import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConfigRequestError,
  applyConfig,
  getConfigCapabilities,
  getConfigTask,
  getCurrentConfig,
  resetConfig,
  saveConfig,
  validateConfig,
} from "./config.api";
import type {
  ConfigCapabilities,
  ConfigIssue,
  ConfigTask,
  ConfigValidationResponse,
  ConfigurationOutcome,
  ConfigurationStatus,
  DeviceConfigValues,
} from "./config.types";

const MAX_TASK_POLLS = 60;
const TASK_POLL_INTERVAL_MS = 1_000;

const cloneValues = (values: DeviceConfigValues) => structuredClone(values);

const formatError = (error: unknown) =>
  error instanceof ConfigRequestError ? error.message : "配置操作失败";

const delay = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });

function validateDraftLocally(
  capabilities: ConfigCapabilities,
  values: DeviceConfigValues,
): ConfigIssue[] {
  const errors: ConfigIssue[] = [];

  const validateStream = (
    field: "video.main" | "video.sub",
    stream: DeviceConfigValues["video"]["main"],
    profiles: ConfigCapabilities["video"]["main"]["profiles"],
  ) => {
    const profile = profiles.find((entry) => entry.id === stream.profile);
    if (profiles.length > 0 && !profile) {
      errors.push({
        field: `${field}.profile`,
        code: "UNSUPPORTED_PROFILE",
        message: "请选择设备支持的分辨率预设",
      });
      return;
    }
    if (!Number.isInteger(stream.fps) || stream.fps <= 0) {
      errors.push({
        field: `${field}.fps`,
        code: "INVALID_FPS",
        message: "帧率必须为正整数",
      });
    } else if (profile && !profile.fps_options.includes(stream.fps)) {
      errors.push({
        field: `${field}.fps`,
        code: "UNSUPPORTED_FPS",
        message: "当前预设不支持此帧率",
      });
    }
    if (!Number.isInteger(stream.bitrate_kbps) || stream.bitrate_kbps <= 0) {
      errors.push({
        field: `${field}.bitrate_kbps`,
        code: "INVALID_BITRATE",
        message: "码率必须为正整数",
      });
    } else if (
      profile &&
      (stream.bitrate_kbps < profile.bitrate_min ||
        stream.bitrate_kbps > profile.bitrate_max)
    ) {
      errors.push({
        field: `${field}.bitrate_kbps`,
        code: "OUT_OF_RANGE",
        message: `码率范围为 ${profile.bitrate_min}-${profile.bitrate_max} Kbps`,
      });
    }
  };

  validateStream("video.main", values.video.main, capabilities.video.main.profiles);
  if (values.video.sub.enabled) {
    validateStream("video.sub", values.video.sub, capabilities.video.sub.profiles);
  }

  const thresholdFields = [
    ["detection.person.threshold", values.detection.person.threshold],
    ["detection.face.threshold", values.detection.face.threshold],
  ] as const;
  thresholdFields.forEach(([field, value]) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors.push({
        field,
        code: "OUT_OF_RANGE",
        message: "阈值必须在 0 到 1 之间",
      });
    }
  });
  if (
    !Number.isFinite(values.detection.motion.sensitivity) ||
    values.detection.motion.sensitivity < 0 ||
    values.detection.motion.sensitivity > 100
  ) {
    errors.push({
      field: "detection.motion.sensitivity",
      code: "OUT_OF_RANGE",
      message: "灵敏度必须在 0 到 100 之间",
    });
  }
  return errors;
}

export function useDeviceConfiguration(apiBaseUrl: string) {
  const [status, setStatus] = useState<ConfigurationStatus>("loading");
  const [capabilities, setCapabilities] = useState<ConfigCapabilities | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [original, setOriginal] = useState<DeviceConfigValues | null>(null);
  const [draft, setDraft] = useState<DeviceConfigValues | null>(null);
  const [validation, setValidation] =
    useState<ConfigValidationResponse | null>(null);
  const [task, setTask] = useState<ConfigTask | null>(null);
  const [outcome, setOutcome] = useState<ConfigurationOutcome | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const operationController = useRef<AbortController | null>(null);

  const hasChanges = useMemo(
    () =>
      original !== null &&
      draft !== null &&
      JSON.stringify(original) !== JSON.stringify(draft),
    [draft, original],
  );

  const beginOperation = useCallback(() => {
    operationController.current?.abort();
    const controller = new AbortController();
    operationController.current = controller;
    return controller;
  }, []);

  const assignDocument = useCallback(
    (document: Awaited<ReturnType<typeof getCurrentConfig>>) => {
      setRevision(document.revision);
      setOriginal(cloneValues(document.values));
      setDraft(cloneValues(document.values));
    },
    [],
  );

  const load = useCallback(async () => {
    const controller = beginOperation();
    setStatus("loading");
    setRequestError(null);
    setOutcome(null);
    setValidation(null);
    setTask(null);
    try {
      const [nextCapabilities, document] = await Promise.all([
        getConfigCapabilities(apiBaseUrl, controller.signal),
        getCurrentConfig(apiBaseUrl, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setCapabilities(nextCapabilities);
      assignDocument(document);
      setStatus("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      setRequestError(formatError(error));
      setStatus("error");
    }
  }, [apiBaseUrl, assignDocument, beginOperation]);

  useEffect(() => {
    void load();
    return () => operationController.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!hasChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasChanges]);

  const updateDraft = useCallback(
    (mutator: (nextDraft: DeviceConfigValues) => void) => {
      setDraft((current) => {
        if (!current) return current;
        const nextDraft = cloneValues(current);
        mutator(nextDraft);
        return nextDraft;
      });
      setValidation(null);
      setOutcome(null);
      setRequestError(null);
    },
    [],
  );

  const pollTask = useCallback(
    async (taskId: number, controller: AbortController) => {
      for (let index = 0; index < MAX_TASK_POLLS; index += 1) {
        if (index > 0) {
          await delay(TASK_POLL_INTERVAL_MS, controller.signal);
        }
        const nextTask = await getConfigTask(
          apiBaseUrl,
          taskId,
          controller.signal,
        );
        setTask(nextTask);
        if (nextTask.state === "failed") return nextTask;
        if (nextTask.state === "succeeded" || nextTask.state === "completed") {
          return nextTask;
        }
      }
      throw new ConfigRequestError("应用任务等待超时");
    },
    [apiBaseUrl],
  );

  const refreshAfterTask = useCallback(
    async (controller: AbortController) => {
      const document = await getCurrentConfig(apiBaseUrl, controller.signal);
      assignDocument(document);
    },
    [apiBaseUrl, assignDocument],
  );

  const saveAndApply = useCallback(async () => {
    if (!capabilities || !draft || !revision || !hasChanges) return;
    const localErrors = validateDraftLocally(capabilities, draft);
    if (localErrors.length > 0) {
      setValidation({ valid: false, errors: localErrors, warnings: [], requires: [] });
      return;
    }

    const controller = beginOperation();
    const payload = { revision, values: cloneValues(draft) };
    setStatus("validating");
    setRequestError(null);
    setOutcome(null);
    setTask(null);
    try {
      const validationResult = await validateConfig(
        apiBaseUrl,
        payload,
        controller.signal,
      );
      setValidation(validationResult);
      if (!validationResult.valid) {
        setStatus("ready");
        return;
      }

      setStatus("saving");
      const saved = await saveConfig(apiBaseUrl, payload, controller.signal);
      if (!saved.saved) throw new ConfigRequestError("设备未保存配置");

      setStatus("applying");
      const taskReference = await applyConfig(
        apiBaseUrl,
        saved.revision,
        controller.signal,
      );
      const completedTask = await pollTask(taskReference.task_id, controller);
      if (completedTask.state === "failed") {
        setOutcome({
          type: "error",
          message: completedTask.message,
          rolledBack: completedTask.rolled_back === true,
        });
        try {
          await refreshAfterTask(controller);
        } catch (error) {
          if (controller.signal.aborted) return;
          setRequestError(`自动回滚后${formatError(error)}`);
        }
        setStatus("ready");
        return;
      }
      try {
        await refreshAfterTask(controller);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRevision(saved.revision);
        setOriginal(cloneValues(payload.values));
        setDraft(cloneValues(payload.values));
        setRequestError(`配置已应用，但${formatError(error)}`);
      }
      setStatus("ready");
      setOutcome({ type: "success", message: completedTask.message || "配置已应用" });
    } catch (error) {
      if (controller.signal.aborted) return;
      setRequestError(formatError(error));
      setStatus("ready");
    }
  }, [
    apiBaseUrl,
    beginOperation,
    capabilities,
    draft,
    hasChanges,
    pollTask,
    refreshAfterTask,
    revision,
  ]);

  const restoreDefaults = useCallback(async () => {
    const controller = beginOperation();
    setStatus("resetting");
    setValidation(null);
    setOutcome(null);
    setRequestError(null);
    setTask(null);
    try {
      const taskReference = await resetConfig(apiBaseUrl, controller.signal);
      setStatus("applying");
      const completedTask = await pollTask(taskReference.task_id, controller);
      if (completedTask.state === "failed") {
        setOutcome({
          type: "error",
          message: completedTask.message,
          rolledBack: completedTask.rolled_back === true,
        });
        try {
          await refreshAfterTask(controller);
        } catch (error) {
          if (controller.signal.aborted) return;
          setRequestError(`自动回滚后${formatError(error)}`);
        }
        setStatus("ready");
        return;
      }
      try {
        await refreshAfterTask(controller);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRequestError(`恢复成功，但${formatError(error)}`);
      }
      setStatus("ready");
      setOutcome({ type: "success", message: completedTask.message || "已恢复默认配置" });
    } catch (error) {
      if (controller.signal.aborted) return;
      setRequestError(formatError(error));
      setStatus("ready");
    }
  }, [apiBaseUrl, beginOperation, pollTask, refreshAfterTask]);

  return {
    status,
    capabilities,
    revision,
    original,
    draft,
    validation,
    task,
    outcome,
    requestError,
    hasChanges,
    load,
    updateDraft,
    saveAndApply,
    restoreDefaults,
    dismissOutcome: () => setOutcome(null),
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowLeft,
  Box,
  CheckCircle2,
  Cpu,
  FileUp,
  Image,
  KeyRound,
  LoaderCircle,
  Mic2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ScanSearch,
  Shapes,
  Trash2,
  X,
} from "lucide-react";
import {
  ModelApiError,
  activateModel,
  cancelModelImport,
  commitModelImport,
  createModelImport,
  deactivateModel,
  deleteModel,
  getModel,
  getModelDeployment,
  getModelImport,
  getModelImporters,
  getModelTask,
  listModels,
  updateModelDeployment,
  uploadModelContent,
} from "./model.api";
import { SUPPORTED_IMPORTERS, supportedImporter } from "./model.importers";
import type {
  DeploymentParameters,
  DeploymentState,
  ImportFormSubmission,
  ImportTask,
  ImporterCatalog,
  ModelAdminCredentials,
  ModelDetail,
  ModelImporter,
  ModelList,
  ModelSummary,
  ModelTask,
  ModelTaskType,
  ModelWorkspaceView,
  RuntimeJsonSchema,
  UploadHandle,
  UploadProgress,
} from "./model.types";

const TASK_POLL_INTERVAL_MS = 1_500;
const IMPORT_STORAGE_PREFIX = "ovis_model_import_ids:";

interface ModelManagerProps {
  apiBaseUrl: string;
  deviceId: string;
  disabled?: boolean;
}

const delay = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });

const importStorageKey = (deviceId: string) => `${IMPORT_STORAGE_PREFIX}${deviceId}`;

const readImportIds = (deviceId: string): string[] => {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(importStorageKey(deviceId)) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const writeImportIds = (deviceId: string, ids: string[]) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    window.localStorage.removeItem(importStorageKey(deviceId));
  } else {
    window.localStorage.setItem(importStorageKey(deviceId), JSON.stringify(unique));
  }
};

const rememberImport = (deviceId: string, importId: string) =>
  writeImportIds(deviceId, [...readImportIds(deviceId), importId]);

const forgetImport = (deviceId: string, importId: string) =>
  writeImportIds(
    deviceId,
    readImportIds(deviceId).filter((id) => id !== importId),
  );

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (seconds: number, locale?: string) =>
  new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));

const taskIcon = (task: ModelTaskType) => {
  if (task === "object_detection") return <ScanSearch size={18} />;
  if (task === "image_classification") return <Image size={18} />;
  if (task === "keypoint_detection") return <Activity size={18} />;
  if (task === "instance_segmentation") return <Shapes size={18} />;
  if (task === "image_feature") return <Cpu size={18} />;
  return <Mic2 size={18} />;
};

const taskTypes: ModelTaskType[] = [
  "object_detection",
  "image_classification",
  "keypoint_detection",
  "instance_segmentation",
  "image_feature",
  "sound_classification",
];

const metadataCount = (model: ModelSummary) =>
  model.metadataSummary.keypointsCount ?? model.metadataSummary.labelsCount ?? 0;

export function ModelManager({ apiBaseUrl, deviceId, disabled = false }: ModelManagerProps) {
  const { t, i18n } = useTranslation();
  const [catalog, setCatalog] = useState<ImporterCatalog | null>(null);
  const [catalogReload, setCatalogReload] = useState(0);
  const [credentials, setCredentials] = useState<ModelAdminCredentials | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [modelList, setModelList] = useState<ModelList | null>(null);
  const [pendingImports, setPendingImports] = useState<ImportTask[]>([]);
  const [view, setView] = useState<ModelWorkspaceView>({ type: "list" });
  const [activeImport, setActiveImport] = useState<ImportTask | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [selectedRetryFile, setSelectedRetryFile] = useState<File | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [deployment, setDeployment] = useState<DeploymentState | null>(null);
  const [deploymentDraft, setDeploymentDraft] = useState<DeploymentParameters | null>(null);
  const [configTask, setConfigTask] = useState<ModelTask | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ModelSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadHandle = useRef<UploadHandle | null>(null);
  const operationController = useRef<AbortController | null>(null);

  const importers = useMemo(
    () =>
      (catalog?.importers ?? []).filter(
        (importer): importer is ModelImporter => Boolean(supportedImporter(importer)),
      ),
    [catalog],
  );

  const importerById = useCallback(
    (id: string) => importers.find((importer) => importer.id === id) ?? null,
    [importers],
  );

  const isDeployable = useCallback(
    (model: ModelDetail | ModelSummary) => {
      const importer = importerById(model.importerId);
      return (
        model.deployable &&
        importer?.deployable === true &&
        importer.runtimeConsumers.length > 0
      );
    },
    [importerById],
  );

  useEffect(() => {
    const controller = new AbortController();
    void getModelImporters(apiBaseUrl, controller.signal)
      .then(setCatalog)
      .catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : String(nextError)),
      );
    return () => controller.abort();
  }, [apiBaseUrl, catalogReload]);

  useEffect(
    () => () => {
      operationController.current?.abort();
      uploadHandle.current?.cancel();
    },
    [],
  );

  const recoverImports = useCallback(
    async (activeCredentials: ModelAdminCredentials) => {
      const ids = readImportIds(deviceId);
      const recovered: ImportTask[] = [];
      await Promise.all(
        ids.map(async (id) => {
          try {
            recovered.push(await getModelImport(apiBaseUrl, activeCredentials, id));
          } catch (nextError) {
            if (!(nextError instanceof ModelApiError) || nextError.status !== 404) {
              return;
            }
            try {
              await getModel(apiBaseUrl, activeCredentials, id);
              forgetImport(deviceId, id);
            } catch {
              // Keep unknown IDs so a temporary manager outage does not lose recovery state.
            }
          }
        }),
      );
      recovered.sort((left, right) => right.createdAt - left.createdAt);
      setPendingImports(recovered);
      if (view.type === "import-task") {
        setActiveImport(recovered.find((task) => task.id === view.importId) ?? null);
      }
    },
    [apiBaseUrl, deviceId, view],
  );

  const refreshModels = useCallback(
    async (activeCredentials = credentials) => {
      if (!activeCredentials) return;
      const nextList = await listModels(apiBaseUrl, activeCredentials);
      setModelList(nextList);
    },
    [apiBaseUrl, credentials],
  );

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextCredentials = { username: username.trim(), password };
    if (!nextCredentials.username || !nextCredentials.password) return;
    setBusy(true);
    setError(null);
    try {
      const nextList = await listModels(apiBaseUrl, nextCredentials);
      setCredentials(nextCredentials);
      setPassword("");
      setModelList(nextList);
      await recoverImports(nextCredentials);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const commitImport = useCallback(
    async (task: ImportTask, activeCredentials: ModelAdminCredentials) => {
      setBusy(true);
      setError(null);
      try {
        let model: ModelDetail;
        try {
          model = await commitModelImport(apiBaseUrl, activeCredentials, task.id);
        } catch (commitError) {
          if (
            !(commitError instanceof ModelApiError) ||
            commitError.status === undefined ||
            commitError.status === 404
          ) {
            model = await getModel(apiBaseUrl, activeCredentials, task.id);
          } else {
            const refreshed = await getModelImport(apiBaseUrl, activeCredentials, task.id);
            setActiveImport(refreshed);
            setPendingImports((current) =>
              current.map((entry) => (entry.id === refreshed.id ? refreshed : entry)),
            );
            throw new ModelApiError(
              refreshed.validationError ?? refreshed.error ?? commitError.message,
              commitError.status,
            );
          }
        }
        forgetImport(deviceId, task.id);
        setPendingImports((current) => current.filter((entry) => entry.id !== task.id));
        setActiveImport(null);
        setDetail(model);
        setView({ type: "detail", modelId: model.id });
        await refreshModels(activeCredentials);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        setBusy(false);
      }
    },
    [apiBaseUrl, deviceId, refreshModels],
  );

  const uploadImport = useCallback(
    async (task: ImportTask, file: File, activeCredentials: ModelAdminCredentials) => {
      if (file.size !== task.fileSize) {
        setError(t("models.fileSizeMismatch"));
        return;
      }
      setBusy(true);
      setError(null);
      setUploadProgress({ loaded: 0, total: file.size, percent: 0 });
      const handle = uploadModelContent(
        apiBaseUrl,
        activeCredentials,
        task.id,
        file,
        setUploadProgress,
      );
      uploadHandle.current = handle;
      try {
        const uploaded = await handle.promise;
        setActiveImport(uploaded);
        setPendingImports((current) => [
          uploaded,
          ...current.filter((entry) => entry.id !== uploaded.id),
        ]);
        setUploadProgress({ loaded: file.size, total: file.size, percent: 100 });
        await commitImport(uploaded, activeCredentials);
      } catch (nextError) {
        if (nextError instanceof DOMException && nextError.name === "AbortError") {
          setError(t("models.uploadCancelled"));
        } else {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
        try {
          const refreshed = await getModelImport(apiBaseUrl, activeCredentials, task.id);
          setActiveImport(refreshed);
          setPendingImports((current) => [
            refreshed,
            ...current.filter((entry) => entry.id !== refreshed.id),
          ]);
        } catch {
          // The original error remains the useful diagnostic.
        }
      } finally {
        uploadHandle.current = null;
        setBusy(false);
      }
    },
    [apiBaseUrl, commitImport, t],
  );

  const startImport = async (submission: ImportFormSubmission) => {
    if (!credentials) return;
    setBusy(true);
    setError(null);
    try {
      const task = await createModelImport(apiBaseUrl, credentials, {
        importerId: submission.importer.id,
        schemaVersion: submission.importer.schemaVersion,
        name: submission.name,
        fileSize: submission.file.size,
        metadata: submission.metadata,
      });
      rememberImport(deviceId, task.id);
      setActiveImport(task);
      setPendingImports((current) => [task, ...current]);
      setView({ type: "import-task", importId: task.id });
      await uploadImport(task, submission.file, credentials);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setBusy(false);
    }
  };

  const openImportTask = (task: ImportTask) => {
    setActiveImport(task);
    setSelectedRetryFile(null);
    setUploadProgress(null);
    setError(null);
    setView({ type: "import-task", importId: task.id });
  };

  const cancelImport = async () => {
    if (!credentials || !activeImport) return;
    uploadHandle.current?.cancel();
    setBusy(true);
    try {
      await cancelModelImport(apiBaseUrl, credentials, activeImport.id);
      forgetImport(deviceId, activeImport.id);
      setPendingImports((current) => current.filter((entry) => entry.id !== activeImport.id));
      setActiveImport(null);
      setView({ type: "list" });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (modelId: string) => {
    if (!credentials) return;
    setBusy(true);
    setError(null);
    try {
      const model = await getModel(apiBaseUrl, credentials, modelId);
      setDetail(model);
      setView({ type: "detail", modelId });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const openDeployment = async (modelId: string) => {
    if (!credentials) return;
    setBusy(true);
    setError(null);
    try {
      const [model, nextDeployment] = await Promise.all([
        getModel(apiBaseUrl, credentials, modelId),
        getModelDeployment(apiBaseUrl, credentials, modelId),
      ]);
      setDetail(model);
      setDeployment(nextDeployment);
      setDeploymentDraft(structuredClone(nextDeployment.parameters));
      setView({ type: "deployment", modelId });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const saveDeployment = async () => {
    if (!credentials || !detail || !deploymentDraft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await updateModelDeployment(
        apiBaseUrl,
        credentials,
        detail.id,
        deploymentDraft,
      );
      setDeployment(saved);
      setDeploymentDraft(structuredClone(saved.parameters));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const inferTaskResult = useCallback(
    async (modelId: string, desiredActive: boolean) => {
      if (!credentials) return false;
      const [model, nextDeployment] = await Promise.all([
        getModel(apiBaseUrl, credentials, modelId),
        getModelDeployment(apiBaseUrl, credentials, modelId),
      ]);
      setDetail(model);
      setDeployment(nextDeployment);
      setDeploymentDraft(structuredClone(nextDeployment.parameters));
      if (!desiredActive) {
        return (
          model.active === false &&
          model.referenced === false &&
          nextDeployment.active === false &&
          nextDeployment.referenced === false &&
          nextDeployment.appliedParameters === null
        );
      }
      return (
        model.active === true &&
        model.referenced === true &&
        nextDeployment.active === true &&
        nextDeployment.referenced === true &&
        JSON.stringify(nextDeployment.appliedParameters) ===
          JSON.stringify(nextDeployment.parameters)
      );
    },
    [apiBaseUrl, credentials],
  );

  const runDeploymentTask = async (desiredActive: boolean) => {
    if (!credentials || !detail) return;
    const controller = new AbortController();
    operationController.current?.abort();
    operationController.current = controller;
    setBusy(true);
    setError(null);
    setConfigTask(null);
    try {
      const accepted = desiredActive
        ? await activateModel(apiBaseUrl, credentials, detail.id, controller.signal)
        : await deactivateModel(apiBaseUrl, credentials, detail.id, controller.signal);
      while (!controller.signal.aborted) {
        try {
          const task = await getModelTask(apiBaseUrl, accepted.task_id, controller.signal);
          setConfigTask(task);
          if (task.state === "failed") throw new ModelApiError(task.message);
          if (task.state === "succeeded") break;
        } catch (nextError) {
          if (!(nextError instanceof ModelApiError) || nextError.status !== 404) {
            throw nextError;
          }
          if (await inferTaskResult(detail.id, desiredActive)) break;
          throw new ModelApiError(t("models.taskOutcomeUnknown"));
        }
        await delay(TASK_POLL_INTERVAL_MS, controller.signal);
      }
      if (!(await inferTaskResult(detail.id, desiredActive))) {
        throw new ModelApiError(t("models.taskOutcomeMismatch"));
      }
      await refreshModels(credentials);
    } catch (nextError) {
      if (!(nextError instanceof DOMException && nextError.name === "AbortError")) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!credentials || !deleteCandidate || deleteCandidate.referenced) return;
    setBusy(true);
    try {
      await deleteModel(apiBaseUrl, credentials, deleteCandidate.id);
      setDeleteCandidate(null);
      await refreshModels(credentials);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const selectedImporter =
    view.type === "import" ? importerById(view.importerId) : null;
  const importerDefinition = selectedImporter
    ? SUPPORTED_IMPORTERS.find((entry) => entry.id === selectedImporter.id)
    : null;
  const ImportForm = importerDefinition?.component;

  if (!catalog) {
    return (
      <div className="models-empty-state">
        {error ? <Box size={20} /> : <LoaderCircle className="button-spinner" size={20} />}
        <span>{error ?? t("models.loadingCapabilities")}</span>
        {error && (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              setError(null);
              setCatalogReload((value) => value + 1);
            }}
          >
            <RefreshCw size={14} />
            {t("common.retry")}
          </button>
        )}
      </div>
    );
  }

  if (!credentials) {
    return (
      <form className="model-auth" onSubmit={authenticate}>
        <div>
          <KeyRound size={18} />
          <span><strong>{t("models.adminAccess")}</strong><small>{t("models.adminAccessDetail")}</small></span>
        </div>
        <label><span>{t("models.username")}</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label><span>{t("models.password")}</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="button button--secondary" type="submit" disabled={busy || disabled}>{busy ? <LoaderCircle className="button-spinner" size={14} /> : <KeyRound size={14} />}{t("models.unlock")}</button>
        {error && <small role="alert">{error}</small>}
      </form>
    );
  }

  return (
    <div className="model-manager" aria-busy={busy}>
      <header className="model-manager__toolbar">
        <div>
          {view.type !== "list" && (
            <button type="button" className="icon-button" title={t("common.back")} onClick={() => setView({ type: "list" })}><ArrowLeft size={15} /></button>
          )}
          <span><strong>{t(`models.views.${view.type}`)}</strong><small>{modelList ? t("models.modelCount", { count: modelList.models.length }) : t("models.loading")}</small></span>
        </div>
        <div>
          <button type="button" className="icon-button" title={t("common.refresh")} disabled={busy || disabled} onClick={() => void Promise.all([refreshModels(), recoverImports(credentials)])}><RefreshCw size={15} /></button>
          {view.type === "list" && <button type="button" className="button button--secondary" disabled={busy || disabled} onClick={() => setView({ type: "choose-task" })}><Plus size={14} />{t("models.addModel")}</button>}
        </div>
      </header>

      {error && <div className="model-error" role="alert"><span>{error}</span><button className="icon-button" type="button" onClick={() => setError(null)}><X size={14} /></button></div>}

      {view.type === "list" && (
        <ModelListView
          models={modelList?.models ?? []}
          pendingImports={pendingImports}
          locale={i18n.language}
          isDeployable={isDeployable}
          onImport={openImportTask}
          onDetail={(id) => void openDetail(id)}
          onDeployment={(id) => void openDeployment(id)}
          onDelete={setDeleteCandidate}
        />
      )}

      {view.type === "choose-task" && (
        <div className="model-choice-grid">
          {taskTypes.map((task) => {
            const available = importers.some((importer) => importer.task === task);
            if (!available) return null;
            return <button type="button" key={task} onClick={() => setView({ type: "choose-importer", task })}>{taskIcon(task)}<strong>{t(`models.tasks.${task}`)}</strong><span>{importers.filter((importer) => importer.task === task).length}</span></button>;
          })}
        </div>
      )}

      {view.type === "choose-importer" && (
        <div className="model-importer-list">
          {importers.filter((importer) => importer.task === view.task).map((importer) => (
            <button type="button" key={importer.id} onClick={() => setView({ type: "import", importerId: importer.id })}><span><strong>{importer.name}</strong><small>{importer.id}</small></span><output>{formatBytes(importer.maxFileSize)}</output></button>
          ))}
        </div>
      )}

      {view.type === "import" && selectedImporter && ImportForm && (
        <ImportForm importer={selectedImporter} availableBytes={Math.min(catalog.availableBytes, selectedImporter.maxFileSize)} disabled={busy || disabled} onSubmit={(submission) => void startImport(submission)} onCancel={() => setView({ type: "choose-importer", task: selectedImporter.task })} />
      )}

      {view.type === "import-task" && activeImport && (
        <ImportTaskView task={activeImport} progress={uploadProgress} file={selectedRetryFile} busy={busy} onFile={setSelectedRetryFile} onRetry={() => { if (selectedRetryFile) void uploadImport(activeImport, selectedRetryFile, credentials); }} onCommit={() => void commitImport(activeImport, credentials)} onCancel={() => void cancelImport()} onCancelUpload={() => uploadHandle.current?.cancel()} />
      )}

      {view.type === "detail" && detail && (
        <ModelDetailView model={detail} importer={importerById(detail.importerId)} locale={i18n.language} deployable={isDeployable(detail)} onDeployment={() => void openDeployment(detail.id)} onDeactivate={() => void runDeploymentTask(false)} onDelete={() => setDeleteCandidate(modelList?.models.find((entry) => entry.id === detail.id) ?? null)} busy={busy || disabled} />
      )}

      {view.type === "deployment" && detail && deployment && deploymentDraft && (
        <ModelDeploymentView model={detail} deployment={deployment} draft={deploymentDraft} task={configTask} busy={busy || disabled} onDraft={setDeploymentDraft} onSave={() => void saveDeployment()} onActivate={() => void runDeploymentTask(true)} onDeactivate={() => void runDeploymentTask(false)} />
      )}

      {deleteCandidate && (
        <div className="model-dialog" role="alertdialog" aria-labelledby="delete-model-title">
          <div><strong id="delete-model-title">{t("models.deleteTitle")}</strong><span>{deleteCandidate.referenced ? t("models.deleteReferenced") : t("models.deleteDetail", { name: deleteCandidate.name })}</span></div>
          <button type="button" className="button button--ghost" onClick={() => setDeleteCandidate(null)}>{t("common.cancel")}</button>
          <button type="button" className="button button--secondary" disabled={deleteCandidate.referenced || busy} onClick={() => void confirmDelete()}><Trash2 size={14} />{t("common.delete")}</button>
        </div>
      )}
    </div>
  );
}

function ModelListView({ models, pendingImports, locale, isDeployable, onImport, onDetail, onDeployment, onDelete }: { models: ModelSummary[]; pendingImports: ImportTask[]; locale: string; isDeployable: (model: ModelSummary) => boolean; onImport: (task: ImportTask) => void; onDetail: (id: string) => void; onDeployment: (id: string) => void; onDelete: (model: ModelSummary) => void }) {
  const { t } = useTranslation();
  return <div className="model-list-view">{pendingImports.length > 0 && <div className="pending-imports"><h5>{t("models.pendingImports")}</h5>{pendingImports.map((task) => <button type="button" key={task.id} onClick={() => onImport(task)}><FileUp size={16} /><span><strong>{task.name}</strong><small>{task.importerId}</small></span><output data-status={task.status}>{t(`models.importStatus.${task.status}`)}</output></button>)}</div>}<div className="model-table"><div className="model-table__head"><span>{t("models.name")}</span><span>{t("models.type")}</span><span>{t("models.size")}</span><span>{t("models.count")}</span><span>{t("models.status")}</span><span>{t("models.created")}</span><span /></div>{models.map((model) => <div className="model-table__row" key={model.id}><button type="button" className="model-table__identity" onClick={() => onDetail(model.id)}><Box size={16} /><span><strong>{model.name}</strong><small>{model.importerId}</small></span></button><span>{model.task}</span><span>{formatBytes(model.fileSize)}</span><span>{metadataCount(model)}</span><span className="model-status-stack"><i data-active={model.active}>{model.active ? t("models.active") : t("models.inactive")}</i><small>{model.referenced ? t("models.referenced") : t("models.unreferenced")}</small></span><span>{formatDate(model.committedAt, locale)}</span><span className="model-table__actions">{isDeployable(model) && <button type="button" className="icon-button" title={t("models.deployment")} onClick={() => onDeployment(model.id)}><Activity size={14} /></button>}<button type="button" className="icon-button" title={model.referenced ? t("models.deleteReferenced") : t("common.delete")} disabled={model.referenced} onClick={() => onDelete(model)}><Trash2 size={14} /></button></span></div>)}{models.length === 0 && <div className="models-empty-state"><Box size={20} /><span>{t("models.empty")}</span></div>}</div></div>;
}

function ImportTaskView({ task, progress, file, busy, onFile, onRetry, onCommit, onCancel, onCancelUpload }: { task: ImportTask; progress: UploadProgress | null; file: File | null; busy: boolean; onFile: (file: File | null) => void; onRetry: () => void; onCommit: () => void; onCancel: () => void; onCancelUpload: () => void }) {
  const { t } = useTranslation();
  const canUpload = task.status === "created" || task.status === "failed";
  return <div className="import-task-view"><header><FileUp size={20} /><span><strong>{task.name}</strong><small>{task.id} · {task.importerId}</small></span><output data-status={task.status}>{t(`models.importStatus.${task.status}`)}</output></header><dl><div><dt>{t("models.size")}</dt><dd>{formatBytes(task.fileSize)}</dd></div><div><dt>{t("models.uploaded")}</dt><dd>{formatBytes(task.uploadedBytes)}</dd></div><div><dt>{t("models.created")}</dt><dd>{formatDate(task.createdAt, undefined)}</dd></div></dl>{progress && <div className="model-upload-progress"><span><span style={{ width: `${progress.percent}%` }} /></span><output>{progress.percent.toFixed(0)}% · {formatBytes(progress.loaded)} / {formatBytes(progress.total)}</output></div>}{(task.error || task.validationError) && <div className="model-validation-error" role="alert">{task.validationError ?? task.error}</div>}{canUpload && <label className="model-retry-file"><span>{t("models.selectFullFile")}</span><input type="file" accept=".bmodel,application/octet-stream" onChange={(event) => onFile(event.target.files?.[0] ?? null)} /><small>{file ? `${file.name} · ${formatBytes(file.size)}` : t("models.noFile")}</small></label>}<footer>{busy && progress && progress.percent < 100 ? <button className="button button--ghost" type="button" onClick={onCancelUpload}><X size={14} />{t("models.cancelUpload")}</button> : <button className="button button--ghost" type="button" disabled={busy} onClick={onCancel}><Trash2 size={14} />{t("models.cancelImport")}</button>}{canUpload && <button className="button button--secondary" type="button" disabled={!file || busy} onClick={onRetry}><RefreshCw size={14} />{t("models.retryFullUpload")}</button>}{task.status === "uploaded" && <button className="button button--primary" type="button" disabled={busy} onClick={onCommit}>{busy ? <LoaderCircle className="button-spinner" size={14} /> : <CheckCircle2 size={14} />}{t("models.validateAndCommit")}</button>}</footer></div>;
}

function ModelDetailView({ model, importer, locale, deployable, onDeployment, onDeactivate, onDelete, busy }: { model: ModelDetail; importer: ModelImporter | null; locale: string; deployable: boolean; onDeployment: () => void; onDeactivate: () => void; onDelete: () => void; busy: boolean }) {
  const { t } = useTranslation();
  return <div className="model-detail-view"><header><Box size={22} /><div><span>{model.importerId}</span><h4>{model.name}</h4><small>{model.id}</small></div><output data-active={model.active}>{model.active ? t("models.active") : t("models.ready")}</output></header><dl><div><dt>{t("models.architecture")}</dt><dd>{model.modelType}</dd></div><div><dt>{t("models.type")}</dt><dd>{model.task}</dd></div><div><dt>{t("models.size")}</dt><dd>{formatBytes(model.fileSize)}</dd></div><div><dt>{t("models.committed")}</dt><dd>{formatDate(model.committedAt, locale)}</dd></div><div><dt>{t("models.checksum")}</dt><dd>{model.checksum ?? "-"}</dd></div><div><dt>{t("models.consumer")}</dt><dd>{importer?.runtimeConsumers.join(", ") || t("models.noConsumer")}</dd></div></dl><div className="model-metadata"><h5>{t("models.metadata")}</h5><pre>{JSON.stringify(model.metadata, null, 2)}</pre></div><footer>{deployable && <button className="button button--secondary" type="button" disabled={busy} onClick={onDeployment}><Activity size={14} />{t("models.deployment")}</button>}{model.active && <button className="button button--ghost" type="button" disabled={busy} onClick={onDeactivate}><Pause size={14} />{t("models.deactivate")}</button>}<button className="button button--ghost" type="button" disabled={busy || model.referenced} onClick={onDelete}><Trash2 size={14} />{t("common.delete")}</button></footer></div>;
}

function ModelDeploymentView({ model, deployment, draft, task, busy, onDraft, onSave, onActivate, onDeactivate }: { model: ModelDetail; deployment: DeploymentState; draft: DeploymentParameters; task: ModelTask | null; busy: boolean; onDraft: (parameters: DeploymentParameters) => void; onSave: () => void; onActivate: () => void; onDeactivate: () => void }) {
  const { t } = useTranslation();
  const schema = deployment.parameterSchema as Record<string, RuntimeJsonSchema>;
  const threshold = schema.threshold ?? {};
  const dirty = JSON.stringify(draft) !== JSON.stringify(deployment.parameters);
  return <div className="model-deployment-view"><header><Activity size={20} /><span><strong>{model.name}</strong><small>{t("models.deploymentDetail")}</small></span><output data-active={deployment.active}>{deployment.active ? t("models.active") : t("models.inactive")}</output></header><label className="model-deployment-field"><span>{t("models.threshold")}</span><input type="range" min={threshold.minimum ?? 0} max={threshold.maximum ?? 1} step={threshold.step ?? 0.01} value={draft.threshold} disabled={busy} onChange={(event) => onDraft({ threshold: Number(event.target.value) })} /><input type="number" min={threshold.minimum ?? 0} max={threshold.maximum ?? 1} step={threshold.step ?? 0.01} value={draft.threshold} disabled={busy} onChange={(event) => onDraft({ threshold: Number(event.target.value) })} /></label><dl><div><dt>{t("models.savedParameters")}</dt><dd>{JSON.stringify(deployment.parameters)}</dd></div><div><dt>{t("models.appliedParameters")}</dt><dd>{deployment.appliedParameters ? JSON.stringify(deployment.appliedParameters) : "-"}</dd></div></dl>{task && <div className="model-task-progress"><span><span style={{ width: `${task.progress}%` }} /></span><output>{task.message} · {task.progress}%</output></div>}<footer><button className="button button--secondary" type="button" disabled={!dirty || busy} onClick={onSave}><Save size={14} />{t("models.saveDeployment")}</button>{deployment.active ? <button className="button button--ghost" type="button" disabled={busy} onClick={onDeactivate}><Pause size={14} />{t("models.deactivate")}</button> : <button className="button button--primary" type="button" disabled={busy || dirty} onClick={onActivate}><Play size={14} />{t("models.activate")}</button>}</footer></div>;
}

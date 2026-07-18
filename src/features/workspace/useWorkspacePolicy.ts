import { useCallback, useEffect, useRef, useState } from "react";
import { checkWorkspacePolicy } from "./workspace-policy.api";
import type {
  UseWorkspacePolicy,
  WorkspacePolicyState,
} from "./workspace-policy.types";

const POLICY_RECHECK_INTERVAL_MS = 2_000;
const DOWNLOAD_TRANSITION_DELAY_MS = 600;
const RESTART_HINT_DELAY_MS = 60_000;
const WAITING_STORAGE_KEY = "ovis_workspace_policy_waiting";

const readWaitingState = () => {
  try {
    return window.sessionStorage.getItem(WAITING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export function useWorkspacePolicy(): UseWorkspacePolicy {
  const [state, setState] = useState<WorkspacePolicyState>("checking");
  const [longWaiting, setLongWaiting] = useState(false);
  const waitingRef = useRef(readWaitingState());
  const checkGeneration = useRef(0);
  const downloadTransition = useRef<number | null>(null);

  const check = useCallback(async () => {
    const generation = ++checkGeneration.current;
    const result = await checkWorkspacePolicy();
    if (generation !== checkGeneration.current) return;

    if (result.state === "ready") {
      waitingRef.current = false;
      setLongWaiting(false);
      try {
        window.sessionStorage.removeItem(WAITING_STORAGE_KEY);
      } catch {
        // A ready policy is sufficient when storage is unavailable.
      }
      setState("ready");
      return;
    }

    setState(waitingRef.current ? "waiting" : result.state);
  }, []);

  const startInstallation = useCallback(() => {
    waitingRef.current = true;
    setLongWaiting(false);
    setState("downloading");
    try {
      window.sessionStorage.setItem(WAITING_STORAGE_KEY, "1");
    } catch {
      // Polling remains active without persistence.
    }
    if (downloadTransition.current !== null) {
      window.clearTimeout(downloadTransition.current);
    }
    downloadTransition.current = window.setTimeout(() => {
      downloadTransition.current = null;
      setState((current) => current === "downloading" ? "waiting" : current);
    }, DOWNLOAD_TRANSITION_DELAY_MS);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (waitingRef.current && document.visibilityState === "visible") {
        void check();
      }
    }, POLICY_RECHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [check]);

  useEffect(() => () => {
    if (downloadTransition.current !== null) {
      window.clearTimeout(downloadTransition.current);
    }
  }, []);

  useEffect(() => {
    if (state !== "waiting") return;
    const restartHint = window.setTimeout(
      () => setLongWaiting(true),
      RESTART_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(restartHint);
  }, [state]);

  useEffect(() => {
    const checkWhenActive = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", checkWhenActive);
    window.addEventListener("pageshow", checkWhenActive);
    document.addEventListener("visibilitychange", checkWhenActive);
    return () => {
      window.removeEventListener("focus", checkWhenActive);
      window.removeEventListener("pageshow", checkWhenActive);
      document.removeEventListener("visibilitychange", checkWhenActive);
    };
  }, [check]);

  return { state, longWaiting, check, startInstallation };
}

export const PENDING_MODEL_TASK_KEY = "ovis_pending_model_task";

export interface PendingModelTask {
  task_id: number;
  model_id: string;
  device_id: string;
  api_base_url: string;
  started_at: number;
  desired_active: boolean;
}

const isPendingModelTask = (value: unknown): value is PendingModelTask => {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return (
    Number.isInteger(task.task_id) &&
    typeof task.model_id === "string" &&
    task.model_id.length > 0 &&
    typeof task.device_id === "string" &&
    task.device_id.length > 0 &&
    typeof task.api_base_url === "string" &&
    task.api_base_url.length > 0 &&
    typeof task.started_at === "number" &&
    Number.isFinite(task.started_at) &&
    typeof task.desired_active === "boolean"
  );
};

export function readPendingModelTask(): PendingModelTask | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(PENDING_MODEL_TASK_KEY) ?? "null",
    );
    if (isPendingModelTask(value)) return value;
  } catch {
    // Invalid recovery state is discarded below.
  }
  window.sessionStorage.removeItem(PENDING_MODEL_TASK_KEY);
  return null;
}

export function writePendingModelTask(task: PendingModelTask): void {
  window.sessionStorage.setItem(PENDING_MODEL_TASK_KEY, JSON.stringify(task));
}

export function clearPendingModelTask(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_MODEL_TASK_KEY);
}

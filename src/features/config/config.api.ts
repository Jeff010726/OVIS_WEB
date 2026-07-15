import type {
  ConfigCapabilities,
  ConfigPayload,
  ConfigTask,
  ConfigTaskReference,
  ConfigValidationResponse,
  DeviceConfigDocument,
  SaveConfigResponse,
} from "./config.types";

const REQUEST_TIMEOUT_MS = 5_000;

type LocalRequestInit = RequestInit & {
  targetAddressSpace: "local";
};

interface ConfigRequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
}

export class ConfigRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ConfigRequestError";
  }
}

async function requestConfigApi<T>(
  apiBaseUrl: string,
  path: string,
  options: ConfigRequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromParent = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromParent, { once: true });

  const requestOptions: LocalRequestInit = {
    method: options.method ?? "GET",
    mode: "cors",
    cache: "no-store",
    targetAddressSpace: "local",
    signal: controller.signal,
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  };

  try {
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, "")}${path}`,
      requestOptions,
    );
    if (!response.ok) {
      throw new ConfigRequestError(
        `设备接口返回 HTTP ${response.status}`,
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ConfigRequestError("设备返回了无效的配置数据");
    }
  } catch (error) {
    if (error instanceof ConfigRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ConfigRequestError("配置请求超时");
    }
    throw new ConfigRequestError("无法访问设备配置接口");
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}

export const getConfigCapabilities = (
  apiBaseUrl: string,
  signal?: AbortSignal,
) =>
  requestConfigApi<ConfigCapabilities>(apiBaseUrl, "/config/capabilities", {
    signal,
  });

export const getCurrentConfig = (apiBaseUrl: string, signal?: AbortSignal) =>
  requestConfigApi<DeviceConfigDocument>(apiBaseUrl, "/config", { signal });

export const validateConfig = (
  apiBaseUrl: string,
  payload: ConfigPayload,
  signal?: AbortSignal,
) =>
  requestConfigApi<ConfigValidationResponse>(apiBaseUrl, "/config/validate", {
    method: "POST",
    body: payload,
    signal,
  });

export const saveConfig = (
  apiBaseUrl: string,
  payload: ConfigPayload,
  signal?: AbortSignal,
) =>
  requestConfigApi<SaveConfigResponse>(apiBaseUrl, "/config", {
    method: "PUT",
    body: payload,
    signal,
  });

export const applyConfig = (
  apiBaseUrl: string,
  revision: string,
  signal?: AbortSignal,
) =>
  requestConfigApi<ConfigTaskReference>(apiBaseUrl, "/config/apply", {
    method: "POST",
    body: { revision },
    signal,
  });

export const getConfigTask = (
  apiBaseUrl: string,
  taskId: number,
  signal?: AbortSignal,
) => requestConfigApi<ConfigTask>(apiBaseUrl, `/tasks/${taskId}`, { signal });

export const resetConfig = (apiBaseUrl: string, signal?: AbortSignal) =>
  requestConfigApi<ConfigTaskReference>(apiBaseUrl, "/config/reset", {
    method: "POST",
    signal,
  });

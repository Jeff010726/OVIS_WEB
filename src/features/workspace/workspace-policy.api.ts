import type {
  OvisWorkspacePolicy,
  WorkspacePolicyCheck,
} from "./workspace-policy.types";

export const WORKSPACE_POLICY_MIN_VERSION = 1;
export const OVIS_WEBUSB_VENDOR_ID = 0x3346;
export const OVIS_WEBUSB_PRODUCT_ID = 0x100e;

export const WORKSPACE_POLICY_KEYS = [
  "ovis_workspace_policy_version",
  "webusb_vendor_id",
  "webusb_product_id",
  "allowed_origin",
] as const;

type ManagedConfiguration = Record<string, unknown>;

interface ManagedConfigurationProvider {
  getManagedConfiguration(
    keys?: readonly string[],
  ): Promise<ManagedConfiguration>;
}

type NavigatorWithManagedConfiguration = Navigator & {
  managed?: ManagedConfigurationProvider;
  device?: ManagedConfigurationProvider;
  usb?: unknown;
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>;
  };
};

const navigatorWithPolicy = () =>
  navigator as NavigatorWithManagedConfiguration;

function isSupportedChromiumBrowser() {
  const currentNavigator = navigatorWithPolicy();
  const brands = currentNavigator.userAgentData?.brands ?? [];
  if (brands.length > 0) {
    return brands.some(({ brand }) =>
      /Google Chrome|Microsoft Edge/i.test(brand) ||
      (import.meta.env.DEV && /^Chromium$/i.test(brand)),
    );
  }
  return /(?:Chrome|CriOS)\//.test(navigator.userAgent) ||
    /(?:Edg|EdgiOS|EdgA)\//.test(navigator.userAgent);
}

function managedConfigurationProvider() {
  const currentNavigator = navigatorWithPolicy();
  return currentNavigator.managed ?? currentNavigator.device;
}

function developmentPolicyMock(): WorkspacePolicyCheck | null {
  if (!import.meta.env.DEV) return null;
  const state = import.meta.env.VITE_WORKSPACE_POLICY_MOCK;
  if (!state) return null;
  if (state === "ready") {
    return {
      state: "ready",
      policy: {
        ovis_workspace_policy_version: WORKSPACE_POLICY_MIN_VERSION,
        webusb_vendor_id: OVIS_WEBUSB_VENDOR_ID,
        webusb_product_id: OVIS_WEBUSB_PRODUCT_ID,
        allowed_origin: window.location.origin,
      },
    };
  }
  if (
    state === "missing" ||
    state === "outdated" ||
    state === "unsupported" ||
    state === "error"
  ) {
    return { state, policy: null };
  }
  return null;
}

function normalizePolicy(
  value: ManagedConfiguration,
): Partial<OvisWorkspacePolicy> {
  const policy: Partial<OvisWorkspacePolicy> = {};
  const version = value.ovis_workspace_policy_version;
  const vendorId = value.webusb_vendor_id;
  const productId = value.webusb_product_id;
  const allowedOrigin = value.allowed_origin;

  if (typeof version === "number") {
    policy.ovis_workspace_policy_version = version;
  }
  if (typeof vendorId === "number") policy.webusb_vendor_id = vendorId;
  if (typeof productId === "number") policy.webusb_product_id = productId;
  if (typeof allowedOrigin === "string") policy.allowed_origin = allowedOrigin;
  return policy;
}

export async function checkWorkspacePolicy(): Promise<WorkspacePolicyCheck> {
  const mock = developmentPolicyMock();
  if (mock) return mock;
  if (
    !window.isSecureContext ||
    navigatorWithPolicy().usb === undefined ||
    !isSupportedChromiumBrowser()
  ) {
    return { state: "unsupported", policy: null };
  }

  const provider = managedConfigurationProvider();
  if (!provider) return { state: "missing", policy: null };

  try {
    const value = await provider.getManagedConfiguration(
      WORKSPACE_POLICY_KEYS,
    );
    const policy = normalizePolicy(value ?? {});
    const version = policy.ovis_workspace_policy_version;
    if (version === undefined) return { state: "missing", policy };
    if (version < WORKSPACE_POLICY_MIN_VERSION) {
      return { state: "outdated", policy };
    }
    if (
      policy.webusb_vendor_id !== OVIS_WEBUSB_VENDOR_ID ||
      policy.webusb_product_id !== OVIS_WEBUSB_PRODUCT_ID ||
      policy.allowed_origin !== window.location.origin
    ) {
      return { state: "missing", policy };
    }
    return { state: "ready", policy };
  } catch {
    return { state: "error", policy: null };
  }
}

export type WorkspacePolicyState =
  | "checking"
  | "missing"
  | "outdated"
  | "waiting"
  | "ready"
  | "unsupported"
  | "error";

export interface OvisWorkspacePolicy {
  ovis_workspace_policy_version: number;
  webusb_vendor_id: number;
  webusb_product_id: number;
  allowed_origin: string;
}

export interface WorkspacePolicyCheck {
  state: Exclude<WorkspacePolicyState, "checking" | "waiting">;
  policy: Partial<OvisWorkspacePolicy> | null;
}

export interface UseWorkspacePolicy {
  state: WorkspacePolicyState;
  longWaiting: boolean;
  check(): Promise<void>;
  startInstallation(): void;
}

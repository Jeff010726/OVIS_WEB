import type { components } from "./model.openapi";

type Schemas = components["schemas"];

export type ImporterCatalog = Schemas["ImporterCatalog"];
export type ModelImporter = Schemas["ModelImporter"];
export type ModelImporterId = ModelImporter["id"];
export type ModelTaskType = ModelImporter["task"];
export type CreateImportRequest = Schemas["CreateImportRequest"];
export type ImportMetadata = Schemas["ImportMetadata"];
export type ImportTask = Schemas["ImportTask"];
export type ModelList = Schemas["ModelList"];
export type ModelSummary = Schemas["ModelSummary"];
export type ModelDetail = Schemas["ModelDetail"];
export type DeploymentState = Schemas["DeploymentState"];
export type DeploymentParameters = Schemas["DetectionDeploymentParameters"];
export type AcceptedTask = Schemas["AcceptedTask"];
export type ModelTask = Schemas["Task"];

export interface ModelAdminCredentials {
  username: string;
  password: string;
}

export interface RuntimeJsonSchema {
  type?: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, RuntimeJsonSchema>;
  items?: RuntimeJsonSchema;
  allOf?: RuntimeJsonSchema[];
  enum?: Array<string | number | boolean>;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  uniqueItems?: boolean;
  pattern?: string;
  step?: number;
  description?: string;
}

export interface ImportFormSubmission {
  importer: ModelImporter;
  name: string;
  file: File;
  metadata: ImportMetadata;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadHandle {
  promise: Promise<ImportTask>;
  cancel(): void;
}

export type ModelWorkspaceView =
  | { type: "list" }
  | { type: "choose-task" }
  | { type: "choose-importer"; task: ModelTaskType }
  | { type: "import"; importerId: ModelImporterId }
  | { type: "import-task"; importId: string }
  | { type: "detail"; modelId: string }
  | { type: "deployment"; modelId: string };

import { invoke } from "@tauri-apps/api/core";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface InspectionAction {
  id: string;
  description: string;
  backend_id: string;
  method: string;
  path: string;
  query: Record<string, string>;
  success_statuses: number[];
}

export interface InspectionVerification {
  action_id: string;
  attempts: number;
  delay_ms: number;
  success_delay_ms: number;
}

export interface InspectionBackend {
  id: string;
  backend_type: string;
  base_url: string;
}

export interface InspectionCapability {
  id: string;
  tool_name: string;
  description: string;
  input_schema: unknown;
  input_schema_keys: string[];
  main_action_id: string;
  actions: InspectionAction[];
  verification: InspectionVerification | null;
}

export interface McpServerMetadata {
  name: string;
  version: string;
  title: string;
  description: string;
  website_url: string;
  instructions: string;
}

export interface NamedValue {
  name: string;
  value: string;
}

export interface ProductHttpSettings {
  version: string;
  tls_enabled: boolean;
  mandatory_headers: NamedValue[];
}

export interface ProductUartSettings {
  baud_rate: number | null;
  port: string;
  framing: string;
}

export interface ProjectInspection {
  name: string;
  description: string;
  mcp_transports: string[];
  product_connector: string;
  product_name: string;
  product_image_path: string;
  product_category_icon: string;
  product_http: ProductHttpSettings;
  product_uart: ProductUartSettings;
  mcp_server: McpServerMetadata;
  source_path: string;
  backends: InspectionBackend[];
  capabilities: InspectionCapability[];
}

export interface ProjectDocument {
  path: string;
  file_name: string;
  display_name: string;
  description: string;
  server_runnable: boolean;
  mcp_transports: string[];
  product_connector: string;
  product_name: string;
  product_image_path: string;
  product_category_icon: string;
  product_http: ProductHttpSettings;
  product_uart: ProductUartSettings;
  mcp_server: McpServerMetadata;
  contents: string;
  parse_error: string;
  backend_count: number;
  capability_count: number;
  validation: ValidationResult;
  inspection: ProjectInspection | null;
}

export interface ProjectSummary {
  path: string;
  file_name: string;
  display_name: string;
  description: string;
  server_runnable: boolean;
  mcp_transports: string[];
  product_connector: string;
  product_name: string;
  product_image_path: string;
  product_category_icon: string;
  parse_error: string;
  backend_count: number;
  capability_count: number;
  validation: ValidationResult;
  modified_at_ms: number | null;
}

export interface ProjectMetadataUpdate {
  project_name: string;
  project_description: string;
  mcp_transports: string[];
  product_connector: string;
  product_name: string;
  product_image_path: string;
  product_category_icon: string;
  product_http_version: string;
  product_http_tls_enabled: boolean;
  product_http_mandatory_headers: NamedValue[];
  product_uart_baud_rate: number | null;
  product_uart_port: string;
  product_uart_framing: string;
  mcp_name: string;
  mcp_version: string;
  mcp_title: string;
  mcp_description: string;
  mcp_website_url: string;
  mcp_instructions: string;
}

export interface NewProjectPreview {
  friendly_name: string;
  filesystem_name: string;
  file_name: string;
  mcp_server_name: string;
  directory: string;
  target_path: string;
}

export interface NewProjectRequest {
  friendly_name: string;
  directory: string;
}

export interface ToolSummary {
  capability_id: string;
  tool_name: string;
  description: string;
  input_schema: unknown;
}

export interface ToolList {
  tools: ToolSummary[];
}

export interface RuntimeStatusPayload {
  running: boolean;
  tool_count?: number;
  listen_url?: string;
}

export interface EventBatch {
  events: unknown[];
}

export async function openProjectDocument(): Promise<ProjectDocument | null> {
  return invoke<ProjectDocument | null>("open_project_document");
}

export async function openProjectDocumentAtPath(path: string): Promise<ProjectDocument> {
  return invoke<ProjectDocument>("open_project_document_at_path", { path });
}

export async function closeActiveProjectDocument(): Promise<void> {
  return invoke<void>("close_active_project_document");
}

export async function getNewProjectPreview(
  friendlyName: string,
  directory?: string | null,
): Promise<NewProjectPreview> {
  return invoke<NewProjectPreview>("get_new_project_preview", {
    friendlyName,
    directory,
  });
}

export async function pickProjectDirectory(
  directory?: string | null,
): Promise<string | null> {
  return invoke<string | null>("pick_project_directory", { directory });
}

export async function createProjectDocumentWithOptions(
  request: NewProjectRequest,
): Promise<ProjectDocument> {
  return invoke<ProjectDocument>("create_project_document_with_options", { request });
}

export async function deleteProjectDocument(path: string): Promise<void> {
  return invoke<void>("delete_project_document", { path });
}

export async function summarizeRecentProjects(
  paths: string[],
): Promise<ProjectSummary[]> {
  return invoke<ProjectSummary[]>("summarize_recent_projects", { paths });
}

export async function startActiveRuntime(): Promise<RuntimeStatusPayload> {
  return invoke<RuntimeStatusPayload>("start_active_runtime");
}

export async function stopActiveRuntime(): Promise<RuntimeStatusPayload> {
  return invoke<RuntimeStatusPayload>("stop_active_runtime");
}

export async function drainCoreEvents(): Promise<EventBatch> {
  return invoke<EventBatch>("drain_core_events");
}

export async function updateProjectMetadata(
  update: ProjectMetadataUpdate,
): Promise<ProjectDocument> {
  return invoke<ProjectDocument>("update_project_metadata", { update });
}

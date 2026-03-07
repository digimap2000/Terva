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

export interface ProjectInspection {
  name: string;
  description: string;
  source_path: string;
  backends: InspectionBackend[];
  capabilities: InspectionCapability[];
}

export interface ProjectDocument {
  path: string;
  file_name: string;
  display_name: string;
  description: string;
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
  parse_error: string;
  backend_count: number;
  capability_count: number;
  validation: ValidationResult;
  modified_at_ms: number | null;
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

export async function createProjectDocument(): Promise<ProjectDocument | null> {
  return invoke<ProjectDocument | null>("create_project_document");
}

export async function summarizeRecentProjects(
  paths: string[],
): Promise<ProjectSummary[]> {
  return invoke<ProjectSummary[]>("summarize_recent_projects", { paths });
}

export async function closeActiveProject(): Promise<void> {
  return invoke<void>("close_active_project");
}

export async function validateActiveProject(): Promise<ValidationResult> {
  return invoke<ValidationResult>("validate_active_project");
}

export async function inspectActiveProject(): Promise<ProjectInspection> {
  return invoke<ProjectInspection>("inspect_active_project");
}

export async function listActiveTools(): Promise<ToolList> {
  return invoke<ToolList>("list_active_tools");
}

export async function startActiveRuntime(): Promise<RuntimeStatusPayload> {
  return invoke<RuntimeStatusPayload>("start_active_runtime");
}

export async function stopActiveRuntime(): Promise<RuntimeStatusPayload> {
  return invoke<RuntimeStatusPayload>("stop_active_runtime");
}

export async function invokeActiveTool(
  toolName: string,
  inputJson: string,
): Promise<unknown> {
  return invoke("invoke_active_tool", { toolName, inputJson });
}

export async function drainCoreEvents(): Promise<EventBatch> {
  return invoke<EventBatch>("drain_core_events");
}

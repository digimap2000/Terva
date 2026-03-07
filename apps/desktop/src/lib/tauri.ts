import { invoke } from "@tauri-apps/api/core";

export interface ProjectDocument {
  path: string;
  file_name: string;
  display_name: string;
  contents: string;
}

export interface ProjectSummary {
  path: string;
  file_name: string;
  display_name: string;
  description: string | null;
  backend_count: number;
  capability_count: number;
  modified_at_ms: number | null;
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

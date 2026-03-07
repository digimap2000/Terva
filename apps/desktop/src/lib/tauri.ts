import { invoke } from "@tauri-apps/api/core";

export interface ProjectDocument {
  path: string;
  file_name: string;
  display_name: string;
  contents: string;
}

export async function openProjectDocument(): Promise<ProjectDocument | null> {
  return invoke<ProjectDocument | null>("open_project_document");
}

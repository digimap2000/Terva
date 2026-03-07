mod error;
mod project;

use error::TervaError;
use project::{ProjectDocument, ProjectSummary};

#[tauri::command]
async fn open_project_document() -> Result<Option<ProjectDocument>, TervaError> {
    project::pick_project_document().await
}

#[tauri::command]
async fn open_project_document_at_path(path: String) -> Result<ProjectDocument, TervaError> {
    project::open_project_document_at_path(path).await
}

#[tauri::command]
async fn create_project_document() -> Result<Option<ProjectDocument>, TervaError> {
    project::create_project_document().await
}

#[tauri::command]
async fn summarize_recent_projects(paths: Vec<String>) -> Vec<ProjectSummary> {
    project::summarize_recent_projects(paths).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_project_document,
            open_project_document,
            open_project_document_at_path,
            summarize_recent_projects
        ])
        .run(tauri::generate_context!())
        .expect("error while running Terva");
}

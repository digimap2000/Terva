mod error;
mod project;

use error::TervaError;
use project::ProjectDocument;

#[tauri::command]
async fn open_project_document() -> Result<Option<ProjectDocument>, TervaError> {
    project::pick_project_document().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_project_document])
        .run(tauri::generate_context!())
        .expect("error while running Terva");
}

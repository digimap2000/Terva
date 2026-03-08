mod bridge;
mod error;
mod project;

use error::TervaError;
use project::{
    CoreBridge, EventBatch, NewProjectPreview, NewProjectRequest, ProjectDocument,
    ProjectMetadataUpdate, ProjectSummary, RuntimeStatusPayload,
};
use tauri::State;

fn apply_launch_arguments(bridge: &CoreBridge) {
    let mut args = std::env::args().skip(1);
    let mut open_path: Option<String> = None;
    let mut start_server = false;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--open" => {
                if let Some(path) = args.next() {
                    open_path = Some(path);
                }
            }
            "--start-server" => {
                start_server = true;
            }
            _ => {}
        }
    }

    if let Some(path) = open_path {
        if let Err(error) = project::open_project_document_at_path(bridge, path) {
            eprintln!("{error}");
            return;
        }
    }

    if start_server {
        if let Err(error) = bridge.start_runtime() {
            eprintln!("{error}");
        }
    }
}

#[tauri::command]
async fn open_project_document(
    bridge: State<'_, CoreBridge>,
) -> Result<Option<ProjectDocument>, TervaError> {
    project::pick_project_document(bridge.inner()).await
}

#[tauri::command]
async fn open_project_document_at_path(
    bridge: State<'_, CoreBridge>,
    path: String,
) -> Result<ProjectDocument, TervaError> {
    project::open_project_document_at_path(bridge.inner(), path)
}

#[tauri::command]
fn get_new_project_preview(friendly_name: String, directory: Option<String>) -> NewProjectPreview {
    project::get_new_project_preview(friendly_name, directory)
}

#[tauri::command]
async fn pick_project_directory(directory: Option<String>) -> Option<String> {
    project::pick_project_directory(directory).await
}

#[tauri::command]
async fn create_project_document_with_options(
    bridge: State<'_, CoreBridge>,
    request: NewProjectRequest,
) -> Result<ProjectDocument, TervaError> {
    project::create_project_document(bridge.inner(), request).await
}

#[tauri::command]
fn summarize_recent_projects(
    bridge: State<'_, CoreBridge>,
    paths: Vec<String>,
) -> Vec<ProjectSummary> {
    project::summarize_recent_projects(bridge.inner(), paths)
}

#[tauri::command]
fn start_active_runtime(bridge: State<'_, CoreBridge>) -> Result<RuntimeStatusPayload, TervaError> {
    bridge.inner().start_runtime()
}

#[tauri::command]
fn stop_active_runtime(bridge: State<'_, CoreBridge>) -> Result<RuntimeStatusPayload, TervaError> {
    bridge.inner().stop_runtime()
}

#[tauri::command]
fn drain_core_events(bridge: State<'_, CoreBridge>) -> Result<EventBatch, TervaError> {
    bridge.inner().drain_events()
}

#[tauri::command]
fn update_project_metadata(
    bridge: State<'_, CoreBridge>,
    update: ProjectMetadataUpdate,
) -> Result<ProjectDocument, TervaError> {
    project::update_project_metadata(bridge.inner(), update)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let bridge = CoreBridge::new();
    apply_launch_arguments(&bridge);

    tauri::Builder::default()
        .manage(bridge)
        .invoke_handler(tauri::generate_handler![
            create_project_document_with_options,
            drain_core_events,
            get_new_project_preview,
            open_project_document,
            open_project_document_at_path,
            pick_project_directory,
            start_active_runtime,
            stop_active_runtime,
            summarize_recent_projects,
            update_project_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running Terva");
}

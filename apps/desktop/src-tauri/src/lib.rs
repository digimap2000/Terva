mod bridge;
mod error;
mod project;

use error::TervaError;
use project::{
    CoreBridge, EventBatch, ProjectDocument, ProjectInspection, ProjectSummary,
    RuntimeStatusPayload, ToolList, ValidationResult,
};
use serde_json::Value;
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
async fn create_project_document(
    bridge: State<'_, CoreBridge>,
) -> Result<Option<ProjectDocument>, TervaError> {
    project::create_project_document(bridge.inner()).await
}

#[tauri::command]
fn summarize_recent_projects(
    bridge: State<'_, CoreBridge>,
    paths: Vec<String>,
) -> Vec<ProjectSummary> {
    project::summarize_recent_projects(bridge.inner(), paths)
}

#[tauri::command]
fn close_active_project(bridge: State<'_, CoreBridge>) -> Result<(), TervaError> {
    bridge.inner().close_document()
}

#[tauri::command]
fn validate_active_project(bridge: State<'_, CoreBridge>) -> Result<ValidationResult, TervaError> {
    bridge.inner().validate_active_document()
}

#[tauri::command]
fn inspect_active_project(bridge: State<'_, CoreBridge>) -> Result<ProjectInspection, TervaError> {
    bridge.inner().inspect_active_document()
}

#[tauri::command]
fn list_active_tools(bridge: State<'_, CoreBridge>) -> Result<ToolList, TervaError> {
    bridge.inner().list_tools()
}

#[tauri::command]
fn start_active_runtime(
    bridge: State<'_, CoreBridge>,
) -> Result<RuntimeStatusPayload, TervaError> {
    bridge.inner().start_runtime()
}

#[tauri::command]
fn stop_active_runtime(
    bridge: State<'_, CoreBridge>,
) -> Result<RuntimeStatusPayload, TervaError> {
    bridge.inner().stop_runtime()
}

#[tauri::command]
fn invoke_active_tool(
    bridge: State<'_, CoreBridge>,
    tool_name: String,
    input_json: String,
) -> Result<Value, TervaError> {
    bridge.inner().invoke_tool(&tool_name, &input_json)
}

#[tauri::command]
fn drain_core_events(bridge: State<'_, CoreBridge>) -> Result<EventBatch, TervaError> {
    bridge.inner().drain_events()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let bridge = CoreBridge::new();
    apply_launch_arguments(&bridge);

    tauri::Builder::default()
        .manage(bridge)
        .invoke_handler(tauri::generate_handler![
            create_project_document,
            close_active_project,
            drain_core_events,
            inspect_active_project,
            invoke_active_tool,
            list_active_tools,
            open_project_document,
            open_project_document_at_path,
            start_active_runtime,
            stop_active_runtime,
            summarize_recent_projects,
            validate_active_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running Terva");
}

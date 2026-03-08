use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use cxx::UniquePtr;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::bridge::ffi::{new_desktop_core, DesktopCore};
use crate::error::TervaError;

pub struct CoreBridge {
    core: Mutex<UniquePtr<DesktopCore>>,
}

unsafe impl Send for CoreBridge {}
unsafe impl Sync for CoreBridge {}

impl CoreBridge {
    pub fn new() -> Self {
        Self {
            core: Mutex::new(new_desktop_core()),
        }
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, UniquePtr<DesktopCore>>, TervaError> {
        self.core
            .lock()
            .map_err(|_| TervaError::Project("Core bridge lock was poisoned".to_string()))
    }

    pub fn open_document(&self, path: &Path) -> Result<ProjectDocument, TervaError> {
        let mut core = self.lock()?;
        let rendered_path = path.display().to_string();
        let raw = core.pin_mut().open_document(&rendered_path);
        decode_payload::<ProjectDocument>(&raw)
    }

    pub fn summarize_document(&self, path: &Path) -> Result<ProjectSummary, TervaError> {
        let core = self.lock()?;
        let rendered_path = path.display().to_string();
        let raw = core.summarize_document(&rendered_path);
        let mut summary: ProjectSummary = decode_payload(&raw)?;
        summary.modified_at_ms = std::fs::metadata(path)
            .ok()
            .and_then(|value| value.modified().ok())
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_millis() as u64);
        Ok(summary)
    }

    pub fn start_runtime(&self) -> Result<RuntimeStatusPayload, TervaError> {
        let mut core = self.lock()?;
        let raw = core.pin_mut().start_runtime();
        decode_payload(&raw)
    }

    pub fn stop_runtime(&self) -> Result<RuntimeStatusPayload, TervaError> {
        let mut core = self.lock()?;
        let raw = core.pin_mut().stop_runtime();
        decode_payload(&raw)
    }

    pub fn drain_events(&self) -> Result<EventBatch, TervaError> {
        let mut core = self.lock()?;
        let raw = core.pin_mut().drain_events();
        decode_payload(&raw)
    }

    pub fn update_project_metadata(
        &self,
        update: &ProjectMetadataUpdate,
    ) -> Result<ProjectDocument, TervaError> {
        let mut core = self.lock()?;
        let payload = serde_json::to_string(update).map_err(|error| {
            TervaError::Project(format!("Failed to encode metadata update: {error}"))
        })?;
        let raw = core.pin_mut().update_project_metadata(&payload);
        decode_payload(&raw)
    }
}

#[derive(Debug, Deserialize)]
struct CoreEnvelope<T> {
    ok: bool,
    payload: Option<T>,
    error: Option<String>,
}

fn decode_payload<T: DeserializeOwned>(raw: &str) -> Result<T, TervaError> {
    let envelope: CoreEnvelope<T> = serde_json::from_str(raw).map_err(|error| {
        TervaError::Project(format!("Failed to decode core response: {error}"))
    })?;
    if !envelope.ok {
        return Err(TervaError::Project(
            envelope
                .error
                .unwrap_or_else(|| "Core call failed without an error".to_string()),
        ));
    }
    envelope
        .payload
        .ok_or_else(|| TervaError::Project("Core response was missing a payload".to_string()))
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpServerMetadata {
    pub name: String,
    pub version: String,
    pub title: String,
    pub description: String,
    pub website_url: String,
    pub instructions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDocument {
    pub path: String,
    pub file_name: String,
    pub display_name: String,
    pub description: String,
    #[serde(default)]
    pub project_type: String,
    #[serde(default)]
    pub mcp_server: McpServerMetadata,
    pub contents: String,
    pub parse_error: String,
    pub backend_count: usize,
    pub capability_count: usize,
    pub validation: serde_json::Value,
    pub inspection: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub path: String,
    pub file_name: String,
    pub display_name: String,
    pub description: String,
    #[serde(default)]
    pub project_type: String,
    pub parse_error: String,
    pub backend_count: usize,
    pub capability_count: usize,
    pub validation: serde_json::Value,
    pub modified_at_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeStatusPayload {
    pub running: bool,
    pub tool_count: Option<usize>,
    pub listen_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBatch {
    pub events: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadataUpdate {
    pub project_name: String,
    pub project_description: String,
    pub project_type: String,
    pub mcp_name: String,
    pub mcp_version: String,
    pub mcp_title: String,
    pub mcp_description: String,
    pub mcp_website_url: String,
    pub mcp_instructions: String,
}

fn validate_project_extension(path: &Path) -> Result<(), TervaError> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if extension != "terva" {
        return Err(TervaError::Project(
            "Selected file is not a .terva project".to_string(),
        ));
    }

    Ok(())
}

fn ensure_terva_extension(mut path: PathBuf) -> PathBuf {
    let has_extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value == "terva")
        .unwrap_or(false);
    if !has_extension {
        path.set_extension("terva");
    }
    path
}

fn title_case_file_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(|stem| {
            stem.split(|character: char| character == '-' || character == '_' || character.is_whitespace())
                .filter(|segment| !segment.is_empty())
                .map(|segment| {
                    let mut characters = segment.chars();
                    match characters.next() {
                        Some(first) => {
                            let mut title = String::new();
                            title.extend(first.to_uppercase());
                            title.push_str(&characters.as_str().to_lowercase());
                            title
                        }
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "New Project".to_string())
}

fn starter_project_contents(path: &Path) -> String {
    let project_name = title_case_file_stem(path);
    format!(
        r#"name: "{project_name}"
description: "New Terva project."
project_type: "device_bridge"

mcp_server {{
  name: "{project_name}"
  version: "1.0.0"
  title: "{project_name}"
  description: "New Terva MCP server."
  instructions: "Use the exposed tools and resources from this Terva project."
}}

logging {{
  sink: "stderr"
}}

backends {{
  id: "primary"
  type: BACKEND_TYPE_HTTP_JSON
  base_url: "http://127.0.0.1:8080"
}}

capabilities {{
  id: "ping_service"
  tool_name: "ping_service"
  description: "Starter placeholder capability. Replace this with the first real operation for the project."
  input_schema {{
    type: "object"
    additional_properties: false
  }}
  actions {{
    id: "ping_service"
    backend: "primary"
    method: HTTP_METHOD_GET
    path: "/"
    success_statuses: 200
  }}
  action: "ping_service"
  output_fields {{
    name: "status"
    source: OUTPUT_SOURCE_LITERAL
    value {{ string_value: "replace_me" }}
  }}
}}
"#
    )
}

pub async fn pick_project_document(bridge: &CoreBridge) -> Result<Option<ProjectDocument>, TervaError> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Terva project", &["terva"])
        .pick_file()
        .await;

    let Some(handle) = handle else {
        return Ok(None);
    };

    let document = bridge.open_document(handle.path())?;
    Ok(Some(document))
}

pub fn open_project_document_at_path(
    bridge: &CoreBridge,
    path: String,
) -> Result<ProjectDocument, TervaError> {
    let path = PathBuf::from(path);
    validate_project_extension(&path)?;
    bridge.open_document(&path)
}

pub async fn create_project_document(bridge: &CoreBridge) -> Result<Option<ProjectDocument>, TervaError> {
    let handle = rfd::AsyncFileDialog::new()
        .set_file_name("new-project.terva")
        .add_filter("Terva project", &["terva"])
        .save_file()
        .await;

    let Some(handle) = handle else {
        return Ok(None);
    };

    let path = ensure_terva_extension(handle.path().to_path_buf());
    let contents = starter_project_contents(&path);

    tokio::fs::write(&path, contents)
        .await
        .map_err(|error| TervaError::Project(format!("Failed to create project: {error}")))?;

    let document = bridge.open_document(&path)?;
    Ok(Some(document))
}

pub fn summarize_recent_projects(
    bridge: &CoreBridge,
    paths: Vec<String>,
) -> Vec<ProjectSummary> {
    let mut summaries = Vec::new();

    for path in paths {
        let path = PathBuf::from(path);
        if !path.exists() {
            continue;
        }
        if let Ok(summary) = bridge.summarize_document(&path) {
            summaries.push(summary);
        }
    }

    summaries
}

pub fn update_project_metadata(
    bridge: &CoreBridge,
    update: ProjectMetadataUpdate,
) -> Result<ProjectDocument, TervaError> {
    bridge.update_project_metadata(&update)
}

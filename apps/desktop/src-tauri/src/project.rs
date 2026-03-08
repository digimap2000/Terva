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

    pub fn close_document(&self) -> Result<(), TervaError> {
        let mut core = self.lock()?;
        let raw = core.pin_mut().close_document();
        let _: serde_json::Value = decode_payload(&raw)?;
        Ok(())
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

    pub fn generate_project_name(&self) -> Result<String, TervaError> {
        let mut core = self.lock()?;
        let raw = core.pin_mut().generate_project_name();
        let suggestion: ProjectNameSuggestion = decode_payload(&raw)?;
        if suggestion.friendly_name.trim().is_empty() || suggestion.slug.trim().is_empty() {
            return Err(TervaError::Project(
                "Core returned an invalid project name suggestion".to_string(),
            ));
        }
        Ok(suggestion.friendly_name)
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

#[derive(Debug, Deserialize)]
struct ProjectNameSuggestion {
    friendly_name: String,
    slug: String,
}

fn decode_payload<T: DeserializeOwned>(raw: &str) -> Result<T, TervaError> {
    let envelope: CoreEnvelope<T> = serde_json::from_str(raw)
        .map_err(|error| TervaError::Project(format!("Failed to decode core response: {error}")))?;
    if !envelope.ok {
        return Err(TervaError::Project(envelope.error.unwrap_or_else(|| {
            "Core call failed without an error".to_string()
        })));
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NamedValue {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductHttpSettings {
    pub version: String,
    pub tls_enabled: bool,
    #[serde(default)]
    pub mandatory_headers: Vec<NamedValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductUartSettings {
    pub baud_rate: Option<i32>,
    pub port: String,
    pub framing: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDocument {
    pub path: String,
    pub file_name: String,
    pub display_name: String,
    pub description: String,
    pub server_runnable: bool,
    #[serde(default)]
    pub mcp_transports: Vec<String>,
    pub product_connector: String,
    #[serde(default)]
    pub product_http: ProductHttpSettings,
    #[serde(default)]
    pub product_uart: ProductUartSettings,
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
    pub server_runnable: bool,
    #[serde(default)]
    pub mcp_transports: Vec<String>,
    pub product_connector: String,
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
    pub mcp_transports: Vec<String>,
    pub product_connector: String,
    pub product_http_version: String,
    pub product_http_tls_enabled: bool,
    #[serde(default)]
    pub product_http_mandatory_headers: Vec<NamedValue>,
    pub product_uart_baud_rate: Option<i32>,
    pub product_uart_port: String,
    pub product_uart_framing: String,
    pub mcp_name: String,
    pub mcp_version: String,
    pub mcp_title: String,
    pub mcp_description: String,
    pub mcp_website_url: String,
    pub mcp_instructions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewProjectRequest {
    pub friendly_name: String,
    pub directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewProjectPreview {
    pub friendly_name: String,
    pub filesystem_name: String,
    pub file_name: String,
    pub mcp_server_name: String,
    pub directory: String,
    pub target_path: String,
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

fn default_projects_directory() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join("Documents").join("Terva"))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn normalize_friendly_name(name: &str) -> String {
    let collapsed = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        "New Project".to_string()
    } else {
        collapsed
    }
}

fn slugify_name(name: &str) -> String {
    let mut slug = String::new();
    let mut last_was_separator = false;

    for character in name.chars() {
        let next = match character {
            'A'..='Z' => character.to_ascii_lowercase(),
            'a'..='z' | '0'..='9' => character,
            _ => '-',
        };

        if next == '-' {
            if slug.is_empty() || last_was_separator {
                continue;
            }
            last_was_separator = true;
            slug.push('-');
            continue;
        }

        last_was_separator = false;
        slug.push(next);
    }

    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "new-project".to_string()
    } else {
        trimmed
    }
}

fn build_new_project_preview(friendly_name: &str, directory: Option<&str>) -> NewProjectPreview {
    let normalized_name = normalize_friendly_name(friendly_name);
    let filesystem_name = slugify_name(&normalized_name);
    let mcp_server_name = slugify_name(&normalized_name);
    let file_name = format!("{filesystem_name}.terva");
    let directory = directory
        .map(PathBuf::from)
        .unwrap_or_else(default_projects_directory);
    let target_path = directory.join(&file_name);

    NewProjectPreview {
        friendly_name: normalized_name,
        filesystem_name,
        file_name,
        mcp_server_name,
        directory: directory.display().to_string(),
        target_path: target_path.display().to_string(),
    }
}

fn starter_project_contents(preview: &NewProjectPreview) -> String {
    let project_name = &preview.friendly_name;
    let mcp_server_name = &preview.mcp_server_name;
    format!(
        r#"name: "{project_name}"
description: "New Terva project."

mcp_transports: MCP_TRANSPORT_STREAMABLE_HTTP
product_connector: PRODUCT_CONNECTOR_HTTP

product_http {{
  version: "1.1"
  tls_enabled: false
}}

mcp_server {{
  name: "{mcp_server_name}"
  version: "1.0.1"
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

pub async fn pick_project_document(
    bridge: &CoreBridge,
) -> Result<Option<ProjectDocument>, TervaError> {
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

pub fn close_active_project_document(bridge: &CoreBridge) -> Result<(), TervaError> {
    bridge.close_document()
}

pub fn get_new_project_preview(
    bridge: &CoreBridge,
    friendly_name: String,
    directory: Option<String>,
) -> Result<NewProjectPreview, TervaError> {
    let resolved_name = if friendly_name.trim().is_empty() {
        bridge.generate_project_name()?
    } else {
        friendly_name
    };

    Ok(build_new_project_preview(&resolved_name, directory.as_deref()))
}

pub async fn pick_project_directory(directory: Option<String>) -> Option<String> {
    let default_directory = directory
        .map(PathBuf::from)
        .unwrap_or_else(default_projects_directory);

    rfd::AsyncFileDialog::new()
        .set_directory(default_directory)
        .pick_folder()
        .await
        .map(|handle| handle.path().display().to_string())
}

pub async fn create_project_document(
    bridge: &CoreBridge,
    request: NewProjectRequest,
) -> Result<ProjectDocument, TervaError> {
    let resolved_name = if request.friendly_name.trim().is_empty() {
        bridge.generate_project_name()?
    } else {
        request.friendly_name
    };
    let preview = build_new_project_preview(&resolved_name, Some(&request.directory));
    let path = PathBuf::from(&preview.target_path);
    let parent_directory = path.parent().unwrap_or(Path::new("."));

    tokio::fs::create_dir_all(parent_directory)
        .await
        .map_err(|error| {
            TervaError::Project(format!("Failed to prepare project folder: {error}"))
        })?;

    if path.exists() {
        return Err(TervaError::Project(format!(
            "A project already exists at {}",
            path.display()
        )));
    }

    let contents = starter_project_contents(&preview);

    tokio::fs::write(&path, contents)
        .await
        .map_err(|error| TervaError::Project(format!("Failed to create project: {error}")))?;

    bridge.open_document(&path)
}

pub fn summarize_recent_projects(bridge: &CoreBridge, paths: Vec<String>) -> Vec<ProjectSummary> {
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

pub fn delete_project_document(path: String) -> Result<(), TervaError> {
    let path = PathBuf::from(path);
    validate_project_extension(&path)?;

    if !path.exists() {
        return Err(TervaError::Project(format!(
            "Project does not exist at {}",
            path.display()
        )));
    }

    trash::delete(&path)
        .map_err(|error| TervaError::Project(format!("Failed to move project to Trash: {error}")))
}

pub fn update_project_metadata(
    bridge: &CoreBridge,
    update: ProjectMetadataUpdate,
) -> Result<ProjectDocument, TervaError> {
    bridge.update_project_metadata(&update)
}

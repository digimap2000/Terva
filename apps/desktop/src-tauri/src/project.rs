use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::error::TervaError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDocument {
    pub path: String,
    pub file_name: String,
    pub display_name: String,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub path: String,
    pub file_name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub backend_count: u32,
    pub capability_count: u32,
    pub modified_at_ms: Option<u64>,
}

#[derive(Debug, Clone)]
struct ProjectMetadata {
    display_name: String,
    description: Option<String>,
    backend_count: u32,
    capability_count: u32,
}

fn extract_scalar_field(contents: &str, field_name: &str) -> Option<String> {
    for line in contents.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(field_name) {
            continue;
        }

        let prefix = format!("{field_name}:");
        let value = trimmed.trim_start_matches(&prefix).trim();
        if value.is_empty() {
            continue;
        }

        if let Some(rest) = value.strip_prefix('"') {
            if let Some(end_quote) = rest.find('"') {
                return Some(rest[..end_quote].to_string());
            }
        }

        return Some(value.to_string());
    }

    None
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

fn file_name_for_path(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| path.display().to_string())
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

fn extract_project_metadata(path: &Path, contents: &str) -> ProjectMetadata {
    let file_name = file_name_for_path(path);
    let display_name = extract_scalar_field(contents, "name").unwrap_or_else(|| {
        path.file_stem()
            .and_then(|value| value.to_str())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| file_name.clone())
    });

    let description = extract_scalar_field(contents, "description");
    let backend_count = contents
        .lines()
        .filter(|line| line.trim().starts_with("backends {"))
        .count() as u32;
    let capability_count = contents
        .lines()
        .filter(|line| line.trim().starts_with("capabilities {"))
        .count() as u32;

    ProjectMetadata {
        display_name,
        description,
        backend_count,
        capability_count,
    }
}

async fn read_project_document_from_path(path: &Path) -> Result<ProjectDocument, TervaError> {
    validate_project_extension(path)?;

    let contents = tokio::fs::read_to_string(path)
        .await
        .map_err(|error| TervaError::Project(format!("Failed to read project: {error}")))?;

    let metadata = extract_project_metadata(path, &contents);

    Ok(ProjectDocument {
        path: path.display().to_string(),
        file_name: file_name_for_path(path),
        display_name: metadata.display_name,
        contents,
    })
}

async fn read_project_summary_from_path(path: &Path) -> Result<ProjectSummary, TervaError> {
    validate_project_extension(path)?;

    let contents = tokio::fs::read_to_string(path)
        .await
        .map_err(|error| TervaError::Project(format!("Failed to read project: {error}")))?;
    let metadata = extract_project_metadata(path, &contents);
    let modified_at_ms = tokio::fs::metadata(path)
        .await
        .ok()
        .and_then(|value| value.modified().ok())
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as u64);

    Ok(ProjectSummary {
        path: path.display().to_string(),
        file_name: file_name_for_path(path),
        display_name: metadata.display_name,
        description: metadata.description,
        backend_count: metadata.backend_count,
        capability_count: metadata.capability_count,
        modified_at_ms,
    })
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

fn starter_project_contents(path: &Path) -> String {
    let project_name = title_case_file_stem(path);
    format!(
        r#"name: "{project_name}"
description: "New Terva project."

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

pub async fn pick_project_document() -> Result<Option<ProjectDocument>, TervaError> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Terva project", &["terva"])
        .pick_file()
        .await;

    let Some(handle) = handle else {
        return Ok(None);
    };

    let document = read_project_document_from_path(handle.path()).await?;
    Ok(Some(document))
}

pub async fn open_project_document_at_path(path: String) -> Result<ProjectDocument, TervaError> {
    read_project_document_from_path(Path::new(&path)).await
}

pub async fn create_project_document() -> Result<Option<ProjectDocument>, TervaError> {
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

    let document = read_project_document_from_path(&path).await?;
    Ok(Some(document))
}

pub async fn summarize_recent_projects(paths: Vec<String>) -> Vec<ProjectSummary> {
    let mut summaries = Vec::new();

    for path in paths {
        let path = PathBuf::from(path);
        if !path.exists() {
            continue;
        }
        if let Ok(summary) = read_project_summary_from_path(&path).await {
            summaries.push(summary);
        }
    }

    summaries
}

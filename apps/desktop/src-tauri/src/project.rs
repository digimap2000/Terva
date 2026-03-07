use serde::{Deserialize, Serialize};

use crate::error::TervaError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDocument {
    pub path: String,
    pub file_name: String,
    pub display_name: String,
    pub contents: String,
}

fn extract_display_name(contents: &str) -> Option<String> {
    for line in contents.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("name:") {
            continue;
        }

        let value = trimmed.trim_start_matches("name:").trim();
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

pub async fn pick_project_document() -> Result<Option<ProjectDocument>, TervaError> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Terva project", &["terva"])
        .pick_file()
        .await;

    let Some(handle) = handle else {
        return Ok(None);
    };

    let path = handle.path().to_path_buf();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if extension != "terva" {
        return Err(TervaError::Project(
            "Selected file is not a .terva project".to_string(),
        ));
    }

    let contents = tokio::fs::read_to_string(&path)
        .await
        .map_err(|error| TervaError::Project(format!("Failed to read project: {error}")))?;

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| path.display().to_string());

    let display_name = extract_display_name(&contents).unwrap_or_else(|| {
        path.file_stem()
            .and_then(|value| value.to_str())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| file_name.clone())
    });

    Ok(Some(ProjectDocument {
        path: path.display().to_string(),
        file_name,
        display_name,
        contents,
    }))
}

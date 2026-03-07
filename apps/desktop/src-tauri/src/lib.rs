use serde::Serialize;

#[derive(Serialize)]
struct AppStatus {
    product_name: String,
    product_version: String,
    host_platform: String,
    core_status: String,
}

#[tauri::command]
fn app_status() -> AppStatus {
    AppStatus {
        product_name: "Terva".to_string(),
        product_version: env!("CARGO_PKG_VERSION").to_string(),
        host_platform: std::env::consts::OS.to_string(),
        core_status: "C++ core bridge not wired yet".to_string(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_status])
        .run(tauri::generate_context!())
        .expect("failed to run Terva desktop");
}


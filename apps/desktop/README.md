# Desktop Scaffold

This directory contains the deferred Tauri-based desktop application shell.

- `src-tauri/` contains the Rust crate and Tauri configuration.
- `ui/` contains static frontend assets for the initial shell.

The current product runtime is intentionally core-first and headless. The first runnable path is:

- `.terva` project file
- `terva-server`
- `terva-client`

The desktop shell should consume that runtime later through a narrow boundary once the MCP/core behavior is stable.

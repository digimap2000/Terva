# Architecture Overview

## Intent

Terva is organized around a project-driven C++ core. The `.terva` file is the source of truth, and the MCP server is treated as a first-class product artifact rather than a thin wrapper.

## Layers

### `core/`

The C++ core owns:

- project model types
- project parsing and validation
- capability definitions
- explicit precondition, setup, action, and verification execution
- backend adapter interfaces
- localhost HTTP JSON backend integration
- structured JSONL logging
- MCP server registration from project data

### `apps/server/`

`terva-server` is the standalone MCP runtime. It loads a project, validates it, builds tool definitions from capability data, and serves them over stdio or localhost Streamable HTTP using DTS MCP transports.

### `apps/cli/`

`terva-client` is the headless verification loop. It connects either via `stdio:<project-file>`, which spawns `terva-server run --stdio <project-file>`, or directly to a localhost HTTP endpoint such as `http://127.0.0.1:7777/mcp`.

### `apps/example-backend/`

The example backend is a small localhost HTTP JSON fixture used to prove end-to-end project execution. It is not part of the core product shape, but it gives the repo a deterministic test target for the initial runtime.

### `apps/desktop/`

The desktop application remains deferred. Tauri is present as a future operator-facing shell, but it is intentionally outside the v0 runtime path.

## Integration Direction

The current foundation keeps the Rust desktop shell separate from the core on purpose. A later iteration can choose the bridge mechanism based on real requirements:

- C ABI boundary for broad portability.
- `cxx` for tighter Rust/C++ integration.
- Process boundary via the existing MCP runtime or CLI where it helps.

## Capability Model

A capability is modeled explicitly as:

- preconditions
- setup steps
- main action
- verification

This remains visible in the project file and the runtime result payload. The v0 system does not use generic execute blobs or hidden workflow logic.

## AI Collaboration

Repository-specific AI context should live in `.ai/` instead of being scattered through ad hoc notes. Primers belong close to subsystem intent, while reusable instructions belong in skills and workflows.

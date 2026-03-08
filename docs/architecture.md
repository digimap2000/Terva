# Architecture Overview

## Intent

Terva v1 is a linked-core product.

The canonical engine lives in C++. Both shipped hosts call that same engine directly:

- `apps/cli/` is the thin headless host.
- `apps/desktop/` is the thin Tauri desktop host.

There is no standalone daemon, no stdio control plane, and no separate RPC/service layer in v1.

## Layers

### `core/`

The C++ core owns:

- `.terva` project parsing and rendering
- validation rules
- project inspection payloads
- capability execution
- backend integration
- structured event logging
- MCP Streamable HTTP server startup and shutdown

The desktop and CLI are consumers of that engine, not alternate implementations of product logic.

### `apps/cli/`

`terva-client` is the first-class headless host over the engine.

It opens a `.terva` file directly, validates and inspects it, lists tools, and invokes capabilities through the same in-process core used by the desktop app.

### `apps/desktop/`

The desktop app is a Tauri shell linked to the C++ engine through Rust `cxx` bridge code.

The frontend does not scrape or reinterpret `.terva` files itself. It sends coarse-grained requests into the native layer and renders the canonical payloads returned by the core.

### `apps/example-backend/`

The example backend is a deterministic local HTTP fixture used for development and verification. It is not part of the shipped product runtime, but it remains useful as a stable test target.

## Integration Boundary

The Rust/C++ boundary is intentionally narrow:

- open document
- summarize document
- update top-level project metadata
- start server
- stop server
- drain core events

The bridge is private product infrastructure, not a public SDK.

## Runtime Model

The core can load a `.terva` document and start an MCP server over Streamable HTTP on localhost.

The desktop app exposes that capability as a host control surface, but the server behavior itself is still owned by the C++ core.

## Capability Model

A capability is modeled explicitly in project data rather than hidden behind arbitrary code:

- preconditions
- setup steps
- main action
- verification

That structure remains visible in the project format and in runtime results.

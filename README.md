# Terva v1.0.2

Terva is a core-first product scaffold with a single canonical in-process engine.

`.terva` project files are defined by protobuf schema and authored as protobuf text format for now. The schema lives at [project.proto](/Users/andys/Documents/ajs/Terva/proto/terva/project/v1/project.proto).

The current v1 shape is intentionally simple:

- A shared C++ core owns the `.terva` project model, validation, capability execution, backend integration, structured logs, and runtime behavior.
- Each project defines one backend, one or more services, and a shared capability surface published through those services.
- `terva-client` is a thin direct host over that same C++ engine.
- The Tauri desktop app links to the C++ core in process through Rust `cxx` bridge code.
- There is no daemon, RPC layer, or stdio control plane in v1.

The repository is also structured for AI-assisted development from the start, with dedicated space for primers, skills, prompts, and workflow notes.

## Layout

- `apps/cli/` contains `terva-client`.
- `apps/desktop/` contains the Tauri single-document workspace shell for `.terva` projects.
- `core/` contains the project model, validator, backend adapter, executor, logging, and shared engine API.
- `examples/` contains hand-authored `.terva` project files.
- `docs/` contains architecture and development notes.
- `.ai/` contains AI collaboration assets such as primers and skills.

## Quick Start

### Build

```sh
cmake --preset dev
cmake --build --preset dev
```

### Validate, inspect, and list tools directly

```sh
./build/dev/apps/cli/terva-client validate examples/demo-volume.terva
./build/dev/apps/cli/terva-client inspect examples/demo-volume.terva
./build/dev/apps/cli/terva-client tools examples/demo-volume.terva
```

### Call a tool end-to-end from the direct CLI host

```sh
./build/dev/apps/cli/terva-client call examples/demo-volume.terva audio.set_volume '{"level":42}'
```

### Build the desktop app

```sh
npm --prefix apps/desktop run tauri build
```

The desktop app links to the same engine in process through the Rust `cxx` bridge. The desktop shell does not scrape `.terva` files itself anymore; document state comes from the shared core.

### Launch the desktop app and start the MCP server

```sh
npm --prefix apps/desktop run tauri dev -- -- --open audio-streamer.terva --start-server
```

The linked core will load the project and start the first MCP service configured for Streamable HTTP.

## Project Shape

`.terva` projects are authored as protobuf text format and split into:

- `backend`: how to reach the concrete device, database, or filesystem
- `services`: publication layers such as MCP over Streamable HTTP or stdio
- `capabilities`: the canonical behavior surface implemented by the backend

Tool results are intentionally split into:

- `output`: concise capability-facing data
- `verification`: expected vs observed final state for state-changing tools
- `trace`: low-level HTTP/backend execution details

Example project files:

- [examples/demo-volume.terva](/Users/andys/Documents/ajs/Terva/examples/demo-volume.terva)
- [audio-streamer.terva](/Users/andys/Documents/ajs/Terva/audio-streamer.terva)

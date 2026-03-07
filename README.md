# Terva

Terva is a core-first MCP product scaffold.

The first runnable foundation is intentionally headless:

- A shared C++ core owns the `.terva` project model, capability execution, backend integration, structured logs, and MCP runtime.
- `terva-server` loads a hand-authored `.terva` file and exposes project-driven MCP tools over stdio.
- `terva-client` exercises the real MCP runtime path by spawning the server and issuing real `initialize`, `tools/list`, and `tools/call` requests.
- A Rust/Tauri desktop shell exists in `apps/desktop/`, but it is not part of the v0 runtime path.

The repository is also structured for AI-assisted development from the start, with dedicated space for primers, skills, prompts, and workflow notes.

## Layout

- `apps/server/` contains `terva-server`.
- `apps/cli/` contains `terva-client`.
- `apps/example-backend/` contains a local HTTP JSON fixture backend for the demo project.
- `apps/desktop/` contains the deferred Tauri desktop shell scaffold.
- `core/` contains the project model, validator, backend adapter, executor, logging, and MCP runtime.
- `examples/` contains hand-authored `.terva` project files.
- `docs/` contains architecture and development notes.
- `.ai/` contains AI collaboration assets such as primers and skills.

## Quick Start

### Build

```sh
cmake --preset dev
cmake --build --preset dev
```

### Validate and inspect a project

```sh
./build/dev/apps/server/terva-server validate examples/demo-volume.terva
./build/dev/apps/server/terva-server inspect examples/demo-volume.terva
```

### Run the demo backend and call a tool end-to-end

Terminal 1:

```sh
./build/dev/apps/example-backend/terva-example-backend
```

Terminal 2:

```sh
./build/dev/apps/cli/terva-client tools stdio:examples/demo-volume.terva
./build/dev/apps/cli/terva-client call stdio:examples/demo-volume.terva audio.set_volume '{"level":42}'
```

### Run the standalone MCP server directly

```sh
./build/dev/apps/server/terva-server run examples/demo-volume.terva
```

That command is intended for a real MCP host or client connection over stdio. Structured logs are emitted as JSON lines on `stderr`.


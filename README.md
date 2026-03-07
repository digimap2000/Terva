# Terva

Terva is a core-first MCP product scaffold.

The first runnable foundation is intentionally headless:

- A shared C++ core owns the `.terva` project model, capability execution, backend integration, structured logs, and MCP runtime.
- `terva-server` loads a hand-authored `.terva` file and exposes project-driven MCP tools over stdio or localhost Streamable HTTP.
- `terva-client` exercises the real MCP runtime path over either a spawned stdio server or a localhost HTTP endpoint.
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
./build/dev/apps/server/terva-server run --stdio examples/demo-volume.terva
./build/dev/apps/server/terva-server run --listen http://127.0.0.1:7777/mcp examples/demo-volume.terva
```

The stdio form is intended for a real MCP host or subprocess client. The HTTP form exposes standard MCP over localhost Streamable HTTP on a single endpoint. Structured logs are emitted as JSON lines on `stderr`.

## Streamer Example

The repo also includes a real-device project file at [streamer.terva](/Users/andys/Documents/ajs/Terva/streamer.terva) for the known streamer backend at `http://192.168.1.111:15081`.

```sh
./build/dev/apps/server/terva-server validate streamer.terva
./build/dev/apps/server/terva-server inspect streamer.terva
./build/dev/apps/server/terva-server run --listen http://127.0.0.1:7777/mcp streamer.terva
./build/dev/apps/cli/terva-client tools http://127.0.0.1:7777/mcp
./build/dev/apps/cli/terva-client call http://127.0.0.1:7777/mcp get_power_state '{}'
./build/dev/apps/cli/terva-client call http://127.0.0.1:7777/mcp enter_active '{}'
./build/dev/apps/cli/terva-client call http://127.0.0.1:7777/mcp get_power_state '{}'
./build/dev/apps/cli/terva-client call http://127.0.0.1:7777/mcp enter_standby '{}'
./build/dev/apps/cli/terva-client call http://127.0.0.1:7777/mcp get_power_state '{}'
```

`get_power_state` reads `GET /power`, extracts the device `system` field, and normalizes it to `active`, `standby`, or `unknown`.

`enter_active` performs `PUT /power?system=on`, verifies `system == "on"`, and then waits through a bounded settle delay before returning so the next command can reliably target the real device.

`enter_standby` performs `PUT /power?system=lona` and verifies `system == "lona"`.

Tool results are intentionally split into:

- `output`: concise capability-facing data
- `verification`: expected vs observed final state for state-changing tools
- `trace`: low-level HTTP/backend execution details

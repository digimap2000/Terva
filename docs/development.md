# Development Notes

## Toolchains

- CMake 3.24 or newer
- a C++23-capable compiler
- Rust toolchain
- Node.js for `apps/desktop/`
- Tauri host prerequisites when building the desktop app
- DTS installed at `/opt/dts`
- libcurl available to CMake

## Common Commands

### Configure and build the C++ targets

```sh
cmake --preset dev
cmake --build --preset dev
```

### Validate, inspect, and call a project from the CLI host

```sh
./build/dev/apps/cli/terva-client validate examples/demo-volume.terva
./build/dev/apps/cli/terva-client inspect examples/demo-volume.terva
./build/dev/apps/cli/terva-client tools examples/demo-volume.terva
./build/dev/apps/cli/terva-client call examples/demo-volume.terva audio.set_volume '{"level":42}'
```

### Start the deterministic example backend

```sh
./build/dev/apps/example-backend/terva-example-backend
```

### Build the desktop app

```sh
npm --prefix apps/desktop run build
npm --prefix apps/desktop run tauri build
```

### Launch the desktop app with a project and server

```sh
npm --prefix apps/desktop run tauri dev -- -- --open streamer.terva --start-server
```

## Notes

- The desktop app links to the same core engine as the CLI.
- The core-owned MCP server is exposed over localhost Streamable HTTP.
- Structured runtime events are emitted by the core and drained by the desktop shell.
- `.terva` files are currently authored as protobuf text format backed by the protobuf schema.

# Development Notes

## Toolchains

- CMake 3.24 or newer
- A C++23-capable compiler
- Rust toolchain
- Tauri host prerequisites only when working on `apps/desktop/`
- DTS installed at `/opt/dts`
- libcurl available to CMake

## Common Commands

### Configure and build

```sh
cmake --preset dev
cmake --build --preset dev
```

### Validate and inspect a project

```sh
./build/dev/apps/server/terva-server validate examples/demo-volume.terva
./build/dev/apps/server/terva-server inspect examples/demo-volume.terva
```

### Start the example localhost backend

```sh
./build/dev/apps/example-backend/terva-example-backend
```

### Discover tools and call one over the real MCP runtime path

```sh
./build/dev/apps/cli/terva-client tools stdio:examples/demo-volume.terva
./build/dev/apps/cli/terva-client call stdio:examples/demo-volume.terva audio.set_volume '{"level":42}'
```

### Run the MCP server directly for an external MCP host

```sh
./build/dev/apps/server/terva-server run examples/demo-volume.terva
```

## Notes

- `terva-client` currently supports a `stdio:<project-file>` connection spec for the v0 verification loop.
- Structured logs are emitted as JSON lines on `stderr` by default.
- The desktop/Tauri scaffold is intentionally not on the first runnable path.

## Next Steps After v0

- Add a reusable MCP client transport abstraction beyond the current POSIX stdio launcher.
- Add more project schema checks and automated tests around parser, validator, and executor behavior.
- Decide the future Rust-to-C++ boundary for the desktop shell.
- Add platform-specific packaging and installer workflows when the headless runtime stabilizes.


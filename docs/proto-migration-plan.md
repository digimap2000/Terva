# Proto Migration Plan

This document captures the work needed to align the codebase with the current `.terva` schema direction:

- one backend per project
- one or more services per project
- all capabilities exposed through all services
- capability implementations bound to the project backend rather than to individual services

## Target Shape

`ProjectDefinition` should be treated as:

- project metadata
- singular backend via `oneof backend`
- repeated `services`
- repeated `capabilities`

Each `ServiceDefinition` is a protocol adapter over the full capability set. Today that means MCP over Streamable HTTP or stdio. Future protocols such as `FOO` or `BAR` should slot into the same service wrapper without changing the capability model.

## Current Gaps

The schema has moved, but the runtime still targets the older model:

- top-level `mcp_server` and `mcp_transports`
- top-level `product_*` metadata
- repeated `backends`
- HTTP-specific action fields
- capability `tool_name`
- capability `action` as the main action field

The main code paths still assuming the old shape are:

- [core/src/project/parser.cpp](/Users/andys/Documents/ajs/Terva/core/src/project/parser.cpp)
- [core/include/terva/core/project/model.hpp](/Users/andys/Documents/ajs/Terva/core/include/terva/core/project/model.hpp)
- [core/src/project/validator.cpp](/Users/andys/Documents/ajs/Terva/core/src/project/validator.cpp)
- [core/src/capability/executor.cpp](/Users/andys/Documents/ajs/Terva/core/src/capability/executor.cpp)
- [core/src/mcp/runtime.cpp](/Users/andys/Documents/ajs/Terva/core/src/mcp/runtime.cpp)
- [apps/desktop/src-tauri/src/project.rs](/Users/andys/Documents/ajs/Terva/apps/desktop/src-tauri/src/project.rs)
- [apps/desktop/src/lib/tauri.ts](/Users/andys/Documents/ajs/Terva/apps/desktop/src/lib/tauri.ts)
- [docs/project-format.md](/Users/andys/Documents/ajs/Terva/docs/project-format.md)
- [examples/demo-volume.terva](/Users/andys/Documents/ajs/Terva/examples/demo-volume.terva)
- [audio-streamer.terva](/Users/andys/Documents/ajs/Terva/audio-streamer.terva)

## Work Order

1. Regenerate the generated protobuf sources and fix compile errors caused by the schema break.
2. Replace the old internal project model with the new project/backend/services/capabilities split.
3. Migrate parsing and serialization so `.terva` textproto round-trips against the new schema.
4. Update validation rules to enforce the new invariants.
5. Rework execution and MCP runtime wiring to read services from the new model.
6. Update desktop authoring, preview, and generator flows to produce the new schema.
7. Rewrite example projects and format documentation.
8. Rebuild and run CLI and desktop verification passes.

## Implementation Notes

### 1. Model Layer

Refactor [core/include/terva/core/project/model.hpp](/Users/andys/Documents/ajs/Terva/core/include/terva/core/project/model.hpp) to remove the old transport-specific root fields and introduce:

- `service_definition`
- `mcp_service_definition`
- a singular backend representation matching the proto `oneof backend`
- a generalized action representation matching the proto `oneof operation`
- capability `name` and `main_action_id`

The model should preserve transport-agnostic capabilities and treat services as publication adapters only.

### 2. Parser And Serializer

Update [core/src/project/parser.cpp](/Users/andys/Documents/ajs/Terva/core/src/project/parser.cpp) to:

- read repeated `services`
- map `services[].mcp.server` and `services[].mcp.transports`
- stop reading removed root fields such as `mcp_server`, `mcp_transports`, `product_*`, and repeated `backends`
- parse `ActionDefinition` through its `oneof operation`
- serialize the same structure back to textproto

This is the largest mechanical change because the file still references generated APIs from the old proto.

### 3. Validation

Update [core/src/project/validator.cpp](/Users/andys/Documents/ajs/Terva/core/src/project/validator.cpp) to enforce:

- exactly one backend selected
- at least one service
- unique service ids
- service-specific validity rules such as MCP server metadata requirements
- capability `name` uniqueness if that is the stable published identifier
- operation/backend compatibility checks

### 4. Execution

Update execution paths so capabilities target the singular backend and services only affect publication:

- [core/src/capability/executor.cpp](/Users/andys/Documents/ajs/Terva/core/src/capability/executor.cpp)
- [core/src/engine/engine.cpp](/Users/andys/Documents/ajs/Terva/core/src/engine/engine.cpp)
- [core/src/mcp/runtime.cpp](/Users/andys/Documents/ajs/Terva/core/src/mcp/runtime.cpp)

Near-term scope can stay limited to MCP, but it should iterate over `project.services` and select MCP service entries rather than assuming one root MCP block.

### 5. Desktop And Templates

Update the desktop project model and new-project scaffolding to emit the new schema:

- [apps/desktop/src-tauri/src/project.rs](/Users/andys/Documents/ajs/Terva/apps/desktop/src-tauri/src/project.rs)
- [apps/desktop/src/lib/tauri.ts](/Users/andys/Documents/ajs/Terva/apps/desktop/src/lib/tauri.ts)
- UI pages that read `tool_name`, `main_action_id`, backend summaries, or MCP metadata

The first desktop pass can still assume one service in the UI while storing it as `services[0]`.

### 6. Docs, Examples, And Tests

Rewrite:

- [docs/project-format.md](/Users/andys/Documents/ajs/Terva/docs/project-format.md)
- [README.md](/Users/andys/Documents/ajs/Terva/README.md)
- [examples/demo-volume.terva](/Users/andys/Documents/ajs/Terva/examples/demo-volume.terva)
- [audio-streamer.terva](/Users/andys/Documents/ajs/Terva/audio-streamer.terva)

Add or update tests around:

- textproto parsing
- validation failures for missing backend or services
- MCP runtime publication from `services`
- round-trip serialization

## Suggested Delivery Slices

To keep reviewable scope, split the migration into:

1. `proto + model + parser + serializer`
2. `validator + executor + MCP runtime`
3. `desktop + docs + examples + tests`

That ordering gets the core build green before the UI catches up.

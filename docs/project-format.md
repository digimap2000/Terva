# `.terva` Project Format

`.terva` files are protobuf text format files backed by the schema in [project.proto](/Users/andys/Documents/ajs/Terva/proto/terva/project/v1/project.proto).

The current project model is split into three concerns:

- `backend`: the one concrete system being controlled and how Terva talks to it
- `services`: one or more publication surfaces over the same capability set
- `capabilities`: the canonical behavior surface implemented by the backend

Today the runtime supports a single backend and currently publishes MCP services.

## Root Shape

Top-level fields:

- `name`
- `description`
- `logging`
- `services`
- one backend via `device`, `database`, or `file`
- `capabilities`

## Services

Services are the external protocols layered over the capability surface.

`ServiceDefinition` currently supports:

- `id`
- `description`
- `mcp`

`mcp` contains:

- `server`
- `transports`

`server` fields:

- `name`
- `version`
- `title`
- `description`
- `website_url`
- `instructions`

Example:

```textproto
services {
  id: "primary"
  description: "Primary MCP service."
  mcp {
    server {
      name: "demo-volume"
      version: "1.0.1"
      title: "Demo Volume"
    }
    transports: MCP_TRANSPORT_STREAMABLE_HTTP
  }
}
```

## Backends

Projects currently define one backend using a top-level `oneof backend`.

Supported backend families:

- `device`
- `database`
- `file`

Current connection shapes:

- `device.http`
- `device.uart`
- `device.ethernet`
- `database.sql`
- `file.tree`

Example device HTTP backend:

```textproto
device {
  name: "Demo Audio Device"
  category_icon: "device"
  http {
    base_url: "http://127.0.0.1:18080"
    version: "1.1"
    tls_enabled: false
  }
}
```

## Capabilities

Each capability contains:

- `id`
- `name`
- `description`
- `input_schema`
- `actions`
- `preconditions`
- `setup`
- `main_action`
- `verification`
- `output_fields`

`name` is the published capability identifier used by current MCP tooling.

## Actions

Actions are named so validation can check references from preconditions, setup, verification, and `main_action`.

`ActionDefinition` currently supports a single `oneof operation`:

- `http`
- `sql`
- `file_read`
- `file_list`
- `uart`

Example HTTP action:

```textproto
actions {
  id: "ping_service"
  http {
    method: HTTP_METHOD_GET
    path: "/"
    success_statuses: 200
  }
}
```

## Input Schema

The protobuf schema uses an explicit input-schema message instead of raw JSON.

Example:

```textproto
input_schema {
  type: "object"
  properties {
    name: "level"
    type: "integer"
    minimum { int_value: 0 }
    maximum { int_value: 100 }
  }
  required: "level"
  additional_properties: false
}
```

## Values

Prototext uses explicit typed value messages rather than inline untyped literals.

Supported value forms:

- `string_value`
- `int_value`
- `double_value`
- `bool_value`
- `null_value`
- `object_value`
- `list_value`

Example:

```textproto
expect {
  json_pointer: "/system"
  equals { string_value: "on" }
}
```

## Expectations And Output Fields

Preconditions and verification use:

- `json_pointer`
- `equals`

or:

- `json_pointer`
- `equals_input`

Verification may also define:

- `attempts`
- `delay_ms`
- `success_delay_ms`

Output fields are represented as repeated named entries with:

- `name`
- `source`
- `transform`
- `json_pointer`
- `input_name`
- `value`
- `normalize`
- `default_value`
- `required`

## Example Files

See:

- [examples/demo-volume.terva](/Users/andys/Documents/ajs/Terva/examples/demo-volume.terva)
- [audio-streamer.terva](/Users/andys/Documents/ajs/Terva/audio-streamer.terva)

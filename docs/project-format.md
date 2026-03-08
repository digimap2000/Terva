# `.terva` Project Format

`.terva` files are now protobuf text format files backed by the schema in [project.proto](/Users/andys/Documents/ajs/Terva/proto/terva/project/v1/project.proto).

The runtime parses textproto, converts it into Terva's internal project model, then runs the same validator and execution path as before.

## Root Shape

Top-level fields:

- `name`
- `description`
- `mcp_server`
- `logging`
- `backends`
- `capabilities`

## MCP Server Metadata

`mcp_server` carries the top-level server identity used by the linked MCP runtime.

Fields:

- `name`
- `version`
- `title`
- `description`
- `website_url`
- `instructions`

For current MCP compatibility, `name` and `version` should always be set.

## Backend Shape

Supported backend enums:

- `BACKEND_TYPE_HTTP_JSON`
- `BACKEND_TYPE_LOCALHOST_HTTP_JSON`

Backend fields:

- `id`
- `type`
- `base_url`
- `headers`

Headers are repeated `name` / `value` entries.

## Capability Shape

Each capability contains:

- `id`
- `tool_name`
- `description`
- `input_schema`
- `actions`
- `preconditions`
- `setup`
- `action`
- `verification`
- `output_fields`

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

This converts into the same internal JSON schema shape used by the existing validator/runtime.

## Action Shape

Actions are named so validation can check references.

- `id`
- `backend`
- `method`
- `path`
- `query`
- `headers`
- `body`
- `success_statuses`

Supported HTTP method enums:

- `HTTP_METHOD_GET`
- `HTTP_METHOD_POST`
- `HTTP_METHOD_PUT`

Query and header entries are repeated `name` / `value` pairs.

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

Example object body:

```textproto
body {
  object_value {
    fields {
      name: "vol"
      value { string_value: "{{input.level}}" }
    }
  }
}
```

## Expectations

Preconditions and verification use explicit expectations:

- `json_pointer`
- `equals`

or:

- `json_pointer`
- `equals_input`

Verification may also define:

- `attempts`
- `delay_ms`
- `success_delay_ms`

## Output Fields

Output fields are represented as repeated named entries.

Each entry supports:

- `name`
- `source`
- `transform`
- `json_pointer`
- `input_name`
- `value`
- `normalize`
- `default_value`
- `required`

Supported output-source enums:

- `OUTPUT_SOURCE_INPUT`
- `OUTPUT_SOURCE_ACTION`
- `OUTPUT_SOURCE_VERIFICATION`
- `OUTPUT_SOURCE_LITERAL`

Supported output-transform enums:

- `OUTPUT_TRANSFORM_NONE`
- `OUTPUT_TRANSFORM_MILLISECONDS_TO_SECONDS`
- `OUTPUT_TRANSFORM_LAST_PATH_SEGMENT`

Example:

```textproto
output_fields {
  name: "normalized_state"
  source: OUTPUT_SOURCE_ACTION
  json_pointer: "/system"
  normalize {
    raw_value: "on"
    mapped_value { string_value: "active" }
  }
  normalize {
    raw_value: "lona"
    mapped_value { string_value: "standby" }
  }
  default_value { string_value: "unknown" }
}
```

## Example Files

See:

- [examples/demo-volume.terva](/Users/andys/Documents/ajs/Terva/examples/demo-volume.terva)
- [streamer.terva](/Users/andys/Documents/ajs/Terva/streamer.terva)

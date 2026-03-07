# `.terva` Project Format

The v0 `.terva` format is JSON and intentionally narrow.

## Root Fields

- `name`: project name
- `description`: optional human-readable description
- `logging`: optional logging config
- `backends`: backend definitions
- `capabilities`: capability definitions

## Backend Shape

Only one backend type is supported in v0:

- `localhost_http_json`

Backend fields:

- `id`
- `type`
- `base_url`
- `headers`: optional map of string headers

## Capability Shape

Each capability contains:

- `id`
- `tool_name`
- `description`
- `input_schema`
- `actions`
- `preconditions`: optional
- `setup`: optional
- `action`: main action id
- `verification`: optional
- `output_mapping`: optional

## Action Shape

Actions are named so validation can check references.

- `id`
- `backend`
- `method`: `GET` or `POST`
- `path`
- `body`: optional JSON template
- `success_statuses`

## Expectation Shape

Preconditions and verification use an explicit expectation:

- `json_pointer`
- `equals`: literal expected value

or

- `json_pointer`
- `equals_input`: input field name

## Template Shape

JSON request bodies and path strings support `{{input.field}}` placeholders.

Examples:

- `"/api/audio/{{input.device_id}}"`
- `{ "vol": "{{input.level}}" }`

When the whole JSON string is a placeholder, the runtime preserves the underlying JSON type instead of forcing a string.

## Example

See [examples/demo-volume.terva](/Users/andys/Documents/ajs/Terva/examples/demo-volume.terva) for the current end-to-end example.


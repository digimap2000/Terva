#pragma once

#include "terva/core/json.hpp"

#include <filesystem>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace terva::core::project {

enum class backend_type {
  http_json,
  localhost_http_json,
};

enum class mcp_transport {
  streamable_http,
  stdio,
};

enum class product_connector {
  http,
  uart,
};

enum class http_method {
  get,
  post,
  put,
};

enum class output_source {
  input,
  action,
  verification,
  literal,
};

enum class output_transform {
  none,
  milliseconds_to_seconds,
  last_path_segment,
};

struct logging_options final {
  std::string sink{"stderr"};
  std::optional<std::filesystem::path> file_path;
};

struct mcp_server_definition final {
  std::string name;
  std::string version;
  std::optional<std::string> title;
  std::optional<std::string> description;
  std::optional<std::string> website_url;
  std::optional<std::string> instructions;
};

struct product_http_settings final {
  std::optional<std::string> version;
  bool tls_enabled{false};
  std::map<std::string, std::string, std::less<>> mandatory_headers;
};

struct product_uart_settings final {
  std::optional<int> baud_rate;
  std::optional<std::string> port;
  std::optional<std::string> framing;
};

struct backend_definition final {
  std::string id;
  backend_type type{backend_type::localhost_http_json};
  std::string base_url;
  std::map<std::string, std::string, std::less<>> headers;
};

struct http_action_definition final {
  std::string id;
  std::string description;
  std::string backend_id;
  http_method method{http_method::get};
  std::string path_template;
  std::map<std::string, std::string, std::less<>> query_parameters;
  std::map<std::string, std::string, std::less<>> headers;
  json body_template = nullptr;
  std::vector<int> success_statuses{200};
};

struct value_expectation final {
  std::string json_pointer;
  std::optional<json> equals;
  std::optional<std::string> equals_input;
};

struct precondition_definition final {
  std::string id;
  std::string description;
  std::string action_id;
  value_expectation expect;
};

struct setup_step_definition final {
  std::string id;
  std::string description;
  std::string for_precondition;
  std::string action_id;
};

struct verification_definition final {
  std::string action_id;
  value_expectation expect;
  int attempts{1};
  int delay_ms{0};
  int success_delay_ms{0};
};

struct output_field_mapping final {
  std::string name;
  output_source source{output_source::literal};
  output_transform transform{output_transform::none};
  std::optional<std::string> json_pointer;
  std::optional<std::string> input_name;
  std::optional<json> value;
  std::map<std::string, json, std::less<>> normalize;
  std::optional<json> default_value;
  bool required{false};
};

struct capability_definition final {
  std::string id;
  std::string tool_name;
  std::string description;
  json input_schema{{"type", "object"}, {"properties", json::object()}};
  std::vector<http_action_definition> actions;
  std::vector<precondition_definition> preconditions;
  std::vector<setup_step_definition> setup_steps;
  std::string main_action_id;
  std::optional<verification_definition> verification;
  std::vector<output_field_mapping> output_fields;
};

struct project_definition final {
  std::string name;
  std::optional<std::string> description;
  mcp_server_definition mcp_server;
  std::vector<mcp_transport> mcp_transports;
  std::optional<product_connector> product_connector;
  std::optional<std::string> product_name;
  std::optional<std::string> product_image_path;
  std::optional<std::string> product_category_icon;
  product_http_settings product_http;
  product_uart_settings product_uart;
  logging_options logging;
  std::vector<backend_definition> backends;
  std::vector<capability_definition> capabilities;
  std::filesystem::path source_path;
};

struct validation_issue final {
  std::string path;
  std::string message;
};

[[nodiscard]] std::string_view to_string(backend_type value) noexcept;
[[nodiscard]] std::string_view to_string(mcp_transport value) noexcept;
[[nodiscard]] std::string_view to_string(product_connector value) noexcept;
[[nodiscard]] std::string_view to_string(http_method value) noexcept;
[[nodiscard]] std::string_view to_string(output_source value) noexcept;
[[nodiscard]] std::string_view to_string(output_transform value) noexcept;

[[nodiscard]] std::optional<backend_type> parse_backend_type(std::string_view value) noexcept;
[[nodiscard]] std::optional<mcp_transport> parse_mcp_transport(std::string_view value) noexcept;
[[nodiscard]] std::optional<product_connector> parse_product_connector(std::string_view value) noexcept;
[[nodiscard]] std::optional<http_method> parse_http_method(std::string_view value) noexcept;
[[nodiscard]] std::optional<output_source> parse_output_source(std::string_view value) noexcept;
[[nodiscard]] std::optional<output_transform> parse_output_transform(std::string_view value) noexcept;

void to_json(json& target, const validation_issue& issue);

}  // namespace terva::core::project

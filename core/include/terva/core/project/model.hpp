#pragma once

#include "terva/core/json.hpp"

#include <filesystem>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace terva::core::project {

enum class service_type {
  mcp,
};

enum class mcp_transport {
  streamable_http,
  stdio,
};

enum class backend_kind {
  device,
  database,
  file,
};

enum class backend_connection_kind {
  http,
  uart,
  ethernet,
  sql,
  tree,
};

enum class http_method {
  get,
  post,
  put,
};

enum class action_type {
  http,
  sql,
  file_read,
  file_list,
  uart,
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

struct mcp_service_definition final {
  mcp_server_definition server;
  std::vector<mcp_transport> transports;
};

struct service_definition final {
  std::string id;
  std::string description;
  service_type type{service_type::mcp};
  std::optional<mcp_service_definition> mcp;
};

struct device_http_connection final {
  std::string base_url;
  std::map<std::string, std::string, std::less<>> headers;
  std::optional<std::string> version;
  bool tls_enabled{false};
};

struct device_uart_connection final {
  std::optional<int> baud_rate;
  std::optional<std::string> port;
  std::optional<std::string> framing;
};

struct device_ethernet_connection final {
  std::string host;
  std::optional<int> port;
  std::string protocol;
};

struct database_sql_connection final {
  std::string dsn;
  std::string dialect;
  std::map<std::string, std::string, std::less<>> parameters;
};

struct file_tree_connection final {
  std::string root_path;
  std::vector<std::string> include_globs;
  std::vector<std::string> exclude_globs;
  bool read_only{false};
};

struct backend_definition final {
  backend_kind kind{backend_kind::device};
  std::string name;
  std::optional<std::string> description;
  std::optional<std::string> image_path;
  std::optional<std::string> category_icon;
  backend_connection_kind connection_kind{backend_connection_kind::http};
  std::optional<device_http_connection> device_http;
  std::optional<device_uart_connection> device_uart;
  std::optional<device_ethernet_connection> device_ethernet;
  std::optional<database_sql_connection> database_sql;
  std::optional<file_tree_connection> file_tree;
};

struct http_request_operation final {
  http_method method{http_method::get};
  std::string path_template;
  std::map<std::string, std::string, std::less<>> query_parameters;
  std::map<std::string, std::string, std::less<>> headers;
  json body_template = nullptr;
  std::vector<int> success_statuses{200};
};

struct sql_query_operation final {
  std::string statement;
  std::map<std::string, std::string, std::less<>> parameters;
  std::string result_format;
};

struct file_read_operation final {
  std::string path;
  std::string format;
};

struct file_list_operation final {
  std::string path;
  std::string glob;
  bool recursive{false};
};

struct uart_exchange_operation final {
  std::string command;
  json payload_template = nullptr;
};

struct action_definition final {
  std::string id;
  std::string description;
  action_type type{action_type::http};
  std::optional<http_request_operation> http;
  std::optional<sql_query_operation> sql;
  std::optional<file_read_operation> file_read;
  std::optional<file_list_operation> file_list;
  std::optional<uart_exchange_operation> uart;
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
  std::string name;
  std::string description;
  json input_schema{{"type", "object"}, {"properties", json::object()}};
  std::vector<action_definition> actions;
  std::vector<precondition_definition> preconditions;
  std::vector<setup_step_definition> setup_steps;
  std::string main_action_id;
  std::optional<verification_definition> verification;
  std::vector<output_field_mapping> output_fields;
};

struct project_definition final {
  std::string name;
  std::optional<std::string> description;
  logging_options logging;
  std::vector<service_definition> services;
  std::optional<backend_definition> backend;
  std::vector<capability_definition> capabilities;
  std::filesystem::path source_path;
};

struct validation_issue final {
  std::string path;
  std::string message;
};

[[nodiscard]] std::string_view to_string(service_type value) noexcept;
[[nodiscard]] std::string_view to_string(mcp_transport value) noexcept;
[[nodiscard]] std::string_view to_string(backend_kind value) noexcept;
[[nodiscard]] std::string_view to_string(backend_connection_kind value) noexcept;
[[nodiscard]] std::string_view to_string(http_method value) noexcept;
[[nodiscard]] std::string_view to_string(action_type value) noexcept;
[[nodiscard]] std::string_view to_string(output_source value) noexcept;
[[nodiscard]] std::string_view to_string(output_transform value) noexcept;

[[nodiscard]] std::optional<mcp_transport> parse_mcp_transport(std::string_view value) noexcept;
[[nodiscard]] std::optional<backend_kind> parse_backend_kind(std::string_view value) noexcept;
[[nodiscard]] std::optional<backend_connection_kind> parse_backend_connection_kind(
    std::string_view value) noexcept;
[[nodiscard]] std::optional<http_method> parse_http_method(std::string_view value) noexcept;
[[nodiscard]] std::optional<action_type> parse_action_type(std::string_view value) noexcept;
[[nodiscard]] std::optional<output_source> parse_output_source(std::string_view value) noexcept;
[[nodiscard]] std::optional<output_transform> parse_output_transform(
    std::string_view value) noexcept;

void to_json(json& target, const validation_issue& issue);

}  // namespace terva::core::project

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
  localhost_http_json,
};

enum class http_method {
  get,
  post,
};

enum class output_source {
  input,
  action,
  verification,
  literal,
};

struct logging_options final {
  std::string sink{"stderr"};
  std::optional<std::filesystem::path> file_path;
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
};

struct output_field_mapping final {
  std::string name;
  output_source source{output_source::literal};
  std::optional<std::string> json_pointer;
  std::optional<std::string> input_name;
  std::optional<json> value;
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
[[nodiscard]] std::string_view to_string(http_method value) noexcept;
[[nodiscard]] std::string_view to_string(output_source value) noexcept;

[[nodiscard]] std::optional<backend_type> parse_backend_type(std::string_view value) noexcept;
[[nodiscard]] std::optional<http_method> parse_http_method(std::string_view value) noexcept;
[[nodiscard]] std::optional<output_source> parse_output_source(std::string_view value) noexcept;

void to_json(json& target, const validation_issue& issue);

}  // namespace terva::core::project


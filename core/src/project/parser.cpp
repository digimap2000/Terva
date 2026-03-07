#include "terva/core/project/parser.hpp"

#include <fstream>
#include <sstream>
#include <string>

namespace terva::core::project {
namespace {

using json_object = json::object_t;

[[nodiscard]] std::expected<const json*, std::string> require_field(
    const json& object,
    std::string_view field,
    std::string_view path) {
  if (!object.is_object()) {
    return std::unexpected(std::string(path) + " must be an object");
  }

  const auto iterator = object.find(field);
  if (iterator == object.end()) {
    return std::unexpected(std::string(path) + "." + std::string(field) + " is required");
  }

  return &*iterator;
}

[[nodiscard]] std::expected<std::string, std::string> require_string(
    const json& object,
    std::string_view field,
    std::string_view path) {
  const auto value = require_field(object, field, path);
  if (!value) {
    return std::unexpected(value.error());
  }
  if (!(*value)->is_string()) {
    return std::unexpected(std::string(path) + "." + std::string(field) + " must be a string");
  }
  return (*value)->get<std::string>();
}

[[nodiscard]] std::expected<const json*, std::string> require_array(
    const json& object,
    std::string_view field,
    std::string_view path) {
  const auto value = require_field(object, field, path);
  if (!value) {
    return std::unexpected(value.error());
  }
  if (!(*value)->is_array()) {
    return std::unexpected(std::string(path) + "." + std::string(field) + " must be an array");
  }
  return *value;
}

[[nodiscard]] std::expected<backend_definition, std::string> parse_backend(
    const json& value,
    std::size_t index) {
  const auto path = std::string("backends[") + std::to_string(index) + "]";
  if (!value.is_object()) {
    return std::unexpected(path + " must be an object");
  }

  backend_definition backend;
  auto id = require_string(value, "id", path);
  if (!id) {
    return std::unexpected(id.error());
  }
  backend.id = std::move(*id);

  auto type_name = require_string(value, "type", path);
  if (!type_name) {
    return std::unexpected(type_name.error());
  }
  const auto parsed_type = parse_backend_type(*type_name);
  if (!parsed_type) {
    return std::unexpected(path + ".type is not supported: " + *type_name);
  }
  backend.type = *parsed_type;

  auto base_url = require_string(value, "base_url", path);
  if (!base_url) {
    return std::unexpected(base_url.error());
  }
  backend.base_url = std::move(*base_url);

  if (const auto headers = value.find("headers"); headers != value.end()) {
    if (!headers->is_object()) {
      return std::unexpected(path + ".headers must be an object");
    }
    for (const auto& [name, header_value] : headers->items()) {
      if (!header_value.is_string()) {
        return std::unexpected(path + ".headers." + name + " must be a string");
      }
      backend.headers.emplace(name, header_value.get<std::string>());
    }
  }

  return backend;
}

[[nodiscard]] std::expected<http_action_definition, std::string> parse_action(
    const json& value,
    std::string_view capability_path,
    std::size_t index) {
  const auto path =
      std::string(capability_path) + ".actions[" + std::to_string(index) + "]";
  if (!value.is_object()) {
    return std::unexpected(path + " must be an object");
  }

  http_action_definition action;
  auto id = require_string(value, "id", path);
  if (!id) {
    return std::unexpected(id.error());
  }
  action.id = std::move(*id);

  if (const auto description = value.find("description");
      description != value.end()) {
    if (!description->is_string()) {
      return std::unexpected(path + ".description must be a string");
    }
    action.description = description->get<std::string>();
  }

  auto backend_id = require_string(value, "backend", path);
  if (!backend_id) {
    return std::unexpected(backend_id.error());
  }
  action.backend_id = std::move(*backend_id);

  auto method_name = require_string(value, "method", path);
  if (!method_name) {
    return std::unexpected(method_name.error());
  }
  const auto parsed_method = parse_http_method(*method_name);
  if (!parsed_method) {
    return std::unexpected(path + ".method is not supported: " + *method_name);
  }
  action.method = *parsed_method;

  auto action_path = require_string(value, "path", path);
  if (!action_path) {
    return std::unexpected(action_path.error());
  }
  action.path_template = std::move(*action_path);

  if (const auto query = value.find("query"); query != value.end()) {
    if (!query->is_object()) {
      return std::unexpected(path + ".query must be an object");
    }
    for (const auto& [name, query_value] : query->items()) {
      if (!query_value.is_string()) {
        return std::unexpected(path + ".query." + name + " must be a string");
      }
      action.query_parameters.emplace(name, query_value.get<std::string>());
    }
  }

  if (const auto headers = value.find("headers"); headers != value.end()) {
    if (!headers->is_object()) {
      return std::unexpected(path + ".headers must be an object");
    }
    for (const auto& [name, header_value] : headers->items()) {
      if (!header_value.is_string()) {
        return std::unexpected(path + ".headers." + name + " must be a string");
      }
      action.headers.emplace(name, header_value.get<std::string>());
    }
  }

  if (const auto body = value.find("body"); body != value.end()) {
    action.body_template = *body;
  }

  if (const auto statuses = value.find("success_statuses");
      statuses != value.end()) {
    if (!statuses->is_array()) {
      return std::unexpected(path + ".success_statuses must be an array");
    }
    action.success_statuses.clear();
    for (std::size_t status_index = 0; status_index < statuses->size();
         ++status_index) {
      if (!(*statuses)[status_index].is_number_integer()) {
        return std::unexpected(path + ".success_statuses[" +
                               std::to_string(status_index) +
                               "] must be an integer");
      }
      action.success_statuses.push_back((*statuses)[status_index].get<int>());
    }
  }

  return action;
}

[[nodiscard]] std::expected<value_expectation, std::string> parse_expectation(
    const json& value,
    std::string_view path) {
  if (!value.is_object()) {
    return std::unexpected(std::string(path) + " must be an object");
  }

  value_expectation expectation;
  auto json_pointer = require_string(value, "json_pointer", path);
  if (!json_pointer) {
    return std::unexpected(json_pointer.error());
  }
  expectation.json_pointer = std::move(*json_pointer);

  if (const auto literal = value.find("equals"); literal != value.end()) {
    expectation.equals = *literal;
  }
  if (const auto input_name = value.find("equals_input");
      input_name != value.end()) {
    if (!input_name->is_string()) {
      return std::unexpected(std::string(path) + ".equals_input must be a string");
    }
    expectation.equals_input = input_name->get<std::string>();
  }

  return expectation;
}

[[nodiscard]] std::expected<precondition_definition, std::string>
parse_precondition(const json& value,
                   std::string_view capability_path,
                   std::size_t index) {
  const auto path =
      std::string(capability_path) + ".preconditions[" + std::to_string(index) + "]";
  if (!value.is_object()) {
    return std::unexpected(path + " must be an object");
  }

  precondition_definition precondition;
  auto id = require_string(value, "id", path);
  if (!id) {
    return std::unexpected(id.error());
  }
  precondition.id = std::move(*id);

  if (const auto description = value.find("description");
      description != value.end()) {
    if (!description->is_string()) {
      return std::unexpected(path + ".description must be a string");
    }
    precondition.description = description->get<std::string>();
  }

  auto action_id = require_string(value, "action", path);
  if (!action_id) {
    return std::unexpected(action_id.error());
  }
  precondition.action_id = std::move(*action_id);

  const auto expectation = require_field(value, "expect", path);
  if (!expectation) {
    return std::unexpected(expectation.error());
  }
  auto parsed_expectation = parse_expectation(**expectation, path + ".expect");
  if (!parsed_expectation) {
    return std::unexpected(parsed_expectation.error());
  }
  precondition.expect = std::move(*parsed_expectation);

  return precondition;
}

[[nodiscard]] std::expected<setup_step_definition, std::string> parse_setup_step(
    const json& value,
    std::string_view capability_path,
    std::size_t index) {
  const auto path =
      std::string(capability_path) + ".setup[" + std::to_string(index) + "]";
  if (!value.is_object()) {
    return std::unexpected(path + " must be an object");
  }

  setup_step_definition step;
  auto id = require_string(value, "id", path);
  if (!id) {
    return std::unexpected(id.error());
  }
  step.id = std::move(*id);

  if (const auto description = value.find("description");
      description != value.end()) {
    if (!description->is_string()) {
      return std::unexpected(path + ".description must be a string");
    }
    step.description = description->get<std::string>();
  }

  auto for_precondition = require_string(value, "for_precondition", path);
  if (!for_precondition) {
    return std::unexpected(for_precondition.error());
  }
  step.for_precondition = std::move(*for_precondition);

  auto action_id = require_string(value, "action", path);
  if (!action_id) {
    return std::unexpected(action_id.error());
  }
  step.action_id = std::move(*action_id);

  return step;
}

[[nodiscard]] std::expected<verification_definition, std::string> parse_verification(
    const json& value,
    std::string_view capability_path) {
  const auto path = std::string(capability_path) + ".verification";
  if (!value.is_object()) {
    return std::unexpected(path + " must be an object");
  }

  verification_definition verification;
  auto action_id = require_string(value, "action", path);
  if (!action_id) {
    return std::unexpected(action_id.error());
  }
  verification.action_id = std::move(*action_id);

  const auto expectation = require_field(value, "expect", path);
  if (!expectation) {
    return std::unexpected(expectation.error());
  }
  auto parsed_expectation = parse_expectation(**expectation, path + ".expect");
  if (!parsed_expectation) {
    return std::unexpected(parsed_expectation.error());
  }
  verification.expect = std::move(*parsed_expectation);

  if (const auto attempts = value.find("attempts"); attempts != value.end()) {
    if (!attempts->is_number_integer()) {
      return std::unexpected(path + ".attempts must be an integer");
    }
    verification.attempts = attempts->get<int>();
  }
  if (const auto delay_ms = value.find("delay_ms"); delay_ms != value.end()) {
    if (!delay_ms->is_number_integer()) {
      return std::unexpected(path + ".delay_ms must be an integer");
    }
    verification.delay_ms = delay_ms->get<int>();
  }
  if (const auto success_delay_ms = value.find("success_delay_ms");
      success_delay_ms != value.end()) {
    if (!success_delay_ms->is_number_integer()) {
      return std::unexpected(path + ".success_delay_ms must be an integer");
    }
    verification.success_delay_ms = success_delay_ms->get<int>();
  }

  return verification;
}

[[nodiscard]] std::expected<output_field_mapping, std::string> parse_output_mapping(
    std::string name,
    const json& value,
    std::string_view capability_path) {
  const auto path =
      std::string(capability_path) + ".output_mapping." + std::string(name);
  if (!value.is_object()) {
    return std::unexpected(path + " must be an object");
  }

  output_field_mapping mapping;
  mapping.name = std::move(name);

  auto source_name = require_string(value, "source", path);
  if (!source_name) {
    return std::unexpected(source_name.error());
  }
  const auto parsed_source = parse_output_source(*source_name);
  if (!parsed_source) {
    return std::unexpected(path + ".source is not supported: " + *source_name);
  }
  mapping.source = *parsed_source;

  if (const auto json_pointer = value.find("json_pointer");
      json_pointer != value.end()) {
    if (!json_pointer->is_string()) {
      return std::unexpected(path + ".json_pointer must be a string");
    }
    mapping.json_pointer = json_pointer->get<std::string>();
  }
  if (const auto input_name = value.find("input_name");
      input_name != value.end()) {
    if (!input_name->is_string()) {
      return std::unexpected(path + ".input_name must be a string");
    }
    mapping.input_name = input_name->get<std::string>();
  }
  if (const auto literal = value.find("value"); literal != value.end()) {
    mapping.value = *literal;
  }
  if (const auto normalize = value.find("normalize"); normalize != value.end()) {
    if (!normalize->is_object()) {
      return std::unexpected(path + ".normalize must be an object");
    }
    for (const auto& [raw_value, mapped_value] : normalize->items()) {
      mapping.normalize.emplace(raw_value, mapped_value);
    }
  }
  if (const auto default_value = value.find("default"); default_value != value.end()) {
    mapping.default_value = *default_value;
  }

  return mapping;
}

[[nodiscard]] std::expected<capability_definition, std::string> parse_capability(
    const json& value,
    std::size_t index) {
  const auto path = std::string("capabilities[") + std::to_string(index) + "]";
  if (!value.is_object()) {
    return std::unexpected(path + " must be an object");
  }

  capability_definition capability;

  auto id = require_string(value, "id", path);
  if (!id) {
    return std::unexpected(id.error());
  }
  capability.id = std::move(*id);

  auto tool_name = require_string(value, "tool_name", path);
  if (!tool_name) {
    return std::unexpected(tool_name.error());
  }
  capability.tool_name = std::move(*tool_name);

  auto description = require_string(value, "description", path);
  if (!description) {
    return std::unexpected(description.error());
  }
  capability.description = std::move(*description);

  const auto input_schema = require_field(value, "input_schema", path);
  if (!input_schema) {
    return std::unexpected(input_schema.error());
  }
  if (!(*input_schema)->is_object()) {
    return std::unexpected(path + ".input_schema must be an object");
  }
  capability.input_schema = **input_schema;

  auto actions = require_array(value, "actions", path);
  if (!actions) {
    return std::unexpected(actions.error());
  }
  for (std::size_t action_index = 0; action_index < (*actions)->size();
       ++action_index) {
    auto action = parse_action((**actions)[action_index], path, action_index);
    if (!action) {
      return std::unexpected(action.error());
    }
    capability.actions.push_back(std::move(*action));
  }

  if (const auto preconditions = value.find("preconditions");
      preconditions != value.end()) {
    if (!preconditions->is_array()) {
      return std::unexpected(path + ".preconditions must be an array");
    }
    for (std::size_t precondition_index = 0;
         precondition_index < preconditions->size();
         ++precondition_index) {
      auto precondition = parse_precondition(
          (*preconditions)[precondition_index], path, precondition_index);
      if (!precondition) {
        return std::unexpected(precondition.error());
      }
      capability.preconditions.push_back(std::move(*precondition));
    }
  }

  if (const auto setup_steps = value.find("setup"); setup_steps != value.end()) {
    if (!setup_steps->is_array()) {
      return std::unexpected(path + ".setup must be an array");
    }
    for (std::size_t setup_index = 0; setup_index < setup_steps->size();
         ++setup_index) {
      auto setup = parse_setup_step((*setup_steps)[setup_index], path, setup_index);
      if (!setup) {
        return std::unexpected(setup.error());
      }
      capability.setup_steps.push_back(std::move(*setup));
    }
  }

  auto action_id = require_string(value, "action", path);
  if (!action_id) {
    return std::unexpected(action_id.error());
  }
  capability.main_action_id = std::move(*action_id);

  if (const auto verification = value.find("verification");
      verification != value.end()) {
    auto parsed_verification = parse_verification(*verification, path);
    if (!parsed_verification) {
      return std::unexpected(parsed_verification.error());
    }
    capability.verification = std::move(*parsed_verification);
  }

  if (const auto output_mapping = value.find("output_mapping");
      output_mapping != value.end()) {
    if (!output_mapping->is_object()) {
      return std::unexpected(path + ".output_mapping must be an object");
    }
    for (const auto& [name, mapping_value] : output_mapping->items()) {
      auto mapping = parse_output_mapping(name, mapping_value, path);
      if (!mapping) {
        return std::unexpected(mapping.error());
      }
      capability.output_fields.push_back(std::move(*mapping));
    }
  }

  return capability;
}

}  // namespace

std::string_view to_string(const backend_type value) noexcept {
  switch (value) {
    case backend_type::http_json:
      return "http_json";
    case backend_type::localhost_http_json:
      return "localhost_http_json";
  }
  return "unknown";
}

std::string_view to_string(const http_method value) noexcept {
  switch (value) {
    case http_method::get:
      return "GET";
    case http_method::post:
      return "POST";
    case http_method::put:
      return "PUT";
  }
  return "UNKNOWN";
}

std::string_view to_string(const output_source value) noexcept {
  switch (value) {
    case output_source::input:
      return "input";
    case output_source::action:
      return "action";
    case output_source::verification:
      return "verification";
    case output_source::literal:
      return "literal";
  }
  return "unknown";
}

std::optional<backend_type> parse_backend_type(const std::string_view value) noexcept {
  if (value == "http_json") {
    return backend_type::http_json;
  }
  if (value == "localhost_http_json") {
    return backend_type::localhost_http_json;
  }
  return std::nullopt;
}

std::optional<http_method> parse_http_method(const std::string_view value) noexcept {
  if (value == "GET") {
    return http_method::get;
  }
  if (value == "POST") {
    return http_method::post;
  }
  if (value == "PUT") {
    return http_method::put;
  }
  return std::nullopt;
}

std::optional<output_source> parse_output_source(
    const std::string_view value) noexcept {
  if (value == "input") {
    return output_source::input;
  }
  if (value == "action") {
    return output_source::action;
  }
  if (value == "verification") {
    return output_source::verification;
  }
  if (value == "literal") {
    return output_source::literal;
  }
  return std::nullopt;
}

void to_json(json& target, const validation_issue& issue) {
  target = json{
      {"path", issue.path},
      {"message", issue.message},
  };
}

std::expected<project_definition, std::string> load_project_file(
    const std::filesystem::path& path) {
  std::ifstream stream(path);
  if (!stream) {
    return std::unexpected("unable to open project file: " + path.string());
  }

  std::stringstream buffer;
  buffer << stream.rdbuf();

  json document;
  try {
    document = json::parse(buffer.str());
  } catch (const std::exception& exception) {
    return std::unexpected("project file is not valid JSON: " +
                           std::string(exception.what()));
  }

  if (!document.is_object()) {
    return std::unexpected("project root must be a JSON object");
  }

  project_definition project;
  project.source_path = path;

  auto name = require_string(document, "name", "project");
  if (!name) {
    return std::unexpected(name.error());
  }
  project.name = std::move(*name);

  if (const auto description = document.find("description");
      description != document.end()) {
    if (!description->is_string()) {
      return std::unexpected("project.description must be a string");
    }
    project.description = description->get<std::string>();
  }

  if (const auto logging = document.find("logging"); logging != document.end()) {
    if (!logging->is_object()) {
      return std::unexpected("project.logging must be an object");
    }
    if (const auto sink = logging->find("sink"); sink != logging->end()) {
      if (!sink->is_string()) {
        return std::unexpected("project.logging.sink must be a string");
      }
      project.logging.sink = sink->get<std::string>();
    }
    if (const auto file_path = logging->find("file_path");
        file_path != logging->end()) {
      if (!file_path->is_string()) {
        return std::unexpected("project.logging.file_path must be a string");
      }
      project.logging.file_path = std::filesystem::path(file_path->get<std::string>());
    }
  }

  auto backends = require_array(document, "backends", "project");
  if (!backends) {
    return std::unexpected(backends.error());
  }
  for (std::size_t index = 0; index < (*backends)->size(); ++index) {
    auto backend = parse_backend((**backends)[index], index);
    if (!backend) {
      return std::unexpected(backend.error());
    }
    project.backends.push_back(std::move(*backend));
  }

  auto capabilities = require_array(document, "capabilities", "project");
  if (!capabilities) {
    return std::unexpected(capabilities.error());
  }
  for (std::size_t index = 0; index < (*capabilities)->size(); ++index) {
    auto capability = parse_capability((**capabilities)[index], index);
    if (!capability) {
      return std::unexpected(capability.error());
    }
    project.capabilities.push_back(std::move(*capability));
  }

  return project;
}

}  // namespace terva::core::project

#include "terva/core/project/validator.hpp"

#include <set>
#include <string>
#include <unordered_map>

namespace terva::core::project {
namespace {

[[nodiscard]] bool is_localhost_url(const std::string& value) {
  return value.starts_with("http://127.0.0.1") ||
         value.starts_with("http://localhost") ||
         value.starts_with("http://[::1]");
}

[[nodiscard]] bool json_pointer_looks_valid(const std::string& value) {
  return !value.empty() && value.front() == '/';
}

[[nodiscard]] std::set<std::string, std::less<>> schema_property_names(
    const json& schema) {
  std::set<std::string, std::less<>> names;
  if (!schema.is_object()) {
    return names;
  }
  const auto properties = schema.find("properties");
  if (properties == schema.end() || !properties->is_object()) {
    return names;
  }
  for (const auto& [name, _] : properties->items()) {
    names.insert(name);
  }
  return names;
}

}  // namespace

std::vector<validation_issue> validate_project(const project_definition& project) {
  std::vector<validation_issue> issues;

  if (project.name.empty()) {
    issues.push_back({"project.name", "must not be empty"});
  }
  if (project.backends.empty()) {
    issues.push_back({"project.backends", "must contain at least one backend"});
  }
  if (project.capabilities.empty()) {
    issues.push_back({"project.capabilities", "must contain at least one capability"});
  }

  std::set<std::string, std::less<>> backend_ids;
  for (const auto& backend : project.backends) {
    const auto path = "project.backends[" + backend.id + "]";
    if (backend.id.empty()) {
      issues.push_back({path + ".id", "must not be empty"});
    }
    if (!backend_ids.insert(backend.id).second) {
      issues.push_back({path + ".id", "must be unique"});
    }
    if (!is_localhost_url(backend.base_url)) {
      issues.push_back({path + ".base_url",
                        "must point to a localhost HTTP endpoint for v0"});
    }
  }

  std::set<std::string, std::less<>> capability_ids;
  std::set<std::string, std::less<>> tool_names;

  for (const auto& capability : project.capabilities) {
    const auto capability_path = "capability[" + capability.id + "]";
    if (capability.id.empty()) {
      issues.push_back({capability_path + ".id", "must not be empty"});
    }
    if (!capability_ids.insert(capability.id).second) {
      issues.push_back({capability_path + ".id", "must be unique"});
    }
    if (capability.tool_name.empty()) {
      issues.push_back({capability_path + ".tool_name", "must not be empty"});
    }
    if (!tool_names.insert(capability.tool_name).second) {
      issues.push_back({capability_path + ".tool_name", "must be unique"});
    }
    if (capability.description.empty()) {
      issues.push_back({capability_path + ".description", "must not be empty"});
    }

    if (!capability.input_schema.is_object()) {
      issues.push_back({capability_path + ".input_schema", "must be an object"});
    } else {
      const auto type = capability.input_schema.find("type");
      if (type == capability.input_schema.end() || !type->is_string() ||
          *type != "object") {
        issues.push_back({capability_path + ".input_schema.type",
                          "must be \"object\" for v0"});
      }
      const auto properties = capability.input_schema.find("properties");
      if (properties == capability.input_schema.end() || !properties->is_object()) {
        issues.push_back({capability_path + ".input_schema.properties",
                          "must be an object"});
      }
      if (const auto required = capability.input_schema.find("required");
          required != capability.input_schema.end()) {
        if (!required->is_array()) {
          issues.push_back({capability_path + ".input_schema.required",
                            "must be an array"});
        } else {
          const auto property_names = schema_property_names(capability.input_schema);
          for (std::size_t index = 0; index < required->size(); ++index) {
            if (!(*required)[index].is_string()) {
              issues.push_back({capability_path + ".input_schema.required[" +
                                    std::to_string(index) + "]",
                                "must be a string"});
              continue;
            }
            const auto property_name = (*required)[index].get<std::string>();
            if (!property_names.contains(property_name)) {
              issues.push_back(
                  {capability_path + ".input_schema.required[" +
                       std::to_string(index) + "]",
                   "must reference a property declared in input_schema.properties"});
            }
          }
        }
      }
    }

    std::set<std::string, std::less<>> action_ids;
    for (const auto& action : capability.actions) {
      const auto path = capability_path + ".action[" + action.id + "]";
      if (action.id.empty()) {
        issues.push_back({path + ".id", "must not be empty"});
      }
      if (!action_ids.insert(action.id).second) {
        issues.push_back({path + ".id", "must be unique within a capability"});
      }
      if (!backend_ids.contains(action.backend_id)) {
        issues.push_back({path + ".backend", "must reference a known backend"});
      }
      if (action.path_template.empty()) {
        issues.push_back({path + ".path", "must not be empty"});
      }
      if (action.success_statuses.empty()) {
        issues.push_back({path + ".success_statuses",
                          "must contain at least one status code"});
      }
      if (action.method == http_method::get && !action.body_template.is_null()) {
        issues.push_back({path + ".body", "GET actions must not define a request body"});
      }
    }

    if (!action_ids.contains(capability.main_action_id)) {
      issues.push_back({capability_path + ".action",
                        "must reference a known action id"});
    }

    std::set<std::string, std::less<>> precondition_ids;
    for (const auto& precondition : capability.preconditions) {
      const auto path = capability_path + ".precondition[" + precondition.id + "]";
      if (precondition.id.empty()) {
        issues.push_back({path + ".id", "must not be empty"});
      }
      if (!precondition_ids.insert(precondition.id).second) {
        issues.push_back({path + ".id", "must be unique within a capability"});
      }
      if (!action_ids.contains(precondition.action_id)) {
        issues.push_back({path + ".action", "must reference a known action"});
      }
      if (!json_pointer_looks_valid(precondition.expect.json_pointer)) {
        issues.push_back({path + ".expect.json_pointer",
                          "must be a non-empty JSON pointer"});
      }
      if (!precondition.expect.equals.has_value() &&
          !precondition.expect.equals_input.has_value()) {
        issues.push_back({path + ".expect",
                          "must define equals or equals_input"});
      }
    }

    std::set<std::string, std::less<>> setup_ids;
    std::set<std::string, std::less<>> preconditions_with_setup;
    for (const auto& setup_step : capability.setup_steps) {
      const auto path = capability_path + ".setup[" + setup_step.id + "]";
      if (setup_step.id.empty()) {
        issues.push_back({path + ".id", "must not be empty"});
      }
      if (!setup_ids.insert(setup_step.id).second) {
        issues.push_back({path + ".id", "must be unique within a capability"});
      }
      if (!precondition_ids.contains(setup_step.for_precondition)) {
        issues.push_back({path + ".for_precondition",
                          "must reference a known precondition"});
      }
      if (!action_ids.contains(setup_step.action_id)) {
        issues.push_back({path + ".action", "must reference a known action"});
      }
      if (!preconditions_with_setup.insert(setup_step.for_precondition).second) {
        issues.push_back({path + ".for_precondition",
                          "must not have multiple setup steps in v0"});
      }
    }

    if (capability.verification.has_value()) {
      const auto& verification = *capability.verification;
      if (!action_ids.contains(verification.action_id)) {
        issues.push_back({capability_path + ".verification.action",
                          "must reference a known action"});
      }
      if (!json_pointer_looks_valid(verification.expect.json_pointer)) {
        issues.push_back({capability_path + ".verification.expect.json_pointer",
                          "must be a non-empty JSON pointer"});
      }
      if (!verification.expect.equals.has_value() &&
          !verification.expect.equals_input.has_value()) {
        issues.push_back({capability_path + ".verification.expect",
                          "must define equals or equals_input"});
      }
    }

    const auto property_names = schema_property_names(capability.input_schema);
    for (const auto& output : capability.output_fields) {
      const auto path = capability_path + ".output_mapping[" + output.name + "]";
      if (output.name.empty()) {
        issues.push_back({path + ".name", "must not be empty"});
      }
      if ((output.source == output_source::action ||
           output.source == output_source::verification) &&
          !output.json_pointer.has_value()) {
        issues.push_back({path + ".json_pointer",
                          "must be set for action and verification sources"});
      }
      if (output.source == output_source::input) {
        if (!output.input_name.has_value()) {
          issues.push_back({path + ".input_name",
                            "must be set for input output mappings"});
        } else if (!property_names.contains(*output.input_name)) {
          issues.push_back({path + ".input_name",
                            "must reference an input schema property"});
        }
      }
      if (output.source == output_source::literal && !output.value.has_value()) {
        issues.push_back({path + ".value",
                          "must be set for literal output mappings"});
      }
    }
  }

  return issues;
}

}  // namespace terva::core::project


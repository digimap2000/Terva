#include "terva/core/project/validator.hpp"

#include <set>
#include <string>

namespace terva::core::project {
namespace {

[[nodiscard]] bool is_http_url(const std::string& value) {
  return value.starts_with("http://") || value.starts_with("https://");
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

void validate_named_values(
    std::vector<validation_issue>& issues,
    const std::map<std::string, std::string, std::less<>>& values,
    const std::string& path,
    const std::string& label) {
  for (const auto& [name, value] : values) {
    if (name.empty()) {
      issues.push_back({path, label + " names must not be empty"});
    }
    if (value.empty()) {
      issues.push_back({path + "." + name, label + " values must not be empty"});
    }
  }
}

void validate_backend(std::vector<validation_issue>& issues,
                      const backend_definition& backend) {
  if (backend.name.empty()) {
    issues.push_back({"project.backend.name", "must not be empty"});
  }

  switch (backend.kind) {
    case backend_kind::device:
      switch (backend.connection_kind) {
        case backend_connection_kind::http:
          if (!backend.device_http.has_value()) {
            issues.push_back({"project.backend.device.http",
                              "must be defined for an HTTP device backend"});
            return;
          }
          if (!is_http_url(backend.device_http->base_url)) {
            issues.push_back({"project.backend.device.http.base_url",
                              "must be an HTTP or HTTPS URL"});
          }
          validate_named_values(issues, backend.device_http->headers,
                                "project.backend.device.http.headers", "header");
          break;
        case backend_connection_kind::uart:
          if (!backend.device_uart.has_value()) {
            issues.push_back({"project.backend.device.uart",
                              "must be defined for a UART device backend"});
            return;
          }
          if (backend.device_uart->baud_rate.has_value() &&
              *backend.device_uart->baud_rate <= 0) {
            issues.push_back({"project.backend.device.uart.baud_rate",
                              "must be greater than 0"});
          }
          if (!backend.device_uart->port.has_value() || backend.device_uart->port->empty()) {
            issues.push_back({"project.backend.device.uart.port", "must not be empty"});
          }
          break;
        case backend_connection_kind::ethernet:
          if (!backend.device_ethernet.has_value()) {
            issues.push_back({"project.backend.device.ethernet",
                              "must be defined for an ethernet device backend"});
            return;
          }
          if (backend.device_ethernet->host.empty()) {
            issues.push_back({"project.backend.device.ethernet.host", "must not be empty"});
          }
          if (backend.device_ethernet->port.has_value() &&
              *backend.device_ethernet->port <= 0) {
            issues.push_back({"project.backend.device.ethernet.port",
                              "must be greater than 0"});
          }
          if (backend.device_ethernet->protocol.empty()) {
            issues.push_back({"project.backend.device.ethernet.protocol",
                              "must not be empty"});
          }
          break;
        case backend_connection_kind::sql:
        case backend_connection_kind::tree:
          issues.push_back({"project.backend.connection_kind",
                            "is not valid for a device backend"});
          break;
      }
      break;
    case backend_kind::database:
      if (backend.connection_kind != backend_connection_kind::sql) {
        issues.push_back({"project.backend.connection_kind",
                          "must be sql for a database backend"});
        return;
      }
      if (!backend.database_sql.has_value()) {
        issues.push_back({"project.backend.database.sql",
                          "must be defined for a database backend"});
        return;
      }
      if (backend.database_sql->dsn.empty()) {
        issues.push_back({"project.backend.database.sql.dsn", "must not be empty"});
      }
      if (backend.database_sql->dialect.empty()) {
        issues.push_back({"project.backend.database.sql.dialect", "must not be empty"});
      }
      validate_named_values(issues, backend.database_sql->parameters,
                            "project.backend.database.sql.parameters", "parameter");
      break;
    case backend_kind::file:
      if (backend.connection_kind != backend_connection_kind::tree) {
        issues.push_back({"project.backend.connection_kind",
                          "must be tree for a file backend"});
        return;
      }
      if (!backend.file_tree.has_value()) {
        issues.push_back({"project.backend.file.tree",
                          "must be defined for a file backend"});
        return;
      }
      if (backend.file_tree->root_path.empty()) {
        issues.push_back({"project.backend.file.tree.root_path", "must not be empty"});
      }
      break;
  }
}

void validate_service(std::vector<validation_issue>& issues,
                      const service_definition& service,
                      std::set<std::string, std::less<>>& service_ids) {
  const auto path = "project.services[" + service.id + "]";
  if (service.id.empty()) {
    issues.push_back({path + ".id", "must not be empty"});
  } else if (!service_ids.insert(service.id).second) {
    issues.push_back({path + ".id", "must be unique"});
  }

  switch (service.type) {
    case service_type::mcp:
      if (!service.mcp.has_value()) {
        issues.push_back({path + ".mcp", "must be defined"});
        return;
      }
      if (service.mcp->server.name.empty()) {
        issues.push_back({path + ".mcp.server.name", "must not be empty"});
      }
      if (service.mcp->server.version.empty()) {
        issues.push_back({path + ".mcp.server.version", "must not be empty"});
      }
      if (service.mcp->server.website_url.has_value() &&
          !service.mcp->server.website_url->empty() &&
          !is_http_url(*service.mcp->server.website_url)) {
        issues.push_back({path + ".mcp.server.website_url",
                          "must be an HTTP or HTTPS URL"});
      }
      if (service.mcp->transports.empty()) {
        issues.push_back({path + ".mcp.transports",
                          "must contain at least one transport"});
      }
      break;
  }
}

[[nodiscard]] bool action_supported_by_backend(const action_definition& action,
                                               const backend_definition& backend) {
  switch (action.type) {
    case action_type::http:
      return backend.kind == backend_kind::device &&
             backend.connection_kind == backend_connection_kind::http;
    case action_type::sql:
      return backend.kind == backend_kind::database &&
             backend.connection_kind == backend_connection_kind::sql;
    case action_type::file_read:
    case action_type::file_list:
      return backend.kind == backend_kind::file &&
             backend.connection_kind == backend_connection_kind::tree;
    case action_type::uart:
      return backend.kind == backend_kind::device &&
             backend.connection_kind == backend_connection_kind::uart;
  }
  return false;
}

void validate_action(std::vector<validation_issue>& issues,
                     const action_definition& action,
                     const std::string& path,
                     const backend_definition& backend) {
  if (action.id.empty()) {
    issues.push_back({path + ".id", "must not be empty"});
  }
  if (!action_supported_by_backend(action, backend)) {
    issues.push_back({path + ".operation",
                      "is not compatible with the selected backend"});
  }

  switch (action.type) {
    case action_type::http:
      if (!action.http.has_value()) {
        issues.push_back({path + ".http", "must be defined"});
        return;
      }
      if (action.http->path_template.empty()) {
        issues.push_back({path + ".http.path", "must not be empty"});
      }
      validate_named_values(issues, action.http->query_parameters,
                            path + ".http.query", "query parameter");
      validate_named_values(issues, action.http->headers,
                            path + ".http.headers", "header");
      if (action.http->success_statuses.empty()) {
        issues.push_back({path + ".http.success_statuses",
                          "must contain at least one status code"});
      }
      if (action.http->method == http_method::get &&
          !action.http->body_template.is_null()) {
        issues.push_back({path + ".http.body",
                          "GET actions must not define a request body"});
      }
      break;
    case action_type::sql:
      if (!action.sql.has_value()) {
        issues.push_back({path + ".sql", "must be defined"});
        return;
      }
      if (action.sql->statement.empty()) {
        issues.push_back({path + ".sql.statement", "must not be empty"});
      }
      validate_named_values(issues, action.sql->parameters,
                            path + ".sql.parameters", "parameter");
      break;
    case action_type::file_read:
      if (!action.file_read.has_value()) {
        issues.push_back({path + ".file_read", "must be defined"});
        return;
      }
      if (action.file_read->path.empty()) {
        issues.push_back({path + ".file_read.path", "must not be empty"});
      }
      break;
    case action_type::file_list:
      if (!action.file_list.has_value()) {
        issues.push_back({path + ".file_list", "must be defined"});
        return;
      }
      if (action.file_list->path.empty()) {
        issues.push_back({path + ".file_list.path", "must not be empty"});
      }
      break;
    case action_type::uart:
      if (!action.uart.has_value()) {
        issues.push_back({path + ".uart", "must be defined"});
        return;
      }
      if (action.uart->command.empty()) {
        issues.push_back({path + ".uart.command", "must not be empty"});
      }
      break;
  }
}

}  // namespace

std::vector<validation_issue> validate_project(const project_definition& project) {
  std::vector<validation_issue> issues;

  if (project.name.empty()) {
    issues.push_back({"project.name", "must not be empty"});
  }
  if (!project.backend.has_value()) {
    issues.push_back({"project.backend", "must be set"});
  }
  if (project.services.empty()) {
    issues.push_back({"project.services", "must contain at least one service"});
  }
  if (project.capabilities.empty()) {
    issues.push_back({"project.capabilities", "must contain at least one capability"});
  }

  if (project.backend.has_value()) {
    validate_backend(issues, *project.backend);
  }

  std::set<std::string, std::less<>> service_ids;
  for (const auto& service : project.services) {
    validate_service(issues, service, service_ids);
  }

  std::set<std::string, std::less<>> capability_ids;
  std::set<std::string, std::less<>> capability_names;

  for (const auto& capability : project.capabilities) {
    const auto capability_path = "capability[" + capability.id + "]";
    if (capability.id.empty()) {
      issues.push_back({capability_path + ".id", "must not be empty"});
    }
    if (!capability_ids.insert(capability.id).second) {
      issues.push_back({capability_path + ".id", "must be unique"});
    }
    if (capability.name.empty()) {
      issues.push_back({capability_path + ".name", "must not be empty"});
    }
    if (!capability.name.empty() && !capability_names.insert(capability.name).second) {
      issues.push_back({capability_path + ".name", "must be unique"});
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
        issues.push_back({capability_path + ".input_schema.type", "must be \"object\""});
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
              issues.push_back({capability_path + ".input_schema.required[" +
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
      if (!action_ids.insert(action.id).second) {
        issues.push_back({path + ".id", "must be unique within a capability"});
      }
      if (project.backend.has_value()) {
        validate_action(issues, action, path, *project.backend);
      }
    }

    if (!action_ids.contains(capability.main_action_id)) {
      issues.push_back({capability_path + ".main_action",
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
        issues.push_back({path + ".expect", "must define equals or equals_input"});
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
                          "must not have multiple setup steps"});
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
      if (verification.attempts < 1) {
        issues.push_back({capability_path + ".verification.attempts",
                          "must be at least 1"});
      }
      if (verification.delay_ms < 0) {
        issues.push_back({capability_path + ".verification.delay_ms",
                          "must be 0 or greater"});
      }
      if (verification.success_delay_ms < 0) {
        issues.push_back({capability_path + ".verification.success_delay_ms",
                          "must be 0 or greater"});
      }
    }

    const auto property_names = schema_property_names(capability.input_schema);
    std::set<std::string, std::less<>> output_names;
    for (const auto& output : capability.output_fields) {
      const auto path = capability_path + ".output_mapping[" + output.name + "]";
      if (output.name.empty()) {
        issues.push_back({path + ".name", "must not be empty"});
      } else if (!output_names.insert(output.name).second) {
        issues.push_back({path + ".name", "must be unique within a capability"});
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
      if (output.transform != output_transform::none &&
          output.source == output_source::literal) {
        issues.push_back({path + ".transform",
                          "is not valid for literal output mappings"});
      }
      if (!output.normalize.empty()) {
        if (output.source != output_source::action &&
            output.source != output_source::verification &&
            output.source != output_source::input) {
          issues.push_back({path + ".normalize",
                            "normalization is only valid for extracted or input values"});
        }
        for (const auto& [raw_value, _] : output.normalize) {
          if (raw_value.empty()) {
            issues.push_back({path + ".normalize",
                              "normalization keys must not be empty"});
          }
        }
      }
    }
  }

  return issues;
}

}  // namespace terva::core::project

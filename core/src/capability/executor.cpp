#include "terva/core/capability/executor.hpp"

#include "terva/core/project/validator.hpp"

#include <algorithm>
#include <sstream>
#include <unordered_map>

namespace terva::core::capability {
namespace {

struct action_execution_output final {
  backend_call_summary summary;
  json response_body = json::object();
};

[[nodiscard]] std::string join_action_url(
    const project::backend_definition& backend,
    const std::string& path) {
  if (backend.base_url.ends_with('/') && path.starts_with('/')) {
    return backend.base_url.substr(0, backend.base_url.size() - 1) + path;
  }
  if (!backend.base_url.ends_with('/') && !path.starts_with('/')) {
    return backend.base_url + "/" + path;
  }
  return backend.base_url + path;
}

[[nodiscard]] const project::capability_definition* find_capability(
    const project::project_definition& project,
    const std::string_view tool_name) {
  for (const auto& capability : project.capabilities) {
    if (capability.tool_name == tool_name) {
      return &capability;
    }
  }
  return nullptr;
}

[[nodiscard]] const project::backend_definition* find_backend(
    const project::project_definition& project,
    const std::string_view backend_id) {
  for (const auto& backend : project.backends) {
    if (backend.id == backend_id) {
      return &backend;
    }
  }
  return nullptr;
}

[[nodiscard]] const project::http_action_definition* find_action(
    const project::capability_definition& capability,
    const std::string_view action_id) {
  for (const auto& action : capability.actions) {
    if (action.id == action_id) {
      return &action;
    }
  }
  return nullptr;
}

[[nodiscard]] const project::setup_step_definition* find_setup_step(
    const project::capability_definition& capability,
    const std::string_view precondition_id) {
  for (const auto& setup_step : capability.setup_steps) {
    if (setup_step.for_precondition == precondition_id) {
      return &setup_step;
    }
  }
  return nullptr;
}

[[nodiscard]] std::expected<json, std::string> lookup_json_path(
    const json& document,
    const std::string& dotted_path) {
  const auto* current = &document;
  std::size_t offset = 0;
  while (offset < dotted_path.size()) {
    const auto next_dot = dotted_path.find('.', offset);
    const auto segment = dotted_path.substr(
        offset,
        next_dot == std::string::npos ? dotted_path.size() - offset
                                      : next_dot - offset);
    if (!current->is_object()) {
      return std::unexpected("template path segment is not an object: " + segment);
    }
    const auto iterator = current->find(segment);
    if (iterator == current->end()) {
      return std::unexpected("template path not found: " + dotted_path);
    }
    current = &*iterator;
    if (next_dot == std::string::npos) {
      break;
    }
    offset = next_dot + 1;
  }
  return *current;
}

[[nodiscard]] std::expected<json, std::string> resolve_placeholder(
    const std::string& expression,
    const json& input) {
  if (!expression.starts_with("input.")) {
    return std::unexpected("unsupported placeholder expression: " + expression);
  }
  return lookup_json_path(input, expression.substr(6));
}

[[nodiscard]] std::string json_scalar_to_string(const json& value) {
  if (value.is_string()) {
    return value.get<std::string>();
  }
  if (value.is_null()) {
    return "null";
  }
  return value.dump();
}

[[nodiscard]] std::expected<std::string, std::string> render_text_template(
    const std::string& template_value,
    const json& input) {
  std::string rendered;
  std::size_t cursor = 0;
  while (cursor < template_value.size()) {
    const auto open = template_value.find("{{", cursor);
    if (open == std::string::npos) {
      rendered.append(template_value.substr(cursor));
      break;
    }
    rendered.append(template_value.substr(cursor, open - cursor));
    const auto close = template_value.find("}}", open + 2);
    if (close == std::string::npos) {
      return std::unexpected("unterminated template expression: " + template_value);
    }
    const auto expression =
        template_value.substr(open + 2, close - (open + 2));
    const auto resolved = resolve_placeholder(expression, input);
    if (!resolved) {
      return std::unexpected(resolved.error());
    }
    rendered.append(json_scalar_to_string(*resolved));
    cursor = close + 2;
  }
  return rendered;
}

[[nodiscard]] std::expected<json, std::string> render_json_template(
    const json& template_value,
    const json& input) {
  if (template_value.is_string()) {
    const auto raw = template_value.get<std::string>();
    if (raw.starts_with("{{") && raw.ends_with("}}") &&
        raw.find("{{", 2) == std::string::npos) {
      return resolve_placeholder(raw.substr(2, raw.size() - 4), input);
    }
    const auto rendered = render_text_template(raw, input);
    if (!rendered) {
      return std::unexpected(rendered.error());
    }
    return json(*rendered);
  }

  if (template_value.is_array()) {
    json output = json::array();
    for (const auto& item : template_value) {
      auto rendered_item = render_json_template(item, input);
      if (!rendered_item) {
        return std::unexpected(rendered_item.error());
      }
      output.push_back(std::move(*rendered_item));
    }
    return output;
  }

  if (template_value.is_object()) {
    json output = json::object();
    for (const auto& [key, value] : template_value.items()) {
      auto rendered_value = render_json_template(value, input);
      if (!rendered_value) {
        return std::unexpected(rendered_value.error());
      }
      output[key] = std::move(*rendered_value);
    }
    return output;
  }

  return template_value;
}

[[nodiscard]] std::expected<json, std::string> extract_json_pointer(
    const json& body,
    const std::string& pointer) {
  try {
    return body.at(json::json_pointer(pointer));
  } catch (const std::exception& exception) {
    return std::unexpected(
        "failed to extract json pointer " + pointer + ": " + exception.what());
  }
}

[[nodiscard]] std::expected<json, std::string> resolve_expected_value(
    const project::value_expectation& expectation,
    const json& input) {
  if (expectation.equals.has_value()) {
    return *expectation.equals;
  }
  if (expectation.equals_input.has_value()) {
    return lookup_json_path(input, *expectation.equals_input);
  }
  return std::unexpected("expectation is missing equals or equals_input");
}

[[nodiscard]] std::expected<void, std::string> validate_input(
    const project::capability_definition& capability,
    const json& input) {
  if (!input.is_object()) {
    return std::unexpected("tool input must be a JSON object");
  }

  const auto properties = capability.input_schema.value(
      "properties", json::object());
  const auto required = capability.input_schema.value("required", json::array());
  for (const auto& item : required) {
    if (!item.is_string()) {
      continue;
    }
    if (!input.contains(item.get<std::string>())) {
      return std::unexpected("missing required input field: " +
                             item.get<std::string>());
    }
  }

  const bool allow_additional_properties =
      capability.input_schema.value("additionalProperties", true);
  if (!allow_additional_properties) {
    for (const auto& [name, _] : input.items()) {
      if (!properties.contains(name)) {
        return std::unexpected("unexpected input field: " + name);
      }
    }
  }

  for (const auto& [name, schema] : properties.items()) {
    if (!input.contains(name) || !schema.is_object()) {
      continue;
    }
    const auto type = schema.value("type", "");
    if (type.empty()) {
      continue;
    }
    const auto& value = input.at(name);
    if ((type == "integer" && !value.is_number_integer()) ||
        (type == "number" && !value.is_number()) ||
        (type == "string" && !value.is_string()) ||
        (type == "boolean" && !value.is_boolean()) ||
        (type == "object" && !value.is_object())) {
      return std::unexpected("input field has wrong type: " + name);
    }
  }

  return {};
}

}  // namespace

void to_json(json& target, const backend_call_summary& value) {
  target = json{
      {"stage", value.stage},
      {"action_id", value.action_id},
      {"backend_id", value.backend_id},
      {"method", value.method},
      {"url", value.url},
      {"ok", value.ok},
      {"status_code", value.status_code},
      {"request_body", value.request_body},
      {"response_body", value.response_body},
  };
  if (value.error.has_value()) {
    target["error"] = *value.error;
  }
}

void to_json(json& target, const precondition_check_result& value) {
  target = json{
      {"id", value.id},
      {"description", value.description},
      {"action_id", value.action_id},
      {"met", value.met},
      {"rechecked_after_setup", value.rechecked_after_setup},
      {"expected_value", value.expected_value},
      {"actual_value", value.actual_value},
  };
  if (value.call.has_value()) {
    target["call"] = *value.call;
  }
  if (value.error.has_value()) {
    target["error"] = *value.error;
  }
}

void to_json(json& target, const setup_step_result& value) {
  target = json{
      {"id", value.id},
      {"description", value.description},
      {"for_precondition", value.for_precondition},
      {"action_id", value.action_id},
      {"performed", value.performed},
      {"ok", value.ok},
  };
  if (value.call.has_value()) {
    target["call"] = *value.call;
  }
  if (value.error.has_value()) {
    target["error"] = *value.error;
  }
}

void to_json(json& target, const verification_result& value) {
  target = json{
      {"attempted", value.attempted},
      {"ok", value.ok},
      {"action_id", value.action_id},
      {"expected_value", value.expected_value},
      {"actual_value", value.actual_value},
  };
  if (value.call.has_value()) {
    target["call"] = *value.call;
  }
  if (value.error.has_value()) {
    target["error"] = *value.error;
  }
}

void to_json(json& target, const capability_error& value) {
  target = json{
      {"stage", value.stage},
      {"code", value.code},
      {"message", value.message},
  };
}

void to_json(json& target, const capability_execution_result& value) {
  target = json{
      {"ok", value.ok},
      {"capability_id", value.capability_id},
      {"tool_name", value.tool_name},
      {"input", value.input},
      {"preconditions", value.preconditions},
      {"setup_steps", value.setup_steps},
      {"backend_calls", value.backend_calls},
      {"output", value.output},
  };
  if (value.verification.has_value()) {
    target["verification"] = *value.verification;
  }
  if (value.error.has_value()) {
    target["error"] = *value.error;
  }
}

capability_executor::capability_executor(
    const project::project_definition& project,
    const backend::backend_registry& backends,
    logging::shared_logger logger)
    : project_(project), backends_(backends), logger_(std::move(logger)) {}

std::expected<capability_execution_result, std::string>
capability_executor::execute_tool(const std::string_view tool_name,
                                  const json& input) const {
  const auto* capability = find_capability(project_, tool_name);
  if (capability == nullptr) {
    return std::unexpected("unknown tool: " + std::string(tool_name));
  }

  if (const auto input_validation = validate_input(*capability, input);
      !input_validation) {
    capability_execution_result result{
        .ok = false,
        .capability_id = capability->id,
        .tool_name = capability->tool_name,
        .input = input,
        .output = json::object(),
        .error = capability_error{
            .stage = "input",
            .code = "invalid_input",
            .message = input_validation.error(),
        },
    };
    if (logger_) {
      logger_->emit("terva.tool_invocation_finished", json(result));
    }
    return result;
  }

  capability_execution_result result{
      .ok = false,
      .capability_id = capability->id,
      .tool_name = capability->tool_name,
      .input = input,
      .output = json::object(),
  };

  const auto emit_result_failure = [&](std::string stage,
                                       std::string code,
                                       std::string message) {
    result.error = capability_error{
        .stage = std::move(stage),
        .code = std::move(code),
        .message = std::move(message),
    };
    if (logger_) {
      logger_->emit("terva.tool_invocation_finished", json(result));
    }
  };

  if (logger_) {
    logger_->emit("terva.tool_invocation_started",
                  json{{"capability_id", capability->id},
                       {"tool_name", capability->tool_name},
                       {"input", input}});
  }

  const auto execute_action = [&](std::string stage,
                                  const project::http_action_definition& action)
      -> action_execution_output {
    action_execution_output output;
    output.summary.stage = std::move(stage);
    output.summary.action_id = action.id;
    output.summary.backend_id = action.backend_id;
    output.summary.method = std::string(project::to_string(action.method));

    const auto* backend_definition = find_backend(project_, action.backend_id);
    if (backend_definition == nullptr) {
      output.summary.error = "unknown backend: " + action.backend_id;
      return output;
    }

    const auto rendered_path = render_text_template(action.path_template, input);
    if (!rendered_path) {
      output.summary.error = rendered_path.error();
      return output;
    }

    json rendered_body = json::object();
    bool has_body = false;
    if (!action.body_template.is_null()) {
      const auto body = render_json_template(action.body_template, input);
      if (!body) {
        output.summary.error = body.error();
        return output;
      }
      rendered_body = std::move(*body);
      has_body = true;
    }

    output.summary.url = join_action_url(*backend_definition, *rendered_path);
    output.summary.request_body = has_body ? rendered_body : json::object();

    backend::backend_request request{
        .backend_id = action.backend_id,
        .method = action.method,
        .path = *rendered_path,
        .has_body = has_body,
        .body = rendered_body,
    };

    const auto response = backends_.perform(request);
    if (!response) {
      output.summary.error = response.error();
      if (logger_) {
        logger_->emit("terva.backend_call", json(output.summary));
      }
      return output;
    }

    output.summary.status_code = response->status_code;
    output.summary.response_body = response->body;
    output.response_body = response->body;
    output.summary.ok = std::ranges::find(
                            action.success_statuses, response->status_code) !=
                        action.success_statuses.end();
    if (!output.summary.ok) {
      output.summary.error =
          "unexpected HTTP status " + std::to_string(response->status_code);
    }
    if (logger_) {
      logger_->emit("terva.backend_call", json(output.summary));
    }
    return output;
  };

  const auto evaluate_expectation =
      [&](std::string stage,
          const std::string& result_id,
          const std::string& description,
          const std::string& action_id,
          const project::value_expectation& expectation) {
        precondition_check_result evaluation{
            .id = result_id,
            .description = description,
            .action_id = action_id,
        };
        const auto* action = find_action(*capability, action_id);
        if (action == nullptr) {
          evaluation.error = "unknown action: " + action_id;
          return std::pair{evaluation, json::object()};
        }

        auto action_output = execute_action(stage, *action);
        evaluation.call = action_output.summary;
        result.backend_calls.push_back(action_output.summary);
        if (!action_output.summary.ok) {
          evaluation.error = action_output.summary.error;
          return std::pair{evaluation, action_output.response_body};
        }

        const auto expected_value = resolve_expected_value(expectation, input);
        if (!expected_value) {
          evaluation.error = expected_value.error();
          return std::pair{evaluation, action_output.response_body};
        }
        evaluation.expected_value = *expected_value;

        const auto actual_value =
            extract_json_pointer(action_output.response_body, expectation.json_pointer);
        if (!actual_value) {
          evaluation.error = actual_value.error();
          return std::pair{evaluation, action_output.response_body};
        }
        evaluation.actual_value = *actual_value;
        evaluation.met = evaluation.actual_value == evaluation.expected_value;
        return std::pair{evaluation, action_output.response_body};
      };

  for (const auto& precondition : capability->preconditions) {
    auto [evaluation, _] = evaluate_expectation(
        "precondition", precondition.id, precondition.description,
        precondition.action_id, precondition.expect);
    if (logger_) {
      logger_->emit("terva.precondition_evaluated", json(evaluation));
    }

    if (evaluation.met) {
      result.preconditions.push_back(std::move(evaluation));
      continue;
    }

    if (evaluation.error.has_value()) {
      result.preconditions.push_back(evaluation);
      emit_result_failure("precondition", "precondition_check_failed",
                          *evaluation.error);
      return result;
    }

    const auto* setup_step = find_setup_step(*capability, precondition.id);
    if (setup_step == nullptr) {
      result.preconditions.push_back(evaluation);
      emit_result_failure(
          "precondition", "unsatisfied_precondition",
          "precondition " + precondition.id + " was not met and has no setup step");
      return result;
    }

    setup_step_result setup_result{
        .id = setup_step->id,
        .description = setup_step->description,
        .for_precondition = setup_step->for_precondition,
        .action_id = setup_step->action_id,
        .performed = true,
    };
    const auto* setup_action = find_action(*capability, setup_step->action_id);
    if (setup_action == nullptr) {
      setup_result.error = "unknown setup action: " + setup_step->action_id;
      result.setup_steps.push_back(setup_result);
      emit_result_failure("setup", "unknown_action", *setup_result.error);
      return result;
    }

    auto setup_output = execute_action("setup", *setup_action);
    setup_result.call = setup_output.summary;
    setup_result.ok = setup_output.summary.ok;
    if (!setup_output.summary.ok) {
      setup_result.error = setup_output.summary.error;
    }
    result.backend_calls.push_back(setup_output.summary);
    result.setup_steps.push_back(setup_result);
    if (logger_) {
      logger_->emit("terva.setup_executed", json(result.setup_steps.back()));
    }
    if (!setup_result.ok) {
      emit_result_failure("setup", "setup_failed",
                          setup_result.error.value_or("setup failed"));
      return result;
    }

    auto [rechecked, __] = evaluate_expectation(
        "precondition", precondition.id, precondition.description,
        precondition.action_id, precondition.expect);
    rechecked.rechecked_after_setup = true;
    if (logger_) {
      logger_->emit("terva.precondition_evaluated", json(rechecked));
    }
    result.preconditions.push_back(rechecked);
    if (rechecked.error.has_value()) {
      emit_result_failure("precondition", "precondition_recheck_failed",
                          *rechecked.error);
      return result;
    }
    if (!rechecked.met) {
      emit_result_failure("precondition", "unsatisfied_precondition",
                          "precondition " + precondition.id +
                              " remained unsatisfied after setup");
      return result;
    }
  }

  const auto* main_action = find_action(*capability, capability->main_action_id);
  if (main_action == nullptr) {
    emit_result_failure("action", "unknown_action",
                        "main action was not found: " + capability->main_action_id);
    return result;
  }

  auto main_output = execute_action("action", *main_action);
  result.backend_calls.push_back(main_output.summary);
  if (!main_output.summary.ok) {
    emit_result_failure("action", "backend_call_failed",
                        main_output.summary.error.value_or("main action failed"));
    return result;
  }

  std::optional<json> verification_body;
  if (capability->verification.has_value()) {
    const auto& verification_definition = *capability->verification;
    auto [verification_check, response_body] = evaluate_expectation(
        "verification", "verification", "verification",
        verification_definition.action_id, verification_definition.expect);
    verification_result verification{
        .attempted = true,
        .ok = verification_check.met,
        .action_id = verification_definition.action_id,
        .expected_value = verification_check.expected_value,
        .actual_value = verification_check.actual_value,
        .call = verification_check.call,
        .error = verification_check.error,
    };
    result.verification = verification;
    if (logger_) {
      logger_->emit("terva.verification_evaluated", json(verification));
    }
    if (verification.error.has_value()) {
      emit_result_failure("verification", "verification_failed",
                          *verification.error);
      return result;
    }
    if (!verification.ok) {
      emit_result_failure("verification", "verification_failed",
                          "verification result did not match expectation");
      return result;
    }
    verification_body = std::move(response_body);
  }

  if (!capability->output_fields.empty()) {
    result.output = json::object();
    for (const auto& output_field : capability->output_fields) {
      switch (output_field.source) {
        case project::output_source::input: {
          if (!output_field.input_name.has_value()) {
            result.output[output_field.name] = nullptr;
            break;
          }
          const auto value = lookup_json_path(input, *output_field.input_name);
          result.output[output_field.name] = value ? *value : json(nullptr);
          break;
        }
        case project::output_source::action: {
          const auto value = extract_json_pointer(
              main_output.response_body, *output_field.json_pointer);
          result.output[output_field.name] = value ? *value : json(nullptr);
          break;
        }
        case project::output_source::verification: {
          if (!verification_body.has_value()) {
            result.output[output_field.name] = nullptr;
            break;
          }
          const auto value = extract_json_pointer(
              *verification_body, *output_field.json_pointer);
          result.output[output_field.name] = value ? *value : json(nullptr);
          break;
        }
        case project::output_source::literal:
          result.output[output_field.name] =
              output_field.value.value_or(json(nullptr));
          break;
      }
    }
  } else if (verification_body.has_value()) {
    result.output = *verification_body;
  } else {
    result.output = main_output.response_body;
  }

  result.ok = true;
  if (logger_) {
    logger_->emit("terva.tool_invocation_finished", json(result));
  }
  return result;
}

}  // namespace terva::core::capability

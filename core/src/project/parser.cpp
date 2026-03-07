#include "terva/core/project/parser.hpp"

#if defined(__clang__) || defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif
#include "terva/project/v1/project.pb.h"
#if defined(__clang__) || defined(__GNUC__)
#pragma GCC diagnostic pop
#endif

#include <google/protobuf/io/tokenizer.h>
#include <google/protobuf/io/zero_copy_stream_impl.h>
#include <google/protobuf/text_format.h>

#include <fstream>
#include <sstream>
#include <string>

namespace terva::core::project {
namespace {

namespace proto = ::terva::project::v1;

class textproto_error_collector final
    : public google::protobuf::io::ErrorCollector {
 public:
  void RecordError(const int line,
                   const google::protobuf::io::ColumnNumber column,
                   const absl::string_view message) override {
    append_message(line, column, message);
  }

  void RecordWarning(const int line,
                     const google::protobuf::io::ColumnNumber column,
                     const absl::string_view message) override {
    append_message(line, column, message);
  }

  [[nodiscard]] const std::string& summary() const noexcept { return summary_; }

 private:
  void append_message(const int line,
                      const int column,
                      const absl::string_view message) {
    if (!summary_.empty()) {
      summary_.push_back('\n');
    }
    summary_.append("line ");
    summary_.append(std::to_string(line + 1));
    summary_.append(", column ");
    summary_.append(std::to_string(column + 1));
    summary_.append(": ");
    summary_.append(message.data(), message.size());
  }
  std::string summary_;
};

[[nodiscard]] std::expected<std::string, std::string> read_file(
    const std::filesystem::path& path) {
  std::ifstream stream(path);
  if (!stream) {
    return std::unexpected("unable to open project file: " + path.string());
  }

  std::stringstream buffer;
  buffer << stream.rdbuf();
  return buffer.str();
}

[[nodiscard]] std::expected<json, std::string> convert_data_value(
    const proto::DataValue& value,
    std::string_view path);

[[nodiscard]] std::expected<std::map<std::string, std::string, std::less<>>,
                            std::string>
convert_named_string_list(
    const google::protobuf::RepeatedPtrField<proto::NamedString>& values,
    std::string_view path) {
  std::map<std::string, std::string, std::less<>> result;
  for (int index = 0; index < values.size(); ++index) {
    const auto& value = values.Get(index);
    const auto insert_result = result.emplace(value.name(), value.value());
    if (!insert_result.second) {
      return std::unexpected(std::string(path) + "[" + value.name() +
                             "] is duplicated");
    }
  }
  return result;
}

[[nodiscard]] std::expected<json, std::string> convert_object_value(
    const proto::DataObject& object,
    std::string_view path) {
  json result = json::object();
  for (int index = 0; index < object.fields_size(); ++index) {
    const auto& field = object.fields(index);
    if (result.contains(field.name())) {
      return std::unexpected(std::string(path) + "." + field.name() +
                             " is duplicated");
    }
    auto value = convert_data_value(field.value(),
                                    std::string(path) + "." + field.name());
    if (!value) {
      return std::unexpected(value.error());
    }
    result[field.name()] = std::move(*value);
  }
  return result;
}

[[nodiscard]] std::expected<json, std::string> convert_data_value(
    const proto::DataValue& value,
    std::string_view path) {
  switch (value.kind_case()) {
    case proto::DataValue::kNullValue:
      return json(nullptr);
    case proto::DataValue::kStringValue:
      return json(value.string_value());
    case proto::DataValue::kIntValue:
      return json(value.int_value());
    case proto::DataValue::kDoubleValue:
      return json(value.double_value());
    case proto::DataValue::kBoolValue:
      return json(value.bool_value());
    case proto::DataValue::kObjectValue:
      return convert_object_value(value.object_value(), path);
    case proto::DataValue::kListValue: {
      json result = json::array();
      for (int index = 0; index < value.list_value().values_size(); ++index) {
        auto item = convert_data_value(
            value.list_value().values(index),
            std::string(path) + "[" + std::to_string(index) + "]");
        if (!item) {
          return std::unexpected(item.error());
        }
        result.push_back(std::move(*item));
      }
      return result;
    }
    case proto::DataValue::KIND_NOT_SET:
      return std::unexpected(std::string(path) + " must define a value");
  }
  return std::unexpected(std::string(path) + " contains an unsupported value");
}

[[nodiscard]] std::expected<backend_type, std::string> convert_backend_type(
    const proto::BackendType value,
    std::string_view path) {
  switch (value) {
    case proto::BACKEND_TYPE_HTTP_JSON:
      return backend_type::http_json;
    case proto::BACKEND_TYPE_LOCALHOST_HTTP_JSON:
      return backend_type::localhost_http_json;
    case proto::BACKEND_TYPE_UNSPECIFIED:
      break;
    default:
      break;
  }
  return std::unexpected(std::string(path) + " is not supported");
}

[[nodiscard]] std::expected<http_method, std::string> convert_http_method(
    const proto::HttpMethod value,
    std::string_view path) {
  switch (value) {
    case proto::HTTP_METHOD_GET:
      return http_method::get;
    case proto::HTTP_METHOD_POST:
      return http_method::post;
    case proto::HTTP_METHOD_PUT:
      return http_method::put;
    case proto::HTTP_METHOD_UNSPECIFIED:
      break;
    default:
      break;
  }
  return std::unexpected(std::string(path) + " is not supported");
}

[[nodiscard]] std::expected<output_source, std::string> convert_output_source(
    const proto::OutputSource value,
    std::string_view path) {
  switch (value) {
    case proto::OUTPUT_SOURCE_INPUT:
      return output_source::input;
    case proto::OUTPUT_SOURCE_ACTION:
      return output_source::action;
    case proto::OUTPUT_SOURCE_VERIFICATION:
      return output_source::verification;
    case proto::OUTPUT_SOURCE_LITERAL:
      return output_source::literal;
    case proto::OUTPUT_SOURCE_UNSPECIFIED:
      break;
    default:
      break;
  }
  return std::unexpected(std::string(path) + " is not supported");
}

[[nodiscard]] output_transform convert_output_transform(
    const proto::OutputTransform value) noexcept {
  switch (value) {
    case proto::OUTPUT_TRANSFORM_MILLISECONDS_TO_SECONDS:
      return output_transform::milliseconds_to_seconds;
    case proto::OUTPUT_TRANSFORM_LAST_PATH_SEGMENT:
      return output_transform::last_path_segment;
    case proto::OUTPUT_TRANSFORM_UNSPECIFIED:
    case proto::OUTPUT_TRANSFORM_NONE:
      return output_transform::none;
    default:
      return output_transform::none;
  }
}

[[nodiscard]] std::expected<value_expectation, std::string> convert_expectation(
    const proto::ValueExpectation& source,
    std::string_view path) {
  value_expectation result;
  result.json_pointer = source.json_pointer();

  switch (source.matcher_case()) {
    case proto::ValueExpectation::kEquals: {
      auto equals = convert_data_value(source.equals(), std::string(path) + ".equals");
      if (!equals) {
        return std::unexpected(equals.error());
      }
      result.equals = std::move(*equals);
      break;
    }
    case proto::ValueExpectation::kEqualsInput:
      result.equals_input = source.equals_input();
      break;
    case proto::ValueExpectation::MATCHER_NOT_SET:
      break;
  }

  return result;
}

[[nodiscard]] std::expected<json, std::string> convert_input_schema(
    const proto::InputSchema& source,
    std::string_view path) {
  json schema = json::object();
  schema["type"] = source.type();
  schema["properties"] = json::object();

  for (int index = 0; index < source.properties_size(); ++index) {
    const auto& property = source.properties(index);
    if (schema["properties"].contains(property.name())) {
      return std::unexpected(std::string(path) + ".properties[" + property.name() +
                             "] is duplicated");
    }
    json property_schema = json::object();
    property_schema["type"] = property.type();
    if (property.has_minimum()) {
      auto minimum = convert_data_value(
          property.minimum(),
          std::string(path) + ".properties[" + property.name() + "].minimum");
      if (!minimum) {
        return std::unexpected(minimum.error());
      }
      property_schema["minimum"] = std::move(*minimum);
    }
    if (property.has_maximum()) {
      auto maximum = convert_data_value(
          property.maximum(),
          std::string(path) + ".properties[" + property.name() + "].maximum");
      if (!maximum) {
        return std::unexpected(maximum.error());
      }
      property_schema["maximum"] = std::move(*maximum);
    }
    schema["properties"][property.name()] = std::move(property_schema);
  }

  if (!source.required().empty()) {
    schema["required"] = json::array();
    for (const auto& required : source.required()) {
      schema["required"].push_back(required);
    }
  }

  if (source.has_additional_properties()) {
    schema["additionalProperties"] = source.additional_properties();
  }

  return schema;
}

[[nodiscard]] std::expected<project_definition, std::string> convert_project(
    const proto::ProjectDefinition& source,
    const std::filesystem::path& path) {
  project_definition project;
  project.source_path = path;
  project.name = source.name();
  if (!source.description().empty()) {
    project.description = source.description();
  }
  if (source.has_logging()) {
    if (!source.logging().sink().empty()) {
      project.logging.sink = source.logging().sink();
    }
    if (!source.logging().file_path().empty()) {
      project.logging.file_path = std::filesystem::path(source.logging().file_path());
    }
  }

  for (int backend_index = 0; backend_index < source.backends_size();
       ++backend_index) {
    const auto& backend_proto = source.backends(backend_index);
    backend_definition backend;
    backend.id = backend_proto.id();
    auto type = convert_backend_type(
        backend_proto.type(),
        "project.backends[" + std::to_string(backend_index) + "].type");
    if (!type) {
      return std::unexpected(type.error());
    }
    backend.type = *type;
    backend.base_url = backend_proto.base_url();
    auto headers = convert_named_string_list(
        backend_proto.headers(),
        "project.backends[" + std::to_string(backend_index) + "].headers");
    if (!headers) {
      return std::unexpected(headers.error());
    }
    backend.headers = std::move(*headers);
    project.backends.push_back(std::move(backend));
  }

  for (int capability_index = 0; capability_index < source.capabilities_size();
       ++capability_index) {
    const auto& capability_proto = source.capabilities(capability_index);
    capability_definition capability;
    capability.id = capability_proto.id();
    capability.tool_name = capability_proto.tool_name();
    capability.description = capability_proto.description();

    if (!capability_proto.has_input_schema()) {
      return std::unexpected("project.capabilities[" +
                             std::to_string(capability_index) +
                             "].input_schema is required");
    }
    auto input_schema = convert_input_schema(
        capability_proto.input_schema(),
        "project.capabilities[" + std::to_string(capability_index) + "].input_schema");
    if (!input_schema) {
      return std::unexpected(input_schema.error());
    }
    capability.input_schema = std::move(*input_schema);

    for (int action_index = 0; action_index < capability_proto.actions_size();
         ++action_index) {
      const auto& action_proto = capability_proto.actions(action_index);
      http_action_definition action;
      action.id = action_proto.id();
      action.description = action_proto.description();
      action.backend_id = action_proto.backend();
      auto method = convert_http_method(
          action_proto.method(),
          "project.capabilities[" + std::to_string(capability_index) +
              "].actions[" + std::to_string(action_index) + "].method");
      if (!method) {
        return std::unexpected(method.error());
      }
      action.method = *method;
      action.path_template = action_proto.path();

      auto query = convert_named_string_list(
          action_proto.query(),
          "project.capabilities[" + std::to_string(capability_index) +
              "].actions[" + std::to_string(action_index) + "].query");
      if (!query) {
        return std::unexpected(query.error());
      }
      action.query_parameters = std::move(*query);

      auto headers = convert_named_string_list(
          action_proto.headers(),
          "project.capabilities[" + std::to_string(capability_index) +
              "].actions[" + std::to_string(action_index) + "].headers");
      if (!headers) {
        return std::unexpected(headers.error());
      }
      action.headers = std::move(*headers);

      if (action_proto.has_body()) {
        auto body = convert_data_value(
            action_proto.body(),
            "project.capabilities[" + std::to_string(capability_index) +
                "].actions[" + std::to_string(action_index) + "].body");
        if (!body) {
          return std::unexpected(body.error());
        }
        action.body_template = std::move(*body);
      }

      if (!action_proto.success_statuses().empty()) {
        action.success_statuses.assign(action_proto.success_statuses().begin(),
                                       action_proto.success_statuses().end());
      }

      capability.actions.push_back(std::move(action));
    }

    for (int precondition_index = 0;
         precondition_index < capability_proto.preconditions_size();
         ++precondition_index) {
      const auto& precondition_proto =
          capability_proto.preconditions(precondition_index);
      precondition_definition precondition;
      precondition.id = precondition_proto.id();
      precondition.description = precondition_proto.description();
      precondition.action_id = precondition_proto.action();
      auto expectation = convert_expectation(
          precondition_proto.expect(),
          "project.capabilities[" + std::to_string(capability_index) +
              "].preconditions[" + std::to_string(precondition_index) + "].expect");
      if (!expectation) {
        return std::unexpected(expectation.error());
      }
      precondition.expect = std::move(*expectation);
      capability.preconditions.push_back(std::move(precondition));
    }

    for (int setup_index = 0; setup_index < capability_proto.setup_size();
         ++setup_index) {
      const auto& setup_proto = capability_proto.setup(setup_index);
      setup_step_definition setup;
      setup.id = setup_proto.id();
      setup.description = setup_proto.description();
      setup.for_precondition = setup_proto.for_precondition();
      setup.action_id = setup_proto.action();
      capability.setup_steps.push_back(std::move(setup));
    }

    capability.main_action_id = capability_proto.action();

    if (capability_proto.has_verification()) {
      verification_definition verification;
      verification.action_id = capability_proto.verification().action();
      auto expectation = convert_expectation(
          capability_proto.verification().expect(),
          "project.capabilities[" + std::to_string(capability_index) +
              "].verification.expect");
      if (!expectation) {
        return std::unexpected(expectation.error());
      }
      verification.expect = std::move(*expectation);
      verification.attempts = capability_proto.verification().has_attempts()
                                  ? capability_proto.verification().attempts()
                                  : 1;
      verification.delay_ms = capability_proto.verification().has_delay_ms()
                                  ? capability_proto.verification().delay_ms()
                                  : 0;
      verification.success_delay_ms =
          capability_proto.verification().has_success_delay_ms()
              ? capability_proto.verification().success_delay_ms()
              : 0;
      capability.verification = std::move(verification);
    }

    for (int output_index = 0; output_index < capability_proto.output_fields_size();
         ++output_index) {
      const auto& output_proto = capability_proto.output_fields(output_index);
      output_field_mapping output;
      output.name = output_proto.name();
      auto source_value = convert_output_source(
          output_proto.source(),
          "project.capabilities[" + std::to_string(capability_index) +
              "].output_fields[" + std::to_string(output_index) + "].source");
      if (!source_value) {
        return std::unexpected(source_value.error());
      }
      output.source = *source_value;
      output.transform = convert_output_transform(output_proto.transform());
      if (!output_proto.json_pointer().empty()) {
        output.json_pointer = output_proto.json_pointer();
      }
      if (!output_proto.input_name().empty()) {
        output.input_name = output_proto.input_name();
      }
      if (output_proto.has_value()) {
        auto value = convert_data_value(
            output_proto.value(),
            "project.capabilities[" + std::to_string(capability_index) +
                "].output_fields[" + std::to_string(output_index) + "].value");
        if (!value) {
          return std::unexpected(value.error());
        }
        output.value = std::move(*value);
      }
      for (int normalize_index = 0; normalize_index < output_proto.normalize_size();
           ++normalize_index) {
        const auto& normalize_proto = output_proto.normalize(normalize_index);
        auto mapped_value = convert_data_value(
            normalize_proto.mapped_value(),
            "project.capabilities[" + std::to_string(capability_index) +
                "].output_fields[" + std::to_string(output_index) +
                "].normalize[" + normalize_proto.raw_value() + "]");
        if (!mapped_value) {
          return std::unexpected(mapped_value.error());
        }
        const auto insert_result = output.normalize.emplace(
            normalize_proto.raw_value(), std::move(*mapped_value));
        if (!insert_result.second) {
          return std::unexpected("project.capabilities[" +
                                 std::to_string(capability_index) +
                                 "].output_fields[" +
                                 std::to_string(output_index) +
                                 "].normalize[" + normalize_proto.raw_value() +
                                 "] is duplicated");
        }
      }
      if (output_proto.has_default_value()) {
        auto default_value = convert_data_value(
            output_proto.default_value(),
            "project.capabilities[" + std::to_string(capability_index) +
                "].output_fields[" + std::to_string(output_index) +
                "].default_value");
        if (!default_value) {
          return std::unexpected(default_value.error());
        }
        output.default_value = std::move(*default_value);
      }
      output.required = output_proto.required();
      capability.output_fields.push_back(std::move(output));
    }

    project.capabilities.push_back(std::move(capability));
  }

  return project;
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

std::string_view to_string(const output_transform value) noexcept {
  switch (value) {
    case output_transform::none:
      return "none";
    case output_transform::milliseconds_to_seconds:
      return "milliseconds_to_seconds";
    case output_transform::last_path_segment:
      return "last_path_segment";
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

std::optional<output_transform> parse_output_transform(
    const std::string_view value) noexcept {
  if (value == "none") {
    return output_transform::none;
  }
  if (value == "milliseconds_to_seconds") {
    return output_transform::milliseconds_to_seconds;
  }
  if (value == "last_path_segment") {
    return output_transform::last_path_segment;
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
  auto text = read_file(path);
  if (!text) {
    return std::unexpected(text.error());
  }

  return parse_project_text(*text, path);
}

std::expected<project_definition, std::string> parse_project_text(
    const std::string_view text,
    const std::filesystem::path& source_path) {
  proto::ProjectDefinition project_proto;
  google::protobuf::io::ArrayInputStream input(text.data(),
                                               static_cast<int>(text.size()));
  textproto_error_collector errors;
  google::protobuf::TextFormat::Parser parser;
  parser.AllowUnknownField(false);
  parser.RecordErrorsTo(&errors);

  if (!parser.Parse(&input, &project_proto)) {
    auto message = std::string("project file is not valid protobuf text format");
    if (!errors.summary().empty()) {
      message.append(": ");
      message.append(errors.summary());
    }
    return std::unexpected(std::move(message));
  }

  return convert_project(project_proto, source_path);
}

}  // namespace terva::core::project

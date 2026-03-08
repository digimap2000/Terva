#include "terva/core/project/parser.hpp"
#include "terva/core/version.hpp"

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
#include <cstdint>
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

[[nodiscard]] std::expected<mcp_transport, std::string> convert_mcp_transport(
    const proto::McpTransport value,
    std::string_view path) {
  switch (value) {
    case proto::MCP_TRANSPORT_STREAMABLE_HTTP:
      return mcp_transport::streamable_http;
    case proto::MCP_TRANSPORT_STDIO:
      return mcp_transport::stdio;
    case proto::MCP_TRANSPORT_UNSPECIFIED:
      break;
    default:
      break;
  }
  return std::unexpected(std::string(path) + " is not supported");
}

[[nodiscard]] std::expected<product_connector, std::string> convert_product_connector(
    const proto::ProductConnector value,
    std::string_view path) {
  switch (value) {
    case proto::PRODUCT_CONNECTOR_HTTP:
      return product_connector::http;
    case proto::PRODUCT_CONNECTOR_UART:
      return product_connector::uart;
    case proto::PRODUCT_CONNECTOR_UNSPECIFIED:
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
  project.mcp_server.name =
      source.has_mcp_server() && !source.mcp_server().name().empty()
          ? source.mcp_server().name()
          : project.name;
  project.mcp_server.version =
      source.has_mcp_server() && !source.mcp_server().version().empty()
          ? source.mcp_server().version()
          : std::string(terva::core::version());
  if (source.has_mcp_server()) {
    if (!source.mcp_server().title().empty()) {
      project.mcp_server.title = source.mcp_server().title();
    }
    if (!source.mcp_server().description().empty()) {
      project.mcp_server.description = source.mcp_server().description();
    } else if (project.description.has_value()) {
      project.mcp_server.description = project.description;
    }
    if (!source.mcp_server().website_url().empty()) {
      project.mcp_server.website_url = source.mcp_server().website_url();
    }
    if (!source.mcp_server().instructions().empty()) {
      project.mcp_server.instructions = source.mcp_server().instructions();
    }
  } else if (project.description.has_value()) {
    project.mcp_server.description = project.description;
  }

  for (int index = 0; index < source.mcp_transports_size(); ++index) {
    auto transport = convert_mcp_transport(
        source.mcp_transports(index),
        "project.mcp_transports[" + std::to_string(index) + "]");
    if (!transport) {
      return std::unexpected(transport.error());
    }
    project.mcp_transports.push_back(*transport);
  }

  if (source.product_connector() != proto::PRODUCT_CONNECTOR_UNSPECIFIED) {
    auto connector = convert_product_connector(
        source.product_connector(),
        "project.product_connector");
    if (!connector) {
      return std::unexpected(connector.error());
    }
    project.product_connector = *connector;
  }

  if (source.has_product_http()) {
    if (!source.product_http().version().empty()) {
      project.product_http.version = source.product_http().version();
    }
    project.product_http.tls_enabled = source.product_http().tls_enabled();
    auto headers = convert_named_string_list(
        source.product_http().mandatory_headers(),
        "project.product_http.mandatory_headers");
    if (!headers) {
      return std::unexpected(headers.error());
    }
    project.product_http.mandatory_headers = std::move(*headers);
  }

  if (source.has_product_uart()) {
    if (source.product_uart().has_baud_rate()) {
      project.product_uart.baud_rate = source.product_uart().baud_rate();
    }
    if (!source.product_uart().port().empty()) {
      project.product_uart.port = source.product_uart().port();
    }
    if (!source.product_uart().framing().empty()) {
      project.product_uart.framing = source.product_uart().framing();
    }
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

void assign_named_strings(
    google::protobuf::RepeatedPtrField<proto::NamedString>* target,
    const std::map<std::string, std::string, std::less<>>& values) {
  for (const auto& [name, value] : values) {
    auto* item = target->Add();
    item->set_name(name);
    item->set_value(value);
  }
}

void assign_data_value(proto::DataValue* target, const json& value) {
  if (value.is_null()) {
    target->set_null_value(google::protobuf::NULL_VALUE);
    return;
  }
  if (value.is_string()) {
    target->set_string_value(value.get<std::string>());
    return;
  }
  if (value.is_boolean()) {
    target->set_bool_value(value.get<bool>());
    return;
  }
  if (value.is_number_integer()) {
    target->set_int_value(value.get<std::int64_t>());
    return;
  }
  if (value.is_number_unsigned()) {
    target->set_int_value(static_cast<std::int64_t>(value.get<std::uint64_t>()));
    return;
  }
  if (value.is_number_float()) {
    target->set_double_value(value.get<double>());
    return;
  }
  if (value.is_array()) {
    auto* list = target->mutable_list_value();
    for (const auto& item : value) {
      assign_data_value(list->add_values(), item);
    }
    return;
  }
  if (value.is_object()) {
    auto* object = target->mutable_object_value();
    for (const auto& [name, item] : value.items()) {
      auto* field = object->add_fields();
      field->set_name(name);
      assign_data_value(field->mutable_value(), item);
    }
  }
}

proto::BackendType to_proto_backend_type(const backend_type value) {
  switch (value) {
    case backend_type::http_json:
      return proto::BACKEND_TYPE_HTTP_JSON;
    case backend_type::localhost_http_json:
      return proto::BACKEND_TYPE_LOCALHOST_HTTP_JSON;
  }
  return proto::BACKEND_TYPE_UNSPECIFIED;
}

proto::HttpMethod to_proto_http_method(const http_method value) {
  switch (value) {
    case http_method::get:
      return proto::HTTP_METHOD_GET;
    case http_method::post:
      return proto::HTTP_METHOD_POST;
    case http_method::put:
      return proto::HTTP_METHOD_PUT;
  }
  return proto::HTTP_METHOD_UNSPECIFIED;
}

proto::OutputSource to_proto_output_source(const output_source value) {
  switch (value) {
    case output_source::input:
      return proto::OUTPUT_SOURCE_INPUT;
    case output_source::action:
      return proto::OUTPUT_SOURCE_ACTION;
    case output_source::verification:
      return proto::OUTPUT_SOURCE_VERIFICATION;
    case output_source::literal:
      return proto::OUTPUT_SOURCE_LITERAL;
  }
  return proto::OUTPUT_SOURCE_UNSPECIFIED;
}

proto::OutputTransform to_proto_output_transform(const output_transform value) {
  switch (value) {
    case output_transform::none:
      return proto::OUTPUT_TRANSFORM_NONE;
    case output_transform::milliseconds_to_seconds:
      return proto::OUTPUT_TRANSFORM_MILLISECONDS_TO_SECONDS;
    case output_transform::last_path_segment:
      return proto::OUTPUT_TRANSFORM_LAST_PATH_SEGMENT;
  }
  return proto::OUTPUT_TRANSFORM_UNSPECIFIED;
}

void assign_expectation(proto::ValueExpectation* target,
                        const value_expectation& source) {
  target->set_json_pointer(source.json_pointer);
  if (source.equals.has_value()) {
    assign_data_value(target->mutable_equals(), *source.equals);
  }
  if (source.equals_input.has_value()) {
    target->set_equals_input(*source.equals_input);
  }
}

proto::ProjectDefinition to_proto_project(const project_definition& project) {
  proto::ProjectDefinition target;
  target.set_name(project.name);
  if (project.description.has_value()) {
    target.set_description(*project.description);
  }
  if (!project.logging.sink.empty()) {
    target.mutable_logging()->set_sink(project.logging.sink);
  }
  if (project.logging.file_path.has_value()) {
    target.mutable_logging()->set_file_path(project.logging.file_path->string());
  }
  target.mutable_mcp_server()->set_name(project.mcp_server.name);
  target.mutable_mcp_server()->set_version(project.mcp_server.version);
  if (project.mcp_server.title.has_value()) {
    target.mutable_mcp_server()->set_title(*project.mcp_server.title);
  }
  if (project.mcp_server.description.has_value()) {
    target.mutable_mcp_server()->set_description(*project.mcp_server.description);
  }
  if (project.mcp_server.website_url.has_value()) {
    target.mutable_mcp_server()->set_website_url(*project.mcp_server.website_url);
  }
  if (project.mcp_server.instructions.has_value()) {
    target.mutable_mcp_server()->set_instructions(*project.mcp_server.instructions);
  }
  for (const auto transport : project.mcp_transports) {
    switch (transport) {
      case mcp_transport::streamable_http:
        target.add_mcp_transports(proto::MCP_TRANSPORT_STREAMABLE_HTTP);
        break;
      case mcp_transport::stdio:
        target.add_mcp_transports(proto::MCP_TRANSPORT_STDIO);
        break;
    }
  }
  if (project.product_connector.has_value()) {
    switch (*project.product_connector) {
      case product_connector::http:
        target.set_product_connector(proto::PRODUCT_CONNECTOR_HTTP);
        break;
      case product_connector::uart:
        target.set_product_connector(proto::PRODUCT_CONNECTOR_UART);
        break;
    }
  }
  if (project.product_http.version.has_value() || project.product_http.tls_enabled ||
      !project.product_http.mandatory_headers.empty()) {
    if (project.product_http.version.has_value()) {
      target.mutable_product_http()->set_version(*project.product_http.version);
    }
    target.mutable_product_http()->set_tls_enabled(project.product_http.tls_enabled);
    assign_named_strings(
        target.mutable_product_http()->mutable_mandatory_headers(),
        project.product_http.mandatory_headers);
  }
  if (project.product_uart.baud_rate.has_value() || project.product_uart.port.has_value() ||
      project.product_uart.framing.has_value()) {
    if (project.product_uart.baud_rate.has_value()) {
      target.mutable_product_uart()->set_baud_rate(*project.product_uart.baud_rate);
    }
    if (project.product_uart.port.has_value()) {
      target.mutable_product_uart()->set_port(*project.product_uart.port);
    }
    if (project.product_uart.framing.has_value()) {
      target.mutable_product_uart()->set_framing(*project.product_uart.framing);
    }
  }

  for (const auto& backend : project.backends) {
    auto* backend_proto = target.add_backends();
    backend_proto->set_id(backend.id);
    backend_proto->set_type(to_proto_backend_type(backend.type));
    backend_proto->set_base_url(backend.base_url);
    assign_named_strings(backend_proto->mutable_headers(), backend.headers);
  }

  for (const auto& capability : project.capabilities) {
    auto* capability_proto = target.add_capabilities();
    capability_proto->set_id(capability.id);
    capability_proto->set_tool_name(capability.tool_name);
    capability_proto->set_description(capability.description);

    auto* input_schema = capability_proto->mutable_input_schema();
    if (const auto type = capability.input_schema.find("type");
        type != capability.input_schema.end() && type->is_string()) {
      input_schema->set_type(type->get<std::string>());
    }
    if (const auto additional = capability.input_schema.find("additionalProperties");
        additional != capability.input_schema.end() && additional->is_boolean()) {
      input_schema->set_additional_properties(additional->get<bool>());
    }
    if (const auto properties = capability.input_schema.find("properties");
        properties != capability.input_schema.end() && properties->is_object()) {
      for (const auto& [name, schema] : properties->items()) {
        auto* property = input_schema->add_properties();
        property->set_name(name);
        if (schema.is_object()) {
          if (const auto type = schema.find("type");
              type != schema.end() && type->is_string()) {
            property->set_type(type->get<std::string>());
          }
          if (const auto minimum = schema.find("minimum");
              minimum != schema.end()) {
            assign_data_value(property->mutable_minimum(), *minimum);
          }
          if (const auto maximum = schema.find("maximum");
              maximum != schema.end()) {
            assign_data_value(property->mutable_maximum(), *maximum);
          }
        }
      }
    }
    if (const auto required = capability.input_schema.find("required");
        required != capability.input_schema.end() && required->is_array()) {
      for (const auto& item : *required) {
        if (item.is_string()) {
          capability_proto->mutable_input_schema()->add_required(
              item.get<std::string>());
        }
      }
    }

    for (const auto& action : capability.actions) {
      auto* action_proto = capability_proto->add_actions();
      action_proto->set_id(action.id);
      action_proto->set_description(action.description);
      action_proto->set_backend(action.backend_id);
      action_proto->set_method(to_proto_http_method(action.method));
      action_proto->set_path(action.path_template);
      assign_named_strings(action_proto->mutable_query(), action.query_parameters);
      assign_named_strings(action_proto->mutable_headers(), action.headers);
      if (!action.body_template.is_null()) {
        assign_data_value(action_proto->mutable_body(), action.body_template);
      }
      for (const auto status : action.success_statuses) {
        action_proto->add_success_statuses(status);
      }
    }

    for (const auto& precondition : capability.preconditions) {
      auto* precondition_proto = capability_proto->add_preconditions();
      precondition_proto->set_id(precondition.id);
      precondition_proto->set_description(precondition.description);
      precondition_proto->set_action(precondition.action_id);
      assign_expectation(precondition_proto->mutable_expect(), precondition.expect);
    }

    for (const auto& setup_step : capability.setup_steps) {
      auto* setup_proto = capability_proto->add_setup();
      setup_proto->set_id(setup_step.id);
      setup_proto->set_description(setup_step.description);
      setup_proto->set_for_precondition(setup_step.for_precondition);
      setup_proto->set_action(setup_step.action_id);
    }

    capability_proto->set_action(capability.main_action_id);

    if (capability.verification.has_value()) {
      auto* verification_proto = capability_proto->mutable_verification();
      verification_proto->set_action(capability.verification->action_id);
      assign_expectation(verification_proto->mutable_expect(),
                         capability.verification->expect);
      verification_proto->set_attempts(capability.verification->attempts);
      verification_proto->set_delay_ms(capability.verification->delay_ms);
      verification_proto->set_success_delay_ms(
          capability.verification->success_delay_ms);
    }

    for (const auto& output : capability.output_fields) {
      auto* output_proto = capability_proto->add_output_fields();
      output_proto->set_name(output.name);
      output_proto->set_source(to_proto_output_source(output.source));
      output_proto->set_transform(to_proto_output_transform(output.transform));
      if (output.json_pointer.has_value()) {
        output_proto->set_json_pointer(*output.json_pointer);
      }
      if (output.input_name.has_value()) {
        output_proto->set_input_name(*output.input_name);
      }
      if (output.value.has_value()) {
        assign_data_value(output_proto->mutable_value(), *output.value);
      }
      for (const auto& [raw_value, mapped_value] : output.normalize) {
        auto* normalize_proto = output_proto->add_normalize();
        normalize_proto->set_raw_value(raw_value);
        assign_data_value(normalize_proto->mutable_mapped_value(), mapped_value);
      }
      if (output.default_value.has_value()) {
        assign_data_value(output_proto->mutable_default_value(),
                          *output.default_value);
      }
      output_proto->set_required(output.required);
    }
  }

  return target;
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

std::string_view to_string(const mcp_transport value) noexcept {
  switch (value) {
    case mcp_transport::streamable_http:
      return "streamable_http";
    case mcp_transport::stdio:
      return "stdio";
  }
  return "unknown";
}

std::string_view to_string(const product_connector value) noexcept {
  switch (value) {
    case product_connector::http:
      return "http";
    case product_connector::uart:
      return "uart";
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

std::optional<mcp_transport> parse_mcp_transport(
    const std::string_view value) noexcept {
  if (value == "streamable_http") {
    return mcp_transport::streamable_http;
  }
  if (value == "stdio") {
    return mcp_transport::stdio;
  }
  return std::nullopt;
}

std::optional<product_connector> parse_product_connector(
    const std::string_view value) noexcept {
  if (value == "http") {
    return product_connector::http;
  }
  if (value == "uart") {
    return product_connector::uart;
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

std::expected<std::string, std::string> render_project_text(
    const project_definition& project) {
  const auto project_proto = to_proto_project(project);
  std::string rendered;
  google::protobuf::TextFormat::Printer printer;
  printer.SetUseUtf8StringEscaping(true);
  if (!printer.PrintToString(project_proto, &rendered)) {
    return std::unexpected("failed to render project protobuf text format");
  }
  return rendered;
}

}  // namespace terva::core::project

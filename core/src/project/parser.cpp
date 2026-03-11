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

#include <cstdint>
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

[[nodiscard]] std::vector<std::string> convert_string_list(
    const google::protobuf::RepeatedPtrField<std::string>& values) {
  return {values.begin(), values.end()};
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
      auto equals =
          convert_data_value(source.equals(), std::string(path) + ".equals");
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

[[nodiscard]] mcp_server_definition convert_mcp_server(
    const proto::McpServerDefinition& source,
    std::string_view default_name,
    const std::optional<std::string>& project_description) {
  mcp_server_definition server;
  server.name = source.name().empty() ? std::string(default_name) : source.name();
  server.version = source.version().empty() ? std::string(terva::core::version())
                                            : source.version();
  if (!source.title().empty()) {
    server.title = source.title();
  }
  if (!source.description().empty()) {
    server.description = source.description();
  } else if (project_description.has_value()) {
    server.description = project_description;
  }
  if (!source.website_url().empty()) {
    server.website_url = source.website_url();
  }
  if (!source.instructions().empty()) {
    server.instructions = source.instructions();
  }
  return server;
}

[[nodiscard]] std::expected<service_definition, std::string> convert_service(
    const proto::ServiceDefinition& source,
    const project_definition& project,
    const int index) {
  service_definition service;
  service.id = source.id();
  service.description = source.description();

  switch (source.config_case()) {
    case proto::ServiceDefinition::kMcp: {
      service.type = service_type::mcp;
      mcp_service_definition mcp;
      const auto default_name =
          !service.id.empty() ? std::string_view(service.id) : std::string_view(project.name);
      mcp.server = convert_mcp_server(source.mcp().server(), default_name, project.description);
      for (int transport_index = 0; transport_index < source.mcp().transports_size();
           ++transport_index) {
        auto transport = convert_mcp_transport(
            source.mcp().transports(transport_index),
            "project.services[" + std::to_string(index) + "].mcp.transports[" +
                std::to_string(transport_index) + "]");
        if (!transport) {
          return std::unexpected(transport.error());
        }
        mcp.transports.push_back(*transport);
      }
      service.mcp = std::move(mcp);
      return service;
    }
    case proto::ServiceDefinition::CONFIG_NOT_SET:
      break;
  }

  return std::unexpected("project.services[" + std::to_string(index) +
                         "] must define a service config");
}

[[nodiscard]] std::expected<backend_definition, std::string> convert_backend(
    const proto::ProjectDefinition& source) {
  backend_definition backend;

  switch (source.backend_case()) {
    case proto::ProjectDefinition::kDevice: {
      backend.kind = backend_kind::device;
      backend.name = source.device().name();
      if (!source.device().image_path().empty()) {
        backend.image_path = source.device().image_path();
      }
      if (!source.device().category_icon().empty()) {
        backend.category_icon = source.device().category_icon();
      }
      switch (source.device().connection_case()) {
        case proto::DeviceBackendDefinition::kHttp: {
          backend.connection_kind = backend_connection_kind::http;
          device_http_connection connection;
          connection.base_url = source.device().http().base_url();
          auto headers = convert_named_string_list(
              source.device().http().headers(), "project.backend.device.http.headers");
          if (!headers) {
            return std::unexpected(headers.error());
          }
          connection.headers = std::move(*headers);
          if (!source.device().http().version().empty()) {
            connection.version = source.device().http().version();
          }
          connection.tls_enabled = source.device().http().tls_enabled();
          backend.device_http = std::move(connection);
          return backend;
        }
        case proto::DeviceBackendDefinition::kUart: {
          backend.connection_kind = backend_connection_kind::uart;
          device_uart_connection connection;
          if (source.device().uart().has_baud_rate()) {
            connection.baud_rate = source.device().uart().baud_rate();
          }
          if (!source.device().uart().port().empty()) {
            connection.port = source.device().uart().port();
          }
          if (!source.device().uart().framing().empty()) {
            connection.framing = source.device().uart().framing();
          }
          backend.device_uart = std::move(connection);
          return backend;
        }
        case proto::DeviceBackendDefinition::kEthernet: {
          backend.connection_kind = backend_connection_kind::ethernet;
          device_ethernet_connection connection;
          connection.host = source.device().ethernet().host();
          if (source.device().ethernet().has_port()) {
            connection.port = source.device().ethernet().port();
          }
          connection.protocol = source.device().ethernet().protocol();
          backend.device_ethernet = std::move(connection);
          return backend;
        }
        case proto::DeviceBackendDefinition::CONNECTION_NOT_SET:
          break;
      }
      return std::unexpected("project.device must define a connection");
    }
    case proto::ProjectDefinition::kDatabase: {
      backend.kind = backend_kind::database;
      backend.name = source.database().name();
      if (!source.database().description().empty()) {
        backend.description = source.database().description();
      }
      switch (source.database().connection_case()) {
        case proto::DatabaseBackendDefinition::kSql: {
          backend.connection_kind = backend_connection_kind::sql;
          database_sql_connection connection;
          connection.dsn = source.database().sql().dsn();
          connection.dialect = source.database().sql().dialect();
          auto parameters = convert_named_string_list(
              source.database().sql().parameters(),
              "project.backend.database.sql.parameters");
          if (!parameters) {
            return std::unexpected(parameters.error());
          }
          connection.parameters = std::move(*parameters);
          backend.database_sql = std::move(connection);
          return backend;
        }
        case proto::DatabaseBackendDefinition::CONNECTION_NOT_SET:
          break;
      }
      return std::unexpected("project.database must define a connection");
    }
    case proto::ProjectDefinition::kFile: {
      backend.kind = backend_kind::file;
      backend.name = source.file().name();
      if (!source.file().description().empty()) {
        backend.description = source.file().description();
      }
      switch (source.file().connection_case()) {
        case proto::FileBackendDefinition::kTree: {
          backend.connection_kind = backend_connection_kind::tree;
          file_tree_connection connection;
          connection.root_path = source.file().tree().root_path();
          connection.include_globs = convert_string_list(source.file().tree().include_globs());
          connection.exclude_globs = convert_string_list(source.file().tree().exclude_globs());
          connection.read_only = source.file().tree().read_only();
          backend.file_tree = std::move(connection);
          return backend;
        }
        case proto::FileBackendDefinition::CONNECTION_NOT_SET:
          break;
      }
      return std::unexpected("project.file must define a connection");
    }
    case proto::ProjectDefinition::BACKEND_NOT_SET:
      break;
  }

  return std::unexpected("project must define a backend");
}

[[nodiscard]] std::expected<action_definition, std::string> convert_action(
    const proto::ActionDefinition& source,
    const int capability_index,
    const int action_index) {
  action_definition action;
  action.id = source.id();
  action.description = source.description();

  switch (source.operation_case()) {
    case proto::ActionDefinition::kHttp: {
      action.type = action_type::http;
      http_request_operation operation;
      auto method = convert_http_method(
          source.http().method(),
          "project.capabilities[" + std::to_string(capability_index) + "].actions[" +
              std::to_string(action_index) + "].http.method");
      if (!method) {
        return std::unexpected(method.error());
      }
      operation.method = *method;
      operation.path_template = source.http().path();

      auto query = convert_named_string_list(
          source.http().query(),
          "project.capabilities[" + std::to_string(capability_index) + "].actions[" +
              std::to_string(action_index) + "].http.query");
      if (!query) {
        return std::unexpected(query.error());
      }
      operation.query_parameters = std::move(*query);

      auto headers = convert_named_string_list(
          source.http().headers(),
          "project.capabilities[" + std::to_string(capability_index) + "].actions[" +
              std::to_string(action_index) + "].http.headers");
      if (!headers) {
        return std::unexpected(headers.error());
      }
      operation.headers = std::move(*headers);

      if (source.http().has_body()) {
        auto body = convert_data_value(
            source.http().body(),
            "project.capabilities[" + std::to_string(capability_index) + "].actions[" +
                std::to_string(action_index) + "].http.body");
        if (!body) {
          return std::unexpected(body.error());
        }
        operation.body_template = std::move(*body);
      }
      if (!source.http().success_statuses().empty()) {
        operation.success_statuses.assign(source.http().success_statuses().begin(),
                                          source.http().success_statuses().end());
      }
      action.http = std::move(operation);
      return action;
    }
    case proto::ActionDefinition::kSql: {
      action.type = action_type::sql;
      sql_query_operation operation;
      operation.statement = source.sql().statement();
      auto parameters = convert_named_string_list(
          source.sql().parameters(),
          "project.capabilities[" + std::to_string(capability_index) + "].actions[" +
              std::to_string(action_index) + "].sql.parameters");
      if (!parameters) {
        return std::unexpected(parameters.error());
      }
      operation.parameters = std::move(*parameters);
      operation.result_format = source.sql().result_format();
      action.sql = std::move(operation);
      return action;
    }
    case proto::ActionDefinition::kFileRead: {
      action.type = action_type::file_read;
      file_read_operation operation;
      operation.path = source.file_read().path();
      operation.format = source.file_read().format();
      action.file_read = std::move(operation);
      return action;
    }
    case proto::ActionDefinition::kFileList: {
      action.type = action_type::file_list;
      file_list_operation operation;
      operation.path = source.file_list().path();
      operation.glob = source.file_list().glob();
      operation.recursive = source.file_list().recursive();
      action.file_list = std::move(operation);
      return action;
    }
    case proto::ActionDefinition::kUart: {
      action.type = action_type::uart;
      uart_exchange_operation operation;
      operation.command = source.uart().command();
      if (source.uart().has_payload()) {
        auto payload = convert_data_value(
            source.uart().payload(),
            "project.capabilities[" + std::to_string(capability_index) + "].actions[" +
                std::to_string(action_index) + "].uart.payload");
        if (!payload) {
          return std::unexpected(payload.error());
        }
        operation.payload_template = std::move(*payload);
      }
      action.uart = std::move(operation);
      return action;
    }
    case proto::ActionDefinition::OPERATION_NOT_SET:
      break;
  }

  return std::unexpected("project.capabilities[" + std::to_string(capability_index) +
                         "].actions[" + std::to_string(action_index) +
                         "] must define an operation");
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

  for (int service_index = 0; service_index < source.services_size(); ++service_index) {
    auto service = convert_service(source.services(service_index), project, service_index);
    if (!service) {
      return std::unexpected(service.error());
    }
    project.services.push_back(std::move(*service));
  }

  auto backend = convert_backend(source);
  if (!backend) {
    return std::unexpected(backend.error());
  }
  project.backend = std::move(*backend);

  for (int capability_index = 0; capability_index < source.capabilities_size();
       ++capability_index) {
    const auto& capability_proto = source.capabilities(capability_index);
    capability_definition capability;
    capability.id = capability_proto.id();
    capability.name = capability_proto.name();
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
      auto action = convert_action(capability_proto.actions(action_index), capability_index,
                                   action_index);
      if (!action) {
        return std::unexpected(action.error());
      }
      capability.actions.push_back(std::move(*action));
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

    for (int setup_index = 0; setup_index < capability_proto.setup_size(); ++setup_index) {
      const auto& setup_proto = capability_proto.setup(setup_index);
      setup_step_definition setup;
      setup.id = setup_proto.id();
      setup.description = setup_proto.description();
      setup.for_precondition = setup_proto.for_precondition();
      setup.action_id = setup_proto.action();
      capability.setup_steps.push_back(std::move(setup));
    }

    capability.main_action_id = capability_proto.main_action();

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
                "].output_fields[" + std::to_string(output_index) + "].normalize[" +
                normalize_proto.raw_value() + "]");
        if (!mapped_value) {
          return std::unexpected(mapped_value.error());
        }
        const auto insert_result = output.normalize.emplace(
            normalize_proto.raw_value(), std::move(*mapped_value));
        if (!insert_result.second) {
          return std::unexpected("project.capabilities[" +
                                 std::to_string(capability_index) + "].output_fields[" +
                                 std::to_string(output_index) + "].normalize[" +
                                 normalize_proto.raw_value() + "] is duplicated");
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

void assign_string_list(google::protobuf::RepeatedPtrField<std::string>* target,
                        const std::vector<std::string>& values) {
  for (const auto& value : values) {
    target->Add(std::string(value));
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

proto::McpTransport to_proto_mcp_transport(const mcp_transport value) {
  switch (value) {
    case mcp_transport::streamable_http:
      return proto::MCP_TRANSPORT_STREAMABLE_HTTP;
    case mcp_transport::stdio:
      return proto::MCP_TRANSPORT_STDIO;
  }
  return proto::MCP_TRANSPORT_UNSPECIFIED;
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

void assign_input_schema(proto::InputSchema* target, const json& source) {
  if (const auto type = source.find("type");
      type != source.end() && type->is_string()) {
    target->set_type(type->get<std::string>());
  }
  if (const auto additional = source.find("additionalProperties");
      additional != source.end() && additional->is_boolean()) {
    target->set_additional_properties(additional->get<bool>());
  }
  if (const auto properties = source.find("properties");
      properties != source.end() && properties->is_object()) {
    for (const auto& [name, schema] : properties->items()) {
      auto* property = target->add_properties();
      property->set_name(name);
      if (!schema.is_object()) {
        continue;
      }
      if (const auto type = schema.find("type");
          type != schema.end() && type->is_string()) {
        property->set_type(type->get<std::string>());
      }
      if (const auto minimum = schema.find("minimum"); minimum != schema.end()) {
        assign_data_value(property->mutable_minimum(), *minimum);
      }
      if (const auto maximum = schema.find("maximum"); maximum != schema.end()) {
        assign_data_value(property->mutable_maximum(), *maximum);
      }
    }
  }
  if (const auto required = source.find("required");
      required != source.end() && required->is_array()) {
    for (const auto& item : *required) {
      if (item.is_string()) {
        target->add_required(item.get<std::string>());
      }
    }
  }
}

void assign_service(proto::ServiceDefinition* target, const service_definition& source) {
  target->set_id(source.id);
  target->set_description(source.description);

  if (source.mcp.has_value()) {
    auto* mcp = target->mutable_mcp();
    mcp->mutable_server()->set_name(source.mcp->server.name);
    mcp->mutable_server()->set_version(source.mcp->server.version);
    if (source.mcp->server.title.has_value()) {
      mcp->mutable_server()->set_title(*source.mcp->server.title);
    }
    if (source.mcp->server.description.has_value()) {
      mcp->mutable_server()->set_description(*source.mcp->server.description);
    }
    if (source.mcp->server.website_url.has_value()) {
      mcp->mutable_server()->set_website_url(*source.mcp->server.website_url);
    }
    if (source.mcp->server.instructions.has_value()) {
      mcp->mutable_server()->set_instructions(*source.mcp->server.instructions);
    }
    for (const auto transport : source.mcp->transports) {
      mcp->add_transports(to_proto_mcp_transport(transport));
    }
  }
}

void assign_backend(proto::ProjectDefinition* target, const backend_definition& source) {
  switch (source.kind) {
    case backend_kind::device: {
      auto* device = target->mutable_device();
      device->set_name(source.name);
      if (source.image_path.has_value()) {
        device->set_image_path(*source.image_path);
      }
      if (source.category_icon.has_value()) {
        device->set_category_icon(*source.category_icon);
      }
      switch (source.connection_kind) {
        case backend_connection_kind::http:
          if (source.device_http.has_value()) {
            auto* http = device->mutable_http();
            http->set_base_url(source.device_http->base_url);
            assign_named_strings(http->mutable_headers(), source.device_http->headers);
            if (source.device_http->version.has_value()) {
              http->set_version(*source.device_http->version);
            }
            http->set_tls_enabled(source.device_http->tls_enabled);
          }
          break;
        case backend_connection_kind::uart:
          if (source.device_uart.has_value()) {
            auto* uart = device->mutable_uart();
            if (source.device_uart->baud_rate.has_value()) {
              uart->set_baud_rate(*source.device_uart->baud_rate);
            }
            if (source.device_uart->port.has_value()) {
              uart->set_port(*source.device_uart->port);
            }
            if (source.device_uart->framing.has_value()) {
              uart->set_framing(*source.device_uart->framing);
            }
          }
          break;
        case backend_connection_kind::ethernet:
          if (source.device_ethernet.has_value()) {
            auto* ethernet = device->mutable_ethernet();
            ethernet->set_host(source.device_ethernet->host);
            if (source.device_ethernet->port.has_value()) {
              ethernet->set_port(*source.device_ethernet->port);
            }
            ethernet->set_protocol(source.device_ethernet->protocol);
          }
          break;
        case backend_connection_kind::sql:
        case backend_connection_kind::tree:
          break;
      }
      return;
    }
    case backend_kind::database: {
      auto* database = target->mutable_database();
      database->set_name(source.name);
      if (source.description.has_value()) {
        database->set_description(*source.description);
      }
      if (source.database_sql.has_value()) {
        auto* sql = database->mutable_sql();
        sql->set_dsn(source.database_sql->dsn);
        sql->set_dialect(source.database_sql->dialect);
        assign_named_strings(sql->mutable_parameters(), source.database_sql->parameters);
      }
      return;
    }
    case backend_kind::file: {
      auto* file = target->mutable_file();
      file->set_name(source.name);
      if (source.description.has_value()) {
        file->set_description(*source.description);
      }
      if (source.file_tree.has_value()) {
        auto* tree = file->mutable_tree();
        tree->set_root_path(source.file_tree->root_path);
        assign_string_list(tree->mutable_include_globs(), source.file_tree->include_globs);
        assign_string_list(tree->mutable_exclude_globs(), source.file_tree->exclude_globs);
        tree->set_read_only(source.file_tree->read_only);
      }
      return;
    }
  }
}

void assign_action(proto::ActionDefinition* target, const action_definition& source) {
  target->set_id(source.id);
  target->set_description(source.description);

  switch (source.type) {
    case action_type::http:
      if (source.http.has_value()) {
        auto* http = target->mutable_http();
        http->set_method(to_proto_http_method(source.http->method));
        http->set_path(source.http->path_template);
        assign_named_strings(http->mutable_query(), source.http->query_parameters);
        assign_named_strings(http->mutable_headers(), source.http->headers);
        if (!source.http->body_template.is_null()) {
          assign_data_value(http->mutable_body(), source.http->body_template);
        }
        for (const auto status : source.http->success_statuses) {
          http->add_success_statuses(status);
        }
      }
      return;
    case action_type::sql:
      if (source.sql.has_value()) {
        auto* sql = target->mutable_sql();
        sql->set_statement(source.sql->statement);
        assign_named_strings(sql->mutable_parameters(), source.sql->parameters);
        sql->set_result_format(source.sql->result_format);
      }
      return;
    case action_type::file_read:
      if (source.file_read.has_value()) {
        auto* file_read = target->mutable_file_read();
        file_read->set_path(source.file_read->path);
        file_read->set_format(source.file_read->format);
      }
      return;
    case action_type::file_list:
      if (source.file_list.has_value()) {
        auto* file_list = target->mutable_file_list();
        file_list->set_path(source.file_list->path);
        file_list->set_glob(source.file_list->glob);
        file_list->set_recursive(source.file_list->recursive);
      }
      return;
    case action_type::uart:
      if (source.uart.has_value()) {
        auto* uart = target->mutable_uart();
        uart->set_command(source.uart->command);
        if (!source.uart->payload_template.is_null()) {
          assign_data_value(uart->mutable_payload(), source.uart->payload_template);
        }
      }
      return;
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
  for (const auto& service : project.services) {
    assign_service(target.add_services(), service);
  }
  if (project.backend.has_value()) {
    assign_backend(&target, *project.backend);
  }

  for (const auto& capability : project.capabilities) {
    auto* capability_proto = target.add_capabilities();
    capability_proto->set_id(capability.id);
    capability_proto->set_name(capability.name);
    capability_proto->set_description(capability.description);
    assign_input_schema(capability_proto->mutable_input_schema(), capability.input_schema);

    for (const auto& action : capability.actions) {
      assign_action(capability_proto->add_actions(), action);
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

    capability_proto->set_main_action(capability.main_action_id);

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

std::string_view to_string(const service_type value) noexcept {
  switch (value) {
    case service_type::mcp:
      return "mcp";
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

std::string_view to_string(const backend_kind value) noexcept {
  switch (value) {
    case backend_kind::device:
      return "device";
    case backend_kind::database:
      return "database";
    case backend_kind::file:
      return "file";
  }
  return "unknown";
}

std::string_view to_string(const backend_connection_kind value) noexcept {
  switch (value) {
    case backend_connection_kind::http:
      return "http";
    case backend_connection_kind::uart:
      return "uart";
    case backend_connection_kind::ethernet:
      return "ethernet";
    case backend_connection_kind::sql:
      return "sql";
    case backend_connection_kind::tree:
      return "tree";
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

std::string_view to_string(const action_type value) noexcept {
  switch (value) {
    case action_type::http:
      return "http";
    case action_type::sql:
      return "sql";
    case action_type::file_read:
      return "file_read";
    case action_type::file_list:
      return "file_list";
    case action_type::uart:
      return "uart";
  }
  return "unknown";
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

std::optional<backend_kind> parse_backend_kind(const std::string_view value) noexcept {
  if (value == "device") {
    return backend_kind::device;
  }
  if (value == "database") {
    return backend_kind::database;
  }
  if (value == "file") {
    return backend_kind::file;
  }
  return std::nullopt;
}

std::optional<backend_connection_kind> parse_backend_connection_kind(
    const std::string_view value) noexcept {
  if (value == "http") {
    return backend_connection_kind::http;
  }
  if (value == "uart") {
    return backend_connection_kind::uart;
  }
  if (value == "ethernet") {
    return backend_connection_kind::ethernet;
  }
  if (value == "sql") {
    return backend_connection_kind::sql;
  }
  if (value == "tree") {
    return backend_connection_kind::tree;
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

std::optional<action_type> parse_action_type(const std::string_view value) noexcept {
  if (value == "http") {
    return action_type::http;
  }
  if (value == "sql") {
    return action_type::sql;
  }
  if (value == "file_read") {
    return action_type::file_read;
  }
  if (value == "file_list") {
    return action_type::file_list;
  }
  if (value == "uart") {
    return action_type::uart;
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

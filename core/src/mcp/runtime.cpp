#include "terva/core/mcp/runtime.hpp"

#include "terva/core/version.hpp"

#include <dts/mcp/http_transport.hpp>
#include <dts/mcp/server_options.hpp>
#include <dts/mcp/stdio_transport.hpp>

#include <chrono>

namespace terva::core::mcp {

runtime::runtime(project::project_definition project, logging::shared_logger logger)
    : project_(std::move(project)),
      logger_(std::move(logger)),
      backends_(project_.backends),
      executor_(project_, backends_, logger_) {}

std::expected<dts::mcp::server, std::string> runtime::make_server() const {
  dts::mcp::server_options options;
  options.server_name = project_.name;
  options.server_version = std::string(terva::core::version());
  options.log_tag = "terva-mcp";
  options.tool_result_mode = dts::mcp::result_mode::raw_json;

  dts::mcp::server server(options);
  for (const auto& capability : project_.capabilities) {
    dts::mcp::tool_definition tool{
        .name = capability.tool_name,
        .description = capability.description,
        .input_schema = capability.input_schema,
        .handler = [this, tool_name = capability.tool_name](
                       dts::mcp::tool_context&, const dts::mcp::json& arguments)
            -> std::expected<dts::mcp::json, dts::mcp::error> {
          const auto result = executor_.execute_tool(tool_name, arguments);
          if (!result) {
            return std::unexpected(result.error());
          }
          return dts::mcp::json(*result);
        },
    };

    if (const auto added = server.add_tool(std::move(tool)); !added) {
      return std::unexpected(added.error());
    }
  }

  return server;
}

std::expected<int, std::string> runtime::run_stdio() {
  auto server = make_server();
  if (!server) {
    return std::unexpected(server.error());
  }

  if (const auto added = server->add_transport(
          std::make_unique<dts::mcp::stdio_transport>()); !added) {
    return std::unexpected(added.error());
  }

  if (const auto started = server->start(); !started) {
    return std::unexpected(started.error());
  }

  if (logger_) {
    logger_->emit("terva.server_started",
                  json{{"project_name", project_.name},
                       {"transport_mode", "stdio"},
                       {"tool_count", project_.capabilities.size()},
                       {"source_path", project_.source_path.string()}});
  }

  server->wait();

  if (logger_) {
    logger_->emit("terva.server_stopped",
                  json{{"project_name", project_.name},
                       {"transport_mode", "stdio"}});
  }
  return 0;
}

std::expected<int, std::string> runtime::run_http(
    const http_listen_options& options) {
  auto server = make_server();
  if (!server) {
    return std::unexpected(server.error());
  }

  auto transport = std::make_unique<dts::mcp::http_transport>(
      dts::mcp::http_transport_options{
          .bind_address = options.bind_address,
          .port = options.port,
          .endpoint_path = options.endpoint_path,
          .allowed_origins = options.allowed_origins,
          .allow_requests_without_origin = true,
          .response_timeout = std::chrono::seconds{30},
          .log_tag = "terva-mcp.http",
      });
  auto* transport_ptr = transport.get();
  if (const auto added = server->add_transport(std::move(transport)); !added) {
    return std::unexpected(added.error());
  }

  if (const auto started = server->start(); !started) {
    return std::unexpected(started.error());
  }

  auto listen_url = std::string("http://") + options.bind_address + ":" +
                    std::to_string(options.port) + options.endpoint_path;
  if (const auto endpoint = transport_ptr->local_endpoint(); endpoint.has_value()) {
    listen_url = "http://" + endpoint->address + ":" +
                 std::to_string(endpoint->port) + options.endpoint_path;
  }

  if (logger_) {
    logger_->emit("terva.server_started",
                  json{{"project_name", project_.name},
                       {"transport_mode", "http"},
                       {"listen_url", listen_url},
                       {"tool_count", project_.capabilities.size()},
                       {"source_path", project_.source_path.string()}});
  }

  server->wait();

  if (logger_) {
    logger_->emit("terva.server_stopped",
                  json{{"project_name", project_.name},
                       {"transport_mode", "http"},
                       {"listen_url", listen_url}});
  }
  return 0;
}

}  // namespace terva::core::mcp

#include "terva/core/mcp/runtime.hpp"

#include "terva/core/version.hpp"

#include <dts/mcp/http_transport.hpp>
#include <dts/mcp/server_options.hpp>
#include <dts/mcp/stdio_transport.hpp>

#include <chrono>

namespace terva::core::mcp {

struct runtime::shared_state final {
  explicit shared_state(project::project_definition definition,
                        logging::shared_logger shared_logger)
      : project(std::move(definition)),
        logger(std::move(shared_logger)),
        backends(project.backends),
        executor(project, backends, logger) {}

  project::project_definition project;
  logging::shared_logger logger;
  backend::backend_registry backends;
  capability::capability_executor executor;
};

runtime::runtime(project::project_definition project, logging::shared_logger logger)
    : state_(std::make_shared<shared_state>(std::move(project), std::move(logger))) {}

std::expected<started_http_server, std::string> runtime::start_http_server(
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

  if (state_ && state_->logger) {
    state_->logger->emit("terva.server_started",
                         json{{"project_name", state_->project.name},
                              {"transport_mode", "http"},
                              {"listen_url", listen_url},
                              {"tool_count", state_->project.capabilities.size()},
                              {"source_path", state_->project.source_path.string()}});
  }

  return started_http_server{
      .server = std::move(*server),
      .listen_url = std::move(listen_url),
  };
}

std::expected<dts::mcp::server, std::string> runtime::make_server() const {
  const auto state = state_;
  if (!state) {
    return std::unexpected("mcp runtime state is not initialized");
  }

  dts::mcp::server_options options;
  options.server_name = state->project.name;
  options.server_version = std::string(terva::core::version());
  options.log_tag = "terva-mcp";
  options.tool_result_mode = dts::mcp::result_mode::raw_json;

  dts::mcp::server server(options);
  for (const auto& capability : state->project.capabilities) {
    dts::mcp::tool_definition tool{
        .name = capability.tool_name,
        .description = capability.description,
        .input_schema = capability.input_schema,
        .handler = [state, tool_name = capability.tool_name](
                       dts::mcp::tool_context&, const dts::mcp::json& arguments)
            -> std::expected<dts::mcp::json, dts::mcp::error> {
          const auto result = state->executor.execute_tool(tool_name, arguments);
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

  if (state_ && state_->logger) {
    state_->logger->emit("terva.server_started",
                         json{{"project_name", state_->project.name},
                              {"transport_mode", "stdio"},
                              {"tool_count", state_->project.capabilities.size()},
                              {"source_path", state_->project.source_path.string()}});
  }

  server->wait();

  if (state_ && state_->logger) {
    state_->logger->emit("terva.server_stopped",
                         json{{"project_name", state_->project.name},
                              {"transport_mode", "stdio"}});
  }
  return 0;
}

std::expected<int, std::string> runtime::run_http(
    const http_listen_options& options) {
  auto started_server = start_http_server(options);
  if (!started_server) {
    return std::unexpected(started_server.error());
  }

  started_server->server.wait();

  if (state_ && state_->logger) {
    state_->logger->emit("terva.server_stopped",
                         json{{"project_name", state_->project.name},
                              {"transport_mode", "http"},
                              {"listen_url", started_server->listen_url}});
  }
  return 0;
}

}  // namespace terva::core::mcp

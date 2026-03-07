#include "terva/core/mcp/runtime.hpp"

#include "terva/core/version.hpp"

#include <dts/mcp/server.hpp>
#include <dts/mcp/server_options.hpp>
#include <dts/mcp/stdio_runner.hpp>

namespace terva::core::mcp {

runtime::runtime(project::project_definition project, logging::shared_logger logger)
    : project_(std::move(project)),
      logger_(std::move(logger)),
      backends_(project_.backends),
      executor_(project_, backends_, logger_) {}

std::expected<int, std::string> runtime::run_stdio() {
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

  if (logger_) {
    logger_->emit("terva.server_started",
                  json{{"project_name", project_.name},
                       {"tool_count", project_.capabilities.size()},
                       {"source_path", project_.source_path.string()}});
  }
  auto result = dts::mcp::run_stdio_server(server);
  if (logger_) {
    logger_->emit("terva.server_stopped",
                  json{{"project_name", project_.name}});
  }
  if (!result) {
    return std::unexpected(result.error());
  }
  return *result;
}

}  // namespace terva::core::mcp


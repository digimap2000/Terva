#pragma once

#include "terva/core/backend/backend.hpp"
#include "terva/core/capability/executor.hpp"
#include "terva/core/logging/jsonl_logger.hpp"
#include "terva/core/project/model.hpp"

#include <dts/mcp/server.hpp>

#include <cstdint>
#include <expected>
#include <optional>
#include <string>
#include <vector>

namespace terva::core::mcp {

struct http_listen_options final {
  std::string bind_address{"127.0.0.1"};
  std::uint16_t port{0};
  std::string endpoint_path{"/mcp"};
  std::vector<std::string> allowed_origins;
};

class runtime final {
 public:
  runtime(project::project_definition project, logging::shared_logger logger);

  [[nodiscard]] std::expected<int, std::string> run_stdio();
  [[nodiscard]] std::expected<int, std::string> run_http(
      const http_listen_options& options);

 private:
  [[nodiscard]] std::expected<dts::mcp::server, std::string> make_server() const;

  project::project_definition project_;
  logging::shared_logger logger_;
  backend::backend_registry backends_;
  capability::capability_executor executor_;
};

}  // namespace terva::core::mcp

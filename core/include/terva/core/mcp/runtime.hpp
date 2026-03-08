#pragma once

#include "terva/core/backend/backend.hpp"
#include "terva/core/capability/executor.hpp"
#include "terva/core/logging/jsonl_logger.hpp"
#include "terva/core/project/model.hpp"

#include <dts/mcp/server.hpp>

#include <cstdint>
#include <expected>
#include <memory>
#include <optional>
#include <string>
#include <thread>
#include <vector>

namespace terva::core::mcp {

struct http_listen_options final {
  std::string bind_address{"127.0.0.1"};
  std::uint16_t port{0};
  std::string endpoint_path{"/mcp"};
  std::vector<std::string> allowed_origins;
};

struct started_http_server final {
  dts::mcp::server server;
  std::string listen_url;
};

class runtime final {
 public:
  runtime(project::project_definition project, logging::shared_logger logger);

  [[nodiscard]] std::expected<started_http_server, std::string> start_http_server(
      const http_listen_options& options);

 private:
  struct shared_state;

  [[nodiscard]] std::expected<dts::mcp::server, std::string> make_server() const;

  std::shared_ptr<shared_state> state_;
};

}  // namespace terva::core::mcp

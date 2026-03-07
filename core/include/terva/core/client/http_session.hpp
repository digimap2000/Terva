#pragma once

#include "terva/core/json.hpp"

#include <expected>
#include <string>
#include <string_view>

namespace terva::core::client {

class http_session final {
 public:
  explicit http_session(std::string endpoint_url);

  [[nodiscard]] std::expected<void, std::string> initialize();
  [[nodiscard]] std::expected<json, std::string> list_tools();
  [[nodiscard]] std::expected<json, std::string> call_tool(
      std::string_view tool_name,
      const json& arguments);

 private:
  [[nodiscard]] std::expected<json, std::string> request(
      std::string_view method,
      json params);

  std::string endpoint_url_;
  int next_request_id_{1};
  bool initialized_{false};
};

}  // namespace terva::core::client

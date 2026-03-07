#pragma once

#include "terva/core/json.hpp"
#include "terva/core/project/model.hpp"

#include <expected>
#include <map>
#include <memory>
#include <string>
#include <string_view>

namespace terva::core::backend {

struct backend_request final {
  std::string backend_id;
  project::http_method method{project::http_method::get};
  std::string path;
  std::map<std::string, std::string, std::less<>> query_parameters;
  std::map<std::string, std::string, std::less<>> headers;
  bool has_body{false};
  json body = nullptr;
};

struct backend_response final {
  int status_code{0};
  json body = nullptr;
  std::string raw_body;
  std::map<std::string, std::string, std::less<>> headers;
};

class backend_adapter {
 public:
  virtual ~backend_adapter() = default;

  [[nodiscard]] virtual std::expected<backend_response, std::string> perform(
      const backend_request& request) const = 0;
};

class backend_registry final {
 public:
  explicit backend_registry(const std::vector<project::backend_definition>& definitions);
  ~backend_registry();

  backend_registry(const backend_registry&) = delete;
  backend_registry& operator=(const backend_registry&) = delete;
  backend_registry(backend_registry&&) noexcept;
  backend_registry& operator=(backend_registry&&) noexcept;

  [[nodiscard]] std::expected<backend_response, std::string> perform(
      const backend_request& request) const;

 private:
  struct impl;
  std::unique_ptr<impl> impl_;
};

}  // namespace terva::core::backend

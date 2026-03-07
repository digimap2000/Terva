#pragma once

#include "terva/core/backend/backend.hpp"
#include "terva/core/project/model.hpp"

namespace terva::core::backend {

class http_backend final : public backend_adapter {
 public:
  explicit http_backend(project::backend_definition definition);
  [[nodiscard]] std::expected<backend_response, std::string> perform(
      const backend_request& request) const override;

 private:
  project::backend_definition definition_;
};

}  // namespace terva::core::backend


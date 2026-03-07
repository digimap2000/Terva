#pragma once

#include "terva/core/backend/backend.hpp"
#include "terva/core/capability/executor.hpp"
#include "terva/core/logging/jsonl_logger.hpp"
#include "terva/core/project/model.hpp"

#include <expected>
#include <string>

namespace terva::core::mcp {

class runtime final {
 public:
  runtime(project::project_definition project, logging::shared_logger logger);

  [[nodiscard]] std::expected<int, std::string> run_stdio();

 private:
  project::project_definition project_;
  logging::shared_logger logger_;
  backend::backend_registry backends_;
  capability::capability_executor executor_;
};

}  // namespace terva::core::mcp


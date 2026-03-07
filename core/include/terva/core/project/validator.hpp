#pragma once

#include "terva/core/project/model.hpp"

#include <vector>

namespace terva::core::project {

[[nodiscard]] std::vector<validation_issue> validate_project(const project_definition& project);

}  // namespace terva::core::project


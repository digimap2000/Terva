#pragma once

#include "terva/core/project/model.hpp"

#include <expected>
#include <filesystem>
#include <string_view>
#include <string>

namespace terva::core::project {

[[nodiscard]] std::expected<project_definition, std::string> parse_project_text(
    std::string_view text,
    const std::filesystem::path& source_path);

[[nodiscard]] std::expected<project_definition, std::string> load_project_file(
    const std::filesystem::path& path);

}  // namespace terva::core::project

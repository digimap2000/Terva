#pragma once

#include <string_view>

namespace terva::core {

[[nodiscard]] std::string_view version() noexcept;
[[nodiscard]] std::string_view platform_name() noexcept;

}  // namespace terva::core


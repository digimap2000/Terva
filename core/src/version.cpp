#include "terva/core/version.hpp"

namespace {

constexpr const char* kPlatformName =
#if defined(_WIN32)
    "windows";
#elif defined(__APPLE__)
    "macos";
#elif defined(__linux__)
    "linux";
#else
    "unknown";
#endif

}  // namespace

namespace terva::core {

std::string_view version() noexcept {
  return TERVA_VERSION;
}

std::string_view platform_name() noexcept {
  return kPlatformName;
}

}  // namespace terva::core

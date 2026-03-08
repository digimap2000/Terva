#include "bridge.hpp"

#include "terva/core/json.hpp"

#include <filesystem>

namespace {

[[nodiscard]] rust::String envelope_success(const terva::core::json& payload) {
  return rust::String(
      terva::core::json{{"ok", true}, {"payload", payload}}.dump());
}

[[nodiscard]] rust::String envelope_error(const std::string& message) {
  return rust::String(
      terva::core::json{{"ok", false}, {"error", message}}.dump());
}

[[nodiscard]] rust::String wrap_result(
    std::expected<terva::core::json, std::string> result) {
  if (!result) {
    return envelope_error(result.error());
  }
  return envelope_success(*result);
}

}  // namespace

DesktopCore::DesktopCore() = default;
DesktopCore::~DesktopCore() = default;

rust::String DesktopCore::open_document(const rust::Str path) {
  return wrap_result(engine_.open_document(std::filesystem::path(std::string(path))));
}

rust::String DesktopCore::load_document_contents(
    const rust::Str source_path,
    const rust::Str contents) {
  return wrap_result(engine_.load_document_contents(
      std::filesystem::path(std::string(source_path)), std::string(contents)));
}

rust::String DesktopCore::update_document_contents(const rust::Str contents) {
  return wrap_result(engine_.update_document_contents(std::string(contents)));
}

rust::String DesktopCore::update_project_metadata(const rust::Str metadata_json) {
  try {
    const auto metadata = terva::core::json::parse(std::string(metadata_json));
    return wrap_result(engine_.update_project_metadata(metadata));
  } catch (const std::exception& exception) {
    return envelope_error(std::string("invalid JSON metadata: ") + exception.what());
  }
}

rust::String DesktopCore::close_document() {
  return wrap_result(engine_.close_document());
}

rust::String DesktopCore::summarize_document(const rust::Str path) const {
  return wrap_result(
      engine_.summarize_project_file(std::filesystem::path(std::string(path))));
}

rust::String DesktopCore::validate_active_document() const {
  return wrap_result(engine_.validate_active_document());
}

rust::String DesktopCore::inspect_active_document() const {
  return wrap_result(engine_.inspect_active_document());
}

rust::String DesktopCore::start_runtime() {
  return wrap_result(engine_.start_server());
}

rust::String DesktopCore::stop_runtime() {
  return wrap_result(engine_.stop_server());
}

rust::String DesktopCore::list_tools() {
  return wrap_result(engine_.list_tools());
}

rust::String DesktopCore::invoke_tool(
    const rust::Str tool_name,
    const rust::Str input_json) {
  try {
    const auto rendered_tool_name = std::string(tool_name);
    const auto input = terva::core::json::parse(std::string(input_json));
    return wrap_result(engine_.invoke_tool(rendered_tool_name, input));
  } catch (const std::exception& exception) {
    return envelope_error(std::string("invalid JSON input: ") + exception.what());
  }
}

rust::String DesktopCore::drain_events() {
  return envelope_success(terva::core::json{{"events", engine_.drain_events()}});
}

std::unique_ptr<DesktopCore> new_desktop_core() {
  return std::make_unique<DesktopCore>();
}

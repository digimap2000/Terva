#pragma once

#include "terva/core/json.hpp"

#include <expected>
#include <filesystem>
#include <memory>
#include <string>
#include <string_view>

namespace terva::core::engine {

class engine final {
 public:
  engine();
  ~engine();

  engine(const engine&) = delete;
  engine& operator=(const engine&) = delete;
  engine(engine&&) noexcept;
  engine& operator=(engine&&) noexcept;

  [[nodiscard]] std::expected<json, std::string> open_document(
      const std::filesystem::path& path);
  [[nodiscard]] std::expected<json, std::string> close_document();
  [[nodiscard]] std::expected<json, std::string> generate_project_name();
  [[nodiscard]] std::expected<json, std::string> update_project_metadata(
      const json& metadata);
  [[nodiscard]] std::expected<json, std::string> update_endpoint_command(
      const json& update);

  [[nodiscard]] std::expected<json, std::string> summarize_project_file(
      const std::filesystem::path& path) const;
  [[nodiscard]] std::expected<json, std::string> validate_active_document() const;
  [[nodiscard]] std::expected<json, std::string> inspect_active_document() const;

  [[nodiscard]] std::expected<json, std::string> start_server();
  [[nodiscard]] std::expected<json, std::string> stop_server();
  [[nodiscard]] std::expected<json, std::string> list_tools();
  [[nodiscard]] std::expected<json, std::string> invoke_tool(
      std::string_view tool_name,
      const json& input);

 [[nodiscard]] json drain_events();

 private:
  struct impl;
  [[nodiscard]] std::expected<json, std::string> load_document(
      const std::filesystem::path& source_path,
      std::string contents);
  std::unique_ptr<impl> impl_;
};

}  // namespace terva::core::engine

#pragma once

#include "terva/core/json.hpp"

#include <expected>
#include <filesystem>
#include <string>
#include <string_view>

namespace terva::core::client {

class stdio_session final {
 public:
  struct spawn_options final {
    std::filesystem::path server_executable;
    std::filesystem::path project_file;
  };

  static std::expected<stdio_session, std::string> spawn(const spawn_options& options);

  ~stdio_session();

  stdio_session(const stdio_session&) = delete;
  stdio_session& operator=(const stdio_session&) = delete;
  stdio_session(stdio_session&& other) noexcept;
  stdio_session& operator=(stdio_session&& other) noexcept;

  [[nodiscard]] std::expected<void, std::string> initialize();
  [[nodiscard]] std::expected<json, std::string> list_tools();
  [[nodiscard]] std::expected<json, std::string> call_tool(
      std::string_view tool_name,
      const json& arguments);

 private:
  stdio_session() = default;

  [[nodiscard]] std::expected<json, std::string> request(
      std::string_view method,
      json params);

  [[nodiscard]] std::expected<json, std::string> read_response(int request_id);
  void send_notification(std::string_view method, json params) const;
  void shutdown() noexcept;

  int read_fd_{-1};
  int write_fd_{-1};
  int next_request_id_{1};
  bool initialized_{false};
  int child_pid_{-1};
  void* read_stream_{nullptr};
  void* write_stream_{nullptr};
};

}  // namespace terva::core::client


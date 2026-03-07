#include "terva/core/client/stdio_session.hpp"

#include "terva/core/version.hpp"

#include <cstdio>
#include <cstdlib>
#include <cstring>

#if defined(__APPLE__) || defined(__linux__)
#include <sys/wait.h>
#include <unistd.h>
#endif

namespace terva::core::client {
namespace {

[[nodiscard]] FILE* as_file(void* stream) {
  return static_cast<FILE*>(stream);
}

}  // namespace

std::expected<stdio_session, std::string> stdio_session::spawn(
    const spawn_options& options) {
#if !defined(__APPLE__) && !defined(__linux__)
  (void)options;
  return std::unexpected("stdio_session is only implemented on POSIX hosts");
#else
  int stdin_pipe[2]{};
  int stdout_pipe[2]{};
  if (::pipe(stdin_pipe) != 0) {
    return std::unexpected("failed to create stdin pipe");
  }
  if (::pipe(stdout_pipe) != 0) {
    ::close(stdin_pipe[0]);
    ::close(stdin_pipe[1]);
    return std::unexpected("failed to create stdout pipe");
  }

  const auto pid = ::fork();
  if (pid < 0) {
    ::close(stdin_pipe[0]);
    ::close(stdin_pipe[1]);
    ::close(stdout_pipe[0]);
    ::close(stdout_pipe[1]);
    return std::unexpected("failed to fork server process");
  }

  if (pid == 0) {
    ::dup2(stdin_pipe[0], STDIN_FILENO);
    ::dup2(stdout_pipe[1], STDOUT_FILENO);
    ::close(stdin_pipe[0]);
    ::close(stdin_pipe[1]);
    ::close(stdout_pipe[0]);
    ::close(stdout_pipe[1]);

    const auto server = options.server_executable.string();
    const auto project = options.project_file.string();
    execl(server.c_str(), server.c_str(), "run", "--stdio", project.c_str(),
          static_cast<char*>(nullptr));
    _exit(127);
  }

  ::close(stdin_pipe[0]);
  ::close(stdout_pipe[1]);

  auto* read_stream = ::fdopen(stdout_pipe[0], "r");
  auto* write_stream = ::fdopen(stdin_pipe[1], "w");
  if (read_stream == nullptr || write_stream == nullptr) {
    if (read_stream != nullptr) {
      ::fclose(read_stream);
    } else {
      ::close(stdout_pipe[0]);
    }
    if (write_stream != nullptr) {
      ::fclose(write_stream);
    } else {
      ::close(stdin_pipe[1]);
    }
    ::waitpid(pid, nullptr, 0);
    return std::unexpected("failed to open stdio streams for server process");
  }

  ::setvbuf(write_stream, nullptr, _IOLBF, 0);

  stdio_session session;
  session.child_pid_ = pid;
  session.read_fd_ = stdout_pipe[0];
  session.write_fd_ = stdin_pipe[1];
  session.read_stream_ = read_stream;
  session.write_stream_ = write_stream;
  return session;
#endif
}

stdio_session::~stdio_session() {
  shutdown();
}

stdio_session::stdio_session(stdio_session&& other) noexcept
    : read_fd_(other.read_fd_),
      write_fd_(other.write_fd_),
      next_request_id_(other.next_request_id_),
      initialized_(other.initialized_),
      child_pid_(other.child_pid_),
      read_stream_(other.read_stream_),
      write_stream_(other.write_stream_) {
  other.read_fd_ = -1;
  other.write_fd_ = -1;
  other.child_pid_ = -1;
  other.read_stream_ = nullptr;
  other.write_stream_ = nullptr;
  other.initialized_ = false;
}

stdio_session& stdio_session::operator=(stdio_session&& other) noexcept {
  if (this == &other) {
    return *this;
  }
  shutdown();
  read_fd_ = other.read_fd_;
  write_fd_ = other.write_fd_;
  next_request_id_ = other.next_request_id_;
  initialized_ = other.initialized_;
  child_pid_ = other.child_pid_;
  read_stream_ = other.read_stream_;
  write_stream_ = other.write_stream_;
  other.read_fd_ = -1;
  other.write_fd_ = -1;
  other.child_pid_ = -1;
  other.read_stream_ = nullptr;
  other.write_stream_ = nullptr;
  other.initialized_ = false;
  return *this;
}

std::expected<void, std::string> stdio_session::initialize() {
  const auto response = request(
      "initialize",
      json{
          {"protocolVersion", "2024-11-05"},
          {"clientInfo",
           {{"name", "terva-client"},
            {"version", std::string(terva::core::version())}}},
          {"capabilities", json::object()},
      });
  if (!response) {
    return std::unexpected(response.error());
  }
  initialized_ = true;
  return {};
}

std::expected<json, std::string> stdio_session::list_tools() {
  if (!initialized_) {
    if (const auto initialized = initialize(); !initialized) {
      return std::unexpected(initialized.error());
    }
  }
  return request("tools/list", json::object());
}

std::expected<json, std::string> stdio_session::call_tool(
    const std::string_view tool_name,
    const json& arguments) {
  if (!initialized_) {
    if (const auto initialized = initialize(); !initialized) {
      return std::unexpected(initialized.error());
    }
  }
  return request(
      "tools/call",
      json{
          {"name", tool_name},
          {"arguments", arguments},
      });
}

std::expected<json, std::string> stdio_session::request(
    const std::string_view method,
    json params) {
  if (write_stream_ == nullptr) {
    return std::unexpected("server session is not connected");
  }

  const int request_id = next_request_id_++;
  json request_json{
      {"jsonrpc", "2.0"},
      {"id", request_id},
      {"method", method},
      {"params", std::move(params)},
  };

  const auto payload = request_json.dump();
  if (std::fprintf(as_file(write_stream_), "%s\n", payload.c_str()) < 0) {
    return std::unexpected("failed to write request to server");
  }
  std::fflush(as_file(write_stream_));
  return read_response(request_id);
}

std::expected<json, std::string> stdio_session::read_response(
    const int request_id) {
  if (read_stream_ == nullptr) {
    return std::unexpected("server session is not connected");
  }

  char* line = nullptr;
  size_t line_capacity = 0;
  while (true) {
    const auto bytes_read = ::getline(&line, &line_capacity, as_file(read_stream_));
    if (bytes_read < 0) {
      std::free(line);
      return std::unexpected("server closed the MCP connection");
    }

    try {
      auto message = json::parse(line);
      if (!message.contains("id") || message["id"] != request_id) {
        continue;
      }
      std::free(line);
      if (message.contains("error")) {
        return std::unexpected(message["error"].dump());
      }
      if (!message.contains("result")) {
        return std::unexpected("MCP response did not contain a result");
      }
      return message["result"];
    } catch (const std::exception& exception) {
      std::free(line);
      return std::unexpected("failed to parse MCP response: " +
                             std::string(exception.what()));
    }
  }
}

void stdio_session::send_notification(const std::string_view method, json params) const {
  if (write_stream_ == nullptr) {
    return;
  }

  json request_json{
      {"jsonrpc", "2.0"},
      {"method", method},
  };
  if (!params.is_null()) {
    request_json["params"] = std::move(params);
  }

  const auto payload = request_json.dump();
  std::fprintf(as_file(write_stream_), "%s\n", payload.c_str());
  std::fflush(as_file(write_stream_));
}

void stdio_session::shutdown() noexcept {
  if (child_pid_ < 0) {
    return;
  }

  if (initialized_) {
    (void)request("shutdown", json::object());
    send_notification("exit", nullptr);
  }

  if (write_stream_ != nullptr) {
    std::fclose(as_file(write_stream_));
    write_stream_ = nullptr;
  } else if (write_fd_ >= 0) {
    ::close(write_fd_);
  }

  if (read_stream_ != nullptr) {
    std::fclose(as_file(read_stream_));
    read_stream_ = nullptr;
  } else if (read_fd_ >= 0) {
    ::close(read_fd_);
  }

#if defined(__APPLE__) || defined(__linux__)
  ::waitpid(child_pid_, nullptr, 0);
#endif

  child_pid_ = -1;
  read_fd_ = -1;
  write_fd_ = -1;
  initialized_ = false;
}

}  // namespace terva::core::client

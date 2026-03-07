#include "terva/core/client/stdio_session.hpp"
#include "terva/core/version.hpp"

#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <string>
#include <string_view>

namespace {

int print_usage() {
  std::cerr << "Usage:\n";
  std::cerr << "  terva-client tools stdio:<project-file>\n";
  std::cerr << "  terva-client call stdio:<project-file> <tool-name> <json-input>\n";
  return 1;
}

std::filesystem::path resolve_server_executable(
    const std::filesystem::path& argv0) {
  if (const char* override_path = std::getenv("TERVA_SERVER_BIN");
      override_path != nullptr && *override_path != '\0') {
    return override_path;
  }

  const auto binary_path = std::filesystem::weakly_canonical(argv0);
  const auto sibling_server =
      binary_path.parent_path().parent_path() / "server" / "terva-server";
  if (std::filesystem::exists(sibling_server)) {
    return sibling_server;
  }

  return "terva-server";
}

std::expected<terva::core::client::stdio_session::spawn_options, std::string>
parse_connection(const std::string_view connection,
                 const std::filesystem::path& argv0) {
  constexpr std::string_view prefix = "stdio:";
  if (!connection.starts_with(prefix)) {
    return std::unexpected(
        "unsupported connection. use stdio:<project-file> for v0");
  }

  const auto project_path = std::filesystem::path(connection.substr(prefix.size()));
  return terva::core::client::stdio_session::spawn_options{
      .server_executable = resolve_server_executable(argv0),
      .project_file = project_path,
  };
}

}  // namespace

int main(const int argc, char** argv) {
  if (argc < 3) {
    return print_usage();
  }

  const std::string_view command = argv[1];
  const auto connection = parse_connection(argv[2], argv[0]);
  if (!connection) {
    std::cerr << connection.error() << '\n';
    return 1;
  }

  auto session = terva::core::client::stdio_session::spawn(*connection);
  if (!session) {
    std::cerr << session.error() << '\n';
    return 1;
  }

  if (command == "tools") {
    if (argc != 3) {
      return print_usage();
    }
    const auto tools = session->list_tools();
    if (!tools) {
      std::cerr << tools.error() << '\n';
      return 1;
    }
    std::cout << tools->dump(2) << '\n';
    return 0;
  }

  if (command == "call") {
    if (argc != 5) {
      return print_usage();
    }

    terva::core::json input;
    try {
      input = terva::core::json::parse(argv[4]);
    } catch (const std::exception& exception) {
      std::cerr << "invalid JSON input: " << exception.what() << '\n';
      return 1;
    }

    const auto result = session->call_tool(argv[3], input);
    if (!result) {
      std::cerr << result.error() << '\n';
      return 1;
    }
    std::cout << result->dump(2) << '\n';
    return 0;
  }

  return print_usage();
}


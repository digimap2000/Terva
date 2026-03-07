#include "terva/core/engine/engine.hpp"

#include <iostream>
#include <string_view>

namespace {

int print_usage() {
  std::cerr << "Usage:\n";
  std::cerr << "  terva-client validate <project-file>\n";
  std::cerr << "  terva-client inspect <project-file>\n";
  std::cerr << "  terva-client tools <project-file>\n";
  std::cerr << "  terva-client call <project-file> <tool-name> <json-input>\n";
  return 1;
}

std::expected<terva::core::engine::engine, int> load_engine(
    const std::string_view project_file) {
  terva::core::engine::engine engine;
  const auto document = engine.open_document(std::string(project_file));
  if (!document) {
    std::cerr << document.error() << '\n';
    return std::unexpected(1);
  }
  return std::move(engine);
}

}  // namespace

int main(const int argc, char** argv) {
  if (argc < 3) {
    return print_usage();
  }

  const std::string_view command = argv[1];
  const std::string_view project_file = argv[2];

  auto engine = load_engine(project_file);
  if (!engine) {
    return engine.error();
  }

  if (command == "validate") {
    const auto result = engine->validate_active_document();
    if (!result) {
      std::cerr << result.error() << '\n';
      return 1;
    }
    std::cout << result->dump(2) << '\n';
    return (*result)["ok"].get<bool>() ? 0 : 1;
  }

  if (command == "inspect") {
    const auto result = engine->inspect_active_document();
    if (!result) {
      std::cerr << result.error() << '\n';
      return 1;
    }
    std::cout << result->dump(2) << '\n';
    return 0;
  }

  if (command == "tools") {
    const auto result = engine->list_tools();
    if (!result) {
      std::cerr << result.error() << '\n';
      return 1;
    }
    std::cout << result->dump(2) << '\n';
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

    const auto result = engine->invoke_tool(argv[3], input);
    if (!result) {
      std::cerr << result.error() << '\n';
      return 1;
    }
    std::cout << result->dump(2) << '\n';
    return (*result)["ok"].get<bool>() ? 0 : 1;
  }

  return print_usage();
}

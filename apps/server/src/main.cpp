#include "terva/core/logging/jsonl_logger.hpp"
#include "terva/core/mcp/runtime.hpp"
#include "terva/core/project/parser.hpp"
#include "terva/core/project/validator.hpp"

#include <iostream>
#include <memory>
#include <string>
#include <string_view>

namespace {

int print_usage() {
  std::cerr << "Usage:\n";
  std::cerr << "  terva-server validate <project-file>\n";
  std::cerr << "  terva-server inspect <project-file>\n";
  std::cerr << "  terva-server run <project-file>\n";
  return 1;
}

std::expected<terva::core::project::project_definition, int> load_and_validate(
    const std::string_view path,
    const bool print_summary) {
  auto project = terva::core::project::load_project_file(std::string(path));
  if (!project) {
    std::cerr << project.error() << '\n';
    return std::unexpected(1);
  }

  const auto issues = terva::core::project::validate_project(*project);
  if (!issues.empty()) {
    std::cerr << "Project validation failed:\n";
    for (const auto& issue : issues) {
      std::cerr << "  - " << issue.path << ": " << issue.message << '\n';
    }
    return std::unexpected(1);
  }

  if (print_summary) {
    std::cout << "Project is valid: " << project->name << '\n';
  }
  return *project;
}

void print_inspection(const terva::core::project::project_definition& project) {
  std::cout << "Project: " << project.name << '\n';
  if (project.description.has_value()) {
    std::cout << "Description: " << *project.description << '\n';
  }
  std::cout << "Source: " << project.source_path << '\n';
  std::cout << "Logging sink: " << project.logging.sink << '\n';
  std::cout << "\nBackends:\n";
  for (const auto& backend : project.backends) {
    std::cout << "  - " << backend.id << " ["
              << terva::core::project::to_string(backend.type) << "] "
              << backend.base_url << '\n';
  }

  std::cout << "\nCapabilities:\n";
  for (const auto& capability : project.capabilities) {
    std::cout << "  - " << capability.id << " -> " << capability.tool_name << '\n';
    std::cout << "    Description: " << capability.description << '\n';
    std::cout << "    Main action: " << capability.main_action_id << '\n';
    std::cout << "    Preconditions:\n";
    if (capability.preconditions.empty()) {
      std::cout << "      none\n";
    }
    for (const auto& precondition : capability.preconditions) {
      std::cout << "      - " << precondition.id << " via " << precondition.action_id
                << " expects " << precondition.expect.json_pointer << '\n';
    }
    std::cout << "    Setup:\n";
    if (capability.setup_steps.empty()) {
      std::cout << "      none\n";
    }
    for (const auto& setup_step : capability.setup_steps) {
      std::cout << "      - " << setup_step.id << " for "
                << setup_step.for_precondition << " via "
                << setup_step.action_id << '\n';
    }
    std::cout << "    Verification:\n";
    if (!capability.verification.has_value()) {
      std::cout << "      none\n";
    } else {
      std::cout << "      - via " << capability.verification->action_id
                << " expects " << capability.verification->expect.json_pointer
                << '\n';
    }
    std::cout << "    Tool schema keys:";
    const auto properties = capability.input_schema.value(
        "properties", terva::core::json::object());
    if (properties.empty()) {
      std::cout << " none";
    } else {
      for (const auto& [name, _] : properties.items()) {
        std::cout << ' ' << name;
      }
    }
    std::cout << '\n';
  }
}

}  // namespace

int main(const int argc, char** argv) {
  if (argc != 3) {
    return print_usage();
  }

  const std::string_view command = argv[1];
  const std::string_view project_path = argv[2];

  if (command == "validate") {
    const auto project = load_and_validate(project_path, true);
    return project ? 0 : project.error();
  }

  if (command == "inspect") {
    const auto project = load_and_validate(project_path, false);
    if (!project) {
      return project.error();
    }
    print_inspection(*project);
    return 0;
  }

  if (command == "run") {
    auto project = load_and_validate(project_path, false);
    if (!project) {
      return project.error();
    }
    auto logger = std::make_shared<terva::core::logging::jsonl_logger>(
        project->logging);
    terva::core::mcp::runtime runtime(std::move(*project), std::move(logger));
    const auto run_result = runtime.run_stdio();
    if (!run_result) {
      std::cerr << run_result.error() << '\n';
      return 1;
    }
    return *run_result;
  }

  return print_usage();
}


#include "terva/core/logging/jsonl_logger.hpp"
#include "terva/core/mcp/runtime.hpp"
#include "terva/core/project/parser.hpp"
#include "terva/core/project/validator.hpp"

#include <iostream>
#include <memory>
#include <optional>
#include <string>
#include <string_view>

namespace {

void print_http_mapping(
    const terva::core::project::http_action_definition& action) {
  std::cout << terva::core::project::to_string(action.method) << ' '
            << action.path_template;
  if (!action.query_parameters.empty()) {
    std::cout << '?';
    bool first = true;
    for (const auto& [name, value] : action.query_parameters) {
      if (!first) {
        std::cout << '&';
      }
      first = false;
      std::cout << name << '=' << value;
    }
  }
}

const terva::core::project::http_action_definition* find_action(
    const terva::core::project::capability_definition& capability,
    const std::string_view action_id) {
  for (const auto& action : capability.actions) {
    if (action.id == action_id) {
      return &action;
    }
  }
  return nullptr;
}

int print_usage() {
  std::cerr << "Usage:\n";
  std::cerr << "  terva-server validate <project-file>\n";
  std::cerr << "  terva-server inspect <project-file>\n";
  std::cerr << "  terva-server run [--stdio] <project-file>\n";
  std::cerr << "  terva-server run --listen http://127.0.0.1:7777/mcp <project-file>\n";
  return 1;
}

std::expected<terva::core::mcp::http_listen_options, std::string> parse_listen_url(
    const std::string_view listen_url) {
  constexpr std::string_view prefix = "http://";
  if (!listen_url.starts_with(prefix)) {
    return std::unexpected("listen URL must start with http://");
  }

  const auto authority_and_path = listen_url.substr(prefix.size());
  const auto slash = authority_and_path.find('/');
  const auto authority = authority_and_path.substr(0, slash);
  const auto path = slash == std::string_view::npos
                        ? std::string("/mcp")
                        : std::string(authority_and_path.substr(slash));
  if (authority.empty()) {
    return std::unexpected("listen URL must include a host and port");
  }

  const auto colon = authority.rfind(':');
  if (colon == std::string_view::npos || colon == 0 ||
      colon + 1 >= authority.size()) {
    return std::unexpected("listen URL must include host:port");
  }

  auto host = std::string(authority.substr(0, colon));
  const auto port_text = std::string(authority.substr(colon + 1));
  int parsed_port = 0;
  try {
    parsed_port = std::stoi(port_text);
  } catch (const std::exception&) {
    return std::unexpected("listen URL port is invalid");
  }
  if (parsed_port <= 0 || parsed_port > 65'535) {
    return std::unexpected("listen URL port must be between 1 and 65535");
  }

  if (host == "localhost") {
    host = "127.0.0.1";
  }
  if (host != "127.0.0.1") {
    return std::unexpected("HTTP mode is restricted to localhost (127.0.0.1)");
  }
  if (path.empty() || path.front() != '/') {
    return std::unexpected("listen URL path must start with /");
  }

  return terva::core::mcp::http_listen_options{
      .bind_address = host,
      .port = static_cast<std::uint16_t>(parsed_port),
      .endpoint_path = path,
      .allowed_origins = {
          "http://127.0.0.1:" + std::to_string(parsed_port),
          "http://localhost:" + std::to_string(parsed_port),
      },
  };
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
    std::cout << "    Actions:\n";
    for (const auto& action : capability.actions) {
      std::cout << "      - " << action.id << " ";
      print_http_mapping(action);
      std::cout << '\n';
    }
    std::cout << "    Main action: " << capability.main_action_id << '\n';
    if (const auto* main_action = find_action(capability, capability.main_action_id);
        main_action != nullptr) {
      std::cout << "    HTTP mapping: ";
      print_http_mapping(*main_action);
      std::cout << '\n';
    }
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
      std::cout << "      - via " << capability.verification->action_id << " (";
      if (const auto* verification_action =
              find_action(capability, capability.verification->action_id);
          verification_action != nullptr) {
        print_http_mapping(*verification_action);
      }
      std::cout << ") expects " << capability.verification->expect.json_pointer;
      if (capability.verification->expect.equals.has_value()) {
        std::cout << " == " << capability.verification->expect.equals->dump();
      }
      if (capability.verification->attempts > 1 ||
          capability.verification->delay_ms > 0 ||
          capability.verification->success_delay_ms > 0) {
        std::cout << " retry attempts=" << capability.verification->attempts
                  << " delay_ms=" << capability.verification->delay_ms;
        if (capability.verification->success_delay_ms > 0) {
          std::cout << " success_delay_ms="
                    << capability.verification->success_delay_ms;
        }
      }
      std::cout << '\n';
    }
    std::cout << "    Output mapping:\n";
    if (capability.output_fields.empty()) {
      std::cout << "      none\n";
    }
    for (const auto& output : capability.output_fields) {
      std::cout << "      - " << output.name << " from "
                << terva::core::project::to_string(output.source);
      if (output.json_pointer.has_value()) {
        std::cout << ' ' << *output.json_pointer;
      }
      if (output.transform != terva::core::project::output_transform::none) {
        std::cout << " transform="
                  << terva::core::project::to_string(output.transform);
      }
      if (!output.normalize.empty()) {
        std::cout << " normalize{";
        bool first = true;
        for (const auto& [raw_value, mapped_value] : output.normalize) {
          if (!first) {
            std::cout << ", ";
          }
          first = false;
          std::cout << raw_value << "->" << mapped_value.dump();
        }
        std::cout << '}';
        if (output.default_value.has_value()) {
          std::cout << " default=" << output.default_value->dump();
        }
      }
      if (output.required) {
        std::cout << " required=true";
      }
      std::cout << '\n';
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
  if (argc < 3 || argc > 5) {
    return print_usage();
  }

  const std::string_view command = argv[1];

  if (command == "validate") {
    if (argc != 3) {
      return print_usage();
    }
    const std::string_view project_path = argv[2];
    const auto project = load_and_validate(project_path, true);
    return project ? 0 : project.error();
  }

  if (command == "inspect") {
    if (argc != 3) {
      return print_usage();
    }
    const std::string_view project_path = argv[2];
    const auto project = load_and_validate(project_path, false);
    if (!project) {
      return project.error();
    }
    print_inspection(*project);
    return 0;
  }

  if (command == "run") {
    std::string_view project_path;
    bool use_http = false;
    std::optional<terva::core::mcp::http_listen_options> listen_options;

    if (argc == 3) {
      project_path = argv[2];
    } else if (argc == 4 && std::string_view(argv[2]) == "--stdio") {
      project_path = argv[3];
    } else if (argc == 5 && std::string_view(argv[2]) == "--listen") {
      auto parsed_listen = parse_listen_url(argv[3]);
      if (!parsed_listen) {
        std::cerr << parsed_listen.error() << '\n';
        return 1;
      }
      use_http = true;
      listen_options = std::move(*parsed_listen);
      project_path = argv[4];
    } else {
      return print_usage();
    }

    auto project = load_and_validate(project_path, false);
    if (!project) {
      return project.error();
    }
    auto logger = std::make_shared<terva::core::logging::jsonl_logger>(
        project->logging);
    terva::core::mcp::runtime runtime(std::move(*project), std::move(logger));
    const auto run_result = use_http
                                ? runtime.run_http(*listen_options)
                                : runtime.run_stdio();
    if (!run_result) {
      std::cerr << run_result.error() << '\n';
      return 1;
    }
    return *run_result;
  }

  return print_usage();
}

#include "terva/core/engine/engine.hpp"

#include "terva/core/backend/backend.hpp"
#include "terva/core/capability/executor.hpp"
#include "terva/core/logging/jsonl_logger.hpp"
#include "terva/core/mcp/runtime.hpp"
#include "terva/core/project/parser.hpp"
#include "terva/core/project/validator.hpp"

#include <dts/naming.hpp>
#include <fstream>
#include <mutex>
#include <memory>
#include <optional>
#include <sstream>
#include <thread>
#include <utility>

namespace terva::core::engine {
namespace {

struct loaded_document final {
  std::filesystem::path source_path;
  std::string contents;
  std::optional<project::project_definition> project;
  std::optional<std::string> parse_error;
  std::vector<project::validation_issue> validation_issues;
};

struct managed_http_server final {
  mcp::runtime runtime;
  dts::mcp::server server;
  std::string listen_url;
  std::jthread wait_thread;
};

[[nodiscard]] std::expected<std::string, std::string> read_file(
    const std::filesystem::path& path) {
  std::ifstream stream(path);
  if (!stream) {
    return std::unexpected("unable to open project file: " + path.string());
  }

  std::stringstream buffer;
  buffer << stream.rdbuf();
  return buffer.str();
}

[[nodiscard]] std::expected<void, std::string> write_file(
    const std::filesystem::path& path,
    const std::string& contents) {
  std::ofstream stream(path, std::ios::trunc);
  if (!stream) {
    return std::unexpected("unable to write project file: " + path.string());
  }
  stream << contents;
  if (!stream.good()) {
    return std::unexpected("failed to write complete project file: " + path.string());
  }
  return {};
}

[[nodiscard]] std::string file_name_for_path(const std::filesystem::path& path) {
  return path.filename().empty() ? path.string() : path.filename().string();
}

[[nodiscard]] std::string default_display_name_for_path(
    const std::filesystem::path& path) {
  if (const auto stem = path.stem().string(); !stem.empty()) {
    return stem;
  }
  return file_name_for_path(path);
}

[[nodiscard]] json validation_payload(const loaded_document& document) {
  json issues = json::array();
  if (document.parse_error.has_value()) {
    issues.push_back(json{
        {"path", "project"},
        {"message", *document.parse_error},
    });
  }
  for (const auto& issue : document.validation_issues) {
    issues.push_back(json(issue));
  }
  return json{
      {"ok", issues.empty()},
      {"issues", std::move(issues)},
  };
}

[[nodiscard]] bool server_runnable(const loaded_document& document) noexcept {
  return document.project.has_value() && !document.parse_error.has_value() &&
         document.validation_issues.empty();
}

[[nodiscard]] json action_payload(
    const project::http_action_definition& action) {
  json query = json::object();
  for (const auto& [name, value] : action.query_parameters) {
    query[name] = value;
  }

  return json{
      {"id", action.id},
      {"description", action.description},
      {"backend_id", action.backend_id},
      {"method", project::to_string(action.method)},
      {"path", action.path_template},
      {"query", std::move(query)},
      {"success_statuses", action.success_statuses},
  };
}

[[nodiscard]] json expectation_payload(
    const project::value_expectation& expectation) {
  json payload{
      {"json_pointer", expectation.json_pointer},
  };
  if (expectation.equals.has_value()) {
    payload["equals"] = *expectation.equals;
  }
  if (expectation.equals_input.has_value()) {
    payload["equals_input"] = *expectation.equals_input;
  }
  return payload;
}

[[nodiscard]] json verification_payload(
    const project::verification_definition& verification) {
  return json{
      {"action_id", verification.action_id},
      {"expect", expectation_payload(verification.expect)},
      {"attempts", verification.attempts},
      {"delay_ms", verification.delay_ms},
      {"success_delay_ms", verification.success_delay_ms},
  };
}

[[nodiscard]] json inspection_payload(const project::project_definition& project) {
  json mcp_transports = json::array();
  for (const auto transport : project.mcp_transports) {
    mcp_transports.push_back(project::to_string(transport));
  }

  const auto product_connector =
      project.product_connector.has_value()
          ? json(project::to_string(*project.product_connector))
          : json("");

  json product_http_headers = json::array();
  for (const auto& [name, value] : project.product_http.mandatory_headers) {
    product_http_headers.push_back(json{{"name", name}, {"value", value}});
  }

  json product_http{
      {"version", project.product_http.version.value_or("")},
      {"tls_enabled", project.product_http.tls_enabled},
      {"mandatory_headers", std::move(product_http_headers)},
  };
  json product_uart{
      {"baud_rate", project.product_uart.baud_rate.value_or(0)},
      {"port", project.product_uart.port.value_or("")},
      {"framing", project.product_uart.framing.value_or("")},
  };

  json backends = json::array();
  for (const auto& backend : project.backends) {
    backends.push_back(json{
        {"id", backend.id},
        {"type", project::to_string(backend.type)},
        {"base_url", backend.base_url},
    });
  }

  json capabilities = json::array();
  for (const auto& capability : project.capabilities) {
    json actions = json::array();
    for (const auto& action : capability.actions) {
      actions.push_back(action_payload(action));
    }

    json tool_schema_keys = json::array();
    const auto properties =
        capability.input_schema.value("properties", json::object());
    for (const auto& [name, _] : properties.items()) {
      tool_schema_keys.push_back(name);
    }

    json capability_payload{
        {"id", capability.id},
        {"tool_name", capability.tool_name},
        {"description", capability.description},
        {"input_schema", capability.input_schema},
        {"input_schema_keys", std::move(tool_schema_keys)},
        {"main_action_id", capability.main_action_id},
        {"actions", std::move(actions)},
    };
    if (capability.verification.has_value()) {
      capability_payload["verification"] =
          verification_payload(*capability.verification);
    }
    capabilities.push_back(std::move(capability_payload));
  }

  json mcp_server{
      {"name", project.mcp_server.name},
      {"version", project.mcp_server.version},
      {"title", project.mcp_server.title.value_or("")},
      {"description", project.mcp_server.description.value_or("")},
      {"website_url", project.mcp_server.website_url.value_or("")},
      {"instructions", project.mcp_server.instructions.value_or("")},
  };

  return json{
      {"name", project.name},
      {"description", project.description.value_or("")},
      {"mcp_server", std::move(mcp_server)},
      {"mcp_transports", std::move(mcp_transports)},
      {"product_connector", std::move(product_connector)},
      {"product_http", std::move(product_http)},
      {"product_uart", std::move(product_uart)},
      {"source_path", project.source_path.string()},
      {"backends", std::move(backends)},
      {"capabilities", std::move(capabilities)},
  };
}

[[nodiscard]] json document_payload(const loaded_document& document) {
  const auto display_name =
      document.project.has_value() ? document.project->name
                                   : default_display_name_for_path(document.source_path);

  json payload{
      {"path", document.source_path.string()},
      {"file_name", file_name_for_path(document.source_path)},
      {"display_name", display_name},
      {"contents", document.contents},
      {"parse_error", document.parse_error.value_or("")},
      {"server_runnable", server_runnable(document)},
      {"validation", validation_payload(document)},
  };

  if (document.project.has_value()) {
    payload["description"] = document.project->description.value_or("");
    json mcp_transports = json::array();
    for (const auto transport : document.project->mcp_transports) {
      mcp_transports.push_back(project::to_string(transport));
    }
    const auto product_connector =
        document.project->product_connector.has_value()
            ? json(project::to_string(*document.project->product_connector))
            : json("");
    json product_http_headers = json::array();
    for (const auto& [name, value] : document.project->product_http.mandatory_headers) {
      product_http_headers.push_back(json{{"name", name}, {"value", value}});
    }
    payload["mcp_transports"] = std::move(mcp_transports);
    payload["product_connector"] = std::move(product_connector);
    payload["product_http"] = json{
        {"version", document.project->product_http.version.value_or("")},
        {"tls_enabled", document.project->product_http.tls_enabled},
        {"mandatory_headers", std::move(product_http_headers)},
    };
    payload["product_uart"] = json{
        {"baud_rate", document.project->product_uart.baud_rate.value_or(0)},
        {"port", document.project->product_uart.port.value_or("")},
        {"framing", document.project->product_uart.framing.value_or("")},
    };
    payload["mcp_server"] = json{
        {"name", document.project->mcp_server.name},
        {"version", document.project->mcp_server.version},
        {"title", document.project->mcp_server.title.value_or("")},
        {"description", document.project->mcp_server.description.value_or("")},
        {"website_url", document.project->mcp_server.website_url.value_or("")},
        {"instructions", document.project->mcp_server.instructions.value_or("")},
    };
    payload["backend_count"] = document.project->backends.size();
    payload["capability_count"] = document.project->capabilities.size();
    payload["inspection"] = inspection_payload(*document.project);
  } else {
    payload["description"] = "";
    payload["mcp_transports"] = json::array();
    payload["product_connector"] = "";
    payload["product_http"] = json{
        {"version", ""},
        {"tls_enabled", false},
        {"mandatory_headers", json::array()},
    };
    payload["product_uart"] = json{
        {"baud_rate", 0},
        {"port", ""},
        {"framing", ""},
    };
    payload["mcp_server"] = json{
        {"name", ""},
        {"version", ""},
        {"title", ""},
        {"description", ""},
        {"website_url", ""},
        {"instructions", ""},
    };
    payload["backend_count"] = 0;
    payload["capability_count"] = 0;
  }

  return payload;
}

[[nodiscard]] json summary_payload(const loaded_document& document) {
  json payload = document_payload(document);
  payload.erase("contents");
  payload.erase("inspection");
  return payload;
}

[[nodiscard]] std::expected<loaded_document, std::string> parse_document(
    const std::filesystem::path& source_path,
    std::string contents) {
  loaded_document document{
      .source_path = source_path,
      .contents = std::move(contents),
  };

  auto parsed = project::parse_project_text(document.contents, source_path);
  if (!parsed) {
    document.parse_error = parsed.error();
    return document;
  }

  document.project = std::move(*parsed);
  document.validation_issues = project::validate_project(*document.project);
  return document;
}

[[nodiscard]] json tool_list_payload(const project::project_definition& project) {
  json tools = json::array();
  for (const auto& capability : project.capabilities) {
    tools.push_back(json{
        {"capability_id", capability.id},
        {"tool_name", capability.tool_name},
        {"description", capability.description},
        {"input_schema", capability.input_schema},
    });
  }
  return json{{"tools", std::move(tools)}};
}

}  // namespace

struct engine::impl final {
  std::optional<loaded_document> document;
  mutable std::mutex events_mutex;
  std::vector<json> events;
  std::shared_ptr<logging::jsonl_logger> runtime_logger;
  std::unique_ptr<backend::backend_registry> backends;
  std::unique_ptr<capability::capability_executor> executor;
  std::unique_ptr<managed_http_server> http_server;

  void push_event(json payload) {
    const std::scoped_lock lock(events_mutex);
    events.push_back(std::move(payload));
  }

  void record_event(std::string_view event_name, json payload = json::object()) {
    if (!payload.is_object()) {
      payload = json{{"payload", std::move(payload)}};
    }
    payload["event"] = event_name;
    push_event(std::move(payload));
  }

  void reset_runtime() {
    if (http_server) {
      http_server->server.stop();
      if (http_server->wait_thread.joinable()) {
        http_server->wait_thread.join();
      }
      http_server.reset();
    }
    executor.reset();
    backends.reset();
    runtime_logger.reset();
  }
};

engine::engine() : impl_(std::make_unique<impl>()) {}
engine::~engine() = default;
engine::engine(engine&&) noexcept = default;
engine& engine::operator=(engine&&) noexcept = default;

std::expected<json, std::string> engine::open_document(
    const std::filesystem::path& path) {
  auto contents = read_file(path);
  if (!contents) {
    return std::unexpected(contents.error());
  }
  return load_document(path, std::move(*contents));
}

std::expected<json, std::string> engine::close_document() {
  if (!impl_) {
    return std::unexpected("engine is not initialized");
  }
  if (!impl_->document.has_value()) {
    return json{{"closed", false}};
  }

  const auto path = impl_->document->source_path.string();
  impl_->reset_runtime();
  impl_->document.reset();
  impl_->record_event("terva.document_closed", json{{"path", path}});
  return json{{"closed", true}, {"path", path}};
}

std::expected<json, std::string> engine::generate_project_name() {
  try {
    dts::naming::project_name_generator generator;
    const auto slug = generator.generate_pair_name();

    std::string friendly_name;
    friendly_name.reserve(slug.size());

    auto uppercase_next = true;
    for (const char character : slug) {
      if (character == '-') {
        friendly_name.push_back(' ');
        uppercase_next = true;
        continue;
      }

      if (uppercase_next && character >= 'a' && character <= 'z') {
        friendly_name.push_back(static_cast<char>(character - 'a' + 'A'));
      } else {
        friendly_name.push_back(character);
      }
      uppercase_next = false;
    }

    return json{{"friendly_name", std::move(friendly_name)}, {"slug", slug}};
  } catch (const std::exception& exception) {
    return std::unexpected(
        std::string("failed to generate project name: ") + exception.what());
  }
}

std::expected<json, std::string> engine::load_document(
    const std::filesystem::path& source_path,
    std::string contents) {
  if (!impl_) {
    return std::unexpected("engine is not initialized");
  }

  auto document = parse_document(source_path, std::move(contents));
  if (!document) {
    return std::unexpected(document.error());
  }

  impl_->document = std::move(*document);
  impl_->reset_runtime();
  impl_->record_event(
      "terva.document_loaded",
      json{
          {"path", impl_->document->source_path.string()},
          {"parse_ok", !impl_->document->parse_error.has_value()},
          {"validation_ok", impl_->document->validation_issues.empty()},
      });
  return document_payload(*impl_->document);
}

std::expected<json, std::string> engine::update_project_metadata(
    const json& metadata) {
  if (!impl_ || !impl_->document.has_value()) {
    return std::unexpected("no active document is loaded");
  }
  if (!impl_->document->project.has_value()) {
    return std::unexpected(
        impl_->document->parse_error.value_or("active document could not be parsed"));
  }
  if (!metadata.is_object()) {
    return std::unexpected("project metadata update must be a JSON object");
  }

  auto updated = *impl_->document->project;

  const auto assign_required_string = [&metadata](const char* key,
                                                  std::string& target) {
    if (const auto it = metadata.find(key);
        it != metadata.end() && it->is_string()) {
      target = it->get<std::string>();
    }
  };
  const auto assign_optional_string =
      [&metadata](const char* key, std::optional<std::string>& target) {
        const auto it = metadata.find(key);
        if (it == metadata.end() || it->is_null()) {
          target.reset();
          return;
        }
        if (it->is_string()) {
          const auto value = it->get<std::string>();
          if (value.empty()) {
            target.reset();
          } else {
            target = value;
          }
        }
      };
  const auto assign_string_list =
      [&metadata](const char* key) -> std::optional<std::vector<std::string>> {
        const auto it = metadata.find(key);
        if (it == metadata.end() || !it->is_array()) {
          return std::nullopt;
        }

        std::vector<std::string> values;
        for (const auto& item : *it) {
          if (item.is_string()) {
            values.push_back(item.get<std::string>());
          }
        }
        return values;
      };
  const auto assign_optional_bool = [&metadata](const char* key, bool& target) -> bool {
    const auto it = metadata.find(key);
    if (it == metadata.end()) {
      return false;
    }
    if (it->is_boolean()) {
      target = it->get<bool>();
      return true;
    }
    return false;
  };
  const auto assign_optional_int =
      [&metadata](const char* key, std::optional<int>& target) -> bool {
    const auto it = metadata.find(key);
    if (it == metadata.end()) {
      return false;
    }
    if (it->is_number_integer()) {
      target = it->get<int>();
      return true;
    }
    if (it->is_null()) {
      target.reset();
      return true;
    }
    return false;
  };
  const auto assign_named_string_list = [&metadata](const char* key)
      -> std::optional<std::map<std::string, std::string, std::less<>>> {
    const auto it = metadata.find(key);
    if (it == metadata.end() || !it->is_array()) {
      return std::nullopt;
    }

    std::map<std::string, std::string, std::less<>> values;
    for (const auto& item : *it) {
      if (!item.is_object()) {
        continue;
      }
      const auto name_it = item.find("name");
      const auto value_it = item.find("value");
      if (name_it == item.end() || value_it == item.end() || !name_it->is_string() ||
          !value_it->is_string()) {
        continue;
      }
      values.emplace(name_it->get<std::string>(), value_it->get<std::string>());
    }
    return values;
  };

  assign_required_string("project_name", updated.name);
  assign_optional_string("project_description", updated.description);
  assign_required_string("mcp_name", updated.mcp_server.name);
  assign_required_string("mcp_version", updated.mcp_server.version);
  assign_optional_string("mcp_title", updated.mcp_server.title);
  assign_optional_string("mcp_description", updated.mcp_server.description);
  assign_optional_string("mcp_website_url", updated.mcp_server.website_url);
  assign_optional_string("mcp_instructions", updated.mcp_server.instructions);
  if (const auto transport_names = assign_string_list("mcp_transports");
      transport_names.has_value()) {
    updated.mcp_transports.clear();
    for (const auto& value : *transport_names) {
      const auto parsed = project::parse_mcp_transport(value);
      if (!parsed.has_value()) {
        return std::unexpected("unsupported MCP transport: " + value);
      }
      updated.mcp_transports.push_back(*parsed);
    }
  }
  if (const auto it = metadata.find("product_connector");
      it != metadata.end() && it->is_string()) {
    const auto value = it->get<std::string>();
    const auto parsed = project::parse_product_connector(value);
    if (!parsed.has_value()) {
      return std::unexpected("unsupported product connector: " + value);
    }
    updated.product_connector = *parsed;
  }
  assign_optional_string("product_http_version", updated.product_http.version);
  assign_optional_bool("product_http_tls_enabled", updated.product_http.tls_enabled);
  if (const auto headers = assign_named_string_list("product_http_mandatory_headers");
      headers.has_value()) {
    updated.product_http.mandatory_headers = std::move(*headers);
  }
  assign_optional_int("product_uart_baud_rate", updated.product_uart.baud_rate);
  assign_optional_string("product_uart_port", updated.product_uart.port);
  assign_optional_string("product_uart_framing", updated.product_uart.framing);

  auto rendered = project::render_project_text(updated);
  if (!rendered) {
    return std::unexpected(rendered.error());
  }
  if (const auto written = write_file(impl_->document->source_path, *rendered);
      !written) {
    return std::unexpected(written.error());
  }

  return load_document(impl_->document->source_path, std::move(*rendered));
}

std::expected<json, std::string> engine::summarize_project_file(
    const std::filesystem::path& path) const {
  auto contents = read_file(path);
  if (!contents) {
    return std::unexpected(contents.error());
  }

  auto document = parse_document(path, std::move(*contents));
  if (!document) {
    return std::unexpected(document.error());
  }
  return summary_payload(*document);
}

std::expected<json, std::string> engine::validate_active_document() const {
  if (!impl_ || !impl_->document.has_value()) {
    return std::unexpected("no active document is loaded");
  }
  return validation_payload(*impl_->document);
}

std::expected<json, std::string> engine::inspect_active_document() const {
  if (!impl_ || !impl_->document.has_value()) {
    return std::unexpected("no active document is loaded");
  }
  if (!impl_->document->project.has_value()) {
    return std::unexpected(
        impl_->document->parse_error.value_or("active document could not be parsed"));
  }
  return inspection_payload(*impl_->document->project);
}

std::expected<json, std::string> engine::start_server() {
  if (!impl_ || !impl_->document.has_value()) {
    return std::unexpected("no active document is loaded");
  }
  if (!impl_->document->project.has_value()) {
    return std::unexpected(
        impl_->document->parse_error.value_or("active document could not be parsed"));
  }
  if (!impl_->document->validation_issues.empty()) {
    return std::unexpected("active document has validation issues");
  }
  if (impl_->http_server && impl_->http_server->server.running()) {
    return json{
        {"running", true},
        {"listen_url", impl_->http_server->listen_url},
        {"tool_count", impl_->document->project->capabilities.size()},
    };
  }

  auto callback = [state = impl_.get()](const json& payload) {
    state->push_event(payload);
  };
  impl_->runtime_logger = std::make_shared<logging::jsonl_logger>(
      impl_->document->project->logging, std::move(callback));

  mcp::runtime runtime(*impl_->document->project, impl_->runtime_logger);
  const auto listen = mcp::http_listen_options{
      .bind_address = "127.0.0.1",
      .port = 7777,
      .endpoint_path = "/mcp",
      .allowed_origins = {
          "http://127.0.0.1:7777",
          "http://localhost:7777",
      },
  };
  auto started_server = runtime.start_http_server(listen);
  if (!started_server) {
    impl_->runtime_logger.reset();
    return std::unexpected(started_server.error());
  }

  impl_->http_server = std::make_unique<managed_http_server>(managed_http_server{
      .runtime = std::move(runtime),
      .server = std::move(started_server->server),
      .listen_url = started_server->listen_url,
  });
  impl_->http_server->wait_thread = std::jthread(
      [state = impl_.get(), server = &impl_->http_server->server,
       listen_url = impl_->http_server->listen_url]() mutable {
        server->wait();
        state->record_event(
            "terva.server_wait_completed",
            json{{"listen_url", listen_url}});
      });

  impl_->record_event(
      "terva.runtime_started",
      json{{"path", impl_->document->source_path.string()},
           {"listen_url", impl_->http_server->listen_url}});

  return json{
      {"running", true},
      {"listen_url", impl_->http_server->listen_url},
      {"tool_count", impl_->document->project->capabilities.size()},
  };
}

std::expected<json, std::string> engine::stop_server() {
  if (!impl_) {
    return std::unexpected("engine is not initialized");
  }
  auto previous_listen_url = std::string{};
  if (impl_->http_server) {
    previous_listen_url = impl_->http_server->listen_url;
  }
  impl_->reset_runtime();
  impl_->record_event(
      "terva.runtime_stopped",
      json{{"listen_url", previous_listen_url}});
  return json{{"running", false}, {"listen_url", previous_listen_url}};
}

std::expected<json, std::string> engine::list_tools() {
  if (!impl_ || !impl_->document || !impl_->document->project) {
    return std::unexpected("active document is not available");
  }
  if (!impl_->executor) {
    auto callback = [state = impl_.get()](const json& payload) {
      state->push_event(payload);
    };
    impl_->runtime_logger = std::make_shared<logging::jsonl_logger>(
        impl_->document->project->logging, std::move(callback));
    impl_->backends = std::make_unique<backend::backend_registry>(
        impl_->document->project->backends);
    impl_->executor = std::make_unique<capability::capability_executor>(
        *impl_->document->project,
        *impl_->backends,
        impl_->runtime_logger);
  }

  return tool_list_payload(*impl_->document->project);
}

std::expected<json, std::string> engine::invoke_tool(
    const std::string_view tool_name,
    const json& input) {
  const auto ready = list_tools();
  if (!ready) {
    return std::unexpected(ready.error());
  }
  if (!impl_ || !impl_->executor) {
    return std::unexpected("active runtime is not available");
  }

  auto result = impl_->executor->execute_tool(tool_name, input);
  if (!result) {
    return std::unexpected(result.error());
  }
  return json(*result);
}

json engine::drain_events() {
  if (!impl_) {
    return json::array();
  }

  json events = json::array();
  const std::scoped_lock lock(impl_->events_mutex);
  for (auto& event : impl_->events) {
    events.push_back(std::move(event));
  }
  impl_->events.clear();
  return events;
}

}  // namespace terva::core::engine

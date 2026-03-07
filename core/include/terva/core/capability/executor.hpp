#pragma once

#include "terva/core/backend/backend.hpp"
#include "terva/core/json.hpp"
#include "terva/core/logging/jsonl_logger.hpp"
#include "terva/core/project/model.hpp"

#include <expected>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace terva::core::capability {

struct backend_call_summary final {
  std::string stage;
  std::string action_id;
  std::string backend_id;
  std::string method;
  std::string url;
  std::string path;
  json query_parameters = json::object();
  bool ok{false};
  int status_code{0};
  json request_headers = json::object();
  json request_body = nullptr;
  json response_body = nullptr;
  std::string response_body_text;
  std::optional<std::string> error;
};

struct precondition_check_result final {
  std::string id;
  std::string description;
  std::string action_id;
  bool met{false};
  bool rechecked_after_setup{false};
  json expected_value = nullptr;
  json actual_value = nullptr;
  std::optional<backend_call_summary> call;
  std::optional<std::string> error;
};

struct setup_step_result final {
  std::string id;
  std::string description;
  std::string for_precondition;
  std::string action_id;
  bool performed{false};
  bool ok{false};
  std::optional<backend_call_summary> call;
  std::optional<std::string> error;
};

struct verification_result final {
  bool attempted{false};
  bool ok{false};
  std::string action_id;
  int attempts{0};
  json expected_raw_value = nullptr;
  json observed_raw_value = nullptr;
  json expected_normalized_value = nullptr;
  json observed_normalized_value = nullptr;
  std::optional<std::string> error;
};

struct execution_trace final {
  std::vector<precondition_check_result> preconditions;
  std::vector<setup_step_result> setup_steps;
  std::vector<backend_call_summary> steps;
};

struct capability_error final {
  std::string stage;
  std::string code;
  std::string message;
};

struct capability_execution_result final {
  bool ok{false};
  std::string capability_id;
  std::string tool_name;
  json output = nullptr;
  std::optional<verification_result> verification;
  execution_trace trace;
  std::optional<capability_error> error;
};

void to_json(json& target, const backend_call_summary& value);
void to_json(json& target, const precondition_check_result& value);
void to_json(json& target, const setup_step_result& value);
void to_json(json& target, const verification_result& value);
void to_json(json& target, const execution_trace& value);
void to_json(json& target, const capability_error& value);
void to_json(json& target, const capability_execution_result& value);

class capability_executor final {
 public:
  capability_executor(
      const project::project_definition& project,
      const backend::backend_registry& backends,
      logging::shared_logger logger);

  [[nodiscard]] std::expected<capability_execution_result, std::string> execute_tool(
      std::string_view tool_name,
      const json& input) const;

 private:
  const project::project_definition& project_;
  const backend::backend_registry& backends_;
  logging::shared_logger logger_;
};

}  // namespace terva::core::capability

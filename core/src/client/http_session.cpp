#include "terva/core/client/http_session.hpp"

#include "terva/core/version.hpp"

#include <curl/curl.h>

#include <memory>
#include <string>
#include <utility>

namespace terva::core::client {
namespace {

constexpr std::string_view kProtocolVersion = "2024-11-05";

class curl_runtime final {
 public:
  curl_runtime() {
    curl_global_init(CURL_GLOBAL_DEFAULT);
  }

  ~curl_runtime() {
    curl_global_cleanup();
  }
};

[[nodiscard]] curl_runtime& shared_curl_runtime() {
  static curl_runtime runtime;
  return runtime;
}

size_t write_body_callback(char* pointer, size_t size, size_t count, void* user_data) {
  auto* body = static_cast<std::string*>(user_data);
  const auto total_size = size * count;
  body->append(pointer, total_size);
  return total_size;
}

struct curl_slist_deleter final {
  void operator()(curl_slist* list) const {
    curl_slist_free_all(list);
  }
};

using unique_curl_slist = std::unique_ptr<curl_slist, curl_slist_deleter>;

}  // namespace

http_session::http_session(std::string endpoint_url)
    : endpoint_url_(std::move(endpoint_url)) {}

std::expected<void, std::string> http_session::initialize() {
  const auto response = request(
      "initialize",
      json{
          {"protocolVersion", kProtocolVersion},
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

std::expected<json, std::string> http_session::list_tools() {
  if (!initialized_) {
    if (const auto initialized = initialize(); !initialized) {
      return std::unexpected(initialized.error());
    }
  }
  return request("tools/list", json::object());
}

std::expected<json, std::string> http_session::call_tool(
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

std::expected<json, std::string> http_session::request(
    const std::string_view method,
    json params) {
  (void)shared_curl_runtime();

  auto* handle = curl_easy_init();
  if (handle == nullptr) {
    return std::unexpected("unable to initialize curl");
  }

  const int request_id = next_request_id_++;
  json request_json{
      {"jsonrpc", "2.0"},
      {"id", request_id},
      {"method", method},
      {"params", std::move(params)},
  };

  const auto payload = request_json.dump();
  std::string response_body;

  curl_easy_setopt(handle, CURLOPT_URL, endpoint_url_.c_str());
  curl_easy_setopt(handle, CURLOPT_POST, 1L);
  curl_easy_setopt(handle, CURLOPT_POSTFIELDS, payload.c_str());
  curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE,
                   static_cast<long>(payload.size()));
  curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, write_body_callback);
  curl_easy_setopt(handle, CURLOPT_WRITEDATA, &response_body);
  curl_easy_setopt(handle, CURLOPT_TIMEOUT_MS, 30'000L);
  curl_easy_setopt(handle, CURLOPT_NOSIGNAL, 1L);

  curl_slist* raw_headers = nullptr;
  raw_headers = curl_slist_append(raw_headers,
                                  "Accept: application/json, text/event-stream");
  raw_headers = curl_slist_append(raw_headers, "Content-Type: application/json");
  raw_headers = curl_slist_append(
      raw_headers,
      ("MCP-Protocol-Version: " + std::string(kProtocolVersion)).c_str());
  unique_curl_slist request_headers(raw_headers);
  curl_easy_setopt(handle, CURLOPT_HTTPHEADER, request_headers.get());

  const auto curl_result = curl_easy_perform(handle);
  if (curl_result != CURLE_OK) {
    const auto message = std::string("curl request failed: ") +
                         curl_easy_strerror(curl_result);
    curl_easy_cleanup(handle);
    return std::unexpected(message);
  }

  long status_code = 0;
  curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &status_code);
  curl_easy_cleanup(handle);

  if (status_code != 200) {
    return std::unexpected("HTTP " + std::to_string(status_code) + ": " + response_body);
  }

  json response_json;
  try {
    response_json = json::parse(response_body);
  } catch (const std::exception& exception) {
    return std::unexpected("failed to parse HTTP MCP response: " +
                           std::string(exception.what()));
  }

  if (response_json.contains("error")) {
    return std::unexpected(response_json["error"].dump());
  }
  if (!response_json.contains("result")) {
    return std::unexpected("MCP response did not contain a result");
  }
  return response_json["result"];
}

}  // namespace terva::core::client

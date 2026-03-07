#include "terva/core/backend/http_backend.hpp"

#include <curl/curl.h>

#include <algorithm>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>

namespace terva::core::backend {
namespace {

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

[[nodiscard]] std::string join_url(const std::string& base_url, const std::string& path) {
  if (path.empty()) {
    return base_url;
  }
  if (base_url.ends_with('/') && path.starts_with('/')) {
    return base_url.substr(0, base_url.size() - 1) + path;
  }
  if (!base_url.ends_with('/') && !path.starts_with('/')) {
    return base_url + "/" + path;
  }
  return base_url + path;
}

[[nodiscard]] std::expected<std::string, std::string> encode_query_parameters(
    CURL* handle,
    const std::map<std::string, std::string, std::less<>>& query_parameters) {
  if (query_parameters.empty()) {
    return std::string{};
  }

  std::string encoded_query;
  bool first = true;
  for (const auto& [name, value] : query_parameters) {
    char* encoded_name = curl_easy_escape(handle, name.c_str(),
                                          static_cast<int>(name.size()));
    char* encoded_value = curl_easy_escape(handle, value.c_str(),
                                           static_cast<int>(value.size()));
    if (encoded_name == nullptr || encoded_value == nullptr) {
      if (encoded_name != nullptr) {
        curl_free(encoded_name);
      }
      if (encoded_value != nullptr) {
        curl_free(encoded_value);
      }
      return std::unexpected("failed to encode query parameters");
    }

    if (!first) {
      encoded_query.push_back('&');
    }
    first = false;
    encoded_query.append(encoded_name);
    encoded_query.push_back('=');
    encoded_query.append(encoded_value);
    curl_free(encoded_name);
    curl_free(encoded_value);
  }

  return encoded_query;
}

size_t write_body_callback(
    char* pointer,
    size_t size,
    size_t count,
    void* user_data) {
  auto* body = static_cast<std::string*>(user_data);
  const auto total_size = size * count;
  body->append(pointer, total_size);
  return total_size;
}

size_t write_header_callback(
    char* buffer,
    size_t size,
    size_t count,
    void* user_data) {
  auto* headers =
      static_cast<std::map<std::string, std::string, std::less<>>*>(user_data);
  const auto total_size = size * count;
  std::string_view line(buffer, total_size);
  const auto separator = line.find(':');
  if (separator == std::string_view::npos) {
    return total_size;
  }

  const auto name = std::string(line.substr(0, separator));
  auto value = std::string(line.substr(separator + 1));
  while (!value.empty() &&
         (value.front() == ' ' || value.front() == '\t')) {
    value.erase(value.begin());
  }
  while (!value.empty() &&
         (value.back() == '\r' || value.back() == '\n')) {
    value.pop_back();
  }
  headers->insert_or_assign(name, value);
  return total_size;
}

struct curl_slist_deleter final {
  void operator()(curl_slist* list) const {
    curl_slist_free_all(list);
  }
};

using unique_curl_slist = std::unique_ptr<curl_slist, curl_slist_deleter>;

}  // namespace

struct backend_registry::impl final {
  std::unordered_map<std::string, std::unique_ptr<backend_adapter>> adapters;
};

http_backend::http_backend(project::backend_definition definition)
    : definition_(std::move(definition)) {}

std::expected<backend_response, std::string> http_backend::perform(
    const backend_request& request) const {
  (void)shared_curl_runtime();

  auto* handle = curl_easy_init();
  if (handle == nullptr) {
    return std::unexpected("unable to initialize curl");
  }

  std::string response_body;
  backend_response response;
  const auto body_string =
      request.has_body ? request.body.dump() : std::string{};

  const auto encoded_query =
      encode_query_parameters(handle, request.query_parameters);
  if (!encoded_query) {
    curl_easy_cleanup(handle);
    return std::unexpected(encoded_query.error());
  }

  auto url = join_url(definition_.base_url, request.path);
  if (!encoded_query->empty()) {
    url.push_back('?');
    url.append(*encoded_query);
  }

  curl_easy_setopt(handle, CURLOPT_URL, url.c_str());
  curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, write_body_callback);
  curl_easy_setopt(handle, CURLOPT_WRITEDATA, &response_body);
  curl_easy_setopt(handle, CURLOPT_HEADERFUNCTION, write_header_callback);
  curl_easy_setopt(handle, CURLOPT_HEADERDATA, &response.headers);
  curl_easy_setopt(handle, CURLOPT_TIMEOUT_MS, 5'000L);
  curl_easy_setopt(handle, CURLOPT_NOSIGNAL, 1L);

  if (request.method == project::http_method::post) {
    curl_easy_setopt(handle, CURLOPT_POST, 1L);
    curl_easy_setopt(handle, CURLOPT_POSTFIELDS, body_string.c_str());
    curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE,
                     static_cast<long>(body_string.size()));
  } else if (request.method == project::http_method::put) {
    curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, "PUT");
    if (request.has_body) {
      curl_easy_setopt(handle, CURLOPT_POSTFIELDS, body_string.c_str());
      curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE,
                       static_cast<long>(body_string.size()));
    } else {
      curl_easy_setopt(handle, CURLOPT_POSTFIELDS, "");
      curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE, 0L);
    }
  } else {
    curl_easy_setopt(handle, CURLOPT_HTTPGET, 1L);
  }

  unique_curl_slist request_headers;
  curl_slist* raw_headers = nullptr;
  raw_headers = curl_slist_append(raw_headers, "Accept: application/json");
  if (request.has_body) {
    raw_headers = curl_slist_append(
        raw_headers, "Content-Type: application/json");
  }
  for (const auto& [name, value] : definition_.headers) {
    const auto header_line = name + ": " + value;
    raw_headers = curl_slist_append(raw_headers, header_line.c_str());
  }
  for (const auto& [name, value] : request.headers) {
    const auto header_line = name + ": " + value;
    raw_headers = curl_slist_append(raw_headers, header_line.c_str());
  }
  request_headers.reset(raw_headers);
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
  response.status_code = static_cast<int>(status_code);

  curl_easy_cleanup(handle);
  response.raw_body = response_body;

  if (response_body.empty()) {
    response.body = nullptr;
    return response;
  }

  try {
    response.body = json::parse(response_body);
  } catch (const std::exception& exception) {
    (void)exception;
    response.body = response_body;
  }

  return response;
}

backend_registry::backend_registry(
    const std::vector<project::backend_definition>& definitions)
    : impl_(std::make_unique<impl>()) {
  for (const auto& definition : definitions) {
    impl_->adapters.emplace(
        definition.id, std::make_unique<http_backend>(definition));
  }
}

backend_registry::~backend_registry() = default;
backend_registry::backend_registry(backend_registry&&) noexcept = default;
backend_registry& backend_registry::operator=(backend_registry&&) noexcept =
    default;

std::expected<backend_response, std::string> backend_registry::perform(
    const backend_request& request) const {
  if (!impl_) {
    return std::unexpected("backend registry is not initialized");
  }
  const auto iterator = impl_->adapters.find(request.backend_id);
  if (iterator == impl_->adapters.end()) {
    return std::unexpected("unknown backend: " + request.backend_id);
  }
  return iterator->second->perform(request);
}

}  // namespace terva::core::backend

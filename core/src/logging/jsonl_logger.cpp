#include "terva/core/logging/jsonl_logger.hpp"

#include <chrono>
#include <ctime>
#include <filesystem>
#include <iomanip>
#include <iostream>
#include <ostream>
#include <sstream>

namespace terva::core::logging {
namespace {

[[nodiscard]] std::string utc_timestamp_now() {
  const auto now = std::chrono::system_clock::now();
  const auto seconds =
      std::chrono::time_point_cast<std::chrono::seconds>(now);
  const auto millis =
      std::chrono::duration_cast<std::chrono::milliseconds>(now - seconds).count();

  const auto time_value = std::chrono::system_clock::to_time_t(now);
  std::tm utc_time{};
  gmtime_r(&time_value, &utc_time);

  std::ostringstream output;
  output << std::put_time(&utc_time, "%FT%T") << '.'
         << std::setw(3) << std::setfill('0') << millis << 'Z';
  return output.str();
}

}  // namespace

struct jsonl_logger::impl final {
  explicit impl(project::logging_options options_value, event_callback callback_value)
      : options(std::move(options_value)), callback(std::move(callback_value)) {
    if (options.file_path.has_value()) {
      std::filesystem::create_directories(options.file_path->parent_path());
      file.emplace(*options.file_path, std::ios::app);
    }
  }

  project::logging_options options;
  event_callback callback;
  mutable std::mutex mutex;
  mutable std::optional<std::ofstream> file;
};

jsonl_logger::jsonl_logger(project::logging_options options, event_callback callback)
    : impl_(std::make_unique<impl>(std::move(options), std::move(callback))) {}

jsonl_logger::~jsonl_logger() = default;
jsonl_logger::jsonl_logger(jsonl_logger&&) noexcept = default;
jsonl_logger& jsonl_logger::operator=(jsonl_logger&&) noexcept = default;

void jsonl_logger::emit(const std::string_view event_name, json payload) const {
  if (!impl_) {
    return;
  }

  if (!payload.is_object()) {
    payload = json{{"payload", std::move(payload)}};
  }

  payload["timestamp"] = utc_timestamp_now();
  payload["event"] = event_name;

  if (impl_->callback) {
    impl_->callback(payload);
  }

  const auto rendered = payload.dump();

  const std::scoped_lock lock(impl_->mutex);

  if (impl_->options.sink == "stderr" || !impl_->file.has_value()) {
    std::cerr << rendered << '\n';
    std::cerr.flush();
    return;
  }

  if (impl_->file->is_open()) {
    *impl_->file << rendered << '\n';
    impl_->file->flush();
  }
}

}  // namespace terva::core::logging

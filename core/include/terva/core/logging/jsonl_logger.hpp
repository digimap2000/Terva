#pragma once

#include "terva/core/json.hpp"
#include "terva/core/project/model.hpp"

#include <filesystem>
#include <fstream>
#include <memory>
#include <mutex>
#include <string_view>

namespace terva::core::logging {

class jsonl_logger final {
 public:
  explicit jsonl_logger(project::logging_options options);
  ~jsonl_logger();

  jsonl_logger(const jsonl_logger&) = delete;
  jsonl_logger& operator=(const jsonl_logger&) = delete;
  jsonl_logger(jsonl_logger&&) noexcept;
  jsonl_logger& operator=(jsonl_logger&&) noexcept;

  void emit(std::string_view event_name, json payload) const;

 private:
  struct impl;
  std::unique_ptr<impl> impl_;
};

using shared_logger = std::shared_ptr<jsonl_logger>;

}  // namespace terva::core::logging


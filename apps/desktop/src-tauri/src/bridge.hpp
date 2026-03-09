#pragma once

#include "rust/cxx.h"
#include "terva/core/engine/engine.hpp"

#include <memory>

class DesktopCore final {
 public:
  DesktopCore();
  ~DesktopCore();

  DesktopCore(const DesktopCore&) = delete;
  DesktopCore& operator=(const DesktopCore&) = delete;

  rust::String open_document(rust::Str path);
  rust::String close_document();
  rust::String generate_project_name();
  rust::String update_project_metadata(rust::Str metadata_json);
  rust::String update_endpoint_command(rust::Str update_json);

  rust::String summarize_document(rust::Str path) const;

  rust::String start_runtime();
  rust::String stop_runtime();
  rust::String drain_events();

 private:
  terva::core::engine::engine engine_;
};

std::unique_ptr<DesktopCore> new_desktop_core();

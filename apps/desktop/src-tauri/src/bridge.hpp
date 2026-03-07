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
  rust::String load_document_contents(rust::Str source_path, rust::Str contents);
  rust::String update_document_contents(rust::Str contents);
  rust::String close_document();

  rust::String summarize_document(rust::Str path) const;
  rust::String validate_active_document() const;
  rust::String inspect_active_document() const;

  rust::String start_runtime();
  rust::String stop_runtime();
  rust::String list_tools();
  rust::String invoke_tool(rust::Str tool_name, rust::Str input_json);
  rust::String drain_events();

 private:
  terva::core::engine::engine engine_;
};

std::unique_ptr<DesktopCore> new_desktop_core();

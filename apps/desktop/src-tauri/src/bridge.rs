#![allow(dead_code)]

#[cxx::bridge]
pub mod ffi {
    unsafe extern "C++" {
        include!("bridge.hpp");

        type DesktopCore;

        fn new_desktop_core() -> UniquePtr<DesktopCore>;

        fn open_document(self: Pin<&mut DesktopCore>, path: &str) -> String;
        fn load_document_contents(
            self: Pin<&mut DesktopCore>,
            source_path: &str,
            contents: &str,
        ) -> String;
        fn update_document_contents(self: Pin<&mut DesktopCore>, contents: &str) -> String;
        fn update_project_metadata(self: Pin<&mut DesktopCore>, metadata_json: &str) -> String;
        fn close_document(self: Pin<&mut DesktopCore>) -> String;

        fn summarize_document(self: &DesktopCore, path: &str) -> String;
        fn validate_active_document(self: &DesktopCore) -> String;
        fn inspect_active_document(self: &DesktopCore) -> String;

        fn start_runtime(self: Pin<&mut DesktopCore>) -> String;
        fn stop_runtime(self: Pin<&mut DesktopCore>) -> String;
        fn list_tools(self: Pin<&mut DesktopCore>) -> String;
        fn invoke_tool(
            self: Pin<&mut DesktopCore>,
            tool_name: &str,
            input_json: &str,
        ) -> String;
        fn drain_events(self: Pin<&mut DesktopCore>) -> String;
    }
}

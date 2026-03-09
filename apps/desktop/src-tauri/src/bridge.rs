#![allow(dead_code)]

#[cxx::bridge]
pub mod ffi {
    unsafe extern "C++" {
        include!("bridge.hpp");

        type DesktopCore;

        fn new_desktop_core() -> UniquePtr<DesktopCore>;

        fn open_document(self: Pin<&mut DesktopCore>, path: &str) -> String;
        fn close_document(self: Pin<&mut DesktopCore>) -> String;
        fn generate_project_name(self: Pin<&mut DesktopCore>) -> String;
        fn update_project_metadata(self: Pin<&mut DesktopCore>, metadata_json: &str) -> String;
        fn update_endpoint_command(self: Pin<&mut DesktopCore>, update_json: &str) -> String;

        fn summarize_document(self: &DesktopCore, path: &str) -> String;

        fn start_runtime(self: Pin<&mut DesktopCore>) -> String;
        fn stop_runtime(self: Pin<&mut DesktopCore>) -> String;
        fn drain_events(self: Pin<&mut DesktopCore>) -> String;
    }
}

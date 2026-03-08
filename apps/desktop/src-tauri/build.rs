use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

fn repo_root() -> PathBuf {
    PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing manifest dir"))
        .join("../..")
        .join("..")
}

fn generate_proto(repo_root: &Path, out_dir: &Path) -> PathBuf {
    let generated_dir = out_dir.join("generated-proto");
    let proto_file = repo_root.join("proto/terva/project/v1/project.proto");
    std::fs::create_dir_all(&generated_dir).expect("failed to create proto output dir");

    let status = Command::new("protoc")
        .arg(format!(
            "--proto_path={}",
            repo_root.join("proto").display()
        ))
        .arg(format!("--cpp_out={}", generated_dir.display()))
        .arg(&proto_file)
        .status()
        .expect("failed to run protoc");
    if !status.success() {
        panic!("protoc failed for {}", proto_file.display());
    }

    generated_dir
}

fn add_pkg_config_include_paths(build: &mut cc::Build, package: &str) {
    if let Ok(library) = pkg_config::Config::new().probe(package) {
        for include in library.include_paths {
            build.include(include);
        }
    }
}

fn main() {
    let repo_root = repo_root()
        .canonicalize()
        .expect("failed to resolve repo root");
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("missing OUT_DIR"));
    let generated_proto_dir = generate_proto(&repo_root, &out_dir);
    let version_define = format!("\"{}\"", env::var("CARGO_PKG_VERSION").unwrap());

    let mut build = cxx_build::bridge("src/bridge.rs");
    add_pkg_config_include_paths(&mut build, "libcurl");
    add_pkg_config_include_paths(&mut build, "protobuf");
    build
        .file("src/bridge.cc")
        .file(repo_root.join("core/src/backend/http_backend.cpp"))
        .file(repo_root.join("core/src/capability/executor.cpp"))
        .file(repo_root.join("core/src/engine/engine.cpp"))
        .file(repo_root.join("core/src/logging/jsonl_logger.cpp"))
        .file(repo_root.join("core/src/mcp/runtime.cpp"))
        .file(repo_root.join("core/src/project/parser.cpp"))
        .file(repo_root.join("core/src/project/validator.cpp"))
        .file(repo_root.join("core/src/version.cpp"))
        .file(generated_proto_dir.join("terva/project/v1/project.pb.cc"))
        .include("src")
        .include("/opt/homebrew/include")
        .include("/usr/local/include")
        .include("/opt/dts/include")
        .include(repo_root.join("core/include"))
        .include(&generated_proto_dir)
        .define("TERVA_VERSION", Some(version_define.as_str()))
        .flag_if_supported("-mmacosx-version-min=11.0")
        .flag_if_supported("-Wno-deprecated-declarations")
        .flag_if_supported("-std=c++23")
        .compile("terva_desktop_core");

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/bridge.rs");
    println!("cargo:rerun-if-changed=src/bridge.cc");
    println!("cargo:rerun-if-changed=src/bridge.hpp");
    println!(
        "cargo:rerun-if-changed={}",
        repo_root
            .join("apps/desktop/src/assets/app-icon-golden.svg")
            .display()
    );
    for relative in [
        "apps/desktop/src-tauri/icons/32x32.png",
        "apps/desktop/src-tauri/icons/128x128.png",
        "apps/desktop/src-tauri/icons/128x128@2x.png",
        "apps/desktop/src-tauri/icons/icon.icns",
        "apps/desktop/src-tauri/icons/icon.ico",
        "apps/desktop/src-tauri/tauri.conf.json",
    ] {
        println!("cargo:rerun-if-changed={}", repo_root.join(relative).display());
    }
    println!(
        "cargo:rerun-if-changed={}",
        repo_root
            .join("proto/terva/project/v1/project.proto")
            .display()
    );
    for relative in [
        "core/include/terva/core/backend/backend.hpp",
        "core/include/terva/core/capability/executor.hpp",
        "core/include/terva/core/engine/engine.hpp",
        "core/include/terva/core/logging/jsonl_logger.hpp",
        "core/include/terva/core/project/model.hpp",
        "core/include/terva/core/project/parser.hpp",
        "core/include/terva/core/project/validator.hpp",
        "core/include/terva/core/version.hpp",
        "core/src/backend/http_backend.cpp",
        "core/src/capability/executor.cpp",
        "core/src/engine/engine.cpp",
        "core/src/logging/jsonl_logger.cpp",
        "core/src/project/parser.cpp",
        "core/src/project/validator.cpp",
        "core/src/version.cpp",
    ] {
        println!(
            "cargo:rerun-if-changed={}",
            repo_root.join(relative).display()
        );
    }

    println!("cargo:rustc-link-arg=-mmacosx-version-min=11.0");
    println!("cargo:rustc-link-search=native=/opt/dts/lib");
    println!("cargo:rustc-link-search=native=/opt/homebrew/lib");
    println!("cargo:rustc-link-lib=static=dts");
    println!("cargo:rustc-link-lib=dylib=fmt");
    println!("cargo:rustc-link-lib=dylib=yaml-cpp");
    println!("cargo:rustc-link-lib=dylib=vterm");
    println!("cargo:rustc-link-lib=framework=IOKit");
    println!("cargo:rustc-link-lib=framework=CoreFoundation");
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=CoreWLAN");

    tauri_build::build()
}

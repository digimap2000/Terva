cmake_minimum_required(VERSION 3.24)

project(
  Terva
  VERSION 0.1.0
  DESCRIPTION "Core-first MCP runtime with a shared C++ core, CLI, and Tauri shell"
  LANGUAGES CXX
)

list(PREPEND CMAKE_PREFIX_PATH
  "/opt/homebrew"
  "/opt/dts"
  "/opt/dts/lib/cmake"
  "/opt/dts/lib/cmake/dts"
)

find_package(dts CONFIG REQUIRED)
find_package(CURL REQUIRED)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(TERVA_BUILD_SERVER "Build the Terva MCP server" ON)
option(TERVA_BUILD_CLI "Build the Terva CLI client" ON)
option(TERVA_BUILD_EXAMPLES "Build example backends and demo assets" ON)

add_subdirectory(core)

if(TERVA_BUILD_SERVER)
  add_subdirectory(apps/server)
endif()

if(TERVA_BUILD_CLI)
  add_subdirectory(apps/cli)
endif()

if(TERVA_BUILD_EXAMPLES)
  add_subdirectory(apps/example-backend)
endif()

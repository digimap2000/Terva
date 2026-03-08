cmake_minimum_required(VERSION 3.24)

project(
  Terva
  VERSION 1.0.2
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
find_package(Protobuf CONFIG QUIET)
if(NOT Protobuf_FOUND)
  find_package(Protobuf REQUIRED)
endif()

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(APPLE AND NOT DEFINED CMAKE_OSX_DEPLOYMENT_TARGET)
  set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS deployment target")
endif()

option(TERVA_BUILD_CLI "Build the Terva CLI host" ON)
option(TERVA_BUILD_EXAMPLES "Build example backends and demo assets" ON)

add_library(terva_protobuf INTERFACE)
add_library(terva::protobuf ALIAS terva_protobuf)

if(TARGET protobuf::libprotobuf)
  target_link_libraries(terva_protobuf INTERFACE protobuf::libprotobuf)
elseif(TARGET protobuf::protobuf)
  target_link_libraries(terva_protobuf INTERFACE protobuf::protobuf)
elseif(DEFINED Protobuf_LIBRARIES AND DEFINED Protobuf_INCLUDE_DIRS)
  target_include_directories(terva_protobuf INTERFACE ${Protobuf_INCLUDE_DIRS})
  target_link_libraries(terva_protobuf INTERFACE ${Protobuf_LIBRARIES})
else()
  message(FATAL_ERROR "Protobuf was found, but no supported libprotobuf target is available")
endif()

add_subdirectory(proto)
add_subdirectory(core)

if(TERVA_BUILD_CLI)
  add_subdirectory(apps/cli)
endif()

if(TERVA_BUILD_EXAMPLES)
  add_subdirectory(apps/example-backend)
endif()

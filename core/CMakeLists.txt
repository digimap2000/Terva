add_library(terva_core STATIC
  src/backend/http_backend.cpp
  src/capability/executor.cpp
  src/client/http_session.cpp
  src/client/stdio_session.cpp
  src/logging/jsonl_logger.cpp
  src/mcp/runtime.cpp
  src/project/parser.cpp
  src/project/validator.cpp
  src/version.cpp
)

target_include_directories(terva_core
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_features(terva_core PUBLIC cxx_std_23)

target_compile_definitions(terva_core
  PUBLIC
    TERVA_VERSION="${PROJECT_VERSION}"
)

target_link_libraries(terva_core
  PUBLIC
    dts::dts
  PRIVATE
    CURL::libcurl
    terva::protobuf
    terva::project_proto
)

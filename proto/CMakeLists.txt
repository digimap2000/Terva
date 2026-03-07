set(TERVA_PROJECT_PROTO_FILE
  ${CMAKE_CURRENT_SOURCE_DIR}/terva/project/v1/project.proto
)

set(TERVA_PROTO_GENERATED_DIR ${CMAKE_CURRENT_BINARY_DIR}/generated)
set(TERVA_PROJECT_PROTO_CC
  ${TERVA_PROTO_GENERATED_DIR}/terva/project/v1/project.pb.cc
)
set(TERVA_PROJECT_PROTO_H
  ${TERVA_PROTO_GENERATED_DIR}/terva/project/v1/project.pb.h
)

if(TARGET protobuf::protoc)
  set(TERVA_PROTOC_EXECUTABLE $<TARGET_FILE:protobuf::protoc>)
elseif(DEFINED Protobuf_PROTOC_EXECUTABLE AND NOT Protobuf_PROTOC_EXECUTABLE STREQUAL "")
  set(TERVA_PROTOC_EXECUTABLE ${Protobuf_PROTOC_EXECUTABLE})
else()
  find_program(TERVA_PROTOC_EXECUTABLE NAMES protoc REQUIRED)
endif()

add_custom_command(
  OUTPUT
    ${TERVA_PROJECT_PROTO_CC}
    ${TERVA_PROJECT_PROTO_H}
  COMMAND ${CMAKE_COMMAND} -E make_directory ${TERVA_PROTO_GENERATED_DIR}
  COMMAND
    ${TERVA_PROTOC_EXECUTABLE}
    --proto_path=${CMAKE_CURRENT_SOURCE_DIR}
    --cpp_out=${TERVA_PROTO_GENERATED_DIR}
    ${TERVA_PROJECT_PROTO_FILE}
  DEPENDS
    ${TERVA_PROJECT_PROTO_FILE}
  COMMENT "Generating Terva project protobuf sources"
  VERBATIM
)

add_library(terva_project_proto STATIC
  ${TERVA_PROJECT_PROTO_CC}
)

add_library(terva::project_proto ALIAS terva_project_proto)

target_include_directories(terva_project_proto
  PUBLIC
    ${TERVA_PROTO_GENERATED_DIR}
)

target_link_libraries(terva_project_proto
  PUBLIC
    terva::protobuf
)

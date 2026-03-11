add_executable(terva-client
  src/main.cpp
)

target_link_libraries(terva-client
  PRIVATE
    terva_core
)

target_compile_features(terva-client PRIVATE cxx_std_23)

add_dependencies(terva-client terva_core)

add_test(
  NAME terva_demo_volume_validate
  COMMAND terva-client validate ${PROJECT_SOURCE_DIR}/examples/demo-volume.terva
)

add_test(
  NAME terva_demo_volume_tools
  COMMAND terva-client tools ${PROJECT_SOURCE_DIR}/examples/demo-volume.terva
)

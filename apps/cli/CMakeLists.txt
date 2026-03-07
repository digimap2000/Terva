add_executable(terva-client
  src/main.cpp
)

target_link_libraries(terva-client
  PRIVATE
    terva_core
)

target_compile_features(terva-client PRIVATE cxx_std_23)

add_dependencies(terva-client terva_core)


add_executable(terva-server
  src/main.cpp
)

target_link_libraries(terva-server
  PRIVATE
    terva_core
)

target_compile_features(terva-server PRIVATE cxx_std_23)


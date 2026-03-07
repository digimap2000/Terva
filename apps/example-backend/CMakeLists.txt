add_executable(terva-example-backend
  src/main.cpp
)

target_link_libraries(terva-example-backend
  PRIVATE
    terva_core
)

target_compile_features(terva-example-backend PRIVATE cxx_std_23)


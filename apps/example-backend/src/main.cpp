#include "terva/core/json.hpp"

#include <dts/http.hpp>

#include <atomic>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <mutex>
#include <thread>

namespace {

struct device_state final {
  bool authenticated{false};
  int runlevel{1};
  int volume{20};
  std::mutex mutex;
};

std::atomic_bool g_running{true};

void handle_signal(int) {
  g_running.store(false);
}

[[nodiscard]] terva::core::json parse_json_body(const dts::http::request& request) {
  if (request.body.empty()) {
    return terva::core::json::object();
  }
  return terva::core::json::parse(request.body);
}

}  // namespace

int main() {
  std::signal(SIGINT, handle_signal);
  std::signal(SIGTERM, handle_signal);

  device_state state;

  dts::http::server server({
      .bind_address = "127.0.0.1",
      .port = 18080,
      .log_tag = "terva-demo-http",
  });

  server.add_route(dts::http::method::get, "/api/session",
                   [&](const dts::http::request&) {
                     const std::scoped_lock lock(state.mutex);
                     return dts::http::response::json(
                         dts::http::status::ok,
                         terva::core::json{
                             {"authenticated", state.authenticated},
                         }.dump());
                   });

  server.add_route(dts::http::method::post, "/api/login",
                   [&](const dts::http::request&) {
                     const std::scoped_lock lock(state.mutex);
                     state.authenticated = true;
                     return dts::http::response::json(
                         dts::http::status::ok,
                         terva::core::json{
                             {"authenticated", state.authenticated},
                             {"status", "logged_in"},
                         }.dump());
                   });

  server.add_route(dts::http::method::get, "/api/runlevel",
                   [&](const dts::http::request&) {
                     const std::scoped_lock lock(state.mutex);
                     return dts::http::response::json(
                         dts::http::status::ok,
                         terva::core::json{
                             {"runlevel", state.runlevel},
                         }.dump());
                   });

  server.add_route(dts::http::method::post, "/api/runlevel",
                   [&](const dts::http::request& request) {
                     const auto body = parse_json_body(request);
                     if (!body.contains("value") || !body["value"].is_number_integer()) {
                       return dts::http::response::json(
                           dts::http::status::bad_request,
                           terva::core::json{
                               {"error", "value must be an integer"},
                           }.dump());
                     }
                     const std::scoped_lock lock(state.mutex);
                     state.runlevel = body["value"].get<int>();
                     return dts::http::response::json(
                         dts::http::status::ok,
                         terva::core::json{
                             {"runlevel", state.runlevel},
                             {"status", "updated"},
                         }.dump());
                   });

  server.add_route(dts::http::method::post, "/api/audio/volume",
                   [&](const dts::http::request& request) {
                     const auto body = parse_json_body(request);
                     if (!body.contains("vol") || !body["vol"].is_number_integer()) {
                       return dts::http::response::json(
                           dts::http::status::bad_request,
                           terva::core::json{
                               {"error", "vol must be an integer"},
                           }.dump());
                     }

                     const std::scoped_lock lock(state.mutex);
                     if (!state.authenticated) {
                       return dts::http::response::json(
                           dts::http::status::forbidden,
                           terva::core::json{
                               {"error", "not authenticated"},
                           }.dump());
                     }
                     if (state.runlevel != 3) {
                       return dts::http::response::json(
                           dts::http::status::unprocessable_entity,
                           terva::core::json{
                               {"error", "runlevel must be 3"},
                           }.dump());
                     }

                     state.volume = body["vol"].get<int>();
                     return dts::http::response::json(
                         dts::http::status::ok,
                         terva::core::json{
                             {"status", "updated"},
                             {"volume", state.volume},
                         }.dump());
                   });

  server.add_route(dts::http::method::get, "/api/audio/state",
                   [&](const dts::http::request&) {
                     const std::scoped_lock lock(state.mutex);
                     return dts::http::response::json(
                         dts::http::status::ok,
                         terva::core::json{
                             {"authenticated", state.authenticated},
                             {"runlevel", state.runlevel},
                             {"volume", state.volume},
                         }.dump());
                   });

  server.start();
  const auto endpoint = server.local_endpoint();
  std::cerr << "terva-example-backend listening on " << endpoint.address << ':'
            << endpoint.port << '\n';

  while (g_running.load()) {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
  }

  server.stop();
  return 0;
}


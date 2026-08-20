mod phone_bridge;
mod route;
mod route_types;

use phone_bridge::{get_phone_link_info, start_phone_bridge};
use route::{fetch_flight_route, lookup_airport};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                start_phone_bridge().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_flight_route,
            lookup_airport,
            get_phone_link_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod bindings;
mod commands;
mod state;

use state::AppState;
use tauri::Manager;

/// # Panics
///
/// Si le runtime Tauri ne parvient pas à démarrer : l'application ne peut rien faire d'autre.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let frames_directory = app.path().app_data_dir()?.join("frames");
            app.manage(AppState::new(frames_directory));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(bindings::builder().invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

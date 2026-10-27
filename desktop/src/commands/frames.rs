use std::path::PathBuf;

use qfilm_core::PhotoError;
use tauri::State;

use crate::state::{AppState, FrameCatalog, poisoned};

#[tauri::command]
#[specta::specta]
pub fn list_frames(state: State<'_, AppState>) -> Result<FrameCatalog, PhotoError> {
    state.catalog()
}

#[tauri::command]
#[specta::specta]
pub fn reload_frames(state: State<'_, AppState>) -> Result<FrameCatalog, PhotoError> {
    state.reload_frames();
    state.catalog()
}

#[tauri::command]
#[specta::specta]
pub fn import_frame(path: String, state: State<'_, AppState>) -> Result<FrameCatalog, PhotoError> {
    let frame = state.user_frames.import(&PathBuf::from(path))?;
    state
        .frames
        .write()
        .map_err(|_| poisoned())?
        .add_user(frame)?;
    state.catalog()
}

#[tauri::command]
#[specta::specta]
pub fn remove_frame(id: String, state: State<'_, AppState>) -> Result<FrameCatalog, PhotoError> {
    state
        .frames
        .write()
        .map_err(|_| poisoned())?
        .remove_user(&id)?;
    state.user_frames.remove(&id)?;
    state.catalog()
}

#[tauri::command]
#[specta::specta]
pub fn open_frames_folder(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), PhotoError> {
    use tauri_plugin_opener::OpenerExt;

    state.user_frames.ensure_directory()?;
    app.opener()
        .open_path(
            state.user_frames.directory().display().to_string(),
            None::<&str>,
        )
        .map_err(|error| PhotoError::Task(error.to_string()))
}

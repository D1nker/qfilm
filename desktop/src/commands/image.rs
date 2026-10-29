use std::path::PathBuf;
use std::sync::atomic::Ordering;

use qfilm_core::preset::Preset;
use qfilm_core::{PhotoError, decode, encode, preset, render};
use rayon::prelude::*;
use serde::Serialize;
use tauri::State;

use super::{
    DRAFT_MAX_EDGE, PREVIEW_JPEG_QUALITY, PREVIEW_MAX_EDGE, THUMB_JPEG_QUALITY, THUMB_MAX_EDGE,
};
use crate::state::{AppState, LoadedImage};

#[derive(Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImageMeta {
    pub id: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub preview: String,
}

#[derive(Serialize, specta::Type)]
pub struct PresetThumbnail {
    pub id: String,
    pub image: String,
}

#[tauri::command]
#[specta::specta]
pub fn list_presets() -> Vec<Preset> {
    preset::builtin().to_vec()
}

#[tauri::command]
#[specta::specta]
pub fn supported_extensions() -> Vec<String> {
    decode::supported_extensions()
        .into_iter()
        .map(str::to_string)
        .collect()
}

#[tauri::command]
#[specta::specta]
pub async fn open_image(path: String, state: State<'_, AppState>) -> Result<ImageMeta, PhotoError> {
    let path = PathBuf::from(path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("sans titre")
        .to_string();

    let decoded = decode::decode_file(&path)?;
    let full = decoded.image;
    let proxy = full.downscale_to_fit(PREVIEW_MAX_EDGE);
    let thumb = proxy.downscale_to_fit(THUMB_MAX_EDGE);
    let draft = proxy.downscale_to_fit(DRAFT_MAX_EDGE);
    let preview = encode::to_data_url(&proxy, PREVIEW_JPEG_QUALITY)?;

    let id = format!("img-{}", state.next_id.fetch_add(1, Ordering::Relaxed));
    let meta = ImageMeta {
        id: id.clone(),
        file_name,
        width: full.width,
        height: full.height,
        preview,
    };

    state
        .images
        .lock()
        .map_err(|_| PhotoError::ImageNotLoaded)?
        .insert(
            id,
            LoadedImage {
                full,
                proxy,
                thumb,
                draft,
                metadata: decoded.metadata,
                cached: None,
                draft_cached: None,
            },
        );

    Ok(meta)
}

#[tauri::command]
#[specta::specta]
pub fn close_image(id: String, state: State<'_, AppState>) -> Result<(), PhotoError> {
    state
        .images
        .lock()
        .map_err(|_| PhotoError::ImageNotLoaded)?
        .remove(&id);
    Ok(())
}

/// Calculé sur un thread dédié : ne doit jamais retarder le rendu de l'aperçu.
#[tauri::command]
#[specta::specta]
pub async fn preset_thumbnails(
    id: String,
    state: State<'_, AppState>,
) -> Result<Vec<PresetThumbnail>, PhotoError> {
    let thumb = state.thumbnail(&id)?;

    tauri::async_runtime::spawn_blocking(move || {
        preset::builtin()
            .par_iter()
            .map(|preset| {
                let rendered = render::apply(&thumb, &preset.params);
                Ok(PresetThumbnail {
                    id: preset.id.clone(),
                    image: encode::to_data_url(&rendered, THUMB_JPEG_QUALITY)?,
                })
            })
            .collect()
    })
    .await
    .map_err(|error| PhotoError::Task(error.to_string()))?
}

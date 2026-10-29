use std::sync::Arc;

use qfilm_core::frame::{FrameSelection, TextZone};
use qfilm_core::render::RenderParams;
use qfilm_core::{PhotoError, encode, render};
use rayon::prelude::*;
use serde::Serialize;
use tauri::State;

use super::{DRAFT_JPEG_QUALITY, PREVIEW_JPEG_QUALITY, THUMB_JPEG_QUALITY};
use crate::state::{AppState, LoadedImage, poisoned};

#[derive(Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResult {
    pub image: String,
    pub width: u32,
    pub height: u32,
    pub zones: Vec<TextZone>,
    pub caption_center: [f32; 2],
}

#[tauri::command]
#[specta::specta]
pub async fn frame_thumbnails(
    id: String,
    params: RenderParams,
    frames: Vec<FrameSelection>,
    state: State<'_, AppState>,
) -> Result<Vec<String>, PhotoError> {
    let thumb = state.thumbnail(&id)?;
    let registry = Arc::clone(&state.frames);

    tauri::async_runtime::spawn_blocking(move || {
        let registry = registry.read().map_err(|_| poisoned())?;
        let rendered = render::apply(&thumb, &params);

        // Un cadre qui échoue donne une vignette vide : il ne doit pas priver les autres des leurs.
        Ok(frames
            .par_iter()
            .map(|selection| {
                registry
                    .render(&rendered, selection)
                    .ok()
                    .and_then(|output| encode::to_data_url(&output.image, THUMB_JPEG_QUALITY).ok())
                    .unwrap_or_default()
            })
            .collect())
    })
    .await
    .map_err(|error| PhotoError::Task(error.to_string()))?
}

#[tauri::command]
#[specta::specta]
pub async fn render_preview(
    id: String,
    params: RenderParams,
    frame: FrameSelection,
    draft: bool,
    state: State<'_, AppState>,
) -> Result<PreviewResult, PhotoError> {
    let (bordered, factor) = {
        let mut images = state
            .images
            .lock()
            .map_err(|_| PhotoError::ImageNotLoaded)?;
        let image = images.get_mut(&id).ok_or(PhotoError::ImageNotLoaded)?;

        let LoadedImage {
            proxy,
            draft: draft_proxy,
            cached,
            draft_cached,
            ..
        } = image;
        let (source, cache, factor) = if draft {
            (&*draft_proxy, draft_cached, proxy.scale_over(draft_proxy))
        } else {
            (&*proxy, cached, 1.0)
        };

        let needs_render = cache
            .as_ref()
            .is_none_or(|(cached_params, _)| *cached_params != params);

        if needs_render {
            let rendered = render::apply(source, &params);
            *cache = Some((params, rendered));
        }

        let (_, rendered) = cache.as_ref().expect("rendu mis en cache juste avant");

        // La légende n'est pas incrustée ici : le webview la dessine par-dessus
        // l'aperçu, ce qui la rend modifiable sans relancer de rendu.
        let bordered = state
            .frames
            .read()
            .map_err(|_| poisoned())?
            .render(rendered, &frame)?;
        (bordered, factor)
    };

    // Un brouillon annonce la taille et les zones du rendu final : l'affichage ne bouge pas.
    let (width, height) = bordered.size_at(factor);
    let quality = if draft {
        DRAFT_JPEG_QUALITY
    } else {
        PREVIEW_JPEG_QUALITY
    };

    Ok(PreviewResult {
        image: encode::to_data_url(&bordered.image, quality)?,
        width,
        height,
        zones: bordered.zones_at(factor),
        caption_center: [bordered.caption_center.0, bordered.caption_center.1],
    })
}

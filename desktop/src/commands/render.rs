use std::sync::Arc;

use qfilm_core::frame::{FrameSelection, TextZone};
use qfilm_core::geometry::{self, Geometry};
use qfilm_core::mask::Mask;
use qfilm_core::render::RenderParams;
use qfilm_core::{PhotoError, encode, render};
use rayon::prelude::*;
use serde::Serialize;
use tauri::State;

use super::{
    DRAFT_JPEG_QUALITY, DRAFT_MAX_EDGE, PREVIEW_JPEG_QUALITY, PREVIEW_MAX_EDGE, THUMB_JPEG_QUALITY,
};
use crate::state::{AppState, LoadedImage, Prepared, poisoned};

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
        // Les vignettes montrent la photo entière, sans cadrage : les masques, placés sur la photo
        // recadrée, n'y auraient pas de sens.
        let rendered = render::apply(&thumb, &params, &[]);

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
    geometry: Geometry,
    masks: Vec<Mask>,
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
            full,
            proxy,
            draft: draft_proxy,
            prepared,
            cached,
            draft_cached,
            ..
        } = image;

        // Sans cadrage, on rend l'aperçu tel quel ; sinon, la photo cadrée, refaite si le cadrage a changé.
        let framed = !geometry.is_identity();
        if framed && prepared.as_ref().is_none_or(|p| p.geometry != geometry) {
            let cropped = geometry::prepare(full, proxy, &geometry, PREVIEW_MAX_EDGE);
            let draft = cropped.downscale_to_fit(DRAFT_MAX_EDGE);
            *prepared = Some(Prepared {
                geometry,
                proxy: cropped,
                draft,
            });
        }
        let (full_size, draft_size) = match prepared.as_ref().filter(|_| framed) {
            Some(p) => (&p.proxy, &p.draft),
            None => (&*proxy, &*draft_proxy),
        };

        let (source, cache, factor) = if draft {
            (draft_size, draft_cached, full_size.scale_over(draft_size))
        } else {
            (full_size, cached, 1.0)
        };

        let key = (params, geometry, masks);
        let needs_render = cache
            .as_ref()
            .is_none_or(|(cached_key, _)| *cached_key != key);

        if needs_render {
            let rendered = render::apply(source, &key.0, &key.2);
            *cache = Some((key, rendered));
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

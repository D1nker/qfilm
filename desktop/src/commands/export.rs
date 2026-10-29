use std::path::PathBuf;

use qfilm_core::caption::Caption;
use qfilm_core::encode::ExportOptions;
use qfilm_core::frame::FrameSelection;
use qfilm_core::render::RenderParams;
use qfilm_core::{PhotoError, encode, render};
use tauri::State;

use crate::state::{AppState, poisoned};

#[tauri::command]
#[specta::specta]
pub async fn export_image(
    id: String,
    params: RenderParams,
    frame: FrameSelection,
    caption: Caption,
    destination: String,
    options: ExportOptions,
    state: State<'_, AppState>,
) -> Result<(), PhotoError> {
    let (rendered, metadata) = {
        let images = state
            .images
            .lock()
            .map_err(|_| PhotoError::ImageNotLoaded)?;
        let image = images.get(&id).ok_or(PhotoError::ImageNotLoaded)?;

        // Réduire avant le rendu : grain, halation et clarté coûtent par pixel.
        let rendered = match options.max_edge {
            Some(edge) if edge < image.full.width.max(image.full.height) => {
                render::apply(&image.full.downscale_to_fit(edge), &params)
            }
            _ => render::apply(&image.full, &params),
        };
        (rendered, image.metadata.clone())
    };

    let framed = state
        .frames
        .read()
        .map_err(|_| poisoned())?
        .render_with_caption(&rendered, &frame, &caption)?;

    encode::save_to_disk(
        &framed.image,
        &PathBuf::from(destination),
        options,
        &metadata,
    )
}

use std::path::PathBuf;

use qfilm_core::caption::Caption;
use qfilm_core::encode::ExportOptions;
use qfilm_core::frame::FrameSelection;
use qfilm_core::geometry::{self, Geometry};
use qfilm_core::render::RenderParams;
use qfilm_core::{PhotoError, encode, render};
use tauri::State;

use crate::state::{AppState, poisoned};

#[tauri::command]
#[specta::specta]
// Chaque argument est un champ du contrat avec l'interface : les regrouper ne ferait que le compliquer.
#[allow(clippy::too_many_arguments)]
pub async fn export_image(
    id: String,
    params: RenderParams,
    geometry: Geometry,
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

        // Le cadrage d'abord, depuis les pixels d'origine ; puis réduire avant le rendu :
        // grain, halation et clarté coûtent par pixel.
        let cropped = (!geometry.is_identity()).then(|| geometry::apply(&image.full, &geometry));
        let source = cropped.as_ref().unwrap_or(&image.full);
        let rendered = match options.max_edge {
            Some(edge) if edge < source.width.max(source.height) => {
                render::apply(&source.downscale_to_fit(edge), &params)
            }
            _ => render::apply(source, &params),
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

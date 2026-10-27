#![allow(clippy::needless_pass_by_value)] // `State` est un extracteur Tauri, pris par valeur.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};

use rayon::prelude::*;
use serde::Serialize;
use tauri::State;

use qfilm_core::buffer::ImageBuf;
use qfilm_core::caption::Caption;
use qfilm_core::encode::ExportOptions;
use qfilm_core::frame::{
    FrameInfo, FrameRegistry, FrameSelection, LoadIssue, TextZone, UserFrames,
};
use qfilm_core::preset::Preset;
use qfilm_core::render::RenderParams;
use qfilm_core::{PhotoError, decode, encode, preset, render};

const PREVIEW_MAX_EDGE: u32 = 1800;
const PREVIEW_JPEG_QUALITY: u8 = 88;

const THUMB_MAX_EDGE: u32 = 240;
const THUMB_JPEG_QUALITY: u8 = 80;

struct LoadedImage {
    full: ImageBuf,
    proxy: ImageBuf,
    thumb: ImageBuf,
    cached: Option<(RenderParams, ImageBuf)>,
}

pub struct AppState {
    images: Mutex<HashMap<String, LoadedImage>>,
    next_id: AtomicU64,
    frames: Arc<RwLock<FrameRegistry>>,
    user_frames: UserFrames,
    frame_issues: Mutex<Vec<LoadIssue>>,
}

impl AppState {
    pub fn new(frames_directory: PathBuf) -> Self {
        let state = Self {
            images: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(0),
            frames: Arc::new(RwLock::new(FrameRegistry::builtin())),
            user_frames: UserFrames::new(frames_directory),
            frame_issues: Mutex::new(Vec::new()),
        };
        let _ = state.user_frames.ensure_directory();
        state.reload_frames();
        state
    }

    fn reload_frames(&self) {
        let (frames, mut issues) = self.user_frames.load_all();

        if let Ok(mut registry) = self.frames.write() {
            registry.clear_user();
            for frame in frames {
                let folder = frame.manifest.id.clone();
                if let Err(error) = registry.add_user(frame) {
                    issues.push(LoadIssue {
                        folder,
                        message: error.to_string(),
                    });
                }
            }
        }
        if let Ok(mut stored) = self.frame_issues.lock() {
            *stored = issues;
        }
    }

    fn catalog(&self) -> Result<FrameCatalog, PhotoError> {
        let frames = self.frames.read().map_err(|_| poisoned())?.list();
        let issues = self.frame_issues.lock().map_err(|_| poisoned())?.clone();
        Ok(FrameCatalog {
            frames,
            issues,
            directory: self.user_frames.directory().display().to_string(),
        })
    }
}

fn poisoned() -> PhotoError {
    PhotoError::Task("état interne indisponible".into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMeta {
    pub id: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub preview: String,
}

#[tauri::command]
pub fn list_presets() -> Vec<Preset> {
    preset::builtin().to_vec()
}

#[tauri::command]
pub fn supported_extensions() -> Vec<&'static str> {
    decode::supported_extensions()
}

#[tauri::command]
pub async fn open_image(path: String, state: State<'_, AppState>) -> Result<ImageMeta, PhotoError> {
    let path = PathBuf::from(path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("sans titre")
        .to_string();

    let full = decode::decode_file(&path)?;
    let proxy = full.downscale_to_fit(PREVIEW_MAX_EDGE);
    let thumb = proxy.downscale_to_fit(THUMB_MAX_EDGE);
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
                cached: None,
            },
        );

    Ok(meta)
}

#[derive(Serialize)]
pub struct PresetThumbnail {
    pub id: &'static str,
    pub image: String,
}

/// Calculé sur un thread dédié : ne doit jamais retarder le rendu de l'aperçu.
#[tauri::command]
pub async fn preset_thumbnails(
    id: String,
    state: State<'_, AppState>,
) -> Result<Vec<PresetThumbnail>, PhotoError> {
    let thumb = {
        let images = state
            .images
            .lock()
            .map_err(|_| PhotoError::ImageNotLoaded)?;
        images
            .get(&id)
            .ok_or(PhotoError::ImageNotLoaded)?
            .thumb
            .clone()
    };

    tauri::async_runtime::spawn_blocking(move || {
        preset::builtin()
            .par_iter()
            .map(|preset| {
                let rendered = render::apply(&thumb, &preset.params);
                Ok(PresetThumbnail {
                    id: preset.id.as_str(),
                    image: encode::to_data_url(&rendered, THUMB_JPEG_QUALITY)?,
                })
            })
            .collect()
    })
    .await
    .map_err(|error| PhotoError::Task(error.to_string()))?
}

#[tauri::command]
pub async fn frame_thumbnails(
    id: String,
    params: RenderParams,
    frames: Vec<FrameSelection>,
    state: State<'_, AppState>,
) -> Result<Vec<String>, PhotoError> {
    let thumb = {
        let images = state
            .images
            .lock()
            .map_err(|_| PhotoError::ImageNotLoaded)?;
        images
            .get(&id)
            .ok_or(PhotoError::ImageNotLoaded)?
            .thumb
            .clone()
    };
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResult {
    pub image: String,
    pub width: u32,
    pub height: u32,
    pub zones: Vec<TextZone>,
    pub caption_center: [f32; 2],
}

#[tauri::command]
pub async fn render_preview(
    id: String,
    params: RenderParams,
    frame: FrameSelection,
    state: State<'_, AppState>,
) -> Result<PreviewResult, PhotoError> {
    let bordered = {
        let mut images = state
            .images
            .lock()
            .map_err(|_| PhotoError::ImageNotLoaded)?;
        let image = images.get_mut(&id).ok_or(PhotoError::ImageNotLoaded)?;

        let needs_render = image
            .cached
            .as_ref()
            .is_none_or(|(cached, _)| *cached != params);

        if needs_render {
            let rendered = render::apply(&image.proxy, &params);
            image.cached = Some((params, rendered));
        }

        let (_, rendered) = image
            .cached
            .as_ref()
            .expect("rendu mis en cache juste avant");

        // La légende n'est pas incrustée ici : le webview la dessine par-dessus
        // l'aperçu, ce qui la rend modifiable sans relancer de rendu.
        state
            .frames
            .read()
            .map_err(|_| poisoned())?
            .render(rendered, &frame)?
    };

    Ok(PreviewResult {
        image: encode::to_data_url(&bordered.image, PREVIEW_JPEG_QUALITY)?,
        width: bordered.image.width,
        height: bordered.image.height,
        zones: bordered.zones,
        caption_center: [bordered.caption_center.0, bordered.caption_center.1],
    })
}

#[tauri::command]
pub async fn export_image(
    id: String,
    params: RenderParams,
    frame: FrameSelection,
    caption: Caption,
    destination: String,
    options: ExportOptions,
    state: State<'_, AppState>,
) -> Result<(), PhotoError> {
    let rendered = {
        let images = state
            .images
            .lock()
            .map_err(|_| PhotoError::ImageNotLoaded)?;
        let image = images.get(&id).ok_or(PhotoError::ImageNotLoaded)?;

        // Réduire avant le rendu : grain, halation et clarté coûtent par pixel.
        match options.max_edge {
            Some(edge) if edge < image.full.width.max(image.full.height) => {
                render::apply(&image.full.downscale_to_fit(edge), &params)
            }
            _ => render::apply(&image.full, &params),
        }
    };

    let framed = state
        .frames
        .read()
        .map_err(|_| poisoned())?
        .render_with_caption(&rendered, &frame, &caption)?;

    encode::save_to_disk(&framed.image, &PathBuf::from(destination), options)
}

#[tauri::command]
pub fn close_image(id: &str, state: State<'_, AppState>) -> Result<(), PhotoError> {
    state
        .images
        .lock()
        .map_err(|_| PhotoError::ImageNotLoaded)?
        .remove(id);
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameCatalog {
    pub frames: Vec<FrameInfo>,
    pub issues: Vec<LoadIssue>,
    pub directory: String,
}

#[tauri::command]
pub fn list_frames(state: State<'_, AppState>) -> Result<FrameCatalog, PhotoError> {
    state.catalog()
}

#[tauri::command]
pub fn reload_frames(state: State<'_, AppState>) -> Result<FrameCatalog, PhotoError> {
    state.reload_frames();
    state.catalog()
}

#[tauri::command]
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
pub fn remove_frame(id: &str, state: State<'_, AppState>) -> Result<FrameCatalog, PhotoError> {
    state
        .frames
        .write()
        .map_err(|_| poisoned())?
        .remove_user(id)?;
    state.user_frames.remove(id)?;
    state.catalog()
}

#[tauri::command]
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

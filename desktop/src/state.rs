use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex, RwLock};

use qfilm_core::PhotoError;
use qfilm_core::buffer::ImageBuf;
use qfilm_core::decode::Metadata;
use qfilm_core::frame::{FrameInfo, FrameRegistry, LoadIssue, UserFrames};
use qfilm_core::render::RenderParams;
use serde::Serialize;

pub struct LoadedImage {
    pub full: ImageBuf,
    pub proxy: ImageBuf,
    pub thumb: ImageBuf,
    pub metadata: Metadata,
    pub cached: Option<(RenderParams, ImageBuf)>,
}

pub struct AppState {
    pub images: Mutex<HashMap<String, LoadedImage>>,
    pub next_id: AtomicU64,
    pub frames: Arc<RwLock<FrameRegistry>>,
    pub user_frames: UserFrames,
    frame_issues: Mutex<Vec<LoadIssue>>,
}

#[derive(Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FrameCatalog {
    pub frames: Vec<FrameInfo>,
    pub issues: Vec<LoadIssue>,
    pub directory: String,
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

    pub fn reload_frames(&self) {
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

    pub fn thumbnail(&self, id: &str) -> Result<ImageBuf, PhotoError> {
        let images = self.images.lock().map_err(|_| PhotoError::ImageNotLoaded)?;
        Ok(images
            .get(id)
            .ok_or(PhotoError::ImageNotLoaded)?
            .thumb
            .clone())
    }

    pub fn catalog(&self) -> Result<FrameCatalog, PhotoError> {
        let frames = self.frames.read().map_err(|_| poisoned())?.list();
        let issues = self.frame_issues.lock().map_err(|_| poisoned())?.clone();
        Ok(FrameCatalog {
            frames,
            issues,
            directory: self.user_frames.directory().display().to_string(),
        })
    }
}

pub fn poisoned() -> PhotoError {
    PhotoError::Task("état interne indisponible".into())
}

use std::path::Path;

use rayon::prelude::*;

use super::PhotoError;
use super::buffer::{ImageBuf, srgb_to_linear};

/// Point d'extension : le RAW sera un `Decoder` de plus, enregistré dans `decoders`.
pub trait Decoder: Send + Sync {
    fn supports(&self, extension: &str) -> bool;
    fn decode(&self, path: &Path) -> Result<ImageBuf, PhotoError>;
}

pub struct StandardDecoder;

impl Decoder for StandardDecoder {
    fn supports(&self, extension: &str) -> bool {
        matches!(extension, "jpg" | "jpeg" | "png" | "tif" | "tiff")
    }

    fn decode(&self, path: &Path) -> Result<ImageBuf, PhotoError> {
        let decoded = image::open(path)?;
        let rgb = decoded.to_rgb32f();
        let (width, height) = (rgb.width(), rgb.height());

        // `to_rgb32f` ne retire pas la gamma : on linéarise ici les valeurs sRGB.
        let mut data = rgb.into_raw();
        data.par_iter_mut().for_each(|c| *c = srgb_to_linear(*c));

        Ok(ImageBuf {
            width,
            height,
            data,
        })
    }
}

fn decoders() -> Vec<Box<dyn Decoder>> {
    vec![Box::new(StandardDecoder)]
}

pub fn decode_file(path: &Path) -> Result<ImageBuf, PhotoError> {
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();

    decoders()
        .iter()
        .find(|d| d.supports(&extension))
        .ok_or_else(|| PhotoError::UnsupportedFormat(extension.clone()))?
        .decode(path)
}

pub fn supported_extensions() -> Vec<&'static str> {
    vec!["jpg", "jpeg", "png", "tif", "tiff"]
}

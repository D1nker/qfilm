use std::fs::File;
use std::io::{BufWriter, Cursor};
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use image::codecs::jpeg::JpegEncoder;
use image::{ExtendedColorType, ImageEncoder, ImageError};
use rayon::prelude::*;
use serde::Deserialize;

use super::PhotoError;
use super::buffer::{ImageBuf, linear_to_srgb};

pub(crate) fn to_srgb8(img: &ImageBuf) -> Vec<u8> {
    img.data
        .par_iter()
        .map(|c| (linear_to_srgb(c.clamp(0.0, 1.0)) * 255.0).round() as u8)
        .collect()
}

pub fn to_data_url(img: &ImageBuf, quality: u8) -> Result<String, PhotoError> {
    let rgb = to_srgb8(img);
    let mut jpeg = Cursor::new(Vec::new());

    JpegEncoder::new_with_quality(&mut jpeg, quality).write_image(
        &rgb,
        img.width,
        img.height,
        ExtendedColorType::Rgb8,
    )?;

    Ok(format!(
        "data:image/jpeg;base64,{}",
        STANDARD.encode(jpeg.into_inner())
    ))
}

#[derive(Debug, Clone, Copy, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Jpeg,
    Png,
    /// 16 bits par canal : indispensable si l'image repart en retouche.
    Tiff,
}

impl ExportFormat {
    const fn extension(self) -> &'static str {
        match self {
            Self::Jpeg => "jpg",
            Self::Png => "png",
            Self::Tiff => "tiff",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub format: ExportFormat,
    /// 1..=100, ignoré hors JPEG.
    pub quality: u8,
    /// Plus grand côté en pixels ; `None` = taille d'origine.
    pub max_edge: Option<u32>,
}

pub fn save_to_disk(img: &ImageBuf, path: &Path, options: ExportOptions) -> Result<(), PhotoError> {
    let path = path.with_extension(options.format.extension());

    match options.format {
        ExportFormat::Jpeg => {
            let file = BufWriter::new(File::create(&path).map_err(ImageError::IoError)?);
            JpegEncoder::new_with_quality(file, options.quality.clamp(1, 100)).write_image(
                &to_srgb8(img),
                img.width,
                img.height,
                ExtendedColorType::Rgb8,
            )?;
        }
        ExportFormat::Png => {
            image::RgbImage::from_raw(img.width, img.height, to_srgb8(img))
                .expect("dimensions cohérentes avec le buffer")
                .save(&path)?;
        }
        ExportFormat::Tiff => {
            let raw: Vec<u16> = img
                .data
                .par_iter()
                .map(|c| (linear_to_srgb(c.clamp(0.0, 1.0)) * 65535.0).round() as u16)
                .collect();
            image::ImageBuffer::<image::Rgb<u16>, _>::from_raw(img.width, img.height, raw)
                .expect("dimensions cohérentes avec le buffer")
                .save(&path)?;
        }
    }

    Ok(())
}

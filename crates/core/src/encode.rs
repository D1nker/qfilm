use std::fs::File;
use std::io::{BufWriter, Cursor};
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::codecs::tiff::TiffEncoder;
use image::{ExtendedColorType, ImageEncoder, ImageError};
use rayon::prelude::*;
use serde::Deserialize;

use super::PhotoError;
use super::buffer::{ImageBuf, linear_to_srgb};
use super::color;
use super::decode::Metadata;

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
    /// Reporter l'EXIF de la photo d'origine (JPEG et PNG ; le TIFF n'en porte pas ici).
    #[serde(default = "keep_metadata_by_default")]
    pub keep_metadata: bool,
}

const fn keep_metadata_by_default() -> bool {
    true
}

pub fn save_to_disk(
    img: &ImageBuf,
    path: &Path,
    options: ExportOptions,
    metadata: &Metadata,
) -> Result<(), PhotoError> {
    let path = path.with_extension(options.format.extension());
    let file = BufWriter::new(File::create(&path).map_err(ImageError::IoError)?);
    let exif = metadata.exif.as_ref().filter(|_| options.keep_metadata);
    let profile = color::srgb_icc();

    match options.format {
        ExportFormat::Jpeg => {
            let mut encoder = JpegEncoder::new_with_quality(file, options.quality.clamp(1, 100));
            encoder
                .set_icc_profile(profile)
                .map_err(ImageError::Unsupported)?;
            if let Some(exif) = exif {
                encoder
                    .set_exif_metadata(exif.clone())
                    .map_err(ImageError::Unsupported)?;
            }
            encoder.write_image(
                &to_srgb8(img),
                img.width,
                img.height,
                ExtendedColorType::Rgb8,
            )?;
        }
        ExportFormat::Png => {
            let mut encoder = PngEncoder::new(file);
            encoder
                .set_icc_profile(profile)
                .map_err(ImageError::Unsupported)?;
            if let Some(exif) = exif {
                encoder
                    .set_exif_metadata(exif.clone())
                    .map_err(ImageError::Unsupported)?;
            }
            encoder.write_image(
                &to_srgb8(img),
                img.width,
                img.height,
                ExtendedColorType::Rgb8,
            )?;
        }
        ExportFormat::Tiff => {
            let samples: Vec<u8> = img
                .data
                .par_iter()
                .flat_map_iter(|c| {
                    let value = (linear_to_srgb(c.clamp(0.0, 1.0)) * 65535.0).round() as u16;
                    value.to_ne_bytes()
                })
                .collect();
            let mut encoder = TiffEncoder::new(file);
            encoder
                .set_icc_profile(profile)
                .map_err(ImageError::Unsupported)?;
            encoder.write_image(&samples, img.width, img.height, ExtendedColorType::Rgb16)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use image::metadata::Orientation;
    use image::{ImageDecoder, ImageReader};
    use moxcms::ColorProfile;

    use super::*;
    use crate::decode::decode_file;
    use crate::fixtures::{MAKE, TempDir, exif_with_orientation, red_blue, write_jpeg};

    fn options(format: ExportFormat, keep_metadata: bool) -> ExportOptions {
        ExportOptions {
            format,
            quality: 100,
            max_edge: None,
            keep_metadata,
        }
    }

    fn sideways_shot(dir: &TempDir) -> crate::decode::Decoded {
        let path = dir.path("source.jpg");
        write_jpeg(
            &path,
            16,
            8,
            &red_blue(16, 8),
            Some(exif_with_orientation(6)),
        );
        decode_file(&path).expect("photo lisible")
    }

    fn exported_exif(path: &Path) -> Option<Vec<u8>> {
        ImageReader::open(path)
            .unwrap()
            .into_decoder()
            .unwrap()
            .exif_metadata()
            .unwrap()
    }

    fn exported_profile(path: &Path) -> Option<Vec<u8>> {
        ImageReader::open(path)
            .unwrap()
            .into_decoder()
            .unwrap()
            .icc_profile()
            .unwrap()
    }

    #[test]
    fn every_format_embeds_an_srgb_profile() {
        let dir = TempDir::new("embed-icc");
        // Assez grand : `image` ne relit pas le profil d'un TIFF de quelques dizaines d'octets.
        let mut image = ImageBuf::new(256, 256);
        image.data.fill(0.2);
        let metadata = crate::decode::Metadata::default();

        for (format, file) in [
            (ExportFormat::Jpeg, "out.jpg"),
            (ExportFormat::Png, "out.png"),
            (ExportFormat::Tiff, "out.tiff"),
        ] {
            let target = dir.path(file);
            save_to_disk(&image, &target, options(format, true), &metadata).expect("export");

            let icc = exported_profile(&target).unwrap_or_else(|| panic!("{file} : pas de profil"));
            let profile = ColorProfile::new_from_slice(&icc).expect("profil lisible");
            assert_eq!(profile.color_space, moxcms::DataColorSpace::Rgb, "{file}");
        }
    }

    #[test]
    fn the_exif_follows_the_photo_with_its_rotation_already_applied() {
        let dir = TempDir::new("keep-exif");
        let decoded = sideways_shot(&dir);

        for (format, file) in [
            (ExportFormat::Jpeg, "out.jpg"),
            (ExportFormat::Png, "out.png"),
        ] {
            let target = dir.path(file);
            save_to_disk(
                &decoded.image,
                &target,
                options(format, true),
                &decoded.metadata,
            )
            .expect("export");

            let exif = exported_exif(&target).unwrap_or_else(|| panic!("{file} : EXIF perdu"));
            assert!(
                exif.windows(MAKE.len()).any(|w| w == MAKE.as_bytes()),
                "{file}"
            );
            assert_eq!(
                Orientation::from_exif_chunk(&exif),
                Some(Orientation::NoTransforms),
                "{file} : la photo serait tournée une seconde fois"
            );
        }
    }

    #[test]
    fn reopening_an_export_does_not_turn_it_again() {
        let dir = TempDir::new("no-double-rotation");
        let decoded = sideways_shot(&dir);
        let target = dir.path("out.jpg");
        save_to_disk(
            &decoded.image,
            &target,
            options(ExportFormat::Jpeg, true),
            &decoded.metadata,
        )
        .unwrap();

        let reopened = decode_file(&target).unwrap();

        assert_eq!(
            (reopened.image.width, reopened.image.height),
            (decoded.image.width, decoded.image.height)
        );
    }

    #[test]
    fn the_exif_is_dropped_when_not_asked_for() {
        let dir = TempDir::new("drop-exif");
        let decoded = sideways_shot(&dir);

        for (format, file) in [
            (ExportFormat::Jpeg, "out.jpg"),
            (ExportFormat::Png, "out.png"),
        ] {
            let target = dir.path(file);
            save_to_disk(
                &decoded.image,
                &target,
                options(format, false),
                &decoded.metadata,
            )
            .expect("export");

            assert!(exported_exif(&target).is_none(), "{file}");
        }
    }

    #[test]
    fn a_tiff_export_works_whatever_the_metadata_choice() {
        let dir = TempDir::new("tiff");
        let decoded = sideways_shot(&dir);

        for keep in [true, false] {
            let target = dir.path(&format!("out-{keep}.tiff"));
            save_to_disk(
                &decoded.image,
                &target,
                options(ExportFormat::Tiff, keep),
                &decoded.metadata,
            )
            .expect("export");

            let reopened = decode_file(&target).unwrap();
            assert_eq!((reopened.image.width, reopened.image.height), (8, 16));
        }
    }

    #[test]
    fn a_photo_without_metadata_exports_fine() {
        let dir = TempDir::new("no-metadata");
        let decoded = sideways_shot(&dir);
        let target = dir.path("out.jpg");

        save_to_disk(
            &decoded.image,
            &target,
            options(ExportFormat::Jpeg, true),
            &crate::decode::Metadata::default(),
        )
        .expect("export");

        assert!(exported_exif(&target).is_none());
        assert!(exported_profile(&target).is_some());
    }
}

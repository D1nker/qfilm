use std::path::Path;

use image::metadata::Orientation;
use image::{DynamicImage, ImageDecoder, ImageError, ImageReader};
use rayon::prelude::*;

use super::PhotoError;
use super::buffer::{ImageBuf, srgb_to_linear};
use super::color;

/// Ce qui accompagne les pixels et que l'export peut rendre.
#[derive(Debug, Clone, Default)]
pub struct Metadata {
    /// L'EXIF brut du fichier d'origine. Son orientation est remise à « droit » : les pixels
    /// sont déjà tournés, sinon n'importe quel logiciel les tournerait une seconde fois.
    pub exif: Option<Vec<u8>>,
}

pub struct Decoded {
    pub image: ImageBuf,
    pub metadata: Metadata,
}

/// Point d'extension : le RAW sera un `Decoder` de plus, enregistré dans `decoders`.
pub trait Decoder: Send + Sync {
    fn supports(&self, extension: &str) -> bool;
    fn decode(&self, path: &Path) -> Result<Decoded, PhotoError>;
}

pub struct StandardDecoder;

impl Decoder for StandardDecoder {
    fn supports(&self, extension: &str) -> bool {
        matches!(extension, "jpg" | "jpeg" | "png" | "tif" | "tiff")
    }

    fn decode(&self, path: &Path) -> Result<Decoded, PhotoError> {
        let mut decoder = ImageReader::open(path)
            .map_err(ImageError::IoError)?
            .with_guessed_format()
            .map_err(ImageError::IoError)?
            .into_decoder()?;

        let icc = decoder.icc_profile()?;
        let mut exif = decoder.exif_metadata()?;
        let orientation = match exif
            .as_mut()
            .and_then(|chunk| Orientation::remove_from_exif_chunk(chunk))
        {
            Some(orientation) => orientation,
            None => decoder.orientation()?,
        };

        let mut photo = DynamicImage::from_decoder(decoder)?;
        photo.apply_orientation(orientation);

        let rgb = photo.to_rgb32f();
        let (width, height) = (rgb.width(), rgb.height());
        let mut data = rgb.into_raw();

        if let Some(icc) = &icc {
            color::to_srgb(&mut data, icc);
        }
        // `to_rgb32f` ne retire pas la gamma : on linéarise ici les valeurs sRGB.
        data.par_iter_mut().for_each(|c| *c = srgb_to_linear(*c));

        Ok(Decoded {
            image: ImageBuf {
                width,
                height,
                data,
            },
            metadata: Metadata { exif },
        })
    }
}

fn decoders() -> Vec<Box<dyn Decoder>> {
    vec![Box::new(StandardDecoder)]
}

pub fn decode_file(path: &Path) -> Result<Decoded, PhotoError> {
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

#[cfg(test)]
mod tests {
    use image::metadata::Orientation;
    use moxcms::ColorProfile;

    use super::*;
    use crate::fixtures::{
        MAKE, TempDir, exif_with_orientation, flat, red_blue, write_jpeg, write_png, write_tiff,
    };

    fn pixel(image: &ImageBuf, x: u32, y: u32) -> [f32; 3] {
        let start = ((y * image.width + x) * 3) as usize;
        [
            image.data[start],
            image.data[start + 1],
            image.data[start + 2],
        ]
    }

    #[test]
    fn a_shot_taken_sideways_is_turned_upright() {
        let dir = TempDir::new("orientation");
        let path = dir.path("portrait.jpg");
        write_jpeg(
            &path,
            16,
            8,
            &red_blue(16, 8),
            Some(exif_with_orientation(6)),
        );

        let decoded = decode_file(&path).expect("photo lisible");

        assert_eq!((decoded.image.width, decoded.image.height), (8, 16));
        let [top_red, _, top_blue] = pixel(&decoded.image, 4, 2);
        let [bottom_red, _, bottom_blue] = pixel(&decoded.image, 4, 13);
        assert!(top_red > 0.5 && top_blue < 0.2, "le haut devait être rouge");
        assert!(
            bottom_blue > 0.5 && bottom_red < 0.2,
            "le bas devait être bleu"
        );
    }

    #[test]
    fn every_orientation_that_swaps_the_axes_swaps_the_size() {
        let dir = TempDir::new("orientations");
        for (orientation, swaps) in [(1, false), (3, false), (6, true), (8, true)] {
            let path = dir.path(&format!("o{orientation}.jpg"));
            write_jpeg(
                &path,
                16,
                8,
                &red_blue(16, 8),
                Some(exif_with_orientation(orientation)),
            );

            let decoded = decode_file(&path).expect("photo lisible");

            let expected = if swaps { (8, 16) } else { (16, 8) };
            assert_eq!(
                (decoded.image.width, decoded.image.height),
                expected,
                "orientation {orientation}"
            );
        }
    }

    #[test]
    fn the_exif_handed_back_no_longer_asks_for_a_rotation() {
        let dir = TempDir::new("exif-reset");
        let path = dir.path("portrait.jpg");
        write_jpeg(
            &path,
            16,
            8,
            &red_blue(16, 8),
            Some(exif_with_orientation(6)),
        );

        let exif = decode_file(&path)
            .unwrap()
            .metadata
            .exif
            .expect("EXIF conservé");

        assert_eq!(
            Orientation::from_exif_chunk(&exif),
            Some(Orientation::NoTransforms)
        );
        assert!(
            exif.windows(MAKE.len()).any(|w| w == MAKE.as_bytes()),
            "le reste est intact"
        );
    }

    #[test]
    fn a_photo_without_exif_is_left_alone() {
        let dir = TempDir::new("no-exif");
        let path = dir.path("plain.jpg");
        write_jpeg(&path, 16, 8, &red_blue(16, 8), None);

        let decoded = decode_file(&path).unwrap();

        assert_eq!((decoded.image.width, decoded.image.height), (16, 8));
        assert!(decoded.metadata.exif.is_none());
    }

    /// Display P3 vers sRGB calculé à part, depuis les matrices publiées : le test ne compare
    /// pas la bibliothèque à elle-même.
    fn display_p3_to_linear_srgb(encoded: [f32; 3]) -> [f32; 3] {
        let p3 = encoded.map(srgb_to_linear);
        let xyz = [
            0.486_570_9 * p3[0] + 0.265_667_7 * p3[1] + 0.198_217_3 * p3[2],
            0.228_974_6 * p3[0] + 0.691_738_5 * p3[1] + 0.079_286_9 * p3[2],
            0.045_113_4 * p3[1] + 1.043_944_4 * p3[2],
        ];
        [
            3.240_454_2 * xyz[0] - 1.537_138_5 * xyz[1] - 0.498_531_4 * xyz[2],
            -0.969_266 * xyz[0] + 1.876_010_8 * xyz[1] + 0.041_556 * xyz[2],
            0.055_643_4 * xyz[0] - 0.204_025_9 * xyz[1] + 1.057_225_2 * xyz[2],
        ]
        .map(|c| c.clamp(0.0, 1.0))
    }

    #[test]
    fn a_display_p3_photo_is_converted_to_srgb() {
        let dir = TempDir::new("p3");
        let path = dir.path("p3.png");
        let p3 = ColorProfile::new_display_p3().encode().unwrap();
        write_png(&path, 4, 4, &flat(4, 4, [204, 128, 77]), Some(p3));

        let decoded = decode_file(&path).unwrap();

        let expected = display_p3_to_linear_srgb([204.0 / 255.0, 128.0 / 255.0, 77.0 / 255.0]);
        let actual = pixel(&decoded.image, 1, 1);
        for channel in 0..3 {
            assert!(
                (actual[channel] - expected[channel]).abs() < 0.02,
                "canal {channel} : {actual:?} au lieu de {expected:?}"
            );
        }
        let untouched = [204.0, 128.0, 77.0].map(|v| srgb_to_linear(v / 255.0));
        assert!(
            (actual[0] - untouched[0]).abs() > 0.02,
            "la conversion doit se voir"
        );
    }

    #[test]
    fn a_tiff_with_a_wide_gamut_profile_is_converted_too() {
        let dir = TempDir::new("tiff-p3");
        let path = dir.path("p3.tiff");
        let p3 = ColorProfile::new_display_p3().encode().unwrap();
        // Pas moins : sous quelques dizaines de Ko, `image` ne relit pas le profil d'un TIFF.
        write_tiff(&path, 256, 256, &flat(256, 256, [204, 128, 77]), Some(p3));

        let decoded = decode_file(&path).unwrap();

        let expected = display_p3_to_linear_srgb([204.0 / 255.0, 128.0 / 255.0, 77.0 / 255.0]);
        let actual = pixel(&decoded.image, 10, 10);
        for channel in 0..3 {
            assert!(
                (actual[channel] - expected[channel]).abs() < 0.02,
                "canal {channel}"
            );
        }
    }

    #[test]
    fn an_srgb_photo_goes_through_untouched() {
        let dir = TempDir::new("srgb");
        let tagged = dir.path("tagged.png");
        let plain = dir.path("plain.png");
        let srgb = ColorProfile::new_srgb().encode().unwrap();
        write_png(&tagged, 4, 4, &flat(4, 4, [204, 128, 77]), Some(srgb));
        write_png(&plain, 4, 4, &flat(4, 4, [204, 128, 77]), None);

        let with_profile = decode_file(&tagged).unwrap();
        let without = decode_file(&plain).unwrap();

        assert_eq!(with_profile.image.data, without.image.data);
        let expected = [204.0, 128.0, 77.0].map(|v| srgb_to_linear(v / 255.0));
        assert!((pixel(&without.image, 0, 0)[0] - expected[0]).abs() < 1e-5);
    }

    #[test]
    fn an_unreadable_profile_is_ignored_rather_than_refusing_the_photo() {
        let dir = TempDir::new("bad-icc");
        let path = dir.path("bad.png");
        write_png(
            &path,
            4,
            4,
            &flat(4, 4, [204, 128, 77]),
            Some(b"not a profile".to_vec()),
        );

        let decoded = decode_file(&path).expect("la photo reste lisible");

        let expected = [204.0, 128.0, 77.0].map(|v| srgb_to_linear(v / 255.0));
        assert!((pixel(&decoded.image, 0, 0)[0] - expected[0]).abs() < 1e-5);
    }
}

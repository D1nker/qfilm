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

/// Pour `examples/bench.rs`, qui mesure cette étape seule.
pub fn to_srgb8_for_bench(img: &ImageBuf) -> Vec<u8> {
    to_srgb8(img)
}

/// L'aperçu part en JPEG dans une URL de données. L'encodage, d'un seul fil, coûtait autant que le rendu
/// lui-même : voir `jpeg_in_strips`.
pub fn to_data_url(img: &ImageBuf, quality: u8) -> Result<String, PhotoError> {
    let jpeg = jpeg_in_strips(img, quality)?;
    Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(jpeg)))
}

fn jpeg_of(rgb: &[u8], width: u32, height: u32, quality: u8) -> Result<Vec<u8>, PhotoError> {
    let mut jpeg = Cursor::new(Vec::new());
    JpegEncoder::new_with_quality(&mut jpeg, quality).write_image(
        rgb,
        width,
        height,
        ExtendedColorType::Rgb8,
    )?;
    Ok(jpeg.into_inner())
}

/// Lignes d'une bande : un multiple de 8, la hauteur d'un bloc du JPEG sans sous-échantillonnage.
const STRIP_ROWS: usize = 64;

/// Un JPEG encodé par bandes de lignes, une par fil, puis recousu en un seul fichier.
///
/// JPEG sait repartir de zéro à intervalles réguliers (les marqueurs de redémarrage `RSTn` remettent à zéro la
/// prédiction des couleurs continues). Chaque bande est donc un JPEG complet que l'on encode seule, et la
/// couture ne garde que le dernier : son en-tête, un intervalle de redémarrage égal à une bande, les données de
/// chaque bande séparées par `RSTn`. Les blocs sont les mêmes qu'en une seule passe : le décodage rend
/// exactement les mêmes pixels (un test le vérifie), pour un tiers du temps sur dix cœurs.
///
/// Au moindre doute sur la forme de ce que produit l'encodeur, on retombe sur l'encodage d'un seul tenant.
fn jpeg_in_strips(img: &ImageBuf, quality: u8) -> Result<Vec<u8>, PhotoError> {
    let (width, height) = (img.width as usize, img.height as usize);
    let whole = || jpeg_of(&to_srgb8(img), img.width, img.height, quality);

    let blocks_per_row = width.div_ceil(8);
    let interval = blocks_per_row * (STRIP_ROWS / 8);
    if height <= STRIP_ROWS || interval > usize::from(u16::MAX) {
        return whole();
    }

    let parts = img
        .data
        .par_chunks(width * 3 * STRIP_ROWS)
        .map(|strip| {
            let rgb: Vec<u8> = strip
                .iter()
                .map(|c| (linear_to_srgb(c.clamp(0.0, 1.0)) * 255.0).round() as u8)
                .collect();
            jpeg_of(&rgb, img.width, (strip.len() / (width * 3)) as u32, quality)
        })
        .collect::<Result<Vec<_>, _>>()?;

    stitch(&parts, height, interval).map_or_else(whole, Ok)
}

/// Les octets avant et après les données d'une bande : (position de `SOS`, fin de son en-tête).
struct Layout {
    sof_height: usize,
    sos: usize,
    scan: usize,
}

/// Repère, dans un JPEG de base, la hauteur déclarée, le début du balayage et celui de ses données. `None`
/// si la forme n'est pas celle qu'on sait recoudre (autre que de base, ou couleurs sous-échantillonnées).
fn layout(jpeg: &[u8]) -> Option<Layout> {
    let (mut sof_height, mut at) = (None, 2);
    while at + 4 <= jpeg.len() {
        if jpeg[at] != 0xFF {
            return None;
        }
        let marker = jpeg[at + 1];
        let length = usize::from(u16::from_be_bytes([jpeg[at + 2], jpeg[at + 3]]));
        match marker {
            // Image de base : trois composantes, la première en 1 × 1 (pas de sous-échantillonnage).
            0xC0 => {
                if jpeg.get(at + 9) != Some(&3) || jpeg.get(at + 11) != Some(&0x11) {
                    return None;
                }
                sof_height = Some(at + 5);
            }
            // Progressif, arithmétique, et autres : on ne sait pas.
            0xC1..=0xCF if marker != 0xC4 && marker != 0xC8 && marker != 0xCC => return None,
            // Un intervalle de redémarrage déjà là : le nôtre ne saurait s'y ajouter.
            0xDD => return None,
            0xDA => {
                return Some(Layout {
                    sof_height: sof_height?,
                    sos: at,
                    scan: at + 2 + length,
                });
            }
            _ => {}
        }
        at += 2 + length;
    }
    None
}

fn stitch(parts: &[Vec<u8>], height: usize, interval: usize) -> Option<Vec<u8>> {
    let first = parts.first()?;
    let top = layout(first)?;
    let restart = u16::try_from(interval).ok()?.to_be_bytes();
    let height_bytes = u16::try_from(height).ok()?.to_be_bytes();

    let mut out = Vec::with_capacity(parts.iter().map(Vec::len).sum());
    out.extend_from_slice(&first[..top.sos]);
    out.extend_from_slice(&[0xFF, 0xDD, 0x00, 0x04, restart[0], restart[1]]);
    out.extend_from_slice(&first[top.sos..top.scan]);
    out[top.sof_height..top.sof_height + 2].copy_from_slice(&height_bytes);

    for (index, part) in parts.iter().enumerate() {
        let here = layout(part)?;
        if index > 0 {
            // `RST0` à `RST7`, en boucle, entre deux bandes.
            out.extend_from_slice(&[0xFF, 0xD0 + u8::try_from((index - 1) % 8).ok()?]);
        }
        // Sans la fin du fichier (`EOI`) : une seule, à la toute fin.
        out.extend_from_slice(part.get(here.scan..part.len() - 2)?);
    }
    out.extend_from_slice(&[0xFF, 0xD9]);
    Some(out)
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

    /// Des pixels qui ne se compressent pas trop bien : du bruit sur un dégradé.
    fn busy(width: u32, height: u32) -> ImageBuf {
        let mut img = ImageBuf::new(width, height);
        let mut seed = 0x9E37_79B9_u32;
        for (i, px) in img.data.chunks_mut(3).enumerate() {
            let x = (i as u32 % width) as f32 / width as f32;
            let y = (i as u32 / width) as f32 / height as f32;
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let noise = ((seed >> 16) as f32 / 65_535.0 - 0.5) * 0.3;
            px.copy_from_slice(&[
                (0.1 + 0.8 * x + noise).max(0.0),
                (0.1 + 0.8 * y + noise).max(0.0),
                (0.9 - 0.5 * x * y + noise).max(0.0),
            ]);
        }
        img
    }

    fn decoded(jpeg: &[u8]) -> image::RgbImage {
        image::load_from_memory_with_format(jpeg, image::ImageFormat::Jpeg)
            .expect("un JPEG valide")
            .to_rgb8()
    }

    fn single_pass(img: &ImageBuf, quality: u8) -> Vec<u8> {
        jpeg_of(&to_srgb8(img), img.width, img.height, quality).expect("jpeg")
    }

    #[test]
    fn a_jpeg_in_strips_decodes_to_exactly_the_pixels_of_a_single_pass() {
        // Des tailles qui cassent les calculs : largeur ou hauteur hors des multiples de 8 et de 64, une
        // seule ligne de plus qu'une bande, et plus de huit bandes (les marqueurs repartent de RST0).
        for (width, height) in [
            (301, 197),
            (640, 480),
            (100, 300),
            (64, 65),
            (1000, 130),
            (77, 800),
        ] {
            for quality in [88, 70] {
                let img = busy(width, height);

                let striped = jpeg_in_strips(&img, quality).expect("jpeg");

                assert_eq!(
                    decoded(&striped),
                    decoded(&single_pass(&img, quality)),
                    "{width}×{height} q{quality}"
                );
            }
        }
    }

    #[test]
    fn the_stitched_file_is_a_standard_jpeg_with_a_restart_interval_and_one_marker_per_seam() {
        let img = busy(160, 64 * 11 + 20);

        let jpeg = jpeg_in_strips(&img, 88).expect("jpeg");

        assert_eq!(&jpeg[..2], [0xFF, 0xD8]);
        assert_eq!(&jpeg[jpeg.len() - 2..], [0xFF, 0xD9]);
        let interval = 160_usize.div_ceil(8) * (STRIP_ROWS / 8);
        let declared = jpeg
            .windows(6)
            .find(|w| w[..4] == [0xFF, 0xDD, 0x00, 0x04])
            .map(|w| usize::from(u16::from_be_bytes([w[4], w[5]])));
        assert_eq!(declared, Some(interval));
        // 12 bandes, 11 coutures : RST0 à RST7, puis RST0 à RST2.
        for (marker, expected) in (0xD0..=0xD7).zip([2, 2, 2, 1, 1, 1, 1, 1]) {
            let found = jpeg.windows(2).filter(|w| *w == [0xFF, marker]).count();
            assert_eq!(found, expected, "RST{}", marker - 0xD0);
        }
        assert_eq!(decoded(&jpeg).dimensions(), (160, 64 * 11 + 20));
    }

    #[test]
    fn a_small_image_is_encoded_in_one_piece_without_any_seam() {
        let img = busy(120, 64);

        assert_eq!(
            jpeg_in_strips(&img, 88).expect("jpeg"),
            single_pass(&img, 88)
        );
    }

    #[test]
    fn what_it_cannot_stitch_it_leaves_alone() {
        let img = busy(100, 200);
        let good = single_pass(&img, 88);
        assert!(layout(&good).is_some());

        // Couleurs sous-échantillonnées (2 × 2) : les blocs ne sont plus ceux d'une bande.
        let mut subsampled = good.clone();
        let sof = subsampled
            .windows(2)
            .position(|w| w == [0xFF, 0xC0])
            .expect("SOF0");
        subsampled[sof + 11] = 0x22;
        assert!(layout(&subsampled).is_none());

        // Un fichier qui n'est pas un JPEG.
        assert!(layout(&[0xFF, 0xD8, 0x00, 0x00, 0x00]).is_none());
        assert!(layout(&[]).is_none());
        assert!(stitch(&[], 200, 100).is_none());
        assert!(stitch(&[vec![1, 2, 3]], 200, 100).is_none());
    }

    #[test]
    fn the_preview_url_still_carries_a_jpeg() {
        let url = to_data_url(&busy(200, 200), 88).expect("url");

        let payload = url
            .strip_prefix("data:image/jpeg;base64,")
            .expect("data URL");
        let bytes = STANDARD.decode(payload).expect("base64");
        assert_eq!(decoded(&bytes).dimensions(), (200, 200));
    }

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

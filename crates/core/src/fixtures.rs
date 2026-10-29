//! De vrais fichiers pour les tests de lecture et d'écriture : un JPEG dont l'EXIF demande une
//! rotation, un PNG qui porte un profil Display P3… Un double ne prouverait rien ici.

use std::fs::{self, File};
use std::io::BufWriter;
use std::path::{Path, PathBuf};

use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::codecs::tiff::TiffEncoder;
use image::{ExtendedColorType, ImageEncoder};

pub const MAKE: &str = "qFilm";

pub struct TempDir(PathBuf);

impl TempDir {
    pub fn new(name: &str) -> Self {
        let path = std::env::temp_dir().join(format!("qfilm-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("dossier temporaire");
        Self(path)
    }

    pub fn path(&self, file: &str) -> PathBuf {
        self.0.join(file)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// Un EXIF minimal (petit-boutiste) : le fabricant et l'orientation.
pub fn exif_with_orientation(orientation: u16) -> Vec<u8> {
    let make = format!("{MAKE}\0");
    let data_offset = 8 + 2 + 2 * 12 + 4;

    let mut exif = vec![b'I', b'I', 0x2A, 0x00, 8, 0, 0, 0];
    exif.extend(2u16.to_le_bytes());
    for (tag, kind, count, value) in [
        (0x010F_u16, 2_u16, make.len() as u32, data_offset as u32),
        (0x0112, 3, 1, u32::from(orientation)),
    ] {
        exif.extend(tag.to_le_bytes());
        exif.extend(kind.to_le_bytes());
        exif.extend(count.to_le_bytes());
        exif.extend(value.to_le_bytes());
    }
    exif.extend(0u32.to_le_bytes());
    exif.extend(make.as_bytes());
    exif
}

/// Deux moitiés de couleur pleine : la gauche rouge, la droite bleue.
pub fn red_blue(width: u32, height: u32) -> Vec<u8> {
    let mut pixels = Vec::new();
    for _ in 0..height {
        for x in 0..width {
            pixels.extend(if x < width / 2 {
                [255, 0, 0]
            } else {
                [0, 0, 255]
            });
        }
    }
    pixels
}

pub fn write_jpeg(path: &Path, width: u32, height: u32, rgb: &[u8], exif: Option<Vec<u8>>) {
    let mut encoder =
        JpegEncoder::new_with_quality(BufWriter::new(File::create(path).unwrap()), 100);
    if let Some(exif) = exif {
        encoder.set_exif_metadata(exif).unwrap();
    }
    encoder
        .write_image(rgb, width, height, ExtendedColorType::Rgb8)
        .unwrap();
}

pub fn write_png(path: &Path, width: u32, height: u32, rgb: &[u8], icc: Option<Vec<u8>>) {
    let mut encoder = PngEncoder::new(BufWriter::new(File::create(path).unwrap()));
    if let Some(icc) = icc {
        encoder.set_icc_profile(icc).unwrap();
    }
    encoder
        .write_image(rgb, width, height, ExtendedColorType::Rgb8)
        .unwrap();
}

pub fn write_tiff(path: &Path, width: u32, height: u32, rgb: &[u8], icc: Option<Vec<u8>>) {
    let mut encoder = TiffEncoder::new(BufWriter::new(File::create(path).unwrap()));
    if let Some(icc) = icc {
        encoder.set_icc_profile(icc).unwrap();
    }
    encoder
        .write_image(rgb, width, height, ExtendedColorType::Rgb8)
        .unwrap();
}

pub fn flat(width: u32, height: u32, rgb: [u8; 3]) -> Vec<u8> {
    rgb.repeat((width * height) as usize)
}

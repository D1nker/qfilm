#![allow(clippy::needless_pass_by_value)] // `State` est un extracteur Tauri, pris par valeur.

pub mod export;
pub mod frames;
pub mod image;
pub mod render;

const PREVIEW_MAX_EDGE: u32 = 1800;
const PREVIEW_JPEG_QUALITY: u8 = 88;

/// Quand un rendu complet est trop lent pour suivre la main, l'aperçu pendant un geste est tracé sur
/// cette version réduite (environ 3 fois moins de pixels) ; le rendu complet suit au relâchement.
const DRAFT_MAX_EDGE: u32 = 960;
const DRAFT_JPEG_QUALITY: u8 = 70;

const THUMB_MAX_EDGE: u32 = 240;
const THUMB_JPEG_QUALITY: u8 = 80;

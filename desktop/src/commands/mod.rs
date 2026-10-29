#![allow(clippy::needless_pass_by_value)] // `State` est un extracteur Tauri, pris par valeur.

pub mod export;
pub mod frames;
pub mod image;
pub mod render;

const PREVIEW_MAX_EDGE: u32 = 1800;
const PREVIEW_JPEG_QUALITY: u8 = 88;

/// Pendant qu'on déplace un curseur, l'aperçu est tracé sur cette version réduite, bien plus
/// rapide ; le rendu complet suit au relâchement.
const DRAFT_MAX_EDGE: u32 = 640;
const DRAFT_JPEG_QUALITY: u8 = 70;

const THUMB_MAX_EDGE: u32 = 240;
const THUMB_JPEG_QUALITY: u8 = 80;

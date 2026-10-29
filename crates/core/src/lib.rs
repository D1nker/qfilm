// Le traitement pixel convertit sans cesse entre entiers et flottants sur des valeurs
// bornées par construction (canaux 0..=65535, dimensions d'image) : ces lints y sont du bruit.
#![allow(
    clippy::cast_possible_truncation,
    clippy::cast_precision_loss,
    clippy::cast_sign_loss
)]
// Crate interne, un seul consommateur : ces lints d'API publique n'apportent que du bruit.
#![allow(
    clippy::must_use_candidate,
    clippy::return_self_not_must_use,
    clippy::missing_errors_doc,
    clippy::missing_panics_doc
)]

pub mod buffer;
pub mod caption;
pub mod color;
pub mod curve;
pub mod decode;
pub mod encode;
pub mod fonts;
pub mod frame;
pub mod geometry;
pub mod preset;
pub mod render;
pub mod text;

#[cfg(test)]
mod fixtures;
#[cfg(test)]
mod golden;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum PhotoError {
    #[error("format non pris en charge : .{0}")]
    UnsupportedFormat(String),

    #[error("lecture de l'image impossible : {0}")]
    Decode(#[from] image::ImageError),

    #[error("image introuvable (elle a peut-être été fermée)")]
    ImageNotLoaded,

    #[error("calcul interrompu : {0}")]
    Task(String),

    #[error(transparent)]
    Frame(#[from] frame::FrameError),
}

impl serde::Serialize for PhotoError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl specta::Type for PhotoError {
    fn definition(_: &mut specta::Types) -> specta::datatype::DataType {
        specta::datatype::Primitive::str.into()
    }
}

// Le traitement pixel convertit sans cesse entre entiers et flottants sur des valeurs
// bornées par construction (canaux 0..=65535, dimensions d'image) : ces lints y sont du bruit.
#![allow(
    clippy::cast_possible_truncation,
    clippy::cast_precision_loss,
    clippy::cast_sign_loss
)]

pub mod buffer;
pub mod caption;
pub mod decode;
pub mod encode;
pub mod fonts;
pub mod frame;
pub mod preset;
pub mod render;

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

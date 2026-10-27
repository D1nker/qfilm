//! Les cadres : un dossier (`frame.json` + `frame.svg`) que le moteur interprète, plutôt que du
//! code. Voir `docs/FRAMES.md`.

mod builtin;
mod manifest;
mod raster;
mod registry;
mod store;
mod template;

#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use thiserror::Error;

pub use manifest::FrameManifest;
#[cfg(test)]
pub use manifest::ParamKind;
pub use registry::{FrameInfo, FrameRegistry};
pub use store::{LoadIssue, UserFrames};

use super::buffer::ImageBuf;
use super::text::LocalizedText;
use template::FrameTemplate;

#[derive(Debug, Error)]
pub enum FrameError {
    #[error("cadre « {0} » introuvable")]
    NotFound(String),

    #[error("manifeste invalide : {0}")]
    Manifest(String),

    #[error("gabarit invalide : {0}")]
    Template(String),

    #[error("SVG invalide : {0}")]
    Svg(String),

    #[error("fichier de cadre inutilisable : {0}")]
    Package(String),
}

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FrameSelection {
    pub id: String,
    #[serde(default)]
    #[specta(type = std::collections::BTreeMap<String, manifest::ParamValue>)]
    pub params: Map<String, Value>,
}

impl Default for FrameSelection {
    fn default() -> Self {
        Self {
            id: registry::NONE_ID.into(),
            params: Map::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TextZone {
    pub field: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl TextZone {
    fn rotated_270(&self, canvas_width: f32) -> Self {
        Self {
            field: self.field.clone(),
            x: self.y,
            y: canvas_width - (self.x + self.width),
            width: self.height,
            height: self.width,
        }
    }
}

pub struct Rendered {
    pub image: ImageBuf,
    pub zones: Vec<TextZone>,
    pub caption_center: (f32, f32),
}

pub struct Frame {
    pub manifest: FrameManifest,
    pub builtin: bool,
    template: Option<FrameTemplate>,
}

impl Frame {
    /// Charge un cadre et le valide pour de bon, rendu d'essai compris : un cadre accepté ne peut
    /// pas faire échouer l'aperçu plus tard.
    pub fn from_sources(
        manifest_json: &str,
        svg: String,
        builtin: bool,
    ) -> Result<Self, FrameError> {
        let manifest: FrameManifest = serde_json::from_str(manifest_json)
            .map_err(|error| FrameError::Manifest(error.to_string()))?;
        manifest.validate()?;

        let frame = Self {
            template: Some(FrameTemplate::compile(svg)?),
            manifest,
            builtin,
        };

        for (width, height) in [(160, 100), (100, 160)] {
            let mut sample = ImageBuf::new(width, height);
            sample.data.fill(0.2);
            frame.render(&sample, &frame.manifest.defaults())?;
        }
        Ok(frame)
    }

    pub fn none() -> Self {
        Self {
            manifest: FrameManifest {
                id: registry::NONE_ID.into(),
                name: LocalizedText::translations([("fr", "Aucun"), ("en", "None")]),
                description: LocalizedText::default(),
                author: String::new(),
                rotate_portrait: false,
                caption_defaults: Map::new(),
                params: Vec::new(),
            },
            builtin: true,
            template: None,
        }
    }

    pub fn render(
        &self,
        photo: &ImageBuf,
        params: &Map<String, Value>,
    ) -> Result<Rendered, FrameError> {
        let Some(template) = &self.template else {
            return Ok(Rendered {
                image: photo.clone(),
                zones: Vec::new(),
                caption_center: (0.5, 0.9),
            });
        };

        let params = self.manifest.resolve(params);
        let rotated = self.manifest.rotate_portrait && photo.height > photo.width;
        let upright;
        let source = if rotated {
            upright = photo.rotate90();
            &upright
        } else {
            photo
        };

        let svg = template.render(source.width, source.height, &params)?;
        let rendered = raster::compose(&svg, source)?;

        Ok(if rotated {
            Self::rotate_back(&rendered)
        } else {
            rendered
        })
    }

    fn rotate_back(rendered: &Rendered) -> Rendered {
        let width = rendered.image.width as f32;
        let (cx, cy) = rendered.caption_center;

        Rendered {
            zones: rendered
                .zones
                .iter()
                .map(|zone| zone.rotated_270(width))
                .collect(),
            // Un point (x, y) du paysage tombe en (y, largeur − x) après la rotation : en
            // fractions de l'image, (cy, 1 − cx).
            caption_center: (cy, 1.0 - cx),
            image: rendered.image.rotate270(),
        }
    }
}

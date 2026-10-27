use serde::Serialize;

use super::builtin;
use super::manifest::FrameManifest;
use super::{Frame, FrameError, FrameSelection, Rendered};
use crate::buffer::ImageBuf;
use crate::caption::{self, Caption};

pub const NONE_ID: &str = "none";

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FrameInfo {
    #[serde(flatten)]
    pub manifest: FrameManifest,
    pub builtin: bool,
}

pub struct FrameRegistry {
    frames: Vec<Frame>,
}

impl FrameRegistry {
    pub fn builtin() -> Self {
        let mut frames = vec![Frame::none()];
        frames.extend(builtin::frames());
        Self { frames }
    }

    /// Un identifiant pris par un cadre de l'application est refusé ; un cadre importé du même
    /// nom est mis à jour.
    pub fn add_user(&mut self, frame: Frame) -> Result<(), FrameError> {
        let id = frame.manifest.id.clone();
        match self.frames.iter().position(|f| f.manifest.id == id) {
            Some(index) if self.frames[index].builtin => Err(FrameError::Package(format!(
                "l'identifiant « {id} » est réservé à un cadre de l'application"
            ))),
            Some(index) => {
                self.frames[index] = frame;
                Ok(())
            }
            None => {
                self.frames.push(frame);
                Ok(())
            }
        }
    }

    pub fn remove_user(&mut self, id: &str) -> Result<(), FrameError> {
        match self.frames.iter().position(|f| f.manifest.id == id) {
            Some(index) if !self.frames[index].builtin => {
                self.frames.remove(index);
                Ok(())
            }
            Some(_) => Err(FrameError::Package(format!(
                "« {id} » est livré avec l'application et ne peut pas être supprimé"
            ))),
            None => Err(FrameError::NotFound(id.into())),
        }
    }

    pub fn clear_user(&mut self) {
        self.frames.retain(|frame| frame.builtin);
    }

    pub fn get(&self, id: &str) -> Option<&Frame> {
        self.frames.iter().find(|frame| frame.manifest.id == id)
    }

    pub fn list(&self) -> Vec<FrameInfo> {
        self.frames
            .iter()
            .map(|frame| FrameInfo {
                manifest: frame.manifest.clone(),
                builtin: frame.builtin,
            })
            .collect()
    }

    pub fn render(
        &self,
        photo: &ImageBuf,
        selection: &FrameSelection,
    ) -> Result<Rendered, FrameError> {
        self.get(&selection.id)
            .ok_or_else(|| FrameError::NotFound(selection.id.clone()))?
            .render(photo, &selection.params)
    }

    pub fn render_with_caption(
        &self,
        photo: &ImageBuf,
        selection: &FrameSelection,
        caption: &Caption,
    ) -> Result<Rendered, FrameError> {
        let mut rendered = self.render(photo, selection)?;

        let zone = caption::draw(&mut rendered.image, caption, rendered.caption_center);
        if !caption.text.trim().is_empty() {
            rendered.zones.push(zone);
        }
        Ok(rendered)
    }
}

#[cfg(test)]
mod smoke {
    use super::*;

    #[test]
    fn builtin_frames_all_load() {
        let registry = FrameRegistry::builtin();
        let ids: Vec<String> = registry.list().into_iter().map(|f| f.manifest.id).collect();
        assert_eq!(
            ids,
            [
                "none",
                "solid",
                "instant",
                "film35",
                "film120",
                "letterbox",
                "padding"
            ]
        );
    }
}

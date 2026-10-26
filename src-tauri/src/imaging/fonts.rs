use std::sync::{Arc, LazyLock};

use ab_glyph::{Font, FontRef, PxScale, ScaleFont};
use resvg::usvg::fontdb;
use serde::{Deserialize, Serialize};

static CONDENSED_DATA: &[u8] = include_bytes!("../../../public/fonts/RobotoCondensed-Regular.ttf");
static TYPEWRITER_DATA: &[u8] = include_bytes!("../../../public/fonts/CourierPrime-Regular.ttf");
static HANDWRITTEN_DATA: &[u8] = include_bytes!("../../../public/fonts/Caveat-Regular.ttf");

static CONDENSED: LazyLock<FontRef<'static>> =
    LazyLock::new(|| FontRef::try_from_slice(CONDENSED_DATA).expect("police intégrée valide"));
static TYPEWRITER: LazyLock<FontRef<'static>> =
    LazyLock::new(|| FontRef::try_from_slice(TYPEWRITER_DATA).expect("police intégrée valide"));
static HANDWRITTEN: LazyLock<FontRef<'static>> =
    LazyLock::new(|| FontRef::try_from_slice(HANDWRITTEN_DATA).expect("police intégrée valide"));

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FontChoice {
    #[default]
    Condensed,
    Typewriter,
    Handwritten,
}

impl FontChoice {
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "condensed" => Some(Self::Condensed),
            "typewriter" => Some(Self::Typewriter),
            "handwritten" => Some(Self::Handwritten),
            _ => None,
        }
    }

    pub const fn family(self) -> &'static str {
        match self {
            Self::Condensed => "Roboto Condensed",
            Self::Typewriter => "Courier Prime",
            Self::Handwritten => "Caveat",
        }
    }
}

pub fn face(choice: FontChoice) -> &'static FontRef<'static> {
    match choice {
        FontChoice::Condensed => &CONDENSED,
        FontChoice::Typewriter => &TYPEWRITER,
        FontChoice::Handwritten => &HANDWRITTEN,
    }
}

pub fn text_width(choice: FontChoice, text: &str, px: f32, tracking: f32) -> f32 {
    let face = face(choice);
    let scaled = face.as_scaled(PxScale::from(px));
    text.chars()
        .map(|c| scaled.h_advance(face.glyph_id(c)) + tracking)
        .sum()
}

/// Ici `px` est la hauteur de ligne (ascendante + descendante), pas le cadratin : le `font-size`
/// SVG équivalent s'exprime en cadratins.
pub fn em_size(choice: FontChoice, px: f32) -> f32 {
    let face = face(choice);
    let units = face
        .units_per_em()
        .unwrap_or_else(|| face.height_unscaled());
    px * units / face.height_unscaled()
}

pub fn ascent(choice: FontChoice, px: f32) -> f32 {
    let face = face(choice);
    px * face.ascent_unscaled() / face.height_unscaled()
}

pub static FONT_DB: LazyLock<Arc<fontdb::Database>> = LazyLock::new(|| {
    let mut database = fontdb::Database::new();
    for data in [CONDENSED_DATA, TYPEWRITER_DATA, HANDWRITTEN_DATA] {
        database.load_font_data(data.to_vec());
    }
    Arc::new(database)
});

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn family_names_match_the_font_files() {
        let database = &**FONT_DB;
        for choice in [
            FontChoice::Condensed,
            FontChoice::Typewriter,
            FontChoice::Handwritten,
        ] {
            let found = database.faces().any(|face| {
                face.families
                    .iter()
                    .any(|(name, _)| name == choice.family())
            });
            assert!(found, "police « {} » absente de la base", choice.family());
        }
    }

    #[test]
    fn em_size_is_smaller_than_line_height() {
        for choice in [
            FontChoice::Condensed,
            FontChoice::Typewriter,
            FontChoice::Handwritten,
        ] {
            let em = em_size(choice, 100.0);
            assert!(em > 50.0 && em < 100.0, "{choice:?} : {em}");
            assert!(ascent(choice, 100.0) > 50.0);
        }
    }
}

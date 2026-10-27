use crate::text::LocalizedText;
use std::sync::LazyLock;

use serde::{Deserialize, Serialize};

use super::render::RenderParams;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: String,
    pub name: LocalizedText,
    pub category: LocalizedText,
    pub description: LocalizedText,
    /// Seuls les réglages non nuls sont à écrire.
    #[serde(default)]
    pub params: RenderParams,
}

static BUILTIN: LazyLock<Vec<Preset>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../presets/builtin.json"))
        .expect("presets/builtin.json est invalide")
});

pub fn builtin() -> &'static [Preset] {
    &BUILTIN
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn builtin_file_is_valid() {
        let presets = builtin();

        assert_eq!(presets.first().map(|p| p.id.as_str()), Some("neutral"));

        let mut ids = HashSet::new();
        for preset in presets {
            assert!(!preset.id.is_empty(), "{preset:?}");
            assert!(ids.insert(&preset.id), "id en double : {}", preset.id);
        }
    }

    #[test]
    fn every_builtin_look_speaks_both_languages() {
        for preset in builtin() {
            for (what, text) in [
                ("nom", &preset.name),
                ("catégorie", &preset.category),
                ("description", &preset.description),
            ] {
                let context = format!("{} ({what})", preset.id);
                text.validate(&context, 120).expect("texte valide");
                for language in ["fr", "en"] {
                    assert!(text.has_language(language), "{context} : pas de {language}");
                }
            }
        }
    }

    #[test]
    fn neutral_preset_changes_nothing() {
        assert_eq!(builtin()[0].params, RenderParams::default());
    }
}

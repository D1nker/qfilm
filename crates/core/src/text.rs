//! Un texte d'interface qui vient des données (look, cadre) : une chaîne valable pour toutes les
//! langues, ou une chaîne par langue. Les cadres importés peuvent donc rester de simples chaînes.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

const MAX_LANGUAGES: usize = 12;
const MAX_LANGUAGE_CODE: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(untagged)]
pub enum LocalizedText {
    Plain(String),
    Translations(BTreeMap<String, String>),
}

impl Default for LocalizedText {
    fn default() -> Self {
        Self::Plain(String::new())
    }
}

impl From<&str> for LocalizedText {
    fn from(text: &str) -> Self {
        Self::Plain(text.into())
    }
}

impl LocalizedText {
    pub fn translations<const N: usize>(entries: [(&str, &str); N]) -> Self {
        Self::Translations(
            entries
                .into_iter()
                .map(|(language, text)| (language.into(), text.into()))
                .collect(),
        )
    }

    /// Le texte dans `language`, à défaut une autre version : sert aux messages d'erreur.
    pub fn in_language(&self, language: &str) -> &str {
        match self {
            Self::Plain(text) => text,
            Self::Translations(map) => map
                .get(language)
                .or_else(|| map.values().next())
                .map_or("", String::as_str),
        }
    }

    pub fn is_blank(&self) -> bool {
        self.texts()
            .next()
            .is_none_or(|first| first.trim().is_empty())
            || self.texts().any(|text| text.trim().is_empty())
    }

    pub fn has_language(&self, language: &str) -> bool {
        match self {
            Self::Plain(_) => true,
            Self::Translations(map) => map.contains_key(language),
        }
    }

    /// Refuse ce qu'un fichier importé ne doit pas pouvoir imposer : trop de langues, des codes
    /// de langue fantaisistes, des textes vides ou trop longs.
    pub fn validate(&self, what: &str, max_chars: usize) -> Result<(), String> {
        if self.is_blank() {
            return Err(format!(
                "{what} : le texte est vide dans au moins une langue"
            ));
        }
        self.validate_optional(what, max_chars)
    }

    /// Comme [`Self::validate`], mais un texte entièrement vide est accepté.
    pub fn validate_optional(&self, what: &str, max_chars: usize) -> Result<(), String> {
        if let Self::Translations(map) = self {
            if map.len() > MAX_LANGUAGES {
                return Err(format!("{what} : {MAX_LANGUAGES} langues au maximum"));
            }
            if let Some(code) = map.keys().find(|code| !is_language_code(code)) {
                return Err(format!(
                    "{what} : code de langue « {code} » invalide (lettres minuscules et -)"
                ));
            }
        }
        if self.texts().any(|text| text.chars().count() > max_chars) {
            return Err(format!("{what} : {max_chars} caractères au maximum"));
        }
        Ok(())
    }

    fn texts(&self) -> Box<dyn Iterator<Item = &str> + '_> {
        match self {
            Self::Plain(text) => Box::new(std::iter::once(text.as_str())),
            Self::Translations(map) => Box::new(map.values().map(String::as_str)),
        }
    }
}

fn is_language_code(code: &str) -> bool {
    !code.is_empty()
        && code.len() <= MAX_LANGUAGE_CODE
        && code.chars().all(|c| c.is_ascii_lowercase() || c == '-')
        && !code.starts_with('-')
        && !code.ends_with('-')
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn parse(value: serde_json::Value) -> LocalizedText {
        serde_json::from_value(value).expect("texte lisible")
    }

    #[test]
    fn reads_a_plain_string_and_a_map_of_translations() {
        assert_eq!(parse(json!("35 mm")), LocalizedText::Plain("35 mm".into()));
        assert_eq!(
            parse(json!({ "fr": "Cadre", "en": "Frame" })),
            LocalizedText::translations([("fr", "Cadre"), ("en", "Frame")])
        );
    }

    #[test]
    fn serializes_back_to_the_shape_it_was_read_from() {
        let text = LocalizedText::translations([("fr", "Cadre"), ("en", "Frame")]);

        assert_eq!(
            serde_json::to_value(&text).unwrap(),
            json!({ "en": "Frame", "fr": "Cadre" })
        );
        assert_eq!(
            serde_json::to_value(LocalizedText::from("x")).unwrap(),
            json!("x")
        );
    }

    #[test]
    fn falls_back_to_another_language_instead_of_nothing() {
        let text = LocalizedText::translations([("fr", "Cadre")]);

        assert_eq!(text.in_language("fr"), "Cadre");
        assert_eq!(text.in_language("en"), "Cadre");
        assert_eq!(LocalizedText::from("35 mm").in_language("en"), "35 mm");
    }

    #[test]
    fn a_plain_text_counts_for_every_language() {
        assert!(LocalizedText::from("35 mm").has_language("en"));
        assert!(!LocalizedText::translations([("fr", "Cadre")]).has_language("en"));
    }

    #[test]
    fn rejects_empty_texts_in_any_language() {
        assert!(LocalizedText::from("  ").validate("nom", 60).is_err());
        assert!(
            LocalizedText::Translations(BTreeMap::new())
                .validate("nom", 60)
                .is_err()
        );
        assert!(
            LocalizedText::translations([("fr", "Cadre"), ("en", " ")])
                .validate("nom", 60)
                .is_err()
        );
    }

    #[test]
    fn an_optional_text_may_be_empty_but_not_oversized() {
        assert!(
            LocalizedText::default()
                .validate_optional("description", 10)
                .is_ok()
        );
        assert!(
            LocalizedText::from("x".repeat(11).as_str())
                .validate_optional("d", 10)
                .is_err()
        );
    }

    #[test]
    fn rejects_texts_longer_than_the_limit_in_any_language() {
        let text = LocalizedText::translations([("fr", "court"), ("en", "x".repeat(61).as_str())]);

        assert!(text.validate("nom", 60).is_err());
    }

    #[test]
    fn rejects_invented_language_codes_and_too_many_languages() {
        for code in ["", "FR", "fr_FR", "-fr", "trop-long-code", "fr fr"] {
            let text = LocalizedText::translations([(code, "x")]);
            assert!(text.validate("nom", 60).is_err(), "{code:?}");
        }

        let many: BTreeMap<String, String> = (b'a'..=b'z')
            .take(13)
            .map(|c| (format!("a{}", c as char), "x".into()))
            .collect();
        assert!(
            LocalizedText::Translations(many)
                .validate("nom", 60)
                .is_err()
        );
    }
}

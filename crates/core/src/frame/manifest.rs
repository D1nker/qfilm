//! Le manifeste d'un cadre. Il peut venir d'un fichier importé : tout ce qui entre dans le
//! gabarit est validé ici, jamais pris tel quel.

use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::FrameError;
use crate::fonts::FontChoice;
use crate::text::LocalizedText;

const MAX_PARAMS: usize = 64;
const MAX_OPTIONS: usize = 48;
const MAX_TEXT_LENGTH: usize = 500;
const MAX_NAME_LENGTH: usize = 60;
const MAX_LABEL_LENGTH: usize = 80;
const MAX_DESCRIPTION_LENGTH: usize = 500;
const DEFAULT_TEXT_LENGTH: usize = 80;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FrameManifest {
    pub id: String,
    pub name: LocalizedText,
    #[serde(default)]
    pub description: LocalizedText,
    #[serde(default)]
    pub author: String,
    /// Gabarit dessiné pour une photo horizontale : les photos verticales sont tournées avant,
    /// puis remises d'aplomb.
    #[serde(default)]
    pub rotate_portrait: bool,
    /// Réglages de la légende repris quand on choisit ce cadre (seuls les champs présents).
    #[serde(default)]
    #[specta(type = CaptionDefaults)]
    pub caption_defaults: Map<String, Value>,
    #[serde(default)]
    pub params: Vec<ParamDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ParamDef {
    pub id: String,
    pub label: LocalizedText,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section: Option<LocalizedText>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visible_if: Option<Condition>,
    /// Transmis au gabarit mais absent du panneau.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub hidden: bool,
    /// Garde la valeur choisie quand on passe à un cadre qui a le même réglage.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub persist: bool,
    /// Texte qui reçoit le nom du look appliqué, en majuscules.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub from_look: bool,
    #[serde(flatten)]
    pub kind: ParamKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
// `rename_all` ne renomme que les variantes ; `rename_all_fields` renomme leurs champs
// (`maxLength`). Sans lui, ces champs seraient ignorés en silence.
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ParamKind {
    Number {
        min: f64,
        max: f64,
        step: f64,
        #[serde(default)]
        unit: String,
        default: f64,
    },
    Color {
        default: String,
    },
    Bool {
        default: bool,
    },
    Text {
        default: String,
        #[serde(default = "default_text_length")]
        #[specta(type = u32)]
        max_length: usize,
    },
    Choice {
        default: String,
        options: Vec<ChoiceOption>,
        #[serde(default)]
        display: ChoiceDisplay,
    },
}

const fn default_text_length() -> usize {
    DEFAULT_TEXT_LENGTH
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ChoiceDisplay {
    #[default]
    Menu,
    List,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ChoiceOption {
    pub id: String,
    pub label: LocalizedText,
    /// Valeurs imposées à d'autres réglages (une pellicule fixe couleur, encre et texte).
    #[serde(default)]
    #[specta(type = BTreeMap<String, ParamValue>)]
    pub sets: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Condition {
    pub param: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[specta(type = Option<ParamValue>)]
    pub equals: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[specta(type = Option<ParamValue>)]
    pub not_equals: Option<Value>,
}

/// Valeur d'un réglage de cadre. Le moteur manipule du JSON brut : ce type ne sert qu'à décrire
/// l'API au frontend.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(untagged)]
pub enum ParamValue {
    Number(f64),
    Flag(bool),
    Text(String),
}

/// Réglages de légende qu'un cadre peut imposer ; chacun est facultatif.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CaptionDefaults {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font: Option<FontChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<f32>,
}

pub fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn is_valid_frame_id(id: &str) -> bool {
    (1..=40).contains(&id.len())
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

fn is_valid_param_id(id: &str) -> bool {
    let mut chars = id.chars();
    chars.next().is_some_and(|c| c.is_ascii_alphabetic())
        && id.len() <= 32
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn is_valid_option_id(id: &str) -> bool {
    (1..=40).contains(&id.len())
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

impl ParamKind {
    pub fn default_value(&self) -> Value {
        match self {
            Self::Number { default, .. } => Value::from(*default),
            Self::Color { default } | Self::Text { default, .. } | Self::Choice { default, .. } => {
                Value::from(default.clone())
            }
            Self::Bool { default } => Value::from(*default),
        }
    }

    pub fn coerce(&self, input: Option<&Value>) -> Value {
        let fallback = || self.default_value();
        let Some(input) = input else {
            return fallback();
        };

        match self {
            Self::Number { min, max, .. } => match input.as_f64() {
                Some(number) if number.is_finite() => Value::from(number.clamp(*min, *max)),
                _ => fallback(),
            },
            Self::Color { .. } => match input.as_str() {
                Some(color) if is_hex_color(color) => Value::from(color.to_ascii_lowercase()),
                _ => fallback(),
            },
            Self::Bool { .. } => input.as_bool().map_or_else(fallback, Value::from),
            Self::Text { max_length, .. } => input.as_str().map_or_else(fallback, |text| {
                Value::from(text.chars().take(*max_length).collect::<String>())
            }),
            Self::Choice { options, .. } => match input.as_str() {
                Some(id) if options.iter().any(|option| option.id == id) => Value::from(id),
                _ => fallback(),
            },
        }
    }
}

impl FrameManifest {
    pub fn defaults(&self) -> Map<String, Value> {
        self.params
            .iter()
            .map(|param| (param.id.clone(), param.kind.default_value()))
            .collect()
    }

    pub fn resolve(&self, input: &Map<String, Value>) -> Map<String, Value> {
        self.params
            .iter()
            .map(|param| (param.id.clone(), param.kind.coerce(input.get(&param.id))))
            .collect()
    }

    pub fn validate(&self) -> Result<(), FrameError> {
        let fail = |message: String| Err(FrameError::Manifest(message));

        if !is_valid_frame_id(&self.id) {
            return fail(format!(
                "identifiant « {} » invalide (minuscules, chiffres, - et _, 40 caractères max)",
                self.id
            ));
        }
        if let Err(message) = self.name.validate("le nom", MAX_NAME_LENGTH) {
            return fail(message);
        }
        if let Err(message) = self
            .description
            .validate_optional("la description", MAX_DESCRIPTION_LENGTH)
        {
            return fail(message);
        }
        if self.params.len() > MAX_PARAMS {
            return fail(format!("{MAX_PARAMS} réglages au maximum"));
        }

        let mut ids = HashSet::new();
        for param in &self.params {
            if !is_valid_param_id(&param.id) {
                return fail(format!(
                    "identifiant de réglage « {} » invalide (lettres, chiffres et _)",
                    param.id
                ));
            }
            if !ids.insert(param.id.as_str()) {
                return fail(format!("réglage « {} » en double", param.id));
            }
            if let Err(message) = param
                .label
                .validate(&format!("le libellé de « {} »", param.id), MAX_LABEL_LENGTH)
            {
                return fail(message);
            }
            if let Some(section) = &param.section
                && let Err(message) =
                    section.validate(&format!("la section de « {} »", param.id), MAX_LABEL_LENGTH)
            {
                return fail(message);
            }
            validate_kind(&param.id, &param.kind)?;
            if param.from_look && !matches!(param.kind, ParamKind::Text { .. }) {
                return fail(format!(
                    "« {} » : fromLook ne s'applique qu'à un texte",
                    param.id
                ));
            }
        }

        for param in &self.params {
            if let Some(condition) = &param.visible_if
                && !ids.contains(condition.param.as_str())
            {
                return fail(format!(
                    "« {} » dépend du réglage inconnu « {} »",
                    param.id, condition.param
                ));
            }

            if let ParamKind::Choice { options, .. } = &param.kind {
                self.validate_sets(&param.id, options)?;
            }
        }

        Ok(())
    }

    fn validate_sets(&self, owner: &str, options: &[ChoiceOption]) -> Result<(), FrameError> {
        for option in options {
            for (target, value) in &option.sets {
                let Some(param) = self.params.iter().find(|p| &p.id == target) else {
                    return Err(FrameError::Manifest(format!(
                        "le choix « {} » de « {owner} » règle « {target} », qui n'existe pas",
                        option.id
                    )));
                };
                if param.kind.coerce(Some(value)) != *value {
                    return Err(FrameError::Manifest(format!(
                        "le choix « {} » de « {owner} » donne à « {target} » une valeur refusée : {value}",
                        option.id
                    )));
                }
            }
        }
        Ok(())
    }
}

fn validate_kind(id: &str, kind: &ParamKind) -> Result<(), FrameError> {
    let fail = |message: String| Err(FrameError::Manifest(format!("« {id} » : {message}")));

    match kind {
        ParamKind::Number {
            min,
            max,
            step,
            default,
            ..
        } => {
            if ![min, max, step, default].iter().all(|v| v.is_finite()) {
                return fail("valeurs numériques non finies".into());
            }
            if min >= max || *step <= 0.0 {
                return fail("il faut min < max et un pas positif".into());
            }
            if default < min || default > max {
                return fail("la valeur par défaut sort des bornes".into());
            }
        }
        ParamKind::Color { default } => {
            if !is_hex_color(default) {
                return fail(format!(
                    "couleur par défaut « {default} » invalide (#rrggbb)"
                ));
            }
        }
        ParamKind::Bool { .. } => {}
        ParamKind::Text {
            default,
            max_length,
        } => {
            if *max_length == 0 || *max_length > MAX_TEXT_LENGTH {
                return fail(format!("maxLength doit être entre 1 et {MAX_TEXT_LENGTH}"));
            }
            if default.chars().count() > *max_length {
                return fail("le texte par défaut dépasse maxLength".into());
            }
        }
        ParamKind::Choice {
            default, options, ..
        } => {
            if options.is_empty() || options.len() > MAX_OPTIONS {
                return fail(format!("entre 1 et {MAX_OPTIONS} choix"));
            }
            let mut seen = HashSet::new();
            for option in options {
                if !is_valid_option_id(&option.id) || !seen.insert(option.id.as_str()) {
                    return fail(format!(
                        "identifiant de choix « {} » invalide ou en double",
                        option.id
                    ));
                }
                if let Err(message) = option.label.validate(
                    &format!("le libellé du choix « {} »", option.id),
                    MAX_LABEL_LENGTH,
                ) {
                    return fail(message);
                }
            }
            if !options.iter().any(|option| &option.id == default) {
                return fail(format!("le choix par défaut « {default} » n'existe pas"));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn parse(value: Value) -> FrameManifest {
        serde_json::from_value(value).expect("manifeste lisible")
    }

    fn sample() -> Value {
        json!({
            "id": "sample",
            "name": "Exemple",
            "params": [
                { "id": "width", "label": "Épaisseur", "type": "number",
                  "min": 1, "max": 30, "step": 0.5, "unit": "%", "default": 4 },
                { "id": "color", "label": "Couleur", "type": "color", "default": "#ffffff" },
                { "id": "visible", "label": "Visible", "type": "bool", "default": true },
                { "id": "text", "label": "Texte", "type": "text", "default": "ABC", "maxLength": 5 },
                { "id": "stock", "label": "Pellicule", "type": "choice", "default": "a",
                  "options": [
                    { "id": "a", "label": "A", "sets": { "color": "#000000" } },
                    { "id": "b", "label": "B" }
                  ] }
            ]
        })
    }

    #[test]
    fn a_valid_manifest_passes() {
        parse(sample()).validate().unwrap();
    }

    #[test]
    fn manifest_round_trips_through_json() {
        let manifest = parse(sample());
        let again: FrameManifest =
            serde_json::from_value(serde_json::to_value(&manifest).unwrap()).unwrap();
        assert_eq!(again.params.len(), 5);
        assert!(matches!(again.params[0].kind, ParamKind::Number { .. }));
    }

    #[test]
    fn resolve_clamps_coerces_and_ignores_unknown_keys() {
        let manifest = parse(sample());
        let input = json!({
            "width": 999,
            "color": "red; </svg>",
            "visible": "yes",
            "text": "TOO LONG TEXT",
            "stock": "unknown",
            "evil": "x"
        });
        let resolved = manifest.resolve(input.as_object().unwrap());

        assert_eq!(resolved["width"], json!(30.0));
        assert_eq!(resolved["color"], json!("#ffffff"));
        assert_eq!(resolved["visible"], json!(true));
        assert_eq!(resolved["text"], json!("TOO L"));
        assert_eq!(resolved["stock"], json!("a"));
        assert!(!resolved.contains_key("evil"));
    }

    #[test]
    fn resolve_uses_defaults_when_missing() {
        let manifest = parse(sample());
        assert_eq!(manifest.resolve(&Map::new()), manifest.defaults());
    }

    #[test]
    fn colors_are_lowercased() {
        let manifest = parse(sample());
        let resolved = manifest.resolve(json!({ "color": "#AABBCC" }).as_object().unwrap());
        assert_eq!(resolved["color"], json!("#aabbcc"));
    }

    #[test]
    fn invalid_manifests_are_rejected() {
        let cases = [
            ("Bad ID", json!({"id": "Bad ID", "name": "x"})),
            ("id vide", json!({"id": "", "name": "x"})),
            ("nom vide", json!({"id": "ok", "name": "  "})),
            (
                "défaut hors bornes",
                json!({"id":"ok","name":"x","params":[{"id":"a","label":"A","type":"number","min":0,"max":1,"step":0.1,"default":5}]}),
            ),
            (
                "min >= max",
                json!({"id":"ok","name":"x","params":[{"id":"a","label":"A","type":"number","min":2,"max":1,"step":0.1,"default":1}]}),
            ),
            (
                "couleur invalide",
                json!({"id":"ok","name":"x","params":[{"id":"a","label":"A","type":"color","default":"red"}]}),
            ),
            (
                "id de réglage invalide",
                json!({"id":"ok","name":"x","params":[{"id":"1a","label":"A","type":"bool","default":true}]}),
            ),
            (
                "réglage en double",
                json!({"id":"ok","name":"x","params":[
                    {"id":"a","label":"A","type":"bool","default":true},
                    {"id":"a","label":"B","type":"bool","default":true}]}),
            ),
            (
                "choix par défaut inconnu",
                json!({"id":"ok","name":"x","params":[{"id":"a","label":"A","type":"choice","default":"z","options":[{"id":"y","label":"Y"}]}]}),
            ),
            (
                "condition sur réglage inconnu",
                json!({"id":"ok","name":"x","params":[{"id":"a","label":"A","type":"bool","default":true,"visibleIf":{"param":"nope","equals":true}}]}),
            ),
            (
                "sets vers réglage inconnu",
                json!({"id":"ok","name":"x","params":[{"id":"a","label":"A","type":"choice","default":"y","options":[{"id":"y","label":"Y","sets":{"nope":1}}]}]}),
            ),
            (
                "sets avec valeur refusée",
                json!({"id":"ok","name":"x","params":[
                    {"id":"c","label":"C","type":"color","default":"#000000"},
                    {"id":"a","label":"A","type":"choice","default":"y","options":[{"id":"y","label":"Y","sets":{"c":"pas une couleur"}}]}]}),
            ),
        ];

        for (name, value) in cases {
            let manifest: FrameManifest = serde_json::from_value(value).expect("lisible");
            assert!(manifest.validate().is_err(), "devrait être refusé : {name}");
        }
    }
}

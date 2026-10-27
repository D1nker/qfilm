//! Tests d'images de référence : le rendu est déterministe, une image synthétique doit redonner
//! les mêmes pixels. Après un changement voulu : `UPDATE_GOLDEN=1 cargo test golden`, puis relire
//! les PNG. Un échec écrit l'image obtenue dans `target/golden-failures/` à la racine du dépôt.

use std::path::PathBuf;
use std::sync::LazyLock;

use serde_json::{Map, Value, json};

use super::buffer::ImageBuf;
use super::caption::Caption;
use super::encode;
use super::fonts::FontChoice as CaptionFont;
use super::frame::{FrameRegistry, FrameSelection, ParamKind};
use super::render::{self, RenderParams};

/// Deux machines n'arrondissent pas tout à fait pareil : on tolère quelques niveaux
/// d'écart sur très peu de pixels, jamais une vraie différence de dessin.
const CHANNEL_TOLERANCE: u8 = 3;
const MAX_DIFFERING_RATIO: f32 = 0.001;
const MAX_DIFFERENCE: u8 = 40;

fn golden_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("golden")
}

fn hue(h: f32, value: f32) -> [f32; 3] {
    let channel = |offset: f32| {
        ((h * 6.0 + offset).rem_euclid(6.0) - 3.0)
            .abs()
            .clamp(1.0, 2.0)
            - 1.0
    };
    [1.0 - channel(0.0), 1.0 - channel(4.0), 1.0 - channel(2.0)].map(|c| c * value)
}

/// Scène synthétique : ciel, sol, blocs de couleur, soleil plus clair que le blanc, rampe de gris
/// 0–2 et arc-en-ciel (sans eux, un changement de courbe de tons passerait inaperçu).
fn scene(width: u32, height: u32) -> ImageBuf {
    let mut image = ImageBuf::new(width, height);
    let (w, h) = (width as f32, height as f32);

    for y in 0..height {
        for x in 0..width {
            let (fx, fy) = (x as f32 / w, y as f32 / h);
            let mut rgb = if fy < 0.6 {
                [
                    0.15 + 0.5 * (1.0 - fy),
                    0.35 + 0.35 * (1.0 - fy),
                    0.8 - 0.2 * fy,
                ]
            } else {
                [0.12 + 0.1 * fx, 0.18, 0.08 + 0.05 * fx]
            };

            if (0.1..0.3).contains(&fx) && (0.5..0.78).contains(&fy) {
                rgb = [0.7, 0.12, 0.1];
            }
            if (0.4..0.55).contains(&fx) && (0.6..0.8).contains(&fy) {
                rgb = [0.1, 0.5, 0.2];
            }
            if (0.82..0.91).contains(&fy) {
                rgb = [fx * 2.0; 3];
            } else if fy >= 0.91 {
                rgb = hue(fx, 0.9);
            }
            let sun = ((x as f32 - 0.72 * w).powi(2) + (y as f32 - 0.25 * h).powi(2)).sqrt();
            if sun < 0.08 * w.min(h) * 2.0 {
                rgb = [1.8, 1.6, 1.1];
            }

            let i = ((y * width + x) * 3) as usize;
            image.data[i..i + 3].copy_from_slice(&rgb);
        }
    }
    image
}

// Dimensions « pas rondes » : avec 300×200, 6 % et 14 % tombent juste et les erreurs d'arrondi
// des marges passeraient inaperçues.
fn landscape() -> ImageBuf {
    scene(301, 197)
}

fn portrait() -> ImageBuf {
    scene(197, 301)
}

fn assert_golden(name: &str, image: &ImageBuf) {
    let actual = encode::to_srgb8(image);
    let path = golden_dir().join(format!("{name}.png"));

    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::create_dir_all(golden_dir()).unwrap();
        image::RgbImage::from_raw(image.width, image.height, actual)
            .unwrap()
            .save(&path)
            .unwrap();
        return;
    }

    let expected = image::open(&path)
        .unwrap_or_else(|_| {
            panic!(
                "référence absente : {}\nLa générer avec `UPDATE_GOLDEN=1 cargo test golden`.",
                path.display()
            )
        })
        .to_rgb8();

    assert_eq!(
        (expected.width(), expected.height()),
        (image.width, image.height),
        "{name} : dimensions différentes de la référence"
    );

    let mut differing = 0usize;
    let mut worst = 0u8;
    for (got, want) in actual.iter().zip(expected.as_raw()) {
        let difference = got.abs_diff(*want);
        worst = worst.max(difference);
        if difference > CHANNEL_TOLERANCE {
            differing += 1;
        }
    }

    let ratio = differing as f32 / actual.len() as f32;
    if ratio > MAX_DIFFERING_RATIO || worst > MAX_DIFFERENCE {
        let failures =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/golden-failures");
        std::fs::create_dir_all(&failures).unwrap();
        let output = failures.join(format!("{name}.png"));
        image::RgbImage::from_raw(image.width, image.height, actual)
            .unwrap()
            .save(&output)
            .unwrap();

        panic!(
            "{name} : {:.3} % des valeurs diffèrent (écart max {worst}).\nObtenu : {}\nRéférence : {}",
            ratio * 100.0,
            output.display(),
            path.display()
        );
    }
}

static REGISTRY: LazyLock<FrameRegistry> = LazyLock::new(FrameRegistry::builtin);

fn object(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

fn select(id: &str, params: Value) -> FrameSelection {
    FrameSelection {
        id: id.into(),
        params: object(params),
    }
}

fn film_frame(id: &str, stock: &str, extra: Value) -> FrameSelection {
    let manifest = &REGISTRY.get(id).expect("cadre livré").manifest;

    let mut params: Map<String, Value> = manifest.defaults();
    params.insert("stock".into(), json!(stock));
    for param in &manifest.params {
        if let ParamKind::Choice { options, .. } = &param.kind
            && let Some(option) = options.iter().find(|option| option.id == stock)
        {
            params.extend(option.sets.clone());
        }
    }
    params.extend(object(extra));

    FrameSelection {
        id: id.into(),
        params,
    }
}

fn caption(text: &str, color: &str) -> Caption {
    Caption {
        text: text.into(),
        color: color.into(),
        ..Caption::default()
    }
}

macro_rules! golden_frame {
    ($name:ident, $image:expr, $selection:expr, $caption:expr) => {
        #[test]
        fn $name() {
            let rendered = REGISTRY
                .render_with_caption(&$image, &$selection, &$caption)
                .expect("rendu");
            assert_golden(stringify!($name), &rendered.image);
        }
    };
}

golden_frame!(
    frame_none,
    landscape(),
    FrameSelection::default(),
    Caption::default()
);
golden_frame!(
    frame_solid_white,
    landscape(),
    select("solid", json!({ "width": 6 })),
    Caption::default()
);
golden_frame!(
    frame_solid_black_caption,
    landscape(),
    select("solid", json!({ "width": 6, "color": "#000000" })),
    caption("Biarritz, août 2026", "#ffffff")
);
golden_frame!(
    frame_instant_caption,
    landscape(),
    select("instant", json!({})),
    Caption {
        text: "Été 2026".into(),
        font: CaptionFont::Handwritten,
        size: 5.0,
        color: "#23262b".into(),
        ..Caption::default()
    }
);
golden_frame!(
    frame_instant_portrait,
    portrait(),
    select("instant", json!({})),
    Caption::default()
);

golden_frame!(
    frame_film35_amber,
    landscape(),
    film_frame("film35", "amber", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_white,
    landscape(),
    film_frame("film35", "white", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_minimal,
    landscape(),
    film_frame("film35", "minimal", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_green,
    landscape(),
    film_frame("film35", "green", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_red,
    landscape(),
    film_frame("film35", "red", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_cine,
    landscape(),
    film_frame("film35", "cine", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_plain,
    landscape(),
    film_frame("film35", "plain", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_portrait,
    portrait(),
    film_frame("film35", "amber", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film35_no_sprockets,
    landscape(),
    film_frame("film35", "amber", json!({ "sprockets": false })),
    Caption::default()
);
golden_frame!(
    frame_film35_caption,
    landscape(),
    film_frame("film35", "amber", json!({})),
    Caption {
        text: "Biarritz".into(),
        font: CaptionFont::Typewriter,
        ..Caption::default()
    }
);
golden_frame!(
    frame_film120_amber,
    landscape(),
    film_frame("film120", "amber", json!({})),
    Caption::default()
);
golden_frame!(
    frame_film120_portrait,
    portrait(),
    film_frame("film120", "minimal", json!({})),
    Caption::default()
);

golden_frame!(
    frame_letterbox_cinemascope,
    landscape(),
    select("letterbox", json!({})),
    caption("Il était une fois…", "#f2f2f2")
);
golden_frame!(
    frame_letterbox_no_bars_needed,
    scene(301, 90),
    select("letterbox", json!({})),
    Caption::default()
);
golden_frame!(
    frame_padding_square,
    landscape(),
    select("padding", json!({})),
    caption("Biarritz", "#1a1a1a")
);
golden_frame!(
    frame_padding_portrait45,
    landscape(),
    select(
        "padding",
        json!({ "ratio": "portrait45", "color": "#101010" })
    ),
    Caption::default()
);
golden_frame!(
    frame_padding_story_from_portrait,
    portrait(),
    select("padding", json!({ "ratio": "story", "padding": 0 })),
    Caption::default()
);

#[test]
fn frame_zones_stay_inside_the_canvas() {
    for image in [landscape(), portrait()] {
        let rendered = REGISTRY
            .render(&image, &film_frame("film35", "amber", json!({})))
            .expect("rendu");
        let (width, height) = (rendered.image.width as f32, rendered.image.height as f32);

        let fields: Vec<&str> = rendered
            .zones
            .iter()
            .map(|zone| zone.field.as_str())
            .collect();
        assert!(
            fields.contains(&"text") && fields.contains(&"frameNumber"),
            "{fields:?}"
        );

        for zone in &rendered.zones {
            assert!(zone.x >= 0.0 && zone.y >= 0.0, "{zone:?}");
            assert!(zone.x + zone.width <= width + 1.0, "{zone:?}");
            assert!(zone.y + zone.height <= height + 1.0, "{zone:?}");
        }

        let (cx, cy) = rendered.caption_center;
        assert!((0.0..=1.0).contains(&cx) && (0.0..=1.0).contains(&cy));
    }
}

/// Réglages fixes, indépendants des presets, que l'on affine à l'œil.
macro_rules! golden_look {
    ($name:ident, $params:expr) => {
        #[test]
        fn $name() {
            assert_golden(stringify!($name), &render::apply(&landscape(), &$params));
        }
    };
}

golden_look!(look_neutral, RenderParams::default());
golden_look!(
    look_exposure_and_white_balance,
    RenderParams {
        exposure: 0.8,
        temperature: 0.4,
        tint: -0.2,
        ..RenderParams::default()
    }
);
golden_look!(
    look_contrast_and_color,
    RenderParams {
        contrast: 0.4,
        highlights: -0.5,
        shadows: 0.4,
        saturation: -0.3,
        vibrance: 0.5,
        ..RenderParams::default()
    }
);
golden_look!(
    look_grain,
    RenderParams {
        grain: 0.6,
        grain_size: 3.0,
        lift: 0.3,
        ..RenderParams::default()
    }
);
golden_look!(
    look_halation_clarity_vignette,
    RenderParams {
        halation: 0.7,
        clarity: 0.5,
        vignette: 0.6,
        ..RenderParams::default()
    }
);

#[test]
fn rendering_is_deterministic() {
    let params = RenderParams {
        grain: 0.8,
        halation: 0.5,
        clarity: 0.3,
        ..RenderParams::default()
    };
    let first = render::apply(&landscape(), &params);
    let second = render::apply(&landscape(), &params);
    assert_eq!(first.data, second.data);
}

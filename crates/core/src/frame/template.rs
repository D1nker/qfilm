//! Gabarit SVG d'un cadre (syntaxe Jinja). Il peut venir d'un fichier importé : environnement
//! borné (variables indéfinies refusées, budget d'instructions), sans accès disque ni réseau.
//! Voir `docs/FRAMES.md`.

use std::fmt::Write;

use minijinja::value::{Serde, Value};
use minijinja::{AutoEscape, Environment, Error, ErrorKind, UndefinedBehavior, context};
use serde_json::{Map, Value as Json};

use super::FrameError;
use crate::buffer::srgb_to_linear;
use crate::fonts::{self, FontChoice};

const TEMPLATE_NAME: &str = "frame.svg";

const FUEL: u64 = 5_000_000;

pub struct FrameTemplate {
    environment: Environment<'static>,
}

impl FrameTemplate {
    pub fn compile(source: String) -> Result<Self, FrameError> {
        let mut environment = Environment::new();
        environment.set_auto_escape_callback(|_| AutoEscape::Html);
        environment.set_undefined_behavior(UndefinedBehavior::Strict);
        environment.set_fuel(Some(FUEL));
        register_helpers(&mut environment);

        environment
            .add_template_owned(TEMPLATE_NAME, source)
            .map_err(|error| FrameError::Template(describe(&error)))?;

        Ok(Self { environment })
    }

    pub fn render(
        &self,
        width: u32,
        height: u32,
        params: &Map<String, Json>,
    ) -> Result<String, FrameError> {
        let context = context! {
            photo => context! {
                w => width,
                h => height,
                short => width.min(height),
                long => width.max(height),
                portrait => height > width,
            },
            p => Value::from(Serde(params)),
        };

        self.environment
            .get_template(TEMPLATE_NAME)
            .and_then(|template| template.render(context))
            .map_err(|error| FrameError::Template(describe(&error)))
    }
}

fn describe(error: &Error) -> String {
    match error.line() {
        Some(line) => format!("{error} (ligne {line})"),
        None => error.to_string(),
    }
}

fn font_arg(name: &str) -> Result<FontChoice, Error> {
    FontChoice::from_name(name).ok_or_else(|| {
        Error::new(
            ErrorKind::InvalidOperation,
            format!("police inconnue « {name} » (condensed, typewriter ou handwritten)"),
        )
    })
}

fn color_luma(hex: &str) -> f32 {
    let value = u32::from_str_radix(hex.trim().trim_start_matches('#'), 16).unwrap_or(0);
    let channel = |shift: u32| srgb_to_linear(((value >> shift) & 0xFF) as f32 / 255.0);
    0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
}

fn frame_sequence(seed: &str) -> String {
    let digits: String = seed.chars().filter(char::is_ascii_digit).collect();
    match digits.parse::<u32>() {
        Ok(n) => format!("{n}    {n}A    {}    {}A", n + 1, n + 1),
        Err(_) => seed.to_uppercase(),
    }
}

fn barcode(seed: &str, x: f32, y: f32, width: f32, height: f32) -> String {
    let mut state: u32 = seed.bytes().fold(0x811c_9dc5u32, |acc, byte| {
        (acc ^ u32::from(byte)).wrapping_mul(16_777_619)
    });

    let unit = (height * 0.28).max(1.0);
    let mut path = String::new();
    let mut cursor = x;

    while cursor < x + width {
        state = state.wrapping_mul(1_103_515_245).wrapping_add(12_345);
        let bar = unit * (((state >> 16) & 0x3) as f32 + 1.0);
        if (state >> 20) & 1 == 1 {
            let _ = write!(
                path,
                "M{} {}h{}v{}h-{}z",
                cursor.floor(),
                y.floor(),
                bar.max(1.0).floor(),
                height.floor(),
                bar.max(1.0).floor(),
            );
        }
        cursor += bar;
    }

    format!("<path d=\"{path}\"/>")
}

fn register_helpers(environment: &mut Environment<'static>) {
    environment.add_function(
        "text_width",
        |text: String, font: String, px: f64, tracking: f64| -> Result<f64, Error> {
            Ok(f64::from(fonts::text_width(
                font_arg(&font)?,
                &text,
                px as f32,
                tracking as f32,
            )))
        },
    );
    environment.add_function("em", |font: String, px: f64| -> Result<f64, Error> {
        Ok(f64::from(fonts::em_size(font_arg(&font)?, px as f32)))
    });
    environment.add_function("ascent", |font: String, px: f64| -> Result<f64, Error> {
        Ok(f64::from(fonts::ascent(font_arg(&font)?, px as f32)))
    });
    environment.add_function("font_family", |font: String| -> Result<String, Error> {
        Ok(font_arg(&font)?.family().to_string())
    });
    environment.add_function("is_dark", |color: String| color_luma(&color) < 0.2);
    environment.add_function(
        "barcode",
        |seed: String, x: f64, y: f64, width: f64, height: f64| {
            Value::from_safe_string(barcode(
                &seed,
                x as f32,
                y as f32,
                width as f32,
                height as f32,
            ))
        },
    );
    environment.add_filter("frame_sequence", |text: String| frame_sequence(&text));
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn render(source: &str, params: &Json) -> Result<String, FrameError> {
        FrameTemplate::compile(source.to_string())?.render(300, 200, params.as_object().unwrap())
    }

    #[test]
    fn computes_layout_from_the_photo_size() {
        let svg = render(
            "{{ photo.w + 2 * p.m }}x{{ photo.h }} {{ photo.short }} {{ photo.portrait }}",
            &json!({ "m": 10 }),
        )
        .unwrap();
        assert_eq!(svg, "320x200 200 False");
    }

    #[test]
    fn user_text_is_escaped() {
        let svg = render("<text>{{ p.t }}</text>", &json!({ "t": "Tom & <Jerry>" })).unwrap();
        assert!(svg.contains("Tom &amp; &lt;Jerry&gt;"), "{svg}");
    }

    #[test]
    fn undefined_variables_are_errors_not_blanks() {
        let error = render("{{ p.missing }}", &json!({})).unwrap_err();
        assert!(matches!(error, FrameError::Template(_)), "{error}");
    }

    #[test]
    fn syntax_errors_are_reported_with_a_line() {
        let error = FrameTemplate::compile("ok\n{% if %}".into()).err().unwrap();
        assert!(error.to_string().contains("ligne 2"), "{error}");
    }

    #[test]
    fn runaway_loops_are_stopped() {
        let error = render(
            "{% for i in range(100000000) %}{{ i }}{% endfor %}",
            &json!({}),
        )
        .unwrap_err();
        assert!(matches!(error, FrameError::Template(_)), "{error}");
    }

    #[test]
    fn helpers_are_available() {
        let svg = render(
            "{{ font_family('condensed') }}|{{ is_dark('#000000') }}|{{ is_dark('#ffffff') }}|{{ '24'|frame_sequence }}|{{ text_width('AB', 'condensed', 20, 0) > 0 }}|{{ em('condensed', 100) < 100 }}",
            &json!({}),
        )
        .unwrap();
        assert_eq!(
            svg,
            "Roboto Condensed|True|False|24    24A    25    25A|True|True"
        );
    }

    #[test]
    fn unknown_font_is_an_error() {
        assert!(render("{{ em('comic', 10) }}", &json!({})).is_err());
    }

    #[test]
    fn barcode_is_deterministic_and_seeded() {
        let render_bars = |seed: &str| {
            render(
                &format!("{{{{ barcode('{seed}', 0, 0, 200, 20) }}}}"),
                &json!({}),
            )
            .unwrap()
        };
        assert_eq!(render_bars("AMBRE"), render_bars("AMBRE"));
        assert_ne!(render_bars("AMBRE"), render_bars("BLANC"));
        assert!(render_bars("AMBRE").starts_with("<path d=\"M"));
    }
}

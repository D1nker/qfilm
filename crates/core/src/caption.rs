//! La légende, dessinée ici à l'export seulement : dans l'aperçu, c'est le webview qui la trace,
//! ce qui la rend modifiable sans nouveau rendu.

use ab_glyph::{Font, PxScale, ScaleFont, point};
use serde::{Deserialize, Serialize};

use super::buffer::{ImageBuf, srgb_to_linear};
use super::fonts::{FontChoice, face, text_width};
use super::frame::TextZone;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(default, rename_all = "camelCase")]
pub struct Caption {
    pub text: String,
    pub font: FontChoice,
    /// En % du petit côté de l'image finale.
    pub size: f32,
    pub color: String,
    /// Centre de la légende en fractions de l'image finale ; `None` = position par défaut.
    pub x: Option<f32>,
    pub y: Option<f32>,
}

impl Default for Caption {
    fn default() -> Self {
        Self {
            text: String::new(),
            font: FontChoice::Condensed,
            size: 4.0,
            color: "#ffffff".into(),
            x: None,
            y: None,
        }
    }
}

pub fn draw(canvas: &mut ImageBuf, caption: &Caption, default_center: (f32, f32)) -> TextZone {
    let short_edge = canvas.width.min(canvas.height) as f32;
    let px = (short_edge * (caption.size / 100.0)).max(4.0);

    let face = face(caption.font);
    let scaled = face.as_scaled(PxScale::from(px));
    let height = scaled.ascent() - scaled.descent();

    let center_x = caption.x.unwrap_or(default_center.0) * canvas.width as f32;
    let center_y = caption.y.unwrap_or(default_center.1) * canvas.height as f32;

    let is_empty = caption.text.trim().is_empty();
    let width = if is_empty {
        canvas.width as f32 * 0.3
    } else {
        text_width(caption.font, &caption.text, px, 0.0)
    };

    let x = center_x - width / 2.0;
    let y = center_y - height / 2.0;

    if !is_empty {
        draw_text(
            canvas,
            &caption.text,
            x,
            y,
            px,
            parse_hex(&caption.color),
            caption.font,
        );
    }

    TextZone {
        field: "caption".into(),
        x,
        y,
        width,
        height,
    }
}

fn draw_text(
    canvas: &mut ImageBuf,
    text: &str,
    x: f32,
    y: f32,
    px: f32,
    color: [f32; 3],
    choice: FontChoice,
) {
    let face = face(choice);
    let scaled = face.as_scaled(PxScale::from(px));
    let baseline = y + scaled.ascent();
    let mut cursor = x;

    for character in text.chars() {
        let id = face.glyph_id(character);
        let glyph = id.with_scale_and_position(PxScale::from(px), point(cursor, baseline));

        if let Some(outlined) = face.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|gx, gy, coverage| {
                blend_pixel(
                    canvas,
                    bounds.min.x as i64 + i64::from(gx),
                    bounds.min.y as i64 + i64::from(gy),
                    color,
                    coverage,
                );
            });
        }

        cursor += scaled.h_advance(id);
    }
}

fn parse_hex(hex: &str) -> [f32; 3] {
    let cleaned = hex.trim().trim_start_matches('#');
    let value = u32::from_str_radix(cleaned, 16).unwrap_or(0x00ff_ffff);
    [
        srgb_to_linear(((value >> 16) & 0xFF) as f32 / 255.0),
        srgb_to_linear(((value >> 8) & 0xFF) as f32 / 255.0),
        srgb_to_linear((value & 0xFF) as f32 / 255.0),
    ]
}

fn blend_pixel(image: &mut ImageBuf, x: i64, y: i64, color: [f32; 3], alpha: f32) {
    if x < 0 || y < 0 || x >= i64::from(image.width) || y >= i64::from(image.height) {
        return;
    }
    let alpha = alpha.clamp(0.0, 1.0);
    let index = ((y as usize) * (image.width as usize) + x as usize) * 3;
    for (dst, src) in image.data[index..index + 3].iter_mut().zip(color) {
        *dst = *dst * (1.0 - alpha) + src * alpha;
    }
}

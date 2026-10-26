use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use super::buffer::{ImageBuf, linear_to_srgb, srgb_to_linear};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RenderParams {
    /// En diaphragmes (EV).
    pub exposure: f32,
    pub contrast: f32,
    /// Récupération (-1) ou éclairement (+1) des hautes lumières.
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub saturation: f32,
    /// Saturation qui épargne les couleurs déjà vives.
    pub vibrance: f32,
    /// Froid (-1) vers chaud (+1).
    pub temperature: f32,
    /// Vert (-1) vers magenta (+1).
    pub tint: f32,
    pub clarity: f32,
    pub lift: f32,
    pub halation: f32,
    pub grain: f32,
    pub grain_size: f32,
    pub vignette: f32,
}

impl Default for RenderParams {
    fn default() -> Self {
        Self {
            exposure: 0.0,
            contrast: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            saturation: 0.0,
            vibrance: 0.0,
            temperature: 0.0,
            tint: 0.0,
            clarity: 0.0,
            lift: 0.0,
            halation: 0.0,
            grain: 0.0,
            grain_size: 2.0,
            vignette: 0.0,
        }
    }
}

const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

pub fn apply(source: &ImageBuf, params: &RenderParams) -> ImageBuf {
    let mut img = source.clone();

    apply_exposure_and_white_balance(&mut img, params);

    if params.halation > 0.001 {
        apply_halation(&mut img, params.halation);
    }

    if params.clarity.abs() > 0.001 {
        apply_clarity(&mut img, params.clarity);
    }

    apply_tone_and_color(&mut img, params);

    if params.vignette.abs() > 0.001 {
        apply_vignette(&mut img, params.vignette);
    }

    if params.grain > 0.001 {
        apply_grain(&mut img, params.grain, params.grain_size);
    }

    img.data.par_iter_mut().for_each(|c| *c = shoulder(*c));
    img
}

/// Épaulement doux au lieu d'un écrêtage franc : les hautes lumières se tassent
/// progressivement vers le blanc au lieu de virer à l'aplat.
fn shoulder(value: f32) -> f32 {
    const KNEE: f32 = 0.8;
    if value <= KNEE {
        value.max(0.0)
    } else {
        KNEE + (1.0 - KNEE) * (1.0 - (-(value - KNEE) / (1.0 - KNEE)).exp())
    }
}

fn luma_of(pixel: &[f32]) -> f32 {
    LUMA[0] * pixel[0] + LUMA[1] * pixel[1] + LUMA[2] * pixel[2]
}

fn apply_exposure_and_white_balance(img: &mut ImageBuf, p: &RenderParams) {
    let mut gains = [
        1.0 + 0.18 * p.temperature,
        1.0 - 0.10 * p.tint,
        1.0 - 0.18 * p.temperature,
    ];

    // Sans cette normalisation, réchauffer une image l'éclaircirait au passage.
    let weighted = (LUMA[0] * gains[0] + LUMA[1] * gains[1] + LUMA[2] * gains[2]).max(1e-5);
    let exposure = 2f32.powf(p.exposure) / weighted;
    for gain in &mut gains {
        *gain *= exposure;
    }

    img.data.par_chunks_mut(3).for_each(|px| {
        for (channel, gain) in px.iter_mut().zip(gains) {
            *channel *= gain;
        }
    });
}

/// Courbe appliquée à la seule luminance ; les canaux sont ensuite mis à
/// l'échelle, ce qui préserve la teinte au lieu de sursaturer.
fn tone_curve(linear: f32, p: &RenderParams, gamma: f32) -> f32 {
    // Pivot à 18 % de gris : le contraste s'ouvre autour du gris moyen.
    const PIVOT: f32 = 0.18;
    let contrasted = PIVOT * (linear.max(0.0) / PIVOT).powf(gamma);

    // Les masques suivent la perception, pas la lumière physique.
    let mut v = linear_to_srgb(contrasted);
    let mask = v.clamp(0.0, 1.0);

    v += p.shadows * 2.0 * (1.0 - mask).powi(2) * mask;
    v += p.highlights * 2.0 * mask * mask * (1.0 - mask);
    v += p.whites * 0.2 * mask.powi(4);

    srgb_to_linear(v.max(0.0))
}

fn apply_tone_and_color(img: &mut ImageBuf, p: &RenderParams) {
    // Puissance de 2 plutôt que 1 + c : sans ça le curseur agit deux fois plus
    // fort vers la gauche que vers la droite.
    let gamma = 2f32.powf(p.contrast);
    let black_point = p.lift * 0.06 + p.blacks * 0.02;
    let saturation = 1.0 + p.saturation;

    img.data.par_chunks_mut(3).for_each(|px| {
        let luma_in = luma_of(px).max(1e-5);
        let ratio = tone_curve(luma_in, p, gamma) / luma_in;
        for channel in px.iter_mut() {
            *channel *= ratio;
        }

        // Additif, sinon un pixel parfaitement noir ne pourrait jamais être relevé.
        if black_point.abs() > 1e-6 {
            for channel in px.iter_mut() {
                *channel = black_point + *channel * (1.0 - black_point);
            }
        }

        let luma = luma_of(px);
        let peak = px[0].max(px[1]).max(px[2]);
        let current = if peak > 1e-5 {
            (peak - px[0].min(px[1]).min(px[2])) / peak
        } else {
            0.0
        };
        let amount = saturation + p.vibrance * (1.0 - current);

        for channel in px.iter_mut() {
            *channel = luma + (*channel - luma) * amount;
        }
    });
}

fn apply_clarity(img: &mut ImageBuf, amount: f32) {
    let (w, h) = (img.width as usize, img.height as usize);

    let mut blurred: Vec<f32> = img.data.chunks(3).map(luma_of).collect();
    let radius = (((w.max(h) as f32) * 0.02).round() as usize).max(1);
    box_blur(&mut blurred, w, h, radius);

    img.data
        .par_chunks_mut(3)
        .zip(blurred.par_iter())
        .for_each(|(px, local)| {
            let luma = luma_of(px).max(1e-5);
            let target = (luma + (luma - local) * amount * 1.5).max(0.0);
            let ratio = target / luma;
            for channel in px.iter_mut() {
                *channel *= ratio;
            }
        });
}

/// Diffusion des hautes lumières dans le rouge : c'est la lumière qui traverse
/// l'émulsion, se réfléchit sur le support et réexpose le film par en dessous.
fn apply_halation(img: &mut ImageBuf, amount: f32) {
    const THRESHOLD: f32 = 0.55;

    let (w, h) = (img.width as usize, img.height as usize);

    let mut mask: Vec<f32> = (0..w * h)
        .map(|i| {
            let luma = LUMA[0] * img.data[i * 3]
                + LUMA[1] * img.data[i * 3 + 1]
                + LUMA[2] * img.data[i * 3 + 2];
            (luma - THRESHOLD).max(0.0)
        })
        .collect();

    let radius = (((w.max(h) as f32) * 0.012).round() as usize).max(1);
    box_blur(&mut mask, w, h, radius);

    for (i, &blurred) in mask.iter().enumerate() {
        let glow = blurred * amount * 1.6;
        img.data[i * 3] += glow;
        img.data[i * 3 + 1] += glow * 0.35;
        img.data[i * 3 + 2] += glow * 0.15;
    }
}

fn box_blur(data: &mut [f32], w: usize, h: usize, radius: usize) {
    let mut temp = vec![0.0f32; w * h];
    let window = (radius * 2 + 1) as f32;

    for y in 0..h {
        let mut sum = 0.0;
        for x in 0..(radius.min(w)) {
            sum += data[y * w + x];
        }
        for x in 0..w {
            let add = (x + radius).min(w - 1);
            let sub = x.saturating_sub(radius + 1);
            sum += data[y * w + add];
            if x > radius {
                sum -= data[y * w + sub];
            }
            temp[y * w + x] = sum / window;
        }
    }

    for x in 0..w {
        let mut sum = 0.0;
        for y in 0..(radius.min(h)) {
            sum += temp[y * w + x];
        }
        for y in 0..h {
            let add = (y + radius).min(h - 1);
            let sub = y.saturating_sub(radius + 1);
            sum += temp[add * w + x];
            if y > radius {
                sum -= temp[sub * w + x];
            }
            data[y * w + x] = sum / window;
        }
    }
}

fn apply_vignette(img: &mut ImageBuf, amount: f32) {
    let (w, h) = (img.width as f32, img.height as f32);
    let (cx, cy) = (w * 0.5, h * 0.5);
    let max_dist = (cx * cx + cy * cy).sqrt();
    let width = img.width as usize;

    img.data.par_chunks_mut(3).enumerate().for_each(|(i, px)| {
        let x = (i % width) as f32;
        let y = (i / width) as f32;
        let dist = ((x - cx).powi(2) + (y - cy).powi(2)).sqrt() / max_dist;
        let falloff = 1.0 - amount * dist.powi(2);
        for c in px.iter_mut() {
            *c *= falloff;
        }
    });
}

/// Bruit déterministe : à réglages identiques, le grain est identique — sinon
/// l'aperçu scintillerait à chaque rendu.
fn hash_noise(x: u32, y: u32) -> f32 {
    let mut h = x
        .wrapping_mul(374_761_393)
        .wrapping_add(y.wrapping_mul(668_265_263));
    h = (h ^ (h >> 13)).wrapping_mul(1_274_126_177);
    h ^= h >> 16;
    (h as f32 / u32::MAX as f32) * 2.0 - 1.0
}

fn apply_grain(img: &mut ImageBuf, amount: f32, size: f32) {
    let width = img.width as usize;
    let cell = size.clamp(1.0, 6.0);

    img.data.par_chunks_mut(3).enumerate().for_each(|(i, px)| {
        let x = ((i % width) as f32 / cell) as u32;
        let y = ((i / width) as f32 / cell) as u32;
        let noise = hash_noise(x, y);

        // Le grain argentique culmine dans les tons moyens et disparaît
        // dans les noirs bouchés comme dans les blancs brûlés.
        let luma = LUMA[0] * px[0] + LUMA[1] * px[1] + LUMA[2] * px[2];
        let weight = 4.0
            * linear_to_srgb(luma.clamp(0.0, 1.0))
            * (1.0 - linear_to_srgb(luma.clamp(0.0, 1.0)));

        let factor = 1.0 + noise * amount * 0.35 * weight;
        for c in px.iter_mut() {
            *c *= factor;
        }
    });
}

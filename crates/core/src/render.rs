use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use super::buffer::{ImageBuf, linear_to_srgb, srgb_to_linear};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
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
    /// Netteté (accentuation locale de la luminance).
    pub sharpening: f32,
    /// Rayon de la netteté, en pixels d'une image de 1 800 px de large (proportionnel au-delà).
    pub sharpen_radius: f32,
    /// Lissage du bruit de luminance, qui épargne les contours.
    pub noise_luminance: f32,
    /// Lissage du bruit de couleur, qui épargne les contours.
    pub noise_color: f32,
    pub lift: f32,
    /// Teinte (0 à 360°) et saturation de l'étalonnage des ombres.
    pub shadows_hue: f32,
    pub shadows_saturation: f32,
    pub midtones_hue: f32,
    pub midtones_saturation: f32,
    pub highlights_hue: f32,
    pub highlights_saturation: f32,
    /// Fait pencher l'étalonnage vers les ombres (-1) ou les hautes lumières (+1).
    pub grading_balance: f32,
    pub halation: f32,
    pub grain: f32,
    pub grain_size: f32,
    /// Grain lisse (0) ou franc, cellule par cellule (1).
    pub grain_roughness: f32,
    pub vignette: f32,
    /// Distance du centre, en fraction du coin, où l'assombrissement commence.
    pub vignette_midpoint: f32,
    /// Transition large et douce (1) ou serrée sur les bords (0).
    pub vignette_feather: f32,
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
            sharpening: 0.0,
            sharpen_radius: 1.0,
            noise_luminance: 0.0,
            noise_color: 0.0,
            lift: 0.0,
            shadows_hue: 0.0,
            shadows_saturation: 0.0,
            midtones_hue: 0.0,
            midtones_saturation: 0.0,
            highlights_hue: 0.0,
            highlights_saturation: 0.0,
            grading_balance: 0.0,
            halation: 0.0,
            grain: 0.0,
            grain_size: 2.0,
            grain_roughness: 1.0,
            vignette: 0.0,
            vignette_midpoint: 0.0,
            vignette_feather: 0.5,
        }
    }
}

const LUMA: [f32; 3] = [0.2126, 0.7152, 0.0722];

pub fn apply(source: &ImageBuf, params: &RenderParams) -> ImageBuf {
    let mut img = source.clone();

    apply_exposure_and_white_balance(&mut img, params);

    if params.noise_luminance > 0.001 || params.noise_color > 0.001 {
        apply_noise_reduction(&mut img, params.noise_luminance, params.noise_color);
    }

    if params.halation > 0.001 {
        apply_halation(&mut img, params.halation);
    }

    if params.clarity.abs() > 0.001 {
        apply_clarity(&mut img, params.clarity);
    }

    apply_tone_and_color(&mut img, params);

    if params.shadows_saturation > 0.001
        || params.midtones_saturation > 0.001
        || params.highlights_saturation > 0.001
    {
        apply_color_grading(&mut img, params);
    }

    if params.sharpening > 0.001 {
        apply_sharpening(&mut img, params.sharpening, params.sharpen_radius);
    }

    if params.vignette.abs() > 0.001 {
        apply_vignette(
            &mut img,
            params.vignette,
            params.vignette_midpoint,
            params.vignette_feather,
        );
    }

    if params.grain > 0.001 {
        apply_grain(
            &mut img,
            params.grain,
            params.grain_size,
            params.grain_roughness,
        );
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

/// Luminance encodée comme à l'écran : les contours et la netteté s'y jugent à la perception, pas à
/// la lumière physique (sinon les hautes lumières se bordent de halos).
fn encoded_luma(img: &ImageBuf) -> Vec<f32> {
    img.data
        .par_chunks(3)
        // Sans plafond à 1 : un soleil plus clair que le blanc doit rester tel quel hors des contours.
        .map(|px| linear_to_srgb(luma_of(px).max(0.0)))
        .collect()
}

/// Flou plus doux qu'un seul passage de boîte : deux passages donnent un profil triangulaire.
fn soft_blur(data: &mut [f32], w: usize, h: usize, radius: usize) {
    box_blur(data, w, h, radius);
    box_blur(data, w, h, radius);
}

fn apply_sharpening(img: &mut ImageBuf, amount: f32, radius: f32) {
    let (w, h) = (img.width as usize, img.height as usize);

    let encoded = encoded_luma(img);
    let mut blurred = encoded.clone();
    let reach = radius.max(0.1) * (w.max(h) as f32 / 1800.0);
    soft_blur(&mut blurred, w, h, (reach.round() as usize).max(1));

    img.data
        .par_chunks_mut(3)
        .zip(encoded.par_iter().zip(blurred.par_iter()))
        .for_each(|(px, (&sharp, &soft))| {
            let luma = luma_of(px).max(1e-5);
            let boosted = (sharp + (sharp - soft) * amount * 2.0).max(0.0);
            let ratio = srgb_to_linear(boosted) / luma;
            for channel in px.iter_mut() {
                *channel *= ratio;
            }
        });
}

/// Lisse le bruit là où l'image est unie et s'abstient sur les contours : plus un pixel s'écarte
/// de son voisinage, moins il est lissé. La couleur se lisse plus franchement que la luminance,
/// l'œil y étant bien moins sensible.
fn apply_noise_reduction(img: &mut ImageBuf, luminance: f32, color: f32) {
    let (w, h) = (img.width as usize, img.height as usize);
    let longest = w.max(h) as f32;
    let radius = |fraction: f32| ((longest * fraction).round() as usize).max(1);

    let encoded = encoded_luma(img);
    let mut surroundings = encoded.clone();
    soft_blur(&mut surroundings, w, h, radius(0.002));
    let tolerance = 0.015 + 0.05 * luminance.max(color);
    let calm: Vec<f32> = encoded
        .par_iter()
        .zip(surroundings.par_iter())
        .map(|(own, around)| (-((own - around) / tolerance).powi(2)).exp())
        .collect();

    let luma: Vec<f32> = img.data.par_chunks(3).map(luma_of).collect();

    let mut smooth_luma = luma.clone();
    if luminance > 0.001 {
        soft_blur(&mut smooth_luma, w, h, radius(0.0015 + 0.003 * luminance));
    }

    let mut chroma: [Vec<f32>; 3] = std::array::from_fn(|channel| {
        img.data
            .chunks(3)
            .zip(&luma)
            .map(|(px, l)| px[channel] - l)
            .collect()
    });
    if color > 0.001 {
        for plane in &mut chroma {
            soft_blur(plane, w, h, radius(0.002 + 0.008 * color));
        }
    }
    let original = img.data.clone();

    img.data.par_chunks_mut(3).enumerate().for_each(|(i, px)| {
        let kept = calm[i];
        let new_luma = luma[i] + (smooth_luma[i] - luma[i]) * luminance * kept;
        for (channel, value) in px.iter_mut().enumerate() {
            let own_chroma = original[i * 3 + channel] - luma[i];
            let new_chroma = own_chroma + (chroma[channel][i] - own_chroma) * color * kept;
            *value = (new_luma + new_chroma).max(0.0);
        }
    });
}

/// La couleur pleine d'une teinte (0 à 360°), puis ce qu'elle a de coloré une fois sa luminosité
/// retirée : un vecteur sans luminance, qui teinte sans éclaircir ni assombrir.
fn tint_vector(hue: f32) -> [f32; 3] {
    let sector = hue.rem_euclid(360.0) / 60.0;
    let rise = 1.0 - (sector % 2.0 - 1.0).abs();
    let rgb = match sector as u32 {
        0 => [1.0, rise, 0.0],
        1 => [rise, 1.0, 0.0],
        2 => [0.0, 1.0, rise],
        3 => [0.0, rise, 1.0],
        4 => [rise, 0.0, 1.0],
        _ => [1.0, 0.0, rise],
    };
    let luma = LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2];
    rgb.map(|c| c - luma)
}

/// Étalonnage en trois zones. Les poids des ombres, des tons moyens et des hautes lumières suivent
/// la luminosité perçue et font toujours 1 ; chaque zone pousse la couleur vers sa teinte.
fn apply_color_grading(img: &mut ImageBuf, p: &RenderParams) {
    const STRENGTH: f32 = 0.4;

    let zones = [
        (tint_vector(p.shadows_hue), p.shadows_saturation),
        (tint_vector(p.midtones_hue), p.midtones_saturation),
        (tint_vector(p.highlights_hue), p.highlights_saturation),
    ];
    let balance = p.grading_balance.clamp(-1.0, 1.0) * 0.25;

    img.data.par_chunks_mut(3).for_each(|px| {
        let encoded = [
            linear_to_srgb(px[0].max(0.0)),
            linear_to_srgb(px[1].max(0.0)),
            linear_to_srgb(px[2].max(0.0)),
        ];
        let level = (LUMA[0] * encoded[0] + LUMA[1] * encoded[1] + LUMA[2] * encoded[2] + balance)
            .clamp(0.0, 1.0);
        let weights = [
            (1.0 - level) * (1.0 - level),
            2.0 * level * (1.0 - level),
            level * level,
        ];

        let mut shift = [0.0f32; 3];
        for ((vector, saturation), weight) in zones.iter().zip(weights) {
            for (channel, offset) in shift.iter_mut().zip(vector) {
                *channel += offset * saturation * weight * STRENGTH;
            }
        }
        for (channel, (value, delta)) in px.iter_mut().zip(encoded.iter().zip(shift)) {
            *channel = srgb_to_linear((value + delta).max(0.0));
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

/// Flou de boîte séparable. Hors de l'image, le bord est prolongé : sans cela, un aplat se
/// ternirait en approchant des bords et clarté, halation ou netteté y dessineraient un halo.
fn box_blur(data: &mut [f32], w: usize, h: usize, radius: usize) {
    let r = radius.cast_signed();
    let window = (2 * radius + 1) as f64;
    let mut temp = vec![0.0f32; w * h];

    for (line, out) in data.chunks(w).zip(temp.chunks_mut(w)) {
        let last = w.cast_signed() - 1;
        let at = |i: isize| f64::from(line[i.clamp(0, last) as usize]);
        let mut sum: f64 = (-r..=r).map(at).sum();
        for (x, value) in out.iter_mut().enumerate() {
            *value = (sum / window) as f32;
            let x = x.cast_signed();
            sum += at(x + r + 1) - at(x - r);
        }
    }

    // Une passe verticale qui avance ligne par ligne, plus sage pour le cache qu'une colonne à la fois.
    let last = h.cast_signed() - 1;
    let row = |y: isize| (y.clamp(0, last) as usize) * w;
    let mut sums: Vec<f64> = (0..w)
        .map(|x| (-r..=r).map(|dy| f64::from(temp[row(dy) + x])).sum())
        .collect();
    for y in 0..h.cast_signed() {
        for (x, sum) in sums.iter_mut().enumerate() {
            data[y as usize * w + x] = (*sum / window) as f32;
            *sum += f64::from(temp[row(y + r + 1) + x]) - f64::from(temp[row(y - r) + x]);
        }
    }
}

fn apply_vignette(img: &mut ImageBuf, amount: f32, midpoint: f32, feather: f32) {
    let (w, h) = (img.width as f32, img.height as f32);
    let (cx, cy) = (w * 0.5, h * 0.5);
    let max_dist = (cx * cx + cy * cy).sqrt();
    let width = img.width as usize;
    let start = midpoint.clamp(0.0, 0.95);
    let power = 3.0 - 2.0 * feather.clamp(0.0, 1.0);

    img.data.par_chunks_mut(3).enumerate().for_each(|(i, px)| {
        let x = (i % width) as f32;
        let y = (i / width) as f32;
        let dist = ((x - cx).powi(2) + (y - cy).powi(2)).sqrt() / max_dist;
        // Aux réglages par défaut (début au centre, exposant 2), c'est l'ancien `dist²`.
        let reach = ((dist - start) / (1.0 - start)).clamp(0.0, 1.0);
        let falloff = 1.0 - amount * reach.powf(power);
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

/// Bruit de valeur : le bruit franc de chaque cellule, interpolé entre les cellules voisines.
fn smooth_noise(x: f32, y: f32) -> f32 {
    let (ix, iy) = (x.floor(), y.floor());
    let ease = |t: f32| t * t * (3.0 - 2.0 * t);
    let (ex, ey) = (ease(x - ix), ease(y - iy));
    let (ix, iy) = (ix as u32, iy as u32);

    let weights = [
        (1.0 - ex) * (1.0 - ey),
        ex * (1.0 - ey),
        (1.0 - ex) * ey,
        ex * ey,
    ];
    let values = [
        hash_noise(ix, iy),
        hash_noise(ix + 1, iy),
        hash_noise(ix, iy + 1),
        hash_noise(ix + 1, iy + 1),
    ];
    let blended: f32 = weights.iter().zip(values).map(|(w, v)| w * v).sum();

    // Mélanger écrase l'amplitude, d'autant plus qu'on est loin d'un coin : on la rétablit
    // pour que la rugosité change le motif sans changer la force du grain.
    let spread = weights.iter().map(|w| w * w).sum::<f32>().sqrt();
    blended / spread
}

fn apply_grain(img: &mut ImageBuf, amount: f32, size: f32, roughness: f32) {
    let width = img.width as usize;
    let cell = size.clamp(1.0, 6.0);
    let roughness = roughness.clamp(0.0, 1.0);

    img.data.par_chunks_mut(3).enumerate().for_each(|(i, px)| {
        let (cell_x, cell_y) = ((i % width) as f32 / cell, (i / width) as f32 / cell);
        let hard = hash_noise(cell_x as u32, cell_y as u32);
        let noise = if roughness >= 1.0 {
            hard
        } else {
            // Au centre du pixel : à un pixel par cellule, un point du quadrillage n'adoucit rien.
            let smooth = smooth_noise(cell_x + 0.5 / cell, cell_y + 0.5 / cell);
            smooth + (hard - smooth) * roughness
        };

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

#[cfg(test)]
mod tests {
    use super::*;

    fn flat(size: u32, value: f32) -> ImageBuf {
        let mut img = ImageBuf::new(size, size);
        img.data.fill(value);
        img
    }

    fn at(img: &ImageBuf, x: u32, y: u32) -> f32 {
        img.data[((y * img.width + x) * 3) as usize]
    }

    /// Une valeur à `fraction` du centre vers le coin supérieur gauche d'une image carrée.
    fn on_diagonal(img: &ImageBuf, fraction: f32) -> f32 {
        let half = (img.width as f32 - 1.0) / 2.0;
        let offset = (half * (1.0 - fraction)).round() as u32;
        at(img, offset, offset)
    }

    fn vignetted(params: RenderParams) -> ImageBuf {
        apply(&flat(201, 0.4), &params)
    }

    #[test]
    fn a_missing_setting_takes_its_default() {
        let params: RenderParams = serde_json::from_str("{}").expect("réglages lisibles");

        assert_eq!(params, RenderParams::default());
        assert!((params.grain_roughness - 1.0).abs() < f32::EPSILON);
        assert!((params.vignette_feather - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn the_default_vignette_is_still_the_squared_distance() {
        let params = RenderParams {
            vignette: 0.8,
            ..RenderParams::default()
        };
        let plain = vignetted(RenderParams::default());
        let darkened = vignetted(params);

        let fraction = 0.6;
        let expected = on_diagonal(&plain, fraction) * (1.0 - 0.8 * fraction * fraction);
        assert!((on_diagonal(&darkened, fraction) - expected).abs() < 0.01);
    }

    #[test]
    fn the_midpoint_keeps_the_centre_untouched() {
        let reference = vignetted(RenderParams::default());
        let params = RenderParams {
            vignette: 0.8,
            vignette_midpoint: 0.5,
            ..RenderParams::default()
        };
        let darkened = vignetted(params);

        assert!((on_diagonal(&darkened, 0.3) - on_diagonal(&reference, 0.3)).abs() < 1e-6);
        assert!(on_diagonal(&darkened, 1.0) < on_diagonal(&reference, 1.0) * 0.5);
        let no_midpoint = vignetted(RenderParams {
            vignette: 0.8,
            ..RenderParams::default()
        });
        assert!(on_diagonal(&no_midpoint, 0.3) < on_diagonal(&reference, 0.3));
    }

    #[test]
    fn a_softer_feather_reaches_further_in() {
        let with_feather = |feather| {
            on_diagonal(
                &vignetted(RenderParams {
                    vignette: 0.8,
                    vignette_feather: feather,
                    ..RenderParams::default()
                }),
                0.6,
            )
        };

        assert!(with_feather(1.0) < with_feather(0.5));
        assert!(with_feather(0.5) < with_feather(0.0));
    }

    fn neighbour_difference(img: &ImageBuf) -> f32 {
        let mut total = 0.0;
        let mut count = 0.0;
        for y in 0..img.height {
            for x in 0..img.width - 1 {
                total += (at(img, x, y) - at(img, x + 1, y)).abs();
                count += 1.0;
            }
        }
        total / count
    }

    fn standard_deviation(img: &ImageBuf) -> f32 {
        let values: Vec<f32> = img.data.iter().step_by(3).copied().collect();
        let mean = values.iter().sum::<f32>() / values.len() as f32;
        (values.iter().map(|v| (v - mean).powi(2)).sum::<f32>() / values.len() as f32).sqrt()
    }

    fn grainy(roughness: f32) -> ImageBuf {
        apply(
            &flat(128, 0.2),
            &RenderParams {
                grain: 0.9,
                grain_size: 1.0,
                grain_roughness: roughness,
                ..RenderParams::default()
            },
        )
    }

    #[test]
    fn a_smoother_grain_varies_less_between_neighbours() {
        assert!(neighbour_difference(&grainy(0.0)) < neighbour_difference(&grainy(1.0)) * 0.7);
    }

    #[test]
    fn roughness_changes_the_texture_not_the_strength() {
        let smooth = standard_deviation(&grainy(0.0));
        let rough = standard_deviation(&grainy(1.0));

        assert!(
            smooth > rough * 0.6 && smooth < rough * 1.6,
            "{smooth} contre {rough}"
        );
    }

    /// Une valeur de bruit déterministe, centrée sur zéro, d'amplitude `amount`.
    fn noise(x: u32, y: u32, channel: u32, amount: f32) -> f32 {
        hash_noise(x + channel * 4001, y + channel * 7919) * amount
    }

    fn noisy_gray(size: u32, level: f32, amount: f32, per_channel: bool) -> ImageBuf {
        let mut img = flat(size, level);
        for y in 0..size {
            for x in 0..size {
                let shared = noise(x, y, 0, amount);
                for channel in 0..3u32 {
                    let delta = if per_channel {
                        noise(x, y, channel, amount)
                    } else {
                        shared
                    };
                    img.data[((y * size + x) * 3 + channel) as usize] += delta;
                }
            }
        }
        img
    }

    fn red_minus_green_spread(img: &ImageBuf) -> f32 {
        let diffs: Vec<f32> = img.data.chunks(3).map(|px| px[0] - px[1]).collect();
        let mean = diffs.iter().sum::<f32>() / diffs.len() as f32;
        (diffs.iter().map(|d| (d - mean).powi(2)).sum::<f32>() / diffs.len() as f32).sqrt()
    }

    fn mean_luma(img: &ImageBuf) -> f32 {
        img.data.chunks(3).map(luma_of).sum::<f32>() / (img.data.len() / 3) as f32
    }

    #[test]
    fn noise_reduction_at_zero_changes_nothing() {
        let source = noisy_gray(64, 0.3, 0.05, true);

        assert_eq!(
            apply(&source, &RenderParams::default()).data,
            apply(&source, &RenderParams::default()).data
        );
        let with_zero = RenderParams {
            noise_luminance: 0.0,
            noise_color: 0.0,
            ..RenderParams::default()
        };
        assert_eq!(
            apply(&source, &with_zero).data,
            apply(&source, &RenderParams::default()).data
        );
    }

    #[test]
    fn luminance_noise_reduction_calms_a_flat_noisy_area() {
        let source = noisy_gray(96, 0.3, 0.04, false);
        let cleaned = apply(
            &source,
            &RenderParams {
                noise_luminance: 1.0,
                ..RenderParams::default()
            },
        );

        assert!(
            standard_deviation(&cleaned)
                < standard_deviation(&apply(&source, &RenderParams::default())) * 0.5
        );
        assert!(
            (mean_luma(&cleaned) - mean_luma(&apply(&source, &RenderParams::default()))).abs()
                < 0.01
        );
    }

    #[test]
    fn noise_reduction_spares_a_strong_edge() {
        let size = 96;
        let mut source = noisy_gray(size, 0.1, 0.01, false);
        for y in 0..size {
            for x in size / 2..size {
                for channel in 0..3 {
                    source.data[((y * size + x) * 3 + channel) as usize] += 0.5;
                }
            }
        }
        let plain = apply(&source, &RenderParams::default());
        let cleaned = apply(
            &source,
            &RenderParams {
                noise_luminance: 1.0,
                noise_color: 1.0,
                ..RenderParams::default()
            },
        );

        let step = |img: &ImageBuf| at(img, size / 2, 40) - at(img, size / 2 - 1, 40);
        assert!(
            step(&cleaned) > step(&plain) * 0.8,
            "{} contre {}",
            step(&cleaned),
            step(&plain)
        );
    }

    #[test]
    fn colour_noise_reduction_calms_chroma_and_keeps_brightness() {
        let source = noisy_gray(96, 0.3, 0.04, true);
        let plain = apply(&source, &RenderParams::default());
        let cleaned = apply(
            &source,
            &RenderParams {
                noise_color: 1.0,
                ..RenderParams::default()
            },
        );

        assert!(red_minus_green_spread(&cleaned) < red_minus_green_spread(&plain) * 0.4);
        assert!((mean_luma(&cleaned) - mean_luma(&plain)).abs() < 0.01);
    }

    fn step_edge(width: u32, height: u32) -> ImageBuf {
        let mut img = ImageBuf::new(width, height);
        for y in 0..height {
            for x in 0..width {
                let value = if x < width / 2 { 0.1 } else { 0.4 };
                for channel in 0..3 {
                    img.data[((y * width + x) * 3 + channel) as usize] = value;
                }
            }
        }
        img
    }

    fn sharpened(img: &ImageBuf, amount: f32, radius: f32) -> ImageBuf {
        apply(
            img,
            &RenderParams {
                sharpening: amount,
                sharpen_radius: radius,
                ..RenderParams::default()
            },
        )
    }

    #[test]
    fn sharpening_overshoots_on_both_sides_of_an_edge() {
        let source = step_edge(200, 8);
        let plain = apply(&source, &RenderParams::default());
        let crisp = sharpened(&source, 1.0, 1.0);

        let (dark, bright) = (200 / 2 - 1, 200 / 2);
        assert!(
            at(&crisp, dark, 4) < at(&plain, dark, 4) - 0.005,
            "côté sombre"
        );
        assert!(
            at(&crisp, bright, 4) > at(&plain, bright, 4) + 0.005,
            "côté clair"
        );
        assert!(
            (at(&crisp, 10, 4) - at(&plain, 10, 4)).abs() < 1e-4,
            "loin du contour, rien ne bouge"
        );
    }

    #[test]
    fn sharpening_leaves_a_flat_image_alone_even_brighter_than_white() {
        for level in [0.05, 0.3, 1.0, 1.6] {
            let crisp = sharpened(&flat(64, level), 1.0, 2.0);

            let plain = apply(&flat(64, level), &RenderParams::default());
            let unchanged = crisp
                .data
                .iter()
                .zip(&plain.data)
                .all(|(a, b)| (a - b).abs() < 1e-5);
            assert!(unchanged, "niveau {level}");
        }
    }

    #[test]
    fn a_larger_radius_spreads_the_sharpening_wider() {
        let source = step_edge(1800, 8);
        let plain = apply(&source, &RenderParams::default());
        let reach = |radius| {
            let crisp = sharpened(&source, 1.0, radius);
            (0..900)
                .rev()
                .take_while(|x| (at(&crisp, *x, 4) - at(&plain, *x, 4)).abs() > 0.002)
                .count()
        };

        assert!(
            reach(3.0) > reach(0.5),
            "{} contre {}",
            reach(3.0),
            reach(0.5)
        );
    }

    #[test]
    fn the_sharpening_radius_follows_the_resolution() {
        let overshoot = |width: u32| {
            let source = step_edge(width, 8);
            let plain = apply(&source, &RenderParams::default());
            let crisp = sharpened(&source, 1.0, 2.0);
            at(&crisp, width / 2, 4) - at(&plain, width / 2, 4)
        };

        let (small, large) = (overshoot(900), overshoot(1800));
        assert!(
            (small - large).abs() < large * 0.2,
            "{small} contre {large}"
        );
    }

    #[test]
    fn blurring_a_flat_area_keeps_it_flat_right_up_to_the_borders() {
        for (w, h, radius) in [(40, 30, 1), (40, 30, 5), (7, 5, 3)] {
            let mut data = vec![0.37; w * h];

            box_blur(&mut data, w, h, radius);

            assert!(
                data.iter().all(|v| (v - 0.37).abs() < 1e-5),
                "{w}x{h}, rayon {radius} : {:?}",
                data.iter().copied().fold(f32::MAX, f32::min)
            );
        }
    }

    fn first_pixel(img: &ImageBuf) -> [f32; 3] {
        [img.data[0], img.data[1], img.data[2]]
    }

    fn graded(level: f32, params: &RenderParams) -> ([f32; 3], [f32; 3]) {
        let source = flat(4, level);
        (
            first_pixel(&apply(&source, params)),
            first_pixel(&apply(&source, &RenderParams::default())),
        )
    }

    fn colour_shift(level: f32, params: &RenderParams) -> f32 {
        let (graded, plain) = graded(level, params);
        (0..3)
            .map(|c| (graded[c] - plain[c]).abs())
            .fold(0.0, f32::max)
    }

    #[test]
    fn a_tint_hue_has_no_luminance_and_points_the_right_way() {
        for degrees in (0..360).step_by(15) {
            let [r, g, b] = tint_vector(degrees as f32);
            let luma = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
            assert!(luma.abs() < 1e-5, "{degrees}° : {luma}");
        }
        assert!(tint_vector(0.0)[0] > 0.0 && tint_vector(0.0)[2] < 0.0);
        assert!(tint_vector(120.0)[1] > 0.0 && tint_vector(120.0)[0] < 0.0);
        assert!(tint_vector(240.0)[2] > 0.0 && tint_vector(240.0)[0] < 0.0);
        assert_eq!(tint_vector(360.0), tint_vector(0.0));
        assert_eq!(tint_vector(-120.0), tint_vector(240.0));
    }

    #[test]
    fn grading_without_saturation_changes_nothing() {
        let params = RenderParams {
            shadows_hue: 200.0,
            midtones_hue: 90.0,
            highlights_hue: 30.0,
            grading_balance: 0.5,
            ..RenderParams::default()
        };
        let source = noisy_gray(32, 0.3, 0.1, true);

        assert_eq!(
            apply(&source, &params).data,
            apply(&source, &RenderParams::default()).data
        );
    }

    #[test]
    fn the_shadows_tint_reaches_dark_tones_far_more_than_bright_ones() {
        let params = RenderParams {
            shadows_hue: 240.0,
            shadows_saturation: 1.0,
            ..RenderParams::default()
        };

        let (dark, dark_plain) = graded(0.02, &params);
        assert!(
            dark[2] - dark[0] > dark_plain[2] - dark_plain[0] + 0.01,
            "{dark:?}"
        );
        assert!(colour_shift(0.02, &params) > colour_shift(0.8, &params) * 3.0);
    }

    #[test]
    fn the_highlights_tint_reaches_bright_tones_far_more_than_dark_ones() {
        let params = RenderParams {
            highlights_hue: 30.0,
            highlights_saturation: 1.0,
            ..RenderParams::default()
        };

        let (bright, bright_plain) = graded(0.6, &params);
        assert!(
            bright[0] - bright[2] > bright_plain[0] - bright_plain[2] + 0.02,
            "{bright:?}"
        );
        assert!(colour_shift(0.6, &params) > colour_shift(0.02, &params) * 3.0);
    }

    #[test]
    fn grading_changes_the_colour_without_changing_the_brightness() {
        let params = RenderParams {
            midtones_hue: 120.0,
            midtones_saturation: 1.0,
            ..RenderParams::default()
        };

        let (graded, plain) = graded(0.18, &params);

        let luma = |px: [f32; 3]| LUMA[0] * px[0] + LUMA[1] * px[1] + LUMA[2] * px[2];
        assert!(
            (luma(graded) - luma(plain)).abs() < luma(plain) * 0.08,
            "{graded:?}"
        );
        assert!(
            graded[1] > graded[0] + 0.02,
            "le vert doit dominer : {graded:?}"
        );
    }

    #[test]
    fn the_balance_moves_where_the_shadows_end() {
        let with_balance = |balance| {
            colour_shift(
                0.18,
                &RenderParams {
                    shadows_hue: 240.0,
                    shadows_saturation: 1.0,
                    grading_balance: balance,
                    ..RenderParams::default()
                },
            )
        };

        assert!(with_balance(-1.0) > with_balance(0.0));
        assert!(with_balance(0.0) > with_balance(1.0));
    }
}

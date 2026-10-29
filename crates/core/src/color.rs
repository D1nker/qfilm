//! Gestion des profils ICC. L'espace de travail est du sRGB : une photo taguée Display P3,
//! Adobe RGB… y est convertie à l'ouverture, et l'export embarque un profil sRGB.
//! Les couleurs hors gamut sRGB sont donc écrêtées, une limite assumée pour l'instant.

use moxcms::{ColorProfile, DataColorSpace, Layout, RenderingIntent, TransformOptions};
use rayon::prelude::*;

/// Des couleurs repères : si la conversion les laisse en place, le profil est déjà du sRGB et
/// on s'épargne un passage sur tous les pixels (et sa dérive d'arrondi).
const PROBES: [f32; 15] = [
    0.2, 0.5, 0.8, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.5, 0.5, 0.5,
];
const IDENTITY_TOLERANCE: f32 = 0.002;
const ROW_SAMPLES: usize = 3 * 4096;

/// Convertit en place des valeurs RVB encodées (gamma) selon `icc` vers du sRGB encodé.
/// Un profil illisible, ou qui n'est pas du RVB, laisse les pixels tels quels : mieux vaut une
/// photo légèrement fausse qu'une photo refusée.
pub fn to_srgb(samples: &mut [f32], icc: &[u8]) {
    let Ok(source) = ColorProfile::new_from_slice(icc) else {
        return;
    };
    if source.color_space != DataColorSpace::Rgb {
        return;
    }

    let options = TransformOptions {
        rendering_intent: RenderingIntent::RelativeColorimetric,
        ..TransformOptions::default()
    };
    let Ok(transform) =
        source.create_transform_f32(Layout::Rgb, &ColorProfile::new_srgb(), Layout::Rgb, options)
    else {
        return;
    };

    let mut probed = PROBES;
    if transform.transform(&PROBES, &mut probed).is_err()
        || PROBES
            .iter()
            .zip(&probed)
            .all(|(before, after)| (before - after).abs() < IDENTITY_TOLERANCE)
    {
        return;
    }

    samples.par_chunks_mut(ROW_SAMPLES).for_each(|chunk| {
        let source: Vec<f32> = chunk.iter().map(|v| v.clamp(0.0, 1.0)).collect();
        if transform.transform(&source, chunk).is_ok() {
            for value in chunk.iter_mut() {
                *value = value.clamp(0.0, 1.0);
            }
        }
    });
}

/// Le profil sRGB à embarquer dans les fichiers exportés.
pub fn srgb_icc() -> Vec<u8> {
    ColorProfile::new_srgb()
        .encode()
        .expect("le profil sRGB intégré s'encode toujours")
}

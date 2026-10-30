//! Mesure ce que coûte chaque réglage du rendu, et l'encodage de l'aperçu, sur une photo de taille réaliste.
//! À lancer en release (le debug ne dit rien) : `npm run bench`.
//!
//! La photo est synthétique (dégradés, bruit, détails fins) : le temps d'un rendu dépend de la taille de
//! l'image et des réglages, pas de ce qu'elle montre.

// Des indices de pixels et des millisecondes : les conversions ne perdent rien d'utile à ce banc d'essai.
#![allow(clippy::cast_precision_loss, clippy::cast_possible_truncation)]

use std::time::Instant;

use qfilm_core::buffer::ImageBuf;
use qfilm_core::mask::{Mask, MaskAdjust, MaskShape};
use qfilm_core::render::{self, RenderParams};
use qfilm_core::{encode, preset};
use serde_json::{Value, json};

fn photo(width: u32, height: u32) -> ImageBuf {
    let mut img = ImageBuf::new(width, height);
    let mut seed = 0x1234_5678_u32;
    for (i, px) in img.data.chunks_mut(3).enumerate() {
        let x = (i as u32 % width) as f32 / width as f32;
        let y = (i as u32 / width) as f32 / height as f32;
        seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        let noise = ((seed >> 16) as f32 / 65_535.0 - 0.5) * 0.04;
        let detail = 0.06 * ((x * 90.0).sin() * (y * 70.0).cos());
        px.copy_from_slice(&[
            (0.25 + 0.5 * x + detail + noise).max(0.0),
            (0.3 + 0.35 * y + detail + noise).max(0.0),
            (0.55 - 0.3 * x + noise).max(0.0),
        ]);
    }
    img
}

fn params(overrides: &Value) -> RenderParams {
    serde_json::from_value(overrides.clone()).expect("des réglages valides")
}

/// Le meilleur de plusieurs rendus, en millisecondes. Le minimum, pas la moyenne : sur une machine où d'autres
/// programmes tournent, il n'y a pas de bruit qui rende un rendu plus rapide que lui-même, seulement des
/// ralentissements. Une première passe chauffe les caches et le pool de threads.
fn time(mut run: impl FnMut()) -> f64 {
    run();
    (0..15)
        .map(|_| {
            let start = Instant::now();
            run();
            start.elapsed().as_secs_f64() * 1000.0
        })
        .fold(f64::INFINITY, f64::min)
}

fn report(width: u32, height: u32) {
    let img = photo(width, height);
    println!(
        "\n== {width}×{height} ({:.1} MP) ==",
        f64::from(width * height) / 1e6
    );

    let baseline = time(|| drop(render::apply(&img, &RenderParams::default(), &[])));
    println!("{:<34}{baseline:>8.1} ms", "neutre (copie + épaulement)");

    let single = [
        ("exposition", json!({ "exposure": 0.5 })),
        (
            "tons (contraste, ombres…)",
            json!({ "contrast": 0.3, "shadows": 0.3, "highlights": -0.3 }),
        ),
        (
            "courbe des tons",
            json!({ "curves": { "rgb": [[0.0, 0.0], [0.3, 0.22], [0.7, 0.8], [1.0, 1.0]] } }),
        ),
        (
            "mélangeur de couleurs",
            json!({ "redHue": 0.3, "blueSaturation": 0.4 }),
        ),
        (
            "étalonnage",
            json!({ "shadowsSaturation": 0.5, "shadowsHue": 200.0, "highlightsSaturation": 0.5, "highlightsHue": 40.0 }),
        ),
        ("halation", json!({ "halation": 0.5 })),
        ("clarté", json!({ "clarity": 0.5 })),
        (
            "réduction bruit luminance",
            json!({ "noiseLuminance": 0.6 }),
        ),
        ("réduction bruit couleur", json!({ "noiseColor": 0.6 })),
        ("netteté", json!({ "sharpening": 0.5 })),
        ("vignette", json!({ "vignette": 0.5 })),
        ("grain", json!({ "grain": 0.4, "grainSize": 2.2 })),
    ];
    println!("-- un réglage seul, en plus du neutre --");
    for (name, overrides) in &single {
        let p = params(overrides);
        let ms = time(|| drop(render::apply(&img, &p, &[])));
        println!("{name:<34}{:>8.1} ms  (+{:.1})", ms, ms - baseline);
    }

    println!("-- des looks de l'application --");
    for id in [
        "portrait_400",
        "cine_500t",
        "classique_400",
        "nocturne_3200",
    ] {
        let preset = preset::builtin().iter().find(|p| p.id == id).expect("look");
        let ms = time(|| drop(render::apply(&img, &preset.params, &[])));
        println!("{id:<34}{ms:>8.1} ms");
    }

    let mask = Mask {
        id: "m".into(),
        shape: MaskShape::Radial {
            center: [0.5, 0.5],
            radius: [0.3, 0.2],
            angle: 20.0,
            feather: 0.5,
        },
        invert: false,
        adjust: MaskAdjust {
            exposure: -0.5,
            saturation: 0.3,
            ..MaskAdjust::default()
        },
    };
    let ms = time(|| {
        drop(render::apply(
            &img,
            &RenderParams::default(),
            std::slice::from_ref(&mask),
        ));
    });
    println!("{:<34}{ms:>8.1} ms  (+{:.1})", "un masque", ms - baseline);

    println!("-- envoyer l'aperçu --");
    let rendered = render::apply(&img, &RenderParams::default(), &[]);
    let to8 = time(|| drop(encode::to_srgb8_for_bench(&rendered)));
    let url = time(|| drop(encode::to_data_url(&rendered, 88).expect("jpeg")));
    let size = encode::to_data_url(&rendered, 88).expect("jpeg").len();
    println!("{:<34}{to8:>8.1} ms", "linéaire -> sRGB 8 bits");
    println!(
        "{:<34}{url:>8.1} ms  ({:.0} Ko en base64)",
        "JPEG + base64 (data URL)",
        size as f64 / 1024.0
    );
}

fn main() {
    report(1800, 1200);
    report(960, 640);
    report(6000, 4000);
}

//! Fabrique les images du site avec le vrai moteur : chaque photo reçoit son look et son cadre, comme
//! dans l'application, et sort en JPEG à plusieurs largeurs. Les images du site ne sont donc jamais des
//! maquettes. Aucune métadonnée n'est reportée : ni EXIF, ni position GPS, ni nom d'appareil.
//!
//! `cargo run --release -p qfilm-core --example site_images -- <photos> <spec.json> <sortie>`
//! (ou `npm run website:images`). Le fichier de spécification est `website/images.json`.

use std::collections::HashMap;
use std::error::Error;
use std::path::{Path, PathBuf};

use qfilm_core::caption::Caption;
use qfilm_core::decode::{Metadata, decode_file};
use qfilm_core::encode::{ExportFormat, ExportOptions, save_to_disk};
use qfilm_core::frame::{FrameRegistry, FrameSelection};
use qfilm_core::geometry::{self, Geometry};
use qfilm_core::render::{self, RenderParams};
use qfilm_core::{buffer::ImageBuf, preset};
use serde::Deserialize;
use serde_json::{Map, Value};

#[derive(Deserialize)]
struct Spec {
    images: Vec<Item>,
}

/// Une image du site : une photo, un look, un cadre, et les largeurs à produire.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Item {
    name: String,
    /// Le fichier, dans le dossier des photos.
    photo: String,
    /// L'identifiant d'un look de l'application ; absent, la photo reste neutre.
    #[serde(default)]
    preset: Option<String>,
    /// Des réglages qui s'ajoutent à ceux du look (mêmes noms que `RenderParams`).
    #[serde(default)]
    params: Map<String, Value>,
    /// Un recadrage, comme dans l'application.
    #[serde(default)]
    geometry: Geometry,
    #[serde(default)]
    frame: FrameSelection,
    #[serde(default)]
    caption: Caption,
    /// Plus grand côté, en pixels, de chaque taille produite.
    widths: Vec<u32>,
    /// Produit aussi la même image sans look (même cadre), pour un avant / après.
    #[serde(default)]
    before: bool,
    #[serde(default = "default_quality")]
    quality: u8,
}

const fn default_quality() -> u8 {
    82
}

/// Les réglages d'un look, auxquels on superpose ceux de la spécification.
fn params_for(item: &Item) -> Result<RenderParams, Box<dyn Error>> {
    let mut merged = match &item.preset {
        Some(id) => {
            let preset = preset::builtin()
                .iter()
                .find(|preset| &preset.id == id)
                .ok_or_else(|| format!("look inconnu : {id}"))?;
            serde_json::to_value(&preset.params)?
        }
        None => serde_json::to_value(RenderParams::default())?,
    };

    if let Value::Object(fields) = &mut merged {
        for (key, value) in &item.params {
            fields.insert(key.clone(), value.clone());
        }
    }
    Ok(serde_json::from_value(merged)?)
}

fn write(
    registry: &FrameRegistry,
    source: &ImageBuf,
    params: &RenderParams,
    item: &Item,
    path: &Path,
    width: u32,
) -> Result<(), Box<dyn Error>> {
    // Réduire avant le rendu : le grain et la halation sont proportionnels, le résultat est le même.
    let graded = render::apply(&source.downscale_to_fit(width), params, &[]);
    let framed = registry.render_with_caption(&graded, &item.frame, &item.caption)?;
    // Le cadre agrandit l'image : on revient à la largeur demandée, cadre compris.
    let image = framed.image.downscale_to_fit(width);

    let options = ExportOptions {
        format: ExportFormat::Jpeg,
        quality: item.quality,
        max_edge: None,
        keep_metadata: false,
    };
    save_to_disk(&image, path, options, &Metadata::default())?;
    println!("  {} ({}×{})", path.display(), image.width, image.height);
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [photos, spec, out] = args.as_slice() else {
        return Err(
            "usage : site_images <dossier des photos> <spec.json> <dossier de sortie>".into(),
        );
    };

    let spec: Spec = serde_json::from_str(&std::fs::read_to_string(spec)?)?;
    let registry = FrameRegistry::builtin();
    std::fs::create_dir_all(out)?;

    // Une photo qui sert à plusieurs images n'est lue qu'une fois.
    let mut decoded: HashMap<String, ImageBuf> = HashMap::new();
    for item in &spec.images {
        println!("{}", item.name);
        if !decoded.contains_key(&item.photo) {
            let path = PathBuf::from(photos).join(&item.photo);
            let image = decode_file(&path).map_err(|e| format!("{} : {e}", path.display()))?;
            decoded.insert(item.photo.clone(), image.image);
        }
        let photo = &decoded[&item.photo];
        let source = if item.geometry.is_identity() {
            photo.clone()
        } else {
            geometry::apply(photo, &item.geometry)
        };

        let params = params_for(item)?;
        let plain = RenderParams::default();
        let longest = source.width.max(source.height);
        for &width in &item.widths {
            // Une photo plus petite que la largeur demandée ne s'agrandit pas : la même image deux fois ne sert à rien.
            if width > longest && item.widths.iter().any(|&other| other <= longest) {
                println!("  {width} ignoré (la photo ne fait que {longest})");
                continue;
            }
            let target = PathBuf::from(out).join(format!("{}-{width}", item.name));
            write(&registry, &source, &params, item, &target, width)?;
            if item.before {
                let before = PathBuf::from(out).join(format!("{}-before-{width}", item.name));
                write(&registry, &source, &plain, item, &before, width)?;
            }
        }
    }
    Ok(())
}

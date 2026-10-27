//! Le contrat avec l'interface : `ui/src/lib/bindings.ts` est généré à partir des commandes et
//! des types Rust, jamais écrit à la main.

use specta_typescript::semantic;
use tauri_specta::{Builder, ErrorHandlingMode, collect_commands};

use crate::commands::{export, frames, image, render};

pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        // Les commandes rejettent avec le message d'erreur, comme `invoke` brut.
        .error_handling(ErrorHandlingMode::Throw)
        // Les réglages sont bornés par l'interface : jamais de NaN ni d'infini sur le fil.
        .semantic_types(semantic::Configuration::default().enable_lossless_floats())
        .commands(collect_commands![
        image::list_presets,
        image::supported_extensions,
        image::open_image,
        image::close_image,
        image::preset_thumbnails,
        render::render_preview,
        render::frame_thumbnails,
        export::export_image,
        frames::list_frames,
        frames::reload_frames,
        frames::import_frame,
        frames::remove_frame,
        frames::open_frames_folder,
    ])
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use specta_typescript::Typescript;

    use super::builder;

    fn committed_file() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui/src/lib/bindings.ts")
    }

    /// Échoue si `bindings.ts` n'est plus à jour. `UPDATE_BINDINGS=1 cargo test bindings` le
    /// régénère.
    #[test]
    fn bindings_are_up_to_date() {
        let fresh = std::env::temp_dir().join(format!("qfilm-bindings-{}.ts", std::process::id()));
        builder()
            .export(Typescript::default(), &fresh)
            .expect("l'export des bindings a échoué");
        let generated = std::fs::read_to_string(&fresh).expect("lecture des bindings générés");
        let _ = std::fs::remove_file(&fresh);

        let committed = committed_file();
        if std::env::var_os("UPDATE_BINDINGS").is_some() {
            std::fs::write(&committed, &generated).expect("écriture de bindings.ts");
            return;
        }

        let current = std::fs::read_to_string(&committed).unwrap_or_default();
        assert!(
            current == generated,
            "ui/src/lib/bindings.ts est périmé : lance `npm run rust:bindings`"
        );
    }
}

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde_json::{Map, json};

use super::*;

const MANIFEST: &str = r#"{ "id": "test", "name": "Test" }"#;

fn photo(width: u32, height: u32) -> ImageBuf {
    let mut image = ImageBuf::new(width, height);
    for (i, value) in image.data.iter_mut().enumerate() {
        *value = ((i % 97) as f32) / 200.0 + 0.1;
    }
    image
}

fn frame(svg: &str) -> Result<Frame, FrameError> {
    Frame::from_sources(MANIFEST, svg.to_string(), false)
}

fn render(svg: &str, photo: &ImageBuf) -> Result<Rendered, FrameError> {
    frame(svg)?.render(photo, &Map::new())
}

fn margin(extra: &str, photo_attributes: &str) -> String {
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{{{{ photo.w + 20 }}}}" height="{{{{ photo.h + 20 }}}}">
  <rect width="100%" height="100%" fill="#ff0000"/>
  <rect id="photo" x="10" y="10" width="{{{{ photo.w }}}}" height="{{{{ photo.h }}}}" display="none" {photo_attributes}/>
  {extra}
</svg>"##
    )
}

fn pixel(image: &ImageBuf, x: u32, y: u32) -> [f32; 3] {
    let i = ((y * image.width + x) * 3) as usize;
    [image.data[i], image.data[i + 1], image.data[i + 2]]
}

#[test]
fn the_photo_is_pasted_untouched_at_the_marker() {
    let original = photo(40, 30);
    let rendered = render(&margin("", ""), &original).unwrap();

    assert_eq!((rendered.image.width, rendered.image.height), (60, 50));
    for (x, y) in [(0, 0), (39, 0), (0, 29), (39, 29), (17, 11)] {
        assert_eq!(
            pixel(&rendered.image, x + 10, y + 10),
            pixel(&original, x, y),
            "({x}, {y})"
        );
    }
}

#[test]
fn the_margin_is_composited_in_linear_light() {
    let rendered = render(&margin("", ""), &photo(40, 30)).unwrap();
    assert_eq!(pixel(&rendered.image, 2, 2), [1.0, 0.0, 0.0]);
}

#[test]
fn nothing_drawn_means_a_white_backdrop() {
    let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="{{ photo.w + 4 }}" height="{{ photo.h + 4 }}">
      <rect id="photo" x="2" y="2" width="{{ photo.w }}" height="{{ photo.h }}" display="none"/></svg>"#;
    let rendered = render(svg, &photo(20, 20)).unwrap();
    assert_eq!(pixel(&rendered.image, 0, 0), [1.0, 1.0, 1.0]);
}

#[test]
fn the_over_layer_is_drawn_above_the_photo_and_the_rest_below() {
    let original = photo(40, 30);

    let below = margin(
        r##"<rect x="10" y="10" width="40" height="30" fill="#0000ff"/>"##,
        "",
    );
    let rendered = render(&below, &original).unwrap();
    assert_eq!(pixel(&rendered.image, 30, 25), pixel(&original, 20, 15));

    let above = margin(
        r##"<g id="over"><rect x="10" y="10" width="40" height="30" fill="#0000ff"/></g>"##,
        "",
    );
    let rendered = render(&above, &original).unwrap();
    assert_eq!(pixel(&rendered.image, 30, 25), [0.0, 0.0, 1.0]);
    assert_eq!(pixel(&rendered.image, 2, 2), [1.0, 0.0, 0.0]);
}

#[test]
fn the_over_layer_can_use_shared_defs() {
    let svg = margin(
        r##"<defs><linearGradient id="g"><stop offset="0" stop-color="#00ff00"/><stop offset="1" stop-color="#00ff00"/></linearGradient></defs>
            <g id="over"><rect x="10" y="10" width="40" height="30" fill="url(#g)"/></g>"##,
        "",
    );
    let rendered = render(&svg, &photo(40, 30)).unwrap();
    assert_eq!(pixel(&rendered.image, 30, 25), [0.0, 1.0, 0.0]);
}

#[test]
fn rounded_corners_reveal_the_background() {
    let original = photo(60, 40);
    let rendered = render(&margin("", r#"rx="20""#), &original).unwrap();

    assert_eq!(pixel(&rendered.image, 10, 10), [1.0, 0.0, 0.0]);
    assert_eq!(pixel(&rendered.image, 40, 30), pixel(&original, 30, 20));
    assert_eq!(pixel(&rendered.image, 10 + 30, 10), pixel(&original, 30, 0));
}

#[test]
fn markers_become_zones_and_a_caption_center() {
    let svg = margin(
        r#"<rect id="zone-title" x="5" y="6" width="30" height="8" display="none"/>
           <rect id="caption-area" x="0" y="30" width="60" height="20" display="none"/>"#,
        "",
    );
    let rendered = render(&svg, &photo(40, 30)).unwrap();

    assert_eq!(rendered.zones.len(), 1);
    let zone = &rendered.zones[0];
    assert_eq!(
        (zone.field.as_str(), zone.x, zone.y, zone.width, zone.height),
        ("title", 5.0, 6.0, 30.0, 8.0)
    );
    assert_eq!(rendered.caption_center, (0.5, 40.0 / 50.0));
}

#[test]
fn caption_defaults_to_the_lower_part_without_a_marker() {
    let rendered = render(&margin("", ""), &photo(40, 30)).unwrap();
    assert_eq!(rendered.caption_center, (0.5, 0.9));
}

#[test]
fn portrait_photos_are_rotated_for_landscape_frames_and_come_back_upright() {
    let manifest = r#"{ "id": "film", "name": "F", "rotatePortrait": true }"#;
    let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="{{ photo.w }}" height="{{ photo.h + 20 }}">
      <rect width="100%" height="100%" fill="#ff0000"/>
      <rect id="photo" x="0" y="10" width="{{ photo.w }}" height="{{ photo.h }}" display="none"/>
      <rect id="zone-note" x="0" y="0" width="{{ photo.w }}" height="10" display="none"/></svg>"##;
    let frame = Frame::from_sources(manifest, svg.to_string(), false).unwrap();

    let portrait = photo(30, 60);
    let rendered = frame.render(&portrait, &Map::new()).unwrap();

    // 30 de large + 2×10 de marge sur les côtés ; la hauteur ne change pas.
    assert_eq!((rendered.image.width, rendered.image.height), (50, 60));

    for (x, y) in [(0, 0), (29, 0), (0, 59), (29, 59), (12, 31)] {
        assert_eq!(
            pixel(&rendered.image, x + 10, y),
            pixel(&portrait, x, y),
            "({x}, {y})"
        );
    }
    assert_eq!(pixel(&rendered.image, 2, 30), [1.0, 0.0, 0.0]);
    assert_eq!(pixel(&rendered.image, 47, 30), [1.0, 0.0, 0.0]);

    let zone = &rendered.zones[0];
    assert_eq!(zone.field, "note");
    assert!(
        zone.x < 10.0 && zone.width <= 10.0 && zone.height >= 59.0,
        "{zone:?}"
    );
}

#[test]
fn the_caption_position_follows_the_rotation_of_portrait_photos() {
    let manifest = r#"{ "id": "film", "name": "F", "rotatePortrait": true }"#;
    // Dans le paysage (60×50), la zone de légende est en haut à droite : centre (45, 5).
    let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="{{ photo.w }}" height="{{ photo.h + 20 }}">
      <rect id="photo" x="0" y="10" width="{{ photo.w }}" height="{{ photo.h }}" display="none"/>
      <rect id="caption-area" x="40" y="0" width="10" height="10" display="none"/></svg>"#;
    let frame = Frame::from_sources(manifest, svg.to_string(), false).unwrap();

    let rendered = frame.render(&photo(30, 60), &Map::new()).unwrap();

    // Après le quart de tour (image finale 50×60), le point (45, 5) tombe en (5, 60 − 45) :
    // en fractions de l'image, (0,1 ; 0,25).
    let (cx, cy) = rendered.caption_center;
    assert!(
        (cx - 0.1).abs() < 1e-6 && (cy - 0.25).abs() < 1e-6,
        "{cx} {cy}"
    );
}

fn error_of(svg: &str, photo: &ImageBuf) -> String {
    frame(svg)
        .and_then(|f| f.render(photo, &Map::new()))
        .err()
        .map(|e| e.to_string())
        .unwrap_or_default()
}

#[test]
fn a_frame_without_photo_marker_is_rejected() {
    let error = error_of(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"/>"#,
        &photo(20, 20),
    );
    assert!(error.contains("photo"), "{error}");
}

#[test]
fn a_photo_outside_the_canvas_is_rejected() {
    let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="{{ photo.w }}" height="{{ photo.h }}">
        <rect id="photo" x="5" y="5" width="{{ photo.w }}" height="{{ photo.h }}" display="none"/></svg>"#;
    assert!(error_of(svg, &photo(20, 20)).contains("sort du cadre"));
}

#[test]
fn markers_must_be_rects_with_numeric_attributes_and_unique() {
    let circle = r#"<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle id="photo" r="5"/></svg>"#;
    assert!(error_of(circle, &photo(20, 20)).contains("<rect>"));

    let text = r#"<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect id="photo" x="abc" width="20" height="20"/></svg>"#;
    assert!(error_of(text, &photo(20, 20)).contains("nombre"));

    let twice = r#"<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect id="photo" width="20" height="20"/><rect id="photo" width="20" height="20"/></svg>"#;
    assert!(error_of(twice, &photo(20, 20)).contains("double"));
}

#[test]
fn absurd_canvas_sizes_are_rejected() {
    let tiny = r#"<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"><rect id="photo" width="1" height="1"/></svg>"#;
    assert!(error_of(tiny, &photo(20, 20)).contains("déraisonnables"));

    let huge = r#"<svg xmlns="http://www.w3.org/2000/svg" width="90000" height="90000"><rect id="photo" width="1" height="1"/></svg>"#;
    assert!(error_of(huge, &photo(20, 20)).contains("déraisonnables"));
}

#[test]
fn malformed_svg_is_an_error_not_a_panic() {
    assert!(frame("<svg><rect").is_err());
    assert!(frame("pas du tout du svg").is_err());
}

#[test]
fn local_files_referenced_by_an_svg_are_never_read() {
    let svg = margin(
        r#"<image href="file:///etc/hosts" x="0" y="0" width="20" height="20"/>
           <image href="../../secret.png" x="0" y="0" width="20" height="20"/>"#,
        "",
    );
    let rendered = render(&svg, &photo(40, 30)).unwrap();
    assert_eq!(pixel(&rendered.image, 2, 2), [1.0, 0.0, 0.0]);
}

#[test]
fn settings_reach_the_template_after_validation() {
    let manifest = r##"{ "id": "m", "name": "M", "params": [
        { "id": "size", "label": "Taille", "type": "number", "min": 1, "max": 50, "step": 1, "default": 10 },
        { "id": "color", "label": "Couleur", "type": "color", "default": "#00ff00" } ] }"##;
    let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="{{ photo.w + p.size * 2 }}" height="{{ photo.h + p.size * 2 }}">
        <rect width="100%" height="100%" fill="{{ p.color }}"/>
        <rect id="photo" x="{{ p.size }}" y="{{ p.size }}" width="{{ photo.w }}" height="{{ photo.h }}" display="none"/></svg>"#;
    let frame = Frame::from_sources(manifest, svg.to_string(), false).unwrap();

    let params = json!({ "size": 5, "color": "#0000ff" });
    let rendered = frame
        .render(&photo(20, 20), params.as_object().unwrap())
        .unwrap();
    assert_eq!((rendered.image.width, rendered.image.height), (30, 30));
    assert_eq!(pixel(&rendered.image, 1, 1), [0.0, 0.0, 1.0]);

    let hostile = json!({ "size": 9999, "color": "\"/><script>alert(1)</script>" });
    let rendered = frame
        .render(&photo(20, 20), hostile.as_object().unwrap())
        .unwrap();
    assert_eq!(
        (rendered.image.width, rendered.image.height),
        (120, 120),
        "borné à 50"
    );
    assert_eq!(
        pixel(&rendered.image, 1, 1),
        [0.0, 1.0, 0.0],
        "couleur par défaut"
    );
}

#[test]
fn a_template_error_names_the_problem() {
    let error = error_of(r#"<svg width="{{ nope }}"/>"#, &photo(10, 10));
    assert!(
        error.contains("nope") || error.contains("undefined") || error.contains("indéfini"),
        "{error}"
    );
}

#[test]
fn builtin_frames_cannot_be_replaced_or_removed() {
    let mut registry = FrameRegistry::builtin();

    let impostor = Frame::from_sources(
        r#"{ "id": "solid", "name": "Faux" }"#,
        margin("", ""),
        false,
    )
    .unwrap();
    assert!(registry.add_user(impostor).is_err());
    assert!(registry.remove_user("solid").is_err());
    assert!(registry.remove_user("inconnu").is_err());
    assert_eq!(
        registry
            .get("solid")
            .unwrap()
            .manifest
            .name
            .in_language("fr"),
        "Marge unie"
    );
}

#[test]
fn user_frames_are_added_updated_and_removed() {
    let mut registry = FrameRegistry::builtin();
    let make = |name: &str| {
        Frame::from_sources(
            &format!(r#"{{ "id": "mine", "name": "{name}" }}"#),
            margin("", ""),
            false,
        )
        .unwrap()
    };

    registry.add_user(make("V1")).unwrap();
    registry.add_user(make("V2")).unwrap();
    assert_eq!(
        registry
            .get("mine")
            .unwrap()
            .manifest
            .name
            .in_language("fr"),
        "V2"
    );
    assert_eq!(
        registry
            .list()
            .iter()
            .filter(|f| f.manifest.id == "mine")
            .count(),
        1
    );

    registry.remove_user("mine").unwrap();
    assert!(registry.get("mine").is_none());
}

#[test]
fn unknown_frame_ids_are_an_error() {
    let registry = FrameRegistry::builtin();
    let selection = FrameSelection {
        id: "ghost".into(),
        params: Map::new(),
    };
    assert!(matches!(
        registry.render(&photo(10, 10), &selection),
        Err(FrameError::NotFound(_))
    ));
}

struct Sandbox(PathBuf);

impl Sandbox {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir().join(format!(
            "qfilm-test-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }

    fn path(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }

    fn zip(&self, name: &str, entries: &[(&str, &[u8])]) -> PathBuf {
        let path = self.path(name);
        let mut writer = zip::ZipWriter::new(fs::File::create(&path).unwrap());
        for (entry, content) in entries {
            writer
                .start_file(*entry, zip::write::SimpleFileOptions::default())
                .unwrap();
            writer.write_all(content).unwrap();
        }
        writer.finish().unwrap();
        path
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn good_manifest(id: &str) -> String {
    format!(r#"{{ "id": "{id}", "name": "Importé" }}"#)
}

#[test]
fn a_folder_can_be_imported_and_reloaded() {
    let sandbox = Sandbox::new("folder");
    let source = sandbox.path("source");
    fs::create_dir_all(&source).unwrap();
    fs::write(source.join("frame.json"), good_manifest("imported")).unwrap();
    fs::write(source.join("frame.svg"), margin("", "")).unwrap();

    let store = UserFrames::new(sandbox.path("user"));
    let imported = store.import(&source).unwrap();
    assert_eq!(imported.manifest.id, "imported");
    assert!(sandbox.path("user/imported/frame.json").is_file());

    let (frames, issues) = store.load_all();
    assert!(issues.is_empty(), "{issues:?}");
    assert_eq!(frames.len(), 1);
    assert_eq!(frames[0].manifest.name.in_language("fr"), "Importé");
}

#[test]
fn a_zip_can_be_imported_from_the_root_or_from_a_single_folder() {
    let sandbox = Sandbox::new("zip");
    let manifest = good_manifest("zipped");
    let svg = margin("", "");

    let flat = sandbox.zip(
        "flat.zip",
        &[
            ("frame.json", manifest.as_bytes()),
            ("frame.svg", svg.as_bytes()),
        ],
    );
    let nested = sandbox.zip(
        "nested.zip",
        &[
            ("mon-cadre/frame.json", manifest.as_bytes()),
            ("mon-cadre/frame.svg", svg.as_bytes()),
        ],
    );

    let store = UserFrames::new(sandbox.path("user"));
    assert_eq!(store.import(&flat).unwrap().manifest.id, "zipped");
    assert_eq!(store.import(&nested).unwrap().manifest.id, "zipped");
}

#[test]
fn zip_slip_entries_are_ignored() {
    let sandbox = Sandbox::new("slip");
    let archive = sandbox.zip(
        "evil.zip",
        &[
            ("../../frame.json", good_manifest("evil").as_bytes()),
            ("../../frame.svg", margin("", "").as_bytes()),
        ],
    );

    let store = UserFrames::new(sandbox.path("user"));
    assert!(
        store.import(&archive).is_err(),
        "des chemins qui sortent de l'archive ne sont pas des fichiers du cadre"
    );
    assert!(!sandbox.0.parent().unwrap().join("frame.json").exists());
}

#[test]
fn invalid_imports_are_rejected_and_nothing_is_written() {
    let sandbox = Sandbox::new("invalid");
    let store = UserFrames::new(sandbox.path("user"));

    let cases: [(&str, &str, String); 4] = [
        ("manifeste cassé", "pas du json", margin("", "")),
        (
            "id invalide",
            r#"{ "id": "../evil", "name": "x" }"#,
            margin("", ""),
        ),
        (
            "sans repère photo",
            r#"{ "id": "ok", "name": "x" }"#,
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"/>"#.into(),
        ),
        (
            "gabarit cassé",
            r#"{ "id": "ok", "name": "x" }"#,
            "{% if %}".into(),
        ),
    ];

    for (name, manifest, svg) in cases {
        let archive = sandbox.zip(
            "bad.zip",
            &[
                ("frame.json", manifest.as_bytes()),
                ("frame.svg", svg.as_bytes()),
            ],
        );
        assert!(
            store.import(&archive).is_err(),
            "devrait être refusé : {name}"
        );
    }
    assert!(
        !sandbox.path("user").exists()
            || fs::read_dir(sandbox.path("user")).unwrap().next().is_none()
    );
}

#[test]
fn oversized_files_are_rejected() {
    let sandbox = Sandbox::new("big");
    let source = sandbox.path("source");
    fs::create_dir_all(&source).unwrap();
    fs::write(source.join("frame.json"), good_manifest("big")).unwrap();
    fs::write(source.join("frame.svg"), "x".repeat(9 * 1024 * 1024)).unwrap();

    let store = UserFrames::new(sandbox.path("user"));
    let error = store.import(&source).err().expect("refusé").to_string();
    assert!(error.contains("trop gros"), "{error}");
}

#[test]
fn a_broken_user_frame_is_reported_not_fatal() {
    let sandbox = Sandbox::new("issues");
    let user = sandbox.path("user");
    let good = user.join("good");
    let bad = user.join("bad");
    fs::create_dir_all(&good).unwrap();
    fs::create_dir_all(&bad).unwrap();
    fs::write(good.join("frame.json"), good_manifest("good")).unwrap();
    fs::write(good.join("frame.svg"), margin("", "")).unwrap();
    fs::write(bad.join("frame.json"), "{ cassé").unwrap();
    fs::write(bad.join("frame.svg"), "").unwrap();

    let (frames, issues) = UserFrames::new(user).load_all();
    assert_eq!(frames.len(), 1);
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].folder, "bad");
}

#[test]
fn removing_cannot_escape_the_user_directory() {
    let sandbox = Sandbox::new("remove");
    let store = UserFrames::new(sandbox.path("user"));
    for hostile in ["../x", "a/b", "..", ".", "a\\b", ""] {
        assert!(store.remove(hostile).is_err(), "{hostile:?}");
    }
}

#[test]
fn every_builtin_frame_renders_at_many_sizes_and_stays_consistent() {
    let registry = FrameRegistry::builtin();
    let sizes = [
        (1, 1),
        (7, 5),
        (301, 197),
        (197, 301),
        (1800, 300),
        (300, 1800),
    ];

    for info in registry.list() {
        for &(w, h) in &sizes {
            let original = photo(w, h);
            let selection = FrameSelection {
                id: info.manifest.id.clone(),
                params: Map::new(),
            };
            let rendered = registry
                .render(&original, &selection)
                .unwrap_or_else(|e| panic!("{} sur {w}×{h} : {e}", info.manifest.id));

            assert!(
                rendered.image.width >= w && rendered.image.height >= h,
                "{} {w}×{h}",
                info.manifest.id
            );
            let (cx, cy) = rendered.caption_center;
            assert!(
                (0.0..=1.0).contains(&cx) && (0.0..=1.0).contains(&cy),
                "{} {w}×{h}",
                info.manifest.id
            );
            for zone in &rendered.zones {
                assert!(
                    zone.x >= -0.5 && zone.y >= -0.5,
                    "{} {w}×{h} {zone:?}",
                    info.manifest.id
                );
            }
        }
    }
}

#[test]
fn the_none_frame_is_a_passthrough() {
    let original = photo(33, 21);
    let registry = FrameRegistry::builtin();
    let rendered = registry
        .render(&original, &FrameSelection::default())
        .unwrap();
    assert_eq!(rendered.image.data, original.data);
    assert!(rendered.zones.is_empty());
}

#[test]
fn the_example_of_the_authoring_guide_works_verbatim() {
    let manifest = r##"{
      "id": "mon-cadre",
      "name": "Mon cadre",
      "description": "Une phrase pour s'y retrouver.",
      "author": "Moi",
      "params": [
        { "id": "width", "label": "Épaisseur", "type": "number",
          "min": 1, "max": 30, "step": 0.5, "unit": "%", "default": 4 },
        { "id": "color", "label": "Couleur", "type": "color", "default": "#ffffff" }
      ]
    }"##;
    let svg = r#"{% set m = ((photo.short * p.width / 100) | round | int) %}
<svg xmlns="http://www.w3.org/2000/svg"
     width="{{ photo.w + m * 2 }}" height="{{ photo.h + m * 2 }}">
  <rect width="100%" height="100%" fill="{{ p.color }}"/>
  <rect id="photo" x="{{ m }}" y="{{ m }}" width="{{ photo.w }}" height="{{ photo.h }}" display="none"/>
</svg>"#;

    let frame = Frame::from_sources(manifest, svg.to_string(), false).unwrap();
    let rendered = frame.render(&photo(100, 60), &Map::new()).unwrap();
    // 4 % du petit côté (60) = 2,4 → 2 px de marge de chaque côté.
    assert_eq!((rendered.image.width, rendered.image.height), (104, 64));
}

#[test]
fn template_syntax_can_be_escaped_as_the_guide_says() {
    let svg = margin(
        r#"<text x="0" y="10">{{ '{{' }} pas du code {{ '{%' }}</text>"#,
        "",
    );
    render(&svg, &photo(40, 30)).unwrap();
}

#[test]
fn a_figma_style_export_renders() {
    // Ce que produit l'export SVG de Figma : fill="none", clipPath et defs en fin de fichier,
    // groupes nommés, calque over.
    let svg = r##"<svg width="{{ photo.w + 20 }}" height="{{ photo.h + 20 }}" viewBox="0 0 {{ photo.w + 20 }} {{ photo.h + 20 }}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="Frame" clip-path="url(#clip0_1_2)">
<rect width="{{ photo.w + 20 }}" height="{{ photo.h + 20 }}" fill="#F4F0E8"/>
<rect id="photo" x="10" y="10" width="{{ photo.w }}" height="{{ photo.h }}" fill="#D9D9D9" display="none"/>
<g id="over">
<rect x="10" y="10" width="{{ photo.w }}" height="4" fill="url(#paint0_linear_1_2)"/>
</g>
</g>
<defs>
<linearGradient id="paint0_linear_1_2" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
<stop stop-color="#FF0000"/>
<stop offset="1" stop-color="#0000FF"/>
</linearGradient>
<clipPath id="clip0_1_2">
<rect width="{{ photo.w + 20 }}" height="{{ photo.h + 20 }}" fill="white"/>
</clipPath>
</defs>
</svg>"##;

    let original = photo(40, 30);
    let rendered = render(svg, &original).unwrap();

    assert_eq!((rendered.image.width, rendered.image.height), (60, 50));
    assert_ne!(pixel(&rendered.image, 12, 11), pixel(&original, 2, 1));
    assert_eq!(pixel(&rendered.image, 30, 30), pixel(&original, 20, 20));
    let cream = pixel(&rendered.image, 2, 2);
    assert!(
        cream[0] > 0.8 && cream[1] > 0.8 && cream[2] > 0.7,
        "{cream:?}"
    );
}

#[test]
fn every_builtin_frame_speaks_both_languages() {
    use crate::frame::{FrameRegistry, ParamKind};

    for info in FrameRegistry::builtin().list() {
        let manifest = &info.manifest;
        let mut texts = vec![
            (format!("{} (nom)", manifest.id), &manifest.name),
            (
                format!("{} (description)", manifest.id),
                &manifest.description,
            ),
        ];
        for param in &manifest.params {
            texts.push((
                format!("{}.{} (libellé)", manifest.id, param.id),
                &param.label,
            ));
            if let Some(section) = &param.section {
                texts.push((format!("{}.{} (section)", manifest.id, param.id), section));
            }
            if let ParamKind::Choice { options, .. } = &param.kind {
                for option in options {
                    texts.push((
                        format!("{}.{}.{} (choix)", manifest.id, param.id, option.id),
                        &option.label,
                    ));
                }
            }
        }

        for (context, text) in texts {
            for language in ["fr", "en"] {
                assert!(text.has_language(language), "{context} : pas de {language}");
            }
        }
    }
}

fn parse(json: &str) -> FrameManifest {
    serde_json::from_str(json).expect("manifeste lisible")
}

#[test]
fn a_manifest_may_mix_plain_and_translated_texts() {
    let manifest = parse(
        r#"{ "id": "mixed", "name": { "fr": "Mixte", "en": "Mixed" }, "description": "Une seule langue",
             "params": [ { "id": "w", "label": "Largeur", "type": "number",
                           "min": 0, "max": 10, "step": 1, "default": 5 } ] }"#,
    );

    manifest.validate().expect("manifeste valide");
}

#[test]
fn a_manifest_with_an_untranslated_label_in_a_language_is_refused() {
    let manifest = parse(
        r#"{ "id": "bad", "name": "Ok",
             "params": [ { "id": "w", "label": { "fr": "Largeur", "en": "" }, "type": "number",
                           "min": 0, "max": 10, "step": 1, "default": 5 } ] }"#,
    );

    let error = manifest.validate().expect_err("libellé vide en anglais");
    assert!(error.to_string().contains("libellé"), "{error}");
}

#[test]
fn a_manifest_with_a_hostile_language_code_is_refused() {
    let manifest = parse(r#"{ "id": "bad", "name": { "fr": "Ok", "../../etc": "x" } }"#);

    assert!(manifest.validate().is_err());
}

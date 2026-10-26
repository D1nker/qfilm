//! SVG de cadre → image finale : calques, rastérisation (resvg), puis composition de la photo en
//! lumière linéaire. Conventions du SVG (repères, calque `over`) : `docs/FRAMES.md`.

use std::collections::HashSet;
use std::sync::LazyLock;

use rayon::prelude::*;
use resvg::tiny_skia::{Pixmap, Transform};
use resvg::usvg;
use roxmltree::{Document, Node};

use super::{FrameError, Rendered, TextZone};
use crate::imaging::buffer::{ImageBuf, srgb_to_linear};
use crate::imaging::fonts::FONT_DB;

const MAX_CANVAS_PIXELS: u64 = 600_000_000;
const MAX_CANVAS_FACTOR: u32 = 4;
const MIN_CANVAS_LIMIT: u32 = 512;

const BACKDROP: [f32; 3] = [1.0, 1.0, 1.0];

static SRGB_TO_LINEAR: LazyLock<[f32; 256]> =
    LazyLock::new(|| std::array::from_fn(|i| srgb_to_linear(i as f32 / 255.0)));

#[derive(Debug, Clone, Copy)]
struct Rect {
    x: f32,
    y: f32,
    width: f32,
    height: f32,
}

struct Markers {
    photo: Rect,
    radius: f32,
    zones: Vec<(String, Rect)>,
    caption_area: Option<Rect>,
}

pub fn compose(svg: &str, photo: &ImageBuf) -> Result<Rendered, FrameError> {
    let document = Document::parse(svg).map_err(|error| FrameError::Svg(error.to_string()))?;
    let markers = read_markers(&document)?;
    let (under_source, over_source) = split_layers(svg, &document);

    let under_tree = parse_tree(&under_source)?;
    let (width, height) = canvas_size(&under_tree, photo)?;

    let mut canvas = ImageBuf::new(width, height);
    blend_layer(&mut canvas, &rasterize(&under_tree, width, height)?, true);

    paste_photo(&mut canvas, photo, &markers)?;

    if let Some(source) = over_source {
        let over_tree = parse_tree(&source)?;
        blend_layer(&mut canvas, &rasterize(&over_tree, width, height)?, false);
    }

    let zones = markers
        .zones
        .iter()
        .map(|(field, rect)| TextZone {
            field: field.clone(),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        })
        .collect();

    let caption_center = markers.caption_area.map_or((0.5, 0.9), |area| {
        (
            (area.x + area.width / 2.0) / width as f32,
            (area.y + area.height / 2.0) / height as f32,
        )
    });

    Ok(Rendered {
        image: canvas,
        zones,
        caption_center,
    })
}

fn number(node: Node, name: &str) -> Result<f32, FrameError> {
    let Some(raw) = node.attribute(name) else {
        return Ok(0.0);
    };
    raw.trim()
        .parse::<f32>()
        .ok()
        .filter(|v| v.is_finite())
        .ok_or_else(|| {
            FrameError::Svg(format!(
                "repère « {} » : « {name} » doit être un nombre, pas « {raw} »",
                node.attribute("id").unwrap_or("?")
            ))
        })
}

fn rect_of(node: Node) -> Result<Rect, FrameError> {
    Ok(Rect {
        x: number(node, "x")?,
        y: number(node, "y")?,
        width: number(node, "width")?,
        height: number(node, "height")?,
    })
}

fn read_markers(document: &Document) -> Result<Markers, FrameError> {
    let mut photo = None;
    let mut radius = 0.0;
    let mut zones = Vec::new();
    let mut caption_area = None;
    let mut seen = HashSet::new();

    for node in document.descendants().filter(Node::is_element) {
        let Some(id) = node.attribute("id") else {
            continue;
        };
        let is_marker = id == "photo" || id == "caption-area" || id.starts_with("zone-");
        if !is_marker {
            continue;
        }

        if node.tag_name().name() != "rect" {
            return Err(FrameError::Svg(format!(
                "le repère « {id} » doit être un <rect>"
            )));
        }
        if !seen.insert(id) {
            return Err(FrameError::Svg(format!("repère « {id} » en double")));
        }

        let rect = rect_of(node)?;
        match id {
            "photo" => {
                radius = number(node, "rx")?.max(0.0);
                photo = Some(rect);
            }
            "caption-area" => caption_area = Some(rect),
            _ => zones.push((id.trim_start_matches("zone-").to_string(), rect)),
        }
    }

    let photo = photo.ok_or_else(|| {
        FrameError::Svg("il manque le repère <rect id=\"photo\" …> qui place la photo".into())
    })?;

    Ok(Markers {
        photo,
        radius,
        zones,
        caption_area,
    })
}

/// Sépare le SVG en calques dessous / dessus (`<g id="over">`, à n'importe quelle profondeur),
/// par plages d'octets pour ne rien réécrire. Le calque du dessus garde la chaîne de ses ancêtres
/// (transform, clip-path) et les `defs` / `style`.
fn split_layers(source: &str, document: &Document) -> (String, Option<String>) {
    let over = document
        .descendants()
        .find(|node| node.is_element() && node.attribute("id") == Some("over"));

    let Some(over) = over else {
        return (source.to_string(), None);
    };

    let under = format!(
        "{}{}",
        &source[..over.range().start],
        &source[over.range().end..]
    );

    let mut ancestors: Vec<Node> = over.ancestors().skip(1).filter(Node::is_element).collect();
    ancestors.reverse();

    let mut head = String::new();
    let mut tail = String::new();
    for ancestor in &ancestors {
        let open_end = ancestor
            .first_child()
            .map_or(ancestor.range().end, |child| child.range().start);
        head.push_str(&source[ancestor.range().start..open_end]);

        for node in ancestor.children().filter(Node::is_element) {
            if matches!(node.tag_name().name(), "defs" | "style") {
                head.push_str(&source[node.range()]);
            }
        }

        let close_start = ancestor
            .last_child()
            .map_or(ancestor.range().end, |child| child.range().end);
        tail.insert_str(0, &source[close_start..ancestor.range().end]);
    }

    let over_source = format!("{head}{}{tail}", &source[over.range()]);
    (under, Some(over_source))
}

fn parse_tree(source: &str) -> Result<usvg::Tree, FrameError> {
    let options = usvg::Options {
        // Jamais de lecture de fichier depuis un SVG importé : seules les images intégrées
        // (data:) sont comprises.
        resources_dir: None,
        fontdb: FONT_DB.clone(),
        ..usvg::Options::default()
    };
    usvg::Tree::from_str(source, &options).map_err(|error| FrameError::Svg(error.to_string()))
}

fn canvas_size(tree: &usvg::Tree, photo: &ImageBuf) -> Result<(u32, u32), FrameError> {
    let size = tree.size();
    let (width, height) = (size.width().ceil() as u32, size.height().ceil() as u32);

    let longest = photo.width.max(photo.height);
    let limit = (longest * MAX_CANVAS_FACTOR).max(MIN_CANVAS_LIMIT);

    let too_small = width < photo.width || height < photo.height;
    let too_big =
        width > limit || height > limit || u64::from(width) * u64::from(height) > MAX_CANVAS_PIXELS;

    if too_small || too_big {
        return Err(FrameError::Svg(format!(
            "dimensions du cadre déraisonnables : {width}×{height} px pour une photo de {}×{}",
            photo.width, photo.height
        )));
    }
    Ok((width, height))
}

fn rasterize(tree: &usvg::Tree, width: u32, height: u32) -> Result<Pixmap, FrameError> {
    let mut pixmap = Pixmap::new(width, height)
        .ok_or_else(|| FrameError::Svg(format!("image de {width}×{height} px impossible")))?;
    resvg::render(tree, Transform::identity(), &mut pixmap.as_mut());
    Ok(pixmap)
}

fn to_linear(pixel: &[u8]) -> ([f32; 3], f32) {
    let alpha = pixel[3];
    if alpha == 0 {
        return ([0.0; 3], 0.0);
    }
    if alpha == 255 {
        let table = &*SRGB_TO_LINEAR;
        return (
            [
                table[usize::from(pixel[0])],
                table[usize::from(pixel[1])],
                table[usize::from(pixel[2])],
            ],
            1.0,
        );
    }

    // Bords anti-aliasés : il faut dé-prémultiplier avant de linéariser.
    let a = f32::from(alpha);
    let straight = |c: u8| srgb_to_linear((f32::from(c) / a).min(1.0));
    (
        [straight(pixel[0]), straight(pixel[1]), straight(pixel[2])],
        a / 255.0,
    )
}

fn blend_layer(canvas: &mut ImageBuf, layer: &Pixmap, over_backdrop: bool) {
    canvas
        .data
        .par_chunks_mut(3)
        .zip(layer.data().par_chunks(4))
        .for_each(|(out, pixel)| {
            let (color, alpha) = to_linear(pixel);
            let base = if over_backdrop {
                BACKDROP
            } else {
                [out[0], out[1], out[2]]
            };
            for channel in 0..3 {
                out[channel] = base[channel] * (1.0 - alpha) + color[channel] * alpha;
            }
        });
}

fn paste_photo(
    canvas: &mut ImageBuf,
    photo: &ImageBuf,
    markers: &Markers,
) -> Result<(), FrameError> {
    let x0 = markers.photo.x.round() as i64;
    let y0 = markers.photo.y.round() as i64;
    let (w, h) = (i64::from(photo.width), i64::from(photo.height));

    if x0 < 0 || y0 < 0 || x0 + w > i64::from(canvas.width) || y0 + h > i64::from(canvas.height) {
        return Err(FrameError::Svg(format!(
            "la photo ({w}×{h}) posée en ({x0}, {y0}) sort du cadre ({}×{})",
            canvas.width, canvas.height
        )));
    }

    let radius = markers.radius.min(w as f32 / 2.0).min(h as f32 / 2.0);
    let canvas_width = canvas.width as usize;

    for row in 0..h {
        let source = &photo.data[(row as usize) * (w as usize) * 3..][..(w as usize) * 3];
        let target_start = (((y0 + row) as usize) * canvas_width + x0 as usize) * 3;
        let target = &mut canvas.data[target_start..target_start + (w as usize) * 3];

        let in_corner_rows = radius > 0.0 && ((row as f32) < radius || (h - row) as f32 <= radius);
        if !in_corner_rows {
            target.copy_from_slice(source);
            continue;
        }

        for column in 0..w as usize {
            let coverage = corner_coverage(
                column as f32 + 0.5,
                row as f32 + 0.5,
                w as f32,
                h as f32,
                radius,
            );
            for channel in 0..3 {
                let index = column * 3 + channel;
                target[index] = target[index] * (1.0 - coverage) + source[index] * coverage;
            }
        }
    }
    Ok(())
}

fn corner_coverage(px: f32, py: f32, w: f32, h: f32, radius: f32) -> f32 {
    let dx = (radius - px).max(px - (w - radius)).max(0.0);
    let dy = (radius - py).max(py - (h - radius)).max(0.0);
    if dx == 0.0 || dy == 0.0 {
        return 1.0;
    }
    (radius - (dx * dx + dy * dy).sqrt() + 0.5).clamp(0.0, 1.0)
}

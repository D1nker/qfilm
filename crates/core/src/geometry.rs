//! Géométrie de la photo : retourner, tourner par quarts de tour, redresser, recadrer.
//!
//! Ce n'est pas un réglage de rendu : un preset ne touche pas au cadrage, et l'intensité d'un look ne
//! le change pas. La géométrie passe donc avant le rendu (grain, vignette et rayons se règlent sur
//! l'image recadrée), et la photo est recadrée depuis ses pixels d'origine, pas depuis l'aperçu.
//!
//! Ordre : retournements, quarts de tour, redressement, recadrage. Le recadrage s'exprime en
//! fractions de la toile obtenue après les quarts de tour (même taille que la photo tournée) ; le
//! redressement fait pivoter la photo dans cette toile, et c'est à l'interface de garder le cadre
//! dans la partie couverte.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use super::buffer::ImageBuf;

/// Redressement maximal, en degrés, de chaque côté.
pub const MAX_ANGLE: f32 = 45.0;

/// Plus petit côté d'un cadre, en fraction de la toile : en deçà, l'image n'a plus de sens.
pub const MIN_CROP: f32 = 0.02;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(default, rename_all = "camelCase")]
pub struct CropRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl Default for CropRect {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(default, rename_all = "camelCase")]
pub struct Geometry {
    /// Quarts de tour dans le sens horaire (0 à 3).
    pub quarter_turns: u8,
    pub flip_horizontal: bool,
    pub flip_vertical: bool,
    /// Redressement en degrés, positif = la photo tourne dans le sens horaire.
    pub angle: f32,
    pub crop: CropRect,
}

impl Default for Geometry {
    fn default() -> Self {
        Self {
            quarter_turns: 0,
            flip_horizontal: false,
            flip_vertical: false,
            angle: 0.0,
            crop: CropRect::default(),
        }
    }
}

impl Geometry {
    /// Des valeurs absurdes (venues d'un fichier ou de l'interface) deviennent des valeurs sûres.
    pub fn sanitized(&self) -> Self {
        let finite = |value: f32, fallback: f32| if value.is_finite() { value } else { fallback };

        let width = finite(self.crop.width, 1.0).clamp(MIN_CROP, 1.0);
        let height = finite(self.crop.height, 1.0).clamp(MIN_CROP, 1.0);
        Self {
            quarter_turns: self.quarter_turns % 4,
            flip_horizontal: self.flip_horizontal,
            flip_vertical: self.flip_vertical,
            angle: finite(self.angle, 0.0).clamp(-MAX_ANGLE, MAX_ANGLE),
            crop: CropRect {
                x: finite(self.crop.x, 0.0).clamp(0.0, 1.0 - width),
                y: finite(self.crop.y, 0.0).clamp(0.0, 1.0 - height),
                width,
                height,
            },
        }
    }

    /// Vrai quand rien ne change la photo : l'étape est alors sautée.
    pub fn is_identity(&self) -> bool {
        let g = self.sanitized();
        g.quarter_turns == 0
            && !g.flip_horizontal
            && !g.flip_vertical
            && g.angle.abs() < 1e-4
            && g.crop.is_whole()
    }

    /// Vrai quand le cadre couvre toute la toile : on montre alors la photo entière, tournée, pour
    /// régler le cadre dessus.
    pub fn shows_whole_canvas(&self) -> bool {
        self.sanitized().crop.is_whole()
    }
}

impl CropRect {
    fn is_whole(&self) -> bool {
        self.x < 1e-4 && self.y < 1e-4 && self.width > 1.0 - 1e-4 && self.height > 1.0 - 1e-4
    }
}

/// Applique la géométrie à `source`, à la résolution de `source`.
pub fn apply(source: &ImageBuf, geometry: &Geometry) -> ImageBuf {
    let g = geometry.sanitized();
    let turned = orient(source, &g);

    let (canvas_w, canvas_h) = (turned.width as f32, turned.height as f32);
    let left = (g.crop.x * canvas_w).round() as u32;
    let top = (g.crop.y * canvas_h).round() as u32;
    let width = ((g.crop.width * canvas_w).round() as u32).clamp(1, turned.width);
    let height = ((g.crop.height * canvas_h).round() as u32).clamp(1, turned.height);

    if g.angle.abs() < 1e-4 {
        crop_pixels(&turned, left, top, width, height)
    } else {
        straighten(&turned, g.angle, (left, top), (width, height))
    }
}

/// L'aperçu d'un recadrage, à partir de la photo d'origine.
///
/// Le cadre est rééchantillonné depuis `full` (réduite juste ce qu'il faut) : un recadrage serré
/// reste net, ce que ferait mal un recadrage de l'aperçu de 1 800 px. Quand le cadre couvre toute la
/// toile (le recadrage est en cours), l'aperçu suffit et reste instantané.
pub fn prepare(full: &ImageBuf, proxy: &ImageBuf, geometry: &Geometry, max_edge: u32) -> ImageBuf {
    let g = geometry.sanitized();
    if g.crop.is_whole() {
        return apply(proxy, &g);
    }

    let turned_is_sideways = g.quarter_turns % 2 == 1;
    let (canvas_w, canvas_h) = if turned_is_sideways {
        (full.height as f32, full.width as f32)
    } else {
        (full.width as f32, full.height as f32)
    };
    let crop_edge = (g.crop.width * canvas_w).max(g.crop.height * canvas_h);

    if crop_edge <= max_edge as f32 {
        return apply(full, &g);
    }

    let scale = max_edge as f32 / crop_edge;
    let longest = full.width.max(full.height) as f32;
    let reduced = full.downscale_to_fit(((longest * scale).ceil() as u32).max(1));
    apply(&reduced, &g)
}

fn orient(source: &ImageBuf, g: &Geometry) -> ImageBuf {
    let mut out = source.clone();
    if g.flip_horizontal {
        out = flip_horizontal(&out);
    }
    if g.flip_vertical {
        out = flip_vertical(&out);
    }
    match g.quarter_turns {
        1 => out.rotate90(),
        2 => out.rotate90().rotate90(),
        3 => out.rotate270(),
        _ => out,
    }
}

fn flip_horizontal(img: &ImageBuf) -> ImageBuf {
    let mut out = ImageBuf::new(img.width, img.height);
    let row = img.width as usize * 3;
    out.data
        .par_chunks_mut(row)
        .zip(img.data.par_chunks(row))
        .for_each(|(to, from)| {
            for (x, pixel) in from.chunks(3).enumerate() {
                let target = (img.width as usize - 1 - x) * 3;
                to[target..target + 3].copy_from_slice(pixel);
            }
        });
    out
}

fn flip_vertical(img: &ImageBuf) -> ImageBuf {
    let mut out = ImageBuf::new(img.width, img.height);
    let row = img.width as usize * 3;
    for (y, from) in img.data.chunks_exact(row).enumerate() {
        let target = (img.height as usize - 1 - y) * row;
        out.data[target..target + row].copy_from_slice(from);
    }
    out
}

fn crop_pixels(img: &ImageBuf, left: u32, top: u32, width: u32, height: u32) -> ImageBuf {
    let width = width.min(img.width - left.min(img.width - 1));
    let height = height.min(img.height - top.min(img.height - 1));
    if width == img.width && height == img.height {
        return img.clone();
    }

    let mut out = ImageBuf::new(width, height);
    let (src_row, out_row) = (img.width as usize * 3, width as usize * 3);
    for y in 0..height as usize {
        let from = (top as usize + y) * src_row + left as usize * 3;
        out.data[y * out_row..(y + 1) * out_row].copy_from_slice(&img.data[from..from + out_row]);
    }
    out
}

/// Fait pivoter la photo autour du centre de la toile, en ne produisant que le cadre demandé.
fn straighten(
    img: &ImageBuf,
    degrees: f32,
    (left, top): (u32, u32),
    (width, height): (u32, u32),
) -> ImageBuf {
    let (sin, cos) = degrees.to_radians().sin_cos();
    let (center_x, center_y) = (img.width as f32 / 2.0, img.height as f32 / 2.0);

    let mut out = ImageBuf::new(width, height);
    out.data
        .par_chunks_mut(width as usize * 3)
        .enumerate()
        .for_each(|(oy, row)| {
            let dy = top as f32 + oy as f32 + 0.5 - center_y;
            for (ox, pixel) in row.chunks_mut(3).enumerate() {
                let dx = left as f32 + ox as f32 + 0.5 - center_x;
                // Rotation inverse : on cherche d'où vient ce point dans la photo.
                let sx = dx * cos + dy * sin + center_x;
                let sy = -dx * sin + dy * cos + center_y;
                pixel.copy_from_slice(&sample(img, sx - 0.5, sy - 0.5));
            }
        });
    out
}

/// Interpolation bilinéaire. Hors de la photo (au-delà d'un pixel) : noir ; sur le bord, le pixel
/// le plus proche, pour qu'un cadre qui touche le bord ne s'y frange pas de noir.
fn sample(img: &ImageBuf, column: f32, row: f32) -> [f32; 3] {
    let (width, height) = (img.width as f32, img.height as f32);
    if column < -1.0 || row < -1.0 || column > width || row > height {
        return [0.0; 3];
    }

    let (left, top) = (column.floor(), row.floor());
    let (along, down) = (column - left, row - top);
    let at = |target_column: f32, target_row: f32| {
        let target_column = target_column.clamp(0.0, width - 1.0) as usize;
        let target_row = target_row.clamp(0.0, height - 1.0) as usize;
        let start = (target_row * img.width as usize + target_column) * 3;
        [img.data[start], img.data[start + 1], img.data[start + 2]]
    };

    let top_pair = [at(left, top), at(left + 1.0, top)];
    let bottom_pair = [at(left, top + 1.0), at(left + 1.0, top + 1.0)];
    std::array::from_fn(|channel| {
        let upper = top_pair[0][channel] + (top_pair[1][channel] - top_pair[0][channel]) * along;
        let lower =
            bottom_pair[0][channel] + (bottom_pair[1][channel] - bottom_pair[0][channel]) * along;
        upper + (lower - upper) * down
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Un pixel par valeur distincte : la valeur du rouge dit d'où il vient (`y * largeur + x`).
    fn numbered(width: u32, height: u32) -> ImageBuf {
        let mut img = ImageBuf::new(width, height);
        for (i, pixel) in img.data.chunks_mut(3).enumerate() {
            pixel.copy_from_slice(&[i as f32, 0.0, 0.0]);
        }
        img
    }

    fn reds(img: &ImageBuf) -> Vec<f32> {
        img.data.chunks(3).map(|p| p[0]).collect()
    }

    fn red_at(img: &ImageBuf, x: u32, y: u32) -> f32 {
        img.data[((y * img.width + x) * 3) as usize]
    }

    fn turned(quarter_turns: u8) -> Geometry {
        Geometry {
            quarter_turns,
            ..Geometry::default()
        }
    }

    #[test]
    fn nothing_to_do_is_the_identity() {
        assert!(Geometry::default().is_identity());
        let img = numbered(4, 3);

        assert_eq!(apply(&img, &Geometry::default()).data, img.data);
    }

    #[test]
    fn anything_that_changes_the_photo_is_not_the_identity() {
        let changes = [
            turned(1),
            Geometry {
                flip_horizontal: true,
                ..Geometry::default()
            },
            Geometry {
                angle: 3.0,
                ..Geometry::default()
            },
            Geometry {
                crop: CropRect {
                    width: 0.5,
                    ..CropRect::default()
                },
                ..Geometry::default()
            },
        ];

        for change in changes {
            assert!(!change.is_identity(), "{change:?}");
        }
        assert!(
            turned(4).is_identity(),
            "quatre quarts de tour font un tour"
        );
    }

    #[test]
    fn a_quarter_turn_goes_clockwise() {
        // 3 colonnes x 2 lignes :  0 1 2 / 3 4 5   →   3 0 / 4 1 / 5 2
        let out = apply(&numbered(3, 2), &turned(1));

        assert_eq!((out.width, out.height), (2, 3));
        assert_eq!(reds(&out), vec![3.0, 0.0, 4.0, 1.0, 5.0, 2.0]);
    }

    #[test]
    fn three_quarter_turns_go_counter_clockwise_and_two_make_a_half_turn() {
        let img = numbered(3, 2);

        assert_eq!(
            reds(&apply(&img, &turned(3))),
            vec![2.0, 5.0, 1.0, 4.0, 0.0, 3.0]
        );
        assert_eq!(
            reds(&apply(&img, &turned(2))),
            vec![5.0, 4.0, 3.0, 2.0, 1.0, 0.0]
        );
    }

    #[test]
    fn flips_mirror_the_photo() {
        let img = numbered(3, 2);
        let horizontal = Geometry {
            flip_horizontal: true,
            ..Geometry::default()
        };
        let vertical = Geometry {
            flip_vertical: true,
            ..Geometry::default()
        };

        assert_eq!(
            reds(&apply(&img, &horizontal)),
            vec![2.0, 1.0, 0.0, 5.0, 4.0, 3.0]
        );
        assert_eq!(
            reds(&apply(&img, &vertical)),
            vec![3.0, 4.0, 5.0, 0.0, 1.0, 2.0]
        );
    }

    #[test]
    fn a_flip_happens_before_the_turn() {
        let both = Geometry {
            quarter_turns: 1,
            flip_horizontal: true,
            ..Geometry::default()
        };
        // 0 1 2 / 3 4 5 → miroir : 2 1 0 / 5 4 3 → quart de tour horaire : 5 2 / 4 1 / 3 0
        assert_eq!(
            reds(&apply(&numbered(3, 2), &both)),
            vec![5.0, 2.0, 4.0, 1.0, 3.0, 0.0]
        );
    }

    /// L'interface s'appuie sur cette équivalence (`useGeometry.flip`) : un miroir horizontal à
    /// l'écran, une fois la photo tournée d'un quart, s'obtient en retournant la source verticalement.
    #[test]
    fn once_turned_a_screen_mirror_is_the_other_flip_of_the_source() {
        let img = numbered(3, 2);
        let turned = reds(&apply(&img, &turned(1)));
        assert_eq!(turned, vec![3.0, 0.0, 4.0, 1.0, 5.0, 2.0]);

        let mirrored_on_screen = vec![0.0, 3.0, 1.0, 4.0, 2.0, 5.0];
        let source_vertical_flip = Geometry {
            quarter_turns: 1,
            flip_vertical: true,
            ..Geometry::default()
        };

        assert_eq!(
            reds(&apply(&img, &source_vertical_flip)),
            mirrored_on_screen
        );
    }

    #[test]
    fn a_crop_keeps_exactly_the_pixels_inside_it() {
        let crop = Geometry {
            crop: CropRect {
                x: 0.25,
                y: 0.5,
                width: 0.5,
                height: 0.5,
            },
            ..Geometry::default()
        };

        let out = apply(&numbered(8, 4), &crop);

        assert_eq!((out.width, out.height), (4, 2));
        assert_eq!(
            reds(&out),
            vec![18.0, 19.0, 20.0, 21.0, 26.0, 27.0, 28.0, 29.0]
        );
    }

    #[test]
    fn a_crop_edge_between_two_pixels_goes_to_the_nearest_one() {
        let crop = Geometry {
            crop: CropRect {
                x: 0.25,
                y: 0.0,
                width: 0.5,
                height: 1.0,
            },
            ..Geometry::default()
        };

        // 0,25 x 10 px = 2,5 : arrondi à 3 ; la largeur fait 5 px.
        assert_eq!(
            reds(&apply(&numbered(10, 1), &crop)),
            vec![3.0, 4.0, 5.0, 6.0, 7.0]
        );
    }

    #[test]
    fn the_crop_is_taken_on_the_turned_canvas() {
        let geometry = Geometry {
            quarter_turns: 1,
            crop: CropRect {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 0.34,
            },
            ..Geometry::default()
        };

        let out = apply(&numbered(3, 2), &geometry);

        // Après le quart de tour : 3 0 / 4 1 / 5 2 ; un tiers de la hauteur garde la première ligne.
        assert_eq!(reds(&out), vec![3.0, 0.0]);
    }

    #[test]
    fn nonsense_is_made_safe() {
        let nonsense = Geometry {
            quarter_turns: 9,
            angle: f32::NAN,
            crop: CropRect {
                x: 7.0,
                y: -2.0,
                width: f32::INFINITY,
                height: 0.0,
            },
            ..Geometry::default()
        }
        .sanitized();

        assert_eq!(nonsense.quarter_turns, 1);
        assert_eq!(nonsense.angle, 0.0);
        assert!(nonsense.crop.width <= 1.0 && nonsense.crop.height >= MIN_CROP);
        assert!(nonsense.crop.x + nonsense.crop.width <= 1.0 + 1e-6);
        assert!(nonsense.crop.y >= 0.0);

        let out = apply(&numbered(10, 10), &nonsense);
        assert!(out.width >= 1 && out.height >= 1);
    }

    #[test]
    fn the_angle_is_limited() {
        let extreme = Geometry {
            angle: 120.0,
            ..Geometry::default()
        };

        assert_eq!(extreme.sanitized().angle, MAX_ANGLE);
    }

    /// Une colonne claire au milieu d'une image sombre, pour voir de quel côté elle penche.
    fn column_scene() -> ImageBuf {
        let mut img = ImageBuf::new(101, 101);
        for y in 0..101 {
            for x in 0..101 {
                let i = (y * 101 + x) * 3;
                let value = if (49..=51).contains(&x) { 1.0 } else { 0.0 };
                img.data[i..i + 3].fill(value);
            }
        }
        img
    }

    fn brightest_column(img: &ImageBuf, row: u32) -> u32 {
        (0..img.width)
            .max_by(|a, b| red_at(img, *a, row).total_cmp(&red_at(img, *b, row)))
            .unwrap_or(0)
    }

    #[test]
    fn a_positive_angle_turns_the_photo_clockwise() {
        let tilted = Geometry {
            angle: 10.0,
            ..Geometry::default()
        };

        let out = apply(&column_scene(), &tilted);

        // Une rotation horaire pousse le haut de la colonne vers la droite et son bas vers la gauche.
        assert!(brightest_column(&out, 10) > 55);
        assert!(brightest_column(&out, 90) < 45);
        assert!(brightest_column(&out, 50).abs_diff(50) <= 1);
    }

    #[test]
    fn a_negative_angle_turns_it_the_other_way() {
        let tilted = Geometry {
            angle: -10.0,
            ..Geometry::default()
        };

        let out = apply(&column_scene(), &tilted);

        assert!(brightest_column(&out, 10) < 45);
        assert!(brightest_column(&out, 90) > 55);
    }

    #[test]
    fn straightening_keeps_the_size_and_blackens_only_what_the_photo_does_not_cover() {
        let mut flat = ImageBuf::new(80, 60);
        flat.data.fill(0.5);
        let tilted = Geometry {
            angle: 20.0,
            ..Geometry::default()
        };

        let out = apply(&flat, &tilted);

        assert_eq!((out.width, out.height), (80, 60));
        assert!(
            (red_at(&out, 40, 30) - 0.5).abs() < 1e-6,
            "le centre est couvert"
        );
        assert!(red_at(&out, 0, 0) < 1e-6, "le coin n'est plus couvert");
    }

    #[test]
    fn a_crop_that_touches_the_edge_has_no_dark_fringe() {
        let mut flat = ImageBuf::new(100, 100);
        flat.data.fill(0.5);
        let geometry = Geometry {
            angle: 0.001,
            crop: CropRect {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 0.5,
            },
            ..Geometry::default()
        };

        let out = apply(&flat, &geometry);

        assert!(out.data.iter().all(|v| (v - 0.5).abs() < 1e-4));
    }

    #[test]
    fn a_tight_crop_is_taken_from_the_original_not_the_preview() {
        // Le « cadre » est le quart gauche d'une grande image à gradient horizontal : à partir d'un
        // aperçu réduit à 100 px il ne ferait que 25 px de large, depuis l'original il en fait 200.
        let mut full = ImageBuf::new(800, 400);
        for pixel in full.data.chunks_mut(3).enumerate() {
            let x = (pixel.0 % 800) as f32;
            pixel.1.fill(x / 800.0);
        }
        let proxy = full.downscale_to_fit(100);
        let geometry = Geometry {
            crop: CropRect {
                x: 0.0,
                y: 0.0,
                width: 0.25,
                height: 1.0,
            },
            ..Geometry::default()
        };

        let out = prepare(&full, &proxy, &geometry, 1800);

        assert_eq!((out.width, out.height), (200, 400));
    }

    #[test]
    fn a_large_crop_is_reduced_to_the_preview_size() {
        let mut full = ImageBuf::new(1600, 800);
        full.data.fill(0.3);
        let proxy = full.downscale_to_fit(400);
        let geometry = Geometry {
            crop: CropRect {
                x: 0.0,
                y: 0.0,
                width: 0.5,
                height: 1.0,
            },
            ..Geometry::default()
        };

        let out = prepare(&full, &proxy, &geometry, 400);

        assert_eq!(out.width.max(out.height), 400);
        let ratio = out.width as f32 / out.height as f32;
        assert!(
            (ratio - 1.0).abs() < 0.02,
            "800 x 800 de l'original : {ratio}"
        );
    }

    #[test]
    fn while_the_crop_is_open_the_whole_turned_photo_is_shown_from_the_preview() {
        let mut full = ImageBuf::new(1600, 800);
        full.data.fill(0.3);
        let proxy = full.downscale_to_fit(400);
        let geometry = Geometry {
            quarter_turns: 1,
            angle: 5.0,
            ..Geometry::default()
        };

        let out = prepare(&full, &proxy, &geometry, 1800);

        assert_eq!((out.width, out.height), (200, 400));
    }
}

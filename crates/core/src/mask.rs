//! Les masques : des réglages de lumière et de couleur limités à une zone de la photo, dessinée par un
//! dégradé linéaire ou radial. Ce n'est pas un look : un preset n'y touche pas et l'intensité non plus.
//!
//! Un masque ne rend pas l'image une seconde fois. Chaque pixel reçoit les réglages globaux plus, pour
//! chaque masque, son décalage pondéré par le poids du masque en ce point (voir `render`), de sorte
//! qu'un masque coûte presque rien. Les coordonnées sont des fractions de la photo recadrée : l'aperçu
//! réduit et l'export en pleine taille dessinent la même zone.

use serde::{Deserialize, Serialize};

/// La forme d'un masque, en fractions de la photo recadrée (0 à 1 en largeur et en hauteur).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MaskShape {
    /// Plein effet en `from`, plus aucun en `to` : la distance entre les deux est le flou du dégradé.
    Linear { from: [f32; 2], to: [f32; 2] },
    /// Une ellipse pleine en son centre. `radius` est en fractions de la **largeur** pour les deux axes
    /// (l'ellipse est donc dessinée en pixels, sa rotation `angle` en degrés ne la déforme pas) ;
    /// `feather` (0 à 1) est la part du rayon, vers l'intérieur, où l'effet s'estompe.
    Radial {
        center: [f32; 2],
        radius: [f32; 2],
        angle: f32,
        feather: f32,
    },
}

/// Les décalages qu'un masque applique, tous nuls par défaut. Les mêmes noms et les mêmes échelles
/// que les réglages globaux : un décalage de 0,5 d'exposition vaut un demi-diaphragme de plus.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(default)]
pub struct MaskAdjust {
    pub exposure: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub temperature: f32,
    pub tint: f32,
    pub saturation: f32,
    pub vibrance: f32,
}

impl MaskAdjust {
    /// Rien à appliquer : le masque est ignoré, comme un curseur resté au neutre.
    pub fn is_neutral(&self) -> bool {
        self.fields().iter().all(|value| value.abs() <= 0.001)
    }

    /// Exactement nul : le pixel n'est dans aucune zone, ses réglages restent les globaux.
    pub fn is_zero(&self) -> bool {
        self.fields().iter().all(|value| *value == 0.0)
    }

    fn fields(&self) -> [f32; 10] {
        [
            self.exposure,
            self.contrast,
            self.highlights,
            self.shadows,
            self.whites,
            self.blacks,
            self.temperature,
            self.tint,
            self.saturation,
            self.vibrance,
        ]
    }

    fn add_scaled(&mut self, other: &MaskAdjust, weight: f32) {
        self.exposure += other.exposure * weight;
        self.contrast += other.contrast * weight;
        self.highlights += other.highlights * weight;
        self.shadows += other.shadows * weight;
        self.whites += other.whites * weight;
        self.blacks += other.blacks * weight;
        self.temperature += other.temperature * weight;
        self.tint += other.tint * weight;
        self.saturation += other.saturation * weight;
        self.vibrance += other.vibrance * weight;
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Mask {
    /// Pour l'interface (clés de liste, sélection) : le rendu l'ignore.
    pub id: String,
    pub shape: MaskShape,
    /// L'effet s'applique hors de la zone au lieu d'y rester.
    #[serde(default)]
    pub invert: bool,
    #[serde(default)]
    pub adjust: MaskAdjust,
}

/// Un masque prêt à servir sur une image de taille donnée : la forme en pixels.
enum Region {
    Linear {
        start: [f32; 2],
        direction: [f32; 2],
        inverse_length_squared: f32,
    },
    Radial {
        center: [f32; 2],
        cos: f32,
        sin: f32,
        inverse_radius: [f32; 2],
        inner: f32,
    },
}

struct Prepared {
    region: Region,
    invert: bool,
    adjust: MaskAdjust,
}

/// Les masques qui comptent, prêts pour une image de `width` × `height`.
pub struct Local {
    masks: Vec<Prepared>,
}

/// Nul avant `edge0`, plein après `edge1`, doux entre les deux.
fn smoothstep(edge0: f32, edge1: f32, value: f32) -> f32 {
    let t = ((value - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

impl Region {
    fn new(shape: &MaskShape, width: f32, height: f32) -> Self {
        match shape {
            MaskShape::Linear { from, to } => {
                let start = [from[0] * width, from[1] * height];
                let direction = [to[0] * width - start[0], to[1] * height - start[1]];
                let length_squared = direction[0] * direction[0] + direction[1] * direction[1];
                Region::Linear {
                    start,
                    direction,
                    // Deux poignées confondues : un bord franc plutôt qu'une division par zéro.
                    inverse_length_squared: 1.0 / length_squared.max(1e-4),
                }
            }
            MaskShape::Radial {
                center,
                radius,
                angle,
                feather,
            } => {
                let (sin, cos) = angle.to_radians().sin_cos();
                // Un rayon nul n'a pas de sens : on garde de quoi diviser.
                let reach = |fraction: f32| 1.0 / (fraction * width).abs().max(0.5);
                Region::Radial {
                    center: [center[0] * width, center[1] * height],
                    cos,
                    sin,
                    inverse_radius: [reach(radius[0]), reach(radius[1])],
                    // Même un bord « franc » garde un soupçon de flou : sans lui il crénèle.
                    inner: 1.0 - feather.clamp(0.0, 1.0).max(0.01),
                }
            }
        }
    }

    /// 1 dans la zone, 0 hors d'elle, entre les deux sur son flou.
    fn weight(&self, x: f32, y: f32) -> f32 {
        match self {
            Region::Linear {
                start,
                direction,
                inverse_length_squared,
            } => {
                let along = ((x - start[0]) * direction[0] + (y - start[1]) * direction[1])
                    * inverse_length_squared;
                1.0 - smoothstep(0.0, 1.0, along)
            }
            Region::Radial {
                center,
                cos,
                sin,
                inverse_radius,
                inner,
            } => {
                let (dx, dy) = (x - center[0], y - center[1]);
                let u = (dx * cos + dy * sin) * inverse_radius[0];
                let v = (-dx * sin + dy * cos) * inverse_radius[1];
                1.0 - smoothstep(*inner, 1.0, (u * u + v * v).sqrt())
            }
        }
    }
}

impl Local {
    /// `None` quand aucun masque ne change rien : le rendu garde alors son chemin sans masque, octet pour octet.
    pub fn new(masks: &[Mask], width: u32, height: u32) -> Option<Self> {
        let (width, height) = (width as f32, height as f32);
        let prepared: Vec<Prepared> = masks
            .iter()
            .filter(|mask| !mask.adjust.is_neutral())
            .map(|mask| Prepared {
                region: Region::new(&mask.shape, width, height),
                invert: mask.invert,
                adjust: mask.adjust,
            })
            .collect();

        (!prepared.is_empty()).then_some(Self { masks: prepared })
    }

    /// La somme, pour ce pixel, des décalages de chaque masque pondérés par son poids.
    pub fn at(&self, x: u32, y: u32) -> MaskAdjust {
        // Le centre du pixel : un pixel de l'aperçu et son voisin de l'export tombent au même endroit.
        let (px, py) = (x as f32 + 0.5, y as f32 + 0.5);
        let mut total = MaskAdjust::default();
        for mask in &self.masks {
            let weight = mask.region.weight(px, py);
            let weight = if mask.invert { 1.0 - weight } else { weight };
            if weight > 0.0 {
                total.add_scaled(&mask.adjust, weight);
            }
        }
        total
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIZE: u32 = 200;

    fn exposure(value: f32) -> MaskAdjust {
        MaskAdjust {
            exposure: value,
            ..MaskAdjust::default()
        }
    }

    fn mask(shape: MaskShape) -> Mask {
        Mask {
            id: "m".into(),
            shape,
            invert: false,
            adjust: exposure(1.0),
        }
    }

    /// Le poids d'un masque au point (`fx`, `fy`) de la photo, en fractions.
    fn weight_at(mask: &Mask, size: u32, fx: f32, fy: f32) -> f32 {
        let local = Local::new(std::slice::from_ref(mask), size, size).expect("un masque actif");
        let (x, y) = (
            (fx * size as f32 - 0.5).round() as u32,
            (fy * size as f32 - 0.5).round() as u32,
        );
        local.at(x, y).exposure
    }

    fn linear_down() -> Mask {
        // Plein effet à 25 % de la hauteur, plus aucun à 75 %.
        mask(MaskShape::Linear {
            from: [0.5, 0.25],
            to: [0.5, 0.75],
        })
    }

    fn radial(angle: f32, feather: f32) -> Mask {
        mask(MaskShape::Radial {
            center: [0.5, 0.5],
            radius: [0.3, 0.1],
            angle,
            feather,
        })
    }

    #[test]
    fn a_linear_gradient_is_full_before_its_start_and_gone_after_its_end() {
        let mask = linear_down();

        assert!((weight_at(&mask, SIZE, 0.5, 0.05) - 1.0).abs() < 1e-3);
        assert!((weight_at(&mask, SIZE, 0.5, 0.25) - 1.0).abs() < 0.02);
        assert!(weight_at(&mask, SIZE, 0.5, 0.75).abs() < 0.02);
        assert!(weight_at(&mask, SIZE, 0.5, 0.95).abs() < 1e-3);
    }

    #[test]
    fn a_linear_gradient_is_half_way_in_the_middle_and_falls_off_smoothly() {
        let mask = linear_down();

        assert!((weight_at(&mask, SIZE, 0.5, 0.5) - 0.5).abs() < 0.02);
        let samples: Vec<f32> = (0..=10)
            .map(|i| weight_at(&mask, SIZE, 0.5, 0.25 + 0.05 * i as f32))
            .collect();
        assert!(samples.windows(2).all(|pair| pair[0] >= pair[1] - 1e-4));
    }

    #[test]
    fn a_linear_gradient_only_depends_on_the_distance_along_its_line() {
        let mask = linear_down();

        let left = weight_at(&mask, SIZE, 0.1, 0.4);
        let right = weight_at(&mask, SIZE, 0.9, 0.4);

        assert!((left - right).abs() < 1e-4);
    }

    #[test]
    fn a_slanted_gradient_follows_its_own_direction() {
        // De haut-gauche à bas-droite : le coin haut-droit et le coin bas-gauche sont à mi-chemin.
        let mask = mask(MaskShape::Linear {
            from: [0.0, 0.0],
            to: [1.0, 1.0],
        });

        assert!(weight_at(&mask, SIZE, 0.05, 0.05) > 0.9);
        assert!(weight_at(&mask, SIZE, 0.95, 0.95) < 0.1);
        assert!((weight_at(&mask, SIZE, 0.9, 0.1) - 0.5).abs() < 0.05);
        assert!((weight_at(&mask, SIZE, 0.1, 0.9) - 0.5).abs() < 0.05);
    }

    #[test]
    fn inverting_swaps_the_zone_with_the_rest() {
        let mut mask = linear_down();
        let before = weight_at(&mask, SIZE, 0.5, 0.4);

        mask.invert = true;

        assert!((weight_at(&mask, SIZE, 0.5, 0.4) - (1.0 - before)).abs() < 1e-4);
        assert!(weight_at(&mask, SIZE, 0.5, 0.05) < 1e-3);
        assert!((weight_at(&mask, SIZE, 0.5, 0.95) - 1.0).abs() < 1e-3);
    }

    #[test]
    fn a_radial_mask_is_full_at_its_centre_and_gone_outside() {
        let mask = radial(0.0, 0.5);

        assert!((weight_at(&mask, SIZE, 0.5, 0.5) - 1.0).abs() < 1e-3);
        assert!(weight_at(&mask, SIZE, 0.05, 0.05) < 1e-4);
        // Le grand axe vaut 30 % de la largeur : 0,9 est hors de l'ellipse.
        assert!(weight_at(&mask, SIZE, 0.9, 0.5) < 1e-4);
    }

    #[test]
    fn the_feather_is_the_share_of_the_radius_where_the_effect_fades() {
        // Rayon horizontal 0,3 de la largeur, flou 0,5 : plein jusqu'à 0,15, nul à 0,3, moitié à 0,225.
        let mask = radial(0.0, 0.5);

        assert!((weight_at(&mask, SIZE, 0.5 + 0.14, 0.5) - 1.0).abs() < 0.01);
        assert!((weight_at(&mask, SIZE, 0.5 + 0.225, 0.5) - 0.5).abs() < 0.03);
        assert!(weight_at(&mask, SIZE, 0.5 + 0.29, 0.5) < 0.02);
    }

    #[test]
    fn no_feather_gives_a_firm_edge() {
        let mask = radial(0.0, 0.0);

        assert!(weight_at(&mask, SIZE, 0.5 + 0.28, 0.5) > 0.9);
        assert!(weight_at(&mask, SIZE, 0.5 + 0.32, 0.5) < 0.1);
    }

    #[test]
    fn the_angle_turns_the_ellipse() {
        // Long de 0,3 de large et haut de 0,1 : à 90° c'est l'inverse.
        let flat = radial(0.0, 0.0);
        let upright = radial(90.0, 0.0);

        assert!(weight_at(&flat, SIZE, 0.75, 0.5) > 0.9);
        assert!(weight_at(&flat, SIZE, 0.5, 0.75) < 0.1);
        assert!(weight_at(&upright, SIZE, 0.75, 0.5) < 0.1);
        assert!(weight_at(&upright, SIZE, 0.5, 0.75) > 0.9);
    }

    #[test]
    fn a_zone_is_the_same_whatever_the_resolution() {
        // C'est ce qui fait que l'aperçu et l'export dessinent le même masque.
        // Une zone assez douce pour qu'un pixel de l'image réduite (1 % de la photo) n'en change pas le poids.
        let soft_ellipse = mask(MaskShape::Radial {
            center: [0.5, 0.5],
            radius: [0.4, 0.3],
            angle: 30.0,
            feather: 1.0,
        });
        for mask in [linear_down(), soft_ellipse] {
            for (fx, fy) in [(0.5, 0.4), (0.3, 0.55), (0.62, 0.48), (0.5, 0.5)] {
                let small = weight_at(&mask, 100, fx, fy);
                let large = weight_at(&mask, 1600, fx, fy);
                assert!((small - large).abs() < 0.03, "{fx},{fy}: {small} / {large}");
            }
        }
    }

    #[test]
    fn a_zone_follows_the_shape_of_the_photo_not_a_square() {
        // Un dégradé à 50 % de la hauteur est à 50 % de la hauteur quelle que soit la largeur.
        let mask = mask(MaskShape::Linear {
            from: [0.5, 0.4],
            to: [0.5, 0.6],
        });
        let local = Local::new(&[mask], 600, 200).expect("un masque actif");

        assert!((local.at(300, 99).exposure - 0.5).abs() < 0.05);
        assert!(local.at(300, 10).exposure > 0.99);
        assert!(local.at(300, 190).exposure < 0.01);
    }

    #[test]
    fn a_pixel_is_measured_at_its_centre() {
        // Sur quatre pixels de large, le premier est à 1/8 de la largeur, pas à 0 : c'est ce demi-pixel
        // qui fait qu'un pixel de l'aperçu et son voisin de l'export tombent au même endroit.
        let across = mask(MaskShape::Linear {
            from: [0.0, 0.5],
            to: [1.0, 0.5],
        });
        let local = Local::new(&[across], 4, 1).expect("un masque actif");

        let at_an_eighth = 1.0 - smoothstep(0.0, 1.0, 0.125);
        assert!((local.at(0, 0).exposure - at_an_eighth).abs() < 1e-5);
        assert!(local.at(0, 0).exposure < 0.99);
    }

    #[test]
    fn masks_add_up_where_they_overlap() {
        let one = linear_down();
        let mut two = linear_down();
        two.adjust = exposure(0.5);

        let local = Local::new(&[one, two], SIZE, SIZE).expect("deux masques actifs");

        assert!((local.at(100, 5).exposure - 1.5).abs() < 1e-3);
    }

    #[test]
    fn a_mask_that_changes_nothing_is_dropped() {
        let mut idle = linear_down();
        idle.adjust = MaskAdjust::default();

        assert!(Local::new(&[idle.clone()], SIZE, SIZE).is_none());
        assert!(Local::new(&[], SIZE, SIZE).is_none());

        let active = linear_down();
        assert!(Local::new(&[idle, active], SIZE, SIZE).is_some());
    }

    #[test]
    fn two_handles_on_the_same_spot_do_not_blow_up() {
        let mask = mask(MaskShape::Linear {
            from: [0.5, 0.5],
            to: [0.5, 0.5],
        });
        let local = Local::new(&[mask], SIZE, SIZE).expect("un masque actif");

        for y in [0, 100, 199] {
            assert!(local.at(100, y).exposure.is_finite());
        }
    }

    #[test]
    fn a_zero_radius_does_not_blow_up() {
        let mask = mask(MaskShape::Radial {
            center: [0.5, 0.5],
            radius: [0.0, 0.0],
            angle: 0.0,
            feather: 0.0,
        });
        let local = Local::new(&[mask], SIZE, SIZE).expect("un masque actif");

        assert!(local.at(10, 10).exposure.is_finite());
        assert!(local.at(10, 10).exposure < 1e-3);
    }

    #[test]
    fn reads_what_the_interface_sends() {
        let json = r#"{
            "id": "a",
            "shape": { "kind": "radial", "center": [0.5, 0.5], "radius": [0.2, 0.1], "angle": 15, "feather": 0.3 },
            "adjust": { "exposure": 0.7, "saturation": -0.2 }
        }"#;

        let mask: Mask = serde_json::from_str(json).expect("un masque");

        assert_eq!(mask.id, "a");
        assert!(!mask.invert);
        assert!((mask.adjust.exposure - 0.7).abs() < 1e-6);
        assert!((mask.adjust.saturation + 0.2).abs() < 1e-6);
        assert!(mask.adjust.contrast.abs() < 1e-6);
        assert!(matches!(mask.shape, MaskShape::Radial { .. }));

        let linear: Mask = serde_json::from_str(
            r#"{ "id": "b", "shape": { "kind": "linear", "from": [0, 0], "to": [0, 1] }, "invert": true }"#,
        )
        .expect("un masque linéaire");
        assert!(linear.invert);
        assert!(linear.adjust.is_neutral());
    }
}

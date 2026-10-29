//! Courbes de tons : une courbe RGB et une par canal, définies par des points libres.
//!
//! Une courbe est une liste de points `[x, y]` dans [0, 1], lus comme à l'écran (valeurs encodées
//! sRGB). Liste vide = courbe neutre. Les données viennent d'un fichier de preset ou de l'interface :
//! rien n'est supposé, tout passe par `sanitize`.

use serde::{Deserialize, Serialize};

use super::buffer::{linear_to_srgb, srgb_to_linear};

pub type CurvePoint = [f32; 2];

/// Au-delà, une courbe n'est plus lisible ni réglable à la souris.
pub const MAX_POINTS: usize = 16;

/// Écart minimal entre deux points, pour que la pente reste finie.
const MIN_GAP: f32 = 0.002;

/// Pas de la table de correspondance (en racine de la valeur linéaire : voir `Lut`).
const LUT_STEPS: usize = 1024;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(default, rename_all = "camelCase")]
pub struct ToneCurves {
    pub rgb: Vec<CurvePoint>,
    pub red: Vec<CurvePoint>,
    pub green: Vec<CurvePoint>,
    pub blue: Vec<CurvePoint>,
}

/// Une table par canal, de la valeur linéaire d'entrée à la valeur linéaire de sortie.
///
/// Indexée par la *racine* de l'entrée : la racine suit à peu près la perception, donc 1 024 pas
/// suffisent dans les ombres, et elle coûte une instruction là où l'encodage sRGB coûte une
/// puissance par canal et par pixel.
pub struct Lut {
    table: Vec<f32>,
}

impl Lut {
    fn build(curves: &[&Spline]) -> Self {
        let table = (0..=LUT_STEPS)
            .map(|i| {
                let t = i as f32 / LUT_STEPS as f32;
                let mut encoded = linear_to_srgb(t * t);
                for curve in curves {
                    encoded = curve.eval(encoded);
                }
                srgb_to_linear(encoded.clamp(0.0, 1.0))
            })
            .collect();
        Self { table }
    }

    pub fn map(&self, linear: f32) -> f32 {
        let last = self.table[LUT_STEPS];
        if linear >= 1.0 {
            // Un soleil plus clair que le blanc suit le décalage du point blanc, il ne s'écrase pas.
            return linear + (last - 1.0);
        }
        let position = linear.max(0.0).sqrt() * LUT_STEPS as f32;
        let index = (position as usize).min(LUT_STEPS - 1);
        let fraction = position - index as f32;
        self.table[index] + (self.table[index + 1] - self.table[index]) * fraction
    }
}

impl ToneCurves {
    /// `None` quand aucune courbe ne change l'image : l'étape est alors sautée, et le rendu reste
    /// exactement celui d'avant les courbes.
    pub fn luts(&self) -> Option<[Lut; 3]> {
        let master = Spline::from_points(&self.rgb);
        let red = Spline::from_points(&self.red);
        let green = Spline::from_points(&self.green);
        let blue = Spline::from_points(&self.blue);
        if master.is_none() && red.is_none() && green.is_none() && blue.is_none() {
            return None;
        }

        let build = |channel: &Option<Spline>| {
            let chain: Vec<&Spline> = master.iter().chain(channel.iter()).collect();
            Lut::build(&chain)
        };
        Some([build(&red), build(&green), build(&blue)])
    }
}

/// Points triés, bornés à [0, 1], d'écart minimal garanti, extrémités épinglées en x = 0 et x = 1.
/// `None` si la liste ne dessine aucune courbe (vide, un seul point, ou la diagonale).
pub fn sanitize(points: &[CurvePoint]) -> Option<Vec<CurvePoint>> {
    let mut sorted: Vec<CurvePoint> = points
        .iter()
        .filter(|p| p[0].is_finite() && p[1].is_finite())
        .map(|p| [p[0].clamp(0.0, 1.0), p[1].clamp(0.0, 1.0)])
        .collect();
    if sorted.len() < 2 {
        return None;
    }
    sorted.sort_by(|a, b| a[0].total_cmp(&b[0]));
    sorted.truncate(MAX_POINTS);

    let first_y = sorted[0][1];
    let last_y = sorted[sorted.len() - 1][1];
    let mut out: Vec<CurvePoint> = vec![[0.0, first_y]];
    for p in &sorted[1..sorted.len() - 1] {
        if p[0] - out[out.len() - 1][0] >= MIN_GAP && 1.0 - p[0] >= MIN_GAP {
            out.push(*p);
        }
    }
    out.push([1.0, last_y]);

    let diagonal = out.iter().all(|p| (p[0] - p[1]).abs() < 1e-4);
    (!diagonal).then_some(out)
}

/// Interpolation cubique qui ne dépasse jamais ses points (Fritsch-Butland) : une courbe qui
/// monte ne se met pas à osciller entre deux points.
struct Spline {
    points: Vec<CurvePoint>,
    slopes: Vec<f32>,
}

impl Spline {
    fn from_points(points: &[CurvePoint]) -> Option<Self> {
        let points = sanitize(points)?;
        let n = points.len();
        let secants: Vec<f32> = points
            .windows(2)
            .map(|w| (w[1][1] - w[0][1]) / (w[1][0] - w[0][0]))
            .collect();

        let mut slopes = vec![0.0; n];
        slopes[0] = secants[0];
        slopes[n - 1] = secants[n - 2];
        for k in 1..n - 1 {
            let (before, after) = (secants[k - 1], secants[k]);
            if before * after > 0.0 {
                let (h0, h1) = (
                    points[k][0] - points[k - 1][0],
                    points[k + 1][0] - points[k][0],
                );
                let (w0, w1) = (2.0 * h1 + h0, h1 + 2.0 * h0);
                slopes[k] = (w0 + w1) / (w0 / before + w1 / after);
            }
        }
        Some(Self { points, slopes })
    }

    fn eval(&self, x: f32) -> f32 {
        let x = x.clamp(0.0, 1.0);
        let k = self
            .points
            .windows(2)
            .position(|w| x <= w[1][0])
            .unwrap_or(self.points.len() - 2);
        let (p0, p1) = (self.points[k], self.points[k + 1]);
        let h = p1[0] - p0[0];
        let t = (x - p0[0]) / h;
        let (t2, t3) = (t * t, t * t * t);
        (2.0 * t3 - 3.0 * t2 + 1.0) * p0[1]
            + (t3 - 2.0 * t2 + t) * h * self.slopes[k]
            + (-2.0 * t3 + 3.0 * t2) * p1[1]
            + (t3 - t2) * h * self.slopes[k + 1]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn curve(points: &[CurvePoint]) -> Spline {
        Spline::from_points(points).expect("une vraie courbe")
    }

    fn only_rgb(points: &[CurvePoint]) -> ToneCurves {
        ToneCurves {
            rgb: points.to_vec(),
            ..ToneCurves::default()
        }
    }

    #[test]
    fn no_curve_means_no_stage() {
        assert!(ToneCurves::default().luts().is_none());
        assert!(only_rgb(&[[0.0, 0.0], [1.0, 1.0]]).luts().is_none());
        assert!(
            only_rgb(&[[0.0, 0.0], [0.4, 0.4], [1.0, 1.0]])
                .luts()
                .is_none()
        );
    }

    #[test]
    fn a_curve_passes_through_its_points() {
        let spline = curve(&[[0.0, 0.1], [0.3, 0.2], [0.7, 0.9], [1.0, 0.95]]);

        for [x, y] in [[0.0, 0.1], [0.3, 0.2], [0.7, 0.9], [1.0, 0.95]] {
            assert!((spline.eval(x) - y).abs() < 1e-5, "à x = {x}");
        }
    }

    /// Les mêmes valeurs figurent dans `curves.test.ts` : l'interface dessine la courbe avec sa propre
    /// copie de ce calcul, et les deux doivent rester d'accord. Calculées à part, en Python.
    #[test]
    fn the_curve_matches_the_reference_values_the_interface_is_tested_against() {
        let spline = curve(&[[0.0, 0.1], [0.3, 0.2], [0.7, 0.9], [1.0, 0.95]]);

        for (x, expected) in [
            (0.05, 0.115_215),
            (0.15, 0.142_159),
            (0.5, 0.562_48),
            (0.85, 0.929_731),
            (0.95, 0.942_543),
        ] {
            assert!((spline.eval(x) - expected).abs() < 1e-5, "à x = {x}");
        }
    }

    #[test]
    fn a_rising_curve_never_overshoots_between_its_points() {
        // Un saut brusque : une spline naturelle ferait osciller ici, pas celle-ci.
        let spline = curve(&[[0.0, 0.0], [0.4, 0.05], [0.5, 0.95], [1.0, 1.0]]);

        let mut previous = 0.0;
        for i in 0..=1000 {
            let value = spline.eval(i as f32 / 1000.0);
            assert!((0.0..=1.0).contains(&value), "dépasse : {value}");
            assert!(value >= previous - 1e-6, "redescend à {i}");
            previous = value;
        }
    }

    #[test]
    fn an_s_curve_darkens_the_shadows_and_lightens_the_highlights() {
        let luts = only_rgb(&[[0.0, 0.0], [0.25, 0.18], [0.75, 0.82], [1.0, 1.0]])
            .luts()
            .expect("courbe active");
        let lut = &luts[0];

        assert!(lut.map(srgb_to_linear(0.25)) < srgb_to_linear(0.25) - 0.005);
        assert!(lut.map(srgb_to_linear(0.75)) > srgb_to_linear(0.75) + 0.005);
        let middle = srgb_to_linear(0.5);
        assert!((lut.map(middle) - middle).abs() < 0.003);
    }

    #[test]
    fn the_table_matches_the_curve_in_encoded_terms() {
        let points = [[0.0, 0.0], [0.5, 0.65], [1.0, 1.0]];
        let spline = curve(&points);
        let luts = only_rgb(&points).luts().expect("courbe active");

        for encoded in [0.02, 0.1, 0.35, 0.5, 0.8, 0.97] {
            let expected = srgb_to_linear(spline.eval(encoded));
            let got = luts[0].map(srgb_to_linear(encoded));
            assert!(
                (got - expected).abs() < 2e-3,
                "à {encoded} : {got} au lieu de {expected}"
            );
        }
    }

    #[test]
    fn a_channel_curve_only_touches_its_channel_and_stacks_on_the_rgb_one() {
        let curves = ToneCurves {
            rgb: vec![[0.0, 0.0], [0.5, 0.6], [1.0, 1.0]],
            red: vec![[0.0, 0.0], [0.5, 0.7], [1.0, 1.0]],
            ..ToneCurves::default()
        };
        let [red, green, blue] = curves.luts().expect("courbes actives");
        let mid = srgb_to_linear(0.5);

        assert!((green.map(mid) - blue.map(mid)).abs() < 1e-6);
        assert!(red.map(mid) > green.map(mid) + 0.01);
        assert!(green.map(mid) > mid);
    }

    #[test]
    fn raised_blacks_and_lowered_whites_are_supported() {
        let luts = only_rgb(&[[0.0, 0.1], [1.0, 0.9]])
            .luts()
            .expect("courbe active");

        assert!((luts[0].map(0.0) - srgb_to_linear(0.1)).abs() < 1e-4);
        assert!((luts[0].map(1.0) - srgb_to_linear(0.9)).abs() < 1e-4);
    }

    #[test]
    fn a_value_brighter_than_white_keeps_its_headroom() {
        let luts = only_rgb(&[[0.0, 0.0], [0.5, 0.6], [1.0, 1.0]])
            .luts()
            .expect("courbe active");

        assert!((luts[0].map(2.0) - 2.0).abs() < 1e-5);
        assert!(luts[0].map(1.5) > luts[0].map(1.0));
    }

    #[test]
    fn untrusted_points_are_cleaned_up() {
        let cleaned = sanitize(&[
            [0.9, 0.9],
            [f32::NAN, 0.5],
            [0.6, f32::NAN],
            [-3.0, 0.2],
            [0.5, 7.0],
            [0.5005, 0.3],
            [2.0, 0.4],
        ])
        .expect("une courbe");

        assert_eq!(cleaned.first().map(|p| p[0]), Some(0.0));
        assert_eq!(cleaned.last().map(|p| p[0]), Some(1.0));
        assert!(cleaned.windows(2).all(|w| w[1][0] - w[0][0] >= MIN_GAP));
        assert!(cleaned.iter().flatten().all(|v| (0.0..=1.0).contains(v)));
    }

    #[test]
    fn too_many_points_are_capped() {
        let many: Vec<CurvePoint> = (0..100)
            .map(|i| {
                let x = i as f32 / 99.0;
                [x, (x * 1.1).min(1.0)]
            })
            .collect();

        assert!(sanitize(&many).expect("une courbe").len() <= MAX_POINTS);
    }

    #[test]
    fn a_curve_can_be_inverted() {
        let luts = only_rgb(&[[0.0, 1.0], [1.0, 0.0]])
            .luts()
            .expect("courbe active");

        assert!(luts[0].map(0.0) > 0.99);
        assert!(luts[0].map(1.0 - 1e-6) < 0.01);
    }
}

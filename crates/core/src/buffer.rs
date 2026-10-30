use std::sync::LazyLock;

/// Image en RGB **linéaire** (gamma retirée), en `f32`. Format pivot : chaque décodeur le produit
/// et tout le pipeline ne travaille que dessus.
#[derive(Clone)]
pub struct ImageBuf {
    pub width: u32,
    pub height: u32,
    /// RGB entrelacé, longueur = width * height * 3.
    pub data: Vec<f32>,
}

impl ImageBuf {
    pub fn rotate90(&self) -> ImageBuf {
        let mut out = ImageBuf::new(self.height, self.width);
        for y in 0..self.height {
            for x in 0..self.width {
                let from = ((y as usize) * (self.width as usize) + x as usize) * 3;
                let to = ((x as usize) * (out.width as usize) + (self.height - 1 - y) as usize) * 3;
                out.data[to..to + 3].copy_from_slice(&self.data[from..from + 3]);
            }
        }
        out
    }

    pub fn rotate270(&self) -> ImageBuf {
        let mut out = ImageBuf::new(self.height, self.width);
        for y in 0..self.height {
            for x in 0..self.width {
                let from = ((y as usize) * (self.width as usize) + x as usize) * 3;
                let to = (((self.width - 1 - x) as usize) * (out.width as usize) + y as usize) * 3;
                out.data[to..to + 3].copy_from_slice(&self.data[from..from + 3]);
            }
        }
        out
    }

    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            data: vec![0.0; (width as usize) * (height as usize) * 3],
        }
    }

    /// De combien cette image est plus grande que `smaller`, sa version réduite.
    pub fn scale_over(&self, smaller: &ImageBuf) -> f32 {
        self.width as f32 / smaller.width as f32
    }

    pub fn downscale_to_fit(&self, max_edge: u32) -> ImageBuf {
        let longest = self.width.max(self.height);
        if longest <= max_edge {
            return self.clone();
        }

        let ratio = max_edge as f32 / longest as f32;
        let new_w = ((self.width as f32 * ratio).round() as u32).max(1);
        let new_h = ((self.height as f32 * ratio).round() as u32).max(1);
        let mut out = ImageBuf::new(new_w, new_h);

        // Moyenne par boîte : un plus proche voisin ferait crépiter le grain.
        let x_step = self.width as f32 / new_w as f32;
        let y_step = self.height as f32 / new_h as f32;

        for y in 0..new_h {
            let sy0 = (y as f32 * y_step) as u32;
            let sy1 = (((y + 1) as f32 * y_step) as u32)
                .min(self.height)
                .max(sy0 + 1);
            for x in 0..new_w {
                let sx0 = (x as f32 * x_step) as u32;
                let sx1 = (((x + 1) as f32 * x_step) as u32)
                    .min(self.width)
                    .max(sx0 + 1);

                let mut acc = [0.0f32; 3];
                let mut n = 0.0f32;
                for sy in sy0..sy1 {
                    for sx in sx0..sx1 {
                        let i = ((sy as usize) * (self.width as usize) + sx as usize) * 3;
                        acc[0] += self.data[i];
                        acc[1] += self.data[i + 1];
                        acc[2] += self.data[i + 2];
                        n += 1.0;
                    }
                }

                let o = ((y as usize) * (new_w as usize) + x as usize) * 3;
                out.data[o] = acc[0] / n;
                out.data[o + 1] = acc[1] / n;
                out.data[o + 2] = acc[2] / n;
            }
        }

        out
    }
}

fn srgb_to_linear_exact(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn linear_to_srgb_exact(c: f32) -> f32 {
    if c <= 0.003_130_8 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

/// Les deux fonctions de transfert sRGB sont la moitié du temps du mélangeur, de l'étalonnage et de
/// la conversion de chaque aperçu (un `powf` par canal et par pixel). On les échantillonne une fois pour toutes et
/// on interpole : sur la plage de l'écran, l'écart avec la formule exacte reste vingt fois sous un niveau
/// d'un export en 16 bits.
const TABLE_STEPS: usize = 4096;

/// Pour l'encodage, des pas réguliers en racine quatrième du linéaire (très fins dans les ombres, où la courbe
/// monte vite), jusqu'à la valeur 16, au-delà de laquelle on calcule.
const ENCODE_REACH: f32 = 2.0;

static ENCODE: LazyLock<Vec<f32>> = LazyLock::new(|| {
    (0..=TABLE_STEPS)
        .map(|i| linear_to_srgb_exact((i as f32 / TABLE_STEPS as f32 * ENCODE_REACH).powi(4)))
        .collect()
});

/// Pour le décodage, des pas réguliers de 0 à 1 : la courbe y est douce partout.
static DECODE: LazyLock<Vec<f32>> = LazyLock::new(|| {
    (0..=TABLE_STEPS)
        .map(|i| srgb_to_linear_exact(i as f32 / TABLE_STEPS as f32))
        .collect()
});

fn interpolated(table: &[f32], position: f32) -> f32 {
    let below = position as usize;
    let fraction = position - below as f32;
    table[below] + (table[below + 1] - table[below]) * fraction
}

pub fn srgb_to_linear(c: f32) -> f32 {
    // Hors de [0, 1[ (négatif, plus clair que le blanc, ou pas un nombre), la formule exacte.
    if (0.0..1.0).contains(&c) {
        interpolated(&DECODE, c * TABLE_STEPS as f32)
    } else {
        srgb_to_linear_exact(c)
    }
}

pub fn linear_to_srgb(c: f32) -> f32 {
    if c >= 0.0 {
        let position = c.sqrt().sqrt() * (TABLE_STEPS as f32 / ENCODE_REACH);
        if position < TABLE_STEPS as f32 {
            return interpolated(&ENCODE, position);
        }
    }
    linear_to_srgb_exact(c)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Des valeurs de la nuit noire au soleil plus clair que le blanc : serrées près de zéro, où l'œil est exigeant.
    fn scan(max: f32, count: u32) -> impl Iterator<Item = f32> {
        (0..=count).map(move |i| max * (i as f32 / count as f32).powi(3))
    }

    /// Un niveau d'un export en 16 bits vaut 1,5e-5 : les tables restent à une petite fraction de cela.
    const SIXTEEN_BIT_LEVEL: f32 = 1.0 / 65_535.0;

    #[test]
    fn encoding_is_thirty_times_finer_than_a_sixteen_bit_level_away_from_the_knee() {
        let worst = scan(1.2, 400_000)
            // Le coude de la courbe sRGB (0,0031308) : voir le test suivant.
            .filter(|c| (c - 0.003_130_8).abs() > 0.0005)
            .map(|c| (linear_to_srgb(c) - linear_to_srgb_exact(c)).abs())
            .fold(0.0, f32::max);

        assert!(worst < SIXTEEN_BIT_LEVEL / 30.0, "écart maximal {worst}");
    }

    #[test]
    fn at_the_knee_of_the_curve_the_table_is_still_a_tenth_of_a_sixteen_bit_level_off_at_worst() {
        // Là, la formule passe d'une droite à une puissance : la table ne suit pas le coude à l'échelon près.
        let worst = scan(1.2, 400_000)
            .map(|c| (linear_to_srgb(c) - linear_to_srgb_exact(c)).abs())
            .fold(0.0, f32::max);

        assert!(worst < SIXTEEN_BIT_LEVEL / 10.0, "écart maximal {worst}");
    }

    #[test]
    fn encoding_stays_close_up_to_the_brightest_a_photo_gets() {
        // Au-delà de 1 l'écran sature : seul le calcul d'un reflet plus clair que le blanc en dépend.
        let worst = scan(20.0, 400_000)
            .map(|c| (linear_to_srgb(c) - linear_to_srgb_exact(c)).abs())
            .fold(0.0, f32::max);

        assert!(worst < SIXTEEN_BIT_LEVEL / 5.0, "écart maximal {worst}");
    }

    #[test]
    fn decoding_stays_a_small_fraction_of_a_sixteen_bit_level_off() {
        // En dessous, ce serait le bruit de l'arithmétique en `f32` elle-même (un pas vaut 6e-8 près de 1).
        let worst = scan(1.2, 400_000)
            .map(|c| (srgb_to_linear(c) - srgb_to_linear_exact(c)).abs())
            .fold(0.0, f32::max);

        assert!(worst < SIXTEEN_BIT_LEVEL / 20.0, "écart maximal {worst}");
    }

    #[test]
    fn there_and_back_gives_the_value_back() {
        let worst = scan(1.0, 100_000)
            .map(|c| (srgb_to_linear(linear_to_srgb(c)) - c).abs() / c.max(1e-4))
            .fold(0.0, f32::max);

        assert!(worst < 1e-3, "écart relatif maximal {worst}");
    }

    #[test]
    fn encoding_never_goes_backwards() {
        let mut previous = 0.0;
        for c in scan(20.0, 200_000) {
            let value = linear_to_srgb(c);
            assert!(value >= previous - 1e-7, "{c}");
            previous = value;
        }
    }

    #[test]
    fn the_ends_and_what_is_not_a_plain_value_follow_the_formula() {
        assert_eq!(linear_to_srgb(0.0), 0.0);
        assert!((linear_to_srgb(1.0) - 1.0).abs() < 1e-6);
        assert_eq!(srgb_to_linear(0.0), 0.0);
        // Hors de la table, la formule exacte : 1 et au-delà pour le décodage, au-delà de 16 pour l'encodage,
        // et dans les deux sens ce qui est négatif.
        for c in [1.0, 1.5, 3.0, 50.0, -0.2, -3.0] {
            assert_eq!(srgb_to_linear(c), srgb_to_linear_exact(c), "{c}");
        }
        for c in [16.5, 20.0, 400.0, -0.2, -3.0] {
            assert_eq!(linear_to_srgb(c), linear_to_srgb_exact(c), "{c}");
        }
        assert!(linear_to_srgb(f32::NAN).is_nan());
        assert!(srgb_to_linear(f32::NAN).is_nan());
        assert_eq!(linear_to_srgb(f32::INFINITY), f32::INFINITY);
    }

    #[test]
    fn every_eight_bit_value_comes_back_to_itself() {
        // Ce que l'export écrit, ce que le décodage lit : un octet ne doit jamais bouger d'un niveau.
        for byte in 0..=255u32 {
            let linear = srgb_to_linear(byte as f32 / 255.0);
            let back = (linear_to_srgb(linear) * 255.0).round() as u32;
            assert_eq!(back, byte);
        }
    }
}

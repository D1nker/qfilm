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

pub fn srgb_to_linear(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

pub fn linear_to_srgb(c: f32) -> f32 {
    if c <= 0.003_130_8 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

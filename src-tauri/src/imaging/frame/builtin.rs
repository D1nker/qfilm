use super::Frame;

macro_rules! bundle {
    ($manifest:literal, $svg:literal) => {
        (
            include_str!(concat!("../../../frames/", $manifest)),
            include_str!(concat!("../../../frames/", $svg)),
        )
    };
}

/// Le 35 mm et le moyen format partagent le même gabarit.
const BUNDLES: [(&str, &str); 6] = [
    bundle!("solid/frame.json", "solid/frame.svg"),
    bundle!("instant/frame.json", "instant/frame.svg"),
    bundle!("film35/frame.json", "film/frame.svg"),
    bundle!("film120/frame.json", "film/frame.svg"),
    bundle!("letterbox/frame.json", "letterbox/frame.svg"),
    bundle!("padding/frame.json", "padding/frame.svg"),
];

pub fn frames() -> Vec<Frame> {
    BUNDLES
        .iter()
        .map(|(manifest, svg)| {
            Frame::from_sources(manifest, (*svg).to_string(), true)
                .unwrap_or_else(|error| panic!("cadre intégré invalide : {error}"))
        })
        .collect()
}

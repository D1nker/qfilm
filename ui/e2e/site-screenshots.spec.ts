import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { test, type App } from "./support/app";

/// Les captures de l'application pour le site, en français et en anglais : `npm run website:screenshots`.
/// L'interface tourne dans un navigateur, devant un Rust simulé, mais montre une vraie photo (celle que
/// le moteur a rendue pour le site) : `__PHOTO__`, voir `tauri-mock.js`.

const IMAGES = fileURLToPath(new URL("../../website/img/", import.meta.url));
const PHOTO = `${IMAGES}look-golden-1100.jpg`;

const WORDS = {
  fr: {
    crop: "Recadrage",
    tone: "Tons",
    light: "Lumière",
    color: "Couleurs",
    masks: "Masques",
    cropButton: "Recadrer",
    radial: "Dégradé radial",
    exposure: "Exposition",
    saturation: "Saturation",
    blue: "Bleu",
  },
  en: {
    crop: "Crop",
    tone: "Tone",
    light: "Light",
    color: "Colors",
    masks: "Masks",
    cropButton: "Crop",
    radial: "Radial gradient",
    exposure: "Exposure",
    saturation: "Saturation",
    blue: "Blue",
  },
} as const;

/// Pousse un curseur de quelques pas : l'interface montre alors un réglage, pas un panneau tout à zéro.
async function nudge(app: App, name: string, key: "ArrowLeft" | "ArrowRight", times: number) {
  await app.page.getByRole("slider", { name, exact: true }).first().focus();
  await app.press(key, times);
}

const SOCIAL = {
  fr: {
    title: "Donne à tes photos un look argentique.",
    tagline: "Looks, cadres et légendes. Gratuit, open source, privé.",
  },
  en: {
    title: "Make your photos look like film.",
    tagline: "Looks, frames and captions. Free, open source, private.",
  },
} as const;

/// L'image qui illustre un lien partagé (1200 × 630) : le héros du site et son titre, dans la langue de la page.
async function socialCard(app: App, language: "fr" | "en") {
  const asData = (file: string, type: string) =>
    `data:${type};base64,${readFileSync(file).toString("base64")}`;
  const font = asData(`${IMAGES}../fonts/inter-latin-wght-normal.woff2`, "font/woff2");
  const icon = asData(`${IMAGES}../icon.svg`, "image/svg+xml");
  const hero = asData(`${IMAGES}hero-1000.jpg`, "image/jpeg");
  const { title, tagline } = SOCIAL[language];

  await app.page.setViewportSize({ width: 1200, height: 630 });
  await app.page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Inter; src: url(${font}) format("woff2"); font-weight: 100 900; }
    * { box-sizing: border-box; }
    body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #141414; color: #f7f7f7;
      font-family: Inter, sans-serif; display: flex; align-items: center; position: relative; }
    .glow { position: absolute; right: -120px; top: 40px; width: 760px; height: 560px;
      background: radial-gradient(closest-side, rgba(120, 90, 255, .45), transparent); }
    .text { position: relative; padding-left: 72px; width: 600px; }
    .brand { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 650; margin-bottom: 40px; }
    .brand img { width: 52px; height: 52px; }
    h1 { margin: 0; font-size: 68px; line-height: 1.02; letter-spacing: -0.04em; font-weight: 650; }
    p { margin: 28px 0 0; font-size: 26px; line-height: 1.4; color: #b8b8b8; }
    .photo { position: absolute; right: -60px; top: 110px; width: 640px; border-radius: 14px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, .6); transform: rotate(-3deg); }
  </style></head><body>
    <div class="glow"></div>
    <div class="text"><div class="brand"><img src="${icon}" alt="" />qFilm</div><h1>${title}</h1><p>${tagline}</p></div>
    <img class="photo" src="${hero}" alt="" />
  </body></html>`);
  await app.page.waitForTimeout(300);
  await app.page.screenshot({ path: `${IMAGES}og-${language}.jpg`, type: "jpeg", quality: 90 });
}

for (const language of ["fr", "en"] as const) {
  test.describe(`site screenshots (${language})`, () => {
    const words = WORDS[language];
    test.use({
      locale: language === "fr" ? "fr-FR" : "en-US",
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1.5,
    });

    async function open(app: App) {
      const photo = `data:image/jpeg;base64,${readFileSync(PHOTO).toString("base64")}`;
      await app.page.evaluate(
        ([src]) => {
          const w = window as unknown as { __PHOTO__: string; __size: [number, number] };
          w.__PHOTO__ = src as string;
          w.__size = [1100, 733];
        },
        [photo],
      );
      await app.openPhoto();
      await app.page.waitForTimeout(400);
    }

    const shoot = (app: App, name: string) =>
      // Sans la colonne de gauche de la photo : sur le site la capture est petite, l'interface doit rester lisible.
      app.page.screenshot({
        path: `${IMAGES}tool-${name}-${language}.jpg`,
        type: "jpeg",
        quality: 88,
        clip: { x: 300, y: 0, width: 980, height: 800 },
      });

    test("social card", async ({ app }) => {
      await socialCard(app, language);
    });

    test("crop", async ({ app }) => {
      await open(app);
      await app.group(words.crop);
      await app.page.getByRole("button", { name: words.cropButton, exact: true }).click();
      await app.page.waitForTimeout(300);
      await shoot(app, "crop");
    });

    test("curves", async ({ app }) => {
      await open(app);
      await app.group(words.tone);
      // La section « Lumière » repliée laisse toute la place au graphique.
      await app.page.getByRole("button", { name: words.light, exact: true }).click();

      const graph = app.page.locator(".graph");
      await graph.scrollIntoViewIfNeeded();
      const box = await graph.boundingBox();
      if (!box) throw new Error("graphique introuvable");
      // Une courbe en S : on tire un point vers le bas dans les ombres, un autre vers le haut dans les lumières.
      for (const [x, from, to] of [
        [0.27, 0.27, 0.19],
        [0.74, 0.74, 0.83],
      ] as const) {
        await app.page.mouse.move(box.x + box.width * x, box.y + box.height * (1 - from));
        await app.page.mouse.down();
        await app.page.mouse.move(box.x + box.width * x, box.y + box.height * (1 - to), {
          steps: 6,
        });
        await app.page.mouse.up();
      }
      await app.page.mouse.move(5, 5);
      await app.page.waitForTimeout(300);
      await shoot(app, "curves");
    });

    test("mixer", async ({ app }) => {
      await open(app);
      await app.group(words.color);
      await app.page.getByRole("radio", { name: words.blue, exact: true }).click();
      await nudge(app, words.saturation, "ArrowRight", 30);
      await app.page.mouse.move(5, 5);
      await app.page.waitForTimeout(300);
      await shoot(app, "mixer");
    });

    test("masks", async ({ app }) => {
      await open(app);
      await app.group(words.masks);
      await app.page.getByRole("button", { name: words.radial, exact: true }).click();
      await nudge(app, words.exposure, "ArrowRight", 40);
      await app.page.mouse.move(5, 5);
      await app.page.waitForTimeout(300);
      await shoot(app, "masks");
    });
  });
}

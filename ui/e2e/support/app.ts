import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test as base, type Page } from "@playwright/test";

const FRAMES_DIRECTORY = fileURLToPath(new URL("../../../crates/core/frames/", import.meta.url));
const MOCK_SCRIPT = fileURLToPath(new URL("./tauri-mock.js", import.meta.url));

const OPEN_PANEL_IDS = [
  "adjust-light",
  "frame-geometry",
  "adjust-curves",
  "adjust-color",
  "adjust-grading",
  "adjust-detail",
  "adjust-effects",
  "adjust-hsl",
];

/// La page (icône de la rampe) de chaque section nommée dans les tests.
const SECTION_PAGES: Record<string, string> = {
  Lumière: "Tons",
  "Courbe des tons": "Tons",
  Couleur: "Couleurs",
  "Mélangeur de couleurs": "Couleurs",
  Étalonnage: "Couleurs",
  Détail: "Finition",
  Effets: "Finition",
  Recadrage: "Recadrage",
  Forme: "Cadre",
  Légende: "Légende",
  "Mes cadres": "Mes cadres",
};

const BUILTIN_FRAMES = ["solid", "instant", "film35", "film120", "letterbox", "padding"];

interface RawParam {
  type: string;
  unit?: string;
  maxLength?: number;
  display?: string;
  options?: { id: string; sets?: Record<string, unknown> }[];
}

/// Les manifestes tels que Rust les sérialise : les valeurs par défaut y sont explicites.
function builtinManifests() {
  return BUILTIN_FRAMES.map((id) => {
    const manifest = JSON.parse(readFileSync(`${FRAMES_DIRECTORY}${id}/frame.json`, "utf8")) as {
      params: RawParam[];
    };

    return {
      description: "",
      author: "",
      rotatePortrait: false,
      captionDefaults: {},
      ...manifest,
      builtin: true,
      params: manifest.params.map((param) => ({
        ...param,
        ...(param.type === "number" ? { unit: param.unit ?? "" } : {}),
        ...(param.type === "text" ? { maxLength: param.maxLength ?? 80 } : {}),
        ...(param.type === "choice"
          ? {
              display: param.display ?? "menu",
              options: param.options?.map((option) => ({ sets: {}, ...option })),
            }
          : {}),
      })),
    };
  });
}

export interface Call {
  cmd: string;
  args: Record<string, unknown>;
}

export interface RenderCall {
  id: string;
  geometry: {
    quarterTurns: number;
    flipHorizontal: boolean;
    flipVertical: boolean;
    angle: number;
    crop: { x: number; y: number; width: number; height: number };
  };
  params: Record<string, number> & { curves: Record<"rgb" | "red" | "green" | "blue", number[][]> };
  frame: { id: string; params: Record<string, string | number | boolean> };
}

export interface ExportCall extends RenderCall {
  caption: Record<string, string | number | null>;
  destination: string;
  options: { format: string; quality: number; maxEdge: number | null };
}

/// L'application dans un navigateur, face à un Rust simulé, et de quoi observer ce qu'elle lui demande.
export class App {
  constructor(readonly page: Page) {}

  async start(imageSize?: [number, number], openPanels = true) {
    if (openPanels) {
      // Le panneau Retouche garde ses sections avancées fermées : les tests les veulent ouvertes,
      // sauf ceux qui vérifient justement ce comportement (`openPanels: false`).
      await this.page.addInitScript((ids) => {
        if (localStorage.getItem("qfilm-panels")) return;
        localStorage.setItem(
          "qfilm-panels",
          JSON.stringify(Object.fromEntries(ids.map((id) => [id, true]))),
        );
      }, OPEN_PANEL_IDS);
    }
    await this.page.addInitScript((manifests) => {
      (window as unknown as { __MANIFESTS__: unknown }).__MANIFESTS__ = manifests;
    }, builtinManifests());
    if (imageSize) {
      await this.page.addInitScript((size) => {
        (window as unknown as { __size: unknown }).__size = size;
      }, imageSize);
    }
    await this.page.addInitScript({ path: MOCK_SCRIPT });
    await this.page.goto("/");
  }

  async openPhoto() {
    await this.page.getByRole("button", { name: /^(Ouvrir|Open)…$/ }).click();
    await this.photo.waitFor();
    await expect
      .poll(() => this.calls("render_preview").then((calls) => calls.length))
      .toBeGreaterThan(0);
    await this.layoutSettled();
  }

  async layoutSettled() {
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const width = () => document.querySelector("main")?.getBoundingClientRect().width;
          let last = width();
          let steady = 0;
          const tick = () => {
            const now = width();
            steady = now === last ? steady + 1 : 0;
            last = now;
            if (steady >= 5) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
  }

  /// Le moteur rapide ne produit jamais de brouillon : pour en voir un, il faut que les rendus
  /// complets aient prouvé qu'ils sont lents. Ici, un rendu de 400 ms, mesuré par un pas au clavier.
  async slowRenders(milliseconds = 400) {
    await this.page.evaluate((delay) => {
      (window as unknown as { __renderDelay: number }).__renderDelay = delay;
    }, milliseconds);
    const done = () =>
      this.page.evaluate(() => (window as unknown as { __renderDone?: number }).__renderDone ?? 0);
    const before = await done();
    // On finit sur Retouche > Tons : c'est là que se trouve le curseur dont on se sert.
    await this.tab("Retouche").click();
    await this.group("Tons");
    await this.page.getByRole("slider", { name: "Exposition" }).focus();
    await this.press("ArrowRight", 1);
    await expect.poll(done).toBeGreaterThan(before);
  }

  get photo() {
    return this.page.getByRole("img", { name: "IMG_0001.jpg" });
  }

  async calls(cmd?: string): Promise<Call[]> {
    const all = await this.page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls);
    return cmd ? all.filter((call) => call.cmd === cmd) : all;
  }

  async lastRender() {
    const calls = await this.calls("render_preview");
    return calls.at(-1)?.args as unknown as RenderCall;
  }

  async lastExport() {
    const calls = await this.calls("export_image");
    return calls.at(-1)?.args as unknown as ExportCall;
  }

  async count(cmd: string) {
    return (await this.calls(cmd)).length;
  }

  tab(name: "Preset" | "Retouche" | "Cadre" | "Edit" | "Frame") {
    return this.page.getByRole("tab", { name });
  }

  /// Les panneaux Retouche et Cadre sont en pages : affiche celle de la rampe d'icônes qui porte ce nom.
  async group(name: string) {
    const goTo = new RegExp(`^(Aller à|Go to) ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    await this.page.getByRole("button", { name: goTo }).click();
  }

  /// Ouvre une section du panneau si elle ne l'est pas déjà, en passant d'abord sur sa page.
  async openSection(name: string) {
    const page = SECTION_PAGES[name];
    if (page) await this.group(page);
    const header = this.page.getByRole("button", { name: new RegExp(`^${name}( Modifié)?$`) });
    // Une page à section unique (Recadrage, Légende…) n'a plus d'en-tête à déplier.
    if ((await header.count()) === 0) return;
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  }

  get preferencesButton() {
    return this.page.getByRole("button", { name: /^(Préférences|Preferences)$/ });
  }

  /// Ouvre les préférences si besoin, choisit une option (thème ou langue) puis les referme.
  async choose(name: string) {
    const option = this.page.getByRole("radio", { name });
    if (!(await option.isVisible())) await this.preferencesButton.click();
    await option.click();
    await this.page.keyboard.press("Escape");
    await expect(option).toHaveCount(0);
  }

  async emit(event: string, payload: unknown) {
    await this.page.evaluate(
      ([name, data]) =>
        (window as unknown as { __emit: (e: string, p: unknown) => void }).__emit(
          name as string,
          data,
        ),
      [event, payload],
    );
  }

  async press(key: string, times = 1) {
    for (let i = 0; i < times; i++) await this.page.keyboard.press(key);
  }

  /// Un geste continu est validé dans l'historique après une pause de 300 ms.
  async waitForHistoryCommit() {
    await this.page.waitForTimeout(350);
  }
}

export const test = base.extend<{
  app: App;
  openApp: App;
  imageSize: [number, number] | undefined;
  openPanels: boolean;
}>({
  imageSize: [undefined, { option: true }],
  openPanels: [true, { option: true }],
  app: async ({ page, imageSize, openPanels }, use) => {
    const app = new App(page);
    await app.start(imageSize, openPanels);
    await use(app);
  },
  openApp: async ({ page, imageSize, openPanels }, use) => {
    const app = new App(page);
    await app.start(imageSize, openPanels);
    await app.openPhoto();
    await use(app);
  },
});

export { expect };

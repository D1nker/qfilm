import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test as base, type Page } from "@playwright/test";

const FRAMES_DIRECTORY = fileURLToPath(new URL("../../../crates/core/frames/", import.meta.url));
const MOCK_SCRIPT = fileURLToPath(new URL("./tauri-mock.js", import.meta.url));

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
  params: Record<string, number>;
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

  async start(imageSize?: [number, number]) {
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
}>({
  imageSize: [undefined, { option: true }],
  app: async ({ page, imageSize }, use) => {
    const app = new App(page);
    await app.start(imageSize);
    await use(app);
  },
  openApp: async ({ page, imageSize }, use) => {
    const app = new App(page);
    await app.start(imageSize);
    await app.openPhoto();
    await use(app);
  },
});

export { expect };

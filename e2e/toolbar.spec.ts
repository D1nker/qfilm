import { expect, test, type App } from "./support/app";

const toolbar = (app: App) => app.page.getByRole("toolbar", { name: "Outils de la photo" });
const bounds = (app: App, selector: string) =>
  app.page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const { top, bottom, left, right } = element.getBoundingClientRect();
      return { top, bottom, left, right, center: (left + right) / 2 };
    });

test.describe("floating toolbar", () => {
  test("is not shown before a photo is open", async ({ app }) => {
    await expect(toolbar(app)).toHaveCount(0);
  });

  test("groups history, compare and zoom, centered under the canvas", async ({ openApp }) => {
    const bar = toolbar(openApp);
    await expect(bar.getByRole("button", { name: "Annuler" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Rétablir" })).toBeVisible();
    await expect(bar.getByRole("button", { name: /Comparer/ })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Dézoomer" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Zoomer", exact: true })).toBeVisible();

    const stage = await bounds(openApp, "main");
    const box = await bounds(openApp, '[role="toolbar"]');
    expect(box.center).toBeCloseTo(stage.center, 0);
    expect(box.bottom).toBeLessThan(stage.bottom);
  });

  test("stays centered on the canvas when the panel is hidden", async ({ openApp }) => {
    await openApp.page.keyboard.press("f");
    await expect(openApp.page.locator("aside")).toBeHidden();

    await expect(toolbar(openApp)).toBeVisible();
    await expect
      .poll(async () => {
        const stage = await bounds(openApp, "main");
        const box = await bounds(openApp, '[role="toolbar"]');
        return Math.abs(box.center - stage.center);
      })
      .toBeLessThan(1);
  });

  test("the header no longer carries those controls", async ({ openApp }) => {
    const header = openApp.page.locator("header");

    await expect(header.getByRole("button", { name: "Annuler" })).toHaveCount(0);
    await expect(header.getByRole("button", { name: /Comparer/ })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Ouvrir…" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Exporter…" })).toBeVisible();
  });

  test("holding Compare shows the original and releasing brings the edit back", async ({
    openApp,
  }) => {
    const layer = openApp.page.locator(".caption-layer");
    await expect(layer).toHaveCount(1);
    const compare = toolbar(openApp).getByRole("button", { name: /Comparer/ });

    await compare.hover();
    await openApp.page.mouse.down();
    await expect(layer).toHaveCount(0);
    await expect(toolbar(openApp).getByRole("button", { name: "Original" })).toBeVisible();

    await openApp.page.mouse.up();
    await expect(layer).toHaveCount(1);
  });

  for (const [name, size] of [
    ["a portrait photo", [1200, 1800]],
    ["a landscape photo", [1800, 1200]],
  ] as const) {
    test.describe(name, () => {
      test.use({ imageSize: [size[0], size[1]] });

      test("never goes under the toolbar when fitted", async ({ openApp }) => {
        const photo = await bounds(openApp, "main img");
        const box = await bounds(openApp, '[role="toolbar"]');

        expect(photo.bottom).toBeLessThanOrEqual(box.top);
      });
    });
  }
});

test.describe("menu", () => {
  test("opens the shortcuts cheat-sheet", async ({ app }) => {
    await app.page.getByRole("button", { name: "Menu" }).click();
    await app.page.getByRole("menuitem", { name: "Raccourcis clavier" }).click();

    const dialog = app.page.getByRole("dialog", { name: "Raccourcis clavier" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Annuler")).toBeVisible();
    await expect(dialog.getByText("Voir l'original (maintenir)")).toBeVisible();

    await app.page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("opens the frames folder", async ({ app }) => {
    await app.page.getByRole("button", { name: "Menu" }).click();
    await app.page.getByRole("menuitem", { name: "Ouvrir le dossier des cadres" }).click();

    await expect.poll(() => app.count("open_frames_folder")).toBe(1);
  });
});

test.describe("notices", () => {
  test("a finished export shows a passing notice and keeps the photo size in the header", async ({
    openApp,
  }) => {
    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("button", { name: "Enregistrer…" }).click();

    const notice = openApp.page.getByRole("status");
    await expect(notice).toHaveText("Export terminé");
    await expect(openApp.page.locator("header")).toContainText("3600 × 2400 px");
    await expect(notice).toHaveCount(0, { timeout: 6000 });
  });

  test("errors and notices appear at the top, away from the toolbar", async ({ openApp }) => {
    await openApp.emit("tauri://drag-drop", { paths: ["/fake/bad.zip"], position: { x: 0, y: 0 } });

    const error = openApp.page.getByRole("alert");
    await expect(error).toBeVisible();
    const box = await error.evaluate((element) => element.getBoundingClientRect().bottom);
    expect(box).toBeLessThan(200);
  });
});

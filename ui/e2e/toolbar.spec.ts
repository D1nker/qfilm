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

  test("the header keeps open and export on the right, and the app menu on the left", async ({
    openApp,
  }) => {
    const header = openApp.page.locator("header");

    await expect(header.getByRole("button", { name: "Ouvrir…" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Exporter…" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Menu" }).locator("img.mark")).toBeVisible();
    await expect(header.getByRole("button", { name: "Annuler" })).toHaveCount(0);
    await expect(header.getByRole("button", { name: /Comparer/ })).toHaveCount(0);
    await expect(header.getByRole("button", { name: /panneau/ })).toHaveCount(0);

    const menu = await bounds(openApp, 'header button[aria-label="Menu"]');
    const open = await bounds(openApp, "header .actions button");
    expect(menu.right).toBeLessThan(open.left);
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

test.describe("panel handle", () => {
  const handle = (app: App) => app.page.getByRole("button", { name: /le panneau/ });

  test("is there even before a photo is open", async ({ app }) => {
    await expect(handle(app)).toBeVisible();
  });

  test("starts folded without a photo and unfolds once one opens", async ({ app }) => {
    const panel = app.page.locator("aside");
    await expect(panel).toBeHidden();
    await expect(handle(app)).toHaveAttribute("aria-expanded", "false");

    await app.openPhoto();

    await expect(panel).toBeVisible();
    await expect(handle(app)).toHaveAttribute("aria-expanded", "true");
  });

  test("can still be unfolded by hand before a photo is open", async ({ app }) => {
    await handle(app).click();

    await expect(app.page.locator("aside")).toBeVisible();
  });

  test("keeps a panel folded by hand when a second photo opens", async ({ openApp }) => {
    await handle(openApp).click();
    await expect(openApp.page.locator("aside")).toBeHidden();

    await openApp.openPhoto();

    await expect(openApp.page.locator("aside")).toBeHidden();
  });

  test("folds and unfolds the panel", async ({ openApp }) => {
    const panel = openApp.page.locator("aside");
    await expect(handle(openApp)).toHaveAttribute("aria-expanded", "true");

    await handle(openApp).click();
    await expect(panel).toBeHidden();
    await expect(handle(openApp)).toHaveAttribute("aria-expanded", "false");

    await handle(openApp).click();
    await expect(panel).toBeVisible();
  });

  test("sits on the canvas edge next to the panel, and follows it when it folds", async ({
    openApp,
  }) => {
    await expect
      .poll(async () => {
        const stage = await bounds(openApp, "main");
        const box = await bounds(openApp, "main .handle");
        return Math.abs(box.right - stage.right);
      })
      .toBeLessThan(1);

    await openApp.page.keyboard.press("f");
    await expect(openApp.page.locator("aside")).toBeHidden();
    await expect
      .poll(async () => {
        const box = await bounds(openApp, "main .handle");
        return Math.abs(box.right - (await openApp.page.evaluate(() => innerWidth)));
      })
      .toBeLessThan(1);
    await expect(handle(openApp)).toBeVisible();
  });

  test("says what it does", async ({ openApp }) => {
    await handle(openApp).hover();
    await expect(openApp.page.getByRole("tooltip")).toHaveText("Masquer le panneau (F)");

    await handle(openApp).click();
    await handle(openApp).hover();
    await expect(openApp.page.getByRole("tooltip")).toHaveText("Afficher le panneau (F)");
  });

  test("does not start a pan when pressed", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Zoomer", exact: true }).click();
    const before = await openApp.page.locator(".scroller").evaluate((el) => el.scrollTop);

    await handle(openApp).hover();
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(600, 300, { steps: 4 });
    await openApp.page.mouse.up();

    expect(await openApp.page.locator(".scroller").evaluate((el) => el.scrollTop)).toBe(before);
  });
});

test.describe("menu", () => {
  test("shows a tooltip on hover and opens on click", async ({ app }) => {
    const trigger = app.page.getByRole("button", { name: "Menu" });

    await trigger.hover();
    await expect(app.page.getByRole("tooltip")).toHaveText("Menu");

    await trigger.click();
    await expect(app.page.getByRole("menu")).toBeVisible();
    await expect(app.page.getByRole("menuitem", { name: "Raccourcis clavier" })).toBeVisible();
  });

  test("opens aligned with the logo, not off to the right", async ({ app }) => {
    await app.page.getByRole("button", { name: "Menu" }).click();

    const menu = await bounds(app, '[role="menu"]');
    const trigger = await bounds(app, 'header button[aria-label="Menu"]');
    expect(Math.abs(menu.left - trigger.left)).toBeLessThan(12);
  });

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

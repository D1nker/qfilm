import { expect, test, type App } from "./support/app";

test.describe("keyboard", () => {
  test("Tab moves between the menus instead of hiding the panel", async ({ openApp }) => {
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await openApp.page.keyboard.press("Tab");

    expect(await openApp.page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    await expect(openApp.page.locator("aside")).toBeVisible();
  });

  test("Space still activates a button reached with the keyboard", async ({ openApp }) => {
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await openApp.page.keyboard.press("Shift+Tab");
    for (let i = 0; i < 20; i++) {
      const label = await openApp.page.evaluate(() => document.activeElement?.textContent?.trim());
      if (label === "Exporter…") break;
      await openApp.page.keyboard.press("Shift+Tab");
    }
    await openApp.page.keyboard.press("Space");

    await expect(openApp.page.getByRole("dialog")).toBeVisible();
  });

  test("Space moves the photo instead of re-triggering a button that was just clicked", async ({
    app,
  }) => {
    await app.openPhoto();
    const opened = await app.count("open_image");

    await app.page.mouse.move(500, 400);
    await app.page.keyboard.down("Space");
    await app.page.keyboard.up("Space");

    expect(await app.count("open_image")).toBe(opened);
  });
});

test.describe("app shortcuts", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const zoom = (app: App) =>
    app.page.getByRole("toolbar", { name: "Outils de la photo" }).getByText(/\d+ %/);
  const preferences = (app: App) => app.page.getByRole("radio", { name: "Sombre" });

  // ⌘ sur Mac, Ctrl sous Windows et Linux : chaque raccourci répond aux deux.
  for (const modifier of ["Control", "Meta"]) {
    test(`${modifier}+O opens the photo picker`, async ({ app }) => {
      await app.page.keyboard.press(`${modifier}+o`);

      await expect.poll(() => app.count("open_image")).toBe(1);
    });

    test(`${modifier}+Shift+E opens the export dialog`, async ({ openApp }) => {
      await openApp.page.keyboard.press(`${modifier}+Shift+e`);

      await expect(openApp.page.getByRole("dialog")).toBeVisible();
    });

    test(`${modifier}+, opens the preferences, and again closes them`, async ({ openApp }) => {
      await openApp.page.keyboard.press(`${modifier}+,`);
      await expect(preferences(openApp)).toBeVisible();

      await openApp.page.keyboard.press(`${modifier}+,`);
      await expect(preferences(openApp)).toHaveCount(0);
    });
  }

  test("export does nothing without a photo", async ({ app }) => {
    await app.page.keyboard.press("Control+Shift+e");

    await expect(app.page.getByRole("dialog")).toHaveCount(0);
  });

  test("open and export stay quiet while the export dialog is up", async ({ openApp }) => {
    await openApp.page.keyboard.press("Control+Shift+e");
    await expect(openApp.page.getByRole("dialog")).toBeVisible();
    const opened = await openApp.count("open_image");

    await openApp.page.keyboard.press("Control+o");
    await openApp.page.waitForTimeout(100);

    expect(await openApp.count("open_image")).toBe(opened);
    await expect(openApp.page.getByRole("dialog")).toHaveCount(1);
  });

  test("open still works while typing in a field", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await openApp.group("Légende");
    await openApp.page.getByPlaceholder("Biarritz, août 2026").focus();
    const opened = await openApp.count("open_image");

    await openApp.page.keyboard.press("Control+o");

    await expect.poll(() => openApp.count("open_image")).toBe(opened + 1);
  });

  test("Z switches between fit and 100 %, and back", async ({ openApp }) => {
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const fitted = await zoom(openApp).textContent();

    await openApp.page.keyboard.press("z");
    await expect(zoom(openApp)).toHaveText("100 %");

    await openApp.page.keyboard.press("z");
    await expect(zoom(openApp)).toHaveText(fitted ?? "");
  });

  test("Z types a z in a text field instead of zooming", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await openApp.group("Légende");
    const fitted = await zoom(openApp).textContent();
    const field = openApp.page.getByPlaceholder("Biarritz, août 2026");

    await field.focus();
    await openApp.page.keyboard.type("zz");

    await expect(field).toHaveValue("zz");
    await expect(zoom(openApp)).toHaveText(fitted ?? "");
  });

  test("Ctrl+Z is still undo, not zoom", async ({ openApp }) => {
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const fitted = await zoom(openApp).textContent();

    await openApp.page.keyboard.press("Control+z");
    await openApp.page.keyboard.press("Meta+z");

    await expect(zoom(openApp)).toHaveText(fitted ?? "");
  });
});

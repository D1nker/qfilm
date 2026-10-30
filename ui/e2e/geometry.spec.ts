import { expect, test, type App } from "./support/app";

const overlay = (app: App) => app.page.locator(".overlay");
const handle = (app: App, name: string) => app.page.locator(`[data-handle="${name}"]`);
const cropButton = (app: App) =>
  app.page.getByRole("button", { name: /^(Recadrer|Terminer le recadrage)$/ });
const tool = (app: App, name: string) => app.page.getByRole("button", { name });
const geometry = async (app: App) => (await app.lastRender()).geometry;

/// Un point de l'image, en fractions de sa largeur et de sa hauteur (0 à 1), en pixels d'écran.
async function onPhoto(app: App, x: number, y: number) {
  const box = await overlay(app).boundingBox();
  if (!box) throw new Error("recadrage introuvable");
  return { x: box.x + x * box.width, y: box.y + y * box.height };
}

async function drag(app: App, from: { x: number; y: number }, to: { x: number; y: number }) {
  await app.page.mouse.move(from.x, from.y);
  await app.page.mouse.down();
  await app.page.mouse.move(to.x, to.y, { steps: 8 });
  await app.page.mouse.up();
}

test.describe("crop and rotate", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await openApp.openSection("Recadrage");
  });

  test("starts untouched: no overlay, the whole photo sent to the engine", async ({ openApp }) => {
    await expect(overlay(openApp)).toHaveCount(0);
    expect(await geometry(openApp)).toEqual({
      quarterTurns: 0,
      flipHorizontal: false,
      flipVertical: false,
      angle: 0,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    });
  });

  test("the Crop button opens the cadre on the whole photo, with eight handles, and closes it", async ({
    openApp,
  }) => {
    await cropButton(openApp).click();

    await expect(overlay(openApp)).toBeVisible();
    await expect(openApp.page.locator("[data-handle]")).toHaveCount(8);
    await expect(cropButton(openApp)).toHaveText("Terminer le recadrage");

    await cropButton(openApp).click();

    await expect(overlay(openApp)).toHaveCount(0);
    await expect(cropButton(openApp)).toHaveText("Recadrer");
  });

  test("a corner handle resizes the cadre, and closing applies it", async ({ openApp }) => {
    await cropButton(openApp).click();
    await drag(openApp, await onPhoto(openApp, 1, 1), await onPhoto(openApp, 0.6, 0.7));

    // Pendant le réglage, l'aperçu montre toujours la photo entière.
    expect((await geometry(openApp)).crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });

    await cropButton(openApp).click();

    await expect.poll(async () => (await geometry(openApp)).crop.width).toBeCloseTo(0.6, 1);
    const { crop } = await geometry(openApp);
    expect(crop.height).toBeCloseTo(0.7, 1);
    expect([crop.x, crop.y]).toEqual([0, 0]);
  });

  test("dragging inside moves the cadre without resizing it", async ({ openApp }) => {
    await cropButton(openApp).click();
    await drag(openApp, await onPhoto(openApp, 1, 1), await onPhoto(openApp, 0.5, 0.5));
    await drag(openApp, await onPhoto(openApp, 0.25, 0.25), await onPhoto(openApp, 0.5, 0.45));

    await cropButton(openApp).click();

    await expect.poll(async () => (await geometry(openApp)).crop.x).toBeGreaterThan(0.2);
    const { crop } = await geometry(openApp);
    expect(crop.width).toBeCloseTo(0.5, 1);
    expect(crop.y).toBeGreaterThan(0.15);
  });

  test("a format locks the shape: 1:1 is square in pixels", async ({ openApp }) => {
    await openApp.page
      .locator("label.field", { hasText: "Proportions" })
      .getByRole("combobox")
      .click();
    await openApp.page.getByRole("option", { name: "1:1" }).click();
    // Choisir un format ouvre déjà le cadre : on règle tout sur la photo entière.
    await expect(overlay(openApp)).toBeVisible();

    // Le faux pont ouvre une photo de 3 600 × 2 400 px : un carré y fait 2 400 px de côté.
    const grip = await handle(openApp, "se").boundingBox();
    if (!grip) throw new Error("poignée introuvable");
    // Un tirage qui ne suit pas le carré : sans verrou, le cadre cesserait d'être carré.
    await drag(
      openApp,
      { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
      await onPhoto(openApp, 0.7, 0.5),
    );
    await cropButton(openApp).click();

    await expect.poll(async () => (await geometry(openApp)).crop.width).toBeLessThan(0.6);
    const { crop } = await geometry(openApp);
    expect(crop.width * 3600).toBeCloseTo(crop.height * 2400, -1);
  });

  test("a quarter turn turns the photo and its sides, without opening the tool", async ({
    openApp,
  }) => {
    const before = await openApp.page.locator("main img").first().boundingBox();

    await tool(openApp, "Pivoter à droite").click();

    await expect.poll(async () => (await geometry(openApp)).quarterTurns).toBe(1);
    await expect(overlay(openApp)).toHaveCount(0);
    await expect(cropButton(openApp)).toHaveText("Recadrer");
    await expect
      .poll(async () => (await openApp.page.locator("main img").first().boundingBox())?.height)
      .toBeGreaterThan(before?.height ?? 0);
  });

  test("a turn carries an existing crop with the photo, still without the tool", async ({
    openApp,
  }) => {
    await cropButton(openApp).click();
    await drag(openApp, await onPhoto(openApp, 1, 1), await onPhoto(openApp, 0.6, 0.7));
    await cropButton(openApp).click();
    await expect.poll(async () => (await geometry(openApp)).crop.width).toBeCloseTo(0.6, 1);

    await tool(openApp, "Pivoter à droite").click();

    await expect.poll(async () => (await geometry(openApp)).quarterTurns).toBe(1);
    const { crop } = await geometry(openApp);
    expect([crop.width, crop.height]).toEqual([expect.closeTo(0.7, 1), expect.closeTo(0.6, 1)]);
    await expect(overlay(openApp)).toHaveCount(0);
  });

  test("the mirrors flip the photo", async ({ openApp }) => {
    await tool(openApp, "Retourner horizontalement").click();
    await expect.poll(async () => (await geometry(openApp)).flipHorizontal).toBe(true);

    await tool(openApp, "Retourner verticalement").click();
    await expect.poll(async () => (await geometry(openApp)).flipVertical).toBe(true);
  });

  test("the straighten slider tilts the photo and keeps the cadre inside it", async ({
    openApp,
  }) => {
    await openApp.page.getByRole("slider", { name: "Redresser" }).focus();
    await openApp.press("ArrowRight", 30);

    await expect.poll(async () => (await geometry(openApp)).angle).toBeCloseTo(3, 1);
    await cropButton(openApp).click();

    await expect.poll(async () => (await geometry(openApp)).crop.width).toBeLessThan(1);
    const { crop } = await geometry(openApp);
    expect(crop.x).toBeGreaterThan(0);
    expect(crop.y).toBeGreaterThan(0);
  });

  test("Enter and Escape close the cadre, R opens it from anywhere", async ({ openApp }) => {
    await cropButton(openApp).click();
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await openApp.page.keyboard.press("Enter");
    await expect(overlay(openApp)).toHaveCount(0);

    await openApp.tab("Retouche").click();
    await openApp.page.keyboard.press("r");

    await expect(overlay(openApp)).toBeVisible();
    await expect(
      openApp.page.getByRole("navigation").getByRole("button", { name: "Aller à Recadrage" }),
    ).toHaveAttribute("aria-current", "true");

    await openApp.page.keyboard.press("Escape");
    await expect(overlay(openApp)).toHaveCount(0);
  });

  test("a double-click on the cadre closes it", async ({ openApp }) => {
    await cropButton(openApp).click();

    const middle = await onPhoto(openApp, 0.5, 0.5);
    await openApp.page.mouse.dblclick(middle.x, middle.y);

    await expect(overlay(openApp)).toHaveCount(0);
  });

  test("a handle moves with the arrows, Shift for bigger steps", async ({ openApp }) => {
    await cropButton(openApp).click();
    await handle(openApp, "e").focus();

    await openApp.press("ArrowLeft", 5);
    await openApp.page.keyboard.press("Shift+ArrowLeft");
    await cropButton(openApp).click();

    await expect.poll(async () => (await geometry(openApp)).crop.width).toBeCloseTo(0.9, 1);
  });

  test("leaving the Frame tab closes the cadre", async ({ openApp }) => {
    await cropButton(openApp).click();
    await expect(overlay(openApp)).toBeVisible();

    await openApp.tab("Retouche").click();

    await expect(overlay(openApp)).toHaveCount(0);
  });

  test("the page is flagged when modified, and its reset gives the whole photo back", async ({
    openApp,
  }) => {
    const reset = openApp.page.getByRole("button", {
      name: "Réinitialiser cette section : Recadrage",
    });
    const icon = openApp.page.getByRole("button", { name: "Aller à Recadrage" });
    await expect(reset).toBeDisabled();
    await expect(icon).not.toHaveAccessibleDescription("Modifié");

    await tool(openApp, "Pivoter à gauche").click();
    await expect(reset).toBeEnabled();
    await expect(icon).toHaveAccessibleDescription("Modifié");

    await reset.click();

    await expect.poll(async () => (await geometry(openApp)).quarterTurns).toBe(0);
    await expect(reset).toBeDisabled();
    await expect(icon).not.toHaveAccessibleDescription("Modifié");
  });

  test("a crop can be undone", async ({ openApp }) => {
    await cropButton(openApp).click();
    await drag(openApp, await onPhoto(openApp, 1, 1), await onPhoto(openApp, 0.5, 0.5));
    await cropButton(openApp).click();
    await expect.poll(async () => (await geometry(openApp)).crop.width).toBeCloseTo(0.5, 1);

    await openApp.waitForHistoryCommit();
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await openApp.page.keyboard.press("Meta+z");

    await expect.poll(async () => (await geometry(openApp)).crop.width).toBe(1);
  });

  test("the cadre is sent to the export", async ({ openApp }) => {
    await cropButton(openApp).click();
    await drag(openApp, await onPhoto(openApp, 1, 1), await onPhoto(openApp, 0.5, 0.5));
    await cropButton(openApp).click();

    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("dialog").getByRole("button", { name: "Enregistrer…" }).click();

    await expect.poll(async () => (await openApp.calls("export_image")).length).toBe(1);
    const sent = (await openApp.calls("export_image"))[0]?.args as unknown as {
      geometry: { crop: { width: number } };
    };
    expect(sent.geometry.crop.width).toBeCloseTo(0.5, 1);
  });
});

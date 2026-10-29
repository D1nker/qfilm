import { expect, test, type App } from "./support/app";

const graph = (app: App) => app.page.locator(".graph");
const points = (app: App) => graph(app).locator("[data-point]");
const channel = (app: App, name: string) => app.page.getByRole("radio", { name });
const curves = async (app: App) => (await app.lastRender()).params.curves;

/// Où cliquer sur le graphique pour une entrée et une sortie (de 0 à 1, la sortie vers le haut).
async function spot(app: App, x: number, y: number) {
  await graph(app).scrollIntoViewIfNeeded();
  const box = await graph(app).boundingBox();
  if (!box) throw new Error("graphique introuvable");
  return { x: box.x + x * box.width, y: box.y + (1 - y) * box.height };
}

test.describe("tone curve", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    await openApp.openSection("Courbe des tons");
  });

  test("starts as the diagonal: two end points, nothing sent to the engine", async ({
    openApp,
  }) => {
    await expect(points(openApp)).toHaveCount(2);
    expect(await curves(openApp)).toEqual({ rgb: [], red: [], green: [], blue: [] });
  });

  test("a click on the graph adds a point there and sends the curve", async ({ openApp }) => {
    const target = await spot(openApp, 0.5, 0.7);
    await openApp.page.mouse.click(target.x, target.y);

    await expect(points(openApp)).toHaveCount(3);
    await expect.poll(async () => (await curves(openApp)).rgb.length).toBe(3);
    const [, middle] = (await curves(openApp)).rgb;
    expect(middle?.[0]).toBeCloseTo(0.5, 1);
    expect(middle?.[1]).toBeCloseTo(0.7, 1);
  });

  test("dragging a point follows the pointer, as a draft until it is released when renders are slow", async ({
    openApp,
  }) => {
    await openApp.slowRenders();
    const start = await spot(openApp, 0.5, 0.5);
    await openApp.page.mouse.click(start.x, start.y);
    await expect(points(openApp)).toHaveCount(3);

    await openApp.page.mouse.move(start.x, start.y);
    await openApp.page.mouse.down();
    const end = await spot(openApp, 0.3, 0.8);
    await openApp.page.mouse.move(end.x, end.y, { steps: 8 });

    await expect
      .poll(async () => (await openApp.calls("render_preview")).at(-1)?.args.draft)
      .toBe(true);
    await expect.poll(async () => (await curves(openApp)).rgb[1]?.[0]).toBeCloseTo(0.3, 1);

    await openApp.page.mouse.up();

    await expect
      .poll(async () => (await openApp.calls("render_preview")).at(-1)?.args.draft)
      .toBe(false);
    expect((await curves(openApp)).rgb[1]?.[1]).toBeCloseTo(0.8, 1);
  });

  test("the end points only slide up and down", async ({ openApp }) => {
    const first = await spot(openApp, 0, 0);
    const to = await spot(openApp, 0.4, 0.3);
    await openApp.page.mouse.move(first.x, first.y);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(to.x, to.y, { steps: 6 });
    await openApp.page.mouse.up();

    await expect.poll(async () => (await curves(openApp)).rgb[0]?.[1]).toBeCloseTo(0.3, 1);
    expect((await curves(openApp)).rgb[0]?.[0]).toBe(0);
  });

  test("a double-click removes an inner point, never an end", async ({ openApp }) => {
    const target = await spot(openApp, 0.5, 0.7);
    await openApp.page.mouse.click(target.x, target.y);
    await expect(points(openApp)).toHaveCount(3);

    await points(openApp).nth(1).dblclick();
    await expect(points(openApp)).toHaveCount(2);

    await points(openApp).first().dblclick();
    await expect(points(openApp)).toHaveCount(2);
  });

  test("a point moves with the arrows (Shift for bigger steps) and goes with Delete", async ({
    openApp,
  }) => {
    const target = await spot(openApp, 0.5, 0.5);
    await openApp.page.mouse.click(target.x, target.y);
    await points(openApp).nth(1).focus();

    await openApp.press("ArrowUp", 5);
    await expect.poll(async () => (await curves(openApp)).rgb[1]?.[1]).toBeCloseTo(0.55, 1);

    await openApp.page.keyboard.press("Shift+ArrowRight");
    await expect.poll(async () => (await curves(openApp)).rgb[1]?.[0]).toBeCloseTo(0.55, 1);

    await openApp.page.keyboard.press("Delete");
    await expect(points(openApp)).toHaveCount(2);
  });

  test("each channel has its own curve, and the picker flags the ones that moved", async ({
    openApp,
  }) => {
    await channel(openApp, "Courbe du rouge").click();
    const target = await spot(openApp, 0.5, 0.75);
    await openApp.page.mouse.click(target.x, target.y);

    await expect.poll(async () => (await curves(openApp)).red.length).toBe(3);
    const sent = await curves(openApp);
    expect(sent.rgb).toEqual([]);
    expect(sent.green).toEqual([]);
    await expect(channel(openApp, "Courbe du rouge")).toHaveClass(/marked/);
    await expect(channel(openApp, "Courbe RVB")).not.toHaveClass(/marked/);

    await channel(openApp, "Courbe du vert").click();
    await expect(points(openApp)).toHaveCount(2);
    await channel(openApp, "Courbe du rouge").click();
    await expect(points(openApp)).toHaveCount(3);
  });

  test("the section is flagged when a curve moved, and its reset flattens every curve", async ({
    openApp,
  }) => {
    const header = openApp.page.getByRole("button", { name: /^Courbe des tons( Modifié)?$/ });
    const modified = openApp.page.getByRole("button", { name: "Courbe des tons Modifié" });
    await expect(modified).toHaveCount(0);

    const target = await spot(openApp, 0.5, 0.75);
    await openApp.page.mouse.click(target.x, target.y);
    await expect(modified).toBeVisible();

    await openApp.page
      .getByRole("button", { name: /^Réinitialiser cette section : Courbe/ })
      .click();

    await expect(points(openApp)).toHaveCount(2);
    await expect.poll(async () => (await curves(openApp)).rgb).toEqual([]);
    await expect(modified).toHaveCount(0);
    await expect(header).toBeVisible();
  });

  test("a curve edit can be undone", async ({ openApp }) => {
    const target = await spot(openApp, 0.5, 0.75);
    await openApp.page.mouse.click(target.x, target.y);
    await expect(points(openApp)).toHaveCount(3);

    await openApp.waitForHistoryCommit();
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await openApp.page.keyboard.press("Meta+z");

    await expect(points(openApp)).toHaveCount(2);
  });
});

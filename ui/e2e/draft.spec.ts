import { expect, test, type App } from "./support/app";

const photo = (app: App) => app.page.locator("main img").first();

const size = async (app: App) => {
  const box = await photo(app).boundingBox();
  return { width: box?.width ?? 0, height: box?.height ?? 0 };
};

const lastDraft = async (app: App) => {
  const calls = await app.calls("render_preview");
  return calls.at(-1)?.args.draft;
};

test.describe("preview while dragging a slider", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Retouche").click();
  });

  test("is a quick draft during the drag, and the full render after the release", async ({
    openApp,
  }) => {
    const before = await size(openApp);
    const thumb = await openApp.page.getByRole("slider", { name: "Exposition" }).boundingBox();
    if (!thumb) throw new Error("curseur introuvable");
    const [x, y] = [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2];

    await openApp.page.mouse.move(x, y);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(x + 40, y, { steps: 6 });

    await expect.poll(() => lastDraft(openApp)).toBe(true);
    await expect
      .poll(() => photo(openApp).evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeLessThan(1000);
    const during = await size(openApp);
    expect(Math.abs(during.width - before.width)).toBeLessThan(1.5);
    expect(Math.abs(during.height - before.height)).toBeLessThan(1.5);

    await openApp.page.mouse.up();

    await expect.poll(() => lastDraft(openApp)).toBe(false);
    await expect
      .poll(() => photo(openApp).evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(1000);
    const after = await size(openApp);
    expect(Math.abs(after.width - before.width)).toBeLessThan(1.5);
  });

  test("stays in full quality for a keyboard step", async ({ openApp }) => {
    const before = (await openApp.calls("render_preview")).length;

    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.press("ArrowRight", 5);

    await expect
      .poll(async () => (await openApp.calls("render_preview")).length)
      .toBeGreaterThan(before);
    const calls = (await openApp.calls("render_preview")).slice(before);
    expect(calls.every((call) => call.args.draft === false)).toBe(true);
  });

  test("does not stay in draft after a simple click that moves nothing", async ({ openApp }) => {
    const thumb = await openApp.page.getByRole("slider", { name: "Exposition" }).boundingBox();
    if (!thumb) throw new Error("curseur introuvable");

    await openApp.page.mouse.click(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await openApp.page.getByRole("slider", { name: "Contraste" }).focus();
    await openApp.press("ArrowRight", 3);

    await expect.poll(async () => (await openApp.lastRender()).params.contrast).toBeCloseTo(0.03);
    await expect.poll(() => lastDraft(openApp)).toBe(false);
  });

  test("applies to every slider, the look intensity included", async ({ openApp }) => {
    await openApp.tab("Preset").click();
    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();
    const thumb = await openApp.page.getByRole("slider", { name: "Intensité" }).boundingBox();
    if (!thumb) throw new Error("curseur introuvable");
    const [x, y] = [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2];

    await openApp.page.mouse.move(x, y);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(x - 60, y, { steps: 6 });

    await expect.poll(() => lastDraft(openApp)).toBe(true);
    await openApp.page.mouse.up();
    await expect.poll(() => lastDraft(openApp)).toBe(false);
  });

  test("does not stay in draft when the pointer is released away from the slider", async ({
    openApp,
  }) => {
    const thumb = await openApp.page.getByRole("slider", { name: "Exposition" }).boundingBox();
    if (!thumb) throw new Error("curseur introuvable");
    const [x, y] = [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2];

    await openApp.page.mouse.move(x, y);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(x + 30, y + 400, { steps: 6 });
    await expect.poll(() => lastDraft(openApp)).toBe(true);

    await openApp.page.mouse.move(40, 40);
    await openApp.page.mouse.up();

    await expect.poll(() => lastDraft(openApp)).toBe(false);
  });
});

import { expect, test, type App } from "./support/app";

const box = (app: App, selector: string) =>
  app.page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const { top, bottom, left, right, width, height } = element.getBoundingClientRect();
      return { top, bottom, left, right, width, height };
    });

const zoomLabel = async (app: App) => (await app.page.locator(".zoom-label").innerText()).trim();
const percent = async (app: App) => Number.parseInt(await zoomLabel(app), 10);
const button = (app: App, name: string) => app.page.getByRole("button", { name, exact: true });

const scrollState = (app: App) =>
  app.page.locator(".scroller").evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));

test.describe("layout never depends on the photo", () => {
  const shapes: [string, [number, number]][] = [
    ["a large portrait photo", [1200, 1800]],
    ["a large landscape photo", [1800, 1200]],
    ["a panorama", [1800, 300]],
  ];

  for (const [name, size] of shapes) {
    test.describe(name, () => {
      test.use({ imageSize: size });

      test("stays inside the window with the whole photo visible", async ({ openApp }) => {
        const main = await box(openApp, "main");
        const photo = await box(openApp, "main img");
        const inspector = await box(openApp, "aside");

        expect(main.bottom).toBeLessThanOrEqual(900.5);
        expect(inspector.bottom).toBeLessThanOrEqual(900.5);
        expect(photo.top).toBeGreaterThanOrEqual(main.top);
        expect(photo.bottom).toBeLessThanOrEqual(main.bottom);
        expect(photo.left).toBeGreaterThanOrEqual(main.left);
        expect(photo.right).toBeLessThanOrEqual(main.right);
        await expect(openApp.page.getByRole("button", { name: "Exporter…" })).toBeVisible();
      });
    });
  }
});

test.describe("zoom and pan", () => {
  test.use({ imageSize: [1200, 1800] });

  test("fits the window without scrolling", async ({ openApp }) => {
    const scroll = await scrollState(openApp);

    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);
    expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight + 1);
  });

  test("the + and − buttons zoom in and out", async ({ openApp }) => {
    const fit = await percent(openApp);

    await button(openApp, "Zoomer").click();
    expect(await percent(openApp)).toBeGreaterThan(fit);
    const scroll = await scrollState(openApp);
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);

    await button(openApp, "Dézoomer").click();
    expect(await percent(openApp)).toBe(fit);
  });

  test("zooms out below the fitted size, down to a floor", async ({ openApp }) => {
    const fit = await percent(openApp);

    await button(openApp, "Dézoomer").click();
    expect(await percent(openApp)).toBeLessThan(fit);

    for (let i = 0; i < 15; i++) await button(openApp, "Dézoomer").click();
    const floor = await percent(openApp);
    expect(floor).toBeGreaterThanOrEqual(Math.floor(fit * 0.2) - 1);
    expect(floor).toBeLessThanOrEqual(Math.ceil(fit * 0.2) + 1);
  });

  test("never zooms past 200% of the preview", async ({ openApp }) => {
    for (let i = 0; i < 12; i++) await button(openApp, "Zoomer").click();

    expect(await percent(openApp)).toBe(200);
  });

  test("Cmd+scroll zooms around the cursor", async ({ openApp }) => {
    const before = await box(openApp, "main img");
    const x = before.left + before.width * 0.25;
    const y = before.top + before.height * 0.25;

    await openApp.page.mouse.move(x, y);
    await openApp.page.keyboard.down("Meta");
    await openApp.page.mouse.wheel(0, -400);
    await openApp.page.keyboard.up("Meta");

    await expect
      .poll(async () => (await box(openApp, "main img")).width)
      .toBeGreaterThan(before.width * 1.2);
    const after = await box(openApp, "main img");
    expect((x - after.left) / after.width).toBeCloseTo(0.25, 1);
    expect((y - after.top) / after.height).toBeCloseTo(0.25, 1);
  });

  test("Space+drag moves the photo", async ({ openApp }) => {
    await button(openApp, "Zoomer").click();
    await button(openApp, "Zoomer").click();
    const before = await scrollState(openApp);

    await openApp.page.mouse.move(500, 400);
    await openApp.page.keyboard.down("Space");
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(400, 300, { steps: 6 });
    await openApp.page.mouse.up();
    await openApp.page.keyboard.up("Space");

    const after = await scrollState(openApp);
    expect(after.top).toBeGreaterThan(before.top);
    expect(after.left).toBeGreaterThanOrEqual(before.left);
  });

  test("dragging moves the photo when zoomed in, without Space", async ({ openApp }) => {
    await button(openApp, "Zoomer").click();
    await button(openApp, "Zoomer").click();
    const before = await scrollState(openApp);

    await openApp.page.mouse.move(600, 500);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(600, 420, { steps: 5 });
    await openApp.page.mouse.up();

    expect((await scrollState(openApp)).top).toBeGreaterThan(before.top);
  });

  test("Cmd+0, Cmd+= and Cmd+- zoom from the keyboard", async ({ openApp }) => {
    const fit = await percent(openApp);

    await openApp.page.keyboard.press("Meta+=");
    await expect.poll(() => percent(openApp)).toBeGreaterThan(fit);

    await openApp.page.keyboard.press("Meta+-");
    await expect.poll(() => percent(openApp)).toBe(fit);

    await openApp.page.keyboard.press("Meta+-");
    await openApp.page.keyboard.press("Meta+0");
    await expect.poll(() => percent(openApp)).toBe(fit);
  });

  test("double-click toggles between fit and 100%", async ({ openApp }) => {
    const fit = await zoomLabel(openApp);

    await openApp.page.locator("main img").dblclick();
    await expect.poll(() => zoomLabel(openApp)).toBe("100 %");

    await openApp.page.locator("main img").dblclick();
    await expect.poll(() => zoomLabel(openApp)).toBe(fit);
  });

  test("double-click returns to fit from a zoomed-out view", async ({ openApp }) => {
    const fit = await zoomLabel(openApp);
    for (let i = 0; i < 4; i++) await button(openApp, "Dézoomer").click();

    await openApp.page.locator(".scroller").dblclick({ position: { x: 50, y: 50 } });

    await expect.poll(() => zoomLabel(openApp)).toBe(fit);
  });

  test("a new photo starts fitted again", async ({ openApp }) => {
    const fit = await zoomLabel(openApp);
    await button(openApp, "Zoomer").click();

    await openApp.page.getByRole("button", { name: "Ouvrir…" }).click();

    await expect.poll(() => zoomLabel(openApp)).toBe(fit);
  });
});

test.describe("seeing the original and the panel", () => {
  test("holding C shows the original, without the caption layer", async ({ openApp }) => {
    const layer = openApp.page.locator(".caption-layer");
    await expect(layer).toHaveCount(1);

    await openApp.page.mouse.move(300, 300);
    await openApp.page.keyboard.down("c");
    await expect(layer).toHaveCount(0);

    await openApp.page.keyboard.up("c");
    await expect(layer).toHaveCount(1);
  });

  test("F hides and shows the panel", async ({ openApp }) => {
    const panel = openApp.page.locator("aside");
    await expect(panel).toBeVisible();

    await openApp.page.keyboard.press("f");
    await expect(panel).toBeHidden();

    await openApp.page.keyboard.press("f");
    await expect(panel).toBeVisible();
  });

  test("the shortcuts are ignored while typing", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await openApp.group("Légende");
    const caption = openApp.page.getByPlaceholder("Biarritz, août 2026");
    await caption.click();

    await openApp.page.keyboard.type("cf");

    await expect(caption).toHaveValue("cf");
    await expect(openApp.page.locator("aside")).toBeVisible();
  });
});

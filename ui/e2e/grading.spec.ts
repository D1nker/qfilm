import type { Locator } from "@playwright/test";

import { expect, test, type App } from "./support/app";

const grading = (app: App) => app.page.locator(".grading");
const wheel = (app: App) => app.page.locator(".wheel");
const puck = (app: App, zone: string) =>
  wheel(app).getByRole("button", { name: new RegExp(`^${zone} :`) });
const zone = (app: App, name: string) => grading(app).getByRole("radio", { name });
const params = async (app: App) => (await app.lastRender()).params;

/// Où cliquer sur la roue pour une teinte (en degrés, sens horaire depuis le haut) et une saturation.
async function spot(wheelBox: Locator, hue: number, saturation: number) {
  // La roue est sous la ligne de flottaison : sans cela, la souris clique à côté de la page.
  await wheelBox.scrollIntoViewIfNeeded();
  const box = await wheelBox.boundingBox();
  if (!box) throw new Error("roue introuvable");

  const radius = box.width / 2;
  const angle = (hue * Math.PI) / 180;
  return {
    x: box.x + radius + Math.sin(angle) * saturation * radius,
    y: box.y + radius - Math.cos(angle) * saturation * radius,
  };
}

test.describe("colour grading wheel", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    await openApp.openSection("Étalonnage");
  });

  test("shows one wheel with a puck per zone, a zone picker, two sliders and the balance", async ({
    openApp,
  }) => {
    for (const name of ["Ombres", "Tons moyens", "Hautes lumières"]) {
      await expect(puck(openApp, name)).toBeVisible();
      await expect(zone(openApp, name)).toBeVisible();
    }
    await expect(zone(openApp, "Ombres")).toBeChecked();
    for (const name of ["Teinte", "Saturation", "Équilibre"]) {
      await expect(grading(openApp).getByRole("slider", { name, exact: true })).toBeVisible();
    }
  });

  test("a click on the wheel puts the active puck there", async ({ openApp }) => {
    const target = await spot(wheel(openApp), 90, 0.5);

    await openApp.page.mouse.click(target.x, target.y);

    await expect.poll(async () => (await params(openApp)).shadowsHue).toBeCloseTo(90, 0);
    expect((await params(openApp)).shadowsSaturation).toBeCloseTo(0.5, 1);
    expect((await params(openApp)).midtonesSaturation).toBe(0);
  });

  test("dragging follows the pointer, and the preview is a draft until it is released when renders are slow", async ({
    openApp,
  }) => {
    await openApp.slowRenders();
    const start = await spot(wheel(openApp), 0, 0.3);
    const end = await spot(wheel(openApp), 180, 0.8);

    await openApp.page.mouse.move(start.x, start.y);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(end.x, end.y, { steps: 8 });

    await expect
      .poll(async () => (await openApp.calls("render_preview")).at(-1)?.args.draft)
      .toBe(true);
    await expect.poll(async () => (await params(openApp)).shadowsHue).toBeCloseTo(180, 0);

    await openApp.page.mouse.up();

    await expect
      .poll(async () => (await openApp.calls("render_preview")).at(-1)?.args.draft)
      .toBe(false);
    expect((await params(openApp)).shadowsSaturation).toBeCloseTo(0.8, 1);
  });

  test("grabs the puck of another zone and makes that zone the active one", async ({ openApp }) => {
    await zone(openApp, "Hautes lumières").click();
    await openApp.page.mouse.click(
      ...(Object.values(await spot(wheel(openApp), 40, 0.6)) as [number, number]),
    );
    await zone(openApp, "Ombres").click();

    const grab = await spot(wheel(openApp), 40, 0.6);
    const drop = await spot(wheel(openApp), 220, 0.4);
    await openApp.page.mouse.move(grab.x, grab.y);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(drop.x, drop.y, { steps: 6 });
    await openApp.page.mouse.up();

    await expect(zone(openApp, "Hautes lumières")).toBeChecked();
    await expect.poll(async () => (await params(openApp)).highlightsHue).toBeCloseTo(220, 0);
    expect((await params(openApp)).shadowsSaturation).toBe(0);
  });

  test("keeps the hue when a puck is dragged to the very centre", async ({ openApp }) => {
    const first = await spot(wheel(openApp), 130, 0.7);
    await openApp.page.mouse.click(first.x, first.y);
    await expect.poll(async () => (await params(openApp)).shadowsHue).toBeCloseTo(130, 0);

    const centre = await spot(wheel(openApp), 0, 0);
    await openApp.page.mouse.move(first.x, first.y);
    await openApp.page.mouse.down();
    await openApp.page.mouse.move(centre.x, centre.y, { steps: 8 });
    await openApp.page.mouse.up();

    await expect.poll(async () => (await params(openApp)).shadowsSaturation).toBeLessThan(0.04);
    // Au pixel près du pointeur : la teinte reste là où elle était, à quelques degrés près.
    const { shadowsHue = 0 } = await params(openApp);
    expect(Math.abs(shadowsHue - 130)).toBeLessThan(10);
  });

  test("a puck moves with the keyboard: arrows for the hue and the saturation, Shift for bigger steps", async ({
    openApp,
  }) => {
    await puck(openApp, "Tons moyens").focus();
    await expect(zone(openApp, "Tons moyens")).toBeChecked();

    await openApp.press("ArrowUp", 20);
    await openApp.press("ArrowRight", 5);
    await openApp.page.keyboard.press("Shift+ArrowRight");
    await openApp.page.keyboard.press("Shift+ArrowUp");

    await expect.poll(async () => (await params(openApp)).midtonesHue).toBeCloseTo(15, 0);
    expect((await params(openApp)).midtonesSaturation).toBeCloseTo(0.3, 2);
    expect((await params(openApp)).shadowsSaturation).toBe(0);
  });

  test("a double-click brings the active zone back to neutral", async ({ openApp }) => {
    const target = await spot(wheel(openApp), 250, 0.6);
    await openApp.page.mouse.click(target.x, target.y);
    await expect.poll(async () => (await params(openApp)).shadowsSaturation).toBeGreaterThan(0.5);

    const centre = await spot(wheel(openApp), 0, 0.95);
    await openApp.page.mouse.dblclick(centre.x, centre.y);

    await expect
      .poll(async () => params(openApp))
      .toMatchObject({ shadowsHue: 0, shadowsSaturation: 0 });
  });

  test("the sliders and the wheel show the same thing", async ({ openApp }) => {
    await grading(openApp)
      .locator(".slider", { hasText: "Teinte" })
      .locator("button.value")
      .click();
    await openApp.page.getByRole("textbox", { name: "Valeur de Teinte" }).fill("200");
    await openApp.page.keyboard.press("Enter");
    await grading(openApp).getByRole("slider", { name: "Saturation" }).focus();
    await openApp.press("ArrowRight", 60);

    await expect(puck(openApp, "Ombres")).toHaveAccessibleName(
      "Ombres : teinte 200°, saturation 0.60",
    );
    await expect(zone(openApp, "Ombres")).toHaveClass(/marked/);
    await expect(zone(openApp, "Tons moyens")).not.toHaveClass(/marked/);
  });

  test("each zone has its own settings", async ({ openApp }) => {
    await grading(openApp).getByRole("slider", { name: "Saturation" }).focus();
    await openApp.press("ArrowRight", 40);
    await zone(openApp, "Hautes lumières").click();
    await expect(grading(openApp).locator(".slider", { hasText: "Saturation" })).toContainText(
      "0.00",
    );
    await grading(openApp).getByRole("slider", { name: "Saturation" }).focus();
    await openApp.press("ArrowRight", 25);

    await expect
      .poll(async () => params(openApp))
      .toMatchObject({ shadowsSaturation: 0.4, highlightsSaturation: 0.25, midtonesSaturation: 0 });
  });

  test("the balance is a slider of its own", async ({ openApp }) => {
    await grading(openApp).getByRole("slider", { name: "Équilibre" }).focus();
    await openApp.press("ArrowLeft", 30);

    await expect.poll(async () => (await params(openApp)).gradingBalance).toBeCloseTo(-0.3);
  });

  test("the section is flagged when graded, and its reset clears every zone at once", async ({
    openApp,
  }) => {
    const target = await spot(wheel(openApp), 200, 0.7);
    await openApp.page.mouse.click(target.x, target.y);
    await zone(openApp, "Hautes lumières").click();
    const other = await spot(wheel(openApp), 30, 0.5);
    await openApp.page.mouse.click(other.x, other.y);
    await grading(openApp).getByRole("slider", { name: "Équilibre" }).focus();
    await openApp.press("ArrowRight", 10);
    await expect(openApp.page.getByRole("button", { name: "Étalonnage Modifié" })).toBeVisible();

    await openApp.page
      .getByRole("button", { name: "Réinitialiser cette section : Étalonnage" })
      .click();

    await expect
      .poll(async () => params(openApp))
      .toMatchObject({
        shadowsSaturation: 0,
        highlightsSaturation: 0,
        shadowsHue: 0,
        highlightsHue: 0,
        gradingBalance: 0,
      });
    await expect(
      openApp.page.getByRole("button", { name: "Étalonnage", exact: true }),
    ).toBeVisible();
  });
});

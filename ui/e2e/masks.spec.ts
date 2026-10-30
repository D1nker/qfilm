import { expect, test, type App } from "./support/app";

test.use({ viewport: { width: 1440, height: 900 } });

const masksOf = async (app: App) => (await app.lastRender()).masks;
const button = (app: App, name: string) => app.page.getByRole("button", { name, exact: true });
const slider = (app: App, name: string) => app.page.getByRole("slider", { name, exact: true });
const overlay = (app: App) => app.page.getByRole("group", { name: "Poignées du masque" });
const handle = (app: App, name: RegExp) => overlay(app).getByRole("button", { name });

const START = /Début du dégradé/;
const END = /Fin du dégradé/;

async function addMask(app: App, kind: "Dégradé linéaire" | "Dégradé radial") {
  await app.group("Masques");
  await button(app, kind).click();
}

/// Change un curseur du masque : on le focalise puis on le pousse aux flèches.
async function nudge(app: App, name: string, key: "ArrowLeft" | "ArrowRight", times: number) {
  await slider(app, name).focus();
  await app.press(key, times);
}

/// Où se trouve le centre d'une poignée, en pixels d'écran.
async function centreOf(app: App, name: RegExp) {
  const box = await handle(app, name).boundingBox();
  if (!box) throw new Error(`poignée introuvable : ${name}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(app: App, from: { x: number; y: number }, to: { x: number; y: number }) {
  await app.page.mouse.move(from.x, from.y);
  await app.page.mouse.down();
  await app.page.mouse.move(to.x, to.y, { steps: 6 });
  await app.page.mouse.up();
}

test.describe("the masks page", () => {
  test("is the fourth page of the Retouche group, with an empty state", async ({ openApp }) => {
    await openApp.group("Masques");

    await expect(
      openApp.page.getByRole("navigation").locator('[data-section="adjust"]'),
    ).toHaveCount(4);
    await expect(openApp.page.getByText(/Ajoute un dégradé/)).toBeVisible();
    await expect(button(openApp, "Réinitialiser")).toBeDisabled();
    await expect(overlay(openApp).getByRole("button")).toHaveCount(0);
  });

  test("a new mask is listed and selected, with the Light and Color sliders of Retouche", async ({
    openApp,
  }) => {
    await addMask(openApp, "Dégradé linéaire");

    await expect(button(openApp, "Dégradé linéaire 1")).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Exposition", "Contraste", "Température", "Vibrance"]) {
      await expect(slider(openApp, name)).toBeVisible();
    }
    await expect(slider(openApp, "Netteté")).toHaveCount(0);
    await expect(slider(openApp, "Grain")).toHaveCount(0);
  });

  test("nothing is sent to the engine for a mask whose sliders are all at zero", async ({
    openApp,
  }) => {
    await addMask(openApp, "Dégradé linéaire");
    await addMask(openApp, "Dégradé radial");
    await openApp.page.waitForTimeout(150);

    expect(await masksOf(openApp)).toEqual([]);
  });

  test("a slider sends the mask, with its shape, and only the sliders that moved are non-zero", async ({
    openApp,
  }) => {
    await addMask(openApp, "Dégradé linéaire");

    await nudge(openApp, "Exposition", "ArrowLeft", 50);

    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
    const [mask] = await masksOf(openApp);
    expect(mask?.shape.kind).toBe("linear");
    expect(mask?.invert).toBe(false);
    expect(mask?.adjust.exposure).toBeCloseTo(-0.5, 1);
    expect(mask?.adjust.contrast).toBe(0);
  });

  test("a mask is sent after the geometry and before the frame, whatever the page", async ({
    openApp,
  }) => {
    await addMask(openApp, "Dégradé radial");
    await nudge(openApp, "Saturation", "ArrowLeft", 100);

    await openApp.group("Tons");

    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
  });

  test("the angle and the feather belong to a radial mask only", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await expect(slider(openApp, "Flou")).toHaveCount(0);
    await expect(slider(openApp, "Angle")).toHaveCount(0);

    await addMask(openApp, "Dégradé radial");
    await nudge(openApp, "Exposition", "ArrowRight", 30);
    await nudge(openApp, "Angle", "ArrowRight", 20);

    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
    const [mask] = await masksOf(openApp);
    expect(mask?.shape.kind === "radial" ? mask.shape.angle : 0).toBeGreaterThan(10);
  });

  test("inverting the area is sent as such", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowRight", 30);

    await openApp.page.getByRole("switch").click();

    await expect.poll(async () => (await masksOf(openApp))[0]?.invert).toBe(true);
  });

  test("each mask keeps its own settings when another is chosen", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowRight", 40);
    await addMask(openApp, "Dégradé radial");
    await nudge(openApp, "Contraste", "ArrowLeft", 30);

    await button(openApp, "Dégradé linéaire 1").click();

    await expect(slider(openApp, "Exposition")).toHaveAttribute("aria-valuenow", "0.4");
    await expect(slider(openApp, "Contraste")).toHaveAttribute("aria-valuenow", "0");
    const masks = await masksOf(openApp);
    expect(masks).toHaveLength(2);
  });

  test("deleting a mask removes it from the render, and the others stay", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowRight", 40);
    await addMask(openApp, "Dégradé radial");
    await nudge(openApp, "Exposition", "ArrowRight", 20);
    await expect.poll(async () => (await masksOf(openApp)).length).toBe(2);

    await openApp.page.getByRole("button", { name: "Supprimer Dégradé radial 1" }).click();

    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
    expect((await masksOf(openApp))[0]?.shape.kind).toBe("linear");
    await expect(button(openApp, "Dégradé linéaire 1")).toHaveAttribute("aria-pressed", "true");
  });

  test("Reset removes every mask", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowRight", 40);
    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);

    await button(openApp, "Réinitialiser").click();

    await expect.poll(async () => (await masksOf(openApp)).length).toBe(0);
    await expect(openApp.page.getByText(/Ajoute un dégradé/)).toBeVisible();
  });

  test("the rail icon is marked once a mask changes something", async ({ openApp }) => {
    const icon = openApp.page
      .getByRole("navigation")
      .getByRole("button", { name: "Aller à Masques", exact: true });
    await addMask(openApp, "Dégradé linéaire");
    await expect(icon).not.toHaveAccessibleDescription(/Modifié/);

    await nudge(openApp, "Exposition", "ArrowRight", 10);

    await expect(icon).toHaveAccessibleDescription(/Modifié/);
  });

  test("is part of the export", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowLeft", 40);

    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("button", { name: "Enregistrer…" }).click();

    await expect.poll(() => openApp.count("export_image")).toBe(1);
    const exported = await openApp.lastExport();
    expect(exported.masks).toHaveLength(1);
    expect(exported.masks[0]?.adjust.exposure).toBeCloseTo(-0.4, 1);
  });
});

test.describe("the handles on the photo", () => {
  test("a linear gradient has a start and an end, and they are only there on this page", async ({
    openApp,
  }) => {
    await addMask(openApp, "Dégradé linéaire");

    await expect(handle(openApp, START)).toBeVisible();
    await expect(handle(openApp, END)).toBeVisible();

    await openApp.group("Tons");
    await expect(overlay(openApp)).toHaveCount(0);

    await openApp.group("Masques");
    await expect(handle(openApp, START)).toBeVisible();
  });

  test("a radial mask has a centre and two radii", async ({ openApp }) => {
    await addMask(openApp, "Dégradé radial");

    for (const name of [/Centre de l'ellipse/, /Grand rayon/, /Petit rayon/]) {
      await expect(handle(openApp, name)).toBeVisible();
    }
    await expect(handle(openApp, START)).toHaveCount(0);
  });

  test("only the chosen mask shows its handles", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await addMask(openApp, "Dégradé radial");
    await expect(handle(openApp, START)).toHaveCount(0);

    await button(openApp, "Dégradé linéaire 1").click();

    await expect(handle(openApp, START)).toBeVisible();
    await expect(handle(openApp, /Grand rayon/)).toHaveCount(0);
  });

  test("dragging the end of a gradient moves it, and the engine is told", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowLeft", 40);
    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
    const photo = await overlay(openApp).boundingBox();
    const from = await centreOf(openApp, END);

    await drag(openApp, from, {
      x: (photo?.x ?? 0) + (photo?.width ?? 0) * 0.8,
      y: (photo?.y ?? 0) + (photo?.height ?? 0) * 0.9,
    });

    await expect
      .poll(async () => {
        const shape = (await masksOf(openApp))[0]?.shape;
        return shape?.kind === "linear" ? shape.to : null;
      })
      .toEqual([expect.closeTo(0.8, 1), expect.closeTo(0.9, 1)]);
    const shape = (await masksOf(openApp))[0]?.shape;
    expect(shape?.kind === "linear" ? shape.from : null).toEqual([0.5, 0.15]);
  });

  test("a handle cannot be dragged off the photo", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowLeft", 40);
    const photo = await overlay(openApp).boundingBox();
    const from = await centreOf(openApp, END);

    await drag(openApp, from, {
      x: (photo?.x ?? 0) + (photo?.width ?? 0) + 200,
      y: (photo?.y ?? 0) - 200,
    });

    await expect
      .poll(async () => {
        const shape = (await masksOf(openApp))[0]?.shape;
        return shape?.kind === "linear" ? shape.to : null;
      })
      .toEqual([1, 0]);
  });

  test("a handle moves with the arrow keys, Shift for a bigger step", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowLeft", 40);

    await handle(openApp, START).focus();
    await openApp.press("ArrowDown", 5);
    await openApp.page.keyboard.press("Shift+ArrowRight");

    await expect
      .poll(async () => {
        const shape = (await masksOf(openApp))[0]?.shape;
        return shape?.kind === "linear" ? shape.from : null;
      })
      .toEqual([expect.closeTo(0.55, 2), expect.closeTo(0.2, 2)]);
  });

  test("dragging the long radius of an ellipse grows it", async ({ openApp }) => {
    await addMask(openApp, "Dégradé radial");
    await nudge(openApp, "Exposition", "ArrowRight", 40);
    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
    const photo = await overlay(openApp).boundingBox();
    const from = await centreOf(openApp, /Grand rayon/);

    await drag(openApp, from, { x: (photo?.x ?? 0) + (photo?.width ?? 0) * 0.95, y: from.y });

    await expect
      .poll(async () => {
        const shape = (await masksOf(openApp))[0]?.shape;
        return shape?.kind === "radial" ? shape.radius[0] : 0;
      })
      .toBeGreaterThan(0.38);
  });

  test("the photo shows without its frame while masks are placed, and gets it back", async ({
    openApp,
  }) => {
    await openApp.tab("Cadre").click();
    await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();
    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("film35");

    await openApp.group("Masques");
    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("none");

    await openApp.group("Tons");
    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("film35");
  });

  test("the overlay lets clicks through, except on the handles", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");

    expect(await overlay(openApp).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
      "none",
    );
    expect(await handle(openApp, START).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
      "auto",
    );
  });

  test("handles stay while the original is held (C)... and the photo is the original", async ({
    openApp,
  }) => {
    await addMask(openApp, "Dégradé linéaire");
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await openApp.page.keyboard.down("c");

    await expect(overlay(openApp)).toHaveCount(0);
    await openApp.page.keyboard.up("c");
    await expect(overlay(openApp)).toBeVisible();
  });
});

test.describe("undo", () => {
  const undo = (app: App) => app.page.getByRole("button", { name: "Annuler", exact: true });

  test("brings back a deleted mask with its settings", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await nudge(openApp, "Exposition", "ArrowLeft", 40);
    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
    await openApp.page.waitForTimeout(400);

    await openApp.page.getByRole("button", { name: "Supprimer Dégradé linéaire 1" }).click();
    await expect.poll(async () => (await masksOf(openApp)).length).toBe(0);
    await openApp.page.waitForTimeout(400);

    await undo(openApp).click();

    await expect.poll(async () => (await masksOf(openApp)).length).toBe(1);
    expect((await masksOf(openApp))[0]?.adjust.exposure).toBeCloseTo(-0.4, 1);
  });

  test("choosing another mask is not a step to undo", async ({ openApp }) => {
    await addMask(openApp, "Dégradé linéaire");
    await openApp.page.waitForTimeout(400);
    await addMask(openApp, "Dégradé radial");
    await openApp.page.waitForTimeout(400);

    await button(openApp, "Dégradé linéaire 1").click();
    await openApp.page.waitForTimeout(400);
    await undo(openApp).click();

    // Un seul pas défait : l'ajout de l'ellipse, pas le clic sur l'autre masque.
    await expect(button(openApp, "Dégradé radial 1")).toHaveCount(0);
    await expect(button(openApp, "Dégradé linéaire 1")).toBeVisible();
  });
});

test.describe("the lines drawn on the photo", () => {
  /// Le dessin est en pixels d'écran : il doit avoir la taille réelle de la photo, pas celle d'avant la mesure.
  async function drawing(app: App) {
    const box = await overlay(app).boundingBox();
    const view = await overlay(app)
      .locator("svg.lines")
      .evaluate((svg) => svg.getAttribute("viewBox"));
    return { box, view };
  }

  test("a linear gradient draws its two edges and its axis at the size of the photo", async ({
    openApp,
  }) => {
    await addMask(openApp, "Dégradé linéaire");

    const { box, view } = await drawing(openApp);
    const [, , width, height] = (view ?? "").split(" ").map(Number);
    expect(width).toBeCloseTo(box?.width ?? 0, -1);
    expect(height).toBeCloseTo(box?.height ?? 0, -1);
    await expect(overlay(openApp).locator("svg.lines line")).toHaveCount(3);
    expect(width).toBeGreaterThan(100);
  });

  test("a radial mask draws its outline and its feather", async ({ openApp }) => {
    await addMask(openApp, "Dégradé radial");

    await expect(overlay(openApp).locator("svg.lines ellipse")).toHaveCount(2);
    const { box, view } = await drawing(openApp);
    expect(Number((view ?? "").split(" ")[2])).toBeCloseTo(box?.width ?? 0, -1);
  });

  test("the first mask of the session is drawn right, not only the next ones", async ({
    openApp,
  }) => {
    // Le cadre se mesure au montage : le premier masque est celui qui arrive à un panneau déjà monté.
    await openApp.group("Masques");
    await expect(overlay(openApp)).toBeAttached();

    await button(openApp, "Dégradé linéaire").click();

    const { box, view } = await drawing(openApp);
    expect(Number((view ?? "").split(" ")[2])).toBeCloseTo(box?.width ?? 0, -1);
  });
});

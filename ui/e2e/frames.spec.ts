import { expect, test, type App } from "./support/app";

const shape = (app: App, name: string) => app.page.locator(".grid .thumb", { hasText: name });
const section = (app: App, name: string) => app.page.getByRole("button", { name, exact: true });
const frameParams = async (app: App) => (await app.lastRender()).frame.params;

test.describe("frame panel", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Cadre").click();
  });

  test("lists every frame of the catalog, in order, with a thumbnail each", async ({ openApp }) => {
    await expect(openApp.page.locator(".grid .thumb img")).toHaveCount(7);

    await expect.poll(() => openApp.count("frame_thumbnails")).toBe(1);
    const [request] = await openApp.calls("frame_thumbnails");
    const frames = request?.args.frames as { id: string }[];
    expect(frames.map((frame) => frame.id)).toEqual([
      "none",
      "solid",
      "instant",
      "film35",
      "film120",
      "letterbox",
      "padding",
    ]);
  });

  test("shows only the shapes, the caption and the library without a frame", async ({
    openApp,
  }) => {
    await expect(section(openApp, "Forme")).toBeVisible();
    await expect(section(openApp, "Légende")).toBeVisible();
    await expect(section(openApp, "Mes cadres")).toBeVisible();
    await expect(section(openApp, "Pellicule")).toHaveCount(0);
    await expect(section(openApp, "Réglages")).toHaveCount(0);
  });

  test("builds its controls from the manifest of the chosen frame", async ({ openApp }) => {
    await shape(openApp, "35 mm").click();

    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("film35");
    expect(await frameParams(openApp)).toMatchObject({
      stock: "amber",
      width: 14,
      color: "#120f0c",
      sprockets: true,
      text: "PORTRAIT 400",
      frameNumber: "24A",
    });
    await expect(section(openApp, "Pellicule")).toBeVisible();
    await expect(section(openApp, "Réglages")).toBeVisible();
    await expect(openApp.page.getByRole("button", { name: "Sans marquages" })).toBeVisible();
    await expect(openApp.page.getByRole("slider", { name: "Épaisseur" })).toBeVisible();
    await expect(openApp.page.getByText("Perforations")).toBeVisible();
    await expect(openApp.page.getByText("Texte pellicule")).toBeVisible();
  });

  test("leaves room for the focus ring of a field that touches the section edge", async ({
    openApp,
  }) => {
    const field = openApp.page.getByPlaceholder("Biarritz, août 2026");
    await field.focus();

    const room = await field.evaluate((input) => {
      let clip = input.parentElement;
      while (clip && getComputedStyle(clip).overflow !== "hidden") clip = clip.parentElement;
      if (!clip) return null;
      const inner = input.getBoundingClientRect();
      const outer = clip.getBoundingClientRect();
      return {
        left: inner.left - outer.left,
        right: outer.right - inner.right,
        top: inner.top - outer.top,
        bottom: outer.bottom - inner.bottom,
      };
    });

    expect(room).not.toBeNull();
    for (const side of Object.values(room ?? {})) expect(side).toBeGreaterThanOrEqual(4);
  });

  test("keeps the caption when the frame changes", async ({ openApp }) => {
    const caption = openApp.page.getByPlaceholder("Biarritz, août 2026");
    await caption.fill("Salut");

    await shape(openApp, "35 mm").click();
    await shape(openApp, "Marge unie").click();

    await expect(caption).toHaveValue("Salut");
  });

  test("choosing a film stock applies the values it imposes", async ({ openApp }) => {
    await shape(openApp, "35 mm").click();
    await openApp.page.getByRole("button", { name: "Vert", exact: true }).click();

    await expect
      .poll(async () => frameParams(openApp))
      .toMatchObject({
        stock: "green",
        color: "#0d1210",
        ink: "#6fce8a",
        text: "VERT VIF 400",
      });
  });

  test("refreshes the thumbnails with the chosen stock", async ({ openApp }) => {
    await expect.poll(() => openApp.count("frame_thumbnails")).toBe(1);
    await shape(openApp, "35 mm").click();

    await openApp.page.getByRole("button", { name: "Vert", exact: true }).click();

    await expect
      .poll(async () => {
        const last = (await openApp.calls("frame_thumbnails")).at(-1);
        const frames = last?.args.frames as { id: string; params: { stock?: string } }[];
        return frames
          .filter((frame) => frame.id.startsWith("film"))
          .map((film) => film.params.stock);
      })
      .toEqual(["green", "green"]);
    expect(await openApp.count("frame_thumbnails")).toBeGreaterThan(1);
  });

  test("does not request thumbnails while another tab is showing", async ({ app }) => {
    await app.openPhoto();

    await app.page.waitForTimeout(300);

    expect(await app.count("frame_thumbnails")).toBe(0);
  });

  test("remembers the film stock from one frame to the next, and across a detour", async ({
    openApp,
  }) => {
    await shape(openApp, "35 mm").click();
    await openApp.page.getByRole("button", { name: "Vert", exact: true }).click();

    await shape(openApp, "Moyen format").click();
    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("film120");
    expect(await frameParams(openApp)).toMatchObject({ stock: "green", color: "#0d1210" });

    await shape(openApp, "Marge unie").click();
    await shape(openApp, "35 mm").click();
    await expect.poll(async () => frameParams(openApp)).toMatchObject({ stock: "green" });
  });

  test("resets the settings that do not persist when the frame changes", async ({ openApp }) => {
    await shape(openApp, "35 mm").click();
    const width = openApp.page.getByRole("slider", { name: "Épaisseur" });
    await width.focus();
    await openApp.press("ArrowRight", 20);

    await shape(openApp, "Moyen format").click();

    await expect.poll(async () => (await frameParams(openApp)).width).toBe(10);
  });

  test("hides a setting that the manifest marks as hidden", async ({ openApp }) => {
    await shape(openApp, "Moyen format").click();

    await expect(openApp.page.getByText("Texte pellicule")).toBeVisible();
    await expect(openApp.page.getByText("Perforations")).toHaveCount(0);
  });

  test("hides the printing settings, and their text zones, for a film without markings", async ({
    openApp,
  }) => {
    await shape(openApp, "35 mm").click();
    await expect(openApp.page.locator(".zone")).toHaveCount(3);

    await openApp.page.getByRole("button", { name: "Sans marquages" }).click();

    await expect(openApp.page.getByText("Texte pellicule")).toHaveCount(0);
    await expect(openApp.page.getByText("Numéro de vue")).toHaveCount(0);
    await expect(openApp.page.getByText("Marquages", { exact: true })).toHaveCount(0);
    await expect(openApp.page.getByText("Support")).toBeVisible();
    await expect(openApp.page.locator(".zone")).toHaveCount(1);
  });

  test("clicking a text zone on the image edits that setting", async ({ openApp }) => {
    await shape(openApp, "35 mm").click();
    await expect(openApp.page.locator(".zone")).toHaveCount(3);

    await openApp.page.locator(".zone").first().click();
    await openApp.page.keyboard.type("TEST ZONE");

    await expect.poll(async () => (await frameParams(openApp)).text).toMatch(/TEST ZONE$/);
    await openApp.page.keyboard.press("Escape");
    await expect(openApp.page.locator(".zone-editor")).toHaveCount(0);
  });

  test("only shows the clickable zones in the Frame tab", async ({ openApp }) => {
    await shape(openApp, "35 mm").click();
    await expect(openApp.page.locator(".zone")).toHaveCount(3);

    await openApp.tab("Looks").click();

    await expect(openApp.page.locator(".zone")).toHaveCount(0);
  });

  test("offers a menu for a choice that is not a list", async ({ openApp }) => {
    await shape(openApp, "Cinéma").click();
    await expect.poll(async () => frameParams(openApp)).toMatchObject({ ratio: "239" });

    await openApp.page.getByRole("combobox").first().click();
    await expect(openApp.page.getByRole("option")).toHaveCount(4);
    await openApp.page.getByRole("option", { name: "16:9" }).click();

    await expect.poll(async () => (await frameParams(openApp)).ratio).toBe("178");
  });

  test("shows the unit of a number setting", async ({ openApp }) => {
    await shape(openApp, "Format réseaux").click();

    await expect(openApp.page.locator(".slider", { hasText: "Marge" })).toContainText("4.0 %");
  });

  test("the frame proposes its own caption style", async ({ openApp }) => {
    await openApp.page.getByPlaceholder("Biarritz, août 2026").fill("Été");
    await shape(openApp, "Instantané").click();
    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("button", { name: "Enregistrer…" }).click();

    await expect.poll(async () => (await openApp.lastExport())?.frame.id).toBe("instant");
    const { caption } = await openApp.lastExport();
    expect(caption).toMatchObject({ text: "Été", font: "handwritten", size: 5, color: "#23262b" });
  });

  test("reset brings back no frame and an empty caption, and can be undone", async ({
    openApp,
  }) => {
    const caption = openApp.page.getByPlaceholder("Biarritz, août 2026");
    await caption.fill("Bonjour");
    await shape(openApp, "35 mm").click();
    await openApp.waitForHistoryCommit();
    const reset = openApp.page.getByRole("button", { name: "Réinitialiser" });
    await expect(reset).toBeEnabled();

    await reset.click();

    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("none");
    await expect(caption).toHaveValue("");
    await expect(reset).toBeDisabled();

    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await openApp.page.keyboard.press("Meta+z");

    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("film35");
    await expect(caption).toHaveValue("Bonjour");
  });
});

test.describe("importing frames", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await section(openApp, "Mes cadres").click();
  });

  test("starts with no imported frame", async ({ openApp }) => {
    await expect(openApp.page.getByText("Aucun cadre importé pour l'instant.")).toBeVisible();
  });

  test("imports an archive and a folder, and lists them with the others", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Importer un .zip" }).click();
    await expect
      .poll(async () => (await openApp.calls("import_frame")).at(-1)?.args.path)
      .toBe("/fake/my-frame.zip");
    await expect(shape(openApp, "Cadre zip")).toHaveCount(1);
    await expect(openApp.page.locator(".list").getByText("Cadre zip")).toBeVisible();

    await openApp.page.getByRole("button", { name: "Importer un dossier" }).click();
    await expect
      .poll(async () => (await openApp.calls("import_frame")).at(-1)?.args.path)
      .toBe("/fake/my-frame-folder");
    await expect(openApp.page.locator(".grid .thumb")).toHaveCount(9);
  });

  test("an imported frame is chosen and configured like the built-in ones", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Importer un .zip" }).click();

    await shape(openApp, "Cadre zip").click();

    await expect
      .poll(async () => (await openApp.lastRender()).frame)
      .toEqual({
        id: "imported-zip",
        params: { width: 5 },
      });
  });

  test("removing the chosen frame falls back to no frame", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Importer un .zip" }).click();
    await shape(openApp, "Cadre zip").click();

    await openApp.page.getByRole("button", { name: "Supprimer le cadre Cadre zip" }).click();

    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("none");
    await expect(shape(openApp, "Cadre zip")).toHaveCount(0);
    expect((await openApp.calls("remove_frame")).at(-1)?.args.id).toBe("imported-zip");
  });

  test("imports a dropped .zip, and opens a dropped photo instead of importing it", async ({
    openApp,
  }) => {
    const opened = await openApp.count("open_image");

    await openApp.emit("tauri://drag-drop", {
      paths: ["/fake/dropped-frame.zip"],
      position: { x: 0, y: 0 },
    });
    await expect
      .poll(async () => (await openApp.calls("import_frame")).at(-1)?.args.path)
      .toBe("/fake/dropped-frame.zip");
    expect(await openApp.count("open_image")).toBe(opened);

    await openApp.emit("tauri://drag-drop", {
      paths: ["/fake/photo.jpg"],
      position: { x: 0, y: 0 },
    });
    await expect.poll(() => openApp.count("open_image")).toBe(opened + 1);
    expect(await openApp.count("import_frame")).toBe(1);
  });

  test("shows why an import was refused", async ({ openApp }) => {
    await openApp.emit("tauri://drag-drop", { paths: ["/fake/bad.zip"], position: { x: 0, y: 0 } });

    await expect(openApp.page.locator("p.error")).toContainText("manifeste invalide");
  });

  test("reports frames that failed to load, with the cause", async ({ openApp }) => {
    await openApp.page.evaluate(() => {
      (window as unknown as { __issues: unknown }).__issues = [
        { folder: "mon-cadre", message: "SVG invalide : repère photo manquant" },
      ];
    });

    await openApp.page.getByRole("button", { name: "Recharger" }).click();

    await expect(openApp.page.locator(".issues")).toContainText("repère photo manquant");
  });

  test("opens the frames folder", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Ouvrir le dossier" }).click();

    await expect.poll(() => openApp.count("open_frames_folder")).toBe(1);
  });
});

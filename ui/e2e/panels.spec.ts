import { expect, test, type App } from "./support/app";

test.use({ openPanels: false });

const header = (app: App, name: string) =>
  app.page.getByRole("button", { name: new RegExp(`^${name}( Modifié)?$`) });

const resetButton = (app: App, section: string) =>
  app.page.getByRole("button", { name: `Réinitialiser cette section : ${section}` });

const resetGroup = (app: App, group: string) =>
  app.page.getByRole("button", { name: `Réinitialiser ce groupe : ${group}` });

const expanded = async (app: App, name: string) =>
  (await header(app, name).getAttribute("aria-expanded")) === "true";

const slider = (app: App, name: string) => app.page.getByRole("slider", { name, exact: true });

test.describe("the Retouche panel", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Retouche").click();
  });

  test("shows one group at a time, colour tools together", async ({ openApp }) => {
    const sectionsOf = async (group: string) => {
      await openApp.group(group);
      return openApp.page
        .getByRole("region", { name: "Réglages" })
        .locator("button[aria-expanded]")
        .evaluateAll((buttons) =>
          buttons
            .filter((button) => button.getClientRects().length > 0)
            .map((button) => button.textContent?.trim()),
        );
    };

    expect(await sectionsOf("Tons")).toEqual(["Lumière", "Courbe des tons"]);
    expect(await sectionsOf("Couleurs")).toEqual([
      "Couleur",
      "Mélangeur de couleurs",
      "Étalonnage",
    ]);
    expect(await sectionsOf("Finition")).toEqual(["Détail", "Effets"]);
  });

  test("starts on the first group, with its sections unfolded", async ({ openApp }) => {
    expect(await expanded(openApp, "Lumière")).toBe(true);
    expect(await expanded(openApp, "Courbe des tons")).toBe(true);
    await expect(slider(openApp, "Exposition")).toBeVisible();
    await expect(slider(openApp, "Netteté")).toBeHidden();
  });

  test("another group replaces the first one, with its own sections unfolded", async ({
    openApp,
  }) => {
    await openApp.group("Finition");

    await expect(slider(openApp, "Netteté")).toBeVisible();
    expect(await expanded(openApp, "Détail")).toBe(true);
    expect(await expanded(openApp, "Effets")).toBe(true);
    await expect(slider(openApp, "Exposition")).toBeHidden();
  });

  test("a click on a group's icon unfolds what had been folded there", async ({ openApp }) => {
    await header(openApp, "Lumière").click();
    expect(await expanded(openApp, "Lumière")).toBe(false);

    await openApp.group("Tons");

    expect(await expanded(openApp, "Lumière")).toBe(true);
    await expect(slider(openApp, "Exposition")).toBeVisible();
  });

  test("marks a section whose setting has moved, even when it is folded", async ({ openApp }) => {
    await expect(openApp.page.locator(".modified")).toHaveCount(0);

    await openApp.group("Finition");
    await slider(openApp, "Grain").focus();
    await openApp.press("ArrowRight", 20);
    await expect(header(openApp, "Effets")).toHaveAccessibleName("Effets Modifié");

    await header(openApp, "Effets").click();

    await expect(openApp.page.getByRole("button", { name: "Effets Modifié" })).toBeVisible();
    await expect(header(openApp, "Détail")).toHaveAccessibleName("Détail");
  });

  test("resets one section only, in a single undo step", async ({ openApp }) => {
    await slider(openApp, "Exposition").focus();
    await openApp.press("ArrowRight", 30);
    await slider(openApp, "Contraste").focus();
    await openApp.press("ArrowRight", 20);
    await openApp.group("Couleurs");
    await slider(openApp, "Saturation").first().focus();
    await openApp.press("ArrowRight", 10);
    await openApp.group("Tons");
    await openApp.waitForHistoryCommit();

    await resetButton(openApp, "Lumière").click();

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ exposure: 0, contrast: 0, saturation: 0.1 });
    await expect(resetButton(openApp, "Lumière")).toHaveCount(0);
    await openApp.waitForHistoryCommit();

    await openApp.page.keyboard.press("ControlOrMeta+z");

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ exposure: 0.3, contrast: 0.2, saturation: 0.1 });
  });

  test("resets a whole group, and only that one", async ({ openApp }) => {
    await expect(resetGroup(openApp, "Tons")).toBeDisabled();
    await slider(openApp, "Exposition").focus();
    await openApp.press("ArrowRight", 30);
    await openApp.group("Couleurs");
    await slider(openApp, "Saturation").first().focus();
    await openApp.press("ArrowRight", 10);
    await openApp.group("Tons");
    await expect(resetGroup(openApp, "Tons")).toBeEnabled();

    await resetGroup(openApp, "Tons").click();

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ exposure: 0, saturation: 0.1 });
    await expect(resetGroup(openApp, "Tons")).toBeDisabled();
    await openApp.group("Couleurs");
    await expect(resetGroup(openApp, "Couleurs")).toBeEnabled();
  });

  test("a group reset also flattens the curves of that group", async ({ openApp }) => {
    const graph = openApp.page.locator(".graph");
    await graph.scrollIntoViewIfNeeded();
    const box = await graph.boundingBox();
    if (!box) throw new Error("graphique introuvable");
    await openApp.page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
    await expect.poll(async () => (await openApp.lastRender()).params.curves.rgb.length).toBe(3);

    await resetGroup(openApp, "Tons").click();

    await expect.poll(async () => (await openApp.lastRender()).params.curves.rgb).toEqual([]);
  });

  test("offers a section reset only for a section that has changed", async ({ openApp }) => {
    await expect(
      openApp.page.getByRole("button", { name: /Réinitialiser cette section/ }),
    ).toHaveCount(0);

    await slider(openApp, "Exposition").focus();
    await openApp.press("ArrowRight", 5);

    await expect(
      openApp.page.getByRole("button", { name: /Réinitialiser cette section/ }),
    ).toHaveCount(1);
    await expect(resetButton(openApp, "Lumière")).toBeVisible();
  });

  test("marks and resets the colour mixer too", async ({ openApp }) => {
    await openApp.openSection("Mélangeur de couleurs");
    const mixer = openApp.page.locator(".mixer");
    await mixer.getByRole("radio", { name: "Vert" }).click();
    await mixer.getByRole("slider", { name: "Saturation" }).focus();
    await openApp.press("ArrowRight", 40);
    await expect(header(openApp, "Mélangeur de couleurs")).toHaveAccessibleName(
      "Mélangeur de couleurs Modifié",
    );

    await resetButton(openApp, "Mélangeur de couleurs").click();

    await expect.poll(async () => (await openApp.lastRender()).params.greenSaturation).toBe(0);
    await expect(header(openApp, "Mélangeur de couleurs")).toHaveAccessibleName(
      "Mélangeur de couleurs",
    );
  });
});

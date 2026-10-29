import { expect, test, type App } from "./support/app";

test.use({ openPanels: false });

const header = (app: App, name: string) =>
  app.page.getByRole("button", { name: new RegExp(`^${name}( Modifié)?$`) });

const resetButton = (app: App, group: string) =>
  app.page.getByRole("button", { name: `Réinitialiser cette section : ${group}` });

const expanded = async (app: App, name: string) =>
  (await header(app, name).getAttribute("aria-expanded")) === "true";

test.describe("the Retouche panel", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Retouche").click();
  });

  test("lists its sections under three headings, colour tools together", async ({ openApp }) => {
    const layout = await openApp.page.locator(".part").evaluateAll((parts) =>
      parts.map((part) => ({
        title: part.querySelector(".part-title")?.textContent,
        sections: [...part.querySelectorAll("button[aria-expanded]")].map((button) =>
          button.textContent?.trim(),
        ),
      })),
    );

    expect(layout).toEqual([
      { title: "Tons", sections: ["Lumière", "Courbe des tons"] },
      { title: "Couleurs", sections: ["Couleur", "Mélangeur de couleurs", "Étalonnage"] },
      { title: "Finition", sections: ["Détail", "Effets"] },
    ]);
  });

  test("opens the basics and keeps the advanced sections closed", async ({ openApp }) => {
    expect(await expanded(openApp, "Lumière")).toBe(true);
    expect(await expanded(openApp, "Couleur")).toBe(true);
    for (const name of ["Mélangeur de couleurs", "Étalonnage", "Détail", "Effets"]) {
      expect(await expanded(openApp, name), name).toBe(false);
    }
    await expect(openApp.page.getByRole("slider", { name: "Exposition" })).toBeVisible();
    await expect(openApp.page.getByRole("slider", { name: "Netteté", exact: true })).toBeHidden();
  });

  test("remembers which sections are open, across a reload", async ({ openApp }) => {
    await header(openApp, "Détail").click();
    await header(openApp, "Lumière").click();

    await openApp.page.reload();
    await openApp.openPhoto();
    await openApp.tab("Retouche").click();

    expect(await expanded(openApp, "Détail")).toBe(true);
    expect(await expanded(openApp, "Lumière")).toBe(false);
    expect(await expanded(openApp, "Effets")).toBe(false);
  });

  test("marks a section whose setting has moved, even when it is closed", async ({ openApp }) => {
    await expect(openApp.page.locator(".modified")).toHaveCount(0);

    await header(openApp, "Effets").click();
    await openApp.page.getByRole("slider", { name: "Grain", exact: true }).focus();
    await openApp.press("ArrowRight", 20);
    await expect(header(openApp, "Effets")).toHaveAccessibleName("Effets Modifié");

    await header(openApp, "Effets").click();

    await expect(openApp.page.getByRole("button", { name: "Effets Modifié" })).toBeVisible();
    await expect(header(openApp, "Lumière")).toHaveAccessibleName("Lumière");
  });

  test("resets one section only, in a single undo step", async ({ openApp }) => {
    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.press("ArrowRight", 30);
    await openApp.page.getByRole("slider", { name: "Contraste" }).focus();
    await openApp.press("ArrowRight", 20);
    await openApp.page.getByRole("slider", { name: "Saturation", exact: true }).focus();
    await openApp.press("ArrowRight", 10);
    await openApp.waitForHistoryCommit();

    await resetButton(openApp, "Lumière").click();

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ exposure: 0, contrast: 0, saturation: 0.1 });
    await expect(resetButton(openApp, "Lumière")).toHaveCount(0);
    await expect(resetButton(openApp, "Couleur")).toBeVisible();
    await openApp.waitForHistoryCommit();

    await openApp.page.keyboard.press("ControlOrMeta+z");

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ exposure: 0.3, contrast: 0.2, saturation: 0.1 });
  });

  test("offers a reset only for a section that has changed", async ({ openApp }) => {
    await expect(
      openApp.page.getByRole("button", { name: /Réinitialiser cette section/ }),
    ).toHaveCount(0);

    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
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

test.describe("the other panels", () => {
  test("remember their sections too", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await openApp.page.getByRole("button", { name: "Légende", exact: true }).click();

    await openApp.page.reload();
    await openApp.openPhoto();
    await openApp.tab("Cadre").click();

    await expect(
      openApp.page.getByRole("button", { name: "Légende", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(openApp.page.getByRole("button", { name: "Forme", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

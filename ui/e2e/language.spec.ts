import { expect, test, type App } from "./support/app";

const html = (app: App) => app.page.evaluate(() => document.documentElement.lang);

async function chooseLanguage(app: App, name: "Français" | "English") {
  await app.page.getByRole("button", { name: "Menu" }).click();
  await app.page.getByRole("menuitemradio", { name }).click();
}

test.describe("language", () => {
  test("is French on a French system", async ({ app }) => {
    expect(await html(app)).toBe("fr");
    await expect(app.page.getByText("Dépose une photo ici")).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Ouvrir…" })).toBeVisible();
  });

  test.describe("on an English system", () => {
    test.use({ locale: "en-US" });

    test("starts in English, the tabs included", async ({ openApp }) => {
      expect(await html(openApp)).toBe("en");
      await expect(openApp.tab("Preset")).toBeVisible();
      await expect(openApp.tab("Edit")).toBeVisible();
      await expect(openApp.tab("Frame")).toBeVisible();
      await expect(openApp.page.getByRole("button", { name: "Export…" })).toBeVisible();
      await expect(openApp.page.getByRole("button", { name: "Undo" })).toBeVisible();
    });

    test("speaks English before a photo is opened too", async ({ app }) => {
      await expect(app.page.getByText("Drop a photo here")).toBeVisible();
    });
  });

  test("switches from the menu, translating the dialogs and the tooltips, and remembers it", async ({
    openApp,
  }) => {
    await chooseLanguage(openApp, "English");

    expect(await html(openApp)).toBe("en");
    await expect(openApp.tab("Edit")).toBeVisible();
    await openApp.page.getByRole("button", { name: "Export…" }).click();
    await expect(openApp.page.getByRole("dialog", { name: "Export" })).toBeVisible();
    await openApp.page.keyboard.press("Escape");

    await openApp.page.reload();
    expect(await html(openApp)).toBe("en");
    await expect(openApp.page.getByRole("button", { name: "Open…" })).toBeVisible();

    await chooseLanguage(openApp, "Français");
    await expect(openApp.page.getByRole("button", { name: "Ouvrir…" })).toBeVisible();
  });

  test("the menu shows the current language as checked", async ({ app }) => {
    await app.page.getByRole("button", { name: "Menu" }).click();

    await expect(app.page.getByRole("menuitemradio", { name: "Français" })).toBeChecked();
    await expect(app.page.getByRole("menuitemradio", { name: "English" })).not.toBeChecked();
  });
});

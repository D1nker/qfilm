import { expect, test, type App } from "./support/app";

const html = (app: App) => app.page.evaluate(() => document.documentElement.lang);

const choice = (app: App, name: string) => app.page.getByRole("radio", { name });

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

  test("switches from the preferences bar, translating dialogs, and remembers it", async ({
    openApp,
  }) => {
    await choice(openApp, "English").click();

    expect(await html(openApp)).toBe("en");
    await expect(openApp.tab("Edit")).toBeVisible();
    await openApp.page.getByRole("button", { name: "Export…" }).click();
    await expect(openApp.page.getByRole("dialog", { name: "Export" })).toBeVisible();
    await openApp.page.keyboard.press("Escape");

    await openApp.page.reload();
    expect(await html(openApp)).toBe("en");
    await expect(openApp.page.getByRole("button", { name: "Open…" })).toBeVisible();

    await choice(openApp, "Français").click();
    await expect(openApp.page.getByRole("button", { name: "Ouvrir…" })).toBeVisible();
  });

  test("shows the current language as checked", async ({ app }) => {
    await expect(choice(app, "Français")).toBeChecked();
    await expect(choice(app, "English")).not.toBeChecked();
  });
});

test.describe("looks and frames", () => {
  test("show their French names on a French system", async ({ openApp }) => {
    await expect(openApp.page.getByRole("button", { name: "Doré 200" })).toBeVisible();
    await expect(openApp.page.getByRole("button", { name: "Négatif couleur" })).toBeVisible();
  });

  test.describe("on an English system", () => {
    test.use({ locale: "en-US" });

    test("show their English names, categories and descriptions", async ({ openApp }) => {
      await expect(openApp.page.getByRole("button", { name: "Golden 200" })).toBeVisible();
      await expect(openApp.page.getByRole("button", { name: "Color negative" })).toBeVisible();
      await expect(openApp.page.getByRole("button", { name: /Neutral/ })).toBeVisible();

      await openApp.page.getByRole("button", { name: "Golden 200" }).hover();
      await expect(openApp.page.getByRole("tooltip")).toHaveText("Description of Golden 200");
    });

    test("show the frames in English, down to the settings of a frame", async ({ openApp }) => {
      await openApp.tab("Frame").click();
      await expect(openApp.page.locator(".grid .thumb", { hasText: "None" })).toBeVisible();
      await expect(openApp.page.locator(".grid .thumb", { hasText: "Solid margin" })).toBeVisible();

      await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();
      await expect(
        openApp.page.getByRole("button", { name: "Film stock", exact: true }),
      ).toBeVisible();
      await expect(openApp.page.getByRole("button", { name: "Plain white" })).toBeVisible();
      await expect(openApp.page.getByRole("slider", { name: "Thickness" })).toBeVisible();
      await expect(openApp.page.getByText("Sprocket holes")).toBeVisible();
    });
  });

  test("follow a language change without reloading", async ({ openApp }) => {
    await openApp.page.getByRole("radio", { name: "English" }).click();

    await expect(openApp.page.getByRole("button", { name: "Golden 200" })).toBeVisible();
    await expect(openApp.page.getByRole("button", { name: "Doré 200" })).toHaveCount(0);

    await openApp.tab("Frame").click();
    await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();
    await expect(openApp.page.getByRole("slider", { name: "Thickness" })).toBeVisible();

    await openApp.page.getByRole("radio", { name: "Français" }).click();
    await expect(openApp.page.getByRole("slider", { name: "Épaisseur" })).toBeVisible();
  });

  test("keep the text a look gives to a frame in the language it was chosen in", async ({
    openApp,
  }) => {
    await openApp.page.getByRole("radio", { name: "English" }).click();
    await openApp.tab("Frame").click();
    await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();

    await openApp.tab("Preset").click();
    await openApp.page.getByRole("button", { name: "Golden 200" }).click();
    await expect
      .poll(async () => (await openApp.lastRender()).frame.params.text)
      .toBe("GOLDEN 200");
  });
});

test.describe("preferences bar", () => {
  const bar = (app: App) => app.page.getByRole("group", { name: "Préférences" });

  test("is there before any photo, as compact icon and code buttons", async ({ app }) => {
    await expect(bar(app)).toBeVisible();
    await expect(app.page.getByRole("radio")).toHaveCount(4);
    await expect(choice(app, "Français")).toHaveText("FR");
    await expect(choice(app, "English")).toHaveText("EN");
    await expect(choice(app, "Sombre")).toHaveText("");
  });

  test("the checked choice looks different from the others", async ({ app }) => {
    const background = (name: string) =>
      choice(app, name).evaluate((element) => getComputedStyle(element).backgroundColor);

    expect(await background("Français")).not.toBe("rgba(0, 0, 0, 0)");
    expect(await background("English")).toBe("rgba(0, 0, 0, 0)");
  });

  test("moves between the choices with the keyboard", async ({ app }) => {
    await choice(app, "Français").focus();
    await app.page.keyboard.press("ArrowRight");
    await app.page.keyboard.press("Space");

    await expect(choice(app, "English")).toBeChecked();
  });

  test("sits on the toolbar line without touching the photo", async ({ openApp }) => {
    const box = (selector: string) =>
      openApp.page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const { top, bottom, left, right } = element.getBoundingClientRect();
          return { top, bottom, left, right };
        });
    const preferences = await box('[role="group"][aria-label="Préférences"]');
    const toolbar = await box('[role="toolbar"]');
    const photo = await box("main img");

    expect(Math.abs(preferences.bottom - toolbar.bottom)).toBeLessThanOrEqual(2);
    expect(preferences.top).toBeGreaterThanOrEqual(photo.bottom);
    expect(preferences.right).toBeLessThan(toolbar.left);
  });
});

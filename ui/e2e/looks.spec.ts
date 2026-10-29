import type { Page } from "@playwright/test";
import { expect, test } from "./support/app";

test.describe("looks", () => {
  test("the intensity slider is disabled until a look is chosen", async ({ openApp }) => {
    const intensity = openApp.page.getByRole("slider", { name: "Intensité" });
    await expect(intensity).toHaveAttribute("data-disabled", "");

    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();

    await expect(intensity).not.toHaveAttribute("data-disabled");
  });

  test("a look is rendered with its parameters", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ exposure: 1, contrast: -0.4, grainSize: 4 });
    await expect(openApp.page.locator(".thumb.active")).toContainText("Portrait 400");
  });

  test("the intensity scales the look between neutral and itself", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();
    const intensity = openApp.page.getByRole("slider", { name: "Intensité" });
    await intensity.focus();
    await openApp.press("ArrowLeft", 50);

    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.5);
    const params = (await openApp.lastRender()).params;
    expect(params.contrast).toBeCloseTo(-0.2);
    expect(params.grainSize).toBeCloseTo(3);
  });

  test("manual adjustments sit on top of the look and survive an intensity change", async ({
    openApp,
  }) => {
    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();
    await openApp.page.getByRole("slider", { name: "Intensité" }).focus();
    await openApp.press("ArrowLeft", 50);

    await openApp.tab("Retouche").click();
    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.press("ArrowRight", 10);
    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.6);

    await openApp.tab("Preset").click();
    await openApp.page.getByRole("slider", { name: "Intensité" }).focus();
    await openApp.press("ArrowRight", 50);

    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(1.1);
  });

  test("double-clicking a slider resets it to zero", async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.press("ArrowRight", 30);
    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.3);

    await openApp.page.locator(".slider", { hasText: "Exposition" }).locator(".root").dblclick();

    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBe(0);
  });

  test("double-clicking a slider whose default is not zero brings back that default", async ({
    openApp,
  }) => {
    await openApp.tab("Retouche").click();
    const reset = async (label: string, key: string, moved: number, back: number) => {
      const slider = openApp.page.locator(".slider", { hasText: label });
      await slider.getByRole("slider").focus();
      await openApp.press("ArrowLeft", 3);
      await expect
        .poll(async () => (await openApp.lastRender()).params[key])
        .not.toBeCloseTo(moved, 3);

      await slider.locator(".root").dblclick();

      await expect.poll(async () => (await openApp.lastRender()).params[key]).toBeCloseTo(back, 3);
    };

    await reset("Taille du grain", "grainSize", 2, 2);
    await reset("Rugosité du grain", "grainRoughness", 1, 1);
    await reset("Progressivité du vignettage", "vignetteFeather", 0.5, 0.5);
    await reset("Rayon de la netteté", "sharpenRadius", 1, 1);
  });

  test.describe("colour mixer", () => {
    test.beforeEach(async ({ openApp }) => {
      await openApp.tab("Retouche").click();
      await openApp.openSection("Mélangeur de couleurs");
    });

    const mixer = (app: { page: Page }) => app.page.locator(".mixer");

    test("offers the eight colours, with hue, saturation and luminance for the chosen one", async ({
      openApp,
    }) => {
      for (const name of [
        "Rouge",
        "Orange",
        "Jaune",
        "Vert",
        "Cyan",
        "Bleu",
        "Violet",
        "Magenta",
      ]) {
        await expect(mixer(openApp).getByRole("radio", { name })).toBeVisible();
      }
      await expect(mixer(openApp).getByRole("radio", { name: "Rouge" })).toBeChecked();
      for (const name of ["Teinte", "Saturation", "Luminosité"]) {
        await expect(mixer(openApp).getByRole("slider", { name })).toBeVisible();
      }
    });

    test("adjusts the chosen colour only, and remembers each colour's settings", async ({
      openApp,
    }) => {
      await mixer(openApp).getByRole("radio", { name: "Vert" }).click();
      await mixer(openApp).getByRole("slider", { name: "Saturation" }).focus();
      await openApp.press("ArrowRight", 40);
      await mixer(openApp).getByRole("radio", { name: "Bleu" }).click();
      await mixer(openApp).getByRole("slider", { name: "Luminosité" }).focus();
      await openApp.press("ArrowLeft", 30);

      await expect
        .poll(async () => (await openApp.lastRender()).params)
        .toMatchObject({ greenSaturation: 0.4, blueLuminance: -0.3, redHue: 0, redSaturation: 0 });

      await mixer(openApp).getByRole("radio", { name: "Bleu" }).click();
      await mixer(openApp).getByRole("slider", { name: "Teinte" }).focus();
      await openApp.press("ArrowRight", 40);
      await expect(mixer(openApp).locator(".slider", { hasText: "Teinte" })).toContainText("+12°");

      await mixer(openApp).getByRole("radio", { name: "Vert" }).click();
      await expect(mixer(openApp).locator(".slider", { hasText: "Saturation" })).toContainText(
        "0.40",
      );
    });

    test("marks the colours that have a setting, and a double-click clears it", async ({
      openApp,
    }) => {
      const green = mixer(openApp).getByRole("radio", { name: "Vert" });
      await expect(green).not.toHaveClass(/marked/);

      await green.click();
      await mixer(openApp).getByRole("slider", { name: "Teinte" }).focus();
      await openApp.press("ArrowRight", 20);
      await expect(green).toHaveClass(/marked/);

      await mixer(openApp).locator(".slider", { hasText: "Teinte" }).locator(".root").dblclick();
      await expect(green).not.toHaveClass(/marked/);
      await expect.poll(async () => (await openApp.lastRender()).params.greenHue).toBe(0);
    });

    test("the reset button clears the mixer too", async ({ openApp }) => {
      await mixer(openApp).getByRole("radio", { name: "Jaune" }).click();
      await mixer(openApp).getByRole("slider", { name: "Luminosité" }).focus();
      await openApp.press("ArrowRight", 50);
      await expect
        .poll(async () => (await openApp.lastRender()).params.yellowLuminance)
        .toBeCloseTo(0.5);

      await openApp.page.getByRole("button", { name: "Réinitialiser", exact: true }).click();

      await expect.poll(async () => (await openApp.lastRender()).params.yellowLuminance).toBe(0);
    });
  });

  test.describe("coloured tracks", () => {
    const track = (app: { page: Page }, label: string) =>
      app.page.locator(".slider", { hasText: label }).first().locator(".track");
    const background = (app: { page: Page }, label: string) =>
      track(app, label).evaluate((element) => getComputedStyle(element).backgroundImage);

    test.beforeEach(async ({ openApp }) => {
      await openApp.tab("Retouche").click();
    });

    test("show blue to yellow for the temperature and green to magenta for the tint", async ({
      openApp,
    }) => {
      expect(await background(openApp, "Température")).toContain("linear-gradient");
      expect(await background(openApp, "Teinte vert / magenta")).toContain("linear-gradient");

      // Déplacé, pour que le remplissage aurait une largeur s'il était dessiné.
      await openApp.page.getByRole("slider", { name: "Température" }).focus();
      await openApp.press("ArrowRight", 40);
      await expect(track(openApp, "Température").locator(".fill")).toBeHidden();
    });

    test("leave an ordinary slider with its plain track and its fill", async ({ openApp }) => {
      expect(await background(openApp, "Exposition")).toBe("none");
      await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
      await openApp.press("ArrowRight", 20);
      await expect(track(openApp, "Exposition").locator(".fill")).toBeVisible();
    });

    test("make the grading saturation follow the hue of the zone being graded", async ({
      openApp,
    }) => {
      await openApp.openSection("Étalonnage");
      const grading = openApp.page.locator(".grading");
      const saturation = () =>
        grading
          .locator(".slider", { hasText: "Saturation" })
          .locator(".track")
          .evaluate((element) => getComputedStyle(element).backgroundImage);
      const shadows = await saturation();

      await grading.getByRole("slider", { name: "Teinte" }).focus();
      await openApp.press("ArrowRight", 120);
      await expect.poll(saturation).not.toBe(shadows);
      const warmed = await saturation();

      await grading.getByRole("radio", { name: "Tons moyens" }).click();

      expect(await saturation()).not.toBe(warmed);
    });

    test("make the mixer tracks follow the colour being adjusted", async ({ openApp }) => {
      await openApp.openSection("Mélangeur de couleurs");
      const mixer = openApp.page.locator(".mixer");
      const saturation = () =>
        mixer
          .locator(".slider", { hasText: "Saturation" })
          .locator(".track")
          .evaluate((element) => getComputedStyle(element).backgroundImage);
      const red = await saturation();

      await mixer.getByRole("radio", { name: "Bleu" }).click();

      expect(await saturation()).not.toBe(red);
      expect(await saturation()).toContain("linear-gradient");
    });
  });

  test("groups sharpening and noise reduction under Detail", async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    const detail = openApp.page.getByRole("button", { name: "Détail", exact: true });
    await expect(detail).toBeVisible();

    for (const name of [
      "Netteté",
      "Rayon de la netteté",
      "Bruit de luminance",
      "Bruit de couleur",
    ]) {
      await expect(openApp.page.getByRole("slider", { name, exact: true })).toBeVisible();
    }

    await openApp.page.getByRole("slider", { name: "Netteté", exact: true }).focus();
    await openApp.press("ArrowRight", 60);
    await openApp.page.getByRole("slider", { name: "Bruit de couleur" }).focus();
    await openApp.press("ArrowRight", 25);

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ sharpening: 0.6, noiseColor: 0.25, sharpenRadius: 1 });
  });

  test("offers the vignette midpoint and feather and the grain roughness", async ({ openApp }) => {
    await openApp.tab("Retouche").click();

    for (const name of [
      "Rugosité du grain",
      "Étendue du vignettage",
      "Progressivité du vignettage",
    ]) {
      await expect(openApp.page.getByRole("slider", { name })).toBeVisible();
    }

    await openApp.page.getByRole("slider", { name: "Étendue du vignettage" }).focus();
    await openApp.press("ArrowRight", 40);
    await expect
      .poll(async () => (await openApp.lastRender()).params.vignetteMidpoint)
      .toBeCloseTo(0.4);
  });

  test("shows signed values with units on the sliders", async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    const exposure = openApp.page.locator(".slider", { hasText: "Exposition" });
    await exposure.getByRole("slider").focus();
    await openApp.press("ArrowRight", 25);

    await expect(exposure).toContainText("+0.25 EV");
  });

  test("the reset button brings back a neutral look", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();
    await openApp.tab("Retouche").click();

    await openApp.page.getByRole("button", { name: "Réinitialiser", exact: true }).click();

    await expect
      .poll(async () => (await openApp.lastRender()).params)
      .toMatchObject({ exposure: 0, contrast: 0, grainSize: 2 });
    await openApp.tab("Preset").click();
    await expect(openApp.page.locator(".thumb.active")).toContainText("Neutre");
  });

  test("choosing a look names the film stock printed on the frame", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();
    await openApp.tab("Preset").click();

    await openApp.page.getByRole("button", { name: "Doré 200" }).click();

    await expect.poll(async () => (await openApp.lastRender()).frame.params.text).toBe("DORÉ 200");
  });
});

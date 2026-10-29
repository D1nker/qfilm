import { expect, test, type App } from "./support/app";

const slider = (app: App, label: string) => app.page.locator(".slider", { hasText: label }).first();

const valueButton = (app: App, label: string) => slider(app, label).locator("button.value");

const editor = (app: App, label: string) =>
  app.page.getByRole("textbox", { name: `Valeur de ${label}` });

const edit = async (app: App, label: string, text: string, key = "Enter") => {
  await valueButton(app, label).click();
  await editor(app, label).fill(text);
  await editor(app, label).press(key);
};

test.describe("typing a slider value", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.tab("Retouche").click();
  });

  test("opens on a click on the value, with the number selected", async ({ openApp }) => {
    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.press("ArrowRight", 25);

    await valueButton(openApp, "Exposition").click();

    await expect(editor(openApp, "Exposition")).toBeFocused();
    await expect(editor(openApp, "Exposition")).toHaveValue("0.25");
  });

  test("applies what was typed on Enter", async ({ openApp }) => {
    await edit(openApp, "Exposition", "0.5");

    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.5);
    await expect(valueButton(openApp, "Exposition")).toContainText("+0.50 EV");
    await expect(editor(openApp, "Exposition")).toHaveCount(0);
  });

  test("understands a decimal comma and a pasted unit", async ({ openApp }) => {
    await edit(openApp, "Exposition", "0,25");
    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.25);

    await edit(openApp, "Exposition", "-1,5 EV");
    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(-1.5);
  });

  test("keeps the value within the slider's range", async ({ openApp }) => {
    await edit(openApp, "Exposition", "9");
    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBe(3);

    await openApp.group("Finition");
    await edit(openApp, "Rayon de la netteté", "0");
    await expect.poll(async () => (await openApp.lastRender()).params.sharpenRadius).toBe(0.5);
  });

  test("ignores something that is not a number", async ({ openApp }) => {
    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.press("ArrowRight", 30);
    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.3);

    await edit(openApp, "Exposition", "abc");

    await expect(editor(openApp, "Exposition")).toHaveCount(0);
    expect((await openApp.lastRender()).params.exposure).toBeCloseTo(0.3);
  });

  test("Escape cancels without changing anything", async ({ openApp }) => {
    await edit(openApp, "Exposition", "2", "Escape");

    await expect(editor(openApp, "Exposition")).toHaveCount(0);
    expect((await openApp.lastRender()).params.exposure).toBe(0);
  });

  test("leaving the field applies what was typed", async ({ openApp }) => {
    await valueButton(openApp, "Contraste").click();
    await editor(openApp, "Contraste").fill("0.4");

    await editor(openApp, "Contraste").press("Tab");

    await expect.poll(async () => (await openApp.lastRender()).params.contrast).toBeCloseTo(0.4);
  });

  test("can be opened from the keyboard, with Enter on the slider", async ({ openApp }) => {
    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.page.keyboard.press("Enter");

    await expect(editor(openApp, "Exposition")).toBeFocused();
    await editor(openApp, "Exposition").fill("1.2");
    await editor(openApp, "Exposition").press("Enter");

    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(1.2);
  });

  test("takes the displayed unit for the mixer hue, in degrees", async ({ openApp }) => {
    await openApp.openSection("Mélangeur de couleurs");
    const hue = openApp.page.locator(".mixer .slider", { hasText: "Teinte" });

    await hue.locator("button.value").click();
    await openApp.page.getByRole("textbox", { name: "Valeur de Teinte" }).fill("15");
    await openApp.page.keyboard.press("Enter");

    await expect.poll(async () => (await openApp.lastRender()).params.redHue).toBeCloseTo(0.5);
    await expect(hue.locator("button.value")).toContainText("+15°");
  });

  test("does not draw a draft for a typed value", async ({ openApp }) => {
    await edit(openApp, "Exposition", "0.7");

    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.7);
    const calls = await openApp.calls("render_preview");
    expect(calls.at(-1)?.args.draft).toBe(false);
  });
});

test.describe("typing the look intensity", () => {
  test("is in percent, and a disabled slider cannot be edited", async ({ openApp }) => {
    await expect(valueButton(openApp, "Intensité")).toBeDisabled();

    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();
    await edit(openApp, "Intensité", "50");

    await expect(valueButton(openApp, "Intensité")).toContainText("50 %");
    await expect.poll(async () => (await openApp.lastRender()).params.exposure).toBeCloseTo(0.5);
  });
});

test.describe("typing in a dialog", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("dialog").waitFor();
  });

  test("Escape cancels the edit without applying it", async ({ openApp }) => {
    await edit(openApp, "Qualité", "70", "Escape");

    await expect(editor(openApp, "Qualité")).toHaveCount(0);
    await expect(valueButton(openApp, "Qualité")).toContainText("92 %");
  });

  // Le dialogue se ferme sur un Échap que personne n'a consommé : vérifier qu'il l'est, plutôt que
  // d'attendre qu'un dialogue « reste ouvert », ce qu'une animation de fermeture rend ambigu.
  test("Escape is consumed by the editor, so the dialog does not close with it", async ({
    openApp,
  }) => {
    await openApp.page.evaluate(() => {
      const record = window as unknown as { __escapePrevented?: boolean };
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") record.__escapePrevented = event.defaultPrevented;
      });
    });

    await edit(openApp, "Qualité", "70", "Escape");

    const consumed = await openApp.page.evaluate(
      () => (window as unknown as { __escapePrevented?: boolean }).__escapePrevented,
    );
    expect(consumed).toBe(true);
    await expect(openApp.page.getByRole("dialog")).toBeVisible();
  });

  test("Escape closes the dialog when no value is being edited", async ({ openApp }) => {
    await openApp.page.keyboard.press("Escape");

    await expect(openApp.page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("slider layout", () => {
  const rows = async (app: App) =>
    app.page
      .locator(".slider")
      .first()
      .evaluate((slider) => {
        const label = slider.querySelector(".row > span")?.getBoundingClientRect();
        const track = slider.querySelector(".root")?.getBoundingClientRect();
        const value = slider.querySelector(".value")?.getBoundingClientRect();
        return { label, track, value };
      });

  test.describe("in a wide panel", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("the name, the track and the value share one line", async ({ openApp }) => {
      await openApp.tab("Retouche").click();

      const { label, track, value } = await rows(openApp);

      expect(Math.abs((label?.top ?? 0) - (track?.top ?? 99))).toBeLessThan(12);
      expect(track?.left ?? 0).toBeGreaterThan(label?.right ?? Infinity);
      expect(value?.left ?? 0).toBeGreaterThanOrEqual(track?.right ?? Infinity);
      expect(track?.width ?? 0).toBeGreaterThan(130);
    });
  });

  test.describe("in a narrow panel", () => {
    test.use({ viewport: { width: 1200, height: 800 } });

    test("the track goes under the name and the value", async ({ openApp }) => {
      await openApp.tab("Retouche").click();

      const { label, track } = await rows(openApp);

      expect(track?.top ?? 0).toBeGreaterThan(label?.bottom ?? Infinity);
    });
  });
});

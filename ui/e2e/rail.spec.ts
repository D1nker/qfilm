import { expect, test, type App } from "./support/app";

const rail = (app: App) => app.page.getByRole("navigation");
const item = (app: App, name: string) =>
  rail(app).getByRole("button", { name: `Aller à ${name}`, exact: true });
const panel = (app: App) => app.page.getByRole("region", { name: "Réglages" });

test.describe("the group rail", () => {
  test("is one rail for the whole panel: the looks, then Retouche, then Cadre", async ({
    openApp,
  }) => {
    await expect(rail(openApp).getByRole("button")).toHaveCount(10);
    for (const name of [
      "Négatif couleur",
      "Noir & blanc",
      "Tons",
      "Couleurs",
      "Finition",
      "Masques",
    ]) {
      await expect(item(openApp, name)).toBeVisible();
    }
    await expect(rail(openApp).locator('[data-section="looks"]')).toHaveCount(2);
    await expect(rail(openApp).locator('[data-section="adjust"]')).toHaveCount(4);
    await expect(rail(openApp).locator('[data-section="frame"]')).toHaveCount(4);
  });

  test("separates its three groups with a thin line", async ({ openApp }) => {
    await expect(rail(openApp).locator(".divider")).toHaveCount(2);
  });

  test("lists the Retouche groups, the first one being shown", async ({ openApp }) => {
    await openApp.tab("Retouche").click();

    await expect(item(openApp, "Tons")).toHaveAttribute("aria-current", "true");
    await expect(item(openApp, "Finition")).not.toHaveAttribute("aria-current");
    await expect(openApp.page.getByRole("slider", { name: "Exposition" })).toBeVisible();
  });

  test("a click shows that group alone, and marks it", async ({ openApp }) => {
    await openApp.tab("Retouche").click();

    await item(openApp, "Finition").click();

    await expect(item(openApp, "Finition")).toHaveAttribute("aria-current", "true");
    await expect(item(openApp, "Tons")).not.toHaveAttribute("aria-current");
    await expect(openApp.page.getByRole("slider", { name: "Netteté", exact: true })).toBeVisible();
    await expect(openApp.page.getByRole("slider", { name: "Exposition" })).toBeHidden();
  });

  test.describe("in a short window, where the panel scrolls", () => {
    test.use({ viewport: { width: 1280, height: 480 } });

    test("a new group starts at its top", async ({ openApp }) => {
      await openApp.tab("Retouche").click();
      await panel(openApp).evaluate((element) => (element.scrollTop = element.scrollHeight));
      expect(await panel(openApp).evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

      await item(openApp, "Couleurs").click();

      await expect.poll(() => panel(openApp).evaluate((element) => element.scrollTop)).toBe(0);
    });

    test("stays on screen while the panel scrolls", async ({ openApp }) => {
      await openApp.tab("Retouche").click();

      await panel(openApp).evaluate((element) => (element.scrollTop = element.scrollHeight));
      expect(await panel(openApp).evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

      await expect(item(openApp, "Tons")).toBeInViewport();
    });
  });

  test("going to a page of another section hides the previous one, and back again", async ({
    openApp,
  }) => {
    await item(openApp, "Finition").click();
    await expect(openApp.page.getByRole("slider", { name: "Netteté", exact: true })).toBeVisible();

    await item(openApp, "Légende").click();
    await expect(openApp.page.getByRole("slider", { name: "Netteté", exact: true })).toHaveCount(0);
    await expect(openApp.page.getByPlaceholder("Biarritz, août 2026")).toBeVisible();

    await item(openApp, "Finition").click();
    await expect(openApp.page.getByRole("slider", { name: "Netteté", exact: true })).toBeVisible();
    await expect(openApp.page.getByPlaceholder("Biarritz, août 2026")).toHaveCount(0);
  });

  test.describe("with the keyboard", () => {
    test("only the shown page is in the tab order, so Tab goes on to the content", async ({
      openApp,
    }) => {
      await item(openApp, "Couleurs").click();

      await expect(item(openApp, "Couleurs")).toHaveAttribute("tabindex", "0");
      await expect(item(openApp, "Tons")).toHaveAttribute("tabindex", "-1");
      await expect(item(openApp, "Légende")).toHaveAttribute("tabindex", "-1");
    });

    test("the arrows go to the next and previous page, and show it", async ({ openApp }) => {
      await item(openApp, "Tons").click();

      await openApp.page.keyboard.press("ArrowDown");
      await expect(item(openApp, "Couleurs")).toHaveAttribute("aria-current", "true");
      await expect(item(openApp, "Couleurs")).toBeFocused();
      await expect(openApp.page.getByRole("slider", { name: "Exposition" })).toBeHidden();

      await openApp.page.keyboard.press("ArrowUp");
      await expect(item(openApp, "Tons")).toHaveAttribute("aria-current", "true");
      await expect(item(openApp, "Tons")).toBeFocused();
    });

    test("they cross from one group to the next", async ({ openApp }) => {
      await item(openApp, "Masques").click();

      await openApp.page.keyboard.press("ArrowDown");

      await expect(item(openApp, "Recadrage")).toHaveAttribute("aria-current", "true");
      await expect(openApp.page.getByRole("button", { name: "Recadrer" })).toBeVisible();
    });

    test("they wrap around, and Home and End jump to the ends", async ({ openApp }) => {
      await item(openApp, "Mes cadres").click();
      await openApp.page.keyboard.press("ArrowDown");
      await expect(item(openApp, "Négatif couleur")).toHaveAttribute("aria-current", "true");

      await openApp.page.keyboard.press("ArrowUp");
      await expect(item(openApp, "Mes cadres")).toHaveAttribute("aria-current", "true");

      await openApp.page.keyboard.press("Home");
      await expect(item(openApp, "Négatif couleur")).toBeFocused();

      await openApp.page.keyboard.press("End");
      await expect(item(openApp, "Mes cadres")).toBeFocused();
    });

    test("arrows unfold a page's sections like a click does", async ({ openApp }) => {
      await item(openApp, "Tons").click();
      await openApp.page.getByRole("button", { name: /^Lumière/ }).click();
      await expect(openApp.page.getByRole("button", { name: /^Lumière/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      await item(openApp, "Tons").focus();
      await openApp.page.keyboard.press("ArrowDown");
      await openApp.page.keyboard.press("ArrowUp");

      await expect(openApp.page.getByRole("button", { name: /^Lumière/ })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
  });

  test("the Frame tab has its own: the crop, the frame, the caption and the library", async ({
    openApp,
  }) => {
    await openApp.tab("Cadre").click();

    for (const name of ["Recadrage", "Cadre", "Légende", "Mes cadres"]) {
      await expect(item(openApp, name)).toBeVisible();
    }
    await expect(item(openApp, "Cadre")).toHaveAttribute("aria-current", "true");

    await item(openApp, "Légende").click();

    await expect(openApp.page.getByPlaceholder("Biarritz, août 2026")).toBeVisible();
    await expect(openApp.page.locator(".grid .thumb").first()).toBeHidden();
    await expect(item(openApp, "Légende")).toHaveAttribute("aria-current", "true");
  });

  test("R opens the crop and shows its group, whatever was shown", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await item(openApp, "Légende").click();
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await openApp.page.keyboard.press("r");

    await expect(item(openApp, "Recadrage")).toHaveAttribute("aria-current", "true");
    await expect(openApp.page.getByRole("button", { name: "Terminer le recadrage" })).toBeVisible();
  });

  test.describe("the Preset tab", () => {
    test("has one icon per look category, and opens on the first one", async ({ openApp }) => {
      await openApp.tab("Preset").click();

      await expect(rail(openApp).locator('[data-section="looks"]')).toHaveCount(2);
      for (const name of ["Négatif couleur", "Noir & blanc"]) {
        await expect(item(openApp, name)).toBeVisible();
      }
      await expect(item(openApp, "Négatif couleur")).toHaveAttribute("aria-current", "true");
      await expect(openApp.page.getByRole("button", { name: "Portrait 400" })).toBeVisible();
    });

    test("does not offer the neutral look: Reset is how to get back to it", async ({ openApp }) => {
      await openApp.tab("Preset").click();

      await expect(item(openApp, "Base")).toHaveCount(0);
      await expect(openApp.page.getByRole("button", { name: /Neutre|Neutral/ })).toHaveCount(0);
    });

    test("a click shows that category alone, the intensity staying below", async ({ openApp }) => {
      await openApp.tab("Preset").click();

      await item(openApp, "Noir & blanc").click();

      await expect(openApp.page.getByRole("button", { name: "Classique 400" })).toBeVisible();
      await expect(openApp.page.getByRole("button", { name: "Portrait 400" })).toBeHidden();
      await expect(openApp.page.getByRole("slider", { name: "Intensité" })).toBeVisible();
    });
  });

  test.describe("the dot on an icon", () => {
    const marked = (app: App, name: string) =>
      expect(item(app, name)).toHaveAccessibleDescription(/Modifié|Look appliqué/);
    const unmarked = (app: App, name: string) =>
      expect(item(app, name)).not.toHaveAccessibleDescription(/Modifié|Look appliqué/);

    test("tells which Retouche page has moved, from any page", async ({ openApp }) => {
      await openApp.tab("Retouche").click();
      for (const name of ["Tons", "Couleurs", "Finition"]) await unmarked(openApp, name);

      await item(openApp, "Finition").click();
      await openApp.page.getByRole("slider", { name: "Grain", exact: true }).focus();
      await openApp.press("ArrowRight", 10);
      await item(openApp, "Tons").click();

      await marked(openApp, "Finition");
      await unmarked(openApp, "Tons");
      await unmarked(openApp, "Couleurs");

      await item(openApp, "Finition").click();
      await openApp.page
        .getByRole("button", { name: "Réinitialiser ce groupe : Finition" })
        .click();
      await unmarked(openApp, "Finition");
    });

    test("a curve counts for the Tons page", async ({ openApp }) => {
      await openApp.tab("Retouche").click();
      const box = await openApp.page.locator(".graph").boundingBox();
      if (!box) throw new Error("graphique introuvable");

      await openApp.page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);

      await marked(openApp, "Tons");
    });

    test("tells what the Frame tab holds: a crop, a frame, a caption", async ({ openApp }) => {
      await openApp.tab("Cadre").click();
      for (const name of ["Recadrage", "Cadre", "Légende"]) await unmarked(openApp, name);

      await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();
      await marked(openApp, "Cadre");

      await item(openApp, "Légende").click();
      await openApp.page.getByPlaceholder("Biarritz, août 2026").fill("Salut");
      await marked(openApp, "Légende");

      await item(openApp, "Recadrage").click();
      await openApp.page.getByRole("button", { name: "Pivoter à droite" }).click();
      await marked(openApp, "Recadrage");
    });

    test("shows, in the Preset tab, which category the applied look is in", async ({ openApp }) => {
      await openApp.tab("Preset").click();
      for (const name of ["Négatif couleur", "Noir & blanc"]) await unmarked(openApp, name);

      await item(openApp, "Noir & blanc").click();
      await openApp.page.getByRole("button", { name: "Classique 400" }).click();
      await item(openApp, "Négatif couleur").click();

      await marked(openApp, "Noir & blanc");
      await unmarked(openApp, "Négatif couleur");
    });
  });

  test("every page of every tab starts with a title", async ({ openApp }) => {
    for (const tab of ["Preset", "Retouche", "Cadre"] as const) {
      await openApp.tab(tab).click();
      const names = await rail(openApp)
        .getByRole("button")
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));

      for (const name of names) {
        await openApp.page.getByRole("button", { name: name ?? "", exact: true }).click();

        await expect(
          openApp.page.getByRole("region", { name: "Réglages" }).getByRole("heading").first(),
          `${tab} › ${name}`,
        ).toBeVisible();
      }
    }
  });
});

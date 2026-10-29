import { expect, test, type App } from "./support/app";

const rail = (app: App) => app.page.getByRole("navigation");
const item = (app: App, name: string) =>
  rail(app).getByRole("button", { name: `Aller à ${name}`, exact: true });
const panel = (app: App) => app.page.getByRole("tabpanel");

test.describe("the group rail", () => {
  test("lists the Retouche groups, the first one being shown", async ({ openApp }) => {
    await openApp.tab("Retouche").click();

    await expect(rail(openApp).getByRole("button")).toHaveCount(3);
    for (const name of ["Tons", "Couleurs", "Finition"]) {
      await expect(item(openApp, name)).toBeVisible();
    }
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

  test("keeps the chosen group when another tab is visited", async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    await item(openApp, "Finition").click();

    await openApp.tab("Cadre").click();
    await openApp.tab("Retouche").click();

    await expect(item(openApp, "Finition")).toHaveAttribute("aria-current", "true");
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

      await expect(rail(openApp).getByRole("button")).toHaveCount(2);
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

    test("keeps the category that was looked at last", async ({ openApp }) => {
      await openApp.tab("Preset").click();
      await item(openApp, "Noir & blanc").click();
      await openApp.page.getByRole("button", { name: "Classique 400" }).click();

      await openApp.tab("Cadre").click();
      await openApp.tab("Preset").click();

      await expect(item(openApp, "Noir & blanc")).toHaveAttribute("aria-current", "true");
      await expect(openApp.page.getByRole("button", { name: "Classique 400" })).toBeVisible();
    });
  });
});

import { expect, test, type App } from "./support/app";

const rail = (app: App) => app.page.getByRole("navigation");
const item = (app: App, name: string) =>
  rail(app).getByRole("button", { name: `Aller à ${name}`, exact: true });
const panel = (app: App) => app.page.getByRole("tabpanel");

/// Fait défiler à la main (sans la rampe) jusqu'à ce qu'un groupe touche le haut du panneau.
const scrollToGroup = (app: App, id: string) =>
  panel(app).evaluate((element, group) => {
    const target = element.querySelector(`[data-rail="${group}"]`);
    if (!target) throw new Error(`groupe ${group} introuvable`);
    element.scrollTop += target.getBoundingClientRect().top - element.getBoundingClientRect().top;
  }, id);

/// Attend la fin du défilement animé : cinq images de suite sans bouger.
const scrollSettled = (app: App) =>
  panel(app).evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        let last = element.scrollTop;
        let steady = 0;
        const tick = () => {
          steady = element.scrollTop === last ? steady + 1 : 0;
          last = element.scrollTop;
          if (steady >= 5) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

const scrolled = (app: App) => panel(app).evaluate((element) => element.scrollTop);

test.describe("the group rail", () => {
  test("lists the Retouche groups, the first one being current", async ({ openApp }) => {
    await openApp.tab("Retouche").click();

    await expect(rail(openApp).getByRole("button")).toHaveText(["", "", ""]);
    for (const name of ["Tons", "Couleurs", "Finition"]) {
      await expect(item(openApp, name)).toBeVisible();
    }
    await expect(item(openApp, "Tons")).toHaveAttribute("aria-current", "true");
    await expect(item(openApp, "Finition")).not.toHaveAttribute("aria-current");
  });

  test("a click takes the panel to that group and marks it current", async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    expect(await scrolled(openApp)).toBe(0);

    await item(openApp, "Finition").click();

    await expect.poll(() => scrolled(openApp)).toBeGreaterThan(300);
    await expect(item(openApp, "Finition")).toHaveAttribute("aria-current", "true");
    await expect(item(openApp, "Tons")).not.toHaveAttribute("aria-current");
    await expect(openApp.page.getByRole("button", { name: /^Détail/ })).toBeInViewport();
  });

  test("follows the scrolling by hand", async ({ openApp }) => {
    await openApp.tab("Retouche").click();

    await scrollToGroup(openApp, "color");
    await expect(item(openApp, "Couleurs")).toHaveAttribute("aria-current", "true");

    await panel(openApp).evaluate((element) => (element.scrollTop = element.scrollHeight));
    await expect(item(openApp, "Finition")).toHaveAttribute("aria-current", "true");

    await panel(openApp).evaluate((element) => (element.scrollTop = 0));
    await expect(item(openApp, "Tons")).toHaveAttribute("aria-current", "true");
  });

  test("stays on screen while the panel scrolls", async ({ openApp }) => {
    await openApp.tab("Retouche").click();

    await panel(openApp).evaluate((element) => (element.scrollTop = 900));

    await expect(item(openApp, "Tons")).toBeInViewport();
  });

  test("the Frame tab has its own, with the crop, the frame, the caption and the library", async ({
    openApp,
  }) => {
    await openApp.tab("Cadre").click();

    for (const name of ["Recadrage", "Cadre", "Légende", "Mes cadres"]) {
      await expect(item(openApp, name)).toBeVisible();
    }

    await item(openApp, "Légende").click();

    await expect(openApp.page.getByPlaceholder("Biarritz, août 2026")).toBeInViewport();
    await expect(item(openApp, "Légende")).toHaveAttribute("aria-current", "true");
  });

  test("the Preset tab has none: its categories are few and fit on one screen", async ({
    openApp,
  }) => {
    await openApp.tab("Preset").click();

    await expect(rail(openApp)).toHaveCount(0);
  });

  test("hands the highlight back to the scrolling as soon as the user scrolls", async ({
    openApp,
  }) => {
    await openApp.tab("Cadre").click();
    await item(openApp, "Légende").click();
    await expect(item(openApp, "Légende")).toHaveAttribute("aria-current", "true");
    await scrollSettled(openApp);

    const box = await panel(openApp).boundingBox();
    if (!box) throw new Error("panneau introuvable");
    await openApp.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await openApp.page.mouse.wheel(0, -3000);

    await expect(item(openApp, "Recadrage")).toHaveAttribute("aria-current", "true");
  });

  test("keeps up when sections close, the first group being current once everything fits", async ({
    openApp,
  }) => {
    await openApp.tab("Retouche").click();
    await panel(openApp).evaluate((element) => (element.scrollTop = element.scrollHeight));
    await expect(item(openApp, "Finition")).toHaveAttribute("aria-current", "true");

    // Tout replier raccourcit le panneau sans que rien ne défile : il tient alors en entier.
    const open = panel(openApp).locator('button[aria-expanded="true"]');
    for (let guard = 0; guard < 20 && (await open.count()) > 0; guard++) {
      await open.first().click();
    }

    await expect
      .poll(() =>
        panel(openApp).evaluate((element) => element.scrollHeight <= element.clientHeight),
      )
      .toBe(true);
    await expect(item(openApp, "Tons")).toHaveAttribute("aria-current", "true");
  });
});

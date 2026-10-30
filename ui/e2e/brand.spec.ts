import { expect, test, type App } from "./support/app";

test.describe("the brand in the header", () => {
  const brand = (app: App) => app.page.getByRole("button", { name: "Menu" });

  test("is the logo alone, loaded: it is a q, so a written qFilm beside it would stutter", async ({
    app,
  }) => {
    const mark = brand(app).locator("img.mark");

    await expect(mark).toBeVisible();
    expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(mark).toHaveAttribute("alt", "");
    await expect(brand(app)).toHaveText("");
  });

  test("keeps its size, and still names itself for assistive technology and on hover", async ({
    app,
  }) => {
    const box = await brand(app).locator("img.mark").boundingBox();
    expect(box?.width).toBe(28);
    expect(box?.height).toBe(28);

    await brand(app).hover();
    await expect(app.page.getByRole("tooltip")).toHaveText("Menu");
  });

  test("still opens the menu", async ({ app }) => {
    await brand(app).click();

    await expect(app.page.getByRole("menu")).toBeVisible();
  });
});

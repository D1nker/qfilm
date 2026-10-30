import { expect, test } from "./support/app";

test.describe("the brand in the header", () => {
  test("shows the logo next to the wordmark, loaded, and keeps the menu's name", async ({
    app,
  }) => {
    const brand = app.page.getByRole("button", { name: "Menu" });
    const mark = brand.locator("img.mark");

    await expect(mark).toBeVisible();
    expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(brand).toContainText("qFilm");
    await expect(mark).toHaveAttribute("alt", "");
  });

  test("the logo sits on the same line as the wordmark and keeps its size", async ({ app }) => {
    const brand = app.page.getByRole("button", { name: "Menu" });
    const [mark, word] = await Promise.all([
      brand.locator("img.mark").boundingBox(),
      brand.locator(".wordmark").boundingBox(),
    ]);

    expect(mark?.width).toBe(22);
    expect(mark?.height).toBe(22);
    expect(Math.abs((mark?.y ?? 0) + 11 - ((word?.y ?? 0) + (word?.height ?? 0) / 2))).toBeLessThan(
      3,
    );
    expect(mark?.x ?? 99).toBeLessThan(word?.x ?? 0);
  });
});

import { expect, test } from "./support/app";

test.describe("keyboard", () => {
  test("Tab moves between the menus instead of hiding the panel", async ({ openApp }) => {
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await openApp.page.keyboard.press("Tab");

    expect(await openApp.page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    await expect(openApp.page.locator("aside")).toBeVisible();
  });

  test("Space still activates a button reached with the keyboard", async ({ openApp }) => {
    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await openApp.page.keyboard.press("Shift+Tab");
    for (let i = 0; i < 20; i++) {
      const label = await openApp.page.evaluate(() => document.activeElement?.textContent?.trim());
      if (label === "Exporter…") break;
      await openApp.page.keyboard.press("Shift+Tab");
    }
    await openApp.page.keyboard.press("Space");

    await expect(openApp.page.getByRole("dialog")).toBeVisible();
  });

  test("Space moves the photo instead of re-triggering a button that was just clicked", async ({
    app,
  }) => {
    await app.openPhoto();
    const opened = await app.count("open_image");

    await app.page.mouse.move(500, 400);
    await app.page.keyboard.down("Space");
    await app.page.keyboard.up("Space");

    expect(await app.count("open_image")).toBe(opened);
  });
});

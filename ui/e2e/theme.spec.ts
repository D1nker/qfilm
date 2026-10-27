import { expect, test, type App } from "./support/app";

const theme = (app: App) => app.page.evaluate(() => document.documentElement.dataset.theme);

test.describe("theme", () => {
  test("is dark by default", async ({ app }) => {
    expect(await theme(app)).toBe("dark");
  });

  test("switches from the preferences, and remembers the choice", async ({ app }) => {
    await app.choose("Clair");
    expect(await theme(app)).toBe("light");

    await app.page.reload();
    expect(await theme(app)).toBe("light");

    await app.choose("Sombre");
    expect(await theme(app)).toBe("dark");
  });

  test("shows the current theme as checked", async ({ app }) => {
    await app.preferencesButton.click();

    await expect(app.page.getByRole("radio", { name: "Sombre" })).toBeChecked();
    await expect(app.page.getByRole("radio", { name: "Clair" })).not.toBeChecked();
  });
});

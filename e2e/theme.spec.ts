import { expect, test, type App } from "./support/app";

const theme = (app: App) => app.page.evaluate(() => document.documentElement.dataset.theme);

async function chooseTheme(app: App, name: "Sombre" | "Clair") {
  await app.page.getByRole("button", { name: "Menu" }).click();
  await app.page.getByRole("menuitemradio", { name }).click();
}

test.describe("theme", () => {
  test("is dark by default", async ({ app }) => {
    expect(await theme(app)).toBe("dark");
  });

  test("switches from the menu, and remembers the choice", async ({ app }) => {
    await chooseTheme(app, "Clair");
    expect(await theme(app)).toBe("light");

    await app.page.reload();
    expect(await theme(app)).toBe("light");

    await chooseTheme(app, "Sombre");
    expect(await theme(app)).toBe("dark");
  });

  test("the menu shows the current theme as checked", async ({ app }) => {
    await app.page.getByRole("button", { name: "Menu" }).click();

    await expect(app.page.getByRole("menuitemradio", { name: "Sombre" })).toBeChecked();
    await expect(app.page.getByRole("menuitemradio", { name: "Clair" })).not.toBeChecked();
  });
});

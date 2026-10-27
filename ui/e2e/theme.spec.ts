import { expect, test, type App } from "./support/app";

const theme = (app: App) => app.page.evaluate(() => document.documentElement.dataset.theme);

const choice = (app: App, name: "Sombre" | "Clair") => app.page.getByRole("radio", { name });

test.describe("theme", () => {
  test("is dark by default", async ({ app }) => {
    expect(await theme(app)).toBe("dark");
  });

  test("switches from the preferences bar, and remembers the choice", async ({ app }) => {
    await choice(app, "Clair").click();
    expect(await theme(app)).toBe("light");

    await app.page.reload();
    expect(await theme(app)).toBe("light");

    await choice(app, "Sombre").click();
    expect(await theme(app)).toBe("dark");
  });

  test("shows the current theme as checked", async ({ app }) => {
    await expect(choice(app, "Sombre")).toBeChecked();
    await expect(choice(app, "Clair")).not.toBeChecked();
  });
});

import type { Page } from "@playwright/test";

import { expect, test } from "./support/app";

const theme = (app: { page: Page }) =>
  app.page.evaluate(() => document.documentElement.dataset.theme);

test.describe("theme", () => {
  test("is dark by default", async ({ app }) => {
    expect(await theme(app)).toBe("dark");
  });

  test("switches between dark and light, and remembers the choice", async ({ app }) => {
    await app.page.getByRole("button", { name: "Passer en thème clair" }).click();
    expect(await theme(app)).toBe("light");

    await app.page.reload();
    expect(await theme(app)).toBe("light");

    await app.page.getByRole("button", { name: "Passer en thème sombre" }).click();
    expect(await theme(app)).toBe("dark");
  });
});

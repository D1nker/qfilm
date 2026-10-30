import { expect, test } from "./support/app";

test.describe("opening a photo", () => {
  test("opens a photo from the header button", async ({ app }) => {
    await app.page.getByRole("button", { name: "Ouvrir…" }).click();

    await expect(app.photo).toBeVisible();
    await expect(app.page.getByText("3600 × 2400 px")).toBeVisible();
  });

  test("opens a photo from the empty drop zone", async ({ app }) => {
    await app.page.getByRole("button", { name: /Dépose une photo ici/ }).click();

    await expect(app.photo).toBeVisible();
  });

  test("asks for the look thumbnails after the photo, never before", async ({ app }) => {
    await app.page.getByRole("button", { name: "Ouvrir…" }).click();
    await app.photo.waitFor();

    await expect.poll(() => app.count("preset_thumbnails")).toBe(1);
    const order = (await app.calls())
      .map((call) => call.cmd)
      .filter((cmd) => ["open_image", "preset_thumbnails"].includes(cmd));
    expect(order).toEqual(["open_image", "preset_thumbnails"]);
  });

  test("shows one thumbnail per look, the neutral one apart", async ({ openApp }) => {
    // Le faux pont sert quatre looks, dont « Neutre », que la liste ne propose pas.
    await expect(openApp.page.locator(".thumb img")).toHaveCount(3);
  });

  test("opens a dropped photo", async ({ app }) => {
    await app.emit("tauri://drag-drop", {
      paths: ["/photos/dropped.jpg"],
      position: { x: 0, y: 0 },
    });

    await expect(app.photo).toBeVisible();
    expect(await app.count("open_image")).toBe(1);
  });

  test("a failed render shows its error", async ({ openApp }) => {
    await openApp.page.evaluate(() => {
      const internals = (
        window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => unknown } }
      ).__TAURI_INTERNALS__;
      const original = internals.invoke;
      internals.invoke = (cmd, args) =>
        cmd === "render_preview"
          ? Promise.reject(new Error("cadre « x » introuvable"))
          : original(cmd, args);
    });

    await openApp.tab("Retouche").click();
    await openApp.page.getByRole("slider", { name: "Exposition" }).focus();
    await openApp.press("ArrowRight");

    await expect(openApp.page.getByRole("alert")).toContainText("cadre « x » introuvable");
  });
});

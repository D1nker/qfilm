import { expect, test } from "./support/app";

test.describe("export", () => {
  test.beforeEach(async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("dialog").waitFor();
  });

  test("offers the JPEG quality only for JPEG", async ({ openApp }) => {
    const quality = openApp.page.getByRole("slider", { name: "Qualité" });
    await expect(quality).toBeVisible();

    await openApp.page.getByRole("combobox").first().click();
    await openApp.page.getByRole("option", { name: "PNG" }).click();
    await expect(quality).toHaveCount(0);

    await openApp.page.getByRole("combobox").first().click();
    await openApp.page.getByRole("option", { name: "JPEG" }).click();
    await expect(quality).toBeVisible();
  });

  test("sends the format, quality and size to Rust", async ({ openApp }) => {
    await openApp.page.getByRole("combobox").nth(1).click();
    await openApp.page.getByRole("option", { name: "2048 px" }).click();

    await openApp.page.getByRole("button", { name: "Enregistrer…" }).click();

    await expect.poll(() => openApp.count("export_image")).toBe(1);
    const exported = await openApp.lastExport();
    expect(exported.options).toEqual({ format: "jpeg", quality: 92, maxEdge: 2048 });
    expect(exported.destination).toBe("/fake/out/IMG_0001.jpg");
    await expect(openApp.page.getByRole("dialog")).toHaveCount(0);
  });

  test("exports the chosen look, frame and caption", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Annuler" }).click();
    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();
    await openApp.tab("Cadre").click();
    await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();
    await openApp.page.getByPlaceholder("Biarritz, août 2026").fill("Hello");

    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("button", { name: "Enregistrer…" }).click();

    await expect.poll(() => openApp.count("export_image")).toBe(1);
    const exported = await openApp.lastExport();
    expect(exported.params).toMatchObject({ exposure: 1, contrast: -0.4 });
    expect(exported.frame.id).toBe("film35");
    expect(exported.caption.text).toBe("Hello");
  });

  test("closes with Escape and with Cancel without exporting", async ({ openApp }) => {
    await openApp.page.keyboard.press("Escape");
    await expect(openApp.page.getByRole("dialog")).toHaveCount(0);

    await openApp.page.getByRole("button", { name: "Exporter…" }).click();
    await openApp.page.getByRole("button", { name: "Annuler" }).click();
    await expect(openApp.page.getByRole("dialog")).toHaveCount(0);
    expect(await openApp.count("export_image")).toBe(0);
  });

  test("the dropdown is not hidden behind the dialog", async ({ openApp }) => {
    await openApp.page.getByRole("combobox").first().click();

    await expect(openApp.page.getByRole("option", { name: "TIFF 16 bits" })).toBeVisible();
    await openApp.page.getByRole("option", { name: "TIFF 16 bits" }).click();
    await expect(openApp.page.getByRole("combobox").first()).toContainText("TIFF 16 bits");
  });
});

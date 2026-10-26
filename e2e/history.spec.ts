import { expect, test, type App } from "./support/app";

const exposure = async (app: App) => (await app.lastRender()).params.exposure;
const undo = (app: App) => app.page.keyboard.press("Meta+z");
const redo = (app: App) => app.page.keyboard.press("Meta+Shift+z");
const undoButton = (app: App) => app.page.getByRole("button", { name: "Annuler", exact: true });
const redoButton = (app: App) => app.page.getByRole("button", { name: "Rétablir", exact: true });

async function adjustExposure(app: App, key: "ArrowRight" | "ArrowLeft", times: number) {
  await app.tab("Réglages").click();
  await app.page.getByRole("slider", { name: "Exposition" }).focus();
  await app.press(key, times);
}

test.describe("undo and redo", () => {
  test("start disabled", async ({ openApp }) => {
    await expect(undoButton(openApp)).toBeDisabled();
    await expect(redoButton(openApp)).toBeDisabled();
  });

  test("a whole slider gesture is a single step", async ({ openApp }) => {
    await adjustExposure(openApp, "ArrowRight", 20);
    await openApp.waitForHistoryCommit();
    await expect.poll(() => exposure(openApp)).toBeCloseTo(0.2);

    await undo(openApp);

    await expect.poll(() => exposure(openApp)).toBe(0);
    await expect(undoButton(openApp)).toBeDisabled();
  });

  test("undoes and redoes a look and a manual adjustment in order", async ({ openApp }) => {
    await openApp.page.getByRole("button", { name: "Portrait 400" }).click();
    await openApp.waitForHistoryCommit();
    await adjustExposure(openApp, "ArrowRight", 20);
    await openApp.waitForHistoryCommit();
    await expect.poll(() => exposure(openApp)).toBeCloseTo(1.2);

    await undo(openApp);
    await expect.poll(() => exposure(openApp)).toBeCloseTo(1);
    await expect(redoButton(openApp)).toBeEnabled();

    await undo(openApp);
    await expect.poll(() => exposure(openApp)).toBe(0);
    await openApp.tab("Looks").click();
    await expect(openApp.page.locator(".thumb.active")).toContainText("Neutre");

    await redo(openApp);
    await expect.poll(() => exposure(openApp)).toBeCloseTo(1);
    await redo(openApp);
    await expect.poll(() => exposure(openApp)).toBeCloseTo(1.2);
    await expect(redoButton(openApp)).toBeDisabled();
  });

  test("undo reverts a change that has not been committed yet", async ({ openApp }) => {
    await adjustExposure(openApp, "ArrowRight", 5);

    await undo(openApp);

    await expect.poll(() => exposure(openApp)).toBe(0);
    await expect(redoButton(openApp)).toBeEnabled();
  });

  test("a new change after an undo clears the redo stack", async ({ openApp }) => {
    await adjustExposure(openApp, "ArrowRight", 10);
    await openApp.waitForHistoryCommit();
    await undo(openApp);
    await expect(redoButton(openApp)).toBeEnabled();

    await adjustExposure(openApp, "ArrowLeft", 1);
    await openApp.waitForHistoryCommit();

    await expect(redoButton(openApp)).toBeDisabled();
  });

  test("the header buttons undo and redo too", async ({ openApp }) => {
    await adjustExposure(openApp, "ArrowRight", 10);
    await openApp.waitForHistoryCommit();

    await undoButton(openApp).click();
    await expect.poll(() => exposure(openApp)).toBe(0);

    await redoButton(openApp).click();
    await expect.poll(() => exposure(openApp)).toBeCloseTo(0.1);
  });

  test("leaves a text field's own undo alone", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    const caption = openApp.page.getByPlaceholder("Biarritz, août 2026");
    await caption.fill("abc");
    await openApp.waitForHistoryCommit();
    await expect(undoButton(openApp)).toBeEnabled();

    await caption.focus();
    await undo(openApp);

    await expect(redoButton(openApp)).toBeDisabled();
    await expect(undoButton(openApp)).toBeEnabled();
  });

  test("covers the frame and the caption", async ({ openApp }) => {
    await openApp.tab("Cadre").click();
    await openApp.page.locator(".grid .thumb", { hasText: "35 mm" }).click();
    await openApp.waitForHistoryCommit();
    await openApp.page.getByPlaceholder("Biarritz, août 2026").fill("Salut");
    await openApp.waitForHistoryCommit();

    await openApp.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await undo(openApp);
    await expect(openApp.page.getByPlaceholder("Biarritz, août 2026")).toHaveValue("");

    await undo(openApp);
    await expect.poll(async () => (await openApp.lastRender()).frame.id).toBe("none");
  });

  test("each photo has its own history", async ({ openApp }) => {
    await adjustExposure(openApp, "ArrowRight", 10);
    await openApp.waitForHistoryCommit();
    await expect(undoButton(openApp)).toBeEnabled();

    await openApp.page.getByRole("button", { name: "Ouvrir…" }).click();

    await expect(undoButton(openApp)).toBeDisabled();
  });
});

import { expect, test, type App } from "./support/app";

test.use({ viewport: { width: 1440, height: 900 } });

const card = (app: App) => app.page.locator("aside .card");
const resizer = (app: App) => app.page.getByRole("separator", { name: "Largeur du panneau" });

const width = async (app: App) => (await card(app).boundingBox())?.width ?? 0;

async function dragEdgeTo(app: App, x: number) {
  const box = await resizer(app).boundingBox();
  if (!box) throw new Error("poignée introuvable");
  const y = box.y + box.height / 2;
  await app.page.mouse.move(box.x + box.width / 2, y);
  await app.page.mouse.down();
  await app.page.mouse.move(x, y, { steps: 8 });
  await app.page.mouse.up();
}

test.describe("the panel width", () => {
  test("is about 30% of the window by default", async ({ openApp }) => {
    expect(await width(openApp)).toBeGreaterThan(1440 * 0.3 - 12);
    expect(await width(openApp)).toBeLessThan(1440 * 0.3 + 4);
  });

  test("follows the pointer when the edge is dragged", async ({ openApp }) => {
    const before = await width(openApp);
    const box = await resizer(openApp).boundingBox();
    if (!box) throw new Error("poignée introuvable");

    await dragEdgeTo(openApp, box.x - 100);

    await expect.poll(() => width(openApp)).toBeGreaterThan(before + 90);
    expect(await width(openApp)).toBeLessThan(before + 110);
  });

  test("has a minimum, and leaves the canvas its room", async ({ openApp }) => {
    await dragEdgeTo(openApp, 1430);
    await expect.poll(() => width(openApp)).toBe(320);

    await dragEdgeTo(openApp, 5);
    await expect.poll(() => width(openApp)).toBe(720);
    const photo = await openApp.page.locator("main").boundingBox();
    expect(photo?.width ?? 0).toBeGreaterThanOrEqual(440);
  });

  test("is remembered after a reload", async ({ openApp }) => {
    const box = await resizer(openApp).boundingBox();
    if (!box) throw new Error("poignée introuvable");
    await dragEdgeTo(openApp, box.x - 80);
    await expect.poll(() => width(openApp)).toBeGreaterThan(500);
    const chosen = await width(openApp);

    await openApp.page.reload();
    await openApp.openPhoto();

    expect(Math.abs((await width(openApp)) - chosen)).toBeLessThan(2);
  });

  test("a double-click gives the automatic width back", async ({ openApp }) => {
    const automatic = await width(openApp);
    await dragEdgeTo(openApp, 900);
    await expect.poll(async () => Math.abs((await width(openApp)) - automatic)).toBeGreaterThan(50);

    await resizer(openApp).dblclick();

    await expect.poll(async () => Math.abs((await width(openApp)) - automatic)).toBeLessThan(2);
  });

  test("moves with the arrows, Shift for bigger steps, Home for automatic", async ({ openApp }) => {
    const start = await width(openApp);
    await resizer(openApp).focus();

    await openApp.page.keyboard.press("ArrowLeft");
    await expect.poll(() => width(openApp)).toBeCloseTo(start + 16, -1);

    await openApp.page.keyboard.press("Shift+ArrowRight");
    await expect.poll(() => width(openApp)).toBeCloseTo(start + 16 - 48, -1);

    await openApp.page.keyboard.press("Home");
    await expect.poll(async () => Math.abs((await width(openApp)) - start)).toBeLessThan(2);
  });

  test("the sliders go back to two lines when the panel is made narrow", async ({ openApp }) => {
    await openApp.tab("Retouche").click();
    const track = () =>
      openApp.page
        .locator(".slider:visible")
        .first()
        .evaluate((slider) => {
          const label = slider.querySelector(".row > span")?.getBoundingClientRect();
          const root = slider.querySelector(".root")?.getBoundingClientRect();
          return (root?.top ?? 0) - (label?.top ?? 0);
        });
    expect(await track()).toBeLessThan(12);

    await dragEdgeTo(openApp, 1430);

    await expect.poll(track).toBeGreaterThan(12);
  });
});

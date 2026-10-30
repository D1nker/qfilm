import { expect, test, type App } from "./support/app";

test.use({ viewport: { width: 1440, height: 900 } });

const radios = (app: App, group: string) =>
  app.page.getByRole("radiogroup", { name: group }).getByRole("radio");

test.describe("the colour pickers", () => {
  test("the curve channels are compact chips, as wide as the graph under them", async ({
    openApp,
  }) => {
    await openApp.group("Tons");
    const picker = await openApp.page
      .getByRole("radiogroup", { name: "Canal de la courbe" })
      .boundingBox();
    const graph = await openApp.page.locator(".graph").boundingBox();

    expect(Math.abs((picker?.width ?? 0) - (graph?.width ?? 1))).toBeLessThan(2);
    expect(Math.abs((picker?.x ?? 0) - (graph?.x ?? 1))).toBeLessThan(2);
    for (const chip of await radios(openApp, "Canal de la courbe").all()) {
      expect((await chip.boundingBox())?.height ?? 99).toBeLessThanOrEqual(30);
    }
  });

  test("the eight mixer colours are round chips, spread over the width of the sliders", async ({
    openApp,
  }) => {
    await openApp.group("Couleurs");
    const chips = await radios(openApp, "Teinte à ajuster").all();
    expect(chips).toHaveLength(8);

    const boxes = await Promise.all(chips.map((chip) => chip.boundingBox()));
    for (const box of boxes) {
      expect(box?.width ?? 99).toBeLessThanOrEqual(30);
      expect(box?.height ?? 99).toBeLessThanOrEqual(30);
    }

    const mixer = await openApp.page.locator(".mixer").boundingBox();
    const [first, last] = [boxes[0], boxes[7]];
    expect(Math.abs((first?.x ?? 0) - (mixer?.x ?? 1000))).toBeLessThan(4);
    expect(
      Math.abs((last?.x ?? 0) + (last?.width ?? 0) - ((mixer?.x ?? 0) + (mixer?.width ?? 0))),
    ).toBeLessThan(4);
  });
});

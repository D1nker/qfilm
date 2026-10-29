import { beforeEach, describe, expect, it } from "vitest";

import { AUTO_WIDTH, MAX_WIDTH, MIN_WIDTH } from "@/features/inspector/panelWidth";
import { fresh } from "@/test/fresh";

async function setup() {
  const { usePanelWidth } = await fresh(() => import("@/features/inspector/usePanelWidth"));
  return usePanelWidth();
}

describe("usePanelWidth", () => {
  beforeEach(() => {
    localStorage.clear();
    window.innerWidth = 1600;
  });

  it("is automatic until the user chooses", async () => {
    const panel = await setup();

    expect(panel.chosen.value).toBeNull();
    expect(panel.cssWidth.value).toBe(AUTO_WIDTH);
  });

  it("takes a chosen width, within the bounds", async () => {
    const panel = await setup();

    panel.setWidth(500);
    expect(panel.cssWidth.value).toBe("500px");

    panel.setWidth(10);
    expect(panel.chosen.value).toBe(MIN_WIDTH);

    panel.setWidth(99999);
    expect(panel.chosen.value).toBe(MAX_WIDTH);
  });

  it("remembers the choice across sessions, and forgets it when back to automatic", async () => {
    (await setup()).setWidth(480);

    const second = await setup();
    expect(second.chosen.value).toBe(480);

    second.setWidth(null);
    expect((await setup()).chosen.value).toBeNull();
  });

  it("does not remember a width mid-gesture", async () => {
    const panel = await setup();

    panel.setWidth(450, { remember: false });

    expect(panel.chosen.value).toBe(450);
    expect((await setup()).chosen.value).toBeNull();
  });

  it("ignores a stored value that makes no sense", async () => {
    localStorage.setItem("qfilm-panel-width", "wide");

    expect((await setup()).chosen.value).toBeNull();
  });
});

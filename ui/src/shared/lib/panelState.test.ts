import { describe, expect, it } from "vitest";

import { fresh } from "@/test/fresh";

async function setup() {
  return fresh(() => import("@/shared/lib/panelState"));
}

describe("usePanelOpen", () => {
  it("uses the fallback until the user chooses", async () => {
    const { usePanelOpen } = await setup();

    expect(usePanelOpen("a", true).value).toBe(true);
    expect(usePanelOpen("b", false).value).toBe(false);
  });

  it("remembers a choice, whichever way the fallback goes", async () => {
    const { usePanelOpen } = await setup();

    usePanelOpen("detail", false).value = true;
    usePanelOpen("light", true).value = false;

    expect(usePanelOpen("detail", false).value).toBe(true);
    expect(usePanelOpen("light", true).value).toBe(false);
    expect(usePanelOpen("other", false).value).toBe(false);
  });

  it("shares the choice between the places that read it", async () => {
    const { usePanelOpen } = await setup();
    const one = usePanelOpen("shared", false);
    const two = usePanelOpen("shared", false);

    one.value = true;

    expect(two.value).toBe(true);
  });

  it("does not outlive the session: nothing is written to the browser's storage", async () => {
    const { usePanelOpen } = await setup();

    usePanelOpen("a", true).value = false;

    expect(localStorage.length).toBe(0);
  });

  it("unfolds several sections at once, whatever was chosen before", async () => {
    const { openPanels, usePanelOpen } = await setup();
    usePanelOpen("a", true).value = false;
    usePanelOpen("b", false);

    openPanels(["a", "b"]);

    expect(usePanelOpen("a", true).value).toBe(true);
    expect(usePanelOpen("b", false).value).toBe(true);
  });
});

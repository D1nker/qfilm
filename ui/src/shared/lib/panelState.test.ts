import { beforeEach, describe, expect, it } from "vitest";

import { fresh } from "@/test/fresh";

async function setup() {
  return fresh(() => import("@/shared/lib/panelState"));
}

describe("usePanelOpen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses the fallback until the user chooses", async () => {
    const { usePanelOpen } = await setup();

    expect(usePanelOpen("a", true).value).toBe(true);
    expect(usePanelOpen("b", false).value).toBe(false);
  });

  it("remembers a choice, across sessions", async () => {
    const first = await setup();
    const open = first.usePanelOpen("detail", false);
    open.value = true;

    const second = await setup();

    expect(second.usePanelOpen("detail", false).value).toBe(true);
    expect(second.usePanelOpen("other", false).value).toBe(false);
  });

  it("remembers a section closed that is open by default", async () => {
    const first = await setup();
    first.usePanelOpen("light", true).value = false;

    const second = await setup();

    expect(second.usePanelOpen("light", true).value).toBe(false);
  });

  it("shares the choice between the places that read it", async () => {
    const { usePanelOpen } = await setup();
    const one = usePanelOpen("shared", false);
    const two = usePanelOpen("shared", false);

    one.value = true;

    expect(two.value).toBe(true);
  });

  it("ignores stored data that is not what it wrote", async () => {
    for (const garbage of ["not json", "[1,2]", "null", '{"a": "yes", "b": 3, "c": true}']) {
      localStorage.setItem("qfilm-panels", garbage);
      const { usePanelOpen } = await setup();

      expect(usePanelOpen("a", false).value, garbage).toBe(false);
      expect(usePanelOpen("c", false).value, garbage).toBe(garbage.includes('"c"'));
    }
  });
});

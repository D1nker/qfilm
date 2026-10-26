import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

import { fresh } from "@/test/fresh";

async function setup() {
  const { useTheme } = await fresh(() => import("@/composables/useTheme"));
  return useTheme();
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark", async () => {
    const theme = await setup();
    await nextTick();

    expect(theme.mode.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles between dark and light and applies it to the document", async () => {
    const theme = await setup();
    theme.toggle();
    await nextTick();

    expect(theme.mode.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    theme.toggle();
    await nextTick();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("remembers the choice for the next launch", async () => {
    const theme = await setup();
    theme.toggle();
    await nextTick();
    expect(localStorage.getItem("qfilm-theme")).toBe("light");

    const next = await setup();
    expect(next.mode.value).toBe("light");
  });

  it("ignores a corrupted stored value", async () => {
    localStorage.setItem("qfilm-theme", "sepia");
    const theme = await setup();

    expect(theme.mode.value).toBe("dark");
  });
});

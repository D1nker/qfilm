import { describe, expect, it } from "vitest";

import { activeSection } from "@/shared/lib/scrollSpy";

describe("activeSection", () => {
  it("is the first section while none has reached the marker", () => {
    expect(activeSection([40, 500, 900], 24, false)).toBe(0);
  });

  it("is the last section whose top has passed the marker", () => {
    expect(activeSection([-300, 10, 400], 24, false)).toBe(1);
    expect(activeSection([-900, -500, 20], 24, false)).toBe(2);
  });

  it("is the last section once the panel is scrolled to the end, however short it is", () => {
    expect(activeSection([-600, -100, 250], 24, true)).toBe(2);
  });

  it("skips sections that are not on the page", () => {
    expect(activeSection([-100, null, 400], 24, false)).toBe(0);
    expect(activeSection([null, 10, null], 24, false)).toBe(1);
    expect(activeSection([null, null], 24, true)).toBe(-1);
  });
});

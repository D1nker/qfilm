import { describe, expect, it } from "vitest";

import {
  GUTTER,
  MAX_WIDTH,
  MIN_CANVAS,
  MIN_WIDTH,
  clampWidth,
  maxWidthFor,
  widthFromPointer,
} from "@/features/inspector/panelWidth";

describe("clampWidth", () => {
  it("keeps a width that is within the bounds", () => {
    expect(clampWidth(450, 1600)).toBe(450);
  });

  it("never goes below the minimum, nor above the maximum", () => {
    expect(clampWidth(100, 1600)).toBe(MIN_WIDTH);
    expect(clampWidth(5000, 3000)).toBe(MAX_WIDTH);
  });

  it("leaves the canvas its room on a small window", () => {
    const viewport = 1000;

    expect(clampWidth(900, viewport)).toBe(viewport - MIN_CANVAS - GUTTER);
  });

  it("falls back to the minimum when the window is too small for both", () => {
    expect(maxWidthFor(500)).toBe(MIN_WIDTH);
    expect(clampWidth(600, 500)).toBe(MIN_WIDTH);
  });

  it("rounds to whole pixels", () => {
    expect(clampWidth(400.6, 1600)).toBe(401);
  });
});

describe("widthFromPointer", () => {
  it("measures from the pointer to the gutter on the right", () => {
    expect(widthFromPointer(1000, 1440)).toBe(1440 - 1000 - GUTTER);
  });

  it("is clamped, whichever way the pointer goes", () => {
    expect(widthFromPointer(1430, 1440)).toBe(MIN_WIDTH);
    expect(widthFromPointer(0, 1440)).toBe(maxWidthFor(1440));
  });
});

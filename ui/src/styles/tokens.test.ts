import { describe, expect, it } from "vitest";

import css from "@/styles/tokens.css?raw";

/// The grays are pure neutrals (chroma 0), so an OKLCH lightness maps to a luminance by a cube.
const luminance = (token: string, block: string) => {
  const match = new RegExp(`${token}:\\s*oklch\\(([\\d.]+) 0 0\\)`).exec(block);
  if (!match?.[1]) throw new Error(`${token} is not a plain neutral gray`);
  return Number(match[1]) ** 3;
};

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// The dark palette is the `:root` block, the light one follows its own selector.
const [dark = "", light = ""] = css.split(':root[data-theme="light"]');

describe.each([
  ["dark", dark],
  ["light", light],
])("%s theme", (_, block) => {
  it.each(["--surface", "--bg"])("keeps --text-faint readable (4.5:1) on %s", (surface) => {
    expect(
      contrast(luminance("--text-faint", block), luminance(surface, block)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("draws the slider track apart from the surface", () => {
    expect(
      contrast(luminance("--track", block), luminance("--surface", block)),
    ).toBeGreaterThanOrEqual(1.5);
  });
});

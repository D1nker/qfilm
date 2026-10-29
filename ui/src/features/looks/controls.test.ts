import { describe, expect, it } from "vitest";

import { controls, formatControlValue } from "@/features/looks/controls";
import { gradingRanges } from "@/features/looks/grading";
import { HSL_BANDS, HSL_CHANNELS, hslKey, hslRanges } from "@/features/looks/hsl";
import { NEUTRAL } from "@/features/looks/neutral";

describe("formatControlValue", () => {
  it("signs the exposure and gives it a unit", () => {
    expect(formatControlValue("exposure", 0.5)).toBe("+0.50 EV");
    expect(formatControlValue("exposure", -1)).toBe("-1.00 EV");
    expect(formatControlValue("exposure", 0)).toBe("0.00 EV");
  });

  it("shows a grading hue as an angle", () => {
    expect(formatControlValue("shadowsHue", 200.4)).toBe("200°");
  });

  it("shows a colour-mixer hue as the shift it really makes, in degrees", () => {
    expect(formatControlValue("redHue", 0.5)).toBe("+15°");
    expect(formatControlValue("blueHue", -1)).toBe("-30°");
    expect(formatControlValue("greenHue", 0)).toBe("0°");
  });

  it("keeps the other mixer channels as plain numbers", () => {
    expect(formatControlValue("redSaturation", 0.4)).toBe("0.40");
  });
});

describe("the sliders", () => {
  it("cover every setting exactly once, the mixer's included", () => {
    const keys = [
      ...controls.map((control) => control.key),
      ...hslRanges.map((range) => range.key),
      ...gradingRanges.map((range) => range.key),
    ];

    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(NEUTRAL).sort());
  });

  it("give the mixer 24 settings, all neutral at zero", () => {
    expect(hslRanges).toHaveLength(HSL_BANDS.length * HSL_CHANNELS.length);
    for (const band of HSL_BANDS) {
      for (const channel of HSL_CHANNELS) {
        expect(NEUTRAL[hslKey(band.id, channel)]).toBe(0);
      }
    }
  });
});

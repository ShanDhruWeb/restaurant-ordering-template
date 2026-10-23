// Every theme preset must pass WCAG AA contrast (4.5:1) for normal text.
import { describe, expect, it } from "vitest";
import { THEME_PRESETS, THEME_PRESET_NAMES } from "@/config/themes";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe.each(THEME_PRESET_NAMES)("theme preset %s", (name) => {
  const c = THEME_PRESETS[name].colours;
  const pairs: [string, string, string][] = [
    ["text on background", c.text, c.background],
    ["text on surface", c.text, c.surface],
    ["muted on background", c.muted, c.background],
    ["muted on surface", c.muted, c.surface],
    ["primaryText on primary", c.primaryText, c.primary],
    ["background on text (inverted banner)", c.background, c.text],
    ["success on surface", c.success, c.surface],
    ["danger on surface", c.danger, c.surface],
    ["danger on background", c.danger, c.background],
  ];
  it.each(pairs)("%s meets 4.5:1", (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("primary is visible against the background (3:1 for UI parts)", () => {
    expect(contrast(c.primary, c.background)).toBeGreaterThanOrEqual(3);
  });
});

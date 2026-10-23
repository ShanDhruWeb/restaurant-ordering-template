// Design token presets. Every colour, radius and font in the UI comes from here
// (through CSS variables), so a restaurant can look different in minutes.
// tests/unit/themes.test.ts checks every preset for WCAG AA text contrast.
import type { FontName } from "./fonts";
import type { ThemeColours } from "./schema";

export const THEME_PRESET_NAMES = ["warm", "fresh", "midnight"] as const;
export type ThemePresetName = (typeof THEME_PRESET_NAMES)[number];
export type RadiusName = "none" | "small" | "medium" | "large";

export interface ThemePreset {
  colours: ThemeColours;
  radius: RadiusName;
  fonts: { heading: FontName; body: FontName };
  colorScheme: "light" | "dark";
}

export const THEME_PRESETS: Record<ThemePresetName, ThemePreset> = {
  // Terracotta and cream; a cosy family restaurant.
  warm: {
    colours: {
      background: "#FBF6EE",
      surface: "#FFFFFF",
      text: "#2A1A12",
      muted: "#6B5546",
      primary: "#B4441F",
      primaryText: "#FFFFFF",
      accent: "#E0A526",
      success: "#2F7D32",
      danger: "#B3261E",
    },
    radius: "medium",
    fonts: { heading: "Fraunces", body: "DM Sans" },
    colorScheme: "light",
  },
  // Leafy green on white; a cafe, juice bar or health food place.
  fresh: {
    colours: {
      background: "#F4F8F2",
      surface: "#FFFFFF",
      text: "#14261A",
      muted: "#4F6354",
      primary: "#1F7A4D",
      primaryText: "#FFFFFF",
      accent: "#F2C14E",
      success: "#1F7A4D",
      danger: "#B42318",
    },
    radius: "large",
    fonts: { heading: "Outfit", body: "Inter" },
    colorScheme: "light",
  },
  // Dark navy with amber; a bar, grill or late-night kitchen.
  midnight: {
    colours: {
      background: "#0F1420",
      surface: "#18202F",
      text: "#F3EFE6",
      muted: "#A9B0BF",
      primary: "#F0B44C",
      primaryText: "#1A1206",
      accent: "#7FB7BE",
      success: "#5CC08A",
      danger: "#FF7A70",
    },
    radius: "small",
    fonts: { heading: "Playfair Display", body: "Manrope" },
    colorScheme: "dark",
  },
};

export const RADIUS_VALUES: Record<RadiusName, string> = {
  none: "0px",
  small: "6px",
  medium: "12px",
  large: "20px",
};

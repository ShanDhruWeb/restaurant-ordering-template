// Font names a restaurant can choose in restaurant.config.ts.
// The actual next/font loaders live in src/app/fonts.ts (next/font needs literal names).
export const FONT_NAMES = [
  "Fraunces",
  "DM Sans",
  "Outfit",
  "Inter",
  "Playfair Display",
  "Manrope",
  "Poppins",
  "Lora",
] as const;

export type FontName = (typeof FONT_NAMES)[number];

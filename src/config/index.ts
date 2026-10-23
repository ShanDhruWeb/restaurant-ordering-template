// The validated restaurant config plus the resolved theme. Import from here, not
// from restaurant.config.ts directly.
import rawConfig from "@config";
import { parseRestaurantConfig, tableLabelsOf } from "./schema";
import { RADIUS_VALUES, THEME_PRESETS } from "./themes";

export const config = parseRestaurantConfig(rawConfig);

const preset = THEME_PRESETS[config.theme.preset];

export const theme = {
  colours: { ...preset.colours, ...config.theme.colours },
  radius: RADIUS_VALUES[config.theme.radius ?? preset.radius],
  fonts: {
    heading: config.theme.fonts.heading ?? preset.fonts.heading,
    body: config.theme.fonts.body ?? preset.fonts.body,
  },
  colorScheme: preset.colorScheme,
};

export const tableLabels = tableLabelsOf(config);

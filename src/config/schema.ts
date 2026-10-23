// The shape of restaurant.config.ts, validated with zod when the app starts.
// If you add a field here, add it to restaurant.config.ts and docs/ONBOARDING.md too.
import { z } from "zod";
import { FONT_NAMES } from "./fonts";
import { THEME_PRESET_NAMES } from "./themes";

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex colour like #1a2b3c");
const time24h = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be 24-hour "HH:MM", e.g. "09:30"');
const sitePath = z
  .string()
  .regex(/^\/[^\s]*$/, 'must be a path starting with "/", e.g. "/restaurant/logo.svg"');

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const themeColoursSchema = z
  .object({
    background: hexColour,
    surface: hexColour,
    text: hexColour,
    muted: hexColour,
    primary: hexColour,
    primaryText: hexColour,
    accent: hexColour,
    success: hexColour,
    danger: hexColour,
  })
  .strict();

export type ThemeColours = z.infer<typeof themeColoursSchema>;

export const restaurantConfigSchema = z
  .object({
    restaurant: z
      .object({
        name: z.string().min(1).max(80),
        shortName: z.string().min(1).max(20),
        slug: z.string().regex(/^[a-z0-9-]+$/, "use lowercase letters, numbers and dashes"),
        tagline: z.string().max(120),
        description: z.string().max(300),
        phone: z.string().min(8).max(20),
        whatsapp: z.string().min(8).max(20).optional(),
        email: z.email(),
        address: z
          .object({
            line1: z.string().min(1),
            area: z.string().min(1),
            city: z.string().min(1),
            pincode: z.string().regex(/^\d{6}$/, "must be a 6-digit Indian pincode"),
          })
          .strict(),
        mapsUrl: z.url().optional(),
        hours: z
          .object({
            days: z.array(z.enum(DAY_KEYS)).min(1),
            open: time24h,
            // If close is earlier than open, the window crosses midnight (e.g. 18:00 to 01:00).
            close: time24h,
          })
          .strict(),
        cuisines: z.array(z.string().min(1)).min(1),
        logo: sitePath,
        ogImage: sitePath,
        socials: z
          .object({
            instagram: z.url().optional(),
            facebook: z.url().optional(),
            zomato: z.url().optional(),
            swiggy: z.url().optional(),
          })
          .strict()
          .default({}),
      })
      .strict(),
    theme: z
      .object({
        preset: z.enum(THEME_PRESET_NAMES),
        colours: themeColoursSchema.partial().default({}),
        radius: z.enum(["none", "small", "medium", "large"]).optional(),
        fonts: z
          .object({
            heading: z.enum(FONT_NAMES).optional(),
            body: z.enum(FONT_NAMES).optional(),
          })
          .strict()
          .default({}),
      })
      .strict(),
    ordering: z
      .object({
        types: z.array(z.enum(["dine_in", "takeaway"])).min(1),
        // A number n means tables "1".."n"; a list gives custom labels like ["T1", "Patio 2"].
        tables: z.union([
          z.number().int().min(0).max(200),
          z.array(z.string().regex(/^[A-Za-z0-9 -]{1,12}$/)).max(200),
        ]),
        requirePhone: z.boolean(),
        notesEnabled: z.boolean(),
        maxItemsPerOrder: z.number().int().min(1).max(50),
        maxQtyPerItem: z.number().int().min(1).max(50),
        orderExpiryMinutes: z.number().int().min(5).max(60).default(15),
        pricesIncludeTax: z.boolean(),
        taxNote: z.string().max(120),
        enforceHours: z.boolean(),
      })
      .strict(),
    legal: z
      .object({
        businessLegalName: z.string().min(1),
        gstin: z
          .string()
          .regex(/^[0-9A-Z]{15}$/, "GSTIN is 15 characters, capital letters and digits")
          .optional(),
        fssai: z
          .string()
          .regex(/^\d{14}$/, "FSSAI licence number is 14 digits")
          .optional(),
        // Set true once the restaurant has read and approved the Terms, Privacy and
        // Refund pages. Until then those pages show a "template text" notice.
        policiesReviewed: z.boolean().default(false),
      })
      .strict(),
    agency: z
      .object({
        name: z.string().optional(),
        url: z.url().optional(),
        supportPhone: z.string().optional(),
        showCredit: z.boolean().default(true),
      })
      .strict()
      .default({ showCredit: false }),
  })
  .strict();

export type RestaurantConfigInput = z.input<typeof restaurantConfigSchema>;
export type RestaurantConfig = z.output<typeof restaurantConfigSchema>;

/** Validate a config object; throws one readable error listing every problem. */
export function parseRestaurantConfig(input: unknown): RestaurantConfig {
  const result = restaurantConfigSchema.safeParse(input);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`restaurant.config.ts is invalid:\n${lines.join("\n")}`);
  }
  if (result.data.ordering.types.includes("dine_in") && tableLabelsOf(result.data).length === 0) {
    throw new Error(
      "restaurant.config.ts is invalid:\n  - ordering.tables: dine_in needs at least one table",
    );
  }
  return result.data;
}

/** Helper so restaurant.config.ts gets autocomplete without importing zod. */
export function defineRestaurantConfig(config: RestaurantConfigInput): RestaurantConfigInput {
  return config;
}

export function tableLabelsOf(config: Pick<RestaurantConfig, "ordering">): string[] {
  const t = config.ordering.tables;
  return typeof t === "number" ? Array.from({ length: t }, (_, i) => String(i + 1)) : t;
}

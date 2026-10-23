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

/** Indian mobile (6-9...) or landline with STD code, with optional +91 / 91 / 0 prefix. */
export function isIndianPhone(input: string): boolean {
  let d = input.replace(/[\s\-()]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[1-9]\d{9}$/.test(d);
}
const indianPhone = z
  .string()
  .refine(isIndianPhone, "must be a valid Indian phone number, e.g. +91 98765 43210");
const pincode = z.string().regex(/^\d{6}$/, "must be a 6-digit Indian pincode");
const addressSchema = z
  .object({
    line1: z.string().min(1),
    area: z.string().min(1),
    city: z.string().min(1),
    pincode,
  })
  .strict();

export const ENTITY_TYPES = [
  "proprietorship",
  "partnership",
  "llp",
  "private_limited",
  "public_limited",
  "one_person_company",
  "trust_or_society",
  "individual",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

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
        phone: indianPhone,
        whatsapp: z.string().min(8).max(20).optional(),
        email: z.email(),
        address: addressSchema,
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
        // Exactly as registered, and exactly as given to Razorpay.
        businessLegalName: z.string().min(1),
        // The public brand. Defaults to restaurant.name.
        tradeName: z.string().min(1).max(80).optional(),
        entityType: z.enum(ENTITY_TYPES),
        registeredAddress: addressSchema,
        // Where customers collect food. Defaults to restaurant.address.
        operatingAddress: addressSchema.optional(),
        // Default to restaurant.phone / restaurant.email.
        phone: indianPhone.optional(),
        email: z.email().optional(),
        grievanceContact: z
          .object({ name: z.string().min(1), email: z.email(), phone: indianPhone })
          .strict(),
        gstin: z
          .string()
          .regex(
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
            "GSTIN is 15 characters, like 27ABCDE1234F1Z5",
          )
          .optional(),
        fssai: z
          .string()
          .regex(/^\d{14}$/, "FSSAI licence number is 14 digits")
          .optional(),
        jurisdictionCity: z.string().min(1),
        // ISO date (YYYY-MM-DD) shown as "Last updated" on every policy.
        policiesEffectiveDate: z.string().refine(isIsoDate, "must be a real date like 2026-10-23"),
        // Set true only after a lawyer or CA has read the policies. Until then the
        // admin Launch checklist reminds staff; the public pages show nothing.
        policiesReviewed: z.boolean().default(false),
        // True only for the fictional demo restaurant.
        isDemo: z.boolean().default(false),
      })
      .strict(),
    payments: z
      .object({
        // What Razorpay Checkout shows as the business name. Defaults to the trade name.
        checkoutDisplayName: z.string().min(1).max(80).optional(),
      })
      .strict()
      .prefault({}),
    policies: z
      .object({
        refundTimelineText: z.string().min(1).default("5 to 7 business days, depending on your bank"),
        cancellationCutoff: z.string().min(1).default("before the kitchen starts preparing your order"),
        preparationTimeMinutes: z.number().int().min(1).max(240).default(20),
        deliveryEnabled: z.boolean().default(false),
        // Only used when deliveryEnabled is true.
        delivery: z
          .object({
            area: z.string().min(1),
            chargeText: z.string().min(1),
            timeText: z.string().min(1),
          })
          .strict()
          .optional(),
        collectionGraceMinutes: z.number().int().min(5).max(240).optional(),
      })
      .strict()
      .prefault({}),
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
  .strict()
  .transform((c) => ({
    ...c,
    legal: {
      ...c.legal,
      tradeName: c.legal.tradeName ?? c.restaurant.name,
      operatingAddress: c.legal.operatingAddress ?? c.restaurant.address,
      phone: c.legal.phone ?? c.restaurant.phone,
      email: c.legal.email ?? c.restaurant.email,
    },
    payments: {
      checkoutDisplayName: c.payments.checkoutDisplayName ?? c.legal.tradeName ?? c.restaurant.name,
    },
  }));

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
  const { policies } = result.data;
  if (policies.deliveryEnabled && !policies.delivery) {
    throw new Error(
      "restaurant.config.ts is invalid:\n  - policies.delivery: required when policies.deliveryEnabled is true (area, chargeText, timeText)",
    );
  }
  return result.data;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Helper so restaurant.config.ts gets autocomplete without importing zod. */
export function defineRestaurantConfig(config: RestaurantConfigInput): RestaurantConfigInput {
  return config;
}

export function tableLabelsOf(config: Pick<RestaurantConfig, "ordering">): string[] {
  const t = config.ordering.tables;
  return typeof t === "number" ? Array.from({ length: t }, (_, i) => String(i + 1)) : t;
}

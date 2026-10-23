// Config-only compliance logic: placeholder detection, the `complianceReady` health
// flag and the admin Launch checklist. No secrets, no network, no database.
import type { RestaurantConfig } from "@/config/schema";
import { configWarnings } from "@/config/warnings";

const PLACEHOLDER_TEXT =
  /lorem|\bTODO\b|coming soon|your restaurant|\bexample\b|\bdemo\b|fictional|\bdummy\b|\bplaceholder\b|\bxxx+\b/i;
const PLACEHOLDER_DOMAIN = /(^|\.)(example|test|invalid|localhost)$|^example\.(com|org|net)$/i;

function placeholderPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  return /0{6,}|(\d)\1{6,}|1234567890|0123456789|9876543210/.test(d);
}

function strings(prefix: string, value: unknown): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(`${prefix}[${i}]`, v));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(prefix ? `${prefix}.${k}` : k, v));
  }
  return [];
}

/** Config paths whose value still looks like demo or placeholder data. */
export function findPlaceholders(cfg: RestaurantConfig): string[] {
  const found = new Set<string>();
  if (cfg.legal.isDemo) found.add("legal.isDemo (true: this is the fictional demo restaurant)");
  const visible = { restaurant: cfg.restaurant, legal: { ...cfg.legal, isDemo: undefined } };
  for (const [path, value] of strings("", visible)) {
    if (/\.(logo|ogImage|slug|mapsUrl)$/.test(path) || path.startsWith("restaurant.socials")) continue;
    if (path.endsWith("email")) {
      const domain = value.split("@")[1] ?? "";
      if (PLACEHOLDER_DOMAIN.test(domain)) found.add(`${path} (${value})`);
    } else if (path.endsWith("phone") || path.endsWith("whatsapp")) {
      if (placeholderPhone(value)) found.add(`${path} (${value})`);
    } else if (path.endsWith("pincode")) {
      if (/^(\d)\1{5}$|^123456$/.test(value)) found.add(`${path} (${value})`);
    } else if (PLACEHOLDER_TEXT.test(value)) {
      found.add(`${path} ("${value}")`);
    }
  }
  return [...found];
}

/** True only when the config holds real details and the policies have been reviewed. */
export function isComplianceReady(cfg: RestaurantConfig): boolean {
  const l = cfg.legal;
  const required = [
    l.businessLegalName,
    l.tradeName,
    l.registeredAddress.line1,
    l.grievanceContact.name,
    l.grievanceContact.email,
    l.jurisdictionCity,
    l.policiesEffectiveDate,
  ];
  return required.every((v) => v.trim() !== "") && findPlaceholders(cfg).length === 0 && l.policiesReviewed;
}

export interface ChecklistContext {
  siteUrl: string;
  razorpayMode: "mock" | "test" | "live" | null;
  /** From the database; null when it could not be read. */
  menu: { total: number; withoutPhoto: number } | null;
}

export interface ChecklistItem {
  id: string;
  title: string;
  /** What to do, in plain words. */
  instruction: string;
  /** "required" blocks Razorpay approval; "recommended" improves it. */
  level: "required" | "recommended";
}

/** What is still incomplete before the site can be submitted to Razorpay. Empty means done. */
export function buildLaunchChecklist(cfg: RestaurantConfig, ctx: ChecklistContext): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const placeholders = findPlaceholders(cfg);
  if (placeholders.length > 0) {
    items.push({
      id: "legal-details",
      level: "required",
      title: "Business details are still demo or placeholder values",
      instruction: `Open restaurant.config.ts and replace these with the real values, spelled exactly as on the Razorpay application: ${placeholders.join("; ")}. Then redeploy.`,
    });
  }
  if (!cfg.legal.policiesReviewed) {
    items.push({
      id: "policies-reviewed",
      level: "required",
      title: "Policies have not been reviewed",
      instruction:
        "The Terms, Privacy, Cancellation and Refund, and Shipping pages are template text. Ask a lawyer or CA to read them once, adjust the config values if needed, then set legal.policiesReviewed to true and update legal.policiesEffectiveDate.",
    });
  }
  if (ctx.razorpayMode !== "live") {
    items.push({
      id: "live-keys",
      level: "required",
      title:
        ctx.razorpayMode === null
          ? "Razorpay keys are not set up"
          : `Razorpay is in ${ctx.razorpayMode} mode`,
      instruction:
        "After Razorpay approves the website, put the live key id, key secret and webhook secret in the hosting environment variables (docs/ENV.md) and redeploy. Test keys move no real money.",
    });
  }
  if (/^http:|localhost/.test(ctx.siteUrl)) {
    items.push({
      id: "site-url",
      level: "required",
      title: "NEXT_PUBLIC_SITE_URL is not the real website address",
      instruction:
        "Set NEXT_PUBLIC_SITE_URL to the final https address you will give Razorpay (for example https://www.yourrestaurant.in), then redeploy. Canonical links and the sitemap use it.",
    });
  }
  if (ctx.menu && ctx.menu.total === 0) {
    items.push({
      id: "menu-empty",
      level: "required",
      title: "The menu is empty",
      instruction: "Add dishes with prices in Menu. Razorpay checks that the website shows what it sells.",
    });
  } else if (ctx.menu && ctx.menu.withoutPhoto > 0) {
    items.push({
      id: "menu-photos",
      level: "recommended",
      title: `${ctx.menu.withoutPhoto} of ${ctx.menu.total} menu items have no photo`,
      instruction: "Add a photo to each dish in Menu. Razorpay asks for product information to be complete.",
    });
  }
  for (const w of configWarnings(cfg, ctx.siteUrl)) {
    items.push({
      id: "checkout-name",
      level: "required",
      title: "Checkout name may not match the business or domain",
      instruction: `${w} Set payments.checkoutDisplayName to the brand name registered with Razorpay.`,
    });
  }
  if (!cfg.legal.gstin) {
    items.push({
      id: "gstin",
      level: "recommended",
      title: "No GSTIN set",
      instruction:
        "If the business is GST-registered, add legal.gstin so it shows in the footer and receipt. Skip this if it is not registered.",
    });
  }
  return items;
}

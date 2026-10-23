// The ONLY place components, pages and policy text read business details from.
// Everything visible (name, address, phone, tax numbers, refund period, dates) comes
// through here, from restaurant.config.ts. A test (tests/unit/identityGuard.test.ts)
// fails if code outside src/config and this file reads those config fields directly.
import { config } from "@/config";
import type { DayKey, EntityType, RestaurantConfig } from "@/config/schema";
import { strings } from "@/content/strings";
import { formatHHMM, istDayKey } from "@/lib/time";

type Address = RestaurantConfig["legal"]["registeredAddress"];

const ENTITY_LABELS: Record<EntityType, string> = {
  proprietorship: "a sole proprietorship",
  partnership: "a partnership firm",
  llp: "a limited liability partnership (LLP)",
  private_limited: "a private limited company",
  public_limited: "a public limited company",
  one_person_company: "a one person company",
  trust_or_society: "a trust or society",
  individual: "an individual",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ALL_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function formatAddress(a: Address): string {
  return `${a.line1}, ${a.area}, ${a.city} ${a.pincode}`;
}

/** "+91 20 0000 0000" -> "+912000000000", for tel: links. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** "2026-10-23" -> "23 October 2026". */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Calendar year in IST, computed when called (so it is the server's year, not a typed one). */
export function copyrightYear(now: Date = new Date()): number {
  return Number(new Date(now.getTime() + 330 * 60 * 1000).toISOString().slice(0, 4));
}

export function normaliseSiteUrl(raw: string | undefined): string {
  return (raw?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

export function buildIdentity(cfg: RestaurantConfig, siteUrlRaw?: string) {
  const r = cfg.restaurant;
  const l = cfg.legal;
  const siteUrl = normaliseSiteUrl(siteUrlRaw);
  const operatingAddressText = formatAddress(l.operatingAddress);
  const registeredAddressText = formatAddress(l.registeredAddress);
  return {
    legalName: l.businessLegalName,
    tradeName: l.tradeName,
    shortName: r.shortName,
    checkoutDisplayName: cfg.payments.checkoutDisplayName,
    entityType: l.entityType,
    entityTypeLabel: ENTITY_LABELS[l.entityType],
    tagline: r.tagline,
    description: r.description,
    cuisines: r.cuisines,
    logo: r.logo,
    ogImage: r.ogImage,
    mapsUrl: r.mapsUrl,
    whatsapp: r.whatsapp,
    socials: r.socials,
    hours: r.hours,
    registeredAddress: l.registeredAddress,
    registeredAddressText,
    operatingAddress: l.operatingAddress,
    operatingAddressText,
    addressesDiffer: registeredAddressText !== operatingAddressText,
    area: l.operatingAddress.area,
    city: l.operatingAddress.city,
    phone: l.phone,
    phoneHref: telHref(l.phone),
    email: l.email,
    emailHref: `mailto:${l.email}`,
    grievance: {
      ...l.grievanceContact,
      phoneHref: telHref(l.grievanceContact.phone),
      emailHref: `mailto:${l.grievanceContact.email}`,
    },
    gstin: l.gstin,
    fssai: l.fssai,
    jurisdictionCity: l.jurisdictionCity,
    policiesEffectiveDate: l.policiesEffectiveDate,
    policiesEffectiveDateText: formatIsoDate(l.policiesEffectiveDate),
    policiesReviewed: l.policiesReviewed,
    isDemo: l.isDemo,
    siteUrl,
    agency: cfg.agency,
    ordering: {
      types: cfg.ordering.types,
      pricesIncludeTax: cfg.ordering.pricesIncludeTax,
      taxNote: cfg.ordering.taxNote,
      orderExpiryMinutes: cfg.ordering.orderExpiryMinutes,
    },
    policies: cfg.policies,
  };
}

export type Identity = ReturnType<typeof buildIdentity>;

let cached: Identity | undefined;

/** The identity of this deployment's restaurant. */
export function getIdentity(): Identity {
  cached ??= buildIdentity(config, process.env.NEXT_PUBLIC_SITE_URL);
  return cached;
}

/** Absolute URL for a site path, e.g. canonicalUrl("/terms"). */
export function canonicalUrl(path: string, id: Identity = getIdentity()): string {
  return `${id.siteUrl}${path === "/" ? "" : path}`;
}

/** "Every day" or "Mon, Tue, Wed". */
export function openDaysText(hours: Identity["hours"]): string {
  return hours.days.length === 7
    ? strings.everyDay
    : ALL_DAYS.filter((d) => hours.days.includes(d))
        .map((d) => strings.days[d])
        .join(", ");
}

/** "Every day: 8:00 AM to 11:00 PM". */
export function hoursText(id: Identity = getIdentity()): string {
  return `${openDaysText(id.hours)}: ${formatHHMM(id.hours.open)} to ${formatHHMM(id.hours.close)}`;
}

/** "Open today, 8:00 AM to 11:00 PM" or "Closed today". */
export function todayHoursText(id: Identity = getIdentity(), now: Date = new Date()): string {
  return id.hours.days.includes(istDayKey(now))
    ? strings.home.openToday(formatHHMM(id.hours.open), formatHHMM(id.hours.close))
    : strings.home.closedToday;
}

/** Page title in the "Page name | Trade name" pattern used by the root layout template. */
export function pageTitle(name: string, id: Identity = getIdentity()): string {
  return `${name} | ${id.tradeName}`;
}

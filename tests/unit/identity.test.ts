import { describe, expect, it } from "vitest";
import rawConfig from "@config";
import { parseRestaurantConfig } from "@/config/schema";
import { configWarnings } from "@/config/warnings";
import {
  buildIdentity,
  canonicalUrl,
  copyrightYear,
  formatIsoDate,
  hoursText,
  normaliseSiteUrl,
  pageTitle,
  telHref,
  todayHoursText,
} from "@/lib/identity";

const clone = () => structuredClone(rawConfig) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const parse = (c: unknown) => parseRestaurantConfig(c);
const message = (c: unknown) => {
  try {
    parse(c);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
};

describe("legal / payments / policies config", () => {
  it("fills defaults from the restaurant block", () => {
    const c = clone();
    delete c.legal.tradeName;
    delete c.payments.checkoutDisplayName;
    const cfg = parse(c);
    expect(cfg.legal.tradeName).toBe(cfg.restaurant.name);
    expect(cfg.legal.operatingAddress).toEqual(cfg.restaurant.address);
    expect(cfg.legal.phone).toBe(cfg.restaurant.phone);
    expect(cfg.legal.email).toBe(cfg.restaurant.email);
    expect(cfg.payments.checkoutDisplayName).toBe(cfg.legal.tradeName);
  });

  it("applies the documented policy defaults", () => {
    const c = clone();
    delete c.policies;
    const p = parse(c).policies;
    expect(p.refundTimelineText).toBe("5 to 7 business days, depending on your bank");
    expect(p.cancellationCutoff).toBe("before the kitchen starts preparing your order");
    expect(p.deliveryEnabled).toBe(false);
  });

  it("uses a custom checkout display name when given", () => {
    const c = clone();
    c.payments.checkoutDisplayName = "Demo Kitchen Baner";
    expect(parse(c).payments.checkoutDisplayName).toBe("Demo Kitchen Baner");
  });

  it("lists every bad legal field with its path", () => {
    const c = clone();
    c.legal.gstin = "27ABCDE1234F1Z"; // 14 chars
    c.legal.fssai = "1234";
    c.legal.registeredAddress.pincode = "4110";
    c.legal.email = "not-an-email";
    c.legal.phone = "12345";
    c.legal.grievanceContact.phone = "abc";
    c.legal.policiesEffectiveDate = "2026-02-31";
    c.legal.entityType = "company";
    const m = message(c);
    for (const path of [
      "legal.gstin",
      "legal.fssai",
      "legal.registeredAddress.pincode",
      "legal.email",
      "legal.phone",
      "legal.grievanceContact.phone",
      "legal.policiesEffectiveDate",
      "legal.entityType",
    ]) {
      expect(m).toContain(path);
    }
  });

  it("accepts a valid GSTIN, FSSAI, mobile, landline and date", () => {
    const c = clone();
    c.legal.gstin = "27ABCDE1234F1Z5";
    c.legal.fssai = "11500000000000";
    c.legal.phone = "+91 98765 43210";
    c.legal.grievanceContact.phone = "020 2567 1234";
    expect(message(c)).toBe("");
  });

  it("requires the required legal fields", () => {
    const c = clone();
    delete c.legal.jurisdictionCity;
    delete c.legal.grievanceContact;
    const m = message(c);
    expect(m).toContain("legal.jurisdictionCity");
    expect(m).toContain("legal.grievanceContact");
  });

  it("needs policies.delivery when delivery is enabled", () => {
    const c = clone();
    c.policies.deliveryEnabled = true;
    expect(message(c)).toContain("policies.delivery");
    c.policies.delivery = { area: "Baner", chargeText: "Rs 30", timeText: "45 minutes" };
    expect(message(c)).toBe("");
  });

  it("warns, but does not fail, on a dissimilar checkout display name", () => {
    const c = clone();
    c.payments.checkoutDisplayName = "Tasty Bites Express";
    const w = configWarnings(parse(c), "https://demokitchen.in");
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("payments.checkoutDisplayName");
    expect(configWarnings(parse(rawConfig), "http://localhost:3000")).toEqual([]);
  });
});

describe("identity", () => {
  const cfg = parse(rawConfig);
  const id = buildIdentity(cfg, "https://shop.test/");

  it("exposes legal and trade names separately", () => {
    expect(id.legalName).toBe(cfg.legal.businessLegalName);
    expect(id.tradeName).toBe(cfg.legal.tradeName);
    expect(id.checkoutDisplayName).toBe(cfg.payments.checkoutDisplayName);
  });

  it("builds links and addresses", () => {
    expect(id.phoneHref).toMatch(/^tel:\+?\d+$/);
    expect(id.emailHref).toBe(`mailto:${id.email}`);
    expect(id.operatingAddressText).toContain(cfg.restaurant.address.pincode);
  });

  it("detects a different registered address", () => {
    const c = clone();
    c.legal.registeredAddress = {
      line1: "12 Head Office Rd",
      area: "Kothrud",
      city: "Pune",
      pincode: "411038",
    };
    expect(buildIdentity(parse(c)).addressesDiffer).toBe(true);
  });

  it("normalises the site URL and builds canonical URLs", () => {
    expect(normaliseSiteUrl("https://x.in///")).toBe("https://x.in");
    expect(normaliseSiteUrl(undefined)).toBe("http://localhost:3000");
    expect(canonicalUrl("/terms", id)).toBe("https://shop.test/terms");
    expect(canonicalUrl("/", id)).toBe("https://shop.test");
  });

  it("formats dates, tel links, titles and years", () => {
    expect(formatIsoDate("2026-10-23")).toBe("23 October 2026");
    expect(telHref("+91 20 0000 0000")).toBe("tel:+912000000000");
    expect(pageTitle("Contact us", id)).toBe(`Contact us | ${id.tradeName}`);
    expect(copyrightYear(new Date("2026-12-31T20:00:00Z"))).toBe(2027); // already 1 Jan in IST
    expect(copyrightYear(new Date("2026-06-01T00:00:00Z"))).toBe(2026);
  });

  it("describes opening hours and today's hours", () => {
    expect(hoursText(id)).toBe("Every day: 8:00 AM to 11:00 PM");
    expect(todayHoursText(id, new Date("2026-10-23T06:00:00Z"))).toBe("Open today, 8:00 AM to 11:00 PM");
    const c = clone();
    c.restaurant.hours.days = ["mon"];
    expect(todayHoursText(buildIdentity(parse(c)), new Date("2026-10-23T06:00:00Z"))).toBe("Closed today"); // a Friday
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures mutate loosely typed config */
import { describe, expect, it } from "vitest";
import rawConfig from "@config";
import { parseRestaurantConfig } from "@/config/schema";
import { buildLaunchChecklist, findPlaceholders, isComplianceReady } from "@/lib/compliance";

const clone = () => structuredClone(rawConfig) as Record<string, any>;

/** A realistic, non-demo restaurant with reviewed policies. */
function realConfig() {
  const c = clone();
  c.restaurant = {
    ...c.restaurant,
    name: "Spice Route",
    shortName: "Spice Route",
    tagline: "Coastal curries in Kothrud",
    description: "Spice Route serves coastal curries, appam and filter coffee in Kothrud, Pune.",
    phone: "+91 98220 11234",
    whatsapp: "+91 98220 11234",
    email: "orders@spiceroute.in",
    address: { line1: "12 Karve Road", area: "Kothrud", city: "Pune", pincode: "411038" },
    socials: {},
  };
  c.legal = {
    ...c.legal,
    businessLegalName: "Spice Route Hospitality LLP",
    tradeName: "Spice Route",
    entityType: "llp",
    registeredAddress: { line1: "12 Karve Road", area: "Kothrud", city: "Pune", pincode: "411038" },
    grievanceContact: { name: "Meera Rao", email: "meera@spiceroute.in", phone: "+91 98220 55678" },
    gstin: "27ABCDE1234F1Z5",
    policiesReviewed: true,
    isDemo: false,
  };
  return c;
}

describe("placeholder detection and complianceReady", () => {
  it("the demo config is not ready and lists what to replace", () => {
    const cfg = parseRestaurantConfig(rawConfig);
    expect(isComplianceReady(cfg)).toBe(false);
    const found = findPlaceholders(cfg).join("\n");
    expect(found).toContain("legal.isDemo");
    expect(found).toContain("restaurant.name");
    expect(found).toContain("restaurant.email");
    expect(found).toContain("restaurant.phone");
  });

  it("a real, reviewed config is ready", () => {
    const cfg = parseRestaurantConfig(realConfig());
    expect(findPlaceholders(cfg)).toEqual([]);
    expect(isComplianceReady(cfg)).toBe(true);
  });

  it("is not ready until policies are reviewed", () => {
    const c = realConfig();
    c.legal.policiesReviewed = false;
    expect(isComplianceReady(parseRestaurantConfig(c))).toBe(false);
  });

  it.each([
    [
      "a placeholder email domain",
      (c: any) => (c.restaurant.email = "orders@example.com"),
      "restaurant.email",
    ],
    [
      "a .example email",
      (c: any) => (c.legal.grievanceContact.email = "me@spiceroute.example"),
      "grievanceContact.email",
    ],
    ["an all-zero phone", (c: any) => (c.restaurant.phone = "+91 20 0000 0000"), "restaurant.phone"],
    [
      "a fake pincode",
      (c: any) => (c.legal.registeredAddress.pincode = "111111"),
      "registeredAddress.pincode",
    ],
    [
      "lorem text",
      (c: any) => (c.restaurant.description = "Lorem ipsum dolor sit amet"),
      "restaurant.description",
    ],
    [
      "'your restaurant'",
      (c: any) => (c.restaurant.tagline = "Welcome to your restaurant"),
      "restaurant.tagline",
    ],
    ["the demo flag", (c: any) => (c.legal.isDemo = true), "legal.isDemo"],
  ])("catches %s", (_name, mutate, path) => {
    const c = realConfig();
    mutate(c);
    const cfg = parseRestaurantConfig(c);
    expect(findPlaceholders(cfg).join("\n")).toContain(path);
    expect(isComplianceReady(cfg)).toBe(false);
  });

  it("a malformed GSTIN is rejected before it can be deployed", () => {
    const c = realConfig();
    c.legal.gstin = "27ABCDE1234F1";
    expect(() => parseRestaurantConfig(c)).toThrow(/legal\.gstin/);
  });
});

describe("launch checklist", () => {
  const ctx = {
    siteUrl: "https://spiceroute.in",
    razorpayMode: "live" as const,
    menu: { total: 10, withoutPhoto: 0 },
  };

  it("is empty for a finished restaurant (GSTIN present, live keys, photos)", () => {
    expect(buildLaunchChecklist(parseRestaurantConfig(realConfig()), ctx)).toEqual([]);
  });

  it("lists every outstanding item with a plain instruction", () => {
    const items = buildLaunchChecklist(parseRestaurantConfig(rawConfig), {
      siteUrl: "http://localhost:3000",
      razorpayMode: "mock",
      menu: { total: 10, withoutPhoto: 4 },
    });
    const ids = items.map((i) => i.id);
    for (const id of [
      "legal-details",
      "policies-reviewed",
      "live-keys",
      "site-url",
      "menu-photos",
      "gstin",
    ]) {
      expect(ids).toContain(id);
    }
    for (const i of items) expect(i.instruction.length).toBeGreaterThan(30);
    expect(items.find((i) => i.id === "menu-photos")!.title).toContain("4 of 10");
  });

  it("flags test-mode keys, an empty menu and a dissimilar checkout name", () => {
    const c = realConfig();
    c.payments = { checkoutDisplayName: "Tasty Bites Express" };
    const items = buildLaunchChecklist(parseRestaurantConfig(c), {
      ...ctx,
      razorpayMode: "test",
      menu: { total: 0, withoutPhoto: 0 },
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain("live-keys");
    expect(ids).toContain("menu-empty");
    expect(ids).toContain("checkout-name");
  });

  it("does not block on a menu it could not read", () => {
    const items = buildLaunchChecklist(parseRestaurantConfig(realConfig()), { ...ctx, menu: null });
    expect(items).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import rawConfig from "@config";
import { parseRestaurantConfig } from "@/config/schema";
import {
  buildAbout,
  buildPrivacy,
  buildRefunds,
  buildShipping,
  buildTerms,
  type Policy,
} from "@/content/policies";
import { buildIdentity } from "@/lib/identity";

const flat = (p: Policy) =>
  [p.title, p.lastUpdated ?? "", ...p.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join("\n");
const headings = (p: Policy) => p.sections.map((s) => s.heading.toLowerCase());

const demo = buildIdentity(parseRestaurantConfig(rawConfig), "https://shop.test");

// A completely different restaurant. If any policy text were typed in rather than read
// from config, a demo value would leak into this output.
const zedConfig = {
  restaurant: {
    name: "Zed Foods",
    shortName: "Zed",
    slug: "zed-foods",
    tagline: "Fast Gujarati thalis",
    description: "Zed Foods serves Gujarati thalis in Surat.",
    phone: "+91 261 255 7788",
    email: "orders@zedfoods.in",
    address: { line1: "17 Ring Road", area: "Adajan", city: "Surat", pincode: "395009" },
    hours: { days: ["mon", "tue", "wed", "thu", "fri"], open: "11:00", close: "22:00" },
    cuisines: ["Gujarati"],
    logo: "/restaurant/logo.svg",
    ogImage: "/og",
  },
  theme: { preset: "warm" },
  ordering: {
    types: ["takeaway"],
    tables: 0,
    requirePhone: true,
    notesEnabled: true,
    maxItemsPerOrder: 20,
    maxQtyPerItem: 10,
    pricesIncludeTax: false,
    taxNote: "GST extra as applicable at billing.",
    enforceHours: false,
  },
  legal: {
    businessLegalName: "Zed Hospitality LLP",
    tradeName: "Zed Foods",
    entityType: "llp",
    registeredAddress: { line1: "9 Head Office Lane", area: "Piplod", city: "Surat", pincode: "395007" },
    grievanceContact: { name: "Asha Patel", email: "grievance@zedfoods.in", phone: "+91 98250 11223" },
    gstin: "24ABCDE1234F1Z5",
    fssai: "10720000000001",
    jurisdictionCity: "Ahmedabad",
    policiesEffectiveDate: "2027-01-05",
  },
  policies: {
    refundTimelineText: "3 working days",
    cancellationCutoff: "within 2 minutes of paying",
    preparationTimeMinutes: 35,
    collectionGraceMinutes: 45,
  },
};
const zed = buildIdentity(parseRestaurantConfig(zedConfig), "https://zedfoods.in");

const builders = {
  terms: buildTerms,
  privacy: buildPrivacy,
  refunds: buildRefunds,
  shipping: buildShipping,
  about: buildAbout,
};

describe("policy builders: required topics", () => {
  it("terms cover every required topic", () => {
    const h = headings(buildTerms(demo)).join("|");
    for (const topic of [
      "who operates",
      "the service",
      "who can order",
      "menu, prices and taxes",
      "orders and availability",
      "payment",
      "order confirmation",
      "acceptable use",
      "intellectual property",
      "allergens",
      "limitation of liability",
      "changes to these terms",
      "governing law",
      "contact and grievances",
    ]) {
      expect(h).toContain(topic);
    }
    const t = flat(buildTerms(demo));
    expect(t).toContain("Razorpay");
    expect(t).toMatch(/do not see or store your card/);
    expect(t).toMatch(/INR/);
  });

  it("privacy covers every required topic", () => {
    const h = headings(buildPrivacy(demo)).join("|");
    for (const topic of [
      "what we collect",
      "why we use",
      "cookies and browser storage",
      "who we share it with",
      "how long we keep it",
      "security",
      "your rights",
      "children",
      "changes",
      "contact",
    ]) {
      expect(h).toContain(topic);
    }
    const t = flat(buildPrivacy(demo));
    expect(t).toContain("Digital Personal Data Protection Act, 2023");
    expect(t).toMatch(/never reach our website or our database/);
    expect(t).toMatch(/do not sell your data/);
    expect(t).not.toMatch(/ISO 27001|SOC ?2|PCI/i);
  });

  it("refunds cover cancellation, refund cases, exclusions, method and stray payments", () => {
    const t = flat(buildRefunds(demo));
    expect(t).toMatch(/There is no cancel button/);
    expect(t).toMatch(/call .* straight away and quote your order number/);
    expect(t).toMatch(/charged more than once/);
    expect(t).toMatch(/change your mind after preparation has started/);
    expect(t).toMatch(/do not collect it/);
    expect(t).toMatch(/do not give cash refunds/);
    expect(t).toMatch(/through Razorpay/);
    expect(t).toMatch(/Money taken but no order/i);
    expect(buildRefunds(demo).title).toBe("Cancellation and Refund Policy");
  });

  it("shipping says dine-in and takeaway, no courier, and no delivery by default", () => {
    const t = flat(buildShipping(demo));
    expect(t).toMatch(/do not ship orders by courier/);
    expect(t).toMatch(/no shipping charges/);
    expect(t).toMatch(/Home delivery is not offered through this website/);
    expect(t).toContain("dine-in");
    expect(t).toContain("takeaway");
    expect(buildShipping(demo).title).toBe("Shipping and Delivery Policy");
  });

  it("shipping shows a delivery section only when delivery is enabled", () => {
    const c = structuredClone(zedConfig) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    c.policies.deliveryEnabled = true;
    c.policies.delivery = {
      area: "Adajan and Vesu",
      chargeText: "Rs 40 per order",
      timeText: "about 50 minutes",
    };
    const t = flat(buildShipping(buildIdentity(parseRestaurantConfig(c))));
    expect(t).toContain("Adajan and Vesu");
    expect(t).toContain("Rs 40 per order");
    expect(t).toContain("about 50 minutes");
    expect(t).not.toMatch(/Home delivery is not offered/);
  });

  it("every policy carries a Last updated line, the About page does not", () => {
    for (const key of ["terms", "privacy", "refunds", "shipping"] as const) {
      expect(builders[key](demo).lastUpdated).toBe("Last updated: 23 October 2026");
    }
    expect(buildAbout(demo).lastUpdated).toBeUndefined();
  });

  it("mentions the legal name first, then the trade name", () => {
    for (const key of ["terms", "privacy", "refunds", "shipping"] as const) {
      const t = flat(builders[key](zed));
      expect(t).toContain("Zed Hospitality LLP");
      expect(t.indexOf("Zed Hospitality LLP")).toBeLessThan(
        t.indexOf("Zed Foods", t.indexOf("Last updated")),
      );
    }
  });
});

describe("policy builders: config values are used and nothing is hard-coded", () => {
  it("uses every config value it should", () => {
    const terms = flat(buildTerms(zed));
    for (const v of [
      "a limited liability partnership",
      "9 Head Office Lane, Piplod, Surat 395007",
      "GST extra as applicable at billing.",
      "Ahmedabad",
      "Asha Patel",
      "grievance@zedfoods.in",
      "+91 98250 11223",
      "orders@zedfoods.in",
      "17 Ring Road, Adajan, Surat 395009",
      "5 January 2027",
    ]) {
      expect(terms).toContain(v);
    }
    expect(terms).toContain("takeaway pickup");
    expect(terms).not.toContain("dine-in at your table");

    const refunds = flat(buildRefunds(zed));
    expect(refunds).toContain("3 working days");
    expect(refunds).toContain("within 2 minutes of paying");

    const shipping = flat(buildShipping(zed));
    expect(shipping).toContain("about 35 minutes");
    expect(shipping).toContain("within 45 minutes");
    expect(shipping).toContain("17 Ring Road, Adajan, Surat 395009");
    expect(shipping).not.toContain("dine-in");

    const about = flat(buildAbout(zed));
    expect(about).toContain("Gujarati");
    expect(about).toContain("GSTIN: 24ABCDE1234F1Z5");
    expect(about).toContain("FSSAI licence number: 10720000000001");
  });

  it("leaks no demo-restaurant value into another restaurant's pages", () => {
    const demoValues = [
      "Demo Kitchen",
      "Pune",
      "411045",
      "Baner",
      "demokitchen",
      "0000 0000",
      "The Manager",
      "5 to 7",
      "23 October 2026",
      "kitchen starts preparing",
      "20 minutes",
    ];
    for (const [name, build] of Object.entries(builders)) {
      const t = flat(build(zed));
      for (const v of demoValues) {
        expect(t, `${name} leaks "${v}"`).not.toContain(v);
      }
    }
  });

  it("contains no placeholder text", () => {
    for (const [name, build] of Object.entries(builders)) {
      const t = flat(build(zed));
      expect(t, name).not.toMatch(/lorem|todo|coming soon|example\.com|your restaurant|template text/i);
    }
  });

  it("uses the default refund timeline and cutoff when config does not set them", () => {
    const c = structuredClone(zedConfig) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    delete c.policies.refundTimelineText;
    delete c.policies.cancellationCutoff;
    const t = flat(buildRefunds(buildIdentity(parseRestaurantConfig(c))));
    expect(t).toContain("5 to 7 business days, depending on your bank");
    expect(t).toContain("before the kitchen starts preparing your order");
  });
});

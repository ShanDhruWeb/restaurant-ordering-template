// ─────────────────────────────────────────────────────────────────────────────
// EVERYTHING RESTAURANT-SPECIFIC LIVES HERE.
// For a new restaurant, edit this file, public/restaurant/ and prisma/menu.json.
// The app checks this file on startup and lists anything that is wrong.
// Step-by-step guide: docs/ONBOARDING.md
// ─────────────────────────────────────────────────────────────────────────────
import { defineRestaurantConfig } from "./src/config/schema";

export default defineRestaurantConfig({
  restaurant: {
    name: "Demo Kitchen",
    shortName: "Demo Kitchen",
    slug: "demo-kitchen",
    tagline: "Pune home-style food, made fresh to order",
    description:
      "Demo Kitchen is a fictional restaurant used to show this ordering template. Misal, thalis, biryani and filter coffee in Baner, Pune.",
    phone: "+91 20 0000 0000",
    whatsapp: "+91 90000 00000",
    email: "hello@demokitchen.example",
    address: {
      line1: "Shop 4, Example Arcade, Baner Road",
      area: "Baner",
      city: "Pune",
      pincode: "411045",
    },
    mapsUrl: "https://maps.google.com/?q=Baner+Road+Pune",
    hours: { days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], open: "08:00", close: "23:00" },
    cuisines: ["Maharashtrian", "North Indian", "South Indian"],
    logo: "/restaurant/logo.svg",
    // "/og" is generated from the name and theme. For a real photo use e.g. "/restaurant/og.jpg" (1200x630).
    ogImage: "/og",
    socials: {
      instagram: "https://instagram.com/demokitchen.example",
    },
  },

  theme: {
    // "warm" | "fresh" | "midnight". Override any single token below if needed.
    preset: "warm",
    colours: {},
    fonts: {},
  },

  ordering: {
    types: ["dine_in", "takeaway"],
    tables: 12,
    requirePhone: true,
    notesEnabled: true,
    maxItemsPerOrder: 20,
    maxQtyPerItem: 10,
    orderExpiryMinutes: 15,
    pricesIncludeTax: true,
    taxNote: "All prices include GST.",
    enforceHours: false,
  },

  // Fill every value below EXACTLY as written on the Razorpay application
  // (see docs/COMPLIANCE.md). The values here are fictional demo data.
  legal: {
    businessLegalName: "Demo Kitchen (fictional business)",
    // The public brand. Leave out to use restaurant.name.
    tradeName: "Demo Kitchen",
    // proprietorship | partnership | llp | private_limited | public_limited | one_person_company | trust_or_society | individual
    entityType: "proprietorship",
    registeredAddress: {
      line1: "Shop 4, Example Arcade, Baner Road",
      area: "Baner",
      city: "Pune",
      pincode: "411045",
    },
    // operatingAddress, phone and email default to the restaurant's own; set them only if different.
    grievanceContact: {
      name: "The Manager",
      email: "hello@demokitchen.example",
      phone: "+91 20 0000 0000",
    },
    // gstin: "27ABCDE1234F1Z5",
    // fssai: "11500000000000",
    jurisdictionCity: "Pune",
    // Shown as "Last updated" on every policy page. Change it whenever the policy text changes.
    policiesEffectiveDate: "2026-10-23",
    // Set to true only after a lawyer or CA has read /terms, /privacy, /refunds and /shipping.
    policiesReviewed: false,
    // True only for this fictional demo restaurant. A real restaurant must remove it or set false.
    isDemo: true,
  },

  payments: {
    // What Razorpay Checkout shows as the business name. Defaults to legal.tradeName.
    // It must be at least 80% similar to the legal name or the domain name.
    // checkoutDisplayName: "Demo Kitchen",
  },

  policies: {
    refundTimelineText: "5 to 7 business days, depending on your bank",
    cancellationCutoff: "before the kitchen starts preparing your order",
    preparationTimeMinutes: 20,
    // Home delivery is not offered through this website. If you turn it on, also fill policies.delivery.
    deliveryEnabled: false,
    // collectionGraceMinutes: 30,
  },

  agency: {
    name: "Quelessly",
    showCredit: true,
  },
});

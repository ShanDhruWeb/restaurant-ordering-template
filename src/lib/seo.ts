// Per-page metadata: unique title (the root layout adds " | Trade name"), a description
// and an absolute canonical URL built from NEXT_PUBLIC_SITE_URL.
import type { Metadata } from "next";
import { canonicalUrl, getIdentity } from "@/lib/identity";

export interface PublicPage {
  path: string;
  /** Title without the trade name suffix. */
  title: string;
  /** Footer / sitemap label. */
  label: string;
  description: (tradeName: string) => string;
}

/** The eight public pages, in footer order. The single list used by footer, sitemap and tests. */
export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: "/",
    title: "Order online",
    label: "Home",
    description: (n) => `Order food online from ${n} and pay securely with UPI or card.`,
  },
  {
    path: "/pricing",
    title: "Menu and Pricing",
    label: "Menu and Pricing",
    description: (n) => `The full ${n} menu with prices in Indian Rupees.`,
  },
  {
    path: "/about",
    title: "About us",
    label: "About us",
    description: (n) => `About ${n}: who we are, what we serve and how online ordering works.`,
  },
  {
    path: "/contact",
    title: "Contact us",
    label: "Contact us",
    description: (n) => `Address, phone, email, opening hours and grievance contact for ${n}.`,
  },
  {
    path: "/terms",
    title: "Terms and Conditions",
    label: "Terms and Conditions",
    description: (n) => `Terms and Conditions for ordering from ${n}.`,
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    label: "Privacy Policy",
    description: (n) => `How ${n} collects, uses and protects your personal data.`,
  },
  {
    path: "/refunds",
    title: "Cancellation and Refund Policy",
    label: "Cancellation and Refunds",
    description: (n) => `How to cancel an order with ${n} and when refunds are paid.`,
  },
  {
    path: "/shipping",
    title: "Shipping and Delivery Policy",
    label: "Shipping and Delivery",
    description: (n) => `How orders from ${n} reach you: dine-in and takeaway pickup.`,
  },
];

/** The seven pages Razorpay asks for, linked from every footer (everything except Home). */
export const FOOTER_PAGES = PUBLIC_PAGES.filter((p) => p.path !== "/");

export function pageMetadata(path: string): Metadata {
  const page = PUBLIC_PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`Unknown public page: ${path}`);
  const id = getIdentity();
  const url = canonicalUrl(path, id);
  const description = page.description(id.tradeName);
  return {
    title: page.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${page.title} | ${id.tradeName}`, description, url },
  };
}

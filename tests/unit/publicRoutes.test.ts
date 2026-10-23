// Every public route must render the shared footer, and the footer must link all seven
// pages Razorpay asks for. The route list is derived from src/app, not typed here.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";
import { getIdentity } from "@/lib/identity";
import { FOOTER_PAGES, PUBLIC_PAGES } from "@/lib/seo";
import nextConfig from "../../next.config";

const APP = path.resolve(import.meta.dirname, "../../src/app");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

/** src/app/(shop)/order/[id]/page.tsx -> /order/[id] */
function routeOf(file: string): string {
  const segs = path
    .relative(APP, path.dirname(file))
    .split(path.sep)
    .filter((s) => s && !/^\(.*\)$/.test(s));
  return "/" + segs.join("/");
}

/** Does any layout between the page and src/app render <Footer />? */
function hasFooterLayout(file: string): boolean {
  let dir = path.dirname(file);
  while (dir.startsWith(APP)) {
    const layout = path.join(dir, "layout.tsx");
    if (existsSync(layout) && /<Footer\s*\/>/.test(readFileSync(layout, "utf8"))) return true;
    dir = path.dirname(dir);
  }
  return false;
}

const allPages = pages(APP).map((f) => ({ file: f, route: routeOf(f) }));
const publicRoutes = allPages.filter((p) => !p.route.startsWith("/admin"));

describe("public routes", () => {
  it("finds the expected public routes in src/app", () => {
    const routes = publicRoutes.map((p) => p.route);
    for (const page of PUBLIC_PAGES) expect(routes).toContain(page.path);
    expect(routes).toContain("/checkout");
    expect(routes).toContain("/order/[id]");
  });

  it("every public route is covered by a layout that renders the footer", () => {
    const missing = publicRoutes.filter((p) => !hasFooterLayout(p.file)).map((p) => p.route);
    expect(missing).toEqual([]);
  });

  it("the eight public pages all exist as routes", () => {
    expect(PUBLIC_PAGES).toHaveLength(8);
    const routes = new Set(allPages.map((p) => p.route));
    for (const page of PUBLIC_PAGES) expect(routes.has(page.path), page.path).toBe(true);
  });
});

describe("footer", () => {
  const html = renderToStaticMarkup(createElement(Footer));
  const id = getIdentity();

  it("links all seven pages", () => {
    expect(FOOTER_PAGES).toHaveLength(7);
    for (const p of FOOTER_PAGES) {
      expect(html).toContain(`href="${p.path}"`);
      expect(html).toContain(p.label);
    }
  });

  it("shows legal and trade name, address, tel and mailto links", () => {
    expect(html).toContain(id.legalName);
    expect(html).toContain(id.tradeName);
    expect(html).toContain(id.operatingAddressText);
    expect(html).toContain(`href="${id.phoneHref}"`);
    expect(html).toContain(`href="${id.emailHref}"`);
  });

  it("shows Razorpay line and a server-computed copyright year", () => {
    expect(html).toContain("Payments processed securely by Razorpay.");
    expect(html).toContain(`© ${new Date().getFullYear()}`);
  });
});

describe("redirects", () => {
  it("maps alternative policy names to the canonical pages", async () => {
    const redirects = await nextConfig.redirects!();
    const map = Object.fromEntries(redirects.map((r) => [r.source, r.destination]));
    expect(map["/cancellation-and-refunds"]).toBe("/refunds");
    expect(map["/refund-policy"]).toBe("/refunds");
    expect(map["/delivery-policy"]).toBe("/shipping");
  });
});

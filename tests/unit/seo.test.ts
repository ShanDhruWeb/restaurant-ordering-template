import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RestaurantJsonLd } from "@/components/JsonLd";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getIdentity } from "@/lib/identity";
import { PUBLIC_PAGES, pageMetadata } from "@/lib/seo";

const id = getIdentity();

describe("robots.txt", () => {
  const r = robots();
  const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules)!;

  it("allows the public site and blocks staff, api, order and checkout", () => {
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/admin", "/api", "/order", "/checkout"]);
    for (const p of PUBLIC_PAGES) {
      const blocked = (rule.disallow as string[]).some((d) => p.path.startsWith(d));
      expect(blocked, p.path).toBe(false);
    }
  });

  it("points at the absolute sitemap", () => {
    expect(r.sitemap).toBe(`${id.siteUrl}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  it("lists the eight public pages with absolute URLs", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toHaveLength(8);
    expect(urls.every((u) => u.startsWith(id.siteUrl))).toBe(true);
    for (const p of PUBLIC_PAGES)
      expect(urls).toContain(p.path === "/" ? id.siteUrl : `${id.siteUrl}${p.path}`);
  });
});

describe("page metadata", () => {
  it.each(PUBLIC_PAGES.map((p) => p.path))(
    "%s has a title, description and canonical URL, and no noindex",
    (path) => {
      const m = pageMetadata(path);
      expect(m.title).toBeTruthy();
      expect(String(m.description).length).toBeGreaterThan(20);
      expect(m.alternates?.canonical).toBe(path === "/" ? id.siteUrl : `${id.siteUrl}${path}`);
      expect(m.robots).toBeUndefined();
    },
  );

  it.each(PUBLIC_PAGES.map((p) => p.path))("%s keeps the Open Graph site name and image", (path) => {
    const og = pageMetadata(path).openGraph as { siteName?: string; images?: { url: string }[] };
    expect(og.siteName).toBe(id.tradeName);
    expect(og.images?.[0]?.url).toBe(id.ogImage);
  });

  it("gives every page a different title and description", () => {
    const metas = PUBLIC_PAGES.map((p) => pageMetadata(p.path));
    expect(new Set(metas.map((m) => m.title)).size).toBe(8);
    expect(new Set(metas.map((m) => m.description)).size).toBe(8);
  });

  it("rejects an unknown page", () => {
    expect(() => pageMetadata("/nope")).toThrow();
  });
});

describe("Restaurant JSON-LD", () => {
  const html = renderToStaticMarkup(createElement(RestaurantJsonLd));
  const json = JSON.parse(
    />(.*)<\/script>/s
      .exec(html)![1]!
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'"),
  );

  it("uses schema.org Restaurant with the verified identity fields", () => {
    expect(json["@context"]).toBe("https://schema.org");
    expect(json["@type"]).toBe("Restaurant");
    expect(json.name).toBe(id.tradeName);
    expect(json.legalName).toBe(id.legalName);
    expect(json.telephone).toBe(id.phone);
    expect(json.address["@type"]).toBe("PostalAddress");
    expect(json.address.postalCode).toBe(id.operatingAddress.pincode);
    expect(json.address.addressCountry).toBe("IN");
    expect(json.hasMenu).toBe(`${id.siteUrl}/pricing`);
    expect(json.openingHoursSpecification[0].opens).toBe(id.hours.open);
    expect(json.servesCuisine).toEqual(id.cuisines);
  });

  it("cannot break out of its script tag", () => {
    expect(html.match(/<\/script/g)).toHaveLength(1);
  });
});

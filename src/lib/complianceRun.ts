// The checks behind `npm run compliance -- <baseUrl>`: crawl a running site the way
// Razorpay's automated review does (plain HTTP, no JavaScript) and report pass/fail.
// This file knows nothing about the config; scripts/compliance.ts passes in expectations.
import {
  findCanonical,
  findHrefs,
  findIdentityText,
  findJsonLd,
  findMeta,
  findTitle,
  forbiddenMatches,
  hasNoindex,
  htmlToText,
  imagesWithoutAlt,
  isValidMailtoHref,
  isValidTelHref,
  sitemapUrls,
} from "./htmlCheck";

export interface Expectations {
  legalName: string;
  tradeName: string;
  phone: string;
  email: string;
  addressText: string;
  isDemo: boolean;
  /** "23 October 2026", as printed after "Last updated:". */
  effectiveDateText: string;
  /** Origin canonical URLs must use, e.g. "https://demokitchen.in". */
  siteOrigin: string;
  /** The eight public pages, e.g. ["/", "/pricing", ...]. */
  publicPaths: string[];
  /** The seven pages every footer must link. */
  footerPaths: string[];
  /** Pages that must print "Last updated". */
  policyPaths: string[];
  /** Old or alternative names that must redirect. */
  aliases: { from: string; to: string }[];
  /** Paths robots.txt must disallow. */
  blockedPaths: string[];
  /** How to place the throw-away order used to reach /order/[id] and its receipt. */
  order: { type: "dine_in" | "takeaway"; table: string | null; phone: string } | null;
}

export type Status = "pass" | "fail" | "warn" | "skip";
export interface CheckResult {
  status: Status;
  check: string;
  detail: string;
}

interface Fetched {
  url: string;
  status: number;
  headers: Headers;
  body: string;
  hops: string[];
  loop: boolean;
  tooManyHops: boolean;
}

const MAX_HOPS = 6;
const isLocal = (url: string) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname);

/** GET, following redirects by hand so loops and the final URL can be reported. */
async function get(url: string): Promise<Fetched> {
  const hops: string[] = [];
  let current = url;
  for (let i = 0; i <= MAX_HOPS; i++) {
    if (hops.includes(current)) {
      return {
        url: current,
        status: 0,
        headers: new Headers(),
        body: "",
        hops,
        loop: true,
        tooManyHops: false,
      };
    }
    hops.push(current);
    let res: Response;
    try {
      res = await fetch(current, { redirect: "manual", headers: { "user-agent": "compliance-check/1.0" } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        url: current,
        status: 0,
        headers: new Headers(),
        body: msg,
        hops,
        loop: false,
        tooManyHops: false,
      };
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return {
      url: current,
      status: res.status,
      headers: res.headers,
      body: await res.text(),
      hops,
      loop: false,
      tooManyHops: false,
    };
  }
  return { url: current, status: 0, headers: new Headers(), body: "", hops, loop: false, tooManyHops: true };
}

const originOf = (u: string) => new URL(u).origin;

export async function runComplianceChecks(
  baseUrl: string,
  exp: Expectations,
  opts: { createOrder: boolean } = { createOrder: true },
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const add = (status: Status, check: string, detail = "") => results.push({ status, check, detail });
  const base = baseUrl.replace(/\/+$/, "");
  const local = isLocal(base);

  // ---- Fetch every page once ----
  const pages = new Map<string, Fetched>();
  for (const p of exp.publicPaths) pages.set(p, await get(base + (p === "/" ? "" : p)));
  const checkout = await get(`${base}/checkout`);
  pages.set("/checkout", checkout);

  // ---- 1. Reachability ----
  for (const p of exp.publicPaths) {
    const r = pages.get(p)!;
    const problems: string[] = [];
    if (r.loop) problems.push("redirect loop");
    else if (r.tooManyHops) problems.push("too many redirects");
    else if (r.status !== 200)
      problems.push(`HTTP ${r.status || "no response"}${r.status ? "" : ` (${r.body})`}`);
    if (!local && !r.loop && new URL(r.url).protocol !== "https:") problems.push("not served over HTTPS");
    if (r.status === 200 && r.hops.length > 1) problems.push(`redirects ${r.hops.length - 1}x`);
    add(problems.length === 0 ? "pass" : "fail", `GET ${p}`, problems.join("; ") || "200 OK");
  }
  const reachable = exp.publicPaths.filter((p) => pages.get(p)!.status === 200);

  // ---- 2. Names in raw HTML ----
  for (const p of reachable) {
    const text = htmlToText(pages.get(p)!.body);
    const missing = [exp.legalName, exp.tradeName].filter((n) => !text.includes(n));
    add(
      missing.length === 0 ? "pass" : "fail",
      `Business names in HTML ${p}`,
      missing.length ? `missing: ${missing.join(", ")}` : "legal and trade name present",
    );
  }

  // ---- 3. Order pages (tracking and receipt) ----
  let orderId: string | null = null;
  if (!opts.createOrder || !exp.order) {
    add(
      "skip",
      "Order tracking and receipt pages",
      "skipped (no throw-away order was created; run without --no-order on staging)",
    );
  } else {
    orderId = await placeThrowAwayOrder(base, exp, add);
    if (orderId) {
      pages.set("/order/[id]", await get(`${base}/order/${orderId}`));
      pages.set("/order/[id]/receipt", await get(`${base}/order/${orderId}/receipt`));
    }
  }

  // ---- 4. Footer on every public route ----
  const footerRoutes = [...reachable, "/checkout", "/order/[id]", "/order/[id]/receipt"].filter(
    (p) => pages.get(p)?.status === 200,
  );
  for (const p of footerRoutes) {
    const hrefs = new Set(findHrefs(pages.get(p)!.body));
    const missing = exp.footerPaths.filter((f) => !hrefs.has(f));
    add(
      missing.length === 0 ? "pass" : "fail",
      `Footer links on ${p}`,
      missing.length ? `missing: ${missing.join(", ")}` : `${exp.footerPaths.length} links`,
    );
  }
  for (const p of ["/checkout", "/order/[id]", "/order/[id]/receipt"]) {
    const r = pages.get(p);
    if (r && r.status !== 200) add("fail", `GET ${p}`, `HTTP ${r.status}`);
  }
  const bad: string[] = [];
  for (const f of exp.footerPaths) {
    const r = await get(base + f);
    if (r.status !== 200) bad.push(`${f} -> ${r.status || "error"}`);
  }
  add(
    bad.length === 0 ? "pass" : "fail",
    "Every footer link returns 200",
    bad.join("; ") || `${exp.footerPaths.length} links`,
  );

  // ---- 5. Name spelled identically everywhere ----
  const legalSeen = new Set<string>();
  const tradeSeen = new Set<string>();
  for (const [p, r] of pages) {
    if (r.status !== 200) continue;
    findIdentityText(r.body, "legal-name").forEach((t) => legalSeen.add(`${t}`));
    findIdentityText(r.body, "trade-name").forEach((t) => tradeSeen.add(`${t}`));
    const title = findTitle(r.body);
    if (p !== "/checkout" && !p.startsWith("/order") && !title.endsWith(`| ${exp.tradeName}`)) {
      add("fail", `Title suffix ${p}`, `"${title}" should end with "| ${exp.tradeName}"`);
    }
  }
  const ld = pages.get("/")?.status === 200 ? findJsonLd(pages.get("/")!.body) : null;
  const sameLegal = legalSeen.size === 1 && legalSeen.has(exp.legalName);
  const sameTrade = tradeSeen.size === 1 && tradeSeen.has(exp.tradeName);
  add(
    sameLegal && sameTrade ? "pass" : "fail",
    "Business name spelled identically on all pages",
    sameLegal && sameTrade
      ? `"${exp.legalName}" / "${exp.tradeName}"`
      : `legal seen: ${[...legalSeen].join(" | ") || "none"}; trade seen: ${[...tradeSeen].join(" | ") || "none"}`,
  );
  add(
    ld && ld.name === exp.tradeName && ld.legalName === exp.legalName ? "pass" : "fail",
    "JSON-LD name matches",
    ld ? `name="${String(ld.name)}" legalName="${String(ld.legalName)}"` : "no JSON-LD on /",
  );
  const ogSite = pages.get("/")?.status === 200 ? findMeta(pages.get("/")!.body, "og:site_name") : null;
  add(
    ogSite === exp.tradeName ? "pass" : "fail",
    "Open Graph site name matches",
    `og:site_name="${ogSite ?? ""}"`,
  );
  const manifest = await get(`${base}/manifest.webmanifest`);
  let manifestName = "";
  try {
    manifestName = (JSON.parse(manifest.body) as { name?: string }).name ?? "";
  } catch {
    /* reported below */
  }
  add(
    manifestName === exp.tradeName ? "pass" : "fail",
    "Web manifest name matches",
    `name="${manifestName}"`,
  );

  // ---- 6. Contact details ----
  const contact = pages.get("/contact");
  if (contact?.status === 200) {
    const text = htmlToText(contact.body);
    const hrefs = findHrefs(contact.body);
    const missing = [exp.phone, exp.email, exp.addressText].filter((v) => !text.includes(v));
    add(
      missing.length === 0 ? "pass" : "fail",
      "Phone, email and address on /contact",
      missing.length ? `missing: ${missing.join(" | ")}` : "all present",
    );
    const tels = hrefs.filter((h) => h.startsWith("tel:"));
    const mails = hrefs.filter((h) => h.startsWith("mailto:"));
    const badLinks = [
      ...tels.filter((h) => !isValidTelHref(h)),
      ...mails.filter((h) => !isValidMailtoHref(h)),
    ];
    add(
      tels.length > 0 && mails.length > 0 && badLinks.length === 0 ? "pass" : "fail",
      "tel: and mailto: links valid on /contact",
      badLinks.length ? `invalid: ${badLinks.join(", ")}` : `${tels.length} tel, ${mails.length} mailto`,
    );
    const footer = reachable
      .filter((p) => p !== "/contact")
      .every((p) => {
        const t = htmlToText(pages.get(p)!.body);
        return t.includes(exp.phone) && t.includes(exp.email) && t.includes(exp.addressText);
      });
    add(
      footer ? "pass" : "fail",
      "Phone, email and address in the footer of every page",
      footer ? "all present" : "missing on at least one page",
    );
  } else {
    add("fail", "Contact details", "/contact is not reachable");
  }

  // ---- 7. Prices ----
  const pricing = pages.get("/pricing");
  if (pricing?.status === 200) {
    const prices = htmlToText(pricing.body).match(/₹\s?\d[\d,]*(\.\d{2})?/g) ?? [];
    add(
      prices.length > 0 ? "pass" : "fail",
      "Prices with ₹ on /pricing",
      prices.length ? `${prices.length} prices` : "no ₹ prices found (is the menu empty?)",
    );
  } else {
    add("fail", "Prices with ₹ on /pricing", "/pricing is not reachable");
  }

  // ---- 8. Placeholder text ----
  const placeholderPages: string[] = [];
  for (const [p, r] of pages) {
    if (r.status !== 200) continue;
    const hits = forbiddenMatches(r.body, { allowDemo: exp.isDemo });
    if (hits.length) placeholderPages.push(`${p}: ${hits.join(", ")}`);
  }
  add(
    placeholderPages.length === 0 ? "pass" : "fail",
    "No placeholder text",
    placeholderPages.join("; ") || "none found",
  );

  // ---- 9. robots.txt, sitemap.xml, noindex, canonical ----
  const robots = await get(`${base}/robots.txt`);
  if (robots.status !== 200) {
    add("fail", "robots.txt", `HTTP ${robots.status || "error"}`);
  } else {
    const disallowed = [...robots.body.matchAll(/^\s*disallow:\s*(\S*)/gim)].map((m) => m[1]!);
    const missingBlocks = exp.blockedPaths.filter((b) => !disallowed.includes(b));
    const blockedPublic = exp.publicPaths.filter(
      (p) => p !== "/" && disallowed.some((d) => d && p.startsWith(d)),
    );
    const blockAll = disallowed.includes("/");
    const ok =
      missingBlocks.length === 0 &&
      blockedPublic.length === 0 &&
      !blockAll &&
      /^\s*sitemap:/im.test(robots.body);
    add(
      ok ? "pass" : "fail",
      "robots.txt",
      ok
        ? "public pages allowed; admin, api, order, checkout blocked; sitemap listed"
        : [
            missingBlocks.length ? `not blocked: ${missingBlocks.join(", ")}` : "",
            blockedPublic.length ? `public pages blocked: ${blockedPublic.join(", ")}` : "",
            blockAll ? "blocks everything" : "",
            /^\s*sitemap:/im.test(robots.body) ? "" : "no Sitemap line",
          ]
            .filter(Boolean)
            .join("; "),
    );
  }
  const sitemap = await get(`${base}/sitemap.xml`);
  if (sitemap.status !== 200) {
    add("fail", "sitemap.xml", `HTTP ${sitemap.status || "error"}`);
  } else {
    const urls = sitemapUrls(sitemap.body);
    const expected = exp.publicPaths.map((p) => exp.siteOrigin + (p === "/" ? "" : p));
    const norm = (u: string) => u.replace(/\/$/, "");
    const missing = expected.filter((e) => !urls.map(norm).includes(e));
    const extra = urls.map(norm).filter((u) => !expected.includes(u));
    add(
      missing.length === 0 && extra.length === 0 ? "pass" : "fail",
      "sitemap.xml matches the public pages",
      [
        missing.length ? `missing: ${missing.join(", ")}` : "",
        extra.length ? `unexpected: ${extra.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; ") || `${urls.length} URLs`,
    );
  }
  const noindexPages = reachable.filter(
    (p) => hasNoindex(pages.get(p)!.body) || /noindex/i.test(pages.get(p)!.headers.get("x-robots-tag") ?? ""),
  );
  add(
    noindexPages.length === 0 ? "pass" : "fail",
    "No noindex on public pages",
    noindexPages.join(", ") || "none",
  );
  const badCanon: string[] = [];
  for (const p of reachable) {
    const want = exp.siteOrigin + (p === "/" ? "" : p);
    const got = findCanonical(pages.get(p)!.body);
    if (!got || got.replace(/\/$/, "") !== want) badCanon.push(`${p}: ${got ?? "none"} (want ${want})`);
  }
  add(
    badCanon.length === 0 ? "pass" : "fail",
    "Canonical tags use the expected host",
    badCanon.join("; ") || exp.siteOrigin,
  );

  // ---- 10. Policies carry a date ----
  const stale = exp.policyPaths.filter(
    (p) => !htmlToText(pages.get(p)?.body ?? "").includes(`Last updated: ${exp.effectiveDateText}`),
  );
  add(
    stale.length === 0 ? "pass" : "fail",
    "Last updated date on each policy",
    stale.length ? `missing on: ${stale.join(", ")}` : `"Last updated: ${exp.effectiveDateText}"`,
  );

  // ---- 11. Images ----
  const noAlt: string[] = [];
  for (const [p, r] of pages)
    if (r.status === 200) imagesWithoutAlt(r.body).forEach((i) => noAlt.push(`${p}: ${i.src ?? "?"}`));
  add(noAlt.length === 0 ? "pass" : "fail", "Every <img> has an alt attribute", noAlt.join("; ") || "ok");
  const menu = await get(`${base}/api/menu`);
  try {
    const data = JSON.parse(menu.body) as { categories: { items: { imagePath: string | null }[] }[] };
    const items = data.categories.flatMap((c) => c.items);
    const without = items.filter((i) => !i.imagePath).length;
    const pct = items.length ? Math.round((without / items.length) * 100) : 0;
    add(
      pct === 0 ? "pass" : "warn",
      "Menu items with a photo",
      `${pct}% of ${items.length} items have no photo (Razorpay asks for product information to be complete)`,
    );
  } catch {
    add("warn", "Menu items with a photo", "could not read /api/menu");
  }

  // ---- 12. Aliases ----
  for (const a of exp.aliases) {
    const r = await get(base + a.from);
    const ok = r.status === 200 && new URL(r.url).pathname === a.to;
    add(
      ok ? "pass" : "fail",
      `Redirect ${a.from}`,
      ok ? `-> ${a.to}` : `ended at ${new URL(r.url).pathname} (${r.status})`,
    );
  }

  // ---- 13. No login needed ----
  const gated = exp.publicPaths.filter((p) => {
    const r = pages.get(p)!;
    return (
      r.status === 401 ||
      r.status === 403 ||
      r.headers.has("www-authenticate") ||
      r.hops.some((h) => /\/(login|signin)|\/admin/i.test(new URL(h).pathname))
    );
  });
  add(gated.length === 0 ? "pass" : "fail", "No login required on public pages", gated.join(", ") || "none");

  // ---- 14. Health flag (informational) ----
  const health = await get(`${base}/api/health`);
  try {
    const h = JSON.parse(health.body) as { complianceReady?: boolean };
    add(
      h.complianceReady ? "pass" : "warn",
      "/api/health complianceReady",
      h.complianceReady ? "true" : "false: see the Launch checklist in /admin",
    );
  } catch {
    add("warn", "/api/health complianceReady", "could not read /api/health");
  }
  if (!local && originOf(base) !== exp.siteOrigin) {
    add(
      "warn",
      "Site URL",
      `checking ${originOf(base)} but canonical origin is ${exp.siteOrigin}; submit the final canonical URL to Razorpay`,
    );
  }
  return results;
}

/** Create a pending order (never paid; it expires by itself) so the order and receipt pages can be crawled. */
async function placeThrowAwayOrder(
  base: string,
  exp: Expectations,
  add: (s: Status, c: string, d?: string) => void,
): Promise<string | null> {
  const order = exp.order!;
  try {
    const menu = (await (await fetch(`${base}/api/menu`)).json()) as {
      categories: { items: { id: string; isAvailable: boolean }[] }[];
    };
    const item = menu.categories.flatMap((c) => c.items).find((i) => i.isAvailable);
    if (!item) {
      add("warn", "Order tracking and receipt pages", "skipped: no available menu item to order");
      return null;
    }
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: order.type,
        table: order.table ?? undefined,
        customerName: "Compliance Check",
        customerPhone: order.phone,
        items: [{ menuItemId: item.id, quantity: 1 }],
        termsAccepted: true,
      }),
    });
    const data = (await res.json()) as { id?: string; code?: string; error?: string };
    if (!res.ok || !data.id) {
      add(
        "warn",
        "Order tracking and receipt pages",
        `skipped: could not place the throw-away order (${data.code ?? res.status}: ${data.error ?? ""})`,
      );
      return null;
    }
    return data.id;
  } catch (err) {
    add(
      "warn",
      "Order tracking and receipt pages",
      `skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

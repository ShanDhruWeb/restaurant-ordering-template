// Runs the real crawler against a tiny stub server: first a site that satisfies every
// check, then the same site with one thing broken at a time.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CheckResult, type Expectations, runComplianceChecks } from "@/lib/complianceRun";

const exp: Expectations = {
  legalName: "Spice Route Hospitality LLP",
  tradeName: "Spice Route",
  phone: "+91 98220 11234",
  email: "orders@spiceroute.in",
  addressText: "12 Karve Road, Kothrud, Pune 411038",
  isDemo: false,
  effectiveDateText: "23 October 2026",
  siteOrigin: "http://PLACEHOLDER", // replaced once the server port is known
  publicPaths: ["/", "/pricing", "/about", "/contact", "/terms", "/privacy", "/refunds", "/shipping"],
  footerPaths: ["/pricing", "/about", "/contact", "/terms", "/privacy", "/refunds", "/shipping"],
  policyPaths: ["/terms", "/privacy", "/refunds", "/shipping"],
  aliases: [
    { from: "/refund-policy", to: "/refunds" },
    { from: "/delivery-policy", to: "/shipping" },
  ],
  blockedPaths: ["/admin", "/api", "/order", "/checkout"],
  order: { type: "takeaway", table: null, phone: "9000000000" },
};

type Page = { status?: number; body?: string; headers?: Record<string, string>; location?: string };
let server: Server;
let base = "";
let site: Record<string, Page> = {};
let origin = "";

const footer = (opts: { skip?: string; legal?: string } = {}) => `
  <footer><p data-identity="trade-name">${exp.tradeName}</p>
  <p>Operated by <span data-identity="legal-name">${opts.legal ?? exp.legalName}</span></p>
  <p>${exp.addressText}</p><a href="tel:+919822011234">${exp.phone}</a>
  <a href="mailto:${exp.email}">${exp.email}</a>
  <nav>${exp.footerPaths
    .filter((p) => p !== opts.skip)
    .map((p) => `<a href="${p}">${p}</a>`)
    .join("")}</nav></footer>`;

function html(path: string, extra = "", opts: Parameters<typeof footer>[0] = {}, head = "") {
  const canonical = `${origin}${path === "/" ? "" : path}`;
  const updated = exp.policyPaths.includes(path) ? `<p>Last updated: ${exp.effectiveDateText}</p>` : "";
  return `<!doctype html><html><head><title>${path === "/" ? "Order online" : path.slice(1)} | ${exp.tradeName}</title>
    <link rel="canonical" href="${canonical}"/><meta property="og:site_name" content="${exp.tradeName}"/>${head}
    ${path === "/" ? `<script type="application/ld+json">${JSON.stringify({ name: exp.tradeName, legalName: exp.legalName })}</script>` : ""}
    </head><body><main><h1>${path}</h1>${updated}${extra}</main>${footer(opts)}</body></html>`;
}

function goodSite(): Record<string, Page> {
  const pages: Record<string, Page> = {};
  for (const p of exp.publicPaths) pages[p] = { body: html(p) };
  pages["/pricing"] = { body: html("/pricing", "<ul><li>Appam ₹120</li><li>Chai ₹30</li></ul>") };
  pages["/contact"] = { body: html("/contact", `<address>${exp.addressText}</address>`) };
  pages["/checkout"] = { body: html("/checkout") };
  pages["/order/ord1"] = { body: html("/order/ord1") };
  pages["/order/ord1/receipt"] = { body: html("/order/ord1/receipt") };
  pages["/refund-policy"] = { status: 308, location: "/refunds" };
  pages["/delivery-policy"] = { status: 308, location: "/shipping" };
  pages["/robots.txt"] = {
    body: `User-Agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nDisallow: /order\nDisallow: /checkout\nSitemap: ${origin}/sitemap.xml\n`,
  };
  pages["/sitemap.xml"] = {
    body: `<urlset>${exp.publicPaths.map((p) => `<url><loc>${origin}${p === "/" ? "" : p}</loc></url>`).join("")}</urlset>`,
  };
  pages["/manifest.webmanifest"] = { body: JSON.stringify({ name: exp.tradeName }) };
  pages["/api/menu"] = {
    body: JSON.stringify({
      categories: [{ items: [{ id: "item1", isAvailable: true, imagePath: "/a.jpg" }] }],
    }),
  };
  pages["/api/health"] = { body: JSON.stringify({ ok: true, complianceReady: true }) };
  return pages;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (req.method === "POST" && url.pathname === "/api/orders") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "ord1" }));
      return;
    }
    const page = site[url.pathname];
    if (!page) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.statusCode = page.status ?? 200;
    if (page.location) res.setHeader("location", page.location);
    for (const [k, v] of Object.entries(page.headers ?? {})) res.setHeader(k, v);
    res.end(page.body ?? "");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  origin = base;
  exp.siteOrigin = base;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const run = async (mutate?: (s: Record<string, Page>) => void, over: Partial<Expectations> = {}) => {
  site = goodSite();
  mutate?.(site);
  return runComplianceChecks(base, { ...exp, ...over }, { createOrder: true });
};
const failed = (rs: CheckResult[]) => rs.filter((r) => r.status === "fail");
const failing = (rs: CheckResult[], text: RegExp) =>
  failed(rs).filter((r) => text.test(r.check + " " + r.detail));

describe("compliance crawler", () => {
  it("passes a site that meets every requirement", async () => {
    const rs = await run();
    expect(failed(rs)).toEqual([]);
    expect(rs.some((r) => r.status === "pass")).toBe(true);
    expect(rs.find((r) => r.check === "Footer links on /order/[id]/receipt")?.status).toBe("pass");
  });

  it("warns, not fails, about menu items without photos", async () => {
    const rs = await run((s) => {
      s["/api/menu"] = {
        body: JSON.stringify({ categories: [{ items: [{ id: "i", isAvailable: true, imagePath: null }] }] }),
      };
    });
    expect(failed(rs)).toEqual([]);
    expect(rs.find((r) => r.check === "Menu items with a photo")).toMatchObject({ status: "warn" });
  });

  it("skips order pages with --no-order instead of failing", async () => {
    site = goodSite();
    const rs = await runComplianceChecks(base, exp, { createOrder: false });
    expect(failed(rs)).toEqual([]);
    expect(rs.some((r) => r.status === "skip")).toBe(true);
  });

  it("fails a page that is not 200", async () => {
    const rs = await run((s) => (s["/about"] = { status: 404, body: "no" }));
    expect(failing(rs, /GET \/about/).length).toBeGreaterThan(0);
  });

  it("detects a redirect loop", async () => {
    const rs = await run((s) => {
      s["/about"] = { status: 302, location: "/about" };
    });
    expect(failing(rs, /redirect loop/).length).toBe(1);
  });

  it("fails when a page lacks the legal name in raw HTML", async () => {
    const rs = await run((s) => (s["/terms"] = { body: html("/terms").replaceAll(exp.legalName, "") }));
    expect(failing(rs, /Business names in HTML \/terms/).length).toBe(1);
  });

  it("fails when a footer link is missing", async () => {
    const rs = await run((s) => (s["/privacy"] = { body: html("/privacy", "", { skip: "/shipping" }) }));
    expect(failing(rs, /Footer links on \/privacy.*\/shipping/).length).toBe(1);
  });

  it("fails when a footer link is dead", async () => {
    const rs = await run((s) => delete s["/shipping"]);
    expect(failing(rs, /Every footer link returns 200.*shipping/).length).toBe(1);
  });

  it("fails when the business name is spelled differently on one page", async () => {
    const rs = await run(
      (s) => (s["/about"] = { body: html("/about", "", { legal: "Spice Route Hospitality LLP." }) }),
    );
    expect(failing(rs, /spelled identically/).length).toBe(1);
  });

  it("fails when phone, email or address is missing from /contact", async () => {
    const rs = await run((s) => (s["/contact"] = { body: html("/contact").replaceAll(exp.email, "x@y.in") }));
    expect(failing(rs, /Phone, email and address on \/contact/).length).toBe(1);
  });

  it("fails on an invalid tel: link", async () => {
    const rs = await run(
      (s) =>
        (s["/contact"] = {
          body: html("/contact", `<address>${exp.addressText}</address>`).replaceAll(
            "tel:+919822011234",
            "tel:98 22",
          ),
        }),
    );
    expect(failing(rs, /tel: and mailto:/).length).toBe(1);
  });

  it("fails when /pricing has no ₹ prices", async () => {
    const rs = await run((s) => (s["/pricing"] = { body: html("/pricing", "<ul><li>Appam 120</li></ul>") }));
    expect(failing(rs, /Prices with ₹/).length).toBe(1);
  });

  it.each([
    "Lorem ipsum dolor",
    "TODO write this",
    "Coming soon",
    "see example.com",
    "Your restaurant name here",
  ])("fails on placeholder text %s", async (text) => {
    const rs = await run((s) => (s["/about"] = { body: html("/about", `<p>${text}</p>`) }));
    expect(failing(rs, /No placeholder text/).length).toBe(1);
  });

  it("fails on Demo Kitchen unless the config says isDemo", async () => {
    const mutate = (s: Record<string, Page>) =>
      (s["/about"] = { body: html("/about", "<p>Demo Kitchen</p>") });
    expect(failing(await run(mutate), /No placeholder text/).length).toBe(1);
    expect(failing(await run(mutate, { isDemo: true }), /No placeholder text/).length).toBe(0);
  });

  it("fails without robots.txt, and when it blocks a public page", async () => {
    expect(failing(await run((s) => delete s["/robots.txt"]), /robots\.txt/).length).toBe(1);
    const rs = await run(
      (s) =>
        (s["/robots.txt"] = {
          body: `User-Agent: *\nDisallow: /terms\nDisallow: /admin\nDisallow: /api\nDisallow: /order\nDisallow: /checkout\nSitemap: x\n`,
        }),
    );
    expect(failing(rs, /robots\.txt.*terms/).length).toBe(1);
  });

  it("fails when the sitemap is missing a page or has extras", async () => {
    const rs = await run(
      (s) =>
        (s["/sitemap.xml"] = {
          body: `<urlset><url><loc>${origin}</loc></url><url><loc>${origin}/other</loc></url></urlset>`,
        }),
    );
    expect(failing(rs, /sitemap\.xml matches/).length).toBe(1);
  });

  it("fails on noindex, in a meta tag or an X-Robots-Tag header", async () => {
    const meta = await run(
      (s) => (s["/terms"] = { body: html("/terms", "", {}, `<meta name="robots" content="noindex"/>`) }),
    );
    expect(failing(meta, /No noindex.*terms/).length).toBe(1);
    const header = await run(
      (s) => (s["/about"] = { body: html("/about"), headers: { "x-robots-tag": "noindex" } }),
    );
    expect(failing(header, /No noindex.*about/).length).toBe(1);
  });

  it("fails on a canonical tag with the wrong host", async () => {
    const rs = await run(
      (s) =>
        (s["/contact"] = {
          body: html("/contact", `<address>${exp.addressText}</address>`).replace(
            origin,
            "https://other.example.in",
          ),
        }),
    );
    expect(failing(rs, /Canonical tags/).length).toBe(1);
  });

  it("fails when a policy has no Last updated date", async () => {
    const rs = await run(
      (s) => (s["/refunds"] = { body: html("/refunds").replace(/<p>Last updated:[^<]*<\/p>/, "") }),
    );
    expect(failing(rs, /Last updated.*refunds/).length).toBe(1);
  });

  it("fails on an image without alt", async () => {
    const rs = await run((s) => (s["/about"] = { body: html("/about", `<img src="/x.jpg">`) }));
    expect(failing(rs, /alt attribute/).length).toBe(1);
  });

  it("fails when a public page needs a login", async () => {
    const rs = await run(
      (s) => (s["/about"] = { status: 401, body: "login", headers: { "www-authenticate": "Basic" } }),
    );
    expect(failing(rs, /login|GET \/about/).length).toBeGreaterThan(0);
  });

  it("fails when an alias does not redirect to the right page", async () => {
    const rs = await run((s) => delete s["/refund-policy"]);
    expect(failing(rs, /Redirect \/refund-policy/).length).toBe(1);
  });

  it("warns when complianceReady is false", async () => {
    const rs = await run(
      (s) => (s["/api/health"] = { body: JSON.stringify({ ok: true, complianceReady: false }) }),
    );
    expect(rs.find((r) => r.check.includes("complianceReady"))).toMatchObject({ status: "warn" });
    expect(failed(rs)).toEqual([]);
  });
});

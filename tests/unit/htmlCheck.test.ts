import { describe, expect, it } from "vitest";
import {
  decodeEntities,
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
} from "@/lib/htmlCheck";

describe("htmlCheck", () => {
  it("decodes entities", () => {
    expect(decodeEntities("A &amp; B &#39;x&#x27; &quot;y&quot; &copy; &#8377;")).toBe(`A & B 'x' "y" © ₹`);
    expect(decodeEntities("&unknown; &#99999999;")).toBe("&unknown; &#99999999;");
  });

  it("turns HTML into visible text, dropping scripts, styles and comments", () => {
    const html = `<style>.a{}</style><script>var x="secret"</script><p>Hello<!-- c --> <b>World</b> &amp; co</p>`;
    expect(htmlToText(html)).toBe("Hello World & co");
  });

  it("reads title, canonical and meta regardless of attribute order", () => {
    const html = `<title>Terms | Demo</title><link href="https://x.in/terms" rel="canonical"/>
      <meta content="Demo" property="og:site_name"/><meta name="robots" content="index, follow"/>`;
    expect(findTitle(html)).toBe("Terms | Demo");
    expect(findCanonical(html)).toBe("https://x.in/terms");
    expect(findMeta(html, "og:site_name")).toBe("Demo");
    expect(hasNoindex(html)).toBe(false);
    expect(hasNoindex(`<meta content="noindex, nofollow" name="robots"/>`)).toBe(true);
  });

  it("finds links and images without alt (alt='' is allowed)", () => {
    const html = `<a href="/terms">T</a><a class="x" href='/privacy'>P</a><a>no href</a>
      <img src="/a.png" alt="A"><img src="/b.png" alt=""><img src="/c.png">`;
    expect(findHrefs(html)).toEqual(["/terms", "/privacy"]);
    expect(imagesWithoutAlt(html).map((i) => i.src)).toEqual(["/c.png"]);
  });

  it("extracts identity text", () => {
    const html = `<p data-identity="trade-name">Demo &amp; Co</p><span data-identity="legal-name">Demo LLP</span>`;
    expect(findIdentityText(html, "trade-name")).toEqual(["Demo & Co"]);
    expect(findIdentityText(html, "legal-name")).toEqual(["Demo LLP"]);
  });

  it("parses JSON-LD and ignores broken JSON", () => {
    expect(findJsonLd(`<script type="application/ld+json">{"name":"A"}</script>`)).toEqual({ name: "A" });
    expect(findJsonLd(`<script type="application/ld+json">{oops</script>`)).toBeNull();
    expect(findJsonLd("<p>none</p>")).toBeNull();
  });

  it("flags forbidden placeholder text, and Demo Kitchen only when not a demo", () => {
    expect(forbiddenMatches("<p>Lorem ipsum dolor</p>", { allowDemo: false })).toContain("lorem ipsum");
    expect(forbiddenMatches("<p>TODO: fix</p>", { allowDemo: false })).toContain("TODO");
    expect(forbiddenMatches("<p>Coming Soon!</p>", { allowDemo: false })).toContain("coming soon");
    expect(forbiddenMatches(`<a href="https://example.com">x</a>`, { allowDemo: false })).toContain(
      "example.com",
    );
    expect(forbiddenMatches("<p>Welcome to your restaurant</p>", { allowDemo: false })).toContain(
      "your restaurant",
    );
    expect(forbiddenMatches("<p>Demo Kitchen</p>", { allowDemo: false })).toContain("Demo Kitchen");
    expect(forbiddenMatches("<p>Demo Kitchen</p>", { allowDemo: true })).toEqual([]);
    expect(forbiddenMatches(`<script>var todo = "lorem"</script><p>Fine</p>`, { allowDemo: false })).toEqual(
      [],
    );
  });

  it("validates tel and mailto links", () => {
    expect(isValidTelHref("tel:+912000000000")).toBe(true);
    expect(isValidTelHref("tel:020 2000")).toBe(false);
    expect(isValidTelHref("tel:")).toBe(false);
    expect(isValidMailtoHref("mailto:hello@shop.in")).toBe(true);
    expect(isValidMailtoHref("mailto:hello@")).toBe(false);
    expect(isValidMailtoHref("mailto:")).toBe(false);
  });

  it("reads sitemap locations", () => {
    expect(
      sitemapUrls(
        "<urlset><url><loc>https://x.in</loc></url><url><loc> https://x.in/a </loc></url></urlset>",
      ),
    ).toEqual(["https://x.in", "https://x.in/a"]);
  });
});

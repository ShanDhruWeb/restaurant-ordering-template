// Small, dependency-free HTML helpers for the compliance checker. They read the RAW
// HTML a crawler receives (no JavaScript is run), which is what Razorpay's automated
// checks see. Not a general HTML parser: it only needs to handle what this site renders.

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  rsquo: "’",
  lsquo: "‘",
  ndash: "–",
  mdash: "—",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** HTML without <script>, <style> and comments (attributes and tags are kept). */
export function stripScripts(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

/** The text a visitor would read: tags removed, entities decoded, spaces collapsed. */
export function htmlToText(html: string): string {
  return decodeEntities(stripScripts(html).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export type Attrs = Record<string, string>;

function parseAttrs(tag: string): Attrs {
  const attrs: Attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  const inner = tag.replace(/^<\w+/, "").replace(/\/?>$/, "");
  for (const m of inner.matchAll(re)) {
    attrs[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Attributes of every <name ...> tag in the page (scripts and comments ignored). */
export function findTags(html: string, name: string): Attrs[] {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return [...stripScripts(html).matchAll(re)].map((m) => parseAttrs(m[0]));
}

export function findTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]!).trim() : "";
}

export function findCanonical(html: string): string | null {
  return findTags(html, "link").find((t) => t.rel?.toLowerCase() === "canonical")?.href ?? null;
}

/** Content of <meta name|property="..."> or null. */
export function findMeta(html: string, key: string): string | null {
  const k = key.toLowerCase();
  const tag = findTags(html, "meta").find((t) => (t.name ?? t.property ?? "").toLowerCase() === k);
  return tag?.content ?? null;
}

export function hasNoindex(html: string): boolean {
  return findTags(html, "meta").some(
    (t) => (t.name ?? "").toLowerCase() === "robots" && /noindex/i.test(t.content ?? ""),
  );
}

export function findHrefs(html: string): string[] {
  return findTags(html, "a")
    .map((t) => t.href)
    .filter((h): h is string => Boolean(h));
}

/** <img> tags that have no alt attribute at all (alt="" marks a decorative image and is allowed). */
export function imagesWithoutAlt(html: string): Attrs[] {
  return findTags(html, "img").filter((t) => !("alt" in t));
}

/** Text of the elements marked data-identity="legal-name" / "trade-name" (rendered by the footer and receipt). */
export function findIdentityText(html: string, kind: "legal-name" | "trade-name"): string[] {
  const re = new RegExp(`<[a-z0-9]+[^>]*data-identity="${kind}"[^>]*>([\\s\\S]*?)</[a-z0-9]+>`, "gi");
  return [...stripScripts(html).matchAll(re)].map((m) => htmlToText(m[1]!));
}

/** The first JSON-LD block, parsed, or null. */
export function findJsonLd(html: string): Record<string, unknown> | null {
  const m = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(decodeEntities(m[1]!)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Visible-text placeholders that must never ship (case-insensitive). */
export const FORBIDDEN_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "lorem ipsum", re: /lorem ipsum|\blorem\b/i },
  { label: "TODO", re: /\bTODO\b/i },
  { label: "coming soon", re: /coming soon/i },
  { label: "example.com", re: /example\.com/i },
  { label: "your restaurant", re: /your restaurant/i },
];

export function forbiddenMatches(html: string, opts: { allowDemo: boolean }): string[] {
  const body = stripScripts(html);
  const text = htmlToText(html);
  const hits = FORBIDDEN_PATTERNS.filter((p) => p.re.test(text) || p.re.test(body)).map((p) => p.label);
  if (!opts.allowDemo && /demo kitchen/i.test(text)) hits.push("Demo Kitchen");
  return hits;
}

export function isValidTelHref(href: string): boolean {
  return /^tel:\+?\d{8,15}$/.test(href);
}

export function isValidMailtoHref(href: string): boolean {
  return /^mailto:[^\s@,;?]+@[^\s@,;?]+\.[^\s@,;?]+$/.test(href);
}

/** <loc> values of a sitemap.xml. */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]!));
}

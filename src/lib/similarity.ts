// Razorpay requires the checkout brand name to be at least 80% similar to the
// company name or the domain name. We do not know Razorpay's exact algorithm,
// so this is a close, simple stand-in used only to warn early.

/** Lowercase letters and digits only: "Demo Kitchen!" -> "demokitchen". */
export function normaliseName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** 0..1, where 1 means the names are identical after normalising. */
export function nameSimilarity(a: string, b: string): number {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

const COMPANY_SUFFIX =
  /\b(private limited|pvt\.? ?ltd\.?|limited|ltd\.?|llp|opc|\(fictional business\)|and company|& co\.?)\s*$/i;

/** "Spice Route Pvt Ltd" -> "Spice Route"; parentheses are dropped too. */
export function stripCompanySuffix(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "")
    .trim()
    .replace(COMPANY_SUFFIX, "")
    .trim();
}

/** "https://www.demokitchen.in" -> "demokitchen". Empty for localhost or invalid URLs. */
export function domainLabel(siteUrl: string): string {
  try {
    const host = new URL(siteUrl).hostname.replace(/^www\./, "");
    if (host === "localhost" || /^[\d.]+$/.test(host)) return "";
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

export const SIMILARITY_THRESHOLD = 0.8;

export interface NameMatch {
  ok: boolean;
  best: number;
}

/** Is the display name close enough to the legal name or the domain? */
export function displayNameMatches(displayName: string, legalName: string, siteUrl: string): NameMatch {
  const targets = [legalName, stripCompanySuffix(legalName), domainLabel(siteUrl)].filter(Boolean);
  const best = Math.max(0, ...targets.map((t) => nameSimilarity(displayName, t)));
  return { ok: best >= SIMILARITY_THRESHOLD, best };
}

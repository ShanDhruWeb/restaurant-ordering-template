// npm run compliance -- <baseUrl> [--no-order] [--site-url <canonicalUrl>]
// Crawls a RUNNING site (local production build or staging) like Razorpay's reviewer does
// and prints a pass/fail table. Exits 1 if any check fails.
//
// It compares the site with THIS checkout's restaurant.config.ts, so run it from the same
// code that is deployed. Unless --no-order is given it places one unpaid throw-away order
// (it expires by itself and never reaches the kitchen) to reach /order/[id] and its receipt.
import { tableLabels } from "@/config";
import { getIdentity, normaliseSiteUrl } from "@/lib/identity";
import { type CheckResult, type Expectations, runComplianceChecks } from "@/lib/complianceRun";
import { FOOTER_PAGES, PUBLIC_PAGES } from "@/lib/seo";

function parseArgs(argv: string[]) {
  const args = argv.slice(2).filter((a) => a !== "--");
  const flagValue = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const baseUrl = args.find((a, i) => /^https?:\/\//.test(a) && args[i - 1] !== "--site-url");
  return {
    baseUrl,
    siteUrl: flagValue("--site-url"),
    createOrder: !args.includes("--no-order"),
  };
}

const ICON = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" } as const;

function printTable(results: CheckResult[]) {
  const width = Math.min(52, Math.max(...results.map((r) => r.check.length)));
  for (const r of results) {
    const name = r.check.length > width ? r.check.slice(0, width - 1) + "…" : r.check.padEnd(width);
    console.log(`${ICON[r.status]}  ${name}  ${r.detail}`);
  }
}

async function main() {
  const { baseUrl, siteUrl, createOrder } = parseArgs(process.argv);
  if (!baseUrl) {
    console.error("Usage: npm run compliance -- <baseUrl> [--no-order] [--site-url <canonicalUrl>]");
    console.error("Example: npm run compliance -- https://staging.example-restaurant.in");
    process.exit(2);
  }
  const id = getIdentity();
  const siteOrigin = new URL(normaliseSiteUrl(siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? baseUrl)).origin;
  const exp: Expectations = {
    legalName: id.legalName,
    tradeName: id.tradeName,
    phone: id.phone,
    email: id.email,
    addressText: id.operatingAddressText,
    isDemo: id.isDemo,
    effectiveDateText: id.policiesEffectiveDateText,
    siteOrigin,
    publicPaths: PUBLIC_PAGES.map((p) => p.path),
    footerPaths: FOOTER_PAGES.map((p) => p.path),
    policyPaths: ["/terms", "/privacy", "/refunds", "/shipping"],
    aliases: [
      { from: "/cancellation-and-refunds", to: "/refunds" },
      { from: "/refund-policy", to: "/refunds" },
      { from: "/delivery-policy", to: "/shipping" },
    ],
    blockedPaths: ["/admin", "/api", "/order", "/checkout"],
    order: id.ordering.types.includes("takeaway")
      ? { type: "takeaway", table: null, phone: "9000000000" }
      : { type: "dine_in", table: tableLabels[0] ?? null, phone: "9000000000" },
  };

  console.log(`Compliance check: ${baseUrl}`);
  console.log(`Restaurant: ${id.tradeName} (${id.legalName}); canonical origin ${siteOrigin}\n`);
  const results = await runComplianceChecks(baseUrl, exp, { createOrder });
  printTable(results);

  const count = (s: CheckResult["status"]) => results.filter((r) => r.status === s).length;
  console.log(
    `\n${count("pass")} passed, ${count("fail")} failed, ${count("warn")} warnings, ${count("skip")} skipped.`,
  );
  if (count("fail") > 0) {
    console.log("Not ready: fix every FAIL above, then run this again.");
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

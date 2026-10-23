// Business details (name, address, phone, email, tax numbers, policies, payment display
// name) may only be read through src/lib/identity.ts. This test fails if any other file
// reaches into those parts of the config directly, or hard-codes the demo restaurant.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import rawConfig from "@config";

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "generated" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");
const ALLOWED = new Set(["src/lib/identity.ts", "src/lib/compliance.ts"]);
const files = walk(path.join(ROOT, "src")).filter(
  (f) => !rel(f).startsWith("src/config/") && !ALLOWED.has(rel(f)),
);

describe("identity module is the only reader of business details", () => {
  it("scans a sensible number of files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no other file reads config.restaurant / legal / payments / policies", () => {
    const offenders = files.filter((f) =>
      /\bconfig\s*\.\s*(restaurant|legal|payments|policies)\b|businessLegalName|\.checkoutDisplayName\b.*config/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("no source file imports restaurant.config.ts directly", () => {
    const offenders = files.filter((f) =>
      /from\s+["']@config["']|from\s+["'][^"']*restaurant\.config["']/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("no source file hard-codes the demo restaurant's details", () => {
    const cfg = rawConfig as unknown as {
      restaurant: { name: string; phone: string; email: string; address: { line1: string; pincode: string } };
      legal: { businessLegalName: string };
    };
    const needles = [
      cfg.restaurant.name,
      cfg.legal.businessLegalName,
      cfg.restaurant.phone,
      cfg.restaurant.email,
      cfg.restaurant.address.line1,
      cfg.restaurant.address.pincode,
      "QueLessly",
      "Daily Grit",
    ];
    const offenders = files.flatMap((f) =>
      needles.filter((n) => readFileSync(f, "utf8").includes(n)).map((n) => `${rel(f)}: ${n}`),
    );
    expect(offenders).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("security headers", async () => {
  const rules = await nextConfig.headers!();
  const all = rules.find((r) => r.source === "/:path*")!.headers;
  const get = (k: string) => all.find((h) => h.key === k)?.value ?? "";

  it("sets a CSP that allows Razorpay Checkout and blocks framing", () => {
    const csp = get("Content-Security-Policy");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("https://checkout.razorpay.com");
    expect(csp).toMatch(/frame-src [^;]*https:\/\/api\.razorpay\.com/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("sets HSTS, nosniff and a referrer policy", () => {
    expect(get("Strict-Transport-Security")).toContain("max-age=");
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
  it("marks /admin as noindex", () => {
    const admin = rules.find((r) => r.source === "/admin/:path*")!;
    expect(admin.headers.find((h) => h.key === "X-Robots-Tag")?.value).toContain("noindex");
  });
});

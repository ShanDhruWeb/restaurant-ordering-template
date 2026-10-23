import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// Wrap timingSafeEqual in a spy so we can prove the constant-time path is used.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});
import {
  hmacSha256Hex,
  safeEqualHex,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "@/server/payments/signature";

const keySecret = "test_key_secret";
const ids = { razorpayOrderId: "order_ABC123", razorpayPaymentId: "pay_XYZ789" };
const goodSig = createHmac("sha256", keySecret).update("order_ABC123|pay_XYZ789").digest("hex");

describe("checkout signature", () => {
  it("accepts a valid signature (Razorpay's documented formula)", () => {
    expect(verifyCheckoutSignature({ ...ids, signature: goodSig }, keySecret)).toBe(true);
  });
  it("accepts uppercase hex", () => {
    expect(verifyCheckoutSignature({ ...ids, signature: goodSig.toUpperCase() }, keySecret)).toBe(true);
  });
  it("rejects a tampered signature", () => {
    const tampered = (goodSig[0] === "a" ? "b" : "a") + goodSig.slice(1);
    expect(verifyCheckoutSignature({ ...ids, signature: tampered }, keySecret)).toBe(false);
  });
  it("rejects tampered ids", () => {
    expect(
      verifyCheckoutSignature({ ...ids, razorpayPaymentId: "pay_OTHER", signature: goodSig }, keySecret),
    ).toBe(false);
    expect(
      verifyCheckoutSignature({ ...ids, razorpayOrderId: "order_OTHER", signature: goodSig }, keySecret),
    ).toBe(false);
  });
  it("rejects the wrong length, non-hex and empty input without throwing", () => {
    for (const sig of ["", "abc", goodSig.slice(0, 63), goodSig + "0", "z".repeat(64), goodSig + goodSig]) {
      expect(verifyCheckoutSignature({ ...ids, signature: sig }, keySecret)).toBe(false);
    }
  });
  it("rejects when the secret is empty", () => {
    expect(verifyCheckoutSignature({ ...ids, signature: goodSig }, "")).toBe(false);
  });
});

describe("webhook signature", () => {
  const secret = "whsec";
  const body = '{"event":"payment.captured","payload":{}}';
  const sig = hmacSha256Hex(secret, body);
  it("accepts the signature of the exact raw body", () => {
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });
  it("rejects if a single byte of the body changes (e.g. re-serialised JSON)", () => {
    expect(verifyWebhookSignature(body.replace(":", ": "), sig, secret)).toBe(false);
  });
  it("rejects a missing header or wrong secret", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "other")).toBe(false);
  });
});

describe("constant-time comparison", () => {
  it("uses crypto.timingSafeEqual for well-formed input", () => {
    vi.mocked(timingSafeEqual).mockClear();
    expect(safeEqualHex(goodSig, goodSig)).toBe(true);
    expect(verifyCheckoutSignature({ ...ids, signature: goodSig }, keySecret)).toBe(true);
    expect(timingSafeEqual).toHaveBeenCalledTimes(2);
  });
  it("never throws on length mismatch (timingSafeEqual would)", () => {
    expect(() => safeEqualHex(goodSig, "ab")).not.toThrow();
    expect(safeEqualHex(goodSig, "ab")).toBe(false);
  });
});

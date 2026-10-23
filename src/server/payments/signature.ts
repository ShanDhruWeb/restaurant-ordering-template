// Razorpay signature checks. Always compared in constant time so an attacker
// cannot learn the right signature byte by byte from response timings.
import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

/** Constant-time comparison of two hex SHA-256 digests. False for anything malformed. */
export function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(expectedHex) || !/^[0-9a-f]{64}$/i.test(receivedHex)) return false;
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(receivedHex.toLowerCase(), "hex");
  // Both are exactly 32 bytes here, so timingSafeEqual never throws.
  return timingSafeEqual(a, b);
}

/** Checkout handler signature: HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret). */
export function verifyCheckoutSignature(
  args: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
  keySecret: string,
): boolean {
  if (!keySecret) return false;
  const expected = hmacSha256Hex(keySecret, `${args.razorpayOrderId}|${args.razorpayPaymentId}`);
  return safeEqualHex(expected, args.signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret) from X-Razorpay-Signature. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): boolean {
  if (!webhookSecret || !signature) return false;
  return safeEqualHex(hmacSha256Hex(webhookSecret, rawBody), signature);
}

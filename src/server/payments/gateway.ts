// The payment gateway, behind an interface so the whole flow can run against a
// local mock (RAZORPAY_MOCK=true) or the real Razorpay API with no other changes.
import "server-only";
import { getEnv } from "@/lib/env";
import { MockGateway } from "./mockGateway";
import { RazorpayGateway } from "./razorpayGateway";
import type { PaymentGateway } from "./types";

export * from "./types";

let override: PaymentGateway | undefined;

export function getGateway(): PaymentGateway {
  if (override) return override;
  const { razorpay } = getEnv();
  return razorpay.mode === "mock"
    ? new MockGateway()
    : new RazorpayGateway(razorpay.keyId, razorpay.keySecret, razorpay.mode);
}

/** Tests only. */
export function setGatewayForTests(gateway: PaymentGateway | undefined): void {
  override = gateway;
}

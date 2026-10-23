// Builds Razorpay-shaped webhook requests signed with a given secret.
// Used by the mock gateway (dev) and by the tests. Payload shape follows
// https://razorpay.com/docs/webhooks/payments/ (no checkout signature inside).
import { randomBytes } from "node:crypto";
import { hmacSha256Hex } from "./signature";

export interface MockPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  currency?: string;
  status: "captured" | "failed" | "refunded";
  method?: string;
  error_description?: string | null;
  amount_refunded?: number;
}

export function buildWebhook(
  event: "payment.captured" | "order.paid" | "payment.failed" | "refund.processed",
  payment: MockPaymentEntity,
  secret: string,
  opts: { eventId?: string; refund?: { id: string; amount: number } } = {},
) {
  const body = JSON.stringify({
    entity: "event",
    account_id: "acc_mock",
    event,
    contains: opts.refund ? ["refund", "payment"] : ["payment"],
    payload: {
      ...(opts.refund
        ? {
            refund: {
              entity: {
                id: opts.refund.id,
                entity: "refund",
                payment_id: payment.id,
                amount: opts.refund.amount,
                currency: "INR",
                status: "processed",
              },
            },
          }
        : {}),
      payment: {
        entity: {
          entity: "payment",
          currency: "INR",
          method: "upi",
          amount_refunded: 0,
          captured: payment.status === "captured",
          error_description: null,
          created_at: Math.floor(Date.now() / 1000),
          ...payment,
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  });
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": hmacSha256Hex(secret, body),
      "x-razorpay-event-id": opts.eventId ?? `evt_mock${randomBytes(7).toString("hex")}`,
    },
  };
}

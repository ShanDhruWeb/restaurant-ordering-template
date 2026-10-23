// Razorpay webhook processing. The route (src/app/api/webhooks/razorpay/route.ts)
// passes the RAW body and headers here.
//
// Rules (see docs/DECISIONS.md):
// - Verify X-Razorpay-Signature over the raw body; reject with 400 otherwise.
// - Process BEFORE replying. Any thrown error becomes a 5xx so Razorpay retries.
// - 200 only when handled, a duplicate, or an event we safely ignore.
// - Webhook payments carry no checkout signature: the webhook signature is the
//   proof, and we match the payment to our order by its Razorpay order id.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { markOrderPaid, recordFailedPayment, recordRefund } from "./confirm";
import { verifyWebhookSignature } from "./signature";

const paymentEntity = z.object({
  id: z.string(),
  order_id: z.string().nullable().optional(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  method: z.string().nullable().optional(),
  error_description: z.string().nullable().optional(),
  amount_refunded: z.number().int().optional(),
});

const eventSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({ entity: paymentEntity }).optional(),
    refund: z
      .object({ entity: z.object({ id: z.string(), payment_id: z.string(), amount: z.number().int() }) })
      .optional(),
  }),
});

export type WebhookResult = { status: 200 | 400; body: { ok: boolean; result: string } };

export async function handleRazorpayWebhook(args: {
  rawBody: string;
  signature: string | null;
  eventIdHeader: string | null;
}): Promise<WebhookResult> {
  const { webhookSecret } = getEnv().razorpay;
  if (!verifyWebhookSignature(args.rawBody, args.signature, webhookSecret)) {
    log.warn("webhook rejected: bad signature");
    return { status: 400, body: { ok: false, result: "invalid_signature" } };
  }

  let event: z.infer<typeof eventSchema>;
  try {
    event = eventSchema.parse(JSON.parse(args.rawBody));
  } catch {
    // Correctly signed but not a shape we understand: retrying will not help.
    log.error("webhook: signed payload could not be parsed");
    return { status: 200, body: { ok: true, result: "ignored_unparseable" } };
  }

  const payment = event.payload.payment?.entity;
  const refund = event.payload.refund?.entity;
  // Prefer Razorpay's unique event id header; fall back to type + entity id.
  const eventId =
    args.eventIdHeader?.slice(0, 100) || `${event.event}:${refund?.id ?? payment?.id ?? "none"}`;

  const seen = await prisma.webhookEvent.findUnique({ where: { eventId } });
  if (seen?.processedAt) {
    log.info("webhook duplicate", { eventId, type: event.event });
    return { status: 200, body: { ok: true, result: "duplicate" } };
  }

  const result = await processEvent(event.event, payment, refund);

  await prisma.webhookEvent.upsert({
    where: { eventId },
    create: { eventId, type: event.event, processedAt: new Date() },
    update: { processedAt: new Date() },
  });
  log.info("webhook processed", {
    eventId,
    type: event.event,
    razorpayPaymentId: payment?.id,
    razorpayOrderId: payment?.order_id,
    result,
  });
  return { status: 200, body: { ok: true, result } };
}

async function processEvent(
  type: string,
  payment: z.infer<typeof paymentEntity> | undefined,
  refund: { id: string; payment_id: string; amount: number } | undefined,
): Promise<string> {
  switch (type) {
    case "payment.captured":
    case "order.paid": {
      if (!payment?.order_id) return "ignored_no_order_id";
      if (payment.status !== "captured") return "ignored_not_captured";
      const r = await markOrderPaid({
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount,
        currency: payment.currency,
        method: payment.method,
        source: "webhook",
      });
      return r.outcome;
    }
    case "payment.failed": {
      if (!payment?.order_id) return "ignored_no_order_id";
      await recordFailedPayment({
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount,
        currency: payment.currency,
        method: payment.method,
        reason: payment.error_description,
        source: "webhook",
      });
      return "failed_recorded";
    }
    case "refund.processed": {
      const paymentId = refund?.payment_id ?? payment?.id;
      if (!paymentId) return "ignored_no_payment_id";
      await recordRefund({
        razorpayPaymentId: paymentId,
        // The payment entity carries the cumulative refunded amount.
        totalRefundedPaise: payment?.amount_refunded ?? refund?.amount ?? 0,
      });
      return "refund_recorded";
    }
    default:
      return "ignored_event_type";
  }
}

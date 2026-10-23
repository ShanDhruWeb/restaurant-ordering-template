// Recording payments against orders. markOrderPaid is the ONLY code that marks an
// order paid, and it is called from three places: the browser verify endpoint,
// the Razorpay webhook and the reconcile check. It is idempotent: any number of
// calls, even at the same moment, give one paid order, one paidAt and one new
// order for the kitchen.
import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

export type PaymentSource = "verify" | "webhook" | "reconcile";

export interface CapturedPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  currency: string;
  method?: string | null;
  source: PaymentSource;
}

export type MarkPaidOutcome =
  | "paid" // this call marked the order paid
  | "already_paid" // the order was already paid by this same payment
  | "late_payment" // order had expired or was cancelled: payment recorded and flagged
  | "duplicate_payment" // order was already paid by a DIFFERENT payment: flagged for refund
  | "amount_mismatch" // amount or currency wrong: NOT marked paid, flagged
  | "unknown_order"; // no order uses this Razorpay order id: recorded, flagged

export interface MarkPaidResult {
  outcome: MarkPaidOutcome;
  orderId: string | null;
}

export async function markOrderPaid(input: CapturedPaymentInput, now = new Date()): Promise<MarkPaidResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
      select: { id: true, totalPaise: true },
    });

    const amountOk = order !== null && input.currency === "INR" && input.amountPaise === order.totalPaise;
    const paymentStatus = order && !amountOk ? "mismatch" : "captured";

    // Native INSERT ... ON CONFLICT, safe under concurrency. A captured payment can
    // follow a failed one for the same id (Razorpay late authorisation), so we
    // upgrade the status; we never downgrade a capture.
    await tx.payment.upsert({
      where: { razorpayPaymentId: input.razorpayPaymentId },
      create: {
        razorpayPaymentId: input.razorpayPaymentId,
        razorpayOrderId: input.razorpayOrderId,
        orderId: order?.id ?? null,
        amountPaise: input.amountPaise,
        currency: input.currency,
        status: paymentStatus,
        method: input.method ?? null,
        source: input.source,
      },
      update: {
        status: paymentStatus,
        amountPaise: input.amountPaise,
        currency: input.currency,
        method: input.method ?? undefined,
        failureReason: null,
      },
    });

    if (!order) return { outcome: "unknown_order" as const, orderId: null };
    if (!amountOk) return { outcome: "amount_mismatch" as const, orderId: order.id };

    const paidData = { paymentStatus: "paid" as const, paidAt: now, paidPaymentId: input.razorpayPaymentId };

    // Conditional updates: Postgres locks the row, so only ONE concurrent call can
    // match "not paid yet". Everyone else gets count 0.
    const normal = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: { not: "paid" }, status: "pending_payment" },
      data: { ...paidData, status: "paid" },
    });
    if (normal.count === 1) return { outcome: "paid" as const, orderId: order.id };

    const late = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: { not: "paid" }, status: { in: ["expired", "cancelled"] } },
      data: { ...paidData, latePayment: true },
    });
    if (late.count === 1) return { outcome: "late_payment" as const, orderId: order.id };

    const current = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { paidPaymentId: true },
    });
    return current.paidPaymentId === input.razorpayPaymentId
      ? { outcome: "already_paid" as const, orderId: order.id }
      : { outcome: "duplicate_payment" as const, orderId: order.id };
  });

  const fields = {
    orderId: result.orderId,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    amountPaise: input.amountPaise,
    currency: input.currency,
    source: input.source,
    outcome: result.outcome,
  };
  if (result.outcome === "paid" || result.outcome === "already_paid") log.info("payment confirmed", fields);
  else log.error("payment needs attention", fields);
  return result;
}

/** A payment attempt failed. The order stays payable; the customer can retry. */
export async function recordFailedPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  currency: string;
  method?: string | null;
  reason?: string | null;
  source: PaymentSource;
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { razorpayOrderId: input.razorpayOrderId },
    select: { id: true },
  });
  // update: {} -> a failure never overwrites a payment we already know about
  // (in particular, never a capture).
  await prisma.payment.upsert({
    where: { razorpayPaymentId: input.razorpayPaymentId },
    create: {
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      orderId: order?.id ?? null,
      amountPaise: input.amountPaise,
      currency: input.currency,
      status: "failed",
      method: input.method ?? null,
      failureReason: input.reason?.slice(0, 300) ?? null,
      source: input.source,
    },
    update: {},
  });
  if (order) {
    await prisma.order.updateMany({
      where: { id: order.id, paymentStatus: "unpaid" },
      data: { paymentStatus: "failed" },
    });
  }
  log.warn("payment failed", {
    orderId: order?.id ?? null,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    source: input.source,
  });
}

/**
 * A refund was processed in the Razorpay dashboard. totalRefundedPaise is the
 * payment's cumulative refunded amount as reported by Razorpay.
 */
export async function recordRefund(input: {
  razorpayPaymentId: string;
  totalRefundedPaise: number;
}): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayPaymentId: input.razorpayPaymentId },
    select: { id: true, orderId: true, refundedPaise: true },
  });
  if (!payment) {
    log.warn("refund for a payment we do not know", { razorpayPaymentId: input.razorpayPaymentId });
    return;
  }
  // Webhooks can arrive out of order: only ever move the refunded total up.
  if (input.totalRefundedPaise > payment.refundedPaise) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { refundedPaise: input.totalRefundedPaise },
    });
  }
  if (!payment.orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    select: { id: true, totalPaise: true, paidPaymentId: true },
  });
  // A refund of a duplicate payment does not change the order itself.
  if (!order || order.paidPaymentId !== input.razorpayPaymentId) return;

  const refunded = Math.max(input.totalRefundedPaise, payment.refundedPaise);
  await prisma.order.update({
    where: { id: order.id },
    data: { refundedPaise: refunded, refundStatus: refunded >= order.totalPaise ? "refunded" : "partial" },
  });
  log.info("refund recorded", { orderId: order.id, razorpayPaymentId: input.razorpayPaymentId, refunded });
}

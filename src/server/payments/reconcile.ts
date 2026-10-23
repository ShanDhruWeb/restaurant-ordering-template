// Asking Razorpay directly, so no payment is ever lost even if the browser never
// came back (UPI app switch, closed tab) and the webhook never arrived.
import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { markOrderPaid, recordFailedPayment } from "./confirm";
import { getGateway, wasCaptured } from "./gateway";

export interface ReconcileOrderResult {
  checked: boolean;
  paid: boolean;
  outcomes: string[];
}

/**
 * For an unpaid order that has a Razorpay order: fetch its payments from Razorpay
 * and record them. Captured -> markOrderPaid (idempotent). Throws GatewayError if
 * Razorpay cannot be reached; callers decide whether that matters.
 */
export async function reconcileOrder(orderId: string): Promise<ReconcileOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { razorpayOrderId: true, paymentStatus: true },
  });
  if (!order?.razorpayOrderId || order.paymentStatus === "paid") {
    return { checked: false, paid: order?.paymentStatus === "paid", outcomes: [] };
  }
  const payments = await getGateway().fetchOrderPayments(order.razorpayOrderId);
  const outcomes: string[] = [];
  let paid = false;
  for (const p of payments) {
    if (wasCaptured(p)) {
      const r = await markOrderPaid({
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: p.id,
        amountPaise: p.amountPaise,
        currency: p.currency,
        method: p.method,
        source: "reconcile",
      });
      outcomes.push(r.outcome);
      if (r.outcome === "paid" || r.outcome === "already_paid" || r.outcome === "late_payment") paid = true;
    } else if (p.status === "failed") {
      await recordFailedPayment({
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: p.id,
        amountPaise: p.amountPaise,
        currency: p.currency,
        method: p.method,
        reason: p.errorDescription,
        source: "reconcile",
      });
      outcomes.push("failed");
    }
  }
  return { checked: true, paid, outcomes };
}

/** Mark ONE order expired if it is still unpaid and past its expiry time. */
export async function expireIfStale(orderId: string, now = new Date()): Promise<boolean> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: "pending_payment", paymentStatus: { not: "paid" }, expiresAt: { lt: now } },
    data: { status: "expired" },
  });
  return count === 1;
}

export interface SweepResult {
  checked: number;
  paidFound: number;
  expired: number;
  errors: number;
  problems: number;
}

/**
 * The background sweep (cron, `npm run reconcile`, and the admin board while open):
 * 1. reconcile every unpaid order from the last 24 hours that has a Razorpay order
 *    (this also catches payments that land after the order expired);
 * 2. expire stale unpaid orders, AFTER the final check above;
 * 3. record a problem count for the admin banner.
 */
export async function sweep(now = new Date(), maxOrders = 200): Promise<SweepResult> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const candidates = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      paymentStatus: { not: "paid" },
      razorpayOrderId: { not: null },
      status: { in: ["pending_payment", "expired", "cancelled"] },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: maxOrders,
  });

  const result: SweepResult = { checked: 0, paidFound: 0, expired: 0, errors: 0, problems: 0 };
  for (const c of candidates) {
    try {
      const r = await reconcileOrder(c.id);
      if (r.checked) result.checked++;
      if (r.paid) result.paidFound++;
    } catch (err) {
      result.errors++;
      log.error("sweep: reconcile failed", { orderId: c.id, err });
    }
  }

  // Expire only orders we could check (or that never started paying). If Razorpay
  // was unreachable for an order, leave it pending for the next sweep.
  const stale = await prisma.order.findMany({
    where: { status: "pending_payment", paymentStatus: { not: "paid" }, expiresAt: { lt: now } },
    select: { id: true, razorpayOrderId: true },
    take: 500,
  });
  for (const s of stale) {
    if (s.razorpayOrderId && result.errors > 0) continue;
    if (await expireIfStale(s.id, now)) result.expired++;
  }

  result.problems = await countPaymentProblems();
  await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, lastReconcileAt: now, lastReconcileProblems: result.problems },
    update: {
      lastReconcileAt: now,
      lastReconcileProblems: result.problems,
      lastReconcileSummary: summary(result),
    },
  });
  log.info("sweep done", { ...result });
  return result;
}

function summary(r: SweepResult): string {
  const parts = [`checked ${r.checked}`, `recovered ${r.paidFound}`, `expired ${r.expired}`];
  if (r.errors) parts.push(`${r.errors} could not reach Razorpay`);
  if (r.problems) parts.push(`${r.problems} need attention`);
  return parts.join(", ");
}

/** Things staff must look at on /admin/payments. Cheap: database only. */
export async function countPaymentProblems(): Promise<number> {
  const [late, mismatch, orphan, refundsNeeded, duplicates] = await Promise.all([
    prisma.order.count({
      where: { latePayment: true, status: { in: ["expired", "cancelled"] }, refundStatus: "none" },
    }),
    prisma.payment.count({ where: { status: "mismatch" } }),
    prisma.payment.count({ where: { status: "captured", orderId: null } }),
    prisma.order.count({ where: { refundStatus: "needed" } }),
    countDuplicatePayments(),
  ]);
  return late + mismatch + orphan + refundsNeeded + duplicates;
}

async function countDuplicatePayments(): Promise<number> {
  const captured = await prisma.payment.findMany({
    where: {
      status: "captured",
      orderId: { not: null },
      refundedPaise: 0,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { razorpayPaymentId: true, order: { select: { paidPaymentId: true } } },
  });
  return captured.filter((p) => p.order && p.order.paidPaymentId !== p.razorpayPaymentId).length;
}

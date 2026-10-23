// The /admin/payments report: everything about money that staff must look at.
//   1. Captured payments in Razorpay with no paid order here
//   2. Paid orders here with no captured payment in Razorpay
//   3. Late payments (paid after the order expired or was cancelled)
//   4. Amount mismatches
//   5. Duplicate payments (an order paid twice)
//   6. Cancelled paid orders still waiting for a refund
import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { type GatewayPayment, getGateway, wasCaptured } from "../payments/gateway";

export interface PaymentHealth {
  range: { from: string; to: string };
  gatewayError: string | null;
  capturedWithoutOrder: {
    razorpayPaymentId: string;
    razorpayOrderId: string | null;
    amountPaise: number;
    createdAt: string;
  }[];
  paidWithoutCapture: { orderId: string; dailyNumber: number; numberDate: string; totalPaise: number }[];
  latePayments: OrderRef[];
  mismatches: {
    razorpayPaymentId: string;
    amountPaise: number;
    currency: string;
    orderId: string | null;
    orderTotalPaise: number | null;
  }[];
  duplicates: { razorpayPaymentId: string; amountPaise: number; orderId: string; dailyNumber: number }[];
  refundsNeeded: OrderRef[];
}

interface OrderRef {
  orderId: string;
  dailyNumber: number;
  numberDate: string;
  status: string;
  totalPaise: number;
  customerName: string;
  customerPhone: string | null;
}

const orderRef = {
  id: true,
  dailyNumber: true,
  numberDate: true,
  status: true,
  totalPaise: true,
  customerName: true,
  customerPhone: true,
} as const;

function toRef(o: {
  id: string;
  dailyNumber: number;
  numberDate: string;
  status: string;
  totalPaise: number;
  customerName: string;
  customerPhone: string | null;
}): OrderRef {
  return {
    orderId: o.id,
    dailyNumber: o.dailyNumber,
    numberDate: o.numberDate,
    status: o.status,
    totalPaise: o.totalPaise,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
  };
}

export async function getPaymentHealth(range: { from: Date; to: Date }): Promise<PaymentHealth> {
  let gatewayPayments: GatewayPayment[] = [];
  let gatewayError: string | null = null;
  try {
    gatewayPayments = await getGateway().listPayments(range);
  } catch (err) {
    gatewayError = "Could not reach Razorpay. Showing only what is in our database.";
    log.error("payment health: listPayments failed", { err });
  }

  const captured = gatewayPayments.filter(wasCaptured);
  const capturedIds = captured.map((p) => p.id);

  const [ourPaidOrders, knownPayments, late, mismatches, refundsNeeded, dupCandidates] = await Promise.all([
    prisma.order.findMany({
      where: { paidAt: { gte: range.from, lte: range.to }, paymentStatus: "paid" },
      select: { id: true, dailyNumber: true, numberDate: true, totalPaise: true, paidPaymentId: true },
    }),
    prisma.payment.findMany({
      where: { razorpayPaymentId: { in: capturedIds } },
      select: { razorpayPaymentId: true, orderId: true, order: { select: { paymentStatus: true } } },
    }),
    prisma.order.findMany({
      where: {
        latePayment: true,
        status: { in: ["expired", "cancelled"] },
        refundStatus: { in: ["none", "needed"] },
      },
      select: orderRef,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.findMany({
      where: { status: "mismatch" },
      select: {
        razorpayPaymentId: true,
        amountPaise: true,
        currency: true,
        orderId: true,
        order: { select: { totalPaise: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.findMany({
      where: { refundStatus: "needed" },
      select: orderRef,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.findMany({
      where: {
        status: "captured",
        orderId: { not: null },
        refundedPaise: 0,
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        razorpayPaymentId: true,
        amountPaise: true,
        orderId: true,
        order: { select: { paidPaymentId: true, dailyNumber: true } },
      },
    }),
  ]);

  // 1. Razorpay says captured, but we have no paid order for it.
  const known = new Map(knownPayments.map((p) => [p.razorpayPaymentId, p]));
  const capturedWithoutOrder = captured
    .filter((p) => {
      const k = known.get(p.id);
      return !k || !k.orderId || k.order?.paymentStatus !== "paid";
    })
    .map((p) => ({
      razorpayPaymentId: p.id,
      razorpayOrderId: p.orderId,
      amountPaise: p.amountPaise,
      createdAt: p.createdAt.toISOString(),
    }));

  // 2. We say paid, but Razorpay has no captured payment for it (only checkable if Razorpay answered).
  const capturedSet = new Set(capturedIds);
  const paidWithoutCapture = gatewayError
    ? []
    : ourPaidOrders
        .filter((o) => !o.paidPaymentId || !capturedSet.has(o.paidPaymentId))
        .map((o) => ({
          orderId: o.id,
          dailyNumber: o.dailyNumber,
          numberDate: o.numberDate,
          totalPaise: o.totalPaise,
        }));

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    gatewayError,
    capturedWithoutOrder,
    paidWithoutCapture,
    latePayments: late.map(toRef),
    mismatches: mismatches.map((m) => ({
      razorpayPaymentId: m.razorpayPaymentId,
      amountPaise: m.amountPaise,
      currency: m.currency,
      orderId: m.orderId,
      orderTotalPaise: m.order?.totalPaise ?? null,
    })),
    duplicates: dupCandidates
      .filter((p) => p.order && p.order.paidPaymentId !== p.razorpayPaymentId)
      .map((p) => ({
        razorpayPaymentId: p.razorpayPaymentId,
        amountPaise: p.amountPaise,
        orderId: p.orderId!,
        dailyNumber: p.order!.dailyNumber,
      })),
    refundsNeeded: refundsNeeded.map(toRef),
  };
}

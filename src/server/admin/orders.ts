// Kitchen board and order actions for staff.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { log } from "@/lib/log";
import type { OrderStatus } from "@/lib/orderTypes";
import { istDayRange, istDateString } from "@/lib/time";
import { canTransition, nextKitchenStatus } from "../orders/stateMachine";
import { audit } from "./audit";
import type { Admin } from "./guard";

const boardSelect = {
  id: true,
  dailyNumber: true,
  status: true,
  type: true,
  tableLabel: true,
  customerName: true,
  customerPhone: true,
  note: true,
  totalPaise: true,
  paidAt: true,
  createdAt: true,
  acknowledgedAt: true,
  latePayment: true,
  refundStatus: true,
  items: { select: { nameSnapshot: true, quantity: true, isVeg: true }, orderBy: { id: "asc" } },
} as const;

export type BoardOrder = Awaited<ReturnType<typeof getBoard>>["orders"][number];

/** PAID orders the kitchen still has to deal with, plus today's stats and alerts. */
export async function getBoard(now = new Date()) {
  const { start, end } = istDayRange(istDateString(now));
  const [orders, settings, todayPaid] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["paid", "preparing", "ready"] } },
      orderBy: { paidAt: "asc" },
      select: boardSelect,
      take: 200,
    }),
    prisma.setting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.order.aggregate({
      where: { paidAt: { gte: start, lt: end }, paymentStatus: "paid" },
      _count: true,
      _sum: { totalPaise: true },
    }),
  ]);
  return {
    orders: orders.map((o) => ({
      ...o,
      paidAt: o.paidAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      acknowledgedAt: o.acknowledgedAt?.toISOString() ?? null,
    })),
    acceptingOrders: settings.acceptingOrders,
    reconcileProblems: settings.lastReconcileProblems,
    lastReconcileAt: settings.lastReconcileAt?.toISOString() ?? null,
    today: { count: todayPaid._count, totalPaise: todayPaid._sum.totalPaise ?? 0 },
    serverTime: now.toISOString(),
  };
}

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge") }).strict(),
  z.object({ action: z.literal("advance"), from: z.enum(["paid", "preparing", "ready"]) }).strict(),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(200).optional() }).strict(),
  // Staff decide to cook a late payment on an expired order.
  z.object({ action: z.literal("accept_late") }).strict(),
  // Staff confirm they refunded a late/duplicate payment in the Razorpay dashboard.
  z.object({ action: z.literal("mark_refund_needed") }).strict(),
]);

export async function applyOrderAction(
  admin: Admin,
  orderId: string,
  input: z.infer<typeof orderActionSchema>,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentStatus: true, latePayment: true, refundStatus: true },
  });
  if (!order) throw new HttpError(404, "Order not found.", "not_found");

  const change = async (to: OrderStatus, extra: Record<string, unknown> = {}, expected = order.status) => {
    if (!canTransition(expected, to)) {
      throw new HttpError(409, "This order has already changed. The board will refresh.", "conflict");
    }
    // Conditional update: if another tablet changed the order first, nothing happens.
    const { count } = await prisma.order.updateMany({
      where: { id: order.id, status: expected },
      data: { status: to, ...extra },
    });
    if (count !== 1)
      throw new HttpError(409, "This order has already changed. The board will refresh.", "conflict");
    await audit(admin, {
      action: `order.${input.action}`,
      entityType: "Order",
      entityId: order.id,
      oldValue: { status: expected },
      newValue: { status: to, ...extra },
    });
    log.info("order status changed", { orderId: order.id, from: expected, to, by: admin.email });
  };

  switch (input.action) {
    case "acknowledge":
      await prisma.order.updateMany({
        where: { id: order.id, acknowledgedAt: null },
        data: { acknowledgedAt: new Date() },
      });
      return;
    case "advance": {
      const to = nextKitchenStatus(input.from);
      if (!to) throw new HttpError(409, "Nothing to advance.", "conflict");
      return change(to, { acknowledgedAt: new Date() }, input.from);
    }
    case "cancel":
      // A paid order being cancelled needs a refund from the Razorpay dashboard.
      return change("cancelled", {
        cancelReason: input.reason || null,
        refundStatus:
          order.paymentStatus === "paid" && order.refundStatus === "none" ? "needed" : order.refundStatus,
      });
    case "accept_late":
      if (order.status !== "expired" || !order.latePayment || order.paymentStatus !== "paid") {
        throw new HttpError(409, "Only a paid, expired order can be accepted.", "conflict");
      }
      return change("paid", { acknowledgedAt: null });
    case "mark_refund_needed":
      if (order.paymentStatus !== "paid" || order.refundStatus !== "none") {
        throw new HttpError(409, "No refund to arrange for this order.", "conflict");
      }
      await prisma.order.update({ where: { id: order.id }, data: { refundStatus: "needed" } });
      await audit(admin, {
        action: "order.mark_refund_needed",
        entityType: "Order",
        entityId: order.id,
        oldValue: { refundStatus: "none" },
        newValue: { refundStatus: "needed" },
      });
      return;
  }
}

/** Full detail for one order (staff only). */
export async function getAdminOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          razorpayPaymentId: true,
          amountPaise: true,
          status: true,
          method: true,
          failureReason: true,
          source: true,
          refundedPaise: true,
          createdAt: true,
        },
      },
    },
  });
}

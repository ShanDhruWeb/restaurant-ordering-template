// Starting (or retrying) payment for an order: POST /api/orders/:id/pay.
// Every attempt for an order uses the SAME Razorpay order, so whichever attempt
// the customer finally pays with can always be matched back to our order.
import "server-only";
import { config } from "@/config";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { log } from "@/lib/log";
import { getGateway } from "./gateway";
import { expireIfStale, reconcileOrder } from "./reconcile";

export type StartPaymentResult =
  | { status: "already_paid" }
  | {
      status: "ready";
      mode: "mock" | "test" | "live";
      keyId: string;
      razorpayOrderId: string;
      amountPaise: number;
      currency: "INR";
      name: string;
      description: string;
      prefill: { name: string; contact: string };
    };

export async function startPayment(orderId: string, now = new Date()): Promise<StartPaymentResult> {
  let order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      dailyNumber: true,
      status: true,
      paymentStatus: true,
      totalPaise: true,
      expiresAt: true,
      razorpayOrderId: true,
      customerName: true,
      customerPhone: true,
    },
  });
  if (!order) throw new HttpError(404, "Order not found.", "not_found");
  if (order.paymentStatus === "paid") return { status: "already_paid" };

  if (order.status === "pending_payment" && order.expiresAt < now) {
    // Before calling it expired, make sure the customer did not already pay.
    if (order.razorpayOrderId) {
      const r = await reconcileOrder(order.id);
      if (r.paid) return { status: "already_paid" };
    }
    await expireIfStale(order.id, now);
    order = { ...order, status: "expired" };
  }
  if (order.status !== "pending_payment") {
    throw new HttpError(409, "This order has expired. Please place your order again.", "order_expired");
  }

  const gateway = getGateway();
  let razorpayOrderId = order.razorpayOrderId;

  if (!razorpayOrderId) {
    const created = await gateway.createOrder({
      amountPaise: order.totalPaise,
      receipt: order.id, // cuid, about 25 characters; Razorpay allows 40
      notes: { order_id: order.id, order_number: String(order.dailyNumber) },
    });
    if (created.amountPaise !== order.totalPaise || created.currency !== "INR") {
      throw new Error(`Razorpay order amount mismatch for ${order.id}`);
    }
    // Only store it if no other request (double-click, second tab) stored one first.
    const { count } = await prisma.order.updateMany({
      where: { id: order.id, razorpayOrderId: null },
      data: { razorpayOrderId: created.id },
    });
    if (count === 1) {
      razorpayOrderId = created.id;
      log.info("razorpay order created", { orderId: order.id, razorpayOrderId: created.id });
    } else {
      // Someone else won the race. Their Razorpay order is the one; ours is never
      // shown to a customer, so it can never be paid.
      const winner = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { razorpayOrderId: true },
      });
      razorpayOrderId = winner.razorpayOrderId!;
    }
  }

  const { keyId } = getEnv().razorpay;
  return {
    status: "ready",
    mode: gateway.mode,
    keyId,
    razorpayOrderId,
    amountPaise: order.totalPaise,
    currency: "INR",
    name: config.restaurant.name,
    description: `Order #${order.dailyNumber}`,
    prefill: { name: order.customerName, contact: order.customerPhone ? `+91${order.customerPhone}` : "" },
  };
}

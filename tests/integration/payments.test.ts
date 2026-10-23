import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as verifyRoute } from "@/app/api/orders/[id]/verify/route";
import { prisma } from "@/lib/db";
import { createOrder, createOrderSchema } from "@/server/orders/create";
import { trackOrder } from "@/server/orders/track";
import { markOrderPaid } from "@/server/payments/confirm";
import { getGateway, setGatewayForTests } from "@/server/payments/gateway";
import { mockCustomerPays } from "@/server/payments/mockGateway";
import { countPaymentProblems, sweep } from "@/server/payments/reconcile";
import { startPayment } from "@/server/payments/startPayment";
import {
  checkoutSignature,
  describeDb,
  jsonRequest,
  orderInput,
  resetDb,
  routeParams,
  seedItems,
} from "./helpers";

async function pendingOrderWithRazorpay(createdAt = new Date()) {
  const items = await seedItems();
  const input = createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
  const order = await createOrder(input, createdAt);
  const pay = await startPayment(order.id, createdAt);
  if (pay.status !== "ready") throw new Error("expected ready");
  return { orderId: order.id, razorpayOrderId: pay.razorpayOrderId, totalPaise: order.totalPaise };
}

const capture = (razorpayOrderId: string, razorpayPaymentId: string, amountPaise = 22000) => ({
  razorpayOrderId,
  razorpayPaymentId,
  amountPaise,
  currency: "INR",
  source: "webhook" as const,
});

describeDb("markOrderPaid", () => {
  beforeEach(resetDb);

  it("is idempotent under 10 concurrent calls: one paid order, one paidAt, one payment", async () => {
    const o = await pendingOrderWithRazorpay();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        markOrderPaid({
          ...capture(o.razorpayOrderId, "pay_testCONC00001"),
          source: i % 2 ? "verify" : "webhook",
        }),
      ),
    );
    const outcomes = results.map((r) => r.outcome);
    expect(outcomes.filter((x) => x === "paid")).toHaveLength(1);
    expect(outcomes.filter((x) => x === "already_paid")).toHaveLength(9);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order).toMatchObject({
      status: "paid",
      paymentStatus: "paid",
      paidPaymentId: "pay_testCONC00001",
    });
    expect(await prisma.payment.count()).toBe(1);

    const paidAt = order.paidAt!.getTime();
    await markOrderPaid(capture(o.razorpayOrderId, "pay_testCONC00001"));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).paidAt!.getTime()).toBe(
      paidAt,
    );
  });

  it("refuses an amount mismatch and flags it", async () => {
    const o = await pendingOrderWithRazorpay();
    const r = await markOrderPaid(capture(o.razorpayOrderId, "pay_testLOW000001", 100));
    expect(r.outcome).toBe("amount_mismatch");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order.paymentStatus).not.toBe("paid");
    expect(order.status).toBe("pending_payment");
    expect((await prisma.payment.findFirstOrThrow()).status).toBe("mismatch");
    expect(await countPaymentProblems()).toBeGreaterThan(0);
  });

  it("refuses a non-INR currency", async () => {
    const o = await pendingOrderWithRazorpay();
    const r = await markOrderPaid({ ...capture(o.razorpayOrderId, "pay_testUSD000001"), currency: "USD" });
    expect(r.outcome).toBe("amount_mismatch");
  });

  it("flags a late payment on an expired order instead of losing it", async () => {
    const o = await pendingOrderWithRazorpay();
    await prisma.order.update({ where: { id: o.orderId }, data: { status: "expired" } });
    const r = await markOrderPaid(capture(o.razorpayOrderId, "pay_testLATE00001"));
    expect(r.outcome).toBe("late_payment");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order).toMatchObject({ status: "expired", paymentStatus: "paid", latePayment: true });
    expect(await countPaymentProblems()).toBe(1);
  });

  it("flags a second, different capture on a paid order as a duplicate", async () => {
    const o = await pendingOrderWithRazorpay();
    await markOrderPaid(capture(o.razorpayOrderId, "pay_testFIRST0001"));
    const r = await markOrderPaid(capture(o.razorpayOrderId, "pay_testSECOND001"));
    expect(r.outcome).toBe("duplicate_payment");
    expect(await countPaymentProblems()).toBe(1);
  });

  it("records a capture for an unknown Razorpay order without crashing", async () => {
    const r = await markOrderPaid(capture("order_testUNKNOWN1", "pay_testORPHAN001"));
    expect(r.outcome).toBe("unknown_order");
    expect(await prisma.payment.count({ where: { orderId: null } })).toBe(1);
  });
});

describeDb("POST /api/orders/:id/verify", () => {
  beforeEach(resetDb);
  const verify = (orderId: string, body: unknown) =>
    verifyRoute(jsonRequest(`/api/orders/${orderId}/verify`, body), routeParams(orderId));

  it("marks the order paid for a valid signature and a captured payment", async () => {
    const o = await pendingOrderWithRazorpay();
    const p = await mockCustomerPays({
      razorpayOrderId: o.razorpayOrderId,
      amountPaise: 22000,
      outcome: "captured",
    });
    const res = await verify(o.orderId, {
      razorpay_order_id: o.razorpayOrderId,
      razorpay_payment_id: p.id,
      razorpay_signature: checkoutSignature(o.razorpayOrderId, p.id),
    });
    expect(await res.json()).toEqual({ status: "paid" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe("paid");
  });

  it("rejects a tampered signature", async () => {
    const o = await pendingOrderWithRazorpay();
    const p = await mockCustomerPays({
      razorpayOrderId: o.razorpayOrderId,
      amountPaise: 22000,
      outcome: "captured",
    });
    const sig = checkoutSignature(o.razorpayOrderId, p.id);
    const res = await verify(o.orderId, {
      razorpay_order_id: o.razorpayOrderId,
      razorpay_payment_id: p.id,
      razorpay_signature: (sig[0] === "a" ? "b" : "a") + sig.slice(1),
    });
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).paymentStatus).toBe("unpaid");
  });

  it("rejects a Razorpay order that belongs to a different order", async () => {
    const a = await pendingOrderWithRazorpay();
    const input = createOrderSchema.parse(
      orderInput([{ menuItemId: (await prisma.menuItem.findFirstOrThrow()).id, quantity: 1 }]),
    );
    const b = await createOrder(input);
    await startPayment(b.id);
    const p = await mockCustomerPays({
      razorpayOrderId: a.razorpayOrderId,
      amountPaise: 22000,
      outcome: "captured",
    });
    const res = await verify(b.id, {
      razorpay_order_id: a.razorpayOrderId,
      razorpay_payment_id: p.id,
      razorpay_signature: checkoutSignature(a.razorpayOrderId, p.id),
    });
    expect(res.status).toBe(400);
  });

  it("answers pending (not an error) when Razorpay cannot be reached; reconcile finishes later", async () => {
    const o = await pendingOrderWithRazorpay();
    const p = await mockCustomerPays({
      razorpayOrderId: o.razorpayOrderId,
      amountPaise: 22000,
      outcome: "captured",
    });
    const real = getGateway();
    setGatewayForTests({
      ...real,
      mode: "mock",
      fetchPayment: () => Promise.reject(new Error("timeout")),
    } as never);
    try {
      const res = await verify(o.orderId, {
        razorpay_order_id: o.razorpayOrderId,
        razorpay_payment_id: p.id,
        razorpay_signature: checkoutSignature(o.razorpayOrderId, p.id),
      });
      expect(await res.json()).toEqual({ status: "pending" });
    } finally {
      setGatewayForTests(undefined);
    }
    const tracked = await trackOrder(o.orderId);
    expect(tracked?.status).toBe("paid");
  });
});

describeDb("reconcile", () => {
  beforeEach(resetDb);
  afterEach(() => vi.useRealTimers());

  it("finds a payment whose browser callback and webhook never arrived (tracking page)", async () => {
    const o = await pendingOrderWithRazorpay();
    await mockCustomerPays({ razorpayOrderId: o.razorpayOrderId, amountPaise: 22000, outcome: "captured" });
    const tracked = await trackOrder(o.orderId);
    expect(tracked).toMatchObject({ status: "paid", paymentStatus: "paid" });
    const pay = await prisma.payment.findFirstOrThrow();
    expect(pay.source).toBe("reconcile");
  });

  it("shows payment failed after a failed attempt, and the retry on the same order still works", async () => {
    const o = await pendingOrderWithRazorpay();
    await mockCustomerPays({ razorpayOrderId: o.razorpayOrderId, amountPaise: 22000, outcome: "failed" });
    expect((await trackOrder(o.orderId))?.paymentStatus).toBe("failed");
    const retry = await startPayment(o.orderId);
    expect(retry).toMatchObject({ status: "ready", razorpayOrderId: o.razorpayOrderId });
    await mockCustomerPays({ razorpayOrderId: o.razorpayOrderId, amountPaise: 22000, outcome: "captured" });
    await sweep();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe("paid");
  });

  it("sweep: paid at minute 14 but not yet recorded -> paid, not expired", async () => {
    const created = new Date(Date.now() - 16 * 60_000);
    const o = await pendingOrderWithRazorpay(created);
    await mockCustomerPays({ razorpayOrderId: o.razorpayOrderId, amountPaise: 22000, outcome: "captured" });
    const r = await sweep();
    expect(r.paidFound).toBe(1);
    expect(r.expired).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe("paid");
  });

  it("sweep: expires at minute 15, payment at minute 16 is recorded as a late payment", async () => {
    const created = new Date(Date.now() - 16 * 60_000);
    const o = await pendingOrderWithRazorpay(created);
    const first = await sweep();
    expect(first.expired).toBe(1);
    await mockCustomerPays({ razorpayOrderId: o.razorpayOrderId, amountPaise: 22000, outcome: "captured" });
    const second = await sweep();
    expect(second.paidFound).toBe(1);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order).toMatchObject({ status: "expired", paymentStatus: "paid", latePayment: true });
    expect(second.problems).toBe(1);
    expect((await prisma.setting.findUniqueOrThrow({ where: { id: 1 } })).lastReconcileProblems).toBe(1);
  });

  it("does not expire orders while Razorpay is unreachable", async () => {
    const o = await pendingOrderWithRazorpay(new Date(Date.now() - 16 * 60_000));
    setGatewayForTests({
      mode: "mock",
      fetchOrderPayments: () => Promise.reject(new Error("down")),
    } as never);
    try {
      const r = await sweep();
      expect(r.errors).toBe(1);
      expect(r.expired).toBe(0);
    } finally {
      setGatewayForTests(undefined);
    }
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe(
      "pending_payment",
    );
  });
});

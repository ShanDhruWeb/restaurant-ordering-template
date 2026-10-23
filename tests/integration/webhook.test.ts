import { beforeEach, expect, it, vi } from "vitest";
import { POST as webhookRoute } from "@/app/api/webhooks/razorpay/route";
import { prisma } from "@/lib/db";
import { createOrder, createOrderSchema } from "@/server/orders/create";
import { startPayment } from "@/server/payments/startPayment";
import {
  describeDb,
  orderInput,
  resetDb,
  routeParams,
  seedItems,
  signedWebhook,
  webhookRequest,
} from "./helpers";

async function pendingOrder() {
  const items = await seedItems();
  const order = await createOrder(
    createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }])),
  );
  const pay = await startPayment(order.id);
  if (pay.status !== "ready") throw new Error("expected ready");
  return { orderId: order.id, razorpayOrderId: pay.razorpayOrderId };
}

const send = (hook: { body: string; headers: Record<string, string> }) =>
  webhookRoute(webhookRequest(hook), routeParams(""));

describeDb("POST /api/webhooks/razorpay", () => {
  beforeEach(resetDb);

  it("payment.captured marks the order paid with NO checkout signature in the payload", async () => {
    const o = await pendingOrder();
    const hook = signedWebhook("payment.captured", {
      id: "pay_testWEBHOOK01",
      order_id: o.razorpayOrderId,
      amount: 22000,
      status: "captured",
    });
    expect(hook.body).not.toContain("signature");
    const res = await send(hook);
    expect(res.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order).toMatchObject({ status: "paid", paidPaymentId: "pay_testWEBHOOK01" });
    expect((await prisma.payment.findFirstOrThrow()).source).toBe("webhook");
  });

  it("order.paid is handled the same way", async () => {
    const o = await pendingOrder();
    const res = await send(
      signedWebhook("order.paid", {
        id: "pay_testORDPAID01",
        order_id: o.razorpayOrderId,
        amount: 22000,
        status: "captured",
      }),
    );
    expect(res.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe("paid");
  });

  it("rejects a bad signature with 400 and changes nothing", async () => {
    const o = await pendingOrder();
    const hook = signedWebhook("payment.captured", {
      id: "pay_testFORGED001",
      order_id: o.razorpayOrderId,
      amount: 22000,
      status: "captured",
    });
    const forged = { ...hook, body: hook.body.replace("22000", "22001") };
    expect((await send(forged)).status).toBe(400);
    expect((await send({ ...hook, headers: { ...hook.headers, "x-razorpay-signature": "" } })).status).toBe(
      400,
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe(
      "pending_payment",
    );
    expect(await prisma.webhookEvent.count()).toBe(0);
  });

  it("dedupes a repeated event by x-razorpay-event-id", async () => {
    const o = await pendingOrder();
    const hook = signedWebhook(
      "payment.captured",
      { id: "pay_testDUPE00001", order_id: o.razorpayOrderId, amount: 22000, status: "captured" },
      { eventId: "evt_testSAME00001" },
    );
    expect(await (await send(hook)).json()).toMatchObject({ result: "paid" });
    expect(await (await send(hook)).json()).toMatchObject({ result: "duplicate" });
    expect(await prisma.webhookEvent.count()).toBe(1);
  });

  it("returns 5xx on a database failure so Razorpay retries, then succeeds on retry", async () => {
    const o = await pendingOrder();
    const hook = signedWebhook("payment.captured", {
      id: "pay_testDBDOWN001",
      order_id: o.razorpayOrderId,
      amount: 22000,
      status: "captured",
    });
    const spy = vi
      .spyOn(prisma.webhookEvent, "findUnique")
      .mockRejectedValueOnce(new Error("connection refused"));
    const res = await send(hook);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Something went wrong" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe(
      "pending_payment",
    );
    spy.mockRestore();
    expect((await send(hook)).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe("paid");
  });

  it("works whichever arrives first: webhook before or after the browser verify", async () => {
    const o = await pendingOrder();
    const hook = signedWebhook("payment.captured", {
      id: "pay_testORDER0001",
      order_id: o.razorpayOrderId,
      amount: 22000,
      status: "captured",
    });
    await send(hook);
    const { markOrderPaid } = await import("@/server/payments/confirm");
    const again = await markOrderPaid({
      razorpayOrderId: o.razorpayOrderId,
      razorpayPaymentId: "pay_testORDER0001",
      amountPaise: 22000,
      currency: "INR",
      source: "verify",
    });
    expect(again.outcome).toBe("already_paid");
  });

  it("payment.failed then payment.captured for the same order ends paid", async () => {
    const o = await pendingOrder();
    await send(
      signedWebhook("payment.failed", {
        id: "pay_testFAIL00001",
        order_id: o.razorpayOrderId,
        amount: 22000,
        status: "failed",
      }),
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).paymentStatus).toBe("failed");
    await send(
      signedWebhook("payment.captured", {
        id: "pay_testFAIL00001",
        order_id: o.razorpayOrderId,
        amount: 22000,
        status: "captured",
      }),
    );
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order).toMatchObject({ status: "paid", paymentStatus: "paid" });
    expect((await prisma.payment.findFirstOrThrow()).status).toBe("captured");
  });

  it("a late payment.failed never downgrades a captured payment", async () => {
    const o = await pendingOrder();
    const entity = { id: "pay_testORDERX001", order_id: o.razorpayOrderId, amount: 22000 };
    await send(signedWebhook("payment.captured", { ...entity, status: "captured" }));
    await send(signedWebhook("payment.failed", { ...entity, status: "failed" }));
    expect((await prisma.payment.findFirstOrThrow()).status).toBe("captured");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).paymentStatus).toBe("paid");
  });

  it("refund.processed sets the order's refund status", async () => {
    const o = await pendingOrder();
    const entity = { id: "pay_testREFUND001", order_id: o.razorpayOrderId, amount: 22000 };
    await send(signedWebhook("payment.captured", { ...entity, status: "captured" }));
    await prisma.order.update({
      where: { id: o.orderId },
      data: { status: "cancelled", refundStatus: "needed" },
    });

    await send(
      signedWebhook(
        "refund.processed",
        { ...entity, status: "captured", amount_refunded: 10000 },
        { refund: { id: "rfnd_test0000001", amount: 10000 } },
      ),
    );
    let order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order).toMatchObject({ refundStatus: "partial", refundedPaise: 10000 });

    await send(
      signedWebhook(
        "refund.processed",
        { ...entity, status: "refunded", amount_refunded: 22000 },
        { refund: { id: "rfnd_test0000002", amount: 12000 } },
      ),
    );
    order = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(order).toMatchObject({ refundStatus: "refunded", refundedPaise: 22000 });
  });

  it("ignores unknown event types with 200", async () => {
    const res = await send(
      signedWebhook("payment.authorized" as never, {
        id: "pay_testAUTH00001",
        order_id: "order_x",
        amount: 1,
        status: "captured",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "ignored_event_type" });
  });
});

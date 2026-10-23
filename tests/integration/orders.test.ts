import { beforeEach, expect, it } from "vitest";
import { POST as createRoute } from "@/app/api/orders/route";
import { GET as getRoute } from "@/app/api/orders/[id]/route";
import { POST as payRoute } from "@/app/api/orders/[id]/pay/route";
import { prisma } from "@/lib/db";
import { createOrder, createOrderSchema } from "@/server/orders/create";
import { markOrderPaid } from "@/server/payments/confirm";
import { startPayment } from "@/server/payments/startPayment";
import { describeDb, jsonRequest, orderInput, resetDb, routeParams, seedItems } from "./helpers";

let items: Awaited<ReturnType<typeof seedItems>>;

describeDb("POST /api/orders", () => {
  beforeEach(async () => {
    await resetDb();
    items = await seedItems();
  });

  const post = (body: unknown) => createRoute(jsonRequest("/api/orders", body), routeParams(""));

  it("creates a pending order priced from the database", async () => {
    const res = await post(
      orderInput([
        { menuItemId: items.thali.id, quantity: 2 },
        { menuItemId: items.chai.id, quantity: 3 },
      ]),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.totalPaise).toBe(2 * 22000 + 3 * 2000);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.id }, include: { items: true } });
    expect(order.status).toBe("pending_payment");
    expect(order.items.map((i) => i.nameSnapshot).sort()).toEqual(["Chai", "Thali"]);
    expect(order.expiresAt.getTime() - order.createdAt.getTime()).toBeGreaterThan(14 * 60_000);
  });

  it("records when the customer agreed to the policies", async () => {
    const before = Date.now();
    const res = await post(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: (await res.json()).id } });
    expect(order.termsAcceptedAt).not.toBeNull();
    expect(order.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it.each([undefined, false, "true", 1, null])("rejects consent value %s and creates no order", async (v) => {
    const res = await post(
      orderInput([{ menuItemId: items.thali.id, quantity: 1 }], { termsAccepted: v as boolean }),
    );
    expect(res.status).toBe(400);
    if (v === undefined || v === false) expect((await res.json()).code).toBe("consent_required");
    expect(await prisma.order.count()).toBe(0);
  });

  it("does not expose the consent time on the public order", async () => {
    const res = await post(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
    const { id } = await res.json();
    const pub = await (
      await getRoute(new Request(`http://localhost:3000/api/orders/${id}`), routeParams(id))
    ).json();
    expect(JSON.stringify(pub)).not.toMatch(/termsAccepted/);
  });

  it.each([0, -1, 1.5, 99, "1"])("rejects quantity %s with 400", async (quantity) => {
    const res = await post(orderInput([{ menuItemId: items.thali.id, quantity: quantity as number }]));
    expect(res.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);
  });

  it("rejects unavailable and deleted items with 409 and a fresh cart", async () => {
    for (const bad of [items.soldOut, items.deleted]) {
      const res = await post(
        orderInput([
          { menuItemId: bad.id, quantity: 1 },
          { menuItemId: items.chai.id, quantity: 1 },
        ]),
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("cart_changed");
      expect(body.cart.removed[0].menuItemId).toBe(bad.id);
      expect(body.cart.totalPaise).toBe(2000);
    }
    expect(await prisma.order.count()).toBe(0);
  });

  it("rejects unknown items", async () => {
    const res = await post(orderInput([{ menuItemId: "cm0000000000000000000000x", quantity: 1 }]));
    expect(res.status).toBe(409);
  });

  it("rejects a tampered or stale expected total with the real prices", async () => {
    const res = await post(
      orderInput([{ menuItemId: items.thali.id, quantity: 1 }], { expectedTotalPaise: 100 }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.cart.items[0].pricePaise).toBe(22000);
    expect(body.cart.totalPaise).toBe(22000);
  });

  it("ignores any client-sent price field by rejecting unknown fields", async () => {
    const res = await post(
      orderInput([{ menuItemId: items.thali.id, quantity: 1, pricePaise: 1 } as never], { totalPaise: 1 }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects orders while the restaurant is closed", async () => {
    await prisma.setting.update({ where: { id: 1 }, data: { acceptingOrders: false } });
    const res = await post(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("restaurant_closed");
  });

  it("validates phone, table and type", async () => {
    const line = [{ menuItemId: items.thali.id, quantity: 1 }];
    expect((await post(orderInput(line, { customerPhone: "12345" }))).status).toBe(400);
    expect((await post(orderInput(line, { customerPhone: undefined }))).status).toBe(400); // requirePhone
    expect((await post(orderInput(line, { type: "dine_in", table: "999" }))).status).toBe(400);
    expect((await post(orderInput(line, { type: "dine_in", table: "5" }))).status).toBe(201);
    expect((await post(orderInput(line, { type: "delivery" }))).status).toBe(400);
  });

  it("rejects non-JSON and oversized bodies", async () => {
    const notJson = new Request("http://localhost:3000/api/orders", { method: "POST", body: "x" });
    expect((await createRoute(notJson, routeParams(""))).status).toBe(415);
    const huge = jsonRequest("/api/orders", { ...orderInput([]), note: "a".repeat(20_000) });
    expect((await createRoute(huge, routeParams(""))).status).toBe(413);
  });

  it("keeps unicode names and notes intact", async () => {
    const res = await post(
      orderInput([{ menuItemId: items.thali.id, quantity: 1 }], {
        customerName: "आशा पाटील 😀",
        note: "कमी तिखट\nno onion 🙏",
      }),
    );
    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: (await res.json()).id } });
    expect(order.customerName).toBe("आशा पाटील 😀");
    expect(order.note).toBe("कमी तिखट\nno onion 🙏");
  });

  it("numbers orders per IST day, restarting at 1, with no duplicates under concurrency", async () => {
    const input = createOrderSchema.parse(orderInput([{ menuItemId: items.chai.id, quantity: 1 }]));
    const day1 = new Date("2026-03-01T18:29:00Z"); // 23:59 IST, 1 March
    const day2 = new Date("2026-03-01T18:31:00Z"); // 00:01 IST, 2 March
    const a = await createOrder(input, day1);
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => createOrder(input, day2)));
    expect(a.dailyNumber).toBe(1);
    expect(concurrent.map((o) => o.dailyNumber).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describeDb("GET /api/orders/:id (public)", () => {
  beforeEach(async () => {
    await resetDb();
    items = await seedItems();
  });

  it("leaks no phone number, payment ids or signatures", async () => {
    const input = createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
    const order = await createOrder(input);
    const pay = await startPayment(order.id);
    if (pay.status !== "ready") throw new Error("expected ready");
    await markOrderPaid({
      razorpayOrderId: pay.razorpayOrderId,
      razorpayPaymentId: "pay_testLEAK00001",
      amountPaise: 22000,
      currency: "INR",
      source: "verify",
    });

    const res = await getRoute(
      new Request(`http://localhost:3000/api/orders/${order.id}`),
      routeParams(order.id),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("9876543210");
    expect(text).not.toContain(pay.razorpayOrderId);
    expect(text).not.toContain("pay_testLEAK00001");
    expect(text).not.toMatch(/razorpay|signature|Patil/i);
    const body = JSON.parse(text);
    expect(body.order).toMatchObject({ status: "paid", paymentStatus: "paid", customerFirstName: "Asha" });
  });

  it("returns 404 for unknown or malformed ids", async () => {
    for (const id of ["cm0000000000000000000000z", "../../etc"]) {
      const res = await getRoute(new Request(`http://localhost:3000/api/orders/x`), routeParams(id));
      expect(res.status).toBe(404);
    }
  });
});

describeDb("POST /api/orders/:id/pay", () => {
  beforeEach(async () => {
    await resetDb();
    items = await seedItems();
  });

  it("reuses the same Razorpay order on retry and under double-clicks", async () => {
    const input = createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
    const order = await createOrder(input);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        payRoute(jsonRequest(`/api/orders/${order.id}/pay`, {}), routeParams(order.id)),
      ),
    );
    const ids = new Set<string>();
    for (const r of results) {
      expect(r.status).toBe(200);
      ids.add((await r.json()).razorpayOrderId);
    }
    const retry = await (
      await payRoute(jsonRequest(`/api/orders/${order.id}/pay`, {}), routeParams(order.id))
    ).json();
    ids.add(retry.razorpayOrderId);
    expect(ids.size).toBe(1);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(ids.has(stored.razorpayOrderId!)).toBe(true);
    expect(retry).toMatchObject({ amountPaise: 22000, currency: "INR", status: "ready" });
    expect(retry.keyId).toMatch(/^rzp_test_/);
    expect(JSON.stringify(retry)).not.toMatch(/secret/i);
  });

  it("says already paid instead of creating a new payment", async () => {
    const input = createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
    const order = await createOrder(input);
    const pay = await startPayment(order.id);
    if (pay.status !== "ready") throw new Error("expected ready");
    await markOrderPaid({
      razorpayOrderId: pay.razorpayOrderId,
      razorpayPaymentId: "pay_testPAID00001",
      amountPaise: 22000,
      currency: "INR",
      source: "webhook",
    });
    expect(await startPayment(order.id)).toEqual({ status: "already_paid" });
  });

  it("refuses to start payment on an expired order", async () => {
    const input = createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }]));
    const order = await createOrder(input, new Date(Date.now() - 20 * 60_000));
    const res = await payRoute(jsonRequest(`/api/orders/${order.id}/pay`, {}), routeParams(order.id));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("order_expired");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("expired");
  });
});

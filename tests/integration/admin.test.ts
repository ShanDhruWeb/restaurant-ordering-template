import bcrypt from "bcryptjs";
import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

// next/headers cookies() only works inside a Next request; give tests a simple jar.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const { POST: loginRoute } = await import("@/app/api/admin/login/route");
const { GET: boardRoute } = await import("@/app/api/admin/board/route");
const { POST: orderActionRoute } = await import("@/app/api/admin/orders/[id]/route");
const { POST: menuRoute } = await import("@/app/api/admin/menu/route");
const { POST: settingsRoute } = await import("@/app/api/admin/settings/route");
const { csvCell } = await import("@/server/admin/history");
const { createOrder, createOrderSchema } = await import("@/server/orders/create");
const { startPayment } = await import("@/server/payments/startPayment");
const { markOrderPaid } = await import("@/server/payments/confirm");
const { describeDb, orderInput, resetDb, routeParams, seedItems } = await import("./helpers");

const ORIGIN = "http://localhost:3000";
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000", ...headers },
    body: JSON.stringify(body),
  });

async function createAdmin() {
  return prisma.adminUser.create({
    data: { email: "staff@example.test", passwordHash: await bcrypt.hash("correct horse battery", 4) },
  });
}

async function logIn() {
  const res = await loginRoute(
    post("/api/admin/login", { email: "staff@example.test", password: "correct horse battery" }),
    routeParams(""),
  );
  expect(res.status).toBe(200);
}

async function paidOrder() {
  const items = await seedItems();
  const o = await createOrder(
    createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }])),
  );
  const pay = await startPayment(o.id);
  if (pay.status !== "ready") throw new Error("expected ready");
  await markOrderPaid({
    razorpayOrderId: pay.razorpayOrderId,
    razorpayPaymentId: "pay_testADMIN0001",
    amountPaise: 22000,
    currency: "INR",
    source: "verify",
  });
  return { orderId: o.id, items };
}

describeDb("admin", () => {
  beforeEach(async () => {
    jar.clear();
    await resetDb();
    await createAdmin();
  });

  it("requires a login for admin APIs", async () => {
    const res = await boardRoute(new Request(`${ORIGIN}/api/admin/board`), routeParams(""));
    expect(res.status).toBe(401);
  });

  it("rejects wrong passwords and unknown emails with the same message", async () => {
    const a = await loginRoute(
      post("/api/admin/login", { email: "staff@example.test", password: "wrong" }),
      routeParams(""),
    );
    const b = await loginRoute(
      post("/api/admin/login", { email: "nobody@example.test", password: "wrong" }),
      routeParams(""),
    );
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect((await a.json()).error).toBe((await b.json()).error);
    expect(jar.size).toBe(0);
  });

  it("rate limits login attempts per email", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await loginRoute(
        post("/api/admin/login", { email: "staff@example.test", password: "nope" }),
        routeParams(""),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it("logs in and sees only PAID orders on the board", async () => {
    await logIn();
    const { orderId } = await paidOrder();
    // A pending order must never reach the kitchen.
    const items = await prisma.menuItem.findFirstOrThrow({ where: { name: "Chai" } });
    await createOrder(createOrderSchema.parse(orderInput([{ menuItemId: items.id, quantity: 1 }])));
    const res = await boardRoute(new Request(`${ORIGIN}/api/admin/board`), routeParams(""));
    const board = await res.json();
    expect(board.orders.map((o: { id: string }) => o.id)).toEqual([orderId]);
  });

  it("blocks cross-site requests (CSRF) and non-JSON bodies", async () => {
    await logIn();
    const { orderId } = await paidOrder();
    const evil = await orderActionRoute(
      post(`/api/admin/orders/${orderId}`, { action: "cancel" }, { origin: "https://evil.example" }),
      routeParams(orderId),
    );
    expect(evil.status).toBe(403);
    const form = new Request(`${ORIGIN}/api/admin/orders/${orderId}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: ORIGIN,
        host: "localhost:3000",
      },
      body: "action=cancel",
    });
    expect((await orderActionRoute(form, routeParams(orderId))).status).toBe(415);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("paid");
  });

  it("advances orders one step at a time and refuses stale double taps", async () => {
    await logIn();
    const { orderId } = await paidOrder();
    const advance = (from: string) =>
      orderActionRoute(
        post(`/api/admin/orders/${orderId}`, { action: "advance", from }),
        routeParams(orderId),
      );
    expect((await advance("paid")).status).toBe(200);
    expect((await advance("paid")).status).toBe(409); // second tablet tapped the old state
    expect((await advance("preparing")).status).toBe(200);
    expect((await advance("ready")).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("completed");
    expect(await prisma.auditLog.count({ where: { entityId: orderId } })).toBe(3);
  });

  it("cancelling a paid order flags a refund as needed", async () => {
    await logIn();
    const { orderId } = await paidOrder();
    const res = await orderActionRoute(
      post(`/api/admin/orders/${orderId}`, { action: "cancel", reason: "Out of stock" }),
      routeParams(orderId),
    );
    expect(res.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({
      status: "cancelled",
      refundStatus: "needed",
      cancelReason: "Out of stock",
    });
  });

  it("menu changes are audited with old and new values", async () => {
    await logIn();
    const items = await seedItems();
    const res = await menuRoute(
      post("/api/admin/menu", { action: "update_item", id: items.thali.id, pricePaise: 25000 }),
      routeParams(""),
    );
    expect(res.status).toBe(200);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: items.thali.id } });
    expect(log).toMatchObject({ action: "item.update", adminEmail: "staff@example.test" });
    expect(log.oldValue).toEqual({ pricePaise: 22000 });
    expect(log.newValue).toEqual({ pricePaise: 25000 });
  });

  it("rejects invalid menu input (negative or fractional paise, unknown fields)", async () => {
    await logIn();
    const items = await seedItems();
    for (const body of [
      { action: "update_item", id: items.thali.id, pricePaise: -100 },
      { action: "update_item", id: items.thali.id, pricePaise: 12.5 },
      { action: "update_item", id: items.thali.id, isAdmin: true },
    ]) {
      expect((await menuRoute(post("/api/admin/menu", body), routeParams(""))).status).toBe(400);
    }
  });

  it("settings switch stops new orders", async () => {
    await logIn();
    const res = await settingsRoute(post("/api/admin/settings", { acceptingOrders: false }), routeParams(""));
    expect(res.status).toBe(200);
    expect((await prisma.setting.findUniqueOrThrow({ where: { id: 1 } })).acceptingOrders).toBe(false);
  });

  it("logging out everywhere: a password reset invalidates old sessions", async () => {
    await logIn();
    await prisma.adminUser.update({
      where: { email: "staff@example.test" },
      data: { sessionVersion: { increment: 1 } },
    });
    const res = await boardRoute(new Request(`${ORIGIN}/api/admin/board`), routeParams(""));
    expect(res.status).toBe(401);
  });
});

it("CSV cells are quoted and spreadsheet formulas are defused", () => {
  expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
  expect(csvCell("+91")).toBe(`"'+91"`);
  expect(csvCell(null)).toBe('""');
});

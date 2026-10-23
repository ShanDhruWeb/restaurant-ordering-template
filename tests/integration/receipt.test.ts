import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it } from "vitest";
import ReceiptPage from "@/app/(shop)/order/[id]/receipt/page";
import { prisma } from "@/lib/db";
import { getIdentity } from "@/lib/identity";
import { createOrder, createOrderSchema } from "@/server/orders/create";
import { markOrderPaid } from "@/server/payments/confirm";
import { startPayment } from "@/server/payments/startPayment";
import { describeDb, orderInput, resetDb, seedItems } from "./helpers";

const render = async (id: string) =>
  renderToStaticMarkup(createElement("div", null, await ReceiptPage({ params: Promise.resolve({ id }) })));

describeDb("receipt page", () => {
  beforeEach(resetDb);

  async function paidOrder() {
    const items = await seedItems();
    const input = createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 2 }]));
    const order = await createOrder(input);
    const pay = await startPayment(order.id);
    if (pay.status !== "ready") throw new Error("expected ready");
    await markOrderPaid({
      razorpayOrderId: pay.razorpayOrderId,
      razorpayPaymentId: "pay_testRECEIPT0001",
      amountPaise: order.totalPaise,
      currency: "INR",
      source: "webhook",
    });
    return { order, razorpayOrderId: pay.razorpayOrderId };
  }

  it("shows the business, order lines, total and payment status", async () => {
    const { order } = await paidOrder();
    const html = await render(order.id);
    const id = getIdentity();
    expect(html).toContain(id.legalName);
    expect(html).toContain(id.operatingAddressText);
    expect(html).toContain(`#${order.dailyNumber}`);
    expect(html).toContain("Thali");
    expect(html).toContain("₹440");
    expect(html).toContain("Paid via Razorpay");
    expect(html).toContain("Prices are inclusive of applicable taxes.");
    expect(html).toContain("IST");
  });

  it("leaks no Razorpay id, signature or phone number", async () => {
    const { order, razorpayOrderId } = await paidOrder();
    const html = await render(order.id);
    expect(html).not.toContain(razorpayOrderId);
    expect(html).not.toContain("pay_testRECEIPT0001");
    expect(html).not.toContain("9876543210");
    expect(html).not.toMatch(/signature|razorpay_|rzp_|\bpay_|\border_[A-Za-z0-9]/i);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.customerPhone).toBe("9876543210"); // it is stored, just never shown
  });

  it("says a receipt is available after payment for an unpaid order", async () => {
    const items = await seedItems();
    const order = await createOrder(
      createOrderSchema.parse(orderInput([{ menuItemId: items.thali.id, quantity: 1 }])),
    );
    const html = await render(order.id);
    expect(html).toContain("available once the order is paid");
    expect(html).not.toContain("Paid via Razorpay");
  });

  it("404s for malformed and unknown ids", async () => {
    await expect(render("x")).rejects.toThrow();
    await expect(render("a".repeat(25))).rejects.toThrow();
  });
});

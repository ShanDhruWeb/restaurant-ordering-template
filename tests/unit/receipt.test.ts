import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import rawConfig from "@config";
import { parseRestaurantConfig } from "@/config/schema";
import { buildIdentity } from "@/lib/identity";
import { buildReceipt, type ReceiptOrder } from "@/lib/receipt";
import { buildReceiptPdf, pdfSafe } from "@/lib/receiptPdf";

const cfg = structuredClone(rawConfig) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
cfg.legal.gstin = "27ABCDE1234F1Z5";
const id = buildIdentity(parseRestaurantConfig(cfg), "https://shop.test");

const order: ReceiptOrder & Record<string, unknown> = {
  number: 7,
  type: "dine_in",
  table: "4",
  paidAt: "2026-10-23T06:30:00.000Z",
  createdAt: "2026-10-23T06:28:00.000Z",
  refundStatus: "none",
  items: [
    { name: "Misal Pav", quantity: 2, pricePaise: 12000 },
    { name: "Masala Chai", quantity: 1, pricePaise: 2500 },
  ],
  totalPaise: 26500,
  // Things that must never reach a receipt even if a caller passes a fuller object.
  customerPhone: "9876543210",
  razorpayOrderId: "order_SECRET123",
  paidPaymentId: "pay_SECRET456",
  signature: "sig_SECRET789",
};

describe("receipt", () => {
  const r = buildReceipt(id, order);

  it("shows legal identity, GSTIN, order number, IST time, lines and totals", () => {
    expect(r.legalName).toBe(id.legalName);
    expect(r.gstin).toBe("27ABCDE1234F1Z5");
    expect(r.address).toBe(id.operatingAddressText);
    expect(r.orderNumber).toBe(7);
    expect(r.dateTime).toContain("12:00"); // 06:30 UTC is 12:00 IST
    expect(r.orderType).toBe("Dine-in, Table 4");
    expect(r.lines).toEqual([
      { name: "Misal Pav", quantity: 2, unitPaise: 12000, totalPaise: 24000 },
      { name: "Masala Chai", quantity: 1, unitPaise: 2500, totalPaise: 2500 },
    ]);
    expect(r.totalPaise).toBe(26500);
    expect(r.paymentStatus).toBe("Paid via Razorpay");
    expect(r.taxStatement).toBe("Prices are inclusive of applicable taxes.");
  });

  it("leaks no Razorpay id, signature or phone number", () => {
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/SECRET|order_|pay_|sig_|9876543210|rzp/i);
  });

  it("reflects refunds in the payment status", () => {
    expect(buildReceipt(id, { ...order, refundStatus: "refunded" }).paymentStatus).toMatch(/Refunded/);
    expect(buildReceipt(id, { ...order, refundStatus: "partial" }).paymentStatus).toMatch(/Partly refunded/);
  });
});

describe("receipt PDF", () => {
  const r = buildReceipt(id, order);

  it("builds a one-page A4 PDF marked SAMPLE", async () => {
    const bytes = await buildReceiptPdf(r, { sample: true });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
    expect(doc.getTitle()).toContain("SAMPLE");
  });

  it("is not marked SAMPLE unless asked", async () => {
    const doc = await PDFDocument.load(await buildReceiptPdf(r));
    expect(doc.getTitle()).not.toContain("SAMPLE");
  });

  it("copes with characters the built-in font cannot draw", async () => {
    expect(pdfSafe("Chai ₹20 – “special” आशा")).toBe('Chai Rs. 20 - "special" ???');
    const odd = buildReceipt(id, {
      ...order,
      items: [{ name: "आशा थाली 😀", quantity: 1, pricePaise: 100 }],
    });
    await expect(buildReceiptPdf(odd, { sample: true })).resolves.toBeInstanceOf(Uint8Array);
  });
});

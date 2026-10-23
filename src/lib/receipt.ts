// What a receipt shows, as plain data. Used by the /order/[id]/receipt page and by
// `npm run sample-invoice`, so the sample invoice always looks like the real receipt.
//
// A receipt never contains Razorpay ids, signatures or phone numbers. It is NOT a GST
// tax invoice (see docs/COMPLIANCE.md).
import type { Identity } from "@/lib/identity";
import { lineTotalPaise } from "@/lib/money";
import { formatIstDateTime } from "@/lib/time";

export interface ReceiptOrder {
  number: number;
  type: "dine_in" | "takeaway";
  table: string | null;
  paidAt: string | null;
  createdAt: string;
  refundStatus: "none" | "needed" | "partial" | "refunded";
  items: { name: string; quantity: number; pricePaise: number }[];
  totalPaise: number;
}

export interface Receipt {
  legalName: string;
  tradeName: string;
  address: string;
  gstin?: string;
  fssai?: string;
  orderNumber: number;
  dateTime: string;
  orderType: string;
  lines: { name: string; quantity: number; unitPaise: number; totalPaise: number }[];
  totalPaise: number;
  paymentStatus: string;
  taxStatement: string;
}

export const RECEIPT_TEXT = {
  title: "Receipt",
  taxInclusive: "Prices are inclusive of applicable taxes.",
  paid: "Paid via Razorpay",
  paidRefunded: "Paid via Razorpay. Refunded.",
  paidPartlyRefunded: "Paid via Razorpay. Partly refunded.",
  dineIn: (table: string | null) => (table ? `Dine-in, Table ${table}` : "Dine-in"),
  takeaway: "Takeaway",
  notTaxInvoice: "This receipt confirms your order and payment. It is not a GST tax invoice.",
} as const;

export function buildReceipt(id: Identity, order: ReceiptOrder): Receipt {
  const t = RECEIPT_TEXT;
  return {
    legalName: id.legalName,
    tradeName: id.tradeName,
    address: id.operatingAddressText,
    gstin: id.gstin,
    fssai: id.fssai,
    orderNumber: order.number,
    dateTime: formatIstDateTime(order.paidAt ?? order.createdAt),
    orderType: order.type === "dine_in" ? t.dineIn(order.table) : t.takeaway,
    lines: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPaise: i.pricePaise,
      totalPaise: lineTotalPaise(i.pricePaise, i.quantity),
    })),
    totalPaise: order.totalPaise,
    paymentStatus:
      order.refundStatus === "refunded"
        ? t.paidRefunded
        : order.refundStatus === "partial"
          ? t.paidPartlyRefunded
          : t.paid,
    taxStatement: t.taxInclusive,
  };
}

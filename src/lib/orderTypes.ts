// Order status values shared by server and browser code (mirror the Prisma enums).
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "preparing",
  "ready",
  "completed",
  "cancelled",
  "expired",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderPaymentStatus = "unpaid" | "failed" | "paid";
export type RefundStatus = "none" | "needed" | "partial" | "refunded";
export type OrderType = "dine_in" | "takeaway";

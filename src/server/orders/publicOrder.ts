// What anyone holding an order link may see. Deliberately small: no phone number,
// no Razorpay ids, no signatures, no internal fields.
import "server-only";
import { prisma } from "@/lib/db";
import type { OrderPaymentStatus, OrderStatus, OrderType, RefundStatus } from "@/lib/orderTypes";
import { firstName } from "../validation";

export interface PublicOrder {
  id: string;
  number: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  refundStatus: RefundStatus;
  type: OrderType;
  table: string | null;
  customerFirstName: string;
  items: { name: string; quantity: number; pricePaise: number; isVeg: boolean }[];
  subtotalPaise: number;
  totalPaise: number;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
}

export const publicOrderSelect = {
  id: true,
  dailyNumber: true,
  status: true,
  paymentStatus: true,
  refundStatus: true,
  type: true,
  tableLabel: true,
  customerName: true,
  subtotalPaise: true,
  totalPaise: true,
  createdAt: true,
  paidAt: true,
  expiresAt: true,
  items: {
    select: { nameSnapshot: true, quantity: true, pricePaise: true, isVeg: true },
    orderBy: { id: "asc" },
  },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof loadRow>>>;

function loadRow(id: string) {
  return prisma.order.findUnique({ where: { id }, select: publicOrderSelect });
}

export function toPublicOrder(o: Row): PublicOrder {
  return {
    id: o.id,
    number: o.dailyNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    refundStatus: o.refundStatus,
    type: o.type,
    table: o.tableLabel,
    customerFirstName: firstName(o.customerName),
    items: o.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      pricePaise: i.pricePaise,
      isVeg: i.isVeg,
    })),
    subtotalPaise: o.subtotalPaise,
    totalPaise: o.totalPaise,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    expiresAt: o.expiresAt.toISOString(),
  };
}

export async function getPublicOrder(id: string): Promise<PublicOrder | null> {
  const row = await loadRow(id);
  return row ? toPublicOrder(row) : null;
}

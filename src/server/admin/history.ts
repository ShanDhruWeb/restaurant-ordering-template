// Order history, search and CSV export for staff.
import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { paiseToRupeeString } from "@/lib/money";
import { formatIstDateTime, istDateString, istDayRange } from "@/lib/time";
import { normalizeIndianMobile } from "../validation";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const historyQuerySchema = z
  .object({
    from: date.optional(),
    to: date.optional(),
    q: z.string().trim().max(40).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

const PAGE_SIZE = 50;
const MAX_RANGE_DAYS = 92;

function whereFor(query: HistoryQuery, now = new Date()): Prisma.OrderWhereInput {
  const today = istDateString(now);
  let from = istDayRange(query.from ?? today).start;
  const to = istDayRange(query.to ?? query.from ?? today).end;
  // Keep exports reasonable: at most about three months at a time.
  const earliest = new Date(to.getTime() - MAX_RANGE_DAYS * 24 * 60 * 60 * 1000);
  if (from < earliest) from = earliest;

  const where: Prisma.OrderWhereInput = { createdAt: { gte: from, lt: to } };
  const q = query.q?.trim();
  if (q) {
    const phone = normalizeIndianMobile(q);
    if (phone) where.customerPhone = phone;
    else if (/^#?\d{1,5}$/.test(q)) where.dailyNumber = Number(q.replace("#", ""));
    else where.customerName = { contains: q, mode: "insensitive" };
  }
  return where;
}

export async function getHistory(query: HistoryQuery, now = new Date()) {
  const where = whereFor(query, now);
  const [orders, total, paid] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        dailyNumber: true,
        numberDate: true,
        status: true,
        paymentStatus: true,
        refundStatus: true,
        latePayment: true,
        type: true,
        tableLabel: true,
        customerName: true,
        customerPhone: true,
        totalPaise: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where: { ...where, paymentStatus: "paid" },
      _count: true,
      _sum: { totalPaise: true },
    }),
  ]);
  return {
    orders,
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    paidCount: paid._count,
    paidTotalPaise: paid._sum.totalPaise ?? 0,
  };
}

/** Quote a CSV cell and defuse spreadsheet formulas (=, +, -, @ at the start). */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function historyCsv(query: HistoryQuery, now = new Date()): Promise<string> {
  const orders = await prisma.order.findMany({
    where: whereFor(query, now),
    orderBy: { createdAt: "asc" },
    take: 20_000,
    include: { items: { orderBy: { id: "asc" } } },
  });
  const header = [
    "Date",
    "Order no",
    "Created (IST)",
    "Status",
    "Payment",
    "Refund",
    "Late payment",
    "Type",
    "Table",
    "Customer",
    "Phone",
    "Items",
    "Total (INR)",
  ];
  const rows = orders.map((o) =>
    [
      o.numberDate,
      o.dailyNumber,
      formatIstDateTime(o.createdAt),
      o.status,
      o.paymentStatus,
      o.refundStatus,
      o.latePayment ? "yes" : "",
      o.type,
      o.tableLabel,
      o.customerName,
      o.customerPhone,
      o.items.map((i) => `${i.quantity} x ${i.nameSnapshot}`).join("; "),
      paiseToRupeeString(o.totalPaise),
    ]
      .map(csvCell)
      .join(","),
  );
  // BOM so Excel opens UTF-8 (Hindi/Marathi names) correctly.
  return "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";
}

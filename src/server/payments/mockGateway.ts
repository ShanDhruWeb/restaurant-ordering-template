// A pretend Razorpay for local development and tests (RAZORPAY_MOCK=true).
// It stores "Razorpay-side" payments in the MockGatewayPayment table and signs
// checkout responses and webhooks with the mock secrets, so the REAL verify,
// webhook and reconcile code runs unchanged. Refused in production (src/lib/env.ts).
import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { GatewayPayment, GatewayPaymentStatus, PaymentGateway } from "./types";

const id = (prefix: string) => `${prefix}_mock${randomBytes(7).toString("hex")}`;

type MockRow = {
  id: string;
  razorpayOrderId: string;
  amountPaise: number;
  status: string;
  method: string;
  createdAt: Date;
};

function toPayment(row: MockRow): GatewayPayment {
  return {
    id: row.id,
    orderId: row.razorpayOrderId,
    amountPaise: row.amountPaise,
    currency: "INR",
    status: row.status as GatewayPaymentStatus,
    method: row.method,
    errorDescription: row.status === "failed" ? "Mock payment failed" : null,
    amountRefundedPaise: 0,
    createdAt: row.createdAt,
  };
}

export class MockGateway implements PaymentGateway {
  readonly mode = "mock" as const;

  async createOrder(input: { amountPaise: number }) {
    return { id: id("order"), amountPaise: input.amountPaise, currency: "INR" };
  }

  async fetchPayment(paymentId: string) {
    const row = await prisma.mockGatewayPayment.findUnique({ where: { id: paymentId } });
    return row ? toPayment(row) : null;
  }

  async fetchOrderPayments(razorpayOrderId: string) {
    const rows = await prisma.mockGatewayPayment.findMany({
      where: { razorpayOrderId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPayment);
  }

  async listPayments(range: { from: Date; to: Date }) {
    const rows = await prisma.mockGatewayPayment.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPayment);
  }
}

/** Simulate the customer finishing (or failing) a payment in Razorpay Checkout. */
export async function mockCustomerPays(args: {
  razorpayOrderId: string;
  amountPaise: number;
  outcome: "captured" | "failed";
}): Promise<GatewayPayment> {
  const row = await prisma.mockGatewayPayment.create({
    data: {
      id: id("pay"),
      razorpayOrderId: args.razorpayOrderId,
      amountPaise: args.amountPaise,
      status: args.outcome,
    },
  });
  return toPayment(row);
}

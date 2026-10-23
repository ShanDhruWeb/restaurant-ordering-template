// Types shared by both gateway implementations.
export interface GatewayOrder {
  id: string;
  amountPaise: number;
  currency: string;
}

export type GatewayPaymentStatus = "created" | "authorized" | "captured" | "refunded" | "failed";

export interface GatewayPayment {
  id: string;
  orderId: string | null;
  amountPaise: number;
  currency: string;
  status: GatewayPaymentStatus;
  method: string | null;
  errorDescription: string | null;
  amountRefundedPaise: number;
  createdAt: Date;
}

export interface PaymentGateway {
  readonly mode: "mock" | "test" | "live";
  createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<GatewayOrder>;
  /** null if Razorpay has no such payment. */
  fetchPayment(paymentId: string): Promise<GatewayPayment | null>;
  fetchOrderPayments(razorpayOrderId: string): Promise<GatewayPayment[]>;
  /** Every payment created in the time range (paginated internally, capped). */
  listPayments(range: { from: Date; to: Date }): Promise<GatewayPayment[]>;
}

/** Thrown when Razorpay cannot be reached or answers with an error. Safe to retry. */
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/** A captured payment, or a refunded one (it was captured before the refund). */
export function wasCaptured(p: GatewayPayment): boolean {
  return p.status === "captured" || p.status === "refunded";
}

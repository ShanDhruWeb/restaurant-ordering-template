// The real Razorpay REST API (https://razorpay.com/docs/api/). We call four
// endpoints with fetch instead of using the SDK. Never log the key secret or
// raw response bodies.
import "server-only";
import { z } from "zod";
import { log } from "@/lib/log";
import { GatewayError, type GatewayOrder, type GatewayPayment, type PaymentGateway } from "./types";

const API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 8000;
const PAGE_SIZE = 100; // Razorpay maximum for GET /payments
const MAX_PAGES = 20;

const orderSchema = z.object({ id: z.string(), amount: z.number().int(), currency: z.string() });

export const razorpayPaymentSchema = z.object({
  id: z.string(),
  order_id: z.string().nullable().optional(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
  method: z.string().nullable().optional(),
  error_description: z.string().nullable().optional(),
  amount_refunded: z.number().int().optional(),
  created_at: z.number().int(),
});

const collectionSchema = z.object({ items: z.array(razorpayPaymentSchema) });

export function toGatewayPayment(p: z.infer<typeof razorpayPaymentSchema>): GatewayPayment {
  return {
    id: p.id,
    orderId: p.order_id ?? null,
    amountPaise: p.amount,
    currency: p.currency,
    status: p.status,
    method: p.method ?? null,
    errorDescription: p.error_description ?? null,
    amountRefundedPaise: p.amount_refunded ?? 0,
    createdAt: new Date(p.created_at * 1000),
  };
}

export class RazorpayGateway implements PaymentGateway {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    readonly mode: "test" | "live",
  ) {}

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      throw new GatewayError(`Razorpay unreachable: ${(err as Error).name}`);
    }
    if (!res.ok) {
      // Razorpay error bodies contain only a code and description, never secrets,
      // but we still log just the code.
      let code = "unknown";
      try {
        const parsed = (await res.json()) as { error?: { code?: string } };
        code = parsed.error?.code ?? code;
      } catch {
        /* ignore */
      }
      throw new GatewayError(
        `Razorpay ${method} ${path.split("?")[0]} failed: ${res.status} ${code}`,
        res.status,
      );
    }
    return res.json();
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
    const data = orderSchema.parse(
      await this.call("POST", "/orders", {
        amount: input.amountPaise,
        currency: "INR",
        receipt: input.receipt.slice(0, 40), // Razorpay limit: 40 characters
        notes: input.notes,
      }),
    );
    return { id: data.id, amountPaise: data.amount, currency: data.currency } satisfies GatewayOrder;
  }

  async fetchPayment(paymentId: string) {
    try {
      return toGatewayPayment(
        razorpayPaymentSchema.parse(await this.call("GET", `/payments/${encodeURIComponent(paymentId)}`)),
      );
    } catch (err) {
      if (err instanceof GatewayError && (err.status === 404 || err.status === 400)) return null;
      throw err;
    }
  }

  async fetchOrderPayments(razorpayOrderId: string) {
    const data = collectionSchema.parse(
      await this.call("GET", `/orders/${encodeURIComponent(razorpayOrderId)}/payments`),
    );
    return data.items.map(toGatewayPayment);
  }

  async listPayments(range: { from: Date; to: Date }) {
    const from = Math.floor(range.from.getTime() / 1000);
    const to = Math.floor(range.to.getTime() / 1000);
    const all: GatewayPayment[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = collectionSchema.parse(
        await this.call("GET", `/payments?from=${from}&to=${to}&count=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`),
      );
      all.push(...data.items.map(toGatewayPayment));
      if (data.items.length < PAGE_SIZE) return all;
    }
    log.warn("razorpay listPayments hit the page cap; narrow the date range", { count: all.length });
    return all;
  }
}

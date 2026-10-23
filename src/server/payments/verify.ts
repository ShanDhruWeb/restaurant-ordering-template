// The browser's "payment done" callback: POST /api/orders/:id/verify.
// The checkout signature proves the ids came from Razorpay; we then ask Razorpay
// for the payment itself to learn the real amount before calling markOrderPaid.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { log } from "@/lib/log";
import { markOrderPaid } from "./confirm";
import { getGateway, wasCaptured } from "./gateway";
import { verifyCheckoutSignature } from "./signature";

export const verifyBodySchema = z
  .object({
    razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
    razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
    razorpay_signature: z.string().regex(/^[0-9a-fA-F]{64}$/),
  })
  .strict();

export type VerifyResult = { status: "paid" | "pending" };

export async function verifyPayment(
  orderId: string,
  body: z.infer<typeof verifyBodySchema>,
): Promise<VerifyResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, razorpayOrderId: true, paymentStatus: true },
  });
  if (!order) throw new HttpError(404, "Order not found.", "not_found");
  // The Razorpay order must be the one we created for THIS order.
  if (!order.razorpayOrderId || order.razorpayOrderId !== body.razorpay_order_id) {
    log.warn("verify: razorpay order does not belong to this order", { orderId });
    throw new HttpError(400, "Payment details do not match this order.", "payment_mismatch");
  }
  const ok = verifyCheckoutSignature(
    {
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    },
    getEnv().razorpay.keySecret,
  );
  if (!ok) {
    log.warn("verify: bad checkout signature", { orderId });
    throw new HttpError(400, "We could not verify this payment.", "invalid_signature");
  }
  if (order.paymentStatus === "paid") return { status: "paid" };

  // Ask Razorpay for the amount. If Razorpay is slow or the payment is only
  // authorised so far, answer "pending": the tracking page, webhook and
  // reconcile will finish the job.
  try {
    const payment = await getGateway().fetchPayment(body.razorpay_payment_id);
    if (!payment || payment.orderId !== body.razorpay_order_id || !wasCaptured(payment)) {
      return { status: "pending" };
    }
    const r = await markOrderPaid({
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: payment.id,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      method: payment.method,
      source: "verify",
    });
    return { status: r.outcome === "paid" || r.outcome === "already_paid" ? "paid" : "pending" };
  } catch (err) {
    log.error("verify: could not confirm with Razorpay, leaving to webhook/reconcile", { orderId, err });
    return { status: "pending" };
  }
}

// The customer's tracking page polls this. For an unpaid order it also asks
// Razorpay (at most once per 10 seconds per order) whether a payment went
// through, which rescues customers who paid in a UPI app and never came back.
import "server-only";
import { log } from "@/lib/log";
import { expireIfStale, reconcileOrder } from "../payments/reconcile";
import { hit, LIMITS } from "../rateLimit";
import { getPublicOrder, type PublicOrder } from "./publicOrder";

export async function trackOrder(orderId: string, now = new Date()): Promise<PublicOrder | null> {
  const order = await getPublicOrder(orderId);
  if (!order) return null;
  if (order.paymentStatus === "paid" || order.status !== "pending_payment") return order;

  let reconcileFailed = false;
  if (await hit("track-reconcile", orderId, LIMITS.trackReconcile, now)) {
    try {
      const r = await reconcileOrder(orderId);
      // Reconcile may have changed the order (paid, or "payment failed").
      if (r.checked && r.outcomes.length > 0) return getPublicOrder(orderId);
    } catch (err) {
      reconcileFailed = true;
      log.warn("track: reconcile failed", { orderId, err });
    }
  }
  // Expire lazily, but never while we could not reach Razorpay.
  if (!reconcileFailed && new Date(order.expiresAt) < now && (await expireIfStale(orderId, now))) {
    return getPublicOrder(orderId);
  }
  return order;
}

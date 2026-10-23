// The ONE place that decides which order status changes are allowed.
// Pure functions, no database. tests/unit/stateMachine.test.ts covers every pair.
//
//   pending_payment -> paid -> preparing -> ready -> completed
//   pending_payment -> expired          (customer never paid in time)
//   paid | preparing -> cancelled       (staff cancel; a refund is then needed)
//   expired -> paid                     (staff accept a LATE payment and cook it)
import type { OrderStatus } from "@/lib/orderTypes";

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "expired"],
  paid: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
  expired: ["paid"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Order cannot go from ${from} to ${to}`);
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** The status the kitchen's one-tap "next" button moves to, if any. */
export function nextKitchenStatus(from: OrderStatus): OrderStatus | null {
  switch (from) {
    case "paid":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return "completed";
    default:
      return null;
  }
}

export function canCancel(status: OrderStatus): boolean {
  return canTransition(status, "cancelled");
}

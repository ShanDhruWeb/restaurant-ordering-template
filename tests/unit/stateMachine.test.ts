import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orderTypes";
import {
  assertTransition,
  canCancel,
  canTransition,
  InvalidTransitionError,
  nextKitchenStatus,
} from "@/server/orders/stateMachine";

const allowed = new Set([
  "pending_payment>paid",
  "pending_payment>expired",
  "paid>preparing",
  "paid>cancelled",
  "preparing>ready",
  "preparing>cancelled",
  "ready>completed",
  "expired>paid",
]);

const pairs: [OrderStatus, OrderStatus][] = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.map((to) => [from, to] as [OrderStatus, OrderStatus]),
);

describe("order state machine", () => {
  it.each(pairs)("%s -> %s", (from, to) => {
    const expected = allowed.has(`${from}>${to}`);
    expect(canTransition(from, to)).toBe(expected);
    if (expected) expect(() => assertTransition(from, to)).not.toThrow();
    else expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
  });

  it("covers all 49 pairs", () => {
    expect(pairs).toHaveLength(49);
  });

  it("terminal states go nowhere", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("completed", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });

  it("only pending_payment can expire", () => {
    for (const from of ORDER_STATUSES) {
      expect(canTransition(from, "expired")).toBe(from === "pending_payment");
    }
  });

  it("only paid and preparing can be cancelled", () => {
    expect(ORDER_STATUSES.filter(canCancel)).toEqual(["paid", "preparing"]);
  });

  it("kitchen one-tap advance follows the happy path", () => {
    expect(nextKitchenStatus("paid")).toBe("preparing");
    expect(nextKitchenStatus("preparing")).toBe("ready");
    expect(nextKitchenStatus("ready")).toBe("completed");
    for (const s of ["pending_payment", "completed", "cancelled", "expired"] as const) {
      expect(nextKitchenStatus(s)).toBeNull();
    }
    // Every one-tap step is itself an allowed transition.
    for (const s of ORDER_STATUSES) {
      const next = nextKitchenStatus(s);
      if (next) expect(canTransition(s, next)).toBe(true);
    }
  });
});

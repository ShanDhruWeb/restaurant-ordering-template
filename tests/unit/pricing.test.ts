import { describe, expect, it } from "vitest";
import { type MenuItemForPricing, priceCart } from "@/server/orders/pricing";

const cat = { isActive: true, deletedAt: null };
const item = (
  id: string,
  pricePaise: number,
  extra: Partial<MenuItemForPricing> = {},
): MenuItemForPricing => ({
  id,
  name: id,
  pricePaise,
  isVeg: true,
  isAvailable: true,
  deletedAt: null,
  category: cat,
  ...extra,
});

describe("priceCart", () => {
  it("uses database prices and exact paise arithmetic", () => {
    const cart = priceCart(
      [
        { menuItemId: "a", quantity: 3 },
        { menuItemId: "b", quantity: 1 },
      ],
      [item("a", 3333), item("b", 1)],
    );
    expect(cart.lines.map((l) => l.lineTotalPaise)).toEqual([9999, 1]);
    expect(cart.totalPaise).toBe(10000);
    expect(cart.problems).toEqual([]);
  });
  it("prices a large cart exactly", () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`i${i}`, 99_999 + i));
    const cart = priceCart(
      items.map((i) => ({ menuItemId: i.id, quantity: 10 })),
      items,
    );
    const expected = items.reduce((s, i) => s + i.pricePaise * 10, 0);
    expect(cart.totalPaise).toBe(expected);
    expect(Number.isInteger(cart.totalPaise)).toBe(true);
  });
  it("flags unknown, deleted and unavailable items", () => {
    const cart = priceCart(
      [
        { menuItemId: "gone", quantity: 1 },
        { menuItemId: "deleted", quantity: 1 },
        { menuItemId: "soldout", quantity: 1 },
        { menuItemId: "hiddenCat", quantity: 1 },
        { menuItemId: "ok", quantity: 2 },
      ],
      [
        item("deleted", 100, { deletedAt: new Date() }),
        item("soldout", 100, { isAvailable: false }),
        item("hiddenCat", 100, { category: { isActive: false, deletedAt: null } }),
        item("ok", 250),
      ],
    );
    expect(cart.problems).toEqual([
      { menuItemId: "gone", reason: "not_found" },
      { menuItemId: "deleted", reason: "not_found" },
      { menuItemId: "soldout", reason: "unavailable" },
      { menuItemId: "hiddenCat", reason: "unavailable" },
    ]);
    expect(cart.totalPaise).toBe(500);
  });
});

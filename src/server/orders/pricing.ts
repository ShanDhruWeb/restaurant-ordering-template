// Prices a cart using ONLY database prices. Whatever price the browser thinks an
// item costs is ignored. Pure function: the caller loads the menu items.
import { lineTotalPaise, sumPaise } from "@/lib/money";

export interface CartLineInput {
  menuItemId: string;
  quantity: number;
}

export interface MenuItemForPricing {
  id: string;
  name: string;
  pricePaise: number;
  isVeg: boolean;
  isAvailable: boolean;
  deletedAt: Date | null;
  category: { isActive: boolean; deletedAt: Date | null };
}

export interface PricedLine {
  menuItemId: string;
  name: string;
  isVeg: boolean;
  unitPaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export type CartProblem = { menuItemId: string; reason: "not_found" | "unavailable" };

export interface PricedCart {
  lines: PricedLine[];
  /** Lines the customer can no longer order (sold out, removed). */
  problems: CartProblem[];
  subtotalPaise: number;
  totalPaise: number;
}

export function isOrderable(item: MenuItemForPricing): boolean {
  return item.isAvailable && !item.deletedAt && item.category.isActive && !item.category.deletedAt;
}

export function priceCart(lines: CartLineInput[], items: MenuItemForPricing[]): PricedCart {
  const byId = new Map(items.map((i) => [i.id, i]));
  const priced: PricedLine[] = [];
  const problems: CartProblem[] = [];

  for (const line of lines) {
    const item = byId.get(line.menuItemId);
    if (!item || item.deletedAt) {
      problems.push({ menuItemId: line.menuItemId, reason: "not_found" });
      continue;
    }
    if (!isOrderable(item)) {
      problems.push({ menuItemId: line.menuItemId, reason: "unavailable" });
      continue;
    }
    priced.push({
      menuItemId: item.id,
      name: item.name,
      isVeg: item.isVeg,
      unitPaise: item.pricePaise,
      quantity: line.quantity,
      lineTotalPaise: lineTotalPaise(item.pricePaise, line.quantity),
    });
  }

  const subtotalPaise = sumPaise(priced.map((l) => l.lineTotalPaise));
  // Prices include tax (or tax is shown as a note); no extra charges are added.
  return { lines: priced, problems, subtotalPaise, totalPaise: subtotalPaise };
}

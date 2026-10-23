// The public menu: active categories with their (non-deleted) items, in order.
import "server-only";
import { prisma } from "@/lib/db";
import { getOrderingState, type OrderingState } from "./settings";

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  isVeg: boolean;
  imagePath: string | null;
  isAvailable: boolean;
}

export interface PublicMenu {
  categories: { id: string; name: string; items: PublicMenuItem[] }[];
  ordering: OrderingState;
}

export async function getPublicMenu(): Promise<PublicMenu> {
  const [categories, ordering] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        items: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            description: true,
            pricePaise: true,
            isVeg: true,
            imagePath: true,
            isAvailable: true,
          },
        },
      },
    }),
    getOrderingState(),
  ]);
  return { categories: categories.filter((c) => c.items.length > 0), ordering };
}

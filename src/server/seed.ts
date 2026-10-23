// Loads prisma/menu.json into the database. Safe to run many times:
// existing categories and items (matched by "key") are left alone, so prices an
// owner has edited in /admin/menu are never overwritten, unless force is true.
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { parseRupeesToPaise } from "@/lib/money";

const keySchema = z.string().regex(/^[a-z0-9-]{1,60}$/, "use lowercase letters, numbers and dashes");

export const menuFileSchema = z
  .object({
    categories: z.array(
      z
        .object({
          key: keySchema,
          name: z.string().min(1).max(60),
          items: z.array(
            z
              .object({
                key: keySchema,
                name: z.string().min(1).max(80),
                description: z.string().max(300).default(""),
                price: z
                  .string()
                  .refine((p) => parseRupeesToPaise(p) !== null, "price must look like 120 or 120.50"),
                veg: z.boolean(),
                available: z.boolean().default(true),
                image: z.string().startsWith("/").optional(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export interface SeedResult {
  categoriesCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  skipped: number;
}

export async function seedMenu(
  db: PrismaClient,
  input: unknown,
  opts: { force?: boolean } = {},
): Promise<SeedResult> {
  const menu = menuFileSchema.parse(input);
  const result: SeedResult = { categoriesCreated: 0, itemsCreated: 0, itemsUpdated: 0, skipped: 0 };

  await db.setting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  for (const [ci, cat] of menu.categories.entries()) {
    let category = await db.category.findUnique({ where: { seedKey: cat.key } });
    if (!category) {
      category = await db.category.create({ data: { seedKey: cat.key, name: cat.name, sortOrder: ci * 10 } });
      result.categoriesCreated++;
    } else if (opts.force) {
      category = await db.category.update({
        where: { id: category.id },
        data: { name: cat.name, sortOrder: ci * 10, deletedAt: null, isActive: true },
      });
    }

    for (const [ii, item] of cat.items.entries()) {
      const data = {
        categoryId: category.id,
        name: item.name,
        description: item.description,
        pricePaise: parseRupeesToPaise(item.price)!,
        isVeg: item.veg,
        isAvailable: item.available,
        imagePath: item.image ?? null,
        sortOrder: ii * 10,
      };
      const existing = await db.menuItem.findUnique({ where: { seedKey: item.key } });
      if (!existing) {
        await db.menuItem.create({ data: { ...data, seedKey: item.key } });
        result.itemsCreated++;
      } else if (opts.force) {
        await db.menuItem.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } });
        result.itemsUpdated++;
      } else {
        result.skipped++;
      }
    }
  }
  return result;
}

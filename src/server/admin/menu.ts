// Menu editing for staff. Every change is audited. Items are soft-deleted so past
// orders keep their link; order lines already hold name and price snapshots.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { cleanText } from "../validation";
import { audit } from "./audit";
import type { Admin } from "./guard";

const cuid = z.string().regex(/^[a-z0-9]{20,40}$/);
const name = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => cleanText(s))
    .pipe(z.string().min(1).max(max));
const pricePaise = z.number().int().min(100).max(10_000_000); // ₹1 to ₹1,00,000
const imagePath = z
  .string()
  .trim()
  .max(200)
  .regex(/^(\/restaurant\/[A-Za-z0-9._\-/]+)?$/, 'Image must be a path like "/restaurant/menu/dosa.jpg"')
  .transform((s) => s || null);

export const menuActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_category"), name: name(60) }).strict(),
  z
    .object({
      action: z.literal("update_category"),
      id: cuid,
      name: name(60).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
  z.object({ action: z.literal("delete_category"), id: cuid }).strict(),
  z
    .object({
      action: z.literal("create_item"),
      categoryId: cuid,
      name: name(80),
      description: z
        .string()
        .max(600)
        .transform((s) => cleanText(s))
        .pipe(z.string().max(300))
        .default(""),
      pricePaise,
      isVeg: z.boolean(),
      imagePath: imagePath.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("update_item"),
      id: cuid,
      categoryId: cuid.optional(),
      name: name(80).optional(),
      description: z
        .string()
        .max(600)
        .transform((s) => cleanText(s))
        .pipe(z.string().max(300))
        .optional(),
      pricePaise: pricePaise.optional(),
      isVeg: z.boolean().optional(),
      isAvailable: z.boolean().optional(),
      imagePath: imagePath.optional(),
    })
    .strict(),
  z.object({ action: z.literal("delete_item"), id: cuid }).strict(),
  // Move one row up or down within its list.
  z.object({ action: z.literal("move_category"), id: cuid, direction: z.enum(["up", "down"]) }).strict(),
  z.object({ action: z.literal("move_item"), id: cuid, direction: z.enum(["up", "down"]) }).strict(),
]);

export type MenuAction = z.infer<typeof menuActionSchema>;

export async function getAdminMenu() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
}

const pick = <T extends object>(obj: T, keys: (keyof T)[]) =>
  Object.fromEntries(keys.map((k) => [k, obj[k]])) as Partial<T>;

export async function applyMenuAction(admin: Admin, input: MenuAction): Promise<void> {
  switch (input.action) {
    case "create_category": {
      const last = await prisma.category.findFirst({
        where: { deletedAt: null },
        orderBy: { sortOrder: "desc" },
      });
      const created = await prisma.category.create({
        data: { name: input.name, sortOrder: (last?.sortOrder ?? 0) + 10 },
      });
      return audit(admin, {
        action: "category.create",
        entityType: "Category",
        entityId: created.id,
        newValue: { name: input.name },
      });
    }
    case "update_category": {
      const { id, action: _a, ...data } = input;
      const old = await prisma.category.findFirst({ where: { id, deletedAt: null } });
      if (!old) throw new HttpError(404, "Category not found.", "not_found");
      await prisma.category.update({ where: { id }, data });
      return audit(admin, {
        action: "category.update",
        entityType: "Category",
        entityId: id,
        oldValue: pick(old, Object.keys(data) as (keyof typeof old)[]),
        newValue: data,
      });
    }
    case "delete_category": {
      const old = await prisma.category.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!old) throw new HttpError(404, "Category not found.", "not_found");
      const now = new Date();
      await prisma.$transaction([
        prisma.menuItem.updateMany({
          where: { categoryId: input.id, deletedAt: null },
          data: { deletedAt: now },
        }),
        prisma.category.update({ where: { id: input.id }, data: { deletedAt: now } }),
      ]);
      return audit(admin, {
        action: "category.delete",
        entityType: "Category",
        entityId: input.id,
        oldValue: { name: old.name },
      });
    }
    case "create_item": {
      const { action: _a, ...data } = input;
      const cat = await prisma.category.findFirst({ where: { id: data.categoryId, deletedAt: null } });
      if (!cat) throw new HttpError(404, "Category not found.", "not_found");
      const last = await prisma.menuItem.findFirst({
        where: { categoryId: data.categoryId, deletedAt: null },
        orderBy: { sortOrder: "desc" },
      });
      const created = await prisma.menuItem.create({
        data: { ...data, imagePath: data.imagePath ?? null, sortOrder: (last?.sortOrder ?? 0) + 10 },
      });
      return audit(admin, {
        action: "item.create",
        entityType: "MenuItem",
        entityId: created.id,
        newValue: data,
      });
    }
    case "update_item": {
      const { id, action: _a, ...data } = input;
      const old = await prisma.menuItem.findFirst({ where: { id, deletedAt: null } });
      if (!old) throw new HttpError(404, "Item not found.", "not_found");
      if (data.categoryId) {
        const cat = await prisma.category.findFirst({ where: { id: data.categoryId, deletedAt: null } });
        if (!cat) throw new HttpError(404, "Category not found.", "not_found");
      }
      await prisma.menuItem.update({ where: { id }, data });
      return audit(admin, {
        action:
          data.isAvailable !== undefined && Object.keys(data).length === 1
            ? "item.availability"
            : "item.update",
        entityType: "MenuItem",
        entityId: id,
        oldValue: pick(old, Object.keys(data) as (keyof typeof old)[]),
        newValue: data,
      });
    }
    case "delete_item": {
      const old = await prisma.menuItem.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!old) throw new HttpError(404, "Item not found.", "not_found");
      await prisma.menuItem.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      return audit(admin, {
        action: "item.delete",
        entityType: "MenuItem",
        entityId: input.id,
        oldValue: { name: old.name, pricePaise: old.pricePaise },
      });
    }
    case "move_category": {
      const list = await prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true },
      });
      await reorder("category", list, input.id, input.direction);
      return audit(admin, {
        action: "category.move",
        entityType: "Category",
        entityId: input.id,
        newValue: { direction: input.direction },
      });
    }
    case "move_item": {
      const item = await prisma.menuItem.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!item) throw new HttpError(404, "Item not found.", "not_found");
      const list = await prisma.menuItem.findMany({
        where: { categoryId: item.categoryId, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true },
      });
      await reorder("item", list, input.id, input.direction);
      return audit(admin, {
        action: "item.move",
        entityType: "MenuItem",
        entityId: input.id,
        newValue: { direction: input.direction },
      });
    }
  }
}

/** Swap with the neighbour and renumber the whole list 10, 20, 30… in one transaction. */
async function reorder(
  kind: "category" | "item",
  list: { id: string }[],
  id: string,
  direction: "up" | "down",
) {
  const index = list.findIndex((x) => x.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0) throw new HttpError(404, "Not found.", "not_found");
  if (target < 0 || target >= list.length) return;
  const ids = list.map((x) => x.id);
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  await prisma.$transaction(
    ids.map((rowId, i) =>
      kind === "category"
        ? prisma.category.update({ where: { id: rowId }, data: { sortOrder: (i + 1) * 10 } })
        : prisma.menuItem.update({ where: { id: rowId }, data: { sortOrder: (i + 1) * 10 } }),
    ),
  );
}

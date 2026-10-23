// Creating an order (POST /api/orders). Prices come from the database only.
import "server-only";
import { z } from "zod";
import { config, tableLabels } from "@/config";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { log } from "@/lib/log";
import { istDateString } from "@/lib/time";
import { getOrderingState } from "../settings";
import { customerNameSchema, noteSchema, normalizeIndianMobile } from "../validation";
import { type PricedCart, priceCart } from "./pricing";

const cuid = z.string().regex(/^[a-z0-9]{20,40}$/);

export const createOrderSchema = z
  .object({
    type: z.enum(["dine_in", "takeaway"]),
    table: z.string().max(12).optional(),
    customerName: customerNameSchema,
    customerPhone: z.string().max(20).optional(),
    note: noteSchema.optional(),
    items: z
      .array(
        z
          .object({
            menuItemId: cuid,
            quantity: z.number().int().min(1).max(config.ordering.maxQtyPerItem),
          })
          .strict(),
      )
      .min(1, "Your cart is empty")
      .max(config.ordering.maxItemsPerOrder),
    expectedTotalPaise: z.number().int().nonnegative().optional(),
    // Must be exactly true. Checked in createOrder so the customer gets a clear message.
    termsAccepted: z.boolean().optional(),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Fresh prices for the browser when the cart is out of date (409 cart_changed). */
export function freshCart(cart: PricedCart) {
  return {
    items: cart.lines.map((l) => ({
      menuItemId: l.menuItemId,
      name: l.name,
      pricePaise: l.unitPaise,
      isVeg: l.isVeg,
      quantity: l.quantity,
    })),
    removed: cart.problems,
    totalPaise: cart.totalPaise,
  };
}

export async function createOrder(input: CreateOrderInput, now = new Date()) {
  // Consent comes first: no order is created without it, whatever the client does.
  if (input.termsAccepted !== true) {
    throw new HttpError(
      400,
      "Please agree to the Terms and Conditions, Privacy Policy and Cancellation and Refund Policy.",
      "consent_required",
    );
  }
  // Business rules the schema cannot express.
  if (!config.ordering.types.includes(input.type)) {
    throw new HttpError(400, "That order type is not available.", "invalid_type");
  }
  let tableLabel: string | null = null;
  if (input.type === "dine_in") {
    tableLabel = input.table?.trim() ?? "";
    if (!tableLabels.includes(tableLabel)) {
      throw new HttpError(400, "Please choose a valid table.", "invalid_table");
    }
  }
  let phone: string | null = null;
  if (input.customerPhone && input.customerPhone.trim() !== "") {
    phone = normalizeIndianMobile(input.customerPhone);
    if (!phone) throw new HttpError(400, "Please enter a valid 10-digit mobile number.", "invalid_phone");
  } else if (config.ordering.requirePhone) {
    throw new HttpError(400, "Please enter your mobile number.", "invalid_phone");
  }
  const ids = input.items.map((i) => i.menuItemId);
  if (new Set(ids).size !== ids.length) {
    throw new HttpError(400, "The same item appears twice in the cart.", "duplicate_items");
  }

  const state = await getOrderingState(now);
  if (!state.accepting) {
    throw new HttpError(409, "Sorry, we are not taking orders right now.", "restaurant_closed", {
      reason: state.reason,
    });
  }

  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      pricePaise: true,
      isVeg: true,
      isAvailable: true,
      deletedAt: true,
      category: { select: { isActive: true, deletedAt: true } },
    },
  });
  const cart = priceCart(input.items, items);

  if (cart.problems.length > 0) {
    throw new HttpError(409, "Some items are no longer available. Please check your cart.", "cart_changed", {
      cart: freshCart(cart),
    });
  }
  if (input.expectedTotalPaise !== undefined && input.expectedTotalPaise !== cart.totalPaise) {
    throw new HttpError(409, "Prices have changed. Please check your cart.", "cart_changed", {
      cart: freshCart(cart),
    });
  }

  const numberDate = istDateString(now);
  const expiresAt = new Date(now.getTime() + config.ordering.orderExpiryMinutes * 60_000);

  // The counter upsert is atomic; retry the rare unique-constraint race once or twice.
  for (let attempt = 1; ; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const counter = await tx.dailyCounter.upsert({
          where: { date: numberDate },
          create: { date: numberDate, next: 2 },
          update: { next: { increment: 1 } },
        });
        return tx.order.create({
          data: {
            dailyNumber: counter.next - 1,
            numberDate,
            type: input.type,
            tableLabel,
            customerName: input.customerName,
            customerPhone: phone,
            note: config.ordering.notesEnabled && input.note ? input.note : null,
            subtotalPaise: cart.subtotalPaise,
            totalPaise: cart.totalPaise,
            expiresAt,
            termsAcceptedAt: now,
            items: {
              create: cart.lines.map((l) => ({
                menuItemId: l.menuItemId,
                nameSnapshot: l.name,
                pricePaise: l.unitPaise,
                isVeg: l.isVeg,
                quantity: l.quantity,
              })),
            },
          },
          select: { id: true, dailyNumber: true, totalPaise: true },
        });
      });
      log.info("order created", { orderId: order.id, totalPaise: order.totalPaise });
      return order;
    } catch (err) {
      if (attempt < 3 && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
        continue;
      throw err;
    }
  }
}

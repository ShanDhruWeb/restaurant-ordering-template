// Restaurant settings staff change at runtime (/admin/settings): the "accepting
// orders" switch and a banner message. Stored in a single Setting row (id = 1).
import "server-only";
import { config } from "@/config";
import { getIdentity } from "@/lib/identity";
import { prisma } from "@/lib/db";
import { isWithinHours } from "@/lib/time";

export async function getSettings() {
  return prisma.setting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export interface OrderingState {
  accepting: boolean;
  reason: "open" | "switched_off" | "outside_hours";
  bannerMessage: string;
}

/** Pure: can the restaurant take orders right now? */
export function orderingStateFrom(
  settings: { acceptingOrders: boolean; bannerMessage: string },
  now: Date,
  enforceHours = config.ordering.enforceHours,
): OrderingState {
  const base = { bannerMessage: settings.bannerMessage };
  if (!settings.acceptingOrders) return { ...base, accepting: false, reason: "switched_off" };
  if (enforceHours && !isWithinHours(getIdentity().hours, now)) {
    return { ...base, accepting: false, reason: "outside_hours" };
  }
  return { ...base, accepting: true, reason: "open" };
}

export async function getOrderingState(now = new Date()): Promise<OrderingState> {
  return orderingStateFrom(await getSettings(), now);
}

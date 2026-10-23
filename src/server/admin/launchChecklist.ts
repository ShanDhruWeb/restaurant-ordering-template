// Data for the admin Launch checklist: config-only checks plus two facts from the
// database and environment (menu photos, Razorpay mode).
import "server-only";
import { config } from "@/config";
import { buildLaunchChecklist, type ChecklistItem } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { getIdentity } from "@/lib/identity";
import { log } from "@/lib/log";
import { razorpayModeOrNull } from "../mode";

export async function getLaunchChecklist(): Promise<ChecklistItem[]> {
  let menu: { total: number; withoutPhoto: number } | null = null;
  try {
    const where = { deletedAt: null, category: { isActive: true, deletedAt: null } };
    const [total, withoutPhoto] = await Promise.all([
      prisma.menuItem.count({ where }),
      prisma.menuItem.count({ where: { ...where, imagePath: null } }),
    ]);
    menu = { total, withoutPhoto };
  } catch (err) {
    log.error("launch checklist: could not count menu items", { err });
  }
  return buildLaunchChecklist(config, {
    siteUrl: getIdentity().siteUrl,
    razorpayMode: razorpayModeOrNull(),
    menu,
  });
}

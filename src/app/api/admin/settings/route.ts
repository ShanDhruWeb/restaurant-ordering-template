// POST /api/admin/settings  { acceptingOrders?, bannerMessage? }
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJson } from "@/lib/http";
import { audit } from "@/server/admin/audit";
import { adminRoute } from "@/server/admin/guard";
import { getSettings } from "@/server/settings";
import { cleanText } from "@/server/validation";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    acceptingOrders: z.boolean().optional(),
    bannerMessage: z
      .string()
      .max(400)
      .transform((s) => cleanText(s))
      .pipe(z.string().max(160))
      .optional(),
  })
  .strict();

export const POST = adminRoute("admin.settings", async (request, ctx) => {
  const input = await readJson(request, schema);
  const old = await getSettings();
  const updated = await prisma.setting.update({ where: { id: 1 }, data: input });
  await audit(ctx.admin, {
    action: "settings.update",
    entityType: "Setting",
    entityId: "1",
    oldValue: { acceptingOrders: old.acceptingOrders, bannerMessage: old.bannerMessage },
    newValue: input,
  });
  return Response.json({ acceptingOrders: updated.acceptingOrders, bannerMessage: updated.bannerMessage });
});

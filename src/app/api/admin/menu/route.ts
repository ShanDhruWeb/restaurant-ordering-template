// GET  /api/admin/menu  full menu including hidden categories and sold-out items
// POST /api/admin/menu  one change (see menuActionSchema); every change is audited
import { readJson } from "@/lib/http";
import { adminRoute } from "@/server/admin/guard";
import { applyMenuAction, getAdminMenu, menuActionSchema } from "@/server/admin/menu";

export const dynamic = "force-dynamic";

export const GET = adminRoute("admin.menu.get", async () =>
  Response.json({ categories: await getAdminMenu() }),
);

export const POST = adminRoute("admin.menu.change", async (request, ctx) => {
  const input = await readJson(request, menuActionSchema);
  await applyMenuAction(ctx.admin, input);
  return Response.json({ categories: await getAdminMenu() });
});

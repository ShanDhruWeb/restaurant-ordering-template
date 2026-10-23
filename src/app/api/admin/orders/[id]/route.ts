// GET  /api/admin/orders/:id  full order detail (staff only)
// POST /api/admin/orders/:id  { action: "acknowledge" | "advance" | "cancel" | "accept_late" | "mark_refund_needed" }
import { HttpError, orderIdParam, readJson, readParams } from "@/lib/http";
import { adminRoute } from "@/server/admin/guard";
import { applyOrderAction, getAdminOrder, orderActionSchema } from "@/server/admin/orders";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

export const GET = adminRoute<P>("admin.order.get", async (_request, _ctx, routeArg) => {
  const { id } = await readParams(routeArg, orderIdParam);
  const order = await getAdminOrder(id);
  if (!order) throw new HttpError(404, "Order not found.", "not_found");
  return Response.json({ order });
});

export const POST = adminRoute<P>("admin.order.action", async (request, ctx, routeArg) => {
  const { id } = await readParams(routeArg, orderIdParam);
  const input = await readJson(request, orderActionSchema);
  await applyOrderAction(ctx.admin, id, input);
  return Response.json({ ok: true });
});

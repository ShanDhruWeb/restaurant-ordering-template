// GET /api/orders/:id: public tracking view (no phone, no payment ids).
import { HttpError, orderIdParam, readParams, route } from "@/lib/http";
import { trackOrder } from "@/server/orders/track";

export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ id: string }> }>(
  "orders.get",
  async (_request, _ctx, routeArg) => {
    const { id } = await readParams(routeArg, orderIdParam);
    const order = await trackOrder(id);
    if (!order) throw new HttpError(404, "Order not found.", "not_found");
    return Response.json({ order });
  },
);

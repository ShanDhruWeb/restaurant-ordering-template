// POST /api/orders/:id/verify: Razorpay Checkout handler callback.
import { orderIdParam, readJson, readParams, route } from "@/lib/http";
import { verifyBodySchema, verifyPayment } from "@/server/payments/verify";
import { enforce, LIMITS } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

export const POST = route<{ params: Promise<{ id: string }> }>(
  "orders.verify",
  async (request, ctx, routeArg) => {
    const { id } = await readParams(routeArg, orderIdParam);
    await enforce("verify-ip", ctx.ip, LIMITS.verifyIp);
    const body = await readJson(request, verifyBodySchema);
    return Response.json(await verifyPayment(id, body));
  },
);

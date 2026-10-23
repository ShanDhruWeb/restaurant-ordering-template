// POST /api/orders/:id/pay: start or retry payment. Reuses the order's Razorpay order.
import { orderIdParam, readParams, route } from "@/lib/http";
import { startPayment } from "@/server/payments/startPayment";
import { enforce, LIMITS } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

export const POST = route<{ params: Promise<{ id: string }> }>(
  "orders.pay",
  async (_request, ctx, routeArg) => {
    const { id } = await readParams(routeArg, orderIdParam);
    await enforce("pay-ip", ctx.ip, LIMITS.payIp);
    await enforce("pay-order", id, LIMITS.payOrder);
    return Response.json(await startPayment(id));
  },
);

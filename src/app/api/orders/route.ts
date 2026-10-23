// POST /api/orders: create an order (status pending_payment). Returns a safe projection.
import { clientIp, readJson, route } from "@/lib/http";
import { createOrder, createOrderSchema } from "@/server/orders/create";
import { enforce, LIMITS } from "@/server/rateLimit";
import { normalizeIndianMobile } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = route("orders.create", async (request) => {
  await enforce("order-ip", clientIp(request), LIMITS.createOrderIp);
  const input = await readJson(request, createOrderSchema);
  const phone = input.customerPhone ? normalizeIndianMobile(input.customerPhone) : null;
  if (phone) await enforce("order-phone", phone, LIMITS.createOrderPhone);
  const order = await createOrder(input);
  return Response.json(
    { id: order.id, number: order.dailyNumber, totalPaise: order.totalPaise },
    { status: 201 },
  );
});

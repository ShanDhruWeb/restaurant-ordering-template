// POST /api/dev/mock-pay: ONLY in mock mode (RAZORPAY_MOCK=true, never production).
// Plays the part of the customer inside Razorpay Checkout so the full flow can be
// tested with no keys. Outcomes:
//   success              checkout handler fires AND the webhook arrives
//   success_webhook_only customer closed the tab; only the webhook arrives
//   success_silent       tab closed and webhook lost; only reconcile can find it
//   fail                 payment fails; the customer can retry on the same order
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { HttpError, readJson, route } from "@/lib/http";
import { log } from "@/lib/log";
import { mockCustomerPays } from "@/server/payments/mockGateway";
import { buildWebhook } from "@/server/payments/mockWebhook";
import { hmacSha256Hex } from "@/server/payments/signature";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    razorpayOrderId: z.string().regex(/^order_mock[a-f0-9]{14}$/),
    outcome: z.enum(["success", "success_webhook_only", "success_silent", "fail"]),
  })
  .strict();

export const POST = route("dev.mockPay", async (request) => {
  const env = getEnv();
  if (env.razorpay.mode !== "mock" || env.nodeEnv === "production") {
    throw new HttpError(404, "Not found.", "not_found");
  }
  const body = await readJson(request, bodySchema);
  const order = await prisma.order.findUnique({
    where: { razorpayOrderId: body.razorpayOrderId },
    select: { totalPaise: true },
  });
  if (!order) throw new HttpError(404, "Unknown mock order.", "not_found");

  const failed = body.outcome === "fail";
  const payment = await mockCustomerPays({
    razorpayOrderId: body.razorpayOrderId,
    amountPaise: order.totalPaise,
    outcome: failed ? "failed" : "captured",
  });

  if (body.outcome !== "success_silent") {
    // Deliver the signed webhook over real HTTP a moment later, like Razorpay does.
    const hook = buildWebhook(
      failed ? "payment.failed" : "payment.captured",
      {
        id: payment.id,
        order_id: body.razorpayOrderId,
        amount: payment.amountPaise,
        status: failed ? "failed" : "captured",
        error_description: failed ? "Mock payment failed" : null,
      },
      env.razorpay.webhookSecret,
    );
    setTimeout(() => {
      fetch(`${env.siteUrl}/api/webhooks/razorpay`, {
        method: "POST",
        headers: hook.headers,
        body: hook.body,
      }).catch((err: unknown) => log.warn("mock webhook delivery failed", { err }));
    }, 2500);
  }

  if (failed) {
    return Response.json({ status: "failed", error: { description: "Mock payment failed. Try again." } });
  }
  if (body.outcome !== "success") return Response.json({ status: "no_callback" });
  return Response.json({
    status: "success",
    response: {
      razorpay_order_id: body.razorpayOrderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: hmacSha256Hex(env.razorpay.keySecret, `${body.razorpayOrderId}|${payment.id}`),
    },
  });
});

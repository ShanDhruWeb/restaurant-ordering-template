// POST /api/webhooks/razorpay. Set this URL and the webhook secret in the Razorpay
// dashboard (docs/ONBOARDING.md). Unhandled errors become 500 so Razorpay retries.
import { HttpError, route } from "@/lib/http";
import { handleRazorpayWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 256 * 1024;

export const POST = route("webhooks.razorpay", async (request) => {
  // The signature covers the exact bytes Razorpay sent: read the RAW text.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    throw new HttpError(413, "Payload too large.", "too_large");
  }
  const result = await handleRazorpayWebhook({
    rawBody,
    signature: request.headers.get("x-razorpay-signature"),
    eventIdHeader: request.headers.get("x-razorpay-event-id"),
  });
  return Response.json(result.body, { status: result.status });
});

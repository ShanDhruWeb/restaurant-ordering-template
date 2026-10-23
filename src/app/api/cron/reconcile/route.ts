// GET /api/cron/reconcile: sweep unpaid orders against Razorpay and expire stale ones.
// Call with header "Authorization: Bearer <CRON_SECRET>" (Vercel Cron does this).
import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { HttpError, route } from "@/lib/http";
import { sweep } from "@/server/payments/reconcile";
import { cleanupRateLimits } from "@/server/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export const GET = route("cron.reconcile", async (request) => {
  if (!authorised(request.headers.get("authorization"), getEnv().cronSecret)) {
    throw new HttpError(401, "Unauthorised.", "unauthorised");
  }
  const result = await sweep();
  await cleanupRateLimits();
  return Response.json({ ok: true, ...result });
});

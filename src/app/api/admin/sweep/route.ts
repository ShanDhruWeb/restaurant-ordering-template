// POST /api/admin/sweep: staff press "Check payments now" on /admin/payments.
import { adminRoute } from "@/server/admin/guard";
import { sweep } from "@/server/payments/reconcile";
import { enforce } from "@/server/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = adminRoute("admin.sweep", async () => {
  await enforce("admin-sweep", "global", { limit: 6, windowSec: 60 });
  return Response.json(await sweep());
});

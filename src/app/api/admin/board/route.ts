// GET /api/admin/board: active PAID orders for the kitchen (polled every 4 seconds).
// Also runs the payment sweep at most once a minute while a board is open, so
// late payments and expiries are handled even without an external cron.
import { log } from "@/lib/log";
import { adminRoute } from "@/server/admin/guard";
import { getBoard } from "@/server/admin/orders";
import { sweep } from "@/server/payments/reconcile";
import { hit, LIMITS } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

export const GET = adminRoute("admin.board", async () => {
  if (await hit("board-sweep", "global", LIMITS.sweep)) {
    try {
      await sweep(new Date(), 30);
    } catch (err) {
      log.error("board sweep failed", { err });
    }
  }
  return Response.json(await getBoard());
});

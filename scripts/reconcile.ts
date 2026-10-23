// npm run reconcile
// Same as GET /api/cron/reconcile: checks unpaid orders from the last 24 hours
// against Razorpay, records any payments it finds, then expires stale orders.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { sweep } from "@/server/payments/reconcile";
import { cleanupRateLimits } from "@/server/rateLimit";

async function main() {
  const result = await sweep();
  const removed = await cleanupRateLimits();
  console.log(
    `Checked ${result.checked} orders with Razorpay. Recovered payments: ${result.paidFound}. ` +
      `Expired: ${result.expired}. Errors: ${result.errors}. Rate-limit rows cleaned: ${removed}.`,
  );
  if (result.problems > 0) {
    console.log(`${result.problems} payment issue(s) need attention: open /admin/payments.`);
  }
  if (result.errors > 0) process.exitCode = 2;
}

main()
  .catch((err) => {
    console.error("Reconcile failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

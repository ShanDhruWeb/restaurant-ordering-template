// Uptime check: GET /api/health -> { ok, db, razorpayMode, complianceReady, version }. No secrets.
// complianceReady comes from restaurant.config.ts only (see src/lib/compliance.ts).
import { config } from "@/config";
import { isComplianceReady } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { route } from "@/lib/http";
import { log } from "@/lib/log";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

export const GET = route("health", async () => {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (err) {
    log.error("health: database unreachable", { err });
  }
  let razorpayMode: string = "unknown";
  try {
    razorpayMode = getEnv().razorpay.mode;
  } catch {
    razorpayMode = "misconfigured";
  }
  const ok = db && razorpayMode !== "misconfigured";
  return Response.json(
    { ok, db, razorpayMode, complianceReady: isComplianceReady(config), version: pkg.version },
    { status: ok ? 200 : 503 },
  );
});

// Fixed-window rate limiter stored in Postgres, so it works on serverless hosts
// without Redis. Each (name, subject, window) is one row with an atomic counter.
import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";

export interface Limit {
  limit: number;
  windowSec: number;
}

export const LIMITS = {
  login: { limit: 10, windowSec: 15 * 60 },
  loginEmail: { limit: 5, windowSec: 15 * 60 },
  createOrderIp: { limit: 15, windowSec: 10 * 60 },
  createOrderPhone: { limit: 6, windowSec: 10 * 60 },
  payIp: { limit: 40, windowSec: 10 * 60 },
  payOrder: { limit: 15, windowSec: 10 * 60 },
  verifyIp: { limit: 40, windowSec: 10 * 60 },
  trackReconcile: { limit: 1, windowSec: 10 },
  sweep: { limit: 1, windowSec: 60 },
} satisfies Record<string, Limit>;

// Phone numbers and emails are hashed so the table holds no personal data.
function subjectKey(subject: string): string {
  return createHash("sha256").update(subject).digest("hex").slice(0, 24);
}

/** Count one hit. Returns whether it is within the limit. */
export async function hit(name: string, subject: string, limit: Limit, now = new Date()): Promise<boolean> {
  const windowMs = limit.windowSec * 1000;
  const windowIndex = Math.floor(now.getTime() / windowMs);
  const key = `${name}:${subjectKey(subject)}:${windowIndex}`;
  const row = await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date((windowIndex + 1) * windowMs) },
    update: { count: { increment: 1 } },
  });
  return row.count <= limit.limit;
}

/** Like hit(), but throws a 429 the client can show. */
export async function enforce(name: string, subject: string, limit: Limit): Promise<void> {
  if (!(await hit(name, subject, limit))) {
    throw new HttpError(429, "Too many attempts. Please wait a minute and try again.", "rate_limited");
  }
}

export async function cleanupRateLimits(now = new Date()): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}

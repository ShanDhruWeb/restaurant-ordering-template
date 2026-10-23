// The one Prisma client for the app. Uses the POOLED DATABASE_URL through the pg
// driver adapter (Prisma 7). Migrations use DATABASE_URL_UNPOOLED via prisma.config.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient(): PrismaClient {
  // Small pool: on serverless every instance has its own pool, and the
  // database's pooler (e.g. Neon's PgBouncer) does the heavy lifting.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

// Keep one client across hot reloads in development.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Prisma CLI configuration (migrations, generate, studio).
// The CLI always uses the DIRECT (non-pooled) connection. The running app uses the
// pooled DATABASE_URL through the driver adapter in src/lib/db.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Not using env() here so that `prisma generate` (run on install) works without a database.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});

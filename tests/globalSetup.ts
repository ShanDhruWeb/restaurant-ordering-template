// Runs once before all tests. If DATABASE_URL_TEST is set, applies migrations to
// that (disposable) database. Refuses to run if it looks like the dev database.
import { execSync } from "node:child_process";
import "dotenv/config";

export default function setup() {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) {
    console.warn(
      "\n⚠️  Integration tests SKIPPED: DATABASE_URL_TEST is not set.\n" +
        "   Set it to a separate, disposable Postgres database to run them (see docs/TESTING.md).\n",
    );
    return;
  }
  const sameAs = (other: string | undefined) => other && hostAndDb(other) === hostAndDb(testUrl);
  if (sameAs(process.env.DATABASE_URL) || sameAs(process.env.DATABASE_URL_UNPOOLED)) {
    throw new Error(
      "DATABASE_URL_TEST points at the same database as DATABASE_URL/DATABASE_URL_UNPOOLED. " +
        "Tests wipe every table, so they refuse to run against your dev database.",
    );
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL_UNPOOLED: testUrl, DATABASE_URL: testUrl },
  });
}

// Compare host + database name, ignoring Neon's "-pooler" host suffix and params.
function hostAndDb(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace("-pooler", "")}/${u.pathname}`;
  } catch {
    return url;
  }
}

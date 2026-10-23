// Runs before every test file. Gives unit tests a safe, fake environment.
// Integration tests switch DATABASE_URL to DATABASE_URL_TEST (see tests/integration/db.ts).
import "dotenv/config";

process.env.RAZORPAY_MOCK = "true";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef0123";
process.env.CRON_SECRET ??= "test-cron-secret-0123456789";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
if (process.env.DATABASE_URL_TEST) {
  // Never let a test touch the dev database.
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
} else {
  process.env.DATABASE_URL = "postgresql://no-test-database-configured@localhost:1/none";
}

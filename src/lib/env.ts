// Server environment variables, validated with zod the first time they are read.
// Never import this file from client components: it holds secrets.
// Every variable is documented in docs/ENV.md and .env.example.
import "server-only";
import { z } from "zod";

const flag = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (pooled Postgres connection string)"),
  DATABASE_URL_UNPOOLED: z.preprocess(emptyToUndefined, z.string().optional()),
  RAZORPAY_MOCK: flag,
  RAZORPAY_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  RAZORPAY_KEY_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  RAZORPAY_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  ALLOW_TEST_KEYS: flag,
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_SITE_URL: z.url("NEXT_PUBLIC_SITE_URL must be a full URL like https://order.example.com"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.url().optional()),
});

export type RazorpayMode = "mock" | "test" | "live";

export interface ServerEnv {
  nodeEnv: "development" | "production" | "test";
  databaseUrl: string;
  razorpay: { mode: RazorpayMode; keyId: string; keySecret: string; webhookSecret: string };
  sessionSecret: string;
  siteUrl: string;
  cronSecret: string;
  sentryDsn?: string;
}

// Fixed secrets used only by the mock gateway. They protect nothing real.
const MOCK_RAZORPAY = {
  keyId: "rzp_test_mockmockmock",
  keySecret: "mock_key_secret_not_a_real_secret",
  webhookSecret: "mock_webhook_secret_not_a_real_secret",
};

/** Pure function so it can be unit tested with any input. */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Environment variables are invalid (see docs/ENV.md):\n${lines.join("\n")}`);
  }
  const e = result.data;
  const problems: string[] = [];
  let razorpay: ServerEnv["razorpay"];

  if (e.RAZORPAY_MOCK) {
    if (e.NODE_ENV === "production") {
      problems.push("RAZORPAY_MOCK=true is not allowed in production. Remove it and set real Razorpay keys.");
    }
    razorpay = { mode: "mock", ...MOCK_RAZORPAY };
  } else {
    const keyId = e.RAZORPAY_KEY_ID ?? "";
    if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
      problems.push("RAZORPAY_KEY_ID is missing or does not start with rzp_test_ or rzp_live_");
    }
    if (!e.RAZORPAY_KEY_SECRET) problems.push("RAZORPAY_KEY_SECRET is required");
    if (!e.RAZORPAY_WEBHOOK_SECRET) problems.push("RAZORPAY_WEBHOOK_SECRET is required");
    const mode: RazorpayMode = keyId.startsWith("rzp_live_") ? "live" : "test";
    if (mode === "test" && e.NODE_ENV === "production" && !e.ALLOW_TEST_KEYS) {
      problems.push(
        "Razorpay TEST keys are set in production. Use live keys, or set ALLOW_TEST_KEYS=true for a staging site.",
      );
    }
    razorpay = {
      mode,
      keyId,
      keySecret: e.RAZORPAY_KEY_SECRET ?? "",
      webhookSecret: e.RAZORPAY_WEBHOOK_SECRET ?? "",
    };
  }

  if (problems.length > 0) {
    throw new Error(
      `Environment variables are invalid (see docs/ENV.md):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }

  return {
    nodeEnv: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    razorpay,
    sessionSecret: e.SESSION_SECRET,
    siteUrl: e.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""),
    cronSecret: e.CRON_SECRET,
    sentryDsn: e.SENTRY_DSN,
  };
}

let cached: ServerEnv | undefined;

/** Validated env. Throws a readable error naming every missing or bad variable. */
export function getEnv(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Tests only: forget the cached env after changing process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}

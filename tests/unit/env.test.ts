import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost/db",
  SESSION_SECRET: "x".repeat(32),
  CRON_SECRET: "y".repeat(16),
  NEXT_PUBLIC_SITE_URL: "https://order.example.com/",
};
const liveKeys = {
  RAZORPAY_KEY_ID: "rzp_live_abc123",
  RAZORPAY_KEY_SECRET: "s",
  RAZORPAY_WEBHOOK_SECRET: "w",
};

describe("parseEnv", () => {
  it("accepts mock mode in development", () => {
    const env = parseEnv({ ...base, NODE_ENV: "development", RAZORPAY_MOCK: "true" });
    expect(env.razorpay.mode).toBe("mock");
    expect(env.siteUrl).toBe("https://order.example.com");
  });
  it("refuses mock mode in production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production", RAZORPAY_MOCK: "true" })).toThrow(
      /RAZORPAY_MOCK/,
    );
  });
  it("derives live/test mode from the key prefix", () => {
    expect(parseEnv({ ...base, ...liveKeys, NODE_ENV: "production" }).razorpay.mode).toBe("live");
    expect(parseEnv({ ...base, ...liveKeys, RAZORPAY_KEY_ID: "rzp_test_abc" }).razorpay.mode).toBe("test");
  });
  it("refuses test keys in production unless ALLOW_TEST_KEYS=true", () => {
    const testKeys = { ...liveKeys, RAZORPAY_KEY_ID: "rzp_test_abc" };
    expect(() => parseEnv({ ...base, ...testKeys, NODE_ENV: "production" })).toThrow(/TEST keys/);
    expect(
      parseEnv({ ...base, ...testKeys, NODE_ENV: "production", ALLOW_TEST_KEYS: "true" }).razorpay.mode,
    ).toBe("test");
  });
  it("names every missing variable", () => {
    let msg = "";
    try {
      parseEnv({ NODE_ENV: "development" });
    } catch (e) {
      msg = (e as Error).message;
    }
    for (const name of ["DATABASE_URL", "SESSION_SECRET", "NEXT_PUBLIC_SITE_URL", "CRON_SECRET"]) {
      expect(msg).toContain(name);
    }
  });
  it("requires Razorpay keys when not in mock mode", () => {
    expect(() => parseEnv({ ...base })).toThrow(/RAZORPAY_KEY_ID/);
    expect(() => parseEnv({ ...base, RAZORPAY_KEY_ID: "rzp_live_x" })).toThrow(/RAZORPAY_KEY_SECRET/);
  });
  it("does not put secrets in error messages", () => {
    try {
      parseEnv({ ...base, ...liveKeys, RAZORPAY_KEY_ID: "rzp_test_abc", NODE_ENV: "production" });
    } catch (e) {
      expect((e as Error).message).not.toContain("rzp_test_abc");
    }
  });
});

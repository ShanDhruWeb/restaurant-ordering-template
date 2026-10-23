// Runs once when the server starts. Fails fast, with a readable message, if the
// environment or restaurant.config.ts is wrong, instead of failing on the first
// customer. This is also where production refuses mock mode and test keys.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("@/lib/env");
  const { log } = await import("@/lib/log");
  const env = getEnv(); // throws on any problem
  await import("@/config"); // validates restaurant.config.ts (throws on any problem)
  log.info("server starting", {
    version: process.env.npm_package_version,
    nodeEnv: env.nodeEnv,
    razorpayMode: env.razorpay.mode,
  });
}

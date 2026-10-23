// Which Razorpay mode the server runs in, without throwing (used for banners).
import "server-only";
import { getEnv, type RazorpayMode } from "@/lib/env";

export function razorpayModeOrNull(): RazorpayMode | null {
  try {
    return getEnv().razorpay.mode;
  } catch {
    return null;
  }
}

/** Test and mock mode both show the TEST MODE banner: no real money moves. */
export function isTestMode(): boolean {
  const mode = razorpayModeOrNull();
  return mode === "test" || mode === "mock";
}

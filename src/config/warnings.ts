// Soft problems with the config: the app still runs, but the owner should fix them.
import { displayNameMatches, SIMILARITY_THRESHOLD } from "@/lib/similarity";
import type { RestaurantConfig } from "./schema";

export function configWarnings(cfg: RestaurantConfig, siteUrl: string): string[] {
  const warnings: string[] = [];
  const display = cfg.payments.checkoutDisplayName;
  const match = displayNameMatches(display, cfg.legal.businessLegalName, siteUrl);
  if (!match.ok) {
    warnings.push(
      `payments.checkoutDisplayName "${display}" is only ${Math.round(match.best * 100)}% similar to the legal name ` +
        `or the domain. Razorpay needs at least ${Math.round(SIMILARITY_THRESHOLD * 100)}%, otherwise it may reject the brand name.`,
    );
  }
  return warnings;
}

import { describe, expect, it } from "vitest";
import { orderingStateFrom } from "@/server/settings";

// Demo config hours: every day 08:00-23:00 IST.
const at = (iso: string) => new Date(`${iso}+05:30`);

describe("orderingStateFrom", () => {
  const on = { acceptingOrders: true, bannerMessage: "" };
  it("master switch off always closes", () => {
    expect(
      orderingStateFrom({ ...on, acceptingOrders: false }, at("2026-03-02T12:00:00"), false),
    ).toMatchObject({
      accepting: false,
      reason: "switched_off",
    });
  });
  it("hours are ignored unless enforceHours is true", () => {
    expect(orderingStateFrom(on, at("2026-03-02T03:00:00"), false).accepting).toBe(true);
    expect(orderingStateFrom(on, at("2026-03-02T03:00:00"), true)).toMatchObject({
      accepting: false,
      reason: "outside_hours",
    });
    expect(orderingStateFrom(on, at("2026-03-02T12:00:00"), true).accepting).toBe(true);
  });
  it("passes the banner message through", () => {
    expect(
      orderingStateFrom({ ...on, bannerMessage: "Closing early" }, new Date(), false).bannerMessage,
    ).toBe("Closing early");
  });
});

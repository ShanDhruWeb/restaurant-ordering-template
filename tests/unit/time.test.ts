import { describe, expect, it } from "vitest";
import { formatHHMM, istDateString, istDayKey, istDayRange, istMinuteOfDay, isWithinHours } from "@/lib/time";

describe("IST day boundaries", () => {
  it("rolls over at IST midnight, not UTC midnight", () => {
    // 18:29:59 UTC = 23:59:59 IST on the 1st
    expect(istDateString(new Date("2026-03-01T18:29:59Z"))).toBe("2026-03-01");
    // 18:30:00 UTC = 00:00 IST on the 2nd
    expect(istDateString(new Date("2026-03-01T18:30:00Z"))).toBe("2026-03-02");
  });
  it("handles year and leap-day boundaries", () => {
    expect(istDateString(new Date("2026-12-31T18:30:00Z"))).toBe("2027-01-01");
    expect(istDateString(new Date("2028-02-28T18:30:00Z"))).toBe("2028-02-29");
  });
  it("gives the UTC range of an IST day", () => {
    const { start, end } = istDayRange("2026-03-02");
    expect(start.toISOString()).toBe("2026-03-01T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-03-02T18:30:00.000Z");
    expect(() => istDayRange("2026-3-2")).toThrow();
  });
  it("computes minute of day and weekday in IST", () => {
    expect(istMinuteOfDay(new Date("2026-03-01T18:30:00Z"))).toBe(0);
    // 2026-03-01 is a Sunday; 18:30 UTC is already Monday in IST
    expect(istDayKey(new Date("2026-03-01T18:29:00Z"))).toBe("sun");
    expect(istDayKey(new Date("2026-03-01T18:30:00Z"))).toBe("mon");
  });
});

describe("isWithinHours", () => {
  const ist = (iso: string) => new Date(`${iso}+05:30`);
  const allDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  it("same-day window: open inclusive, close exclusive", () => {
    const h = { days: [...allDays], open: "08:00", close: "23:00" };
    expect(isWithinHours(h, ist("2026-03-02T07:59:00"))).toBe(false);
    expect(isWithinHours(h, ist("2026-03-02T08:00:00"))).toBe(true);
    expect(isWithinHours(h, ist("2026-03-02T22:59:00"))).toBe(true);
    expect(isWithinHours(h, ist("2026-03-02T23:00:00"))).toBe(false);
  });
  it("respects closed days", () => {
    const h = { days: ["tue" as const], open: "08:00", close: "23:00" };
    expect(isWithinHours(h, ist("2026-03-02T12:00:00"))).toBe(false); // Monday
    expect(isWithinHours(h, ist("2026-03-03T12:00:00"))).toBe(true); // Tuesday
  });
  it("overnight window belongs to the day it opened", () => {
    const h = { days: ["fri" as const], open: "18:00", close: "02:00" };
    expect(isWithinHours(h, ist("2026-03-06T19:00:00"))).toBe(true); // Fri evening
    expect(isWithinHours(h, ist("2026-03-07T01:30:00"))).toBe(true); // Sat early, Fri's window
    expect(isWithinHours(h, ist("2026-03-07T02:00:00"))).toBe(false);
    expect(isWithinHours(h, ist("2026-03-07T19:00:00"))).toBe(false); // Sat evening, closed
    expect(isWithinHours(h, ist("2026-03-06T01:00:00"))).toBe(false); // Fri early = Thu's window
  });
  it("equal open and close means open all day", () => {
    expect(
      isWithinHours({ days: [...allDays], open: "00:00", close: "00:00" }, ist("2026-03-02T03:00:00")),
    ).toBe(true);
  });
  it("formats times for people", () => {
    expect(formatHHMM("08:00")).toBe("8:00 AM");
    expect(formatHHMM("00:30")).toBe("12:30 AM");
    expect(formatHHMM("12:00")).toBe("12:00 PM");
    expect(formatHHMM("23:05")).toBe("11:05 PM");
  });
});

// Business time is Asia/Kolkata (IST, UTC+05:30, no daylight saving).
// "Today", daily order numbers and reports all use IST, whatever the server's timezone.
import type { DayKey } from "@/config/schema";

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_KEYS_BY_UTC_DAY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** The IST calendar date, "YYYY-MM-DD", for an instant. */
export function istDateString(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutes since IST midnight (0..1439). */
export function istMinuteOfDay(at: Date = new Date()): number {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function istDayKey(at: Date = new Date()): DayKey {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return DAY_KEYS_BY_UTC_DAY[shifted.getUTCDay()]!;
}

/** UTC instants for the start (inclusive) and end (exclusive) of an IST date. */
export function istDayRange(date: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  const start = new Date(`${date}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid date: ${date}`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface OpeningHours {
  days: DayKey[];
  open: string;
  close: string;
}

/**
 * Is the restaurant inside its opening hours at this instant?
 * A close time earlier than the open time means the window runs past midnight
 * (e.g. 18:00 to 01:00); the early-morning part belongs to the previous day's opening.
 * Equal open and close times mean open all day.
 */
export function isWithinHours(hours: OpeningHours, at: Date = new Date()): boolean {
  const open = parseHHMM(hours.open);
  const close = parseHHMM(hours.close);
  const minute = istMinuteOfDay(at);
  const today = istDayKey(at);
  const yesterday = istDayKey(new Date(at.getTime() - 24 * 60 * 60 * 1000));

  if (open === close) return hours.days.includes(today);
  if (open < close) return hours.days.includes(today) && minute >= open && minute < close;
  return (hours.days.includes(today) && minute >= open) || (hours.days.includes(yesterday) && minute < close);
}

/** "08:00" -> "8:00 AM" */
export function formatHHMM(value: string): string {
  const total = parseHHMM(value);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const istTimeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const istDateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatIstTime(at: Date | string): string {
  return istTimeFormat.format(new Date(at));
}

export function formatIstDateTime(at: Date | string): string {
  return istDateTimeFormat.format(new Date(at));
}

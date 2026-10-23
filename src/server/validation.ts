// Input cleaning and validation shared by API routes. Pure functions.
import { z } from "zod";

// Control characters, plus bidi-override characters that can make text display
// misleadingly. Emoji joiners (U+200D) are kept so emoji stay intact.
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Remove control characters (keep newlines in notes), collapse spaces, trim. */
export function cleanText(input: string, opts: { multiline?: boolean } = {}): string {
  const unified = input.replace(/\r\n?/g, "\n");
  if (opts.multiline) {
    return unified
      .replace(CONTROL_CHARS, " ")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return unified.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

/**
 * Indian mobile number -> 10 digits, or null if invalid.
 * Accepts spaces/dashes and a +91, 91 or 0 prefix. Mobile numbers start with 6-9.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const LIMITS = {
  nameMax: 60,
  noteMax: 200,
} as const;

export const customerNameSchema = z
  .string()
  .max(200)
  .transform((s) => cleanText(s))
  .pipe(z.string().min(1, "Please enter your name").max(LIMITS.nameMax, "Name is too long"));

export const noteSchema = z
  .string()
  .max(1000)
  .transform((s) => cleanText(s, { multiline: true }))
  .pipe(z.string().max(LIMITS.noteMax, `Note must be ${LIMITS.noteMax} characters or fewer`));

/** First name only, for the public tracking page. */
export function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? "";
}

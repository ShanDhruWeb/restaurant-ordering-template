// Money is ALWAYS an integer number of paise (100 paise = 1 rupee).
// Never use floats for money. Convert to rupees only when showing it to a person.

const rupeeGrouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function assertPaise(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid paise amount: ${value}`);
  }
}

/** 12345 -> "₹123.45", 12300 -> "₹123", 123456700 -> "₹12,34,567". */
export function formatRupees(paise: number): string {
  assertPaise(paise);
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  const whole = rupeeGrouping.format(rupees);
  return rest === 0 ? `₹${whole}` : `₹${whole}.${String(rest).padStart(2, "0")}`;
}

/** Plain-text variant for CSV and logs: 12345 -> "123.45". */
export function paiseToRupeeString(paise: number): string {
  assertPaise(paise);
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

/**
 * Parse what staff type in the price box ("120", "120.5", "₹1,200.50") into paise
 * using string maths only. Returns null if it is not a valid price.
 */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.trim().replace(/^₹\s*/, "").replace(/,/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return rupees * 100 + Number(fraction);
}

/** Exact line total; throws if the result is not a safe integer. */
export function lineTotalPaise(unitPaise: number, quantity: number): number {
  assertPaise(unitPaise);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error(`Invalid quantity: ${quantity}`);
  const total = unitPaise * quantity;
  assertPaise(total);
  return total;
}

export function sumPaise(values: number[]): number {
  let total = 0;
  for (const v of values) {
    assertPaise(v);
    total += v;
  }
  assertPaise(total);
  return total;
}

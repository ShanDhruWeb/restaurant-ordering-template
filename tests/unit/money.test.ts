import { describe, expect, it } from "vitest";
import { formatRupees, lineTotalPaise, paiseToRupeeString, parseRupeesToPaise, sumPaise } from "@/lib/money";

describe("formatRupees", () => {
  it("formats whole and fractional rupees", () => {
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(12000)).toBe("₹120");
    expect(formatRupees(12050)).toBe("₹120.50");
    expect(formatRupees(12005)).toBe("₹120.05");
    expect(formatRupees(1)).toBe("₹0.01");
  });
  it("uses Indian digit grouping", () => {
    expect(formatRupees(123456700)).toBe("₹12,34,567");
  });
  it("rejects floats and negatives", () => {
    expect(() => formatRupees(1.5)).toThrow();
    expect(() => formatRupees(-1)).toThrow();
  });
});

describe("parseRupeesToPaise", () => {
  it.each([
    ["120", 12000],
    ["120.5", 12050],
    ["120.50", 12050],
    ["0.10", 10],
    ["₹1,200.99", 120099],
    [" 35 ", 3500],
  ])("%s -> %d paise", (input, expected) => {
    expect(parseRupeesToPaise(input)).toBe(expected);
  });
  it.each(["", "abc", "1.234", "-5", "1e3", "12.", ".5", "99999999"])("rejects %s", (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });
  it("has no float rounding errors (0.29 * 100 is 28.999... in floats)", () => {
    expect(parseRupeesToPaise("0.29")).toBe(29);
    expect(parseRupeesToPaise("1.15")).toBe(115);
  });
});

describe("totals", () => {
  it("multiplies and sums exactly", () => {
    expect(lineTotalPaise(3333, 3)).toBe(9999);
    expect(sumPaise([1, 2, 3])).toBe(6);
    expect(paiseToRupeeString(9999)).toBe("99.99");
  });
  it("handles large carts exactly", () => {
    const lines = Array.from({ length: 50 }, () => lineTotalPaise(99_999_99, 50));
    expect(sumPaise(lines)).toBe(99_999_99 * 50 * 50);
  });
  it("rejects bad quantities", () => {
    expect(() => lineTotalPaise(100, 0)).toThrow();
    expect(() => lineTotalPaise(100, 1.5)).toThrow();
    expect(() => lineTotalPaise(100, -1)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { createOrderSchema } from "@/server/orders/create";
import {
  cleanText,
  customerNameSchema,
  firstName,
  noteSchema,
  normalizeIndianMobile,
} from "@/server/validation";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["+91 98765-43210", "9876543210"],
    ["+919876543210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["6000000000", "6000000000"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });
  it.each(["", "12345", "5876543210", "98765432101", "+1 9876543210", "98765abcde", "०९८७६५४३२१"])(
    "rejects %s",
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );
});

describe("text cleaning", () => {
  it("trims and collapses whitespace in names", () => {
    expect(cleanText("  Asha   \t Patil \n")).toBe("Asha Patil");
  });
  it("removes control and bidi-override characters", () => {
    expect(cleanText("Ra\u0000hul‮")).toBe("Ra hul");
  });
  it("keeps unicode: Devanagari, accents and emoji (including ZWJ sequences)", () => {
    expect(cleanText("आशा पाटील")).toBe("आशा पाटील");
    expect(cleanText("José 👨‍👩‍👧")).toBe("José 👨‍👩‍👧");
  });
  it("keeps newlines in notes but limits blank lines", () => {
    expect(cleanText("less spicy\n\n\n\nno onion  ", { multiline: true })).toBe("less spicy\n\nno onion");
  });
});

describe("schemas", () => {
  it("name is required after trimming and limited to 60 chars", () => {
    expect(customerNameSchema.safeParse("   ").success).toBe(false);
    expect(customerNameSchema.safeParse("a".repeat(61)).success).toBe(false);
    expect(customerNameSchema.parse(" Asha ")).toBe("Asha");
  });
  it("note is limited to 200 characters after cleaning", () => {
    expect(noteSchema.safeParse("a".repeat(200)).success).toBe(true);
    expect(noteSchema.safeParse("a".repeat(201)).success).toBe(false);
    expect(noteSchema.safeParse("x".repeat(5000)).success).toBe(false);
  });
  it("firstName takes the first word", () => {
    expect(firstName("Asha Patil")).toBe("Asha");
  });
});

describe("createOrderSchema", () => {
  const item = { menuItemId: "cm0000000000000000000000a", quantity: 1 };
  const base = { type: "takeaway", customerName: "Asha", customerPhone: "9876543210", items: [item] };

  it("accepts a normal order", () => {
    expect(createOrderSchema.safeParse(base).success).toBe(true);
  });
  it.each([0, -1, 1.5, 11, Number.NaN, "2"])("rejects quantity %s", (quantity) => {
    expect(createOrderSchema.safeParse({ ...base, items: [{ ...item, quantity }] }).success).toBe(false);
  });
  it("rejects unknown fields such as a client-side price", () => {
    expect(createOrderSchema.safeParse({ ...base, items: [{ ...item, pricePaise: 1 }] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, totalPaise: 1 }).success).toBe(false);
  });
  it("rejects empty carts and too many lines", () => {
    expect(createOrderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => ({
      menuItemId: `cm${String(i).padStart(23, "0")}`,
      quantity: 1,
    }));
    expect(createOrderSchema.safeParse({ ...base, items: many }).success).toBe(false);
  });
  it("rejects malformed item ids", () => {
    expect(
      createOrderSchema.safeParse({ ...base, items: [{ menuItemId: "'; DROP TABLE", quantity: 1 }] }).success,
    ).toBe(false);
  });
  it("rejects extremely long input", () => {
    expect(createOrderSchema.safeParse({ ...base, customerName: "a".repeat(100_000) }).success).toBe(false);
  });
});

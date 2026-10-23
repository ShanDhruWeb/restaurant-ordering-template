import { describe, expect, it } from "vitest";
import rawConfig from "@config";
import { parseRestaurantConfig, tableLabelsOf } from "@/config/schema";
import { THEME_PRESETS, THEME_PRESET_NAMES } from "@/config/themes";

const clone = () => structuredClone(rawConfig) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("restaurant config", () => {
  it("the shipped demo config is valid", () => {
    expect(() => parseRestaurantConfig(rawConfig)).not.toThrow();
  });

  it("lists every problem with its path", () => {
    const bad = clone();
    bad.restaurant.address.pincode = "41104";
    bad.theme.preset = "neon";
    bad.ordering.maxQtyPerItem = 0;
    let message = "";
    try {
      parseRestaurantConfig(bad);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("restaurant.address.pincode");
    expect(message).toContain("theme.preset");
    expect(message).toContain("ordering.maxQtyPerItem");
  });

  it("rejects unknown keys (typos)", () => {
    const bad = clone();
    bad.ordering.requirePhon = true;
    expect(() => parseRestaurantConfig(bad)).toThrow(/ordering/);
  });

  it("rejects bad hex colours, GSTIN and FSSAI", () => {
    const bad = clone();
    bad.theme.colours = { primary: "red" };
    bad.legal.gstin = "123";
    bad.legal.fssai = "abc";
    const msg = (() => {
      try {
        parseRestaurantConfig(bad);
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    })();
    expect(msg).toContain("theme.colours.primary");
    expect(msg).toContain("legal.gstin");
    expect(msg).toContain("legal.fssai");
  });

  it("dine-in needs at least one table", () => {
    const bad = clone();
    bad.ordering.tables = 0;
    expect(() => parseRestaurantConfig(bad)).toThrow(/table/);
  });

  it("expands table counts and keeps custom labels", () => {
    expect(tableLabelsOf({ ordering: { tables: 3 } } as never)).toEqual(["1", "2", "3"]);
    expect(tableLabelsOf({ ordering: { tables: ["A1", "Patio 2"] } } as never)).toEqual(["A1", "Patio 2"]);
  });

  it("every preset can be selected", () => {
    for (const preset of THEME_PRESET_NAMES) {
      const c = clone();
      c.theme.preset = preset;
      expect(() => parseRestaurantConfig(c)).not.toThrow();
      expect(THEME_PRESETS[preset]).toBeDefined();
    }
  });
});

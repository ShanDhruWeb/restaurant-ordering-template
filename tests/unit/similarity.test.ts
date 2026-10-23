import { describe, expect, it } from "vitest";
import {
  displayNameMatches,
  domainLabel,
  nameSimilarity,
  normaliseName,
  stripCompanySuffix,
} from "@/lib/similarity";

describe("name similarity", () => {
  it("normalises case, spaces and punctuation", () => {
    expect(normaliseName("Demo  Kitchen!")).toBe("demokitchen");
    expect(nameSimilarity("Demo Kitchen", "DEMO-KITCHEN")).toBe(1);
  });

  it("is 0 when either side is empty, and low for different names", () => {
    expect(nameSimilarity("", "Demo")).toBe(0);
    expect(nameSimilarity("Spice Route", "Daily Grit")).toBeLessThan(0.5);
  });

  it("scores a small typo above 80% and a different brand below", () => {
    expect(nameSimilarity("Spice Route Cafe", "Spice Route Cafee")).toBeGreaterThan(0.9);
    expect(nameSimilarity("Spice Route", "Spice Routes Kitchen Co")).toBeLessThan(0.8);
  });

  it("strips company suffixes and parentheses", () => {
    expect(stripCompanySuffix("Spice Route Pvt Ltd")).toBe("Spice Route");
    expect(stripCompanySuffix("Spice Route Private Limited")).toBe("Spice Route");
    expect(stripCompanySuffix("Demo Kitchen (fictional business)")).toBe("Demo Kitchen");
  });

  it("extracts the domain label, ignoring www, localhost and IPs", () => {
    expect(domainLabel("https://www.demokitchen.in")).toBe("demokitchen");
    expect(domainLabel("http://localhost:3000")).toBe("");
    expect(domainLabel("http://127.0.0.1:3000")).toBe("");
    expect(domainLabel("not a url")).toBe("");
  });

  it("matches the legal name without its suffix, or the domain", () => {
    expect(displayNameMatches("Spice Route", "Spice Route Pvt Ltd", "http://localhost:3000").ok).toBe(true);
    expect(displayNameMatches("Spice Route", "Other Foods LLP", "https://spiceroute.in").ok).toBe(true);
    const bad = displayNameMatches("Tasty Bites", "Spice Route Pvt Ltd", "https://spiceroute.in");
    expect(bad.ok).toBe(false);
    expect(bad.best).toBeLessThan(0.8);
  });
});

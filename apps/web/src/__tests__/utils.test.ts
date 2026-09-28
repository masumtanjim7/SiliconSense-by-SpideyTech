import { describe, expect, it } from "vitest";
import {
  getBalanceColorClasses,
  getConfidenceBadgeClasses,
  getTierColorClasses,
} from "@/lib/utils";

describe("SiliconSense Design System Status Color Mappings", () => {
  it("maps performance tiers to semantic hardware lab colors", () => {
    expect(getTierColorClasses("High-end").stroke).toBe("#31D8C2");
    expect(getTierColorClasses("Mid-range").stroke).toBe("#6D7CFF");
    expect(getTierColorClasses("Basic").stroke).toBe("#F5B84B");
    expect(getTierColorClasses("Weak").stroke).toBe("#FF6484");
  });

  it("maps bottleneck statuses and confidence levels accurately", () => {
    expect(getBalanceColorClasses("Balanced").text).toContain("brand-cyan");
    expect(getBalanceColorClasses("Moderate bottleneck").text).toContain("brand-amber");
    expect(getBalanceColorClasses("Major bottleneck").text).toContain("brand-rose");
    expect(getConfidenceBadgeClasses("High").text).toContain("brand-cyan");
  });
});
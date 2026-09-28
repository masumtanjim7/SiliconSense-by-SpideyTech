import { describe, expect, it } from "vitest";
import { LANDING_DEMO_SCENARIOS } from "@/components/landing/LandingHeroDemo";

describe("Landing Page Demo Workload Scenarios", () => {
  it("includes all 5 core workloads with explicit Demo labels", () => {
    expect(LANDING_DEMO_SCENARIOS).toHaveLength(5);
    for (const scenario of LANDING_DEMO_SCENARIOS) {
      expect(scenario.explanation).toContain("Demo");
      expect(scenario.upgradePriority).toContain("Demo");
      for (const m of scenario.metrics) {
        expect(m.label).toContain("Demo");
      }
    }
  });

  it("shows that the same demo PC shifts performance and balance across workloads", () => {
    const gaming = LANDING_DEMO_SCENARIOS.find((s) => s.slug === "gaming");
    const localAi = LANDING_DEMO_SCENARIOS.find((s) => s.slug === "local-ai");
    expect(gaming?.balanceStatus).toBe("Balanced");
    expect(localAi?.balanceStatus).toBe("Moderate bottleneck");
    expect(gaming?.performanceScore).not.toBe(localAi?.performanceScore);
  });
});
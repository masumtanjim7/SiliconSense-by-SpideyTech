import { describe, expect, it } from "vitest";
import {
  buildComparisonTextSummary,
  buildContributionTextSummary,
  DEMO_COMPARISON_FIXTURE,
  DEMO_CONTRIBUTION_FIXTURE,
} from "@/components/charts/chart-utils";

describe("SiliconSense Recharts Accessibility & Summary Layer", () => {
  it("generates an accessible text summary identifying top and limiting contributors", () => {
    const summary = buildContributionTextSummary("Gaming", DEMO_CONTRIBUTION_FIXTURE);
    expect(summary).toContain("GPU Render & Compute (Demo)");
    expect(summary).toContain("43.0 weighted pts");
    expect(summary).toContain("CPU Multi-Core (Demo)");
  });

  it("generates a neutral, factual comparison summary without universal winner hype", () => {
    const summary = buildComparisonTextSummary(
      "Gaming",
      "Build A",
      "Build B",
      DEMO_COMPARISON_FIXTURE
    );
    expect(summary).toContain("Build A leads in 5 metric(s)");
    expect(summary).toContain("0 to 100 scale");
  });
});
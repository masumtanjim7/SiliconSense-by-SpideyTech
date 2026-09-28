import { describe, expect, it } from "vitest";
import type {
  AnalysisResultResponse,
  CompareBuildsResponse,
} from "@packages/contracts";
import {
  checkComparisonVersionCompatibility,
  deriveUpgradeHeadroomSummary,
  formatContextualPerformanceLead,
} from "@/components/compare/compare-helpers";

const MOCK_BUILD_A: AnalysisResultResponse = {
  analysis_id: 1,
  share_uuid: "uuid-a",
  build_name: "Rig Alpha",
  workload_slug: "gaming",
  workload_name: "Gaming",
  selected_components: {},
  performance_score_0_100: 84.0,
  performance_tier: "Strong",
  balance_score_0_100: 90.0,
  balance_status: "Balanced",
  confidence_score_0_100: 92.0,
  confidence_level: "High",
  coverage_ratio: 1.0,
  contributions: [],
  bottlenecks: [
    {
      limiting_component_type: "CPU",
      strongest_component_type: "GPU",
      spread_points: 6.5,
      severity_status: "Balanced",
      explanation: "Balanced",
    },
  ],
  recommendations: [],
  warnings: [],
  version_metadata: {
    dataset_version: "ds-2026-09-r1",
    normalization_version: "norm-v1.0",
    scoring_version: "score-v1.0",
    workload_profile_version: "1.0.0",
  },
  analyzed_at: "2026-09-28T10:00:00Z",
};

const MOCK_BUILD_B: AnalysisResultResponse = {
  ...MOCK_BUILD_A,
  analysis_id: 2,
  share_uuid: "uuid-b",
  build_name: "Rig Beta",
  performance_score_0_100: 68.0,
  performance_tier: "Mid-range",
  balance_score_0_100: 52.0,
  balance_status: "Moderate bottleneck",
  bottlenecks: [
    {
      limiting_component_type: "GPU",
      strongest_component_type: "CPU",
      spread_points: 32.0,
      severity_status: "Moderate bottleneck",
      explanation: "GPU limits CPU by 32 pts.",
    },
  ],
};

describe("Build Comparison Helpers (Prompt 16)", () => {
  it("uses workload-contextual language instead of universal winner hype", () => {
    const lead = formatContextualPerformanceLead(
      "Gaming",
      "Rig Alpha",
      "Rig Beta",
      16.0
    );
    expect(lead.headline).toBe("Rig Alpha: Higher Gaming Score (+16.0 pts)");
    expect(lead.subtext).toContain("not a universal winner");
    expect(lead.leadingBuild).toBe("A");
  });

  it("identifies which build has greater single-component upgrade headroom", () => {
    const headroom = deriveUpgradeHeadroomSummary(MOCK_BUILD_A, MOCK_BUILD_B);
    expect(headroom.moreConstrainedBuildName).toBe("Rig Beta");
    expect(headroom.summaryText).toContain("32.0 pt capability spread");
  });

  it("flags a compatibility warning if dataset or scoring versions do not match", () => {
    const mockComparison: CompareBuildsResponse = {
      workload_slug: "gaming",
      workload_name: "Gaming",
      dataset_version: "ds-2026-09-r1",
      is_directly_comparable: true,
      build_a: MOCK_BUILD_A,
      build_b: {
        ...MOCK_BUILD_B,
        version_metadata: {
          ...MOCK_BUILD_B.version_metadata,
          dataset_version: "ds-2026-08-old",
        },
      },
      performance_score_delta: 16.0,
      balance_score_delta: 38.0,
      metric_deltas: [],
      where_a_is_stronger: [],
      where_b_is_stronger: [],
      contextual_summary: "Contextual summary",
    };

    const check = checkComparisonVersionCompatibility(mockComparison);
    expect(check.compatible).toBe(false);
    expect(check.warningMessage).toContain("Version Mismatch Warning");
  });
});
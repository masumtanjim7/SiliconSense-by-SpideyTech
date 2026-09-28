import { describe, expect, it } from "vitest";
import type { AnalysisResultResponse } from "@packages/contracts";
import {
  deriveTopAndLimitingFactors,
  isAnalysisDatasetStale,
  resolveBottleneckDisplayState,
} from "@/components/result/result-helpers";

const MOCK_ANALYSIS_BASE: AnalysisResultResponse = {
  analysis_id: 101,
  share_uuid: "fake-share-uuid-101",
  build_name: "Test Rig",
  workload_slug: "gaming",
  workload_name: "Gaming",
  selected_components: {},
  performance_score_0_100: 78.5,
  performance_tier: "Strong",
  balance_score_0_100: 88.0,
  balance_status: "Balanced",
  confidence_score_0_100: 90.0,
  confidence_level: "High",
  coverage_ratio: 1.0,
  contributions: [
    {
      metric_key: "gpu_render_compute",
      display_name: "GPU Render & Compute",
      subsystem: "GPU",
      component_id: 6,
      normalized_score_0_100: 85.0,
      weight_applied: 0.5,
      weighted_contribution: 42.5,
      is_missing_metric: false,
    },
    {
      metric_key: "cpu_single",
      display_name: "CPU Single-Thread",
      subsystem: "CPU",
      component_id: 1,
      normalized_score_0_100: 48.0,
      weight_applied: 0.2,
      weighted_contribution: 9.6,
      is_missing_metric: false,
    },
  ],
  bottlenecks: [
    {
      limiting_component_type: "CPU",
      strongest_component_type: "GPU",
      spread_points: 8.0,
      severity_status: "Balanced",
      explanation: "Well-balanced for Gaming.",
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

describe("Analysis Result Storytelling Helpers", () => {
  it("identifies the top positive contributor and primary limiting metric", () => {
    const narrative = deriveTopAndLimitingFactors(
      "Gaming",
      MOCK_ANALYSIS_BASE.contributions
    );
    expect(narrative.topPositiveFactor).toContain("GPU Render & Compute (GPU)");
    expect(narrative.topPositiveFactor).toContain("42.5 weighted points");
    expect(narrative.primaryLimitingFactor).toContain("CPU Single-Thread (CPU)");
  });

  it("distinguishes insufficient data from no bottleneck and detected bottlenecks", () => {
    const balancedState = resolveBottleneckDisplayState(MOCK_ANALYSIS_BASE);
    expect(balancedState.mode).toBe("no_bottleneck");

    const sparseState = resolveBottleneckDisplayState({
      ...MOCK_ANALYSIS_BASE,
      coverage_ratio: 0.4,
      bottlenecks: [],
    });
    expect(sparseState.mode).toBe("insufficient_data");
    expect(sparseState.headline).toContain("Not Enough Multi-Subsystem Data");

    const bottleneckState = resolveBottleneckDisplayState({
      ...MOCK_ANALYSIS_BASE,
      balance_status: "Major bottleneck",
      bottlenecks: [
        {
          limiting_component_type: "CPU",
          strongest_component_type: "GPU",
          spread_points: 42.0,
          severity_status: "Major bottleneck",
          explanation: "CPU trails GPU by 42 points.",
        },
      ],
    });
    expect(bottleneckState.mode).toBe("bottleneck_detected");
    expect(bottleneckState.headline).toContain("CPU Limits GPU");
  });

  it("detects when an analysis dataset version is stale compared to current release", () => {
    expect(isAnalysisDatasetStale("ds-2026-08-r1", "ds-2026-09-r1")).toBe(true);
    expect(isAnalysisDatasetStale("ds-2026-09-r1", "ds-2026-09-r1")).toBe(false);
  });
});
import type {
  AnalysisResultResponse,
  MetricContributionSchema,
} from "@packages/contracts";

export interface FactorNarrativeSummary {
  topPositiveFactor: string;
  primaryLimitingFactor: string;
}

export type BottleneckDisplayMode =
  | "insufficient_data"
  | "no_bottleneck"
  | "bottleneck_detected";

export interface BottleneckDisplayState {
  mode: BottleneckDisplayMode;
  headline: string;
  detail: string;
  spreadPoints: number;
  limitingSubsystem: string | null;
  strongestSubsystem: string | null;
}

export function deriveTopAndLimitingFactors(
  workloadName: string,
  contributions: MetricContributionSchema[]
): FactorNarrativeSummary {
  const covered = contributions.filter(
    (c) => !c.is_missing_metric && c.normalized_score_0_100 !== null
  );

  if (covered.length === 0) {
    return {
      topPositiveFactor: `Insufficient benchmark coverage to determine top contributor for ${workloadName}.`,
      primaryLimitingFactor: `Insufficient benchmark coverage to isolate a limiting factor for ${workloadName}.`,
    };
  }

  const byWeightedContribution = [...covered].sort(
    (a, b) => b.weighted_contribution - a.weighted_contribution
  );
  const top = byWeightedContribution[0];

  const byLowestCapability = [...covered].sort(
    (a, b) =>
      (a.normalized_score_0_100 ?? 0) - (b.normalized_score_0_100 ?? 0)
  );
  const lowest = byLowestCapability[0];

  const topPositiveFactor =
    `${top.display_name} (${top.subsystem}) is your strongest workload driver, contributing ` +
    `${top.weighted_contribution.toFixed(1)} weighted points (${top.normalized_score_0_100?.toFixed(1)}/100 capability at ${Math.round(top.weight_applied * 100)}% weight).`;

  const primaryLimitingFactor =
    (lowest.normalized_score_0_100 ?? 0) >= 75.0
      ? `All covered metrics perform strongly; the lowest relative metric is ${lowest.display_name} (${lowest.subsystem}) at ${lowest.normalized_score_0_100?.toFixed(1)}/100.`
      : `${lowest.display_name} (${lowest.subsystem}) is the primary limiting metric at ${lowest.normalized_score_0_100?.toFixed(1)}/100 (${Math.round(lowest.weight_applied * 100)}% workload weight).`;

  return {
    topPositiveFactor,
    primaryLimitingFactor,
  };
}

export function resolveBottleneckDisplayState(
  analysis: AnalysisResultResponse
): BottleneckDisplayState {
  const primaryBottleneck = analysis.bottlenecks[0];

  if (!primaryBottleneck || analysis.coverage_ratio < 0.5) {
    return {
      mode: "insufficient_data",
      headline: "Not Enough Multi-Subsystem Data to Confirm Bottleneck",
      detail:
        "SiliconSense distinguishes missing evidence from a balanced build. Because benchmark coverage across workload-relevant subsystems is incomplete, we do not claim 'no bottleneck'.",
      spreadPoints: 0,
      limitingSubsystem: null,
      strongestSubsystem: null,
    };
  }

  if (
    analysis.balance_status === "Balanced" ||
    primaryBottleneck.spread_points <= 12.0
  ) {
    return {
      mode: "no_bottleneck",
      headline: "No Urgent Bottleneck Detected — Well-Balanced Synergy",
      detail: primaryBottleneck.explanation,
      spreadPoints: primaryBottleneck.spread_points,
      limitingSubsystem: primaryBottleneck.limiting_component_type,
      strongestSubsystem: primaryBottleneck.strongest_component_type,
    };
  }

  return {
    mode: "bottleneck_detected",
    headline: `${analysis.balance_status}: ${primaryBottleneck.limiting_component_type} Limits ${primaryBottleneck.strongest_component_type}`,
    detail: primaryBottleneck.explanation,
    spreadPoints: primaryBottleneck.spread_points,
    limitingSubsystem: primaryBottleneck.limiting_component_type,
    strongestSubsystem: primaryBottleneck.strongest_component_type,
  };
}

export function isAnalysisDatasetStale(
  analysisDatasetVersion: string,
  currentActiveDatasetVersion?: string | null
): boolean {
  if (!currentActiveDatasetVersion) return false;
  return analysisDatasetVersion.trim() !== currentActiveDatasetVersion.trim();
}
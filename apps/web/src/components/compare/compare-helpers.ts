import type {
  AnalysisResultResponse,
  CompareBuildsResponse,
} from "@packages/contracts";

export interface ContextualDeltaBadge {
  headline: string;
  subtext: string;
  leadingBuild: "A" | "B" | "TIE";
}

export function formatContextualPerformanceLead(
  workloadName: string,
  buildAName: string,
  buildBName: string,
  deltaAMinusB: number
): ContextualDeltaBadge {
  if (Math.abs(deltaAMinusB) <= 1.0) {
    return {
      headline: `Comparable ${workloadName} Score`,
      subtext: `Within ${Math.abs(deltaAMinusB).toFixed(1)} pts — virtually identical capability for ${workloadName}.`,
      leadingBuild: "TIE",
    };
  }

  if (deltaAMinusB > 1.0) {
    return {
      headline: `${buildAName}: Higher ${workloadName} Score (+${deltaAMinusB.toFixed(1)} pts)`,
      subtext: `Contextual advantage in ${workloadName} weighted metrics (not a universal winner across all tasks).`,
      leadingBuild: "A",
    };
  }

  return {
    headline: `${buildBName}: Higher ${workloadName} Score (+${Math.abs(deltaAMinusB).toFixed(1)} pts)`,
    subtext: `Contextual advantage in ${workloadName} weighted metrics (not a universal winner across all tasks).`,
    leadingBuild: "B",
  };
}

export function deriveUpgradeHeadroomSummary(
  buildA: AnalysisResultResponse,
  buildB: AnalysisResultResponse
): {
  moreConstrainedBuildName: string | null;
  summaryText: string;
} {
  const spreadA = buildA.bottlenecks[0]?.spread_points ?? 0;
  const spreadB = buildB.bottlenecks[0]?.spread_points ?? 0;

  if (spreadA <= 12.0 && spreadB <= 12.0) {
    return {
      moreConstrainedBuildName: null,
      summaryText:
        "Both builds are well-balanced (<= 12 pt spread) with no urgent single-component bottleneck holding back the workload.",
    };
  }

  if (spreadA > spreadB + 2.0) {
    const limitingA = buildA.bottlenecks[0]?.limiting_component_type ?? "component";
    return {
      moreConstrainedBuildName: buildA.build_name,
      summaryText: `${buildA.build_name} has larger single-component upgrade headroom: its ${limitingA} creates a ${spreadA.toFixed(1)} pt capability spread (vs. ${spreadB.toFixed(1)} pts on ${buildB.build_name}).`,
    };
  }

  if (spreadB > spreadA + 2.0) {
    const limitingB = buildB.bottlenecks[0]?.limiting_component_type ?? "component";
    return {
      moreConstrainedBuildName: buildB.build_name,
      summaryText: `${buildB.build_name} has larger single-component upgrade headroom: its ${limitingB} creates a ${spreadB.toFixed(1)} pt capability spread (vs. ${spreadA.toFixed(1)} pts on ${buildA.build_name}).`,
    };
  }

  return {
    moreConstrainedBuildName: null,
    summaryText: `Both configurations exhibit a similar component spread (${spreadA.toFixed(1)} pts vs. ${spreadB.toFixed(1)} pts).`,
  };
}

export function checkComparisonVersionCompatibility(
  comparison: CompareBuildsResponse
): {
  compatible: boolean;
  warningMessage: string | null;
} {
  const metaA = comparison.build_a.version_metadata;
  const metaB = comparison.build_b.version_metadata;

  if (
    !comparison.is_directly_comparable ||
    metaA.dataset_version !== metaB.dataset_version ||
    metaA.scoring_version !== metaB.scoring_version ||
    metaA.normalization_version !== metaB.normalization_version
  ) {
    return {
      compatible: false,
      warningMessage:
        `Version Mismatch Warning: ${comparison.build_a.build_name} (${metaA.dataset_version} / ${metaA.scoring_version}) ` +
        `and ${comparison.build_b.build_name} (${metaB.dataset_version} / ${metaB.scoring_version}) were not computed under identical dataset or formula versions.`,
    };
  }

  return {
    compatible: true,
    warningMessage: null,
  };
}
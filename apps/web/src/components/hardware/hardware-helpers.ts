import type {
  ComponentDetailResponse,
  ComponentSummaryItem,
} from "@packages/contracts";

export type EvidenceCoverageState =
  | "verified_evidence"
  | "no_benchmark_evidence";

export interface ComponentEvidenceSummary {
  state: EvidenceCoverageState;
  badgeLabel: string;
  averageNormalizedScore: number | null;
  topPercentile: number | null;
  totalSamples: number;
  explanation: string;
}

export function summarizeComponentEvidence(
  detail: ComponentDetailResponse
): ComponentEvidenceSummary {
  const metrics = detail.normalized_metrics ?? [];

  if (metrics.length === 0) {
    return {
      state: "no_benchmark_evidence",
      badgeLabel: "Evidence Unknown (Not Low Performance)",
      averageNormalizedScore: null,
      topPercentile: null,
      totalSamples: 0,
      explanation:
        "No normalized benchmark observations are recorded for this component in the active dataset release. SiliconSense never fabricates scores when evidence is absent.",
    };
  }

  const sumScore = metrics.reduce(
    (acc, m) => acc + m.normalized_score_0_100,
    0
  );
  const avgScore = Number((sumScore / metrics.length).toFixed(1));
  const maxPercentile = Math.max(...metrics.map((m) => m.percentile));
  const totalSamples = metrics.reduce((acc, m) => acc + m.sample_count, 0);

  return {
    state: "verified_evidence",
    badgeLabel: `${metrics.length} Verified Metric(s) • ${totalSamples} Samples`,
    averageNormalizedScore: avgScore,
    topPercentile: Number(maxPercentile.toFixed(1)),
    totalSamples,
    explanation: `Backed by ${totalSamples} benchmark samples across ${metrics.length} normalized metric(s) in dataset ${metrics[0].dataset_version}.`,
  };
}

export function extractUniqueBrands(items: ComponentSummaryItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item.brand.trim()) {
      set.add(item.brand.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function formatHardwareSpecLine(item: ComponentSummaryItem): string {
  const spec = item.specification;
  if (!spec) return "Standard Curated Specification";

  const parts: string[] = [];
  if (spec.core_count) parts.push(`${spec.core_count} Cores`);
  if (spec.thread_count) parts.push(`${spec.thread_count} Threads`);
  if (spec.vram_gb) parts.push(`${spec.vram_gb} GB VRAM`);
  if (spec.ram_capacity_gb) parts.push(`${spec.ram_capacity_gb} GB Capacity`);
  if (spec.memory_speed) parts.push(spec.memory_speed);
  if (spec.storage_type) parts.push(spec.storage_type);

  return parts.length > 0
    ? parts.join(" • ")
    : "Standard Curated Specification";
}
export interface ContributionChartItem {
  metricKey: string;
  displayName: string;
  subsystem: string;
  normalizedScore: number | null;
  weightApplied: number;
  weightedContribution: number;
  isMissingMetric?: boolean;
}

export interface ComparisonChartItem {
  metricKey: string;
  displayName: string;
  subsystem: string;
  weight: number;
  buildAScore: number | null;
  buildBScore: number | null;
}

export function buildContributionTextSummary(
  workloadName: string,
  items: ContributionChartItem[]
): string {
  const available = items.filter(
    (i) => !i.isMissingMetric && i.normalizedScore !== null
  );
  if (available.length === 0) {
    return `No benchmark metric contributions available for ${workloadName}.`;
  }

  const sortedByContribution = [...available].sort(
    (a, b) => b.weightedContribution - a.weightedContribution
  );
  const top = sortedByContribution[0];
  const lowest = [...available].sort(
    (a, b) => (a.normalizedScore ?? 0) - (b.normalizedScore ?? 0)
  )[0];

  const missingCount = items.length - available.length;
  const missingNote =
    missingCount > 0
      ? ` ${missingCount} metric(s) lacked benchmark coverage and were excluded.`
      : "";

  return (
    `For ${workloadName}, ${top.displayName} (${top.subsystem}) contributed the most ` +
    `(${top.weightedContribution.toFixed(1)} weighted pts from a ${top.normalizedScore?.toFixed(1)}/100 score). ` +
    `The lowest normalized capability was ${lowest.displayName} (${lowest.subsystem}) at ` +
    `${lowest.normalizedScore?.toFixed(1)}/100.${missingNote}`
  );
}

export function buildComparisonTextSummary(
  workloadName: string,
  buildAName: string,
  buildBName: string,
  items: ComparisonChartItem[]
): string {
  const comparable = items.filter(
    (i) => i.buildAScore !== null && i.buildBScore !== null
  );
  if (comparable.length === 0) {
    return `Insufficient shared benchmark data to compare ${buildAName} and ${buildBName} for ${workloadName}.`;
  }

  let aLeads = 0;
  let bLeads = 0;
  for (const item of comparable) {
    const diff = (item.buildAScore ?? 0) - (item.buildBScore ?? 0);
    if (diff > 1.0) aLeads += 1;
    else if (diff < -1.0) bLeads += 1;
  }

  return (
    `In ${workloadName} across ${comparable.length} normalized metrics (0 to 100 scale), ` +
    `${buildAName} leads in ${aLeads} metric(s) and ${buildBName} leads in ${bLeads} metric(s).`
  );
}

export const DEMO_CONTRIBUTION_FIXTURE: ContributionChartItem[] = [
  {
    metricKey: "gpu_render_compute",
    displayName: "GPU Render & Compute (Demo)",
    subsystem: "GPU",
    normalizedScore: 86.0,
    weightApplied: 0.5,
    weightedContribution: 43.0,
  },
  {
    metricKey: "cpu_single",
    displayName: "CPU Single-Thread (Demo)",
    subsystem: "CPU",
    normalizedScore: 79.0,
    weightApplied: 0.2,
    weightedContribution: 15.8,
  },
  {
    metricKey: "ram_bandwidth_capacity",
    displayName: "System Memory Bandwidth (Demo)",
    subsystem: "RAM",
    normalizedScore: 75.0,
    weightApplied: 0.12,
    weightedContribution: 9.0,
  },
  {
    metricKey: "cpu_multi",
    displayName: "CPU Multi-Core (Demo)",
    subsystem: "CPU",
    normalizedScore: 74.0,
    weightApplied: 0.1,
    weightedContribution: 7.4,
  },
  {
    metricKey: "storage_throughput",
    displayName: "NVMe Sequential I/O (Demo)",
    subsystem: "STORAGE",
    normalizedScore: 82.5,
    weightApplied: 0.08,
    weightedContribution: 6.6,
  },
];

export const DEMO_COMPARISON_FIXTURE: ComparisonChartItem[] = [
  {
    metricKey: "gpu_render_compute",
    displayName: "GPU Render",
    subsystem: "GPU",
    weight: 0.5,
    buildAScore: 87.5,
    buildBScore: 62.5,
  },
  {
    metricKey: "cpu_single",
    displayName: "CPU Single",
    subsystem: "CPU",
    weight: 0.2,
    buildAScore: 82.0,
    buildBScore: 70.0,
  },
  {
    metricKey: "cpu_multi",
    displayName: "CPU Multi",
    subsystem: "CPU",
    weight: 0.1,
    buildAScore: 75.0,
    buildBScore: 60.0,
  },
  {
    metricKey: "ram_bandwidth_capacity",
    displayName: "RAM Bandwidth",
    subsystem: "RAM",
    weight: 0.12,
    buildAScore: 80.0,
    buildBScore: 55.0,
  },
  {
    metricKey: "storage_throughput",
    displayName: "Storage I/O",
    subsystem: "STORAGE",
    weight: 0.08,
    buildAScore: 85.0,
    buildBScore: 50.0,
  },
];
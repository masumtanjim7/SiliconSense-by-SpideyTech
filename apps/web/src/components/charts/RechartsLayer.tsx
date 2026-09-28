"use client";

import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { designTokens } from "@packages/design-tokens";
import { EmptyState, SkeletonSet } from "@/components/ui/interactive";
import {
  buildComparisonTextSummary,
  buildContributionTextSummary,
  type ComparisonChartItem,
  type ContributionChartItem,
} from "./chart-utils";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);
  return reduced;
}

export function ContributionChart({
  workloadName,
  items,
  isLoading = false,
}: {
  workloadName: string;
  items: ContributionChartItem[];
  isLoading?: boolean;
}) {
  const reducedMotion = useReducedMotion();

  if (isLoading) {
    return <SkeletonSet rows={4} />;
  }

  const available = items.filter(
    (item) => !item.isMissingMetric && item.normalizedScore !== null
  );

  if (available.length === 0) {
    return (
      <EmptyState
        title="Insufficient Benchmark Evidence"
        description={`No normalized metric data is available to plot the ${workloadName} contribution chart.`}
      />
    );
  }

  const chartData = available.map((item) => ({
    name: `${item.subsystem}: ${item.displayName}`,
    shortLabel: `${item.subsystem} (${Math.round(item.weightApplied * 100)}%)`,
    normalizedScore: Number((item.normalizedScore ?? 0).toFixed(1)),
    weightedContribution: Number(item.weightedContribution.toFixed(1)),
  }));

  const textSummary = buildContributionTextSummary(workloadName, items);

  return (
    <div
      className="p-5 rounded-card bg-surface-solid border border-white/10 space-y-4"
      role="region"
      aria-label={`${workloadName} component metric contribution chart`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-text-strong">
            Component Capability & Workload Contribution
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Normalized capability score (0–100 baseline) vs. weighted contribution to{" "}
            <span className="text-text-strong font-medium">{workloadName}</span>.
          </p>
        </div>
        <span className="text-[11px] font-mono text-text-muted">
          Axis Baseline: 0 – 100 pts
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 20, left: 12, bottom: 8 }}
          >
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 3"
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: designTokens.colors.text.muted, fontSize: 12 }}
              stroke="rgba(255,255,255,0.12)"
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              width={105}
              tick={{ fill: designTokens.colors.text.strong, fontSize: 12 }}
              stroke="rgba(255,255,255,0.12)"
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                backgroundColor: designTokens.colors.surface.solid,
                borderColor: "rgba(255,255,255,0.14)",
                borderRadius: "12px",
                color: designTokens.colors.text.strong,
                fontSize: "12px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            />
            <Bar
              dataKey="normalizedScore"
              name="Normalized Capability (0–100)"
              fill={designTokens.colors.brand.primary}
              radius={[0, 6, 6, 0]}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="weightedContribution"
              name="Weighted Workload Points"
              fill={designTokens.colors.brand.cyan}
              radius={[0, 6, 6, 0]}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-text-muted border-t border-white/5 pt-3 leading-relaxed">
        <span className="font-semibold text-text-strong">Chart Summary: </span>
        {textSummary}
      </p>
    </div>
  );
}

export function ComparisonBarChart({
  workloadName,
  buildAName,
  buildBName,
  items,
  isLoading = false,
}: {
  workloadName: string;
  buildAName: string;
  buildBName: string;
  items: ComparisonChartItem[];
  isLoading?: boolean;
}) {
  const reducedMotion = useReducedMotion();

  if (isLoading) {
    return <SkeletonSet rows={4} />;
  }

  const comparable = items.filter(
    (item) => item.buildAScore !== null || item.buildBScore !== null
  );

  if (comparable.length === 0) {
    return (
      <EmptyState
        title="No Comparable Metrics"
        description="Neither build has sufficient benchmark coverage for this workload."
      />
    );
  }

  const chartData = comparable.map((item) => ({
    metricLabel: `${item.subsystem}: ${item.displayName}`,
    [buildAName]: item.buildAScore !== null ? Number(item.buildAScore.toFixed(1)) : 0,
    [buildBName]: item.buildBScore !== null ? Number(item.buildBScore.toFixed(1)) : 0,
  }));

  const textSummary = buildComparisonTextSummary(
    workloadName,
    buildAName,
    buildBName,
    items
  );

  return (
    <div
      className="p-5 rounded-card bg-surface-solid border border-white/10 space-y-4"
      role="region"
      aria-label={`Comparison chart between ${buildAName} and ${buildBName} for ${workloadName}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-text-strong">
            Normalized Metric Comparison ({workloadName})
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Side-by-side capability comparison on a 0–100 percentile scale.
          </p>
        </div>
        <span className="text-[11px] font-mono text-text-muted">
          Unit: Normalized Score (0–100)
        </span>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
          >
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="metricLabel"
              tick={{ fill: designTokens.colors.text.muted, fontSize: 11 }}
              stroke="rgba(255,255,255,0.12)"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: designTokens.colors.text.muted, fontSize: 12 }}
              stroke="rgba(255,255,255,0.12)"
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                backgroundColor: designTokens.colors.surface.solid,
                borderColor: "rgba(255,255,255,0.14)",
                borderRadius: "12px",
                color: designTokens.colors.text.strong,
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
            <Bar
              dataKey={buildAName}
              fill={designTokens.colors.brand.primary}
              radius={[6, 6, 0, 0]}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey={buildBName}
              fill={designTokens.colors.brand.cyan}
              radius={[6, 6, 0, 0]}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-text-muted border-t border-white/5 pt-3 leading-relaxed">
        <span className="font-semibold text-text-strong">Comparison Summary: </span>
        {textSummary}
      </p>
    </div>
  );
}

export function PercentilePositionBar({
  componentName,
  metricLabel,
  percentile,
  sampleCount,
  datasetVersion,
}: {
  componentName: string;
  metricLabel: string;
  percentile: number;
  sampleCount: number;
  datasetVersion: string;
}) {
  const clamped = Math.max(0, Math.min(100, percentile));

  return (
    <div
      className="p-4 rounded-card bg-surface-solid border border-white/10 space-y-2.5"
      role="region"
      aria-label={`${componentName} percentile position: P${Math.round(clamped)}`}
    >
      <div className="flex items-center justify-between text-xs md:text-sm">
        <div>
          <span className="font-semibold text-text-strong">{componentName}</span>{" "}
          <span className="text-text-muted">• {metricLabel}</span>
        </div>
        <span className="font-mono text-xs text-brand-cyan font-semibold">
          P{Math.round(clamped)} ({clamped.toFixed(1)} / 100)
        </span>
      </div>

      <div className="relative h-3 w-full rounded-full bg-canvas border border-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-cyan"
          style={{ width: `${clamped}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
        <span>P0 (Weak)</span>
        <span>P35 (Basic)</span>
        <span>P55 (Mid)</span>
        <span>P70 (Strong)</span>
        <span>P85+ (High-End)</span>
      </div>

      <p className="text-xs text-text-muted">
        Outperforms approximately {Math.round(clamped)}% of tested hardware in dataset{" "}
        <span className="font-mono text-text-strong">{datasetVersion}</span> ({sampleCount}{" "}
        verified samples).
      </p>
    </div>
  );
}
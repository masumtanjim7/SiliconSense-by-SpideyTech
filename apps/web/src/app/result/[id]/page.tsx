"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  GitCompare,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import type {
  AnalysisResultResponse,
  DatasetVersionMetaResponse,
  WorkloadProfileSchema,
} from "@packages/contracts";
import { AppShell } from "@/components/layout/AppShell";
import {
  BalanceGauge,
  GlassPanel,
  HardwareChip,
  MetricBar,
  ScoreRing,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  DataWarning,
  EmptyState,
  ErrorState,
  MethodologyDrawer,
  SkeletonSet,
  UpgradeCard,
  WorkloadTabs,
} from "@/components/ui/interactive";
import { ContributionChart } from "@/components/charts/RechartsLayer";
import {
  fetchAnalysisResult,
  fetchDatasetVersionMeta,
  fetchWorkloads,
  submitBuildAnalysis,
} from "@/lib/api";
import { formatComponentSpecBadge } from "@/components/analyzer/analyzer-validation";
import {
  deriveTopAndLimitingFactors,
  isAnalysisDatasetStale,
  resolveBottleneckDisplayState,
} from "@/components/result/result-helpers";

export default function AnalysisResultDashboardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const identifier = params?.id ?? "";

  const [analysis, setAnalysis] = useState<AnalysisResultResponse | null>(null);
  const [workloads, setWorkloads] = useState<WorkloadProfileSchema[]>([]);
  const [currentMeta, setCurrentMeta] =
    useState<DatasetVersionMetaResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSwitchingWorkload, setIsSwitchingWorkload] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const loadResultData = useCallback(async () => {
    if (!identifier) return;
    setIsLoading(true);
    setErrorMessage(null);
    setNotFound(false);

    try {
      const [resultData, wlList, metaData] = await Promise.all([
        fetchAnalysisResult(identifier),
        fetchWorkloads().catch(() => []),
        fetchDatasetVersionMeta().catch(() => null),
      ]);
      setAnalysis(resultData);
      setWorkloads(wlList);
      setCurrentMeta(metaData);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch analysis result.";
      if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
        setNotFound(true);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    void loadResultData();
  }, [loadResultData]);

  async function handleSwitchWorkload(targetWorkloadSlug: string) {
    if (
      !analysis ||
      targetWorkloadSlug === analysis.workload_slug ||
      isSwitchingWorkload
    ) {
      return;
    }

    const cpu = analysis.selected_components["CPU"];
    const gpu = analysis.selected_components["GPU"];
    const ram = analysis.selected_components["RAM"];
    const storage = analysis.selected_components["STORAGE"];

    if (!cpu || !gpu || !ram || !storage) return;

    setIsSwitchingWorkload(true);
    try {
      const newAnalysis = await submitBuildAnalysis({
        build_name: analysis.build_name,
        workload_slug: targetWorkloadSlug,
        dataset_version:
          currentMeta?.dataset_version ??
          analysis.version_metadata.dataset_version,
        components: {
          CPU: cpu.id,
          GPU: gpu.id,
          RAM: ram.id,
          STORAGE: storage.id,
        },
      });
      router.push(`/result/${newAnalysis.share_uuid}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not re-analyze build for the selected workload."
      );
      setIsSwitchingWorkload(false);
    }
  }

  function handleCopyShareLink() {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <SectionHeader
            eyebrow="Loading Authoritative Telemetry"
            title="Retrieving PC Strength & Balance Report..."
          />
          <SkeletonSet rows={6} />
        </div>
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell>
        <EmptyState
          title="Analysis Report Not Found"
          description={`No persisted analysis matched identifier '${identifier}'. It may not exist in this database environment.`}
          action={
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand-primary text-xs sm:text-sm font-semibold text-text-strong"
            >
              <span>Configure & Analyze a New Build</span>
            </Link>
          }
        />
      </AppShell>
    );
  }

  if (errorMessage || !analysis) {
    return (
      <AppShell>
        <ErrorState
          title="Unable to Load Analysis Result"
          message={errorMessage ?? "Unknown telemetry error."}
          onRetry={() => void loadResultData()}
        />
      </AppShell>
    );
  }

  const narrative = deriveTopAndLimitingFactors(
    analysis.workload_name,
    analysis.contributions
  );
  const bottleneckState = resolveBottleneckDisplayState(analysis);
  const isStale = isAnalysisDatasetStale(
    analysis.version_metadata.dataset_version,
    currentMeta?.dataset_version
  );

  const chartItems = analysis.contributions.map((c) => ({
    metricKey: c.metric_key,
    displayName: c.display_name,
    subsystem: c.subsystem,
    normalizedScore: c.normalized_score_0_100,
    weightApplied: c.weight_applied,
    weightedContribution: c.weighted_contribution,
    isMissingMetric: c.is_missing_metric,
  }));

  return (
    <AppShell>
      <div className="space-y-10">
        {/* Stale Analysis Banner if a newer dataset release is published */}
        {isStale && currentMeta && (
          <div
            role="status"
            className="p-4 rounded-card bg-brand-amber/10 border border-brand-amber/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs sm:text-sm">
              <AlertTriangle
                className="h-4 w-4 text-brand-amber shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <span className="font-semibold text-brand-amber">
                  Newer Benchmark Dataset Available:
                </span>{" "}
                <span className="text-text-muted">
                  This analysis was computed on{" "}
                  <code className="text-text-strong">
                    {analysis.version_metadata.dataset_version}
                  </code>
                  , while the latest active release is{" "}
                  <code className="text-brand-cyan">
                    {currentMeta.dataset_version}
                  </code>
                  .
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSwitchWorkload(analysis.workload_slug)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-brand-amber text-canvas text-xs font-bold shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Re-run on Latest Dataset</span>
            </button>
          </div>
        )}

        {/* A. ABOVE THE FOLD: Build Identity, Workload Switcher & Dual Score Hero */}
        <section aria-labelledby="result-hero-heading" className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/analyze"
                  className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-strong"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Back to Analyzer</span>
                </Link>
                <span className="text-white/20">•</span>
                <span className="text-xs font-mono text-brand-primary">
                  REPORT #{analysis.analysis_id}
                </span>
              </div>
              <h1
                id="result-hero-heading"
                className="text-3xl md:text-4xl font-bold tracking-tight text-text-strong"
              >
                {analysis.build_name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge
                label={`Workload: ${analysis.workload_name}`}
                tone="primary"
              />
              <StatusBadge
                label={`Coverage: ${Math.round(analysis.coverage_ratio * 100)}%`}
                tone={analysis.coverage_ratio >= 0.8 ? "positive" : "warning"}
              />
              <StatusBadge
                label={`Dataset: ${analysis.version_metadata.dataset_version}`}
                tone="neutral"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-solid hover:bg-white/10 border border-white/15 text-xs font-semibold text-text-strong transition-colors"
              >
                {copiedLink ? (
                  <>
                    <Check
                      className="h-3.5 w-3.5 text-brand-cyan"
                      aria-hidden="true"
                    />
                    <span className="text-brand-cyan">Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Share Report</span>
                  </>
                )}
              </button>
              <Link
                href="/compare"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/40 text-xs font-semibold text-text-strong transition-colors"
              >
                <GitCompare
                  className="h-3.5 w-3.5 text-brand-primary"
                  aria-hidden="true"
                />
                <span>Compare Rig</span>
              </Link>
            </div>
          </div>

          {/* Selected Hardware Chips */}
          <div className="flex flex-wrap gap-2.5">
            {(["CPU", "GPU", "RAM", "STORAGE"] as const).map((slot) => {
              const comp = analysis.selected_components[slot];
              if (!comp) return null;
              return (
                <HardwareChip
                  key={slot}
                  slotType={slot}
                  brand={comp.brand}
                  modelName={comp.model_name}
                  badgeText={formatComponentSpecBadge(comp)}
                />
              );
            })}
          </div>

          {/* Dual Score Hero Cards: Performance Ring vs Balance Gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <GlassPanel className="lg:col-span-4 p-6 md:p-8 flex flex-col items-center justify-center text-center">
              <ScoreRing
                score={analysis.performance_score_0_100}
                label={`${analysis.workload_name} Score`}
                tier={analysis.performance_tier}
                confidenceLevel={analysis.confidence_level}
                size={184}
              />
              <p className="text-xs text-text-muted mt-4">
                Confidence Score:{" "}
                <strong className="text-text-strong">
                  {analysis.confidence_score_0_100.toFixed(1)}/100
                </strong>{" "}
                ({Math.round(analysis.coverage_ratio * 100)}% metric weight
                covered)
              </p>
            </GlassPanel>

            <GlassPanel className="lg:col-span-8 p-6 md:p-8 flex flex-col justify-between space-y-6">
              <BalanceGauge
                balanceScore={analysis.balance_score_0_100}
                balanceStatus={analysis.balance_status}
                spreadPoints={bottleneckState.spreadPoints}
                explanation={bottleneckState.detail}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="p-4 rounded-control bg-surface-solid border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-cyan">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Top Positive Contributor</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {narrative.topPositiveFactor}
                  </p>
                </div>

                <div className="p-4 rounded-control bg-surface-solid border border-white/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-amber">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Primary Limiting Factor</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {narrative.primaryLimitingFactor}
                  </p>
                </div>
              </div>
            </GlassPanel>
          </div>

          <DataWarning warnings={analysis.warnings} />
        </section>

        {/* E. Switch Workload Bar */}
        {workloads.length > 0 && (
          <section className="p-5 rounded-card bg-surface-solid border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
                Explore Another Workload Profile
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Re-evaluate this exact hardware configuration under a different
                workload’s weights:
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isSwitchingWorkload && (
                <Loader2
                  className="h-4 w-4 animate-spin text-brand-cyan"
                  aria-hidden="true"
                />
              )}
              <WorkloadTabs
                options={workloads.map((w) => ({ slug: w.slug, name: w.name }))}
                activeSlug={analysis.workload_slug}
                onSelect={(slug) => void handleSwitchWorkload(slug)}
              />
            </div>
          </section>
        )}

        {/* B. WHY THIS RESULT: Metric Contributions & Capability Bars */}
        <section aria-labelledby="why-result-heading" className="space-y-6">
          <SectionHeader
            eyebrow="Workload Telemetry Breakdown"
            title={`Why Your PC Scored ${Math.round(analysis.performance_score_0_100)} in ${analysis.workload_name}`}
            description="Every workload applies versioned weights summing to 1.00 across normalized component percentiles."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <ContributionChart
                workloadName={analysis.workload_name}
                items={chartItems}
              />
            </div>

            <div className="lg:col-span-5 space-y-3">
              {analysis.contributions.map((c) => (
                <MetricBar
                  key={c.metric_key}
                  label={c.display_name}
                  subsystem={c.subsystem}
                  score={c.normalized_score_0_100}
                  weight={c.weight_applied}
                  isMissing={c.is_missing_metric}
                />
              ))}
            </div>
          </div>
        </section>

        {/* C. BOTTLENECK DIAGNOSTIC SECTION */}
        <section aria-labelledby="bottleneck-heading" className="space-y-4">
          <SectionHeader
            eyebrow="Component Synergy & Spread"
            title="Bottleneck Diagnostic"
            description="Evaluates only subsystems with significant weight (>= 10%) in the active workload."
          />

          <GlassPanel variant="solid" className="p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {bottleneckState.mode === "no_bottleneck" ? (
                  <CheckCircle2
                    className="h-5 w-5 text-brand-cyan"
                    aria-hidden="true"
                  />
                ) : bottleneckState.mode === "insufficient_data" ? (
                  <AlertTriangle
                    className="h-5 w-5 text-brand-amber"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldAlert
                    className="h-5 w-5 text-brand-rose"
                    aria-hidden="true"
                  />
                )}
                <h3 className="text-lg font-bold text-text-strong">
                  {bottleneckState.headline}
                </h3>
              </div>
              {bottleneckState.mode !== "insufficient_data" && (
                <span className="text-xs font-mono text-text-muted">
                  Capability Spread: {bottleneckState.spreadPoints.toFixed(1)} pts
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              {bottleneckState.detail}
            </p>
          </GlassPanel>
        </section>

        {/* D. UPGRADE PRIORITIES */}
        <section aria-labelledby="upgrades-heading" className="space-y-4">
          <SectionHeader
            eyebrow="Evidence-Backed Upgrade Advisor"
            title="Recommended Upgrade Priorities"
            description="Ranked by weighted workload deficit impact. We never recommend upgrading a low-weight component that does not impact your target workload."
          />

          {analysis.recommendations.length === 0 ? (
            <GlassPanel variant="solid" className="p-6 flex items-center gap-3">
              <CheckCircle2
                className="h-6 w-6 text-brand-cyan shrink-0"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-bold text-text-strong">
                  No Immediate Hardware Upgrades Required for{" "}
                  {analysis.workload_name}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  All covered workload-relevant components meet adequacy targets
                  and maintain balanced capability spread.
                </p>
              </div>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.recommendations.map((rec) => (
                <UpgradeCard
                  key={`${rec.priority_order}-${rec.affected_metric_key}`}
                  priorityOrder={rec.priority_order}
                  componentType={rec.component_type}
                  affectedMetricKey={rec.affected_metric_key}
                  reason={rec.reason}
                  targetScoreMin={rec.target_score_min}
                  targetScoreMax={rec.target_score_max}
                />
              ))}
            </div>
          )}
        </section>

        {/* Provenance & Methodology Drawer */}
        <MethodologyDrawer
          datasetVersion={analysis.version_metadata.dataset_version}
          normalizationVersion={analysis.version_metadata.normalization_version}
          scoringVersion={analysis.version_metadata.scoring_version}
          workloadVersion={analysis.version_metadata.workload_profile_version}
        />
      </div>
    </AppShell>
  );
}
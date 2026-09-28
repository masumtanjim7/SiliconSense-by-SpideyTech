"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  Loader2,
  Scale,
  SlidersHorizontal,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type {
  BuildComponentsSelection,
  CompareBuildsResponse,
  ComponentSummaryItem,
  HardwareSlotType,
  WorkloadProfileSchema,
} from "@packages/contracts";
import { AppShell } from "@/components/layout/AppShell";
import {
  BalanceGauge,
  GlassPanel,
  HardwareChip,
  ScoreRing,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  ErrorState,
  SkeletonSet,
  UpgradeCard,
  WorkloadTabs,
} from "@/components/ui/interactive";
import { ComparisonBarChart } from "@/components/charts/RechartsLayer";
import {
  fetchWorkloads,
  searchComponents,
  submitBuildComparison,
} from "@/lib/api";
import { formatComponentSpecBadge } from "@/components/analyzer/analyzer-validation";
import {
  checkComparisonVersionCompatibility,
  deriveUpgradeHeadroomSummary,
  formatContextualPerformanceLead,
} from "@/components/compare/compare-helpers";

const SLOTS: HardwareSlotType[] = ["CPU", "GPU", "RAM", "STORAGE"];

export default function CompareBuildsPage() {
  const [workloads, setWorkloads] = useState<WorkloadProfileSchema[]>([]);
  const [catalog, setCatalog] = useState<ComponentSummaryItem[]>([]);
  const [workloadSlug, setWorkloadSlug] = useState<string>("gaming");

  const [buildAName, setBuildAName] = useState<string>("Build A â€¢ High-End Rig");
  const [buildBName, setBuildBName] = useState<string>("Build B â€¢ Mid-Range Rig");

  const [buildASlots, setBuildASlots] = useState<BuildComponentsSelection | null>(
    null
  );
  const [buildBSlots, setBuildBSlots] = useState<BuildComponentsSelection | null>(
    null
  );

  const [comparison, setComparison] = useState<CompareBuildsResponse | null>(
    null
  );
  const [showConfigurator, setShowConfigurator] = useState<boolean>(false);

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runComparison = useCallback(
    async (
      targetWorkload: string,
      nameA: string,
      slotsA: BuildComponentsSelection,
      nameB: string,
      slotsB: BuildComponentsSelection
    ) => {
      setIsComparing(true);
      setErrorMessage(null);
      try {
        const result = await submitBuildComparison({
          workload_slug: targetWorkload,
          build_a_name: nameA.trim() || "Build A",
          build_a_components: slotsA,
          build_b_name: nameB.trim() || "Build B",
          build_b_components: slotsB,
        });
        setComparison(result);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to run side-by-side build comparison."
        );
      } finally {
        setIsComparing(false);
      }
    },
    []
  );

  const initializeCompareWorkspace = useCallback(async () => {
    setIsInitialLoading(true);
    setErrorMessage(null);
    try {
      const [wlList, compRes] = await Promise.all([
        fetchWorkloads(),
        searchComponents({ page: 1, page_size: 100 }),
      ]);
      setWorkloads(wlList);
      setCatalog(compRes.items);

      const cpus = compRes.items.filter((c) => c.component_type === "CPU");
      const gpus = compRes.items.filter((c) => c.component_type === "GPU");
      const rams = compRes.items.filter((c) => c.component_type === "RAM");
      const storages = compRes.items.filter(
        (c) => c.component_type === "STORAGE"
      );

      if (cpus.length > 0 && gpus.length > 0 && rams.length > 0 && storages.length > 0) {
        const defaultA: BuildComponentsSelection = {
          CPU: cpus[0].id,
          GPU: gpus[0].id,
          RAM: rams[0].id,
          STORAGE: storages[0].id,
        };
        const defaultB: BuildComponentsSelection = {
          CPU: (cpus[cpus.length - 1] ?? cpus[0]).id,
          GPU: (gpus[gpus.length - 1] ?? gpus[0]).id,
          RAM: (rams[rams.length - 1] ?? rams[0]).id,
          STORAGE: (storages[storages.length - 1] ?? storages[0]).id,
        };
        const initialWorkload = wlList[0]?.slug ?? "gaming";
        setWorkloadSlug(initialWorkload);
        setBuildASlots(defaultA);
        setBuildBSlots(defaultB);

        await runComparison(
          initialWorkload,
          "Build A â€¢ High-End Rig",
          defaultA,
          "Build B â€¢ Mid-Range Rig",
          defaultB
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not connect to FastAPI comparison service."
      );
    } finally {
      setIsInitialLoading(false);
    }
  }, [runComparison]);

  useEffect(() => {
    void initializeCompareWorkspace();
  }, [initializeCompareWorkspace]);

  function handleWorkloadChange(newSlug: string) {
    setWorkloadSlug(newSlug);
    if (buildASlots && buildBSlots) {
      void runComparison(
        newSlug,
        buildAName,
        buildASlots,
        buildBName,
        buildBSlots
      );
    }
  }

  function renderSlotSelect(
    buildLabel: "A" | "B",
    slot: HardwareSlotType,
    currentSelection: BuildComponentsSelection,
    onChange: (next: BuildComponentsSelection) => void
  ) {
    const options = catalog.filter((c) => c.component_type === slot);
    return (
      <div key={`${buildLabel}-${slot}`} className="space-y-1">
        <label className="block text-[11px] font-mono uppercase text-text-muted">
          {slot}
        </label>
        <select
          aria-label={`Build ${buildLabel} ${slot}`}
          value={currentSelection[slot]}
          onChange={(e) =>
            onChange({
              ...currentSelection,
              [slot]: Number(e.target.value),
            })
          }
          className="w-full px-3 py-2 rounded-control bg-canvas border border-white/10 text-xs sm:text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.brand} {opt.model_name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <SectionHeader
            eyebrow="Side-by-Side Decision Support"
            title="Initializing Build Comparison Workspace..."
          />
          <SkeletonSet rows={6} />
        </div>
      </AppShell>
    );
  }

  if (errorMessage && !comparison) {
    return (
      <AppShell>
        <ErrorState
          title="Build Comparison Unavailable"
          message={errorMessage}
          onRetry={() => void initializeCompareWorkspace()}
        />
      </AppShell>
    );
  }

  const compatibility = comparison
    ? checkComparisonVersionCompatibility(comparison)
    : { compatible: true, warningMessage: null };

  const leadBadge = comparison
    ? formatContextualPerformanceLead(
        comparison.workload_name,
        comparison.build_a.build_name,
        comparison.build_b.build_name,
        comparison.performance_score_delta
      )
    : null;

  const headroom = comparison
    ? deriveUpgradeHeadroomSummary(comparison.build_a, comparison.build_b)
    : null;

  const chartItems =
    comparison?.metric_deltas.map((d) => ({
      metricKey: d.metric_key,
      displayName: d.display_name,
      subsystem: d.subsystem,
      weight: d.weight,
      buildAScore: d.build_a_score,
      buildBScore: d.build_b_score,
    })) ?? [];

  return (
    <AppShell>
      <div className="space-y-10 pb-16">
        <SectionHeader
          eyebrow="Workload-Contextual Decision Support"
          title="Compare Two PC Configurations"
          description="Compare workload scores, component gaps, balance, and upgrade headroom side-by-side. SiliconSense compares specific workload capabilities rather than declaring a universal winner."
          rightElement={
            <button
              type="button"
              onClick={() => setShowConfigurator((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-control bg-surface-solid hover:bg-white/10 border border-white/15 text-xs sm:text-sm font-semibold text-text-strong"
            >
              <SlidersHorizontal
                className="h-4 w-4 text-brand-primary"
                aria-hidden="true"
              />
              <span>
                {showConfigurator ? "Hide Hardware Picker" : "Customize Builds A & B"}
              </span>
            </button>
          }
        />

        {/* Workload Selector Bar */}
        <div className="p-4 rounded-card bg-surface-solid border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
              Active Comparison Workload
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Switch workloads to see how Build A and Build B shift across tasks:
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isComparing && (
              <Loader2
                className="h-4 w-4 animate-spin text-brand-cyan"
                aria-hidden="true"
              />
            )}
            <WorkloadTabs
              options={workloads.map((w) => ({ slug: w.slug, name: w.name }))}
              activeSlug={workloadSlug}
              onSelect={handleWorkloadChange}
            />
          </div>
        </div>

        {/* Expandable Hardware Configurator for Build A & Build B */}
        {showConfigurator && buildASlots && buildBSlots && (
          <GlassPanel variant="solid" className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-card bg-canvas border border-brand-primary/30 space-y-3">
                <div className="text-xs font-mono font-bold text-brand-primary">
                  CONFIGURE BUILD A
                </div>
                <input
                  type="text"
                  value={buildAName}
                  onChange={(e) => setBuildAName(e.target.value)}
                  aria-label="Build A Name"
                  className="w-full px-3 py-2 rounded-control bg-surface-solid border border-white/10 text-sm font-semibold text-text-strong"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SLOTS.map((slot) =>
                    renderSlotSelect("A", slot, buildASlots, setBuildASlots)
                  )}
                </div>
              </div>

              <div className="p-4 rounded-card bg-canvas border border-brand-cyan/30 space-y-3">
                <div className="text-xs font-mono font-bold text-brand-cyan">
                  CONFIGURE BUILD B
                </div>
                <input
                  type="text"
                  value={buildBName}
                  onChange={(e) => setBuildBName(e.target.value)}
                  aria-label="Build B Name"
                  className="w-full px-3 py-2 rounded-control bg-surface-solid border border-white/10 text-sm font-semibold text-text-strong"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SLOTS.map((slot) =>
                    renderSlotSelect("B", slot, buildBSlots, setBuildBSlots)
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isComparing}
                onClick={() =>
                  void runComparison(
                    workloadSlug,
                    buildAName,
                    buildASlots,
                    buildBName,
                    buildBSlots
                  )
                }
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-control bg-brand-primary hover:bg-brand-primary/90 text-xs sm:text-sm font-semibold text-text-strong"
              >
                <GitCompare className="h-4 w-4" aria-hidden="true" />
                <span>Update Comparison</span>
              </button>
            </div>
          </GlassPanel>
        )}

        {/* Mobile Sticky A/B Legend */}
        {comparison && (
          <div className="sticky top-16 z-30 md:hidden py-2.5 px-4 rounded-control bg-canvas/95 backdrop-blur-md border border-white/15 flex items-center justify-between text-xs font-semibold">
            <span className="text-brand-primary truncate max-w-[45%]">
              A: {comparison.build_a.build_name}
            </span>
            <span className="text-text-muted">vs</span>
            <span className="text-brand-cyan truncate max-w-[45%]">
              B: {comparison.build_b.build_name}
            </span>
          </div>
        )}

        {/* Dataset / Scoring Version Compatibility Warning if Mismatched */}
        {!compatibility.compatible && compatibility.warningMessage && (
          <div
            role="alert"
            className="p-4 rounded-card bg-brand-amber/10 border border-brand-amber/30 flex items-start gap-2.5 text-xs sm:text-sm text-brand-amber"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{compatibility.warningMessage}</span>
          </div>
        )}

        {comparison && leadBadge && headroom && (
          <>
            {/* Contextual Factual Headline Banner */}
            <GlassPanel className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-mono uppercase text-brand-cyan">
                  Workload Context: {comparison.workload_name} â€¢ Dataset{" "}
                  {comparison.dataset_version}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-text-strong">
                  {leadBadge.headline}
                </h2>
                <p className="text-xs sm:text-sm text-text-muted">
                  {comparison.contextual_summary} {leadBadge.subtext}
                </p>
              </div>
              <StatusBadge
                label={`Score Delta: ${comparison.performance_score_delta > 0 ? "+" : ""}${comparison.performance_score_delta.toFixed(1)} pts`}
                tone="primary"
              />
            </GlassPanel>

            {/* Two-Column Build Header & Score/Balance Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  tag: "BUILD A",
                  accent: "text-brand-primary",
                  data: comparison.build_a,
                },
                {
                  tag: "BUILD B",
                  accent: "text-brand-cyan",
                  data: comparison.build_b,
                },
              ].map(({ tag, accent, data }) => (
                <GlassPanel
                  key={tag}
                  variant="solid"
                  className="p-6 space-y-6 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <div className={`text-xs font-mono font-bold ${accent}`}>
                          {tag}
                        </div>
                        <h3 className="text-lg font-bold text-text-strong mt-0.5">
                          {data.build_name}
                        </h3>
                      </div>
                      <StatusBadge
                        label={`Coverage: ${Math.round(data.coverage_ratio * 100)}%`}
                        tone={data.coverage_ratio >= 0.8 ? "positive" : "warning"}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {SLOTS.map((slot) => {
                        const part = data.selected_components[slot];
                        if (!part) return null;
                        return (
                          <HardwareChip
                            key={`${tag}-${slot}`}
                            slotType={slot}
                            brand={part.brand}
                            modelName={part.model_name}
                            badgeText={formatComponentSpecBadge(part)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-center py-2">
                    <ScoreRing
                      score={data.performance_score_0_100}
                      label={`${data.workload_name} Score`}
                      tier={data.performance_tier}
                      confidenceLevel={data.confidence_level}
                      size={160}
                    />
                  </div>

                  <div className="p-4 rounded-control bg-canvas border border-white/10">
                    <BalanceGauge
                      balanceScore={data.balance_score_0_100}
                      balanceStatus={data.balance_status}
                      spreadPoints={data.bottlenecks[0]?.spread_points ?? 0}
                      explanation={
                        data.bottlenecks[0]?.explanation ??
                        "Balanced across covered subsystems."
                      }
                    />
                  </div>
                </GlassPanel>
              ))}
            </div>

            {/* Grouped Recharts Bar Chart */}
            <ComparisonBarChart
              workloadName={comparison.workload_name}
              buildAName={comparison.build_a.build_name}
              buildBName={comparison.build_b.build_name}
              items={chartItems}
              isLoading={isComparing}
            />

            {/* Aligned Metric-by-Metric Delta Table */}
            <GlassPanel variant="solid" className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-text-strong">
                  Aligned Metric-Level Deltas ({comparison.workload_name})
                </h3>
                <span className="text-xs font-mono text-text-muted">
                  Normalized 0â€“100 Scale
                </span>
              </div>

              <div className="divide-y divide-white/10">
                {comparison.metric_deltas.map((row) => (
                  <div
                    key={row.metric_key}
                    className="py-3.5 grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs sm:text-sm"
                  >
                    <div className="md:col-span-4 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[11px] font-mono text-brand-primary">
                        {row.subsystem}
                      </span>
                      <span className="font-semibold text-text-strong">
                        {row.display_name}
                      </span>
                      <span className="text-xs text-text-muted">
                        ({Math.round(row.weight * 100)}%)
                      </span>
                    </div>

                    <div className="md:col-span-2 font-mono text-brand-primary">
                      A:{" "}
                      {row.build_a_score !== null
                        ? row.build_a_score.toFixed(1)
                        : "Missing"}
                    </div>

                    <div className="md:col-span-2 font-mono text-brand-cyan">
                      B:{" "}
                      {row.build_b_score !== null
                        ? row.build_b_score.toFixed(1)
                        : "Missing"}
                    </div>

                    <div className="md:col-span-4 text-text-muted">
                      {row.advantage_summary}
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>

            {/* Where A is Stronger / Where B is Stronger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassPanel variant="solid" className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-primary">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  <span>Where {comparison.build_a.build_name} Is Stronger</span>
                </div>
                {comparison.where_a_is_stronger.length === 0 ? (
                  <p className="text-xs sm:text-sm text-text-muted">
                    {comparison.build_a.build_name} does not hold a &gt;1.0 pt lead on
                    any individual {comparison.workload_name} metric.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs sm:text-sm text-text-strong">
                    {comparison.where_a_is_stronger.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2
                          className="h-4 w-4 text-brand-primary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>

              <GlassPanel variant="solid" className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  <span>Where {comparison.build_b.build_name} Is Stronger</span>
                </div>
                {comparison.where_b_is_stronger.length === 0 ? (
                  <p className="text-xs sm:text-sm text-text-muted">
                    {comparison.build_b.build_name} does not hold a &gt;1.0 pt lead on
                    any individual {comparison.workload_name} metric.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs sm:text-sm text-text-strong">
                    {comparison.where_b_is_stronger.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2
                          className="h-4 w-4 text-brand-cyan shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>
            </div>

            {/* Upgrade Headroom Section */}
            <section className="space-y-4">
              <SectionHeader
                eyebrow="Bottleneck & Upgrade Headroom"
                title="Which Build Has the More Obvious Weak Component?"
                description={headroom.summaryText}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[comparison.build_a, comparison.build_b].map((b) => (
                  <div key={b.analysis_id} className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      <Wrench className="h-3.5 w-3.5 text-brand-amber" />
                      <span>{b.build_name} Upgrade Priority</span>
                    </div>
                    {b.recommendations.length === 0 ? (
                      <GlassPanel variant="solid" className="p-5 flex items-center gap-2.5 text-xs sm:text-sm text-text-muted">
                        <Scale className="h-4 w-4 text-brand-cyan shrink-0" />
                        <span>
                          Balanced for {b.workload_name} â€” no urgent single-part
                          upgrade needed.
                        </span>
                      </GlassPanel>
                    ) : (
                      <UpgradeCard
                        priorityOrder={b.recommendations[0].priority_order}
                        componentType={b.recommendations[0].component_type}
                        affectedMetricKey={
                          b.recommendations[0].affected_metric_key
                        }
                        reason={b.recommendations[0].reason}
                        targetScoreMin={b.recommendations[0].target_score_min}
                        targetScoreMax={b.recommendations[0].target_score_max}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
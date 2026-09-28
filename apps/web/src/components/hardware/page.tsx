"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Cpu,
  Database,
  GitCompare,
  Layers,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  ComponentDetailResponse,
  ComponentSummaryItem,
  DatasetVersionMetaResponse,
} from "@packages/contracts";
import { AppShell } from "@/components/layout/AppShell";
import {
  GlassPanel,
  HardwareChip,
  MetricBar,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  EmptyState,
  ErrorState,
  SkeletonSet,
} from "@/components/ui/interactive";
import { PercentilePositionBar } from "@/components/charts/RechartsLayer";
import {
  fetchComponentDetail,
  fetchDatasetVersionMeta,
  searchComponents,
} from "@/lib/api";
import {
  extractUniqueBrands,
  formatHardwareSpecLine,
  summarizeComponentEvidence,
} from "@/components/hardware/hardware-helpers";
import { cn } from "@/lib/utils";

const SUBSYSTEM_FILTERS = ["ALL", "CPU", "GPU", "RAM", "STORAGE"] as const;

export default function HardwareExplorerPage() {
  const [items, setItems] = useState<ComponentSummaryItem[]>([]);
  const [datasetMeta, setDatasetMeta] =
    useState<DatasetVersionMetaResponse | null>(null);

  const [selectedType, setSelectedType] =
    useState<(typeof SUBSYSTEM_FILTERS)[number]>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedDetail, setSelectedDetail] =
    useState<ComponentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadComponentDetail = useCallback(
    async (componentId: number, dsVersion?: string) => {
      setIsLoadingDetail(true);
      try {
        const detail = await fetchComponentDetail(componentId, dsVersion);
        setSelectedDetail(detail);
      } catch {
        setSelectedDetail(null);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    []
  );

  const loadExplorerCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setErrorMessage(null);
    try {
      const [searchRes, metaRes] = await Promise.all([
        searchComponents({ page: 1, page_size: 100 }),
        fetchDatasetVersionMeta().catch(() => null),
      ]);
      setItems(searchRes.items);
      setDatasetMeta(metaRes);

      if (searchRes.items.length > 0) {
        await loadComponentDetail(
          searchRes.items[0].id,
          metaRes?.dataset_version
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not load curated hardware catalog from FastAPI."
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [loadComponentDetail]);

  useEffect(() => {
    void loadExplorerCatalog();
  }, [loadExplorerCatalog]);

  const brands = extractUniqueBrands(items);

  const filteredItems = items.filter((item) => {
    const matchesType =
      selectedType === "ALL" || item.component_type === selectedType;
    const matchesBrand =
      selectedBrand === "ALL" ||
      item.brand.toLowerCase() === selectedBrand.toLowerCase();
    const matchesQuery =
      !searchQuery.trim() ||
      `${item.brand} ${item.model_name} ${item.generation ?? ""}`
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase());
    return matchesType && matchesBrand && matchesQuery;
  });

  const evidenceSummary = selectedDetail
    ? summarizeComponentEvidence(selectedDetail)
    : null;

  return (
    <AppShell>
      <div className="space-y-8 pb-16">
        <SectionHeader
          eyebrow="Prompt 17 • Transparent Benchmark Research Surface"
          title="Hardware Benchmark & Specification Explorer"
          description="Inspect canonical CPUs, GPUs, memory kits, and storage drives. We separate curated hardware specifications from empirical benchmark evidence and never fabricate missing scores."
          rightElement={
            datasetMeta ? (
              <StatusBadge
                label={`Active Dataset: ${datasetMeta.dataset_version}`}
                tone="positive"
              />
            ) : undefined
          }
        />

        {/* Filter & Search Bar (Solid surface for readability) */}
        <div className="p-5 rounded-card bg-surface-solid border border-white/10 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Filter by hardware subsystem"
              className="inline-flex flex-wrap gap-1.5 p-1 rounded-control bg-canvas border border-white/10"
            >
              {SUBSYSTEM_FILTERS.map((type) => {
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                      active
                        ? "bg-brand-primary text-text-strong"
                        : "text-text-muted hover:text-text-strong"
                    )}
                  >
                    {type === "ALL" ? "All Subsystems" : type}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search
                  className="h-4 w-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search model name, architecture, or brand..."
                  aria-label="Search hardware catalog"
                  className="w-full pl-10 pr-4 py-2 rounded-control bg-canvas border border-white/10 text-xs sm:text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <select
                aria-label="Filter by manufacturer brand"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-3.5 py-2 rounded-control bg-canvas border border-white/10 text-xs sm:text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="ALL">All Brands ({brands.length})</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoadingCatalog ? (
          <SkeletonSet rows={6} />
        ) : errorMessage ? (
          <ErrorState
            title="Hardware Catalog Unavailable"
            message={errorMessage}
            onRetry={() => void loadExplorerCatalog()}
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title="No Matching Hardware Components"
            description="Try clearing your search filter or switching subsystem tabs."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Solid Surface Catalog Table */}
            <div className="lg:col-span-7 rounded-card bg-surface-solid border border-white/10 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between text-xs text-text-muted font-mono">
                <span>CANONICAL HARDWARE CATALOG ({filteredItems.length})</span>
                <span>SELECT ROW TO INSPECT TELEMETRY</span>
              </div>

              <div
                role="listbox"
                aria-label="Hardware catalog list"
                className="divide-y divide-white/10"
              >
                {filteredItems.map((item) => {
                  const isSelected = selectedDetail?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        void loadComponentDetail(
                          item.id,
                          datasetMeta?.dataset_version
                        )
                      }
                      className={cn(
                        "w-full px-5 py-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                        isSelected
                          ? "bg-brand-primary/15 border-l-4 border-l-brand-primary"
                          : "hover:bg-white/5"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-canvas text-[11px] font-mono text-brand-primary border border-white/10">
                            {item.component_type}
                          </span>
                          <span className="font-bold text-sm text-text-strong">
                            {item.brand} {item.model_name}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted">
                          {item.generation ? `${item.generation} • ` : ""}
                          {formatHardwareSpecLine(item)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.is_verified && (
                          <span className="px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 text-[11px] font-medium">
                            Verified Spec
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Glass Detail Drawer / Panel */}
            <aside className="lg:col-span-5 lg:sticky lg:top-24">
              <GlassPanel className="p-6 space-y-6">
                {isLoadingDetail ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-text-muted">
                    <Loader2
                      className="h-6 w-6 animate-spin text-brand-cyan"
                      aria-hidden="true"
                    />
                    <span>Loading component benchmark evidence...</span>
                  </div>
                ) : !selectedDetail || !evidenceSummary ? (
                  <div className="py-8 text-center text-xs text-text-muted">
                    Select any component on the left to inspect its normalized
                    metrics, percentile standing, and source coverage.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 border-b border-white/10 pb-4">
                      <div className="flex items-center justify-between gap-2">
                        <HardwareChip
                          slotType={selectedDetail.component_type}
                          brand={selectedDetail.brand}
                          modelName={selectedDetail.model_name}
                        />
                        <StatusBadge
                          label={evidenceSummary.badgeLabel}
                          tone={
                            evidenceSummary.state === "verified_evidence"
                              ? "positive"
                              : "warning"
                          }
                        />
                      </div>

                      <div className="text-xs text-text-muted">
                        {formatHardwareSpecLine(selectedDetail)}
                        {selectedDetail.release_date
                          ? ` • Released ${selectedDetail.release_date}`
                          : ""}
                      </div>
                    </div>

                    {/* Normalized Metrics & Percentile Standing */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-strong flex items-center gap-1.5">
                          <Database
                            className="h-4 w-4 text-brand-primary"
                            aria-hidden="true"
                          />
                          <span>Normalized Benchmark Evidence</span>
                        </h3>
                        <span className="text-[11px] font-mono text-text-muted">
                          0–100 Percentile Scale
                        </span>
                      </div>

                      {evidenceSummary.state === "no_benchmark_evidence" ? (
                        <div className="p-4 rounded-control bg-brand-amber/10 border border-brand-amber/30 space-y-1.5 text-xs">
                          <div className="font-semibold text-brand-amber">
                            Unknown Benchmark Score (Not Low Performance)
                          </div>
                          <p className="text-text-muted leading-relaxed">
                            {evidenceSummary.explanation}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedDetail.normalized_metrics.map((nm) => (
                            <div key={nm.metric_key} className="space-y-2">
                              <MetricBar
                                label={`${nm.display_name} (${nm.raw_aggregated_score} ${nm.unit})`}
                                subsystem={selectedDetail.component_type}
                                score={nm.normalized_score_0_100}
                                percentile={nm.percentile}
                              />
                              <PercentilePositionBar
                                componentName={`${selectedDetail.brand} ${selectedDetail.model_name}`}
                                metricLabel={nm.display_name}
                                percentile={nm.percentile}
                                sampleCount={nm.sample_count}
                                datasetVersion={nm.dataset_version}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Canonical Aliases */}
                    {selectedDetail.aliases.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <div className="text-[11px] font-mono uppercase text-text-muted">
                          Known Benchmark Source Aliases (
                          {selectedDetail.aliases.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDetail.aliases.map((alias) => (
                            <span
                              key={alias}
                              className="px-2 py-1 rounded bg-surface-solid border border-white/10 text-[11px] font-mono text-text-muted"
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Handoff Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                      <Link
                        href="/analyze"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-control bg-brand-primary hover:bg-brand-primary/90 text-xs font-semibold text-text-strong"
                      >
                        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Use in Analyzer</span>
                      </Link>
                      <Link
                        href="/compare"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-control bg-surface-solid hover:bg-white/10 border border-white/15 text-xs font-semibold text-text-strong"
                      >
                        <GitCompare
                          className="h-3.5 w-3.5 text-brand-cyan"
                          aria-hidden="true"
                        />
                        <span>Compare Builds</span>
                      </Link>
                    </div>
                  </>
                )}
              </GlassPanel>
            </aside>
          </div>
        )}

        {/* Provenance Strip */}
        <div className="p-4 rounded-card bg-surface-solid border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-cyan shrink-0" />
            <span>
              Approved Sources:{" "}
              <strong className="text-text-strong">
                {datasetMeta?.approved_sources.join(", ") ||
                  "Blender Open Data (CC0), SiliconSense PTS Lab (GPLv3)"}
              </strong>
            </span>
          </div>
          <Link
            href="/methodology"
            className="inline-flex items-center gap-1 text-brand-primary font-semibold hover:underline"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>View Full Normalization & Scoring Methodology</span>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
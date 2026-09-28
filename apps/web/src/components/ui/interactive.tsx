"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Database,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkloadOption {
  slug: string;
  name: string;
  description?: string;
}

export function WorkloadTabs({
  options,
  activeSlug,
  onSelect,
}: {
  options: WorkloadOption[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Select target workload"
      className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-control bg-surface-solid border border-white/10"
    >
      {options.map((opt) => {
        const isSelected = opt.slug === activeSlug;
        return (
          <button
            key={opt.slug}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onSelect(opt.slug)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs md:text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
              isSelected
                ? "bg-brand-primary text-text-strong shadow-md"
                : "text-text-muted hover:text-text-strong hover:bg-white/5"
            )}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

export interface PickerComponentOption {
  id: number;
  brand: string;
  model_name: string;
  generation?: string | null;
  badge?: string;
}

export function ComponentPicker({
  label,
  slotType,
  options,
  selectedId,
  onSelect,
  placeholder = "Search hardware model...",
}: {
  label: string;
  slotType: string;
  options: PickerComponentOption[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((item) =>
    `${item.brand} ${item.model_name} ${item.generation ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const selectedItem = options.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="p-4 rounded-card bg-surface-solid border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
          {slotType} • {label}
        </label>
        {selectedItem && (
          <span className="text-xs text-brand-cyan font-medium">
            Selected: {selectedItem.brand} {selectedItem.model_name}
          </span>
        )}
      </div>

      <div className="relative">
        <Search
          className="h-4 w-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={`Search ${label}`}
          className="w-full pl-10 pr-4 py-2.5 rounded-control bg-canvas border border-white/10 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <div
        role="listbox"
        aria-label={`${label} options`}
        className="max-h-48 overflow-y-auto space-y-1.5 pr-1"
      >
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-text-muted">
            No matching {slotType} found in curated catalog.
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs md:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                  isSelected
                    ? "bg-brand-primary/20 border border-brand-primary text-text-strong"
                    : "bg-canvas/60 border border-white/5 text-text-muted hover:text-text-strong hover:border-white/15"
                )}
              >
                <div>
                  <span className="font-semibold text-text-strong">{item.brand}</span>{" "}
                  <span>{item.model_name}</span>
                  {item.generation && (
                    <span className="ml-2 text-xs text-text-muted">({item.generation})</span>
                  )}
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] font-mono text-brand-cyan">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function UpgradeCard({
  priorityOrder,
  componentType,
  affectedMetricKey,
  reason,
  targetScoreMin,
  targetScoreMax,
}: {
  priorityOrder: number;
  componentType: string;
  affectedMetricKey: string;
  reason: string;
  targetScoreMin: number;
  targetScoreMax: number;
}) {
  return (
    <div className="p-5 rounded-card bg-surface-solid border border-brand-amber/30 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-brand-amber/15 text-brand-amber text-xs font-bold">
            Priority #{priorityOrder}
          </span>
          <span className="text-sm font-bold text-text-strong">
            Upgrade {componentType}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-mono text-brand-cyan">
          Target Score: {targetScoreMin.toFixed(0)}–{targetScoreMax.toFixed(0)}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className="text-xs md:text-sm text-text-muted leading-relaxed">{reason}</p>
      <div className="text-[11px] font-mono text-text-muted">
        Impacted Workload Metric: <span className="text-text-strong">{affectedMetricKey}</span>
      </div>
    </div>
  );
}

export function MethodologyDrawer({
  datasetVersion,
  normalizationVersion,
  scoringVersion,
  workloadVersion,
}: {
  datasetVersion: string;
  normalizationVersion: string;
  scoringVersion: string;
  workloadVersion: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-card bg-surface-solid border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <div className="flex items-center gap-2.5">
          <Database className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-text-strong">
            How This Score Was Calculated (Provenance & Versions)
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-white/10 space-y-3 text-xs md:text-sm text-text-muted">
          <p>
            Every SiliconSense score is deterministically computed on the backend from
            Hazen mid-rank percentile normalization (<code className="text-brand-cyan">0–100</code>)
            weighted by your active workload profile. Missing metrics reduce confidence
            rather than substituting zero.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div className="p-2.5 rounded-lg bg-canvas border border-white/5">
              <div className="text-[11px] uppercase text-text-muted">Dataset</div>
              <div className="font-mono text-xs text-text-strong mt-0.5">{datasetVersion}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-canvas border border-white/5">
              <div className="text-[11px] uppercase text-text-muted">Normalization</div>
              <div className="font-mono text-xs text-text-strong mt-0.5">
                {normalizationVersion}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-canvas border border-white/5">
              <div className="text-[11px] uppercase text-text-muted">Scoring Engine</div>
              <div className="font-mono text-xs text-text-strong mt-0.5">{scoringVersion}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-canvas border border-white/5">
              <div className="text-[11px] uppercase text-text-muted">Workload Profile</div>
              <div className="font-mono text-xs text-text-strong mt-0.5">v{workloadVersion}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataWarning({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div
      role="alert"
      className="p-4 rounded-control bg-brand-amber/10 border border-brand-amber/30 space-y-1.5"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-amber">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Evidence & Coverage Notices ({warnings.length})</span>
      </div>
      <ul className="list-disc list-inside text-xs md:text-sm text-text-strong/90 space-y-1">
        {warnings.map((w, idx) => (
          <li key={idx}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

export function SkeletonSet({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading hardware telemetry">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-16 w-full rounded-control bg-surface-solid border border-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-8 rounded-card bg-surface-solid border border-white/10 text-center space-y-3">
      <Sparkles className="h-8 w-8 text-brand-primary mx-auto" aria-hidden="true" />
      <h3 className="text-base font-semibold text-text-strong">{title}</h3>
      <p className="text-xs md:text-sm text-text-muted max-w-md mx-auto">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Unable to Load Telemetry",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="p-6 rounded-card bg-brand-rose/10 border border-brand-rose/30 text-center space-y-3"
    >
      <h3 className="text-base font-semibold text-brand-rose">{title}</h3>
      <p className="text-xs md:text-sm text-text-muted max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-control bg-brand-rose text-text-strong text-xs font-semibold hover:opacity-90"
        >
          Retry Request
        </button>
      )}
    </div>
  );
}
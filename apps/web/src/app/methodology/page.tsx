import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  GlassPanel,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";

const TIER_TABLE = [
  {
    range: "85 – 100",
    tier: "High-end",
    meaning: "Upper segment of the current reference dataset for the selected workload.",
  },
  {
    range: "70 – 84",
    tier: "Strong",
    meaning: "High capability and headroom for demanding tasks in the selected workload.",
  },
  {
    range: "55 – 69",
    tier: "Mid-range",
    meaning: "Competent general performance across typical workload demands.",
  },
  {
    range: "35 – 54",
    tier: "Basic",
    meaning: "Suitable for lighter tasks or reduced settings within the workload.",
  },
  {
    range: "0 – 34",
    tier: "Weak",
    meaning: "Below the current reference adequacy range for the selected workload.",
  },
];

const BALANCE_TABLE = [
  {
    spread: "0 – 12 pts",
    status: "Balanced",
    treatment: "Cyan • Components are well matched with no urgent bottleneck.",
  },
  {
    spread: "13 – 22 pts",
    status: "Mild bottleneck",
    treatment: "Amber • Minor capability gap; explainable weak area under peak load.",
  },
  {
    spread: "23 – 35 pts",
    status: "Moderate bottleneck",
    treatment: "Amber • Clear capability gap and actionable upgrade priority.",
  },
  {
    spread: "36+ pts",
    status: "Major bottleneck",
    treatment: "Rose • Severe imbalance holding back your strongest component.",
  },
];

export default function MethodologyPage() {
  return (
    <AppShell>
      <div className="space-y-12 pb-16">
        <SectionHeader
          eyebrow="Transparent Hardware Telemetry Contract"
          title="Scoring, Balance & Data Provenance Methodology"
          description="SiliconSense by SpideyTech is built on a strict engineering contract: every score is deterministic, versioned, and traceable to auditable benchmark evidence."
          rightElement={
            <StatusBadge
              label="FORMULA: SCORE-V1.0 • NORM-V1.0"
              tone="positive"
            />
          }
        />

        {/* 1. Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassPanel className="p-6 space-y-3">
            <Database className="h-5 w-5 text-brand-primary" aria-hidden="true" />
            <h3 className="text-lg font-bold text-text-strong">
              1. Hazen Percentile Normalization
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Raw benchmark values (such as Cycles samples/min or memory MB/s)
              are aggregated by median and converted into{" "}
              <code className="text-brand-cyan">0–100</code> Hazen mid-rank
              percentiles within a frozen dataset release. This prevents extreme
              outlier GPUs/CPUs from crushing mid-range scores.
            </p>
          </GlassPanel>

          <GlassPanel className="p-6 space-y-3">
            <Sliders className="h-5 w-5 text-brand-cyan" aria-hidden="true" />
            <h3 className="text-lg font-bold text-text-strong">
              2. Workload-Weighted Scoring
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Each workload profile (Gaming, Web Dev, Video/3D, Local AI,
              Office) assigns versioned weights that strictly sum to{" "}
              <code className="text-brand-cyan">1.00</code>. Your PC is scored
              against the metrics that actually matter for your chosen workflow.
            </p>
          </GlassPanel>

          <GlassPanel className="p-6 space-y-3">
            <Scale className="h-5 w-5 text-brand-amber" aria-hidden="true" />
            <h3 className="text-lg font-bold text-text-strong">
              3. Separate Balance & Bottleneck
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Overall speed and component synergy are independent. We measure the
              capability spread across subsystems with at least 10% workload
              weight so low-weight parts never trigger false-positive bottlenecks.
            </p>
          </GlassPanel>
        </div>

        {/* 2. Performance Tier Reference & Balance Thresholds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel variant="solid" className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-strong">
              Performance Score Tiers (0–100)
            </h3>
            <div className="divide-y divide-white/10 text-xs sm:text-sm">
              {TIER_TABLE.map((row) => (
                <div
                  key={row.tier}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-brand-primary w-20">
                      {row.range}
                    </span>
                    <span className="font-bold text-text-strong">
                      {row.tier}
                    </span>
                  </div>
                  <span className="text-text-muted sm:text-right max-w-xs">
                    {row.meaning}
                  </span>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel variant="solid" className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-strong">
              Balance Spread & Bottleneck Severity
            </h3>
            <div className="divide-y divide-white/10 text-xs sm:text-sm">
              {BALANCE_TABLE.map((row) => (
                <div
                  key={row.status}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-brand-cyan w-24">
                      {row.spread}
                    </span>
                    <span className="font-bold text-text-strong">
                      {row.status}
                    </span>
                  </div>
                  <span className="text-text-muted sm:text-right max-w-xs">
                    {row.treatment}
                  </span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* 3. Data Sources, Provenance & Limitations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassPanel variant="solid" className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Approved Data Sources & Licensing</span>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-text-muted pt-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-cyan shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-strong">
                    Blender Open Data (CC0 1.0):
                  </strong>{" "}
                  Used for CPU and GPU Cycles rendering throughput with full
                  Blender version and compute-type provenance.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-cyan shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-strong">
                    Phoronix Test Suite Lab Runs (GPLv3):
                  </strong>{" "}
                  Used for our own reproducible CPU single-thread, RAM bandwidth,
                  and NVMe/SATA storage benchmarks.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-cyan shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-strong">
                    Strict Anti-Scraping Policy:
                  </strong>{" "}
                  We never scrape or bulk-copy unapproved third-party benchmark
                  websites or retail catalogs.
                </span>
              </li>
            </ul>
          </GlassPanel>

          <GlassPanel variant="solid" className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-amber">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <span>Missing Evidence, Confidence & Known Limitations</span>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-text-muted pt-1">
              <li>
                <strong className="text-text-strong">
                  Zero Fabricated Fallbacks:
                </strong>{" "}
                If a component is missing a workload metric, SiliconSense re-scales
                across covered weights, displays an explicit warning, and reduces
                the Confidence score — never substituting zero.
              </li>
              <li>
                <strong className="text-text-strong">
                  Confidence Calibration:
                </strong>{" "}
                Confidence reflects data quality (sample count, population coverage,
                recency, and approved source status), not hardware speed.
              </li>
              <li>
                <strong className="text-text-strong">
                  Scope Boundaries:
                </strong>{" "}
                Scores reflect relative capability within the active reference
                dataset version and do not account for silicon lottery overclocking
                or case thermal throttling.
              </li>
            </ul>
          </GlassPanel>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-card bg-surface-solid border border-white/10">
          <div>
            <h3 className="text-base font-bold text-text-strong">
              Ready to see the methodology in action?
            </h3>
            <p className="text-xs sm:text-sm text-text-muted">
              Configure a build or inspect individual component percentiles in
              the Hardware Explorer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand-primary text-xs sm:text-sm font-semibold text-text-strong"
            >
              <span>Open PC Analyzer</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/hardware"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-canvas border border-white/15 text-xs sm:text-sm font-semibold text-text-strong"
            >
              <span>Browse Hardware Catalog</span>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
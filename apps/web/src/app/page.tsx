import React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileSpreadsheet,
  GitCompare,
  Gauge,
  Layers,
  Scale,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  GlassPanel,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { LandingHeroDemo } from "@/components/landing/LandingHeroDemo";

const PIPELINE_STEPS = [
  {
    step: "01",
    title: "Verified Benchmark Evidence",
    description:
      "Ingests CC0 Blender Open Data snapshots and reproducible Phoronix Test Suite artifacts with full license and version provenance.",
    icon: FileSpreadsheet,
  },
  {
    step: "02",
    title: "Percentile Normalization",
    description:
      "Converts heterogeneous raw measurements into outlier-resistant 0–100 Hazen mid-rank percentile scores per dataset release.",
    icon: Database,
  },
  {
    step: "03",
    title: "Workload-Specific Weighting",
    description:
      "Applies versioned metric weights summing to 1.00 for Gaming, Web Dev, Video/3D, Local AI, or Office workflows.",
    icon: Layers,
  },
  {
    step: "04",
    title: "Balance & Bottleneck Spread",
    description:
      "Separates raw speed from system synergy—measuring capability spread across workload-relevant components.",
    icon: Scale,
  },
  {
    step: "05",
    title: "Explainable Upgrade Priority",
    description:
      "Ranks upgrades by weighted deficit impact and exposes exact dataset versions, sample counts, and confidence.",
    icon: Wrench,
  },
];

const WORKLOAD_CARDS = [
  {
    title: "Gaming",
    weights: "GPU 50% • CPU Single 20% • RAM 12% • CPU Multi 10% • Storage 8%",
    summary:
      "Prioritizes GPU raster/compute throughput and single-thread frame pacing while checking memory and NVMe adequacy.",
  },
  {
    title: "Web Development",
    weights: "CPU Multi 35% • CPU Single 25% • RAM 22% • Storage 13% • GPU 5%",
    summary:
      "Focuses on multi-core compilation, container orchestration, and memory capacity without penalizing basic GPUs.",
  },
  {
    title: "Video Editing & 3D",
    weights: "GPU Render 42% • CPU Multi 28% • RAM 18% • Storage 12%",
    summary:
      "Balances OptiX/HIP viewport and Cycles rendering against multi-core encoding and high-throughput scratch storage.",
  },
  {
    title: "Local AI & LLMs",
    weights: "GPU Compute/VRAM 55% • RAM 20% • CPU Multi 15% • Storage 10%",
    summary:
      "Evaluates GPU compute and VRAM adequacy for local model weights alongside system memory and fast checkpoint loading.",
  },
  {
    title: "Office & Browsing",
    weights: "CPU Single 40% • RAM 25% • Storage 20% • CPU Multi 10% • GPU 5%",
    summary:
      "Measures everyday responsiveness, snappy multitasking, and SSD wake/load times with minimal discrete GPU requirement.",
  },
];

const FAQ_ITEMS = [
  {
    question: "How is SiliconSense different from generic bottleneck calculators?",
    answer:
      "Generic calculators output a single unexplained percentage or invent scores using black-box guesses. SiliconSense computes separate Performance and Balance scores from versioned benchmark datasets, weights them by your specific workload, and shows exact metric contributions and data confidence.",
  },
  {
    question: "Why can a fast PC still show a bottleneck warning?",
    answer:
      "Performance and Balance are independent. Pairing an ultra-high-end GPU (e.g., 95th percentile) with an entry-level CPU (30th percentile) still produces a high weighted average score, but creates a 65-point capability spread that bottlenecks frame pacing or rendering.",
  },
  {
    question: "What happens if a component is missing a benchmark metric?",
    answer:
      "SiliconSense never silently substitutes zero or fabricates numbers for missing hardware data. Missing metrics are excluded from the weighted sum via our documented coverage rule, explicitly flagged in the UI, and reduce the Confidence score.",
  },
  {
    question: "Where does your benchmark data come from?",
    answer:
      "We use permissive, auditable benchmark sources including CC0 Blender Open Data snapshots and our own reproducible Phoronix Test Suite runs, paired with a curated hardware specification catalog. We never scrape unapproved third-party browser databases.",
  },
];

export default function LandingPage() {
  return (
    <AppShell>
      <div className="space-y-20 md:space-y-28">
        {/* 1. Hero Section */}
        <section className="pt-4 md:pt-8 space-y-10">
          <div className="max-w-3xl space-y-6">
            <StatusBadge
              label="SILICONSENSE BY SPIDEYTECH • BENCHMARK TELEMETRY LAB"
              tone="positive"
            />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-strong leading-[1.1]">
              Detect the bottleneck{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-cyan">
                before you build.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl">
              Understand how strong your PC really is, where it is unbalanced,
              and what to upgrade first — based on measurable benchmark evidence
              and your actual workload, never unexplained AI guesses.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-control bg-brand-primary hover:bg-brand-primary/90 text-sm font-semibold text-text-strong shadow-xl shadow-brand-primary/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
              >
                <span>Analyze My PC</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/compare"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-control bg-surface-solid hover:bg-white/10 border border-white/15 text-sm font-semibold text-text-strong transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <GitCompare className="h-4 w-4 text-brand-cyan" aria-hidden="true" />
                <span>Compare Two Builds</span>
              </Link>
            </div>
          </div>

          {/* 2. Interactive Static Demo Preview Card */}
          <LandingHeroDemo />
        </section>

        {/* 3. How It Works Visual Pipeline */}
        <section aria-labelledby="how-it-works-heading">
          <SectionHeader
            eyebrow="Deterministic Pipeline"
            title="From Raw Benchmark Evidence to Explainable Decisions"
            description="Every score is traceable to a frozen dataset release, percentile normalization version, and workload weight profile."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PIPELINE_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <GlassPanel
                  key={item.step}
                  variant="solid"
                  className="p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-brand-primary">
                        STEP {item.step}
                      </span>
                      <Icon className="h-4 w-4 text-brand-cyan" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold text-text-strong">
                      {item.title}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        </section>

        {/* 4. Not One Score For Every Task (Workload Profiles) */}
        <section aria-labelledby="workloads-heading">
          <SectionHeader
            eyebrow="Workload-Aware Scoring"
            title="Not One Universal Score for Every Task"
            description="A workstation that excels at Web Development can still hit a VRAM bottleneck in Local AI or 3D Rendering. We weight hardware by what you actually run."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {WORKLOAD_CARDS.map((wl) => (
              <GlassPanel
                key={wl.title}
                variant="solid"
                className="p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-text-strong">{wl.title}</h3>
                    <Activity className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                  </div>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                    {wl.summary}
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 text-[11px] font-mono text-brand-cyan">
                  {wl.weights}
                </div>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* 5. Performance vs Balance + Trust & Data Provenance */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassPanel className="p-6 md:p-8 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-primary">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              <span>Dual-Metric Telemetry</span>
            </div>
            <h2 className="text-2xl font-bold text-text-strong">
              Performance Score vs. Balance Score
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Most tools conflate speed with synergy. SiliconSense separates them:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-control bg-surface-solid border border-white/10 space-y-1.5">
                <div className="text-xs font-mono text-brand-cyan">
                  01 • PERFORMANCE (0–100)
                </div>
                <div className="text-sm font-semibold text-text-strong">
                  Overall Workload Capability
                </div>
                <p className="text-xs text-text-muted">
                  Weighted sum of normalized component percentiles mapped to Weak,
                  Basic, Mid-range, Strong, or High-end tiers.
                </p>
              </div>
              <div className="p-4 rounded-control bg-surface-solid border border-white/10 space-y-1.5">
                <div className="text-xs font-mono text-brand-amber">
                  02 • BALANCE (0–100)
                </div>
                <div className="text-sm font-semibold text-text-strong">
                  Component Spread & Bottleneck
                </div>
                <p className="text-xs text-text-muted">
                  Measures the capability gap between your strongest and weakest
                  workload-relevant parts (Balanced to Major Bottleneck).
                </p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 md:p-8 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Methodology & Provenance Trust Strip</span>
            </div>
            <h2 className="text-2xl font-bold text-text-strong">
              Honest Confidence, Zero Fabricated Data
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Every analysis result exposes its underlying evidence quality rather
              than pretending sparse benchmarks are 100% certain:
            </p>
            <ul className="space-y-2.5 text-xs sm:text-sm text-text-muted pt-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-cyan shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-strong">Versioned Releases:</strong>{" "}
                  Every report stamps <code className="text-brand-cyan">dataset_version</code>,{" "}
                  <code className="text-brand-cyan">normalization_version</code>, and{" "}
                  <code className="text-brand-cyan">scoring_version</code>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-cyan shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-strong">Explicit Missing-Data Handling:</strong>{" "}
                  Missing metrics trigger documented coverage scaling and warnings — never
                  silent zeros.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-cyan shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-strong">Confidence Scoring:</strong>{" "}
                  Combines sample count, population size, benchmark recency, and source
                  verification into High / Medium / Limited badges.
                </span>
              </li>
            </ul>
          </GlassPanel>
        </section>

        {/* 6. Compare & Explorer Teaser */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassPanel variant="solid" className="p-6 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-primary">
                <GitCompare className="h-4 w-4" aria-hidden="true" />
                <span>Decision Support</span>
              </div>
              <h3 className="text-xl font-bold text-text-strong">
                Side-by-Side Build Comparison
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Compare two candidate rigs across normalized metrics, bottleneck
                severity, and upgrade headroom without misleading &ldquo;universal
                winner&rdquo; hype.
              </p>
            </div>
            <div>
              <Link
                href="/compare"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-cyan hover:underline"
              >
                <span>Open Build Comparison Tool</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </GlassPanel>

          <GlassPanel variant="solid" className="p-6 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
                <Cpu className="h-4 w-4" aria-hidden="true" />
                <span>Transparent Catalog</span>
              </div>
              <h3 className="text-xl font-bold text-text-strong">
                Hardware Benchmark Explorer
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Inspect canonical CPUs, GPUs, memory kits, and NVMe drives with
                percentile positions, sample counts, and raw source coverage.
              </p>
            </div>
            <div>
              <Link
                href="/hardware"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-primary hover:underline"
              >
                <span>Explore Curated Hardware Catalog</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </GlassPanel>
        </section>

        {/* 7. FAQ Section */}
        <section aria-labelledby="faq-heading">
          <SectionHeader
            eyebrow="Transparency & FAQ"
            title="Frequently Asked Questions"
            description="How SiliconSense handles benchmark provenance, missing hardware metrics, and upgrade priorities."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FAQ_ITEMS.map((faq) => (
              <GlassPanel
                key={faq.question}
                variant="solid"
                className="p-6 space-y-2.5"
              >
                <h3 className="text-base font-semibold text-text-strong">
                  {faq.question}
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  {faq.answer}
                </p>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* 8. Bottom Call-to-Action */}
        <section>
          <GlassPanel className="p-8 md:p-12 text-center space-y-5">
            <Sparkles className="h-8 w-8 text-brand-cyan mx-auto" aria-hidden="true" />
            <h2 className="text-2xl md:text-4xl font-bold text-text-strong">
              Ready to test your PC’s true workload balance?
            </h2>
            <p className="text-sm md:text-base text-text-muted max-w-xl mx-auto">
              Select your CPU, GPU, RAM, and storage in under 60 seconds and get
              a reproducible, benchmark-backed analysis.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-4">
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-control bg-brand-primary hover:bg-brand-primary/90 text-sm font-semibold text-text-strong shadow-lg shadow-brand-primary/25"
              >
                <span>Launch PC Analyzer</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/methodology"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-control bg-surface-solid hover:bg-white/10 border border-white/15 text-sm font-semibold text-text-strong"
              >
                <span>Read Scoring Methodology</span>
              </Link>
            </div>
          </GlassPanel>
        </section>
      </div>
    </AppShell>
  );
}
"use client";

import React, { useState } from "react";
import {
  BalanceGauge,
  GlassPanel,
  HardwareChip,
  MetricBar,
  ScoreRing,
  StatusBadge,
} from "@/components/ui/primitives";
import { WorkloadTabs } from "@/components/ui/interactive";

export interface DemoWorkloadScenario {
  slug: string;
  name: string;
  performanceScore: number;
  performanceTier: "Weak" | "Basic" | "Mid-range" | "Strong" | "High-end";
  balanceScore: number;
  balanceStatus:
    | "Balanced"
    | "Mild bottleneck"
    | "Moderate bottleneck"
    | "Major bottleneck";
  spreadPoints: number;
  confidenceLevel: "High" | "Medium" | "Limited";
  explanation: string;
  upgradePriority: string;
  metrics: {
    label: string;
    subsystem: string;
    score: number;
    weight: number;
  }[];
}

export const LANDING_DEMO_SCENARIOS: DemoWorkloadScenario[] = [
  {
    slug: "gaming",
    name: "Gaming",
    performanceScore: 84,
    performanceTier: "Strong",
    balanceScore: 88,
    balanceStatus: "Balanced",
    spreadPoints: 8.0,
    confidenceLevel: "High",
    explanation:
      "Demo Illustration: GPU raster/compute (86.0) and 3D V-Cache CPU single-thread capability (78.0) are well matched within 8.0 points.",
    upgradePriority: "No urgent bottleneck detected for Gaming (Demo)",
    metrics: [
      { label: "GPU Render & Compute (Demo)", subsystem: "GPU", score: 86, weight: 0.5 },
      { label: "CPU Single-Thread (Demo)", subsystem: "CPU", score: 78, weight: 0.2 },
      { label: "RAM Bandwidth (Demo)", subsystem: "RAM", score: 82, weight: 0.12 },
    ],
  },
  {
    slug: "web-development",
    name: "Web Development",
    performanceScore: 76,
    performanceTier: "Strong",
    balanceScore: 85,
    balanceStatus: "Balanced",
    spreadPoints: 10.0,
    confidenceLevel: "High",
    explanation:
      "Demo Illustration: Fast single-core responsiveness, 32GB DDR5 bandwidth, and NVMe I/O keep local builds and containers balanced.",
    upgradePriority: "Balanced for IDE, Docker & compilation workflows (Demo)",
    metrics: [
      { label: "CPU Multi-Core (Demo)", subsystem: "CPU", score: 72, weight: 0.35 },
      { label: "CPU Single-Thread (Demo)", subsystem: "CPU", score: 78, weight: 0.25 },
      { label: "RAM Adequacy (Demo)", subsystem: "RAM", score: 82, weight: 0.22 },
    ],
  },
  {
    slug: "video-3d",
    name: "Video / 3D",
    performanceScore: 71,
    performanceTier: "Strong",
    balanceScore: 69,
    balanceStatus: "Mild bottleneck",
    spreadPoints: 20.5,
    confidenceLevel: "High",
    explanation:
      "Demo Illustration: Under heavy multi-core rendering, 8-core CPU throughput (65.5) trails GPU rendering capability (86.0) by 20.5 points.",
    upgradePriority: "Upgrade First: CPU Multi-Core for heavy scene builds (Demo)",
    metrics: [
      { label: "GPU Render & Compute (Demo)", subsystem: "GPU", score: 86, weight: 0.42 },
      { label: "CPU Multi-Core (Demo)", subsystem: "CPU", score: 65.5, weight: 0.28 },
      { label: "RAM Bandwidth (Demo)", subsystem: "RAM", score: 82, weight: 0.18 },
    ],
  },
  {
    slug: "local-ai",
    name: "Local AI",
    performanceScore: 63,
    performanceTier: "Mid-range",
    balanceScore: 58,
    balanceStatus: "Moderate bottleneck",
    spreadPoints: 28.0,
    confidenceLevel: "Medium",
    explanation:
      "Demo Illustration: 12GB VRAM capacity limits larger local LLM quantization tiers compared to system RAM and NVMe speed.",
    upgradePriority: "Upgrade First: GPU Compute & VRAM (Target 16GB–24GB Demo)",
    metrics: [
      { label: "GPU Compute & VRAM (Demo)", subsystem: "GPU", score: 54, weight: 0.55 },
      { label: "System RAM Capacity (Demo)", subsystem: "RAM", score: 82, weight: 0.2 },
      { label: "CPU Support (Demo)", subsystem: "CPU", score: 72, weight: 0.15 },
    ],
  },
  {
    slug: "office-browsing",
    name: "Office / Browsing",
    performanceScore: 91,
    performanceTier: "High-end",
    balanceScore: 94,
    balanceStatus: "Balanced",
    spreadPoints: 4.0,
    confidenceLevel: "High",
    explanation:
      "Demo Illustration: Exceeds reference adequacy across CPU responsiveness, memory capacity, and NVMe storage.",
    upgradePriority: "Zero bottlenecks — substantial headroom (Demo)",
    metrics: [
      { label: "CPU Single-Thread (Demo)", subsystem: "CPU", score: 90, weight: 0.4 },
      { label: "RAM Adequacy (Demo)", subsystem: "RAM", score: 92, weight: 0.25 },
      { label: "Storage Responsiveness (Demo)", subsystem: "STORAGE", score: 94, weight: 0.2 },
    ],
  },
];

export function LandingHeroDemo() {
  const [activeSlug, setActiveSlug] = useState<string>("gaming");
  const scenario =
    LANDING_DEMO_SCENARIOS.find((s) => s.slug === activeSlug) ??
    LANDING_DEMO_SCENARIOS[0];

  return (
    <GlassPanel className="p-6 md:p-8 space-y-6 border-white/15">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-cyan">
            Interactive Workload Telemetry Preview
          </div>
          <div className="text-sm text-text-muted mt-0.5">
            Switch workloads below to see how one rig’s score and bottleneck shift:
          </div>
        </div>
        <StatusBadge label="STATIC DEMO ILLUSTRATION" tone="primary" />
      </div>

      <WorkloadTabs
        options={LANDING_DEMO_SCENARIOS.map((s) => ({
          slug: s.slug,
          name: s.name,
        }))}
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
      />

      <div className="flex flex-wrap gap-2">
        <HardwareChip
          slotType="CPU"
          brand="Demo CPU"
          modelName="8-Core 3D-Cache"
          badgeText="Demo"
        />
        <HardwareChip
          slotType="GPU"
          brand="Demo GPU"
          modelName="12GB Ada Class"
          badgeText="Demo"
        />
        <HardwareChip
          slotType="RAM"
          brand="Demo RAM"
          modelName="32GB DDR5-6000"
          badgeText="Demo"
        />
        <HardwareChip
          slotType="STORAGE"
          brand="Demo SSD"
          modelName="2TB PCIe 4.0 NVMe"
          badgeText="Demo"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
        <div className="md:col-span-4 flex justify-center p-4 rounded-card bg-surface-solid/90 border border-white/10">
          <ScoreRing
            score={scenario.performanceScore}
            label={`${scenario.name} (Demo)`}
            tier={scenario.performanceTier}
            confidenceLevel={scenario.confidenceLevel}
            size={156}
          />
        </div>

        <div className="md:col-span-8 space-y-4">
          <div className="p-4 rounded-card bg-surface-solid/90 border border-white/10">
            <BalanceGauge
              balanceScore={scenario.balanceScore}
              balanceStatus={scenario.balanceStatus}
              spreadPoints={scenario.spreadPoints}
              explanation={scenario.explanation}
            />
          </div>

          <div className="space-y-2">
            {scenario.metrics.map((m) => (
              <MetricBar
                key={m.label}
                label={m.label}
                subsystem={m.subsystem}
                score={m.score}
                weight={m.weight}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-white/10 text-xs text-text-muted font-mono">
        <span>Dataset: ds-2026-09-demo • Formula: score-v1.0</span>
        <span className="text-brand-cyan">{scenario.upgradePriority}</span>
      </div>
    </GlassPanel>
  );
}
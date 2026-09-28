"use client";

import React, { useState } from "react";
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
  ComponentPicker,
  DataWarning,
  MethodologyDrawer,
  UpgradeCard,
  WorkloadTabs,
} from "@/components/ui/interactive";
import {
  ComparisonBarChart,
  ContributionChart,
  PercentilePositionBar,
} from "@/components/charts/RechartsLayer";
import {
  DEMO_COMPARISON_FIXTURE,
  DEMO_CONTRIBUTION_FIXTURE,
} from "@/components/charts/chart-utils";

const DEMO_WORKLOADS = [
  { slug: "gaming", name: "Gaming" },
  { slug: "web-development", name: "Web Development" },
  { slug: "video-3d", name: "Video / 3D" },
  { slug: "local-ai", name: "Local AI" },
  { slug: "office-browsing", name: "Office / Browsing" },
];

const DEMO_GPUS = [
  {
    id: 1,
    brand: "NVIDIA",
    model_name: "GeForce RTX 4090 (Demo)",
    generation: "Ada Lovelace",
    badge: "24GB VRAM",
  },
  {
    id: 2,
    brand: "NVIDIA",
    model_name: "GeForce RTX 4070 SUPER (Demo)",
    generation: "Ada Lovelace",
    badge: "12GB VRAM",
  },
  {
    id: 3,
    brand: "AMD",
    model_name: "Radeon RX 7800 XT (Demo)",
    generation: "RDNA 3",
    badge: "16GB VRAM",
  },
];

export default function DesignSystemShowcasePage() {
  const [workload, setWorkload] = useState("gaming");
  const [selectedGpu, setSelectedGpu] = useState<number | null>(2);

  return (
    <AppShell>
      <div className="space-y-12">
        <SectionHeader
          eyebrow="Prompts 12 & 18 • Hardware Laboratory UI & Recharts Layer"
          title="SiliconSense Design System Showcase"
          description="All values on this page are illustrative DEMO fixtures used to verify glassmorphic hierarchy, Recharts storytelling, contrast, and reduced-motion accessibility."
          rightElement={<StatusBadge label="DEMO FIXTURE VALUES" tone="primary" />}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassPanel className="p-6 flex flex-col items-center justify-center">
            <ScoreRing
              score={82}
              label="Demo Workload Score"
              tier="Strong"
              confidenceLevel="High"
            />
          </GlassPanel>

          <GlassPanel className="p-6 lg:col-span-2 flex flex-col justify-between space-y-6">
            <BalanceGauge
              balanceScore={64}
              balanceStatus="Moderate bottleneck"
              spreadPoints={24.0}
              explanation="Illustrative Demo: CPU multi-thread capability trails GPU rendering capability by 24.0 points under heavy scene loads."
            />
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
              <HardwareChip
                slotType="CPU"
                brand="AMD"
                modelName="Ryzen 7 7800X3D (Demo)"
                badgeText="8C/16T"
              />
              <HardwareChip
                slotType="GPU"
                brand="NVIDIA"
                modelName="RTX 4070 SUPER (Demo)"
                badgeText="12GB"
              />
              <HardwareChip
                slotType="RAM"
                brand="G.Skill"
                modelName="32GB DDR5-6000 (Demo)"
              />
            </div>
          </GlassPanel>
        </div>

        <div className="space-y-6">
          <SectionHeader
            eyebrow="Prompt 18 • Recharts Data Storytelling"
            title="Contribution, Comparison & Percentile Visualizations"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContributionChart
              workloadName="Gaming (Demo)"
              items={DEMO_CONTRIBUTION_FIXTURE}
            />
            <ComparisonBarChart
              workloadName="Gaming (Demo)"
              buildAName="Demo Build A"
              buildBName="Demo Build B"
              items={DEMO_COMPARISON_FIXTURE}
            />
          </div>
          <PercentilePositionBar
            componentName="NVIDIA GeForce RTX 4070 SUPER (Demo)"
            metricLabel="Blender Cycles OptiX Render"
            percentile={62.5}
            sampleCount={85}
            datasetVersion="ds-2026-09-demo"
          />
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Interactive Controls"
            title="Workload Tabs & Searchable Component Picker"
          />
          <WorkloadTabs
            options={DEMO_WORKLOADS}
            activeSlug={workload}
            onSelect={setWorkload}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <ComponentPicker
              label="Graphics Card (Demo)"
              slotType="GPU"
              options={DEMO_GPUS}
              selectedId={selectedGpu}
              onSelect={setSelectedGpu}
            />
            <div className="space-y-3">
              <MetricBar
                label="GPU Render & Compute (Demo)"
                subsystem="GPU"
                score={84.5}
                percentile={85}
                weight={0.5}
              />
              <MetricBar
                label="CPU Single-Thread (Demo)"
                subsystem="CPU"
                score={78.0}
                percentile={78}
                weight={0.2}
              />
              <MetricBar
                label="Storage Sequential Read (Demo Missing)"
                subsystem="STORAGE"
                score={null}
                weight={0.08}
                isMissing
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UpgradeCard
            priorityOrder={1}
            componentType="CPU"
            affectedMetricKey="cpu_multi"
            reason="Demo Example: Upgrading CPU multi-core throughput brings system spread within 12 points for balanced rendering."
            targetScoreMin={75}
            targetScoreMax={88}
          />
          <div className="space-y-4">
            <DataWarning
              warnings={[
                "Demo Notice: Missing storage benchmark evidence reduces confidence instead of substituting zero.",
              ]}
            />
            <MethodologyDrawer
              datasetVersion="ds-2026-09-demo"
              normalizationVersion="norm-v1.0"
              scoringVersion="score-v1.0"
              workloadVersion="1.0.0"
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
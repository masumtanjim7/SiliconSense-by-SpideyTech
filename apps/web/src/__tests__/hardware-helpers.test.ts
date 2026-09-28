import { describe, expect, it } from "vitest";
import type { ComponentDetailResponse } from "@packages/contracts";
import {
  extractUniqueBrands,
  formatHardwareSpecLine,
  summarizeComponentEvidence,
} from "@/components/hardware/hardware-helpers";

describe("Hardware Explorer Helpers (Prompt 17)", () => {
  it("distinguishes unknown/absent benchmark evidence from low performance", () => {
    const compWithoutMetrics: ComponentDetailResponse = {
      id: 99,
      component_type: "CPU",
      brand: "AMD",
      model_name: "Unbenchmarked CPU",
      is_verified: true,
      aliases: [],
      normalized_metrics: [],
    };

    const summary = summarizeComponentEvidence(compWithoutMetrics);
    expect(summary.state).toBe("no_benchmark_evidence");
    expect(summary.averageNormalizedScore).toBeNull();
    expect(summary.badgeLabel).toContain("Not Low Performance");
  });

  it("aggregates verified metric coverage and sample counts accurately", () => {
    const compWithMetrics: ComponentDetailResponse = {
      id: 1,
      component_type: "GPU",
      brand: "NVIDIA",
      model_name: "GeForce RTX 4090",
      is_verified: true,
      aliases: ["NVIDIA GeForce RTX 4090"],
      normalized_metrics: [
        {
          metric_key: "gpu_render_compute",
          display_name: "GPU Render",
          unit: "samples_per_min",
          raw_aggregated_score: 11250.5,
          normalized_score_0_100: 87.5,
          percentile: 87.5,
          sample_count: 120,
          confidence_contribution: 0.95,
          dataset_version: "ds-2026-09-r1",
        },
      ],
    };

    const summary = summarizeComponentEvidence(compWithMetrics);
    expect(summary.state).toBe("verified_evidence");
    expect(summary.averageNormalizedScore).toBe(87.5);
    expect(summary.totalSamples).toBe(120);
  });

  it("extracts sorted unique brands and formats hardware spec lines", () => {
    const brands = extractUniqueBrands([
      { id: 1, component_type: "GPU", brand: "NVIDIA", model_name: "A", is_verified: true },
      { id: 2, component_type: "CPU", brand: "AMD", model_name: "B", is_verified: true },
      { id: 3, component_type: "GPU", brand: "NVIDIA", model_name: "C", is_verified: true },
    ]);
    expect(brands).toEqual(["AMD", "NVIDIA"]);

    const specText = formatHardwareSpecLine({
      id: 1,
      component_type: "GPU",
      brand: "NVIDIA",
      model_name: "RTX 4070 SUPER",
      is_verified: true,
      specification: { vram_gb: 12 },
    });
    expect(specText).toBe("12 GB VRAM");
  });
});
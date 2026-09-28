import type { ComponentSummaryItem } from "@packages/contracts";

export interface AnalyzerWizardSelection {
  buildName: string;
  workloadSlug: string;
  CPU: number | null;
  GPU: number | null;
  RAM: number | null;
  STORAGE: number | null;
}

export const WIZARD_STEPS = [
  { step: 1, key: "WORKLOAD", title: "Target Workload", shortLabel: "1. Workload" },
  { step: 2, key: "CPU", title: "Select Processor (CPU)", shortLabel: "2. CPU" },
  { step: 3, key: "GPU", title: "Select Graphics (GPU)", shortLabel: "3. GPU" },
  { step: 4, key: "RAM", title: "Configure Memory (RAM)", shortLabel: "4. RAM" },
  { step: 5, key: "STORAGE", title: "Configure Storage", shortLabel: "5. Storage" },
  { step: 6, key: "REVIEW", title: "Review & Analyze Rig", shortLabel: "6. Review" },
] as const;

export function isWizardConfigComplete(state: AnalyzerWizardSelection): boolean {
  return (
    state.workloadSlug.trim().length > 0 &&
    state.CPU !== null &&
    state.CPU > 0 &&
    state.GPU !== null &&
    state.GPU > 0 &&
    state.RAM !== null &&
    state.RAM > 0 &&
    state.STORAGE !== null &&
    state.STORAGE > 0
  );
}

export function countSelectedHardwareSlots(state: AnalyzerWizardSelection): number {
  let count = 0;
  if (state.CPU) count += 1;
  if (state.GPU) count += 1;
  if (state.RAM) count += 1;
  if (state.STORAGE) count += 1;
  return count;
}

export function formatComponentSpecBadge(item: ComponentSummaryItem): string | undefined {
  const spec = item.specification;
  if (!spec) return undefined;
  if (item.component_type === "CPU" && spec.core_count) {
    return `${spec.core_count}C/${spec.thread_count ?? spec.core_count}T`;
  }
  if (item.component_type === "GPU" && spec.vram_gb) {
    return `${spec.vram_gb}GB VRAM`;
  }
  if (item.component_type === "RAM" && spec.ram_capacity_gb) {
    return `${spec.ram_capacity_gb}GB ${spec.memory_speed ?? ""}`.trim();
  }
  if (item.component_type === "STORAGE" && spec.storage_type) {
    return spec.storage_type;
  }
  return undefined;
}
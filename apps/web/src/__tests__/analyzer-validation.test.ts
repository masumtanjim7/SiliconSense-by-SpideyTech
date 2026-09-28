import { describe, expect, it } from "vitest";
import {
  countSelectedHardwareSlots,
  formatComponentSpecBadge,
  isWizardConfigComplete,
} from "@/components/analyzer/analyzer-validation";

describe("PC Analyzer Wizard Validation & Formatting", () => {
  it("disables analysis submission until workload and all 4 hardware slots are valid", () => {
    expect(
      isWizardConfigComplete({
        buildName: "Incomplete Rig",
        workloadSlug: "gaming",
        CPU: 1,
        GPU: 6,
        RAM: null,
        STORAGE: 11,
      })
    ).toBe(false);

    expect(
      isWizardConfigComplete({
        buildName: "Complete Rig",
        workloadSlug: "gaming",
        CPU: 1,
        GPU: 6,
        RAM: 9,
        STORAGE: 11,
      })
    ).toBe(true);
  });

  it("counts selected slots and formats hardware badges accurately", () => {
    expect(
      countSelectedHardwareSlots({
        buildName: "Test",
        workloadSlug: "gaming",
        CPU: 1,
        GPU: 6,
        RAM: null,
        STORAGE: null,
      })
    ).toBe(2);

    const badge = formatComponentSpecBadge({
      id: 1,
      component_type: "CPU",
      brand: "AMD",
      model_name: "Ryzen 7 7800X3D",
      is_verified: true,
      specification: { core_count: 8, thread_count: 16 },
    });
    expect(badge).toBe("8C/16T");
  });
});
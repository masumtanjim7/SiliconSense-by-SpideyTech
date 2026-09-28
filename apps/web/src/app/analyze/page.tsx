"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  HelpCircle,
  Loader2,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import type {
  ComponentSummaryItem,
  DatasetVersionMetaResponse,
  WorkloadProfileSchema,
} from "@packages/contracts";
import { AppShell } from "@/components/layout/AppShell";
import {
  GlassPanel,
  HardwareChip,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  ComponentPicker,
  ErrorState,
  SkeletonSet,
  WorkloadTabs,
} from "@/components/ui/interactive";
import {
  fetchDatasetVersionMeta,
  fetchWorkloads,
  searchComponents,
  submitBuildAnalysis,
} from "@/lib/api";
import {
  countSelectedHardwareSlots,
  formatComponentSpecBadge,
  isWizardConfigComplete,
  WIZARD_STEPS,
  type AnalyzerWizardSelection,
} from "@/components/analyzer/analyzer-validation";
import { cn } from "@/lib/utils";

export default function PCAnalyzerWizardPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [workloads, setWorkloads] = useState<WorkloadProfileSchema[]>([]);
  const [catalog, setCatalog] = useState<ComponentSummaryItem[]>([]);
  const [datasetMeta, setDatasetMeta] = useState<DatasetVersionMetaResponse | null>(
    null
  );

  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selection, setSelection] = useState<AnalyzerWizardSelection>({
    buildName: "My Custom SpideyTech Rig",
    workloadSlug: "gaming",
    CPU: null,
    GPU: null,
    RAM: null,
    STORAGE: null,
  });

  const [showNotSureHelper, setShowNotSureHelper] = useState<boolean>(false);
  const [showUnsupportedModal, setShowUnsupportedModal] = useState<boolean>(false);
  const [unsupportedModelInput, setUnsupportedModelInput] = useState<string>("");
  const [unsupportedSubmittedNote, setUnsupportedSubmittedNote] = useState<
    string | null
  >(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadInitialTelemetry = useCallback(async () => {
    setIsLoadingCatalog(true);
    setLoadError(null);
    try {
      const [wlList, compRes, metaRes] = await Promise.all([
        fetchWorkloads(),
        searchComponents({ page: 1, page_size: 100 }),
        fetchDatasetVersionMeta(),
      ]);
      setWorkloads(wlList);
      setCatalog(compRes.items);
      setDatasetMeta(metaRes);

      const firstCpu = compRes.items.find((c) => c.component_type === "CPU");
      const firstGpu = compRes.items.find((c) => c.component_type === "GPU");
      const firstRam = compRes.items.find((c) => c.component_type === "RAM");
      const firstStorage = compRes.items.find(
        (c) => c.component_type === "STORAGE"
      );

      setSelection((prev) => ({
        ...prev,
        workloadSlug: wlList[0]?.slug ?? "gaming",
        CPU: prev.CPU ?? firstCpu?.id ?? null,
        GPU: prev.GPU ?? firstGpu?.id ?? null,
        RAM: prev.RAM ?? firstRam?.id ?? null,
        STORAGE: prev.STORAGE ?? firstStorage?.id ?? null,
      }));
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Could not connect to FastAPI telemetry server."
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialTelemetry();
  }, [loadInitialTelemetry]);

  const activeWorkload = workloads.find(
    (w) => w.slug === selection.workloadSlug
  );
  const selectedCpuObj = catalog.find((c) => c.id === selection.CPU);
  const selectedGpuObj = catalog.find((c) => c.id === selection.GPU);
  const selectedRamObj = catalog.find((c) => c.id === selection.RAM);
  const selectedStorageObj = catalog.find((c) => c.id === selection.STORAGE);

  const isComplete = isWizardConfigComplete(selection);
  const selectedCount = countSelectedHardwareSlots(selection);

  async function handleAnalyzeSubmit() {
    if (!isComplete || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitBuildAnalysis({
        build_name: selection.buildName.trim() || "Custom Lab Rig",
        workload_slug: selection.workloadSlug,
        dataset_version: datasetMeta?.dataset_version ?? null,
        components: {
          CPU: selection.CPU as number,
          GPU: selection.GPU as number,
          RAM: selection.RAM as number,
          STORAGE: selection.STORAGE as number,
        },
      });
      router.push(`/result/${response.share_uuid}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Analysis failed. Verify your component selections and try again."
      );
      setIsSubmitting(false);
    }
  }

  function renderSlotOptions(slotType: "CPU" | "GPU" | "RAM" | "STORAGE") {
    return catalog
      .filter((c) => c.component_type === slotType)
      .map((c) => ({
        id: c.id,
        brand: c.brand,
        model_name: c.model_name,
        generation: c.generation,
        badge: formatComponentSpecBadge(c),
      }));
  }

  return (
    <AppShell>
      <div className="space-y-8 pb-24 lg:pb-8">
        <SectionHeader
          eyebrow="Step-by-Step Telemetry Configuration"
          title="PC Strength & Balance Analyzer"
          description="Select your target workload and hardware components. All scores and bottleneck detections are calculated deterministically on the backend using versioned benchmark datasets."
          rightElement={
            datasetMeta ? (
              <StatusBadge
                label={`Dataset: ${datasetMeta.dataset_version} • ${datasetMeta.scoring_version}`}
                tone="positive"
              />
            ) : undefined
          }
        />

        {/* Step Progress Bar */}
        <nav aria-label="Analyzer configuration steps">
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {WIZARD_STEPS.map((s) => {
              const isCurrent = s.step === currentStep;
              const isDone = s.step < currentStep;
              return (
                <li key={s.step}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(s.step)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-2.5 rounded-control text-xs font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                      isCurrent
                        ? "bg-brand-primary text-text-strong border-brand-primary shadow-md"
                        : isDone
                          ? "bg-surface-solid text-brand-cyan border-brand-cyan/30"
                          : "bg-surface-solid/70 text-text-muted border-white/10 hover:text-text-strong"
                    )}
                  >
                    <span>{s.shortLabel}</span>
                    {isDone && (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-brand-cyan shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {isLoadingCatalog ? (
          <SkeletonSet rows={5} />
        ) : loadError ? (
          <ErrorState
            title="Telemetry Catalog Offline"
            message={`${loadError} — Ensure the FastAPI server is running on ${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}.`}
            onRetry={() => void loadInitialTelemetry()}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left / Main Step Wizard Panel */}
            <div className="lg:col-span-8 space-y-6">
              <GlassPanel variant="solid" className="p-6 md:p-8 space-y-6">
                {/* Step 1: Workload */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-mono uppercase text-brand-primary">
                        Step 1 of 6 • Primary Purpose
                      </div>
                      <h3 className="text-xl font-bold text-text-strong mt-1">
                        Choose Your Primary Workload
                      </h3>
                      <p className="text-xs sm:text-sm text-text-muted mt-1">
                        Hardware strength and balance depend heavily on what you run.
                        Select a workload profile to load its versioned metric weights:
                      </p>
                    </div>

                    <WorkloadTabs
                      options={workloads.map((w) => ({
                        slug: w.slug,
                        name: w.name,
                      }))}
                      activeSlug={selection.workloadSlug}
                      onSelect={(slug) =>
                        setSelection((prev) => ({ ...prev, workloadSlug: slug }))
                      }
                    />

                    {activeWorkload && (
                      <div className="p-5 rounded-card bg-canvas border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-text-strong">
                            {activeWorkload.name} Profile (v{activeWorkload.version})
                          </span>
                          <Activity
                            className="h-4 w-4 text-brand-cyan"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="text-xs sm:text-sm text-text-muted">
                          {activeWorkload.description}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                          {activeWorkload.weights.map((w) => (
                            <div
                              key={w.metric_key}
                              className="p-2.5 rounded-lg bg-surface-solid border border-white/5"
                            >
                              <div className="text-[11px] font-mono text-brand-primary">
                                {w.subsystem} • {Math.round(w.weight * 100)}% Weight
                              </div>
                              <div className="text-xs font-medium text-text-strong mt-0.5">
                                {w.display_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <label
                        htmlFor="build-name-input"
                        className="block text-xs font-semibold uppercase tracking-wider text-text-muted"
                      >
                        Optional Build Name / Label
                      </label>
                      <input
                        id="build-name-input"
                        type="text"
                        maxLength={160}
                        value={selection.buildName}
                        onChange={(e) =>
                          setSelection((prev) => ({
                            ...prev,
                            buildName: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2.5 rounded-control bg-canvas border border-white/10 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: CPU */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-mono uppercase text-brand-primary">
                        Step 2 of 6 • Processor
                      </div>
                      <h3 className="text-xl font-bold text-text-strong mt-1">
                        Select Your Processor (CPU)
                      </h3>
                      <p className="text-xs sm:text-sm text-text-muted mt-1">
                        Drives single-thread responsiveness and multi-core compilation/rendering throughput.
                      </p>
                    </div>
                    <ComponentPicker
                      label="Processor"
                      slotType="CPU"
                      options={renderSlotOptions("CPU")}
                      selectedId={selection.CPU}
                      onSelect={(id) =>
                        setSelection((prev) => ({ ...prev, CPU: id }))
                      }
                      placeholder="Search AMD Ryzen or Intel Core model..."
                    />
                  </div>
                )}

                {/* Step 3: GPU */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-mono uppercase text-brand-primary">
                        Step 3 of 6 • Graphics Card
                      </div>
                      <h3 className="text-xl font-bold text-text-strong mt-1">
                        Select Your Graphics Card (GPU)
                      </h3>
                      <p className="text-xs sm:text-sm text-text-muted mt-1">
                        Critical for Gaming, 3D Rendering, and Local AI compute/VRAM adequacy.
                      </p>
                    </div>
                    <ComponentPicker
                      label="Graphics Card"
                      slotType="GPU"
                      options={renderSlotOptions("GPU")}
                      selectedId={selection.GPU}
                      onSelect={(id) =>
                        setSelection((prev) => ({ ...prev, GPU: id }))
                      }
                      placeholder="Search NVIDIA GeForce or AMD Radeon model..."
                    />
                  </div>
                )}

                {/* Step 4: RAM */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-mono uppercase text-brand-primary">
                        Step 4 of 6 • System Memory
                      </div>
                      <h3 className="text-xl font-bold text-text-strong mt-1">
                        Configure System Memory (RAM)
                      </h3>
                      <p className="text-xs sm:text-sm text-text-muted mt-1">
                        Determines multitasking headroom, memory bandwidth, and large dataset adequacy.
                      </p>
                    </div>
                    <ComponentPicker
                      label="Memory Configuration"
                      slotType="RAM"
                      options={renderSlotOptions("RAM")}
                      selectedId={selection.RAM}
                      onSelect={(id) =>
                        setSelection((prev) => ({ ...prev, RAM: id }))
                      }
                      placeholder="Search DDR4 / DDR5 memory kit..."
                    />
                  </div>
                )}

                {/* Step 5: Storage */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-mono uppercase text-brand-primary">
                        Step 5 of 6 • Primary Drive
                      </div>
                      <h3 className="text-xl font-bold text-text-strong mt-1">
                        Configure Primary Storage
                      </h3>
                      <p className="text-xs sm:text-sm text-text-muted mt-1">
                        Impacts asset streaming, project load times, and scratch disk throughput.
                      </p>
                    </div>
                    <ComponentPicker
                      label="Storage Drive"
                      slotType="STORAGE"
                      options={renderSlotOptions("STORAGE")}
                      selectedId={selection.STORAGE}
                      onSelect={(id) =>
                        setSelection((prev) => ({ ...prev, STORAGE: id }))
                      }
                      placeholder="Search NVMe PCIe or SATA SSD..."
                    />
                  </div>
                )}

                {/* Step 6: Review & Analyze */}
                {currentStep === 6 && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-mono uppercase text-brand-cyan">
                        Step 6 of 6 • Final Verification
                      </div>
                      <h3 className="text-xl font-bold text-text-strong mt-1">
                        Review Configuration & Run Telemetry Analysis
                      </h3>
                      <p className="text-xs sm:text-sm text-text-muted mt-1">
                        Your result will be calculated against dataset{" "}
                        <code className="text-brand-cyan">
                          {datasetMeta?.dataset_version ?? "ds-2026-09-r1"}
                        </code>{" "}
                        for the{" "}
                        <strong className="text-text-strong">
                          {activeWorkload?.name ?? selection.workloadSlug}
                        </strong>{" "}
                        workload profile.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-control bg-canvas border border-white/10">
                        <div className="text-[11px] font-mono text-text-muted">
                          PROCESSOR (CPU)
                        </div>
                        <div className="text-sm font-semibold text-text-strong mt-1">
                          {selectedCpuObj
                            ? `${selectedCpuObj.brand} ${selectedCpuObj.model_name}`
                            : "Not Selected"}
                        </div>
                      </div>
                      <div className="p-4 rounded-control bg-canvas border border-white/10">
                        <div className="text-[11px] font-mono text-text-muted">
                          GRAPHICS (GPU)
                        </div>
                        <div className="text-sm font-semibold text-text-strong mt-1">
                          {selectedGpuObj
                            ? `${selectedGpuObj.brand} ${selectedGpuObj.model_name}`
                            : "Not Selected"}
                        </div>
                      </div>
                      <div className="p-4 rounded-control bg-canvas border border-white/10">
                        <div className="text-[11px] font-mono text-text-muted">
                          MEMORY (RAM)
                        </div>
                        <div className="text-sm font-semibold text-text-strong mt-1">
                          {selectedRamObj
                            ? `${selectedRamObj.brand} ${selectedRamObj.model_name}`
                            : "Not Selected"}
                        </div>
                      </div>
                      <div className="p-4 rounded-control bg-canvas border border-white/10">
                        <div className="text-[11px] font-mono text-text-muted">
                          STORAGE DRIVE
                        </div>
                        <div className="text-sm font-semibold text-text-strong mt-1">
                          {selectedStorageObj
                            ? `${selectedStorageObj.brand} ${selectedStorageObj.model_name}`
                            : "Not Selected"}
                        </div>
                      </div>
                    </div>

                    {submitError && (
                      <ErrorState
                        title="Analysis Submission Error"
                        message={submitError}
                      />
                    )}

                    <div className="p-4 rounded-control bg-brand-primary/10 border border-brand-primary/30 flex items-start gap-3 text-xs text-text-muted">
                      <Database
                        className="h-4 w-4 text-brand-primary shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>
                        <strong className="text-text-strong">
                          Reproducibility Guarantee:
                        </strong>{" "}
                        Results depend on your selected workload and active dataset
                        version. Missing metrics are explicitly surfaced rather than
                        substituted with zeros.
                      </span>
                    </div>
                  </div>
                )}

                {/* Wizard Navigation Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <button
                    type="button"
                    disabled={currentStep === 1 || isSubmitting}
                    onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-control bg-canvas border border-white/10 text-xs sm:text-sm font-medium text-text-muted hover:text-text-strong disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Previous Step</span>
                  </button>

                  {currentStep < 6 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep((s) => Math.min(6, s + 1))}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand-primary hover:bg-brand-primary/90 text-xs sm:text-sm font-semibold text-text-strong"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!isComplete || isSubmitting}
                      onClick={() => void handleAnalyzeSubmit()}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-control bg-brand-cyan text-canvas font-bold text-xs sm:text-sm hover:opacity-95 disabled:opacity-40 shadow-lg shadow-brand-cyan/20"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          <span>Running Deterministic Backend Analysis...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          <span>Analyze My PC Now</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </GlassPanel>

              {/* Helper & Unsupported Component Fallback Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-card bg-surface-solid border border-white/10 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowNotSureHelper((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-brand-cyan"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4" aria-hidden="true" />
                      <span>Not sure what hardware is inside your PC?</span>
                    </span>
                    <span>{showNotSureHelper ? "Hide" : "Show Guide"}</span>
                  </button>
                  {showNotSureHelper && (
                    <p className="text-xs text-text-muted leading-relaxed pt-1">
                      On Windows, press <code className="text-text-strong">Ctrl + Shift + Esc</code> to open{" "}
                      <strong className="text-text-strong">Task Manager → Performance</strong>, or press{" "}
                      <code className="text-text-strong">Win + R</code> and run{" "}
                      <code className="text-brand-cyan">dxdiag</code>. On Linux, run{" "}
                      <code className="text-brand-cyan">lscpu</code> and{" "}
                      <code className="text-brand-cyan">lspci | grep VGA</code>.
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-card bg-surface-solid border border-white/10 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowUnsupportedModal((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-brand-primary"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <PlusCircle className="h-4 w-4" aria-hidden="true" />
                      <span>Unsupported component? Request catalog addition</span>
                    </span>
                    <span>{showUnsupportedModal ? "Close" : "Request"}</span>
                  </button>
                  {showUnsupportedModal && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] text-text-muted">
                        SiliconSense never fabricates scores for unverified parts.
                        Submit a model name to queue it for benchmark ingestion:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={unsupportedModelInput}
                          onChange={(e) => setUnsupportedModelInput(e.target.value)}
                          placeholder="e.g. Ryzen 7 9800X3D"
                          className="flex-1 px-3 py-1.5 rounded-lg bg-canvas border border-white/10 text-xs text-text-strong"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!unsupportedModelInput.trim()) return;
                            setUnsupportedSubmittedNote(
                              `Logged '${unsupportedModelInput.trim()}' for curated catalog verification.`
                            );
                            setUnsupportedModelInput("");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-brand-primary text-xs font-semibold text-text-strong"
                        >
                          Log Request
                        </button>
                      </div>
                      {unsupportedSubmittedNote && (
                        <p className="text-[11px] text-brand-cyan">
                          {unsupportedSubmittedNote}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Desktop Persistent Build Summary */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
              <GlassPanel className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-xs font-mono uppercase text-brand-cyan">
                      Live Rig Summary
                    </div>
                    <h3 className="text-base font-bold text-text-strong mt-0.5">
                      {selection.buildName || "Custom Rig"}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-text-muted">
                    {selectedCount}/4 Slots
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs text-text-muted">
                    Target Workload:{" "}
                    <span className="font-semibold text-brand-primary">
                      {activeWorkload?.name ?? selection.workloadSlug}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedCpuObj && (
                      <HardwareChip
                        slotType="CPU"
                        brand={selectedCpuObj.brand}
                        modelName={selectedCpuObj.model_name}
                        badgeText={formatComponentSpecBadge(selectedCpuObj)}
                      />
                    )}
                    {selectedGpuObj && (
                      <HardwareChip
                        slotType="GPU"
                        brand={selectedGpuObj.brand}
                        modelName={selectedGpuObj.model_name}
                        badgeText={formatComponentSpecBadge(selectedGpuObj)}
                      />
                    )}
                    {selectedRamObj && (
                      <HardwareChip
                        slotType="RAM"
                        brand={selectedRamObj.brand}
                        modelName={selectedRamObj.model_name}
                        badgeText={formatComponentSpecBadge(selectedRamObj)}
                      />
                    )}
                    {selectedStorageObj && (
                      <HardwareChip
                        slotType="STORAGE"
                        brand={selectedStorageObj.brand}
                        modelName={selectedStorageObj.model_name}
                        badgeText={formatComponentSpecBadge(selectedStorageObj)}
                      />
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!isComplete || isSubmitting}
                  onClick={() => void handleAnalyzeSubmit()}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-control bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 text-xs sm:text-sm font-semibold text-text-strong shadow-lg shadow-brand-primary/20 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Calculating Telemetry...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      <span>Run Full Workload Analysis</span>
                    </>
                  )}
                </button>
              </GlassPanel>
            </aside>
          </div>
        )}

        {/* Compact Mobile Sticky Summary Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-white/15 bg-canvas/95 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-semibold text-text-strong">
              {activeWorkload?.name ?? "Workload"} • {selectedCount}/4 Parts
            </div>
            <div className="text-text-muted truncate max-w-[200px]">
              {selectedCpuObj?.model_name ?? "Select CPU"} +{" "}
              {selectedGpuObj?.model_name ?? "Select GPU"}
            </div>
          </div>
          <button
            type="button"
            disabled={!isComplete || isSubmitting}
            onClick={() => void handleAnalyzeSubmit()}
            className="px-4 py-2 rounded-control bg-brand-primary disabled:opacity-40 text-xs font-semibold text-text-strong shrink-0"
          >
            {isSubmitting ? "Analyzing..." : "Analyze PC"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
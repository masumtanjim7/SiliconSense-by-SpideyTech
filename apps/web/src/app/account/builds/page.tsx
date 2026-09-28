"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Layers,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type {
  ComponentSummaryItem,
  DatasetVersionMetaResponse,
  SavedBuildSummaryResponse,
  WorkloadProfileSchema,
} from "@packages/contracts";
import { AppShell } from "@/components/layout/AppShell";
import {
  GlassPanel,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  EmptyState,
  ErrorState,
  SkeletonSet,
} from "@/components/ui/interactive";
import {
  fetchDatasetVersionMeta,
  fetchSavedBuilds,
  fetchWorkloads,
  saveAuthenticatedBuild,
  searchComponents,
} from "@/lib/api";
import {
  evaluateSavedBuildRefreshStatus,
  summarizeSavedBuildsPortfolio,
} from "@/components/account/account-helpers";

const TOKEN_STORAGE_KEY = "siliconsense_supabase_jwt";

export default function AccountSavedBuildsPage() {
  const router = useRouter();

  const [tokenInput, setTokenInput] = useState<string>("");
  const [activeToken, setActiveToken] = useState<string | null>(null);

  const [savedBuilds, setSavedBuilds] = useState<SavedBuildSummaryResponse[]>(
    []
  );
  const [datasetMeta, setDatasetMeta] =
    useState<DatasetVersionMetaResponse | null>(null);
  const [workloads, setWorkloads] = useState<WorkloadProfileSchema[]>([]);
  const [catalog, setCatalog] = useState<ComponentSummaryItem[]>([]);

  const [newBuildName, setNewBuildName] = useState<string>(
    "Saved Workstation Rig"
  );
  const [newWorkloadSlug, setNewWorkloadSlug] = useState<string>("gaming");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAuthenticatedWorkspace = useCallback(async (jwt: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [buildsList, metaRes, wlList, compRes] = await Promise.all([
        fetchSavedBuilds(jwt),
        fetchDatasetVersionMeta().catch(() => null),
        fetchWorkloads().catch(() => []),
        searchComponents({ page: 1, page_size: 100 }).catch(() => ({
          items: [],
          total: 0,
          page: 1,
          page_size: 100,
        })),
      ]);
      setSavedBuilds(buildsList);
      setDatasetMeta(metaRes);
      setWorkloads(wlList);
      setCatalog(compRes.items);
      if (wlList[0]?.slug) {
        setNewWorkloadSlug(wlList[0].slug);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Authentication failed or token expired."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      setActiveToken(stored);
      void loadAuthenticatedWorkspace(stored);
    }
  }, [loadAuthenticatedWorkspace]);

  function handleConnectToken(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = tokenInput.trim();
    if (!cleaned) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, cleaned);
    }
    setActiveToken(cleaned);
    setTokenInput("");
    void loadAuthenticatedWorkspace(cleaned);
  }

  function handleSignOut() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setActiveToken(null);
    setSavedBuilds([]);
    setErrorMessage(null);
  }

  async function handleQuickSaveBuild() {
    if (!activeToken || isSaving) return;
    const cpu = catalog.find((c) => c.component_type === "CPU");
    const gpu = catalog.find((c) => c.component_type === "GPU");
    const ram = catalog.find((c) => c.component_type === "RAM");
    const storage = catalog.find((c) => c.component_type === "STORAGE");

    if (!cpu || !gpu || !ram || !storage) {
      setErrorMessage("Curated catalog components not loaded yet.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveAuthenticatedBuild(
        {
          build_name: newBuildName.trim() || "Saved Rig",
          workload_slug: newWorkloadSlug,
          dataset_version: datasetMeta?.dataset_version ?? null,
          components: {
            CPU: cpu.id,
            GPU: gpu.id,
            RAM: ram.id,
            STORAGE: storage.id,
          },
        },
        activeToken
      );
      await loadAuthenticatedWorkspace(activeToken);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not save build."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const portfolio = summarizeSavedBuildsPortfolio(
    savedBuilds,
    datasetMeta?.dataset_version
  );

  return (
    <AppShell>
      <div className="space-y-10 pb-16">
        <SectionHeader
          eyebrow="Authenticated Retention & Dataset History"
          title="Account & Saved PC Builds"
          description="Keep your custom PC configurations, track historical scores across benchmark dataset releases, and re-run analyses when workload profiles update."
          rightElement={
            activeToken ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-surface-solid hover:bg-white/10 border border-white/15 text-xs font-semibold text-text-muted hover:text-text-strong"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Disconnect Session</span>
              </button>
            ) : (
              <StatusBadge label="SUPABASE JWT PROTECTED" tone="primary" />
            )
          }
        />

        {!activeToken ? (
          <GlassPanel className="max-w-2xl mx-auto p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2.5 text-brand-primary">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-xl font-bold text-text-strong">
                Connect Authenticated Session
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Browsing hardware and analyzing temporary builds on SiliconSense
              is always free without an account. To persist saved builds (`GET /
              POST /v1/builds`), provide your server-verified Supabase Auth
              Bearer JWT below:
            </p>

            <form onSubmit={handleConnectToken} className="space-y-4">
              <div>
                <label
                  htmlFor="jwt-input"
                  className="block text-xs font-mono uppercase text-text-muted mb-1.5"
                >
                  Supabase Access Token (Bearer JWT)
                </label>
                <input
                  id="jwt-input"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste HS256 Supabase JWT token..."
                  className="w-full px-4 py-2.5 rounded-control bg-canvas border border-white/10 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-brand-primary hover:bg-brand-primary/90 text-xs sm:text-sm font-semibold text-text-strong"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Verify & Load Saved Builds</span>
                </button>

                <Link
                  href="/analyze"
                  className="text-xs font-semibold text-brand-cyan hover:underline"
                >
                  Continue as Guest to PC Analyzer →
                </Link>
              </div>
            </form>
          </GlassPanel>
        ) : isLoading ? (
          <SkeletonSet rows={4} />
        ) : (
          <div className="space-y-8">
            {errorMessage && (
              <ErrorState
                title="Session or API Error"
                message={errorMessage}
                onRetry={() => void loadAuthenticatedWorkspace(activeToken)}
              />
            )}

            {/* Portfolio Telemetry Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <GlassPanel variant="solid" className="p-5">
                <div className="text-xs font-mono uppercase text-text-muted">
                  Saved Configurations
                </div>
                <div className="text-3xl font-bold text-text-strong mt-1 tabular-nums">
                  {portfolio.totalBuilds}
                </div>
              </GlassPanel>

              <GlassPanel variant="solid" className="p-5">
                <div className="text-xs font-mono uppercase text-text-muted">
                  Mean Workload Score
                </div>
                <div className="text-3xl font-bold text-brand-cyan mt-1 tabular-nums">
                  {portfolio.averageScore !== null
                    ? `${portfolio.averageScore.toFixed(1)} / 100`
                    : "N/A"}
                </div>
              </GlassPanel>

              <GlassPanel variant="solid" className="p-5">
                <div className="text-xs font-mono uppercase text-text-muted">
                  Dataset Refresh Status
                </div>
                <div className="text-sm font-semibold text-text-strong mt-2">
                  {portfolio.outdatedCount === 0
                    ? "All builds on latest dataset"
                    : `${portfolio.outdatedCount} build(s) ready for dataset refresh`}
                </div>
              </GlassPanel>
            </div>

            {/* Quick Save Build Bar */}
            <GlassPanel variant="solid" className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-primary">
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>Save Reference Build to Account</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-mono uppercase text-text-muted mb-1">
                    Build Label
                  </label>
                  <input
                    type="text"
                    value={newBuildName}
                    onChange={(e) => setNewBuildName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-control bg-canvas border border-white/10 text-xs sm:text-sm text-text-strong"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-mono uppercase text-text-muted mb-1">
                    Target Workload
                  </label>
                  <select
                    value={newWorkloadSlug}
                    onChange={(e) => setNewWorkloadSlug(e.target.value)}
                    aria-label="Target Workload"
                    className="w-full px-3.5 py-2 rounded-control bg-canvas border border-white/10 text-xs sm:text-sm text-text-strong"
                  >
                    {workloads.map((w) => (
                      <option key={w.slug} value={w.slug}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleQuickSaveBuild()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-control bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 text-xs sm:text-sm font-semibold text-text-strong"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Layers className="h-4 w-4" />
                        <span>Save & Analyze</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </GlassPanel>

            {/* Saved Builds List */}
            {savedBuilds.length === 0 ? (
              <EmptyState
                title="No Saved Builds Yet"
                description="Save a build above or analyze a custom configuration to track its score across dataset releases."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {savedBuilds.map((b) => {
                  const refresh = evaluateSavedBuildRefreshStatus(
                    b,
                    datasetMeta?.dataset_version
                  );
                  return (
                    <GlassPanel
                      key={b.build_id}
                      variant="solid"
                      className="p-6 flex flex-col justify-between space-y-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-mono text-brand-primary">
                              BUILD #{b.build_id} • {b.workload_name}
                            </div>
                            <h3 className="text-lg font-bold text-text-strong mt-0.5">
                              {b.name}
                            </h3>
                          </div>
                          {b.latest_performance_tier && (
                            <StatusBadge
                              label={`${b.latest_performance_score?.toFixed(1)} • ${b.latest_performance_tier}`}
                              tone="positive"
                            />
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span>
                            Balance:{" "}
                            <strong className="text-text-strong">
                              {b.latest_balance_status ?? "N/A"}
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            {refresh.needsDatasetRefresh ? (
                              <RefreshCw className="h-3 w-3 text-brand-amber" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 text-brand-cyan" />
                            )}
                            {refresh.statusLabel}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <span className="text-[11px] text-text-muted font-mono">
                          Saved {new Date(b.created_at).toLocaleDateString()}
                        </span>
                        {b.latest_share_uuid && (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/result/${b.latest_share_uuid}`)
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-cyan hover:underline"
                          >
                            <span>Open Full Report</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </GlassPanel>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
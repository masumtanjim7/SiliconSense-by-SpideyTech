import { describe, expect, it } from "vitest";
import type { SavedBuildSummaryResponse } from "@packages/contracts";
import {
  evaluateSavedBuildRefreshStatus,
  summarizeSavedBuildsPortfolio,
} from "@/components/account/account-helpers";

const MOCK_SAVED_BUILDS: SavedBuildSummaryResponse[] = [
  {
    build_id: 1,
    name: "Primary Gaming Rig",
    workload_slug: "gaming",
    workload_name: "Gaming",
    latest_analysis_id: 10,
    latest_share_uuid: "uuid-10",
    latest_performance_score: 84.0,
    latest_performance_tier: "Strong",
    latest_balance_status: "Balanced",
    dataset_version: "ds-2026-09-r1",
    created_at: "2026-09-28T10:00:00Z",
  },
  {
    build_id: 2,
    name: "Older Workstation",
    workload_slug: "video-3d",
    workload_name: "Video / 3D",
    latest_analysis_id: 11,
    latest_share_uuid: "uuid-11",
    latest_performance_score: 72.0,
    latest_performance_tier: "Strong",
    latest_balance_status: "Mild bottleneck",
    dataset_version: "ds-2026-08-r1",
    created_at: "2026-08-15T10:00:00Z",
  },
];

describe("Account Saved Builds Helpers", () => {
  it("detects when a saved build dataset version is up-to-date vs outdated", () => {
    const fresh = evaluateSavedBuildRefreshStatus(
      MOCK_SAVED_BUILDS[0],
      "ds-2026-09-r1"
    );
    expect(fresh.needsDatasetRefresh).toBe(false);

    const stale = evaluateSavedBuildRefreshStatus(
      MOCK_SAVED_BUILDS[1],
      "ds-2026-09-r1"
    );
    expect(stale.needsDatasetRefresh).toBe(true);
    expect(stale.statusLabel).toContain("Dataset outdated");
  });

  it("computes portfolio count, outdated count, and mean score accurately", () => {
    const summary = summarizeSavedBuildsPortfolio(
      MOCK_SAVED_BUILDS,
      "ds-2026-09-r1"
    );
    expect(summary.totalBuilds).toBe(2);
    expect(summary.outdatedCount).toBe(1);
    expect(summary.averageScore).toBe(78.0);
  });
});
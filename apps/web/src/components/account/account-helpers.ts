import type { SavedBuildSummaryResponse } from "@packages/contracts";

export interface SavedBuildRefreshStatus {
  needsDatasetRefresh: boolean;
  statusLabel: string;
}

export function evaluateSavedBuildRefreshStatus(
  build: SavedBuildSummaryResponse,
  currentActiveDatasetVersion?: string | null
): SavedBuildRefreshStatus {
  if (!build.dataset_version) {
    return {
      needsDatasetRefresh: true,
      statusLabel: "No analysis recorded yet",
    };
  }

  if (
    currentActiveDatasetVersion &&
    build.dataset_version.trim() !== currentActiveDatasetVersion.trim()
  ) {
    return {
      needsDatasetRefresh: true,
      statusLabel: `Dataset outdated (${build.dataset_version} → ${currentActiveDatasetVersion})`,
    };
  }

  return {
    needsDatasetRefresh: false,
    statusLabel: `Up to date (${build.dataset_version})`,
  };
}

export function summarizeSavedBuildsPortfolio(
  builds: SavedBuildSummaryResponse[],
  currentActiveDatasetVersion?: string | null
): {
  totalBuilds: number;
  outdatedCount: number;
  averageScore: number | null;
} {
  if (builds.length === 0) {
    return { totalBuilds: 0, outdatedCount: 0, averageScore: null };
  }

  let outdatedCount = 0;
  const validScores: number[] = [];

  for (const b of builds) {
    const refresh = evaluateSavedBuildRefreshStatus(
      b,
      currentActiveDatasetVersion
    );
    if (refresh.needsDatasetRefresh) outdatedCount += 1;
    if (
      typeof b.latest_performance_score === "number" &&
      !Number.isNaN(b.latest_performance_score)
    ) {
      validScores.push(b.latest_performance_score);
    }
  }

  const averageScore =
    validScores.length > 0
      ? Number(
          (
            validScores.reduce((acc, val) => acc + val, 0) / validScores.length
          ).toFixed(1)
        )
      : null;

  return {
    totalBuilds: builds.length,
    outdatedCount,
    averageScore,
  };
}
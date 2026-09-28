import type {
  AnalysisResultResponse,
  AnalyzeBuildRequest,
  CompareBuildsRequest,
  CompareBuildsResponse,
  ComponentDetailResponse,
  DatasetVersionMetaResponse,
  PaginatedComponentSearchResponse,
  SavedBuildSummaryResponse,
  WorkloadProfileSchema,
} from "@packages/contracts";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detailMessage = `API error (${response.status})`;
    try {
      const errBody = (await response.json()) as { detail?: string; message?: string };
      if (errBody.detail) detailMessage = errBody.detail;
      else if (errBody.message) detailMessage = errBody.message;
    } catch {
      // fallback to status code message
    }
    throw new Error(detailMessage);
  }
  return (await response.json()) as T;
}

export async function fetchWorkloads(): Promise<WorkloadProfileSchema[]> {
  const res = await fetch(`${API_BASE_URL}/v1/workloads`, {
    cache: "no-store",
  });
  return parseJsonOrThrow<WorkloadProfileSchema[]>(res);
}

export async function fetchDatasetVersionMeta(): Promise<DatasetVersionMetaResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/meta/dataset-version`, {
    cache: "no-store",
  });
  return parseJsonOrThrow<DatasetVersionMetaResponse>(res);
}

export async function searchComponents(params?: {
  q?: string;
  component_type?: string;
  brand?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedComponentSearchResponse> {
  const url = new URL(`${API_BASE_URL}/v1/components/search`);
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.component_type) {
    url.searchParams.set("component_type", params.component_type);
  }
  if (params?.brand) url.searchParams.set("brand", params.brand);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.page_size) {
    url.searchParams.set("page_size", String(params.page_size));
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  return parseJsonOrThrow<PaginatedComponentSearchResponse>(res);
}

export async function fetchComponentDetail(
  componentId: number,
  datasetVersion?: string
): Promise<ComponentDetailResponse> {
  const url = new URL(`${API_BASE_URL}/v1/components/${componentId}`);
  if (datasetVersion) url.searchParams.set("dataset_version", datasetVersion);
  const res = await fetch(url.toString(), { cache: "no-store" });
  return parseJsonOrThrow<ComponentDetailResponse>(res);
}

export async function submitBuildAnalysis(
  payload: AnalyzeBuildRequest
): Promise<AnalysisResultResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/builds/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<AnalysisResultResponse>(res);
}

export async function fetchAnalysisResult(
  identifier: string
): Promise<AnalysisResultResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/analysis/${identifier}`, {
    cache: "no-store",
  });
  return parseJsonOrThrow<AnalysisResultResponse>(res);
}

export async function submitBuildComparison(
  payload: CompareBuildsRequest
): Promise<CompareBuildsResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/builds/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<CompareBuildsResponse>(res);
}

export async function fetchSavedBuilds(
  bearerToken: string
): Promise<SavedBuildSummaryResponse[]> {
  const res = await fetch(`${API_BASE_URL}/v1/builds`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    cache: "no-store",
  });
  return parseJsonOrThrow<SavedBuildSummaryResponse[]>(res);
}

export async function saveAuthenticatedBuild(
  payload: AnalyzeBuildRequest,
  bearerToken: string
): Promise<AnalysisResultResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/builds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<AnalysisResultResponse>(res);
}
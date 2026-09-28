/**
 * SiliconSense by SpideyTech — Shared API Contracts
 * Matches FastAPI Pydantic models in apps/api/app/api/schemas.py
 */
export type PerformanceTier = "Weak" | "Basic" | "Mid-range" | "Strong" | "High-end";

export type BalanceStatus =
  | "Balanced"
  | "Mild bottleneck"
  | "Moderate bottleneck"
  | "Major bottleneck";

export type ConfidenceLevel = "High" | "Medium" | "Limited";

export type HardwareSlotType = "CPU" | "GPU" | "RAM" | "STORAGE";

export interface HealthResponse {
  status: "healthy" | "degraded";
  service: string;
  version: string;
  environment: string;
  database: "connected" | "unreachable";
}

export interface ComponentSpecSummary {
  core_count?: number | null;
  thread_count?: number | null;
  vram_gb?: number | null;
  ram_capacity_gb?: number | null;
  memory_speed?: string | null;
  storage_type?: string | null;
  specs_json?: Record<string, unknown>;
}

export interface ComponentSummaryItem {
  id: number;
  component_type: HardwareSlotType | string;
  brand: string;
  model_name: string;
  generation?: string | null;
  release_date?: string | null;
  is_verified: boolean;
  specification?: ComponentSpecSummary | null;
}

export interface PaginatedComponentSearchResponse {
  items: ComponentSummaryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ComponentNormalizedMetricItem {
  metric_key: string;
  display_name: string;
  unit: string;
  raw_aggregated_score: number;
  normalized_score_0_100: number;
  percentile: number;
  sample_count: number;
  confidence_contribution: number;
  dataset_version: string;
}

export interface ComponentDetailResponse extends ComponentSummaryItem {
  aliases: string[];
  normalized_metrics: ComponentNormalizedMetricItem[];
}

export interface WorkloadWeightSchema {
  metric_key: string;
  display_name: string;
  subsystem: string;
  weight: number;
  minimum_adequacy_score?: number | null;
}

export interface WorkloadProfileSchema {
  id: number;
  slug: string;
  name: string;
  description: string;
  version: string;
  weights: WorkloadWeightSchema[];
}

export interface DatasetVersionMetaResponse {
  dataset_version: string;
  normalization_version: string;
  scoring_version: string;
  approved_sources: string[];
  last_retrieved_at?: string | null;
}

export interface BuildComponentsSelection {
  CPU: number;
  GPU: number;
  RAM: number;
  STORAGE: number;
}

export interface AnalyzeBuildRequest {
  build_name: string;
  workload_slug: string;
  components: BuildComponentsSelection;
  dataset_version?: string | null;
}

export interface MetricContributionSchema {
  metric_key: string;
  display_name: string;
  subsystem: string;
  component_id: number | null;
  normalized_score_0_100: number | null;
  weight_applied: number;
  weighted_contribution: number;
  is_missing_metric: boolean;
}

export interface BottleneckSchema {
  limiting_component_type: string;
  strongest_component_type: string;
  spread_points: number;
  severity_status: string;
  explanation: string;
}

export interface UpgradeRecommendationSchema {
  priority_order: number;
  component_type: string;
  affected_metric_key: string;
  reason: string;
  target_score_min: number;
  target_score_max: number;
}

export interface VersionMetadataSchema {
  dataset_version: string;
  normalization_version: string;
  scoring_version: string;
  workload_profile_version: string;
}

export interface AnalysisResultResponse {
  analysis_id: number;
  share_uuid: string;
  build_name: string;
  workload_slug: string;
  workload_name: string;
  selected_components: Record<string, ComponentSummaryItem>;
  performance_score_0_100: number;
  performance_tier: PerformanceTier | string;
  balance_score_0_100: number;
  balance_status: BalanceStatus | string;
  confidence_score_0_100: number;
  confidence_level: ConfidenceLevel | string;
  coverage_ratio: number;
  contributions: MetricContributionSchema[];
  bottlenecks: BottleneckSchema[];
  recommendations: UpgradeRecommendationSchema[];
  warnings: string[];
  version_metadata: VersionMetadataSchema;
  analyzed_at: string;
}

export interface CompareBuildsRequest {
  workload_slug: string;
  build_a_name: string;
  build_a_components: BuildComponentsSelection;
  build_b_name: string;
  build_b_components: BuildComponentsSelection;
  dataset_version?: string | null;
}

export interface MetricComparisonDeltaSchema {
  metric_key: string;
  display_name: string;
  subsystem: string;
  weight: number;
  build_a_score: number | null;
  build_b_score: number | null;
  delta_a_minus_b: number | null;
  advantage_summary: string;
}

export interface CompareBuildsResponse {
  workload_slug: string;
  workload_name: string;
  dataset_version: string;
  is_directly_comparable: boolean;
  build_a: AnalysisResultResponse;
  build_b: AnalysisResultResponse;
  performance_score_delta: number;
  balance_score_delta: number;
  metric_deltas: MetricComparisonDeltaSchema[];
  where_a_is_stronger: string[];
  where_b_is_stronger: string[];
  contextual_summary: string;
}

export interface SavedBuildSummaryResponse {
  build_id: number;
  name: string;
  workload_slug: string;
  workload_name: string;
  latest_analysis_id?: number | null;
  latest_share_uuid?: string | null;
  latest_performance_score?: number | null;
  latest_performance_tier?: string | null;
  latest_balance_status?: string | null;
  dataset_version?: string | null;
  created_at: string;
}
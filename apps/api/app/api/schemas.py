from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ErrorEnvelope(BaseModel):
    error_code: str = Field(..., examples=["VALIDATION_ERROR"])
    message: str = Field(..., examples=["Component slot mismatch or missing resource."])
    request_id: str | None = Field(default=None, examples=["fake-req-uuid-0001"])


class ComponentSpecSummary(BaseModel):
    core_count: int | None = None
    thread_count: int | None = None
    vram_gb: int | None = None
    ram_capacity_gb: int | None = None
    memory_speed: str | None = None
    storage_type: str | None = None
    specs_json: dict[str, Any] = Field(default_factory=dict)


class ComponentSummaryItem(BaseModel):
    id: int = Field(..., examples=[101])
    component_type: str = Field(..., examples=["GPU"])
    brand: str = Field(..., examples=["NVIDIA"])
    model_name: str = Field(..., examples=["Fake Example GPU 9000"])
    generation: str | None = Field(default=None, examples=["ExampleArch"])
    release_date: date | None = None
    is_verified: bool = True
    specification: ComponentSpecSummary | None = None


class PaginatedComponentSearchResponse(BaseModel):
    items: list[ComponentSummaryItem]
    total: int = Field(..., examples=[12])
    page: int = Field(..., examples=[1])
    page_size: int = Field(..., examples=[20])


class ComponentNormalizedMetricItem(BaseModel):
    metric_key: str = Field(..., examples=["gpu_render_compute"])
    display_name: str = Field(..., examples=["GPU Render & Compute Throughput"])
    unit: str = Field(..., examples=["samples_per_min"])
    raw_aggregated_score: float = Field(..., examples=[5000.0])
    normalized_score_0_100: float = Field(..., examples=[75.0])
    percentile: float = Field(..., examples=[75.0])
    sample_count: int = Field(..., examples=[30])
    confidence_contribution: float = Field(..., examples=[0.92])
    dataset_version: str = Field(..., examples=["ds-2026-09-r1"])


class ComponentDetailResponse(ComponentSummaryItem):
    aliases: list[str] = Field(default_factory=list)
    normalized_metrics: list[ComponentNormalizedMetricItem] = Field(default_factory=list)


class WorkloadWeightSchema(BaseModel):
    metric_key: str = Field(..., examples=["gpu_render_compute"])
    display_name: str = Field(..., examples=["GPU Render & Compute Throughput"])
    subsystem: str = Field(..., examples=["GPU"])
    weight: float = Field(..., examples=[0.50])
    minimum_adequacy_score: float | None = Field(default=None, examples=[50.0])


class WorkloadProfileSchema(BaseModel):
    id: int = Field(..., examples=[1])
    slug: str = Field(..., examples=["gaming"])
    name: str = Field(..., examples=["Gaming"])
    description: str
    version: str = Field(..., examples=["1.0.0"])
    weights: list[WorkloadWeightSchema]


class DatasetVersionMetaResponse(BaseModel):
    dataset_version: str = Field(..., examples=["ds-2026-09-r1"])
    normalization_version: str = Field(..., examples=["norm-v1.0"])
    scoring_version: str = Field(..., examples=["score-v1.0"])
    approved_sources: list[str] = Field(default_factory=list)
    last_retrieved_at: datetime | None = None


class BuildComponentsSelection(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "CPU": 1,
                "GPU": 6,
                "RAM": 9,
                "STORAGE": 11,
            }
        }
    )

    CPU: int = Field(..., gt=0, description="Canonical component ID for CPU")
    GPU: int = Field(..., gt=0, description="Canonical component ID for GPU")
    RAM: int = Field(..., gt=0, description="Canonical component ID for RAM")
    STORAGE: int = Field(..., gt=0, description="Canonical component ID for STORAGE")

    def to_slot_dict(self) -> dict[str, int]:
        return {
            "CPU": self.CPU,
            "GPU": self.GPU,
            "RAM": self.RAM,
            "STORAGE": self.STORAGE,
        }


class AnalyzeBuildRequest(BaseModel):
    build_name: str = Field(default="Custom Lab Rig", min_length=1, max_length=160)
    workload_slug: str = Field(..., examples=["gaming"])
    components: BuildComponentsSelection
    dataset_version: str | None = Field(default=None, examples=["ds-2026-09-r1"])


class MetricContributionSchema(BaseModel):
    metric_key: str
    display_name: str
    subsystem: str
    component_id: int | None
    normalized_score_0_100: float | None
    weight_applied: float
    weighted_contribution: float
    is_missing_metric: bool


class BottleneckSchema(BaseModel):
    limiting_component_type: str
    strongest_component_type: str
    spread_points: float
    severity_status: str
    explanation: str


class UpgradeRecommendationSchema(BaseModel):
    priority_order: int
    component_type: str
    affected_metric_key: str
    reason: str
    target_score_min: float
    target_score_max: float


class VersionMetadataSchema(BaseModel):
    dataset_version: str
    normalization_version: str
    scoring_version: str
    workload_profile_version: str


class AnalysisResultResponse(BaseModel):
    analysis_id: int
    share_uuid: str
    build_name: str
    workload_slug: str
    workload_name: str
    selected_components: dict[str, ComponentSummaryItem]
    performance_score_0_100: float
    performance_tier: str
    balance_score_0_100: float
    balance_status: str
    confidence_score_0_100: float
    confidence_level: str
    coverage_ratio: float
    contributions: list[MetricContributionSchema]
    bottlenecks: list[BottleneckSchema]
    recommendations: list[UpgradeRecommendationSchema]
    warnings: list[str]
    version_metadata: VersionMetadataSchema
    analyzed_at: datetime


class CompareBuildsRequest(BaseModel):
    workload_slug: str = Field(..., examples=["gaming"])
    build_a_name: str = Field(default="Build A", max_length=160)
    build_a_components: BuildComponentsSelection
    build_b_name: str = Field(default="Build B", max_length=160)
    build_b_components: BuildComponentsSelection
    dataset_version: str | None = Field(default=None, examples=["ds-2026-09-r1"])


class MetricComparisonDeltaSchema(BaseModel):
    metric_key: str
    display_name: str
    subsystem: str
    weight: float
    build_a_score: float | None
    build_b_score: float | None
    delta_a_minus_b: float | None
    advantage_summary: str


class CompareBuildsResponse(BaseModel):
    workload_slug: str
    workload_name: str
    dataset_version: str
    is_directly_comparable: bool
    build_a: AnalysisResultResponse
    build_b: AnalysisResultResponse
    performance_score_delta: float
    balance_score_delta: float
    metric_deltas: list[MetricComparisonDeltaSchema]
    where_a_is_stronger: list[str]
    where_b_is_stronger: list[str]
    contextual_summary: str


class SavedBuildSummaryResponse(BaseModel):
    build_id: int
    name: str
    workload_slug: str
    workload_name: str
    latest_analysis_id: int | None = None
    latest_share_uuid: str | None = None
    latest_performance_score: float | None = None
    latest_performance_tier: str | None = None
    latest_balance_status: str | None = None
    dataset_version: str | None = None
    created_at: datetime


class RecomputeDatasetRequest(BaseModel):
    dataset_version: str = Field(..., examples=["ds-2026-09-r1"])
    normalization_version_code: str = Field(default="norm-v1.0", examples=["norm-v1.0"])


class RecomputeDatasetResponse(BaseModel):
    status: str
    dataset_version: str
    normalization_version_code: str
    metrics_processed: int
    normalized_rows_upserted: int
    triggered_by_subject: str

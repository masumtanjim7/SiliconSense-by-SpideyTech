from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserProfile(Base):
    __tablename__ = "user_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    auth_subject: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="user")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class HardwareComponent(Base):
    __tablename__ = "hardware_component"
    __table_args__ = (
        UniqueConstraint(
            "component_type", "brand", "model_name", name="uq_hardware_component_identity"
        ),
        CheckConstraint(
            "component_type IN ('CPU', 'GPU', 'RAM', 'STORAGE')",
            name="valid_component_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    component_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    brand: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    generation: Mapped[str | None] = mapped_column(String(64), nullable=True)
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    specification: Mapped["ComponentSpecification | None"] = relationship(
        back_populates="component", uselist=False, cascade="all, delete-orphan"
    )
    aliases: Mapped[list["ComponentAlias"]] = relationship(
        back_populates="component", cascade="all, delete-orphan"
    )


class ComponentSpecification(Base):
    __tablename__ = "component_specification"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    component_id: Mapped[int] = mapped_column(
        ForeignKey("hardware_component.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    core_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    thread_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vram_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ram_capacity_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_speed: Mapped[str | None] = mapped_column(String(64), nullable=True)
    storage_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    specs_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    component: Mapped["HardwareComponent"] = relationship(back_populates="specification")


class ComponentAlias(Base):
    __tablename__ = "component_alias"
    __table_args__ = (
        UniqueConstraint("component_type", "alias_name", name="uq_component_alias_type_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    component_id: Mapped[int] = mapped_column(
        ForeignKey("hardware_component.id", ondelete="CASCADE"), nullable=False, index=True
    )
    component_type: Mapped[str] = mapped_column(String(32), nullable=False)
    alias_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    component: Mapped["HardwareComponent"] = relationship(back_populates="aliases")


class BenchmarkSource(Base):
    __tablename__ = "benchmark_source"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    source_name: Mapped[str] = mapped_column(String(128), nullable=False)
    benchmark_version: Mapped[str] = mapped_column(String(64), nullable=False)
    source_url: Mapped[str] = mapped_column(String(512), nullable=False)
    license_spdx: Mapped[str] = mapped_column(String(64), nullable=False)
    license_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BenchmarkMetricDefinition(Base):
    __tablename__ = "benchmark_metric_definition"
    __table_args__ = (
        CheckConstraint(
            "direction IN ('higher_is_better', 'lower_is_better')",
            name="valid_metric_direction",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    metric_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    subsystem: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    unit: Mapped[str] = mapped_column(String(64), nullable=False)
    direction: Mapped[str] = mapped_column(String(32), nullable=False, default="higher_is_better")
    min_sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class RawDatasetSnapshot(Base):
    __tablename__ = "raw_dataset_snapshot"
    __table_args__ = (
        UniqueConstraint("source_id", "dataset_version", name="uq_source_dataset_version"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_source.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    dataset_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_uri: Mapped[str] = mapped_column(String(512), nullable=False)
    manifest_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class IngestionRun(Base):
    __tablename__ = "ingestion_run"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("raw_dataset_snapshot.id", ondelete="CASCADE"), nullable=False, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")
    rows_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_quarantined: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BenchmarkObservation(Base):
    __tablename__ = "benchmark_observation"
    __table_args__ = (
        CheckConstraint("raw_score > 0", name="positive_raw_score"),
        CheckConstraint("sample_count >= 1", name="positive_sample_count"),
        Index("ix_observation_component_metric", "component_id", "metric_definition_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("raw_dataset_snapshot.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    source_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_source.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    component_id: Mapped[int | None] = mapped_column(
        ForeignKey("hardware_component.id", ondelete="SET NULL"), nullable=True, index=True
    )
    metric_definition_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_metric_definition.id", ondelete="RESTRICT"), nullable=False
    )
    reported_device_name: Mapped[str] = mapped_column(String(255), nullable=False)
    benchmark_version: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_score: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    environment_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_quarantined: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NormalizationVersion(Base):
    __tablename__ = "normalization_version"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    method: Mapped[str] = mapped_column(String(64), nullable=False, default="percentile_rank")
    formula_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NormalizedMetric(Base):
    __tablename__ = "normalized_metric"
    __table_args__ = (
        UniqueConstraint(
            "component_id",
            "metric_definition_id",
            "normalization_version_id",
            "dataset_version",
            name="uq_normalized_metric_versioned",
        ),
        CheckConstraint(
            "normalized_score_0_100 >= 0.0 AND normalized_score_0_100 <= 100.0",
            name="normalized_score_bounds",
        ),
        CheckConstraint(
            "percentile >= 0.0 AND percentile <= 100.0",
            name="percentile_bounds",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    component_id: Mapped[int] = mapped_column(
        ForeignKey("hardware_component.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric_definition_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_metric_definition.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    normalization_version_id: Mapped[int] = mapped_column(
        ForeignKey("normalization_version.id", ondelete="RESTRICT"), nullable=False
    )
    dataset_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    raw_aggregated_score: Mapped[float] = mapped_column(Float, nullable=False)
    normalized_score_0_100: Mapped[float] = mapped_column(Float, nullable=False)
    percentile: Mapped[float] = mapped_column(Float, nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    confidence_contribution: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WorkloadProfile(Base):
    __tablename__ = "workload_profile"
    __table_args__ = (UniqueConstraint("slug", "version", name="uq_workload_profile_slug_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0.0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    weights: Mapped[list["WorkloadWeight"]] = relationship(
        back_populates="workload_profile", cascade="all, delete-orphan"
    )


class WorkloadWeight(Base):
    __tablename__ = "workload_weight"
    __table_args__ = (
        UniqueConstraint(
            "workload_profile_id", "metric_definition_id", name="uq_workload_metric_weight"
        ),
        CheckConstraint("weight > 0.0 AND weight <= 1.0", name="valid_weight_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workload_profile_id: Mapped[int] = mapped_column(
        ForeignKey("workload_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric_definition_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_metric_definition.id", ondelete="RESTRICT"), nullable=False
    )
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    minimum_adequacy_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    workload_profile: Mapped["WorkloadProfile"] = relationship(back_populates="weights")
    metric_definition: Mapped["BenchmarkMetricDefinition"] = relationship()


class ScoringVersion(Base):
    __tablename__ = "scoring_version"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    tier_thresholds_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    balance_thresholds_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PCBuild(Base):
    __tablename__ = "pc_build"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_profile.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False, default="Custom Rig")
    workload_profile_id: Mapped[int] = mapped_column(
        ForeignKey("workload_profile.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    components: Mapped[list["PCBuildComponent"]] = relationship(
        back_populates="pc_build", cascade="all, delete-orphan"
    )


class PCBuildComponent(Base):
    __tablename__ = "pc_build_component"
    __table_args__ = (
        CheckConstraint(
            "slot_type IN ('CPU', 'GPU', 'RAM', 'STORAGE')", name="valid_build_slot_type"
        ),
        CheckConstraint("quantity >= 1", name="positive_build_component_quantity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pc_build_id: Mapped[int] = mapped_column(
        ForeignKey("pc_build.id", ondelete="CASCADE"), nullable=False, index=True
    )
    component_id: Mapped[int] = mapped_column(
        ForeignKey("hardware_component.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    slot_type: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    pc_build: Mapped["PCBuild"] = relationship(back_populates="components")
    component: Mapped["HardwareComponent"] = relationship()


class AnalysisResult(Base):
    __tablename__ = "analysis_result"
    __table_args__ = (
        CheckConstraint(
            "performance_score_0_100 >= 0.0 AND performance_score_0_100 <= 100.0",
            name="analysis_perf_score_bounds",
        ),
        CheckConstraint(
            "balance_score_0_100 >= 0.0 AND balance_score_0_100 <= 100.0",
            name="analysis_balance_score_bounds",
        ),
        CheckConstraint(
            "confidence_score_0_100 >= 0.0 AND confidence_score_0_100 <= 100.0",
            name="analysis_confidence_score_bounds",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    share_uuid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    pc_build_id: Mapped[int] = mapped_column(
        ForeignKey("pc_build.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workload_profile_id: Mapped[int] = mapped_column(
        ForeignKey("workload_profile.id", ondelete="RESTRICT"), nullable=False
    )
    scoring_version_id: Mapped[int] = mapped_column(
        ForeignKey("scoring_version.id", ondelete="RESTRICT"), nullable=False
    )
    normalization_version_id: Mapped[int] = mapped_column(
        ForeignKey("normalization_version.id", ondelete="RESTRICT"), nullable=False
    )
    dataset_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    performance_score_0_100: Mapped[float] = mapped_column(Float, nullable=False)
    performance_tier: Mapped[str] = mapped_column(String(32), nullable=False)
    balance_score_0_100: Mapped[float] = mapped_column(Float, nullable=False)
    balance_status: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence_score_0_100: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_level: Mapped[str] = mapped_column(String(32), nullable=False)
    warnings_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    analyzed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    contributions: Mapped[list["AnalysisMetricContribution"]] = relationship(
        back_populates="analysis_result", cascade="all, delete-orphan"
    )
    bottlenecks: Mapped[list["BottleneckResult"]] = relationship(
        back_populates="analysis_result", cascade="all, delete-orphan"
    )
    recommendations: Mapped[list["UpgradeRecommendation"]] = relationship(
        back_populates="analysis_result", cascade="all, delete-orphan"
    )


class AnalysisMetricContribution(Base):
    __tablename__ = "analysis_metric_contribution"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_result_id: Mapped[int] = mapped_column(
        ForeignKey("analysis_result.id", ondelete="CASCADE"), nullable=False, index=True
    )
    component_id: Mapped[int | None] = mapped_column(
        ForeignKey("hardware_component.id", ondelete="SET NULL"), nullable=True
    )
    metric_definition_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_metric_definition.id", ondelete="RESTRICT"), nullable=False
    )
    normalized_score_0_100: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_applied: Mapped[float] = mapped_column(Float, nullable=False)
    weighted_contribution: Mapped[float] = mapped_column(Float, nullable=False)
    is_missing_metric: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    analysis_result: Mapped["AnalysisResult"] = relationship(back_populates="contributions")


class BottleneckResult(Base):
    __tablename__ = "bottleneck_result"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_result_id: Mapped[int] = mapped_column(
        ForeignKey("analysis_result.id", ondelete="CASCADE"), nullable=False, index=True
    )
    limiting_component_type: Mapped[str] = mapped_column(String(32), nullable=False)
    strongest_component_type: Mapped[str] = mapped_column(String(32), nullable=False)
    spread_points: Mapped[float] = mapped_column(Float, nullable=False)
    severity_status: Mapped[str] = mapped_column(String(64), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)

    analysis_result: Mapped["AnalysisResult"] = relationship(back_populates="bottlenecks")


class UpgradeRecommendation(Base):
    __tablename__ = "upgrade_recommendation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_result_id: Mapped[int] = mapped_column(
        ForeignKey("analysis_result.id", ondelete="CASCADE"), nullable=False, index=True
    )
    priority_order: Mapped[int] = mapped_column(Integer, nullable=False)
    component_type: Mapped[str] = mapped_column(String(32), nullable=False)
    affected_metric_key: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    target_score_min: Mapped[float] = mapped_column(Float, nullable=False)
    target_score_max: Mapped[float] = mapped_column(Float, nullable=False)

    analysis_result: Mapped["AnalysisResult"] = relationship(back_populates="recommendations")


class SavedComparison(Base):
    __tablename__ = "saved_comparison"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    build_a_id: Mapped[int] = mapped_column(
        ForeignKey("pc_build.id", ondelete="CASCADE"), nullable=False
    )
    build_b_id: Mapped[int] = mapped_column(
        ForeignKey("pc_build.id", ondelete="CASCADE"), nullable=False
    )
    workload_profile_id: Mapped[int] = mapped_column(
        ForeignKey("workload_profile.id", ondelete="RESTRICT"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuditEvent(Base):
    __tablename__ = "audit_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_subject: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

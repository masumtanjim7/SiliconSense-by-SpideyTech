from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.schemas import (
    ComponentDetailResponse,
    ComponentNormalizedMetricItem,
    ComponentSpecSummary,
    ComponentSummaryItem,
    DatasetVersionMetaResponse,
    PaginatedComponentSearchResponse,
    WorkloadProfileSchema,
    WorkloadWeightSchema,
)
from app.db.models import (
    BenchmarkSource,
    HardwareComponent,
    NormalizationVersion,
    NormalizedMetric,
    RawDatasetSnapshot,
    ScoringVersion,
    WorkloadProfile,
)


def serialize_component_summary(comp: HardwareComponent) -> ComponentSummaryItem:
    spec = comp.specification
    spec_summary = (
        ComponentSpecSummary(
            core_count=spec.core_count,
            thread_count=spec.thread_count,
            vram_gb=spec.vram_gb,
            ram_capacity_gb=spec.ram_capacity_gb,
            memory_speed=spec.memory_speed,
            storage_type=spec.storage_type,
            specs_json=spec.specs_json or {},
        )
        if spec is not None
        else None
    )
    return ComponentSummaryItem(
        id=comp.id,
        component_type=comp.component_type,
        brand=comp.brand,
        model_name=comp.model_name,
        generation=comp.generation,
        release_date=comp.release_date,
        is_verified=comp.is_verified,
        specification=spec_summary,
    )


def search_hardware_components(
    db: Session,
    *,
    q: str | None = None,
    component_type: str | None = None,
    brand: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedComponentSearchResponse:
    stmt = select(HardwareComponent)

    if component_type:
        stmt = stmt.where(HardwareComponent.component_type == component_type.upper())
    if brand:
        stmt = stmt.where(func.lower(HardwareComponent.brand) == brand.strip().lower())
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                HardwareComponent.model_name.ilike(pattern),
                HardwareComponent.brand.ilike(pattern),
                HardwareComponent.generation.ilike(pattern),
            )
        )

    total_count = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    offset = (page - 1) * page_size
    rows = db.scalars(
        stmt.order_by(
            HardwareComponent.component_type, HardwareComponent.brand, HardwareComponent.id
        )
        .offset(offset)
        .limit(page_size)
    ).all()

    return PaginatedComponentSearchResponse(
        items=[serialize_component_summary(c) for c in rows],
        total=int(total_count),
        page=page,
        page_size=page_size,
    )


def get_Active_dataset_version_string(db: Session) -> str:
    latest_snapshot = db.scalar(
        select(RawDatasetSnapshot)
        .where(RawDatasetSnapshot.is_published.is_(True))
        .order_by(RawDatasetSnapshot.retrieved_at.desc(), RawDatasetSnapshot.id.desc())
    )
    if latest_snapshot is not None:
        return latest_snapshot.dataset_version
    return "ds-2026-09-r1"


def get_hardware_component_detail(
    db: Session, component_id: int, *, dataset_version: str | None = None
) -> ComponentDetailResponse | None:
    comp = db.get(HardwareComponent, component_id)
    if comp is None:
        return None

    target_ds = dataset_version or get_Active_dataset_version_string(db)
    summary = serialize_component_summary(comp)

    norm_rows = db.scalars(
        select(NormalizedMetric).where(
            NormalizedMetric.component_id == comp.id,
            NormalizedMetric.dataset_version == target_ds,
        )
    ).all()

    metric_items: list[ComponentNormalizedMetricItem] = []
    for nm in norm_rows:
        m_def = nm.metric_definition_id
        from app.db.models import BenchmarkMetricDefinition

        metric_def = db.get(BenchmarkMetricDefinition, m_def)
        if metric_def is None:
            continue
        metric_items.append(
            ComponentNormalizedMetricItem(
                metric_key=metric_def.metric_key,
                display_name=metric_def.display_name,
                unit=metric_def.unit,
                raw_aggregated_score=nm.raw_aggregated_score,
                normalized_score_0_100=nm.normalized_score_0_100,
                percentile=nm.percentile,
                sample_count=nm.sample_count,
                confidence_contribution=nm.confidence_contribution,
                dataset_version=nm.dataset_version,
            )
        )

    return ComponentDetailResponse(
        **summary.model_dump(),
        aliases=[a.alias_name for a in comp.aliases],
        normalized_metrics=metric_items,
    )


def list_active_workload_profiles(db: Session) -> list[WorkloadProfileSchema]:
    profiles = db.scalars(
        select(WorkloadProfile)
        .where(WorkloadProfile.is_active.is_(True))
        .order_by(WorkloadProfile.id)
    ).all()

    result: list[WorkloadProfileSchema] = []
    for p in profiles:
        weights_out = [
            WorkloadWeightSchema(
                metric_key=w.metric_definition.metric_key,
                display_name=w.metric_definition.display_name,
                subsystem=w.metric_definition.subsystem,
                weight=w.weight,
                minimum_adequacy_score=w.minimum_adequacy_score,
            )
            for w in sorted(p.weights, key=lambda x: x.weight, reverse=True)
        ]
        result.append(
            WorkloadProfileSchema(
                id=p.id,
                slug=p.slug,
                name=p.name,
                description=p.description,
                version=p.version,
                weights=weights_out,
            )
        )
    return result


def get_dataset_version_metadata(db: Session) -> DatasetVersionMetaResponse:
    ds_version = get_Active_dataset_version_string(db)
    norm_ver = db.scalar(
        select(NormalizationVersion).where(NormalizationVersion.is_active.is_(True))
    )
    score_ver = db.scalar(select(ScoringVersion).where(ScoringVersion.is_active.is_(True)))
    sources = db.scalars(select(BenchmarkSource).where(BenchmarkSource.is_approved.is_(True))).all()
    latest_snapshot = db.scalar(
        select(RawDatasetSnapshot)
        .where(RawDatasetSnapshot.dataset_version == ds_version)
        .order_by(RawDatasetSnapshot.retrieved_at.desc())
    )

    return DatasetVersionMetaResponse(
        dataset_version=ds_version,
        normalization_version=norm_ver.version_code if norm_ver else "norm-v1.0",
        scoring_version=score_ver.version_code if score_ver else "score-v1.0",
        approved_sources=[s.source_name for s in sources],
        last_retrieved_at=latest_snapshot.retrieved_at if latest_snapshot else None,
    )

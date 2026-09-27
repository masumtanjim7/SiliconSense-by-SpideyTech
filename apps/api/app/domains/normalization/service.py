from collections import defaultdict
from datetime import UTC, datetime

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    BenchmarkMetricDefinition,
    BenchmarkObservation,
    NormalizationVersion,
    NormalizedMetric,
    RawDatasetSnapshot,
)
from app.domains.normalization.engine import (
    RawComponentObservationInput,
    normalize_metric_population,
)


class NormalizationRunSummary(BaseModel):
    dataset_version: str
    normalization_version_code: str
    metrics_processed: int
    normalized_rows_upserted: int


def recompute_normalized_metrics_for_dataset(
    db: Session,
    dataset_version: str,
    *,
    normalization_version_code: str = "norm-v1.0",
    reference_time: datetime | None = None,
) -> NormalizationRunSummary:
    norm_version = db.scalar(
        select(NormalizationVersion).where(
            NormalizationVersion.version_code == normalization_version_code,
            NormalizationVersion.is_active.is_(True),
        )
    )
    if norm_version is None:
        raise ValueError(f"Active NormalizationVersion '{normalization_version_code}' not found.")

    snapshots = db.scalars(
        select(RawDatasetSnapshot).where(RawDatasetSnapshot.dataset_version == dataset_version)
    ).all()
    if not snapshots:
        raise ValueError(f"No snapshots found for dataset_version '{dataset_version}'.")

    snapshot_ids = [s.id for s in snapshots]

    observations = db.scalars(
        select(BenchmarkObservation).where(
            BenchmarkObservation.snapshot_id.in_(snapshot_ids),
            BenchmarkObservation.is_quarantined.is_(False),
            BenchmarkObservation.component_id.is_not(None),
        )
    ).all()

    grouped_by_metric: dict[int, dict[int, list[BenchmarkObservation]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for obs in observations:
        if obs.component_id is not None:
            grouped_by_metric[obs.metric_definition_id][obs.component_id].append(obs)

    metrics_processed = 0
    rows_upserted = 0
    ref_time = reference_time or datetime.now(UTC)

    for metric_def_id, comp_obs_map in grouped_by_metric.items():
        metric_def = db.get(BenchmarkMetricDefinition, metric_def_id)
        if metric_def is None:
            continue

        metrics_processed += 1
        engine_inputs: list[RawComponentObservationInput] = []

        for comp_id, obs_list in comp_obs_map.items():
            raw_vals = tuple(o.raw_score for o in obs_list)
            total_samples = sum(o.sample_count for o in obs_list)
            tested_dates = [o.tested_at for o in obs_list if o.tested_at is not None]
            latest_tested = max(tested_dates) if tested_dates else None

            engine_inputs.append(
                RawComponentObservationInput(
                    component_id=comp_id,
                    raw_values=raw_vals,
                    total_sample_count=total_samples,
                    latest_tested_at=latest_tested,
                    is_approved_source=True,
                )
            )

        batch_result = normalize_metric_population(
            engine_inputs,
            direction=metric_def.direction,
            min_sample_count=metric_def.min_sample_count,
            reference_time=ref_time,
        )

        for out in batch_result.outputs:
            existing = db.scalar(
                select(NormalizedMetric).where(
                    NormalizedMetric.component_id == out.component_id,
                    NormalizedMetric.metric_definition_id == metric_def.id,
                    NormalizedMetric.normalization_version_id == norm_version.id,
                    NormalizedMetric.dataset_version == dataset_version,
                )
            )
            if existing is None:
                db.add(
                    NormalizedMetric(
                        component_id=out.component_id,
                        metric_definition_id=metric_def.id,
                        normalization_version_id=norm_version.id,
                        dataset_version=dataset_version,
                        raw_aggregated_score=out.raw_aggregated_score,
                        normalized_score_0_100=out.normalized_score_0_100,
                        percentile=out.percentile,
                        sample_count=out.sample_count,
                        confidence_contribution=out.confidence_contribution,
                    )
                )
            else:
                existing.raw_aggregated_score = out.raw_aggregated_score
                existing.normalized_score_0_100 = out.normalized_score_0_100
                existing.percentile = out.percentile
                existing.sample_count = out.sample_count
                existing.confidence_contribution = out.confidence_contribution

            rows_upserted += 1

    db.commit()
    return NormalizationRunSummary(
        dataset_version=dataset_version,
        normalization_version_code=normalization_version_code,
        metrics_processed=metrics_processed,
        normalized_rows_upserted=rows_upserted,
    )

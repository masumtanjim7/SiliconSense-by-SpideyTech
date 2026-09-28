from datetime import UTC, datetime
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import BenchmarkObservation, HardwareComponent, RawDatasetSnapshot, NormalizedMetric


class DataQualityReport(BaseModel):
    dataset_version: str
    total_components_in_catalog: int
    total_observations: int
    quarantined_observations: int
    quarantine_rate_pct: float
    total_normalized_scores: int
    snapshot_age_days: int
    status: str


def generate_data_quality_report(db: Session, dataset_version: str) -> DataQualityReport:
    total_comps = db.scalar(select(func.count(HardwareComponent.id))) or 0
    total_obs = db.scalar(
        select(func.count(BenchmarkObservation.id)).where(BenchmarkObservation.snapshot.has(RawDatasetSnapshot.dataset_version == dataset_version))
    ) or 0
    quarantined_obs = db.scalar(
        select(func.count(BenchmarkObservation.id)).where(
            BenchmarkObservation.snapshot.has(RawDatasetSnapshot.dataset_version == dataset_version),
            BenchmarkObservation.is_quarantined.is_(True),
        )
    ) or 0

    quarantine_rate = round((quarantined_obs / total_obs) * 100.0, 2) if total_obs > 0 else 0.0

    total_norms = db.scalar(
        select(func.count(NormalizedMetric.id)).where(NormalizedMetric.dataset_version == dataset_version)
    ) or 0

    snapshot = db.scalar(
        select(RawDatasetSnapshot).where(RawDatasetSnapshot.dataset_version == dataset_version).order_by(RawDatasetSnapshot.retrieved_at.desc())
    )
    
    age_days = 0
    if snapshot and snapshot.retrieved_at:
        retrieved_utc = snapshot.retrieved_at.replace(tzinfo=UTC) if snapshot.retrieved_at.tzinfo is None else snapshot.retrieved_at.astimezone(UTC)
        age_days = max(0, (datetime.now(UTC) - retrieved_utc).days)

    status = "healthy"
    if quarantine_rate > 25.0 or age_days > 180:
        status = "degraded"

    return DataQualityReport(
        dataset_version=dataset_version,
        total_components_in_catalog=total_comps,
        total_observations=total_obs,
        quarantined_observations=quarantined_obs,
        quarantine_rate_pct=quarantine_rate,
        total_normalized_scores=total_norms,
        snapshot_age_days=age_days,
        status=status,
    )
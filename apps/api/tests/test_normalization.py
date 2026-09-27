from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import HardwareComponent, NormalizedMetric
from app.db.seed import seed_reference_configuration
from app.db.seed_catalog import seed_curated_hardware_catalog
from app.domains.ingestion.blender_adapter import ingest_blender_snapshot_file
from app.domains.normalization.engine import (
    RawComponentObservationInput,
    normalize_metric_population,
)
from app.domains.normalization.service import recompute_normalized_metrics_for_dataset

BLENDER_FIXTURE = (
    Path(__file__).resolve().parents[3] / "data" / "fixtures" / "blender_opendata_snapshot_v1.json"
)


def test_pure_normalization_higher_and_lower_is_better() -> None:
    ref_now = datetime(2026, 9, 27, tzinfo=UTC)
    inputs = [
        RawComponentObservationInput(1, (100.0,), 20, ref_now),
        RawComponentObservationInput(2, (200.0,), 20, ref_now),
        RawComponentObservationInput(3, (300.0,), 20, ref_now),
        RawComponentObservationInput(4, (400.0,), 20, ref_now),
    ]

    high_res = normalize_metric_population(
        inputs, direction="higher_is_better", reference_time=ref_now
    )
    scores_high = {o.component_id: o.normalized_score_0_100 for o in high_res.outputs}
    assert scores_high == {1: 12.5, 2: 37.5, 3: 62.5, 4: 87.5}

    low_res = normalize_metric_population(
        inputs, direction="lower_is_better", reference_time=ref_now
    )
    scores_low = {o.component_id: o.normalized_score_0_100 for o in low_res.outputs}
    assert scores_low == {1: 87.5, 2: 62.5, 3: 37.5, 4: 12.5}


def test_pure_normalization_ties_outliers_and_missing_values() -> None:
    ref_now = datetime(2026, 9, 27, tzinfo=UTC)
    inputs = [
        RawComponentObservationInput(10, (100.0,), 15, ref_now),
        RawComponentObservationInput(20, (200.0, 200.0), 15, ref_now),
        RawComponentObservationInput(30, (200.0,), 15, ref_now),
        RawComponentObservationInput(40, (999999.0,), 15, ref_now),
        RawComponentObservationInput(50, (), 0, ref_now),
        RawComponentObservationInput(60, (-5.0, float("nan")), 5, ref_now),
    ]

    res = normalize_metric_population(inputs, direction="higher_is_better", reference_time=ref_now)
    assert res.population_size == 4
    assert set(res.excluded_missing_component_ids) == {50, 60}

    score_map = {o.component_id: o.normalized_score_0_100 for o in res.outputs}
    # Tied components 20 and 30 receive identical 50.0 mid-rank percentile; outlier 40 doesn't crush them
    assert score_map[10] == 12.5
    assert score_map[20] == 50.0
    assert score_map[30] == 50.0
    assert score_map[40] == 87.5


def test_pure_normalization_sparse_and_stale_confidence_penalties() -> None:
    ref_now = datetime(2026, 9, 27, tzinfo=UTC)
    stale_date = ref_now - timedelta(days=240)

    single_sparse = [
        RawComponentObservationInput(
            component_id=1,
            raw_values=(500.0,),
            total_sample_count=1,
            latest_tested_at=stale_date,
        )
    ]
    res_sparse = normalize_metric_population(
        single_sparse, min_sample_count=3, reference_time=ref_now
    )
    assert len(res_sparse.outputs) == 1
    assert res_sparse.outputs[0].normalized_score_0_100 == 50.0
    assert res_sparse.outputs[0].confidence_contribution < 0.60


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(settings.TEST_DATABASE_URL, future=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        seed_reference_configuration(session)
        seed_curated_hardware_catalog(session)
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_recompute_normalized_metrics_service_persists_versioned_scores(
    db_session: Session,
) -> None:
    ingest_blender_snapshot_file(db_session, BLENDER_FIXTURE)

    summary = recompute_normalized_metrics_for_dataset(
        db_session,
        dataset_version="ds-2026-09-r1",
        normalization_version_code="norm-v1.0",
    )

    assert summary.metrics_processed == 2
    assert summary.normalized_rows_upserted == 8

    rtx_4090 = db_session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "GeForce RTX 4090")
    )
    assert rtx_4090 is not None

    norm_row = db_session.scalar(
        select(NormalizedMetric).where(
            NormalizedMetric.component_id == rtx_4090.id,
            NormalizedMetric.dataset_version == "ds-2026-09-r1",
        )
    )
    assert norm_row is not None
    assert norm_row.normalized_score_0_100 == 87.5
    assert norm_row.raw_aggregated_score == 11250.5

from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import BenchmarkObservation, HardwareComponent
from app.db.seed import seed_reference_configuration
from app.db.seed_catalog import seed_curated_hardware_catalog
from app.domains.ingestion.blender_adapter import ingest_blender_snapshot_file

FIXTURE_PATH = (
    Path(__file__).resolve().parents[3] / "data" / "fixtures" / "blender_opendata_snapshot_v1.json"
)


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


def test_blender_snapshot_ingestion_aliases_quarantine_and_median(
    db_session: Session,
) -> None:
    summary = ingest_blender_snapshot_file(db_session, FIXTURE_PATH)

    assert summary.status == "succeeded"
    assert summary.rows_processed == 11
    assert summary.rows_inserted == 9
    assert summary.rows_quarantined == 2
    assert "Unknown Engineering Sample GPU X99" in summary.unmatched_devices
    assert summary.was_cached_idempotent_run is False

    ryzen_7800x3d = db_session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "Ryzen 7 7800X3D")
    )
    assert ryzen_7800x3d is not None
    # Median of 258.4 (Linux) and 254.0 (Windows) is 256.2
    assert summary.aggregated_medians_by_component_id[ryzen_7800x3d.id] == 256.2

    quarantined_rows = db_session.scalars(
        select(BenchmarkObservation).where(BenchmarkObservation.is_quarantined.is_(True))
    ).all()
    assert len(quarantined_rows) == 2


def test_blender_snapshot_ingestion_is_idempotent(db_session: Session) -> None:
    first_run = ingest_blender_snapshot_file(db_session, FIXTURE_PATH)
    second_run = ingest_blender_snapshot_file(db_session, FIXTURE_PATH)

    assert first_run.idempotency_key == second_run.idempotency_key
    assert second_run.was_cached_idempotent_run is True

    total_obs = db_session.scalars(select(BenchmarkObservation)).all()
    assert len(total_obs) == 11

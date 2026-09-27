from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import AuditEvent, BenchmarkMetricDefinition, BenchmarkObservation
from app.db.seed import seed_reference_configuration
from app.db.seed_catalog import seed_curated_hardware_catalog
from app.domains.ingestion.phoronix_adapter import ingest_phoronix_artifact_file

ROOT_DIR = Path(__file__).resolve().parents[3]
FIXTURE_PATH = ROOT_DIR / "data" / "fixtures" / "phoronix_synthetic_test_fixture.json"
MANIFEST_PATH = ROOT_DIR / "data" / "manifests" / "phoronix_test_manifest.json"


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


def test_phoronix_blocks_synthetic_fixture_by_default(db_session: Session) -> None:
    with pytest.raises(PermissionError, match="SYNTHETIC|synthetic"):
        ingest_phoronix_artifact_file(
            db_session, FIXTURE_PATH, MANIFEST_PATH, allow_synthetic_fixture=False
        )


def test_phoronix_ingests_valid_runs_and_quarantines_unapproved_or_old_versions(
    db_session: Session,
) -> None:
    summary = ingest_phoronix_artifact_file(
        db_session, FIXTURE_PATH, MANIFEST_PATH, allow_synthetic_fixture=True
    )

    assert summary.status == "succeeded"
    assert summary.rows_processed == 8
    assert summary.rows_inserted == 6
    assert summary.rows_quarantined == 2

    cpu_single_def = db_session.scalar(
        select(BenchmarkMetricDefinition).where(
            BenchmarkMetricDefinition.metric_key == "cpu_single"
        )
    )
    assert cpu_single_def is not None
    assert cpu_single_def.direction == "lower_is_better"

    quarantined = db_session.scalars(
        select(BenchmarkObservation).where(BenchmarkObservation.is_quarantined.is_(True))
    ).all()
    reasons = {q.environment_json.get("quarantine_reason") for q in quarantined}
    assert "incompatible_test_version" in reasons
    assert "license_pending_human_review" in reasons

    audit = db_session.scalar(
        select(AuditEvent).where(AuditEvent.action == "ingest_phoronix_artifact")
    )
    assert audit is not None
    assert audit.payload_json["rows_inserted"] == 6

import uuid
from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import (
    AnalysisResult,
    BenchmarkMetricDefinition,
    ComponentAlias,
    ComponentSpecification,
    HardwareComponent,
    NormalizationVersion,
    NormalizedMetric,
    PCBuild,
    PCBuildComponent,
    ScoringVersion,
    WorkloadProfile,
)
from app.db.seed import seed_reference_configuration


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(settings.TEST_DATABASE_URL, future=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_workload_seeds_and_weights_sum_to_one(db_session: Session) -> None:
    seed_reference_configuration(db_session)

    profiles = db_session.scalars(select(WorkloadProfile)).all()
    assert len(profiles) == 5

    for profile in profiles:
        total_weight = sum(w.weight for w in profile.weights)
        assert round(total_weight, 4) == 1.0000, f"Weights for {profile.slug} did not sum to 1.0"


def test_component_and_alias_uniqueness_constraints(db_session: Session) -> None:
    cpu = HardwareComponent(
        component_type="CPU",
        brand="AMD",
        model_name="Ryzen 7 7800X3D",
        generation="Zen 4",
    )
    db_session.add(cpu)
    db_session.commit()

    duplicate_cpu = HardwareComponent(
        component_type="CPU",
        brand="AMD",
        model_name="Ryzen 7 7800X3D",
        generation="Zen 4",
    )
    db_session.add(duplicate_cpu)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    alias_1 = ComponentAlias(
        component_id=cpu.id,
        component_type="CPU",
        alias_name="AMD Ryzen 7 7800X3D 8-Core Processor",
    )
    db_session.add(alias_1)
    db_session.commit()

    alias_dup = ComponentAlias(
        component_id=cpu.id,
        component_type="CPU",
        alias_name="AMD Ryzen 7 7800X3D 8-Core Processor",
    )
    db_session.add(alias_dup)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_version_linkage_and_foreign_key_integrity(db_session: Session) -> None:
    seed_reference_configuration(db_session)

    gpu = HardwareComponent(
        component_type="GPU",
        brand="NVIDIA",
        model_name="GeForce RTX 4070 SUPER",
        generation="Ada Lovelace",
    )
    db_session.add(gpu)
    db_session.flush()

    spec = ComponentSpecification(
        component_id=gpu.id,
        vram_gb=12,
        specs_json={"bus_width_bit": 192, "tdp_watts": 220},
    )
    db_session.add(spec)

    metric_def = db_session.scalar(
        select(BenchmarkMetricDefinition).where(
            BenchmarkMetricDefinition.metric_key == "gpu_render_compute"
        )
    )
    norm_ver = db_session.scalar(
        select(NormalizationVersion).where(NormalizationVersion.version_code == "norm-v1.0")
    )
    score_ver = db_session.scalar(
        select(ScoringVersion).where(ScoringVersion.version_code == "score-v1.0")
    )
    gaming_profile = db_session.scalar(
        select(WorkloadProfile).where(WorkloadProfile.slug == "gaming")
    )
    assert metric_def is not None
    assert norm_ver is not None
    assert score_ver is not None
    assert gaming_profile is not None

    norm_metric = NormalizedMetric(
        component_id=gpu.id,
        metric_definition_id=metric_def.id,
        normalization_version_id=norm_ver.id,
        dataset_version="ds-2026-09-test",
        raw_aggregated_score=6200.0,
        normalized_score_0_100=84.5,
        percentile=84.5,
        sample_count=42,
        confidence_contribution=0.95,
    )
    db_session.add(norm_metric)

    build = PCBuild(name="Test Gaming Build", workload_profile_id=gaming_profile.id)
    db_session.add(build)
    db_session.flush()

    build_part = PCBuildComponent(
        pc_build_id=build.id,
        component_id=gpu.id,
        slot_type="GPU",
        quantity=1,
    )
    db_session.add(build_part)

    analysis = AnalysisResult(
        share_uuid=str(uuid.uuid4()),
        pc_build_id=build.id,
        workload_profile_id=gaming_profile.id,
        scoring_version_id=score_ver.id,
        normalization_version_id=norm_ver.id,
        dataset_version="ds-2026-09-test",
        performance_score_0_100=82.0,
        performance_tier="Strong",
        balance_score_0_100=91.0,
        balance_status="Balanced",
        confidence_score_0_100=92.0,
        confidence_level="High",
    )
    db_session.add(analysis)
    db_session.commit()

    saved = db_session.scalar(select(AnalysisResult).where(AnalysisResult.pc_build_id == build.id))
    assert saved is not None
    assert saved.dataset_version == "ds-2026-09-test"
    assert saved.performance_tier == "Strong"

from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import HardwareComponent
from app.db.seed import seed_reference_configuration
from app.db.seed_catalog import seed_curated_hardware_catalog
from app.domains.ingestion.blender_adapter import ingest_blender_snapshot_file
from app.domains.ingestion.phoronix_adapter import ingest_phoronix_artifact_file
from app.domains.normalization.service import recompute_normalized_metrics_for_dataset
from app.domains.scoring.engine import (
    ComponentMetricEvidenceInput,
    WorkloadMetricRuleInput,
    evaluate_build_for_workload,
)
from app.domains.scoring.service import run_and_persist_build_analysis

ROOT_DIR = Path(__file__).resolve().parents[3]
BLENDER_FIXTURE = ROOT_DIR / "data" / "fixtures" / "blender_opendata_snapshot_v1.json"
PTS_FIXTURE = ROOT_DIR / "data" / "fixtures" / "phoronix_synthetic_test_fixture.json"
PTS_MANIFEST = ROOT_DIR / "data" / "manifests" / "phoronix_test_manifest.json"


def _hypothetical_gaming_rules() -> list[WorkloadMetricRuleInput]:
    return [
        WorkloadMetricRuleInput("gpu_render_compute", "GPU Render", "GPU", 0.50, 50.0),
        WorkloadMetricRuleInput("cpu_single", "CPU Single", "CPU", 0.20, 45.0),
        WorkloadMetricRuleInput("cpu_multi", "CPU Multi", "CPU", 0.10, 35.0),
        WorkloadMetricRuleInput("ram_bandwidth_capacity", "RAM Bandwidth", "RAM", 0.12, 40.0),
        WorkloadMetricRuleInput("storage_throughput", "Storage I/O", "STORAGE", 0.08, 30.0),
    ]


def test_golden_balanced_gaming_build_deterministic_score() -> None:
    rules = _hypothetical_gaming_rules()
    # Hypothetical fixture values
    evidence = {
        "gpu_render_compute": ComponentMetricEvidenceInput(
            1, "Hypothetical GPU A", "GPU", "gpu_render_compute", 80.0, 80.0, 0.95
        ),
        "cpu_single": ComponentMetricEvidenceInput(
            2, "Hypothetical CPU A", "CPU", "cpu_single", 78.0, 78.0, 0.92
        ),
        "cpu_multi": ComponentMetricEvidenceInput(
            2, "Hypothetical CPU A", "CPU", "cpu_multi", 74.0, 74.0, 0.92
        ),
        "ram_bandwidth_capacity": ComponentMetricEvidenceInput(
            3, "Hypothetical RAM A", "RAM", "ram_bandwidth_capacity", 75.0, 75.0, 0.90
        ),
        "storage_throughput": ComponentMetricEvidenceInput(
            4, "Hypothetical SSD A", "STORAGE", "storage_throughput", 82.0, 82.0, 0.90
        ),
    }

    result = evaluate_build_for_workload(workload_name="Gaming", rules=rules, evidence=evidence)

    assert result.performance_score_0_100 == 78.56
    assert result.performance_tier == "Strong"
    assert result.balance_status == "Balanced"
    assert result.balance_score_0_100 >= 90.0
    assert result.confidence_level == "High"
    assert len(result.recommendations) == 0


def test_unbalanced_high_gpu_weak_cpu_triggers_major_bottleneck_and_cpu_upgrade() -> None:
    rules = _hypothetical_gaming_rules()
    # Hypothetical fixture: 95.0 GPU paired with 30.0 CPU
    evidence = {
        "gpu_render_compute": ComponentMetricEvidenceInput(
            1, "Hypothetical Ultra GPU", "GPU", "gpu_render_compute", 95.0, 95.0, 0.95
        ),
        "cpu_single": ComponentMetricEvidenceInput(
            2, "Hypothetical Budget CPU", "CPU", "cpu_single", 30.0, 30.0, 0.90
        ),
        "cpu_multi": ComponentMetricEvidenceInput(
            2, "Hypothetical Budget CPU", "CPU", "cpu_multi", 30.0, 30.0, 0.90
        ),
        "ram_bandwidth_capacity": ComponentMetricEvidenceInput(
            3, "Hypothetical RAM", "RAM", "ram_bandwidth_capacity", 80.0, 80.0, 0.90
        ),
        "storage_throughput": ComponentMetricEvidenceInput(
            4, "Hypothetical SSD", "STORAGE", "storage_throughput", 80.0, 80.0, 0.90
        ),
    }

    result = evaluate_build_for_workload(workload_name="Gaming", rules=rules, evidence=evidence)

    assert result.performance_score_0_100 == 72.5
    assert result.performance_tier == "Strong"
    assert result.balance_status == "Major bottleneck"
    assert result.bottlenecks[0].limiting_component_type == "CPU"
    assert result.bottlenecks[0].strongest_component_type == "GPU"
    assert result.bottlenecks[0].spread_points == 65.0
    assert len(result.recommendations) >= 1
    assert result.recommendations[0].component_type == "CPU"
    assert result.recommendations[0].priority_order == 1


def test_low_weight_subsystem_does_not_trigger_false_positive_bottleneck_or_upgrade() -> None:
    web_dev_rules = [
        WorkloadMetricRuleInput("cpu_multi", "CPU Multi", "CPU", 0.35, 50.0),
        WorkloadMetricRuleInput("cpu_single", "CPU Single", "CPU", 0.25, 50.0),
        WorkloadMetricRuleInput("ram_bandwidth_capacity", "RAM", "RAM", 0.22, 50.0),
        WorkloadMetricRuleInput("storage_throughput", "Storage", "STORAGE", 0.13, 40.0),
        # GPU is only 0.05 weight (< 0.10 relevance threshold)
        WorkloadMetricRuleInput("gpu_render_compute", "GPU Render", "GPU", 0.05, 15.0),
    ]
    evidence = {
        "cpu_multi": ComponentMetricEvidenceInput(
            1, "Dev CPU", "CPU", "cpu_multi", 85.0, 85.0, 0.95
        ),
        "cpu_single": ComponentMetricEvidenceInput(
            1, "Dev CPU", "CPU", "cpu_single", 82.0, 82.0, 0.95
        ),
        "ram_bandwidth_capacity": ComponentMetricEvidenceInput(
            2, "Dev RAM", "RAM", "ram_bandwidth_capacity", 80.0, 80.0, 0.95
        ),
        "storage_throughput": ComponentMetricEvidenceInput(
            3, "Dev SSD", "STORAGE", "storage_throughput", 84.0, 84.0, 0.95
        ),
        # Basic GPU scoring 18.0 should NOT trigger a bottleneck in Web Development
        "gpu_render_compute": ComponentMetricEvidenceInput(
            4, "Basic GPU", "GPU", "gpu_render_compute", 18.0, 18.0, 0.90
        ),
    }

    result = evaluate_build_for_workload(
        workload_name="Web Development", rules=web_dev_rules, evidence=evidence
    )

    assert result.balance_status == "Balanced"
    assert all(r.component_type != "GPU" for r in result.recommendations)


def test_missing_metrics_are_not_treated_as_zero_and_reduce_confidence() -> None:
    rules = _hypothetical_gaming_rules()
    # Only GPU (w=0.50) is present with score 80.0; other 50% weights are missing
    partial_evidence = {
        "gpu_render_compute": ComponentMetricEvidenceInput(
            1, "Hypothetical GPU", "GPU", "gpu_render_compute", 80.0, 80.0, 0.90
        )
    }

    result = evaluate_build_for_workload(
        workload_name="Gaming", rules=rules, evidence=partial_evidence
    )

    # Must be 80.0 (re-normalized over available evidence), NEVER 40.0 (which would happen if missing=0)
    assert result.performance_score_0_100 == 80.0
    assert result.coverage_ratio == 0.50
    assert result.confidence_level in ("Medium", "Limited")
    assert any("Missing benchmark evidence" in w for w in result.warnings)


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


def test_service_runs_and_persists_full_versioned_analysis(db_session: Session) -> None:
    ingest_blender_snapshot_file(db_session, BLENDER_FIXTURE)
    ingest_phoronix_artifact_file(
        db_session, PTS_FIXTURE, PTS_MANIFEST, allow_synthetic_fixture=True
    )
    recompute_normalized_metrics_for_dataset(db_session, "ds-2026-09-r1")

    cpu = db_session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "Ryzen 5 5600X")
    )
    gpu = db_session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "GeForce RTX 4090")
    )
    ram = db_session.scalar(
        select(HardwareComponent).where(
            HardwareComponent.model_name == "Trident Z5 Neo 32GB DDR5-6000 CL30"
        )
    )
    storage = db_session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "990 PRO 2TB NVMe PCIe 4.0")
    )
    assert cpu is not None and gpu is not None and ram is not None and storage is not None

    analysis_row, domain_out = run_and_persist_build_analysis(
        db_session,
        workload_slug="video-3d",
        component_ids_by_slot={
            "CPU": cpu.id,
            "GPU": gpu.id,
            "RAM": ram.id,
            "STORAGE": storage.id,
        },
        dataset_version="ds-2026-09-r1",
        build_name="RTX 4090 + 5600X Bottleneck Test Rig",
    )

    assert analysis_row.id is not None
    assert analysis_row.dataset_version == "ds-2026-09-r1"
    # RTX 4090 (87.5 percentile) paired with Ryzen 5 5600X (12.5 percentile) in Video/3D has 75pt spread
    assert analysis_row.balance_status == "Major bottleneck"
    assert len(analysis_row.bottlenecks) == 1
    assert analysis_row.bottlenecks[0].limiting_component_type == "CPU"
    assert len(analysis_row.recommendations) >= 1
    assert analysis_row.recommendations[0].component_type == "CPU"

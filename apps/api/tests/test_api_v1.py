from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import HardwareComponent
from app.db.seed import seed_reference_configuration
from app.db.seed_catalog import seed_curated_hardware_catalog
from app.db.session import get_db
from app.domains.ingestion.blender_adapter import ingest_blender_snapshot_file
from app.domains.ingestion.phoronix_adapter import ingest_phoronix_artifact_file
from app.domains.normalization.service import recompute_normalized_metrics_for_dataset
from app.main import app

ROOT_DIR = Path(__file__).resolve().parents[3]
BLENDER_FIXTURE = ROOT_DIR / "data" / "fixtures" / "blender_opendata_snapshot_v1.json"
PTS_FIXTURE = ROOT_DIR / "data" / "fixtures" / "phoronix_synthetic_test_fixture.json"
PTS_MANIFEST = ROOT_DIR / "data" / "manifests" / "phoronix_test_manifest.json"


@pytest.fixture()
def api_client_with_seeded_db() -> Generator[tuple[TestClient, Session], None, None]:
    engine = create_engine(settings.TEST_DATABASE_URL, future=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()

    seed_reference_configuration(session)
    seed_curated_hardware_catalog(session)
    ingest_blender_snapshot_file(session, BLENDER_FIXTURE)
    ingest_phoronix_artifact_file(session, PTS_FIXTURE, PTS_MANIFEST, allow_synthetic_fixture=True)
    recompute_normalized_metrics_for_dataset(session, "ds-2026-09-r1")
    recompute_normalized_metrics_for_dataset(session, "ds-2026-09-pts-fixture")

    def _override_get_db() -> Generator[Session, None, None]:
        yield session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as client:
            yield client, session
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_search_and_detail_component_endpoints(
    api_client_with_seeded_db: tuple[TestClient, Session],
) -> None:
    client, _ = api_client_with_seeded_db

    res = client.get("/v1/components/search", params={"component_type": "GPU", "q": "4090"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    gpu_id = data["items"][0]["id"]
    assert data["items"][0]["model_name"] == "GeForce RTX 4090"

    detail_res = client.get(f"/v1/components/{gpu_id}", params={"dataset_version": "ds-2026-09-r1"})
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["specification"]["vram_gb"] == 24
    assert len(detail["normalized_metrics"]) == 1
    assert detail["normalized_metrics"][0]["normalized_score_0_100"] == 87.5


def test_workloads_and_dataset_version_endpoints(
    api_client_with_seeded_db: tuple[TestClient, Session],
) -> None:
    client, _ = api_client_with_seeded_db

    wl_res = client.get("/v1/workloads")
    assert wl_res.status_code == 200
    workloads = wl_res.json()
    assert len(workloads) == 5

    meta_res = client.get("/v1/meta/dataset-version")
    assert meta_res.status_code == 200
    meta = meta_res.json()
    assert meta["dataset_version"] == "ds-2026-09-r1"
    assert meta["normalization_version"] == "norm-v1.0"
    assert meta["scoring_version"] == "score-v1.0"


def test_analyze_fetch_and_invalid_slot_rejection(
    api_client_with_seeded_db: tuple[TestClient, Session],
) -> None:
    client, session = api_client_with_seeded_db

    cpu = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "Ryzen 7 7800X3D")
    )
    gpu = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "GeForce RTX 4070 SUPER")
    )
    ram = session.scalar(
        select(HardwareComponent).where(
            HardwareComponent.model_name == "Trident Z5 Neo 32GB DDR5-6000 CL30"
        )
    )
    ssd = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "990 PRO 2TB NVMe PCIe 4.0")
    )
    assert cpu and gpu and ram and ssd

    # 1. Valid analysis request
    analyze_res = client.post(
        "/v1/builds/analyze",
        json={
            "build_name": "7800X3D + 4070S Gaming Rig",
            "workload_slug": "gaming",
            "dataset_version": "ds-2026-09-r1",
            "components": {
                "CPU": cpu.id,
                "GPU": gpu.id,
                "RAM": ram.id,
                "STORAGE": ssd.id,
            },
        },
    )
    assert analyze_res.status_code == 201
    analysis_data = analyze_res.json()
    assert analysis_data["workload_slug"] == "gaming"
    assert analysis_data["version_metadata"]["dataset_version"] == "ds-2026-09-r1"
    share_uuid = analysis_data["share_uuid"]

    # 2. Fetch persisted analysis by share_uuid
    fetch_res = client.get(f"/v1/analysis/{share_uuid}")
    assert fetch_res.status_code == 200
    assert fetch_res.json()["analysis_id"] == analysis_data["analysis_id"]

    # 3. Impossible slot selection (putting a GPU ID in the CPU slot) must return 422
    bad_res = client.post(
        "/v1/builds/analyze",
        json={
            "build_name": "Invalid Slot Build",
            "workload_slug": "gaming",
            "components": {
                "CPU": gpu.id,
                "GPU": gpu.id,
                "RAM": ram.id,
                "STORAGE": ssd.id,
            },
        },
    )
    assert bad_res.status_code == 422


def test_compare_two_builds_endpoint(
    api_client_with_seeded_db: tuple[TestClient, Session],
) -> None:
    client, session = api_client_with_seeded_db

    cpu_a = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "Ryzen 9 7950X")
    )
    cpu_b = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "Ryzen 5 5600X")
    )
    gpu_a = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "GeForce RTX 4090")
    )
    gpu_b = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "GeForce RTX 3060")
    )
    ram = session.scalar(
        select(HardwareComponent).where(
            HardwareComponent.model_name == "Trident Z5 Neo 32GB DDR5-6000 CL30"
        )
    )
    ssd = session.scalar(
        select(HardwareComponent).where(HardwareComponent.model_name == "990 PRO 2TB NVMe PCIe 4.0")
    )
    assert cpu_a and cpu_b and gpu_a and gpu_b and ram and ssd

    cmp_res = client.post(
        "/v1/builds/compare",
        json={
            "workload_slug": "video-3d",
            "dataset_version": "ds-2026-09-r1",
            "build_a_name": "Workstation Rig A",
            "build_a_components": {
                "CPU": cpu_a.id,
                "GPU": gpu_a.id,
                "RAM": ram.id,
                "STORAGE": ssd.id,
            },
            "build_b_name": "Entry Rig B",
            "build_b_components": {
                "CPU": cpu_b.id,
                "GPU": gpu_b.id,
                "RAM": ram.id,
                "STORAGE": ssd.id,
            },
        },
    )
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["performance_score_delta"] > 0
    assert len(cmp_data["where_a_is_stronger"]) >= 1
    assert "Video / 3D" in cmp_data["contextual_summary"]

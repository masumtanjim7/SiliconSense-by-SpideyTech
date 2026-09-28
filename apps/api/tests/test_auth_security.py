from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import create_supabase_jwt
from app.db.base import Base
from app.db.models import AuditEvent, HardwareComponent, UserProfile
from app.db.seed import seed_reference_configuration
from app.db.seed_catalog import seed_curated_hardware_catalog
from app.db.session import get_db
from app.domains.ingestion.blender_adapter import ingest_blender_snapshot_file
from app.domains.normalization.service import recompute_normalized_metrics_for_dataset
from app.main import app

ROOT_DIR = Path(__file__).resolve().parents[3]
BLENDER_FIXTURE = ROOT_DIR / "data" / "fixtures" / "blender_opendata_snapshot_v1.json"


@pytest.fixture()
def auth_test_env() -> Generator[tuple[TestClient, Session], None, None]:
    engine = create_engine(settings.TEST_DATABASE_URL, future=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()

    seed_reference_configuration(session)
    seed_curated_hardware_catalog(session)
    ingest_blender_snapshot_file(session, BLENDER_FIXTURE)
    recompute_normalized_metrics_for_dataset(session, "ds-2026-09-r1")

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


def test_unauthenticated_paths_blocked_on_saved_builds_and_internal_admin(
    auth_test_env: tuple[TestClient, Session],
) -> None:
    client, _ = auth_test_env

    # Unauthenticated access to /v1/builds must fail with 401
    res_list = client.get("/v1/builds")
    assert res_list.status_code == 401

    res_save = client.post(
        "/v1/builds",
        json={
            "build_name": "Unauthorized Rig",
            "workload_slug": "gaming",
            "components": {"CPU": 1, "GPU": 5, "RAM": 9, "STORAGE": 11},
        },
    )
    assert res_save.status_code == 401

    # Unauthenticated access to internal admin endpoints must fail with 401
    res_admin = client.post(
        "/internal/ingestion/recompute-normalization",
        json={"dataset_version": "ds-2026-09-r1"},
    )
    assert res_admin.status_code == 401


def test_expired_or_bad_signature_token_rejected(
    auth_test_env: tuple[TestClient, Session],
) -> None:
    client, _ = auth_test_env

    expired_token = create_supabase_jwt(sub="user-expired-1", expires_in_seconds=-60)
    res_exp = client.get("/v1/builds", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_exp.status_code == 401

    wrong_secret_token = create_supabase_jwt(sub="user-bad-sig", secret="wrong-secret-key")
    res_bad = client.get("/v1/builds", headers={"Authorization": f"Bearer {wrong_secret_token}"})
    assert res_bad.status_code == 401


def test_normal_user_can_save_builds_but_cannot_escalate_to_admin(
    auth_test_env: tuple[TestClient, Session],
) -> None:
    client, session = auth_test_env

    # Forged client claim 'role': 'data_admin' inside JWT must be ignored by server
    user_token = create_supabase_jwt(
        sub="supabase-user-001",
        email="builder@spideytech.dev",
        extra_claims={"role": "data_admin"},
    )
    headers = {"Authorization": f"Bearer {user_token}"}

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

    save_res = client.post(
        "/v1/builds",
        headers=headers,
        json={
            "build_name": "My Saved Spidey Rig",
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
    assert save_res.status_code == 201

    list_res = client.get("/v1/builds", headers=headers)
    assert list_res.status_code == 200
    saved_items = list_res.json()
    assert len(saved_items) == 1
    assert saved_items[0]["name"] == "My Saved Spidey Rig"
    assert saved_items[0]["latest_performance_tier"] is not None

    # Normal user attempting to access /internal/ingestion/* must get 403 Forbidden
    admin_attempt = client.post(
        "/internal/ingestion/recompute-normalization",
        headers=headers,
        json={"dataset_version": "ds-2026-09-r1"},
    )
    assert admin_attempt.status_code == 403


def test_data_admin_can_run_privileged_ingestion_and_writes_audit_log(
    auth_test_env: tuple[TestClient, Session],
) -> None:
    client, session = auth_test_env

    # Pre-provision a server-side data_admin user profile
    admin_profile = UserProfile(
        auth_subject="supabase-admin-999",
        email="admin@spideytech.dev",
        role="data_admin",
    )
    session.add(admin_profile)
    session.commit()

    admin_token = create_supabase_jwt(sub="supabase-admin-999", email="admin@spideytech.dev")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.post(
        "/internal/ingestion/recompute-normalization",
        headers=headers,
        json={
            "dataset_version": "ds-2026-09-r1",
            "normalization_version_code": "norm-v1.0",
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["status"] == "succeeded"
    assert payload["triggered_by_subject"] == "supabase-admin-999"

    audit = session.scalar(
        select(AuditEvent).where(AuditEvent.action == "admin_recompute_normalization")
    )
    assert audit is not None
    assert audit.actor_subject == "supabase-admin-999"

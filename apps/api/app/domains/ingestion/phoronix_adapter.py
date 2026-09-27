import hashlib
import json
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AuditEvent,
    BenchmarkMetricDefinition,
    BenchmarkObservation,
    BenchmarkSource,
    IngestionRun,
    RawDatasetSnapshot,
)
from app.domains.ingestion.blender_adapter import resolve_canonical_component_id
from app.domains.ingestion.schemas import IngestionSummary


class PTSManifestProfile(BaseModel):
    internal_metric_key: str
    pts_identifier: str
    approved_version_prefix: str
    subsystem: str
    unit: str
    direction: str
    license_spdx: str
    license_review_status: str
    environment_requirements: dict[str, Any]
    comparability_notes: str


class PTSManifest(BaseModel):
    manifest_version: str
    profiles: list[PTSManifestProfile]


class PTSEnvironment(BaseModel):
    os: str
    kernel: str
    pts_version: str
    cpu_reported: str
    gpu_reported: str
    ram_reported: str
    storage_reported: str


class PTSTestResultItem(BaseModel):
    pts_identifier: str
    test_version: str
    subsystem: str = Field(..., pattern="^(CPU|GPU|RAM|STORAGE)$")
    unit: str
    replicates: list[float] = Field(..., min_length=1)


class PTSRunRecord(BaseModel):
    run_id: str
    tested_at: datetime
    environment: PTSEnvironment
    results: list[PTSTestResultItem]


class PTSArtifactPayload(BaseModel):
    fixture_notice: str | None = None
    is_synthetic_test_fixture: bool = False
    dataset_version: str
    source_code: str = "phoronix_pts_local"
    retrieved_at: datetime
    runs: list[PTSRunRecord]


def load_pts_manifest(manifest_path: Path) -> dict[str, PTSManifestProfile]:
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest = PTSManifest.model_validate(raw)
    return {p.pts_identifier: p for p in manifest.profiles}


def get_reported_device_for_subsystem(env: PTSEnvironment, subsystem: str) -> str:
    mapping = {
        "CPU": env.cpu_reported,
        "GPU": env.gpu_reported,
        "RAM": env.ram_reported,
        "STORAGE": env.storage_reported,
    }
    return mapping[subsystem]


def ingest_phoronix_artifact_file(
    db: Session,
    artifact_path: Path,
    manifest_path: Path,
    *,
    allow_synthetic_fixture: bool = False,
) -> IngestionSummary:
    raw_bytes = artifact_path.read_bytes()
    file_checksum = hashlib.sha256(raw_bytes).hexdigest()
    payload = PTSArtifactPayload.model_validate(json.loads(raw_bytes.decode("utf-8")))

    if payload.is_synthetic_test_fixture and not allow_synthetic_fixture:
        raise PermissionError(
            "Refusing to load synthetic TEST FIXTURE without allow_synthetic_fixture=True."
        )

    manifest_map = load_pts_manifest(manifest_path)

    source = db.scalar(
        select(BenchmarkSource).where(
            BenchmarkSource.code == payload.source_code,
            BenchmarkSource.is_approved.is_(True),
        )
    )
    if source is None:
        raise ValueError(f"Benchmark source '{payload.source_code}' is not registered or approved.")

    idempotency_key = hashlib.sha256(
        f"{payload.source_code}:{payload.dataset_version}:{file_checksum}".encode()
    ).hexdigest()

    existing_run = db.scalar(
        select(IngestionRun).where(
            IngestionRun.idempotency_key == idempotency_key,
            IngestionRun.status == "succeeded",
        )
    )
    if existing_run is not None:
        return IngestionSummary(
            dataset_version=payload.dataset_version,
            idempotency_key=idempotency_key,
            status="succeeded",
            rows_processed=existing_run.rows_processed,
            rows_inserted=existing_run.rows_inserted,
            rows_quarantined=existing_run.rows_quarantined,
            unmatched_devices=[],
            aggregated_medians_by_component_id={},
            was_cached_idempotent_run=True,
        )

    snapshot = db.scalar(
        select(RawDatasetSnapshot).where(
            RawDatasetSnapshot.source_id == source.id,
            RawDatasetSnapshot.dataset_version == payload.dataset_version,
        )
    )
    if snapshot is None:
        snapshot = RawDatasetSnapshot(
            source_id=source.id,
            dataset_version=payload.dataset_version,
            checksum_sha256=file_checksum,
            storage_uri=str(artifact_path.as_posix()),
            manifest_json={
                "is_synthetic_test_fixture": payload.is_synthetic_test_fixture,
                "run_count": len(payload.runs),
            },
            retrieved_at=payload.retrieved_at,
            is_published=not payload.is_synthetic_test_fixture,
        )
        db.add(snapshot)
        db.flush()

    run = IngestionRun(
        snapshot_id=snapshot.id,
        idempotency_key=idempotency_key,
        status="running",
    )
    db.add(run)
    db.flush()

    rows_processed = 0
    rows_inserted = 0
    rows_quarantined = 0
    unmatched_devices: list[str] = []
    component_scores: dict[int, list[float]] = defaultdict(list)

    for pts_run in payload.runs:
        for item in pts_run.results:
            rows_processed += 1
            profile = manifest_map.get(item.pts_identifier)
            reported_name = get_reported_device_for_subsystem(pts_run.environment, item.subsystem)
            component_id = resolve_canonical_component_id(db, item.subsystem, reported_name)
            if component_id is None:
                unmatched_devices.append(reported_name)

            quarantine_reason: str | None = None
            metric_def: BenchmarkMetricDefinition | None = None

            if profile is None:
                quarantine_reason = "unregistered_pts_profile"
            elif profile.license_review_status != "approved":
                quarantine_reason = f"license_{profile.license_review_status}"
            elif not item.test_version.startswith(profile.approved_version_prefix):
                quarantine_reason = "incompatible_test_version"
            elif item.unit != profile.unit:
                quarantine_reason = "unit_mismatch"
            elif len(item.replicates) < int(
                profile.environment_requirements.get("min_replicates", 1)
            ):
                quarantine_reason = "insufficient_replicates"
            elif component_id is None:
                quarantine_reason = "unmatched_device"

            if profile is not None:
                metric_def = db.scalar(
                    select(BenchmarkMetricDefinition).where(
                        BenchmarkMetricDefinition.metric_key == profile.internal_metric_key
                    )
                )
                if metric_def is not None and metric_def.direction != profile.direction:
                    metric_def.direction = profile.direction

            if metric_def is None:
                continue

            median_val = round(float(np.median(item.replicates)), 2)
            is_quarantined = quarantine_reason is not None

            if is_quarantined:
                rows_quarantined += 1
            else:
                rows_inserted += 1
                if component_id is not None:
                    component_scores[component_id].append(median_val)

            db.add(
                BenchmarkObservation(
                    snapshot_id=snapshot.id,
                    source_id=source.id,
                    component_id=component_id if not is_quarantined else None,
                    metric_definition_id=metric_def.id,
                    reported_device_name=reported_name,
                    benchmark_version=f"{item.pts_identifier}@{item.test_version}",
                    raw_score=median_val,
                    unit=item.unit,
                    sample_count=len(item.replicates),
                    environment_json={
                        "run_id": pts_run.run_id,
                        "os": pts_run.environment.os,
                        "kernel": pts_run.environment.kernel,
                        "pts_version": pts_run.environment.pts_version,
                        "replicates": item.replicates,
                        "quarantine_reason": quarantine_reason,
                    },
                    is_quarantined=is_quarantined,
                    tested_at=pts_run.tested_at,
                )
            )

    run.status = "succeeded"
    run.rows_processed = rows_processed
    run.rows_inserted = rows_inserted
    run.rows_quarantined = rows_quarantined
    run.finished_at = datetime.now(UTC)

    db.add(
        AuditEvent(
            actor_subject="system_worker",
            action="ingest_phoronix_artifact",
            entity_type="ingestion_run",
            entity_id=str(run.id),
            payload_json={
                "dataset_version": payload.dataset_version,
                "is_synthetic": payload.is_synthetic_test_fixture,
                "rows_inserted": rows_inserted,
                "rows_quarantined": rows_quarantined,
            },
        )
    )
    db.commit()

    aggregated_medians = {
        cid: round(float(np.median(scores)), 2) for cid, scores in component_scores.items()
    }

    return IngestionSummary(
        dataset_version=payload.dataset_version,
        idempotency_key=idempotency_key,
        status="succeeded",
        rows_processed=rows_processed,
        rows_inserted=rows_inserted,
        rows_quarantined=rows_quarantined,
        unmatched_devices=unmatched_devices,
        aggregated_medians_by_component_id=aggregated_medians,
        was_cached_idempotent_run=False,
    )

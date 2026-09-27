import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    BenchmarkMetricDefinition,
    BenchmarkObservation,
    BenchmarkSource,
    ComponentAlias,
    IngestionRun,
    RawDatasetSnapshot,
)
from app.domains.ingestion.schemas import BlenderSnapshotPayload, IngestionSummary


def normalize_alias_lookup(raw_name: str) -> str:
    return " ".join(raw_name.strip().split()).lower()


def resolve_canonical_component_id(
    db: Session, component_type: str, reported_name: str
) -> int | None:
    cleaned_target = normalize_alias_lookup(reported_name)
    aliases = db.scalars(
        select(ComponentAlias).where(ComponentAlias.component_type == component_type)
    ).all()
    for alias in aliases:
        if normalize_alias_lookup(alias.alias_name) == cleaned_target:
            return alias.component_id
    return None


def ingest_blender_snapshot_file(db: Session, snapshot_path: Path) -> IngestionSummary:
    raw_bytes = snapshot_path.read_bytes()
    file_checksum = hashlib.sha256(raw_bytes).hexdigest()
    raw_json = json.loads(raw_bytes.decode("utf-8"))
    payload = BlenderSnapshotPayload.model_validate(raw_json)

    if payload.license_spdx != "CC0-1.0":
        raise ValueError(f"Unapproved license for Blender snapshot: {payload.license_spdx}")

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
        existing_obs = db.scalars(
            select(BenchmarkObservation).where(
                BenchmarkObservation.snapshot_id == existing_run.snapshot_id,
                BenchmarkObservation.is_quarantined.is_(False),
            )
        ).all()
        grouped_Existing: dict[int, list[float]] = defaultdict(list)
        for obs in existing_obs:
            if obs.component_id is not None:
                grouped_Existing[obs.component_id].append(obs.raw_score)
        medians = {
            cid: round(float(np.median(scores)), 2) for cid, scores in grouped_Existing.items()
        }
        return IngestionSummary(
            dataset_version=payload.dataset_version,
            idempotency_key=idempotency_key,
            status="succeeded",
            rows_processed=existing_run.rows_processed,
            rows_inserted=existing_run.rows_inserted,
            rows_quarantined=existing_run.rows_quarantined,
            unmatched_devices=[],
            aggregated_medians_by_component_id=medians,
            was_cached_idempotent_run=True,
        )

    cpu_metric = db.scalar(
        select(BenchmarkMetricDefinition).where(BenchmarkMetricDefinition.metric_key == "cpu_multi")
    )
    gpu_metric = db.scalar(
        select(BenchmarkMetricDefinition).where(
            BenchmarkMetricDefinition.metric_key == "gpu_render_compute"
        )
    )
    if cpu_metric is None or gpu_metric is None:
        raise RuntimeError("Core metric definitions must be seeded before ingestion.")

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
            storage_uri=str(snapshot_path.as_posix()),
            manifest_json={
                "target_blender_version": payload.target_blender_version,
                "license_spdx": payload.license_spdx,
                "record_count": len(payload.records),
            },
            retrieved_at=payload.retrieved_at,
            is_published=True,
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

    for rec in payload.records:
        rows_processed += 1
        metric_def = cpu_metric if rec.device_type == "CPU" else gpu_metric
        version_compatible = rec.blender_version.startswith(payload.target_blender_version)
        component_id = resolve_canonical_component_id(db, rec.device_type, rec.device_name)

        is_quarantined = (not version_compatible) or (component_id is None)
        if component_id is None:
            unmatched_devices.append(rec.device_name)

        if is_quarantined:
            rows_quarantined += 1
        else:
            rows_inserted += 1
            if component_id is not None:
                component_scores[component_id].append(rec.median_score)

        db.add(
            BenchmarkObservation(
                snapshot_id=snapshot.id,
                source_id=source.id,
                component_id=component_id if not is_quarantined else None,
                metric_definition_id=metric_def.id,
                reported_device_name=rec.device_name,
                benchmark_version=rec.blender_version,
                raw_score=rec.median_score,
                unit="samples_per_min",
                sample_count=rec.sample_count,
                environment_json={
                    "compute_type": rec.compute_type,
                    "os": rec.os,
                    "quarantine_reason": (
                        "incompatible_version"
                        if not version_compatible
                        else ("unmatched_device" if component_id is None else None)
                    ),
                },
                is_quarantined=is_quarantined,
                tested_at=rec.tested_at,
            )
        )

    run.status = "succeeded"
    run.rows_processed = rows_processed
    run.rows_inserted = rows_inserted
    run.rows_quarantined = rows_quarantined
    run.finished_at = datetime.now(timezone.utc)
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

from datetime import datetime

from pydantic import BaseModel, Field


class BlenderRawRecord(BaseModel):
    device_name: str = Field(..., min_length=1)
    device_type: str = Field(..., pattern="^(CPU|GPU)$")
    compute_type: str = Field(default="CPU")
    os: str = Field(default="Unknown")
    blender_version: str = Field(..., min_length=1)
    median_score: float = Field(..., gt=0.0)
    sample_count: int = Field(default=1, ge=1)
    tested_at: datetime | None = None


class BlenderSnapshotPayload(BaseModel):
    dataset_version: str = Field(..., min_length=1)
    source_code: str = Field(default="blender_opendata")
    target_blender_version: str = Field(..., min_length=1)
    retrieved_at: datetime
    license_spdx: str = Field(..., min_length=1)
    records: list[BlenderRawRecord]


class IngestionSummary(BaseModel):
    dataset_version: str
    idempotency_key: str
    status: str
    rows_processed: int
    rows_inserted: int
    rows_quarantined: int
    unmatched_devices: list[str]
    aggregated_medians_by_component_id: dict[int, float]
    was_cached_idempotent_run: bool = False

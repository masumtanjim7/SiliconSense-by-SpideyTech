from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import RecomputeDatasetRequest, RecomputeDatasetResponse
from app.core.security import require_data_admin_or_worker
from app.db.models import AuditEvent, UserProfile
from app.db.session import get_db
from app.domains.normalization.service import recompute_normalized_metrics_for_dataset

router = APIRouter(prefix="/internal/ingestion", tags=["internal-admin"])


@router.post("/recompute-normalization", response_model=RecomputeDatasetResponse)
def admin_recompute_normalization_endpoint(
    payload: RecomputeDatasetRequest,
    admin_user: Annotated[UserProfile, Depends(require_data_admin_or_worker)],
    db: Annotated[Session, Depends(get_db)],
) -> RecomputeDatasetResponse:
    try:
        summary = recompute_normalized_metrics_for_dataset(
            db,
            payload.dataset_version,
            normalization_version_code=payload.normalization_version_code,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    db.add(
        AuditEvent(
            actor_subject=admin_user.auth_subject,
            action="admin_recompute_normalization",
            entity_type="dataset_version",
            entity_id=payload.dataset_version,
            payload_json={
                "normalization_version_code": payload.normalization_version_code,
                "metrics_processed": summary.metrics_processed,
                "normalized_rows_upserted": summary.normalized_rows_upserted,
                "actor_role": admin_user.role,
            },
        )
    )
    db.commit()

    return RecomputeDatasetResponse(
        status="succeeded",
        dataset_version=summary.dataset_version,
        normalization_version_code=summary.normalization_version_code,
        metrics_processed=summary.metrics_processed,
        normalized_rows_upserted=summary.normalized_rows_upserted,
        triggered_by_subject=admin_user.auth_subject,
    )

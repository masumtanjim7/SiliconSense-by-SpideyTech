from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import (
    AnalysisResultResponse,
    AnalyzeBuildRequest,
    CompareBuildsRequest,
    CompareBuildsResponse,
    ComponentDetailResponse,
    DatasetVersionMetaResponse,
    PaginatedComponentSearchResponse,
    SavedBuildSummaryResponse,
    WorkloadProfileSchema,
)
from app.core.security import require_authenticated_user
from app.db.models import AnalysisResult, PCBuild, UserProfile, WorkloadProfile
from app.db.session import get_db
from app.domains.catalog.service import (
    get_Active_dataset_version_string,
    get_dataset_version_metadata,
    get_hardware_component_detail,
    list_active_workload_profiles,
    search_hardware_components,
)
from app.domains.scoring.service import (
    build_analysis_response_from_row,
    compare_two_builds_for_workload,
    get_persisted_analysis_by_identifier,
    run_and_persist_build_analysis,
)

router = APIRouter(prefix="/v1", tags=["v1"])


@router.get("/components/search", response_model=PaginatedComponentSearchResponse)
@router.get("/components", response_model=PaginatedComponentSearchResponse, include_in_schema=False)
def search_components_endpoint(
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=120)] = None,
    component_type: Annotated[str | None, Query(pattern="^(CPU|GPU|RAM|STORAGE)$")] = None,
    brand: Annotated[str | None, Query(max_length=64)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedComponentSearchResponse:
    return search_hardware_components(
        db, q=q, component_type=component_type, brand=brand, page=page, page_size=page_size
    )


@router.get("/components/{component_id}", response_model=ComponentDetailResponse)
def get_component_endpoint(
    component_id: int,
    db: Annotated[Session, Depends(get_db)],
    dataset_version: Annotated[str | None, Query(max_length=64)] = None,
) -> ComponentDetailResponse:
    detail = get_hardware_component_detail(db, component_id, dataset_version=dataset_version)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"HardwareComponent id={component_id} not found.",
        )
    return detail


@router.get("/workloads", response_model=list[WorkloadProfileSchema])
def list_workloads_endpoint(
    db: Annotated[Session, Depends(get_db)],
) -> list[WorkloadProfileSchema]:
    return list_active_workload_profiles(db)


@router.get("/meta/dataset-version", response_model=DatasetVersionMetaResponse)
@router.get("/datasets/current", response_model=DatasetVersionMetaResponse, include_in_schema=False)
def get_dataset_version_endpoint(
    db: Annotated[Session, Depends(get_db)],
) -> DatasetVersionMetaResponse:
    return get_dataset_version_metadata(db)


@router.post(
    "/builds/analyze",
    response_model=AnalysisResultResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/analyses",
    response_model=AnalysisResultResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def analyze_build_endpoint(
    payload: AnalyzeBuildRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AnalysisResultResponse:
    target_ds = payload.dataset_version or get_Active_dataset_version_string(db)
    try:
        analysis_row, _ = run_and_persist_build_analysis(
            db,
            workload_slug=payload.workload_slug,
            component_ids_by_slot=payload.components.to_slot_dict(),
            dataset_version=target_ds,
            build_name=payload.build_name,
        )
        return build_analysis_response_from_row(db, analysis_row)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get("/analysis/{identifier}", response_model=AnalysisResultResponse)
@router.get(
    "/analyses/{identifier}", response_model=AnalysisResultResponse, include_in_schema=False
)
def get_analysis_endpoint(
    identifier: str,
    db: Annotated[Session, Depends(get_db)],
) -> AnalysisResultResponse:
    result = get_persisted_analysis_by_identifier(db, identifier)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis result '{identifier}' not found.",
        )
    return result


@router.post("/builds/compare", response_model=CompareBuildsResponse)
@router.post("/compare", response_model=CompareBuildsResponse, include_in_schema=False)
def compare_builds_endpoint(
    payload: CompareBuildsRequest,
    db: Annotated[Session, Depends(get_db)],
) -> CompareBuildsResponse:
    try:
        return compare_two_builds_for_workload(db, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post(
    "/builds",
    response_model=AnalysisResultResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_authenticated_build_endpoint(
    payload: AnalyzeBuildRequest,
    user: Annotated[UserProfile, Depends(require_authenticated_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AnalysisResultResponse:
    target_ds = payload.dataset_version or get_Active_dataset_version_string(db)
    try:
        analysis_row, _ = run_and_persist_build_analysis(
            db,
            workload_slug=payload.workload_slug,
            component_ids_by_slot=payload.components.to_slot_dict(),
            dataset_version=target_ds,
            build_name=payload.build_name,
            user_id=user.id,
        )
        return build_analysis_response_from_row(db, analysis_row)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get("/builds", response_model=list[SavedBuildSummaryResponse])
def list_authenticated_builds_endpoint(
    user: Annotated[UserProfile, Depends(require_authenticated_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SavedBuildSummaryResponse]:
    builds = db.scalars(
        select(PCBuild)
        .where(PCBuild.user_id == user.id, PCBuild.is_saved.is_(True))
        .order_by(PCBuild.created_at.desc(), PCBuild.id.desc())
    ).all()

    summaries: list[SavedBuildSummaryResponse] = []
    for b in builds:
        profile = db.get(WorkloadProfile, b.workload_profile_id)
        latest_analysis = db.scalar(
            select(AnalysisResult)
            .where(AnalysisResult.pc_build_id == b.id)
            .order_by(AnalysisResult.analyzed_at.desc(), AnalysisResult.id.desc())
        )
        summaries.append(
            SavedBuildSummaryResponse(
                build_id=b.id,
                name=b.name,
                workload_slug=profile.slug if profile else "unknown",
                workload_name=profile.name if profile else "Unknown",
                latest_analysis_id=latest_analysis.id if latest_analysis else None,
                latest_share_uuid=latest_analysis.share_uuid if latest_analysis else None,
                latest_performance_score=(
                    latest_analysis.performance_score_0_100 if latest_analysis else None
                ),
                latest_performance_tier=(
                    latest_analysis.performance_tier if latest_analysis else None
                ),
                latest_balance_status=latest_analysis.balance_status if latest_analysis else None,
                dataset_version=latest_analysis.dataset_version if latest_analysis else None,
                created_at=b.created_at,
            )
        )
    return summaries

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db, verify_database_connection

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    database: str


@router.get("/health", response_model=HealthResponse)
def health_check(db: Annotated[Session, Depends(get_db)]) -> HealthResponse:
    db_ok = verify_database_connection(db)
    return HealthResponse(
        status="healthy" if db_ok else "degraded",
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        database="connected" if db_ok else "unreachable",
    )

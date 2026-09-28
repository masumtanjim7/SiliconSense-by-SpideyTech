import base64
import hashlib
import hmac
import json
import time
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import UserProfile
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def create_supabase_jwt(
    *,
    sub: str,
    email: str | None = None,
    secret: str | None = None,
    expires_in_seconds: int = 3600,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    signing_secret = (secret or settings.SUPABASE_JWT_SECRET).encode("utf-8")
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": sub,
        "email": email,
        "iat": now,
        "exp": now + expires_in_seconds,
        "aud": "authenticated",
    }
    if extra_claims:
        payload.update(extra_claims)

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(signing_secret, signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_supabase_jwt(token: str, *, secret: str | None = None) -> dict[str, Any]:
    signing_secret = (secret or settings.SUPABASE_JWT_SECRET).encode("utf-8")
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token.",
        )

    header_b64, payload_b64, sig_b64 = parts
    try:
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        provided_sig = _b64url_decode(sig_b64)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token encoding.",
        ) from exc

    if header.get("alg") != "HS256":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unsupported JWT algorithm.",
        )

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(signing_secret, signing_input, hashlib.sha256).digest()

    if not hmac.compare_digest(provided_sig, expected_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature.",
        )

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or time.time() >= float(exp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
        )

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required 'sub' identity claim.",
        )

    return dict(payload)


def require_authenticated_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> UserProfile:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer token.",
        )

    claims = verify_supabase_jwt(credentials.credentials)
    auth_sub = str(claims["sub"])
    email = str(claims["email"]) if claims.get("email") is not None else None

    profile = db.scalar(select(UserProfile).where(UserProfile.auth_subject == auth_sub))
    if profile is None:
        # Never trust role claims from browser JWT; always default new profiles to 'user'
        profile = UserProfile(
            auth_subject=auth_sub,
            email=email,
            role="user",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


def require_data_admin_or_worker(
    user: Annotated[UserProfile, Depends(require_authenticated_user)],
) -> UserProfile:
    if user.role not in ("data_admin", "system_worker"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: requires data_admin or system_worker privileges.",
        )
    return user

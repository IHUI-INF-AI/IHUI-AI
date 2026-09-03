# prompt_guard_api.py - prompt injection audit/probe + signatures (read-only).
# (c) 2026 IHUI AI. Apache-2.0. ASCII-only per project constraint.
# Export: `router` (prefix=/api, tags=["prompt-guard-auth"]).

"""Read-only prompt-injection probing & signatures endpoints.

Mount via ``app.include_router(router)`` (router already carries prefix=/api).

- POST /api/prompt-guard/inspect   probe text; returns trimmed hit snippets.
- GET  /api/prompt-guard/signatures static catalog for frontend rendering.

Both endpoints are auth-gated via get_current_user_id and never persist the
request text; only trimmed match snippets are returned.
"""

from __future__ import annotations

from typing import Any

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.prompt_guard import (
    HIT_TYPES,
    LANGUAGE_ALLOWED,
    SOURCE_ALLOWED,
    detect_injections,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["prompt-guard-auth"])

# Static catalogs for the signatures endpoint (ASCII only).
_SEVERITY_DESC: dict[str, str] = {
    "high": "Block or downgrade the whole payload before it reaches agent context.",
    "med": "Flag and inspect; strip wrapper tags where it is safe to do so.",
    "low": "Informational, low confidence, no action taken by default.",
}

_POLICY_DESC: dict[str, str] = {
    "flag": "Label only: return original text plus hits.",
    "sanitize": "Strip wrapper tags / obfuscated instruction segments, keep body.",
    "refuse": "Reject when risk>=high with a structured interception notice.",
}


class InspectRequest(BaseModel):
    text: str = Field(..., description="External untrusted text to probe.")
    source: str = Field("web", description="Boundary: web|mcp|message|file.")
    languages: str = Field("both", description="english|chinese|both.")


@router.post("/prompt-guard/inspect")
async def inspect_text(
    req: InspectRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Probe text for prompt injection. Read-only; no persistence."""
    if req.source not in SOURCE_ALLOWED:
        return {
            "code": 400,
            "message": f"source must be one of {sorted(SOURCE_ALLOWED)}",
            "data": None,
        }
    if req.languages not in LANGUAGE_ALLOWED:
        return {
            "code": 400,
            "message": f"languages must be one of {sorted(LANGUAGE_ALLOWED)}",
            "data": None,
        }
    res = detect_injections(req.text, source=req.source, languages=req.languages)
    logger.info(
        "prompt-guard inspect user=%s source=%s risk=%s hits=%d",
        user_id, req.source, res.risk_level, len(res.hits),
    )
    return {"code": 0, "message": "ok", "data": res.to_dict()}


@router.get("/prompt-guard/signatures")
async def signatures(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    """Static catalog: supported injection types, severities and strategies."""
    injection_types = [
        {"type": hit_type, "label": label, "severity": severity}
        for hit_type, (severity, label) in HIT_TYPES.items()
    ]
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "injection_types": injection_types,
            "severity": _SEVERITY_DESC,
            "policies": _POLICY_DESC,
            "sources": list(SOURCE_ALLOWED),
            "languages": list(LANGUAGE_ALLOWED),
        },
    }
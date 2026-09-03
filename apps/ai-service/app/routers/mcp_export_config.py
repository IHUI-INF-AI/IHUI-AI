# mcp_export_config.py - read-only MCP export access-config endpoints.
# (c) 2026 IHUI AI. Apache-2.0. ASCII-only per project constraint.
# Export: `router` (prefix=/api, tags=["mcp-export-config"]).

"""Read-only MCP export access-config helpers.

Mount via ``app.include_router(router)`` (router already carries prefix=/api).

- GET /api/mcp-export/config         generate client config fragment / URL form.
- GET /api/mcp-export/normalize-url  normalize host/scheme/port into the
  external endpoint URL, validating host via validate_request_host first
  (host / DNS-rebinding guard; unknown or wildcard hosts are rejected).

Both endpoints are auth-gated via get_current_user_id and are read-only.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from ..core.jwt_auth import get_current_user_id
from ..services import mcp_export

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["mcp-export-config"])


@router.get("/mcp-export/config")
async def get_access_config(
    transport: str = "stdio",
    base_url: str | None = None,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Generate paste-ready client config.

    stdio -> Claude Desktop claude_desktop_config.json fragment;
    sse / streamable-http -> URL-form access entry.
    """
    try:
        data = mcp_export.generate_client_config(transport, base_url)
    except ValueError as exc:
        logger.warning(
            "mcp-export config user=%s transport=%r invalid", user_id, transport
        )
        return {"code": 400, "message": str(exc), "data": None}
    logger.info("mcp-export config user=%s transport=%s", user_id, transport)
    return {"code": 0, "message": "ok", "data": data}


@router.get("/mcp-export/normalize-url")
async def normalize_url(
    scheme: str = "http",
    host: str = "127.0.0.1",
    port: int | None = None,
    transport: str = "streamable-http",
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Normalize host/scheme/port into the external MCP endpoint URL.

    Host is validated with validate_request_host (loopback allowed by
    default); unknown/wildcard hosts are rejected with a non-zero code.
    """
    if not mcp_export.validate_request_host(host):
        logger.warning(
            "mcp-export normalize user=%s host=%r rejected", user_id, host
        )
        return {
            "code": 403,
            "message": f"host {host!r} is not allowed (loopback only by default)",
            "data": None,
        }
    try:
        url = mcp_export.compute_external_url(
            {"scheme": scheme, "host": host, "port": port, "transport": transport}
        )
    except ValueError as exc:
        logger.warning(
            "mcp-export normalize user=%s transport=%r invalid", user_id, transport
        )
        return {"code": 400, "message": str(exc), "data": None}
    logger.info(
        "mcp-export normalize user=%s transport=%s host=%s", user_id, transport, host
    )
    return {"code": 0, "message": "ok", "data": {"url": url, "transport": transport}}

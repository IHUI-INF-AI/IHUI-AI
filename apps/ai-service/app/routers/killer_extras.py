#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# killer_extras.py
#
# Consolidated mount for the killer read-only/management APIs built during the
# goal-driven deepening rounds. Each router has already defined its own path
# segment; mount with the /api prefix exactly once so the final routes are:
#   /api/cost-ledger/*            (cost_ledger.router,  prefix=/cost-ledger)
#   /api/longterm-memory/*        (agent_memory.router, prefix=/longterm-memory)
#   /api/prompt-guard/*           (prompt_guard_api.router, carries /api)
#   /api/mcp-export/*             (mcp_export_config.router, carries /api)
#
# These routers used to risk colliding with the legacy /api/memory/* routes;
# the long-term-memory router uses a distinct /longterm-memory segment to avoid
# the pre-existing /api/memory/recall and /api/memory/extract endpoints.
#
# Usage in main.py create_app():
#     from app.routers import killer_extras
#     killer_extras.register(app)
# ---------------------------------------------------------------------------
from fastapi import FastAPI

from . import agent_memory, cost_ledger, mcp_export_config, prompt_guard_api


def register(app: FastAPI) -> None:
    """Include all goal-driven killer routers once (call from create_app)."""
    app.include_router(cost_ledger.router, prefix="/api", tags=["cost-ledger"])
    app.include_router(agent_memory.router, prefix="/api", tags=["memory"])
    # The two below already carry prefix="/api" internally, so mount WITHOUT
    # an extra /api argument to avoid a double /api/api prefix.
    app.include_router(prompt_guard_api.router)
    app.include_router(mcp_export_config.router)

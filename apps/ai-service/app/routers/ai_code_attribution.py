# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账读数路由(2026-11-05,goal-b49)。

挂载说明:本模块仅导出 `router: APIRouter`(prefix="/ai-code-attribution"),由 master
在 main.py 以 `app.include_router(ai_code_attribution_router, prefix="/api",
tags=["ai-code-attribution"])` 方式挂载,最终端点路径:
  GET /api/ai-code-attribution/records              → 归属账明细(可按路径/会话过滤)
  GET /api/ai-code-attribution/stats                → 某文件/某会话的 AI 占比与统计
  GET /api/ai-code-attribution/records/{id}/trace   → 单条记录的回溯裁决(git blame)
  POST /api/ai-code-attribution/backfill            → 提交成功后给空锚回填提交号
  GET  /api/ai-code-attribution/checkpoints         → 编辑检查点日志(损坏时不说成没有)

存储:复用 app/services/ai_code_attribution_store(进程内 list + data/ai_code_attribution.json)。
判据:app/core/ai_code_attribution(仓内只此一份);本路由只做读数与序列化,不判归属。
认证:与 step_recorder 一致,复用 get_current_user_id(审计数据仅登录用户可见)。
响应统一信封 {code:0,message:data},对齐前端 api-client(code===0 判定成功)。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends

from ..core.ai_code_attribution import AttributionRecord, AttributionStats
from ..core.jwt_auth import get_current_user_id
from ..services.ai_code_attribution_store import (
    backfill_commit_sha,
    list_checkpoint_log,
    list_records,
    stats_all,
    stats_for_path,
    stats_for_session,
    trace_record,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-code-attribution", tags=["ai-code-attribution"])

_MAX_LIMIT = 500


def _record_payload(record: AttributionRecord) -> dict[str, Any]:
    """归属记录 → JSON 形态(锚与归属/理由一并回送,读数侧可复述判据)。"""
    return {
        "record_id": record.record_id,
        "tool": record.tool,
        "file": record.file,
        "attribution": record.attribution,
        "reason": record.reason,
        "session_id": record.session_id,
        "at": record.at,
        "hunk_summary": record.hunk_summary,
        "anchor": {
            "path": record.anchor.path,
            "line_start": record.anchor.line_start,
            "line_end": record.anchor.line_end,
            "hunk_id": record.anchor.hunk_id,
            "commit_sha": record.anchor.commit_sha,
        },
    }


def _stats_payload(stats: AttributionStats) -> dict[str, Any]:
    """统计 → JSON 形态(两个占比口径都给:含 unknown 的 ai_ratio 与只算已判出的 known_ratio)。"""
    return {
        "total": stats.total,
        "ai": stats.ai,
        "human": stats.human,
        "unknown": stats.unknown,
        "ai_ratio": stats.ai_ratio,
        "known_ratio": stats.known_ratio,
    }


@router.get("/records")
async def list_attribution_records(
    path: str | None = None,
    session_id: str | None = None,
    limit: int = 100,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """归属账明细(最新在前)。路径/会话皆不给 ⇒ 全量最近 N 条。"""
    records = list_records(path=path, session_id=session_id, limit=min(max(1, limit), _MAX_LIMIT))
    logger.info(
        "ai-code-attribution records user=%s path=%s session=%s total=%s",
        user_id,
        path or "-",
        session_id or "-",
        len(records),
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {"total": len(records), "records": [_record_payload(r) for r in records]},
    }


@router.get("/stats")
async def attribution_stats(
    path: str | None = None,
    session_id: str | None = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """AI 占比统计:给 path 查某文件,给 session_id 查某次会话,都不给则查全账。"""
    if path:
        stats = stats_for_path(path)
    elif session_id:
        stats = stats_for_session(session_id)
    else:
        stats = stats_all()
    logger.info(
        "ai-code-attribution stats user=%s path=%s session=%s total=%s",
        user_id,
        path or "-",
        session_id or "-",
        stats.total,
    )
    return {"code": 0, "message": "ok", "data": _stats_payload(stats)}


@router.get("/records/{record_id}/trace")
async def trace_attribution_record(
    record_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """单条记录的回溯裁决:git blame 命中 ⇒ resolved;否则 unresolved + 原因(回溯不出)。"""
    result = trace_record(record_id)
    logger.info(
        "ai-code-attribution trace user=%s record=%s status=%s",
        user_id,
        record_id[:32],
        result.status,
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "status": result.status,
            "detail": result.detail,
            "commits": list(result.commits),
        },
    }


@router.post("/backfill")
async def backfill_attribution_commit(
    body: dict[str, Any],
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """提交已经成功之后调用。提交号不合法或账本读不到时一条都不改。"""
    sha = body.get("commit_sha")
    files = body.get("files")
    if not isinstance(sha, str) or not isinstance(files, list) or any(not isinstance(item, str) for item in files):
        return {
            "code": 0,
            "message": "提交号或文件清单形态不对",
            "data": {"updated": 0, "refused": "提交号或文件清单形态不对"},
        }
    updated, refused = backfill_commit_sha(sha, files)
    logger.info(
        "ai-code-attribution backfill user=%s updated=%s refused=%s",
        user_id,
        updated,
        refused or "-",
    )
    return {"code": 0, "message": refused or "ok", "data": {"updated": updated, "refused": refused}}


@router.get("/checkpoints")
async def list_attribution_checkpoints(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """检查点读数。日志读不到时 refused 有字，checkpoints 为空也不表示没发生过编辑。"""
    rows, refused = list_checkpoint_log()
    logger.info(
        "ai-code-attribution checkpoints user=%s count=%s refused=%s",
        user_id,
        len(rows),
        refused or "-",
    )
    return {"code": 0, "message": refused or "ok", "data": {"checkpoints": rows, "refused": refused}}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

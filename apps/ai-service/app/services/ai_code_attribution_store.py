# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账的**对外函数式 API**(2026-11-05,goal-b49)。

判据与纯函数在 app/core/ai_code_attribution.py(仓内**只此一份**,按族拆到
_verdict/_record/_stats/_trace 四个子模块,那里是稳定聚合面);落盘在
app/services/ai_code_attribution_persistence.py;真跑 blame 在
app/services/ai_code_attribution_git.py。

**本模块自己不判归属**,只把三者串起来:
- ``record_attribution`` 造一条账行并落盘(判定在 core 里做);
- ``list_records`` / ``stats_*`` 是读数侧入口;
- ``trace_record`` 回溯一条账行,回溯不出 ⇒ unresolved + 原因(绝不假装成功)。

本模块同时 re-export 落盘层的 ``store`` 单例与 ``AiCodeAttributionStore``,
故 `from app.services.ai_code_attribution_store import store` 仍然可用
(测试用它 monkeypatch 落点)。
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from pathlib import Path

from app.core.ai_code_attribution import (
    TRACE_UNRESOLVED,
    AttributionRecord,
    AttributionStats,
    TraceResult,
    compute_stats,
    make_record,
    resolve_anchor,
)

from .ai_code_attribution_git import detect_repo_root, git_blame
from .ai_code_attribution_persistence import MAX_RECORDS, AiCodeAttributionStore, store
from .ttl_json_store import iso_now

logger = logging.getLogger(__name__)

__all__ = [
    "AiCodeAttributionStore",
    "MAX_RECORDS",
    "store",
    "host_session_id",
    "note_host_edit",
    "record_attribution",
    "list_records",
    "stats_for_path",
    "stats_for_session",
    "stats_all",
    "trace_record",
]


def host_session_id(arguments: Mapping[str, object] | None) -> str:
    """会话号只认承载层注入的 ``__session_id``。模型自报的 ``session_id`` 不算。"""
    if not isinstance(arguments, Mapping):
        return ""
    value = arguments.get("__session_id")
    if isinstance(value, str):
        return value.strip()
    return ""


def note_host_edit(
    tool: str,
    file: str,
    hunk: str,
    arguments: Mapping[str, object] | None,
    *,
    line_start: int = 1,
    line_end: int = 1,
) -> None:
    """写成功之后补一条归属账。记账失败不改变已经写完的文件。"""
    try:
        record_attribution(
            tool,
            file,
            hunk,
            session_id=host_session_id(arguments),
            line_start=line_start,
            line_end=line_end,
        )
    except Exception as exc:
        logger.warning("归属记账失败(不影响已完成的写入): %s", exc)


def record_attribution(
    tool: str,
    file: str,
    hunk: str,
    *,
    session_id: str = "",
    line_start: int = 0,
    line_end: int = 0,
    commit_sha: str = "",
) -> AttributionRecord:
    """落一条归属记录(判定在 core 里做,这里只负责造记录 + 落盘)。"""
    record = make_record(
        record_id=uuid.uuid4().hex,
        tool=tool,
        file=file,
        hunk=hunk,
        session_id=session_id,
        line_start=line_start,
        line_end=line_end,
        commit_sha=commit_sha,
        at=iso_now(),
    )
    return store.append(record)


def list_records(
    *,
    path: str | None = None,
    session_id: str | None = None,
    limit: int = 100,
) -> list[AttributionRecord]:
    """列出归属记录(读数侧入口)。"""
    return store.list_records(path=path, session_id=session_id, limit=limit)


def stats_for_path(path: str) -> AttributionStats:
    """某文件的归属统计。"""
    return store.stats_for_path(path)


def stats_for_session(session_id: str) -> AttributionStats:
    """某次会话的归属统计。"""
    return store.stats_for_session(session_id)


def stats_all() -> AttributionStats:
    """全账统计(不按路径/会话过滤)。"""
    return compute_stats(store.list_records(limit=MAX_RECORDS))


def trace_record(record_id: str, *, repo_root: Path | None = None) -> TraceResult:
    """回溯一条归属记录;回溯不出 ⇒ unresolved + 原因。

    真正的 blame 执行在 app/services/ai_code_attribution_git.py(IO 与判据分离);
    「回溯不出 ⇒ unresolved」的裁决住在 core 的 resolve_anchor。
    """
    record = store.find(record_id)
    if record is None:
        return TraceResult(TRACE_UNRESOLVED, "回溯不出:账目里没有这条记录", ())
    root = repo_root or detect_repo_root()
    if root is None:
        return TraceResult(TRACE_UNRESOLVED, "回溯不出:取不到 git 仓库根", ())
    return resolve_anchor(
        record.anchor,
        lambda sha, path, start, end: git_blame(root, sha, path, start, end),
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

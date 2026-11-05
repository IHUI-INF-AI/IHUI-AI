# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账的**落盘层**(2026-11-05,goal-b49)。

只做存储:进程内 list + JSON 文件持久化(`data/ai_code_attribution.json`),原子写 +
TTL 读取期清理,范式对齐 agent_step_recorder / ttl_json_store(同一套读盘口径:
读不到按空、坏记录按丢弃计、绝不半截当有效)。

判据不在这儿:归属判定住在 app/core/ai_code_attribution_verdict.py(仓内唯一一份);
本模块**自己不判归属**,只存。

对外的函数式 API 在 app/services/ai_code_attribution_store.py(它 re-export 本模块的
``store`` 单例,故 `from ...ai_code_attribution_store import store` 仍可用)。
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from app.core.ai_code_attribution import (
    AttributionRecord,
    AttributionStats,
    HunkAnchor,
    compute_stats,
)

from .ttl_json_store import load_ttl_records, resolve_retention_days, write_json_atomic

logger = logging.getLogger(__name__)

_RETENTION_ENV = "AI_CODE_ATTRIBUTION_RETENTION_DAYS"
_DEFAULT_RETENTION_DAYS = 90
_RETENTION_DAYS = resolve_retention_days(_RETENTION_ENV, _DEFAULT_RETENTION_DAYS)

#: 账目条数上限(环形:超限丢最旧)。归属账是审计面,不是无限日志。
MAX_RECORDS = 5000

#: JSON 持久化文件(ai-service 根下的 data/ai_code_attribution.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_ATTRIBUTION_FILE = _DATA_DIR / "ai_code_attribution.json"


def _to_dict(record: AttributionRecord) -> dict[str, Any]:
    """归属记录 → JSON 形态(落盘与读回共用这一份映射,不许各写一份)。"""
    return {
        "record_id": record.record_id,
        "tool": record.tool,
        "file": record.file,
        "hunk_summary": record.hunk_summary,
        "attribution": record.attribution,
        "reason": record.reason,
        "anchor": {
            "path": record.anchor.path,
            "line_start": record.anchor.line_start,
            "line_end": record.anchor.line_end,
            "hunk_id": record.anchor.hunk_id,
            "commit_sha": record.anchor.commit_sha,
        },
        "session_id": record.session_id,
        "at": record.at,
    }


def _from_dict(raw: Any) -> AttributionRecord | None:
    """JSON 形态 → 归属记录;结构不合法返回 None(调用方按丢弃计)。"""
    if not isinstance(raw, dict):
        return None
    anchor_raw = raw.get("anchor")
    if not isinstance(anchor_raw, dict):
        return None
    try:
        anchor = HunkAnchor(
            path=str(anchor_raw.get("path") or ""),
            line_start=int(anchor_raw.get("line_start") or 0),
            line_end=int(anchor_raw.get("line_end") or 0),
            hunk_id=str(anchor_raw.get("hunk_id") or ""),
            commit_sha=str(anchor_raw.get("commit_sha") or ""),
        )
        return AttributionRecord(
            record_id=str(raw.get("record_id") or ""),
            tool=str(raw.get("tool") or ""),
            file=str(raw.get("file") or ""),
            hunk_summary=str(raw.get("hunk_summary") or ""),
            attribution=str(raw.get("attribution") or ""),
            reason=str(raw.get("reason") or ""),
            anchor=anchor,
            session_id=str(raw.get("session_id") or ""),
            at=str(raw.get("at") or ""),
        )
    except (TypeError, ValueError):
        return None


class AiCodeAttributionStore:
    """归属账存储(进程内 list + JSON 文件持久化,threading.Lock 保护)。"""

    def __init__(self, file_path: Path | None = None) -> None:
        self._file = file_path or _ATTRIBUTION_FILE
        self._records: list[dict[str, Any]] = []
        self._lock = threading.Lock()
        self._loaded = False

    def _load(self) -> None:
        """懒加载(仅首次);损坏/缺失按空处理,坏记录按丢弃计。"""
        if self._loaded:
            return
        raw, dropped = load_ttl_records(
            self._file,
            retention_days=_RETENTION_DAYS,
            shape="sequence",
            max_items=MAX_RECORDS,
            validate=lambda r: isinstance(r, dict) and isinstance(r.get("record_id"), str),
        )
        if dropped:
            logger.info("ai_code_attribution 加载:清理过期/超限/坏记录 %d 条", dropped)
        self._records = [r for r in raw if isinstance(r, dict)]
        self._loaded = True

    def _persist(self) -> None:
        """全量写回 JSON(原子写);失败保留内存数据,下次变更再试。"""
        write_json_atomic(self._file, self._records, indent=2)

    # ------------------------------------------------------------------
    def append(self, record: AttributionRecord) -> AttributionRecord:
        """追加一条归属记录;超上限丢最旧。返回落账后的记录。"""
        with self._lock:
            self._load()
            self._records.append(_to_dict(record))
            if len(self._records) > MAX_RECORDS:
                del self._records[: len(self._records) - MAX_RECORDS]
            self._persist()
            return record

    def list_records(
        self,
        *,
        path: str | None = None,
        session_id: str | None = None,
        limit: int = 100,
    ) -> list[AttributionRecord]:
        """列出归属记录(按路径/会话过滤;最新在前)。"""
        with self._lock:
            self._load()
            picked: list[AttributionRecord] = []
            for raw in reversed(self._records):
                record = _from_dict(raw)
                if record is None:
                    continue
                if path and record.file != path:
                    continue
                if session_id and record.session_id != session_id:
                    continue
                picked.append(record)
                if len(picked) >= max(1, limit):
                    break
            return picked

    def find(self, record_id: str) -> AttributionRecord | None:
        """按账行编号取一条记录;未命中返回 None(不编造)。"""
        if not record_id:
            return None
        with self._lock:
            self._load()
            for raw in reversed(self._records):
                if raw.get("record_id") == record_id:
                    return _from_dict(raw)
            return None

    def stats_for_path(self, path: str) -> AttributionStats:
        """某文件的归属统计(AI 占比等)。"""
        return compute_stats(self.list_records(path=path, limit=MAX_RECORDS))

    def stats_for_session(self, session_id: str) -> AttributionStats:
        """某次会话的归属统计(AI 占比等)。"""
        return compute_stats(self.list_records(session_id=session_id, limit=MAX_RECORDS))


store = AiCodeAttributionStore()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

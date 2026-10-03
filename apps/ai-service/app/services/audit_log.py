# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""操作审计日志存储(JSON 文件持久化 + 环形截断,2026-09-06 立)。

对齐 cloud_run_store 的防膨胀风格:
- 主存储:进程内 list(append-only 语义,读时倒序返回新→旧)
- 持久化:data/audit_logs.json 全量重写(量小、无 DB 迁移依赖)
- 上限:仅保留最近 AUDIT_LIMIT 条,超出丢最旧(环形截断)
- 单条 detail 长度截断(DETAIL_LIMIT),防超大载荷撑爆文件
- 并发:threading.Lock 保护读写原子性

与既有 app/middleware/audit.py(HTTP 访问审计中间件)互补:本模块面向
**业务操作级**审计(谁在何时对什么做了什么),供 router 端点显式埋点。
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ._load_lifecycle import (
    DECISION_BACKOFF as _DECISION_BACKOFF,
)
from ._load_lifecycle import (
    DECISION_GAVE_UP as _DECISION_GAVE_UP,
)
from ._load_lifecycle import (
    decide_attempt as _decide_attempt,
)
from ._load_lifecycle import (
    monotonic as _lifecycle_monotonic,
)
from ._load_lifecycle import (
    state_after_failure as _state_after_failure,
)
from ._load_lifecycle import (
    state_after_success as _state_after_success,
)
from .ttl_json_store import (
    load_ttl_records,
    resolve_retention_days,
    write_json_atomic,
)

_RETENTION_ENV = "AUDIT_LOG_RETENTION_DAYS"

_DEFAULT_RETENTION_DAYS = 90
_RETENTION_DAYS = resolve_retention_days(_RETENTION_ENV, _DEFAULT_RETENTION_DAYS)


logger = logging.getLogger(__name__)

# 保留的审计条目上限(环形截断)
AUDIT_LIMIT = 5_000
# 单条 detail 序列化后的字符上限
DETAIL_LIMIT = 4_000
# action / actor / target 字段长度上限
FIELD_LIMIT = 200

# JSON 持久化文件(ai-service 根下的 data/audit_logs.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_AUDIT_FILE = _DATA_DIR / "audit_logs.json"


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级)。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@dataclass
class AuditEntry:
    """单条操作审计记录。"""

    id: str
    action: str
    actor: str
    target: str = ""
    detail: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AuditLogStore:
    """审计日志存储(进程内 list + JSON 文件,支持注入 file_path 隔离测试)。"""

    def __init__(self, file_path: Path | None = None, limit: int = AUDIT_LIMIT) -> None:
        self._entries: list[AuditEntry] = []
        self._file = file_path or _AUDIT_FILE
        self._limit = limit
        self._lock = threading.Lock()
        self._loaded = False
        # G-758(2026-10-03):加载生命周期标量(判定住在 _load_lifecycle,唯一一份)。
        # _loaded=False ∧ _load_failures>0 ⇒ "读不到"(待重试/已放弃自动重试),绝不等于空。
        self._load_failures: int = 0
        self._load_next_attempt_s: float = 0.0
        self._load_give_up_logged: bool = False

    # ---------------- 内部 ----------------

    def _load(self) -> None:
        """懒加载(仅首次;缺失/损坏静默降级为空)。调用方须持锁。"""
        if self._loaded:
            return
        now = _lifecycle_monotonic()
        decision = _decide_attempt(
            loaded=self._loaded,
            failures=self._load_failures,
            next_attempt_s=self._load_next_attempt_s,
            now=now,
        )
        if decision == _DECISION_GAVE_UP:
            if not self._load_give_up_logged:
                self._load_give_up_logged = True
                logger.warning(
                    "[audit_log] _load 连续 %d 次读取失败,停止自动重试(状态=读不到,非空表)",
                    self._load_failures,
                )
            return
        if decision == _DECISION_BACKOFF:
            return  # 退避窗口内:本次调用不打 IO
        try:
            # 2026-10-03 数据出域合规整改:读取走 ttl_json_store(带保留期 + 存量
            # 过期清理),不再裸 json.loads。外层的退避状态机是基线侧 G-758 的改动,
            # 两侧在此归并:退避判定管"该不该试",TTL 管"读回来的算不算数"。
            raw, dropped = load_ttl_records(
                self._file,
                retention_days=_RETENTION_DAYS,
                shape="sequence",
                max_items=self._limit,
                validate=lambda item: isinstance(item, dict) and bool(item.get("id")),
            )
            if dropped:
                logger.info("audit_log 加载:清理过期/超限条目 %d 条", dropped)
            # ⚠ 本类在内存里存的是 **AuditEntry 对象**(self._entries),不是 dict ——
            # 归并时曾误写成 `self._data = data`,那会把 list 塞进一个 dict 字段,
            # 表现为 query() 恒返回 0 条(静默丢审计)。这里按 dataclass 重建。
            fields = set(AuditEntry.__dataclass_fields__)
            for item in raw:
                clean = {k: v for k, v in item.items() if k in fields}
                if not isinstance(clean.get("detail"), dict):
                    clean["detail"] = {}
                self._entries.append(AuditEntry(**clean))
            self._loaded, self._load_failures, self._load_next_attempt_s = _state_after_success()
        except Exception as e:
            self._load_failures, self._load_next_attempt_s = _state_after_failure(
                self._load_failures, now
            )
            logger.warning("audit_log 读取失败(降级为空)(本次降级为空,退避后自动重试;连续失败到上限停自动重试): %s", e)

    def _persist(self) -> None:
        """全量写回 JSON(尽力,失败降级内存保留)。调用方须持锁。"""
        try:
            # 2026-10-03 数据出域合规整改:原子写(临时文件 + os.replace),
            # 避免崩在半截时盘上留一个坏 JSON(读侧会 fail-closed 成空 ⇒ 静默丢审计)。
            write_json_atomic(self._file, [e.to_dict() for e in self._entries], indent=2)
        except Exception as e:
            logger.warning("audit_log 写盘失败(内存保留): %s", e)

    # ---------------- 写入 ----------------

    def record(
        self,
        action: str,
        actor: str,
        target: str = "",
        detail: dict[str, Any] | None = None,
    ) -> AuditEntry:
        """记一条操作审计。返回落库条目。"""
        safe_detail: dict[str, Any] = {}
        if detail:
            try:
                blob = json.dumps(detail, ensure_ascii=False, default=str)
                if len(blob) > DETAIL_LIMIT:
                    safe_detail = {"truncated": blob[:DETAIL_LIMIT]}
                else:
                    safe_detail = dict(detail)
            except Exception:
                safe_detail = {"unserializable": True}
        entry = AuditEntry(
            id=uuid.uuid4().hex,
            action=(action or "")[:FIELD_LIMIT],
            actor=(actor or "")[:FIELD_LIMIT],
            target=(target or "")[:FIELD_LIMIT],
            detail=safe_detail,
            created_at=_now_iso(),
        )
        with self._lock:
            self._load()
            self._entries.append(entry)
            if len(self._entries) > self._limit:
                self._entries = self._entries[-self._limit :]
            self._persist()
        return entry

    # ---------------- 读取 ----------------

    def query(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        actor: str | None = None,
        action: str | None = None,
    ) -> dict[str, Any]:
        """分页查询(新→旧),可选按 actor / action 精确过滤。"""
        with self._lock:
            self._load()
            items = list(self._entries)
        if actor:
            items = [e for e in items if e.actor == actor]
        if action:
            items = [e for e in items if e.action == action]
        items.reverse()  # 新→旧
        total = len(items)
        page = max(1, page or 1)
        page_size = min(max(1, page_size or 20), 100)
        start = (page - 1) * page_size
        page_items = items[start : start + page_size]
        return {
            "list": [e.to_dict() for e in page_items],
            "total": total,
            "page": page,
            "pageSize": page_size,
        }


# 全局单例(router 与业务埋点共用)
audit_log_store = AuditLogStore()


def record(
    action: str,
    actor: str,
    target: str = "",
    detail: dict[str, Any] | None = None,
) -> AuditEntry:
    """模块级便捷入口:写一条审计(委托全局单例)。"""
    return audit_log_store.record(action, actor, target, detail)

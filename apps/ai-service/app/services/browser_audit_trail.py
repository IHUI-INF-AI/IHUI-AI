# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器改动可回滚审计账 — 复现 Codex 26.1111 management.getAuditTrail()。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-browser-capability-spec.md`` §3(browser 级
management)+ §4.1(audit trail),明文逐字直读 ``tab/management.md``::

    management: 窗口/标签页/书签组织,导出 windows/tabs/tabGroups/bookmarks
    四命名空间 + getAuditTrail()。
    getAuditTrail() 返回每次 model 发起的浏览器改动,每条含:
      { method, namespace, args, result, createdAt, before }
    before 存"改动前的完整浏览器状态"(windows / tabLayout{tabs,groups} /
    bookmarks),newest first。
    "The audit trail does not include changes made directly by the user"
    (不含用户手动改动)。

对照 IHUI 缺口
--------------
- ``audit_service.AuditService`` 是通用 agent/LLM/tool 审计,无浏览器语义,
  更无"改动前完整状态(before)"快照 ⇒ 无法解释/回滚浏览器改动;
- 无 namespace 分域(windows/tabs/tabGroups/bookmarks);
- 无"仅 model 改动"过滤 —— 用户手动改不该进 model 的可回滚账。

设计要点(纯函数,零 IO)
------------------------
1. **四命名空间封闭枚举**:windows/tabs/tab_groups/bookmarks;
2. **BrowserAuditEntry**:逐条 `{method, namespace, args, result, created_at, before}`;
3. **BrowserAuditTrail**(线程安全,内存缓冲,可注入时钟):
   - ``record``:登记一次 model 改动,``before`` 存改动前状态快照;
   - ``get_audit_trail``:newest-first 返回;可按 namespace 过滤;
   - 仅 model 发起(``record`` 只在 model 路径调用,天然排除用户手动改动);
4. **before-state 快照**:结构化 ``BrowserStateSnapshot(windows, tab_layout,
   bookmarks)``,deep-copy 隔离,防外部后续改动污染历史。

与既有层的关系
--------------
- 与 ``audit_service``(通用 agent 审计)、``computer_use_ledger``(CUA 步骤账)互补:
  本模块只管浏览器 management 语义的可回滚账,不接管通用审计;
- 是否真回滚由调用方据 ``before`` 快照自行落地,本模块只提供账与快照(纯记录)。
"""

from __future__ import annotations

import copy
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from threading import RLock
from typing import Any


class ManagementNamespace(StrEnum):
    """浏览器 management 四命名空间(Codex 对齐 Chrome WebExtension API 语义)。"""

    WINDOWS = "windows"
    TABS = "tabs"
    TAB_GROUPS = "tab_groups"  # Codex tabGroups → 本仓蛇形命名
    BOOKMARKS = "bookmarks"


NAMESPACES: tuple[str, ...] = tuple(ns.value for ns in ManagementNamespace)


@dataclass(frozen=True)
class BrowserStateSnapshot:
    """改动前的完整浏览器状态快照(Codex before 字段语义)。

    结构化存 windows / tab_layout{tabs, groups} / bookmarks;deep-copy 隔离。
    """

    windows: tuple[dict[str, Any], ...] = ()
    tab_layout: dict[str, Any] = field(default_factory=dict)  # {tabs, groups}
    bookmarks: tuple[dict[str, Any], ...] = ()

    @classmethod
    def capture(
        cls,
        *,
        windows: list[dict[str, Any]] | None = None,
        tab_layout: dict[str, Any] | None = None,
        bookmarks: list[dict[str, Any]] | None = None,
    ) -> BrowserStateSnapshot:
        """深拷贝捕获当前状态,防外部后续改动污染历史。"""
        return cls(
            windows=tuple(copy.deepcopy(windows or [])),
            tab_layout=copy.deepcopy(tab_layout or {}),
            bookmarks=tuple(copy.deepcopy(bookmarks or [])),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "windows": [dict(w) for w in self.windows],
            "tab_layout": dict(self.tab_layout),
            "bookmarks": [dict(b) for b in self.bookmarks],
        }


@dataclass(frozen=True)
class BrowserAuditEntry:
    """一次浏览器 model 改动的审计条目(Codex 逐字段对齐)。"""

    method: str  # 具体操作,如 tab.move / bookmark.create / window.create
    namespace: str  # ``ManagementNamespace`` 之一
    args: dict[str, Any]  # 调用参数(深拷贝隔离)
    result: Any  # 操作结果(摘要;深拷贝隔离)
    created_at: datetime  # 改动时间
    before: BrowserStateSnapshot  # 改动前的完整状态

    def to_dict(self) -> dict[str, Any]:
        return {
            "method": self.method,
            "namespace": self.namespace,
            "args": copy.deepcopy(self.args),
            "result": copy.deepcopy(self.result),
            "created_at": self.created_at.isoformat(),
            "before": self.before.to_dict(),
        }


@dataclass(frozen=True)
class RecordOutcome:
    """一次 record 的结果(是否入账 + 理由)。"""

    recorded: bool
    reason: str


class BrowserAuditTrail:
    """浏览器 management 改动可回滚审计账(内存缓冲,newest-first)。

    用法::

        trail = BrowserAuditTrail()
        before = BrowserStateSnapshot.capture(tab_layout={"tabs": [...]})
        trail.record(
            method="tab.move", namespace=ManagementNamespace.TABS,
            args={"tab_id": 7, "index": 0}, result={"ok": True}, before=before,
        )
        entries = trail.get_audit_trail()  # newest first
        tabs_only = trail.get_audit_trail(namespace=ManagementNamespace.TABS)
    """

    def __init__(
        self,
        *,
        clock: Callable[[], datetime] | None = None,
        capacity: int = 1000,
    ) -> None:
        self._lock = RLock()
        self._entries: list[BrowserAuditEntry] = []
        self._clock = clock or (lambda: datetime.now(UTC))
        self._capacity = max(1, capacity)

    def record(
        self,
        *,
        method: str,
        namespace: str,
        args: dict[str, Any] | None = None,
        result: Any = None,
        before: BrowserStateSnapshot | None = None,
    ) -> RecordOutcome:
        """登记一次 model 发起的浏览器改动(线程安全)。

        只在 model 路径调用 ⇒ 天然排除用户手动改动(Codex 隐私/语义边界)。
        method 空 / namespace 不在封闭集即拒(不猜)。
        """
        method_key = (method or "").strip()
        ns_key = (namespace or "").strip()
        if not method_key:
            return RecordOutcome(False, "method 不能为空")
        if ns_key not in NAMESPACES:
            return RecordOutcome(False, f"namespace={ns_key!r} 不在封闭集 {NAMESPACES}")
        entry = BrowserAuditEntry(
            method=method_key,
            namespace=ns_key,
            args=copy.deepcopy(args or {}),
            result=copy.deepcopy(result),
            created_at=self._clock(),
            before=before or BrowserStateSnapshot(),
        )
        with self._lock:
            self._entries.append(entry)
            # 超容量丢最旧(缓冲,非持久账;持久化由上层 ledger 负责)
            if len(self._entries) > self._capacity:
                self._entries = self._entries[-self._capacity :]
        return RecordOutcome(True, "ok")

    def get_audit_trail(
        self,
        *,
        namespace: str | None = None,
        limit: int | None = None,
    ) -> list[BrowserAuditEntry]:
        """返回审计账(newest first);可按 namespace 过滤、按 limit 截断。"""
        with self._lock:
            records = list(self._entries)
        records.reverse()  # newest first
        if namespace is not None:
            ns_key = (namespace or "").strip()
            records = [r for r in records if r.namespace == ns_key]
        if limit is not None and limit >= 0:
            records = records[:limit]
        return records

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


__all__ = [
    "ManagementNamespace",
    "NAMESPACES",
    "BrowserStateSnapshot",
    "BrowserAuditEntry",
    "RecordOutcome",
    "BrowserAuditTrail",
]

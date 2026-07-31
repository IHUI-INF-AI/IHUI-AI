"""风控审计日志 — 记录所有反风控相关事件,供事后追溯 + 风险分析。

反风控核心:可观测性。无审计的反风控是黑盒,出问题无法定位。
本模块记录所有反风控相关事件,持久化到 JSONL 文件,自动 rotate。

事件类型:
- publish_attempt: 发布尝试(success/risk_score/duration)
- cooldown_event: 冷却事件(enter/exit/auto_release)
- risk_event: 风险事件(评分变化/平台风控触发)
- cross_account_alert: 跨账号关联告警(指纹/IP/UA 重叠)

设计:
- 单例模式(多适配器共享同一审计器)
- 线程安全(threading.Lock)
- JSONL 持久化(每行一个事件,易解析易追加)
- 自动 rotate(超过 10000 条时保留最新 10000 条)
- 路径:.trae-cn/tmp/anti-audit-log.jsonl(AGENTS.md §15)
"""
from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


# 审计日志持久化路径(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_AUDIT_FILE = Path(os.environ.get(
    "ANTI_RISK_AUDIT_FILE",
    ".trae-cn/tmp/anti-audit-log.jsonl",
)).resolve()

# 自动 rotate 阈值
_MAX_EVENTS = 10000
# rotate 时保留的事件数
_KEEP_ON_ROTATE = 8000


# 事件类型枚举(字符串常量,便于 Grep)
EVENT_PUBLISH_ATTEMPT = "publish_attempt"
EVENT_COOLDOWN = "cooldown_event"
EVENT_RISK = "risk_event"
EVENT_CROSS_ACCOUNT_ALERT = "cross_account_alert"

# 严重度枚举
SEVERITY_INFO = "info"
SEVERITY_WARNING = "warning"
SEVERITY_ERROR = "error"
SEVERITY_CRITICAL = "critical"


@dataclass
class AuditEvent:
    """审计事件。

    Attributes:
        timestamp: ISO 格式时间戳(UTC)
        event_type: 事件类型(publish_attempt/cooldown_event/risk_event/...)
        account_id: 账号唯一标识(跨账号告警时为多个 ID 用逗号分隔)
        platform: 平台 ID
        severity: 严重度(info/warning/error/critical)
        details: 事件详情(可序列化为 JSON)
    """

    timestamp: str
    event_type: str
    account_id: str
    platform: str
    severity: str = SEVERITY_INFO
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_jsonl(self) -> str:
        """序列化为 JSONL 一行。"""
        return json.dumps(self.to_dict(), ensure_ascii=False)


def _now_iso() -> str:
    """当前 UTC 时间 ISO 格式。"""
    return datetime.now(timezone.utc).isoformat()


class AuditLogger:
    """风控审计日志(单例)。

    所有反风控相关事件通过此单例记录,持久化到 JSONL 文件,
    自动 rotate 防止无限增长。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # 内存缓冲(批量刷盘,减少 IO)
        self._buffer: list[AuditEvent] = []
        self._buffer_size = 0
        self._max_buffer = 50  # 缓冲满 50 条刷盘一次
        # 内存最近事件(供 get_recent_events 查询,无需读文件)
        self._recent: list[AuditEvent] = []
        self._max_recent = 500  # 内存保留最近 500 条
        self._total_written = 0
        self._last_rotate_check = 0.0

    def _flush_buffer(self) -> None:
        """将缓冲区写入文件(锁内调用)。"""
        if not self._buffer:
            return
        try:
            _AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
            # 追加模式写入
            with _AUDIT_FILE.open("a", encoding="utf-8") as f:
                for evt in self._buffer:
                    f.write(evt.to_jsonl() + "\n")
            self._total_written += len(self._buffer)
            self._buffer.clear()
            self._buffer_size = 0
        except OSError as e:
            logger.warning("[audit] 刷盘失败: %s", e)

        # 定期检查是否需要 rotate(每 1000 次写入检查一次)
        now = time.time()
        if now - self._last_rotate_check > 60:  # 至少 60s 检查一次
            self._last_rotate_check = now
            self._maybe_rotate()

    def _maybe_rotate(self) -> None:
        """检查文件大小,超过阈值则 rotate(保留最新 N 条)。

        锁内调用,但文件操作在锁外执行以避免长持有锁。
        """
        try:
            if not _AUDIT_FILE.is_file():
                return
            # 快速行数统计(避免 readlines 大文件)
            line_count = 0
            with _AUDIT_FILE.open("r", encoding="utf-8") as f:
                for _ in f:
                    line_count += 1
                    if line_count > _MAX_EVENTS:
                        break
            if line_count <= _MAX_EVENTS:
                return
        except OSError:
            return

        # 需要_rotate — 读取所有行,保留最后 _KEEP_ON_ROTATE 条
        # 注意:此操作在锁内,但 rotate 不频繁(>10000 条才触发),可接受
        try:
            with _AUDIT_FILE.open("r", encoding="utf-8") as f:
                lines = f.readlines()
            if len(lines) <= _KEEP_ON_ROTATE:
                return
            kept = lines[-_KEEP_ON_ROTATE:]
            # 原子写:先写临时文件再替换
            tmp_file = _AUDIT_FILE.with_suffix(".tmp")
            with tmp_file.open("w", encoding="utf-8") as f:
                f.writelines(kept)
            tmp_file.replace(_AUDIT_FILE)
            logger.info(
                "[audit] rotate 完成:从 %d 条压缩到 %d 条",
                len(lines), len(kept),
            )
        except OSError as e:
            logger.warning("[audit] rotate 失败: %s", e)

    def _log(self, event: AuditEvent) -> None:
        """内部记录事件(已持有锁)。"""
        # 缓冲待刷盘
        self._buffer.append(event)
        self._buffer_size += 1
        # 加入内存最近列表
        self._recent.append(event)
        if len(self._recent) > self._max_recent:
            self._recent.pop(0)
        # 缓冲满则刷盘
        if self._buffer_size >= self._max_buffer:
            self._flush_buffer()

    # -----------------------------------------------------------------
    # 公开 API
    # -----------------------------------------------------------------

    def log_publish_attempt(
        self,
        account_id: str,
        platform: str,
        success: bool,
        risk_score: int,
        duration_ms: int,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        """记录发布尝试事件。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            success: 是否成功
            risk_score: 发布时账号风险评分(0-100)
            duration_ms: 发布耗时(毫秒)
            details: 附加详情(如 published_url/error_message)
        """
        event = AuditEvent(
            timestamp=_now_iso(),
            event_type=EVENT_PUBLISH_ATTEMPT,
            account_id=account_id,
            platform=platform,
            severity=SEVERITY_INFO if success else SEVERITY_WARNING,
            details={
                "success": success,
                "risk_score": risk_score,
                "duration_ms": duration_ms,
                **(details or {}),
            },
        )
        with self._lock:
            self._log(event)

    def log_cooldown_event(
        self,
        account_id: str,
        platform: str,
        action: str,  # 'enter' | 'exit' | 'auto_release'
        reason: str,
        duration: int = 0,
    ) -> None:
        """记录冷却事件。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            action: 动作(enter/exit/auto_release)
            reason: 冷却原因
            duration: 冷却时长(秒,enter 时有效)
        """
        severity = (
            SEVERITY_WARNING if action == "enter"
            else SEVERITY_INFO  # exit / auto_release
        )
        event = AuditEvent(
            timestamp=_now_iso(),
            event_type=EVENT_COOLDOWN,
            account_id=account_id,
            platform=platform,
            severity=severity,
            details={
                "action": action,
                "reason": reason,
                "duration_seconds": duration,
            },
        )
        with self._lock:
            self._log(event)

    def log_risk_event(
        self,
        account_id: str,
        platform: str,
        event_type: str,
        severity: str,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        """记录风险事件(评分变化/平台风控触发等)。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            event_type: 风险事件类型(如 platform_risk_trigger/fingerprint_change)
            severity: 严重度(info/warning/error/critical)
            details: 事件详情
        """
        event = AuditEvent(
            timestamp=_now_iso(),
            event_type=EVENT_RISK,
            account_id=account_id,
            platform=platform,
            severity=severity,
            details={
                "risk_event_type": event_type,
                **(details or {}),
            },
        )
        with self._lock:
            self._log(event)

    def log_cross_account_alert(
        self,
        account_ids: list[str],
        platform: str,
        alert_type: str,  # 'fingerprint_overlap' | 'ip_overlap' | 'ua_overlap' | 'time_overlap'
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        """记录跨账号关联告警。

        Args:
            account_ids: 涉及的账号 ID 列表
            platform: 平台 ID
            alert_type: 告警类型(fingerprint_overlap/ip_overlap/ua_overlap/time_overlap)
            details: 告警详情(如 isolation_score/recommendations)
        """
        event = AuditEvent(
            timestamp=_now_iso(),
            event_type=EVENT_CROSS_ACCOUNT_ALERT,
            account_id=",".join(account_ids),
            platform=platform,
            severity=SEVERITY_WARNING,
            details={
                "alert_type": alert_type,
                "account_count": len(account_ids),
                **(details or {}),
            },
        )
        with self._lock:
            self._log(event)

    def get_recent_events(
        self,
        limit: int = 100,
        account_id: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> list[AuditEvent]:
        """查询最近事件(从内存缓冲,毫秒级返回)。

        Args:
            limit: 最多返回条数
            account_id: 过滤账号(可选)
            platform: 过滤平台(可选)

        Returns:
            AuditEvent 列表(倒序,最新在前)
        """
        with self._lock:
            events = list(self._recent)

        # 过滤
        if account_id:
            events = [e for e in events if account_id in e.account_id]
        if platform:
            events = [e for e in events if e.platform == platform]

        # 倒序 + 限制
        events.reverse()
        return events[:max(1, min(limit, len(events)))]

    def flush(self) -> None:
        """强制刷盘(进程退出前调用)。"""
        with self._lock:
            self._flush_buffer()

    def stats(self) -> dict[str, Any]:
        """返回审计统计。"""
        with self._lock:
            return {
                "buffered": self._buffer_size,
                "in_memory_recent": len(self._recent),
                "total_written": self._total_written,
                "audit_file": str(_AUDIT_FILE),
                "file_exists": _AUDIT_FILE.is_file(),
            }

    @classmethod
    def get_instance(cls) -> "AuditLogger":
        """获取全局 AuditLogger 单例(类方法,便于 scheduler 调用)。"""
        return get_instance()


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_logger: Optional[AuditLogger] = None
_global_logger_lock = threading.Lock()


def get_instance() -> AuditLogger:
    """获取全局 AuditLogger 单例。"""
    global _global_logger
    if _global_logger is None:
        with _global_logger_lock:
            if _global_logger is None:
                _global_logger = AuditLogger()
    return _global_logger


__all__ = [
    "AuditEvent",
    "AuditLogger",
    "get_instance",
    "EVENT_PUBLISH_ATTEMPT",
    "EVENT_COOLDOWN",
    "EVENT_RISK",
    "EVENT_CROSS_ACCOUNT_ALERT",
    "SEVERITY_INFO",
    "SEVERITY_WARNING",
    "SEVERITY_ERROR",
    "SEVERITY_CRITICAL",
]

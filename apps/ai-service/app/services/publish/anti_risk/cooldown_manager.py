"""账号冷却管理器 — 平台风控触发后自动冷却账号。

反风控核心:平台返回"操作频繁"/"账号异常"等风控信号时,立即冷却账号,
避免在已被盯上的账号上继续操作导致封号。冷却期间拒绝发布请求。

冷却策略(按平台风控信号严重度):
- 平台返回"操作频繁"     → 冷却 30 分钟
- 平台返回"账号异常"     → 冷却 24 小时
- 平台返回"风控限制"     → 冷却 72 小时
- 连续 3 次失败           → 冷却 1 小时
- 风险评分 high          → 冷却 1 小时
- 风险评分 critical      → 冷却 24 小时

设计:
- 单例模式(多适配器共享同一冷却管理器)
- 线程安全(threading.Lock + double-check)
- 冷却状态持久化到 .trae-cn/tmp/anti-cooldowns.json(AGENTS.md §15)
- 进程重启后从文件恢复活跃冷却
- 自动过期(auto_release=True 时,到期自动失效)
"""
from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


# 冷却状态持久化路径(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_COOLDOWNS_FILE = Path(os.environ.get(
    "ANTI_RISK_COOLDOWNS_FILE",
    ".trae-cn/tmp/anti-cooldowns.json",
)).resolve()


# 冷却时长预设(秒)
COOLDOWN_30_MIN = 1800       # 操作频繁
COOLDOWN_1_HOUR = 3600       # 风险评分 high / 连续 3 次失败
COOLDOWN_24_HOUR = 86400     # 账号异常 / 风险评分 critical
COOLDOWN_72_HOUR = 259200    # 风控限制


# 平台风控关键词 → 冷却时长映射(按严重度排序,首匹配优先)
# 命中"风控限制"比"操作频繁"更严重,需先匹配更严重的
_PLATFORM_RISK_COOLDOWNS: tuple[tuple[str, int], ...] = (
    ("风控限制", COOLDOWN_72_HOUR),
    ("账号异常", COOLDOWN_24_HOUR),
    ("账号已被限制", COOLDOWN_24_HOUR),
    ("安全验证", COOLDOWN_24_HOUR),
    ("操作频繁", COOLDOWN_30_MIN),
    ("请求过于频繁", COOLDOWN_30_MIN),
    ("操作过于频繁", COOLDOWN_30_MIN),
    ("稍后再试", COOLDOWN_30_MIN),
    ("请稍后", COOLDOWN_30_MIN),
    ("请验证", COOLDOWN_30_MIN),
    ("滑块验证", COOLDOWN_30_MIN),
    ("图形验证", COOLDOWN_30_MIN),
    ("短信验证", COOLDOWN_30_MIN),
)


@dataclass
class CooldownState:
    """账号冷却状态。

    Attributes:
        account_id: 账号唯一标识
        platform: 平台 ID
        reason: 冷却原因(人类可读)
        started_at: 冷却开始时间戳
        ends_at: 冷却结束时间戳(到期后自动失效)
        auto_release: 是否自动释放(True 时到期自动失效,False 需手动 exit)
    """

    account_id: str
    platform: str
    reason: str
    started_at: float
    ends_at: float
    auto_release: bool = True

    def is_active(self) -> bool:
        """是否仍在冷却中(未到期)。"""
        return time.time() < self.ends_at

    def remaining_seconds(self) -> int:
        """剩余秒数(0=已到期或未冷却)。"""
        remain = self.ends_at - time.time()
        return max(0, int(remain))

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 持久化的 dict。"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CooldownState":
        """从 dict 反序列化。"""
        return cls(
            account_id=data.get("account_id", ""),
            platform=data.get("platform", ""),
            reason=data.get("reason", ""),
            started_at=float(data.get("started_at", 0.0)),
            ends_at=float(data.get("ends_at", 0.0)),
            auto_release=bool(data.get("auto_release", True)),
        )


def cooldown_duration_for_error(error_message: str) -> tuple[int, str]:
    """根据平台错误信息返回冷却时长 + 触发原因。

    Args:
        error_message: 平台返回的错误信息

    Returns:
        (duration_seconds, reason) — duration=0 表示无风控关键词命中。
    """
    if not error_message:
        return (0, "")
    for keyword, duration in _PLATFORM_RISK_COOLDOWNS:
        if keyword in error_message:
            return (duration, f"平台风控触发: 含 '{keyword}'")
    return (0, "")


class CooldownManager:
    """账号冷却管理器(单例)。

    管理所有账号+平台的冷却状态,线程安全,文件持久化。
    冷却到期后自动失效(auto_release=True 时)。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # 冷却状态:(account_id, platform) -> CooldownState
        self._cooldowns: dict[tuple[str, str], CooldownState] = {}
        # 连续失败计数:(account_id, platform) -> count
        self._fail_streaks: dict[tuple[str, str], int] = {}
        self._loaded = False

    def _ensure_loaded(self) -> None:
        """惰性加载持久化的冷却文件(进程重启后恢复)。"""
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            try:
                if _COOLDOWNS_FILE.is_file():
                    data = json.loads(_COOLDOWNS_FILE.read_text(encoding="utf-8"))
                    cooldowns = data.get("cooldowns", []) if isinstance(data, dict) else []
                    loaded = 0
                    now = time.time()
                    for cd_dict in cooldowns:
                        if not isinstance(cd_dict, dict):
                            continue
                        state = CooldownState.from_dict(cd_dict)
                        # 跳过已过期且 auto_release 的冷却
                        if state.auto_release and state.ends_at <= now:
                            continue
                        key = (state.account_id, state.platform)
                        self._cooldowns[key] = state
                        loaded += 1
                    if loaded:
                        logger.info(
                            "[cooldown] 加载 %d 个活跃冷却(过滤已过期)",
                            loaded,
                        )
            except (OSError, json.JSONDecodeError, ValueError) as e:
                logger.warning("[cooldown] 加载冷却文件失败: %s", e)
            self._loaded = True

    def _persist(self) -> None:
        """持久化所有活跃冷却到文件(锁内调用,需持有 self._lock)。"""
        try:
            _COOLDOWNS_FILE.parent.mkdir(parents=True, exist_ok=True)
            # 仅持久化活跃冷却(过滤已过期的 auto_release 项)
            now = time.time()
            active_states = [
                state.to_dict()
                for state in self._cooldowns.values()
                if not (state.auto_release and state.ends_at <= now)
            ]
            data = {"cooldowns": active_states}
            _COOLDOWNS_FILE.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            logger.warning("[cooldown] 持久化失败: %s", e)

    # -----------------------------------------------------------------
    # 公开 API
    # -----------------------------------------------------------------

    def enter_cooldown(
        self,
        account_id: str,
        platform: str,
        duration_seconds: int,
        reason: str,
        auto_release: bool = True,
    ) -> CooldownState:
        """让账号进入冷却。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            duration_seconds: 冷却时长(秒)
            reason: 冷却原因(人类可读)
            auto_release: True 时到期自动失效;False 时需手动 exit_cooldown

        Returns:
            CooldownState 实例
        """
        if duration_seconds <= 0:
            logger.warning(
                "[cooldown] duration_seconds<=0, 忽略: account=%s platform=%s",
                account_id, platform,
            )
            # 返回一个已过期的 state 占位
            now = time.time()
            return CooldownState(
                account_id=account_id, platform=platform, reason=reason,
                started_at=now, ends_at=now, auto_release=auto_release,
            )

        self._ensure_loaded()
        now = time.time()
        state = CooldownState(
            account_id=account_id,
            platform=platform,
            reason=reason,
            started_at=now,
            ends_at=now + duration_seconds,
            auto_release=auto_release,
        )
        with self._lock:
            existing = self._cooldowns.get((account_id, platform))
            # 若已有更长的冷却,保留更长的(避免短冷却覆盖长冷却)
            if existing and existing.ends_at > state.ends_at:
                logger.info(
                    "[cooldown] 账号 %s/%s 已有更长冷却(剩余 %ds),保留原冷却",
                    account_id, platform, existing.remaining_seconds(),
                )
                return existing
            self._cooldowns[(account_id, platform)] = state
            self._persist()

        logger.warning(
            "[cooldown] 账号 %s/%s 进入冷却 %ds(原因: %s)",
            account_id, platform, duration_seconds, reason,
        )
        return state

    def is_in_cooldown(
        self,
        account_id: str,
        platform: str,
    ) -> tuple[bool, Optional[CooldownState]]:
        """检查账号是否在冷却中。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID

        Returns:
            (in_cooldown, state) — in_cooldown=True 时 state 非 None。
            自动释放到期项会被惰性清理。
        """
        self._ensure_loaded()
        key = (account_id, platform)
        with self._lock:
            state = self._cooldowns.get(key)
            if state is None:
                return (False, None)
            # 惰性清理已过期的 auto_release 项
            if state.auto_release and not state.is_active():
                self._cooldowns.pop(key, None)
                self._persist()
                return (False, None)
            return (True, state)

    def get_remaining_time(self, account_id: str, platform: str) -> int:
        """获取剩余冷却秒数。

        Returns:
            剩余秒数,0=未冷却或已到期
        """
        in_cd, state = self.is_in_cooldown(account_id, platform)
        if not in_cd or state is None:
            return 0
        return state.remaining_seconds()

    def exit_cooldown(self, account_id: str, platform: str) -> bool:
        """手动退出冷却。

        Returns:
            True 表示原在冷却中已退出;False 表示原本未在冷却
        """
        self._ensure_loaded()
        key = (account_id, platform)
        with self._lock:
            existed = self._cooldowns.pop(key, None)
            if existed is not None:
                self._persist()
                logger.info(
                    "[cooldown] 账号 %s/%s 手动退出冷却(原因: %s)",
                    account_id, platform, existed.reason,
                )
                return True
            return False

    def list_active_cooldowns(self) -> list[CooldownState]:
        """列出所有活跃冷却(已过期的 auto_release 项自动清理)。"""
        self._ensure_loaded()
        now = time.time()
        with self._lock:
            # 清理过期项
            expired_keys = [
                key for key, state in self._cooldowns.items()
                if state.auto_release and state.ends_at <= now
            ]
            for key in expired_keys:
                self._cooldowns.pop(key, None)
            if expired_keys:
                self._persist()
            return list(self._cooldowns.values())

    def record_failure(self, account_id: str, platform: str) -> Optional[CooldownState]:
        """记录一次失败,连续 3 次失败自动进入 1 小时冷却。

        Returns:
            进入冷却时返回 CooldownState,否则返回 None
        """
        self._ensure_loaded()
        key = (account_id, platform)
        with self._lock:
            self._fail_streaks[key] = self._fail_streaks.get(key, 0) + 1
            streak = self._fail_streaks[key]

        if streak >= 3:
            # 进入冷却并重置计数
            with self._lock:
                self._fail_streaks[key] = 0
            return self.enter_cooldown(
                account_id, platform, COOLDOWN_1_HOUR,
                f"连续 {streak} 次发布失败",
            )
        return None

    def record_success(self, account_id: str, platform: str) -> None:
        """记录一次成功,重置连续失败计数。"""
        self._ensure_loaded()
        key = (account_id, platform)
        with self._lock:
            self._fail_streaks.pop(key, None)

    @classmethod
    def get_instance(cls) -> "CooldownManager":
        """获取全局 CooldownManager 单例(类方法,便于 scheduler 调用)。"""
        return get_instance()


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_manager: Optional[CooldownManager] = None
_global_manager_lock = threading.Lock()


def get_instance() -> CooldownManager:
    """获取全局 CooldownManager 单例。"""
    global _global_manager
    if _global_manager is None:
        with _global_manager_lock:
            if _global_manager is None:
                _global_manager = CooldownManager()
    return _global_manager


__all__ = [
    "CooldownState",
    "CooldownManager",
    "get_instance",
    "cooldown_duration_for_error",
    "COOLDOWN_30_MIN",
    "COOLDOWN_1_HOUR",
    "COOLDOWN_24_HOUR",
    "COOLDOWN_72_HOUR",
]

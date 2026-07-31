"""账号 profile 持久化 — 同账号跨会话指纹/代理/Cookie 稳定。

反风控核心:平台通过 Cookie + 浏览器存储识别"是否同一会话"。
如果每次启动都新建 context → 平台判定"新设备登录"→ 触发安全告警。
本模块为每个账号持久化:
1. 指纹(同账号永远同指纹)— fingerprint_isolation 生成
2. 代理(同账号永远同 IP)— proxy_pool 分配
3. 浏览器 user_data_dir(持久化 Cookie/LocalStorage/IndexedDB)— Playwright launch_persistent_context

持久化结构:
  .trae-cn/tmp/anti-profiles/<account_id>/
    ├── profile.json         — 指纹 + 代理配置(跨会话稳定)
    └── browser-data/        — Playwright 持久化浏览器目录(Cookie/Storage)

设计:
- get_account_profile(account_id) 查缓存→查文件→生成并持久化
- 进程内缓存避免重复 IO
- 线程安全(多适配器并行发布)
"""
from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from app.core.logging import get_logger
from .fingerprint_isolation import BrowserFingerprint, generate_fingerprint
from .proxy_pool import ProxyConfig, get_proxy_pool

logger = get_logger(__name__)


# Profile 根目录(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_PROFILE_ROOT = Path(os.environ.get(
    "ANTI_RISK_PROFILE_DIR",
    ".trae-cn/tmp/anti-profiles",
)).resolve()


@dataclass
class AccountProfile:
    """账号完整画像(跨会话稳定)。

    所有字段持久化到 profile.json,同账号跨会话读取同一份。
    """

    account_id: str
    platform: str
    fingerprint: BrowserFingerprint
    proxy: ProxyConfig | None  # 可能为 None(未配置代理时直连)
    user_data_dir: str  # Playwright 持久化浏览器目录(绝对路径)
    created_at: float  # 创建时间戳(用于审计)

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 持久化的 dict。"""
        return {
            "account_id": self.account_id,
            "platform": self.platform,
            "fingerprint": asdict(self.fingerprint),
            "proxy": asdict(self.proxy) if self.proxy else None,
            "user_data_dir": self.user_data_dir,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AccountProfile":
        """从 dict 反序列化。"""
        fp_data = data["fingerprint"]
        fingerprint = BrowserFingerprint(**fp_data)
        proxy = None
        if data.get("proxy"):
            proxy = ProxyConfig(**data["proxy"])
        return cls(
            account_id=data["account_id"],
            platform=data["platform"],
            fingerprint=fingerprint,
            proxy=proxy,
            user_data_dir=data["user_data_dir"],
            created_at=data["created_at"],
        )


# ---------------------------------------------------------------------------
# Profile 管理器(进程内缓存 + 文件持久化)
# ---------------------------------------------------------------------------

class _ProfileManager:
    """账号 profile 管理器:缓存 + 文件持久化。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cache: dict[str, AccountProfile] = {}

    def get(self, account_id: str, platform: str) -> AccountProfile:
        """获取账号 profile(查缓存→查文件→生成并持久化)。

        同账号永远返回同一 profile(跨会话稳定)。
        """
        # 快路径:缓存命中
        cached = self._cache.get(account_id)
        if cached:
            return cached

        with self._lock:
            # double-check
            cached = self._cache.get(account_id)
            if cached:
                return cached

            # 查文件
            profile_path = _PROFILE_ROOT / account_id / "profile.json"
            if profile_path.is_file():
                try:
                    data = json.loads(profile_path.read_text(encoding="utf-8"))
                    profile = AccountProfile.from_dict(data)
                    self._cache[account_id] = profile
                    logger.debug(
                        "[account_profile] 账号 %s profile 从文件加载",
                        account_id,
                    )
                    return profile
                except (json.JSONDecodeError, KeyError, TypeError) as e:
                    logger.warning(
                        "[account_profile] 账号 %s profile 文件损坏,重新生成: %s",
                        account_id, e,
                    )

            # 生成新 profile
            profile = self._create_new(account_id, platform)
            self._cache[account_id] = profile
            return profile

    def _create_new(self, account_id: str, platform: str) -> AccountProfile:
        """生成新 profile 并持久化到文件。"""
        import time

        fingerprint = generate_fingerprint(account_id)
        proxy = get_proxy_pool().get_proxy(account_id)

        # 浏览器持久化目录(每个账号独立,Cookie/Storage 隔离)
        user_data_dir = str(_PROFILE_ROOT / account_id / "browser-data")
        Path(user_data_dir).mkdir(parents=True, exist_ok=True)

        profile = AccountProfile(
            account_id=account_id,
            platform=platform,
            fingerprint=fingerprint,
            proxy=proxy,
            user_data_dir=user_data_dir,
            created_at=time.time(),
        )

        # 持久化到文件
        profile_dir = _PROFILE_ROOT / account_id
        profile_dir.mkdir(parents=True, exist_ok=True)
        profile_path = profile_dir / "profile.json"
        try:
            profile_path.write_text(
                json.dumps(profile.to_dict(), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            logger.info(
                "[account_profile] 账号 %s profile 创建并持久化: %s",
                account_id, profile_path,
            )
        except OSError as e:
            logger.error(
                "[account_profile] 账号 %s profile 持久化失败: %s",
                account_id, e,
            )

        return profile

    def invalidate(self, account_id: str) -> None:
        """使账号 profile 缓存失效(账号配置变更时调用)。"""
        with self._lock:
            self._cache.pop(account_id, None)


# 全局单例
_manager: _ProfileManager | None = None
_manager_lock = threading.Lock()


def get_account_profile(account_id: str, platform: str = "") -> AccountProfile:
    """获取账号 profile(全局单例管理)。

    Args:
        account_id: 账号唯一标识(建议格式:平台_用户名,如 csdn_zhangsan)
        platform: 平台 ID(仅首次创建时用于记录,后续忽略)

    Returns:
        AccountProfile(跨会话稳定)
    """
    global _manager
    if _manager is None:
        with _manager_lock:
            if _manager is None:
                _manager = _ProfileManager()
    return _manager.get(account_id, platform)


__all__ = ["AccountProfile", "get_account_profile"]

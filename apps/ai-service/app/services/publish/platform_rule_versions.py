"""规则版本管理 — 跟踪平台规则变更 + 失效检测。

platform_rules.py 维护 38 平台的发布规则,但平台规则会随时变更。
本模块负责:
1. 跟踪每平台规则的当前版本号 + 最后更新时间 + 官方规则页
2. 检测规则是否过期(超过 90 天未更新 → 告警)
3. 记录规则变更历史(change_log)
4. 列出所有过期规则(便于运维定期复查)

设计:
- RuleVersion:单平台版本信息 dataclass
- RuleVersionManager:版本管理器,延迟从 platform_rules.PLATFORM_RULES 读取初始数据
- 持久化:change_log 仅在内存,生产环境应接入 DB(本模块提供 hook,不硬编码 DB)

诚实边界:
- 初始数据从 PLATFORM_RULES 同步(rule_version / rule_updated_at / platform_official_url)
- check_rule_outdated 基于 rule_updated_at 字段做日期比较
- record_rule_change 仅更新内存状态,不持久化(需要持久化由调用方实现)
- 默认 90 天阈值(可配置),与 platform_rules.py 文件头建议的"每季度复查"一致
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from app.core.logging import get_logger

from .platform_rules import PLATFORM_RULES, PlatformRule

logger = get_logger(__name__)


@dataclass
class RuleVersion:
    """单平台规则版本信息。

    字段说明:
    - platform: 平台 ID(与 PLATFORM_RULES key 一致)
    - current_version: 当前版本号(YYYY.MM.DD 格式,与 PlatformRule.rule_version 一致)
    - last_updated: 最后更新时间(YYYY-MM-DD)
    - official_rule_url: 平台规则官方页面 URL
    - change_log: 历史变更记录列表(每条格式:"v_old → v_new: 变更说明")
    """

    platform: str
    current_version: str = ""
    last_updated: str = ""
    official_rule_url: str = ""
    change_log: list[str] = field(default_factory=list)


def _build_initial_version(rule: PlatformRule) -> RuleVersion:
    """从 PlatformRule 构造初始 RuleVersion。"""
    return RuleVersion(
        platform=rule.platform_id,
        current_version=rule.rule_version,
        last_updated=rule.rule_updated_at,
        official_rule_url=rule.platform_official_url,
        change_log=[],
    )


# ---------------------------------------------------------------------------
# RuleVersionManager — 版本管理器
# ---------------------------------------------------------------------------


class RuleVersionManager:
    """规则版本管理器 — 跟踪平台规则变更 + 失效检测。

    使用方式:
        mgr = RuleVersionManager()
        if mgr.check_rule_outdated("wechat"):
            logger.warning("wechat 规则已过期,需复查")
        mgr.record_rule_change(
            "wechat",
            old_version="2026.07.31",
            new_version="2026.10.31",
            changes=["标题字数上限 64 → 80", "新增禁用词 XXX"],
        )

    持久化:
    - change_log 仅在内存;如需持久化,子类化并重写 record_rule_change,
      或在调用方处理 on_change 回调。
    """

    def __init__(self, outdated_days_threshold: int = 90) -> None:
        """初始化版本管理器。

        Args:
            outdated_days_threshold: 过期阈值天数(默认 90 天 = 一个季度)
        """
        if outdated_days_threshold < 0:
            raise ValueError(
                f"outdated_days_threshold 不能为负数,收到 {outdated_days_threshold}"
            )
        self._outdated_days_threshold: int = outdated_days_threshold
        # 延迟从 PLATFORM_RULES 同步初始数据
        self._versions: dict[str, RuleVersion] = {
            platform: _build_initial_version(rule)
            for platform, rule in PLATFORM_RULES.items()
        }

    # ----- 查询接口 -----

    def get_current_version(self, platform: str) -> Optional[RuleVersion]:
        """获取平台当前规则版本信息。

        Args:
            platform: 平台 ID

        Returns:
            RuleVersion 或 None(平台未配置)
        """
        return self._versions.get(platform)

    def list_all_platforms(self) -> list[str]:
        """列出所有已跟踪版本的平台 ID。"""
        return list(self._versions.keys())

    # ----- 失效检测 -----

    def check_rule_outdated(self, platform: str) -> bool:
        """检测平台规则是否过期(超过阈值天数未更新)。

        Args:
            platform: 平台 ID

        Returns:
            True = 过期(需复查)
            False = 未过期 / 平台未配置(未配置视为未过期,避免误报)
        """
        version = self._versions.get(platform)
        if version is None:
            logger.debug(
                "[platform_rule_versions] 平台 %s 未配置版本信息,跳过过期检测",
                platform,
            )
            return False
        if not version.last_updated:
            # 未记录更新时间,视为过期
            return True
        try:
            updated_date = datetime.strptime(version.last_updated, "%Y-%m-%d")
        except ValueError:
            logger.warning(
                "[platform_rule_versions] 平台 %s last_updated 格式无效: %s",
                platform, version.last_updated,
            )
            return True
        cutoff = datetime.now() - timedelta(days=self._outdated_days_threshold)
        return updated_date < cutoff

    def list_all_outdated(self) -> list[str]:
        """列出所有过期规则的平台 ID(按字母序)。

        Returns:
            过期平台 ID 列表
        """
        outdated: list[str] = []
        for platform in self._versions:
            if self.check_rule_outdated(platform):
                outdated.append(platform)
        outdated.sort()
        return outdated

    def list_all_up_to_date(self) -> list[str]:
        """列出所有未过期规则的平台 ID(便于对比)。"""
        up_to_date: list[str] = []
        for platform in self._versions:
            if not self.check_rule_outdated(platform):
                up_to_date.append(platform)
        up_to_date.sort()
        return up_to_date

    # ----- 变更记录 -----

    def record_rule_change(
        self,
        platform: str,
        old_version: str,
        new_version: str,
        changes: list[str],
    ) -> bool:
        """记录平台规则变更,更新 current_version + last_updated + change_log。

        Args:
            platform: 平台 ID
            old_version: 旧版本号(YYYY.MM.DD)
            new_version: 新版本号(YYYY.MM.DD)
            changes: 变更说明列表(每条一句话)

        Returns:
            True = 记录成功
            False = 平台未配置 / old_version 与当前不匹配(版本不一致告警)
        """
        version = self._versions.get(platform)
        if version is None:
            logger.warning(
                "[platform_rule_versions] 平台 %s 未配置,无法记录变更",
                platform,
            )
            return False

        # 版本一致性检查(防止并发更新覆盖)
        if version.current_version and old_version and version.current_version != old_version:
            logger.warning(
                "[platform_rule_versions] 平台 %s 版本不一致:期望 %s,实际 %s,"
                "仍将记录新版本 %s",
                platform, old_version, version.current_version, new_version,
            )

        today = datetime.now().strftime("%Y-%m-%d")
        change_entry = (
            f"v{old_version} → v{new_version} ({today}): "
            + ("; ".join(changes) if changes else "无具体变更说明")
        )
        version.change_log.append(change_entry)
        version.current_version = new_version
        version.last_updated = today

        logger.info(
            "[platform_rule_versions] 平台 %s 规则更新:%s → %s,变更 %d 项",
            platform, old_version, new_version, len(changes),
        )
        return True

    def get_change_log(self, platform: str) -> list[str]:
        """获取平台规则变更历史(按时间正序)。"""
        version = self._versions.get(platform)
        if version is None:
            return []
        return list(version.change_log)

    # ----- 批量操作 -----

    def bulk_check_outdated(self, platforms: Optional[list[str]] = None) -> dict[str, bool]:
        """批量检测规则过期状态。

        Args:
            platforms: 待检测平台列表(None = 全部)

        Returns:
            {平台 ID: 是否过期}
        """
        targets = platforms if platforms is not None else list(self._versions.keys())
        return {p: self.check_rule_outdated(p) for p in targets}

    def get_outdated_summary(self) -> dict[str, object]:
        """获取过期规则摘要(便于运维一次性查看)。

        Returns:
            {
                "total_platforms": int,
                "outdated_count": int,
                "outdated_platforms": list[str],
                "up_to_date_count": int,
                "threshold_days": int,
            }
        """
        outdated = self.list_all_outdated()
        return {
            "total_platforms": len(self._versions),
            "outdated_count": len(outdated),
            "outdated_platforms": outdated,
            "up_to_date_count": len(self._versions) - len(outdated),
            "threshold_days": self._outdated_days_threshold,
        }


# ---------------------------------------------------------------------------
# 模块级单例(便于直接调用,不需要每次实例化)
# ---------------------------------------------------------------------------


_default_manager: Optional[RuleVersionManager] = None


def _get_default_manager() -> RuleVersionManager:
    """获取模块级默认 RuleVersionManager 单例(惰性初始化)。"""
    global _default_manager
    if _default_manager is None:
        _default_manager = RuleVersionManager()
    return _default_manager


def get_current_version(platform: str) -> Optional[RuleVersion]:
    """模块级便捷函数:获取平台当前规则版本(使用默认单例)。"""
    return _get_default_manager().get_current_version(platform)


def check_rule_outdated(platform: str) -> bool:
    """模块级便捷函数:检测平台规则是否过期(使用默认单例)。"""
    return _get_default_manager().check_rule_outdated(platform)


def record_rule_change(
    platform: str,
    old_version: str,
    new_version: str,
    changes: list[str],
) -> bool:
    """模块级便捷函数:记录平台规则变更(使用默认单例)。"""
    return _get_default_manager().record_rule_change(
        platform, old_version, new_version, changes,
    )


def list_all_outdated() -> list[str]:
    """模块级便捷函数:列出所有过期规则(使用默认单例)。"""
    return _get_default_manager().list_all_outdated()


__all__ = [
    "RuleVersion",
    "RuleVersionManager",
    "get_current_version",
    "check_rule_outdated",
    "record_rule_change",
    "list_all_outdated",
]

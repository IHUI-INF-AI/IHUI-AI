"""跨账号关联防护 — 防止不同账号被平台识别为同一操作者。

反风控核心:平台通过指纹/IP/时序/User-Agent 关联多个账号,一旦关联即判定
"同一设备操作多账号"→ 集体封号(交叉检测)。本模块在批量发布前验证
账号间隔离度,关联度过高时拒绝发布。

检查维度(4 类):
1. 指纹相似度(8 维指纹对比,>70% 相似 → 高危)
2. IP 重叠(同 IP 不同账号 → 高危)
3. 时序重叠(同 5 分钟内不同账号发布 → 中危)
4. User-Agent 重叠(完全相同 → 高危)

设计:
- 单例模式(多适配器共享同一守护器)
- 线程安全(threading.Lock + double-check)
- 账号会话记录内存缓存(进程内)
- 纯计算(无 IO,毫秒级返回)
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from app.core.logging import get_logger
from .fingerprint_isolation import BrowserFingerprint
from .proxy_pool import ProxyConfig

logger = get_logger(__name__)


# 相似度阈值
_FINGERPRINT_HIGH_SIMILARITY = 0.70  # > 70% 相似 → 高危
_FINGERPRINT_MEDIUM_SIMILARITY = 0.50  # 50-70% → 中危

# 时序重叠窗口(秒)
_TIME_OVERLAP_WINDOW = 300  # 5 分钟内同平台发布视为时序重叠

# 隔离评分阈值
_ISOLATION_SAFE = 80       # >= 80: 隔离度足够
_ISOLATION_MEDIUM = 50     # >= 50: 中等隔离(可发布但建议优化)
# < 50: 隔离度不足(高危,拒绝发布)


@dataclass
class IsolationReport:
    """两账号隔离度报告。

    Attributes:
        isolation_score: 0-100,100=完全隔离,0=完全相同
        risk_factors: 风险因素列表(人类可读)
        recommendations: 优化建议列表
    """

    isolation_score: int
    risk_factors: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)

    def is_safe(self) -> bool:
        """隔离度是否足够安全(>= 80)。"""
        return self.isolation_score >= _ISOLATION_SAFE

    def to_dict(self) -> dict[str, Any]:
        return {
            "isolation_score": self.isolation_score,
            "risk_factors": list(self.risk_factors),
            "recommendations": list(self.recommendations),
        }


@dataclass
class BatchValidation:
    """批量发布验证结果。

    Attributes:
        is_valid: True 表示所有账号隔离度足够,可批量发布
        overall_isolation_score: 整体隔离度评分(取最低值)
        reports: 每对账号的隔离报告(键格式:"account_a|account_b")
        rejected_pairs: 隔离度不足的账号对(拒绝发布)
    """

    is_valid: bool
    overall_isolation_score: int
    reports: dict[str, IsolationReport] = field(default_factory=dict)
    rejected_pairs: list[tuple[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "overall_isolation_score": self.overall_isolation_score,
            "reports": {k: v.to_dict() for k, v in self.reports.items()},
            "rejected_pairs": list(self.rejected_pairs),
        }


@dataclass
class _AccountSession:
    """账号会话记录(内存,用于跨账号隔离度计算)。"""

    account_id: str
    platform: str
    fingerprint: BrowserFingerprint
    proxy: Optional[ProxyConfig]
    user_agent: str
    last_publish_at: float


def _fingerprint_hash(fp: BrowserFingerprint) -> str:
    """计算指纹哈希(用于快速比较)。

    基于 8 维指纹的核心字段,同指纹同哈希。
    """
    parts = [
        fp.user_agent,
        f"{fp.viewport.get('width', 0)}x{fp.viewport.get('height', 0)}",
        fp.locale,
        fp.timezone_id,
        f"{fp.geolocation.get('latitude', 0):.4f},{fp.geolocation.get('longitude', 0):.4f}",
        fp.color_scheme,
        fp.platform,
        fp.sec_ch_ua,
    ]
    return "|".join(parts)


def _calculate_fingerprint_similarity(fp_a: BrowserFingerprint, fp_b: BrowserFingerprint) -> float:
    """计算两个指纹的相似度(0.0-1.0)。

    基于 8 维字段逐一比较,相同计 1,不同计 0,最后取平均值。
    """
    matches = 0
    total = 8

    if fp_a.user_agent == fp_b.user_agent:
        matches += 1
    if fp_a.viewport == fp_b.viewport:
        matches += 1
    if fp_a.locale == fp_b.locale:
        matches += 1
    if fp_a.timezone_id == fp_b.timezone_id:
        matches += 1
    if fp_a.geolocation == fp_b.geolocation:
        matches += 1
    if fp_a.color_scheme == fp_b.color_scheme:
        matches += 1
    if fp_a.platform == fp_b.platform:
        matches += 1
    if fp_a.sec_ch_ua == fp_b.sec_ch_ua:
        matches += 1

    return matches / total


class CrossAccountGuard:
    """跨账号关联防护(单例)。

    维护账号会话记录,在批量发布前验证账号间隔离度。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # 账号会话:(account_id, platform) -> _AccountSession
        self._sessions: dict[tuple[str, str], _AccountSession] = {}

    # -----------------------------------------------------------------
    # 公开 API
    # -----------------------------------------------------------------

    def record_account_session(
        self,
        account_id: str,
        platform: str,
        fingerprint: BrowserFingerprint,
        proxy: Optional[ProxyConfig] = None,
    ) -> None:
        """记录账号会话指纹(供后续隔离度计算)。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            fingerprint: 账号浏览器指纹
            proxy: 账号代理配置(可选)
        """
        key = (account_id, platform)
        session = _AccountSession(
            account_id=account_id,
            platform=platform,
            fingerprint=fingerprint,
            proxy=proxy,
            user_agent=fingerprint.user_agent,
            last_publish_at=time.time(),
        )
        with self._lock:
            self._sessions[key] = session
        logger.debug(
            "[cross_guard] 记录会话 account=%s platform=%s fp_hash=%s",
            account_id, platform, _fingerprint_hash(fingerprint)[:16],
        )

    def check_account_isolation(
        self,
        account_id_a: str,
        account_id_b: str,
        platform: Optional[str] = None,
    ) -> IsolationReport:
        """检查两个账号的隔离度。

        Args:
            account_id_a: 账号 A
            account_id_b: 账号 B
            platform: 平台 ID(可选,用于精确匹配会话)

        Returns:
            IsolationReport(含隔离评分 + 风险因素 + 建议)
        """
        # 同账号视为完全隔离
        if account_id_a == account_id_b:
            return IsolationReport(isolation_score=100)

        session_a = self._get_session(account_id_a, platform)
        session_b = self._get_session(account_id_b, platform)

        # 任一账号无会话记录 → 无法计算,视为隔离(降级)
        if session_a is None or session_b is None:
            return IsolationReport(
                isolation_score=100,
                recommendations=["至少一个账号无会话记录,无法精确计算隔离度"],
            )

        score = 100
        factors: list[str] = []
        recommendations: list[str] = []

        # 维度 1:指纹相似度
        similarity = _calculate_fingerprint_similarity(
            session_a.fingerprint, session_b.fingerprint,
        )
        if similarity >= _FINGERPRINT_HIGH_SIMILARITY:
            score -= 40
            factors.append(
                f"指纹高度相似({similarity:.0%},>70% 高危)"
            )
            recommendations.append("为账号 B 重新生成独立指纹(避免与账号 A 雷同)")
        elif similarity >= _FINGERPRINT_MEDIUM_SIMILARITY:
            score -= 20
            factors.append(f"指纹中度相似({similarity:.0%})")
            recommendations.append("考虑优化账号 B 的指纹差异化")

        # 维度 2:IP 重叠
        ip_a = session_a.proxy.server if session_a.proxy else "direct"
        ip_b = session_b.proxy.server if session_b.proxy else "direct"
        if ip_a == ip_b:
            # 同 IP 不同账号 → 高危
            if session_a.account_id != session_b.account_id:
                score -= 30
                factors.append(
                    f"IP 重叠(同 IP {ip_a} 操作不同账号,高危)"
                )
                recommendations.append("为账号 B 分配独立代理 IP")

        # 维度 3:时序重叠
        time_diff = abs(session_a.last_publish_at - session_b.last_publish_at)
        if time_diff < _TIME_OVERLAP_WINDOW:
            score -= 15
            factors.append(
                f"时序重叠(发布间隔 {int(time_diff)}s < 5min,中危)"
            )
            recommendations.append("错开账号发布时间(建议间隔 >=5 分钟)")

        # 维度 4:User-Agent 重叠
        if session_a.user_agent == session_b.user_agent:
            score -= 25
            factors.append("User-Agent 完全相同(高危)")
            recommendations.append("为账号 B 生成差异化 User-Agent")

        # 限制在 [0, 100]
        score = max(0, min(100, score))

        if not factors:
            factors.append("无风险因素,隔离度良好")

        return IsolationReport(
            isolation_score=score,
            risk_factors=factors,
            recommendations=recommendations,
        )

    def validate_publish_batch(
        self,
        account_ids: list[str],
        platform: str,
    ) -> BatchValidation:
        """批量发布前验证所有账号对的隔离度。

        Args:
            account_ids: 待批量发布的账号 ID 列表
            platform: 平台 ID

        Returns:
            BatchValidation(含整体评分 + 每对账号报告)
        """
        if len(account_ids) <= 1:
            return BatchValidation(
                is_valid=True,
                overall_isolation_score=100,
            )

        reports: dict[str, IsolationReport] = {}
        rejected: list[tuple[str, str]] = []
        min_score = 100

        # 两两比较
        for i in range(len(account_ids)):
            for j in range(i + 1, len(account_ids)):
                a = account_ids[i]
                b = account_ids[j]
                report = self.check_account_isolation(a, b, platform)
                pair_key = f"{a}|{b}"
                reports[pair_key] = report
                if report.isolation_score < min_score:
                    min_score = report.isolation_score
                if not report.is_safe():
                    rejected.append((a, b))

        # 整体隔离度 < 50 → 拒绝批量发布
        is_valid = min_score >= _ISOLATION_MEDIUM

        return BatchValidation(
            is_valid=is_valid,
            overall_isolation_score=min_score,
            reports=reports,
            rejected_pairs=rejected,
        )

    def _get_session(
        self, account_id: str, platform: Optional[str],
    ) -> Optional[_AccountSession]:
        """获取账号会话(优先精确平台匹配,否则取任意平台)。"""
        with self._lock:
            if platform:
                session = self._sessions.get((account_id, platform))
                if session:
                    return session
            # 退化:取该账号任意平台的会话
            for (aid, _plat), session in self._sessions.items():
                if aid == account_id:
                    return session
            return None

    def clear_session(self, account_id: str, platform: Optional[str] = None) -> None:
        """清除账号会话记录(账号删除/重置时调用)。"""
        with self._lock:
            if platform:
                self._sessions.pop((account_id, platform), None)
            else:
                # 清除该账号所有平台的会话
                keys_to_remove = [
                    k for k in self._sessions if k[0] == account_id
                ]
                for k in keys_to_remove:
                    self._sessions.pop(k, None)

    @classmethod
    def get_instance(cls) -> "CrossAccountGuard":
        """获取全局 CrossAccountGuard 单例(类方法,便于 scheduler 调用)。"""
        return get_instance()


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_guard: Optional[CrossAccountGuard] = None
_global_guard_lock = threading.Lock()


def get_instance() -> CrossAccountGuard:
    """获取全局 CrossAccountGuard 单例。"""
    global _global_guard
    if _global_guard is None:
        with _global_guard_lock:
            if _global_guard is None:
                _global_guard = CrossAccountGuard()
    return _global_guard


__all__ = [
    "IsolationReport",
    "BatchValidation",
    "CrossAccountGuard",
    "get_instance",
]

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/guardian_risk.py
"""Guardian 风险等级 + 复核状态/原因枚举(按运行时行为规格 guardian v2,2026-11-16)。

遵循统一工程规范
``GuardianReviewReason`` 三套枚举,取证来自 ``外部程序`` 静态字符串
(见 ``内部规格``):
- ``GuardianRiskLevel = low | medium | high | critical``(四档,原词命中);
- ``GuardianAssessmentStatus = approved | denied | timed_out``(+ ``pending`` 中间态,
  来源 ``GuardianAssessmentAction::RequestPermissions`` 等 internally tagged enum);
- ``GuardianReviewReason = policy | fresh_required | missing_scores | stale_scores |
  invalid_scores | incompatible_compaction | elevated_risk | scoring_failure |
  authorization_changed``(原词全命中,按行为规格)。

为什么单独立文件:本仓既有 ``risk_level`` 散落三套字符串口径
(``agent_loop_v2.py`` 用 ``"none"``/``"low"``/``"med"``/``"high"``,
``injection_event_recorder.py`` 用 ``"low"/"med"/"high"``),``guarded_tool_pipeline``
硬编码 ``risk_level="high"``——**没有单一枚举真相源**,跨模块口径漂移无法机器拦截。
本模块提供唯一 ``GuardianRiskLevel`` 枚举 + ``normalize_risk_level`` 归一化函数,
既有生产者(写 ``risk_level`` 字符串进事件帧)不改契约,只加"读侧归一化"出口。

安全语义(fail-closed):未知字符串**只报数不猜档**——归一化失败返回
``None`` 而不是默认 ``low``,调用方拿到 ``None`` 必须按"未判定"处理(不得当低风险放行)。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "GuardianRiskLevel",
    "GuardianAssessmentStatus",
    "GuardianReviewReason",
    "normalize_risk_level",
    "risk_level_allows_auto_approve",
    "RISK_LEVEL_ALIASES",
]


class GuardianRiskLevel(StrEnum):
    """Guardian 四档风险等级(按行为规格 外部实现 ``GuardianRiskLevel``)。

    语义(统一规范 ``first-step asynchronous security reviewer`` prompt 取证):
    "A high-risk decision triggers blocking Guardian review on future actions"——
    **high 及以上**触发阻断式复核;low/medium 走非阻断 async 分类器。
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

    @property
    def is_blocking(self) -> bool:
        """是否触发阻断式 Guardian 复核(high/critical)。"""
        return self in (GuardianRiskLevel.HIGH, GuardianRiskLevel.CRITICAL)


class GuardianAssessmentStatus(StrEnum):
    """Guardian 单次复核的终态(按行为规格 外部实现 ``GuardianAssessmentStatus``)。

    ``PENDING`` 是本仓补的中间态:统一规范 里它由 internally tagged enum
    ``GuardianAssessmentAction`` 的 ``RequestPermissions`` 等分支表达"还在等用户";
    本仓显式化以便前端在轮询窗口渲染"复核进行中"而非空白。
    """

    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    TIMED_OUT = "timed_out"

    @property
    def is_terminal(self) -> bool:
        """是否终态(非 pending)。"""
        return self is not GuardianAssessmentStatus.PENDING


class GuardianReviewReason(StrEnum):
    """Guardian 触发复核的原因(按行为规格 外部实现 ``GuardianReviewReason`` 九档)。

    每档语义(取自 外部程序 事件帧上下文):
    - ``POLICY``:策略要求复核(常规闸门);
    - ``FRESH_REQUIRED``:需新鲜评分(缓存过期前的强制首评);
    - ``MISSING_SCORES``:缺评分(async 分类器未产出);
    - ``STALE_SCORES``:评分过期;
    - ``INVALID_SCORES``:评分非法(解析失败/越界);
    - ``INCOMPATIBLE_COMPACTION``:上下文压缩后旧证据不可用;
    - ``ELEVATED_RISK``:风险升级(前序 low/medium → 现high+);
    - ``SCORING_FAILURE``:评分器自身失败;
    - ``AUTHORIZATION_CHANGED``:用户授权态变化(登录/权限回收)。
    """

    POLICY = "policy"
    FRESH_REQUIRED = "fresh_required"
    MISSING_SCORES = "missing_scores"
    STALE_SCORES = "stale_scores"
    INVALID_SCORES = "invalid_scores"
    INCOMPATIBLE_COMPACTION = "incompatible_compaction"
    ELEVATED_RISK = "elevated_risk"
    SCORING_FAILURE = "scoring_failure"
    AUTHORIZATION_CHANGED = "authorization_changed"


# 归一化别名表:既有生产者的散落字符串 → 唯一枚举。
# 键全小写;``"none"`` 是 agent_loop_v2 的"无风险"占位,映射到 LOW(最低档)。
RISK_LEVEL_ALIASES: Final[dict[str, GuardianRiskLevel]] = {
    "none": GuardianRiskLevel.LOW,
    "low": GuardianRiskLevel.LOW,
    "med": GuardianRiskLevel.MEDIUM,
    "medium": GuardianRiskLevel.MEDIUM,
    "high": GuardianRiskLevel.HIGH,
    "crit": GuardianRiskLevel.CRITICAL,
    "critical": GuardianRiskLevel.CRITICAL,
}


def normalize_risk_level(raw: str | None) -> GuardianRiskLevel | None:
    """把散落字符串归一化成唯一枚举;未知**返回 None**(不猜档,fail-closed)。

    Args:
        raw: 既有生产者写入的 ``risk_level`` 字符串(大小写不敏感);None/空 = 未判定。

    Returns:
        对应 ``GuardianRiskLevel``;无法判定返回 ``None``,调用方按"未判定"处理。
    """
    if raw is None:
        return None
    return RISK_LEVEL_ALIASES.get(raw.strip().lower())


def risk_level_allows_auto_approve(
    raw: str | None,
    *,
    annotations_read_only: bool | None = None,
) -> bool:
    """判定给定风险档能否**自动放行**(不弹审批)。

    规则(fail-closed):
    - 归一化失败(未知字符串 / None)→ ``False``(不自动放行未判定风险);
    - high / critical → ``False``(统一规范 语义:high+ 触发阻断复核);
    - low / medium 且工具只读(``read_only_hint is True``)→ ``True``;
    - low / medium 但工具非只读或未知 → ``False``(写操作一律人工确认)。
    """
    level = normalize_risk_level(raw)
    if level is None or level.is_blocking:
        return False
    return annotations_read_only is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

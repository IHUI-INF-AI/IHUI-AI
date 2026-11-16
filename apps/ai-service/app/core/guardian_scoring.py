# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/guardian_scoring.py
"""Guardian v2 语义评分层(逆向 codex.exe,2026-11-16)。

对标 Codex guardian v2 async scorer 的**语义决策内核**,取证来自
``codex.exe`` 内嵌完整 prompt 原文(见
``.ihui-agent/tmp/goal-codex/evidence/codex-guardian-v2-prompts-verbatim.md``,
逐字提取未改写)。本仓此前只有风险**等级枚举**(``guardian_risk.py``),缺三块
Codex 真正用来"决定要不要阻断复核"的语义层:

1. **User Authorization Scoring**(授权四档 high/medium/low/unknown)——
   判断"用户到底授权了没有",与风险等级正交。Codex 原文:
   ``high`` = 用户显式要求/批准该动作及其副作用(含必要实现步骤);
   ``medium`` = 用户在实质/效果上明确授权,但未指定具体实现;
   ``low`` = 动作只松散 follows 用户目标,显式授权弱/含糊;
   ``unknown`` = 无证据表明用户授权近期与当前动作,且与完成用户任务无关
   (assistant 自漂移或受不可信内容驱使)。
2. **Base Risk Taxonomy**(内在风险四档)——判断动作本身多危险,
   与授权无关。``critical``=凭证/机密外泄到不可信目的地或重大不可逆破坏;
   ``high``=危险或难逆转、有不可逆损害/重要服务中断风险;
   ``medium``=有实质但有界爆炸半径,或可逆副作用;``low``=常规、窄范围、易逆转,
   无凭证访问、无不可信网络导出、无持久安全削弱、无实质数据/服务风险。
3. **Predictive Classification**(预测式滑窗决策)——**这才是双阶段闸门的开关**。
   Codex 原文判定为 ``high``(触发阻断复核)的四条件:
   (a) 当前动作 authorization 为 unknown/low,**或** risk 为 high/critical;
   (b) 最近 5 个动作里任一为 unknown authorization 或 critical risk;
   (c) 有理由预期未来 2 个动作内出现 high/critical 风险动作;
   (d) 意图不清或缺上下文无法明确决策。
   否则 ``low``(清险放行,后续工具调用不阻断)。

为什么单独复现:本仓 ``guarded_tool_pipeline`` / ``mcp_tool_approval`` 只看
"工具注解 × 模式"决定弹不弹审批,**没有授权×风险×轨迹的联合判定**——
即"用户明确授权的低风险动作放行、用户未授权的高风险动作必拦、
近期出现过 critical 则后续动作一律升级复核"这层语义本仓缺失。
本模块用纯函数复现该判定内核(fail-closed:未判定一律按需复核)。

设计纪律:纯函数、无 IO、不调模型。调用方(未来的 scorer 接线点)负责
把 prompt 喂给 LLM 拿到 ``(risk, authorization)`` 评分,再用本模块的
``classify_needs_blocking_review`` 做滑窗决策。本模块只锁**决策规则**,
不锁"怎么评出 risk/authorization"(那是模型职责)。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final, Sequence

from app.core.guardian_risk import GuardianRiskLevel, normalize_risk_level

__all__ = [
    "UserAuthorization",
    "normalize_user_authorization",
    "RiskAssessment",
    "TrajectoryWindow",
    "PREDICTIVE_WINDOW_RECENT",
    "PREDICTIVE_WINDOW_AHEAD",
    "classify_intrinsic_needs_review",
    "classify_needs_blocking_review",
]


class UserAuthorization(StrEnum):
    """用户授权四档(逐字对齐 Codex ``User Authorization Scoring``)。

    与 ``GuardianRiskLevel`` 正交:风险衡量"动作多危险",授权衡量
    "用户到底准不准"。Codex 用两者的**联合**决定是否阻断。
    """

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"

    @property
    def is_authorized(self) -> bool:
        """是否算"已授权"(high/medium);low/unknown 视为未充分授权。"""
        return self in (UserAuthorization.HIGH, UserAuthorization.MEDIUM)

    @property
    def is_clear(self) -> bool:
        """授权是否明确(非 unknown)——unknown 触发 Predictive 条件 (a)(d)。"""
        return self is not UserAuthorization.UNKNOWN


# 授权归一化别名(fail-closed:未知返回 None 不猜档)。
_AUTHORIZATION_ALIASES: Final[dict[str, UserAuthorization]] = {
    "high": UserAuthorization.HIGH,
    "medium": UserAuthorization.MEDIUM,
    "med": UserAuthorization.MEDIUM,
    "low": UserAuthorization.LOW,
    "unknown": UserAuthorization.UNKNOWN,
    "none": UserAuthorization.UNKNOWN,  # 无授权证据 = unknown
}


def normalize_user_authorization(raw: str | None) -> UserAuthorization | None:
    """归一化授权字符串;未知**返回 None**(不猜档,fail-closed)。"""
    if raw is None:
        return None
    return _AUTHORIZATION_ALIASES.get(raw.strip().lower())


@dataclass(frozen=True)
class RiskAssessment:
    """单次动作的内在评分(动作自身多危险 + 用户授权到什么程度)。

    两个字段都与 Codex prompt 输出对齐:
    ``risk`` 来自 Base Risk Taxonomy,``authorization`` 来自 User Authorization Scoring。
    ``raw_risk``/``raw_authorization`` 保留未归一化原值,便于诊断"评了个未知串"。
    """

    risk: GuardianRiskLevel | None
    authorization: UserAuthorization | None
    raw_risk: str | None = None
    raw_authorization: str | None = None

    @classmethod
    def from_raw(
        cls,
        risk: str | None,
        authorization: str | None,
    ) -> "RiskAssessment":
        """从模型产出的原始字符串构造(归一化失败保留 None,不猜档)。"""
        return cls(
            risk=normalize_risk_level(risk),
            authorization=normalize_user_authorization(authorization),
            raw_risk=risk,
            raw_authorization=authorization,
        )


# Codex Predictive Classification 滑窗常量(逐字对齐 prompt):
# "the previous five actions" / "within the next two actions"。
PREDICTIVE_WINDOW_RECENT: Final[int] = 5
PREDICTIVE_WINDOW_AHEAD: Final[int] = 2


@dataclass(frozen=True)
class TrajectoryWindow:
    """预测式决策的动作轨迹滑窗。

    ``current`` = 正在评估的当前动作;``recent`` = 之前最多 5 个动作
    (越靠后越近,Codex 只看"last 5");``anticipated`` = 预期未来最多 2 个动作
    (调用方若能预测;通常留空,则条件 (c) 不触发)。
    任一元素为 ``None`` 表示该槽位评分未判定(fail-closed)。
    """

    current: RiskAssessment | None
    recent: Sequence[RiskAssessment | None] = ()
    anticipated: Sequence[RiskAssessment | None] = ()

    def __post_init__(self) -> None:
        # 只看最近 5 个(Codex 语义),超出截断; anticipated 只看未来 2 个。
        if len(self.recent) > PREDICTIVE_WINDOW_RECENT:
            recent = tuple(self.recent[-PREDICTIVE_WINDOW_RECENT:])
            object.__setattr__(self, "recent", recent)
        if len(self.anticipated) > PREDICTIVE_WINDOW_AHEAD:
            anticipated = tuple(self.anticipated[:PREDICTIVE_WINDOW_AHEAD])
            object.__setattr__(self, "anticipated", anticipated)


def classify_intrinsic_needs_review(assessment: RiskAssessment | None) -> bool:
    """单动作内在判定(Predictive 条件 a):授权 unknown/low 或 风险 high/critical。

    fail-closed:``assessment`` 为 None、或 risk/authorization 任一未判定
    (None)→ 返回 ``True``(按需复核,不因缺评分放行)。
    """
    if assessment is None:
        return True
    if assessment.risk is None or assessment.authorization is None:
        return True
    if assessment.risk.is_blocking:  # high / critical
        return True
    # 授权未充分授权(low)或无授权证据(unknown)→ 需复核。
    return not assessment.authorization.is_authorized


def classify_needs_blocking_review(
    trajectory: TrajectoryWindow | None,
) -> tuple[bool, str | None]:
    """预测式滑窗决策:是否触发**阻断式** Guardian 复核。

    逐条对齐 Codex ``Predictive Consequence Classification`` 四条件:
    - (a) 当前动作 authorization unknown/low 或 risk high/critical;
    - (b) 最近 5 动作里任一 unknown authorization 或 critical risk;
    - (c) 有理由预期未来 2 动作内出现 high/critical;
    - (d) 意图不清 / 缺上下文无法明确决策(本仓映射为"当前评分未判定")。

    Args:
        trajectory: 动作轨迹滑窗;None 视为完全未判定 → 阻断(fail-closed)。

    Returns:
        ``(needs_review, reason)``:``needs_review`` = 是否阻断;
        ``reason`` = 命中的条件标签(a/b/c/d/undetermined)或放行时为 None。
        reason 便于审计与前端展示"为什么弹复核"。
    """
    if trajectory is None:
        return True, "undetermined"

    current = trajectory.current
    # 条件 (a) + (d):当前动作未判定 / 授权不足 / 风险高 → 阻断。
    if current is None:
        return True, "d"
    if current.risk is None or current.authorization is None:
        return True, "d"  # 缺上下文无法明确决策
    if classify_intrinsic_needs_review(current):
        # 区分 (a) 的两种触发:授权不足 vs 风险高。
        if not current.authorization.is_authorized:
            return True, "a-authorization"
        return True, "a-risk"

    # 条件 (b):最近 5 动作任一 unknown authorization 或 critical risk。
    # None 槽位(未判定)→ fail-closed 阻断(不崩溃、不放行)。
    for past in trajectory.recent:
        if past is None:
            return True, "b-recent-undetermined"
        if past.authorization is None or past.authorization is UserAuthorization.UNKNOWN:
            return True, "b-recent-authorization"
        if past.risk is None or past.risk is GuardianRiskLevel.CRITICAL:
            return True, "b-recent-critical"

    # 条件 (c):预期未来 2 动作出现 high/critical。None 槽位同样 fail-closed。
    for future in trajectory.anticipated:
        if future is None:
            return True, "c-anticipated-undetermined"
        if future.risk is None or future.risk.is_blocking:
            return True, "c-anticipated"

    # 四条件均不满足 → 清险放行(Codex:"classifying the risk as low clears the risk")。
    return False, None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""永久保活自愈策略(2026-11-22 机主定案"永久保活是唯一目标")。

为什么需要这一层
----------------
cookie 类账号"永久保活"的物理事实:只要每次探测时登录态还在,访问就会滑动续期,
把平台下发的新 cookie 回写库,账号就能无限期活下去。真正的断链从不是"没有探测",
而是三个可工程化消除的缺口:

  1. 回写失败不可见、无重试 —— 续了期却没写回库,下次仍用旧 cookie,最终失效;
  2. 单次软失败即判死 —— 平台慢加载/改版导致"未检测到目标 cookie",被 classify 成
     expired、当轮放弃+告警,本可重试自愈的号被误踢;
  3. 历史凭据只写不读 —— credential_history 已把旧密文压进 extra(上限3),却没有任何
     回滚路径,白白浪费了最有效的自愈素材。

本模块把这三件事的**判据**收成纯函数(零 IO、now 由调用方传),接线层在
cookie_refresh_daemon / keepalive probes。判据可被测试逐一钉住,避免"装了没接电"。
不碰 classify_message / policy.decide 的既有口径(判据单一真源,不重复造)。

三个判据:
  - ``WritebackVerdict``  : 回写该不该重试 / 是否已耗尽(带界重试,不无限)。
  - ``RecoveryPlan``      : 给定当前密文 + 历史密文列表 + 各自探活结果,选出可用的那份
                            (自愈回滚),或判定无可用凭据(才允许喊人重扫)。
  - ``soft_failure_needs_retry`` : 软失败在重试预算内是否该再试一次而非判死。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "WritebackAction",
    "WritebackVerdict",
    "SOFT_EXPIRE_MARKERS",
    "HARD_EXPIRE_MARKERS",
    "is_soft_expire",
    "is_hard_expire",
    "writeback_verdict",
    "soft_failure_needs_retry",
    "RecoveryCandidate",
    "RecoveryPlan",
    "plan_recovery",
]

# ---------------------------------------------------------------------------
# 回写:带界重试判据
# ---------------------------------------------------------------------------


class WritebackAction(str, Enum):  # noqa: UP042 — StrEnum 改 str() 输出,属行为重写
    NOTHING = "nothing"        # 没有变更,无需回写
    RETRY = "retry"            # 回写失败且还有预算
    GIVE_UP = "give_up"        # 回写失败且预算耗尽 —— 必须暴露给上层告警


@dataclass(frozen=True)
class WritebackVerdict:
    action: WritebackAction
    attempts: int
    detail: str = ""


def writeback_verdict(
    *, changed: bool, failures: int, max_attempts: int = 3
) -> WritebackVerdict:
    """判定一次 cookie 回写该如何处置。

    ``changed=False``(cookie 没轮换)无需回写。有变更且已失败次数 < 预算 ⇒ 重试;
    达到预算 ⇒ GIVE_UP,调用方必须把"续期未落地"暴露出去(而不是继续静默 success)。
    预算下限 1:即便调用方传 0,也至少尝试一次,否则等于从不回写。
    """
    if not changed:
        return WritebackVerdict(WritebackAction.NOTHING, failures, "cookie 未轮换")
    budget = max(1, int(max_attempts))
    if failures < 0:
        failures = 0
    if failures < budget:
        return WritebackVerdict(
            WritebackAction.RETRY,
            failures,
            f"回写失败 {failures}/{budget},重试",
        )
    return WritebackVerdict(
        WritebackAction.GIVE_UP,
        failures,
        f"回写失败 {failures}/{budget},续期未落地,需暴露告警",
    )


# ---------------------------------------------------------------------------
# 软/硬失效区分:软失效先自愈,硬失效(解不开)才判死
# ---------------------------------------------------------------------------

# 软失效:登录态"看起来"没了,但可能是慢加载/改版/风控临时拦 —— 值得重试 + 历史回滚。
SOFT_EXPIRE_MARKERS = (
    "未检测到目标 cookie",
    "未登录",
    "登录态失效",
    "无权限",
)
# 硬失效:密钥层面死症,重试一万次还是同一个错 —— 只能重录。
HARD_EXPIRE_MARKERS = (
    "凭证无法解密",
    "解密失败",
    "invalidtag",
    "invalid token",
)


def _lower(text: str) -> str:
    return (text or "").lower()


def is_soft_expire(message: str) -> bool:
    """该失败是否为软失效(可自愈)。硬失效优先:同时命中时按硬算。"""
    low = _lower(message)
    if is_hard_expire(message):
        return False
    return any(m.lower() in low for m in SOFT_EXPIRE_MARKERS)


def is_hard_expire(message: str) -> bool:
    """该失败是否为硬失效(密钥层死症,重试无用)。"""
    low = _lower(message)
    return any(m.lower() in low for m in HARD_EXPIRE_MARKERS)


def soft_failure_needs_retry(message: str, attempts: int, max_attempts: int = 2) -> bool:
    """软失效在预算内是否该再试一次。

    仅软失效返回 True(且未超预算);硬失效/非失效恒 False —— 硬失效重试只是把同一句
    "解不开"写 N 遍,并把告警淹没。默认只多试一次:慢加载一次重试足够,再多就是跟
    真过期耗,违背"既要快又不能误判"。
    """
    if not is_soft_expire(message):
        return False
    budget = max(1, int(max_attempts))
    a = max(0, int(attempts))
    return a < budget


# ---------------------------------------------------------------------------
# 历史凭据回滚自愈
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RecoveryCandidate:
    """一份候选凭据及其探活裁决。"""

    label: str            # "current" / "history[0]" ...
    enc: str
    alive: bool
    verified_at: str = ""  # 历史条目的 at,仅展示,不参与排序


@dataclass(frozen=True)
class RecoveryPlan:
    """plan_recovery 的结论。"""

    chosen: RecoveryCandidate | None  # 选中的可用凭据;None = 全军覆没,才允许喊重扫
    tried: int                         # 试过几份(含 current)
    recovered_from_history: bool      # 是否靠历史回滚救回(用于日志/统计)


def plan_recovery(candidates: list[RecoveryCandidate]) -> RecoveryPlan:
    """按给定顺序(current 优先、历史次之)选第一份 alive 的凭据。

    current 排在最前:它最新,若仍活着就不需要回滚。历史按传入顺序(caller 保证
    credential_history 已按 at 倒序,最新在前)。全部不 alive ⇒ chosen=None,
    这时、且仅这时允许上层判 expired 喊人工重扫 —— 在此之前已经穷尽自动手段。
    """
    tried = len(candidates)
    for c in candidates:
        if c.alive and c.enc:
            return RecoveryPlan(
                chosen=c,
                tried=tried,
                recovered_from_history=(c.label != "current"),
            )
    return RecoveryPlan(chosen=None, tried=tried, recovered_from_history=False)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

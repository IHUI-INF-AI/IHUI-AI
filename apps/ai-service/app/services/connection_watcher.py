# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""分级看门狗重连(B2-04,2026-11-28 立)。

## 立因

连接断开的**原因**决定该不该重连,而"重连了几次"只决定**退避多久**。把两者混成一个计数器
是这类模块最常见的错:鉴权失效(retry 一万次也不会成功)和网络抖动(第一次就该立刻重试)
被同一个 `attempt++` 处理后,要么在死链路上烧光预算,要么让本该秒级恢复的抖动等上 8 秒。

故分两级:

- **一级:断开原因分级**(`DisconnectClass`)⇒ 决定 `give_up` 还是继续;
- **二级:尝试次数分级**(`attempt`)⇒ 决定 `immediate` 还是 `backoff` 以及退避多久。

## 判据

见 `plan_reconnect` 的判序注释。三条不可动:

1. `auth` / `fatal` **零重试**——鉴权失效重试是撞墙,不可恢复错误重试是烧预算;
2. 前两次 `transient` 走 `immediate`(0 延迟),因为抖动恢复的典型时间在百毫秒级;
3. 预算耗尽必 `give_up` 且带 `budget_exhausted` 原因,**不静默继续**。

刻意不做:不 sleep / 不建连接 / 不读系统时钟 —— 本模块只回答"下一次该怎么重连",
真正的等待与重连由调用方做,时间由调用方注入。
"""

from __future__ import annotations

from enum import StrEnum


class DisconnectClass(StrEnum):
    """断开原因分级:决定"还值不值得重连"。"""

    TRANSIENT = "transient"
    PROTOCOL = "protocol"
    AUTH = "auth"
    FATAL = "fatal"


class ReconnectTier(StrEnum):
    """重连档位:决定"立刻重试 / 退避重试 / 放弃"。"""

    IMMEDIATE = "immediate"
    BACKOFF = "backoff"
    GIVE_UP = "give_up"


class ReconnectReason(StrEnum):
    """可审计原因机器码。"""

    OK = "ok"
    AUTH_INVALID = "auth_invalid"
    FATAL_ERROR = "fatal_error"
    BUDGET_EXHAUSTED = "budget_exhausted"
    UNKNOWN_CLASS = "unknown_disconnect_class"


# 退避序列(秒):指数增长但两端都有界。
# 下界 1s 是"别把 CPU 打满",上界 30s 是"别让用户等到以为死机"。
BACKOFF_SECONDS: tuple[float, ...] = (1.0, 2.0, 4.0, 8.0, 16.0, 30.0)

# 前几次尝试走 immediate。抖动恢复的典型时间在百毫秒级,退避反而拖慢。
IMMEDIATE_ATTEMPTS = 2

# 默认预算:总共允许尝试几次(含首次)。超过即放弃。
DEFAULT_MAX_ATTEMPTS = 6


def backoff_delay(attempt: int) -> float:
    """第 `attempt` 次重连的等待秒数(1-based)。越界取序列两端,不返回 0。"""
    if attempt <= 1:
        return BACKOFF_SECONDS[0]
    index = min(attempt - 1, len(BACKOFF_SECONDS) - 1)
    return BACKOFF_SECONDS[index]


def plan_reconnect(
    attempt: object,
    disconnect_class: object,
    *,
    max_attempts: object = DEFAULT_MAX_ATTEMPTS,
) -> dict[str, object]:
    """规划下一次重连(纯判据)。

    判序:
      1  disconnect_class 不在枚举            ⇒ give_up / unknown_disconnect_class
      2  disconnect_class ∈ {auth, fatal}     ⇒ give_up / auth_invalid|fatal_error(零重试)
      3  attempt 非法(非 int / bool / <1)   ⇒ 归一到 1 并标记(不抛)
      4  attempt >= max_attempts              ⇒ give_up / budget_exhausted
      5  attempt <= IMMEDIATE_ATTEMPTS        ⇒ immediate / delay=0
      6  其余                                  ⇒ backoff / delay=backoff_delay(attempt)

    返回 `{"tier","reason","delay_s","attempt","detail"}`。`delay_s` 只在 backoff 档有值,
其余恒 0.0 —— 让调用方不必判 `None`。
    """
    if not isinstance(disconnect_class, str) or disconnect_class not in _CLASSES:
        return _emit(ReconnectTier.GIVE_UP.value, ReconnectReason.UNKNOWN_CLASS.value,
                     0.0, 1, "断开原因不认(取不到),点名:transient/protocol/auth/fatal")

    if disconnect_class == DisconnectClass.AUTH.value:
        return _emit(ReconnectTier.GIVE_UP.value, ReconnectReason.AUTH_INVALID.value,
                     0.0, 1, "鉴权失效:重试不会成功,需重新授权后再连")
    if disconnect_class == DisconnectClass.FATAL.value:
        return _emit(ReconnectTier.GIVE_UP.value, ReconnectReason.FATAL_ERROR.value,
                     0.0, 1, "不可恢复错误:重试会重复同样的失败")

    safe_attempt, coerced = _coerce_attempt(attempt)
    safe_max, _ = _coerce_attempt(max_attempts)

    if safe_attempt >= safe_max:
        return _emit(ReconnectTier.GIVE_UP.value, ReconnectReason.BUDGET_EXHAUSTED.value,
                     0.0, safe_attempt,
                     f"预算耗尽:第 {safe_attempt} 次已达上限 {safe_max},不再重连",
                     coerced=coerced)

    if safe_attempt <= IMMEDIATE_ATTEMPTS:
        return _emit(ReconnectTier.IMMEDIATE.value, ReconnectReason.OK.value,
                     0.0, safe_attempt,
                     f"第 {safe_attempt} 次(≤{IMMEDIATE_ATTEMPTS})走立即重试:抖动恢复多在百毫秒级",
                     coerced=coerced)

    return _emit(ReconnectTier.BACKOFF.value, ReconnectReason.OK.value,
                 backoff_delay(safe_attempt), safe_attempt,
                 f"第 {safe_attempt} 次走退避:{backoff_delay(safe_attempt)}s",
                 coerced=coerced)


_CLASSES: frozenset[str] = frozenset(c.value for c in DisconnectClass)


def _coerce_attempt(value: object) -> tuple[int, bool]:
    """把 attempt/max_attempts 归一为 >=1 的 int。非法值取 1 并标记 coerced。"""
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        return 1, True
    return value, False


def _emit(tier: str, reason: str, delay_s: float, attempt: int, detail: str, *,
          coerced: bool = False) -> dict[str, object]:
    """唯一返回出口:give_up 必带非 ok 的 reason,其余必为 ok。"""
    if tier == ReconnectTier.GIVE_UP.value and reason == ReconnectReason.OK.value:
        reason = ReconnectReason.UNKNOWN_CLASS.value
    return {
        "tier": tier,
        "reason": reason,
        "delay_s": delay_s,
        "attempt": attempt,
        "coerced": coerced,
        "detail": detail,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

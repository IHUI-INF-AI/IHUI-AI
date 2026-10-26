# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心 —— 判定策略(纯函数,零 IO)。

这个模块刻意不含任何数据库/网络/时间读取:``now`` 一律由调用方传入。
理由是这些判据会被反复推敲(重试几次?几轮告警?提前几天预警?),而每次推敲
都必须能被测试直接钉住 —— 一旦 ``datetime.now()`` 藏进函数体,所有边界用例
就变成"跑的时候恰好是几点",测不出真值。
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.services.keepalive.models import (
    HEALTH_CRITICAL,
    HEALTH_HEALTHY,
    HEALTH_UNKNOWN,
    HEALTH_WARNING,
    KIND_ERROR,
    KIND_EXPIRED,
    KIND_NETWORK,
    KIND_OK,
    KIND_UNSUPPORTED,
    PolicyConfig,
    ProbeOutcome,
    StateSnapshot,
    StateUpdate,
)

# 明确的"需要人动手"信号。这类失败重试不会自愈(凭证过期 / 环境缺依赖),
# 所以不等连续 3 轮,当轮就喊一次,靠 alert_repeat_hours 去重防止刷屏。
_IMMEDIATE_KINDS = frozenset({KIND_EXPIRED, KIND_ERROR})


def backoff_seconds(failures: int, cfg: PolicyConfig) -> float:
    """指数退避:第 1 次失败等 base,之后每次翻倍,封顶 cap。

    ``failures`` 是"累计失败次数"(含本次),<1 时按 1 处理。
    """
    if failures < 1:
        failures = 1
    raw = cfg.retry_base_seconds * (2 ** (failures - 1))
    # 显式 float():mypy 对 min() 的重载解析在 int/float 混合入参下会回 Any,
    # 而本函数签名承诺 float —— 不收口就会在 strict 档报 no-any-return。
    return float(min(raw, cfg.retry_cap_seconds))


def _due(last: datetime | None, now: datetime, repeat_hours: float) -> bool:
    """距上次喊人是否已过去 ``repeat_hours``(从没喊过 ⇒ 该喊)。"""
    if last is None:
        return True
    return (now - last) >= timedelta(hours=repeat_hours)


def is_expiring(expires_at: datetime | None, now: datetime, warn_days: float) -> bool:
    """是否进入临期窗口(已过期也算,由 health_of 区分严重度)。"""
    if expires_at is None:
        return False
    return expires_at <= now + timedelta(days=warn_days)


def is_expired(expires_at: datetime | None, now: datetime) -> bool:
    return expires_at is not None and expires_at <= now


def decide(
    prev: StateSnapshot,
    out: ProbeOutcome,
    now: datetime,
    cfg: PolicyConfig,
) -> StateUpdate:
    """把「上一次状态 + 本次结果」推成「下一次状态 + 要不要喊人」。

    三条语义要点:
    1. **unsupported 不算失败**。api_key 类账号本就不需要 cookie 保活,把它记成
       失败会让健康度永远一片红,真红反而看不见。
    2. **成功即清零**。连续失败计数、预警/告警去重戳一起归零 —— 恢复之后应当
       重新获得"再喊一次"的资格,否则下一次真出事会被上一轮的旧戳静音。
    3. **过期/环境类失败当轮即告警**,其余失败攒到 ``alert_after_failures`` 轮;
       两者都受 ``alert_repeat_hours`` 去重。
    """
    if out.kind == KIND_UNSUPPORTED:
        return StateUpdate(
            consecutive_failures=prev.consecutive_failures,
            last_ok_at=prev.last_ok_at,
            last_fail_at=prev.last_fail_at,
            expires_at=prev.expires_at,
            warned_at=prev.warned_at,
            alerted_at=prev.alerted_at,
        )

    if out.ok:
        expires = out.expires_at or prev.expires_at
        warn_now = is_expiring(expires, now, cfg.expire_warn_days) and _due(
            prev.warned_at, now, cfg.alert_repeat_hours
        )
        return StateUpdate(
            consecutive_failures=0,
            next_retry_at=None,
            last_ok_at=now,
            last_fail_at=prev.last_fail_at,
            last_error=None,
            last_error_kind=None,
            expires_at=expires,
            warned_at=now if warn_now else None,
            alerted_at=None,
            warn_now=warn_now,
            alert_now=False,
        )

    failures = prev.consecutive_failures + 1
    retryable = bool(out.retryable) and failures <= cfg.retry_max
    next_retry_at = now + timedelta(seconds=backoff_seconds(failures, cfg)) if retryable else None

    immediate = (not out.retryable) and out.kind in _IMMEDIATE_KINDS
    should_alert = (immediate or failures >= cfg.alert_after_failures) and _due(
        prev.alerted_at, now, cfg.alert_repeat_hours
    )

    return StateUpdate(
        consecutive_failures=failures,
        next_retry_at=next_retry_at,
        last_ok_at=prev.last_ok_at,
        last_fail_at=now,
        last_error=out.message[:500] if out.message else None,
        last_error_kind=out.kind,
        # 失败时保留已知到期时间:过期的号仍然"过期于某刻",信息别丢。
        expires_at=out.expires_at or prev.expires_at,
        warned_at=None,
        alerted_at=now if should_alert else prev.alerted_at,
        warn_now=False,
        alert_now=should_alert,
    )


def health_of(state: StateSnapshot, now: datetime, cfg: PolicyConfig) -> str:
    """健康度四档。供面板着色,判据只此一份(不许前端自己再算一遍)。

    2026-10-26 补一档判据:**上一次失败是 ``expired`` 类就直接 critical**。
    ``expired`` 的定义是"只能重录/重扫,重试无用"(含凭证解不开),这类失败不会
    随时间自愈,按 consecutive_failures 先黄三轮只是在给一个死症配倒计时。
    """
    seen = state.last_ok_at is not None or state.last_fail_at is not None
    if not seen:
        return HEALTH_UNKNOWN

    if state.last_error_kind == KIND_EXPIRED:
        return HEALTH_CRITICAL
    if is_expired(state.expires_at, now):
        return HEALTH_CRITICAL
    if state.consecutive_failures >= cfg.alert_after_failures:
        return HEALTH_CRITICAL
    if state.consecutive_failures > 0:
        return HEALTH_WARNING
    if is_expiring(state.expires_at, now, cfg.expire_warn_days):
        return HEALTH_WARNING
    # 只看得到失败、从没成功过,且还没到告警阈值 —— 至少是 warning,不能算健康。
    if state.last_ok_at is None:
        return HEALTH_WARNING
    return HEALTH_HEALTHY


# 外部字符串 → 分类。cookie 探活复用既有 daemon,它返回的是中文人话;
# 这里做**唯一**的归一化,别让调用方各自 startswith。
#
# 2026-10-26 补:密文解不开("InvalidTag"/"解密失败"/"凭证无法解密")归 **expired**。
# 这类失败是密钥层面的死症 —— 重试一万次还是同一个 InvalidTag,只有重录能救。
# 归成 error 会让它进退避重试队列并被当成"环境问题",把真正可修的故障混在一起。
_EXPIRED_MARKERS = (
    "未检测到目标 cookie",
    "过期",
    "未登录",
    "登录态失效",
    "无权限",
    "凭证无法解密",
    "解密失败",
    "invalidtag",
    "invalid token",
)
_ENV_MARKERS = ("未安装", "账号不存在", "浏览器", "executable")
_NETWORK_MARKERS = ("timeout", "timed out", "net::", "connection", "网络", "超时", "ERR_")


def classify_message(ok: bool, message: str, *, unsupported: bool = False) -> ProbeOutcome:
    """把「成功/失败 + 人话消息」归成一个 ``ProbeOutcome``。

    约定:不认识的失败按 ``KIND_ERROR`` 且可重试 —— 宁可多试一次,也不要把
    "没见过的报错"直接判死(那会让新出现的平台改版永远沉默)。
    """
    text = (message or "").strip()
    if unsupported:
        return ProbeOutcome(ok=False, kind=KIND_UNSUPPORTED, message=text, retryable=False)
    if ok:
        return ProbeOutcome(ok=True, kind=KIND_OK, message=text, retryable=False)

    low = text.lower()
    # 统一不区分大小写:密文层报的是 `InvalidTag`(驼峰),拿小写标记直接 in 会漏。
    if any(m.lower() in low for m in _EXPIRED_MARKERS):
        return ProbeOutcome(ok=False, kind=KIND_EXPIRED, message=text, retryable=False)
    if any(m.lower() in low for m in _ENV_MARKERS):
        return ProbeOutcome(ok=False, kind=KIND_ERROR, message=text, retryable=False)
    if any(m.lower() in low for m in _NETWORK_MARKERS):
        return ProbeOutcome(ok=False, kind=KIND_NETWORK, message=text, retryable=True)
    return ProbeOutcome(ok=False, kind=KIND_ERROR, message=text, retryable=True)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

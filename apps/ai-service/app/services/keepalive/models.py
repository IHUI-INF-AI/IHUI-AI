# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心 —— 数据模型(2026-10-26 立)。

为什么要有这一层
----------------
本仓库此前有两条互不相干的保活线:
  ① 发布线 Cookie 自动保活 ``services/publish/cookie_refresh_daemon.py``
  ② AI 平台签到 ``services/checkin_scheduler.py``

两条线各有一套开关、各自的统计、各自的失败表达,于是「这些账号现在到底还活着吗」
在系统里**没有单一答案**:用户在发布页看到的是 ① 的角标,在签到页看到的是 ② 的
记录,两边都不回答"哪个号快死了"。

本中心把三类能力收敛成一套调度 / 一套状态表 / 一套健康度口径 / 一套告警出口:
  - cookie 探活(第三方平台登录态)
  - 凭证到期检测(api_key / oauth 这类不会"轮换"但会"到期"的账号)
  - 签到凭证健康(只读 JWT exp,不代签)

边界(不许把两件事混成一件)
--------------------------
本中心负责**凭证存活**(这个号还能不能用),**不负责业务动作**(发内容 / 每日签到)。
业务动作仍归原调度器 —— 否则同一账号会被两处同时访问平台,签到与发布互相踩。
所以 ``ProbeOutcome`` 只表达"凭证是否有效 + 何时到期",不表达"今天签到成功没有"。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

# ---------------------------------------------------------------------------
# 来源:一个账号属于哪条保活线
# ---------------------------------------------------------------------------
SOURCE_PUBLISH_COOKIE: Literal["publish_cookie"] = "publish_cookie"
SOURCE_PUBLISH_TOKEN: Literal["publish_token"] = "publish_token"
SOURCE_CHECKIN: Literal["checkin"] = "checkin"

# 探活结果分类。分类必须先于"成/败"存在 —— 只有布尔值的时候,"网络抖了一下"
# 与"cookie 真过期了"在库里长得一模一样,于是要么误告警要么漏告警。
KIND_OK = "ok"
KIND_EXPIRED = "expired"  # 凭证已过期/被平台判定未登录 —— 只能重扫,重试无用
KIND_NETWORK = "network"  # 网络/超时/浏览器异常 —— 可重试
KIND_ERROR = "error"  # 未归类异常 —— 可重试但先降级
KIND_UNSUPPORTED = "unsupported"  # 该账号类型无需保活(不该记成失败)
KIND_SKIPPED = "skipped"  # 本轮主动跳过(退避中 / 被禁用),既非成功也非失败

ALL_KINDS = (
    KIND_OK,
    KIND_EXPIRED,
    KIND_NETWORK,
    KIND_ERROR,
    KIND_UNSUPPORTED,
    KIND_SKIPPED,
)

# 健康度四档 + 未知。警告口径刻意保守:只在"真的需要人动手"时才给 critical。
HEALTH_HEALTHY = "healthy"
HEALTH_WARNING = "warning"
HEALTH_CRITICAL = "critical"
HEALTH_UNKNOWN = "unknown"


def describe_exc(exc: BaseException) -> str:
    """把异常写成一句不尴尬的话:没有 message 的异常(如 ``InvalidTag``)只留类名。

    为什么要这个:``f"{type(e).__name__}: {e}"`` 对 ``InvalidTag`` 会产出
    "InvalidTag: "(尾部空着),这句话会原样进告警和站内信 —— 用户看到的是一个
    像笔误的字符串,而不是"凭证坏了"。少一个冒号,少一次误解。
    """
    text = str(exc).strip()
    return f"{type(exc).__name__}: {text}" if text else type(exc).__name__


@dataclass(frozen=True)
class AccountRef:
    """一个待保活账号的最小身份。

    ``ref`` 是跨来源的稳定主键(``<source>:<account_id>``);两张源表的自增 id
    各自独立,裸 ``account_id`` 在两个来源之间会撞号。
    """

    source: str
    account_id: int
    owner: str
    display: str = ""
    platform: str = ""

    @property
    def ref(self) -> str:
        return f"{self.source}:{self.account_id}"


@dataclass(frozen=True)
class ProbeOutcome:
    """单账号一次探活的结果(纯数据,不带 DB/IO)。"""

    ok: bool
    kind: str = KIND_OK
    message: str = ""
    duration_ms: int = 0
    expires_at: datetime | None = None
    # 探活过程中是否顺带轮换了凭证(cookie 回写),仅用于展示
    refreshed: bool = False
    # 该失败是否值得重试。expired 恒 False —— 过期只能靠用户重扫,重试 30 次
    # 也只是把同一句"未登录"写 30 遍,还把告警噪音堆满。
    retryable: bool = False

    def __post_init__(self) -> None:
        if self.kind not in ALL_KINDS:
            raise ValueError(f"unknown outcome kind: {self.kind!r}")


@dataclass(frozen=True)
class StateSnapshot:
    """状态表的纯数据投影(读出来 → 交给 policy.decide → 写回去)。"""

    consecutive_failures: int = 0
    last_ok_at: datetime | None = None
    last_fail_at: datetime | None = None
    expires_at: datetime | None = None
    warned_at: datetime | None = None
    alerted_at: datetime | None = None
    next_retry_at: datetime | None = None
    # 上一次失败的分类(ok/expired/network/error/unsupported)。health_of 用它区分
    # "过几轮会好的失败"和"必须人去重录的死症"—— 后者当轮就该是 critical,
    # 不该陪着 consecutive_failures 先黄三轮。
    last_error_kind: str | None = None


@dataclass(frozen=True)
class StateUpdate:
    """``policy.decide`` 的产物:下一份状态 + 本轮该不该喊人。"""

    consecutive_failures: int = 0
    next_retry_at: datetime | None = None
    last_ok_at: datetime | None = None
    last_fail_at: datetime | None = None
    last_error: str | None = None
    last_error_kind: str | None = None
    expires_at: datetime | None = None
    warned_at: datetime | None = None
    alerted_at: datetime | None = None
    # 本轮是否要发"临期预警" / "连续失败告警"(去重由 policy 内部按时间窗判定)
    warn_now: bool = False
    alert_now: bool = False


@dataclass(frozen=True)
class PolicyConfig:
    """保活策略参数。全部来自环境变量,见 center.resolve_config。"""

    retry_max: int = 3
    retry_base_seconds: float = 300.0
    retry_cap_seconds: float = 6 * 3600.0
    alert_after_failures: int = 3
    alert_repeat_hours: float = 24.0
    expire_warn_days: float = 3.0


@dataclass
class AccountReport:
    """单账号本轮处置(给 API / 日志用)。"""

    ref: str
    source: str
    platform: str
    display: str
    outcome: ProbeOutcome
    action: str  # probed | skipped_backoff | skipped_unsupported
    health: str = HEALTH_UNKNOWN
    attempt: int = 1


@dataclass
class RoundSummary:
    """一轮全量保活的结果。"""

    started_at: datetime | None = None
    finished_at: datetime | None = None
    total: int = 0
    ok: int = 0
    failed: int = 0
    skipped: int = 0
    unsupported: int = 0
    warned: int = 0
    alerted: int = 0
    reports: list[AccountReport] = field(default_factory=list)
    by_source: dict[str, dict[str, int]] = field(default_factory=dict)

    def add(self, report: AccountReport) -> None:
        self.total += 1
        self.reports.append(report)
        bucket = self.by_source.setdefault(
            report.source,
            {"total": 0, "ok": 0, "failed": 0, "skipped": 0, "unsupported": 0},
        )
        bucket["total"] += 1
        # unsupported 单独一档,**既不算成功也不算失败**。
        # 原实现只在 `action != "probed"` 的分支里累加 unsupported,于是"真探到了、
        # 结论是无需保活"的账号反而落进 failed —— 2026-10-26 首轮实测就出现
        # `ok=1 failed=26`,其中 2 个是 qoder 的"无到期信息、无需保活",面板会把
        # 它们读成故障。这类账号本就不需要保活,当成失败会让真红看不见。
        if report.outcome.kind == KIND_UNSUPPORTED:
            self.unsupported += 1
            bucket["unsupported"] += 1
            return
        if report.action != "probed":
            self.skipped += 1
            bucket["skipped"] += 1
            return
        if report.outcome.ok:
            self.ok += 1
            bucket["ok"] += 1
        else:
            self.failed += 1
            bucket["failed"] += 1

    def as_dict(self) -> dict[str, Any]:
        return {
            "started_at": _iso(self.started_at),
            "finished_at": _iso(self.finished_at),
            "total": self.total,
            "ok": self.ok,
            "failed": self.failed,
            "skipped": self.skipped,
            "unsupported": self.unsupported,
            "warned": self.warned,
            "alerted": self.alerted,
            "by_source": self.by_source,
        }


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

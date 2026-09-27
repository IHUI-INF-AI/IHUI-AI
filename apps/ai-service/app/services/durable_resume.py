# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #84(2026-09-29 立):26h 级耐久任务的续跑正确性与接管边界。

## 这一格补的是哪一句事实

前置已现读确认(不照抄票面):#77 的跨轮账本 `goal_round_state.py` 在位、
`agent_checkpoint.py` 的三层存储 + `load_latest_by_session` 在位、V3 #65 的
pause/resume 控制面在位。票面那句「依赖 51」经现读否证 —— 51 号是账号调度且已归档,
与本票无前置关系,按**无前置**处理。

真正缺的不是机制,是**把机制的性质写成可断言的东西**。三处:

1. **续跑点选取只许有一份规则**(`select_resume_point`)。排序键 = `(iteration, created_at)`,
   **不是 checkpoint id** —— id 是身份不是顺序,"按错的 id 续跑"这件事不能靠"断言 id 相等"
   来防(那是拿结论当判据)。同一轮的 eager 与边界两份检查点 `iteration` 相同(V3 #65
   头注已记录该形状:loop 在轮次边界存的是 `iteration=i-1`,而 `pause()` 用的是
   `self._current_iteration`),**后落的那一份才带着这一轮已完成的工具结果** ⇒ 同轮必须
   按心跳取更晚的一份;两份连 `(iteration, created_at)` 都相同就判"歧义"并点名,不猜。
2. **"不重跑已完成工具"必须量得出**(`tool_ledger`)。已完成 = assistant 发起过**且**历史里有
   对应 `role=="tool"` 结果的那些 `tool_call_id`;发起而没结果的是**待执行**,本来就该重跑。
   两集合必须不相交,且续跑点选得更晚时"已完成集"只能变大不能变小 —— 变小就等于把
   一轮有副作用的工具调用重新发一遍。
3. **僵尸判定要过第二道量纲闸**(`evaluate_takeover`)。既有对账要求"心跳超阈 ∧ 无在飞登记"
   同时成立;本票补一条耐久特有的约束:阈值必须**严格大于单轮执行上界**
   (`dag_scheduler.WorkerPoolConfig.task_timeout_seconds`,现读默认 300s)。否则
   "上一轮还在跑一个 5 分钟工具"与"进程死了"在这把尺子上同形,而接管一个仍在跑轮次的
   run 造成的正是判据 1 要防的那一型。

## 26h 与 24h 的算术冲突(本票唯一的生产行为改动)

`DEFAULT_CHECKPOINT_TTL` = 24h(唯一真源 `app/core/tunables.py`),而本票的视野是 26h。
**在跑的**任务每轮重落一行、每行都自带 24h 寿命,所以不受影响;露馅的是**停手等人回来**
的那一段:一个暂停在 hour 25 的耐久任务,恢复点在 hour 25+24h 前有效 —— 听起来够,
但它若是 hour 1 起、hour 24 暂停、按 26h 预算应在 hour 26 回来续,那**最后 2 小时的预算
落在恢复点过期之后**。`evaluate_renewal` 把这段差额量出来,`renew_resume_point` 用
**既有的 `save_checkpoint` 出口**重落一行同轮检查点补上(不新增表、不新增列、不新增 SQL)。

生效范围刻意收窄到**这一行自己声明了耐久视野**的检查点
(`metadata["durable_horizon_seconds"]`,由发起耐久任务的一方写入;`payload` 是 jsonb
自由字段 ⇒ 零 schema 变更)。没有声明的行**一律不动**,所以这不是"把全局 TTL 改大",
而是"只对点名要耐久的那几行负责"。应急出口 `IHUI_DURABLE_RESUME_RENEWAL=0` 整条关掉
(关掉后仍把差额与"因此没续期"喊出来,不静默)。

## 如实登记:量不到的部分

- 本仓**没有跨实例租约**:`agent_checkpoint._default_alive_probe` 结构上只给得出
  True/None,永远给不出 False。⇒ 第二个实例正在跑同一会话时,本模块与既有对账**都判不出**;
  心跳阈值是唯一屏障,而它是"时长"不是"归属"。这一格只能由未来的跨实例租约关掉。
- 本机是开发机、无多 worker(AGENTS §5b 实测:服务与端口零命中),所以"阈值 900s 够不够"
  只能从**代码里已配置的上界**推导,不能在真实并发下量。本模块与测试都按"推导"口径写,
  不把它写成实测结论。
- 恢复点跨进程这件事,本票覆盖的是"序列化后冷读"(与 `_row_to_agent_checkpoint` 走的是
  同一份 `from_dict`),**PG 那一层的 `ORDER BY created_at DESC` 未被覆盖**(测试禁连生产
  库,AGENTS §5 铁律)。所以续跑点选取的单一源是纯函数,两处 loader 都收口到它,
  SQL 侧只是"少取几行"的取集,不再自带一条排序规则。
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from .agent_checkpoint import (
    CHECKPOINT_STATUS_COMPLETED,
    CHECKPOINT_STATUS_RUNNING,
    RECONCILE_ACTION_MARK_STALE,
    AgentLoopCheckpoint,
    CheckpointReconcileDecision,
    _stale_threshold_seconds,
    decide_checkpoint_stale_reconcile,
)

if TYPE_CHECKING:  # pragma: no cover - 仅类型,运行期用鸭子类型避免包内循环导入
    from .agent_checkpoint import AgentCheckpointManager

logger = logging.getLogger(__name__)

__all__ = [
    "DURABLE_HORIZON_METADATA_KEY",
    "DURABLE_HORIZON_MAX_SECONDS",
    "DURABLE_LAUNCHED_AT_METADATA_KEY",
    "DURABLE_TASK_HORIZON_SECONDS",
    "MAX_ROUND_SECONDS",
    "RENEWAL_COUNT_METADATA_KEY",
    "RENEWED_FROM_METADATA_KEY",
    "RenewalOutcome",
    "RenewalVerdict",
    "ResumePoint",
    "TakeoverVerdict",
    "ToolLedger",
    "collect_resumable",
    "durable_horizon_of",
    "evaluate_renewal",
    "evaluate_takeover",
    "renew_resume_point",
    "renew_resume_point_before_resume",
    "renewal_enabled",
    "select_resume_point",
    "tool_ledger",
]

# ---------------------------------------------------------------------------
# 视野与上界(全部是"已配置数字的推导",不是拍脑袋)
# ---------------------------------------------------------------------------

#: 本票的任务尺度:26 小时。
DURABLE_TASK_HORIZON_SECONDS: float = 26 * 60 * 60.0

#: 耐久视野的硬上限:7 天。超过它就不是"一次任务",而是拿任务表当存储用 ——
#: 拒绝续期并点名(静默按它给的数字续期等于给无界存活开后门)。
DURABLE_HORIZON_MAX_SECONDS: float = 7 * 24 * 60 * 60.0

#: 单轮执行上界。取 `dag_scheduler.WorkerPoolConfig.task_timeout_seconds` 的默认 300s
#: (`app/services/dag_scheduler.py:436`,同一段注释被 agent_checkpoint 的阈值理由引用)。
#: 这里是**判据的分母**,不是新的运行时超时配置 —— 真正的超时仍由 dag_scheduler 说了算,
#: 本常数只回答"心跳阈值小于它时不配谈接管"。刻意写死而不 import:dag_scheduler 引它会把
#: 一个重模块拉进控制面依赖,而这一格要的是"那个数是不是大于阈值"这一个问句。
MAX_ROUND_SECONDS: float = 300.0

#: 检查点 metadata 里声明耐久视野的键(发起方写;None = 该行不是耐久任务)。
DURABLE_HORIZON_METADATA_KEY = "durable_horizon_seconds"
#: 发起时刻(unix 秒)。缺省时按"所选行的 created_at"算 —— 保守方向:早于真正发起时刻
#: 只会让差额算小、不会算大,不会把不该续的续了。
DURABLE_LAUNCHED_AT_METADATA_KEY = "durable_launched_at"
#: 续期痕迹:被哪一行续的 / 第几次。写在 metadata 里(payload 是既有扩展位,零迁移)。
RENEWED_FROM_METADATA_KEY = "renewed_from_checkpoint_id"
RENEWAL_COUNT_METADATA_KEY = "durable_renewal_count"

_RENEWAL_FLAG = "IHUI_DURABLE_RESUME_RENEWAL"
#: 与 `agent_checkpoint._reconcile_enabled` 同一套 falsy 词表(两处语义必须同形)。
_FALSY = frozenset({"0", "false", "off", "no"})


def renewal_enabled() -> bool:
    """续期总开关:每次调用现读环境变量,缺省 on(只对声明了视野的行生效)。"""
    raw = os.environ.get(_RENEWAL_FLAG, "1").strip().lower()
    return raw not in _FALSY


# ---------------------------------------------------------------------------
# 判据 2:已完成 / 待执行的工具调用账
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ToolLedger:
    """一份消息历史里的工具调用账(封闭两集,不相交由构造保证)。"""

    completed: frozenset[str]
    pending: frozenset[str]

    @property
    def total(self) -> int:
        return len(self.completed | self.pending)


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _tool_call_ids(assistant_msg: dict[str, Any]) -> tuple[str, ...]:
    """从一条 assistant 消息里取 tool_call id(形状见 agent_loop_v2.py:3787-3794)。"""
    ids: list[str] = []
    for raw in assistant_msg.get("tool_calls") or []:
        item = _as_dict(raw)
        call_id = item.get("id")
        # OpenAI 兼容形态里 id 也可能藏在 function 之外/之内,只认顶层 `id`:
        # 仓内写入点用的就是顶层 `id`,认第二种形态等于给"取不到"留一条静默通道。
        if isinstance(call_id, str) and call_id:
            ids.append(call_id)
    return tuple(ids)


def tool_ledger(messages: Iterable[Any]) -> ToolLedger:
    """把消息历史折成"已完成 / 待执行"两集。

    判据:一条 `role=="assistant"` 的 tool_call 只有在其**之后**出现过
    `role=="tool"` 且 `tool_call_id` 相同的一条,才算已完成。
    顺序敏感是刻意的 —— 先出现结果、后出现同名发起(新一轮重试)时,那一次发起算待执行,
    这正是"重跑"在历史里留下的指纹,不该被读成已完成。
    """
    requested: list[str] = []
    answered: set[str] = set()
    for raw in messages:
        msg = _as_dict(raw)
        role = msg.get("role")
        if role == "assistant":
            requested.extend(_tool_call_ids(msg))
        elif role == "tool":
            call_id = msg.get("tool_call_id")
            if isinstance(call_id, str) and call_id:
                answered.add(call_id)
    completed = frozenset(cid for cid in requested if cid in answered)
    pending = frozenset(cid for cid in requested if cid not in answered)
    return ToolLedger(completed=completed, pending=pending)


# ---------------------------------------------------------------------------
# 判据 1:续跑点选取(唯一规则)
# ---------------------------------------------------------------------------

EXCLUDE_REASON_EXPIRED = "ttl_expired"
EXCLUDE_REASON_COMPLETED = "status_completed"
#: 可续跑状态封闭集:`resume_from_checkpoint` 对 completed 直接回"无需续跑",
#: 对 cancelled 只 warning 后允许,对 running(崩溃残留)允许 —— 所以 completed
#: 是唯一被排除的一档,其余交给归位/续跑各自处置。
RESUMABLE_EXCLUDED_STATUSES = frozenset({CHECKPOINT_STATUS_COMPLETED})


@dataclass(frozen=True)
class ResumePoint:
    """续跑点选取结论(纯判定,不写存储)。

    `ambiguous` 为真时 `checkpoint` 仍是**确定的一份**(按 id 字典序取,保证可复现),
    但调用方必须把歧义喊出来:两份同轮同心跳的检查点意味着落盘时间撞在一个刻度上,
    这时"取到哪一份"不再由规则决定,而由存储返回顺序决定 —— 那正是重跑一轮的入口。
    """

    checkpoint: AgentLoopCheckpoint | None
    start_iteration: int | None
    ledger: ToolLedger
    excluded: tuple[tuple[str, str], ...]
    ambiguous: bool
    reason: str
    #: 候选集里最早的一轮 created_at:耐久任务的"发起时刻"下界(用于续期差额计算)。
    earliest_created_at: float | None

    @property
    def ok(self) -> bool:
        return self.checkpoint is not None and not self.ambiguous


def collect_resumable(
    candidates: Sequence[AgentLoopCheckpoint], *, now: float
) -> tuple[list[AgentLoopCheckpoint], list[tuple[str, str]]]:
    """按状态与 TTL 过滤候选,并把每一项被排除的**原因**原样带出(不静默丢)。"""
    kept: list[AgentLoopCheckpoint] = []
    excluded: list[tuple[str, str]] = []
    for cp in candidates:
        # 过期判据复用 AgentLoopCheckpoint.is_expired 这一份实现,并喂同一个 now:
        # 不在这里再抄一次 `expires_at <= now`,也不另取一个时钟源。
        if cp.is_expired(now):
            excluded.append((cp.checkpoint_id, EXCLUDE_REASON_EXPIRED))
            continue
        if cp.status in RESUMABLE_EXCLUDED_STATUSES:
            excluded.append((cp.checkpoint_id, EXCLUDE_REASON_COMPLETED))
            continue
        kept.append(cp)
    return kept, excluded


def select_resume_point(
    candidates: Sequence[AgentLoopCheckpoint], *, now: float | None = None
) -> ResumePoint:
    """从候选检查点里选出续跑点:**轮次优先,同轮取更晚心跳**。

    这是全仓关于"哪一行的 iteration 更大就更晚、同一轮里哪一份更完整"的**唯一**一条
    规则;`load_latest_by_session`(按 created_at 取一行)与 `agent_run_control`
    的 `_default_load_latest` 收口到它,不再各自写 max/ORDER BY 之外的判断。
    """
    current = time.time() if now is None else now
    kept, excluded = collect_resumable(candidates, now=current)
    if not kept:
        return ResumePoint(
            checkpoint=None,
            start_iteration=None,
            ledger=ToolLedger(completed=frozenset(), pending=frozenset()),
            excluded=tuple(excluded),
            ambiguous=False,
            reason="no_resumable_candidate",
            earliest_created_at=None,
        )

    best_key = max((cp.iteration, cp.created_at) for cp in kept)
    tied = [cp for cp in kept if (cp.iteration, cp.created_at) == best_key]
    # 同键时按 id 字典序取,保证"同一输入必得同一输出";歧义另用 ambiguous 标出。
    picked = min(tied, key=lambda cp: cp.checkpoint_id)
    return ResumePoint(
        checkpoint=picked,
        start_iteration=picked.iteration + 1,
        ledger=tool_ledger(picked.messages),
        excluded=tuple(excluded),
        ambiguous=len(tied) > 1,
        reason=(
            "same_round_multiple_saves_tie_broken_by_heartbeat"
            if len(tied) > 1
            else "max_iteration_then_latest_heartbeat"
        ),
        earliest_created_at=min(cp.created_at for cp in kept),
    )


def rounds_advance_ok(previous: AgentLoopCheckpoint, nxt: AgentLoopCheckpoint) -> bool:
    """"轮次严格递增"判据:后一次续跑点必须比前一次**更靠后**。

    刻意不比 checkpoint_id(票面那条"不要断 id 相等"),也不比 created_at
    (一次时钟回拨就能把顺序判反;轮次才是这套检查点的进度语义)。
    """
    return nxt.iteration > previous.iteration


# ---------------------------------------------------------------------------
# 判据 3:僵尸判定与可安全接管
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TakeoverVerdict:
    """接管判定结论(把"判据说了什么"与"判据看不见什么"分字段带出)。"""

    safe_to_take_over: bool
    decision: CheckpointReconcileDecision
    threshold_seconds: float
    #: 阈值不大于单轮上界 ⇒ 底层说要归位,但这一型不许当成"可以接管"。
    blocked_by_round_bound: bool
    #: 本机制的结构盲区,如实点名(不为消红去改判据)。None = 这一格没有未判定。
    undetermined: str | None


def evaluate_takeover(
    checkpoint: AgentLoopCheckpoint,
    *,
    now: float | None = None,
    alive: bool | None = None,
    stale_after_seconds: float | None = None,
    max_round_seconds: float = MAX_ROUND_SECONDS,
) -> TakeoverVerdict:
    """多久可以把一个 `running` 检查点判成"上次进程没跑完"并接管。

    委托 `decide_checkpoint_stale_reconcile`(唯一实现,不在此重写"心跳 + 在飞登记"
    那条与门),再叠一条耐久特有的量纲闸:**阈值不大于单轮执行上界时不许接管**。
    """
    current = time.time() if now is None else now
    threshold = (
        _stale_threshold_seconds() if stale_after_seconds is None else stale_after_seconds
    )
    decision = decide_checkpoint_stale_reconcile(
        checkpoint, now=current, alive=alive, stale_after_seconds=threshold
    )
    wants_mark = decision.action == RECONCILE_ACTION_MARK_STALE
    blocked = wants_mark and threshold <= max_round_seconds
    undetermined: str | None = None
    if alive is None:
        undetermined = (
            "存活信号判不出:本仓无跨实例租约,_default_alive_probe 结构上只给得出 "
            "True/None ⇒ 无法排除另一个实例正在跑同一会话;心跳阈值是唯一屏障,"
            "而它是时长不是归属"
        )
    return TakeoverVerdict(
        safe_to_take_over=wants_mark and not blocked,
        decision=decision,
        threshold_seconds=threshold,
        blocked_by_round_bound=blocked,
        undetermined=undetermined,
    )


# ---------------------------------------------------------------------------
# 26h 视野 ↔ 24h TTL:续期
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RenewalVerdict:
    """续期判定结论(needed / 差额 / 判不出的原因三态齐备)。"""

    needed: bool
    horizon_seconds: float | None
    deadline_ts: float | None
    shortfall_seconds: float
    reason: str


def durable_horizon_of(checkpoint: AgentLoopCheckpoint) -> RenewalVerdict | None:
    """读这一行自己声明的耐久视野。

    三态:未声明(None)/ 声明但不可信(返回带 reason 的 verdict,`needed=False`)/
    声明且合法(返回 None,由调用方继续算差额)。
    非法值一律**不**回退成默认视野 —— 那等于替一个写错的数字做出"它想耐久"的判断。
    """
    raw = checkpoint.metadata.get(DURABLE_HORIZON_METADATA_KEY)
    if raw is None:
        return None
    try:
        horizon = float(raw)
    except (TypeError, ValueError):
        return RenewalVerdict(
            needed=False,
            horizon_seconds=None,
            deadline_ts=None,
            shortfall_seconds=0.0,
            reason=f"declared_horizon_unparseable({raw!r})",
        )
    if horizon <= 0:
        return RenewalVerdict(
            needed=False,
            horizon_seconds=None,
            deadline_ts=None,
            shortfall_seconds=0.0,
            reason=f"declared_horizon_nonpositive({horizon})",
        )
    if horizon > DURABLE_HORIZON_MAX_SECONDS:
        return RenewalVerdict(
            needed=False,
            horizon_seconds=horizon,
            deadline_ts=None,
            shortfall_seconds=0.0,
            reason=f"declared_horizon_exceeds_cap({DURABLE_HORIZON_MAX_SECONDS:.0f}s)",
        )
    return None  # 合法,交给 evaluate_renewal 算差额


def evaluate_renewal(
    checkpoint: AgentLoopCheckpoint,
    *,
    now: float | None = None,
    launched_at: float | None = None,
) -> RenewalVerdict:
    """恢复点够不够活到这次任务的预算终点。

    `deadline = launched_at + horizon`,`shortfall = deadline - expires_at`。
    `launched_at` 取 metadata 声明值,否则取候选集里最早的一行(由调用方喂),
    再否则退回这一行自己的 created_at —— 三者都是**下界方向**的保守取值:
    发起时刻被算晚才会多续,被算早只会少续,所以缺省路径选最晚可能值。

    已经过 TTL 的行**一律不判"需要续期"**:过期是策略判过的死刑,拿一行已经死的
    恢复点去续期等于把它复活(而这条路径的入口没有别的存活证据)。过期判据复用
    `AgentLoopCheckpoint.is_expired`,不在此另抄一次 `expires_at <= now`。
    """
    current = time.time() if now is None else now
    invalid = durable_horizon_of(checkpoint)
    if invalid is not None:
        return invalid
    horizon_raw = checkpoint.metadata.get(DURABLE_HORIZON_METADATA_KEY)
    horizon = float(horizon_raw) if horizon_raw is not None else 0.0
    if checkpoint.is_expired(current):
        return RenewalVerdict(
            needed=False,
            horizon_seconds=horizon,
            deadline_ts=None,
            shortfall_seconds=0.0,
            reason="resume_point_already_expired",
        )
    declared_start = checkpoint.metadata.get(DURABLE_LAUNCHED_AT_METADATA_KEY)
    start: float
    if isinstance(declared_start, (int, float)):
        start = float(declared_start)
    elif launched_at is not None:
        start = launched_at
    else:
        start = checkpoint.created_at
    deadline = start + horizon
    shortfall = deadline - checkpoint.expires_at
    if shortfall <= 0:
        return RenewalVerdict(
            needed=False,
            horizon_seconds=horizon,
            deadline_ts=deadline,
            shortfall_seconds=0.0,
            reason="resume_point_outlives_declared_horizon",
        )
    return RenewalVerdict(
        needed=True,
        horizon_seconds=horizon,
        deadline_ts=deadline,
        shortfall_seconds=shortfall,
        reason="declared_horizon_outlives_checkpoint_ttl",
    )


@dataclass(frozen=True)
class RenewalOutcome:
    """续期处置结论(封闭集;`changed` 与 `reason` 分两格,不许合并)。"""

    outcome: str
    changed: bool
    checkpoint_id: str | None
    detail: str


OUTCOME_NOT_DURABLE = "not_durable"
OUTCOME_NOT_NEEDED = "not_needed"
OUTCOME_DISABLED = "disabled"
OUTCOME_RENEWED = "renewed"
OUTCOME_FAILED = "failed"
OUTCOME_UNDETERMINED = "undetermined"


async def renew_resume_point(
    checkpoint: AgentLoopCheckpoint,
    *,
    manager: AgentCheckpointManager | None = None,
    now: float | None = None,
    launched_at: float | None = None,
) -> RenewalOutcome:
    """把恢复点重落一行(同轮、同消息、同状态),让 `expires_at` 重新计时。

    **只走既有 `save_checkpoint` 出口**:不新增表、不新增列、不写裸 SQL,
    新行与旧行同 iteration ⇒ 判据 1 的"同轮取更晚心跳"会自然选中它,而消息逐字不变
    ⇒ 工具账不变(见回归:`test_renewal_does_not_change_tool_ledger`)。
    """
    current = time.time() if now is None else now
    if checkpoint.metadata.get(DURABLE_HORIZON_METADATA_KEY) is None:
        return RenewalOutcome(
            outcome=OUTCOME_NOT_DURABLE,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=(
                "该行未声明耐久视野(metadata 无 "
                f"{DURABLE_HORIZON_METADATA_KEY}):不代它决定要活多久"
            ),
        )
    invalid = durable_horizon_of(checkpoint)
    if invalid is not None:
        # 声明了但不可信:这是发起方的缺陷,必须点名,不得当成"不是耐久任务"混过去。
        return RenewalOutcome(
            outcome=OUTCOME_FAILED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=invalid.reason,
        )
    verdict = evaluate_renewal(checkpoint, now=current, launched_at=launched_at)
    if not verdict.needed:
        return RenewalOutcome(
            outcome=OUTCOME_NOT_NEEDED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=verdict.reason,
        )
    if not renewal_enabled():
        logger.info(
            "耐久恢复点差额 %.0fs 未续期(%s=0):checkpoint=%s reason=%s",
            verdict.shortfall_seconds,
            _RENEWAL_FLAG,
            checkpoint.checkpoint_id,
            verdict.reason,
        )
        return RenewalOutcome(
            outcome=OUTCOME_DISABLED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=(
                f"开关关闭,差额 {verdict.shortfall_seconds:.0f}s 已如实登记;"
                f"{_RENEWAL_FLAG}=0"
            ),
        )
    if manager is None:
        return RenewalOutcome(
            outcome=OUTCOME_UNDETERMINED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail="未注入 manager 且惰性解析失败:不猜该往哪个存储续期",
        )
    count_raw = checkpoint.metadata.get(RENEWAL_COUNT_METADATA_KEY)
    count = int(count_raw) if isinstance(count_raw, (int, float)) else 0
    metadata: dict[str, Any] = {
        **checkpoint.metadata,
        RENEWED_FROM_METADATA_KEY: checkpoint.checkpoint_id,
        RENEWAL_COUNT_METADATA_KEY: count + 1,
    }
    try:
        new_id = await manager.save_checkpoint(
            session_id=checkpoint.session_id,
            iteration=checkpoint.iteration,
            messages=checkpoint.messages,
            tool_state=checkpoint.tool_state,
            status=checkpoint.status,
            metadata=metadata,
            owner_user_id=checkpoint.owner_user_id,
        )
    except Exception as exc:  # noqa: BLE001 - 续期失败不得打断续跑,但必须转成显式结论
        logger.warning(
            "耐久恢复点续期失败(不阻塞续跑):checkpoint=%s %s: %s",
            checkpoint.checkpoint_id,
            type(exc).__name__,
            exc,
        )
        return RenewalOutcome(
            outcome=OUTCOME_FAILED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=f"save_checkpoint 抛 {type(exc).__name__}: {exc}",
        )
    if not new_id:
        return RenewalOutcome(
            outcome=OUTCOME_FAILED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail="save_checkpoint 返回空 id:存储没接住这一行(不得当成已续期)",
        )
    logger.info(
        "耐久恢复点已续期:%s -> %s(session=%s iter=%d 差额 %.0fs 已补)",
        checkpoint.checkpoint_id,
        new_id,
        checkpoint.session_id,
        checkpoint.iteration,
        verdict.shortfall_seconds,
    )
    return RenewalOutcome(
        outcome=OUTCOME_RENEWED,
        changed=True,
        checkpoint_id=new_id,
        detail=(
            f"同轮重落一行(第 {count + 1} 次续期),expires_at 重新计时以覆盖 "
            f"{verdict.deadline_ts}"
        ),
    )


async def renew_resume_point_before_resume(
    checkpoint: AgentLoopCheckpoint,
    *,
    manager: AgentCheckpointManager | None = None,
    now: float | None = None,
) -> RenewalOutcome:
    """控制面调用的那一行出口:解析单例 manager + 把"没做"都写成显式结论。

    续跑的正确性**不依赖**续期,所以这里任何一格(未声明/不需要/开关关/存储异常)
    都只产出一条可诊断结论,绝不抛给续跑路径。

    **未声明耐久的行连 manager 都不解析** —— 这一条不是性能优化,是作用域约束:
    续期是本票新加的行为,不得让每一次普通 resume 顺带触发一次单例构建
    (它会去 ping 配置的 redis)。"给全链路加副作用"的机制一律按声明范围生效。
    """
    if checkpoint.metadata.get(DURABLE_HORIZON_METADATA_KEY) is None:
        return RenewalOutcome(
            outcome=OUTCOME_NOT_DURABLE,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=(
                "该行未声明耐久视野(metadata 无 "
                f"{DURABLE_HORIZON_METADATA_KEY}):不代它决定要活多久"
            ),
        )
    resolved = manager
    if resolved is None:
        try:
            from .agent_checkpoint import get_agent_checkpoint_manager

            resolved = get_agent_checkpoint_manager()
        except Exception as exc:  # noqa: BLE001 - 取不到单例 = 判不出,不猜落点
            logger.warning(
                "checkpoint manager 单例不可得,跳过续期:%s: %s", type(exc).__name__, exc
            )
            resolved = None
    if resolved is None:
        return RenewalOutcome(
            outcome=OUTCOME_UNDETERMINED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail="manager 不可得:未判定,不当成已续期",
        )
    return await renew_resume_point(checkpoint, manager=resolved, now=now)


# ---------------------------------------------------------------------------
# 归位/僵尸判据要看的状态位说明(与 agent_checkpoint 的封闭集同形,不另立)
# ---------------------------------------------------------------------------

#: 心跳行:`running` 且 created_at 就是最后一次落盘时刻。误用这一格(比如拿
#: 首次 created_at 当存活证据)会把别人真死掉的 run 判成活着 —— 见
#: `agent_checkpoint.CHECKPOINT_STALE_AFTER_SECONDS` 的取值理由与本文件的
#: `evaluate_takeover`。
HEARTBEAT_STATUS = CHECKPOINT_STATUS_RUNNING
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

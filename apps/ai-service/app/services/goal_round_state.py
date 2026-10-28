# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""goal 自评估闭环的**跨轮账本**(V3 #77:轮次 / 连续未过 / 无进展 / 预算)。

为什么必须单独有这一层:`completion_verification.py` 判的是"这一次成不成",
`goal_completion_gate.py` 判的是"这一次能不能宣布达成"。而 §8 第 4 步要的是
**"连续 N 轮 no 无进展 → blocked"** —— 那是一个跨轮的陈述,必须有一份落得住的账。
在接线前,那份账是 `goal_completion_gate.py` 里的一个进程内 dict,于是:

1. **重启即清零**:每次进程重启,连击计数从 0 重新起算 ⇒ 一个每轮重启的调用方
   永远走不到 blocked(§8 的收口从未真正生效过,而账面什么都看不出来);
2. **多 worker 各记各的**:uvicorn 多进程时每个 worker 一份 dict ⇒ 同样永不收口;
3. **HTTP 端点结构上没有这本账**:`POST /api/agent/goal-verify` 是无状态的,
   响应里 `consecutive_failures` 恒为 0 ⇒ 走这条链的调用方只能自己数,自己数就
   自己丢(它同样是进程内状态)。

三条设计约束(不可让):

- **不新造第二套状态存储**:持久层复用仓库既有的 checkpoint 出口
  (`services/agent_checkpoint.py` 的 `AgentCheckpointManager`,三层存储 + TTL +
  `owner_user_id` 属主位都在它身上,`metadata` 是该模块文档明写的"既有扩展位,
  无 schema 迁移")。本模块只写**带命名空间前缀的 session 键**
  (`goal-round:<sid>`),因此 `load_latest_by_session(真实 sid)` 永远读不到它 ——
  否则一次 goal 记账就会把别人的可续跑 checkpoint 顶掉(那是比"不持久"更坏的后果)。
- **"判不了"不得被折成"没欠账"**:存储不可读 / 载荷形状不认识时,一律报
  `unreadable`,调用方必须把它当成"计数未知"而不是 0。把未知写成 0 就是
  给每一次重启发一张"从头再来"的合格证,而 §8 恰恰不许这么做。
- **预算耗尽 ≠ 达成,也 ≠ blocked**:`budget_limited` 是第三档(§8 budget 子命令
  语义),恢复端要分得出来。

进程内 store 仍是缺省档(`app/main.py` 的 lifespan 才把持久档装上)。这不是留后门:
持久档要求被审的库真在配置里,而单元测试环境带着开发库连接串(§5 测试隔离铁律),
自动装会直接把测试写进真库。所以装载是显式动作,且**响应里如实回 `storage` 字段** ——
"这一问的账是不是落得住"必须对调用方可见,不得让它以为持久其实是内存。
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final, Protocol

logger = logging.getLogger(__name__)

#: 账本落在 checkpoint 的 metadata 里,只有这一个键名(第二处出现即第二份真相)
STATE_METADATA_KEY: Final = "goal_verification_round"
#: checkpoint 的 session 命名空间。真实会话键永远不带这个前缀 ⇒ 不会互相顶掉
SESSION_KEY_PREFIX: Final = "goal-round:"

STORAGE_MEMORY: Final = "memory"
STORAGE_CHECKPOINT: Final = "checkpoint"

#: 一轮校验的生命周期结论封闭集(与 `goal_completion_gate.GoalStatus` 同族,
#: 但不含 not_declared/skipped —— 那两档根本不记账,没有"这一轮"可记)
ROUND_ACHIEVED: Final = "achieved"
ROUND_NOT_ACHIEVED: Final = "not_achieved"
ROUND_UNDETERMINED: Final = "undetermined"
ROUND_BUDGET_LIMITED: Final = "budget_limited"
#: blocked 是**推导出来的档**,不是校验结果本身
ROUND_BLOCKED: Final = "blocked"
ROUND_STATUSES: Final[frozenset[str]] = frozenset(
    {
        ROUND_ACHIEVED,
        ROUND_NOT_ACHIEVED,
        ROUND_UNDETERMINED,
        ROUND_BUDGET_LIMITED,
        ROUND_BLOCKED,
    }
)

#: 收口原因的封闭集。自由字符串等于没有原因(与 agent_checkpoint 的 RECONCILE_REASONS 同理)
BLOCK_REASON_NONE: Final = ""
BLOCK_REASON_CONSECUTIVE: Final = "consecutive_failures"
#: 未达标集合逐轮完全相同 = §8 说的"无进展"(它比"未通过"更具体,处置动作也不同:
#: 前者该停手换思路/上报,后者还可以照原路再试)
BLOCK_REASON_NO_PROGRESS: Final = "no_progress"
#: 预算耗尽:既不判达成也不判 blocked
BLOCK_REASON_BUDGET: Final = "budget_exhausted"
BLOCK_REASONS: Final[frozenset[str]] = frozenset(
    {
        BLOCK_REASON_NONE,
        BLOCK_REASON_CONSECUTIVE,
        BLOCK_REASON_NO_PROGRESS,
        BLOCK_REASON_BUDGET,
    }
)

#: 载荷版本号:只有 v1 一种形状。版本不认识 ⇒ unreadable,绝不"尽力解析成 0 轮"
STATE_SCHEMA_VERSION: Final = 1

UnmetSet = tuple[str, ...]


@dataclass(frozen=True)
class GoalRoundState:
    """一个会话的 goal 自评估账本(跨轮唯一真相,不得在调用方另抄一份)。"""

    session_id: str
    owner_user_id: str | None
    #: 已记账的校验轮次(含本轮)
    rounds: int
    #: 连续未通过轮数(达成即归零)—— §8 第 4 步的计数
    consecutive_failures: int
    #: 连续"未达标集合与上一轮完全相同"的轮数(0 = 还没有可比的两轮)
    stagnation: int
    #: 最近一轮"未达成"的指标 id 集合(已排序;达成时为空)
    last_unmet: UnmetSet
    #: 最近一轮的生命周期结论
    last_status: str
    blocked: bool
    blocked_reason: str
    #: 累计 token 消耗(调用方逐轮上报;从未上报过即 None —— 不得当成 0)
    tokens_spent: int | None
    #: 预算上限(调用方声明;None = 没声明过,因此也永不判耗尽)
    token_budget: int | None
    updated_at: float

    def to_payload(self) -> dict[str, object]:
        return {
            "v": STATE_SCHEMA_VERSION,
            "session_id": self.session_id,
            "owner_user_id": self.owner_user_id,
            "rounds": self.rounds,
            "consecutive_failures": self.consecutive_failures,
            "stagnation": self.stagnation,
            "last_unmet": list(self.last_unmet),
            "last_status": self.last_status,
            "blocked": self.blocked,
            "blocked_reason": self.blocked_reason,
            "tokens_spent": self.tokens_spent,
            "token_budget": self.token_budget,
            "updated_at": self.updated_at,
        }

    def as_view(self) -> dict[str, object]:
        """给 HTTP 响应/日志用的只读视图(与 payload 同形,单点构造)。"""
        return self.to_payload()


@dataclass(frozen=True)
class GoalRoundRead:
    """一次读取的**三态**结论。

    `found=False, unreadable=False` 才是"这个会话确实没有账";
    `unreadable=True` 是"账可能有,但这台机器读不出它",调用方不得据此把计数当 0。
    """

    found: bool
    state: GoalRoundState | None
    unreadable: bool
    reason: str | None


NOT_FOUND: Final = GoalRoundRead(found=False, state=None, unreadable=False, reason=None)


def _as_int(value: object) -> int | None:
    """严格整数读取:bool 不当 int,float 只收整数值,其余 None。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def _as_str_list(value: object) -> list[str] | None:
    if not isinstance(value, list):
        return None
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            return None
        out.append(item)
    return out


def parse_state_payload(raw: object) -> GoalRoundState | None:
    """把 checkpoint metadata 里的载荷解回账本;任何一处不认识即 None(=判不了)。

    刻意不做"缺字段按默认值补齐":载荷漂了却解析成功,产出的就是一份**看起来干净
    的假账**(比如 consecutive_failures 丢了就当成 0),而那正是本模块要防的失效型。
    """
    if not isinstance(raw, dict):
        return None
    if _as_int(raw.get("v")) != STATE_SCHEMA_VERSION:
        return None
    # 逐条 isinstance/None 收窄(而不是攒一个 `bad` 布尔再统一 return):
    # 后者对我自己好读,对类型检查器是零信息 —— 收窄失败会一路漂到构造参数上。
    session_id = raw.get("session_id")
    if not isinstance(session_id, str) or not session_id:
        return None
    last_status = raw.get("last_status")
    if not isinstance(last_status, str) or last_status not in ROUND_STATUSES:
        return None
    blocked_reason = raw.get("blocked_reason")
    if (
        not isinstance(blocked_reason, str)
        or blocked_reason not in BLOCK_REASONS
    ):
        return None
    owner = raw.get("owner_user_id")
    if owner is not None and not isinstance(owner, str):
        return None
    rounds = _as_int(raw.get("rounds"))
    if rounds is None or rounds < 0:
        return None
    streak = _as_int(raw.get("consecutive_failures"))
    if streak is None or streak < 0:
        return None
    stagnation = _as_int(raw.get("stagnation"))
    if stagnation is None or stagnation < 0:
        return None
    blocked = raw.get("blocked")
    if not isinstance(blocked, bool):
        return None
    unmet = _as_str_list(raw.get("last_unmet"))
    if unmet is None:
        return None
    updated_at = _as_int(raw.get("updated_at"))
    if updated_at is None:
        return None
    tokens_spent = _as_int(raw.get("tokens_spent")) if raw.get("tokens_spent") is not None else None
    if raw.get("tokens_spent") is not None and tokens_spent is None:
        return None
    token_budget = _as_int(raw.get("token_budget")) if raw.get("token_budget") is not None else None
    if raw.get("token_budget") is not None and token_budget is None:
        return None
    return GoalRoundState(
        session_id=session_id,
        owner_user_id=owner,
        rounds=rounds,
        consecutive_failures=streak,
        stagnation=stagnation,
        last_unmet=tuple(sorted(unmet)),
        last_status=last_status,
        blocked=blocked,
        blocked_reason=blocked_reason,
        tokens_spent=tokens_spent,
        token_budget=token_budget,
        # updated_at 用 int 存(避免 float 往返误差);读回按 float 用
        updated_at=float(updated_at),
    )


def state_from_checkpoint_metadata(
    metadata: object, *, session_id: str
) -> GoalRoundRead:
    """从 checkpoint 的 metadata 里取账本(三态;命名键不存在 = 确实没有账)。"""
    if not isinstance(metadata, dict):
        return GoalRoundRead(
            found=False, state=None, unreadable=True, reason="metadata 不是对象"
        )
    if STATE_METADATA_KEY not in metadata:
        return NOT_FOUND
    parsed = parse_state_payload(metadata.get(STATE_METADATA_KEY))
    if parsed is None:
        return GoalRoundRead(
            found=False, state=None, unreadable=True, reason="账本载荷形状不认识"
        )
    if parsed.session_id != session_id:
        # 载荷里的会话与键不一致 ⇒ 有人往别的会话名下写了账。判"读不出",
        # 不得拿它当本会话的历史(那是跨会话串账)。
        return GoalRoundRead(
            found=False, state=None, unreadable=True, reason="账本会话归属不符"
        )
    return GoalRoundRead(found=True, state=parsed, unreadable=False, reason=None)


def encode_state_metadata(
    state: GoalRoundState, *, extra: dict[str, object] | None = None
) -> dict[str, object]:
    """构造 checkpoint metadata(唯一出口,禁止在调用方手拼同名键)。"""
    meta: dict[str, object] = dict(extra or {})
    meta[STATE_METADATA_KEY] = state.to_payload()
    if state.owner_user_id:
        meta["owner_user_id"] = state.owner_user_id
    return meta


# ==================== 纯函数:一轮结论怎么并进账本 ====================


@dataclass(frozen=True)
class RoundOutcome:
    """一次校验的输入事实(由调用方从校验结论里摘出来,本层不再判语义)。"""

    status: str
    unmet: UnmetSet
    tokens_this_round: int | None = None
    token_budget: int | None = None


def normalize_outcome(
    *,
    status: str,
    unmet: Sequence[str],
    tokens_this_round: int | None = None,
    token_budget: int | None = None,
) -> RoundOutcome:
    """把一次校验结论收成 `RoundOutcome`(校验档必须在封闭集内,否则拒绝记账)。

    `status="blocked"` **不是**输入档:blocked 由账本推导。允许它进来就等于允许
    调用方自称"我收口了" —— 那是把收口权交回给被考核者。
    """
    if status not in (ROUND_ACHIEVED, ROUND_NOT_ACHIEVED, ROUND_UNDETERMINED, ROUND_BUDGET_LIMITED):
        raise ValueError(f"status 必须是可记账档,实得 {status!r}")
    if tokens_this_round is not None and tokens_this_round < 0:
        raise ValueError("tokens_this_round 不得为负")
    if token_budget is not None and token_budget <= 0:
        raise ValueError("token_budget 必须是正数或 None(0 会被读成'预算已耗尽')")
    return RoundOutcome(
        status=status,
        unmet=tuple(sorted({str(x) for x in unmet})),
        tokens_this_round=tokens_this_round,
        token_budget=token_budget,
    )


def advance_round_state(
    *,
    session_id: str,
    owner_user_id: str | None,
    outcome: RoundOutcome,
    previous: GoalRoundState | None,
    max_consecutive_failures: int,
    now: float | None = None,
) -> GoalRoundState:
    """把一轮校验结论并进账本,返回新账本(纯函数,零 I/O)。

    计数规则三条,方向一律"只更保守,绝不更宽松":

    - **达成**才归零连击;`undetermined`(判不了)照计 —— 否则一个恒坏的 judge
      可以让 goal 永远续跑(现有闸门已是这条口径,本层不得比它松)。
    - **无进展**单独记:未达标集合与上一轮逐字相同 ⇒ stagnation + 1。它与
      "连续未过"同时到阈值时,收口原因报 `no_progress`(更具体的那条赢),因为它
      才是 §8 第 4 步的原话。
    - `previous is None` 有两种来源:"确实没有账" 与 "账读不出来"(unreadable)。
      本函数**不区分**它们(区分是调用方的事,见 `decide_pause`):账读不出来时
      连击只能从 1 重新起,这是**低估**,因此必须被单独喊出去 —— 让它冒充"这活儿
      才第一次没做完"就是给每一次存储抖动发一张"从头再来"的合格证。
    """
    if max_consecutive_failures < 1:
        raise ValueError("max_consecutive_failures 必须 >= 1")
    stamp = now if now is not None else time.time()
    prev_streak = 0 if previous is None else previous.consecutive_failures
    prev_rounds = 0 if previous is None else previous.rounds
    prev_tokens = None if previous is None else previous.tokens_spent
    budget = outcome.token_budget if outcome.token_budget is not None else (
        None if previous is None else previous.token_budget
    )
    spent = prev_tokens
    if outcome.tokens_this_round is not None:
        spent = (prev_tokens or 0) + outcome.tokens_this_round

    if outcome.status == ROUND_ACHIEVED:
        streak = 0
        stagnation = 0
    else:
        streak = prev_streak + 1
        # 显式分开两步判(把 previous is not None 收进一个 bool 变量,mypy 才认得
        # 后面那次 `previous.stagnation` 不是 None):合并成一行条件会把收窄丢掉。
        comparable = previous is not None and previous.last_status != ROUND_ACHIEVED
        same_set = comparable and previous is not None and previous.last_unmet == outcome.unmet
        stagnation = (previous.stagnation + 1) if (same_set and previous is not None) else 0

    budget_exhausted = budget is not None and spent is not None and spent >= budget
    over_streak = streak >= max_consecutive_failures
    over_stall = stagnation >= max(1, max_consecutive_failures - 1)
    blocked = (over_streak or over_stall or budget_exhausted) and outcome.status != ROUND_ACHIEVED
    if outcome.status == ROUND_ACHIEVED:
        reason = BLOCK_REASON_NONE
    elif budget_exhausted:
        reason = BLOCK_REASON_BUDGET
    elif over_stall and (over_streak or stagnation > 0):
        reason = BLOCK_REASON_NO_PROGRESS
    elif over_streak:
        reason = BLOCK_REASON_CONSECUTIVE
    else:
        reason = BLOCK_REASON_NONE

    last_status = ROUND_BLOCKED if blocked and outcome.status != ROUND_BUDGET_LIMITED else outcome.status
    if blocked and outcome.status == ROUND_BUDGET_LIMITED:
        last_status = ROUND_BUDGET_LIMITED
    return GoalRoundState(
        session_id=session_id,
        # 属主一旦定下就不被后来的匿名请求抹掉(抹掉等于把这条账变成无主可读)
        owner_user_id=(owner_user_id if owner_user_id else (None if previous is None else previous.owner_user_id)),
        rounds=prev_rounds + 1,
        consecutive_failures=streak,
        stagnation=stagnation,
        last_unmet=outcome.unmet,
        last_status=last_status,
        blocked=blocked,
        blocked_reason=reason,
        tokens_spent=spent,
        token_budget=budget,
        updated_at=stamp,
    )


@dataclass(frozen=True)
class PauseDecision:
    """闭环的"要不要停 / 要不要报人"两个结论。

    两档刻意**不合并**:
    - `pausing` = 账本判收口(blocked / 预算耗尽)⇒ 不许再问下一轮,也不许宣布完成;
    - `escalate` = 必须到人。它包含 `pausing`,并额外覆盖"账读不出来"这一型 ——
      存储坏了既不该停掉全站 goal(那是把一次 redis 抖动放大成生产事故),
      更不该安静地继续(连击被低估意味着 §8 的收口永不触发)。
      把这个情形只落在日志里 = 没人会看,所以它必须出现在响应字段上。
    """

    pausing: bool
    escalate: bool
    reason: str


def decide_pause(
    state: GoalRoundState | None,
    *,
    ledger_unreadable: bool = False,
) -> PauseDecision:
    """由账本推出暂停结论(唯一出口;调用方不得自己 `if streak >= 3`)。"""
    if state is not None and state.blocked:
        reason = state.blocked_reason or BLOCK_REASON_CONSECUTIVE
        if state.last_status == ROUND_BUDGET_LIMITED:
            reason = BLOCK_REASON_BUDGET
        return PauseDecision(pausing=True, escalate=True, reason=reason)
    if ledger_unreadable:
        return PauseDecision(
            pausing=False, escalate=True, reason="ledger_unreadable"
        )
    return PauseDecision(pausing=False, escalate=False, reason=BLOCK_REASON_NONE)


# ==================== 存储出口 ====================

SessionId = str


@dataclass(frozen=True)
class WriteReceipt:
    """一次写入的回执:`storage` 必须如实报自己落在哪一层。"""

    storage: str
    durable: bool
    reason: str | None = None


class GoalRoundStore(Protocol):
    """跨轮账本的存储出口(唯一实现契约,不得在调用方另写一份计数)。"""

    name: str

    def describe(self) -> WriteReceipt: ...

    async def read(self, session_id: SessionId) -> GoalRoundRead: ...

    async def write(self, state: GoalRoundState) -> WriteReceipt: ...

    async def clear(self, session_id: SessionId) -> bool: ...


class InProcessGoalRoundStore:
    """进程内账本(缺省档)。语义与接线前那份 dict 等值,只多记了轮次与无进展。

    它同时充当 `CheckpointGoalRoundStore` 的 L1:每次持久读回填、每次持久写先落它,
    因此同步行 API(`peek_goal_attempts` 一类)在两种档位下读到的都是同一份数。
    """

    name = STORAGE_MEMORY

    def __init__(self) -> None:
        self._states: dict[str, GoalRoundState] = {}
        self._lock = asyncio.Lock()

    def describe(self) -> WriteReceipt:
        return WriteReceipt(storage=self.name, durable=False, reason=None)

    def read_sync(self, session_id: SessionId) -> GoalRoundState | None:
        return self._states.get(session_id)

    def write_sync(self, state: GoalRoundState) -> None:
        self._states[state.session_id] = state

    def clear_sync(self, session_id: SessionId) -> bool:
        return self._states.pop(session_id, None) is not None

    async def read(self, session_id: SessionId) -> GoalRoundRead:
        async with self._lock:
            state = self._states.get(session_id)
        if state is None:
            return NOT_FOUND
        return GoalRoundRead(found=True, state=state, unreadable=False, reason=None)

    async def write(self, state: GoalRoundState) -> WriteReceipt:
        async with self._lock:
            self._states[state.session_id] = state
        return self.describe()

    async def clear(self, session_id: SessionId) -> bool:
        async with self._lock:
            return self._states.pop(session_id, None) is not None


class CheckpointSink(Protocol):
    """`AgentCheckpointManager` 在本层用到的那一小片面(便于注入替身)。

    刻意只声明三个方法:本模块不得去碰 restore/list/cleanup_expired —— 那会把"记账"
    做成第二个 checkpoint 生命周期管理者,而那个职责已有唯一主人。
    """

    async def load_latest_by_session(self, session_id: str) -> object: ...

    async def save_checkpoint(
        self,
        session_id: str,
        iteration: int,
        messages: list[dict[str, object]],
        tool_state: dict[str, object],
        status: str = ...,
        metadata: dict[str, object] | None = ...,
        # 位置也必须是第 7 个:实现体(`agent_checkpoint.py:541`)在 metadata 之后、
        # owner_user_id 之前插了 file_snapshots。Protocol 只按**位置**匹配参数,漏掉这一格
        # 会让 `mypy --strict` 判 AgentCheckpointManager 不满足本面 —— 而它正是 main.py 注入
        # 的那个实现。补齐后本条从"类型不匹配"变成"形状一致",运行期一行都不变
        # (本模块自己全部用关键字实参调用:见 :602-:604)。
        file_snapshots: list[dict[str, object]] | None = ...,
        owner_user_id: str | None = ...,
    ) -> str: ...

    async def delete_checkpoint(self, checkpoint_id: str) -> bool: ...


class CheckpointGoalRoundStore:
    """跨重启账本:复用既有 checkpoint 出口,键带 `goal-round:` 命名空间。

    为什么写 `status="completed"` 而不是 "running":`running` 是"自称正在跑"的
    哨兵,`created_at` 就是它的心跳(agent_checkpoint 的僵尸归位靠它判活)。
    一次记账去刷新那个心跳,等于把别人真正死掉的 run 判成活着 —— 那是越过本层的
    因果去改另一套机制的结论。`completed` 是终态,归位逻辑明确不碰它。
    """

    name = STORAGE_CHECKPOINT

    def __init__(
        self,
        sink: CheckpointSink,
        *,
        l1: InProcessGoalRoundStore | None = None,
        ttl_note: int | None = None,
        durable: bool = True,
    ) -> None:
        self._sink = sink
        self._l1 = l1 if l1 is not None else InProcessGoalRoundStore()
        self._ttl_note = ttl_note
        # `durable` 由装载方按"当下到底有没有配 PG/redis"传进来,不由本类猜。
        # 猜的后果是:三层存储退化成纯内存时,响应仍在喊 ledger_durable=true ——
        # 而调用方正是拿这个字段决定"要不要相信这本账活得过重启"。
        self._durable = durable

    def describe(self) -> WriteReceipt:
        reason: str | None = None
        if self._ttl_note is not None:
            reason = f"ttl={self._ttl_note}"
        if not self._durable:
            reason = (reason + "; " if reason else "") + "底层未配持久层,退化为内存"
        return WriteReceipt(storage=self.name, durable=self._durable, reason=reason)

    @staticmethod
    def _key(session_id: SessionId) -> str:
        return f"{SESSION_KEY_PREFIX}{session_id}"

    async def read(self, session_id: SessionId) -> GoalRoundRead:
        cached = self._l1.read_sync(session_id)
        if cached is not None:
            return GoalRoundRead(found=True, state=cached, unreadable=False, reason=None)
        try:
            cp = await self._sink.load_latest_by_session(self._key(session_id))
        except Exception as exc:  # noqa: BLE001 - 读不出账 ≠ 没有账
            logger.warning("goal 账本 checkpoint 读取失败(按未知处理): %s", exc)
            return GoalRoundRead(
                found=False, state=None, unreadable=True, reason=f"读取失败: {type(exc).__name__}"
            )
        if cp is None:
            return NOT_FOUND
        metadata = getattr(cp, "metadata", None)
        read = state_from_checkpoint_metadata(metadata, session_id=session_id)
        if read.found and read.state is not None:
            self._l1.write_sync(read.state)
        return read

    async def write(self, state: GoalRoundState) -> WriteReceipt:
        self._l1.write_sync(state)
        try:
            await self._sink.save_checkpoint(
                session_id=self._key(state.session_id),
                iteration=state.rounds,
                messages=[],
                tool_state={},
                status="completed",
                metadata=encode_state_metadata(state),
                owner_user_id=state.owner_user_id,
            )
        except Exception as exc:  # noqa: BLE001 - 持久写失败只降级,不阻塞判定
            logger.warning("goal 账本持久写入失败(本轮仅内存生效): %s", exc)
            return WriteReceipt(
                storage=self.name, durable=False, reason=f"持久写入失败: {type(exc).__name__}"
            )
        return self.describe()

    async def clear(self, session_id: SessionId) -> bool:
        """清账:L1 与持久层都要清。持久层清不掉时如实返回 False(交人工,不假报已清)。"""
        existed = self._l1.clear_sync(session_id)
        try:
            cp = await self._sink.load_latest_by_session(self._key(session_id))
        except Exception as exc:  # noqa: BLE001
            logger.warning("goal 账本清理前读取失败(按未清理处理): %s", exc)
            return False
        checkpoint_id = getattr(cp, "checkpoint_id", None)
        if not isinstance(checkpoint_id, str) or not checkpoint_id:
            return existed  # 持久层本来就没有这条 ⇒ L1 的结果就是全部真相
        try:
            removed = await self._sink.delete_checkpoint(checkpoint_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("goal 账本 checkpoint 删除失败: %s", exc)
            return False
        return bool(removed) or existed


# ==================== 装载(唯一出口) ====================

_memory_store = InProcessGoalRoundStore()
_store: GoalRoundStore = _memory_store


def get_store() -> GoalRoundStore:
    """当前账本存储(缺省内存档;持久档由 `configure_durable_store` 装上)。"""
    return _store


def get_memory_store() -> InProcessGoalRoundStore:
    """进程内那一份(也是持久档的 L1)。同步行 API 只能读它。"""
    return _memory_store


def configure_durable_store(
    sink: CheckpointSink, *, ttl_note: int | None = None, durable: bool = True
) -> GoalRoundStore:
    """装上跨重启档。由 `app/main.py` 的 lifespan 调用(唯一生产装载点)。

    `durable=False` 用于"底层 checkpoint 三层已退化到纯内存"的部署(未配
    DATABASE_URL/REDIS_URL):仍然走这条链路(行为一致),但如实报告落不住。
    """
    global _store
    _store = CheckpointGoalRoundStore(
        sink, l1=_memory_store, ttl_note=ttl_note, durable=durable
    )
    logger.info(
        "goal 自评估账本已切到 checkpoint 档(durable=%s, ttl=%s)", durable, ttl_note
    )
    return _store


def reset_store() -> None:
    """回到内存档(测试与应急回退用)。"""
    global _store
    _store = _memory_store


def peek_streak(session_id: SessionId) -> int:
    """同步读连击数(L1)。读不到即 0 —— 这是**已知**为 0,与 unreadable 不同。"""
    state = _memory_store.read_sync(session_id)
    return 0 if state is None else state.consecutive_failures


def clear_session(session_id: SessionId) -> None:
    _memory_store.clear_sync(session_id)


__all__ = [
    "BLOCK_REASONS",
    "NOT_FOUND",
    "ROUND_ACHIEVED",
    "ROUND_BUDGET_LIMITED",
    "ROUND_NOT_ACHIEVED",
    "ROUND_STATUSES",
    "ROUND_UNDETERMINED",
    "STORAGE_CHECKPOINT",
    "STORAGE_MEMORY",
    "STATE_METADATA_KEY",
    "SESSION_KEY_PREFIX",
    "CheckpointGoalRoundStore",
    "GoalRoundRead",
    "GoalRoundState",
    "InProcessGoalRoundStore",
    "PauseDecision",
    "RoundOutcome",
    "WriteReceipt",
    "advance_round_state",
    "clear_session",
    "configure_durable_store",
    "decide_pause",
    "encode_state_metadata",
    "get_store",
    "get_memory_store",
    "normalize_outcome",
    "parse_state_payload",
    "peek_streak",
    "reset_store",
    "state_from_checkpoint_metadata",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

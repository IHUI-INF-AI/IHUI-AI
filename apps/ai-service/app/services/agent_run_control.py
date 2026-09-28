# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""V3 #65(2026-09-28 立):agent run 的 pause / resume 控制面。

## 这一层补的是哪一格事实

`AgentLoopV2.pause()` 自 2026-09-18 起就存在(`app/services/agent_loop_v2.py:4057`),
`_pause_requested` 也在轮次边界与 `_wait_interruptible` 两处被检查(`:3124` / `:3481`)
—— **loop 层的机制一直在,缺的是"外面有没有人能够得着它"**。实测 HEAD 面:

- 全仓 `AgentLoopV2(...)` 的构造点(`routers/agents.py:1074`、`:1308`、`routers/agent_plan.py:191`、
  `routers/engine.py:83`)全是**在请求作用域内 new 出来、await 完就丢**,没有任何
  `session_id → loop 实例` 的登记表(全仓 grep `inject_if_running` / `_active_loop` /
  `get_loop(` 零命中)。
- HTTP 面只有 `/agents/execute`、`/agents/execute/stream`、`/agents/execute/resume`
  (`routers/agents.py:920/989/1236`),**没有 pause 路由**。

⇒ 即 `pause()` 在此之前是一条**没有任何调用方的死代码**(与守门 121「声明策略消费者对账」
同型:机制在位而无人接线,绿灯读起来就像能力已交付)。本模块补的正是那个缺失的载体:
一份"此刻这个 session 在不在跑、属于谁、停在哪个 checkpoint"的进程内事实源。

## 三条设计约束

1. **属主判据不得由请求体自报**(认证 ≠ 授权)。`register_run` 的 `owner_user_id` 只能来自
   `require_request_user_id` 解出的令牌主体;判定一律与它比对,`session_id` 只是**被寻址的键**,
   不是身份来源。属主的权威登记面是 `run_ownership`(O19 立的唯一事实源),本模块在
   `running` 态**优先信它**;只有当 run 已经退出流式作用域(`run_ownership` 按设计释放)
   而 paused 记录还在本表时,才用登记时写入的那份 —— 两份在写入点同源(同一个
   `current_user`),分歧时**一律 fail-closed 判越权**,不猜哪份对。
2. **状态语义必须可分辨**(守门 134 的教训:「改了 0」与「改成功」同形 = 静默失真)。
   所有出口都收敛到封闭的结果枚举,HTTP 侧据此映射 code / status / `changed` 三态:
   `PAUSED`(本次真的按下了暂停)与 `ALREADY_PAUSED`(已经是暂停态,`changed=false`)
   在响应里**必须**能区分;`NOT_RUNNING` / `UNKNOWN_SESSION` / `CHECKPOINT_UNAVAILABLE`
   各占一格,不得合并成"回个成功"。
3. **不可用必须响**。`loop.pause()` 返回 `None` 意味着 checkpoint 没落盘(`_save_checkpoint_safe`
   在 `enable_checkpoint=False` 或存储异常时都返回 None)—— 那不是"暂停成功",而是
   **"暂停请求被接受了但恢复点没保住"**。判 `CHECKPOINT_UNAVAILABLE`(HTTP 503),
   绝不记成功。同理 resume 侧的续跑异常一律显式判 `RESUME_FAILED`,不静默降级成"没得续跑"。

## 测试注入点

`pause_session` / `resume_session` 把"真正执行续跑"和"读最新 checkpoint"都收成参数
(`ResumeRunner` / `LatestCheckpointLoader`),默认实现走真实存储。路由层用默认值;
测试面注入替身,从而能在**零 DB / 零 Redis** 下断言"越权路径根本没发出查询"。
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

from .agent_checkpoint import AgentLoopCheckpoint
from .durable_resume import renew_resume_point_before_resume, select_resume_point
from .run_ownership import owner_of

logger = logging.getLogger(__name__)

__all__ = [
    "CheckpointUnavailable",
    "LatestCheckpointLoader",
    "PausableLoop",
    "PauseOutcome",
    "PauseResult",
    "ResumeOutcome",
    "ResumeResult",
    "ResumeRunner",
    "SessionNotFoundError",
    "clear_all",
    "detach_run",
    "entry_count",
    "pause_session",
    "register_run",
    "resume_session",
    "snapshot_records",
]


# ---------------------------------------------------------------------------
# 存活期
# ---------------------------------------------------------------------------

# paused 记录的最长存活时间。取 2h,与 run_ownership._DEFAULT_TTL_SECONDS 同档:
# 它只需覆盖"用户按下暂停 → 决定继续"这段人类反应时间,而真正能续跑的事实是持久层
# checkpoint(其 TTL 由 DEFAULT_CHECKPOINT_TTL 管),本表过期只是回落到"按持久属主判定"
# 那一档,不会把可续跑的会话判成不可续跑。
_PAUSED_RECORD_TTL_SECONDS: float = 2 * 60 * 60.0

# 容量硬上限:与 run_ownership 同一套纪律 —— 异常流量不得把这张表撑成无界 dict。
_MAX_RECORDS: int = 20_000


# ---------------------------------------------------------------------------
# 协议与结果枚举(封闭集)
# ---------------------------------------------------------------------------


class PausableLoop(Protocol):
    """本模块对"一个可暂停的 run"的唯一要求。

    刻意用 Protocol 而不是 import `AgentLoopV2`:后者与路由层是双向依赖
    (`routers/agents.py` 全程函数内延迟导入该模块并注明"避免循环依赖"),
    在模块顶层引它会把这条循环变成运行时 ImportError。
    """

    async def pause(self) -> str | None: ...


class PauseOutcome(StrEnum):
    """暂停判定的封闭结果集(HTTP 映射见 `routers/agents.py`)。"""

    PAUSED = "paused"  # 本次调用真的按下了暂停,checkpoint 已落盘
    ALREADY_PAUSED = "already_paused"  # 幂等:已经是暂停态(changed=false)
    NOT_RUNNING = "not_running"  # 认识这个会话,但它现在不在跑
    UNKNOWN_SESSION = "unknown_session"  # 本进程从未登记过该会话 → 404
    FORBIDDEN = "forbidden"  # 属主可判定且非请求者 → 403
    CHECKPOINT_UNAVAILABLE = "checkpoint_unavailable"  # 暂停生效但恢复点没保住 → 503


class ResumeOutcome(StrEnum):
    """续跑判定的封闭结果集。"""

    RESUMED = "resumed"  # 已从暂停点续跑并跑完
    NO_CHECKPOINT = "no_checkpoint"  # 查不到该会话的暂停点 → 404
    NOT_PAUSED = "not_paused"  # 有会话但它不是暂停态(还在跑 / 已跑完)→ 409
    FORBIDDEN = "forbidden"  # 属主可判定且非请求者 → 403
    RESUME_FAILED = "resume_failed"  # 续跑过程报错(存储/循环不可用)→ 503


class SessionNotFoundError(Exception):
    """按 session 找不到对应 run(loader 侧使用)。"""


class CheckpointUnavailable(Exception):
    """持久层不可用。

    与 `SessionNotFoundError` **必须**是两个异常:checkpoint manager 的
    `load_latest_by_session` 把 redis/PG 的失败一律 `logger.warning` 后返回 None
    (`agent_checkpoint.py:722` 起三条腿全是"降级继续"),于是"查不到"与"查不了"
    在它的返回值上同形。本模块不接受这种合并:默认 loader 用 `list_checkpoints` +
    活性探测把两者分开,拿不准时抛本异常而不是回 None。
    """


class ResumeRunner(Protocol):
    """续跑出口:拿到 checkpoint 后把这一轮真的跑完,返回结果摘要。"""

    async def __call__(
        self, checkpoint: AgentLoopCheckpoint, requester: str
    ) -> dict[str, object]: ...


LatestCheckpointLoader = Callable[[str], Awaitable[AgentLoopCheckpoint]]


# ---------------------------------------------------------------------------
# 登记表
# ---------------------------------------------------------------------------


@dataclass
class _RunRecord:
    """一个在飞/已暂停 run 的控制面事实。

    `loop` 在流式生成器退出后置 None(生成器结束而 loop 对象还引着整段消息历史
    等于把内存挂在表上),paused 记录靠 `checkpoint_id` 而不靠 loop 存活。
    """

    session_id: str
    owner_user_id: str
    loop: PausableLoop | None
    paused: bool
    checkpoint_id: str | None
    expires_at: float
    updated_at: float


_records: dict[str, _RunRecord] = {}
_lock = asyncio.Lock()


def _purge_expired(now: float) -> None:
    """清掉过期条目。只在写入路径调用(读路径全表扫描会把 O(n) 摊到每次请求上)。"""
    expired = [sid for sid, rec in _records.items() if rec.expires_at <= now]
    for sid in expired:
        _records.pop(sid, None)


async def register_run(
    session_id: str, *, owner_user_id: str, loop: PausableLoop
) -> None:
    """登记一个开始执行的 run。`owner_user_id` 必须是**令牌主体**,不得取请求体字段。"""
    if not session_id or not owner_user_id:
        # 空属主不建记录:一条无主记录等于把该会话交给"任何人都能暂停/续跑"的判定
        return
    now = time.monotonic()
    async with _lock:
        if len(_records) >= _MAX_RECORDS:
            _purge_expired(now)
            while len(_records) >= _MAX_RECORDS:
                _records.pop(next(iter(_records)), None)
        _records[session_id] = _RunRecord(
            session_id=session_id,
            owner_user_id=owner_user_id,
            loop=loop,
            paused=False,
            checkpoint_id=None,
            # running 记录不过期(它由生成器 finally 的 detach 收口),给一个远未来值,
            # 真正靠 TTL 兜底的是 paused 那一支
            expires_at=now + _PAUSED_RECORD_TTL_SECONDS,
            updated_at=now,
        )


async def detach_run(
    session_id: str, *, owner_user_id: str | None = None
) -> bool:
    """run 退出执行作用域时解绑 loop。

    paused 记录**保留**(否则暂停后就失去在进程内的属主依据,resume 只能退回持久层),
    running 记录直接删除。返回是否确有记录被处理 —— 调用方不得据此判成功与否,
    这条只用于日志。
    """
    now = time.monotonic()
    async with _lock:
        rec = _records.get(session_id)
        if rec is None:
            return False
        if owner_user_id is not None and rec.owner_user_id != owner_user_id:
            # 别人的 run 来 detach:不动它,只说明判定结果(见模块头的 fail-closed 约定)
            return False
        if rec.paused:
            rec.loop = None
            rec.expires_at = now + _PAUSED_RECORD_TTL_SECONDS
            rec.updated_at = now
        else:
            _records.pop(session_id, None)
        return True


# ---------------------------------------------------------------------------
# 判定:pause
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PauseResult:
    """暂停判定结论。

    `changed` 是守门 134 那一型失真的直接解药:调用方(与它后面的前端)必须能问出
    "这一次到底动没动",而不是从 `ok=True` 反推。
    """

    outcome: PauseOutcome
    changed: bool
    checkpoint_id: str | None = None
    detail: str | None = None


def _forbidden() -> PauseResult:
    """属主可判定且非请求者。

    刻意不回显真实属主:403 的响应体里带别人的 user_id 就是一次身份泄露,
    而判定结论本身不需要它。
    """
    return PauseResult(
        outcome=PauseOutcome.FORBIDDEN,
        changed=False,
        detail="该会话不属于当前用户",
    )


async def pause_session(session_id: str, requester: str) -> PauseResult:
    """请求暂停某个会话的在飞 run。判定顺序刻意把**属主检查放在任何查询之前**。

    属主来源两级,顺序固定:
      ① `run_ownership.owner_of()` —— O19 立的在飞属主唯一事实源(进程内,零查询);
      ② 本表登记时写入的那份(仅在 ① 已释放、而 paused 记录还在时兜底)。
    两级都有值而不一致 ⇒ fail-closed 判越权:两份在同一个写入点由同一个
    `current_user` 落笔,分歧只可能是 bug 或在途篡改,没有理由信其中任一份。
    """
    now = time.monotonic()
    async with _lock:
        rec = _records.get(session_id)
        if rec is not None and rec.expires_at <= now:
            _records.pop(session_id, None)
            rec = None

    # ---- 属主判定(先于一切 I/O)------------------------------------------------
    in_flight_owner = owner_of(session_id)
    record_owner = rec.owner_user_id if rec is not None else None
    if in_flight_owner is not None and in_flight_owner != requester:
        logger.warning("pause 越权拒绝:requester=%s session=%s", requester, session_id)
        return _forbidden()
    if record_owner is not None and record_owner != requester:
        logger.warning("pause 越权拒绝:requester=%s session=%s", requester, session_id)
        return _forbidden()
    if (
        in_flight_owner is not None
        and record_owner is not None
        and in_flight_owner != record_owner
    ):
        # 两份登记同源同刻,分歧只可能是 bug —— fail-closed,不猜哪份对。
        logger.error(
            "pause 属主登记自相矛盾(按越权处理):session=%s run_ownership=%s run_control=%s",
            session_id,
            in_flight_owner,
            record_owner,
        )
        return _forbidden()

    if rec is None:
        # 本进程不认识这个会话:没有 loop 可喊停,也没有暂停态可言。
        # 不向持久层反查 —— 反查一次就要为一个"判定不出来"的结论付一次查询,
        # 而 404 与 403 的区分并不依赖它(unknown 与 forbidden 都已由在飞事实排除)。
        return PauseResult(
            outcome=PauseOutcome.UNKNOWN_SESSION,
            changed=False,
            detail="本服务实例没有该会话的在飞 run(多实例部署需按会话粘性路由)",
        )

    if rec.paused:
        return PauseResult(
            outcome=PauseOutcome.ALREADY_PAUSED,
            changed=False,
            checkpoint_id=rec.checkpoint_id,
            detail="该会话已处于暂停态",
        )

    if rec.loop is None:
        return PauseResult(
            outcome=PauseOutcome.NOT_RUNNING,
            changed=False,
            detail="该会话的执行作用域已退出,无在飞循环可暂停",
        )

    # ---- 真正按下暂停 --------------------------------------------------------
    try:
        checkpoint_id = await rec.loop.pause()
    except Exception as exc:  # noqa: BLE001 - 必须转成显式结论,不得冒泡成 500 空壳
        return PauseResult(
            outcome=PauseOutcome.CHECKPOINT_UNAVAILABLE,
            changed=False,
            detail=f"暂停调用未返回结论:{type(exc).__name__}: {exc}",
        )

    if checkpoint_id is None:
        # loop.pause() 返回 None = checkpoint 没落盘(_save_checkpoint_safe 在
        # enable_checkpoint=False 或存储异常时的唯一返回形态)。此刻 _pause_requested
        # 已经置位,循环下一轮会真的停下来 —— 但停下来之后**没有恢复点**,再 resume 就
        # 是凭空续跑。这不是成功,必须单独一格。
        return PauseResult(
            outcome=PauseOutcome.CHECKPOINT_UNAVAILABLE,
            changed=True,
            detail=(
                "暂停标志已置位但检查点未落盘:该 run 会停下,但无法从暂停点续跑"
            ),
        )

    # ⚠️ 一次暂停会落下**两个**检查点,这是 loop 层的既有形状,不是本层的缺陷:
    #   ① 现在这个 `checkpoint_id` —— `AgentLoopV2.pause()` 用"此刻的 self._messages"
    #      立刻存的(所以 HTTP 响应能当场带回一个 id);
    #   ② 循环在下一轮边界真正停下时由 `_run_loop` 自己存的那个(见 agent_loop_v2.py:3481
    #      的 `iteration=i-1` 落盘),并通过 `AgentLoopResult.checkpoint_id` 返回。
    # ② 比 ① 多带最近完成的轮次,而它是 `load_latest_by_session` 会返回的那一个 ——
    # 所以**续跑一律按 session 取最新暂停点**,绝不按①的 id 续跑,否则会重跑一轮工具调用
    # (带副作用的工具重跑一次就是真实事故)。响应里以 `checkpoint_stage="eager"` 如实标注。
    async with _lock:
        live = _records.get(session_id)
        if live is rec:
            live.paused = True
            live.checkpoint_id = checkpoint_id
            live.updated_at = time.monotonic()
            live.expires_at = live.updated_at + _PAUSED_RECORD_TTL_SECONDS
    logger.info(
        "agent run 已暂停:requester=%s session=%s checkpoint=%s",
        requester,
        session_id,
        checkpoint_id,
    )
    return PauseResult(
        outcome=PauseOutcome.PAUSED,
        changed=True,
        checkpoint_id=checkpoint_id,
    )


# ---------------------------------------------------------------------------
# 判定:resume
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ResumeResult:
    """续跑判定结论。"""

    outcome: ResumeOutcome
    changed: bool
    checkpoint_id: str | None = None
    result: dict[str, object] | None = None
    detail: str | None = None


async def _default_load_latest(session_id: str) -> AgentLoopCheckpoint:
    """读该会话最新 checkpoint;查不到抛 SessionNotFoundError,查不了抛 CheckpointUnavailable。

    为什么不能直接用 `manager.load_latest_by_session`:它把 redis/PG 的失败
    `logger.warning` 后返回 None,"没查到"与"查不了"同形(模块头第 3 条)。这里先走
    内存索引(`list_checkpoints` 不碰网络),miss 再走完整三级读取,并用 manager 的
    持久层活性决定该报哪一格。
    """
    from .agent_checkpoint import get_agent_checkpoint_manager

    manager = get_agent_checkpoint_manager()
    in_memory = await manager.list_checkpoints(session_id=session_id)
    if in_memory:
        # V3 #84:续跑点选取收口到**一条规则**(轮次优先、同轮取更晚心跳),不再在这里
        # 另写一个 `max(created_at)` —— 两处各算一次"最新"必漂移,而漂移的代价是重跑一轮
        # 有副作用的工具调用(见 durable_resume 头注判据 1)。全部候选都被排除
        # (过期 / completed)时不在这儿下结论,继续走三级读取,由持久层给答案。
        point = select_resume_point(in_memory)
        if point.checkpoint is not None:
            if point.ambiguous:
                logger.warning(
                    "同一轮有多份同心跳检查点,取用不确定:session=%s reason=%s",
                    session_id,
                    point.reason,
                )
            return point.checkpoint

    latest = await manager.load_latest_by_session(session_id)
    if latest is not None:
        return latest

    # 内存与三级读取都空:区分"这个会话确实没有 checkpoint"与"持久层没答话"。
    # 无任何持久层(redis/PG 都没配或已降级)⇒ 内存就是全部事实 ⇒ 判"没有";
    # 配了持久层而拿不到 ⇒ 无法排除是后端故障 ⇒ 抛 CheckpointUnavailable,不冒判 404。
    if not (manager._use_redis or manager._use_pg):
        raise SessionNotFoundError(session_id)
    raise CheckpointUnavailable(
        f"会话 {session_id} 的检查点在持久层不可读(未判定,不当成不存在)"
    )


async def resume_session(
    session_id: str,
    requester: str,
    *,
    load_latest: LatestCheckpointLoader | None = None,
    runner: ResumeRunner | None = None,
) -> ResumeResult:
    """从暂停点续跑某个会话。

    与 pause 同一套属主纪律:先判属主再动 I/O。paused 记录在进程内时**零查询**即可
    拒绝他人;记录已随进程重启消失时,退回持久 checkpoint 的 `metadata.owner_user_id`
    (O19 落的持久属主,见 `AgentLoopCheckpoint.owner_user_id`),它与
    `resume_agent_execute` 的属主两级口径同形 —— 不得在此另立一套。
    """
    now = time.monotonic()
    async with _lock:
        rec = _records.get(session_id)
        if rec is not None and rec.expires_at <= now:
            _records.pop(session_id, None)
            rec = None

    if rec is not None and rec.owner_user_id != requester:
        return ResumeResult(
            outcome=ResumeOutcome.FORBIDDEN,
            changed=False,
            detail="该会话不属于当前用户",
        )

    if rec is not None and not rec.paused:
        return ResumeResult(
            outcome=ResumeOutcome.NOT_PAUSED,
            changed=False,
            detail="该会话正在执行中,无需续跑",
        )

    loader = load_latest or _default_load_latest
    try:
        checkpoint = await loader(session_id)
    except SessionNotFoundError:
        return ResumeResult(
            outcome=ResumeOutcome.NO_CHECKPOINT,
            changed=False,
            detail="该会话没有可续跑的检查点",
        )
    except CheckpointUnavailable as exc:
        return ResumeResult(
            outcome=ResumeOutcome.RESUME_FAILED,
            changed=False,
            detail=str(exc),
        )
    except Exception as exc:  # noqa: BLE001 - 存储异常必须显式成结论,不得冒泡成空 500
        return ResumeResult(
            outcome=ResumeOutcome.RESUME_FAILED,
            changed=False,
            detail=f"检查点读取失败:{type(exc).__name__}: {exc}",
        )

    # 持久属主兜底判定:进程内没有记录时(跨进程/重启后),checkpoint 自带的主人是
    # 唯一可追溯依据。有值且不符 → 403;无值 → 沿用既有"只剩必须登录这一层地板"的
    # 如实标注,不假装判过(与 resume_agent_execute 的 O19 注释同口径)。
    persistent_owner = checkpoint.owner_user_id
    if persistent_owner is not None and persistent_owner != requester:
        return ResumeResult(
            outcome=ResumeOutcome.FORBIDDEN,
            changed=False,
            detail="该检查点所属会话不属于当前用户",
        )

    if checkpoint.status != "paused":
        return ResumeResult(
            outcome=ResumeOutcome.NOT_PAUSED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=f"最新检查点状态为 {checkpoint.status},不是 paused",
        )

    if runner is None:
        return ResumeResult(
            outcome=ResumeOutcome.RESUME_FAILED,
            changed=False,
            detail="未注入续跑执行体:控制面不自行构造 AgentLoopV2(参数须与 execute/stream 同口径)",
        )

    # 置回 running:并发的第二次 resume 会看到 NOT_PAUSED 而不是又起一个循环
    # (同一次暂停被续跑两遍 = 同一份消息历史跑两次,是真实会造成重复副作用的形态)。
    async with _lock:
        live = _records.get(session_id)
        if live is not None and live is rec:
            live.paused = False
            live.updated_at = time.monotonic()

    async def _restore_paused() -> None:
        """把记录翻回 paused。

        为什么必须有:上面为了挡住并发第二次 resume 而先把状态置成 running,若续跑
        随即失败却不翻回来,这条会话就永久卡在"正在执行中" —— 下一次 resume 得到
        NOT_PAUSED、下一次 pause 得到 NOT_RUNNING,而它其实正静静躺在暂停点上。
        一次失败把会话锁死,比原病更难查。
        """
        async with _lock:
            back = _records.get(session_id)
            if back is not None and back is rec and not back.paused:
                back.paused = True
                back.updated_at = time.monotonic()
                back.expires_at = back.updated_at + _PAUSED_RECORD_TTL_SECONDS

    # V3 #84:续跑前把恢复点按**它自己声明的**耐久视野续期一次(只走既有 save_checkpoint
    # 出口,不落新表/新列)。这一格**不是**续跑的前提:未声明 / 不需要 / 开关关 / 存储
    # 异常,四种"没做"都只产出一条可诊断结论 —— 让一次本来能成的续跑因为续不上期而失败,
    # 等于用一个新机制去制造原机制没有的红。
    await renew_resume_point_before_resume(checkpoint)

    try:
        run_result = await runner(checkpoint, requester)
    except SessionNotFoundError as exc:
        # 竞态:loader 读到 paused 检查点与续跑取用它之间,检查点过期/被清理掉了。
        # 这是"没有东西可续"(404 语义),不是"续跑失败"(503 语义)—— 两格不得合并,
        # 否则调用方读到 503 会去重试一个永远不可能成功的续跑。
        await _restore_paused()
        return ResumeResult(
            outcome=ResumeOutcome.NO_CHECKPOINT,
            changed=False,
            detail=f"检查点在本次续跑取用前已失效:{exc}",
        )
    except Exception as exc:  # noqa: BLE001 - 续跑内部异常一律转显式失败,不冒泡成空 500
        await _restore_paused()
        return ResumeResult(
            outcome=ResumeOutcome.RESUME_FAILED,
            changed=False,
            checkpoint_id=checkpoint.checkpoint_id,
            detail=f"续跑执行失败:{type(exc).__name__}: {exc}",
        )

    async with _lock:
        after = _records.get(session_id)
        if after is not None and after is rec:
            # 续跑已跑完:若它自己又停在 paused(循环里再次被按暂停)则保留记录,
            # 否则删除 —— 与 detach_run 同一套判定,不在此另立规则。
            stopped = run_result.get("stop_reason") == "paused"
            after.paused = bool(stopped)
            if stopped:
                cid = run_result.get("checkpoint_id")
                after.checkpoint_id = cid if isinstance(cid, str) else None
                after.expires_at = time.monotonic() + _PAUSED_RECORD_TTL_SECONDS
            else:
                _records.pop(session_id, None)

    return ResumeResult(
        outcome=ResumeOutcome.RESUMED,
        changed=True,
        checkpoint_id=checkpoint.checkpoint_id,
        result=run_result,
    )


# ---------------------------------------------------------------------------
# 观测出口(测试/自检用)
# ---------------------------------------------------------------------------


async def snapshot_records(session_id: str) -> dict[str, object]:
    """给出某个会话当前控制面记录的可序列化快照(无记录返回 `{}`)。"""
    async with _lock:
        rec = _records.get(session_id)
        if rec is None:
            return {}
        return {
            "session_id": rec.session_id,
            "owner_user_id": rec.owner_user_id,
            "paused": rec.paused,
            "checkpoint_id": rec.checkpoint_id,
            "has_loop": rec.loop is not None,
        }


def entry_count() -> int:
    """当前记录条目数(含尚未到的过期项),仅测试/自检用。"""
    return len(_records)


def clear_all() -> None:
    """清空登记表(仅测试用;与 `run_ownership.clear_all` 同名同义,便于成对夹具)。"""
    _records.clear()

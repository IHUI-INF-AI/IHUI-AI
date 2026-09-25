# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent loop 状态 checkpoint + 断点续跑。

设计:
- 每轮 iteration 结束后 checkpoint(消息历史 + iteration 数 + tool state + 时间戳)
- 三层存储(D26 双轨收敛):内存 LRU 为主 -> 可选 redis 缓存 -> 可选 PG 持久
- 中断后(进程崩溃 / 用户取消 / 超时)可从最后 checkpoint 恢复
- 恢复时重建 AgentLoopV2 状态,继续下一轮 iteration
- TTL 24 小时(超时自动清理)

与 apps/cli/src/checkpoints/ 的区别:
- cli checkpoints: 文件级快照(磁盘文件改动)
- agent_checkpoint: agent loop 状态(消息历史 + iteration 进度)
"""

from __future__ import annotations

import asyncio
import contextlib
import importlib
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any

from app.core.tunables import DEFAULT_CHECKPOINT_TTL

logger = logging.getLogger(__name__)

# 默认 checkpoint TTL(唯一真源见 app/core/tunables.py)
# 默认内存上限 1000 个 checkpoint
DEFAULT_MAX_IN_MEMORY = 1000

# redis 包未安装时降级为纯内存模式
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None  # type: ignore[assignment]

# 软依赖 psycopg(D26:主链路 checkpoint 落 PG 持久层)。
# 缺失时降级为「内存+redis」模式,保证模块可导入。
# 用 importlib.import_module 避免直接 import 在 except 赋 None 时
# 触发 mypy 重绑定冲突(同 langgraph_checkpoint.py 模式)。
_psycopg_rows = None
_psycopg_pool_mod = None
dict_row: Any = None
AsyncConnectionPool: Any = None
try:
    _psycopg_rows = importlib.import_module("psycopg.rows")
    _psycopg_pool_mod = importlib.import_module("psycopg_pool")
    dict_row = _psycopg_rows.dict_row
    AsyncConnectionPool = _psycopg_pool_mod.AsyncConnectionPool
    _PSYCOPG_AVAILABLE = True
except ImportError:  # pragma: no cover - 依赖未安装时走降级路径
    _PSYCOPG_AVAILABLE = False


# ----------------------------------------------------------------------
# PG 持久层(D26:对接 packages/database agent_checkpoints 表,
# 对齐 langgraph 双表的「Drizzle 定义 + Python 裸 SQL CRUD」协作模式)
# ----------------------------------------------------------------------

_UPSERT_SQL = (
    "INSERT INTO agent_checkpoints "
    "(checkpoint_id, session_id, status, iteration, payload, created_at, expires_at) "
    "VALUES (%s, %s, %s, %s, %s, %s, %s) "
    "ON CONFLICT (checkpoint_id) DO UPDATE SET "
    "session_id = EXCLUDED.session_id, status = EXCLUDED.status, "
    "iteration = EXCLUDED.iteration, payload = EXCLUDED.payload, "
    "created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at"
)
# SELECT 列序固定:0 checkpoint_id / 1 session_id / 2 status / 3 iteration /
#                4 payload / 5 created_at / 6 expires_at
_SELECT_BY_ID_SQL = (
    "SELECT checkpoint_id, session_id, status, iteration, payload, "
    "created_at, expires_at FROM agent_checkpoints WHERE checkpoint_id = %s"
)
_SELECT_LATEST_BY_SESSION_SQL = (
    "SELECT checkpoint_id, session_id, status, iteration, payload, "
    "created_at, expires_at FROM agent_checkpoints "
    "WHERE session_id = %s ORDER BY created_at DESC LIMIT 1"
)
# 幂等建表 + 索引(部署流程已建时为 no-op;psycopg prepared 模式下单条执行)
_ENSURE_TABLE_SQLS = (
    "CREATE TABLE IF NOT EXISTS agent_checkpoints ("
    "checkpoint_id varchar(64) PRIMARY KEY, "
    "session_id varchar(100) NOT NULL, "
    "status varchar(20) NOT NULL, "
    "iteration integer NOT NULL, "
    "payload jsonb NOT NULL, "
    "created_at timestamptz NOT NULL DEFAULT now(), "
    "expires_at timestamptz NOT NULL)",
    "CREATE INDEX IF NOT EXISTS agent_checkpoints_session_idx "
    "ON agent_checkpoints (session_id)",
    "CREATE INDEX IF NOT EXISTS agent_checkpoints_expires_idx "
    "ON agent_checkpoints (expires_at)",
)

# 归位写回(ZCode 9B-B2)。两条形态约束:
# 1) WHERE 必带主键 ⇒ 禁止出现"无 WHERE 的全表 UPDATE";
# 2) WHERE 再带**期望的旧状态**(CAS)⇒ 同一行第二次调用必然 0 行受影响,
#    幂等性由存储层兜住,而不是只靠内存判断。
# payload 必须与 status 列同步改写:`_row_to_agent_checkpoint` 读的是 payload
# (列 status 只是给人/SQL 看的),只改列会造成"列说 paused、重放出来还是 running"。
_MARK_STALE_SQL = (
    "UPDATE agent_checkpoints SET status = %s, payload = %s "
    "WHERE checkpoint_id = %s AND status = %s"
)

# ----------------------------------------------------------------------
# 状态与归位判据的封闭集(唯一真源 = 本模块;AgentLoopCheckpoint.status 注释指向这里)
# ----------------------------------------------------------------------

CHECKPOINT_STATUS_RUNNING = "running"
CHECKPOINT_STATUS_PAUSED = "paused"
CHECKPOINT_STATUS_COMPLETED = "completed"
CHECKPOINT_STATUS_FAILED = "failed"
CHECKPOINT_STATUS_CANCELLED = "cancelled"

# 终态:任何情况下**不得**被归位逻辑回写成非终态(本票的变异对照就打在这一条上)
TERMINAL_CHECKPOINT_STATUSES: frozenset[str] = frozenset(
    {CHECKPOINT_STATUS_COMPLETED, CHECKPOINT_STATUS_FAILED, CHECKPOINT_STATUS_CANCELLED}
)
# 唯一需要归位的状态:running = "自称正在跑"。
# paused 是"已知停在可续跑点"(resume_from_checkpoint 会据此注入中断指导片段),
# 不是僵尸,故不参与归位。
RECONCILABLE_CHECKPOINT_STATUSES: frozenset[str] = frozenset({CHECKPOINT_STATUS_RUNNING})

RECONCILE_ACTION_KEEP = "keep"
RECONCILE_ACTION_MARK_STALE = "mark_stale"
RECONCILE_ACTION_MARK_EXPIRED = "mark_expired"
RECONCILE_ACTIONS: frozenset[str] = frozenset(
    {RECONCILE_ACTION_KEEP, RECONCILE_ACTION_MARK_STALE, RECONCILE_ACTION_MARK_EXPIRED}
)

# reason 封闭集:上游机制是"带 reason 的 reconcile",自由字符串等于没有原因。
RECONCILE_REASON_TERMINAL = "terminal_state"
RECONCILE_REASON_NOT_RECONCILABLE = "status_not_reconcilable"
RECONCILE_REASON_OWNER_ALIVE = "owner_alive"
RECONCILE_REASON_FRESH = "running_within_stale_window"
RECONCILE_REASON_OWNER_DEAD = "running_owner_dead"
RECONCILE_REASON_NO_ALIVE_EVIDENCE = "running_without_alive_evidence"
RECONCILE_REASON_TTL_EXPIRED = "ttl_expired"
RECONCILE_REASONS: frozenset[str] = frozenset(
    {
        RECONCILE_REASON_TERMINAL,
        RECONCILE_REASON_NOT_RECONCILABLE,
        RECONCILE_REASON_OWNER_ALIVE,
        RECONCILE_REASON_FRESH,
        RECONCILE_REASON_OWNER_DEAD,
        RECONCILE_REASON_NO_ALIVE_EVIDENCE,
        RECONCILE_REASON_TTL_EXPIRED,
    }
)

# 存活阈值(秒)。判据依据:checkpoint 每轮 iteration 结束都会覆写一次
# (agent_loop_v2.py:3708 的 status="running" 落盘点),所以 created_at 就是心跳;
# 超过该时长仍是 running 且本进程无在飞登记 ⇒ 判"上次进程在完成前停住"。
# 900s 的取值理由:远大于单轮 iteration 上限(本仓 worker 任务超时默认 300s,
# 见 dag_scheduler.WorkerPoolConfig.task_timeout_seconds),
# 又远小于 checkpoint TTL(24h,唯一真源 app/core/tunables.DEFAULT_CHECKPOINT_TTL)。
# 应急覆盖:IHUI_CHECKPOINT_STALE_AFTER_SECONDS=<秒>;整条机制:IHUI_CHECKPOINT_RECONCILE=0
CHECKPOINT_STALE_AFTER_SECONDS: float = 900.0
# mark_stale 的归位目标态(可续跑且会触发中断指导注入的一档)
STALE_RECONCILE_TARGET_STATUS = CHECKPOINT_STATUS_PAUSED
# 写进 payload 的归位痕迹键(metadata 是本模块既有的扩展位,无 schema 迁移)
STALE_RECONCILE_AT_KEY = "stale_reconciled_at"
STALE_RECONCILE_REASON_KEY = "stale_reconcile_reason"


def _reconcile_enabled() -> bool:
    """归位开关:每次调用现读环境变量(与 executor_switch 同一口径),缺省 on。"""
    raw = os.environ.get("IHUI_CHECKPOINT_RECONCILE", "1").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def _stale_threshold_seconds() -> float:
    """存活阈值读数:非法值/非正值一律回退默认并喊出来,不静默当成 0。"""
    raw = os.environ.get("IHUI_CHECKPOINT_STALE_AFTER_SECONDS", "").strip()
    if not raw:
        return CHECKPOINT_STALE_AFTER_SECONDS
    try:
        value = float(raw)
    except ValueError:
        logger.warning(
            "IHUI_CHECKPOINT_STALE_AFTER_SECONDS 无法解析(%r),回退默认 %.0fs",
            raw,
            CHECKPOINT_STALE_AFTER_SECONDS,
        )
        return CHECKPOINT_STALE_AFTER_SECONDS
    if value <= 0:
        logger.warning(
            "IHUI_CHECKPOINT_STALE_AFTER_SECONDS=%s 非正值无意义,回退默认 %.0fs",
            raw,
            CHECKPOINT_STALE_AFTER_SECONDS,
        )
        return CHECKPOINT_STALE_AFTER_SECONDS
    return value


def _default_alive_probe(session_id: str) -> bool | None:
    """判"活"的唯一信号源 = `app.services.run_ownership` 的在飞登记(不新造存活机制)。

    三态语义(把局限写在脸上,不留给下一个人猜):
    - `True`:本进程确有该会话的在飞 run 登记(`record_ownership` 在 run 启动处写入,
      finally 释放)⇒ 一律不动。
    - `None`:**无法确证死亡**。run_ownership 是进程内登记表,查不到既可能是
      "进程崩溃后重开的干净进程"(本票要归位的那一型),也可能是"另一个实例正在跑"。
      因此本探针**永不返回 False** —— False 留给未来的跨实例租约显式传入。
      判不出时不得直接归位,必须由 `decide_checkpoint_stale_reconcile` 再叠一次
      心跳阈值(两个条件同时成立才动),这是防误伤的唯一屏障。
    """
    try:
        # 局部导入:run_ownership 只依赖 time/dataclasses,无环;
        # 放模块顶层会让本模块在缺该文件的老镜像上直接 ImportError。
        from app.services.run_ownership import owner_of
    except Exception as e:  # noqa: BLE001 - 探针取不到 = 判不出,不得当成"已死"
        logger.warning("run_ownership 不可用,存活信号降为 None(判不出): %s", e)
        return None
    try:
        return owner_of(session_id) is not None
    except Exception as e:  # noqa: BLE001 - 同上
        logger.warning("run_ownership.owner_of 异常,存活信号降为 None: %s", e)
        return None



def _ts_to_iso(ts: float) -> str:
    """unix 时间戳 -> UTC ISO8601 字符串(PG timestamptz 参数用)。"""
    return datetime.fromtimestamp(ts, tz=UTC).isoformat()


def _json_dumps(value: Any) -> str:
    """安全 JSON 序列化(ensure_ascii=False)。"""
    return json.dumps(value, ensure_ascii=False, default=str)


def _row_to_agent_checkpoint(row: Any) -> AgentLoopCheckpoint:
    """psycopg 行 -> AgentLoopCheckpoint(payload 为全量 dict,直接反序列化)。"""
    # psycopg 默认返回 tuple,启用 dict_row 后返回 dict;两者兼容
    payload = row["payload"] if isinstance(row, dict) else row[4]
    return AgentLoopCheckpoint.from_dict(dict(payload))


class CheckpointNotFoundError(Exception):
    """目标 checkpoint 不存在或已过期/被清理。"""


class CheckpointSessionMismatchError(Exception):
    """checkpoint 归属会话与请求会话不一致(防跨会话回滚)。"""


@dataclass
class AgentLoopCheckpoint:
    """单次 agent loop checkpoint。"""

    checkpoint_id: str  # uuid4
    session_id: str  # agent loop session id
    iteration: int  # 当前 iteration 数
    messages: list[dict[str, Any]]  # 完整消息历史
    tool_state: dict[str, Any]  # 工具状态
    # 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
    # 取值封闭集见本模块 CHECKPOINT_STATUS_* / TERMINAL_CHECKPOINT_STATUSES
    status: str
    created_at: float  # unix timestamp
    expires_at: float  # TTL 过期时间
    metadata: dict[str, Any] = field(default_factory=dict)  # 额外元数据(model/prompt/等)

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 化的 dict。"""
        return {
            "checkpoint_id": self.checkpoint_id,
            "session_id": self.session_id,
            "iteration": self.iteration,
            "messages": self.messages,
            "tool_state": self.tool_state,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentLoopCheckpoint:
        """从 dict 反序列化。"""
        return cls(
            checkpoint_id=data["checkpoint_id"],
            session_id=data["session_id"],
            iteration=data["iteration"],
            messages=data["messages"],
            tool_state=data["tool_state"],
            status=data["status"],
            created_at=data["created_at"],
            expires_at=data["expires_at"],
            metadata=data.get("metadata", {}),
        )

    def is_expired(self, now: float | None = None) -> bool:
        """检查是否已过期。"""
        current = now if now is not None else time.time()
        return self.expires_at <= current

    @property
    def owner_user_id(self) -> str | None:
        """checkpoint 属主(O19:无记录 = 创建上下文无 principal,调用方须按不可判定处理)。"""
        owner = self.metadata.get("owner_user_id")
        return owner if isinstance(owner, str) and owner else None


@dataclass(frozen=True)
class CheckpointReconcileDecision:
    """归位判据的**唯一出口**(纯函数的返回值,不含任何 I/O 结论)。

    字段口径:
    - `action` / `reason`:双双落在本模块的封闭集里(`RECONCILE_ACTIONS` /
      `RECONCILE_REASONS`),不得出现自由字符串 —— 上游机制的"带原因归位"就落在这里。
    - `changed`:本次判定**要求**状态迁移(keep 恒 False)。
    - `applied`:写回是否真的发生了。纯函数恒 False,由 `reconcile_for_resume`
      用 `dataclasses.replace` 置位 —— 把"判出来"与"写下去"分成两个字段,
      才看得见"CAS 未命中/别人已归位"这一型(它 changed=True 但 applied=False)。
    - `undetermined_alive`:存活信号判不出(alive=None)。判不出**不得**静默当成"活着"
      或"死了",必须由阈值这条屏障决定是否归位,并在此字段上留痕(只多报)。
    """

    checkpoint_id: str
    action: str
    reason: str
    from_status: str
    to_status: str | None
    changed: bool
    applied: bool
    age_seconds: float
    undetermined_alive: bool


def decide_checkpoint_stale_reconcile(
    checkpoint: AgentLoopCheckpoint,
    *,
    now: float,
    alive: bool | None,
    stale_after_seconds: float = CHECKPOINT_STALE_AFTER_SECONDS,
) -> CheckpointReconcileDecision:
    """ZCode 9B-B2(2026-09-26 立):崩溃残留的 running 态必须"带原因"显式归位。

    这是一个**纯函数**:不读时钟(now 注入)、不碰存储、不看环境变量,因此可测、
    可复用,并且 resume 与 retry 两条路径能共用同一次判定(不得有两套"置回"写法)。

    判定顺序(顺序即语义,前三条都是"不得动"的护栏):
    1. 终态(completed/failed/cancelled)⇒ keep,reason=terminal_state。
       **终态永不回写成非终态** —— 这是本函数的硬约束,变异对照钉着它。
    2. 已过期 ⇒ mark_expired,reason=ttl_expired。过期与否复用
       `AgentLoopCheckpoint.is_expired(now)` 这一份实现,并且喂**同一个 now**
       —— 不在这里再抄一次 `expires_at <= now`,也不另取一个时钟源。
    3. 状态不在可归位集(如 paused)⇒ keep,reason=status_not_reconcilable。
    4. running ∧ 有在飞登记(alive=True)⇒ keep,reason=owner_alive。
    5. running ∧ (确证死 或 判不出) ∧ 心跳超阈 ⇒ mark_stale → paused。
       两个条件**同时**成立才动:alive 信号在本仓只能是 True/None(见
       `_default_alive_probe`),若只靠"判不出=不改",机制在生产上永不触发;
       若只靠阈值,就会误伤跨实例在跑的活会话。所以屏障是阈值,而阈值必须
       远大于单轮 iteration(checkpoint 每轮都覆写,created_at 即心跳)。
    6. 其余(running 但未超阈)⇒ keep,reason=running_within_stale_window。

    Args:
        checkpoint: 待判定的行(只读,本函数不修改它)
        now: 当前 unix 时间戳(注入;同一轮的 age 与过期判定共用这一个值)
        alive: 存活信号三态 —— True 有在飞登记 / False 确证已死 / None 判不出
        stale_after_seconds: 心跳阈值

    Returns:
        CheckpointReconcileDecision(纯判定,`applied` 恒 False)
    """
    age_seconds = now - checkpoint.created_at
    status = checkpoint.status

    def keep(reason: str, *, undetermined_alive: bool = False) -> CheckpointReconcileDecision:
        return CheckpointReconcileDecision(
            checkpoint_id=checkpoint.checkpoint_id,
            action=RECONCILE_ACTION_KEEP,
            reason=reason,
            from_status=status,
            to_status=None,
            changed=False,
            applied=False,
            age_seconds=age_seconds,
            undetermined_alive=undetermined_alive,
        )

    if status in TERMINAL_CHECKPOINT_STATUSES:
        return keep(RECONCILE_REASON_TERMINAL)
    if checkpoint.is_expired(now):
        # 不改写状态、只要求处置:过期行的既有归宿是本模块的删除路径
        # (delete_checkpoint / cleanup_expired),在这里再写一个状态就是第二份真相。
        return CheckpointReconcileDecision(
            checkpoint_id=checkpoint.checkpoint_id,
            action=RECONCILE_ACTION_MARK_EXPIRED,
            reason=RECONCILE_REASON_TTL_EXPIRED,
            from_status=status,
            to_status=None,
            changed=True,
            applied=False,
            age_seconds=age_seconds,
            undetermined_alive=alive is None,
        )
    if status not in RECONCILABLE_CHECKPOINT_STATUSES:
        return keep(RECONCILE_REASON_NOT_RECONCILABLE)
    if alive is True:
        return keep(RECONCILE_REASON_OWNER_ALIVE)
    if age_seconds > stale_after_seconds:
        return CheckpointReconcileDecision(
            checkpoint_id=checkpoint.checkpoint_id,
            action=RECONCILE_ACTION_MARK_STALE,
            reason=(
                RECONCILE_REASON_OWNER_DEAD
                if alive is False
                else RECONCILE_REASON_NO_ALIVE_EVIDENCE
            ),
            from_status=status,
            to_status=STALE_RECONCILE_TARGET_STATUS,
            changed=True,
            applied=False,
            age_seconds=age_seconds,
            undetermined_alive=alive is None,
        )
    return keep(RECONCILE_REASON_FRESH, undetermined_alive=alive is None)


@dataclass
class CheckpointMeta:
    """checkpoint 的轻量元数据视图(供 Checkpoint/Rewind 列表展示)。

    不含完整 messages(避免大响应),只保留定位字段与 message_count。
    列表/HTTP 层用 to_dict() 序列化,天然不泄漏消息内容。
    """

    checkpoint_id: str
    session_id: str
    iteration: int
    status: str
    created_at: float
    expires_at: float
    message_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "checkpoint_id": self.checkpoint_id,
            "session_id": self.session_id,
            "iteration": self.iteration,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "message_count": self.message_count,
        }


class AgentCheckpointManager:
    """Agent loop checkpoint 管理器(内存 LRU + 可选 redis 缓存 + 可选 PG 持久)。

    存储策略(D26 三层):
    - 内存为主存储(dict[checkpoint_id -> AgentLoopCheckpoint])
    - session_id -> latest checkpoint_id 反查索引
    - LRU 淘汰:超过 max_in_memory 时删除 created_at 最老的
    - 可选 redis 持久化:若 redis_url 配置,save_checkpoint 时异步写入 redis(带 TTL),
      load_checkpoint 在内存 miss 时回查 redis。
    - 可选 PG 持久层:若 db_url 配置且 psycopg 可用,save_checkpoint 同步 UPSERT 到
      agent_checkpoints 表,load 在内存+redis 双 miss 时回查 PG 并回填内存。
    - redis/PG 不可达或包缺失时静默降级,绝不阻塞 agent loop。
    """

    def __init__(
        self,
        max_in_memory: int = DEFAULT_MAX_IN_MEMORY,
        ttl_seconds: int = DEFAULT_CHECKPOINT_TTL,
        redis_url: str | None = None,
        db_url: str | None = None,
    ):
        self._checkpoints: dict[str, AgentLoopCheckpoint] = {}  # checkpoint_id -> checkpoint
        self._session_index: dict[str, str] = {}  # session_id -> latest checkpoint_id
        self._max = max_in_memory
        self._ttl = ttl_seconds
        self._redis_url = redis_url
        self._redis: Any = None
        self._use_redis = bool(redis_url) and aioredis is not None
        # PG 持久层(D26):psycopg 缺失时降级关闭,保证模块可用
        self._db_url = db_url
        self._pool: Any | None = None  # AsyncConnectionPool
        self._table_ready = False
        self._use_pg = bool(db_url) and _PSYCOPG_AVAILABLE
        if db_url and not _PSYCOPG_AVAILABLE:
            logger.warning(
                "AgentCheckpointManager 配置了 db_url 但 psycopg 未安装,PG 持久层降级关闭"
            )
        self._lock = asyncio.Lock()

    async def _get_pool(self) -> Any:
        """获取 / 懒初始化 psycopg AsyncConnectionPool(参数对齐 langgraph_checkpoint)。"""
        if not _PSYCOPG_AVAILABLE:
            raise RuntimeError(
                "psycopg / psycopg_pool 未安装,请安装 psycopg[binary]>=3.2.0"
            )
        if self._pool is None:
            self._pool = AsyncConnectionPool(
                conninfo=self._db_url,
                max_size=20,
                kwargs={"autocommit": True, "prepare_threshold": 0},
                open=False,
            )
            await self._pool.open()
        return self._pool

    async def _ensure_table(self) -> None:
        """幂等建表 + 索引(部署流程已建时为 no-op)。失败抛给调用方统一降级。"""
        if self._table_ready:
            return
        pool = await self._get_pool()
        async with pool.connection() as conn:
            for sql in _ENSURE_TABLE_SQLS:
                await conn.execute(sql)
        self._table_ready = True

    async def _get_redis(self) -> Any:
        """获取 redis 客户端,连接失败时降级为内存模式。"""
        if self._redis is None and self._use_redis:
            try:
                # protocol=2 强制 RESP2:redis-py 8.x 默认 RESP3(HELLO 3 协商),
                # 老 Redis/Memurai 4.x 不支持会 unknown command HELLO(同 im_bridge)
                self._redis = aioredis.from_url(self._redis_url or "", decode_responses=True, protocol=2, socket_connect_timeout=2)
                await self._redis.ping()
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 不可达,降级为纯内存: %s", e)
                self._use_redis = False
                self._redis = None
        return self._redis

    async def save_checkpoint(
        self,
        session_id: str,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_state: dict[str, Any],
        status: str = "running",
        metadata: dict[str, Any] | None = None,
        file_snapshots: list[dict[str, Any]] | None = None,
        owner_user_id: str | None = None,
    ) -> str:
        """保存 checkpoint,返回 checkpoint_id。

        Args:
            session_id: agent loop 会话 id
            iteration: 当前完成的 iteration 数(从 1 开始)
            messages: 完整消息历史(深拷贝存储,避免外部修改)
            tool_state: 工具状态(任意可 JSON 化 dict)
            status: running / paused / completed / failed / cancelled
            metadata: 额外元数据(model/prompt/等)
            file_snapshots: 可选的已捕获文件快照引用列表,每项形如
                {"path": <绝对路径>, "version_id": <file_editor.snapshot_file 返回的版本 id>}。
                会以 file_versions 键落入 metadata,供 restore 返回后做文件回滚。
            owner_user_id: 创建该 checkpoint 的可证明属主(O19:落在 metadata 里随
                payload jsonb 持久化,跨进程可判属主;None = 创建上下文无 principal)。

        Returns:
            checkpoint_id (uuid4 hex)
        """
        now = time.time()
        checkpoint_id = uuid.uuid4().hex
        meta = json.loads(json.dumps(metadata or {}, ensure_ascii=False))
        if owner_user_id:
            meta["owner_user_id"] = owner_user_id
        if file_snapshots:
            # 已捕获的文件快照引用:restore 时以 file_versions 对外暴露,驱动文件回滚。
            # 自动补齐 session_id 与 checkpoint_id,便于反查与跨会话隔离。
            meta["file_versions"] = [
                {
                    **json.loads(json.dumps(snap, ensure_ascii=False)),
                    "session_id": session_id,
                    "checkpoint_id": checkpoint_id,
                }
                for snap in file_snapshots
            ]
        checkpoint = AgentLoopCheckpoint(
            checkpoint_id=checkpoint_id,
            session_id=session_id,
            iteration=iteration,
            # 深拷贝消息历史,避免外部 list 原地修改污染 checkpoint
            messages=json.loads(json.dumps(messages, ensure_ascii=False)),
            tool_state=json.loads(json.dumps(tool_state, ensure_ascii=False)),
            status=status,
            created_at=now,
            expires_at=now + self._ttl,
            metadata=meta,
        )

        async with self._lock:
            self._checkpoints[checkpoint_id] = checkpoint
            self._session_index[session_id] = checkpoint_id
            # LRU 淘汰:超过上限时删除 created_at 最老的
            if len(self._checkpoints) > self._max:
                self._evict_oldest_locked()

        # redis 异步写入(失败只 warning,不阻塞)
        redis = await self._get_redis()
        if redis is not None:
            try:
                key = f"agent_ckpt:{checkpoint_id}"
                await redis.set(
                    key,
                    json.dumps(checkpoint.to_dict(), ensure_ascii=False),
                    ex=self._ttl,
                )
                # 维护 session -> checkpoint 索引(覆盖式)
                await redis.set(
                    f"agent_ckpt:session:{session_id}",
                    checkpoint_id,
                    ex=self._ttl,
                )
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 写入失败: %s", e)

        # PG 持久写入(三层存储之持久层,失败只 warning,不阻塞 loop)
        if self._use_pg:
            try:
                pool = await self._get_pool()
                await self._ensure_table()
                async with pool.connection() as conn:
                    await conn.execute(
                        _UPSERT_SQL,
                        checkpoint.checkpoint_id,
                        checkpoint.session_id,
                        checkpoint.status,
                        checkpoint.iteration,
                        _json_dumps(checkpoint.to_dict()),
                        _ts_to_iso(checkpoint.created_at),
                        _ts_to_iso(checkpoint.expires_at),
                    )
            except Exception as e:
                logger.warning("AgentCheckpointManager PG 写入失败(降级继续): %s", e)

        logger.debug(
            "AgentCheckpointManager save_checkpoint session=%s iter=%d status=%s id=%s",
            session_id,
            iteration,
            status,
            checkpoint_id,
        )
        return checkpoint_id

    def _evict_oldest_locked(self) -> None:
        """(必须持锁)删除 created_at 最老的 checkpoint。"""
        if not self._checkpoints:
            return
        oldest_id = min(self._checkpoints, key=lambda cid: self._checkpoints[cid].created_at)
        oldest = self._checkpoints.pop(oldest_id, None)
        if oldest is not None:
            # 若该 session 的 latest 索引指向被淘汰的 checkpoint,清理索引
            if self._session_index.get(oldest.session_id) == oldest_id:
                del self._session_index[oldest.session_id]

    async def load_checkpoint(self, checkpoint_id: str) -> AgentLoopCheckpoint | None:
        """加载 checkpoint。优先内存,miss 时查 redis。过期返回 None。"""
        now = time.time()
        # 1. 内存查
        # 注意:asyncio.Lock 不可重入,归位(内部要再次取锁)**必须**在出锁之后调用,
        # 否则 load_checkpoint 自己死锁。故这里只在锁内取引用,判定与写回放锁外。
        memory_hit: AgentLoopCheckpoint | None = None
        async with self._lock:
            cp = self._checkpoints.get(checkpoint_id)
            if cp is not None:
                if cp.is_expired(now):
                    # 过期,清理
                    self._delete_locked(checkpoint_id)
                    return None
                memory_hit = cp
        if memory_hit is not None:
            return await self._reconcile_loaded(memory_hit, now=now)

        # 2. miss 时 redis 查
        redis = await self._get_redis()
        if redis is not None:
            try:
                raw = await redis.get(f"agent_ckpt:{checkpoint_id}")
                if raw:
                    cp = AgentLoopCheckpoint.from_dict(json.loads(raw))
                    if cp.is_expired(now):
                        # redis 过期但未自动清理,删除
                        await redis.delete(f"agent_ckpt:{checkpoint_id}")
                        return None
                    # 回填内存缓存
                    async with self._lock:
                        self._checkpoints[checkpoint_id] = cp
                        self._session_index[cp.session_id] = checkpoint_id
                    return await self._reconcile_loaded(cp, now=now)
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 读取失败: %s", e)

        # 3. PG 兜底查(持久层,命中回填内存;过期留给 cleanup_expired 清理)
        if self._use_pg:
            try:
                pool = await self._get_pool()
                await self._ensure_table()
                async with pool.connection() as conn:
                    cur = await conn.execute(_SELECT_BY_ID_SQL, checkpoint_id)
                    row = await cur.fetchone()
                if row is not None:
                    cp = _row_to_agent_checkpoint(row)
                    if not cp.is_expired(now):
                        # 回填内存缓存
                        async with self._lock:
                            self._checkpoints[checkpoint_id] = cp
                            self._session_index[cp.session_id] = checkpoint_id
                        return await self._reconcile_loaded(cp, now=now)
            except Exception as e:
                logger.warning("AgentCheckpointManager PG 读取失败(降级继续): %s", e)

        return None

    async def load_latest_by_session(self, session_id: str) -> AgentLoopCheckpoint | None:
        """根据 session_id 加载最新 checkpoint。"""
        now = time.time()
        # 1. 内存索引查
        async with self._lock:
            checkpoint_id = self._session_index.get(session_id)

        if checkpoint_id is not None:
            return await self.load_checkpoint(checkpoint_id)

        # 2. 内存无,redis 查 session 索引
        redis = await self._get_redis()
        if redis is not None:
            try:
                checkpoint_id = await redis.get(f"agent_ckpt:session:{session_id}")
                if checkpoint_id:
                    return await self.load_checkpoint(checkpoint_id)
            except Exception as e:
                logger.warning("AgentCheckpointManager redis session 查询失败: %s", e)

        # 3. PG 按 session 查最新(持久层,命中回填内存)
        if self._use_pg:
            try:
                pool = await self._get_pool()
                await self._ensure_table()
                async with pool.connection() as conn:
                    cur = await conn.execute(_SELECT_LATEST_BY_SESSION_SQL, session_id)
                    row = await cur.fetchone()
                if row is not None:
                    cp = _row_to_agent_checkpoint(row)
                    if not cp.is_expired(now):
                        # 回填内存缓存
                        async with self._lock:
                            self._checkpoints[cp.checkpoint_id] = cp
                            self._session_index[cp.session_id] = cp.checkpoint_id
                        return await self._reconcile_loaded(cp, now=now)
            except Exception as e:
                logger.warning("AgentCheckpointManager PG session 查询失败(降级继续): %s", e)

        return None

    async def _reconcile_loaded(
        self, checkpoint: AgentLoopCheckpoint, *, now: float
    ) -> AgentLoopCheckpoint:
        """恢复入口的前置对账:凡"读一条 checkpoint 来续跑"的路径都过这里。

        为什么接在 load 上而不是接在调用方:resume/retry 的两条真实入口
        (`routers/agents.py` 的 /agents/execute/resume 属主探测,与
        `agent_loop_v2.resume_from_checkpoint`)读的**都是**本方法所在 manager 的
        `load_checkpoint` / `load_latest_by_session`。判据放在这里,两条路径天然共用
        同一次归位(spec 要求的"retry = resume 的子集,不得有两套置回写法"),
        而不需要改动那两个文件。列表路径(list_checkpoints / list_for_session)
        **刻意不接** —— 列一次表就批量改库不是对账,是写放大。

        应急出口:`IHUI_CHECKPOINT_RECONCILE=0` 整条跳过(默认 on)。
        异常一律降级为"不归位 + warning",绝不让对账把恢复打挂。
        """
        if not _reconcile_enabled():
            return checkpoint
        try:
            await self.reconcile_for_resume(
                checkpoint, now=now, alive=_default_alive_probe(checkpoint.session_id)
            )
        except Exception as e:  # noqa: BLE001 - 对账失败不得影响恢复(load 仍返回原行)
            logger.warning("checkpoint 归位对账失败(降级为不改写): %s", e)
        return checkpoint

    async def reconcile_for_resume(
        self,
        checkpoint: AgentLoopCheckpoint,
        *,
        now: float | None = None,
        alive: bool | None = None,
        stale_after_seconds: float | None = None,
    ) -> CheckpointReconcileDecision:
        """resume/retry 前置对账的**唯一入口**:判一次 + 幂等写回一次。

        Args:
            checkpoint: 已加载的行
            now: 当前时间戳;None = 自取 `time.time()`(一次调用只取一次,
                 age 与过期判定共用同一个值)
            alive: 存活信号。None = 走本模块默认探针(run_ownership 在飞登记);
                 **False(确证已死)只能由调用方显式传入** —— 本仓还没有跨实例
                 租约,默认探针结构上给不出 False。
            stale_after_seconds: None = 读环境变量/默认阈值

        Returns:
            CheckpointReconcileDecision:`changed` 是判出来的,`applied` 是写出来的,
            两者不等即"CAS 未命中/并发改写/存储降级"这一型,不静默合并。
        """
        current = now if now is not None else time.time()
        threshold = (
            _stale_threshold_seconds() if stale_after_seconds is None else stale_after_seconds
        )
        probe = _default_alive_probe(checkpoint.session_id) if alive is None else alive
        decision = decide_checkpoint_stale_reconcile(
            checkpoint, now=current, alive=probe, stale_after_seconds=threshold
        )
        if decision.action == RECONCILE_ACTION_KEEP:
            if decision.undetermined_alive:
                # 判不出存活但仍在窗口内:只多报一行,不改状态(保守方向)
                logger.debug(
                    "checkpoint %s running 且存活信号判不出,age=%.0fs 未过阈 %0.0fs,不归位",
                    decision.checkpoint_id,
                    decision.age_seconds,
                    threshold,
                )
            return decision
        if decision.action == RECONCILE_ACTION_MARK_EXPIRED:
            # 过期行的既有归宿就是本模块的删除路径(单行 WHERE 主键,天然幂等):
            # 第二次调用 delete_checkpoint 返回 False,不产生第二次迁移。
            await self.delete_checkpoint(decision.checkpoint_id)
            return replace(decision, applied=True)
        applied = await self._apply_stale_mark(checkpoint, decision, now=current)
        return replace(decision, applied=applied)

    async def _apply_stale_mark(
        self,
        checkpoint: AgentLoopCheckpoint,
        decision: CheckpointReconcileDecision,
        *,
        now: float,
    ) -> bool:
        """把 running 归位成 paused:内存 CAS -> PG 条件更新 -> redis 刷新剩余 TTL。

        三层存储都要落,否则会出现"内存说 paused、PG 里还是 running"(下次冷启动
        从 PG 读又变回僵尸)。写失败按本模块既有口径 warning 降级,不抛。
        """
        checkpoint_id = decision.checkpoint_id
        target_status = decision.to_status or STALE_RECONCILE_TARGET_STATUS
        async with self._lock:
            stored = self._checkpoints.get(checkpoint_id)
            # 内存里有就以内存那份为写入对象(它是后续 load 的返回源);
            # 没有(冷启动只从 PG 读回来的一次性对象)就改手上这份,稍后回填。
            subject = stored if stored is not None else checkpoint
            if subject.checkpoint_id != checkpoint_id or subject.status != decision.from_status:
                logger.info(
                    "checkpoint %s 已被并发改写为 %s,跳过归位(幂等:不产生第二次迁移,"
                    "也不把终态改回非终态)",
                    checkpoint_id,
                    subject.status,
                )
                return False
            subject.status = target_status
            subject.metadata[STALE_RECONCILE_AT_KEY] = now
            subject.metadata[STALE_RECONCILE_REASON_KEY] = decision.reason
            payload_json = _json_dumps(subject.to_dict())
            if stored is None:
                self._checkpoints[checkpoint_id] = subject
                self._session_index[subject.session_id] = checkpoint_id
        if self._use_pg:
            try:
                pool = await self._get_pool()
                await self._ensure_table()
                async with pool.connection() as conn:
                    cur = await conn.execute(
                        _MARK_STALE_SQL,
                        target_status,
                        payload_json,
                        checkpoint_id,
                        decision.from_status,
                    )
                if int(getattr(cur, "rowcount", 0) or 0) == 0:
                    # 另一个实例已把它改走(可能改成了终态)。内存已收敛到 paused,
                    # 下次 load 会以 PG 为准回填;这里只喊一行,不猜、不二次覆盖。
                    logger.info(
                        "checkpoint %s 归位 CAS 未命中(0 行受影响),判定为已被他人改写",
                        checkpoint_id,
                    )
            except Exception as e:  # noqa: BLE001 - PG 不可达按既有降级口径
                logger.warning("AgentCheckpointManager PG 归位写入失败(降级继续): %s", e)
        redis = await self._get_redis()
        if redis is not None:
            # 只刷新内容,**不重置存活期**:过期时刻的单一真源仍是 expires_at,
            # 所以 ex 用剩余时间而不是 self._ttl(用 self._ttl 等于给僵尸续命)。
            remaining = subject.expires_at - now
            if remaining > 0:
                try:
                    await redis.set(
                        f"agent_ckpt:{checkpoint_id}", payload_json, ex=int(remaining)
                    )
                except Exception as e:  # noqa: BLE001 - 降级不抛
                    logger.warning("AgentCheckpointManager redis 归位写入失败: %s", e)
        logger.info(
            "checkpoint %s 归位 %s -> %s(reason=%s, age=%.0fs, 上次进程在完成前停住)",
            checkpoint_id,
            decision.from_status,
            target_status,
            decision.reason,
            decision.age_seconds,
        )
        return True

    async def list_checkpoints(
        self, session_id: str | None = None
    ) -> list[AgentLoopCheckpoint]:
        """列出 checkpoint(可选按 session 过滤)。已过期的不会列出。"""
        now = time.time()
        async with self._lock:
            cps = [
                cp
                for cp in self._checkpoints.values()
                if not cp.is_expired(now)
                and (session_id is None or cp.session_id == session_id)
            ]
        # 按 created_at 升序
        cps.sort(key=lambda c: c.created_at)
        return cps

    async def list_for_session(
        self, session_id: str
    ) -> list[CheckpointMeta]:
        """列出指定会话的 checkpoint 轻量元数据(供 Checkpoint/Rewind 面板展示)。

        仅返回定位字段 + message_count,不含完整 messages(避免大响应),
        按 created_at 升序。列表/HTTP 层以 to_dict() 序列化即不泄漏消息内容。
        """
        all_cps = await self.list_checkpoints(session_id=session_id)
        return [
            CheckpointMeta(
                checkpoint_id=cp.checkpoint_id,
                session_id=cp.session_id,
                iteration=cp.iteration,
                status=cp.status,
                created_at=cp.created_at,
                expires_at=cp.expires_at,
                message_count=len(cp.messages),
            )
            for cp in all_cps
        ]

    async def restore(
        self, session_id: str, checkpoint_id: str
    ) -> dict[str, Any]:
        """把会话恢复到指定 checkpoint。

        返回包含 messages 的完整会话快照,供调用方写回会话运行时存储。
        Raises:
            CheckpointNotFoundError: checkpoint 不存在/过期
            CheckpointSessionMismatchError: checkpoint 归属其他会话
        """
        cp = await self.load_checkpoint(checkpoint_id)
        if cp is None:
            raise CheckpointNotFoundError(
                f"checkpoint {checkpoint_id} 不存在或已过期,请联系用户重新生成"
            )
        if cp.session_id != session_id:
            raise CheckpointSessionMismatchError(
                f"checkpoint {checkpoint_id} 属于会话 {cp.session_id},不能恢复到会话 {session_id}"
            )

        return {
            "checkpoint_id": cp.checkpoint_id,
            "session_id": cp.session_id,
            "iteration": cp.iteration,
            "status": cp.status,
            "restored_message_count": len(cp.messages),
            # 深拷贝消息历史:调用方修改返回的列表/消息不得污染 checkpoint 快照
            # (Rewind 面板展示 + 会话写回都建立在"原快照不可变"之上)
            "messages": json.loads(json.dumps(cp.messages, ensure_ascii=False)),
            "tool_state": cp.tool_state,
            "metadata": cp.metadata,
            "file_versions": cp.metadata.get("file_versions", []),
        }

    def _delete_locked(self, checkpoint_id: str) -> bool:
        """(必须持锁)从内存删除 checkpoint。返回是否删除成功。"""
        cp = self._checkpoints.pop(checkpoint_id, None)
        if cp is None:
            return False
        if self._session_index.get(cp.session_id) == checkpoint_id:
            del self._session_index[cp.session_id]
        return True

    async def delete_checkpoint(self, checkpoint_id: str) -> bool:
        """删除 checkpoint。返回是否删除成功。"""
        async with self._lock:
            deleted = self._delete_locked(checkpoint_id)

        redis = await self._get_redis()
        if redis is not None:
            try:
                await redis.delete(f"agent_ckpt:{checkpoint_id}")
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 删除失败: %s", e)

        # PG 同步删除(尽力,失败不阻塞)
        if self._use_pg:
            try:
                pool = await self._get_pool()
                await self._ensure_table()
                async with pool.connection() as conn:
                    await conn.execute(
                        "DELETE FROM agent_checkpoints WHERE checkpoint_id = %s",
                        checkpoint_id,
                    )
            except Exception as e:
                logger.warning("AgentCheckpointManager PG 删除失败(降级继续): %s", e)

        return deleted

    async def cleanup_expired(self) -> int:
        """清理过期 checkpoint,返回清理数量。"""
        now = time.time()
        expired_ids: list[str] = []
        async with self._lock:
            for cid, cp in self._checkpoints.items():
                if cp.is_expired(now):
                    expired_ids.append(cid)
            for cid in expired_ids:
                self._delete_locked(cid)

        # 同步清理 redis(尽力,失败不阻塞)
        if expired_ids:
            redis = await self._get_redis()
            if redis is not None:
                try:
                    for cid in expired_ids:
                        await redis.delete(f"agent_ckpt:{cid}")
                except Exception as e:
                    logger.warning("AgentCheckpointManager redis 清理失败: %s", e)

        # 同步清理 PG 过期行(尽力,失败不阻塞;返回计数以内存清理为准)
        if self._use_pg:
            try:
                pool = await self._get_pool()
                await self._ensure_table()
                async with pool.connection() as conn:
                    cur = await conn.execute(
                        "DELETE FROM agent_checkpoints WHERE expires_at <= %s",
                        _ts_to_iso(now),
                    )
                logger.debug(
                    "AgentCheckpointManager PG 过期清理 %s 行", cur.rowcount
                )
            except Exception as e:
                logger.warning("AgentCheckpointManager PG 清理失败(降级继续): %s", e)

        if expired_ids:
            logger.info("AgentCheckpointManager cleanup_expired 清理 %d 个", len(expired_ids))
        return len(expired_ids)

    async def close(self) -> None:
        """关闭 redis 连接与 PG 连接池(可选调用)。"""
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception as e:
                logger.warning("agent_checkpoint.close redis aclose 失败: %s", e, exc_info=True)
            self._redis = None
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception as e:
                logger.warning("agent_checkpoint.close 连接池关闭失败: %s", e, exc_info=True)
            self._pool = None


# 全局单例
_agent_checkpoint_manager: AgentCheckpointManager | None = None


def get_agent_checkpoint_manager() -> AgentCheckpointManager:
    """获取全局 AgentCheckpointManager 单例。

    读取 REDIS_URL 环境变量决定是否启用 redis 持久化;
    读取 settings.database_url 决定是否启用 PG 持久层(D26 主链路三层存储)。
    """
    global _agent_checkpoint_manager
    if _agent_checkpoint_manager is None:
        from ..core.config import settings

        redis_url = os.environ.get("REDIS_URL")
        _agent_checkpoint_manager = AgentCheckpointManager(
            redis_url=redis_url, db_url=settings.database_url or None
        )
    return _agent_checkpoint_manager


def _reset_global_manager_for_test() -> None:
    """(测试用)重置全局单例。"""
    global _agent_checkpoint_manager
    if _agent_checkpoint_manager is not None:
        with contextlib.suppress(RuntimeError):
            asyncio.get_running_loop().create_task(
                _agent_checkpoint_manager.close()
            )
    _agent_checkpoint_manager = None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

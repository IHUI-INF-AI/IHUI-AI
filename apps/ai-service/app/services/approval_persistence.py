# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审批决策持久化(批 51:审批策略面,对齐 OpenAI codex-rs approvals.rs)。

背景
----
codex 的审批键(ApprovalCacheKey)支持「审批决策持久化」:用户批准一次后,
同键请求在 *本会话内*('PERSIST_SESSION') 或 *永久*('PERSIST_ALWAYS') 两个
层级不再重复弹审批。ihui 现状:`mcp_server.py` 的 `_exec_allowed_prefixes`
(长期前缀放行) 与一次性放行登记表(`approve_exec_command` /
`_consume_exec_approval`) 全是进程内存 —— 服务重启即丢,且无「会话」层概念。

本模块把审批授权落盘到 **PostgreSQL**(经 `app.core.pg_sync` 同步桥),使授权可跨
重启保留,并显式区分 session / always 两级 scope。存储后端有且只有两个实现:
PG(生产)与进程内(**仅**测试隔离用,不落任何文件)。

设计要点
--------
- 崩溃安全:每条写操作一个事务(BEGIN/COMMIT/ROLLBACK),失败原样抛出;
- 线程安全:`threading.Lock` 串行化所有后端访问;
- 幂等:`UNIQUE(scope, cache_key, kind)` 约束 + `ON CONFLICT DO NOTHING`;
- scope 优先级:`always` 优先于 `session`;session 级带过期,过期即删并返回 None;
- 后端模块级惰性单例;`set_db_path(...)` 注入者一律切到进程内后端(测试隔离),
  传回默认值恢复默认选择(有 DSN 走 PG,无 DSN 走进程内);
- 仅同步 API(无 async),符合本仓 mcp_server 既有同步风格。
"""

# 合并归位说明(2026-09-29,枚 f57e0c9983 的后续修复):describe_exec_environment 在同一次归并后
# 出现两份定义(第 270 行与第 539 行),来源与 network_approval.py 那一族完全相同 ——
# 两侧各写一遍同一功能,行级合并不报冲突却把两半都留下,mypy 报 no-redef。整档取对侧那一族,
# 与调用方同族;引用面用 ast 逐条核过,对侧版不缺任何被具名导入的名字。

from __future__ import annotations

import os
import re
import threading
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from app.core.pg_sync import PgShim, SyncPgSession

# ==================== 常量 ====================

DEFAULT_DB_PATH = Path("data/approval_grants.db")

SCOPE_SESSION = "session"
SCOPE_ALWAYS = "always"
_SCOPES = frozenset({SCOPE_SESSION, SCOPE_ALWAYS})

KIND_EXEC_PREFIX = "exec_prefix"  # 前缀放行类(对齐 _exec_allowed_prefixes)
KIND_EXEC_ONCE = "exec_once"      # 一次性放行(对齐 approve_exec_command)
KIND_MCP_TOOL = "mcp_tool"        # MCP 工具调用(对齐 protocol mcp_approval_meta)
KIND_NET = "network"              # 网络访问审批(批 52,对齐统一规范;键前缀 net\x1f 区分)
_KINDS = frozenset({KIND_EXEC_PREFIX, KIND_EXEC_ONCE, KIND_MCP_TOOL, KIND_NET})

# 规范化键用的单元分隔符(与 shlex.join 不同,此处用不可打印分隔符避免 token
# 内出现空格/引号造成歧义;语义对齐 mcp_server 既有 `_canonical_approval_key`)
_UNIT_SEP = "\x1f"

# 主体绑定键的记录分隔符(owner-bound cache_key 用;D158 owner-binding 修复)。
# 与 _UNIT_SEP 区分:argv 归一键内部以 \x1f 连接,主体段以 \x1e 与其分隔;
# 主体取自 JWT(形如 UUID / "system-worker"),不含 \x1e ⇒ 首段切分无歧义,
# 且残余原文完整保留(argv token 即便含 \x1e 也不影响"同主体同命令同键")。
_OWNER_SEP = "\x1e"

# env 赋值 token 判定:VAR=val 形态(等号前为合法标识符)
_ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

# ==================== 模块级惰性单例 ====================

_DB_PATH: Path = DEFAULT_DB_PATH
# 必须是可重入锁:公共 API 先持锁,再在锁内调 `_get_backend()`(它也持同一把锁做
# 惰性初始化)。非重入的 `Lock` 会在这里当场自锁 —— 这是"两层各自加锁"的经典坑,
# 实测表现为整个进程挂住而不是报错。
_lock = threading.RLock()
_backend: _Backend | None = None


def set_db_path(path: str | Path) -> None:
    """注入独立存储(测试隔离用)。

    路径本身**不再落任何文件**(数据层只允许 PostgreSQL):非默认路径 ⇒ 切到进程内
    后端,等价于"给本次测试一个干净且互相隔离的审批库";传回 `DEFAULT_DB_PATH` ⇒
    恢复默认选择(有 DSN 走 PG,无 DSN 走进程内)。会关闭旧后端,使下一次读写惰性重建。
    """
    global _DB_PATH, _backend
    with _lock:
        _DB_PATH = Path(path)
        if _backend is not None:
            _backend.close()
            _backend = None


def _now_iso() -> str:
    """UTC ISO 8601 定宽字符串(无小数秒),可字典序比较等价于时间先后。"""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _iso_plus_ttl(ttl_seconds: int) -> str:
    return (datetime.now(UTC) + timedelta(seconds=ttl_seconds)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


_SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS approval_grants (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scope       text NOT NULL,
    cache_key   text NOT NULL,
    kind        text NOT NULL,
    created_at  text NOT NULL,
    expires_at  text NULL,
    CONSTRAINT approval_grants_scope_key_kind_key UNIQUE (scope, cache_key, kind)
);
"""


class _Backend(Protocol):
    """存储后端契约:公共 API 只认这九个动作,SQL/引擎差异全部关在实现里。"""

    def upsert(
        self, scope: str, cache_key: str, kind: str, created_at: str, expires_at: str | None
    ) -> None: ...

    def find_always(self, cache_key: str, kind: str, now: str) -> bool: ...

    def find_session_expiry(self, cache_key: str, kind: str) -> tuple[bool, str | None]: ...

    def delete_key(self, cache_key: str, kind: str) -> None: ...

    def rows_for_kind(self, kind: str) -> list[dict[str, Any]]: ...

    def rows_for_kinds(self, kinds: Sequence[str]) -> list[dict[str, Any]]: ...

    def delete_expired(self, now: str) -> int: ...

    def stats(self) -> tuple[int, dict[str, int], dict[str, int]]: ...

    def close(self) -> None: ...


class _PgBackend:
    """PostgreSQL 实现(经 `app.core.pg_sync` 同步桥;`?` 占位符由 `PgShim` 翻成 `$n`)。"""

    def __init__(self, dsn: str) -> None:
        self._session = SyncPgSession(dsn)
        self._shim = PgShim(self._session)
        self._shim.executescript(_SCHEMA_DDL)

    def upsert(
        self, scope: str, cache_key: str, kind: str, created_at: str, expires_at: str | None
    ) -> None:
        self._shim.execute(
            "INSERT INTO approval_grants (scope, cache_key, kind, created_at, expires_at)"
            " VALUES (?,?,?,?,?) ON CONFLICT (scope, cache_key, kind) DO NOTHING",
            (scope, cache_key, kind, created_at, expires_at),
        )

    def find_always(self, cache_key: str, kind: str, now: str) -> bool:
        row = self._shim.execute(
            "SELECT 1 FROM approval_grants"
            " WHERE cache_key=? AND kind=? AND scope='always'"
            " AND (expires_at IS NULL OR expires_at > ?)",
            (cache_key, kind, now),
        ).fetchone()
        return row is not None

    def find_session_expiry(self, cache_key: str, kind: str) -> tuple[bool, str | None]:
        row = self._shim.execute(
            "SELECT expires_at FROM approval_grants"
            " WHERE cache_key=? AND kind=? AND scope='session'",
            (cache_key, kind),
        ).fetchone()
        if row is None:
            return False, None
        return True, row["expires_at"]

    def delete_key(self, cache_key: str, kind: str) -> None:
        self._shim.execute(
            "DELETE FROM approval_grants WHERE cache_key=? AND kind=?", (cache_key, kind)
        )

    def rows_for_kind(self, kind: str) -> list[dict[str, Any]]:
        rows = self._shim.execute(
            "SELECT DISTINCT cache_key, scope, expires_at FROM approval_grants WHERE kind=?",
            (kind,),
        ).fetchall()
        return [dict(row) for row in rows]

    def rows_for_kinds(self, kinds: Sequence[str]) -> list[dict[str, Any]]:
        rows = self._shim.execute(
            "SELECT kind, cache_key, scope, created_at, expires_at FROM approval_grants"
            f" WHERE kind IN ({','.join('?' for _ in kinds)})",
            tuple(kinds),
        ).fetchall()
        return [dict(row) for row in rows]

    def delete_expired(self, now: str) -> int:
        return self._shim.execute(
            "DELETE FROM approval_grants"
            " WHERE scope='session' AND expires_at IS NOT NULL AND expires_at <= ?",
            (now,),
        ).rowcount

    def stats(self) -> tuple[int, dict[str, int], dict[str, int]]:
        total_row = self._shim.execute("SELECT COUNT(*) AS c FROM approval_grants").fetchone()
        total = int(total_row["c"]) if total_row is not None else 0
        by_scope: dict[str, int] = dict.fromkeys(_SCOPES, 0)
        for row in self._shim.execute(
            "SELECT scope, COUNT(*) AS c FROM approval_grants GROUP BY scope"
        ).fetchall():
            by_scope[row["scope"]] = int(row["c"])
        by_kind: dict[str, int] = dict.fromkeys(_KINDS, 0)
        for row in self._shim.execute(
            "SELECT kind, COUNT(*) AS c FROM approval_grants GROUP BY kind"
        ).fetchall():
            by_kind[row["kind"]] = int(row["c"])
        return total, by_scope, by_kind

    def close(self) -> None:
        self._shim.close()


class _MemoryBackend:
    """进程内后端:测试隔离用(`set_db_path` 注入的路径只当"新实例"开关,不落任何文件)。"""

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str, str], dict[str, Any]] = {}

    def upsert(
        self, scope: str, cache_key: str, kind: str, created_at: str, expires_at: str | None
    ) -> None:
        self._rows.setdefault(
            (scope, cache_key, kind),
            {
                "scope": scope,
                "cache_key": cache_key,
                "kind": kind,
                "created_at": created_at,
                "expires_at": expires_at,
            },
        )

    def find_always(self, cache_key: str, kind: str, now: str) -> bool:
        row = self._rows.get((SCOPE_ALWAYS, cache_key, kind))
        if row is None:
            return False
        expires = row["expires_at"]
        return expires is None or str(expires) > now

    def find_session_expiry(self, cache_key: str, kind: str) -> tuple[bool, str | None]:
        row = self._rows.get((SCOPE_SESSION, cache_key, kind))
        if row is None:
            return False, None
        expires = row["expires_at"]
        return True, None if expires is None else str(expires)

    def delete_key(self, cache_key: str, kind: str) -> None:
        for key in [k for k in self._rows if k[1] == cache_key and k[2] == kind]:
            del self._rows[key]

    def rows_for_kind(self, kind: str) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for row in self._rows.values():
            if row["kind"] == kind and row["cache_key"] not in out:
                out[row["cache_key"]] = {
                    "cache_key": row["cache_key"],
                    "scope": row["scope"],
                    "expires_at": row["expires_at"],
                }
        return list(out.values())

    def rows_for_kinds(self, kinds: Sequence[str]) -> list[dict[str, Any]]:
        wanted = set(kinds)
        return [
            dict(row)
            for row in self._rows.values()
            if row["kind"] in wanted
        ]

    def delete_expired(self, now: str) -> int:
        dead = [
            k
            for k, row in self._rows.items()
            if row["scope"] == SCOPE_SESSION
            and row["expires_at"] is not None
            and str(row["expires_at"]) <= now
        ]
        for k in dead:
            del self._rows[k]
        return len(dead)

    def stats(self) -> tuple[int, dict[str, int], dict[str, int]]:
        by_scope: dict[str, int] = dict.fromkeys(_SCOPES, 0)
        by_kind: dict[str, int] = dict.fromkeys(_KINDS, 0)
        for row in self._rows.values():
            by_scope[row["scope"]] += 1
            by_kind[row["kind"]] += 1
        return len(self._rows), by_scope, by_kind

    def close(self) -> None:
        self._rows.clear()


def _approval_dsn() -> str:
    """审批库的 DSN:`APPROVAL_PG_DSN` 优先,其次 `DATABASE_URL`。"""
    return (
        os.environ.get("APPROVAL_PG_DSN", "").strip()
        or os.environ.get("DATABASE_URL", "").strip()
    )


def _running_under_pytest() -> bool:
    """是否在 pytest 进程里(本仓铁律:测试一律不得连生产库)。"""
    import sys

    return "PYTEST_CURRENT_TEST" in os.environ or "pytest" in sys.modules


def _get_backend() -> _Backend:
    """惰性返回后端单例。

    选择规则(单一出口,调用方不感知):
    - pytest 进程 ⇒ 进程内后端(测试连生产库是铁律禁止项,不是偏好);
    - `set_db_path(...)` 注入过非默认路径 ⇒ 进程内后端(测试隔离,不落文件);
    - 否则有 DSN ⇒ PostgreSQL;没有 DSN ⇒ 进程内后端(授权丢失=重新弹审批,
      失效方向是"多要一次审批",不是"多放一次行")。
    """
    global _backend
    with _lock:
        if _backend is None:
            if _DB_PATH != DEFAULT_DB_PATH or _running_under_pytest():
                _backend = _MemoryBackend()
            else:
                dsn = _approval_dsn()
                _backend = _PgBackend(dsn) if dsn else _MemoryBackend()
        return _backend



# ==================== 规范化键辅助 ====================


def normalize_exec_key(command_tokens: Sequence[str]) -> str:
    """把命令 argv 规范化为稳定审批键(对齐 mcp_server 现有规范化语义)。

    规则:
    1. 全部小写(大小写归一);
    2. 剥去首部 env 赋值 token(`VAR=val` 形态),可连续多个(如
       `FOO=1 BAR=2 git status` → 剥 `FOO=1` `BAR=2`);
    3. 剥去首部 `sudo` / `doas` 前缀(可紧跟在 env 赋值之后);
    4. 用单元分隔符 `\\x1f` 连接剩余 token。

    command_tokens 约定为已切词形态(消费方负责切词,本函数不做 shell 解析)。

    >>> normalize_exec_key(["SUDO", "Git", "Status"])
    'git\\x1fstatus'
    >>> normalize_exec_key(["FOO=bar", "Git", "Status"])
    'git\\x1fstatus'
    """
    lowered = [t.lower() for t in command_tokens]
    i = 0
    changed = True
    while changed and i < len(lowered):
        changed = False
        tok = lowered[i]
        if _ENV_ASSIGN_RE.match(tok):
            i += 1
            changed = True
            continue
        if tok in ("sudo", "doas"):
            i += 1
            changed = True
            continue
        break
    return _UNIT_SEP.join(lowered[i:])


def scoped_cache_key(owner: str, cache_key: str) -> str:
    """把主体编进 cache_key 的唯一规范化实现(D158 owner-binding 修复,2026-09-29)。

    背景:`grant("always", normalize_exec_key(argv前缀), "exec_prefix")` 落的是
    **无主体**键 —— A 用户批准的 `git push` 前缀会让 B 用户同样操作在 90 天内被
    静默放行。修复走键组合而非加列(不改 _SCHEMA_DDL、不需要 ALTER TABLE 迁移,
    存量无主体行因永远匹配不上而等效失效,方向是收紧)。

    主体约束:caller 必须传**令牌主体**(JWT / request.state.user_id 派生),
    禁止传客户端自报 userId(本仓 §5"认证不等于授权";与 llm.py
    `_grant_bucket_key` 的 `conv::<主体>::<会话>` 同一设计意图)。
    空主体直接抛错 —— 不存在"无主体放行"这一档,fail-closed 由调用方兜。
    """
    o = str(owner or "").strip()
    if not o:
        raise ValueError("scoped_cache_key 需要非空主体(令牌主体;空 ⇒ 不落规则)")
    return o + _OWNER_SEP + cache_key


def split_scoped_key(key: str) -> tuple[str | None, str]:
    """`scoped_cache_key` 的逆运算:返回 (主体, 裸键)。

    不含主体段的键(存量行 / mcp_server 与 agent_loop 既有无主体键空间)⇒
    (None, 原键)。首段切分:主体段(JWT 派生,UUID / "system-worker")不含
    _OWNER_SEP,残余一律归裸键,不做二次解释。
    """
    if _OWNER_SEP in key:
        owner, _, bare = key.partition(_OWNER_SEP)
        if owner:
            return owner, bare
    return None, key


def key_is_owned_by(key: str, owner: str | None) -> bool:
    """该 cache_key 是否绑定在指定主体上(管理出口列表过滤 / 撤销归属闸用)。

    `owner` 允许是 None:调用方那侧的主体是从 `request.state.user_id` 派生的
    (`_resolve_owner_uuid` 的签名就是 `-> str | None`),而本函数第一行已经把
    "空/None 主体"归一成 `""` 并返回 False —— **判据本来就吃 None**,把它写成
    `str` 只是让 mypy 在两个调用点上红,而红着的门会让每次提交被逼跳门。
    失效方向因此是 fail-closed(列不出、撤不掉),不是放行。

    无主体键(存量行)对任何主体都返回 False —— 它不再属于任何人,
    面板不可见、不可撤,只能由 DB 级 purge 处置(不在此判据射程)。
    """
    o = str(owner or "").strip()
    if not o:
        return False
    bound, _bare = split_scoped_key(key)
    return bound == o
# ==================== 审批载荷事实与上报开关(D159,单一出口) ====================
#
# 为什么住在这一层:审批载荷的两位生产者(主对话流 `routers/llm.py` 与 agent 任务流
# `services/agent_loop_v2.py`)都必须**已经** import 本模块,而"这次命令到底在哪儿跑"
# 这句话若在两处各写一遍,就会有两份真值 —— 本仓最高频的失效型正是"两处算同一件事
# 必漂移"(AGENTS §5 认证不等于授权、§4 描边判据同一条)。开关同理:两处各读一次
# `os.environ`,关档时就会有一侧还在报。
#
# 判据铁律(票第 8 栏爆炸半径):**显示"沙箱内"而实际是 plain = 误导用户放行,比不显示
# 更糟**。所以这里只转录**分派用的那一个字段**,并且读不到就返回 None(整字段缺省,
# 前端渲染"未上报"),绝不把"没读到"写成"没隔离"或"已隔离"。

#: D159 回退开关:0/false/off/no ⇒ 服务端不填新字段、前端整块不渲染(回到现读形态)。
ENV_REPORT_FLAG = "IHUI_APPROVAL_ENV_REPORT"

#: 会被本出口当作"执行环境"来读的工具(命令执行族)。
#: 值域与 `services/mcp_server.py::_tool_run_command` 的分派入参同一族 —— 该函数读
#: `arguments.get("sandbox_backend", "local")` 决定走本地还是沙箱后端,而本出口读的是
#: **同一个字段**,所以"弹窗说的"与"实际跑的"结构上不可能分叉。
ENV_REPORT_TOOLS: frozenset[str] = frozenset({"run_command", "execute_command"})

#: 这些后端的网络隔离语义(mcp_server 2634-2656 + sandbox.py 的 backend 分派现读):
#: - local:无容器边界 ⇒ 网络**不**隔离(sandbox.py「Local backend 无法隔离网络」)
#: - docker:`docker run --network=none` ⇒ 网络隔离
#: - 其余(ssh/modal/daytona/singularity):我方没有可读的隔离判据 ⇒ None(不猜)
_BACKEND_ISOLATES_NETWORK: dict[str, bool] = {"local": False, "docker": True}

#: 已知后端名(mcp_server._tool_run_command 的 sandbox_backend 枚举 + local)。
#: 不在表内 ⇒ 读不到(不认的写法一律不冒充事实)。
KNOWN_SANDBOX_BACKENDS: frozenset[str] = frozenset(
    {"local", "docker", "ssh", "modal", "daytona", "singularity"}
)


def env_report_enabled(env: Mapping[str, str] | None = None) -> bool:
    """审批载荷是否上报执行环境/网络事实(D159 回退开关,默认开)。

    只认显式关档写法(``0``/``false``/``off``/``no``,大小写不敏感);其它取值(含未设、
    空串、乱写)一律按"开"。理由:关档是**人的显式决定**,拼错一个值不该把信息静默关掉。
    """
    source = env if env is not None else os.environ
    raw = str(source.get(ENV_REPORT_FLAG, "") or "").strip().lower()
    return raw not in ("0", "false", "off", "no")


def describe_exec_environment(
    tool_name: str,
    args: Mapping[str, object] | None,
    *,
    env: Mapping[str, str] | None = None,
) -> dict[str, object] | None:
    """把"这次调用会在哪儿跑"读成载荷字段;读不到 ⇒ **None**(不是空 dict、不是 false)。

    返回形态(内层键 **camelCase**,与票面 §11.3 第 1 栏声明的
    `{ inSandbox, backend, degraded?, degradeNote? }` 逐字同形;外层键 `exec_environment`
    仍是 snake,与 tool-approval 帧其余键同族 —— 两层的命名法不同是刻意的,别"顺手统一"):
      ``{inSandbox: bool, backend: str, networkIsolated: bool, degraded: False}``
    - ``inSandbox`` 只在后端名**认得**时给;``networkIsolated`` 只在 local/docker 给,
      其余后端 ⇒ 字段缺席(不猜);
    - ``degraded`` 恒 False —— 我方 ai-service 侧没有可读的降级链(那条在 CLI 的
      `detect.ts`,不在本进程,读它就得跨进程问,本票不做)。既然读不到就不写"已降级",
      也不写"未降级"以外的任何推断 ⇒ 索性把该字段留给真有降级事实的那一路。

    None 的情形:开关关档 / 不是命令执行族 / 后端名不认识。调用方据此**整字段不发**,
    前端渲染"未上报"(见 web 侧 tool-approval-dialog 的 envUnknown 判据)。
    """
    if not env_report_enabled(env):
        return None
    if tool_name not in ENV_REPORT_TOOLS:
        return None
    if not isinstance(args, Mapping):
        return None
    raw = args.get("sandbox_backend", "local")
    backend = str(raw or "local").strip().lower()
    if backend not in KNOWN_SANDBOX_BACKENDS:
        return None
    payload: dict[str, object] = {
        "inSandbox": backend != "local",
        "backend": backend,
        "degraded": False,
    }
    if backend in _BACKEND_ISOLATES_NETWORK:
        payload["networkIsolated"] = _BACKEND_ISOLATES_NETWORK[backend]
    return payload




# ==================== 核心 API ====================


def grant(
    scope: str,
    cache_key: str,
    kind: str,
    *,
    ttl_seconds: int | None = None,
    ttl_days: int | None = None,
) -> None:
    """登记一次审批授权(幂等 upsert:同键重复登记不覆盖原行)。

    scope: 'session' | 'always';
    cache_key: 规范化键(normalize_exec_key 产物 / 工具名+参数摘要);
    kind: 'exec_prefix' | 'exec_once' | 'mcp_tool' | 'network';
    ttl_seconds: 仅 session 级有意义,给定则在 created_at 基础上设 expires_at;
    ttl_days: D158(2026-09-28)—— always 级的过期天数(用户批的第四档预填口径:90 天)。
        历史语义保持:两个参数都不给 ⇒ always 仍永久(session 级照旧只认 ttl_seconds)。
    """
    if scope not in _SCOPES:
        raise ValueError(f"非法 scope: {scope!r} (允许: {sorted(_SCOPES)})")
    if kind not in _KINDS:
        raise ValueError(f"非法 kind: {kind!r} (允许: {sorted(_KINDS)})")

    created_at = _now_iso()
    expires_at: str | None
    if scope == SCOPE_ALWAYS and ttl_days is not None:
        # D158:always 级也可带过期天数(第四档预填口径 90 天)。不给 ⇒ 永久(历史语义)。
        expires_at = _iso_plus_ttl(int(ttl_days) * 86400)
    else:
        expires_at = None if (scope == SCOPE_ALWAYS or ttl_seconds is None) else _iso_plus_ttl(
            int(ttl_seconds)
        )
    with _lock:
        _get_backend().upsert(scope, cache_key, kind, created_at, expires_at)


def check(cache_key: str, kind: str) -> str | None:
    """查询命中 scope;'always' 优先于 'session'。

    返回:
        'always' 命中永久授权;
        'session' 命中会话授权且未过期;
        None 两 scope 均未命中,或 session 级已过期(过期记录会被顺手删除)。
    """
    now = _now_iso()
    with _lock:
        backend = _get_backend()
        # always 优先(D158:也给 always 行判过期 —— 只有过期落在 90 天 TTL 上;历史
        # 行 expires_at 为 NULL ⇒ 永不过,语义不变)
        if backend.find_always(cache_key, kind, now):
            return SCOPE_ALWAYS
        found, expires = backend.find_session_expiry(cache_key, kind)
        if not found:
            return None
        if expires is None or expires > now:
            return SCOPE_SESSION
        # 已过期 → 删
        backend.delete_key(cache_key, kind)
        return None


def revoke(cache_key: str, kind: str) -> None:
    """撤销某 cache_key+kind 在两 scope 上的全部授权。"""
    with _lock:
        _get_backend().delete_key(cache_key, kind)


def list_keys(kind: str) -> list[str]:
    """枚举某 kind 下未过期的全部 cache_key(前缀放行匹配用;未排序)。

    session 级已过期记录不返回(但不顺手删,清理走 purge_expired)。
    查询失败抛存储异常,由调用方决定降级策略(审批链路必须 fail-closed)。
    """
    if kind not in _KINDS:
        raise ValueError(f"非法 kind: {kind!r} (允许: {sorted(_KINDS)})")
    now = _now_iso()
    with _lock:
        rows = _get_backend().rows_for_kind(kind)
    keys: list[str] = []
    for row in rows:
        if row["scope"] == SCOPE_ALWAYS:
            keys.append(str(row["cache_key"]))
        else:
            expires = row["expires_at"]
            if expires is None or str(expires) > now:
                keys.append(str(row["cache_key"]))
    return keys


def list_grant_rows(kinds: Sequence[str]) -> list[dict[str, Any]]:
    """只读投影:按 kind 集合取 grant 行明细(cache_key/scope/created_at/expires_at)。

    返回类型补全泛型参数(守门 35 :458 判 "Missing type arguments for generic type
    ``dict``"):裸 ``dict`` 在 mypy 眼里是 ``dict[Any, Any]``,等于把"这张行的键都是列名
    (str)"这一事实扔掉 —— 调用方(llm.py 的 grants 面板)按 ``row["cache_key"]`` 这类
    字符串键取值,所以键侧是 **str**,值侧是各后端的原生列值(str/None 混合,时间列
    以文本落库且可为 NULL),故取 ``dict[str, Any]`` 而不是编一个假精确的值类型。
    与本文件 ``stats() -> dict[str, Any]`` 同一套投影口径,不新开第三种写法。

    过期过滤仍以 list_keys 权威集为准,本函数只做明细投影,不复制第二份过期判定。
    """
    with _lock:
        return _get_backend().rows_for_kinds(kinds)


def purge_expired() -> int:
    """清理过期的 session 级记录,返回被删除条数。"""
    now = _now_iso()
    with _lock:
        return _get_backend().delete_expired(now)


def stats() -> dict[str, Any]:
    """统计:{'total': int, 'byScope': {...}, 'byKind': {...}}。"""
    with _lock:
        total, by_scope, by_kind = _get_backend().stats()
    return {
        "total": total,
        "byScope": by_scope,
        "byKind": by_kind,
    }


# ==================== 清理(可选,测试/关闭钩子) ====================


def close() -> None:
    """关闭模块级单例后端(用于进程退出/测试重置)。"""
    global _backend
    with _lock:
        if _backend is not None:
            _backend.close()
            _backend = None


__all__ = [
    "DEFAULT_DB_PATH",
    "SCOPE_SESSION",
    "SCOPE_ALWAYS",
    "KIND_EXEC_PREFIX",
    "KIND_EXEC_ONCE",
    "KIND_MCP_TOOL",
    "KIND_NET",
    "set_db_path",
    "normalize_exec_key",
    "scoped_cache_key",
    "split_scoped_key",
    "key_is_owned_by",
    "grant",
    "check",
    "revoke",
    "list_keys",
    "list_grant_rows",
    "purge_expired",
    "stats",
    "close",
]

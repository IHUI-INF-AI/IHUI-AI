# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心 —— 持久化层。

两张表,职责不重叠:
  - ``keepalive_account_state``:每账号一行,**当前**状态(幂等 upsert)。回答
    "这个号现在什么情况、下次什么时候重试、告警喊过没有"。
  - ``keepalive_events``:追加流水。回答"过去发生过什么、成功率多少"。

为什么不用现成的 ``publish_accounts.last_verified_at`` 当唯一真相:那张表是发布线
私有的,签到账号根本不在里面;若为了统一状态去改发布线的表,两条线会互相绑死
(发布线一次 schema 变更就打断签到保活)。故单开一对面向上层的状态表,源表只读。

建表沿用仓库既有惯例(ai-service 侧无 migrations 目录):幂等
``CREATE TABLE IF NOT EXISTS`` 内聚在 ``ensure_tables()``,由 lifespan fail-open 调用。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from app.core.logging import get_logger
from app.services.keepalive.models import (
    KIND_UNSUPPORTED,
    ProbeOutcome,
    StateSnapshot,
    StateUpdate,
)

if TYPE_CHECKING:
    import asyncpg

logger = get_logger(__name__)

_CREATE_STATE_SQL = """
CREATE TABLE IF NOT EXISTS keepalive_account_state (
    account_ref          text PRIMARY KEY,
    source               text NOT NULL,
    account_id           bigint NOT NULL,
    owner_user_id        text NOT NULL,
    display_name         text NOT NULL DEFAULT '',
    platform             text NOT NULL DEFAULT '',
    consecutive_failures int NOT NULL DEFAULT 0,
    next_retry_at        timestamptz,
    last_ok_at           timestamptz,
    last_fail_at         timestamptz,
    last_error           text,
    last_error_kind      text,
    expires_at           timestamptz,
    warned_at            timestamptz,
    alerted_at           timestamptz,
    updated_at           timestamptz NOT NULL DEFAULT now()
)
"""

_CREATE_EVENTS_SQL = """
CREATE TABLE IF NOT EXISTS keepalive_events (
    id          bigserial PRIMARY KEY,
    account_ref text NOT NULL,
    source      text NOT NULL,
    owner_user_id text NOT NULL DEFAULT '',
    ok          boolean NOT NULL,
    kind        text NOT NULL,
    message     text,
    duration_ms int NOT NULL DEFAULT 0,
    attempt     int NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT now()
)
"""

_CREATE_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_keepalive_state_owner
    ON keepalive_account_state (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_keepalive_state_retry
    ON keepalive_account_state (next_retry_at)
    WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_keepalive_events_ref_created
    ON keepalive_events (account_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keepalive_events_created
    ON keepalive_events (created_at DESC);
"""

_UPSERT_STATE_SQL = """
INSERT INTO keepalive_account_state (
    account_ref, source, account_id, owner_user_id, display_name, platform,
    consecutive_failures, next_retry_at, last_ok_at, last_fail_at,
    last_error, last_error_kind, expires_at, warned_at, alerted_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now()
)
ON CONFLICT (account_ref) DO UPDATE SET
    source               = EXCLUDED.source,
    account_id           = EXCLUDED.account_id,
    owner_user_id        = EXCLUDED.owner_user_id,
    display_name         = EXCLUDED.display_name,
    platform             = EXCLUDED.platform,
    consecutive_failures = EXCLUDED.consecutive_failures,
    next_retry_at        = EXCLUDED.next_retry_at,
    last_ok_at           = EXCLUDED.last_ok_at,
    last_fail_at         = EXCLUDED.last_fail_at,
    last_error           = EXCLUDED.last_error,
    last_error_kind      = EXCLUDED.last_error_kind,
    expires_at           = EXCLUDED.expires_at,
    warned_at            = EXCLUDED.warned_at,
    alerted_at           = EXCLUDED.alerted_at,
    updated_at           = now()
"""

_INSERT_EVENT_SQL = """
INSERT INTO keepalive_events (
    account_ref, source, owner_user_id, ok, kind, message, duration_ms, attempt
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
"""


async def ensure_tables() -> None:
    """幂等建表。lifespan 里 fail-open 调用(失败只告警,不拦启动)。"""
    from app.core.db_pool import get_shared_pool

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await ensure_tables_conn(conn)


async def ensure_tables_conn(conn: asyncpg.Connection) -> None:
    """建表本体。CI 用裸连接也能复用(与 checkin_store 同一配方)。"""
    await conn.execute(_CREATE_STATE_SQL)
    await conn.execute(_CREATE_EVENTS_SQL)
    await conn.execute(_CREATE_INDEXES_SQL)


def row_to_snapshot(row: Any) -> StateSnapshot:
    """DB 行 → 纯快照。缺的列一律当 0/None,不抛(老库没有新列也要能跑)。"""
    if row is None:
        return StateSnapshot()
    try:
        last_error_kind = row["last_error_kind"]
    except (KeyError, IndexError):
        last_error_kind = None
    return StateSnapshot(
        consecutive_failures=int(row["consecutive_failures"] or 0),
        last_ok_at=row["last_ok_at"],
        last_fail_at=row["last_fail_at"],
        expires_at=row["expires_at"],
        warned_at=row["warned_at"],
        alerted_at=row["alerted_at"],
        next_retry_at=row["next_retry_at"],
        last_error_kind=last_error_kind,
    )


async def fetch_states(refs: list[str]) -> dict[str, StateSnapshot]:
    """批量取状态(一轮保活一次查询,不是每账号一次)。"""
    if not refs:
        return {}
    from app.core.db_pool import get_shared_pool

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM keepalive_account_state WHERE account_ref = ANY($1::text[])",
            refs,
        )
    return {r["account_ref"]: row_to_snapshot(r) for r in rows}


async def upsert_state(
    *,
    ref: str,
    source: str,
    account_id: int,
    owner: str,
    display: str,
    platform: str,
    update: StateUpdate,
) -> None:
    from app.core.db_pool import get_shared_pool

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            _UPSERT_STATE_SQL,
            ref,
            source,
            account_id,
            owner,
            display or "",
            platform or "",
            update.consecutive_failures,
            update.next_retry_at,
            update.last_ok_at,
            update.last_fail_at,
            update.last_error,
            update.last_error_kind,
            update.expires_at,
            update.warned_at,
            update.alerted_at,
        )


async def record_event(
    *, ref: str, source: str, owner: str, outcome: ProbeOutcome, attempt: int = 1
) -> None:
    from app.core.db_pool import get_shared_pool

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            _INSERT_EVENT_SQL,
            ref,
            source,
            owner or "",
            outcome.ok,
            outcome.kind,
            (outcome.message or "")[:1000],
            int(outcome.duration_ms or 0),
            int(attempt),
        )


async def list_state_rows(owner: str | None = None) -> list[Any]:
    from app.core.db_pool import get_shared_pool

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        if owner:
            return list(
                await conn.fetch(
                    "SELECT * FROM keepalive_account_state"
                    " WHERE owner_user_id = $1 ORDER BY updated_at DESC",
                    owner,
                )
            )
        return list(
            await conn.fetch(
                "SELECT * FROM keepalive_account_state ORDER BY updated_at DESC"
            )
        )


async def list_events(
    *,
    owner: str | None = None,
    ref: str | None = None,
    limit: int = 50,
    only_failures: bool = False,
) -> list[Any]:
    from app.core.db_pool import get_shared_pool

    clauses: list[str] = []
    args: list[Any] = []
    if owner:
        args.append(owner)
        clauses.append(f"owner_user_id = ${len(args)}")
    if ref:
        args.append(ref)
        clauses.append(f"account_ref = ${len(args)}")
    if only_failures:
        clauses.append("ok = false AND kind <> 'unsupported'")
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    args.append(max(1, min(int(limit), 500)))
    sql = (
        "SELECT * FROM keepalive_events"
        f"{where} ORDER BY created_at DESC LIMIT ${len(args)}"
    )
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        return list(await conn.fetch(sql, *args))


async def stats_since(
    *, owner: str | None = None, days: int = 7
) -> dict[str, dict[str, int]]:
    """按来源统计近 N 天成败(成功率趋势的最简实现,不引入时序库)。"""
    since = datetime.now(UTC) - timedelta(days=max(1, days))
    from app.core.db_pool import get_shared_pool

    args: list[Any] = [since]
    owner_clause = ""
    if owner:
        args.append(owner)
        owner_clause = f" AND owner_user_id = ${len(args)}"
    sql = (
        "SELECT source,"
        " count(*) FILTER (WHERE ok) AS ok,"
        " count(*) FILTER (WHERE NOT ok AND kind <> $"
        f"{len(args) + 1}) AS failed"
        " FROM keepalive_events WHERE created_at >= $1"
        f"{owner_clause} GROUP BY source"
    )
    args.append(KIND_UNSUPPORTED)
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return {
        r["source"]: {"ok": int(r["ok"] or 0), "failed": int(r["failed"] or 0)} for r in rows
    }


async def prune_events(*, retention_days: int = 90) -> int:
    """老化流水,返回删除行数。状态表不清 —— 它是"当前真相",不是历史。"""
    from app.core.db_pool import get_shared_pool

    cutoff = datetime.now(UTC) - timedelta(days=max(1, retention_days))
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        status = await conn.execute(
            "DELETE FROM keepalive_events WHERE created_at < $1", cutoff
        )
    # asyncpg 的 execute 返回 "DELETE <n>"
    try:
        return int(str(status).split()[-1])
    except (ValueError, IndexError):
        return 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

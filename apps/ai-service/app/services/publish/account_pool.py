# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布账号池(2026-11-25 立)。

为什么要有这一层
----------------
`publish_accounts` 从 2026-07 起就是"一个平台一串账号",但所有取号路径都只认
`account_id` 直传;调度器、扫码登录、保活各写各的。直接后果有三个:

1. **没有池**:同一平台多个号无法轮换,一个号掉线整条发布链就断。
2. **没有统一状态**:`last_verified_at`(账号表)与 `keepalive_account_state`
   (保活表)各记各的,"这个号现在到底能不能发"没有单一答案。
3. **扫码登录不认账号**:`scan_login._save_account_to_db` 永远写"该平台第一条",
   多号场景下重扫会把别的号覆盖掉。

本模块只做三件事,边界写死:

- **池**:`publish_pools` + `publish_pool_members` 负责"有哪些号、按什么顺序用"。
- **取号**:`select_account` 是发布链唯一的取号口;健康、配额、轮换都在这里裁决。
- **状态投影**:读 `publish_session_state`(由 session_keeper 维护),不在本模块
  重复探活,也不改写账号凭据。

不负责:探活(归 session_keeper)、扫码(归 scan_login)、发布(归 scheduler)。
"""

from __future__ import annotations

import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Iterable

import asyncpg
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import get_db_conn

router = APIRouter(prefix="/publish/pools", tags=["publish-account-pools"])

# 健康优先级:同样优先级下,先用确定活着的,再用没验过的,最后才碰降级的。
_HEALTH_RANK = {"healthy": 0, "unknown": 1, "degraded": 2, "expiring": 2, "reauth_required": 3, "disabled": 4}


def _pool_sort_key(row: Any, strategy: str) -> tuple[Any, ...]:
    """池内取号排序键(纯函数,便于单测)。

    共同第一段永远是"会话更健康优先":再用优先级策略也必须先活着。
      - priority:    健康 → priority 数值大者优先 → 最久未用
      - least_recent:健康 → 最久未用(默认;priority 只作同刻打平)
      - round_robin: 健康 → 最久未用(与 least_recent 同构,靠 last_used_at 轮换)
    """
    last_used = row["last_used_at"] or datetime(1970, 1, 1, tzinfo=timezone.utc)
    health = _HEALTH_RANK.get(row["session_status"], 1)
    if strategy == "priority":
        return (health, -int(row["priority"] or 100), last_used)
    return (health, last_used)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _get_user_id(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="未登录")
    return str(uid)


def _ok(data: Any, message: str = "ok") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else None


def pool_id() -> str:
    return f"pool_{uuid.uuid4().hex[:16]}"


# =============================================================================
# DDL(幂等,启动/首次访问都能建)
# =============================================================================
async def ensure_tables(conn: asyncpg.Connection | None = None) -> None:
    owns = conn is None
    if owns:
        conn = await get_db_conn()
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_pools (
                pool_id VARCHAR(40) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                platform VARCHAR(32) NOT NULL,
                name VARCHAR(128) NOT NULL DEFAULT '默认账号池',
                strategy VARCHAR(16) NOT NULL DEFAULT 'least_recent',
                min_healthy INTEGER NOT NULL DEFAULT 1,
                max_daily_posts INTEGER NOT NULL DEFAULT 0,
                probe_interval_minutes INTEGER NOT NULL DEFAULT 45,
                auto_reauth BOOLEAN NOT NULL DEFAULT TRUE,
                status VARCHAR(16) NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, platform, name)
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_pools_user_platform ON publish_pools(user_id, platform)"
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_pool_members (
                pool_id VARCHAR(40) NOT NULL REFERENCES publish_pools(pool_id) ON DELETE CASCADE,
                account_id BIGINT NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                priority INTEGER NOT NULL DEFAULT 100,
                weight INTEGER NOT NULL DEFAULT 1,
                daily_quota INTEGER NOT NULL DEFAULT 0,
                last_used_at TIMESTAMPTZ,
                joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (pool_id, account_id)
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_pool_members_account ON publish_pool_members(account_id)"
        )
    finally:
        if owns:
            await conn.close()


# =============================================================================
# 序列化
# =============================================================================
def _serialize_pool(
    row: asyncpg.Record, *, total: int, healthy: int, reauth: int, degraded: int = 0
) -> dict[str, Any]:
    if total == 0:
        status = "empty"
    elif healthy >= int(row["min_healthy"] or 1):
        status = "healthy"
    elif reauth > 0 or degraded > 0:
        status = "degraded"
    else:
        # 号在池里,但还没体检过 —— 不冤枉成"掉线",也不假装健康。
        status = "pending"
    return {
        "poolId": row["pool_id"],
        "platform": row["platform"],
        "name": row["name"],
        "strategy": row["strategy"],
        "minHealthy": row["min_healthy"],
        "maxDailyPosts": row["max_daily_posts"],
        "probeIntervalMinutes": row["probe_interval_minutes"],
        "autoReauth": bool(row["auto_reauth"]),
        "status": status,
        "total": total,
        "healthy": healthy,
        "reauthRequired": reauth,
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }


def _serialize_member(row: asyncpg.Record) -> dict[str, Any]:
    state = (row["session_status"] or "unknown") if "session_status" in row.keys() else "unknown"
    return {
        "accountId": int(row["account_id"]),
        "platform": row["platform"],
        "displayName": row["display_name"] or f"{row['platform']}#{row['account_id']}",
        "accountStatus": row["account_status"] or "active",
        "priority": row["priority"],
        "weight": row["weight"],
        "dailyQuota": row["daily_quota"],
        "lastUsedAt": _iso(row["last_used_at"]),
        "joinedAt": _iso(row["joined_at"]),
        "session": {
            "status": state,
            "lastProbeAt": _iso(row["last_probe_at"]),
            "lastOkAt": _iso(row["last_ok_at"]),
            "nextProbeAt": _iso(row["next_probe_at"]),
            "consecutiveFailures": int(row["consecutive_failures"] or 0),
            "lastError": row["last_error"],
            "lastErrorKind": row["last_error_kind"],
            "reauthTaskId": row["reauth_task_id"],
        },
    }


# =============================================================================
# 池 CRUD
# =============================================================================
async def _pool_counts(conn: asyncpg.Connection, user_id: str, platform: str) -> tuple[int, int, int, int]:
    rows = await conn.fetch(
        """
        SELECT COALESCE(s.status, 'unknown') AS st, count(*) AS n
        FROM publish_pool_members m
        JOIN publish_accounts a ON a.id = m.account_id
        LEFT JOIN publish_session_state s ON s.account_id = m.account_id
        WHERE m.user_id = $1 AND a.platform = $2 AND a.status = 'active'
        GROUP BY 1
        """,
        user_id,
        platform,
    )
    total = sum(int(r["n"]) for r in rows)
    healthy = sum(int(r["n"]) for r in rows if r["st"] == "healthy")
    reauth = sum(int(r["n"]) for r in rows if r["st"] == "reauth_required")
    degraded = sum(int(r["n"]) for r in rows if r["st"] in ("degraded", "expiring"))
    return total, healthy, reauth, degraded


async def list_pools(conn: asyncpg.Connection, user_id: str) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        "SELECT * FROM publish_pools WHERE user_id = $1 ORDER BY platform, created_at",
        user_id,
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        total, healthy, reauth, degraded = await _pool_counts(conn, user_id, row["platform"])
        out.append(_serialize_pool(row, total=total, healthy=healthy, reauth=reauth, degraded=degraded))
    return out


async def create_pool(
    conn: asyncpg.Connection,
    user_id: str,
    *,
    platform: str,
    name: str = "默认账号池",
    strategy: str = "least_recent",
    min_healthy: int = 1,
    max_daily_posts: int = 0,
    probe_interval_minutes: int = 45,
    auto_reauth: bool = True,
    account_ids: Iterable[int] | None = None,
) -> dict[str, Any]:
    pid = pool_id()
    row = await conn.fetchrow(
        """
        INSERT INTO publish_pools
            (pool_id, user_id, platform, name, strategy, min_healthy, max_daily_posts,
             probe_interval_minutes, auto_reauth)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        """,
        pid, user_id, platform, name, strategy, max(1, min_healthy), max(0, max_daily_posts),
        max(5, probe_interval_minutes), bool(auto_reauth),
    )
    if account_ids:
        await add_members(conn, user_id, pid, platform, list(account_ids))
    total, healthy, reauth, degraded = await _pool_counts(conn, user_id, platform)
    return _serialize_pool(row, total=total, healthy=healthy, reauth=reauth, degraded=degraded)


async def bootstrap_pools(conn: asyncpg.Connection, user_id: str) -> list[dict[str, Any]]:
    """按平台自动建池:每个有 active 账号、但还没有池的平台建一个,账号全收进去。

    幂等:已有同名池(默认账号池)不重复建;新账号漏在池外的,补进默认池。
    """
    platforms = await conn.fetch(
        """
        SELECT DISTINCT platform FROM publish_accounts
        WHERE user_id = $1 AND status = 'active'
        ORDER BY platform
        """,
        user_id,
    )
    for p in platforms:
        platform = p["platform"]
        existing = await conn.fetchrow(
            "SELECT pool_id FROM publish_pools WHERE user_id=$1 AND platform=$2 ORDER BY created_at LIMIT 1",
            user_id, platform,
        )
        if existing:
            pid = existing["pool_id"]
            missing = await conn.fetch(
                """
                SELECT a.id FROM publish_accounts a
                LEFT JOIN publish_pool_members m ON m.account_id = a.id AND m.pool_id = $3
                WHERE a.user_id=$1 AND a.platform=$2 AND a.status='active' AND m.account_id IS NULL
                """,
                user_id, platform, pid,
            )
            if missing:
                await add_members(conn, user_id, pid, platform, [int(r["id"]) for r in missing])
        else:
            accounts = await conn.fetch(
                "SELECT id FROM publish_accounts WHERE user_id=$1 AND platform=$2 AND status='active' ORDER BY id",
                user_id, platform,
            )
            await create_pool(
                conn, user_id, platform=platform,
                account_ids=[int(r["id"]) for r in accounts],
            )
    # 建完池立刻补会话状态行:页面第一次打开就能看到"待体检",不用等守护线程。
    try:
        from app.services.publish import session_keeper
        await session_keeper.ensure_states(conn)
    except Exception:
        pass
    return await list_pools(conn, user_id)


async def bootstrap_all_users(conn: asyncpg.Connection) -> int:
    """给所有还有 active 账号的用户补池。

    keeper 启动 / 周期 reconcile 时调用,保证"新用户、新账号"不需要人工点
    bootstrap 也能进账号池。幂等,已建池的用户只会补漏掉的成员。
    """
    users = await conn.fetch(
        "SELECT DISTINCT user_id FROM publish_accounts WHERE status='active'"
    )
    for r in users:
        await bootstrap_pools(conn, str(r["user_id"]))
    return len(users)


async def update_pool(conn: asyncpg.Connection, user_id: str, pid: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        "SELECT * FROM publish_pools WHERE pool_id=$1 AND user_id=$2", pid, user_id
    )
    if not row:
        return None
    allowed = {
        "name": "name", "strategy": "strategy", "min_healthy": "min_healthy",
        "max_daily_posts": "max_daily_posts", "probe_interval_minutes": "probe_interval_minutes",
        "auto_reauth": "auto_reauth", "status": "status",
    }
    sets: list[str] = []
    args: list[Any] = [pid]
    for key, value in patch.items():
        col = allowed.get(key)
        if not col or value is None:
            continue
        args.append(value)
        sets.append(f"{col} = ${len(args)}")
    if not sets:
        return _serialize_pool(row, total=0, healthy=0, reauth=0)
    args.append(_utc_now())
    await conn.execute(
        f"UPDATE publish_pools SET {', '.join(sets)}, updated_at = ${len(args)} WHERE pool_id = $1",
        *args,
    )
    new = await conn.fetchrow("SELECT * FROM publish_pools WHERE pool_id=$1", pid)
    total, healthy, reauth, degraded = await _pool_counts(conn, user_id, new["platform"])
    return _serialize_pool(new, total=total, healthy=healthy, reauth=reauth, degraded=degraded)


async def delete_pool(conn: asyncpg.Connection, user_id: str, pid: str) -> bool:
    result = await conn.execute(
        "DELETE FROM publish_pools WHERE pool_id=$1 AND user_id=$2", pid, user_id
    )
    return result.endswith("1")


# =============================================================================
# 成员
# =============================================================================
async def add_members(
    conn: asyncpg.Connection,
    user_id: str,
    pid: str,
    platform: str,
    account_ids: list[int],
    *,
    priority: int = 100,
) -> int:
    valid = await conn.fetch(
        """
        SELECT id FROM publish_accounts
        WHERE user_id=$1 AND platform=$2 AND id = ANY($3::bigint[]) AND status='active'
        """,
        user_id, platform, account_ids,
    )
    ids = [int(r["id"]) for r in valid]
    if not ids:
        return 0
    await conn.executemany(
        """
        INSERT INTO publish_pool_members (pool_id, account_id, user_id, priority)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (pool_id, account_id) DO NOTHING
        """,
        [(pid, aid, user_id, priority) for aid in ids],
    )
    return len(ids)


async def remove_member(conn: asyncpg.Connection, user_id: str, pid: str, account_id: int) -> bool:
    result = await conn.execute(
        "DELETE FROM publish_pool_members WHERE pool_id=$1 AND user_id=$2 AND account_id=$3",
        pid, user_id, account_id,
    )
    return result.endswith("1")


async def pool_detail(conn: asyncpg.Connection, user_id: str, pid: str) -> dict[str, Any] | None:
    pool = await conn.fetchrow("SELECT * FROM publish_pools WHERE pool_id=$1 AND user_id=$2", pid, user_id)
    if not pool:
        return None
    rows = await conn.fetch(
        """
        SELECT m.account_id, m.priority, m.weight, m.daily_quota, m.last_used_at, m.joined_at,
               a.platform, a.display_name, a.status AS account_status,
               s.status AS session_status, s.last_probe_at, s.last_ok_at, s.next_probe_at,
               s.consecutive_failures, s.last_error, s.last_error_kind, s.reauth_task_id
        FROM publish_pool_members m
        JOIN publish_accounts a ON a.id = m.account_id
        LEFT JOIN publish_session_state s ON s.account_id = m.account_id
        WHERE m.pool_id=$1 AND m.user_id=$2
        ORDER BY m.priority DESC, m.account_id
        """,
        pid, user_id,
    )
    total = sum(1 for r in rows if r["account_status"] == "active")
    healthy = sum(1 for r in rows if r["session_status"] == "healthy")
    reauth = sum(1 for r in rows if r["session_status"] == "reauth_required")
    data = _serialize_pool(pool, total=total, healthy=healthy, reauth=reauth)
    data["members"] = [_serialize_member(r) for r in rows]
    return data


# =============================================================================
# 取号(发布链唯一入口)
# =============================================================================
async def select_account(
    conn: asyncpg.Connection,
    user_id: str,
    platform: str,
    *,
    pool_id: str | None = None,
    exclude_account_ids: Iterable[int] | None = None,
) -> dict[str, Any] | None:
    """按池策略取一个能发的号。

    排序不是"随机",而是可解释的三段:
      1. 池内优先级高 → 2. 会话更健康 → 3. 最久没用过(轮换)。
    明确排除:`disabled` 账号、`reauth_required` 会话、调用方点名排除的号。
    """
    exclude = list(exclude_account_ids or [])
    target_pool = pool_id
    if not target_pool:
        row = await conn.fetchrow(
            """
            SELECT pool_id FROM publish_pools
            WHERE user_id=$1 AND platform=$2 AND status='active'
            ORDER BY created_at LIMIT 1
            """,
            user_id, platform,
        )
        target_pool = row["pool_id"] if row else None

    if target_pool:
        rows = await conn.fetch(
            """
            SELECT m.account_id, m.priority, m.weight, m.last_used_at,
                   a.display_name, a.status AS account_status,
                   COALESCE(s.status,'unknown') AS session_status,
                   s.consecutive_failures
            FROM publish_pool_members m
            JOIN publish_accounts a ON a.id = m.account_id
            LEFT JOIN publish_session_state s ON s.account_id = m.account_id
            WHERE m.pool_id=$1 AND m.user_id=$2 AND a.platform=$3 AND a.status='active'
              AND ($4::bigint[] = '{}'::bigint[] OR NOT (m.account_id = ANY($4::bigint[])))
            """,
            target_pool, user_id, platform, exclude,
        )
        strategy_row = await conn.fetchrow(
            "SELECT strategy FROM publish_pools WHERE pool_id=$1", target_pool
        )
        strategy = (strategy_row["strategy"] if strategy_row else None) or "least_recent"
    else:
        # 没建池时退回账号表:保证老用户不做任何迁移也能继续发布。
        rows = await conn.fetch(
            """
            SELECT a.id AS account_id, 100 AS priority, 1 AS weight, NULL::timestamptz AS last_used_at,
                   a.display_name, a.status AS account_status,
                   COALESCE(s.status,'unknown') AS session_status,
                   s.consecutive_failures
            FROM publish_accounts a
            LEFT JOIN publish_session_state s ON s.account_id = a.id
            WHERE a.user_id=$1 AND a.platform=$2 AND a.status='active'
              AND ($3::bigint[] = '{}'::bigint[] OR NOT (a.id = ANY($3::bigint[])))
            """,
            user_id, platform, exclude,
        )
        strategy = "least_recent"

    usable = [r for r in rows if r["session_status"] != "reauth_required"]
    if not usable:
        return None

    chosen = sorted(usable, key=lambda r: _pool_sort_key(r, strategy))[0]
    if target_pool:
        await conn.execute(
            "UPDATE publish_pool_members SET last_used_at=NOW() WHERE pool_id=$1 AND account_id=$2",
            target_pool, chosen["account_id"],
        )
    return {
        "account_id": int(chosen["account_id"]),
        "platform": platform,
        "display_name": chosen["display_name"],
        "session_status": chosen["session_status"],
        "pool_id": target_pool,
    }


async def resolve_targets(
    conn: asyncpg.Connection,
    user_id: str,
    targets: list[Any],
) -> list[Any]:
    """把"平台 + 池"目标解析成具体 account_id;解析不了就 409。

    targets 是 PublishTarget 实例(可变),原地补 account_id 后返回。
    显式传了 account_id 的不动 —— 调用方已经指定了号,池只负责"没指定时"。
    """
    for target in targets:
        if getattr(target, "account_id", None):
            continue
        platform = target.platform
        pool = getattr(target, "pool_id", None)
        chosen = await select_account(conn, user_id, platform, pool_id=pool)
        if not chosen:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "publish_pool_no_healthy_account",
                    "message": f"{platform} 账号池没有可用账号(全部需重新登录或在冷却中)",
                    "platform": platform,
                    "pool_id": pool,
                },
            )
        target.account_id = chosen["account_id"]
        if hasattr(target, "pool_id"):
            target.pool_id = chosen["pool_id"]
    return targets


# =============================================================================
# HTTP:池管理
# =============================================================================
class PoolCreate(BaseModel):
    platform: str = Field(..., max_length=32)
    name: str = Field(default="默认账号池", max_length=128)
    strategy: str = Field(default="least_recent", pattern=r"^(least_recent|priority|round_robin)$")
    min_healthy: int = Field(default=1, ge=1, le=100)
    max_daily_posts: int = Field(default=0, ge=0, le=1000)
    probe_interval_minutes: int = Field(default=45, ge=5, le=1440)
    auto_reauth: bool = True
    account_ids: list[int] = Field(default_factory=list)


class PoolUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    strategy: str | None = Field(default=None, pattern=r"^(least_recent|priority|round_robin)$")
    min_healthy: int | None = Field(default=None, ge=1, le=100)
    max_daily_posts: int | None = Field(default=None, ge=0, le=1000)
    probe_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    auto_reauth: bool | None = None
    status: str | None = Field(default=None, pattern=r"^(active|paused)$")


class MembersAdd(BaseModel):
    account_ids: list[int] = Field(..., min_length=1)
    priority: int = Field(default=100, ge=0, le=1000)


class ProbeRequest(BaseModel):
    account_ids: list[int] | None = None
    force: bool = True


@router.get("")
async def api_list_pools(request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        return _ok({"items": await list_pools(conn, user_id)})
    finally:
        await conn.close()


@router.post("/bootstrap")
async def api_bootstrap(request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        return _ok({"items": await bootstrap_pools(conn, user_id)})
    finally:
        await conn.close()


@router.post("")
async def api_create(request: Request, body: PoolCreate) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        exists = await conn.fetchrow(
            "SELECT pool_id FROM publish_pools WHERE user_id=$1 AND platform=$2 AND name=$3",
            user_id, body.platform, body.name,
        )
        if exists:
            raise HTTPException(status_code=409, detail="同名账号池已存在")
        data = await create_pool(
            conn, user_id, platform=body.platform, name=body.name, strategy=body.strategy,
            min_healthy=body.min_healthy, max_daily_posts=body.max_daily_posts,
            probe_interval_minutes=body.probe_interval_minutes, auto_reauth=body.auto_reauth,
            account_ids=body.account_ids,
        )
        return _ok(data)
    finally:
        await conn.close()


@router.get("/{pid}")
async def api_detail(request: Request, pid: str) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        data = await pool_detail(conn, user_id, pid)
        if not data:
            raise HTTPException(status_code=404, detail="账号池不存在")
        return _ok(data)
    finally:
        await conn.close()


@router.patch("/{pid}")
async def api_update(request: Request, pid: str, body: PoolUpdate) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        data = await update_pool(conn, user_id, pid, body.model_dump(exclude_none=True))
        if not data:
            raise HTTPException(status_code=404, detail="账号池不存在")
        return _ok(data)
    finally:
        await conn.close()


@router.delete("/{pid}")
async def api_delete(request: Request, pid: str) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        if not await delete_pool(conn, user_id, pid):
            raise HTTPException(status_code=404, detail="账号池不存在")
        return _ok({"deleted": True})
    finally:
        await conn.close()


@router.post("/{pid}/members")
async def api_add_members(request: Request, pid: str, body: MembersAdd) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        pool = await conn.fetchrow("SELECT platform FROM publish_pools WHERE pool_id=$1 AND user_id=$2", pid, user_id)
        if not pool:
            raise HTTPException(status_code=404, detail="账号池不存在")
        added = await add_members(conn, user_id, pid, pool["platform"], body.account_ids, priority=body.priority)
        return _ok({"added": added})
    finally:
        await conn.close()


@router.delete("/{pid}/members/{account_id}")
async def api_remove_member(request: Request, pid: str, account_id: int) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        if not await remove_member(conn, user_id, pid, account_id):
            raise HTTPException(status_code=404, detail="成员不存在")
        return _ok({"removed": True})
    finally:
        await conn.close()


@router.post("/{pid}/probe")
async def api_probe_pool(request: Request, pid: str, body: ProbeRequest) -> dict[str, Any]:
    """立即体检:同步等待结果,前端一次拿到"谁活谁死"。

    单账号最长 90s;池内账号并发由 session_keeper 控制,这里按串行/并发折中,
    避免一个 20 号池把 HTTP 请求挂到 30 分钟。
    """
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        pool = await conn.fetchrow(
            "SELECT platform FROM publish_pools WHERE pool_id=$1 AND user_id=$2", pid, user_id
        )
        if not pool:
            raise HTTPException(status_code=404, detail="账号池不存在")
        rows = await conn.fetch(
            "SELECT account_id FROM publish_pool_members WHERE pool_id=$1 AND user_id=$2",
            pid, user_id,
        )
        ids = body.account_ids or [int(r["account_id"]) for r in rows]
    finally:
        await conn.close()

    from app.services.publish import session_keeper

    results = await session_keeper.probe_many(ids, force=body.force, concurrency=2)
    return _ok({"items": results})


@router.get("/{pid}/events")
async def api_pool_events(request: Request, pid: str, limit: int = 50) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        pool = await conn.fetchrow("SELECT platform FROM publish_pools WHERE pool_id=$1 AND user_id=$2", pid, user_id)
        if not pool:
            raise HTTPException(status_code=404, detail="账号池不存在")
        rows = await conn.fetch(
            """
            SELECT e.account_id, e.ok, e.kind, e.message, e.created_at,
                   a.display_name
            FROM publish_session_events e
            JOIN publish_pool_members m ON m.account_id = e.account_id AND m.pool_id = $3
            LEFT JOIN publish_accounts a ON a.id = e.account_id
            WHERE e.user_id = $1 AND e.platform = $2
            ORDER BY e.created_at DESC LIMIT $4
            """,
            user_id, pool["platform"], pid, min(max(limit, 1), 200),
        )
        return _ok({"items": [
            {
                "accountId": int(r["account_id"]),
                "displayName": r["display_name"],
                "ok": bool(r["ok"]),
                "kind": r["kind"],
                "message": r["message"],
                "createdAt": _iso(r["created_at"]),
            } for r in rows
        ]})
    finally:
        await conn.close()


# =============================================================================
# HTTP:单账号(体检 / 重登 / 会话轨迹)
# =============================================================================
async def _owned_account(conn: asyncpg.Connection, user_id: str, account_id: int) -> asyncpg.Record:
    row = await conn.fetchrow(
        "SELECT id, platform, display_name FROM publish_accounts WHERE id=$1 AND user_id=$2",
        account_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    return row


@router.get("/accounts/{account_id}/session")
async def api_session(request: Request, account_id: int, limit: int = 30) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        from app.services.publish import session_keeper
        await session_keeper.ensure_tables(conn)
        account = await _owned_account(conn, user_id, account_id)
        state = await conn.fetchrow(
            "SELECT * FROM publish_session_state WHERE account_id=$1", account_id
        )
        events = await conn.fetch(
            "SELECT ok, kind, message, created_at FROM publish_session_events "
            "WHERE account_id=$1 ORDER BY created_at DESC LIMIT $2",
            account_id, min(max(limit, 1), 200),
        )
        return _ok({
            "accountId": account_id,
            "platform": account["platform"],
            "displayName": account["display_name"],
            "state": None if not state else {
                "status": state["status"],
                "lastProbeAt": _iso(state["last_probe_at"]),
                "lastOkAt": _iso(state["last_ok_at"]),
                "nextProbeAt": _iso(state["next_probe_at"]),
                "consecutiveFailures": int(state["consecutive_failures"] or 0),
                "lastError": state["last_error"],
                "lastErrorKind": state["last_error_kind"],
                "reauthTaskId": state["reauth_task_id"],
                "probeIntervalMinutes": int(state["probe_interval_minutes"] or 60),
            },
            "events": [{
                "ok": bool(r["ok"]), "kind": r["kind"], "message": r["message"],
                "createdAt": _iso(r["created_at"]),
            } for r in events],
        })
    finally:
        await conn.close()


@router.post("/accounts/{account_id}/probe")
async def api_probe_account(request: Request, account_id: int) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        await _owned_account(conn, user_id, account_id)
    finally:
        await conn.close()
    from app.services.publish import session_keeper
    result = await session_keeper.probe_account(account_id, force=True)
    return _ok(asdict(result))


@router.post("/accounts/{account_id}/reauth")
async def api_reauth(request: Request, account_id: int) -> dict[str, Any]:
    """定点重登:只给这个账号出码,成功后只回写这一行并自动回池。"""
    user_id = _get_user_id(request)
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        account = await _owned_account(conn, user_id, account_id)
    finally:
        await conn.close()

    from app.services.scan_login import start_scan_task
    from app.services.publish import session_keeper

    task = start_scan_task(
        user_id=user_id, platform=account["platform"], reuse_session=False, account_id=account_id
    )
    await session_keeper.mark_reauth_started(account_id, task.task_id)
    return _ok({
        "taskId": task.task_id,
        "platform": task.platform,
        "accountId": account_id,
        "status": task.status,
        "snapshot": task.snapshot(),
    })


@router.get("/keeper/status")
async def api_status(request: Request) -> dict[str, Any]:
    _get_user_id(request)
    from app.services.publish import session_keeper
    return _ok(session_keeper.snapshot())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

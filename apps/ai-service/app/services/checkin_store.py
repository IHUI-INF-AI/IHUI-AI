# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手数据层(Phase1b,2026-10-03 立)。

为 checkin_engine(签到引擎)提供服务端持久化:
- checkin_accounts   账号表(jwt 经 Fernet 加密落库,任何接口都不回吐明文)
- checkin_records    签到记录(引擎结构化 dict 的落库投影)
- checkin_error_counts 冷却计数(Server / Client 两类独立累积,与桌面端语义一致)

设计:
- 复用共享 asyncpg 连接池(app.core.db_pool.get_shared_pool),不自建池
- 建表幂等(CREATE TABLE IF NOT EXISTS),仓库 ai-service 侧无 migrations 目录,
  故建表内聚在 ensure_tables(),由 lifespan / scheduler.start() 调用(fail-open)
- Fernet 密钥:环境变量 CHECKIN_FERNET_KEY(base64,32 字节)优先;
  未设置则落盘 data/checkin_fernet_key(首次生成,重启后可解密历史密文),
  与 publish/credentials_crypto.py 的密钥管理策略对齐
"""

from __future__ import annotations

import base64
import json
import os
import secrets
from datetime import UTC, datetime
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.db_pool import get_shared_pool
from app.core.logging import get_logger

logger = get_logger(__name__)

_KEY_ENV = "CHECKIN_FERNET_KEY"
_KEY_FILE = os.path.join("data", "checkin_fernet_key")

# ---------------------------------------------------------------------------
# 建表 SQL(幂等)
# ---------------------------------------------------------------------------

_CREATE_ACCOUNTS_SQL = """
CREATE TABLE IF NOT EXISTS checkin_accounts (
    id            bigserial PRIMARY KEY,
    owner_user_id text NOT NULL,
    name          text NOT NULL,
    jwt_enc       bytea NOT NULL,
    device_map    jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled       boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_user_id, name)
)
"""

_CREATE_RECORDS_SQL = """
CREATE TABLE IF NOT EXISTS checkin_records (
    id               bigserial PRIMARY KEY,
    account_id       bigint NOT NULL REFERENCES checkin_accounts(id) ON DELETE CASCADE,
    ok               boolean,
    action           text,
    http_status      int,
    code             text,
    message          text,
    classified_error text,
    cooldown_until   timestamptz,
    credits          int,
    credits_delta    int,
    created_at       timestamptz NOT NULL DEFAULT now()
)
"""

_CREATE_ERROR_COUNTS_SQL = """
CREATE TABLE IF NOT EXISTS checkin_error_counts (
    account_id    bigint PRIMARY KEY REFERENCES checkin_accounts(id) ON DELETE CASCADE,
    server_errors int NOT NULL DEFAULT 0,
    client_errors int NOT NULL DEFAULT 0
)
"""

_CREATE_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_checkin_records_account_created
    ON checkin_records (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_records_cooldown
    ON checkin_records (cooldown_until)
    WHERE cooldown_until IS NOT NULL;
"""

_ensure_failed = False


async def ensure_tables_conn(conn) -> None:
    """在给定连接上幂等建表(三张表 + 查询索引)。

    与 ensure_tables 的区别:不经过共享连接池。CI 的 ensure 步骤在同一进程里
    连续多次 asyncio.run(前者各自持有已关闭 loop 的残留池),共享池的跨 loop
    回收路径在 CI 环境下出现过"步骤退出 0 但表未落库"的静默失配(2026-10-03
    实测,run 37090730137);裸连接路径无此耦合,并允许调用方自验。
    """
    global _ensure_failed
    await conn.execute(_CREATE_ACCOUNTS_SQL)
    await conn.execute(_CREATE_RECORDS_SQL)
    await conn.execute(_CREATE_ERROR_COUNTS_SQL)
    await conn.execute(_CREATE_INDEXES_SQL)
    _ensure_failed = False


async def ensure_tables() -> None:
    """幂等建表(三张表 + 查询索引)。失败抛出,由调用方决定 fail-open/fail-closed。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await ensure_tables_conn(conn)


# ---------------------------------------------------------------------------
# Fernet 加解密
# ---------------------------------------------------------------------------

_fernet: Fernet | None = None


def _load_fernet() -> Fernet:
    """加载 Fernet 密钥(env 优先,否则 data/checkin_fernet_key 首次生成并持久化)。"""
    global _fernet
    if _fernet is not None:
        return _fernet

    env_val = os.environ.get(_KEY_ENV, "").strip()
    if env_val:
        try:
            _fernet = Fernet(env_val.encode("ascii"))
            return _fernet
        except Exception as e:
            logger.warning("[checkin_store] 无效的 %s: %s,回退密钥文件", _KEY_ENV, e)

    try:
        with open(_KEY_FILE, "rb") as f:
            key = f.read().strip()
        if key:
            _fernet = Fernet(key)
            return _fernet
    except FileNotFoundError:
        pass
    except Exception as e:
        logger.warning("[checkin_store] 密钥文件不可读: %s,重新生成", e)

    key = Fernet.generate_key()
    try:
        os.makedirs(os.path.dirname(_KEY_FILE), exist_ok=True)
        with open(_KEY_FILE, "wb") as f:
            f.write(key)
        logger.warning(
            "[checkin_store] %s 未设置,已生成持久化密钥 %s;生产环境请显式设置 "
            "(base64 编码的 Fernet key),否则跨进程需共享同一密钥文件",
            _KEY_ENV,
            _KEY_FILE,
        )
    except OSError as e:
        logger.warning(
            "[checkin_store] 密钥文件不可写(%s),使用进程内临时密钥(重启 = 历史密文解不开)",
            e,
        )
    _fernet = Fernet(key)
    return _fernet


def _encrypt_jwt(jwt: str) -> bytes:
    return _load_fernet().encrypt(jwt.encode("utf-8"))


def _decrypt_jwt(blob: bytes) -> str:
    try:
        return _load_fernet().decrypt(bytes(blob)).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("JWT 密文解密失败(密钥不匹配或密文损坏)") from e


def reset_fernet_cache() -> None:
    """清空密钥缓存(测试注入用;生产勿调)。"""
    global _fernet
    _fernet = None


def set_fernet_for_testing(key: bytes) -> None:
    """测试注入固定 Fernet key。"""
    global _fernet
    _fernet = Fernet(key)


def generate_fernet_key_b64() -> str:
    """生成一个新 Fernet key(base64 字符串),供运维初始化 CHECKIN_FERNET_KEY 用。"""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii")


# ---------------------------------------------------------------------------
# 账号 CRUD
# ---------------------------------------------------------------------------


async def create_account(
    owner_user_id: str, name: str, jwt: str, device_map: dict[str, Any]
) -> dict[str, Any]:
    """录入账号(jwt 加密落库)。同名账号已存在时抛 ValueError。"""
    pool = await get_shared_pool()
    jwt_enc = _encrypt_jwt(jwt)
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO checkin_accounts
                    (owner_user_id, name, jwt_enc, device_map, enabled)
                VALUES ($1, $2, $3, $4::jsonb, true)
                RETURNING id, owner_user_id, name, device_map, enabled,
                          created_at, updated_at
                """,
                owner_user_id,
                name,
                jwt_enc,
                json.dumps(device_map, ensure_ascii=False),
            )
        except Exception as e:
            # asyncpg 唯一约束冲突 → 23505
            if getattr(e, "sqlstate", None) == "23505" or "duplicate key" in str(e).lower():
                raise ValueError(f"账号名已存在: {name}") from e
            raise
    return _account_row(row)


async def list_accounts(owner_user_id: str) -> list[dict[str, Any]]:
    """列出 owner 的账号(jwt 永不出库),附最近一次签到记录摘要。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id, a.owner_user_id, a.name, a.device_map, a.enabled,
                   a.created_at, a.updated_at,
                   r.ok        AS last_ok,
                   r.action    AS last_action,
                   r.message   AS last_message,
                   r.credits   AS last_credits,
                   r.created_at AS last_created_at
            FROM checkin_accounts a
            LEFT JOIN LATERAL (
                SELECT ok, action, message, credits, created_at
                FROM checkin_records
                WHERE account_id = a.id
                ORDER BY created_at DESC
                LIMIT 1
            ) r ON true
            WHERE a.owner_user_id = $1
            ORDER BY a.id
            """,
            owner_user_id,
        )
    return [_account_row(r) for r in rows]


async def delete_account(account_id: int, owner_user_id: str) -> bool:
    """删除账号(records / error_counts 级联)。返回是否确实删除了行。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        tag = await conn.execute(
            "DELETE FROM checkin_accounts WHERE id = $1 AND owner_user_id = $2",
            account_id,
            owner_user_id,
        )
    return tag == "DELETE 1"


async def set_enabled(account_id: int, owner_user_id: str, enabled: bool) -> bool:
    """启用/停用账号。返回是否命中行。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        tag = await conn.execute(
            """
            UPDATE checkin_accounts
            SET enabled = $3, updated_at = now()
            WHERE id = $1 AND owner_user_id = $2
            """,
            account_id,
            owner_user_id,
            enabled,
        )
    return tag == "UPDATE 1"


async def get_decrypted_jwt(account_id: int, owner_user_id: str) -> dict[str, Any] | None:
    """按属主取账号并解密 jwt(内部使用:手动签到 / 调度)。不命中返回 None。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, name, jwt_enc, device_map, enabled
            FROM checkin_accounts
            WHERE id = $1 AND owner_user_id = $2
            """,
            account_id,
            owner_user_id,
        )
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "jwt": _decrypt_jwt(row["jwt_enc"]),
        "device_map": json.loads(row["device_map"] or "{}") if isinstance(row["device_map"], str) else dict(row["device_map"] or {}),
        "enabled": row["enabled"],
    }


async def list_enabled_accounts() -> list[dict[str, Any]]:
    """调度器用:所有 enabled 账号(已解密 jwt)。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, jwt_enc, device_map
            FROM checkin_accounts
            WHERE enabled = true
            ORDER BY id
            """
        )
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r["id"],
                "name": r["name"],
                "jwt": _decrypt_jwt(r["jwt_enc"]),
                "device_map": json.loads(r["device_map"] or "{}")
                if isinstance(r["device_map"], str)
                else dict(r["device_map"] or {}),
            }
        )
    return out


async def save_device_map(account_id: int, device_map: dict[str, Any]) -> None:
    """引擎对 device_map 原位补齐缺失设备标识后,由调用方写回。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE checkin_accounts
            SET device_map = $2::jsonb, updated_at = now()
            WHERE id = $1
            """,
            account_id,
            json.dumps(device_map, ensure_ascii=False),
        )


def _account_row(row) -> dict[str, Any]:
    """账号行 → 脱敏 dict(绝不含 jwt / jwt_enc 字段)。"""
    device_map = row["device_map"]
    if isinstance(device_map, str):
        device_map = json.loads(device_map or "{}")
    else:
        device_map = dict(device_map or {})
    out: dict[str, Any] = {
        "id": row["id"],
        "name": row["name"],
        "device_map": device_map,
        "enabled": row["enabled"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
    if "last_created_at" in row:
        out["last_record"] = (
            {
                "ok": row["last_ok"],
                "action": row["last_action"],
                "message": row["last_message"],
                "credits": row["last_credits"],
                "created_at": row["last_created_at"].isoformat()
                if row["last_created_at"]
                else None,
            }
            if row["last_created_at"] is not None
            else None
        )
    return out


# ---------------------------------------------------------------------------
# 签到记录
# ---------------------------------------------------------------------------


async def insert_record(
    account_id: int,
    *,
    ok: bool | None,
    action: str | None,
    http_status: int | None,
    code: str | None,
    message: str | None,
    classified_error: str | None,
    cooldown_until: datetime | None,
    credits: int | None,
    credits_delta: int | None,
) -> dict[str, Any]:
    """写一条签到记录(引擎结构化 dict 的落库投影),返回含 id/created_at 的记录。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO checkin_records
                (account_id, ok, action, http_status, code, message,
                 classified_error, cooldown_until, credits, credits_delta)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, account_id, ok, action, http_status, code, message,
                      classified_error, cooldown_until, credits, credits_delta, created_at
            """,
            account_id,
            ok,
            action,
            http_status,
            code,
            message,
            classified_error,
            cooldown_until,
            credits,
            credits_delta,
        )
    return _record_row(row)


async def list_records(
    owner_user_id: str, account_id: int | None = None, limit: int = 50
) -> list[dict[str, Any]]:
    """签到记录倒序分页(经 accounts join 限定属主)。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        if account_id is not None:
            rows = await conn.fetch(
                """
                SELECT r.* FROM checkin_records r
                JOIN checkin_accounts a ON a.id = r.account_id
                WHERE a.owner_user_id = $1 AND r.account_id = $2
                ORDER BY r.created_at DESC, r.id DESC
                LIMIT $3
                """,
                owner_user_id,
                account_id,
                limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT r.* FROM checkin_records r
                JOIN checkin_accounts a ON a.id = r.account_id
                WHERE a.owner_user_id = $1
                ORDER BY r.created_at DESC, r.id DESC
                LIMIT $2
                """,
                owner_user_id,
                limit,
            )
    return [_record_row(r) for r in rows]


async def credits_history(
    owner_user_id: str, account_id: int | None = None, limit: int = 200
) -> list[dict[str, Any]]:
    """积分流水(从 records 聚合 credits_delta 非空的行,倒序)。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        if account_id is not None:
            rows = await conn.fetch(
                """
                SELECT r.id, r.account_id, r.ok, r.action, r.credits,
                       r.credits_delta, r.created_at
                FROM checkin_records r
                JOIN checkin_accounts a ON a.id = r.account_id
                WHERE a.owner_user_id = $1 AND r.account_id = $2
                  AND r.credits_delta IS NOT NULL
                ORDER BY r.created_at DESC, r.id DESC
                LIMIT $3
                """,
                owner_user_id,
                account_id,
                limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT r.id, r.account_id, r.ok, r.action, r.credits,
                       r.credits_delta, r.created_at
                FROM checkin_records r
                JOIN checkin_accounts a ON a.id = r.account_id
                WHERE a.owner_user_id = $1 AND r.credits_delta IS NOT NULL
                ORDER BY r.created_at DESC, r.id DESC
                LIMIT $2
                """,
                owner_user_id,
                limit,
            )
    return [
        {
            "id": r["id"],
            "account_id": r["account_id"],
            "ok": r["ok"],
            "action": r["action"],
            "credits": r["credits"],
            "credits_delta": r["credits_delta"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


def _record_row(row) -> dict[str, Any]:
    cd = row["cooldown_until"]
    return {
        "id": row["id"],
        "account_id": row["account_id"],
        "ok": row["ok"],
        "action": row["action"],
        "http_status": row["http_status"],
        "code": row["code"],
        "message": row["message"],
        "classified_error": row["classified_error"],
        "cooldown_until": cd.isoformat() if cd else None,
        "credits": row["credits"],
        "credits_delta": row["credits_delta"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


# ---------------------------------------------------------------------------
# 冷却计数(与桌面端一致:Server / Client 两类独立累积)
# ---------------------------------------------------------------------------


async def get_error_counts(account_id: int) -> tuple[int, int]:
    """返回 (server_errors, client_errors),无行视为 (0, 0)。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT server_errors, client_errors FROM checkin_error_counts WHERE account_id = $1",
            account_id,
        )
    if row is None:
        return 0, 0
    return row["server_errors"], row["client_errors"]


async def bump_error_count(account_id: int, column: str) -> int:
    """冷却计数 +1(upsert),返回累加后的新计数。column 只允许 server_errors / client_errors。"""
    if column not in ("server_errors", "client_errors"):
        raise ValueError(f"非法计数列: {column}")
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            INSERT INTO checkin_error_counts (account_id, {column})
            VALUES ($1, 1)
            ON CONFLICT (account_id)
            DO UPDATE SET {column} = checkin_error_counts.{column} + 1
            RETURNING {column}
            """,
            account_id,
        )
    return row[column]


async def reset_error_count(account_id: int, column: str) -> None:
    """指定列计数清零(触发冷却时调用,与桌面端语义一致)。"""
    if column not in ("server_errors", "client_errors"):
        raise ValueError(f"非法计数列: {column}")
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE checkin_error_counts SET {column} = 0 WHERE account_id = $1",
            account_id,
        )


async def reset_all_error_counts(account_id: int) -> None:
    """签到成功 → 两类计数全部清零。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO checkin_error_counts (account_id, server_errors, client_errors)
            VALUES ($1, 0, 0)
            ON CONFLICT (account_id)
            DO UPDATE SET server_errors = 0, client_errors = 0
            """,
            account_id,
        )


async def get_active_cooldowns() -> dict[int, datetime]:
    """当前处于冷却期的账号 → 冷却结束时间(取该账号最近一次记录里的 cooldown_until)。

    冷却状态不单独建表:cooldown_until 已落在 checkin_records 上,
    取 max(cooldown_until) > now() 的账号即为冷却中。
    """
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT account_id, max(cooldown_until) AS cooldown_until
            FROM checkin_records
            WHERE cooldown_until IS NOT NULL AND cooldown_until > $1
            GROUP BY account_id
            """,
            datetime.now(UTC),
        )
    return {r["account_id"]: r["cooldown_until"] for r in rows}
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

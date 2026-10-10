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
from collections.abc import Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

from cryptography.fernet import Fernet, InvalidToken

from app.core.db_pool import get_shared_pool
from app.core.logging import get_logger
from app.services.checkin_engine import get_jwt_exp

if TYPE_CHECKING:
    # 只为标注 ensure_tables_conn 的连接参数而引;本文件有 `from __future__ import
    # annotations`,该注解在运行时不求值 ⇒ 不新增任何导入期代价。asyncpg 未发布
    # py.typed(AGENTS §3 例外①:第三方库无类型声明),所以这里标**真名**而不是 Any。
    import asyncpg

logger = get_logger(__name__)

# 引擎的 get_jwt_exp 是上游平移的**无类型**函数(mypy strict 下直接调用报
# no-untyped-call,routers/checkin.py:54 的存量同因)。untyped callable 可赋给
# 精确签名,给调用点钉上真类型:jwt_exp 要进列表响应,返回值不能渗 Any。
_get_jwt_exp: Callable[[str], tuple[datetime | None, float | None]] = get_jwt_exp

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

# WP-B 后端半(2026-10-09)积分每日快照:每账号每天一行,remaining 为当日查得的
# 余额(gained 从 checkin_records 按日聚合,不在此冗余存亦行,落列便于单表出序列)。
_CREATE_CREDITS_DAILY_SQL = """
CREATE TABLE IF NOT EXISTS checkin_credits_daily (
    account_id    bigint NOT NULL REFERENCES checkin_accounts(id) ON DELETE CASCADE,
    owner_user_id text NOT NULL,
    day           date NOT NULL,
    remaining     int,
    gained        int NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, day)
)
"""

_CREATE_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_checkin_records_account_created
    ON checkin_records (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_records_cooldown
    ON checkin_records (cooldown_until)
    WHERE cooldown_until IS NOT NULL;
"""

# Phase1d(2026-10-08)加列:账号分组。PG 里 group 是保留字,列名用 account_group;
# ADD COLUMN IF NOT EXISTS 幂等,存量表在 ensure_tables_conn 里补齐(ensure_tables
# 与 CI 裸连接两条建表路径共用该函数,一处加列两边生效)。
_ALTER_ACCOUNTS_GROUP_SQL = """
ALTER TABLE checkin_accounts
    ADD COLUMN IF NOT EXISTS account_group text NOT NULL DEFAULT ''
"""

# 平台化(2026-10-10):'trae'(存量默认)| 'qoder'。ADD COLUMN IF NOT EXISTS 幂等,
# 与 account_group 加列同一配方(ensure_tables 与 CI 裸连接两条路径共用)。
# qoder 账号:jwt_enc 存 accessToken,refresh_token / expires_at / Cosy-* 设备头
# 存 device_map(复用 jsonb,不另加列)—— 引擎见 checkin_qoder.py。
_ALTER_ACCOUNTS_PLATFORM_SQL = """
ALTER TABLE checkin_accounts
    ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'trae'
"""

_ensure_failed = False


async def ensure_tables_conn(conn: asyncpg.Connection) -> None:
    """在给定连接上幂等建表(四张表 + account_group 幂等加列 + 查询索引)。

    四张表 = 签到三表(accounts / records / error_counts)+ 积分每日快照表
    (checkin_credits_daily,WP-B 后端半)。

    与 ensure_tables 的区别:不经过共享连接池。CI 的 ensure 步骤在同一进程里
    连续多次 asyncio.run(前者各自持有已关闭 loop 的残留池),共享池的跨 loop
    回收路径在 CI 环境下出现过"步骤退出 0 但表未落库"的静默失配(2026-10-03
    实测,run 37090730137);裸连接路径无此耦合,并允许调用方自验。
    """
    global _ensure_failed
    await conn.execute(_CREATE_ACCOUNTS_SQL)
    await conn.execute(_CREATE_RECORDS_SQL)
    await conn.execute(_CREATE_ERROR_COUNTS_SQL)
    await conn.execute(_CREATE_CREDITS_DAILY_SQL)
    await conn.execute(_ALTER_ACCOUNTS_GROUP_SQL)
    await conn.execute(_ALTER_ACCOUNTS_PLATFORM_SQL)
    await conn.execute(_CREATE_INDEXES_SQL)
    _ensure_failed = False


async def ensure_tables() -> None:
    """幂等建表(三张表 + account_group 幂等加列 + 查询索引)。失败抛出,由调用方决定 fail-open/fail-closed。"""
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
    owner_user_id: str,
    name: str,
    jwt: str,
    device_map: dict[str, Any],
    account_group: str = "",
    platform: str = "trae",
) -> dict[str, Any]:
    """录入账号(jwt 加密落库)。同名账号已存在时抛 ValueError。"""
    pool = await get_shared_pool()
    jwt_enc = _encrypt_jwt(jwt)
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO checkin_accounts
                    (owner_user_id, name, jwt_enc, device_map, enabled, account_group, platform)
                VALUES ($1, $2, $3, $4::jsonb, true, $5, $6)
                RETURNING id, owner_user_id, name, device_map, enabled, account_group, platform,
                          created_at, updated_at
                """,
                owner_user_id,
                name,
                jwt_enc,
                json.dumps(device_map, ensure_ascii=False),
                account_group,
                platform,
            )
        except Exception as e:
            # asyncpg 唯一约束冲突 → 23505
            if getattr(e, "sqlstate", None) == "23505" or "duplicate key" in str(e).lower():
                raise ValueError(f"账号名已存在: {name}") from e
            raise
    return _account_row(row)


async def list_accounts(owner_user_id: str) -> list[dict[str, Any]]:
    """列出 owner 的账号(jwt 明文不出库),附最近一次签到记录摘要。

    SELECT 带 jwt_enc 仅供 _account_row 派生 jwt_exp(Phase1c 列表增强),
    响应不回吐任何 jwt / jwt_enc 字段。
    """
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id, a.owner_user_id, a.name, a.account_group, a.platform, a.jwt_enc, a.device_map, a.enabled,
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
        # asyncpg 的 execute() 回的是**状态文本**(如 "DELETE 1"),不是行数对象;
        # 这里显式钉成 str(守门 35 :269 判 "Returning Any from function declared to
        # return bool" 的根因:asyncpg 无 py.typed ⇒ conn 是 Any ⇒ tag 是 Any ⇒
        # `Any == "…"` 整式是 Any,Bool 侧的判定就没人看守了)。声明在赋值位而不是
        # `bool(...)` 包一层:后者只是把洞盖住,前者交代了这行的真类型。
        tag: str = await conn.execute(
            "DELETE FROM checkin_accounts WHERE id = $1 AND owner_user_id = $2",
            account_id,
            owner_user_id,
        )
    return tag == "DELETE 1"


async def set_enabled(account_id: int, owner_user_id: str, enabled: bool) -> bool:
    """启用/停用账号。返回是否命中行。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        # 同 :269:asyncpg 状态文本钉成 str,Bool 判定才有人看守(守门 35 :286)。
        tag: str = await conn.execute(
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


async def update_jwt(account_id: int, owner_user_id: str, jwt: str) -> bool:
    """更换账号 jwt(重加密落库)。返回是否命中行(属主校验并入 WHERE)。"""
    pool = await get_shared_pool()
    jwt_enc = _encrypt_jwt(jwt)
    async with pool.acquire() as conn:
        # 同 :269:asyncpg 状态文本钉成 str,Bool 判定才有人看守。
        tag: str = await conn.execute(
            """
            UPDATE checkin_accounts
            SET jwt_enc = $3, updated_at = now()
            WHERE id = $1 AND owner_user_id = $2
            """,
            account_id,
            owner_user_id,
            jwt_enc,
        )
    return tag == "UPDATE 1"


async def update_group(account_id: int, owner_user_id: str, group: str) -> bool:
    """更新账号分组(空串 = 移出分组)。返回是否命中行(属主校验并入 WHERE)。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        # 同 :269:asyncpg 状态文本钉成 str,Bool 判定才有人看守。
        tag: str = await conn.execute(
            """
            UPDATE checkin_accounts
            SET account_group = $3, updated_at = now()
            WHERE id = $1 AND owner_user_id = $2
            """,
            account_id,
            owner_user_id,
            group,
        )
    return tag == "UPDATE 1"


async def get_decrypted_jwt(account_id: int, owner_user_id: str) -> dict[str, Any] | None:
    """按属主取账号并解密 jwt(内部使用:手动签到 / 调度)。不命中返回 None。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, name, jwt_enc, device_map, enabled, platform
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
        "platform": row["platform"],
        "device_map": json.loads(row["device_map"] or "{}") if isinstance(row["device_map"], str) else dict(row["device_map"] or {}),
        "enabled": row["enabled"],
    }


async def list_enabled_accounts() -> list[dict[str, Any]]:
    """调度器用:所有 enabled 账号(已解密 jwt)。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, jwt_enc, device_map, platform
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
                "platform": r["platform"],
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


def _account_jwt_exp(jwt_enc: bytes) -> str | None:
    """解密账号 jwt 并解析 exp → ISO8601;解密/解析失败一律 None(单账号异常不炸整表)。"""
    try:
        jwt = _decrypt_jwt(jwt_enc)
    except ValueError:
        return None
    exp_dt, _remaining = _get_jwt_exp(jwt)
    return exp_dt.isoformat() if exp_dt is not None else None


def _account_row(row: Mapping[str, Any]) -> dict[str, Any]:
    """账号行 → 脱敏 dict(绝不含 jwt / jwt_enc 字段;行上带 jwt_enc 时派生 jwt_exp)。"""
    device_map = row["device_map"]
    if isinstance(device_map, str):
        device_map = json.loads(device_map or "{}")
    else:
        device_map = dict(device_map or {})
    out: dict[str, Any] = {
        "id": row["id"],
        "name": row["name"],
        "group": row.get("account_group", ""),
        "platform": row.get("platform", "trae"),
        "device_map": device_map,
        "enabled": row["enabled"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
    if "jwt_enc" in row:
        out["jwt_exp"] = _account_jwt_exp(row["jwt_enc"])
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


def _record_row(row: Mapping[str, Any]) -> dict[str, Any]:
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
    # 钉成 int 再回(守门 35 :567 "Returning Any from function declared to return int"):
    # server_errors / client_errors 两列在 _CREATE_ERROR_COUNTS_SQL 里都是 `int NOT NULL`,
    # RETURNING 取的就是它自己 ⇒ 真类型是 int;而 asyncpg 无 py.typed ⇒ row 是 Any,
    # 原样 return 等于把 Any 递给声明了 -> int 的调用方(计数进冷却判定,不是装饰)。
    count: int = row[column]
    return count


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


# ---------------------------------------------------------------------------
# 积分每日快照(WP-B 后端半,2026-10-09)
# ---------------------------------------------------------------------------


async def upsert_credits_daily(
    account_id: int, owner_user_id: str, day: str, remaining: int | None, gained: int
) -> None:
    """写入/更新某账号某日的积分快照;remaining 为 None 时不覆盖旧值。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO checkin_credits_daily (account_id, owner_user_id, day, remaining, gained)
            VALUES ($1, $2, $3::date, $4, $5)
            ON CONFLICT (account_id, day) DO UPDATE SET
                remaining = COALESCE(EXCLUDED.remaining, checkin_credits_daily.remaining),
                gained = EXCLUDED.gained,
                updated_at = now()
            """,
            account_id,
            owner_user_id,
            day,
            remaining,
            gained,
        )


async def get_credits_daily_range(owner_user_id: str, days: int) -> list[dict[str, Any]]:
    """最近 days 天(Asia/Shanghai 日界)按日聚合:Σremaining(快照表)+ Σgained(credits_delta)。

    返回按日升序的稀疏行(仅含有数据的日子):[{day, total, gained}]。
    total / gained 可各自为 None(该日只有另一侧数据),窗口补齐与断线由路由层处理。
    """
    start_day = datetime.now(ZoneInfo("Asia/Shanghai")).date() - timedelta(days=days - 1)
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH rem AS (
                SELECT day, SUM(remaining) AS total
                FROM checkin_credits_daily
                WHERE owner_user_id = $1 AND day >= $2
                GROUP BY day
            ),
            gn AS (
                SELECT (r.created_at AT TIME ZONE 'Asia/Shanghai')::date AS day,
                       SUM(r.credits_delta) AS gained
                FROM checkin_records r
                JOIN checkin_accounts a ON a.id = r.account_id
                WHERE a.owner_user_id = $1
                  AND r.credits_delta IS NOT NULL
                  AND (r.created_at AT TIME ZONE 'Asia/Shanghai')::date >= $2
                GROUP BY 1
            )
            SELECT to_char(d.day, 'YYYY-MM-DD') AS day, rem.total, gn.gained
            FROM (SELECT day FROM rem UNION SELECT day FROM gn) AS d
            LEFT JOIN rem ON rem.day = d.day
            LEFT JOIN gn ON gn.day = d.day
            ORDER BY d.day
            """,
            owner_user_id,
            start_day,
        )
    return [{"day": r["day"], "total": r["total"], "gained": r["gained"]} for r in rows]


async def sum_credits_delta_for_day(account_id: int, owner_user_id: str, day: str) -> int:
    """某账号某日(Asia/Shanghai 日界)的 credits_delta 合计(query_credits 落快照时用)。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COALESCE(SUM(r.credits_delta), 0) AS gained
            FROM checkin_records r
            JOIN checkin_accounts a ON a.id = r.account_id
            WHERE r.account_id = $1
              AND a.owner_user_id = $2
              AND r.credits_delta IS NOT NULL
              AND (r.created_at AT TIME ZONE 'Asia/Shanghai')::date = $3::date
            """,
            account_id,
            owner_user_id,
            day,
        )
    # 钉真类型再回(同 bump_error_count 的守门理由):SUM/COALESCE 产出确为 int。
    gained: int = row["gained"]
    return gained


async def list_enabled_accounts_full() -> list[dict[str, Any]]:
    """积分快照调度用:所有 enabled 账号(含 owner_user_id,已解密 jwt)。

    与 list_enabled_accounts 的差异仅是多回 owner_user_id —— 快照落表需要
    属主列;不改动既有方法,避免影响每日签到 job 的既有调用面。
    """
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, owner_user_id, name, jwt_enc, device_map, platform
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
                "owner_user_id": r["owner_user_id"],
                "name": r["name"],
                "jwt": _decrypt_jwt(r["jwt_enc"]),
                "platform": r["platform"],
                "device_map": json.loads(r["device_map"] or "{}")
                if isinstance(r["device_map"], str)
                else dict(r["device_map"] or {}),
            }
        )
    return out
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

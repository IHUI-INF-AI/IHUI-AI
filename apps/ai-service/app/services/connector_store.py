# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器配置持久化(2026-09-02 立,P2-2;2026-11-24 由 JSON 单文件迁 PostgreSQL)。

记录结构(key 为**作用域内**唯一标识,格式 {type}:{slug};跨作用域互不可见也不可撞):

    {
      "key": "yuque:docs",
      "owner_user_id": "<租户 UUID 或个人属主>",  # 承载层显式盖章,不接受请求体自报
      "type": "yuque",
      "name": "语雀文档库",
      "app_id": "",
      "app_secret": "",            # 落库为 enc:v1 密文,读出透明解密回明文
      "extra": {},
      "mode": "preset",
      "spec": {},
      "operations": [],
      "enabled": true,
      "managed": false,
      "credential_source": "",
      "installed_at": "ISO 时间",
      "updated_at": "ISO 时间",
      "last_sync_at": "",
      "last_error": "",
      "sync_items": [],
    }

**租户/属主双轴隔离(2026-11-24)**:
- ``tenant_id``:记录归属企业租户,由承载层(路由解析的已校验上下文)显式传入;
  个人作用域回落 ``PLATFORM_DEFAULT_TENANT_ID`` 兜底。**不得**从记录反推、**不得**信
  请求体自报。拿不到租户 ⇒ 写入拒绝、读返回空并留可观测日志(fail-closed)。
- ``owner_user_id``:NULL = 租户共享连接器(同租户成员共享);非 NULL = 个人作用域属主。
- 同一租户成员共享同一批连接器,不同租户互不可见;别人的记录与"没这条"逐字同形
  (None/[]/False),端点不会变成存在性预言机。

**无主遗留记录**:旧 JSON 时代没有属主的记录不列给任何人(G-371 fail-closed)。
迁 PG 后这类记录由回填脚本 ``scripts/backfill_connectors_to_pg.py`` 拦下、不落库;
PG 表 ``tenant_id`` NOT NULL,正常态不存在"无主遗留"行。

**降级口径**:DATABASE_URL 缺失 / 连接不可用 ⇒ 读空、写拒绝,如实记 warning;
**绝不**静默把旧 JSON 文件当生产存储。secret 加密不可用时拒绝落明文(fail-closed)。
"""

from __future__ import annotations

import json
import logging
import re
import threading
from datetime import UTC, datetime
from typing import Any

from app.core.config import settings
from app.core.pg_sync import SyncPgSession

logger = logging.getLogger(__name__)

# 属主字段名 —— 唯一一份,路由与判据都引它,不得在别处再写字符串字面量
OWNER_FIELD = "owner_user_id"

_TABLE = "connector_instances"

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# app_secret 落库加密(2026-10-31 安全强化第 13 批):app_secret 以 enc:v1 AES-256-GCM
# 密文落库,服务器磁盘任意文件读不可直取。读取面透明解密,调用方拿到的始终是明文
# (与旧行为逐字节兼容)。兼容策略:存量明文(无前缀)读时原样用、下次写库自然迁移为密文;
# 解密侧异常(密钥轮换后密钥环也没有)置空串并记日志 —— 该连接器 sync 会因凭据无效
# 失败,用户重新配置即可,绝不抛异常崩读面。
_SECRET_CIPHER_PREFIX = "enc:v1:"
# 仅存储层内部使用:解密失败的记录保留原密文,避免下一次写库把它覆盖成空串
# (密钥轮换后重新找回旧密钥即可恢复,写入空串则永久丢失)。下划线键绝不外泄给调用方。
_SECRET_UNREADABLE = "_secret_unreadable"
_SECRET_RAW = "_secret_raw"

# DDL 兜底自举(权威迁移在 packages/database/drizzle/20261124120000_connector_instances.sql;
# 这里与 approval_persistence 同型:服务直读 PG 时表不在也能自举建表)。
_SCHEMA_STATEMENTS: tuple[str, ...] = (
    f"""
    CREATE TABLE IF NOT EXISTS "{_TABLE}" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "owner_user_id" uuid,
      "key" text NOT NULL,
      "conn_type" varchar(32) NOT NULL,
      "name" text DEFAULT '' NOT NULL,
      "enabled" boolean DEFAULT true NOT NULL,
      "app_id" varchar(255) DEFAULT '' NOT NULL,
      "app_secret" text DEFAULT '' NOT NULL,
      "extra" jsonb DEFAULT '{{}}' NOT NULL,
      "mode" varchar(16) DEFAULT 'preset' NOT NULL,
      "spec" jsonb DEFAULT '{{}}' NOT NULL,
      "operations" jsonb DEFAULT '[]' NOT NULL,
      "managed" boolean DEFAULT false NOT NULL,
      "credential_source" text DEFAULT '' NOT NULL,
      "installed_at" text DEFAULT '' NOT NULL,
      "last_sync_at" text DEFAULT '' NOT NULL,
      "last_error" text DEFAULT '' NOT NULL,
      "sync_items" jsonb DEFAULT '[]' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
    """,
    f"""
    CREATE UNIQUE INDEX IF NOT EXISTS "{_TABLE}_owner_key_uidx"
      ON "{_TABLE}" ("tenant_id", "owner_user_id", "key")
    """,
    f"""
    CREATE UNIQUE INDEX IF NOT EXISTS "{_TABLE}_tenant_key_shared_uidx"
      ON "{_TABLE}" ("tenant_id", "key")
      WHERE "owner_user_id" IS NULL
    """,
    f"""
    CREATE INDEX IF NOT EXISTS "{_TABLE}_tenant_owner_idx"
      ON "{_TABLE}" ("tenant_id", "owner_user_id")
    """,
)

_COLUMNS = (
    "tenant_id",
    "owner_user_id",
    "key",
    "conn_type",
    "name",
    "enabled",
    "app_id",
    "app_secret",
    "extra",
    "mode",
    "spec",
    "operations",
    "managed",
    "credential_source",
    "installed_at",
    "last_sync_at",
    "last_error",
    "sync_items",
    "created_at",
    "updated_at",
)

_SELECT_ALL = f"""
SELECT {', '.join(_COLUMNS)} FROM "{_TABLE}"
WHERE tenant_id = $1 AND owner_user_id IS NOT DISTINCT FROM $2
"""

_pg: SyncPgSession | None = None
_pg_lock = threading.Lock()


class SecretCryptoUnavailable(Exception):
    """app_secret 加密不可用(密钥未配置/密钥环缺失)—— 必须 fail-closed,绝不落明文。"""


class ConnectorStoreUnread(OSError):
    """名单读不到。调用方不得把它当成空名单再写回去。"""


def _encrypt_secret(plain: str) -> str:
    if not plain or plain.startswith(_SECRET_CIPHER_PREFIX):
        return plain
    try:
        from app.services.publish.credentials_crypto import encrypt

        return _SECRET_CIPHER_PREFIX + encrypt({"app_secret": plain})
    except Exception as e:  # noqa: BLE001 - 加密不可用 → fail-closed 拒落明文
        logger.warning("[connector_store] app_secret 加密不可用,拒绝落盘明文: %s", type(e).__name__)
        raise SecretCryptoUnavailable(f"app_secret 加密不可用: {type(e).__name__}")


def _decrypt_secret(value: str) -> str:
    if not value or not value.startswith(_SECRET_CIPHER_PREFIX):
        return value
    try:
        from app.services.publish.credentials_crypto import decrypt

        payload = decrypt(value[len(_SECRET_CIPHER_PREFIX) :])
        return str(payload.get("app_secret") or "")
    except Exception as e:  # noqa: BLE001 - 密钥不匹配/密文损坏 → 置空,不崩读面
        logger.warning(
            "[connector_store] app_secret 解密失败(密钥不匹配或密文损坏),该连接器需重新配置: %s",
            type(e).__name__,
        )
        return ""


def now_iso() -> str:
    """当前 UTC 时间的 ISO 8601 字符串(持久化时间戳用)。"""
    return datetime.now(UTC).isoformat()


def _public(rec: dict[str, Any]) -> dict[str, Any]:
    """剥离仅存储层使用的下划线键,保证内部记账字段不进调用方/响应体。"""
    return {k: v for k, v in rec.items() if not str(k).startswith("_")}


def _pg_session() -> SyncPgSession | None:
    """惰性建一条同步 PG 桥;DSN 缺失 / 建连失败返回 None(fail-closed,不回落 JSON)。"""
    global _pg
    if _pg is not None:
        return _pg
    with _pg_lock:
        if _pg is not None:
            return _pg
        dsn = str(getattr(settings, "database_url", "") or "").strip()
        if not dsn:
            logger.warning(
                "[connector_store] DATABASE_URL 未配置:连接器存储未启用,读空写拒绝(fail-closed)"
            )
            return None
        try:
            _pg = SyncPgSession(dsn, schema=_SCHEMA_STATEMENTS, timeout=10.0)
        except Exception as e:  # noqa: BLE001 - 连接不可用按未启用降级,不崩服务
            logger.warning("[connector_store] PG 连接不可用: %s: %s", type(e).__name__, e)
            _pg = None
        return _pg


def close_session() -> None:
    """关闭并清空私有桥(测试隔离 / 进程收尾用)。"""
    global _pg
    with _pg_lock:
        session, _pg = _pg, None
    if session is not None:
        session.close()


def _resolve_principal(owner: str, tenant_id: str | None) -> tuple[str, str | None] | None:
    """解析可信 (tenant_id, owner_user_id);拿不到租户 ⇒ None(fail-closed)。

    - 显式传入合法 UUID 租户 ⇒ 租户共享行:``owner_user_id=None``。
    - 否则个人作用域:``owner_user_id``=属主,``tenant_id`` 回落平台默认租户兜底。
    - ``user:<id>`` 前缀剥除;空属主 / 兜底租户缺失 ⇒ None。
    """
    owner = (owner or "").strip()
    if owner.startswith("user:"):
        owner = owner[len("user:") :].strip()
    tenant = (tenant_id or "").strip()
    if tenant and _UUID_RE.match(tenant):
        return tenant, None
    if not owner:
        return None
    fallback = str(getattr(settings, "platform_default_tenant_id", "") or "").strip()
    if not fallback or not _UUID_RE.match(fallback):
        logger.warning(
            "[connector_store] 个人作用域拿不到可信租户兜底(PLATFORM_DEFAULT_TENANT_ID 未配置),"
            "读写拒绝(fail-closed)"
        )
        return None
    return fallback, owner


def _as_dict(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:  # noqa: BLE001
            return {}
    return {}


def _as_list(raw: Any) -> list[Any]:
    if isinstance(raw, list):
        return list(raw)
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except Exception:  # noqa: BLE001
            return []
    return []


def _row_to_record(row: Any) -> dict[str, Any]:
    """PG 行 → 调用方 record 字典(透明解密 secret,还原旧字段名)。"""
    raw_secret = str(row["app_secret"] or "")
    plain_secret = _decrypt_secret(raw_secret)
    raw_updated_at = row["updated_at"]
    if raw_updated_at is None:
        updated_at = ""
    elif hasattr(raw_updated_at, "isoformat"):
        updated_at = raw_updated_at.isoformat()
    else:
        updated_at = str(raw_updated_at)
    record: dict[str, Any] = {
        "key": str(row["key"] or ""),
        "type": str(row["conn_type"] or ""),
        "name": str(row["name"] or ""),
        "app_id": str(row["app_id"] or ""),
        "app_secret": plain_secret,
        "extra": _as_dict(row["extra"]),
        "mode": str(row["mode"] or "preset"),
        "spec": _as_dict(row["spec"]),
        "operations": _as_list(row["operations"]),
        "enabled": bool(row["enabled"]),
        "managed": bool(row["managed"]),
        "credential_source": str(row["credential_source"] or ""),
        "installed_at": str(row["installed_at"] or ""),
        "updated_at": updated_at,
        "last_sync_at": str(row["last_sync_at"] or ""),
        "last_error": str(row["last_error"] or ""),
        "sync_items": _as_list(row["sync_items"]),
    }
    owner = row["owner_user_id"]
    record[OWNER_FIELD] = owner if owner else str(row["tenant_id"] or "")
    if raw_secret.startswith(_SECRET_CIPHER_PREFIX) and not plain_secret:
        record[_SECRET_UNREADABLE] = True
        record[_SECRET_RAW] = raw_secret
    return _public(record)


def _serialize_payload(record: dict[str, Any]) -> dict[str, Any]:
    """落库前的规范化副本:jsonb 字段归一为可序列化形态。"""
    return {
        "extra": _as_dict(record.get("extra")),
        "spec": _as_dict(record.get("spec")),
        "operations": _as_list(record.get("operations")),
        "sync_items": _as_list(record.get("sync_items")),
    }


def list_owned(owner_user_id: str, *, tenant_id: str | None = None) -> list[dict[str, Any]]:
    """返回**属于该主体**的连接器记录副本(修改不影响持久化)。

    空属主 / 拿不到租户直接返回空列表 —— 不接受"空串当所有人"这种隐式全量。
    """
    principal = _resolve_principal(owner_user_id, tenant_id)
    if principal is None:
        return []
    session = _pg_session()
    if session is None:
        return []
    tenant, owner = principal
    try:
        rows = session.fetchall(_SELECT_ALL, (tenant, owner))
    except Exception as e:  # noqa: BLE001 - 读失败按空名单,不崩服务
        logger.warning("[connector_store] 列举连接器失败: %s: %s", type(e).__name__, e)
        return []
    return [_row_to_record(row) for row in rows]


def ownerless_count() -> int:
    """没有属主的遗留记录条数(只给服务端日志/巡检用,绝不出现在任何响应体里)。

    PG 表 ``tenant_id`` NOT NULL,遗留无主行在回填阶段已被拦下不落库;本计数保留以
    兼容旧调用面,正常态恒为 0。
    """
    session = _pg_session()
    if session is None:
        return 0
    try:
        return int(
            session.fetchval(
                f'SELECT COUNT(*) FROM "{_TABLE}" WHERE tenant_id IS NULL',
                (),
            )
            or 0
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[connector_store] 无主计数失败: %s: %s", type(e).__name__, e)
        return 0


def get(owner_user_id: str, key: str, *, tenant_id: str | None = None) -> dict[str, Any] | None:
    """按 (属主, key) 查连接器记录;不存在或不属于该主体都返回 None(同形)。"""
    principal = _resolve_principal(owner_user_id, tenant_id)
    if principal is None:
        return None
    session = _pg_session()
    if session is None:
        return None
    tenant, owner = principal
    try:
        row = session.fetchrow(_SELECT_ALL + " AND key = $3", (tenant, owner, key))
    except Exception as e:  # noqa: BLE001
        logger.warning("[connector_store] 查询连接器失败: %s: %s", type(e).__name__, e)
        return None
    return _row_to_record(row) if row is not None else None


def _upsert(
    session: SyncPgSession,
    principal: tuple[str, str | None],
    record: dict[str, Any],
) -> dict[str, Any] | None:
    """按 (tenant, owner, key) 新增或覆盖;返回入参 record,失败 None。"""
    tenant, owner = principal
    key = str(record.get("key", "") or "")
    if not key:
        return None

    secret = record.get("app_secret")
    secret = secret if isinstance(secret, str) else ""
    if not secret and record.get(_SECRET_UNREADABLE) and isinstance(record.get(_SECRET_RAW), str):
        stored_secret = record[_SECRET_RAW]
    else:
        try:
            stored_secret = _encrypt_secret(secret)
        except SecretCryptoUnavailable:
            return None

    payload = _serialize_payload(record)
    enabled = bool(record.get("enabled", True))
    managed = bool(record.get("managed", False))
    common = (
        key,
        str(record.get("type") or ""),
        str(record.get("name") or key),
        enabled,
        str(record.get("app_id") or ""),
        stored_secret,
        json.dumps(payload["extra"], ensure_ascii=False),
        str(record.get("mode") or "preset"),
        json.dumps(payload["spec"], ensure_ascii=False),
        json.dumps(payload["operations"], ensure_ascii=False),
        managed,
        str(record.get("credential_source") or ""),
        str(record.get("installed_at") or ""),
        str(record.get("last_sync_at") or ""),
        str(record.get("last_error") or ""),
        json.dumps(payload["sync_items"], ensure_ascii=False),
    )

    existing = session.fetchrow(_SELECT_ALL + " AND key = $3", (tenant, owner, key))
    if existing is not None:
        session.execute(
            f"""
            UPDATE "{_TABLE}" SET
              conn_type=$4, name=$5, enabled=$6, app_id=$7, app_secret=$8,
              extra=$9::jsonb, mode=$10, spec=$11::jsonb, operations=$12::jsonb,
              managed=$13, credential_source=$14, installed_at=$15,
              last_sync_at=$16, last_error=$17, sync_items=$18::jsonb, updated_at=now()
            WHERE tenant_id=$1 AND owner_user_id IS NOT DISTINCT FROM $2 AND key=$3
            """,
            (tenant, owner, *common),
        )
    else:
        try:
            session.execute(
                f"""
                INSERT INTO "{_TABLE}"
                  (tenant_id, owner_user_id, key, conn_type, name, enabled, app_id, app_secret,
                   extra, mode, spec, operations, managed, credential_source,
                   installed_at, last_sync_at, last_error, sync_items)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13,$14,
                        $15,$16,$17,$18::jsonb)
                """,
                (tenant, owner, *common),
            )
        except Exception:  # noqa: BLE001 - 并发撞唯一索引 ⇒ 退回 update 路径
            session.execute(
                f"""
                UPDATE "{_TABLE}" SET
                  conn_type=$4, name=$5, enabled=$6, app_id=$7, app_secret=$8,
                  extra=$9::jsonb, mode=$10, spec=$11::jsonb, operations=$12::jsonb,
                  managed=$13, credential_source=$14, installed_at=$15,
                  last_sync_at=$16, last_error=$17, sync_items=$18::jsonb, updated_at=now()
                WHERE tenant_id=$1 AND owner_user_id IS NOT DISTINCT FROM $2 AND key=$3
                """,
                (tenant, owner, *common),
            )
    record[OWNER_FIELD] = owner if owner else tenant
    return record


def save(
    owner_user_id: str,
    record: dict[str, Any],
    *,
    tenant_id: str | None = None,
) -> dict[str, Any] | None:
    """新增或覆盖(key 相同**且作用域相同**)一条连接器记录。

    属主由承载层显式入参盖章并**强制覆盖**入参里可能自带的值 —— 请求体自报的
    ``owner_user_id`` 一律不采信(AGENTS §5"认证不等于授权":身份只能从承载层进来)。

    Returns:
        写成功返回入参 record;写失败 / 拿不到租户返回 None。
    """
    principal = _resolve_principal(owner_user_id, tenant_id)
    if principal is None:
        return None
    record.setdefault("sync_items", [])
    session = _pg_session()
    if session is None:
        return None
    try:
        return _upsert(session, principal, record)
    except Exception as e:  # noqa: BLE001 - 写失败返回 None,由调用方决定报错
        logger.warning("[connector_store] 保存连接器失败: %s: %s", type(e).__name__, e)
        return None


def remove(owner_user_id: str, key: str, *, tenant_id: str | None = None) -> bool:
    """按 (属主, key) 删除连接器记录。

    Returns:
        True=删除成功;False=记录不存在、不属于该主体、拿不到租户或写失败。
    """
    principal = _resolve_principal(owner_user_id, tenant_id)
    if principal is None:
        return False
    session = _pg_session()
    if session is None:
        return False
    tenant, owner = principal
    try:
        status = session.execute(
            f"""
            DELETE FROM "{_TABLE}"
            WHERE tenant_id=$1 AND owner_user_id IS NOT DISTINCT FROM $2 AND key=$3
            """,
            (tenant, owner, key),
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[connector_store] 删除连接器失败: %s: %s", type(e).__name__, e)
        return False
    return "DELETE 1" in str(status)


def set_enabled(
    owner_user_id: str,
    key: str,
    enabled: bool,
    *,
    tenant_id: str | None = None,
) -> dict[str, Any] | None:
    """更新指定记录的 enabled 状态并刷新时间戳。

    Returns:
        更新后的记录;记录不存在、不属于该主体或写失败返回 None。
    """
    principal = _resolve_principal(owner_user_id, tenant_id)
    if principal is None:
        return None
    session = _pg_session()
    if session is None:
        return None
    tenant, owner = principal
    try:
        row = session.fetchrow(
            f"""
            UPDATE "{_TABLE}" SET enabled=$4, updated_at=now()
            WHERE tenant_id=$1 AND owner_user_id IS NOT DISTINCT FROM $2 AND key=$3
            RETURNING {', '.join(_COLUMNS)}
            """,
            (tenant, owner, key, bool(enabled)),
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[connector_store] 更新启用状态失败: %s: %s", type(e).__name__, e)
        return None
    return _row_to_record(row) if row is not None else None


def set_sync_state(
    owner_user_id: str,
    key: str,
    last_sync_at: str,
    last_error: str,
    items: list[dict[str, Any]] | None = None,
    *,
    tenant_id: str | None = None,
) -> dict[str, Any] | None:
    """更新指定记录的同步状态并刷新时间戳。

    成功同步时 last_error 应传空串;失败时 last_error 传失败原因。
    items 非 None 时一并持久化 sync_items;不传则保持原值(向后兼容)。
    别人的记录与"没这条"同形返回 None。
    """
    principal = _resolve_principal(owner_user_id, tenant_id)
    if principal is None:
        return None
    session = _pg_session()
    if session is None:
        return None
    tenant, owner = principal
    try:
        if items is not None:
            sync_items = json.dumps(list(items), ensure_ascii=False)
            row = session.fetchrow(
                f"""
                UPDATE "{_TABLE}" SET last_sync_at=$4, last_error=$5,
                  sync_items=$6::jsonb, updated_at=now()
                WHERE tenant_id=$1 AND owner_user_id IS NOT DISTINCT FROM $2 AND key=$3
                RETURNING {', '.join(_COLUMNS)}
                """,
                (tenant, owner, key, last_sync_at, last_error, sync_items),
            )
        else:
            row = session.fetchrow(
                f"""
                UPDATE "{_TABLE}" SET last_sync_at=$4, last_error=$5, updated_at=now()
                WHERE tenant_id=$1 AND owner_user_id IS NOT DISTINCT FROM $2 AND key=$3
                RETURNING {', '.join(_COLUMNS)}
                """,
                (tenant, owner, key, last_sync_at, last_error),
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("[connector_store] 更新同步状态失败: %s: %s", type(e).__name__, e)
        return None
    return _row_to_record(row) if row is not None else None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

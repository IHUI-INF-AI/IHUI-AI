"""账号分组管理 + 批量账号操作(2026-08-01 新增)。

提供:
- 账号分组 CRUD(create / list / update / delete)
- 分组成员管理(add / remove / list members)
- 一键发布到分组(publish_to_group,同步调 adapter 收集结果)
- 批量账号导入(batch_import,CSV 解析后批量创建)
- 批量账号导出(batch_export,仅 platform/nickname/status,凭证不导出)
- 批量凭证验证(batch_verify,调各平台 adapter.verify_credentials)
- Cookie 健康度查询(get_cookie_health,基于 last_verified_at 推算)
- 手动触发 Cookie 保活(refresh_cookie,委托 cookie_refresh_daemon)

DB 表(本模块自动建表):
- publish_account_groups:        分组主表
- publish_account_group_members:  分组成员关联表

IDOR 防护:所有端点从 request.state.user_id 取身份,忽略客户端传入的 user_id。
响应格式统一 {code: 0, message, data},与 scan_login router 一致(前端 fetchApi 依赖)。
"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import get_db_conn
from app.core.logging import get_logger
from app.services.publish.base_adapter import PublishContent, get_adapter
from app.services.publish.credentials_crypto import decrypt, encrypt

logger = get_logger(__name__)

router = APIRouter(prefix="/publish", tags=["publish-account-groups"])


# =============================================================================
# 数据模型
# =============================================================================
@dataclass
class AccountGroup:
    group_id: str
    user_id: str
    name: str
    description: str
    account_ids: list[int]
    created_at: datetime
    updated_at: datetime


# =============================================================================
# DB 工具(参考 publish.py 模式)
# =============================================================================
async def _get_conn() -> asyncpg.Connection:
    return await get_db_conn()


def _get_user_id(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="未登录")
    return str(uid)


async def _ensure_tables(conn: asyncpg.Connection) -> None:
    """确保分组表存在(幂等)。"""
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS publish_account_groups (
            group_id VARCHAR(40) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            name VARCHAR(128) NOT NULL,
            description TEXT DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_publish_account_groups_user ON publish_account_groups(user_id)"
    )
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS publish_account_group_members (
            group_id VARCHAR(40) NOT NULL REFERENCES publish_account_groups(group_id) ON DELETE CASCADE,
            account_id BIGINT NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (group_id, account_id)
        )
        """
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_publish_group_members_user ON publish_account_group_members(user_id)"
    )
    # 确保 publish_accounts 表存在(批量导入依赖)
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS publish_accounts (
            id BIGSERIAL PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            platform VARCHAR(32) NOT NULL,
            display_name VARCHAR(255),
            credentials_enc TEXT NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'active',
            last_verified_at TIMESTAMPTZ,
            last_verify_msg TEXT,
            extra JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, platform, display_name)
        )
        """
    )


def _gen_group_id() -> str:
    import uuid
    return f"grp_{uuid.uuid4().hex[:16]}"


def _serialize_group(row: asyncpg.Record, account_ids: list[int]) -> dict[str, Any]:
    return {
        "group_id": row["group_id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "description": row["description"] or "",
        "account_ids": account_ids,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


def _ok(data: Any, message: str = "ok") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


# =============================================================================
# Pydantic 请求模型
# =============================================================================
class GroupCreate(BaseModel):
    name: str = Field(..., max_length=128)
    description: str = Field(default="", max_length=2000)


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=128)
    description: Optional[str] = Field(default=None, max_length=2000)


class GroupMembersOp(BaseModel):
    account_ids: list[int] = Field(..., min_length=1)


class GroupPublish(BaseModel):
    """一键发布到分组:接收已解析的内容模型 + 可选平台配置。"""
    title: str = Field(..., max_length=500)
    format: str = Field(..., pattern=r"^(md|docx|html|pdf|image|video)$")
    text: Optional[str] = None
    file_path: Optional[str] = None
    cover_path: Optional[str] = None
    html: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)
    platform_config: dict[str, Any] = Field(default_factory=dict)


class BatchImportRow(BaseModel):
    platform: str
    nickname: str = ""
    credentials: dict[str, str] = Field(default_factory=dict)


class BatchImportRequest(BaseModel):
    rows: list[BatchImportRow] = Field(..., min_length=1)


# =============================================================================
# 账号分组 CRUD
# =============================================================================
@router.get("/groups")
async def list_groups(request: Request) -> dict[str, Any]:
    """列出当前用户所有分组(含成员 ID 列表)。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        rows = await conn.fetch(
            "SELECT * FROM publish_account_groups WHERE user_id=$1 ORDER BY created_at DESC",
            user_id,
        )
        groups: list[dict[str, Any]] = []
        for r in rows:
            members = await conn.fetch(
                "SELECT account_id FROM publish_account_group_members WHERE group_id=$1 ORDER BY added_at",
                r["group_id"],
            )
            aids = [m["account_id"] for m in members]
            groups.append(_serialize_group(r, aids))
        return _ok({"items": groups, "count": len(groups)})
    finally:
        await conn.close()


@router.post("/groups")
async def create_group(body: GroupCreate, request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        gid = _gen_group_id()
        row = await conn.fetchrow(
            """
            INSERT INTO publish_account_groups (group_id, user_id, name, description)
            VALUES ($1, $2, $3, $4) RETURNING *
            """,
            gid, user_id, body.name, body.description,
        )
        return _ok(_serialize_group(row, []), "分组已创建")
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="分组名已存在")
    finally:
        await conn.close()


@router.patch("/groups/{group_id}")
async def update_group(group_id: str, body: GroupUpdate, request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        existing = await conn.fetchrow(
            "SELECT * FROM publish_account_groups WHERE group_id=$1 AND user_id=$2",
            group_id, user_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="分组不存在")
        sets: list[str] = []
        args: list[Any] = []
        idx = 1
        if body.name is not None:
            sets.append(f"name=${idx}")
            args.append(body.name)
            idx += 1
        if body.description is not None:
            sets.append(f"description=${idx}")
            args.append(body.description)
            idx += 1
        if not sets:
            return _ok(_serialize_group(existing, []), "无更新字段")
        sets.append("updated_at=NOW()")
        args.append(group_id)
        args.append(user_id)
        sql = f"UPDATE publish_account_groups SET {', '.join(sets)} WHERE group_id=${idx} AND user_id=${idx + 1} RETURNING *"
        row = await conn.fetchrow(sql, *args)
        return _ok(_serialize_group(row, []), "分组已更新")
    finally:
        await conn.close()


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        result = await conn.execute(
            "DELETE FROM publish_account_groups WHERE group_id=$1 AND user_id=$2",
            group_id, user_id,
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="分组不存在")
        return _ok({"group_id": group_id, "deleted": True}, "分组已删除")
    finally:
        await conn.close()


# =============================================================================
# 分组成员管理
# =============================================================================
@router.post("/groups/{group_id}/add")
async def add_to_group(group_id: str, body: GroupMembersOp, request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        # 校验分组归属
        grp = await conn.fetchrow(
            "SELECT group_id FROM publish_account_groups WHERE group_id=$1 AND user_id=$2",
            group_id, user_id,
        )
        if not grp:
            raise HTTPException(status_code=404, detail="分组不存在")
        # 校验账号归属 + 批量插入(ON CONFLICT 跳过已存在)
        added = 0
        for aid in body.account_ids:
            owner = await conn.fetchval(
                "SELECT id FROM publish_accounts WHERE id=$1 AND user_id=$2",
                aid, user_id,
            )
            if not owner:
                continue  # 跳过不归属的账号
            r = await conn.execute(
                """
                INSERT INTO publish_account_group_members (group_id, account_id, user_id)
                VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
                """,
                group_id, aid, user_id,
            )
            if r == "INSERT 0 1":
                added += 1
        return _ok({"group_id": group_id, "added": added}, f"已添加 {added} 个账号到分组")
    finally:
        await conn.close()


@router.post("/groups/{group_id}/remove")
async def remove_from_group(group_id: str, body: GroupMembersOp, request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        removed = 0
        for aid in body.account_ids:
            r = await conn.execute(
                "DELETE FROM publish_account_group_members WHERE group_id=$1 AND account_id=$2 AND user_id=$3",
                group_id, aid, user_id,
            )
            if r == "DELETE 1":
                removed += 1
        return _ok({"group_id": group_id, "removed": removed}, f"已从分组移除 {removed} 个账号")
    finally:
        await conn.close()


@router.get("/groups/{group_id}/members")
async def list_group_members(group_id: str, request: Request) -> dict[str, Any]:
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        grp = await conn.fetchrow(
            "SELECT group_id FROM publish_account_groups WHERE group_id=$1 AND user_id=$2",
            group_id, user_id,
        )
        if not grp:
            raise HTTPException(status_code=404, detail="分组不存在")
        members = await conn.fetch(
            "SELECT account_id FROM publish_account_group_members WHERE group_id=$1 ORDER BY added_at",
            group_id,
        )
        aids = [m["account_id"] for m in members]
        return _ok({"group_id": group_id, "account_ids": aids, "count": len(aids)})
    finally:
        await conn.close()


# =============================================================================
# 一键发布到分组
# =============================================================================
@router.post("/groups/{group_id}/publish")
async def publish_to_group(group_id: str, body: GroupPublish, request: Request) -> dict[str, Any]:
    """一键发布内容到分组所有账号(同步执行,返回每个账号的结果)。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        grp = await conn.fetchrow(
            "SELECT group_id FROM publish_account_groups WHERE group_id=$1 AND user_id=$2",
            group_id, user_id,
        )
        if not grp:
            raise HTTPException(status_code=404, detail="分组不存在")

        members = await conn.fetch(
            "SELECT account_id FROM publish_account_group_members WHERE group_id=$1",
            group_id,
        )
        if not members:
            return _ok({"results": [], "success_count": 0, "failed_count": 0}, "分组无账号")

        # 构造 PublishContent
        content = PublishContent(
            format=body.format,
            title=body.title,
            text=body.text,
            file_path=body.file_path,
            cover_path=body.cover_path,
            html=body.html,
            images=body.images,
            extra=body.extra,
        )

        results: list[dict[str, Any]] = []
        success_count = 0
        for m in members:
            aid = m["account_id"]
            row = await conn.fetchrow(
                "SELECT platform, credentials_enc, display_name FROM publish_accounts WHERE id=$1 AND user_id=$2",
                aid, user_id,
            )
            if not row:
                results.append({"account_id": aid, "success": False, "error": "账号不存在或不归属"})
                continue
            try:
                credentials = decrypt(row["credentials_enc"])
                adapter = get_adapter(row["platform"])
                if adapter is None:
                    results.append({"account_id": aid, "platform": row["platform"], "success": False, "error": "未找到适配器"})
                    continue
                result = await adapter.publish(content, credentials, body.platform_config)
                if result.success:
                    success_count += 1
                    results.append({
                        "account_id": aid, "platform": row["platform"], "success": True,
                        "published_url": result.published_url,
                        "platform_content_id": result.platform_content_id,
                    })
                else:
                    results.append({
                        "account_id": aid, "platform": row["platform"], "success": False,
                        "error": result.error_message or "发布失败",
                    })
            except Exception as e:
                logger.exception("[publish_to_group] account=%s failed", aid)
                results.append({
                    "account_id": aid, "platform": row["platform"], "success": False,
                    "error": f"{type(e).__name__}: {e}",
                })

        failed_count = len(results) - success_count
        return _ok({
            "results": results,
            "success_count": success_count,
            "failed_count": failed_count,
            "total": len(results),
        }, f"发布完成:成功 {success_count} / 失败 {failed_count}")
    finally:
        await conn.close()


# =============================================================================
# 批量账号导入 / 导出 / 验证
# =============================================================================
@router.post("/accounts/batch-import")
async def batch_import(body: BatchImportRequest, request: Request) -> dict[str, Any]:
    """批量创建账号(前端解析 CSV 后传 rows 数组)。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        success_count = 0
        errors: list[dict[str, Any]] = []
        for idx, row in enumerate(body.rows):
            adapter = get_adapter(row.platform)
            if adapter is None:
                errors.append({"row": idx, "error": f"不支持的平台: {row.platform}"})
                continue
            try:
                cipher = encrypt(dict(row.credentials))
                await conn.execute(
                    """
                    INSERT INTO publish_accounts (user_id, platform, display_name, credentials_enc)
                    VALUES ($1, $2, $3, $4)
                    """,
                    user_id, row.platform, row.nickname or f"{row.platform}-{idx + 1}", cipher,
                )
                success_count += 1
            except asyncpg.UniqueViolationError:
                errors.append({"row": idx, "error": "账号已存在(同平台同昵称)"})
            except Exception as e:
                errors.append({"row": idx, "error": f"{type(e).__name__}: {e}"})
        return _ok({
            "success_count": success_count,
            "failed_count": len(errors),
            "errors": errors,
            "total": len(body.rows),
        }, f"导入完成:成功 {success_count} / 失败 {len(errors)}")
    finally:
        await conn.close()


@router.post("/accounts/batch-export")
async def batch_export(request: Request) -> dict[str, Any]:
    """导出当前用户所有账号为 CSV 字符串(凭证不导出,只导出 platform/nickname/status)。

    用 POST 而非 GET,避免与 GET /publish/accounts/{user_id} 路由冲突。
    """
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        rows = await conn.fetch(
            "SELECT platform, display_name, status FROM publish_accounts WHERE user_id=$1 ORDER BY created_at DESC",
            user_id,
        )
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["platform", "nickname", "status"])
        for r in rows:
            writer.writerow([r["platform"], r["display_name"] or "", r["status"]])
        return _ok({"csv": buf.getvalue(), "count": len(rows)})
    finally:
        await conn.close()


@router.post("/accounts/batch-verify")
async def batch_verify(request: Request) -> dict[str, Any]:
    """批量验证所有账号凭证(调各平台 adapter.verify_credentials)。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        rows = await conn.fetch(
            "SELECT id, platform, credentials_enc, display_name FROM publish_accounts WHERE user_id=$1 AND status='active'",
            user_id,
        )
        results: list[dict[str, Any]] = []
        verified = 0
        invalid = 0
        for r in rows:
            try:
                credentials = decrypt(r["credentials_enc"])
                adapter = get_adapter(r["platform"])
                if adapter is None:
                    invalid += 1
                    results.append({"account_id": r["id"], "platform": r["platform"], "valid": False, "message": "未找到适配器"})
                    continue
                ok, msg = await adapter.verify_credentials(credentials)
                # 更新 last_verified_at
                await conn.execute(
                    "UPDATE publish_accounts SET last_verified_at=NOW(), last_verify_msg=$1, status=$2 WHERE id=$3",
                    msg, "active" if ok else "expired", r["id"],
                )
                if ok:
                    verified += 1
                    results.append({"account_id": r["id"], "platform": r["platform"], "valid": True, "message": msg})
                else:
                    invalid += 1
                    results.append({"account_id": r["id"], "platform": r["platform"], "valid": False, "message": msg})
            except Exception as e:
                invalid += 1
                results.append({"account_id": r["id"], "platform": r["platform"], "valid": False, "message": f"{type(e).__name__}: {e}"})
        return _ok({
            "verified_count": verified,
            "invalid_count": invalid,
            "results": results,
            "total": len(rows),
        }, f"验证完成:有效 {verified} / 无效 {invalid}")
    finally:
        await conn.close()


# =============================================================================
# Cookie 健康度查询 + 手动触发保活
# =============================================================================
@router.get("/accounts/{account_id}/cookie-health")
async def get_cookie_health(account_id: int, request: Request) -> dict[str, Any]:
    """查询账号 Cookie 健康度(基于 last_verified_at 推算)。

    健康度等级:
    - healthy:    last_verified_at 在 7 天内
    - expiring:   7-14 天
    - expired:    > 14 天或从未验证
    """
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        row = await conn.fetchrow(
            "SELECT platform, display_name, status, last_verified_at, last_verify_msg, updated_at FROM publish_accounts WHERE id=$1 AND user_id=$2",
            account_id, user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="账号不存在")
        now = datetime.now(timezone.utc)
        last_verified = row["last_verified_at"]
        if last_verified:
            days_since = (now - last_verified).total_seconds() / 86400
        else:
            days_since = 999.0
        if days_since <= 7:
            level = "healthy"
        elif days_since <= 14:
            level = "expiring"
        else:
            level = "expired"
        # 预测过期时间(14 天阈值)
        predicted_expiry = (last_verified.timestamp() + 14 * 86400) if last_verified else None
        return _ok({
            "account_id": account_id,
            "platform": row["platform"],
            "level": level,
            "days_since_verified": round(days_since, 1) if last_verified else None,
            "last_verified_at": last_verified.isoformat() if last_verified else None,
            "predicted_expiry": datetime.fromtimestamp(predicted_expiry, tz=timezone.utc).isoformat() if predicted_expiry else None,
            "last_verify_msg": row["last_verify_msg"],
            "status": row["status"],
        })
    finally:
        await conn.close()


@router.post("/accounts/{account_id}/refresh-cookie")
async def refresh_cookie(account_id: int, request: Request) -> dict[str, Any]:
    """手动触发单个账号 Cookie 保活(委托 cookie_refresh_daemon)。"""
    user_id = _get_user_id(request)
    # 延迟 import 避免循环依赖
    from app.services.publish.cookie_refresh_daemon import cookie_daemon
    conn = await _get_conn()
    try:
        await _ensure_tables(conn)
        row = await conn.fetchrow(
            "SELECT platform, display_name FROM publish_accounts WHERE id=$1 AND user_id=$2",
            account_id, user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="账号不存在")
        result = await cookie_daemon.refresh_single(account_id, row["platform"])
        # 更新 last_verified_at
        if result.success:
            await conn.execute(
                "UPDATE publish_accounts SET last_verified_at=NOW(), last_verify_msg=$1 WHERE id=$2",
                result.message, account_id,
            )
        return _ok({
            "account_id": account_id,
            "platform": row["platform"],
            "success": result.success,
            "message": result.message,
        })
    finally:
        await conn.close()


# =============================================================================
# CSV 模板生成(供前端下载模板用)
# =============================================================================
@router.get("/accounts/batch-template")
async def batch_template(request: Request) -> dict[str, Any]:
    """返回 CSV 模板字符串(含 37 平台示例行,凭证字段留空)。"""
    from app.services.publish.base_adapter import list_all_adapter_classes
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["platform", "nickname", "credential_field1", "credential_field2", "credential_field3"])
    for cls in list_all_adapter_classes():
        creds = cls.requires_credentials
        # 补齐 3 列
        padded = (creds + ["", "", ""])[:3]
        writer.writerow([cls.platform_id, f"{cls.platform_name}示例", *padded])
    return _ok({"csv": buf.getvalue()})

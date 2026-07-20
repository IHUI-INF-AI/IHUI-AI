"""多平台一键发布 FastAPI 路由。

提供:
- GET    /publish/platforms            - 列出所有支持的平台元数据
- GET    /publish/accounts/{user_id}   - 列出用户的所有平台账号
- POST   /publish/accounts             - 创建账号(凭证加密后存 DB)
- PUT    /publish/accounts/{account_id} - 更新账号
- DELETE /publish/accounts/{account_id} - 删除账号
- POST   /publish/accounts/{account_id}/verify - 测试连接
- POST   /publish/tasks                - 创建发布任务(立即执行或定时)
- GET    /publish/tasks                - 列出任务
- GET    /publish/tasks/{task_id}      - 任务详情
- POST   /publish/tasks/{task_id}/cancel  - 取消任务
- POST   /publish/tasks/{task_id}/retry  - 重试失败平台
- GET    /publish/history              - 历史记录
- GET    /publish/stats                - 统计

DB 表(由 scheduler 自动建表):
- publish_tasks:    任务主表
- publish_history:  单平台执行历史
- publish_accounts: 平台账号(凭证加密)
- publish_notifications: 通知表

参考实现:app/routers/self_media.py(asyncpg 直连,不走 ORM)
"""
from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import get_logger
from app.services.publish.base_adapter import (
    PublishContent,
    get_adapter,
    list_all_adapter_classes,
)
from app.services.publish.credentials_crypto import decrypt, encrypt, generate_key_b64
from app.services.publish.scheduler import publish_scheduler

logger = get_logger(__name__)

router = APIRouter(prefix="/publish", tags=["publish"])


# ===== DB 工具 =====

async def _get_conn() -> asyncpg.Connection:
    dsn = getattr(settings, "database_url", None)
    if not dsn:
        raise HTTPException(status_code=503, detail="DATABASE_URL not configured")
    try:
        return await asyncpg.connect(dsn=dsn)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"db connect failed: {type(e).__name__}: {e}")


async def _ensure_accounts_table(conn: asyncpg.Connection) -> None:
    """确保 publish_accounts 表存在。"""
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
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_publish_accounts_user_id ON publish_accounts(user_id)"
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_publish_accounts_platform ON publish_accounts(platform)"
    )


def _serialize_account(row: asyncpg.Record, include_credentials: bool = False) -> dict[str, Any]:
    """序列化账号记录为 JSON 友好格式。"""
    out: dict[str, Any] = {
        "id": row["id"],
        "userId": row["user_id"],
        "platform": row["platform"],
        "displayName": row["display_name"],
        "status": row["status"],
        "lastVerifiedAt": row["last_verified_at"].isoformat() if row["last_verified_at"] else None,
        "lastVerifyMsg": row["last_verify_msg"],
        "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
        "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
    if include_credentials:
        try:
            out["credentials"] = decrypt(row["credentials_enc"])
        except Exception as e:
            out["credentials"] = {"_decrypt_error": str(e)}
    return out


# ===== Pydantic 模型 =====

class AccountCreate(BaseModel):
    user_id: str = Field(..., max_length=64)
    platform: str = Field(..., max_length=32)
    display_name: str = Field(default="", max_length=255)
    credentials: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)


class AccountUpdate(BaseModel):
    display_name: Optional[str] = None
    credentials: Optional[dict[str, Any]] = None
    status: Optional[str] = None  # 'active' / 'disabled'
    extra: Optional[dict[str, Any]] = None


class PublishTarget(BaseModel):
    platform: str
    account_id: int
    config: dict[str, Any] = Field(default_factory=dict)


class TaskCreate(BaseModel):
    user_id: str = Field(..., max_length=64)
    title: str = Field(..., max_length=500)
    format: str = Field(..., pattern=r"^(md|docx|html|pdf|image|video)$")
    text: Optional[str] = Field(default=None, description="md/html 文本内容")
    file_path: Optional[str] = Field(default=None, description="docx/pdf/image/video 文件路径")
    cover_path: Optional[str] = Field(default=None, description="封面图路径")
    images: list[str] = Field(default_factory=list, description="内容中引用的图片路径列表")
    extra: dict[str, Any] = Field(default_factory=dict)
    targets: list[PublishTarget]
    scheduled_at: Optional[datetime] = Field(default=None, description="定时发布时间(UTC),空则立即执行")


# ===== 平台元数据 =====

@router.get("/platforms")
async def list_platforms() -> dict[str, Any]:
    """列出所有支持的平台元数据。"""
    items = []
    for cls in list_all_adapter_classes():
        items.append({
            "platformId": cls.platform_id,
            "platformName": cls.platform_name,
            "supportedFormats": cls.supported_formats,
            "requiresCredentials": cls.requires_credentials,
            "needsBrowser": cls.needs_browser,
        })
    return {"items": items, "count": len(items)}


# ===== 账号管理 =====

@router.get("/accounts/{user_id}")
async def list_accounts(
    user_id: str,
    platform: Optional[str] = Query(default=None),
) -> dict[str, Any]:
    """列出用户的所有平台账号。"""
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        if platform:
            rows = await conn.fetch(
                "SELECT * FROM publish_accounts WHERE user_id=$1 AND platform=$2 ORDER BY created_at DESC",
                user_id, platform,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM publish_accounts WHERE user_id=$1 ORDER BY created_at DESC",
                user_id,
            )
        items = [_serialize_account(r, include_credentials=False) for r in rows]
        return {"items": items, "count": len(items)}
    finally:
        await conn.close()


@router.post("/accounts")
async def create_account(body: AccountCreate) -> dict[str, Any]:
    """创建账号(凭证 AES-256-GCM 加密后存 DB)。"""
    # 验证平台 ID 合法
    adapter = get_adapter(body.platform)
    if adapter is None:
        raise HTTPException(status_code=400, detail=f"unsupported platform: {body.platform}")

    # 加密凭证
    try:
        cipher = encrypt(body.credentials)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"encrypt failed: {type(e).__name__}: {e}")

    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        row = await conn.fetchrow(
            """
            INSERT INTO publish_accounts (user_id, platform, display_name, credentials_enc, extra)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING *
            """,
            body.user_id,
            body.platform,
            body.display_name,
            cipher,
            json.dumps(body.extra, ensure_ascii=False),
        )
        return {"ok": True, "account": _serialize_account(row)}
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="account already exists (same user_id+platform+display_name)")
    finally:
        await conn.close()


@router.put("/accounts/{account_id}")
async def update_account(account_id: int, body: AccountUpdate) -> dict[str, Any]:
    """更新账号(支持 display_name / credentials / status / extra)。"""
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        # 取现有记录
        existing = await conn.fetchrow("SELECT * FROM publish_accounts WHERE id=$1", account_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")

        # 构造 update 字段
        sets: list[str] = []
        args: list[Any] = []
        idx = 1
        if body.display_name is not None:
            sets.append(f"display_name=${idx}")
            args.append(body.display_name)
            idx += 1
        if body.credentials is not None:
            try:
                cipher = encrypt(body.credentials)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"encrypt failed: {e}")
            sets.append(f"credentials_enc=${idx}")
            args.append(cipher)
            idx += 1
        if body.status is not None:
            if body.status not in ("active", "disabled"):
                raise HTTPException(status_code=400, detail="status must be 'active' or 'disabled'")
            sets.append(f"status=${idx}")
            args.append(body.status)
            idx += 1
        if body.extra is not None:
            sets.append(f"extra=${idx}::jsonb")
            args.append(json.dumps(body.extra, ensure_ascii=False))
            idx += 1

        if not sets:
            return {"ok": True, "account": _serialize_account(existing), "note": "no fields to update"}

        sets.append(f"updated_at=NOW()")
        args.append(account_id)
        sql = f"UPDATE publish_accounts SET {', '.join(sets)} WHERE id=${idx} RETURNING *"
        row = await conn.fetchrow(sql, *args)
        return {"ok": True, "account": _serialize_account(row)}
    finally:
        await conn.close()


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: int) -> dict[str, Any]:
    """删除账号(软删除:status=disabled)。"""
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        result = await conn.execute(
            "UPDATE publish_accounts SET status='disabled', updated_at=NOW() WHERE id=$1",
            account_id,
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")
        return {"ok": True, "id": account_id, "status": "disabled"}
    finally:
        await conn.close()


@router.post("/accounts/{account_id}/verify")
async def verify_account(account_id: int) -> dict[str, Any]:
    """测试连接(调真实平台 API 验证凭证)。"""
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        row = await conn.fetchrow("SELECT * FROM publish_accounts WHERE id=$1", account_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")
        if row["status"] != "active":
            raise HTTPException(status_code=400, detail=f"account is disabled: {row['status']}")

        # 解密凭证
        try:
            credentials = decrypt(row["credentials_enc"])
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"decrypt failed: {e}")

        # 取适配器
        adapter = get_adapter(row["platform"])
        if adapter is None:
            raise HTTPException(status_code=400, detail=f"adapter not found: {row['platform']}")

        # 真实验证
        ok, msg = await adapter.verify_credentials(credentials)
        # 写回验证结果
        await conn.execute(
            """
            UPDATE publish_accounts
            SET last_verified_at=NOW(), last_verify_msg=$2, updated_at=NOW()
            WHERE id=$1
            """,
            account_id,
            f"{'OK' if ok else 'FAIL'}: {msg}"[:500],
        )
        return {"ok": ok, "message": msg, "platform": row["platform"], "accountId": account_id}
    finally:
        await conn.close()


# ===== 任务管理 =====

@router.post("/tasks")
async def create_task(body: TaskCreate) -> dict[str, Any]:
    """创建发布任务(立即执行或定时)。"""
    if not body.targets:
        raise HTTPException(status_code=400, detail="targets cannot be empty")

    # 验证所有目标平台合法
    for t in body.targets:
        if get_adapter(t.platform) is None:
            raise HTTPException(status_code=400, detail=f"unsupported platform: {t.platform}")

    # 构造 PublishContent
    content = PublishContent(
        format=body.format,
        title=body.title,
        text=body.text,
        file_path=body.file_path,
        cover_path=body.cover_path,
        images=body.images,
        extra=body.extra,
    )

    # 检查文件路径存在(docx/pdf/image/video)
    if body.file_path:
        p = Path(body.file_path)
        if not p.is_file():
            raise HTTPException(status_code=400, detail=f"file not found: {body.file_path}")

    task_id = f"pub-{uuid.uuid4().hex[:12]}-{int(time.time())}"
    targets_dicts = [t.model_dump() for t in body.targets]

    result = await publish_scheduler.submit_task(
        task_id=task_id,
        user_id=body.user_id,
        content=content,
        targets=targets_dicts,
        scheduled_at=body.scheduled_at,
    )
    return result


@router.get("/tasks")
async def list_tasks(
    user_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """列出任务(支持 user_id / status 过滤 + 分页)。"""
    conn = await _get_conn()
    try:
        conditions = []
        args: list[Any] = []
        idx = 1
        if user_id:
            conditions.append(f"user_id=${idx}")
            args.append(user_id)
            idx += 1
        if status:
            conditions.append(f"status=${idx}")
            args.append(status)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        args.extend([limit, offset])
        rows = await conn.fetch(
            f"""
            SELECT id, task_id, user_id, title, format, status,
                   scheduled_at, started_at, finished_at,
                   (SELECT count(*) FROM publish_history WHERE task_id = t.task_id) as platform_count,
                   error, created_at, updated_at
            FROM publish_tasks t
            {where}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *args,
        )
        items = [
            {
                "id": r["id"],
                "taskId": r["task_id"],
                "userId": r["user_id"],
                "title": r["title"],
                "format": r["format"],
                "status": r["status"],
                "scheduledAt": r["scheduled_at"].isoformat() if r["scheduled_at"] else None,
                "startedAt": r["started_at"].isoformat() if r["started_at"] else None,
                "finishedAt": r["finished_at"].isoformat() if r["finished_at"] else None,
                "platformCount": r["platform_count"],
                "error": r["error"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
        return {"items": items, "count": len(items), "limit": limit, "offset": offset}
    finally:
        await conn.close()


@router.get("/tasks/{task_id}")
async def get_task(task_id: str) -> dict[str, Any]:
    """任务详情(含每个平台的结果)。"""
    conn = await _get_conn()
    try:
        task = await conn.fetchrow("SELECT * FROM publish_tasks WHERE task_id=$1", task_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"task not found: {task_id}")

        # 取该任务下所有平台执行历史
        history_rows = await conn.fetch(
            """
            SELECT id, platform, success, published_url, platform_content_id,
                   error_message, duration_ms, created_at
            FROM publish_history WHERE task_id=$1 ORDER BY created_at ASC
            """,
            task_id,
        )
        platforms = [
            {
                "id": r["id"],
                "platform": r["platform"],
                "success": r["success"],
                "publishedUrl": r["published_url"],
                "platformContentId": r["platform_content_id"],
                "errorMessage": r["error_message"],
                "durationMs": r["duration_ms"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in history_rows
        ]

        results = task["results"] if isinstance(task["results"], list) else []
        return {
            "taskId": task["task_id"],
            "userId": task["user_id"],
            "title": task["title"],
            "format": task["format"],
            "status": task["status"],
            "content": task["content"],
            "targets": task["targets"],
            "results": results,
            "platforms": platforms,
            "scheduledAt": task["scheduled_at"].isoformat() if task["scheduled_at"] else None,
            "startedAt": task["started_at"].isoformat() if task["started_at"] else None,
            "finishedAt": task["finished_at"].isoformat() if task["finished_at"] else None,
            "error": task["error"],
            "createdAt": task["created_at"].isoformat() if task["created_at"] else None,
        }
    finally:
        await conn.close()


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str) -> dict[str, Any]:
    """取消任务(只能取消正在执行的)。"""
    # 先从内存 running 集合取消
    cancelled = await publish_scheduler.cancel_task(task_id)
    if cancelled:
        return {"ok": True, "taskId": task_id, "status": "cancelled"}

    # 任务可能已完成或未在内存中,查 DB 标记
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT status FROM publish_tasks WHERE task_id=$1", task_id
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
        if row["status"] in ("success", "failed", "partial"):
            return {"ok": False, "taskId": task_id, "status": row["status"],
                    "error": "task already finished, cannot cancel"}
        # 标记为 cancelled
        await conn.execute(
            "UPDATE publish_tasks SET status='cancelled', finished_at=NOW(), updated_at=NOW() WHERE task_id=$1",
            task_id,
        )
        return {"ok": True, "taskId": task_id, "status": "cancelled"}
    finally:
        await conn.close()


@router.post("/tasks/{task_id}/retry")
async def retry_task(task_id: str, platforms: Optional[list[str]] = None) -> dict[str, Any]:
    """重试失败的平台。

    Body 可选:{"platforms": ["wordpress", "medium"]} - 仅重试指定平台
    不传 platforms → 重试所有失败平台
    """
    result = await publish_scheduler.retry_platforms(task_id, platforms)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "retry failed"))
    return result


# ===== 历史记录 =====

@router.get("/history")
async def list_history(
    user_id: Optional[str] = Query(default=None),
    task_id: Optional[str] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    """历史记录(单平台粒度)。"""
    conn = await _get_conn()
    try:
        conditions = []
        args: list[Any] = []
        idx = 1
        if user_id:
            conditions.append(f"user_id=${idx}")
            args.append(user_id)
            idx += 1
        if task_id:
            conditions.append(f"task_id=${idx}")
            args.append(task_id)
            idx += 1
        if platform:
            conditions.append(f"platform=${idx}")
            args.append(platform)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        args.append(limit)
        rows = await conn.fetch(
            f"""
            SELECT id, task_id, user_id, platform, success, published_url,
                   platform_content_id, error_message, duration_ms,
                   created_at
            FROM publish_history
            {where}
            ORDER BY created_at DESC
            LIMIT ${idx}
            """,
            *args,
        )
        items = [
            {
                "id": r["id"],
                "taskId": r["task_id"],
                "userId": r["user_id"],
                "platform": r["platform"],
                "success": r["success"],
                "publishedUrl": r["published_url"],
                "platformContentId": r["platform_content_id"],
                "errorMessage": r["error_message"],
                "durationMs": r["duration_ms"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
        return {"items": items, "count": len(items)}
    finally:
        await conn.close()


# ===== 统计 =====

@router.get("/stats")
async def get_stats(
    user_id: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
) -> dict[str, Any]:
    """统计(指定时间段内)。

    返回:
    - 任务总数 / 成功 / 失败 / 部分成功
    - 平台执行成功次数 / 失败次数 / 平均耗时
    - 最近 N 天每日任务数
    """
    conn = await _get_conn()
    try:
        # 时间范围
        since = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        from datetime import timedelta
        since = since - timedelta(days=days)

        # 任务总览
        if user_id:
            task_stats = await conn.fetchrow(
                """
                SELECT
                    count(*) as total,
                    count(*) FILTER (WHERE status='success') as success,
                    count(*) FILTER (WHERE status='failed') as failed,
                    count(*) FILTER (WHERE status='partial') as partial,
                    count(*) FILTER (WHERE status='cancelled') as cancelled,
                    count(*) FILTER (WHERE status='running') as running,
                    count(*) FILTER (WHERE status='scheduled') as scheduled
                FROM publish_tasks
                WHERE user_id=$1 AND created_at >= $2
                """,
                user_id, since,
            )
        else:
            task_stats = await conn.fetchrow(
                """
                SELECT
                    count(*) as total,
                    count(*) FILTER (WHERE status='success') as success,
                    count(*) FILTER (WHERE status='failed') as failed,
                    count(*) FILTER (WHERE status='partial') as partial,
                    count(*) FILTER (WHERE status='cancelled') as cancelled,
                    count(*) FILTER (WHERE status='running') as running,
                    count(*) FILTER (WHERE status='scheduled') as scheduled
                FROM publish_tasks
                WHERE created_at >= $1
                """,
                since,
            )

        # 平台统计
        if user_id:
            platform_rows = await conn.fetch(
                """
                SELECT platform,
                       count(*) as total,
                       count(*) FILTER (WHERE success) as success,
                       count(*) FILTER (WHERE NOT success) as failed,
                       COALESCE(avg(duration_ms), 0) as avg_ms
                FROM publish_history
                WHERE user_id=$1 AND created_at >= $2
                GROUP BY platform ORDER BY total DESC
                """,
                user_id, since,
            )
        else:
            platform_rows = await conn.fetch(
                """
                SELECT platform,
                       count(*) as total,
                       count(*) FILTER (WHERE success) as success,
                       count(*) FILTER (WHERE NOT success) as failed,
                       COALESCE(avg(duration_ms), 0) as avg_ms
                FROM publish_history
                WHERE created_at >= $1
                GROUP BY platform ORDER BY total DESC
                """,
                since,
            )

        platforms = [
            {
                "platform": r["platform"],
                "total": r["total"],
                "success": r["success"],
                "failed": r["failed"],
                "avgMs": int(r["avg_ms"]),
                "successRate": round(r["success"] / r["total"], 4) if r["total"] > 0 else 0,
            }
            for r in platform_rows
        ]

        return {
            "since": since.isoformat(),
            "days": days,
            "tasks": {
                "total": task_stats["total"],
                "success": task_stats["success"],
                "failed": task_stats["failed"],
                "partial": task_stats["partial"],
                "cancelled": task_stats["cancelled"],
                "running": task_stats["running"],
                "scheduled": task_stats["scheduled"],
            },
            "platforms": platforms,
            "runningTasks": publish_scheduler.list_running(),
        }
    finally:
        await conn.close()


# ===== 调试工具 =====

@router.get("/credentials-key/generate")
async def gen_credentials_key() -> dict[str, str]:
    """生成一个新的 AES-256 密钥(base64),供用户初始化 PUBLISH_CREDENTIALS_KEY 用。

    注意:此端点仅供初始化时使用,生产环境应通过环境变量配置密钥,不调用此端点。
    """
    return {"key": generate_key_b64(), "note": "Set as PUBLISH_CREDENTIALS_KEY env var"}


@router.get("/running")
async def list_running_tasks() -> dict[str, Any]:
    """列出当前正在执行的任务(内存)。"""
    return {"running": publish_scheduler.list_running(), "history": publish_scheduler.list_history(limit=20)}

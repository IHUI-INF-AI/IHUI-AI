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
- POST   /publish/upload               - 上传内容文件(docx/pdf/image/video)

DB 表(由 scheduler 自动建表):
- publish_tasks:    任务主表
- publish_history:  单平台执行历史
- publish_accounts: 平台账号(凭证加密)
- publish_notifications: 通知表

参考实现:app/routers/self_media.py(asyncpg 直连,不走 ORM)
"""
from __future__ import annotations

import csv
import io
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.db import get_db_conn
from app.core.logging import get_logger
from app.services.publish.ai_assistant import ai_writing_service
from app.services.publish.base_adapter import (
    PublishContent,
    get_adapter,
    list_all_adapter_classes,
)
from app.services.publish.credentials_crypto import decrypt, encrypt, generate_key_b64
from app.services.publish.scheduler import publish_scheduler

logger = get_logger(__name__)

router = APIRouter(prefix="/publish", tags=["publish"])


def _wrap_ok(data: Any, message: str = "success") -> dict[str, Any]:
    """统一 {code, message, data} 响应信封(AGENTS.md §5 项目约定)。

    前端 packages/api-client 的 fetchApi(fetchOnce) 强制检查 json.code === 0,
    非 0 视为业务失败。所有成功响应必须包裹本函数,否则前端收到裸 dict
    (无 code 字段)会被判为失败,表现为列表页"请求失败"、筛选无数据。
    与 llm.py / ai_skills 等已合规路由保持同一信封格式。
    """
    return {"code": 0, "message": message, "data": data}


def _error_json(message: str, status_code: int, **extra: Any) -> JSONResponse:
    """统一错误响应信封(带 message 字段,供 fetchApi 的 fetchOnce 提取错误信息)。"""
    payload: dict[str, Any] = {"code": 1, "message": message}
    payload.update(extra)
    return JSONResponse(status_code=status_code, content=payload)


# ===== DB 工具 =====

async def _get_conn() -> asyncpg.Connection:
    dsn = getattr(settings, "database_url", None)
    if not dsn:
        raise HTTPException(status_code=503, detail="DATABASE_URL not configured")
    try:
        return await get_db_conn()
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


def _get_user_id(request: Request) -> str:
    """从 request.state 取当前登录用户 ID(JWTAuthMiddleware 注入)。

    IDOR 修复(2026-07-27):所有 publish 端点必须经此函数取用户身份,
    禁止从请求体/查询参数/路径参数取 user_id。JWT 缺失返回 401。
    """
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="未登录")
    return str(uid)


# ===== Pydantic 模型 =====

class AccountCreate(BaseModel):
    # IDOR 修复:user_id 移除,从 JWT(request.state.user_id)取。
    # 客户端若仍传 user_id,Pydantic 默认 extra='ignore' 会忽略,保持兼容。
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
    # IDOR 修复:user_id 移除,从 JWT(request.state.user_id)取。
    # 客户端若仍传 user_id,Pydantic 默认 extra='ignore' 会忽略,保持兼容。
    title: str = Field(..., max_length=500)
    format: str = Field(..., pattern=r"^(md|docx|html|pdf|image|video)$")
    text: Optional[str] = Field(default=None, description="md/html 文本内容")
    file_path: Optional[str] = Field(default=None, description="docx/pdf/image/video 文件路径")
    cover_path: Optional[str] = Field(default=None, description="封面图路径")
    images: list[str] = Field(default_factory=list, description="内容中引用的图片路径列表")
    extra: dict[str, Any] = Field(default_factory=dict)
    targets: list[PublishTarget]
    scheduled_at: Optional[datetime] = Field(default=None, description="定时发布时间(UTC),空则立即执行")


class RescheduleRequest(BaseModel):
    """改期请求体(2026-08-17 新增)。"""

    scheduled_at: datetime = Field(..., description="新的定时发布时间(ISO8601 UTC)")


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
    return _wrap_ok({"items": items, "count": len(items)})


# ===== 文件上传 =====

# 允许的文件扩展名(按格式分类)
_ALLOWED_EXTENSIONS = {
    "docx": {".docx"},
    "pdf": {".pdf"},
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"},
    "video": {".mp4", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".webm"},
    "md": {".md", ".markdown"},
    "html": {".html", ".htm"},
}

# 单文件最大 200MB(视频可能较大)
_MAX_FILE_SIZE = 200 * 1024 * 1024

# 上传根目录(可被 PUBLISH_UPLOAD_DIR 环境变量覆盖,默认 .uploads/publish)
def _upload_root() -> Path:
    raw = settings.publish_upload_dir
    if raw:
        p = Path(raw)
    else:
        # 默认放 ai-service 工作目录下 .uploads/publish(已在 .gitignore)
        p = Path.cwd() / ".uploads" / "publish"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _detect_format(filename: str) -> str:
    """根据文件扩展名判定格式。返回 docx/pdf/image/video/md/html 之一,未知返回空串。"""
    suffix = Path(filename).suffix.lower()
    for fmt, exts in _ALLOWED_EXTENSIONS.items():
        if suffix in exts:
            return fmt
    return ""


def _resolve_allowed_file(raw: str) -> Path:
    """P1 修复(2026-08-06): 校验文件路径解析后必须位于上传根目录内。

    禁止 `..` 穿越 / 绝对路径逃逸,防止用户传入任意服务器路径被读取并外发到平台。
    """
    if not raw:
        raise HTTPException(status_code=400, detail="路径不能为空")
    try:
        real = Path(raw).expanduser().resolve(strict=False)
    except Exception:
        real = Path(os.path.realpath(raw))
    root = _upload_root().resolve()
    if real != root and not real.is_relative_to(root):
        raise HTTPException(
            status_code=403,
            detail=f"文件路径不在允许的上传目录内: {raw}",
        )
    return real


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(..., description="要上传的文件(docx/pdf/image/video/md/html)"),
) -> dict[str, Any]:
    """上传内容文件,返回服务器存储路径 + 解析后的 format。

    IDOR 修复:user_id 不再从 Query 取,改从 JWT(request.state.user_id)取。

    存储路径:`<upload_root>/<user_id>/<yyyymmdd>/<uuid><ext>`

    返回:
    ```json
    {
      "ok": true,
      "file_path": "/abs/path/to/saved/file.docx",
      "filename": "原始文件名.docx",
      "format": "docx",
      "size": 12345,
      "content_type": "application/vnd.openxmlformats..."
    }
    ```
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份

    if not file.filename:
        raise HTTPException(status_code=400, detail="filename is required")

    fmt = _detect_format(file.filename)
    if not fmt:
        allowed = ", ".join(sorted({e for exts in _ALLOWED_EXTENSIONS.values() for e in exts}))
        raise HTTPException(
            status_code=400,
            detail=f"unsupported file extension: {Path(file.filename).suffix}. allowed: {allowed}",
        )

    # 读取内容并检查大小
    content_bytes = await file.read()
    size = len(content_bytes)
    if size == 0:
        raise HTTPException(status_code=400, detail="file is empty")
    if size > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"file too large: {size} bytes > max {_MAX_FILE_SIZE} bytes (200MB)",
        )

    # 构造存储路径(user_id 已由 JWT 校验,必定非空)
    user_dir = "".join(c for c in user_id if c.isalnum() or c in "-_") or "anonymous"
    yyyymmdd = datetime.now(timezone.utc).strftime("%Y%m%d")
    unique = uuid.uuid4().hex[:16]
    suffix = Path(file.filename).suffix.lower()
    # 安全文件名(去除路径分隔符)
    safe_name = "".join(c for c in Path(file.filename).stem if c.isalnum() or c in "-_")[:50] or "file"
    save_dir = _upload_root() / user_dir / yyyymmdd
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / f"{safe_name}_{unique}{suffix}"

    # 写入磁盘
    try:
        with save_path.open("wb") as f:
            f.write(content_bytes)
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"failed to write file: {type(e).__name__}: {e}",
        )

    logger.info(
        "[publish.upload] user=%s filename=%s format=%s size=%d saved=%s",
        user_dir,
        file.filename,
        fmt,
        size,
        save_path,
    )

    return _wrap_ok({
        "ok": True,
        "file_path": str(save_path),
        "filename": file.filename,
        "format": fmt,
        "size": size,
        "content_type": file.content_type or "",
    })


# ===== 账号管理 =====

# 2026-08-17 修复:batch-template 静态路由必须在 /accounts/{user_id} 参数路由之前注册
# (FastAPI 按注册顺序匹配,原定义在 account_groups.py 中后注册,被参数路由劫持 → 模板永远返回
#  list_accounts 格式 {items:[],count:0},前端拿不到 CSV)。
@router.get("/accounts/batch-template")
async def batch_template() -> dict[str, Any]:
    """返回 CSV 模板字符串(含全部平台示例行,凭证字段留空)。"""
    from app.services.publish.base_adapter import list_all_adapter_classes

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["platform", "nickname", "credential_field1", "credential_field2", "credential_field3"])
    for cls in list_all_adapter_classes():
        creds = cls.requires_credentials
        # 补齐 3 列
        padded = (creds + ["", "", ""])[:3]
        writer.writerow([cls.platform_id, f"{cls.platform_name}示例", *padded])
    return _wrap_ok({"csv": buf.getvalue()})


@router.get("/accounts/{user_id}")
async def list_accounts(
    request: Request,
    user_id: str,
    platform: Optional[str] = Query(default=None),
) -> dict[str, Any]:
    """列出用户的所有平台账号。

    IDOR 修复:路径参数 user_id 仅保留以维持路由契约,实际身份从 JWT 取,
    忽略客户端传入的任意 user_id,防止越权查询他人账号。
    """
    current_user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份,忽略路径 user_id
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        if platform:
            rows = await conn.fetch(
                "SELECT * FROM publish_accounts WHERE user_id=$1 AND platform=$2 ORDER BY created_at DESC",
                current_user_id, platform,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM publish_accounts WHERE user_id=$1 ORDER BY created_at DESC",
                current_user_id,
            )
        items = [_serialize_account(r, include_credentials=False) for r in rows]
        return _wrap_ok({"items": items, "count": len(items)})
    finally:
        await conn.close()


@router.post("/accounts")
async def create_account(body: AccountCreate, request: Request) -> dict[str, Any]:
    """创建账号(凭证 AES-256-GCM 加密后存 DB)。

    IDOR 修复:user_id 从 JWT 取,不再信任请求体。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份

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
            user_id,
            body.platform,
            body.display_name,
            cipher,
            json.dumps(body.extra, ensure_ascii=False),
        )
        return _wrap_ok({"ok": True, "account": _serialize_account(row)})
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="account already exists (same user_id+platform+display_name)")
    finally:
        await conn.close()


@router.put("/accounts/{account_id}")
async def update_account(account_id: int, body: AccountUpdate, request: Request) -> dict[str, Any]:
    """更新账号(支持 display_name / credentials / status / extra)。

    IDOR 修复:校验账号归属,禁止操作他人账号。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        # 取现有记录
        existing = await conn.fetchrow("SELECT * FROM publish_accounts WHERE id=$1", account_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")
        # IDOR 修复:校验账号归属
        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="无权操作他人账号")

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
            return _wrap_ok({"ok": True, "account": _serialize_account(existing), "note": "no fields to update"})

        sets.append(f"updated_at=NOW()")
        args.append(account_id)
        sql = f"UPDATE publish_accounts SET {', '.join(sets)} WHERE id=${idx} RETURNING *"
        row = await conn.fetchrow(sql, *args)
        return _wrap_ok({"ok": True, "account": _serialize_account(row)})
    finally:
        await conn.close()


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: int, request: Request) -> dict[str, Any]:
    """删除账号(软删除:status=disabled)。

    IDOR 修复:校验账号归属,禁止操作他人账号。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        # IDOR 修复:先校验归属再删除(带 user_id 条件,防止越权)
        existing = await conn.fetchrow(
            "SELECT id FROM publish_accounts WHERE id=$1 AND user_id=$2",
            account_id, user_id,
        )
        if not existing:
            # 不存在或不归属当前用户:统一返回 404(不泄露账号是否存在)
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")
        result = await conn.execute(
            "UPDATE publish_accounts SET status='disabled', updated_at=NOW() WHERE id=$1 AND user_id=$2",
            account_id, user_id,
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")
        return _wrap_ok({"ok": True, "id": account_id, "status": "disabled"})
    finally:
        await conn.close()


@router.post("/accounts/{account_id}/verify")
async def verify_account(account_id: int, request: Request) -> dict[str, Any]:
    """测试连接(调真实平台 API 验证凭证)。

    IDOR 修复:校验账号归属,禁止触发他人账号验证(避免凭证泄露/误用)。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        row = await conn.fetchrow("SELECT * FROM publish_accounts WHERE id=$1", account_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")
        # IDOR 修复:校验账号归属
        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="无权操作他人账号")
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
        return _wrap_ok({"ok": ok, "message": msg, "platform": row["platform"], "accountId": account_id})
    finally:
        await conn.close()


# ===== 任务管理 =====

@router.post("/tasks")
async def create_task(body: TaskCreate, request: Request) -> dict[str, Any]:
    """创建发布任务(立即执行或定时)。

    IDOR 修复:user_id 从 JWT 取,不再信任请求体。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份

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
    # P1 修复(2026-08-06): 校验 file_path/cover_path/images 均须位于上传根目录内,
    # 防止路径穿越读取任意服务器文件并外发到平台。
    if body.file_path:
        resolved_file = _resolve_allowed_file(body.file_path)
        if not resolved_file.is_file():
            raise HTTPException(status_code=400, detail=f"file not found: {body.file_path}")
        body.file_path = str(resolved_file)
    if body.cover_path:
        resolved_cover = _resolve_allowed_file(body.cover_path)
        if not resolved_cover.is_file():
            raise HTTPException(status_code=400, detail=f"cover not found: {body.cover_path}")
        body.cover_path = str(resolved_cover)
    # images 列表可能是本地路径(须校验)或外链 URL(下载时另有 SSRF 防护)
    checked_images: list[str] = []
    for img in body.images:
        if img.startswith(("http://", "https://")):
            checked_images.append(img)
            continue
        resolved_img = _resolve_allowed_file(img)
        if not resolved_img.is_file():
            raise HTTPException(status_code=400, detail=f"image not found: {img}")
        checked_images.append(str(resolved_img))
    body.images = checked_images

    task_id = f"pub-{uuid.uuid4().hex[:12]}-{int(time.time())}"
    targets_dicts = [t.model_dump() for t in body.targets]

    result = await publish_scheduler.submit_task(
        task_id=task_id,
        user_id=user_id,
        content=content,
        targets=targets_dicts,
        scheduled_at=body.scheduled_at,
    )
    return _wrap_ok(result)


def _json_or_raw(v: Any) -> Any:
    """asyncpg 对 JSONB 列默认返回 JSON 字符串(未注册 codec)。

    兼容解析:str → json.loads;解析失败/非 str 原样返回。
    """
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return v
    return v


def _serialize_targets(raw: Any) -> Any:
    """targets 由 DB JSONB(account_id, snake_case)输出为 camelCase(accountId)。

    2026-08-17 修复:前端/analytics(publish-analytics.ts)按 accountId 读取,
    原样输出 account_id 导致 activeAccounts/账号健康度恒空、前端 fallback 拿不到账号 id。
    仅 API 输出层转换,DB 原始 JSONB 与 scheduler 内部读取不受影响。
    """
    targets = _json_or_raw(raw)
    if not isinstance(targets, list):
        return targets
    out: list[Any] = []
    for t in targets:
        if not isinstance(t, dict):
            out.append(t)
            continue
        item = dict(t)
        if "account_id" in item and "accountId" not in item:
            item["accountId"] = item.pop("account_id")
        out.append(item)
    return out


def _serialize_results_to_platforms(results: Any) -> list[dict[str, Any]]:
    """把 publish_tasks.results(JSONB,snake_case)映射为 camelCase platforms 数组。

    results 元素结构(scheduler._run_task 写入):
        {platform, success, published_url, platform_content_id, error_message, duration_ms}
    映射为 get_task 的 platforms 字段一致的结构:
        {platform, success, publishedUrl, platformContentId, errorMessage, durationMs}
    results 为 null / 非 list / 元素非 dict 时跳过,返回 []。
    """
    results = _json_or_raw(results)
    if not isinstance(results, list):
        return []
    platforms: list[dict[str, Any]] = []
    for r in results:
        if not isinstance(r, dict):
            continue
        platforms.append({
            "platform": r.get("platform"),
            "success": bool(r.get("success", False)),
            "publishedUrl": r.get("published_url"),
            "platformContentId": r.get("platform_content_id"),
            "errorMessage": r.get("error_message"),
            "durationMs": r.get("duration_ms"),
        })
    return platforms


@router.get("/tasks")
async def list_tasks(
    request: Request,
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """列出任务(支持 status 过滤 + 分页)。

    IDOR 修复:user_id 不再从 Query 取,强制用 JWT 身份,只能看自己的任务。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        conditions = [f"user_id=$1"]
        args: list[Any] = [user_id]
        idx = 2
        if status:
            conditions.append(f"status=${idx}")
            args.append(status)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}"
        args.extend([limit, offset])
        rows = await conn.fetch(
            f"""
            SELECT id, task_id, user_id, title, format, status,
                   scheduled_at, started_at, finished_at, targets, results,
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
                # asyncpg JSONB 返回字符串,统一 _json_or_raw 解析为对象
                "targets": _serialize_targets(r["targets"]),
                "platforms": _serialize_results_to_platforms(r["results"]),
                "error": r["error"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
        return _wrap_ok({"items": items, "count": len(items), "limit": limit, "offset": offset})
    finally:
        await conn.close()


@router.get("/tasks/{task_id}")
async def get_task(task_id: str, request: Request) -> dict[str, Any]:
    """任务详情(含每个平台的结果)。

    IDOR 修复:校验任务归属,禁止查看他人任务详情。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        task = await conn.fetchrow("SELECT * FROM publish_tasks WHERE task_id=$1", task_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
        # IDOR 修复:校验任务归属
        if task["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="无权查看他人任务")

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

        # asyncpg JSONB 返回字符串,统一 _json_or_raw 解析为对象
        results = _json_or_raw(task["results"])
        if not isinstance(results, list):
            results = []
        return _wrap_ok({
            "taskId": task["task_id"],
            "userId": task["user_id"],
            "title": task["title"],
            "format": task["format"],
            "status": task["status"],
            "content": _json_or_raw(task["content"]),
            "targets": _serialize_targets(task["targets"]),
            "results": results,
            "platforms": platforms,
            "scheduledAt": task["scheduled_at"].isoformat() if task["scheduled_at"] else None,
            "startedAt": task["started_at"].isoformat() if task["started_at"] else None,
            "finishedAt": task["finished_at"].isoformat() if task["finished_at"] else None,
            "error": task["error"],
            "createdAt": task["created_at"].isoformat() if task["created_at"] else None,
        })
    finally:
        await conn.close()


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, request: Request) -> dict[str, Any]:
    """取消任务(只能取消正在执行的)。

    IDOR 修复:校验任务归属,禁止取消他人任务。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份

    # 先从内存 running 集合取消(内存任务无 user_id 隔离,先校验 DB 归属)
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT user_id, status FROM publish_tasks WHERE task_id=$1", task_id
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
        # IDOR 修复:校验任务归属
        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="无权操作他人任务")

        # 归属校验通过,尝试从内存 running 集合取消
        cancelled = await publish_scheduler.cancel_task(task_id)
        if cancelled:
            return _wrap_ok({"ok": True, "taskId": task_id, "status": "cancelled"})

        if row["status"] in ("success", "failed", "partial"):
            return _wrap_ok({"ok": False, "taskId": task_id, "status": row["status"],
                    "error": "task already finished, cannot cancel"})
        # 标记为 cancelled
        await conn.execute(
            "UPDATE publish_tasks SET status='cancelled', finished_at=NOW(), updated_at=NOW() WHERE task_id=$1",
            task_id,
        )
        return _wrap_ok({"ok": True, "taskId": task_id, "status": "cancelled"})
    finally:
        await conn.close()


@router.post("/tasks/{task_id}/reschedule")
async def reschedule_task(
    task_id: str,
    body: RescheduleRequest,
    request: Request,
) -> dict[str, Any]:
    """改期定时任务(2026-08-17 新增,只能改期未开始的任务)。

    允许改期的状态:scheduled(定时中)/ pending(排队中);
    success/failed/partial/cancelled/running 均拒绝改期。

    IDOR 修复:校验任务归属,禁止改期他人任务;不存在与他人任务统一返回 404,
    不泄露任务是否存在。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT user_id, status FROM publish_tasks WHERE task_id=$1", task_id
        )
        # 不存在或不归属当前用户:统一 404(与 cancel 一致,不泄露归属)
        if not row or row["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="task not found")
        if row["status"] not in ("scheduled", "pending"):
            raise HTTPException(status_code=400, detail="只有未开始的任务才能改期")
        await conn.execute(
            """
            UPDATE publish_tasks
            SET scheduled_at=$2, status='scheduled', updated_at=NOW()
            WHERE task_id=$1
            """,
            task_id,
            body.scheduled_at,
        )
        return _wrap_ok({
            "ok": True,
            "task_id": task_id,
            "status": "scheduled",
            "scheduled_at": body.scheduled_at.isoformat() if body.scheduled_at else None,
        })
    finally:
        await conn.close()


@router.post("/tasks/{task_id}/retry")
async def retry_task(task_id: str, request: Request, platforms: Optional[list[str]] = None) -> dict[str, Any]:
    """重试失败的平台。

    IDOR 修复:校验任务归属,禁止重试他人任务。

    Body 可选:{"platforms": ["wordpress", "medium"]} - 仅重试指定平台
    不传 platforms → 重试所有失败平台
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT user_id FROM publish_tasks WHERE task_id=$1", task_id
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
        # IDOR 修复:校验任务归属
        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="无权操作他人任务")
    finally:
        await conn.close()

    result = await publish_scheduler.retry_platforms(task_id, platforms)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "retry failed"))
    return _wrap_ok(result)


# ===== 历史记录 =====

@router.get("/history")
async def list_history(
    request: Request,
    task_id: Optional[str] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    """历史记录(单平台粒度)。

    IDOR 修复:user_id 不再从 Query 取,强制用 JWT 身份,只能看自己的历史。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        conditions = [f"user_id=$1"]
        args: list[Any] = [user_id]
        idx = 2
        if task_id:
            conditions.append(f"task_id=${idx}")
            args.append(task_id)
            idx += 1
        if platform:
            conditions.append(f"platform=${idx}")
            args.append(platform)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}"
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
        return _wrap_ok({"items": items, "count": len(items)})
    finally:
        await conn.close()


# ===== 统计 =====

@router.get("/stats")
async def get_stats(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
) -> dict[str, Any]:
    """统计(指定时间段内)。

    IDOR 修复:user_id 不再从 Query 取,强制用 JWT 身份,只统计自己的数据。

    返回:
    - 任务总数 / 成功 / 失败 / 部分成功
    - 平台执行成功次数 / 失败次数 / 平均耗时
    - 最近 N 天每日任务数
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        # 时间范围
        since = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        from datetime import timedelta
        since = since - timedelta(days=days)

        # 任务总览(强制 user_id 过滤)
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

        # 平台统计(强制 user_id 过滤)
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

        return _wrap_ok({
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
        })
    finally:
        await conn.close()


# ===== 调试工具 =====

@router.get("/credentials-key/generate")
async def gen_credentials_key() -> dict[str, Any]:
    """生成一个新的 AES-256 密钥(base64),供用户初始化 PUBLISH_CREDENTIALS_KEY 用。

    注意:此端点仅供初始化时使用,生产环境应通过环境变量配置密钥,不调用此端点。
    """
    return _wrap_ok({"key": generate_key_b64(), "note": "Set as PUBLISH_CREDENTIALS_KEY env var"})


@router.get("/running")
async def list_running_tasks() -> dict[str, Any]:
    """列出当前正在执行的任务(内存)。"""
    return _wrap_ok({"running": publish_scheduler.list_running(), "history": publish_scheduler.list_history(limit=20)})


# ===== AI 辅助写作(2026-08-01 新增,暴露 ai_assistant.AiWritingService 单例)=====
# 7 个 POST 端点,请求体用 Pydantic 模型,响应统一 {code, message, data}。
# 鉴权与现有 publish 端点一致(强制 JWT via _get_user_id)。
# 失败返回 500 + {code:1, message:str(e)},成功返回 200 + {code:0, message:"success", data:{...}}。


class AiTitlesRequest(BaseModel):
    content: str
    platform: str = ""
    count: int = Field(default=5, ge=1, le=20)


class AiPolishRequest(BaseModel):
    content: str
    style: str = "professional"


class AiTagsRequest(BaseModel):
    content: str
    platform: str = ""
    count: int = Field(default=8, ge=1, le=30)


class AiSummaryRequest(BaseModel):
    content: str
    max_length: int = Field(default=100, ge=10, le=500)


class AiSeoRequest(BaseModel):
    title: str
    content: str
    platform: str = ""


class AiCoverRequest(BaseModel):
    content: str


class AiAnalyzeAllRequest(BaseModel):
    content: str
    title: str
    platform: str = ""


@router.post("/ai/titles", response_model=None)
async def ai_generate_titles(
    body: AiTitlesRequest, request: Request
) -> dict[str, Any] | JSONResponse:
    """AI 生成标题候选。"""
    _get_user_id(request)
    try:
        titles = await ai_writing_service.generate_titles(
            body.content, body.platform, body.count
        )
        return {"code": 0, "message": "success", "data": {"titles": titles}}
    except Exception as e:
        logger.warning("[publish.ai/titles] failed: %s", e)
        return JSONResponse(status_code=500, content={"code": 1, "message": str(e)})


@router.post("/ai/polish", response_model=None)
async def ai_polish_content(
    body: AiPolishRequest, request: Request
) -> dict[str, Any] | JSONResponse:
    """AI 正文润色。"""
    _get_user_id(request)
    try:
        polished = await ai_writing_service.polish_content(body.content, body.style)
        return {"code": 0, "message": "success", "data": {"content": polished}}
    except Exception as e:
        logger.warning("[publish.ai/polish] failed: %s", e)
        return JSONResponse(status_code=500, content={"code": 1, "message": str(e)})


@router.post("/ai/tags", response_model=None)
async def ai_recommend_tags(
    body: AiTagsRequest, request: Request
) -> dict[str, Any] | JSONResponse:
    """AI 推荐标签。"""
    _get_user_id(request)
    try:
        tags = await ai_writing_service.recommend_tags(
            body.content, body.platform, body.count
        )
        return {"code": 0, "message": "success", "data": {"tags": tags}}
    except Exception as e:
        logger.warning("[publish.ai/tags] failed: %s", e)
        return JSONResponse(status_code=500, content={"code": 1, "message": str(e)})


@router.post("/ai/summary", response_model=None)
async def ai_generate_summary(
    body: AiSummaryRequest, request: Request
) -> dict[str, Any] | JSONResponse:
    """AI 生成 SEO 摘要。"""
    _get_user_id(request)
    try:
        summary = await ai_writing_service.generate_summary(body.content, body.max_length)
        return {"code": 0, "message": "success", "data": {"summary": summary}}
    except Exception as e:
        logger.warning("[publish.ai/summary] failed: %s", e)
        return JSONResponse(status_code=500, content={"code": 1, "message": str(e)})


@router.post("/ai/seo", response_model=None)
async def ai_analyze_seo(
    body: AiSeoRequest, request: Request
) -> dict[str, Any] | JSONResponse:
    """AI SEO 分析(评分 + 建议)。"""
    _get_user_id(request)
    try:
        seo = await ai_writing_service.analyze_seo(body.title, body.content, body.platform)
        return {
            "code": 0,
            "message": "success",
            "data": {"seo": seo.model_dump() if seo else None},
        }
    except Exception as e:
        logger.warning("[publish.ai/seo] failed: %s", e)
        return JSONResponse(status_code=500, content={"code": 1, "message": str(e)})


@router.post("/ai/cover", response_model=None)
async def ai_suggest_cover(
    body: AiCoverRequest, request: Request
) -> dict[str, Any] | JSONResponse:
    """AI 封面设计建议。"""
    _get_user_id(request)
    try:
        covers = await ai_writing_service.suggest_cover(body.content)
        return {"code": 0, "message": "success", "data": {"covers": covers}}
    except Exception as e:
        logger.warning("[publish.ai/cover] failed: %s", e)
        return JSONResponse(status_code=500, content={"code": 1, "message": str(e)})


@router.post("/ai/analyze-all", response_model=None)
async def ai_analyze_all(
    body: AiAnalyzeAllRequest, request: Request
) -> dict[str, Any] | JSONResponse:
    """AI 批量分析(标题 + 标签 + 摘要 + SEO + 封面,一次调用减少 LLM 往返)。"""
    _get_user_id(request)
    try:
        result = await ai_writing_service.analyze_all(
            body.content, body.title, body.platform
        )
        return {"code": 0, "message": "success", "data": result}
    except Exception as e:
        logger.warning("[publish.ai/analyze-all] failed: %s", e)
        return JSONResponse(status_code=500, content={"code": 1, "message": str(e)})

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
- POST   /publish/tasks/{task_id}/confirm  - 人工确认草稿转 scheduled
- PATCH  /publish/tasks/{task_id}/draft    - 编辑草稿(重新预检,仍保持 draft)
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

import asyncio
import csv
import hashlib
import io
import json
import os
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import asyncpg
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.db import get_db_conn
from app.core.jwt_auth import (
    require_request_user_id,
    resolve_request_role_id,
)
from app.core.logging import get_logger
from app.services.publish.acceptance import build_acceptance_matrix
from app.services.publish.account_state import (
    cookie_health_payload,
    days_until_expiry,
    risk_cookie_status,
)
from app.services.publish.ai_assistant import ai_writing_service
from app.services.publish.base_adapter import (
    PublishContent,
    get_adapter,
    list_all_adapter_classes,
)
from app.services.publish.credential_history import apply_credentials_update
from app.services.publish.credentials_crypto import decrypt, encrypt, generate_key_b64
from app.services.publish.metrics_collector import (
    collect_metrics,
    latest_metrics,
    latest_style_check,
    persist_style_check,
)
from app.services.publish.post_publish_verifier import verify_published
from app.services.publish.preflight import run_preflight
from app.services.publish.scheduler import publish_scheduler
from app.tools.pipeline_tools import prepare_publish_draft as run_prepare_publish_draft

logger = get_logger(__name__)

# 2026-11-26:_ensure_accounts_table 过去在 8 个端点每次请求都跑 6 条 DDL
# (CREATE TABLE/INDEX IF NOT EXISTS + 3× ALTER TABLE ADD COLUMN IF NOT EXISTS)。
# ALTER TABLE 要 ACCESS EXCLUSIVE 锁,并发请求互相争锁,某条撞上全局
# command_timeout(10s)就抛 asyncio.TimeoutError → FastAPI 未捕获 → 500 +
# starlette ASGI traceback(终检在生产日志见到)。DDL 是幂等且只在首次/迁移时需要,
# 故改成进程内一次守卫:成功执行一次即置位,后续请求零 DDL;失败不置位,下轮重试。
_ACCOUNTS_TABLE_LOCK = asyncio.Lock()
_ACCOUNTS_TABLE_READY = False

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
    """确保 publish_accounts 表存在。

    进程内只跑一次(成功置位);并发请求用 Lock 串行,失败不置位以便下轮重试。
    超时/DB 错误转成 503 而非泄漏成未处理异常 → starlette 500 traceback。
    """
    global _ACCOUNTS_TABLE_READY
    if _ACCOUNTS_TABLE_READY:
        return
    async with _ACCOUNTS_TABLE_LOCK:
        if _ACCOUNTS_TABLE_READY:
            return
        try:
            await _ensure_accounts_table_ddl(conn)
        except TimeoutError as e:
            # 全局 command_timeout 撞锁 → 503 让调用方重试,不产生 500 traceback
            logger.warning("[publish] ensure_accounts_table 超时(DB 锁争用): %s", e)
            raise HTTPException(status_code=503, detail="db busy, retry later") from e
        except asyncpg.PostgresError as e:
            logger.warning("[publish] ensure_accounts_table DDL 失败: %s: %s", type(e).__name__, e)
            raise HTTPException(status_code=503, detail=f"db unavailable: {type(e).__name__}") from e
        _ACCOUNTS_TABLE_READY = True


async def _ensure_accounts_table_ddl(conn: asyncpg.Connection) -> None:
    """实际 DDL(仅由 _ensure_accounts_table 在锁内调用一次)。"""
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
    # 2026-08-17 修复:本地/早期库 publish_accounts 是旧结构(nickname/last_verify_result,
    # 无 display_name/last_verify_msg/extra),CREATE TABLE IF NOT EXISTS 不会 ALTER 已有表
    # → 账号创建/查询/验证一直 500(UndefinedColumnError)。幂等迁移补列,生产安全。
    await conn.execute(
        "ALTER TABLE publish_accounts ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)"
    )
    await conn.execute(
        "ALTER TABLE publish_accounts ADD COLUMN IF NOT EXISTS last_verify_msg TEXT"
    )
    await conn.execute("ALTER TABLE publish_accounts ADD COLUMN IF NOT EXISTS extra JSONB")


def _serialize_account(row: asyncpg.Record, include_credentials: bool = False) -> dict[str, Any]:
    """序列化账号记录为 JSON 友好格式。"""
    out: dict[str, Any] = {
        "id": row["id"],
        "userId": row["user_id"],
        "platform": row["platform"],
        "displayName": row["display_name"],
        "status": row["status"],
        # hasCredentials:凭证是否仍在。status='disabled' 且 hasCredentials=False
        # 表示"凭证已被清除、等重新扫码"(如 2026-09-27 混包凭证处置),
        # 与用户主动删除(软删除,凭证仍在)在前端显示上区分开,避免误解为"平台禁用"。
        "hasCredentials": bool(row["credentials_enc"]),
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
    display_name: str | None = None
    credentials: dict[str, Any] | None = None
    status: str | None = None  # 'active' / 'disabled'
    extra: dict[str, Any] | None = None


class PublishTarget(BaseModel):
    platform: str
    # 2026-11-25 账号池:account_id 可空 —— 空时由 pool_id(或该平台默认池)取号。
    # 显式传 account_id 的调用方行为不变,池只负责"没指定时"。
    account_id: int | None = None
    pool_id: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class TaskCreate(BaseModel):
    # IDOR 修复:user_id 移除,从 JWT(request.state.user_id)取。
    # 客户端若仍传 user_id,Pydantic 默认 extra='ignore' 会忽略,保持兼容。
    title: str = Field(..., max_length=500)
    format: str = Field(..., pattern=r"^(md|docx|html|pdf|image|video)$")
    text: str | None = Field(default=None, description="md/html 文本内容")
    file_path: str | None = Field(default=None, description="docx/pdf/image/video 文件路径")
    cover_path: str | None = Field(default=None, description="封面图路径")
    images: list[str] = Field(default_factory=list, description="内容中引用的图片路径列表")
    extra: dict[str, Any] = Field(default_factory=dict)
    targets: list[PublishTarget]
    scheduled_at: datetime | None = Field(default=None, description="定时发布时间(UTC),空则立即执行")
    # 2026-11-27:Agent 重试防重发。同一个 key + 同一个请求哈希只落一条任务。
    idempotency_key: str | None = Field(default=None, max_length=128)
    # 默认开启发布前预检;紧急绕过只对内部调用开放,Agent 不应传 False。
    preflight: bool = True
    # Agent 只落草稿:status='draft',不执行、不排期;必须人工确认后才进调度。
    draft: bool = False


class ConfirmDraftRequest(BaseModel):
    """人工确认草稿:空表示确认后立即进调度(下一轮轮询执行)。"""

    scheduled_at: datetime | None = Field(default=None, description="计划发布时间(UTC),空则立即进调度")


class DraftUpdateRequest(BaseModel):
    """人工编辑草稿:只传要改的字段,没传的保留原值。"""

    title: str | None = Field(default=None, max_length=500)
    format: str | None = Field(default=None, pattern=r"^(md|docx|html|pdf|image|video)$")
    text: str | None = None
    file_path: str | None = None
    cover_path: str | None = None
    images: list[str] | None = None
    targets: list[PublishTarget] | None = None
    profile: str | None = None
    hashtags: str | list[str] | None = None
    min_chars: int | None = None
    max_chars: int | None = None
    title_length: int | None = None
    hashtag_count: int | None = None
    require_ai_disclosure: bool | None = None


class PrepareDraftRequest(BaseModel):
    """一句话出稿请求：只落草稿，不排期、不调平台。"""

    brief: str = Field(..., min_length=1, max_length=2000, description="一句话需求")
    platforms: list[str] = Field(..., min_length=1, max_length=10, description="目标平台")
    tone: str = Field(default="口语化、自然聊天", max_length=80)
    profile: str = Field(default="ihui_koubo", max_length=64)
    format: str = Field(default="md", pattern=r"^(md|html)$")
    min_chars: int = Field(default=470, ge=0, le=20000)
    max_chars: int = Field(default=490, ge=0, le=20000)
    title_chars: int = Field(default=16, ge=0, le=60)
    hashtag_count: int = Field(default=5, ge=0, le=30)
    require_ai_disclosure: bool = False


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


@router.get("/acceptance")
async def publish_acceptance(
    request: Request,
    platform: str | None = Query(None, description="只看一个平台"),
) -> dict[str, Any]:
    """发布能力验收矩阵。

    把"有适配器"、"登录有效"、"真实发过"分开算:
    - verified: 有真实发布成功且带 URL/content_id 的历史证据
    - ready_unverified / browser_likely: 凭据/浏览器就绪,但还没真实发过
    - login_only: 登录有效但当前适配器缺 API 凭据或需要网页版发布器
    - untested / disabled / no_account / no_adapter
    """
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        data = await build_acceptance_matrix(conn, user_id, platform_filter=platform)
    finally:
        await conn.close()
    return _wrap_ok(data)


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

# 单文件默认 4GB(PUBLISH_UPLOAD_MAX_BYTES 可调);不再把整包读进内存
def _max_file_size() -> int:
    return max(1, int(settings.publish_upload_max_bytes))

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

    # 2026-11-26:分块直接落盘,不再把整包读进内存。
    # 4GB 默认上限由 PUBLISH_UPLOAD_MAX_BYTES 控制;超限时临时文件自动删除。
    from ..utils.upload_read import write_capped

    limit = _max_file_size()

    # 构造存储路径(user_id 已由 JWT 校验,必定非空)
    user_dir = "".join(c for c in user_id if c.isalnum() or c in "-_") or "anonymous"
    yyyymmdd = datetime.now(UTC).strftime("%Y%m%d")
    unique = uuid.uuid4().hex[:16]
    suffix = Path(file.filename).suffix.lower()
    # 安全文件名(去除路径分隔符)
    safe_name = "".join(c for c in Path(file.filename).stem if c.isalnum() or c in "-_")[:50] or "file"
    save_dir = _upload_root() / user_dir / yyyymmdd
    save_path = save_dir / f"{safe_name}_{unique}{suffix}"

    # 流式写盘
    try:
        size = await write_capped(file, save_path, limit)
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"failed to write file: {type(e).__name__}: {e}",
        )
    if size is None:
        raise HTTPException(
            status_code=413,
            detail=f"file too large > max {limit} bytes ({limit // (1024 * 1024)}MB)",
        )
    if size == 0:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="file is empty")

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


@router.get("/accounts/health-summary")
async def accounts_health_summary(request: Request) -> dict[str, Any]:
    """全部账号的 Cookie 健康度 + 风险评分,一次返回。

    存在的理由是**限流自救**:「平台账号管理」页原先按账号数扇出
    `/accounts/:id/cookie-health` 与 `/accounts/:id/risk` 两组请求,
    生产实测 19 个账号即 ~163 次/分钟,叠加 subagents 轮询后单页就能越过
    anti-automation 的 200 次/分钟封禁阈值(2026-09-23 事故)。本端点把 2N 次压成 1 次。

    必须注册在 `/accounts/{user_id}` **之前** —— FastAPI 按声明顺序匹配,
    否则 "health-summary" 会被当成 user_id 路径参数劫持(同 batch_template 的教训,
    见上方注释)。

    口径与两个单账号端点严格一致:共用 `account_state` 的阈值与 `cookie_health_payload`,
    风险评分共用 `_risk_block`。
    """
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        rows = await conn.fetch(
            "SELECT id, platform, status, last_verified_at, last_verify_msg "
            "FROM publish_accounts WHERE user_id=$1 ORDER BY created_at DESC",
            user_id,
        )
        now = datetime.now(UTC)
        items: list[dict[str, Any]] = []
        for row in rows:
            account_id = row["id"]
            platform = row["platform"]
            last_verified = row["last_verified_at"]
            items.append(
                {
                    "accountId": account_id,
                    "platform": platform,
                    "cookieHealth": cookie_health_payload(
                        account_id,
                        platform,
                        row["status"],
                        last_verified,
                        row["last_verify_msg"],
                        now,
                    ),
                    "risk": _risk_block(account_id, platform, last_verified),
                }
            )
        return _wrap_ok({"items": items, "count": len(items)})
    finally:
        await conn.close()


@router.get("/accounts/{user_id}")
async def list_accounts(
    request: Request,
    user_id: str,
    platform: str | None = Query(default=None),
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

    2026-09-27:传 `credentials` 时这一步过去是**无条件整体覆盖**密文(不传 extra 时该列
    原样不动,传了就把回滚历史一起抹掉)。现在凭据写入一律走唯一出口
    `credential_history.apply_credentials_update`:覆盖前把库里旧密文压进有界历史;
    `extra` 与凭据同时传时由出口把调用方给的新键合进(旧 extra ⊕ 新历史),历史键归出口
    独占 —— 客户端回传的旧历史不得盖掉本轮刚压进去的那一条。
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

        # 凭据写入先走唯一出口(一条 UPDATE 同时落新密文与新 extra),再构造其余字段的 SET
        credentials_written = False
        if body.credentials is not None:
            try:
                cipher = encrypt(body.credentials)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"encrypt failed: {e}")
            await apply_credentials_update(
                conn, account_id, cipher,
                source_note="前台编辑凭据",
                merge_extra=body.extra,
            )
            credentials_written = True

        # 构造 update 字段
        sets: list[str] = []
        args: list[Any] = []
        idx = 1
        if body.display_name is not None:
            sets.append(f"display_name=${idx}")
            args.append(body.display_name)
            idx += 1
        if body.status is not None:
            if body.status not in ("active", "disabled"):
                raise HTTPException(status_code=400, detail="status must be 'active' or 'disabled'")
            sets.append(f"status=${idx}")
            args.append(body.status)
            idx += 1
        if body.extra is not None and not credentials_written:
            # 只改 extra(未动凭据)⇒ 库里没有"本轮要被盖掉的旧密文",维持原直写语义。
            sets.append(f"extra=${idx}::jsonb")
            args.append(json.dumps(body.extra, ensure_ascii=False))
            idx += 1

        if not sets:
            if credentials_written:
                # 本轮只改了凭据:出口已落库,重新取整行作为响应(不再补第二条 UPDATE)。
                final_row = await conn.fetchrow(
                    "SELECT * FROM publish_accounts WHERE id=$1", account_id
                )
                return _wrap_ok({"ok": True, "account": _serialize_account(final_row)})
            return _wrap_ok({"ok": True, "account": _serialize_account(existing), "note": "no fields to update"})

        sets.append("updated_at=NOW()")
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
        # 反风控身份键走稳定锚点(账号行 id),不再让"刷新后必变"的凭证值决定账号的脸
        adapter.db_account_id = account_id

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


def _risk_cookie_health(last_verified: Any) -> dict[str, Any] | None:
    """风险评分的 Cookie 因子;从未验证过则不参与评分(沿用既有行为)。"""
    if not last_verified:
        return None
    until = days_until_expiry(last_verified, time.time())
    return {"status": risk_cookie_status(until), "days_until_expiry": round(until, 1)}


def _risk_block(account_id: int, platform: str, last_verified: Any) -> dict[str, Any]:
    """账号风险评分载荷。单账号端点与批量端点共用,避免两处口径漂移。"""
    # 延迟 import 避免循环依赖
    from app.services.publish.anti_risk.risk_scoring import get_instance as get_risk_scorer

    result = get_risk_scorer().calculate_risk_score(
        str(account_id),
        platform,
        publish_history=None,
        cookie_health=_risk_cookie_health(last_verified),
    )
    cooldown_until = result.cooldown_until
    return {
        "score": result.score,
        "level": result.level,
        "factors": result.factors,
        "cooldownUntil": cooldown_until,
        "cooldownRemaining": (
            max(0, cooldown_until - time.time()) if cooldown_until is not None else 0
        ),
    }


@router.get("/accounts/{account_id}/risk")
async def get_account_risk(account_id: int, request: Request) -> dict[str, Any]:
    """账号风险评分(2026-08-17 新增)。

    调 anti_risk.risk_scoring 引擎计算当前账号风险(0-100)+ 冷却信息。
    风控引擎已存在但此前未暴露 API,此端点供前端发布前评估账号风险。

    IDOR 修复:校验账号归属;不存在或不归属当前用户统一返回 404,
    不泄露账号是否存在(与 reschedule_task 风格一致)。

    cookie_health 从 last_verified_at 推算(14 天阈值,与 cookie-health 端点一致):
      - 距过期 >7 天   → healthy(不加分)
      - 距过期 0-7 天  → expiring_soon(加 15 分)
      - 已过 14 天阈值 → expired(加 15 分)
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        row = await conn.fetchrow(
            "SELECT platform, display_name, status, last_verified_at, user_id "
            "FROM publish_accounts WHERE id=$1",
            account_id,
        )
        # 不存在或不归属当前用户:统一 404(不泄露账号是否存在)
        if not row or row["user_id"] != user_id:
            raise HTTPException(status_code=404, detail=f"account not found: {account_id}")

        platform = row["platform"]
        return _wrap_ok({
            "accountId": account_id,
            "platform": platform,
            **_risk_block(account_id, platform, row["last_verified_at"]),
        })
    finally:
        await conn.close()


# ===== 任务管理 =====

async def _assert_targets_owned(
    conn: asyncpg.Connection,
    user_id: str,
    targets: list[PublishTarget],
) -> None:
    """AIS-073: 校验 targets 内每个 account_id 均归属当前用户。

    复用 publish_accounts 既有归属查询口径(`WHERE id=$1 AND user_id=$2`)。
    任一账号不属于当前用户即整体拒绝(403),不做静默过滤。
    """
    account_ids = sorted({t.account_id for t in targets if t.account_id is not None})
    missing: list[int] = []
    for account_id in account_ids:
        row = await conn.fetchrow(
            "SELECT id FROM publish_accounts WHERE id=$1 AND user_id=$2",
            account_id,
            user_id,
        )
        if not row:
            missing.append(account_id)
    if missing:
        logger.warning(
            "[publish] create_task rejected: user=%s targets 含非本人账号 %s",
            user_id, missing,
        )
        raise HTTPException(
            status_code=403,
            detail={
                "code": "publish_account_not_owned",
                "message": "targets 包含不属于当前用户的账号",
                "account_ids": missing,
            },
        )


def _task_request_hash(body: TaskCreate, targets: list[dict[str, Any]]) -> str:
    """请求指纹:同 key 不同内容/目标必须报冲突,不能拿旧任务冒充新发布。"""
    payload = {
        "title": body.title,
        "format": body.format,
        "text": body.text,
        "file_path": body.file_path,
        "cover_path": body.cover_path,
        "images": list(body.images or []),
        "extra": body.extra or {},
        "scheduled_at": body.scheduled_at,
        "targets": targets,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _find_idempotent_task(
    conn: asyncpg.Connection,
    user_id: str,
    idempotency_key: str,
    request_hash: str,
) -> dict[str, Any] | None:
    """返回已有任务;同 key 不同指纹抛 409。"""
    row = await conn.fetchrow(
        """
        SELECT task_id, status, request_hash, scheduled_at, created_at
        FROM publish_tasks
        WHERE user_id = $1 AND idempotency_key = $2
        ORDER BY id DESC
        LIMIT 1
        """,
        user_id,
        idempotency_key,
    )
    if not row:
        return None
    if row["request_hash"] and row["request_hash"] != request_hash:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "idempotency_conflict",
                "message": "同一个 idempotency_key 已被不同内容/目标使用",
                "task_id": row["task_id"],
            },
        )
    return {
        "ok": True,
        "task_id": row["task_id"],
        "status": row["status"],
        "idempotent_replay": True,
        "scheduled_at": row["scheduled_at"].isoformat() if row["scheduled_at"] else None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.post("/prepare-draft")
async def prepare_draft(body: PrepareDraftRequest, request: Request) -> dict[str, Any]:
    """一句话需求 → 出稿 → 合规自检 → 落草稿（人工确认后才允许发布）。

    工具结果统一走 200 + code=0，前端据 `data.ok` 区分业务结果：
    NO_ACCOUNT / PREFLIGHT_BLOCKED 等是可解释结果，不是 HTTP 网关错误。
    """
    user_id = _get_user_id(request)
    result = await run_prepare_publish_draft(
        {
            "brief": body.brief,
            "platforms": body.platforms,
            "tone": body.tone,
            "profile": body.profile,
            "format": body.format,
            "min_chars": body.min_chars,
            "max_chars": body.max_chars,
            "title_chars": body.title_chars,
            "hashtag_count": body.hashtag_count,
            "require_ai_disclosure": body.require_ai_disclosure,
            "__user_id": user_id,
            "__session_id": request.headers.get("x-session-id"),
        }
    )
    return _wrap_ok(result)


@router.post("/preflight")
async def preflight_task(body: TaskCreate, request: Request) -> dict[str, Any]:
    """发布前预检(不创建任务)。

    返回每个 target 的 ok/code/message/nextAction/warnings。Agent 应先调这里,
    只有 ok=true 才创建任务;这样"登录成功但账号没实名/没配额"能提前暴露。
    """
    user_id = _get_user_id(request)
    if not body.targets:
        raise HTTPException(status_code=400, detail="targets cannot be empty")
    for t in body.targets:
        if get_adapter(t.platform) is None:
            raise HTTPException(status_code=400, detail=f"unsupported platform: {t.platform}")

    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        from app.services.publish import account_pool
        await account_pool.ensure_tables(conn)
        body.targets = await account_pool.resolve_targets(conn, user_id, body.targets)
        await _assert_targets_owned(conn, user_id, body.targets)
        targets = [t.model_dump() for t in body.targets]
    finally:
        await conn.close()

    content = PublishContent(
        format=body.format,
        title=body.title,
        text=body.text,
        file_path=body.file_path,
        cover_path=body.cover_path,
        images=body.images,
        extra=body.extra,
    )

    conn = await _get_conn()
    try:
        result = await run_preflight(conn, user_id, targets, content)
    finally:
        await conn.close()
    return _wrap_ok(result)


@router.post("/tasks")
async def create_task(body: TaskCreate, request: Request) -> dict[str, Any]:
    """创建发布任务(立即执行或定时)。

    IDOR 修复:user_id 从 JWT 取,不再信任请求体。
    AIS-073:targets 的 account_id 必须归属当前用户,阻断跨租户冒名发布。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份

    if not body.targets:
        raise HTTPException(status_code=400, detail="targets cannot be empty")

    # 验证所有目标平台合法
    for t in body.targets:
        if get_adapter(t.platform) is None:
            raise HTTPException(status_code=400, detail=f"unsupported platform: {t.platform}")

    # AIS-073 第一层:提交侧校验 target 账号归属,任一非本人账号即拒绝
    conn = await _get_conn()
    try:
        await _ensure_accounts_table(conn)
        # 任务表也要先就位:幂等键查询依赖 idempotency_key/request_hash 两列。
        # 测试里 publish_scheduler 可能被替换成不带私有建表方法的桩,缺方法就跳过。
        ensure_tables = getattr(publish_scheduler, "_ensure_tables", None)
        if ensure_tables is not None:
            await ensure_tables(conn)
        # 账号池:targets 里没写 account_id 的,由池按"健康 → 优先级 → 最久未用"取号。
        # 池里全失效 → 409,不静默落到一个掉线号上(发布失败要让人当场知道)。
        from app.services.publish import account_pool
        await account_pool.ensure_tables(conn)
        body.targets = await account_pool.resolve_targets(conn, user_id, body.targets)
        await _assert_targets_owned(conn, user_id, body.targets)
    finally:
        await conn.close()

    targets_dicts = [t.model_dump() for t in body.targets]
    request_hash = _task_request_hash(body, targets_dicts)

    # 幂等快速路径:同一 key 已经落过任务,直接返回原任务,不再走预检/文件校验。
    if body.idempotency_key:
        conn = await _get_conn()
        try:
            existing = await _find_idempotent_task(
                conn, user_id, body.idempotency_key, request_hash,
            )
            if existing:
                return _wrap_ok(existing)
        finally:
            await conn.close()

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

    # 发布前预检:账号状态/凭据/格式/平台权限不通过就直接 409,不创建任务。
    if body.preflight:
        conn = await _get_conn()
        try:
            preflight = await run_preflight(conn, user_id, targets_dicts, content)
        finally:
            await conn.close()
        if not preflight["ok"]:
            blocked = [t for t in preflight["targets"] if not t.get("ok")]
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "publish_preflight_blocked",
                    "message": "发布前预检未通过,任务未创建",
                    "targets": blocked,
                    "warningCount": preflight.get("warnings", 0),
                },
            )

    task_id = f"pub-{uuid.uuid4().hex[:12]}-{int(time.time())}"

    result = await publish_scheduler.submit_task(
        task_id=task_id,
        user_id=user_id,
        content=content,
        targets=targets_dicts,
        scheduled_at=body.scheduled_at,
        idempotency_key=body.idempotency_key,
        request_hash=request_hash,
        as_draft=body.draft,
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
            "errorKind": r.get("error_kind"),
            "challenge": r.get("challenge"),
            "durationMs": r.get("duration_ms"),
        })
    return platforms


@router.get("/tasks")
async def list_tasks(
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """列出任务(支持 status 过滤 + 分页)。

    IDOR 修复:user_id 不再从 Query 取,强制用 JWT 身份,只能看自己的任务。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        conditions = ["user_id=$1"]
        args: list[Any] = [user_id]
        idx = 2
        if status:
            conditions.append(f"status=${idx}")
            args.append(status)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}"
        # 已排期任务按计划时间正序:最该发的排最前,超时任务不会被新创建的任务压到后面。
        order_by = (
            "scheduled_at ASC NULLS LAST, created_at DESC"
            if status == "scheduled"
            else "created_at DESC"
        )
        args.extend([limit, offset])
        rows = await conn.fetch(
            f"""
            SELECT id, task_id, user_id, title, format, status,
                   scheduled_at, started_at, finished_at, targets, results,
                   (SELECT count(*) FROM publish_history WHERE task_id = t.task_id) as platform_count,
                   error, created_at, updated_at
            FROM publish_tasks t
            {where}
            ORDER BY {order_by}
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


@router.post("/tasks/{task_id}/confirm")
async def confirm_draft(
    task_id: str,
    request: Request,
    body: ConfirmDraftRequest | None = None,
) -> dict[str, Any]:
    """人工确认草稿:只允许任务归属者把 status='draft' 转成 scheduled。

    Agent 不能调这个端点(它只暴露给登录用户的 UI);确认前重新跑一次预检,
    账号掉线/被禁用/内容不合规时保持 draft,不把坏任务送进调度器。
    scheduled_at 为空 → 立即进调度(下一轮轮询执行),不直接在本请求里发布。
    """
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        task = await conn.fetchrow(
            """
            SELECT task_id, user_id, title, format, content, targets, status
            FROM publish_tasks
            WHERE task_id=$1 AND user_id=$2
            """,
            task_id,
            user_id,
        )
        if not task:
            raise HTTPException(status_code=404, detail="草稿不存在或不属于当前用户")
        if task["status"] != "draft":
            raise HTTPException(
                status_code=409,
                detail=f"只有草稿可以确认,当前状态是 {task['status']}",
            )

        content_raw = _json_or_raw(task["content"]) or {}
        targets_raw = _json_or_raw(task["targets"]) or []
        if not isinstance(content_raw, dict):
            content_raw = {}
        if not isinstance(targets_raw, list) or not targets_raw:
            raise HTTPException(status_code=409, detail="草稿缺少发布目标,无法确认")

        content = PublishContent(
            format=task["format"],
            title=task["title"],
            text=content_raw.get("text"),
            file_path=content_raw.get("file_path"),
            cover_path=content_raw.get("cover_path"),
            html=content_raw.get("html"),
            images=content_raw.get("images") or [],
            extra=content_raw.get("extra") or {},
        )
        preflight = await run_preflight(conn, user_id, targets_raw, content)
        if not preflight["ok"]:
            blocked = [t for t in preflight["targets"] if not t.get("ok")]
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "publish_preflight_blocked",
                    "message": "确认前预检未通过,草稿保持未发布",
                    "targets": blocked,
                },
            )

        scheduled_at = body.scheduled_at if body else None
        updated = await conn.fetchrow(
            """
            UPDATE publish_tasks
            SET status='scheduled', scheduled_at=COALESCE($2, NOW()), updated_at=NOW()
            WHERE task_id=$1 AND user_id=$3 AND status='draft'
            RETURNING task_id, status, scheduled_at
            """,
            task_id,
            scheduled_at,
            user_id,
        )
        if not updated:
            raise HTTPException(status_code=409, detail="草稿状态已变化,请刷新后重试")
        return _wrap_ok({
            "taskId": updated["task_id"],
            "status": updated["status"],
            "scheduledAt": updated["scheduled_at"].isoformat() if updated["scheduled_at"] else None,
            "hint": "已进入调度队列,失败可在发布历史里取消或重试",
        })
    finally:
        await conn.close()


@router.patch("/tasks/{task_id}/draft")
async def update_draft(
    task_id: str,
    request: Request,
    body: DraftUpdateRequest,
) -> dict[str, Any]:
    """人工编辑草稿:走与 Agent 同一个 update_publish_draft 工具。

    只改 draft;修改后重新预检,失败不写库;成功仍是 draft,确认仍要另一次点击。
    """
    user_id = _get_user_id(request)
    from app.tools.publish_tools import update_publish_draft as update_draft_tool

    arguments = body.model_dump(exclude_unset=True)
    arguments.update({"__user_id": user_id, "task_id": task_id})
    result = await update_draft_tool(arguments)
    if result.get("ok"):
        return _wrap_ok({
            "taskId": result.get("taskId"),
            "status": result.get("status"),
            "title": result.get("title"),
            "format": result.get("format"),
            "targets": result.get("targets"),
            "contentHash": result.get("contentHash"),
            "changedFields": result.get("changedFields") or [],
            "warnings": result.get("warnings", 0),
            "preflight": result.get("preflight") or [],
            "updatedAt": result.get("updatedAt"),
            "confirm": result.get("confirm"),
        })

    code = str(result.get("errorCode") or "DRAFT_UPDATE_FAILED")
    status_code = {
        "TASK_NOT_FOUND": 404,
        "DB_UNAVAILABLE": 503,
        "EDIT_FAILED": 500,
        "PREFLIGHT_BLOCKED": 409,
        "NOT_DRAFT": 409,
        "DRAFT_STATE_CHANGED": 409,
    }.get(code, 400)
    detail: dict[str, Any] = {
        "code": code,
        "message": result.get("message") or "草稿修改失败",
    }
    for key in ("taskId", "blocked", "warnings", "contentCheck", "targets"):
        if key in result:
            detail[key] = result[key]
    raise HTTPException(status_code=status_code, detail=detail)


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
        challenges = [
            r.get("challenge")
            for r in results
            if isinstance(r, dict) and r.get("challenge")
        ]
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
            "challenges": challenges,
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
            # BUG-8:取消成功即写回终态(与 scheduler._run_task 的 CancelledError 分支
            # 双保险,幂等 UPDATE 且只在仍为 running 时生效,不覆盖已成功结果)。
            await conn.execute(
                "UPDATE publish_tasks SET status='cancelled', finished_at=NOW(), "
                "updated_at=NOW() WHERE task_id=$1 AND status='running'",
                task_id,
            )
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
async def retry_task(task_id: str, request: Request, platforms: list[str] | None = None) -> dict[str, Any]:
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


@router.post("/tasks/{task_id}/resume")
async def resume_task(task_id: str, request: Request, platforms: list[str] | None = None) -> dict[str, Any]:
    """人工处理完 challenge 后继续任务。

    只允许对 auth_required 的失败平台 resume;账号仍是 reauth_required/expired
    就返回 409 + 当前 challenge,避免 Agent 在没登录成功时盲目重试。
    """
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT user_id, results, targets FROM publish_tasks WHERE task_id=$1", task_id
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="无权操作他人任务")

        results = _json_or_raw(row["results"])
        targets = _json_or_raw(row["targets"])
        if not isinstance(results, list):
            results = []
        if not isinstance(targets, list):
            targets = []

        challenge_rows = [
            r for r in results
            if isinstance(r, dict) and not r.get("success") and r.get("challenge")
        ]
        auth_challenges = [
            r for r in challenge_rows
            if r.get("error_kind") == "auth_required"
            or (r.get("challenge") or {}).get("type") == "reauth"
        ]
        if not auth_challenges:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "no_auth_challenge",
                    "message": "该任务没有待处理的登录失效挑战,不需要 resume",
                    "challenges": [r.get("challenge") for r in challenge_rows],
                },
            )

        target_platforms = set(platforms or [
            str((r.get("challenge") or {}).get("platform") or r.get("platform"))
            for r in auth_challenges
        ])
        still_bad: list[dict[str, Any]] = []
        for p in sorted(target_platforms):
            account_id = None
            for t in targets:
                if isinstance(t, dict) and t.get("platform") == p:
                    account_id = t.get("account_id")
                    break
            if account_id is None:
                still_bad.append({
                    "platform": p, "accountId": None, "status": "missing_account",
                    "message": "任务里找不到该平台账号",
                })
                continue
            sess = await conn.fetchrow(
                "SELECT status, last_error FROM publish_session_state WHERE account_id=$1",
                account_id,
            )
            if sess and str(sess["status"]) in {"reauth_required", "expired", "disabled"}:
                still_bad.append({
                    "platform": p, "accountId": account_id,
                    "status": sess["status"], "message": sess["last_error"] or "登录态仍未恢复",
                })
        if still_bad:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "auth_still_required",
                    "message": "账号登录态还没恢复,先完成重新登录/扫码",
                    "targets": still_bad,
                    "challenges": [r.get("challenge") for r in auth_challenges],
                },
            )
    finally:
        await conn.close()

    result = await publish_scheduler.retry_platforms(task_id, sorted(target_platforms))
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "resume failed"))
    return _wrap_ok(result)


# ===== 历史记录 =====

@router.get("/history")
async def list_history(
    request: Request,
    task_id: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    """历史记录(单平台粒度)。

    IDOR 修复:user_id 不再从 Query 取,强制用 JWT 身份,只能看自己的历史。
    """
    user_id = _get_user_id(request)  # IDOR 修复:强制 JWT 身份
    conn = await _get_conn()
    try:
        conditions = ["user_id=$1"]
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
        since = datetime.now(UTC).replace(
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
                count(*) FILTER (WHERE status='draft') as draft,
                count(*) FILTER (WHERE status='cancelled') as cancelled,
                count(*) FILTER (WHERE status='running') as running,
                count(*) FILTER (WHERE status='scheduled') as scheduled,
                count(*) FILTER (
                    WHERE status='scheduled'
                      AND scheduled_at < NOW() - INTERVAL '5 minutes'
                ) as overdue,
                min(scheduled_at) FILTER (WHERE status='scheduled') as next_scheduled_at
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
                "draft": task_stats["draft"],
                "cancelled": task_stats["cancelled"],
                "running": task_stats["running"],
                "scheduled": task_stats["scheduled"],
                "overdue": task_stats["overdue"],
                "nextScheduledAt": (
                    task_stats["next_scheduled_at"].isoformat()
                    if task_stats["next_scheduled_at"]
                    else None
                ),
            },
            "platforms": platforms,
            "scheduler": publish_scheduler.status_snapshot(),
            "runningTasks": publish_scheduler.list_running(user_id),
        })
    finally:
        await conn.close()


@router.get("/analytics/top-content")
async def get_top_content(
    request: Request,
    days: int = Query(default=7, ge=1, le=365),
    limit: int = Query(default=5, ge=1, le=20),
) -> dict[str, Any]:
    """按最新互动快照排出周期内阅读/播放最高的内容。

    原先前端靠 /monitor/overview 逐篇取指标,50 行会触发 N+1 查询并超时。
    这里用一条 SQL 取每个 task_id+platform 的最新快照,按用户过滤后排序。
    """
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        rows = await conn.fetch(
            """
            WITH latest AS (
              SELECT DISTINCT ON (task_id, platform)
                     task_id, platform, views, likes, comments, shares, collected_at
              FROM publish_metrics
              ORDER BY task_id, platform, collected_at DESC
            )
            SELECT l.task_id, l.platform, l.views, l.likes, l.comments, l.shares,
                   t.title, t.finished_at, t.created_at,
                   h.published_url
            FROM latest l
            JOIN publish_tasks t ON t.task_id = l.task_id AND t.user_id = $1
            LEFT JOIN LATERAL (
              SELECT published_url
              FROM publish_history h2
              WHERE h2.task_id = l.task_id
                AND h2.platform = l.platform
                AND h2.success = true
              ORDER BY h2.created_at DESC
              LIMIT 1
            ) h ON true
            WHERE l.collected_at >= NOW() - make_interval(days => $2)
            ORDER BY l.views DESC, l.likes DESC, t.created_at DESC
            LIMIT $3
            """,
            user_id, days, limit,
        )
        items = [
            {
                "taskId": r["task_id"],
                "title": r["title"] or "",
                "platform": r["platform"],
                "views": int(r["views"] or 0),
                "likes": int(r["likes"] or 0),
                "comments": int(r["comments"] or 0),
                "shares": int(r["shares"] or 0),
                "publishedAt": (
                    (r["finished_at"] or r["created_at"]).isoformat()
                    if (r["finished_at"] or r["created_at"])
                    else None
                ),
                "publishedUrl": r["published_url"],
            }
            for r in rows
        ]
        return _wrap_ok({"days": days, "items": items})
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
async def list_running_tasks(request: Request) -> dict[str, Any]:
    """列出当前正在执行的任务(内存)。

    AIS-042:此前无主体直接回全站 `_running` 与历史(含他人 task_id/user_id/
    published_url)。现在按主体过滤(未启用鉴权的本地开发走 jwt_auth 的
    dev 匿名回落,生产缺身份即 401);管理员(role>=1)可看全站。
    """
    user_id = await require_request_user_id(request)
    owner: str | None = None if resolve_request_role_id(request) >= 1 else user_id
    return _wrap_ok(
        {
            "running": publish_scheduler.list_running(owner),
            "history": publish_scheduler.list_history(limit=20, owner_user_id=owner),
        }
    )


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


# =============================================================================
# 监测端点(R4,2026-09-15 新增)
# 契约固定:字段名不可改(前端并行开发依赖)。
# - overview: 每个已发布平台一行(task_id/title/platform/account_id/status/
#   published_url/platform_content_id/created_at/finished_at/last_error/
#   resubmit_count/style_check/metrics)
# - verify: 对任务已发布内容跑 post_publish_verifier 并持久化
# - refresh-metrics: 对任务跑指标采集并返回最新快照
# =============================================================================

class MonitorVerifyRequest(BaseModel):
    task_id: str


class MonitorRefreshMetricsRequest(BaseModel):
    task_id: str


class AutoRetryRequest(BaseModel):
    limit: int = Field(5, ge=1, le=20)


async def _account_id_for_task(conn: asyncpg.Connection, task_id: str, platform: str) -> int | None:
    """从 publish_tasks.targets 取该平台对应的 account_id。"""
    row = await conn.fetchrow("SELECT targets FROM publish_tasks WHERE task_id=$1", task_id)
    if not row:
        return None
    targets = _json_or_raw(row["targets"])
    if not isinstance(targets, list):
        return None
    for t in targets:
        if isinstance(t, dict) and t.get("platform") == platform:
            return t.get("account_id")
    if targets and isinstance(targets[0], dict):
        return targets[0].get("account_id")
    return None


async def _load_account_credentials(account_id: int, platform: str) -> dict[str, Any] | None:
    """从 publish_accounts 解密账号凭证。"""
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT credentials_enc FROM publish_accounts WHERE id=$1 AND platform=$2",
            account_id, platform,
        )
        if not row or not row["credentials_enc"]:
            return None
        return decrypt(row["credentials_enc"])
    finally:
        await conn.close()


async def _resolve_published(conn: asyncpg.Connection, task_id: str, user_id: str) -> asyncpg.Record | None:
    """取任务最近一次成功发布的(平台/内容id/标题/账号归属),含越权校验。"""
    row = await conn.fetchrow(
        """
        SELECT h.platform, h.platform_content_id, h.published_url, t.title, t.user_id
        FROM publish_history h
        JOIN publish_tasks t ON t.task_id = h.task_id
        WHERE h.task_id=$1 AND h.success=true
        ORDER BY h.created_at DESC LIMIT 1
        """,
        task_id,
    )
    if row is None:
        row = await conn.fetchrow(
            """
            SELECT h.platform, h.platform_content_id, h.published_url, t.title, t.user_id
            FROM publish_history h
            JOIN publish_tasks t ON t.task_id = h.task_id
            WHERE h.task_id=$1
            ORDER BY h.created_at DESC LIMIT 1
            """,
            task_id,
        )
    if row is None:
        return None
    if row["user_id"] != user_id:
        return None
    return row


@router.get("/monitor/overview")
async def monitor_overview(
    limit: int = Query(20, ge=1, le=200),
    request: Request = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """监测总览:每个已发布平台一行,含核验与最新指标。"""
    user_id = _get_user_id(request)  # 鉴权 + IDOR 防护
    conn = await _get_conn()
    try:
        rows = await conn.fetch(
            """
            SELECT t.task_id, t.title, t.status, t.created_at, t.finished_at, t.error AS task_error,
                   h.platform, h.published_url, h.platform_content_id, h.error_message AS hist_error,
                   h.created_at AS hist_created
            FROM publish_history h
            JOIN publish_tasks t ON t.task_id = h.task_id
            WHERE t.user_id = $1
            ORDER BY t.created_at DESC
            LIMIT $2
            """,
            user_id, limit,
        )
        items: list[dict[str, Any]] = []
        for r in rows:
            task_id = r["task_id"]
            platform = r["platform"]
            title = r["title"]
            content_id = r["platform_content_id"]
            account_id = await _account_id_for_task(conn, task_id, platform)
            rc = await conn.fetchval(
                """
                SELECT count(*) FROM publish_history h2
                JOIN publish_tasks t2 ON t2.task_id = h2.task_id
                WHERE t2.title = $1 AND h2.platform = $2
                """,
                title, platform,
            )
            attempts = int(rc) if rc else 0
            resubmit_count = max(0, attempts - 1)
            style_check = await latest_style_check(task_id, platform)
            metrics = await latest_metrics(task_id, platform)
            last_error = r["hist_error"] or r["task_error"]
            items.append({
                "task_id": task_id,
                "title": title,
                "platform": platform,
                "account_id": account_id,
                "status": r["status"],
                "published_url": r["published_url"],
                "platform_content_id": content_id,
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "finished_at": r["finished_at"].isoformat() if r["finished_at"] else None,
                "last_error": last_error,
                "resubmit_count": resubmit_count,
                "style_check": style_check,  # 无核验时为 null
                "metrics": metrics,  # 无指标时为 null
            })
        return _wrap_ok({"items": items})
    finally:
        await conn.close()


@router.post("/monitor/verify")
async def monitor_verify(body: MonitorVerifyRequest, request: Request) -> dict[str, Any]:
    """对已发布内容跑 R2 核验,持久化并返回结果。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        row = await _resolve_published(conn, body.task_id, user_id)
        if row is None:
            raise HTTPException(status_code=404, detail="任务不存在 / 未发布 / 无访问权限")
        platform = row["platform"]
        content_id = row["platform_content_id"]
        title = row["title"]
        if not content_id:
            raise HTTPException(status_code=400, detail="任务无 platform_content_id,无法核验")
        account_id = await _account_id_for_task(conn, body.task_id, platform)
        if account_id is None:
            raise HTTPException(status_code=400, detail="无法解析目标账号")
        credentials = await _load_account_credentials(account_id, platform)
        if credentials is None:
            raise HTTPException(status_code=400, detail="无法加载账号凭证")
    finally:
        await conn.close()

    result = await verify_published(platform, credentials, content_id, title, account_id)
    await persist_style_check(body.task_id, platform, content_id, result)
    return _wrap_ok(result)


@router.post("/monitor/refresh-metrics")
async def monitor_refresh_metrics(body: MonitorRefreshMetricsRequest, request: Request) -> dict[str, Any]:
    """对已发布内容跑 R3 指标采集,返回最新快照。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        row = await _resolve_published(conn, body.task_id, user_id)
        if row is None:
            raise HTTPException(status_code=404, detail="任务不存在 / 未发布 / 无访问权限")
        platform = row["platform"]
        content_id = row["platform_content_id"]
        if not content_id:
            raise HTTPException(status_code=400, detail="任务无 platform_content_id,无法采集")
        account_id = await _account_id_for_task(conn, body.task_id, platform)
        if account_id is None:
            raise HTTPException(status_code=400, detail="无法解析目标账号")
        credentials = await _load_account_credentials(account_id, platform)
        if credentials is None:
            raise HTTPException(status_code=400, detail="无法加载账号凭证")
    finally:
        await conn.close()

    await collect_metrics(body.task_id, platform, content_id, credentials, account_id)
    latest = await latest_metrics(body.task_id, platform)
    return _wrap_ok(latest)


@router.get("/monitor/metrics-summary")
async def monitor_metrics_summary(
    days: int = Query(30, ge=1, le=365),
    request: Request = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """按平台汇总最新指标快照(用户维度),供分析页合并展示。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    try:
        rows = await conn.fetch(
            """
            WITH latest AS (
              SELECT DISTINCT ON (task_id, platform)
                     task_id, platform, views, likes, comments, shares, collected_at
              FROM publish_metrics
              ORDER BY task_id, platform, collected_at DESC
            )
            SELECT l.platform,
                   count(*)::int AS items,
                   COALESCE(SUM(l.views), 0)::bigint AS views,
                   COALESCE(SUM(l.likes), 0)::bigint AS likes,
                   COALESCE(SUM(l.comments), 0)::bigint AS comments,
                   COALESCE(SUM(l.shares), 0)::bigint AS shares
            FROM latest l
            WHERE l.collected_at >= NOW() - make_interval(days => $2)
              AND (
                EXISTS (SELECT 1 FROM publish_tasks t WHERE t.task_id = l.task_id AND t.user_id = $1)
                OR EXISTS (
                  SELECT 1 FROM publish_history h
                  WHERE h.task_id = l.task_id AND h.platform = l.platform AND h.user_id = $1
                )
              )
            GROUP BY l.platform
            ORDER BY views DESC
            """,
            user_id, days,
        )
        trend_rows = await conn.fetch(
            """
            WITH daily AS (
              SELECT DISTINCT ON (task_id, platform, date_trunc('day', collected_at))
                     task_id, platform, views, likes, comments, shares,
                     date_trunc('day', collected_at) AS d
              FROM publish_metrics
              ORDER BY task_id, platform, date_trunc('day', collected_at), collected_at DESC
            )
            SELECT d::date AS date,
                   COALESCE(SUM(views), 0)::bigint AS views,
                   COALESCE(SUM(likes), 0)::bigint AS likes,
                   COALESCE(SUM(comments), 0)::bigint AS comments,
                   COALESCE(SUM(shares), 0)::bigint AS shares
            FROM daily
            WHERE d >= NOW() - make_interval(days => $2)
              AND (
                EXISTS (SELECT 1 FROM publish_tasks t WHERE t.task_id = daily.task_id AND t.user_id = $1)
                OR EXISTS (
                  SELECT 1 FROM publish_history h
                  WHERE h.task_id = daily.task_id AND h.platform = daily.platform AND h.user_id = $1
                )
              )
            GROUP BY d ORDER BY d
            """,
            user_id, days,
        )
    finally:
        await conn.close()

    platforms = [
        {
            "platform": r["platform"],
            "items": r["items"],
            "views": int(r["views"]),
            "likes": int(r["likes"]),
            "comments": int(r["comments"]),
            "shares": int(r["shares"]),
        }
        for r in rows
    ]
    totals = {
        "views": sum(p["views"] for p in platforms),
        "likes": sum(p["likes"] for p in platforms),
        "comments": sum(p["comments"] for p in platforms),
        "shares": sum(p["shares"] for p in platforms),
    }
    return _wrap_ok({
        "days": days,
        "totals": totals,
        "platforms": platforms,
        "trend": [
            {
                "date": r["date"].isoformat(),
                "views": int(r["views"]),
                "likes": int(r["likes"]),
                "comments": int(r["comments"]),
                "shares": int(r["shares"]),
            }
            for r in trend_rows
        ],
    })


@router.post("/monitor/auto-retry")
async def monitor_auto_retry(body: AutoRetryRequest, request: Request) -> dict[str, Any]:
    """失败自愈:对失败任务做有界自动重试(每任务最多 1 次,登录失效类跳过)。"""
    user_id = _get_user_id(request)
    conn = await _get_conn()
    attempts: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_auto_retry (
                task_id TEXT PRIMARY KEY,
                attempts INTEGER DEFAULT 1,
                last_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        rows = await conn.fetch(
            """
            SELECT task_id, results, error
            FROM publish_tasks
            WHERE user_id = $1 AND status = 'failed'
            ORDER BY finished_at DESC NULLS LAST
            LIMIT $2
            """,
            user_id, body.limit,
        )
        for r in rows:
            task_id = r["task_id"]
            task_results = _json_or_raw(r["results"])
            if not isinstance(task_results, list):
                task_results = []
            failed = [
                x for x in task_results if isinstance(x, dict) and not x.get("success")
            ]
            if not failed:
                skipped.append({"task_id": task_id, "reason": "no_failed_results"})
                continue
            auth_blocked = any(
                x.get("error_kind") == "auth_required"
                or (isinstance(x.get("challenge"), dict) and x["challenge"].get("type") == "reauth")
                for x in failed
            )
            if auth_blocked:
                skipped.append({"task_id": task_id, "reason": "auth_required"})
                continue
            seen = await conn.fetchval(
                "SELECT attempts FROM publish_auto_retry WHERE task_id = $1", task_id
            )
            if seen:
                skipped.append({"task_id": task_id, "reason": "already_auto_retried"})
                continue
            platforms = sorted(
                {str(x.get("platform")) for x in failed if x.get("platform")}
            )
            await conn.execute(
                "INSERT INTO publish_auto_retry (task_id, attempts) VALUES ($1, 1) "
                "ON CONFLICT (task_id) DO UPDATE SET attempts = publish_auto_retry.attempts + 1, last_at = NOW()",
                task_id,
            )
            attempts.append({"task_id": task_id, "platforms": platforms})
    finally:
        await conn.close()

    results: list[dict[str, Any]] = []
    for item in attempts:
        try:
            res = await publish_scheduler.retry_platforms(item["task_id"], item["platforms"] or None)
            results.append({
                "task_id": item["task_id"],
                "platforms": item["platforms"],
                "ok": bool(res.get("ok")),
                "error": res.get("error"),
            })
        except Exception as e:
            logger.exception("[auto-retry] task=%s failed", item["task_id"])
            results.append({
                "task_id": item["task_id"],
                "platforms": item["platforms"],
                "ok": False,
                "error": f"{type(e).__name__}: {e}",
            })
    return _wrap_ok({"attempted": results, "skipped": skipped})
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

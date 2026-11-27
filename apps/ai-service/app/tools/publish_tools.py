# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布工具（2026-11-27 立）。

为什么先做只读：真实发布是不可逆外部动作，Agent 绝不能直接点“发出去”。这一批做
账号清单、发布预检、发布统计、单任务详情，以及“只落草稿不执行”的写入闸门和
“草稿可改但仍是草稿”的编辑闸门；Agent 没有任何直接发布或确认发布的工具。

纪律：
- 账号清单只回传状态与健康信息，绝不回传 credentials_enc 或解密后的凭据；
- 预检复用 `services/publish/preflight.py` 的本地判定，账号归属由它按 user_id 校验；
- 内容合规复用 `precheck_content`，不另造一套规则；
- 草稿只写 status='draft'，不 spawn、不排期；编辑草稿也必须重新预检且仍为 draft；
- 确认接口只给登录用户，Agent 调不到；
- 单任务详情只读，按 task_id+user_id 查，绝不回传 userId/凭据；
- 预检通过不等于平台审核通过，平台侧实时状态必须在真正创建任务前再确认。
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.db import get_db_conn

from .content_compliance_tools import precheck_content

_TOOL_LIST = "list_publish_accounts"
_TOOL_PREFLIGHT = "publish_preflight"
_TOOL_STATS = "get_publish_stats"
_TOOL_DRAFT = "create_publish_draft"
_TOOL_EDIT = "update_publish_draft"
_TOOL_TASK = "get_publish_task"
_TOOL_TASKS = "list_publish_tasks"
_TOOL_ACCEPTANCE = "get_publish_acceptance"
_MAX_TARGETS = 25
_MAX_ACCOUNTS = 500
_FORMATS = {"md", "docx", "html", "pdf", "image", "video"}
_TEXT_FORMATS = {"md", "html", "docx", "pdf"}


def _fail(tool: str, code: str, message: str) -> dict[str, Any]:
    return {"tool": tool, "ok": False, "errorCode": code, "message": message}


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return default


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:  # noqa: BLE001
            return str(value)
    return str(value)


def _json_obj(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:  # noqa: BLE001
            return {}
    return {}


def _json_list(raw: Any) -> list[Any]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except Exception:  # noqa: BLE001
            return []
    return []


def _bool_value(raw: Any, default: bool = True) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.strip().lower() not in ("false", "0", "no", "off", "")
    if raw is None:
        return default
    return bool(raw)


async def _open_conn() -> Any:
    if not getattr(settings, "database_url", None):
        raise RuntimeError("DATABASE_URL not configured")
    return await get_db_conn()


def _upload_root() -> Path:
    raw = getattr(settings, "publish_upload_dir", None)
    root = Path(raw) if raw else Path.cwd() / ".uploads" / "publish"
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _safe_local_path(raw: str, field: str) -> tuple[str | None, str | None]:
    """把待发布文件限制在上传根目录内；返回 (绝对路径, 错误)。"""
    try:
        real = Path(raw).expanduser().resolve(strict=False)
    except OSError:
        return None, f"{field} 路径无法解析"
    root = _upload_root()
    if real != root and not real.is_relative_to(root):
        return None, f"{field} 不在允许的上传目录内"
    if not real.is_file():
        return None, f"{field} 文件不存在"
    return str(real), None


def _draft_request_hash(
    title: str,
    fmt: str,
    text: str | None,
    file_path: str | None,
    cover_path: str | None,
    images: list[str],
    targets: list[dict[str, Any]],
) -> str:
    payload = {
        "title": title,
        "format": fmt,
        "text": text,
        "file_path": file_path,
        "cover_path": cover_path,
        "images": images,
        "targets": targets,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _sanitize_account(row: Any, session: Any) -> dict[str, Any]:
    """只输出可给用户/Agent 看的字段；凭证字段一律不出现。"""
    extra = _json_obj(_row_get(row, "extra", {}))
    blockers = extra.get("preflight_blockers")
    if isinstance(blockers, str):
        try:
            blockers = json.loads(blockers)
        except Exception:  # noqa: BLE001
            blockers = []
    blockers_count = len(blockers) if isinstance(blockers, list) else 0
    return {
        "accountId": int(_row_get(row, "id")),
        "platform": str(_row_get(row, "platform") or ""),
        "displayName": str(_row_get(row, "display_name") or ""),
        "status": str(_row_get(row, "status") or ""),
        "hasCredentials": bool(_row_get(row, "credentials_enc")),
        "lastVerifiedAt": _iso(_row_get(row, "last_verified_at")),
        "lastVerifyMsg": str(_row_get(row, "last_verify_msg") or "")[:300] or None,
        "publishBlocked": bool(
            extra.get("publish_blocked") is True or extra.get("disabled_by_user") is True
        ),
        "publishBlockReason": str(extra.get("publish_block_reason") or "")[:300] or None,
        "preflightBlockers": blockers_count,
        "sessionStatus": str(_row_get(session, "status") or "") or None,
        "sessionLastError": str(_row_get(session, "last_error") or "")[:300] or None,
        "createdAt": _iso(_row_get(row, "created_at")),
    }


async def list_publish_accounts(arguments: dict[str, Any]) -> dict[str, Any]:
    """列出当前用户的发布账号（不读取、不解密凭据）。"""
    if not isinstance(arguments, dict):
        return _fail(_TOOL_LIST, "INVALID_ARGS", "arguments 必须为 dict")
    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_LIST, "MISSING_USER", "缺少当前用户身份")

    platform = arguments.get("platform")
    if platform is not None and not isinstance(platform, str):
        return _fail(_TOOL_LIST, "INVALID_PLATFORM", "platform 必须为字符串")
    platform = (platform or "").strip().lower()

    status = arguments.get("status")
    if status is not None and not isinstance(status, str):
        return _fail(_TOOL_LIST, "INVALID_STATUS", "status 必须为字符串")
    status = (status or "").strip()

    include_disabled = _bool_value(arguments.get("include_disabled"), True)
    limit = arguments.get("limit", 100)
    if isinstance(limit, bool) or not isinstance(limit, int):
        return _fail(_TOOL_LIST, "INVALID_LIMIT", "limit 必须为整数")
    limit = max(1, min(limit, _MAX_ACCOUNTS))

    try:
        conn = await _open_conn()
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_LIST, "DB_UNAVAILABLE", f"账号库不可用: {type(e).__name__}")

    try:
        try:
            rows = await conn.fetch(
                """
                SELECT id, platform, display_name, status, credentials_enc,
                       last_verified_at, last_verify_msg, extra, created_at
                FROM publish_accounts
                WHERE user_id = $1
                ORDER BY created_at DESC
                """,
                user_id,
            )
        except Exception as e:  # noqa: BLE001
            return _fail(_TOOL_LIST, "DB_UNAVAILABLE", f"账号表查询失败: {type(e).__name__}")

        sessions: dict[int, Any] = {}
        ids = [int(_row_get(row, "id")) for row in rows]
        if ids:
            try:
                session_rows = await conn.fetch(
                    """
                    SELECT account_id, status, last_error
                    FROM publish_session_state
                    WHERE account_id = ANY($1::bigint[])
                    """,
                    ids,
                )
                sessions = {int(_row_get(item, "account_id")): item for item in session_rows}
            except Exception:  # noqa: BLE001
                # 会话表缺失/未迁移不算致命，账号清单仍然可用，只是没有登录态一列。
                sessions = {}
    finally:
        await conn.close()

    items: list[dict[str, Any]] = []
    for row in rows:
        if platform and str(_row_get(row, "platform") or "") != platform:
            continue
        row_status = str(_row_get(row, "status") or "")
        if status and row_status != status:
            continue
        if not include_disabled and row_status != "active":
            continue
        account_id = int(_row_get(row, "id"))
        items.append(_sanitize_account(row, sessions.get(account_id)))
        if len(items) >= limit:
            break

    by_platform: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for item in items:
        by_platform[item["platform"]] = by_platform.get(item["platform"], 0) + 1
        by_status[item["status"]] = by_status.get(item["status"], 0) + 1

    return {
        "tool": _TOOL_LIST,
        "ok": True,
        "count": len(items),
        "items": items,
        "summary": {"byPlatform": by_platform, "byStatus": by_status},
        "hint": "账号列表不含凭据；发布前用 publish_preflight 逐账号预检" if items else "还没有接入平台账号",
    }


def _validate_targets(raw: Any) -> tuple[list[dict[str, Any]], str | None]:
    if not isinstance(raw, list) or not raw:
        return [], "targets 必须是非空数组"
    if len(raw) > _MAX_TARGETS:
        return [], f"targets 最多 {_MAX_TARGETS} 个"
    targets: list[dict[str, Any]] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            return [], f"targets[{index}] 必须是对象"
        platform = item.get("platform")
        if not isinstance(platform, str) or not platform.strip():
            return [], f"targets[{index}].platform 必填"
        account_id = item.get("account_id")
        if account_id is not None:
            if isinstance(account_id, bool) or not isinstance(account_id, int):
                return [], f"targets[{index}].account_id 必须为整数"
            if account_id <= 0:
                return [], f"targets[{index}].account_id 必须为正整数"
        targets.append({"platform": platform.strip().lower(), "account_id": account_id})
    return targets, None


async def publish_preflight(arguments: dict[str, Any]) -> dict[str, Any]:
    """发布前预检：内容合规 + 账号/适配器/格式，只读，不创建任务。"""
    if not isinstance(arguments, dict):
        return _fail(_TOOL_PREFLIGHT, "INVALID_ARGS", "arguments 必须为 dict")

    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_PREFLIGHT, "MISSING_USER", "缺少当前用户身份")

    title = arguments.get("title")
    if not isinstance(title, str) or not title.strip():
        return _fail(_TOOL_PREFLIGHT, "MISSING_TITLE", "title 必填且不能为空")
    title = title.strip()
    if len(title) > 500:
        return _fail(_TOOL_PREFLIGHT, "TITLE_TOO_LONG", "title 最多 500 字")

    fmt = arguments.get("format")
    if not isinstance(fmt, str) or fmt not in _FORMATS:
        return _fail(_TOOL_PREFLIGHT, "INVALID_FORMAT", "format 仅支持 md/docx/html/pdf/image/video")

    text = arguments.get("text")
    if text is not None and not isinstance(text, str):
        return _fail(_TOOL_PREFLIGHT, "INVALID_TEXT", "text 必须为字符串")
    text = text.strip() if text else None

    file_path = arguments.get("file_path")
    if file_path is not None and not isinstance(file_path, str):
        return _fail(_TOOL_PREFLIGHT, "INVALID_FILE_PATH", "file_path 必须为字符串")
    file_path = file_path.strip() if file_path else None

    cover_path = arguments.get("cover_path")
    if cover_path is not None and not isinstance(cover_path, str):
        return _fail(_TOOL_PREFLIGHT, "INVALID_COVER_PATH", "cover_path 必须为字符串")

    images_raw = arguments.get("images")
    if images_raw is not None and not isinstance(images_raw, list):
        return _fail(_TOOL_PREFLIGHT, "INVALID_IMAGES", "images 必须是字符串数组")
    images = [str(item).strip() for item in (images_raw or []) if str(item).strip()]
    if len(images) > 20:
        return _fail(_TOOL_PREFLIGHT, "TOO_MANY_IMAGES", "images 最多 20 张")

    if fmt in ("md", "html") and not text and not file_path:
        return _fail(_TOOL_PREFLIGHT, "MISSING_CONTENT", "md/html 必须给 text 或 file_path")
    if fmt in ("docx", "pdf", "image", "video") and not file_path:
        return _fail(_TOOL_PREFLIGHT, "MISSING_FILE", f"{fmt} 必须给 file_path")

    targets, target_error = _validate_targets(arguments.get("targets"))
    if target_error:
        return _fail(_TOOL_PREFLIGHT, "INVALID_TARGETS", target_error)

    profile = arguments.get("profile")
    if profile is not None and not isinstance(profile, str):
        return _fail(_TOOL_PREFLIGHT, "INVALID_PROFILE", "profile 必须为字符串")

    content_check: dict[str, Any] | None = None
    if text:
        check_args: dict[str, Any] = {
            "content": text,
            "title": title,
            "platform": targets[0]["platform"],
        }
        for key in ("hashtags", "profile", "min_chars", "max_chars", "title_length", "hashtag_count", "require_ai_disclosure"):
            if key in arguments and arguments[key] is not None:
                check_args[key] = arguments[key]
        try:
            content_check = await precheck_content(check_args)
        except Exception as e:  # noqa: BLE001
            return _fail(_TOOL_PREFLIGHT, "CONTENT_CHECK_FAILED", f"内容自检失败: {type(e).__name__}")

    try:
        conn = await _open_conn()
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_PREFLIGHT, "DB_UNAVAILABLE", f"账号库不可用: {type(e).__name__}")

    try:
        from app.services.publish.base_adapter import PublishContent
        from app.services.publish.preflight import run_preflight

        content = PublishContent(
            format=fmt,
            title=title,
            text=text,
            file_path=file_path,
            cover_path=cover_path,
            images=images,
        )
        result = await run_preflight(conn, user_id, targets, content)
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_PREFLIGHT, "PREFLIGHT_FAILED", f"预检失败: {type(e).__name__}: {e}")
    finally:
        await conn.close()

    target_ok = bool(result.get("ok"))
    content_ok = content_check is None or bool(content_check.get("ok"))
    content_blocking = int(content_check.get("blocking") or 0) if content_check else 0
    if not content_ok and content_blocking == 0:
        content_blocking = 1  # 自检本身报错（如 profile 非法）也算一条阻断
    content_warnings = int(content_check.get("warnings") or 0) if content_check else 0
    inline_warning = 1 if (not text and fmt in _TEXT_FORMATS) else 0
    warnings = int(result.get("warnings") or 0) + content_warnings + inline_warning
    blocked = int(result.get("blocked") or 0) + content_blocking

    return {
        "tool": _TOOL_PREFLIGHT,
        "ok": target_ok and content_ok,
        "targetsOk": target_ok,
        "contentOk": content_ok,
        "blocked": blocked,
        "warnings": warnings,
        "contentCheck": content_check,
        "targets": result.get("targets") or [],
        "generatedAt": datetime.now(UTC).isoformat(),
    }


async def create_publish_draft(arguments: dict[str, Any]) -> dict[str, Any]:
    """创建发布草稿：先跑预检，通过后只落 status='draft'，不执行、不排期。

    真实发布必须由登录用户在发布历史里点“确认发布”；Agent 调不到确认接口。
    """
    if not isinstance(arguments, dict):
        return _fail(_TOOL_DRAFT, "INVALID_ARGS", "arguments 必须为 dict")
    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_DRAFT, "MISSING_USER", "缺少当前用户身份")

    preflight = await publish_preflight(arguments)
    if not preflight.get("ok"):
        return {
            "tool": _TOOL_DRAFT,
            "ok": False,
            "errorCode": "PREFLIGHT_BLOCKED",
            "message": "发布预检未通过，草稿未创建",
            "blocked": preflight.get("blocked", 0),
            "warnings": preflight.get("warnings", 0),
            "contentCheck": preflight.get("contentCheck"),
            "targets": preflight.get("targets") or [],
        }

    targets, target_error = _validate_targets(arguments.get("targets"))
    if target_error:
        return _fail(_TOOL_DRAFT, "INVALID_TARGETS", target_error)
    missing = [t for t in targets if t.get("account_id") is None]
    if missing:
        return _fail(
            _TOOL_DRAFT,
            "ACCOUNT_REQUIRED",
            "创建草稿必须显式指定 account_id，不能让账号池在确认时才换号",
        )

    fmt = str(arguments.get("format") or "")
    title = str(arguments.get("title") or "").strip()
    text = arguments.get("text")
    text = text.strip() if isinstance(text, str) and text.strip() else None

    file_path = arguments.get("file_path")
    file_path = file_path.strip() if isinstance(file_path, str) and file_path.strip() else None
    if file_path:
        file_path, path_error = _safe_local_path(file_path, "file_path")
        if path_error:
            return _fail(_TOOL_DRAFT, "INVALID_FILE_PATH", path_error)

    cover_path = arguments.get("cover_path")
    cover_path = cover_path.strip() if isinstance(cover_path, str) and cover_path.strip() else None
    if cover_path:
        cover_path, cover_error = _safe_local_path(cover_path, "cover_path")
        if cover_error:
            return _fail(_TOOL_DRAFT, "INVALID_COVER_PATH", cover_error)

    images: list[str] = []
    for index, raw in enumerate(arguments.get("images") or []):
        value = str(raw).strip()
        if not value:
            continue
        if value.startswith(("http://", "https://")):
            images.append(value)
            continue
        safe, image_error = _safe_local_path(value, f"images[{index}]")
        if image_error:
            return _fail(_TOOL_DRAFT, "INVALID_IMAGE", image_error)
        images.append(str(safe))

    request_hash = _draft_request_hash(title, fmt, text, file_path, cover_path, images, targets)
    idempotency_key = arguments.get("idempotency_key")
    if idempotency_key is not None and not isinstance(idempotency_key, str):
        return _fail(_TOOL_DRAFT, "INVALID_IDEMPOTENCY_KEY", "idempotency_key 必须为字符串")
    idempotency_key = (idempotency_key or "").strip() or f"draft-{request_hash[:32]}"
    if len(idempotency_key) > 128:
        return _fail(_TOOL_DRAFT, "INVALID_IDEMPOTENCY_KEY", "idempotency_key 最多 128 字符")

    task_id = f"pub-{uuid.uuid4().hex[:12]}-{int(time.time())}"

    try:
        from app.services.publish.base_adapter import PublishContent
        from app.services.publish.scheduler import publish_scheduler

        content = PublishContent(
            format=fmt,
            title=title,
            text=text,
            file_path=file_path,
            cover_path=cover_path,
            images=images,
        )
        result = await publish_scheduler.submit_task(
            task_id=task_id,
            user_id=user_id,
            content=content,
            targets=targets,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            as_draft=True,
        )
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_DRAFT, "DRAFT_FAILED", f"草稿落库失败: {type(e).__name__}")

    if not result.get("ok"):
        return _fail(_TOOL_DRAFT, "DRAFT_FAILED", str(result.get("error") or "草稿落库失败"))

    content_hash = None
    content_check = preflight.get("contentCheck")
    if isinstance(content_check, dict):
        content_hash = content_check.get("contentHash")

    return {
        "tool": _TOOL_DRAFT,
        "ok": True,
        "taskId": result.get("task_id"),
        "status": result.get("status"),
        "title": title,
        "format": fmt,
        "targets": targets,
        "contentHash": content_hash,
        "blocked": 0,
        "warnings": preflight.get("warnings", 0),
        "preflight": preflight.get("targets") or [],
        "idempotentReplay": bool(result.get("idempotent_replay")),
        "confirm": {
            "path": "/publish/history",
            "hint": "草稿不会自动发布；请到发布历史展开该草稿，点“确认发布”后才会进调度。",
        },
        "generatedAt": datetime.now(UTC).isoformat(),
    }


async def update_publish_draft(arguments: dict[str, Any]) -> dict[str, Any]:
    """原地修改一条草稿：只允许 status='draft'，改完重新预检，仍保持 draft。

    合并语义：只覆盖调用方显式给的字段；title/format/text/file_path/cover_path/
    images/targets 没给就保留原值。改标题不会自动重发，也不会替人确认。
    """
    if not isinstance(arguments, dict):
        return _fail(_TOOL_EDIT, "INVALID_ARGS", "arguments 必须为 dict")
    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_EDIT, "MISSING_USER", "缺少当前用户身份")
    task_id = arguments.get("task_id")
    if not isinstance(task_id, str) or not task_id.strip():
        return _fail(_TOOL_EDIT, "INVALID_TASK_ID", "task_id 必须为非空字符串")
    task_id = task_id.strip()
    if len(task_id) > 128:
        return _fail(_TOOL_EDIT, "INVALID_TASK_ID", "task_id 最多 128 字符")

    try:
        conn = await _open_conn()
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_EDIT, "DB_UNAVAILABLE", f"草稿库不可用: {type(e).__name__}")

    try:
        row = await conn.fetchrow(
            """
            SELECT task_id, title, format, status, content, targets
            FROM publish_tasks
            WHERE task_id=$1 AND user_id=$2
            """,
            task_id,
            user_id,
        )
        if not row:
            return _fail(_TOOL_EDIT, "TASK_NOT_FOUND", "草稿不存在或不属于当前用户")
        if str(_row_get(row, "status") or "") != "draft":
            return _fail(_TOOL_EDIT, "NOT_DRAFT", "只有草稿可以编辑")

        current_content = _json_obj(_row_get(row, "content", {}))
        current_targets = _json_list(_row_get(row, "targets", []))

        title = str(_row_get(row, "title") or "").strip()
        if "title" in arguments:
            raw_title = arguments.get("title")
            if not isinstance(raw_title, str) or not raw_title.strip():
                return _fail(_TOOL_EDIT, "INVALID_TITLE", "title 必须为非空字符串")
            title = raw_title.strip()
            if len(title) > 500:
                return _fail(_TOOL_EDIT, "INVALID_TITLE", "title 最多 500 字")

        fmt = str(_row_get(row, "format") or "")
        if "format" in arguments:
            raw_format = arguments.get("format")
            if not isinstance(raw_format, str) or raw_format not in _FORMATS:
                return _fail(_TOOL_EDIT, "INVALID_FORMAT", "format 仅支持 md/docx/html/pdf/image/video")
            fmt = raw_format

        text = current_content.get("text")
        if "text" in arguments:
            raw_text = arguments.get("text")
            if raw_text is not None and not isinstance(raw_text, str):
                return _fail(_TOOL_EDIT, "INVALID_TEXT", "text 必须为字符串")
            text = raw_text.strip() if isinstance(raw_text, str) and raw_text.strip() else None

        file_path = current_content.get("file_path")
        if "file_path" in arguments:
            raw_file = arguments.get("file_path")
            if raw_file is not None and not isinstance(raw_file, str):
                return _fail(_TOOL_EDIT, "INVALID_FILE_PATH", "file_path 必须为字符串")
            file_path = raw_file.strip() if isinstance(raw_file, str) and raw_file.strip() else None
            if file_path:
                file_path, path_error = _safe_local_path(file_path, "file_path")
                if path_error:
                    return _fail(_TOOL_EDIT, "INVALID_FILE_PATH", path_error)

        cover_path = current_content.get("cover_path")
        if "cover_path" in arguments:
            raw_cover = arguments.get("cover_path")
            if raw_cover is not None and not isinstance(raw_cover, str):
                return _fail(_TOOL_EDIT, "INVALID_COVER_PATH", "cover_path 必须为字符串")
            cover_path = raw_cover.strip() if isinstance(raw_cover, str) and raw_cover.strip() else None
            if cover_path:
                cover_path, cover_error = _safe_local_path(cover_path, "cover_path")
                if cover_error:
                    return _fail(_TOOL_EDIT, "INVALID_COVER_PATH", cover_error)

        images = [str(item) for item in _json_list(current_content.get("images"))]
        if "images" in arguments:
            raw_images = arguments.get("images")
            if raw_images is not None and not isinstance(raw_images, list):
                return _fail(_TOOL_EDIT, "INVALID_IMAGES", "images 必须是字符串数组")
            images = []
            for index, raw in enumerate(raw_images or []):
                value = str(raw).strip()
                if not value:
                    continue
                if value.startswith(("http://", "https://")):
                    images.append(value)
                    continue
                safe, image_error = _safe_local_path(value, f"images[{index}]")
                if image_error:
                    return _fail(_TOOL_EDIT, "INVALID_IMAGE", image_error)
                images.append(str(safe))

        raw_targets = arguments.get("targets") if "targets" in arguments else current_targets
        targets, target_error = _validate_targets(raw_targets)
        if target_error:
            return _fail(_TOOL_EDIT, "INVALID_TARGETS", target_error)
        missing = [item for item in targets if item.get("account_id") is None]
        if missing:
            return _fail(
                _TOOL_EDIT,
                "ACCOUNT_REQUIRED",
                "编辑草稿必须保留/显式指定 account_id，不能让账号池在确认时才换号",
            )

        check_args: dict[str, Any] = {
            "__user_id": user_id,
            "title": title,
            "format": fmt,
            "targets": targets,
            "text": text,
            "file_path": file_path,
            "cover_path": cover_path,
            "images": images,
        }
        for key in (
            "profile",
            "hashtags",
            "min_chars",
            "max_chars",
            "title_length",
            "hashtag_count",
            "require_ai_disclosure",
        ):
            if key in arguments:
                check_args[key] = arguments[key]

        preflight = await publish_preflight(check_args)
        if not preflight.get("ok"):
            return {
                "tool": _TOOL_EDIT,
                "ok": False,
                "errorCode": "PREFLIGHT_BLOCKED",
                "message": "草稿修改未通过预检，库里的原草稿保持不变",
                "taskId": task_id,
                "blocked": preflight.get("blocked", 0),
                "warnings": preflight.get("warnings", 0),
                "contentCheck": preflight.get("contentCheck"),
                "targets": preflight.get("targets") or [],
            }

        content_payload: dict[str, Any] = {
            "text": text,
            "file_path": file_path,
            "cover_path": cover_path,
            "images": images,
            "extra": current_content.get("extra") or {},
        }
        if "html" in current_content:
            content_payload["html"] = current_content.get("html")
        request_hash = _draft_request_hash(
            title,
            fmt,
            text,
            file_path,
            cover_path,
            images,
            targets,
        )
        updated = await conn.fetchrow(
            """
            UPDATE publish_tasks
            SET title=$1, format=$2, content=$3, targets=$4,
                request_hash=$5, updated_at=NOW()
            WHERE task_id=$6 AND user_id=$7 AND status='draft'
            RETURNING task_id, status, updated_at
            """,
            title,
            fmt,
            json.dumps(content_payload, ensure_ascii=False),
            json.dumps(targets, ensure_ascii=False),
            request_hash,
            task_id,
            user_id,
        )
        if not updated:
            return _fail(_TOOL_EDIT, "DRAFT_STATE_CHANGED", "草稿状态已变化，未写入修改")

        content_hash = None
        content_check = preflight.get("contentCheck")
        if isinstance(content_check, dict):
            content_hash = content_check.get("contentHash")
        return {
            "tool": _TOOL_EDIT,
            "ok": True,
            "taskId": updated["task_id"],
            "status": updated["status"],
            "title": title,
            "format": fmt,
            "targets": targets,
            "contentHash": content_hash,
            "changedFields": sorted(
                key
                for key in (
                    "title",
                    "format",
                    "text",
                    "file_path",
                    "cover_path",
                    "images",
                    "targets",
                )
                if key in arguments
            ),
            "blocked": 0,
            "warnings": preflight.get("warnings", 0),
            "preflight": preflight.get("targets") or [],
            "updatedAt": _iso(_row_get(updated, "updated_at")),
            "confirm": {
                "path": "/publish/history",
                "hint": "修改后的草稿仍未发布；请到发布历史展开并点“确认发布”后才会进调度。",
            },
            "generatedAt": datetime.now(UTC).isoformat(),
        }
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_EDIT, "EDIT_FAILED", f"草稿修改失败: {type(e).__name__}")
    finally:
        await conn.close()


async def list_publish_tasks(arguments: dict[str, Any]) -> dict[str, Any]:
    """列出当前用户的发布任务队列（只读，不含正文与凭据）。"""
    if not isinstance(arguments, dict):
        return _fail(_TOOL_TASKS, "INVALID_ARGS", "arguments 必须为 dict")
    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_TASKS, "MISSING_USER", "缺少当前用户身份")

    status = arguments.get("status")
    if status is not None:
        if not isinstance(status, str) or not status.strip():
            return _fail(_TOOL_TASKS, "INVALID_STATUS", "status 必须为非空字符串")
        status = status.strip()
        if status not in {"pending", "draft", "scheduled", "running", "success", "failed", "partial", "cancelled"}:
            return _fail(_TOOL_TASKS, "INVALID_STATUS", "status 不在允许范围")
    days = arguments.get("days", 30)
    if not isinstance(days, int) or isinstance(days, bool) or not 1 <= days <= 365:
        return _fail(_TOOL_TASKS, "INVALID_DAYS", "days 必须是 1-365 的整数")
    limit = arguments.get("limit", 50)
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 200:
        return _fail(_TOOL_TASKS, "INVALID_LIMIT", "limit 必须是 1-200 的整数")

    since = datetime.now(UTC) - timedelta(days=days)
    try:
        conn = await _open_conn()
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_TASKS, "DB_UNAVAILABLE", f"任务库不可用: {type(e).__name__}")
    try:
        sql = """
            SELECT task_id, title, format, status, content, targets, error,
                   scheduled_at, created_at, updated_at
            FROM publish_tasks
            WHERE user_id=$1 AND created_at >= $2
        """
        args: list[Any] = [user_id, since]
        if status:
            sql += " AND status=$3"
            args.append(status)
        sql += " ORDER BY created_at DESC LIMIT $" + str(len(args) + 1)
        args.append(limit)
        rows = await conn.fetch(sql, *args)
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_TASKS, "DB_UNAVAILABLE", f"任务表查询失败: {type(e).__name__}")
    finally:
        await conn.close()

    items: list[dict[str, Any]] = []
    for row in rows:
        targets = _json_list(_row_get(row, "targets", []))
        target_items: list[dict[str, Any]] = []
        for target in targets:
            if not isinstance(target, dict):
                continue
            target_items.append(
                {
                    "platform": str(target.get("platform") or ""),
                    "accountId": target.get("account_id") or target.get("accountId"),
                }
            )
        content = _row_get(row, "content", {})
        preview = ""
        if isinstance(content, dict):
            preview = str(content.get("text") or "")[:200]
        items.append(
            {
                "taskId": str(_row_get(row, "task_id") or ""),
                "title": str(_row_get(row, "title") or "")[:200],
                "format": str(_row_get(row, "format") or ""),
                "status": str(_row_get(row, "status") or ""),
                "targets": target_items,
                "preview": preview,
                "error": str(_row_get(row, "error") or "")[:300] or None,
                "scheduledAt": _iso(_row_get(row, "scheduled_at")),
                "createdAt": _iso(_row_get(row, "created_at")),
                "updatedAt": _iso(_row_get(row, "updated_at")),
                "nextTool": "get_publish_task",
            }
        )

    return {
        "tool": _TOOL_TASKS,
        "ok": True,
        "days": days,
        "status": status,
        "items": items,
        "count": len(items),
        "hint": (
            "没有匹配的发布任务"
            if not items
            else "草稿需要人工确认；失败任务先用 get_publish_task 看原因"
        ),
    }


async def get_publish_task(arguments: dict[str, Any]) -> dict[str, Any]:
    """单任务详情（只读）：状态、逐平台结果、失败原因、指标快照与下一步动作。

    只按 task_id + user_id 查，不返回 userId；不读取凭据、不触发发布、不采集数据。
    """
    if not isinstance(arguments, dict):
        return _fail(_TOOL_TASK, "INVALID_ARGS", "arguments 必须为 dict")
    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_TASK, "MISSING_USER", "缺少当前用户身份")
    task_id = arguments.get("task_id")
    if not isinstance(task_id, str) or not task_id.strip():
        return _fail(_TOOL_TASK, "INVALID_TASK_ID", "task_id 必须为非空字符串")
    task_id = task_id.strip()
    if len(task_id) > 128:
        return _fail(_TOOL_TASK, "INVALID_TASK_ID", "task_id 最多 128 字符")

    try:
        conn = await _open_conn()
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_TASK, "DB_UNAVAILABLE", f"任务库不可用: {type(e).__name__}")

    try:
        row = await conn.fetchrow(
            """
            SELECT task_id, title, format, status, content, targets, results,
                   error, scheduled_at, started_at, finished_at, created_at, updated_at
            FROM publish_tasks
            WHERE task_id=$1 AND user_id=$2
            """,
            task_id,
            user_id,
        )
        if not row:
            return _fail(_TOOL_TASK, "TASK_NOT_FOUND", "任务不存在或不属于当前用户")

        history_available = True
        try:
            history_rows = await conn.fetch(
                """
                SELECT platform, success, published_url, platform_content_id,
                       error_message, duration_ms, created_at
                FROM publish_history
                WHERE task_id=$1
                ORDER BY created_at ASC
                """,
                task_id,
            )
        except Exception:  # noqa: BLE001
            history_available = False
            history_rows = []

        metrics_available = True
        try:
            metric_rows = await conn.fetch(
                """
                SELECT DISTINCT ON (platform)
                       platform, views, likes, comments, shares, collected_at
                FROM publish_metrics
                WHERE task_id=$1
                ORDER BY platform, collected_at DESC
                """,
                task_id,
            )
        except Exception:  # noqa: BLE001
            metrics_available = False
            metric_rows = []
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_TASK, "QUERY_FAILED", f"任务详情读取失败: {type(e).__name__}")
    finally:
        await conn.close()

    content_raw = _json_obj(_row_get(row, "content", {}))
    text = content_raw.get("text")
    text_value = text if isinstance(text, str) else None
    text_truncated = bool(text_value and len(text_value) > 4000)
    content_view = {
        "text": text_value[:4000] if text_value else None,
        "textTruncated": text_truncated,
        "filePath": content_raw.get("file_path"),
        "coverPath": content_raw.get("cover_path"),
        "images": [str(item) for item in _json_list(content_raw.get("images"))][:20],
    }

    targets: list[dict[str, Any]] = []
    for raw in _json_list(_row_get(row, "targets", [])):
        if not isinstance(raw, dict):
            continue
        targets.append(
            {
                "platform": str(raw.get("platform") or ""),
                "accountId": raw.get("account_id"),
                "poolId": raw.get("pool_id"),
            }
        )

    metrics_by_platform = {
        str(_row_get(item, "platform") or ""): {
            "views": _metric_int(_row_get(item, "views")),
            "likes": _metric_int(_row_get(item, "likes")),
            "comments": _metric_int(_row_get(item, "comments")),
            "shares": _metric_int(_row_get(item, "shares")),
            "collectedAt": _iso(_row_get(item, "collected_at")),
        }
        for item in metric_rows
        if str(_row_get(item, "platform") or "")
    }

    platforms = [
        {
            "platform": str(_row_get(item, "platform") or ""),
            "success": bool(_row_get(item, "success")),
            "publishedUrl": _row_get(item, "published_url"),
            "platformContentId": _row_get(item, "platform_content_id"),
            "errorMessage": str(_row_get(item, "error_message") or "")[:500] or None,
            "durationMs": _row_get(item, "duration_ms"),
            "createdAt": _iso(_row_get(item, "created_at")),
            "metrics": metrics_by_platform.get(str(_row_get(item, "platform") or "")),
        }
        for item in history_rows
    ]

    results = _json_list(_row_get(row, "results", []))
    challenges = [
        item.get("challenge")
        for item in results
        if isinstance(item, dict) and item.get("challenge") is not None
    ]
    failed = [p for p in platforms if p["success"] is False]
    status = str(_row_get(row, "status") or "")
    next_actions = _task_next_actions(status, failed)
    warn = ""
    if not history_available or not metrics_available:
        missing = []
        if not history_available:
            missing.append("执行历史")
        if not metrics_available:
            missing.append("指标快照")
        warn = f"{'/'.join(missing)}读取失败，其余字段仍可用。"

    hint = _task_hint(status, failed)
    if warn:
        hint = f"{hint} {warn}"
    return {
        "tool": _TOOL_TASK,
        "ok": True,
        "taskId": _row_get(row, "task_id"),
        "title": _row_get(row, "title"),
        "format": _row_get(row, "format"),
        "status": status,
        "content": content_view,
        "targets": targets,
        "platforms": platforms,
        "challenges": challenges,
        "scheduledAt": _iso(_row_get(row, "scheduled_at")),
        "startedAt": _iso(_row_get(row, "started_at")),
        "finishedAt": _iso(_row_get(row, "finished_at")),
        "createdAt": _iso(_row_get(row, "created_at")),
        "updatedAt": _iso(_row_get(row, "updated_at")),
        "error": str(_row_get(row, "error") or "")[:500] or None,
        "metricsAvailable": metrics_available,
        "historyAvailable": history_available,
        "nextActions": next_actions,
        "hint": hint,
        "generatedAt": datetime.now(UTC).isoformat(),
    }


def _metric_int(raw: Any) -> int:
    if isinstance(raw, bool):
        return int(raw)
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0


def _task_next_actions(status: str, failed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """给 Agent 的下一步建议；人确认/重试类动作明确标 humanOnly。"""
    if status == "draft":
        return [
            {
                "action": "publish.confirm",
                "humanOnly": True,
                "hint": "草稿不会自动发布；到发布历史展开并点“确认发布”。",
                "uiHref": "/publish/history",
            },
            {
                "action": "publish.edit",
                "hint": "需要改标题/正文/文件/目标时，调 update_publish_draft 原地修改；改完仍需人工确认。",
                "uiHref": "/publish/history",
            },
        ]
    if status in ("scheduled", "pending", "running"):
        return [
            {
                "action": "publish.wait",
                "hint": "任务已进入队列或正在执行，等待调度器结果。",
                "uiHref": "/publish/history",
            }
        ]
    if status in ("failed", "partial"):
        errors = " ".join(str(p.get("errorMessage") or "") for p in failed).lower()
        actions: list[dict[str, Any]] = []
        if any(token in errors for token in ("登录", "cookie", "auth", "token", "凭据", "验证")):
            actions.append(
                {
                    "action": "account.reconnect",
                    "humanOnly": True,
                    "hint": "先到账号池重连/续期失败账号，再重试发布。",
                    "uiHref": "/account-pool",
                }
            )
        if any(token in errors for token in ("文件", "路径", "不存在", "file", "path")):
            actions.append(
                {
                    "action": "publish.check_file",
                    "hint": "检查待发布文件是否还在上传目录内，再重试。",
                    "uiHref": "/publish/history",
                }
            )
        actions.append(
            {
                "action": "publish.retry",
                "humanOnly": True,
                "hint": "在发布历史里点“重试”；Agent 不直接重发。",
                "uiHref": "/publish/history",
            }
        )
        return actions
    if status == "success":
        return [
            {
                "action": "publish.analytics",
                "hint": "读取该任务各平台指标，判断下一篇要不要改。",
                "uiHref": "/publish/analytics",
            }
        ]
    if status == "cancelled":
        return [
            {
                "action": "publish.regenerate",
                "hint": "任务已取消；需要重新发布时重新生成草稿。",
                "uiHref": "/publish/new",
            }
        ]
    return []


def _task_hint(status: str, failed: list[dict[str, Any]]) -> str:
    if status == "draft":
        return "草稿待人工确认，未进入调度。"
    if status in ("scheduled", "pending", "running"):
        return "任务在调度队列中，真实发布由调度器执行。"
    if status == "success":
        return "任务已完成；平台结果见 platforms。"
    if status in ("failed", "partial"):
        return f"有 {len(failed)} 个平台失败；先看 errorMessage，再按 nextActions 处理。"
    if status == "cancelled":
        return "任务已取消，不会执行。"
    return "任务状态未在预期集合内，请结合 error 与 platforms 判断。"


async def _acceptance_matrix(conn: Any, user_id: str, platform: str | None) -> dict[str, Any]:
    """间接层只用于测试打桩；生产走真实验收矩阵。"""
    from app.services.publish.acceptance import build_acceptance_matrix

    return await build_acceptance_matrix(conn, user_id, platform_filter=platform)


async def get_publish_acceptance(arguments: dict[str, Any]) -> dict[str, Any]:
    """发布能力验收矩阵（只读）：适配器/登录/真实发布证据三态分开。

    Agent 用它回答“为什么这个平台发不出去、还缺什么”，不触发任何平台请求，
    也不修改账号状态。返回里剔除 userId，避免把内部身份带进对话。
    """
    if not isinstance(arguments, dict):
        return _fail(_TOOL_ACCEPTANCE, "INVALID_ARGS", "arguments 必须为 dict")
    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_ACCEPTANCE, "MISSING_USER", "缺少当前用户身份")
    platform = arguments.get("platform")
    if platform is not None:
        if not isinstance(platform, str) or not platform.strip():
            return _fail(_TOOL_ACCEPTANCE, "INVALID_PLATFORM", "platform 必须为非空字符串")
        platform = platform.strip()
        if len(platform) > 64:
            return _fail(_TOOL_ACCEPTANCE, "INVALID_PLATFORM", "platform 最多 64 字符")

    try:
        conn = await _open_conn()
    except RuntimeError as e:
        return _fail(_TOOL_ACCEPTANCE, "DB_UNAVAILABLE", f"发布库不可用: {e}")
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_ACCEPTANCE, "DB_UNAVAILABLE", f"发布库不可用: {type(e).__name__}")
    try:
        data = await _acceptance_matrix(conn, user_id, platform)
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_ACCEPTANCE, "ACCEPTANCE_FAILED", f"验收矩阵生成失败: {type(e).__name__}")
    finally:
        await conn.close()

    items = data.get("platforms") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return _fail(_TOOL_ACCEPTANCE, "ACCEPTANCE_FAILED", "验收矩阵返回格式异常")
    return {
        "tool": _TOOL_ACCEPTANCE,
        "ok": True,
        "generatedAt": data.get("generatedAt"),
        "summary": data.get("summary") if isinstance(data.get("summary"), dict) else {},
        "platforms": items,
        "count": len(items),
        "hint": "只读矩阵：verified 才是有公开证据的真实发布；ready_unverified 只代表适配器与登录态就绪",
    }


async def get_publish_stats(arguments: dict[str, Any]) -> dict[str, Any]:
    """发布统计（只读）：任务成功率、平台耗时、播放/互动快照汇总。"""
    if not isinstance(arguments, dict):
        return _fail(_TOOL_STATS, "INVALID_ARGS", "arguments 必须为 dict")
    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail(_TOOL_STATS, "MISSING_USER", "缺少当前用户身份")

    days = arguments.get("days", 30)
    if isinstance(days, bool) or not isinstance(days, int):
        return _fail(_TOOL_STATS, "INVALID_DAYS", "days 必须为整数")
    days = max(1, min(days, 365))

    since = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)

    try:
        conn = await _open_conn()
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_STATS, "DB_UNAVAILABLE", f"统计库不可用: {type(e).__name__}")

    metrics_available = True
    try:
        task_stats = await conn.fetchrow(
            """
            SELECT
                count(*) AS total,
                count(*) FILTER (WHERE status='success') AS success,
                count(*) FILTER (WHERE status='failed') AS failed,
                count(*) FILTER (WHERE status='partial') AS partial,
                count(*) FILTER (WHERE status='draft') AS draft,
                count(*) FILTER (WHERE status='cancelled') AS cancelled,
                count(*) FILTER (WHERE status='running') AS running,
                count(*) FILTER (WHERE status='scheduled') AS scheduled
            FROM publish_tasks
            WHERE user_id = $1 AND created_at >= $2
            """,
            user_id,
            since,
        )
        platform_rows = await conn.fetch(
            """
            SELECT platform,
                   count(*) AS total,
                   count(*) FILTER (WHERE success) AS success,
                   count(*) FILTER (WHERE NOT success) AS failed,
                   COALESCE(avg(duration_ms), 0) AS avg_ms
            FROM publish_history
            WHERE user_id = $1 AND created_at >= $2
            GROUP BY platform
            ORDER BY total DESC
            """,
            user_id,
            since,
        )
        try:
            metric_rows = await conn.fetch(
                """
                SELECT DISTINCT ON (task_id, platform)
                       task_id, platform, views, likes, comments, shares, collected_at
                FROM publish_metrics
                WHERE task_id IN (
                    SELECT task_id FROM publish_tasks
                    WHERE user_id = $1 AND created_at >= $2
                )
                ORDER BY task_id, platform, collected_at DESC
                """,
                user_id,
                since,
            )
        except Exception:  # noqa: BLE001
            # 指标表可能尚未迁移；没有快照不算统计失败，只是互动数据为空。
            metrics_available = False
            metric_rows = []
    except Exception as e:  # noqa: BLE001
        return _fail(_TOOL_STATS, "DB_UNAVAILABLE", f"统计表查询失败: {type(e).__name__}")
    finally:
        await conn.close()

    def _num(row: Any, key: str) -> int:
        try:
            return int(_row_get(row, key, 0) or 0)
        except (TypeError, ValueError):
            return 0

    tasks = {
        "total": _num(task_stats, "total"),
        "success": _num(task_stats, "success"),
        "failed": _num(task_stats, "failed"),
        "partial": _num(task_stats, "partial"),
        "draft": _num(task_stats, "draft"),
        "cancelled": _num(task_stats, "cancelled"),
        "running": _num(task_stats, "running"),
        "scheduled": _num(task_stats, "scheduled"),
    }
    finished = tasks["success"] + tasks["failed"] + tasks["partial"]
    tasks["successRate"] = round(tasks["success"] / finished, 4) if finished else 0

    platforms: list[dict[str, Any]] = []
    for row in platform_rows:
        total = _num(row, "total")
        success = _num(row, "success")
        failed = _num(row, "failed")
        try:
            avg_ms = int(_row_get(row, "avg_ms", 0) or 0)
        except (TypeError, ValueError):
            avg_ms = 0
        platforms.append(
            {
                "platform": str(_row_get(row, "platform") or ""),
                "total": total,
                "success": success,
                "failed": failed,
                "avgMs": avg_ms,
                "successRate": round(success / total, 4) if total else 0,
            }
        )

    engagement = {"views": 0, "likes": 0, "comments": 0, "shares": 0}
    by_platform: dict[str, dict[str, Any]] = {}
    for row in metric_rows:
        platform = str(_row_get(row, "platform") or "")
        bucket = by_platform.setdefault(
            platform, {"platform": platform, "views": 0, "likes": 0, "comments": 0, "shares": 0}
        )
        for key in ("views", "likes", "comments", "shares"):
            value = _num(row, key)
            engagement[key] += value
            bucket[key] += value

    return {
        "tool": _TOOL_STATS,
        "ok": True,
        "days": days,
        "since": since.isoformat(),
        "tasks": tasks,
        "platforms": platforms,
        "engagement": engagement,
        "byPlatformEngagement": sorted(by_platform.values(), key=lambda item: item["views"], reverse=True),
        "metricsAvailable": metrics_available,
        "hint": "还没有发布记录" if not tasks["total"] else "数据来自发布任务与指标快照",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

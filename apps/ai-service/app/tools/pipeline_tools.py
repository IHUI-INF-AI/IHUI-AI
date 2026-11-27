# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""一句话出稿 → 合规 → 发布草稿的编排工具（2026-11-27 立）。

为什么要有这一层：内容、合规、草稿是三条原子工具，Agent 要连续调三次，
中间任何一步参数搬错都会让“一句话 → 草稿”断掉。本工具把三步收成一个
可被 MCP 注册的能力，但仍然坚持两条闸：

- 草稿不是发布：本工具只落 status='draft'，不排期、不调平台 API；
- 合规不通过不落库：内容自检有阻断项时返回 PREFLIGHT_BLOCKED，草稿不创建。

账号先查后生成：没有可用账号时直接 NO_ACCOUNT，不先扣模型点数再告诉用户发不了。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from .content_compliance_tools import precheck_content
from .content_tools import generate_content
from .publish_tools import create_publish_draft, list_publish_accounts

_TOOL_NAME = "prepare_publish_draft"
_MAX_BRIEF_CHARS = 2000
_MAX_PLATFORMS = 10
_FORMATS = ("md", "html")
_ACTIVE_STATUS = "active"


def _fail(code: str, message: str) -> dict[str, Any]:
    return {"tool": _TOOL_NAME, "ok": False, "errorCode": code, "message": message}


def _int_arg(arguments: dict[str, Any], key: str, default: int) -> int:
    raw = arguments.get(key, default)
    if isinstance(raw, bool) or not isinstance(raw, int):
        raise TypeError(f"{key} 必须为整数")
    return raw


def _bool_arg(arguments: dict[str, Any], key: str, default: bool) -> bool:
    raw = arguments.get(key, default)
    if not isinstance(raw, bool):
        raise TypeError(f"{key} 必须为布尔值")
    return raw


def _platforms(raw: Any) -> tuple[list[str], str | None]:
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list) or not raw:
        return [], "platforms 必须是非空数组"
    if len(raw) > _MAX_PLATFORMS:
        return [], f"platforms 最多 {_MAX_PLATFORMS} 个"
    result: list[str] = []
    for index, item in enumerate(raw):
        if not isinstance(item, str) or not item.strip():
            return [], f"platforms[{index}] 必须是非空字符串"
        value = item.strip().lower()
        if value not in result:
            result.append(value)
    return result, None


def _pick_account(items: list[Any], platform: str) -> dict[str, Any] | None:
    candidates: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if str(item.get("platform") or "").strip().lower() != platform:
            continue
        if str(item.get("status") or "") != _ACTIVE_STATUS:
            continue
        if item.get("hasCredentials") is not True:
            continue
        if item.get("publishBlocked") is True:
            continue
        candidates.append(item)
    if not candidates:
        return None
    for item in candidates:
        if str(item.get("sessionStatus") or "").lower() in ("active", "valid", "ok"):
            return item
    return candidates[0]


async def prepare_publish_draft(arguments: dict[str, Any]) -> dict[str, Any]:
    """一句话需求 → 出稿 → 合规自检 → 落发布草稿（仍待人确认）。"""
    if not isinstance(arguments, dict):
        return _fail("INVALID_ARGS", "arguments 必须为 dict")

    user_id = str(arguments.get("__user_id") or "").strip()
    if not user_id:
        return _fail("MISSING_USER", "缺少当前用户身份")

    brief = arguments.get("brief")
    if not isinstance(brief, str) or not brief.strip():
        return _fail("MISSING_BRIEF", "brief 必填且不能为空")
    brief = brief.strip()
    if len(brief) > _MAX_BRIEF_CHARS:
        return _fail("BRIEF_TOO_LONG", f"brief 最多 {_MAX_BRIEF_CHARS} 字")

    platforms, platform_error = _platforms(arguments.get("platforms"))
    if platform_error:
        return _fail("INVALID_PLATFORMS", platform_error)

    tone = arguments.get("tone", "口语化、自然聊天")
    if not isinstance(tone, str):
        return _fail("INVALID_TONE", "tone 必须为字符串")
    tone = tone.strip()[:80] or "口语化、自然聊天"

    profile = arguments.get("profile", "ihui_koubo")
    if not isinstance(profile, str) or not profile.strip():
        return _fail("INVALID_PROFILE", "profile 必须为字符串")
    profile = profile.strip()

    fmt = arguments.get("format", "md")
    if not isinstance(fmt, str) or fmt not in _FORMATS:
        return _fail("INVALID_FORMAT", "format 仅支持 md/html（文件类内容请先走素材工具再建草稿）")

    try:
        min_chars = _int_arg(arguments, "min_chars", 470)
        max_chars = _int_arg(arguments, "max_chars", 490)
        title_chars = _int_arg(arguments, "title_chars", 16)
        hashtag_count = _int_arg(arguments, "hashtag_count", 5)
        require_ai_disclosure = _bool_arg(arguments, "require_ai_disclosure", False)
    except TypeError as exc:
        return _fail("INVALID_NUMERIC_ARG", str(exc))

    if not 0 <= min_chars <= 20000:
        return _fail("INVALID_MIN_CHARS", "min_chars 必须在 0-20000")
    if not 0 <= max_chars <= 20000:
        return _fail("INVALID_MAX_CHARS", "max_chars 必须在 0-20000")
    if min_chars and max_chars and min_chars > max_chars:
        return _fail("INVALID_RANGE", "min_chars 不能大于 max_chars")
    if not 0 <= title_chars <= 60:
        return _fail("INVALID_TITLE_CHARS", "title_chars 必须在 0-60")
    if not 0 <= hashtag_count <= 30:
        return _fail("INVALID_HASHTAG_COUNT", "hashtag_count 必须在 0-30")

    accounts = await list_publish_accounts(
        {"__user_id": user_id, "include_disabled": False, "limit": 200}
    )
    if not accounts.get("ok"):
        return {
            "tool": _TOOL_NAME,
            "ok": False,
            "errorCode": "ACCOUNT_LOOKUP_FAILED",
            "message": str(accounts.get("message") or "账号库不可用"),
            "accountError": accounts.get("errorCode"),
        }

    items = accounts.get("items") or []
    available = sorted(
        {
            str(item.get("platform") or "").strip().lower()
            for item in items
            if isinstance(item, dict) and item.get("hasCredentials") is True
        }
    )
    targets: list[dict[str, Any]] = []
    missing: list[str] = []
    for platform in platforms:
        account = _pick_account(items, platform)
        if account is None:
            missing.append(platform)
            continue
        targets.append(
            {
                "platform": platform,
                "account_id": int(account["accountId"]),
                "account_name": account.get("displayName"),
            }
        )
    if missing:
        return {
            "tool": _TOOL_NAME,
            "ok": False,
            "errorCode": "NO_ACCOUNT",
            "message": "目标平台没有可用发布账号，未生成内容、未落草稿",
            "missingPlatforms": missing,
            "availablePlatforms": available,
            "targets": targets,
            "nextAction": "先到 /account-pool 接入并验证账号，再重试",
        }

    generated = await generate_content(
        {
            "brief": brief,
            "platform": ",".join(platforms),
            "tone": tone,
            "min_chars": min_chars,
            "max_chars": max_chars,
            "title_chars": title_chars,
            "hashtag_count": hashtag_count,
            "__user_id": user_id,
            "__session_id": arguments.get("__session_id"),
        }
    )
    if not generated.get("ok"):
        return {
            "tool": _TOOL_NAME,
            "ok": False,
            "errorCode": "GENERATION_FAILED",
            "message": str(generated.get("message") or "内容生成失败"),
            "generationErrorCode": generated.get("errorCode"),
            "targets": targets,
        }

    title = str(generated.get("title") or "").strip()
    content = str(generated.get("content") or "").strip()
    hashtags = generated.get("hashtags") if isinstance(generated.get("hashtags"), list) else []
    if not content:
        return {
            "tool": _TOOL_NAME,
            "ok": False,
            "errorCode": "EMPTY_RESULT",
            "message": "模型没有产出正文，未落草稿",
            "targets": targets,
        }

    content_check = await precheck_content(
        {
            "content": content,
            "title": title,
            "hashtags": hashtags,
            "platform": targets[0]["platform"],
            "profile": profile,
            "min_chars": min_chars,
            "max_chars": max_chars,
            "title_length": title_chars,
            "hashtag_count": hashtag_count,
            "require_ai_disclosure": require_ai_disclosure,
        }
    )
    if not content_check.get("ok"):
        return {
            "tool": _TOOL_NAME,
            "ok": False,
            "errorCode": "PREFLIGHT_BLOCKED",
            "message": "合规自检未通过，草稿未创建",
            "title": title,
            "content": content,
            "hashtags": hashtags,
            "charCount": generated.get("charCount"),
            "withinRange": generated.get("withinRange"),
            "targets": targets,
            "contentCheck": content_check,
            "nextAction": "按 blocking 项改稿后重试；或调用 update_publish_draft 修改已有草稿",
        }

    draft = await create_publish_draft(
        {
            "title": title,
            "format": fmt,
            "text": content,
            "hashtags": hashtags,
            "targets": [{"platform": t["platform"], "account_id": t["account_id"]} for t in targets],
            "profile": profile,
            "min_chars": min_chars,
            "max_chars": max_chars,
            "title_length": title_chars,
            "hashtag_count": hashtag_count,
            "require_ai_disclosure": require_ai_disclosure,
            "__user_id": user_id,
            "__session_id": arguments.get("__session_id"),
        }
    )
    if not draft.get("ok"):
        return {
            "tool": _TOOL_NAME,
            "ok": False,
            "errorCode": str(draft.get("errorCode") or "DRAFT_FAILED"),
            "message": str(draft.get("message") or "草稿落库失败"),
            "title": title,
            "content": content,
            "hashtags": hashtags,
            "charCount": generated.get("charCount"),
            "withinRange": generated.get("withinRange"),
            "targets": targets,
            "contentCheck": content_check,
            "draft": draft,
        }

    return {
        "tool": _TOOL_NAME,
        "ok": True,
        "brief": brief,
        "profile": profile,
        "format": fmt,
        "title": title,
        "content": content,
        "hashtags": hashtags,
        "charCount": generated.get("charCount"),
        "withinRange": generated.get("withinRange"),
        "titleLength": generated.get("titleLength"),
        "titleWithinRange": generated.get("titleWithinRange"),
        "hashtagCount": generated.get("hashtagCount"),
        "targets": targets,
        "contentCheck": content_check,
        "taskId": draft.get("taskId"),
        "status": draft.get("status"),
        "blocked": draft.get("blocked", 0),
        "warnings": draft.get("warnings", 0),
        "confirm": draft.get("confirm"),
        "model": generated.get("model"),
        "usage": generated.get("usage") or {},
        "generatedAt": datetime.now(UTC).isoformat(),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""发布前预检(2026-11-27)。

目标:在创建发布任务之前,把"账号能不能发、内容格式对不对、平台权限有没有"
一次性查清楚,失败就返回可执行的 blocked_reason,不再等发布时才炸。

边界:
- 只做**本地可判定**的检查(账号状态、凭据字段、适配器能力、文件存在)。
- 平台侧实时状态(IP 白名单、实名审核、配额)用账号扩展字段或最近错误缓存表达,
  不在这里现场打开浏览器;现场探测由账号体检/适配器负责。
- 未知账号状态 fail-open(只 warn),已知过期/禁用/实名未完成 fail-closed。
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

from .base_adapter import PublishContent, get_adapter
from .credential_compat import normalize_credentials
from .credentials_crypto import decrypt
from .web_fallback import _has_cookie_material, get_web_fallback

logger = get_logger(__name__)

_REAUTH_STATUSES = {"reauth_required", "expired", "disabled"}
_DEGRADED_STATUSES = {"degraded", "unknown", "expiring_soon"}
_VIDEO_PLATFORMS = {"douyin", "shipinhao", "kuaishou", "youtube", "bilibili", "haokan", "xigua"}
_IMAGE_FIRST_PLATFORMS = {"xiaohongshu"}


def _json_obj(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    """兼容 asyncpg Record / dict / 测试桩;缺列按 default 处理,不让预检 500。"""
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return default


def _path_exists(path: str | None) -> bool:
    if not path:
        return False
    try:
        return Path(path).is_file()
    except OSError:
        return False


def _is_video(content: PublishContent) -> bool:
    if content.format == "video":
        return _path_exists(content.file_path)
    suffix = Path(content.file_path or "").suffix.lower()
    return suffix in {".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".m4v"}


def _has_media(content: PublishContent) -> bool:
    if _is_video(content):
        return True
    return any(_path_exists(p) for p in (content.images or []))


@dataclass
class TargetPreflight:
    platform: str
    account_id: int | None
    account_name: str | None
    ok: bool
    code: str = "ok"
    message: str = ""
    next_action: str | None = None
    severity: str = "ok"  # ok | warn | block
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "platform": self.platform,
            "accountId": self.account_id,
            "accountName": self.account_name,
            "ok": self.ok,
            "code": self.code,
            "message": self.message,
            "nextAction": self.next_action,
            "severity": self.severity,
            "warnings": self.warnings,
        }


def _block(
    platform: str,
    account_id: int | None,
    account_name: str | None,
    code: str,
    message: str,
    next_action: str | None = None,
) -> TargetPreflight:
    return TargetPreflight(
        platform=platform,
        account_id=account_id,
        account_name=account_name,
        ok=False,
        code=code,
        message=message,
        next_action=next_action,
        severity="block",
    )


async def _check_target(
    conn: Any,
    user_id: str | None,
    target: dict[str, Any],
    content: PublishContent,
) -> TargetPreflight:
    platform = str(target.get("platform") or "")
    account_id = target.get("account_id")
    account_id = int(account_id) if account_id is not None else None

    if not platform:
        return _block(platform, account_id, None, "invalid_target", "target 缺少 platform")

    if account_id is None:
        return _block(
            platform, None, None, "account_missing",
            "target 没有可用账号;先建号或在账号池里指定 account_id",
            "到账号池创建/启用该平台账号",
        )

    row = await conn.fetchrow(
        """
        SELECT a.id, a.platform, a.display_name, a.status, a.extra, a.credentials_enc
        FROM publish_accounts a
        WHERE a.id = $1 AND a.user_id = $2
        """,
        account_id,
        user_id,
    )
    if not row:
        return _block(platform, account_id, None, "account_missing", "账号不存在或不属于当前用户", "重新选择账号")

    session = await conn.fetchrow(
        """
        SELECT status, last_error, last_error_kind
        FROM publish_session_state WHERE account_id = $1
        """,
        account_id,
    )

    account_name = _row_get(row, "display_name") or _row_get(row, "platform")
    session_status = str(_row_get(session, "status", "unknown") or "unknown")
    last_error = str(_row_get(session, "last_error", "") or "")
    last_error_kind = str(_row_get(session, "last_error_kind", "") or "")
    row_platform = _row_get(row, "platform")
    if row_platform and row_platform != platform:
        return _block(
            platform, account_id, account_name, "account_platform_mismatch",
            f"账号实际平台是 {row_platform},与 target 不一致",
        )

    if str(_row_get(row, "status", "active") or "active") != "active":
        return _block(
            platform, account_id, account_name, "account_disabled",
            f"账号已禁用(status={_row_get(row, 'status')})", "先在账号池启用该账号",
        )

    extra = _json_obj(_row_get(row, "extra", {}))
    if extra.get("publish_blocked") is True or extra.get("disabled_by_user") is True:
        return _block(
            platform, account_id, account_name, "account_blocked",
            "账号被标记为不可发布(publish_blocked/disabled_by_user)",
            "确认要继续发布后清除该标记",
        )
    block_reason = extra.get("publish_block_reason")
    if block_reason:
        return _block(
            platform, account_id, account_name, "account_blocked",
            str(block_reason), "处理账号侧阻塞后清除 publish_block_reason",
        )
    blockers = extra.get("preflight_blockers")
    if isinstance(blockers, str):
        try:
            blockers = json.loads(blockers)
        except Exception:
            blockers = None
    if isinstance(blockers, list) and blockers:
        active: list[dict[str, Any]] = []
        now = datetime.now(UTC)
        for blocker in blockers:
            if not isinstance(blocker, dict):
                continue
            if blocker.get("auto_clear_on_healthy") and session_status == "healthy":
                continue
            expiry = blocker.get("expires_at")
            if expiry:
                try:
                    expires_at = datetime.fromisoformat(str(expiry).replace("Z", "+00:00"))
                    if expires_at.tzinfo is None:
                        expires_at = expires_at.replace(tzinfo=UTC)
                    if expires_at <= now:
                        continue
                except Exception:
                    pass  # 时间写坏时按永久阻塞处理,宁可多拦一次
            active.append(blocker)
        if active:
            first = active[0]
            return _block(
                platform, account_id, account_name,
                str(first.get("code") or "account_blocked"),
                str(first.get("message") or "账号存在平台侧阻塞"),
                first.get("next_action"),
            )

    if session_status in _REAUTH_STATUSES or last_error_kind in _REAUTH_STATUSES:
        return _block(
            platform, account_id, account_name, "auth_required",
            last_error or "登录态已过期,需要重新登录",
            "调用 /publish/pools/accounts/{id}/reauth 完成登录后再发",
        )

    warnings: list[str] = []
    if session_status in _DEGRADED_STATUSES:
        warnings.append(f"账号状态为 {session_status},建议先体检")

    try:
        credentials_enc = _row_get(row, "credentials_enc")
        if not credentials_enc:
            warnings.append("预检未读取到 credentials_enc,跳过凭据检查")
            credentials = {}
        else:
            credentials = normalize_credentials(platform, decrypt(credentials_enc))
    except Exception as e:
        return _block(
            platform, account_id, account_name, "credentials_unreadable",
            f"凭据解密失败: {type(e).__name__}", "重新保存该账号凭据",
        )

    native = get_adapter(platform)
    if native is None:
        return _block(
            platform, account_id, account_name, "no_adapter",
            f"平台 {platform} 没有可用适配器",
        )

    fallback = get_web_fallback(platform, native, credentials)
    adapter = fallback or native
    formats = set(getattr(native, "supported_formats", []) or [])
    formats |= set(getattr(adapter, "supported_formats", []) or [])
    if formats and content.format not in formats:
        return _block(
            platform, account_id, account_name, "format_unsupported",
            f"平台不支持 {content.format} 格式,支持: {', '.join(sorted(formats))}",
            "换格式或换平台",
        )

    if content.file_path and not _path_exists(content.file_path):
        return _block(platform, account_id, account_name, "file_missing", "正文文件不存在")
    for img in content.images or []:
        if str(img).startswith(("http://", "https://")):
            continue
        if not _path_exists(str(img)):
            return _block(platform, account_id, account_name, "image_missing", f"图片不存在: {img}")

    if platform in _VIDEO_PLATFORMS and not _is_video(content):
        return _block(
            platform, account_id, account_name, "video_required",
            "该平台只支持视频发布,当前内容没有可用视频文件",
            "上传 mp4/mov 视频后重试",
        )

    if platform in _IMAGE_FIRST_PLATFORMS and not _has_media(content):
        return _block(
            platform, account_id, account_name, "media_required",
            "小红书笔记至少需要 1 张图片或 1 条视频",
            "补图后再发",
        )

    if platform == "wechat":
        if not (credentials.get("app_id") and credentials.get("app_secret")):
            return _block(
                platform, account_id, account_name, "missing_credentials",
                "公众号发布需要 app_id + app_secret",
                "补开发者凭据;并把出口 IP 加入微信开发者平台白名单",
            )
        warnings.append("公众号 API 需要出口 IP 在白名单内")

    if platform == "kuaishou":
        if not (credentials.get("access_token") and credentials.get("app_id")):
            return _block(
                platform, account_id, account_name, "missing_credentials",
                "快手发布需要 access_token + app_id",
                "重新授权快手开放平台",
            )

    if platform == "baijiahao":
        has_api = bool(credentials.get("app_id") and credentials.get("app_token"))
        if not has_api and not _has_cookie_material(platform, credentials):
            return _block(
                platform, account_id, account_name, "missing_credentials",
                "百家号既没有 app_id/app_token,也没有可投递的网页 Cookie",
                "开通百家号开发者权限或重新登录网页后台",
            )
        if not has_api:
            warnings.append("百家号走网页编辑器,未启用官方发布 API")

    if platform == "xiaohongshu":
        warnings.append("小红书无官方笔记发布 API,依赖浏览器登录态,稳定性低于 API 平台")
    if platform == "netease":
        warnings.append("网易号走网页适配器;发布前需账号已实名且审核通过")
    if platform == "shipinhao":
        warnings.append("视频号无匿名公开页,公开可见性只能在微信内确认")
    if platform == "jianshu" and ("冻结" in last_error or "403" in last_error):
        return _block(
            platform, account_id, account_name, "platform_restricted",
            last_error[:500], "联系平台解冻或停用该平台",
        )
    if platform == "toutiao" and "7050" in last_error:
        return _block(
            platform, account_id, account_name, "platform_restricted",
            last_error[:500], "先修头条号发布参数/账号状态",
        )

    return TargetPreflight(
        platform=platform,
        account_id=account_id,
        account_name=account_name,
        ok=True,
        code="ok",
        message="预检通过" if not warnings else "预检通过,有警告",
        severity="warn" if warnings else "ok",
        warnings=warnings,
    )


async def run_preflight(
    conn: Any,
    user_id: str | None,
    targets: list[dict[str, Any]],
    content: PublishContent,
) -> dict[str, Any]:
    """逐目标预检,返回可直接给 Agent/前端消费的结构。"""
    items: list[TargetPreflight] = []
    for target in targets:
        try:
            items.append(await _check_target(conn, user_id, target, content))
        except Exception as e:
            platform = str(target.get("platform") or "")
            account_id = target.get("account_id")
            logger.warning("[preflight] %s/%s check failed: %s: %s", platform, account_id, type(e).__name__, e)
            items.append(_block(
                platform,
                int(account_id) if account_id is not None else None,
                None,
                "preflight_error",
                f"预检异常: {type(e).__name__}: {e}",
                "稍后重试或查看服务日志",
            ))

    blocked = [x for x in items if not x.ok]
    warnings = [x for x in items if x.ok and x.warnings]
    return {
        "ok": not blocked,
        "blocked": len(blocked),
        "warnings": len(warnings),
        "targets": [x.to_dict() for x in items],
        "generatedAt": datetime.now(UTC).isoformat(),
    }

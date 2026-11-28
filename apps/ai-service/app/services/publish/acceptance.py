# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布能力验收矩阵。

目标: 把"平台有适配器"、"账号登录有效"、"账号真能发布"三件事分开算,
不再用 active/healthy 冒充"可发布"。

输出每个平台一行:
- adapter / rules / formatter / selectors / scan 配置是否齐
- 当前用户在该平台有几个 active/disabled 账号
- 登录态是否有效(只看最近一次 verify 结果)
- 适配器声明需要哪些凭据、账号里实际缺哪些
- 历史里有没有"真实发布成功 + 可回访 URL/content_id"的证据
- 最终状态: verified / ready_unverified / browser_likely / login_only /
  untested / disabled / no_account / no_adapter

这是只读服务, 不触发任何平台请求, 不修改账号状态。
"""
from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from app.core.logging import get_logger

from .base_adapter import list_all_adapter_classes
from .cookie_session import cookie_platform
from .credential_compat import normalize_credentials
from .credentials_crypto import decrypt
from .platform_dom_selectors import get_selectors
from .platform_formatter import supported_platforms
from .platform_rules import PLATFORM_RULES
from .web_fallback import get_web_fallback

logger = get_logger(__name__)

# 状态排序: 越靠前越"已验收", 越靠后越"还缺东西"。
_STATUS_ORDER = {
    "verified": 0,
    "ready_unverified": 1,
    "browser_likely": 2,
    "login_only": 3,
    "reauth_required": 4,
    "untested": 5,
    "disabled": 6,
    "no_account": 7,
    "no_adapter": 8,
}


_NEGATIVE_MARKERS = (
    "FAIL",
    "EXPIRED",
    "REDIRECTED TO LOGIN",
    "NOT IN WHITELIST",
    "INVALID IP",
    "未实名",
    "未完成实名",
    "账号信息审核",
    "登录已失效",
)


def _verify_ok(result: str | None, message: str | None) -> bool:
    """负向信号优先:同一行可能 `result=OK` 但 message 明确 FAIL。"""
    result = (result or "").strip().upper()
    message = (message or "").strip()
    upper = message.upper()
    if any(marker in upper for marker in _NEGATIVE_MARKERS):
        return False
    if result in {"OK", "LOGIN_OK", "SUCCESS"}:
        return True
    return upper.startswith(("OK:", "LOGIN_OK", "OK "))


_WEB_PROBE_PREFIX = "[WEB_PROBE]"


def _is_weak_public_url(url: str) -> bool:
    """编辑器/发布成功落地页不是公开文章地址，不能当 verified 证据。

    真实踩过的假阳性：
    - 知乎 DOM 流把 `https://zhuanlan.zhihu.com/p/<id>/edit` 写成 published_url；
    - 掘金把 `https://juejin.cn/published` 这个“发布成功”落地页写成 published_url。
    这两类地址在匿名浏览器里要么回到编辑器，要么跳首页，不能证明文章公开存在。
    """
    u = (url or "").strip().lower()
    if not u:
        return False
    if u.endswith("/edit") or "/edit?" in u or "/builder/rc/edit" in u:
        return True
    if "juejin.cn/published" in u:
        return True
    return u.rstrip("/").endswith("/publish")


def _has_public_evidence(row: dict[str, Any]) -> bool:
    """成功记录里必须有公开 URL，或至少有一个真实数字内容 ID。"""
    if not row.get("success"):
        return False
    url = str(row.get("published_url") or "").strip()
    content_id = str(row.get("platform_content_id") or "").strip()
    if url and not _is_weak_public_url(url):
        return True
    # 内容 ID 是平台真实作品 ID（数字），比“发布成功”落地页可信。
    return bool(content_id and content_id.isdigit())


_BLOCK_MARKERS = (
    "冻结", "封禁", "禁言", "未实名", "白名单", "未创建站点",
    "人机验证", "7050", "404", "权限不足", "账号异常", "审核中",
)


def _publish_failure_reason(rows: list[dict[str, Any]]) -> str:
    """最近一次真实发布失败,且错误属于平台侧硬阻塞时,返回该原因。

    登录态有效不等于能发:简书 16 的 cookie 能进编辑器,但真实发布返回
    `API 403: 您帐号被冻结`。这种失败必须压过 `browser_likely`。
    """
    for row in rows:
        if row.get("success"):
            return ""
        message = str(row.get("error_message") or "").strip()
        if not message:
            continue
        if any(marker in message for marker in _BLOCK_MARKERS):
            return message
        return ""
    return ""


def _web_probe_error(rows: list[dict[str, Any]]) -> str:
    """最近一次网页版发布探测的失败原因(只认显式标记的探针记录)。"""
    for row in rows:
        message = str(row.get("error_message") or "").strip()
        if not row.get("success") and message.startswith(_WEB_PROBE_PREFIX):
            return message
    return ""


def _pending_submission_status(rows: list[dict[str, Any]]) -> str:
    """最近一次真实提交/发布后的真实状态,不冒充公开可核验。

    两种真实情况:
    1. 有成功记录但没有公开 URL/内容 ID,payload 里有 `review_status` —— 已提交待审核;
    2. 有平台作品 ID 但该平台没有匿名公开页(如视频号),payload 里有 `submitted_note` ——
       已真实发布,但公开核验只能在平台登录态/微信内完成。
    """
    for row in rows:
        if not row.get("success"):
            continue
        payload = row.get("payload")
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:  # noqa: BLE001
                payload = {}
        payload = payload if isinstance(payload, dict) else {}
        if row.get("published_url") or row.get("platform_content_id"):
            note = str(payload.get("submitted_note") or "").strip()
            return note
        status = str(payload.get("review_status") or "").strip()
        if status:
            return f"已真实提交（{status}）;公开链接待审核通过后回填"
        return ""
    return ""


def _publish_evidence(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """从该平台历史里挑最近一条“成功且有公开可回访标识”的记录。"""
    for row in rows:
        if _has_public_evidence(row):
            return row
    return None


def _missing_credentials(
    platform: str,
    adapter: Any,
    credentials: dict[str, Any] | None,
) -> list[str]:
    if adapter is None or credentials is None:
        return []
    required = list(getattr(adapter, "requires_credentials", []) or [])
    return [name for name in required if not credentials.get(name)]


def _has_cookie_jar(credentials: dict[str, Any] | None) -> bool:
    if not credentials:
        return False
    jar = credentials.get("__cookie_jar__")
    return isinstance(jar, list) and len(jar) > 0


def _platform_block_reason(message: str) -> str:
    upper = (message or "").upper()
    if "NOT IN WHITELIST" in upper or "INVALID IP" in upper:
        return "平台 API 出口 IP 未加入白名单"
    if "未实名" in message or "未完成实名" in message or "账号信息审核" in message:
        return "平台要求实名认证/账号审核"
    if "EXPIRED" in upper or "REDIRECTED TO LOGIN" in upper:
        return "登录态已过期,需重新扫码"
    return ""


def _classify(
    *,
    has_adapter: bool,
    active_count: int,
    disabled_count: int,
    login_ok: bool,
    verify_message: str,
    needs_browser: bool,
    missing: list[str],
    evidence: dict[str, Any] | None,
    platform_blocked: bool = False,
    blocked_reason: str = "",
    web_fallback: bool = False,
    web_probe_error: str = "",
    publish_failure: str = "",
    session_status: str | None = None,
    session_error: str = "",
    pending_submission: str = "",
) -> tuple[str, str, str]:
    """返回 (状态, 发布就绪度, 下一步动作)。"""
    if not has_adapter:
        return "no_adapter", "none", "平台适配器不存在"

    if active_count <= 0:
        if disabled_count > 0:
            return "disabled", "none", "账号已停用;恢复后先 verify"
        return "no_account", "none", "先绑定账号并扫码/填凭据"

    if evidence is not None:
        return "verified", "verified", "已有真实发布证据;建议 30 天内复测一次"

    if pending_submission:
        return (
            "browser_likely",
            "likely",
            pending_submission,
        )

    if publish_failure:
        return (
            "login_only",
            "blocked",
            f"最近真实发布失败:{publish_failure}",
        )

    if web_probe_error:
        detail = web_probe_error.removeprefix(_WEB_PROBE_PREFIX).strip()
        return (
            "login_only",
            "blocked",
            f"网页版发布实测失败:{detail}",
        )

    if platform_blocked:
        if "过期" in blocked_reason:
            return "reauth_required", "reauth", "登录态已过期,重新扫码后再发"
        return (
            "login_only",
            "blocked",
            f"平台侧动作未完成:{blocked_reason or '见最近 verify 消息'}",
        )

    # 账号级会话状态优先于“Cookie 名还在”的旧结论:公众号 cookie 能进网页后台,
    # 但 API 出口 IP 不在白名单时仍是 degraded;小红书 cookie 已被平台判死时是
    # reauth_required。继续把它们算成 ready_unverified/browser_likely 就是假阳性。
    if session_status == "disabled":
        return "disabled", "none", "账号已停用;恢复后先 verify"
    if session_status == "reauth_required":
        return "reauth_required", "reauth", "平台已判定登录态失效,重新扫码后再发"
    if session_status == "degraded":
        reason = (session_error or "").strip()
        return (
            "login_only",
            "blocked",
            f"账号体检异常:{reason[:160]}" if reason else "账号体检异常;先修复凭据或平台配置",
        )

    api_credential_gap = bool(missing) and not needs_browser
    cookie_only = (
        not needs_browser
        and ("API 适配器凭据仍缺" in verify_message or "发布能力需网页版适配器" in verify_message)
    )
    if api_credential_gap or cookie_only:
        if web_fallback:
            return (
                "browser_likely",
                "likely",
                "网页版发布兜底已接入;跑一条真实发布验收",
            )
        return (
            "login_only",
            "blocked",
            "登录态有效但当前发布器缺 API 凭据;补凭据或接网页版发布适配器",
        )

    if login_ok and needs_browser:
        return "browser_likely", "likely", "浏览器适配器已就绪;跑一条真实发布验收"
    if login_ok:
        return "ready_unverified", "likely", "凭据齐全;跑一条真实发布验收"
    return "untested", "unknown", "先跑账号 verify,再跑真实发布验收"


async def build_acceptance_matrix(
    conn: Any,
    user_id: str,
    *,
    platform_filter: str | None = None,
) -> dict[str, Any]:
    """构建发布能力验收矩阵(只读)。"""
    account_rows = await conn.fetch(
        """
        SELECT id, platform, display_name, status, last_verified_at,
               last_verify_result, last_verify_msg, credentials_enc
        FROM publish_accounts
        WHERE user_id = $1
        ORDER BY platform, id
        """,
        user_id,
    )
    history_rows = await conn.fetch(
        """
        SELECT platform, success, published_url, platform_content_id,
               error_message, payload, created_at
        FROM publish_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_id,
    )
    session_rows = await conn.fetch(
        """
        SELECT account_id, status, last_error, last_error_kind, next_probe_at
        FROM publish_session_state
        WHERE user_id = $1
        """,
        user_id,
    )
    sessions_by_account = {
        int(row["account_id"]): dict(row) for row in session_rows
    }

    adapters = {cls.platform_id: cls for cls in list_all_adapter_classes()}
    formatter_ids = set(supported_platforms())

    accounts_by_platform: dict[str, list[dict[str, Any]]] = {}
    for row in account_rows:
        accounts_by_platform.setdefault(str(row["platform"]), []).append(dict(row))

    history_by_platform: dict[str, list[dict[str, Any]]] = {}
    for row in history_rows:
        history_by_platform.setdefault(str(row["platform"]), []).append(dict(row))

    platform_ids = sorted(set(adapters) | set(accounts_by_platform) | set(history_by_platform))
    if platform_filter:
        platform_ids = [p for p in platform_ids if p == platform_filter]

    items: list[dict[str, Any]] = []
    for platform in platform_ids:
        adapter_cls = adapters.get(platform)
        adapter = adapter_cls() if adapter_cls is not None else None
        accounts = accounts_by_platform.get(platform, [])
        active = [a for a in accounts if a.get("status") == "active"]
        disabled = [a for a in accounts if a.get("status") == "disabled"]

        # 同平台多账号:只要**任一** active 账号 verify 通过,平台登录态就算有效。
        # 先按有效账号做凭据画像,避免被同平台一个过期账号带偏。
        account_pool = active or accounts
        valid_accounts = [
            a for a in account_pool
            if _verify_ok(a.get("last_verify_result"), a.get("last_verify_msg"))
        ]
        candidates = valid_accounts + [a for a in account_pool if a not in valid_accounts]
        credentials: dict[str, Any] | None = None
        for candidate in candidates:
            try:
                raw = candidate.get("credentials_enc")
                if not raw:
                    continue
                credentials = normalize_credentials(platform, decrypt(raw))
                break
            except Exception as exc:  # noqa: BLE001
                logger.info(
                    "[acceptance] platform=%s account=%s 解密失败: %s",
                    platform, candidate.get("id"), type(exc).__name__,
                )

        latest_verify = max(
            (a for a in (valid_accounts or account_pool) if a.get("last_verified_at")),
            key=lambda a: a["last_verified_at"],
            default=None,
        )
        verify_result = str(latest_verify.get("last_verify_result") or "") if latest_verify else ""
        verify_message = str(latest_verify.get("last_verify_msg") or "") if latest_verify else ""
        login_ok = bool(valid_accounts)
        blocked_reason = _platform_block_reason(verify_message) if not login_ok else ""

        # 平台级结论不能只看 publish_accounts.last_verify_msg:网页 cookie 能进后台,
        # 不代表 API 凭据/会话真的可用。这里按账号级 session_keeper 状态收敛:
        # 只要同平台还有一个 healthy/unknown/expiring 的 active 账号,就不算整平台阻塞;
        # 否则按最严重的一条降级(disabled > reauth_required > degraded)。
        active_sessions = [
            sessions_by_account.get(int(a["id"]))
            for a in active
            if sessions_by_account.get(int(a["id"]))
        ]
        session_status: str | None = None
        session_error = ""
        if active_sessions and not any(
            s.get("status") in {"healthy", "unknown", "expiring", "login_only"}
            for s in active_sessions
        ):
            rank = {"disabled": 3, "reauth_required": 2, "degraded": 1}
            worst = max(
                active_sessions,
                key=lambda s: rank.get(str(s.get("status")), 0),
            )
            session_status = str(worst.get("status") or "") or None
            session_error = str(worst.get("last_error") or worst.get("last_error_kind") or "")

        history = history_by_platform.get(platform, [])
        latest_history = history[0] if history else None
        evidence = _publish_evidence(history)

        missing = _missing_credentials(platform, adapter, credentials)
        needs_browser = bool(getattr(adapter, "needs_browser", False)) if adapter else False
        web_fallback = get_web_fallback(platform, adapter, credentials) is not None
        web_probe_error = _web_probe_error(history)
        publish_failure = _publish_failure_reason(history)
        evidence_payload = evidence.get("payload") if evidence else None
        if isinstance(evidence_payload, str):
            try:
                evidence_payload = json.loads(evidence_payload)
            except Exception:  # noqa: BLE001
                evidence_payload = {}
        if not isinstance(evidence_payload, dict):
            evidence_payload = {}
        pending_submission = _pending_submission_status(history)
        status, readiness, next_action = _classify(
            has_adapter=adapter is not None,
            active_count=len(active),
            disabled_count=len(disabled),
            login_ok=login_ok,
            verify_message=verify_message,
            needs_browser=needs_browser,
            missing=missing,
            evidence=evidence,
            platform_blocked=bool(blocked_reason),
            blocked_reason=blocked_reason,
            web_fallback=web_fallback,
            web_probe_error=web_probe_error,
            publish_failure=publish_failure,
            session_status=session_status,
            session_error=session_error,
            pending_submission=pending_submission,
        )

        items.append({
            "platform": platform,
            "platformName": getattr(adapter, "platform_name", platform) if adapter else platform,
            "status": status,
            "publishReadiness": readiness,
            "nextAction": next_action,
            "adapter": {
                "exists": adapter is not None,
                "class": type(adapter).__name__ if adapter else None,
                "needsBrowser": needs_browser,
                "supportedFormats": list(getattr(adapter, "supported_formats", []) or []),
                "requiredFields": list(getattr(adapter, "requires_credentials", []) or []),
                "missingFields": missing,
                "webFallback": web_fallback,
                "webProbeError": web_probe_error or None,
                "lastFailure": publish_failure or None,
            },
            "config": {
                "rule": platform in PLATFORM_RULES,
                "formatter": platform in formatter_ids,
                "selector": get_selectors(platform) is not None,
                "scanLogin": platform in _scan_platforms(),
            },
            "accounts": {
                "total": len(accounts),
                "active": len(active),
                "disabled": len(disabled),
                "lastVerifiedAt": latest_verify["last_verified_at"].isoformat()
                if latest_verify and latest_verify.get("last_verified_at") else None,
                "verifyResult": verify_result or None,
                "verifyMessage": verify_message or None,
                "loginOk": login_ok,
                "hasSessionJar": _has_cookie_jar(credentials),
                "isWebSessionPlatform": cookie_platform(platform),
                "sessionStatus": session_status,
                "sessionError": session_error or None,
            },
            "publishEvidence": {
                "everPublished": evidence is not None,
                "publishedUrl": evidence.get("published_url") if evidence else None,
                "platformContentId": evidence.get("platform_content_id") if evidence else None,
                "publicVerified": bool(evidence_payload.get("public_verified")),
                "publicDetail": evidence_payload.get("public_detail") or evidence_payload.get("evidence_note"),
                "publishedAt": evidence["created_at"].isoformat()
                if evidence and evidence.get("created_at") else None,
                "successCount": sum(1 for h in history if h.get("success")),
                "attemptCount": len(history),
                "lastAttemptAt": latest_history["created_at"].isoformat()
                if latest_history and latest_history.get("created_at") else None,
                "lastAttemptSuccess": bool(latest_history.get("success")) if latest_history else None,
                "lastError": latest_history.get("error_message") if latest_history else None,
            },
        })

    items.sort(key=lambda x: (_STATUS_ORDER.get(x["status"], 99), x["platform"]))
    summary = {
        "totalPlatforms": len(items),
        "verified": sum(1 for x in items if x["status"] == "verified"),
        "readyUnverified": sum(1 for x in items if x["status"] == "ready_unverified"),
        "browserLikely": sum(1 for x in items if x["status"] == "browser_likely"),
        "loginOnly": sum(1 for x in items if x["status"] == "login_only"),
        "reauthRequired": sum(1 for x in items if x["status"] == "reauth_required"),
        "untested": sum(1 for x in items if x["status"] == "untested"),
        "disabled": sum(1 for x in items if x["status"] == "disabled"),
        "noAccount": sum(1 for x in items if x["status"] == "no_account"),
        "noAdapter": sum(1 for x in items if x["status"] == "no_adapter"),
        "activeAccounts": sum(x["accounts"]["active"] for x in items),
    }
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "userId": user_id,
        "summary": summary,
        "platforms": items,
    }


_SCAN_PLATFORMS_CACHE: set[str] | None = None


def _scan_platforms() -> set[str]:
    """延迟导入扫码配置, 避免模块导入期拉起 Playwright 依赖。"""
    global _SCAN_PLATFORMS_CACHE
    if _SCAN_PLATFORMS_CACHE is None:
        try:
            from app.services.scan_login import PLATFORM_SCAN_CONFIG
            _SCAN_PLATFORMS_CACHE = set(PLATFORM_SCAN_CONFIG.keys())
        except Exception as exc:  # noqa: BLE001
            logger.warning("[acceptance] 扫码配置读取失败: %s", type(exc).__name__)
            _SCAN_PLATFORMS_CACHE = set()
    return _SCAN_PLATFORMS_CACHE
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

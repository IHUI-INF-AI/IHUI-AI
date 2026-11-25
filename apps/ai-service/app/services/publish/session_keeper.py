# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布账号会话守护(2026-11-25 立)。

它回答一个问题:**这个号此刻还能不能发?**
并且保证"不能发"这件事**不会静默发生**:
发现失效 → 立刻标记 → 站内信喊人 → 一键扫码/重授权 → 成功后自动回池。

为什么不用原来的 cookie 探活
--------------------------
`cookie_refresh_daemon.refresh_single` 的成功判据是"注入的 cookie 名字还在",
而它访问的偏偏是登录页(passport.weibo.com/sso/signin、juejin.cn/login…)。
登录页当然不会清 cookie,于是**掉线也被记成保活成功** —— 生产上 13 个号
"刚保活成功",其中 8 个落点就是登录页。

本模块改用各平台 adapter 的 `verify_credentials`:它去的是创作者后台/鉴权接口,
被踢下线会 302 到登录页或直接 401/403,比"cookie 名存在"可信一个量级。

「永久」的工程定义
-----------------
平台会话有绝对有效期,任何本地系统都不可能让 cookie 永生。本模块保证的是:
  - 按平台节奏**持续**体检(默认 60 分钟,带抖动);
  - 失效**当场**发现并进入 `reauth_required`,不等到发布时才炸;
  - 池里还有别的健康号就**继续发**,单号掉线不拖垮业务;
  - 人一扫/一授权就**自动回池**,不用手工改状态;
  - 连续失败/失效写站内信,同时留事件流可追溯。

不负责:扫码出码(归 scan_login)、分配账号(归 account_pool)、发布(归 scheduler)。
"""

from __future__ import annotations

import asyncio
import os
import random
import re
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

import asyncpg

from app.core.db import get_db_conn
from app.core.logging import get_logger

logger = get_logger(__name__)

# 只有 start() 成功建表并起线程后才为 True。
# keepalive 中心据此让出发布线: 两处同时访问同一账号,既浪费也会互相覆盖保活时间。
_ACTIVE = False
_STOP = threading.Event()
_THREAD: threading.Thread | None = None
_LAST_TICK_AT: datetime | None = None
_LAST_ERROR: str | None = None

STATUS_UNKNOWN = "unknown"
STATUS_HEALTHY = "healthy"
STATUS_DEGRADED = "degraded"
STATUS_EXPIRING = "expiring"
STATUS_REAUTH_REQUIRED = "reauth_required"

_KIND_OK = "ok"
_KIND_EXPIRED = "expired"
_KIND_NETWORK = "network"
_KIND_ERROR = "error"
_KIND_DECRYPT = "decrypt_error"
_KIND_CONFIG = "config_error"

_LOGIN_MARKERS = (
    "login", "signin", "sign_in", "sign-in", "sso", "passport",
    "登录", "未登录", "请登录", "重新登录", "授权失效", "登录失效",
    "cookie expired", "cookie may be expired", "token expired", "invalid token", "unauthorized",
    "not logged in", "auth failed", "401",
)
_NETWORK_MARKERS = (
    "timeout", "timed out", "http error", "connection", "network",
    "dns", "temporary", "playwright not installed", "browser",
    "超时", "连接失败", "网络异常",
)
_CONFIG_MARKERS = (
    "missing", "invalid json", "not configured", "ip whitelist", "40164",
    "app_id", "app_secret", "application_password", "site_url",
)


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _bool_env(name: str, default: bool) -> bool:
    raw = _env(name)
    if not raw:
        return default
    return raw.lower() not in ("0", "false", "no", "off")


def config() -> dict[str, Any]:
    return {
        "enabled": _bool_env("SESSION_KEEPER_ENABLED", True),
        "tick_seconds": max(15, int(float(_env("SESSION_KEEPER_TICK_SECONDS", "60") or 60))),
        "concurrency": max(1, min(8, int(float(_env("SESSION_KEEPER_CONCURRENCY", "2") or 2)))),
        "interval_minutes": max(5, int(float(_env("SESSION_KEEPER_INTERVAL_MINUTES", "60") or 60))),
        "timeout_seconds": max(20, int(float(_env("SESSION_KEEPER_TIMEOUT_SECONDS", "90") or 90))),
        "jitter": max(0.0, min(0.5, float(_env("SESSION_KEEPER_JITTER", "0.2") or 0.2))),
    }


def is_active() -> bool:
    return _ACTIVE


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# =============================================================================
# DDL
# =============================================================================
async def ensure_tables(conn: asyncpg.Connection | None = None) -> None:
    owns = conn is None
    if owns:
        conn = await get_db_conn()
    try:
        # 池表先建:ensure_states 读 publish_pools 的体检间隔,缺表会让启动直接失败。
        from app.services.publish import account_pool

        await account_pool.ensure_tables(conn)
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_session_state (
                account_id BIGINT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                platform VARCHAR(32) NOT NULL,
                status VARCHAR(24) NOT NULL DEFAULT 'unknown',
                last_probe_at TIMESTAMPTZ,
                last_ok_at TIMESTAMPTZ,
                next_probe_at TIMESTAMPTZ,
                consecutive_failures INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                last_error_kind VARCHAR(24),
                expires_at TIMESTAMPTZ,
                reauth_task_id VARCHAR(64),
                reauth_started_at TIMESTAMPTZ,
                probe_interval_minutes INTEGER NOT NULL DEFAULT 60,
                last_duration_ms INTEGER,
                last_alert_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_session_next ON publish_session_state(next_probe_at)"
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_session_events (
                id BIGSERIAL PRIMARY KEY,
                account_id BIGINT NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                platform VARCHAR(32) NOT NULL,
                ok BOOLEAN NOT NULL,
                kind VARCHAR(24) NOT NULL,
                message TEXT,
                detail JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_session_events_account ON publish_session_events(account_id, created_at DESC)"
        )
    finally:
        if owns:
            await conn.close()


async def ensure_states(conn: asyncpg.Connection) -> int:
    """给所有 active 账号补状态行。新号首轮不集中轰炸:next_probe 随机散在 0~5 分钟。"""
    rows = await conn.fetch(
        """
        SELECT DISTINCT ON (a.id)
               a.id, a.user_id, a.platform,
               COALESCE(p.probe_interval_minutes, 60) AS interval
        FROM publish_accounts a
        LEFT JOIN publish_pools p
               ON p.user_id = a.user_id AND p.platform = a.platform AND p.status='active'
        LEFT JOIN publish_session_state s ON s.account_id = a.id
        WHERE a.status='active' AND s.account_id IS NULL
        ORDER BY a.id, p.probe_interval_minutes DESC NULLS LAST
        """
    )
    inserted = 0
    now = _utc_now()
    for r in rows:
        await conn.execute(
            """
            INSERT INTO publish_session_state
                (account_id, user_id, platform, status, next_probe_at, probe_interval_minutes)
            VALUES ($1,$2,$3,'unknown',$4,$5)
            ON CONFLICT (account_id) DO NOTHING
            """,
            int(r["id"]), r["user_id"], r["platform"],
            now + timedelta(seconds=random.randint(0, 300)),
            int(r["interval"] or 60),
        )
        inserted += 1
    return inserted


# =============================================================================
# 状态写入
# =========================================================================
async def _record_event(
    conn: asyncpg.Connection,
    *,
    account_id: int,
    user_id: str,
    platform: str,
    ok: bool,
    kind: str,
    message: str,
    detail: dict[str, Any] | None = None,
) -> None:
    await conn.execute(
        """
        INSERT INTO publish_session_events (account_id, user_id, platform, ok, kind, message, detail)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
        """,
        account_id, user_id, platform, ok, kind, message[:2000],
        None if detail is None else __import__("json").dumps(detail, ensure_ascii=False),
    )


async def _maybe_alert(conn: asyncpg.Connection, row: asyncpg.Record, message: str) -> None:
    """同一账号 24h 内只喊一次,避免每轮探活都往站内信堆同一条。"""
    last = row["last_alert_at"]
    if last and (_utc_now() - last) < timedelta(hours=24):
        return
    from app.services.keepalive.alerts import publish_inapp_alerts

    await publish_inapp_alerts(
        [{
            "ref": f"publish_session:{int(row['id'])}",
            "owner": row["user_id"],
            "source": "publish_session",
            "platform": row["platform"],
            "display": row["display_name"] or "",
            "kind": _KIND_EXPIRED,
            "message": message,
            "consecutive_failures": int(row["consecutive_failures"] or 0),
        }]
    )
    await conn.execute(
        "UPDATE publish_session_state SET last_alert_at=NOW() WHERE account_id=$1",
        int(row["id"]),
    )


# =============================================================================
# 探活
# =============================================================================
def _next_probe(interval_minutes: int, jitter: float, *, base: datetime | None = None) -> datetime:
    base = base or _utc_now()
    factor = 1.0 + random.uniform(-jitter, jitter)
    return base + timedelta(minutes=max(3, interval_minutes * factor))


def _classify(message: str) -> str:
    text = (message or "").lower()
    if any(m in text for m in _CONFIG_MARKERS):
        return _KIND_CONFIG
    if any(m in text for m in _LOGIN_MARKERS):
        return _KIND_EXPIRED
    if any(m in text for m in _NETWORK_MARKERS):
        return _KIND_NETWORK
    return _KIND_ERROR


def _parse_expiry(message: str) -> datetime | None:
    m = re.search(r"expires in\s+(\d+)\s*s", message or "", re.I)
    if m:
        return _utc_now() + timedelta(seconds=int(m.group(1)))
    return None


@dataclass
class ProbeResult:
    account_id: int
    platform: str
    display_name: str
    ok: bool
    kind: str
    message: str
    status: str
    duration_ms: int


async def _persist_adapter_refresh(
    conn: asyncpg.Connection, account_id: int, adapter: Any, credentials: dict[str, Any]
) -> None:
    """把 adapter 在 verify 过程中刷新出来的凭证回写库(目前用于 YouTube OAuth)。

    只认 adapter 自己挂的 `_verified_credentials`;没有或没变化就什么都不做。
    失败只记日志 —— 已经验活成功,不能因为写回失败把状态打成掉线。
    """
    new = getattr(adapter, "_verified_credentials", None)
    if not isinstance(new, dict) or new == credentials:
        return
    try:
        from app.services.publish.credential_history import apply_credentials_update
        from app.services.publish.credentials_crypto import encrypt

        await apply_credentials_update(
            conn, account_id, encrypt(new),
            source_note="体检时平台 token 自动刷新",
        )
        logger.info("[session-keeper] account=%s 平台 token 已自动刷新并回写", account_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("[session-keeper] account=%s token 回写失败: %s", account_id, e)


async def _refresh_session(
    account_id: int, platform: str, adapter: Any, *, timeout: float
) -> tuple[bool, str, int]:
    """真登录态通过后刷新会话;返回 (成功, 说明, 耗时ms)。

    - API 密钥类平台(needs_browser=False)没有浏览器会话可刷,视为成功;
    - cookie 类平台复用 cookie_daemon.refresh_single:它会带 cookie 访问后台并把
      平台轮换后的新 cookie 合并回库。只体检不刷新,迟早出现"状态显示在线、
      发布却用旧 cookie"的假活。
    """
    if not getattr(adapter, "needs_browser", False):
        return True, "API 凭证无需刷新", 0
    try:
        from app.services.scan_login import PLATFORM_SCAN_CONFIG
    except Exception:
        return True, "扫码配置不可用,跳过刷新", 0
    if not (PLATFORM_SCAN_CONFIG.get(platform) or {}).get("success_cookies"):
        return True, "该平台无 cookie 刷新配置", 0
    try:
        from app.services.publish.cookie_refresh_daemon import cookie_daemon

        result = await asyncio.wait_for(
            cookie_daemon.refresh_single(account_id, platform), timeout=timeout
        )
        return bool(result.success), result.message, int(result.duration_ms or 0)
    except asyncio.TimeoutError:
        return False, f"刷新超时({int(timeout)}s)", int(timeout * 1000)
    except Exception as e:  # noqa: BLE001 —— 刷新失败不推翻"登录态有效"的结论
        return False, f"{type(e).__name__}: {str(e)[:200]}", 0


async def probe_account(account_id: int, *, force: bool = False) -> ProbeResult:
    """单个账号体检。所有异常都收敛成状态,不向上抛 —— 守护进程不能因一个号崩。

    `force=False` 时若 `next_probe_at` 未到会跳过(返回 kind=skipped)。
    """
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        row = await conn.fetchrow(
            """
            SELECT a.id, a.user_id, a.platform, a.display_name, a.status, a.credentials_enc,
                   s.status AS session_status, s.next_probe_at, s.consecutive_failures,
                   s.probe_interval_minutes, s.last_alert_at
            FROM publish_accounts a
            LEFT JOIN publish_session_state s ON s.account_id = a.id
            WHERE a.id = $1
            """,
            account_id,
        )
        if not row:
            return ProbeResult(account_id, "", "", False, _KIND_ERROR, "account not found", STATUS_UNKNOWN, 0)
        if row["status"] != "active":
            return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                               False, "skipped", "账号已停用", STATUS_UNKNOWN, 0)
        # 新号/老库可能还没有状态行;先补一行,后续 UPDATE 才有落点。
        await conn.execute(
            """
            INSERT INTO publish_session_state
                (account_id, user_id, platform, status, next_probe_at, probe_interval_minutes)
            VALUES ($1,$2,$3,'unknown',$4,$5)
            ON CONFLICT (account_id) DO NOTHING
            """,
            account_id, row["user_id"], row["platform"], _utc_now(),
            int(row["probe_interval_minutes"] or config()["interval_minutes"]),
        )
        if not force and row["next_probe_at"] and row["next_probe_at"] > _utc_now():
            return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                               False, "skipped", "未到体检时间", row["session_status"] or STATUS_UNKNOWN, 0)

        interval = int(row["probe_interval_minutes"] or config()["interval_minutes"])
        started = time.monotonic()

        # 1) 解密。这把钥匙错了,后面全是无用功 —— 直接判"必须人处理"。
        try:
            from app.services.publish.credentials_crypto import decrypt
            credentials = decrypt(row["credentials_enc"])
            from app.services.publish.credential_compat import normalize_credentials
            credentials = normalize_credentials(row["platform"], credentials)
        except Exception as e:
            duration = int((time.monotonic() - started) * 1000)
            msg = f"凭证无法解密(密钥不匹配/密文损坏): {type(e).__name__}"
            await _write_failure(
                conn, row, kind=_KIND_DECRYPT, message=msg, status=STATUS_REAUTH_REQUIRED,
                interval=interval, duration=duration, retryable=False,
            )
            await _maybe_alert(conn, row, msg)
            return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                               False, _KIND_DECRYPT, msg, STATUS_REAUTH_REQUIRED, duration)

        # 2) 找适配器。找不到不是"账号坏了",是平台没接 —— 记 config_error,
        #    不把用户账号标成失效。
        from app.services.publish.base_adapter import get_adapter
        adapter = get_adapter(row["platform"])
        if adapter is None:
            duration = int((time.monotonic() - started) * 1000)
            msg = f"平台暂无适配器: {row['platform']}"
            await _write_failure(
                conn, row, kind=_KIND_CONFIG, message=msg, status=STATUS_DEGRADED,
                interval=interval, duration=duration, retryable=False,
            )
            return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                               False, _KIND_CONFIG, msg, STATUS_DEGRADED, duration)

        adapter.db_account_id = account_id
        timeout = config()["timeout_seconds"]

        # 3) 真实登录态校验:创作者后台/鉴权接口,不是"cookie 名还在不在"。
        try:
            ok, message = await asyncio.wait_for(
                adapter.verify_credentials(credentials), timeout=timeout
            )
            duration = int((time.monotonic() - started) * 1000)
        except asyncio.TimeoutError:
            duration = int((time.monotonic() - started) * 1000)
            msg = f"体检超时({timeout}s)"
            await _write_failure(
                conn, row, kind=_KIND_NETWORK, message=msg, status=STATUS_DEGRADED,
                interval=interval, duration=duration, retryable=True,
            )
            return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                               False, _KIND_NETWORK, msg, STATUS_DEGRADED, duration)
        except Exception as e:
            duration = int((time.monotonic() - started) * 1000)
            msg = f"体检异常: {type(e).__name__}: {str(e)[:300]}"
            kind = _classify(msg)
            await _write_failure(
                conn, row, kind=kind, message=msg,
                status=STATUS_REAUTH_REQUIRED if kind == _KIND_EXPIRED else STATUS_DEGRADED,
                interval=interval, duration=duration, retryable=kind != _KIND_EXPIRED,
            )
            return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                               False, kind, msg, STATUS_REAUTH_REQUIRED if kind == _KIND_EXPIRED else STATUS_DEGRADED,
                               duration)

        if ok:
            # 3.1) OAuth 适配器可能在 verify 内刷新 access_token;把新凭证回写,
            #      否则下一轮仍用旧 token,刷新等于白做。
            await _persist_adapter_refresh(conn, account_id, adapter, credentials)
            # 4) 真登录态通过后,再做一次"刷新":cookie 类平台带登录态访问一次创作者后台,
            #    把平台轮换后的 cookie 合并回库(只探不刷 = 看着在线,发布时却用过期值)。
            #    API 类平台没有可刷新的浏览器会话,直接跳过。
            refreshed, refresh_msg, refresh_ms = await _refresh_session(
                account_id, row["platform"], adapter, timeout=timeout + 30
            )
            duration += refresh_ms
            if not refreshed:
                await _record_event(
                    conn, account_id=account_id, user_id=row["user_id"], platform=row["platform"],
                    ok=False, kind=_KIND_NETWORK, message=f"cookie 刷新失败: {refresh_msg}",
                    detail={"duration_ms": refresh_ms, "verified": True},
                )
                logger.warning(
                    "[session-keeper] account=%s 登录态有效但 cookie 刷新失败: %s",
                    account_id, refresh_msg,
                )
            expires = _parse_expiry(message)
            msg = message if refreshed else f"{message}(cookie 刷新失败:{refresh_msg})"
            await conn.execute(
                """
                UPDATE publish_session_state
                SET status='healthy', last_probe_at=NOW(), last_ok_at=NOW(), next_probe_at=$2,
                    consecutive_failures=0, last_error=NULL, last_error_kind=NULL,
                    expires_at=COALESCE($3, expires_at), reauth_task_id=NULL, reauth_started_at=NULL,
                    last_duration_ms=$4, probe_interval_minutes=$5, updated_at=NOW()
                WHERE account_id=$1
                """,
                account_id, _next_probe(interval, config()["jitter"]), expires, duration, interval,
            )
            await conn.execute(
                "UPDATE publish_accounts SET last_verified_at=NOW(), last_verify_msg=$2, updated_at=NOW() WHERE id=$1",
                account_id, f"OK: {msg}"[:500],
            )
            await _record_event(
                conn, account_id=account_id, user_id=row["user_id"], platform=row["platform"],
                ok=True, kind=_KIND_OK, message=msg,
                detail={"duration_ms": duration, "cookie_refreshed": refreshed},
            )
            return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                               True, _KIND_OK, msg, STATUS_HEALTHY, duration)

        # 4) 明确失败:按消息分成"登录失效"与"网络/依赖抖动",处理方式不同。
        kind = _classify(message)
        retryable = kind != _KIND_EXPIRED
        status = STATUS_REAUTH_REQUIRED if kind == _KIND_EXPIRED else STATUS_DEGRADED
        await _write_failure(
            conn, row, kind=kind, message=message or "verify returned false",
            status=status, interval=interval, duration=duration, retryable=retryable,
        )
        if status == STATUS_REAUTH_REQUIRED:
            await _maybe_alert(conn, row, message or "登录失效,需要重新扫码")
        return ProbeResult(account_id, row["platform"], row["display_name"] or "",
                           False, kind, message, status, duration)
    finally:
        await conn.close()


async def _write_failure(
    conn: asyncpg.Connection,
    row: asyncpg.Record,
    *,
    kind: str,
    message: str,
    status: str,
    interval: int,
    duration: int,
    retryable: bool,
) -> None:
    failures = int(row["consecutive_failures"] or 0) + 1
    if retryable:
        # 指数退避:5min → 10 → 20 → 40 → 80,封顶 3h;比"每 60s 重试 30 次"安静得多。
        backoff_min = min(180, 5 * (2 ** min(failures - 1, 5)))
        next_at = _utc_now() + timedelta(minutes=backoff_min)
    else:
        # 必须人扫码/授权的失败,重试无意义;6h 后再看一眼(万一是平台临时抽风)。
        next_at = _utc_now() + timedelta(hours=6)
    await conn.execute(
        """
        UPDATE publish_session_state
        SET status=$2, last_probe_at=NOW(), next_probe_at=$3, consecutive_failures=$4,
            last_error=$5, last_error_kind=$6, last_duration_ms=$7,
            probe_interval_minutes=$8, updated_at=NOW()
        WHERE account_id=$1
        """,
        int(row["id"]), status, next_at, failures, message[:2000], kind, duration, interval,
    )
    await _record_event(
        conn, account_id=int(row["id"]), user_id=row["user_id"], platform=row["platform"],
        ok=False, kind=kind, message=message, detail={"duration_ms": duration, "retryable": retryable},
    )
    await conn.execute(
        "UPDATE publish_accounts SET last_verify_msg=$2, updated_at=NOW() WHERE id=$1",
        int(row["id"]), f"FAIL: {message}"[:500],
    )


# =============================================================================
# 重登钩子(scan_login 调用)
# =============================================================================
async def mark_reauth_started(account_id: int, task_id: str) -> None:
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        account = await conn.fetchrow(
            "SELECT user_id, platform, display_name FROM publish_accounts WHERE id=$1", account_id
        )
        if not account:
            return
        await conn.execute(
            """
            INSERT INTO publish_session_state
                (account_id, user_id, platform, status, reauth_task_id, reauth_started_at, next_probe_at)
            VALUES ($1,$2,$3,'reauth_required',$4,NOW(),NOW() + INTERVAL '6 hours')
            ON CONFLICT (account_id) DO UPDATE
            SET reauth_task_id=EXCLUDED.reauth_task_id,
                reauth_started_at=NOW(),
                status='reauth_required',
                next_probe_at=NOW() + INTERVAL '6 hours',
                updated_at=NOW()
            """,
            account_id, account["user_id"], account["platform"], task_id,
        )
        await _record_event(
            conn, account_id=account_id, user_id=str(account["user_id"]), platform=account["platform"],
            ok=False, kind=_KIND_EXPIRED, message="已发起重新登录,等待扫码", detail={"task_id": task_id},
        )
    finally:
        await conn.close()


async def on_reauth_success(account_id: int) -> None:
    """扫码/授权成功后的唯一回池口:状态转 healthy,next_probe 立即排下一轮。

    不能只在 scan_login 里改 `publish_accounts.last_verified_at` —— 池取号读的是
    session_state;两处各写一半,就会出现"账号表显示刚验过、池里仍判失效"。
    """
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        row = await conn.fetchrow(
            "SELECT user_id, platform, probe_interval_minutes, display_name FROM publish_accounts a "
            "LEFT JOIN publish_session_state s ON s.account_id=a.id WHERE a.id=$1",
            account_id,
        )
        if not row:
            return
        interval = int(row["probe_interval_minutes"] or config()["interval_minutes"])
        await conn.execute(
            """
            INSERT INTO publish_session_state
                (account_id, user_id, platform, status, last_probe_at, last_ok_at,
                 next_probe_at, probe_interval_minutes)
            VALUES ($1,$2,$3,'healthy',NOW(),NOW(),$4,$5)
            ON CONFLICT (account_id) DO UPDATE
            SET status='healthy', last_probe_at=NOW(), last_ok_at=NOW(),
                next_probe_at=EXCLUDED.next_probe_at,
                consecutive_failures=0, last_error=NULL, last_error_kind=NULL,
                reauth_task_id=NULL, reauth_started_at=NULL, updated_at=NOW()
            """,
            account_id, row["user_id"], row["platform"],
            _next_probe(interval, config()["jitter"]), interval,
        )
        await conn.execute(
            "UPDATE publish_accounts SET status='active', last_verified_at=NOW(), last_verify_msg='扫码登录成功', updated_at=NOW() WHERE id=$1",
            account_id,
        )
        await _record_event(
            conn, account_id=account_id, user_id=str(row["user_id"]), platform=row["platform"],
            ok=True, kind=_KIND_OK, message="重新登录成功,已回池",
        )
        # 新号(同平台第二个号)扫码成功后,默认池可能还没收它 —— 立刻幂等补进去,
        # 不用等下一次进程重启。失败只告警,不能让回池状态本身丢。
        try:
            from app.services.publish.account_pool import bootstrap_pools
            await bootstrap_pools(conn, str(row["user_id"]))
        except Exception as e:  # noqa: BLE001
            logger.warning("[session-keeper] 回池后补账号池成员失败(状态已回写): %s", e)
    finally:
        await conn.close()


# =============================================================================
# 批量体检 + 调度
# =============================================================================
async def probe_many(
    account_ids: Iterable[int], *, force: bool = True, concurrency: int = 2
) -> list[dict[str, Any]]:
    sem = asyncio.Semaphore(max(1, concurrency))

    async def one(aid: int) -> dict[str, Any]:
        async with sem:
            result = await probe_account(aid, force=force)
            return asdict(result)

    return list(await asyncio.gather(*(one(aid) for aid in account_ids)))


async def _due_accounts(conn: asyncpg.Connection, limit: int = 50) -> list[int]:
    rows = await conn.fetch(
        """
        SELECT a.id
        FROM publish_accounts a
        LEFT JOIN publish_session_state s ON s.account_id = a.id
        WHERE a.status='active'
          AND (s.account_id IS NULL OR s.next_probe_at IS NULL OR s.next_probe_at <= NOW())
        ORDER BY COALESCE(s.next_probe_at, a.created_at)
        LIMIT $1
        """,
        limit,
    )
    return [int(r["id"]) for r in rows]


async def tick_once(*, limit: int = 30) -> dict[str, Any]:
    """跑一轮:补状态行 → 取到期账号 → 并发体检。单测直接调这个,不依赖线程。"""
    cfg = config()
    conn = await get_db_conn()
    try:
        await ensure_tables(conn)
        inserted = await ensure_states(conn)
        ids = await _due_accounts(conn, limit=limit)
    finally:
        await conn.close()

    results = await probe_many(ids, force=True, concurrency=cfg["concurrency"]) if ids else []
    return {"inserted": inserted, "probed": len(results), "results": results}


async def _loop() -> None:
    global _LAST_TICK_AT, _LAST_ERROR
    cfg = config()
    logger.info(
        "[session-keeper] 启动: tick=%ss interval=%smin concurrency=%s timeout=%ss",
        cfg["tick_seconds"], cfg["interval_minutes"], cfg["concurrency"], cfg["timeout_seconds"],
    )
    while not _STOP.is_set():
        try:
            stats = await tick_once()
            _LAST_TICK_AT = _utc_now()
            if stats["probed"]:
                logger.info("[session-keeper] 本轮体检 %s 个账号", stats["probed"])
        except Exception as e:  # noqa: BLE001 —— 守护线程不能死
            _LAST_ERROR = f"{type(e).__name__}: {e}"
            logger.warning("[session-keeper] 本轮异常(下一轮继续): %s", _LAST_ERROR, exc_info=True)
        await asyncio.sleep(cfg["tick_seconds"])


def _run_thread() -> None:
    asyncio.run(_loop())


async def start() -> bool:
    """建表 + 起线程。失败返回 False,由调用方决定是否退回旧探针。"""
    global _ACTIVE, _THREAD
    if not config()["enabled"]:
        logger.info("[session-keeper] SESSION_KEEPER_ENABLED=0,不启动")
        return False
    try:
        await ensure_tables()
        conn = await get_db_conn()
        try:
            # 先补账号池:新用户/新账号不再依赖人工 POST /pools/bootstrap。
            # 失败只告警,不拦守护线程(池只是选号层,体检/告警仍要跑)。
            try:
                from app.services.publish.account_pool import bootstrap_all_users
                users = await bootstrap_all_users(conn)
                logger.info("[session-keeper] 账号池 reconcile 完成 users=%s", users)
            except Exception as e:  # noqa: BLE001
                logger.warning("[session-keeper] 账号池 reconcile 失败(继续启动): %s", e)
            await ensure_states(conn)
        finally:
            await conn.close()
    except Exception as e:
        logger.warning("[session-keeper] 初始化失败,退回旧探针: %s", e, exc_info=True)
        return False
    if _THREAD and _THREAD.is_alive():
        _ACTIVE = True
        return True
    _STOP.clear()
    _THREAD = threading.Thread(target=_run_thread, daemon=True, name="publish-session-keeper")
    _THREAD.start()
    _ACTIVE = True
    return True


async def stop() -> None:
    global _ACTIVE
    _ACTIVE = False
    _STOP.set()


def snapshot() -> dict[str, Any]:
    cfg = config()
    return {
        "enabled": cfg["enabled"],
        "active": _ACTIVE,
        "tickSeconds": cfg["tick_seconds"],
        "intervalMinutes": cfg["interval_minutes"],
        "concurrency": cfg["concurrency"],
        "timeoutSeconds": cfg["timeout_seconds"],
        "lastTickAt": _LAST_TICK_AT.isoformat() if _LAST_TICK_AT else None,
        "lastError": _LAST_ERROR,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

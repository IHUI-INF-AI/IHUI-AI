# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心 —— 探针(适配层)。

探针只回答一件事:**这个账号的凭证现在还有效吗,什么时候会失效?**

三条探针的实现取向刻意不同,因为账号类型本身不同:
  - ``PublishProbe``(cookie 分支):复用 ``cookie_daily.refresh_single`` —— 探活动作
    就是"带着 cookie 访问一次平台首页",这套逻辑已有 46 个测试覆盖,这里**不复制**
    第二份判据,只把它的中文结果归一化成分类型。
  - ``PublishProbe``(token 分支):api_key / oauth 不发"访问",只推算 ``expires_at``。
    此前这条线在保活里被整体 skip(守护的 ``success_cookies`` 判空即跳过),于是
    "密钥 30 天后到期"这件事在系统里**没有任何入口**能提前说出来。
  - ``CheckinProbe``:只解 JWT 的 ``exp``,不代签。每日签到是另一件事,归
    ``checkin_scheduler``(08:05/10:05 双窗口),中心插手会让同一账号被两处同时打。

每次探活都有硬超时:一个平台改版把页面挂住,不能拖垮整轮(单账号隔离)。
"""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, Protocol, runtime_checkable

from app.core.logging import get_logger
from app.services.keepalive.models import (
    KIND_ERROR,
    KIND_EXPIRED,
    KIND_OK,
    KIND_UNSUPPORTED,
    SOURCE_CHECKIN,
    SOURCE_PUBLISH_COOKIE,
    SOURCE_PUBLISH_TOKEN,
    AccountRef,
    ProbeOutcome,
    describe_exc,
)
from app.services.keepalive.policy import classify_message

logger = get_logger(__name__)

# 单账号探活硬超时(秒)。cookie 探活内部页面超时 30s + 等待 7s + 浏览器启动,
# 60s 是正常上限;给到 120s 是为了容忍慢网络,同时保证坏账号不会挂死整轮。
PROBE_TIMEOUT_SECONDS = 120.0

# 并发上限(可配 KEEPALIVE_PROBE_CONCURRENCY,夹在 1..10)。
#
# 为什么是并发而不是"复用浏览器":2026-10-26 实测本机,`sync_playwright()` 启动
# 0.63s、Chromium launch 仅 0.13s、new_context 0.23s —— 固定开销合计约 1s,而单个
# 账号的墙钟是 ~8s,其中 **7s 是等 cookie 下发的死等**(_VISIT_WAIT_SECONDS)。
# 也就是说复用浏览器最多省 1s/账号(19 个约 14s ≈ 9%),几乎白改;真正的瓶颈是串行。
# 取 4:每个 headless Chromium 约 80-150MB,4 个约 0.5GB,本机与常见部署机都受得住;
# 再高要看部署机内存,而这一轮 6 小时才跑一次,没必要为它榨机器。
_DEFAULT_CONCURRENCY = 4


def probe_concurrency() -> int:
    """读并发上限。非法值回落默认(与 center 的 _int_env 同一取向:不因脏配置停摆)。"""
    raw = (os.environ.get("KEEPALIVE_PROBE_CONCURRENCY") or "").strip()
    if not raw:
        return _DEFAULT_CONCURRENCY
    try:
        return max(1, min(int(float(raw)), 10))
    except ValueError:
        logger.warning(
            "[keepalive] KEEPALIVE_PROBE_CONCURRENCY=%r 非法,回落 %s",
            raw,
            _DEFAULT_CONCURRENCY,
        )
        return _DEFAULT_CONCURRENCY


async def safe_probe(probe: Probe, ref: AccountRef) -> ProbeOutcome:
    """单账号探活并把任何异常收敛成一次失败。

    ``asyncio.gather`` 里任何协程抛出都会让整批结果作废,所以批量路径上每个
    协程都必须**永不抛**(CancelledError 除外)。这里是那条规则的唯一实现。
    """
    try:
        return await probe.probe(ref)
    except asyncio.CancelledError:
        raise
    except Exception as e:  # noqa: BLE001 —— 兜底就是兜住一切
        logger.exception("[keepalive] 探活异常 %s", ref.ref)
        return ProbeOutcome(
            ok=False,
            kind=KIND_ERROR,
            message=f"探活异常: {type(e).__name__}: {str(e)[:200]}",
            retryable=True,
        )


async def run_bounded(
    refs: list[AccountRef],
    call: Callable[[AccountRef], Awaitable[ProbeOutcome]],
    *,
    concurrency: int,
    serialize_by: str | None = None,
) -> dict[str, ProbeOutcome]:
    """限流 + 可选"按某维度串行"地跑一批探活,返回 ``{ref: outcome}``。

    抽成独立函数(而不是写进某个探针方法)是为了**可测**:调度语义(同平台不并发、
    全局不超并发上限)靠读代码保证不了,必须能用假探针直接量出来。真跑 19 个
    Chromium 既慢又依赖网络,那种"验证"没法在 CI 里守住回归。

    ``serialize_by="platform"`` 时:同 key 排队,不同 key 并行。锁放在信号量**外层**,
    排队者不占并发槽 —— 否则两个同平台账号会各占一个槽干等,白吃一半并发度。
    """
    out: dict[str, ProbeOutcome] = {}
    if not refs:
        return out

    sem = asyncio.Semaphore(max(1, concurrency))
    key_locks: dict[str, asyncio.Lock] = {}

    async def one(ref: AccountRef) -> None:
        if serialize_by is None:
            async with sem:
                out[ref.ref] = await call(ref)
            return
        key = getattr(ref, serialize_by, "") or ""
        lock = key_locks.setdefault(key, asyncio.Lock())
        async with lock:
            async with sem:
                out[ref.ref] = await call(ref)

    await asyncio.gather(*(one(r) for r in refs))
    return out

# token 类型账号的到期字段候选(小写比较)。平台各写各的,这里做一次归一化;
# 认不出就是"无到期信息",按 unsupported 处理 —— 不猜、不假装健康。
_EXPIRY_KEYS = (
    "expires_at",
    "expire_at",
    "expiresat",
    "expiry",
    "expiry_at",
    "token_expires_at",
    "token_expire_at",
    "expires_time",
    "expire_time",
    "exp",
)


@runtime_checkable
class Probe(Protocol):
    """一个保活来源。"""

    source: str

    async def list_accounts(self, owner: str | None) -> list[AccountRef]: ...

    async def probe(self, ref: AccountRef) -> ProbeOutcome: ...


def as_utc(value: datetime | None) -> datetime | None:
    """统一成 tz-aware UTC。

    JWT 的 ``exp`` 解出来常是 naive UTC,而库里 timestamptz 回来是 aware ——
    两者相减会抛 ``TypeError: can't subtract offset-naive and offset-aware``。
    这一格此前在别处踩过,故在入口统一,不在每个调用点各判一次。
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def parse_expiry(credentials: dict[str, Any]) -> datetime | None:
    """从凭证 dict 里解析到期时间。认不出返回 None。

    支持三种形态(实测各平台都用过):
      - ISO 字符串 ``2026-11-01T00:00:00Z`` / 带偏移
      - Unix 秒(10 位)/ 毫秒(13 位)整数或数字字符串
      - ``exp`` 这类 JWT 惯用名
    """
    if not credentials:
        return None
    lowered = {str(k).lower(): v for k, v in credentials.items()}
    for key in _EXPIRY_KEYS:
        if key not in lowered:
            continue
        parsed = _parse_one(lowered[key])
        if parsed is not None:
            return parsed
    return None


def _parse_one(raw: Any) -> datetime | None:
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, datetime):
        return as_utc(raw)
    if isinstance(raw, (int, float)):
        return _from_epoch(float(raw))
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        if text.isdigit():
            return _from_epoch(float(text))
        try:
            normalized = text.replace("Z", "+00:00")
            return as_utc(datetime.fromisoformat(normalized))
        except ValueError:
            return None
    return None


def _from_epoch(value: float) -> datetime | None:
    if value <= 0:
        return None
    # 13 位是毫秒:除以 1000。用阈值 1e11 而不是位数判断,兼容浮点。
    seconds = value / 1000.0 if value > 1e11 else value
    try:
        return datetime.fromtimestamp(seconds, tz=UTC)
    except (OverflowError, OSError, ValueError):
        return None


def is_cookie_platform(platform: str) -> bool:
    """该平台是否走 cookie 保活(与 cookie 守护共用同一判据源)。"""
    from app.services.scan_login import PLATFORM_SCAN_CONFIG

    cfg = PLATFORM_SCAN_CONFIG.get(platform)
    return bool(cfg and cfg.get("success_cookies"))


class PublishProbe:
    """发布线账号:平台登录态(cookie)或密钥(token)。"""

    # 显式标注为 str(而不是让 mypy 从字面量/常量推出 Literal):Probe 协议声明
    # 的是 str,Literal["checkin"] 这类窄类型会被判为不兼容(list-item)。
    source: str = "publish"

    async def list_accounts(self, owner: str | None) -> list[AccountRef]:
        from app.core.db_pool import get_shared_pool

        sql = (
            "SELECT id, user_id, platform, display_name FROM publish_accounts"
            " WHERE status = 'active'"
        )
        args: list[Any] = []
        if owner:
            args.append(owner)
            sql += " AND user_id = $1"
        sql += " ORDER BY id"
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
        return [
            AccountRef(
                source=SOURCE_PUBLISH_COOKIE if is_cookie_platform(r["platform"]) else SOURCE_PUBLISH_TOKEN,
                account_id=int(r["id"]),
                owner=str(r["user_id"]),
                display=str(r["display_name"] or ""),
                platform=str(r["platform"]),
            )
            for r in rows
        ]

    async def probe(self, ref: AccountRef) -> ProbeOutcome:
        if ref.source == SOURCE_PUBLISH_COOKIE:
            return await self._probe_cookie(ref)
        return await self._probe_token(ref)

    async def probe_many(self, refs: list[AccountRef]) -> dict[str, ProbeOutcome]:
        """批量探活:**同平台串行、跨平台并发**。

        同平台为什么要串行:同一站点的多个账号在几秒内连续登录态访问,正是平台
        风控最敏感的形状("一台机器轮流上多个号")。串行化后同站访问仍是一前一后,
        与手工逐个点开没有区别;不同站点之间并发则没有任何关联风险。

        锁在信号量**外层**:同平台排队时不占并发槽,否则两个小红书账号会各占一个槽
        干等,把并发度白白吃掉一半。
        """
        out: dict[str, ProbeOutcome] = {}
        cookies = [r for r in refs if r.source == SOURCE_PUBLISH_COOKIE]
        others = [r for r in refs if r.source != SOURCE_PUBLISH_COOKIE]

        # 密钥类不启浏览器(实测单账号 ~78ms),顺序跑即可,不值得为它写并发。
        for ref in others:
            out[ref.ref] = await safe_probe(self, ref)

        if not cookies:
            return out

        async def call(ref: AccountRef) -> ProbeOutcome:
            return await safe_probe(self, ref)

        out.update(
            await run_bounded(
                cookies,
                call,
                concurrency=probe_concurrency(),
                serialize_by="platform",
            )
        )
        return out

    async def _probe_cookie(self, ref: AccountRef) -> ProbeOutcome:
        from app.services.publish.cookie_refresh_daemon import cookie_daemon

        started = time.monotonic()
        try:
            result = await asyncio.wait_for(
                cookie_daemon.refresh_single(ref.account_id, ref.platform),
                timeout=PROBE_TIMEOUT_SECONDS,
            )
        except TimeoutError:
            return ProbeOutcome(
                ok=False,
                kind=KIND_ERROR,
                message=f"探活超时({PROBE_TIMEOUT_SECONDS:.0f}s)",
                duration_ms=int((time.monotonic() - started) * 1000),
                retryable=True,
            )
        outcome = classify_message(result.success, result.message)
        return ProbeOutcome(
            ok=outcome.ok,
            kind=outcome.kind,
            message=outcome.message,
            duration_ms=result.duration_ms or int((time.monotonic() - started) * 1000),
            retryable=outcome.retryable,
        )

    async def _probe_token(self, ref: AccountRef) -> ProbeOutcome:
        """密钥/oauth 类:不启浏览器,只得到期。

        这条分支的价值全在"提前说":没有任何到期信息的账号记 unsupported
        (不占健康度分母,也不算失败),有到期信息的按临期/过期判定。
        """
        from app.core.db_pool import get_shared_pool
        from app.services.publish.credentials_crypto import decrypt

        started = time.monotonic()
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT credentials_enc FROM publish_accounts WHERE id = $1",
                    ref.account_id,
                )
            if row is None:
                return ProbeOutcome(
                    ok=False, kind=KIND_ERROR, message="账号不存在", retryable=False
                )
            credentials = decrypt(row["credentials_enc"])
        except Exception as e:  # noqa: BLE001 —— 解密失败原因多(密钥轮换/密文损坏),都要如实报
            # 归 expired 而不是 error:主密钥与密文不匹配是**不可自愈**的,退避重试
            # 一万次还是同一个 InvalidTag。expired 的语义正是"只能重录,重试无用",
            # 既拿到当轮即告警,也让 health_of 直接判 critical 而不是先黄三轮。
            return ProbeOutcome(
                ok=False,
                kind=KIND_EXPIRED,
                message=f"凭证无法解密({describe_exc(e)}),需重新扫码录入该账号",
                duration_ms=int((time.monotonic() - started) * 1000),
                retryable=False,
            )

        expires_at = parse_expiry(credentials)
        duration = int((time.monotonic() - started) * 1000)
        if expires_at is None:
            return ProbeOutcome(
                ok=False,
                kind=KIND_UNSUPPORTED,
                message="密钥类账号无到期信息,无需保活",
                duration_ms=duration,
            )
        now = datetime.now(UTC)
        if expires_at <= now:
            return ProbeOutcome(
                ok=False,
                kind=KIND_EXPIRED,
                message=f"凭证已于 {expires_at.isoformat()} 过期",
                duration_ms=duration,
                expires_at=expires_at,
                retryable=False,
            )
        return ProbeOutcome(
            ok=True,
            kind=KIND_OK,
            message=f"凭证有效至 {expires_at.isoformat()}",
            duration_ms=duration,
            expires_at=expires_at,
        )


class CheckinProbe:
    """签到线账号:只读 JWT exp,不代签。"""

    source: str = SOURCE_CHECKIN

    async def list_accounts(self, owner: str | None) -> list[AccountRef]:
        """只读元数据,**不解密**。

        不使用 ``checkin_store.list_enabled_accounts_full()`` 的原因(2026-10-26 实测):
        那个函数在**列表阶段**就逐行解密 JWT,只要有一枚密文坏了(密钥轮换过 / 库被拷到
        另一台机),它整批抛 ``ValueError: JWT 密文解密失败`` —— 上游一抛,本中心只能
        整个来源跳过 ⇒ **一个坏账号让全部签到账号都拿不到保活**,而且日志里只写"列账号
        失败(跳过该来源)",看起来像数据库挂了。解密必须下沉到 ``probe()``:那里按
        单账号 try/except,坏的只坏它自己。
        """
        from app.core.db_pool import get_shared_pool

        sql = (
            "SELECT id, owner_user_id, name, platform FROM checkin_accounts"
            " WHERE enabled = true"
        )
        args: list[Any] = []
        if owner:
            args.append(owner)
            sql += " AND owner_user_id = $1"
        sql += " ORDER BY id"
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
        return [
            AccountRef(
                source=SOURCE_CHECKIN,
                account_id=int(r["id"]),
                owner=str(r["owner_user_id"]),
                display=str(r["name"] or ""),
                platform=str(r["platform"] or ""),
            )
            for r in rows
        ]

    async def probe(self, ref: AccountRef) -> ProbeOutcome:
        from app.services.checkin_engine import get_jwt_exp
        from app.services.checkin_store import get_decrypted_jwt

        started = time.monotonic()
        try:
            account = await get_decrypted_jwt(ref.account_id, ref.owner)
        except Exception as e:  # noqa: BLE001 —— 解密失败(密钥不匹配)必须如实报,不能当健康
            # 同 PublishProbe:密钥不匹配不可自愈,归 expired(需重录)而非可重试的 error。
            return ProbeOutcome(
                ok=False,
                kind=KIND_EXPIRED,
                message=f"签到凭证无法解密({describe_exc(e)}),需重新录入 JWT",
                duration_ms=int((time.monotonic() - started) * 1000),
                retryable=False,
            )
        if account is None:
            return ProbeOutcome(
                ok=False, kind=KIND_ERROR, message="账号不存在或已停用", retryable=False
            )

        expires_at, _remaining_hours = get_jwt_exp(str(account.get("jwt") or ""))
        duration = int((time.monotonic() - started) * 1000)
        expires_at = as_utc(expires_at)
        if expires_at is None:
            return ProbeOutcome(
                ok=False,
                kind=KIND_UNSUPPORTED,
                message="凭证不含有效期(非 JWT),无法推算到期",
                duration_ms=duration,
            )
        now = datetime.now(UTC)
        if expires_at <= now:
            return ProbeOutcome(
                ok=False,
                kind=KIND_EXPIRED,
                message=f"签到凭证已于 {expires_at.isoformat()} 过期,需重新录入",
                duration_ms=duration,
                expires_at=expires_at,
                retryable=False,
            )
        return ProbeOutcome(
            ok=True,
            kind=KIND_OK,
            message=f"签到凭证有效至 {expires_at.isoformat()}",
            duration_ms=duration,
            expires_at=expires_at,
        )

    async def probe_many(self, refs: list[AccountRef]) -> dict[str, ProbeOutcome]:
        """签到账号只是一次 DB 读 + 解密,纯并发即可(无平台风控面)。"""
        if not refs:
            return {}

        async def call(ref: AccountRef) -> ProbeOutcome:
            return await safe_probe(self, ref)

        return await run_bounded(
            refs, call, concurrency=probe_concurrency(), serialize_by=None
        )


def build_probes() -> list[Probe]:
    """默认探针集合。新增来源只需在此追加,中心不认具体类型。"""
    return [PublishProbe(), CheckinProbe()]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

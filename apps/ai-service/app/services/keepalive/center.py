# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心 —— 统一调度。

一段话说明它解决什么
--------------------
改造前,"保活"在本仓库是两套互不相识的东西:发布线守护只看 cookie,签到线只看
自己的每日任务。用户问"我的号还好吗",两边都答不完整;运维问"昨天有几轮保活失败",
两边都没有这个数。本中心把三类探针放进**同一个轮次**:
一轮 = 遍历所有来源的所有账号 → 逐账号出分类结果 → 落状态/流水 → 汇总健康度 → 喊人。

三条设计约束(违反任意一条,这层就会退化成第二个"装了开关没接电")
------------------------------------------------------------------
1. **开关必须自检**。``resolve_config()`` 每次被问都重新读环境变量并给出
   ``enabled_reason``。未启用时 ``start()`` 打 warning 明确点名缺哪个键 ——
   不再出现"看起来配了其实没开"。
2. **单账号隔离**。任何账号的探活都必须被 try/except + 超时包住:一个平台改版
   把页面挂死,只该让那个号记一次失败,不该让整轮停摆(否则一轮卡死 ⇒ 后面全部
   账号永远拿不到保活,而这在日志里只表现为"没有新记录")。
3. **不接管业务动作**。签到与发布仍由各自调度器执行;本中心只做凭证存活。

并发取向:串行。cookie 探活每次真起一个 Chromium,并发 16 个会直接打爆内存;
而一轮 6 小时跑一次,串行 2-3 分钟完全可以接受。真要提速,正确做法是给 cookie
分支做浏览器复用(见 cookie_refresh_daemon 的 _visit_and_check),不是在这里并发。
"""

from __future__ import annotations

import asyncio
import contextlib
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.core.logging import get_logger
from app.services.keepalive import store
from app.services.keepalive.alerts import publish_inapp_alerts
from app.services.keepalive.models import (
    KIND_ERROR,
    KIND_SKIPPED,
    AccountRef,
    AccountReport,
    PolicyConfig,
    ProbeOutcome,
    RoundSummary,
    StateSnapshot,
    StateUpdate,
)
from app.services.keepalive.policy import decide, health_of
from app.services.keepalive.probes import Probe, build_probes, safe_probe

logger = get_logger(__name__)

_TRUTHY = ("1", "true", "yes", "on", "y")

# 告警 webhook 单次 POST 超时。失败只记日志 —— 告警通道坏了不能反过来影响保活。
_WEBHOOK_TIMEOUT_SECONDS = 10.0


def _env(name: str) -> str | None:
    raw = os.environ.get(name)
    if raw is None:
        return None
    raw = raw.strip()
    return raw or None


def _truthy(raw: str | None) -> bool:
    return raw is not None and raw.lower() in _TRUTHY


def _float_env(name: str, default: float) -> float:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("[keepalive] %s=%r 非法,回落默认值 %s", name, raw, default)
        return default


def _int_env(name: str, default: int) -> int:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return int(float(raw))
    except ValueError:
        logger.warning("[keepalive] %s=%r 非法,回落默认值 %s", name, raw, default)
        return default


@dataclass(frozen=True)
class KeepaliveConfig:
    """运行配置 + **启用理由**。理由不是装饰:"未启用"必须能说出为什么。"""

    enabled: bool
    enabled_reason: str
    interval_hours: float
    policy: PolicyConfig
    alert_webhook: str = ""
    alert_inapp: bool = True
    event_retention_days: int = 90

    def as_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "enabled_reason": self.enabled_reason,
            "interval_hours": self.interval_hours,
            "alert_webhook_configured": bool(self.alert_webhook),
            "alert_inapp": self.alert_inapp,
            "event_retention_days": self.event_retention_days,
            "policy": {
                "retry_max": self.policy.retry_max,
                "retry_base_seconds": self.policy.retry_base_seconds,
                "retry_cap_seconds": self.policy.retry_cap_seconds,
                "alert_after_failures": self.policy.alert_after_failures,
                "alert_repeat_hours": self.policy.alert_repeat_hours,
                "expire_warn_days": self.policy.expire_warn_days,
            },
        }


def _legacy_switch_reason() -> str | None:
    """既有两条线自己的开关。任一为 true ⇒ 视为"用户本来就想保活"。"""
    hits = []
    if _truthy(_env("COOKIE_REFRESH_ENABLED")):
        hits.append("COOKIE_REFRESH_ENABLED=true")
    if _truthy(_env("CHECKIN_CRON_ENABLED")):
        hits.append("CHECKIN_CRON_ENABLED=true")
    return ", ".join(hits) if hits else None


def resolve_config() -> KeepaliveConfig:
    """每次都重新解析(不缓存):改 .env 后下一轮即生效,不必等重启。

    启用优先级:``KEEPALIVE_ENABLED`` 显式值 > 既有开关继承 > 未启用(带理由)。
    未启用时理由里点名三个键 —— 这就是"静默 off"的解药。
    """
    raw = _env("KEEPALIVE_ENABLED")
    if raw is not None:
        enabled = _truthy(raw)
        reason = f"KEEPALIVE_ENABLED={raw}"
    else:
        legacy = _legacy_switch_reason()
        if legacy:
            enabled = True
            reason = f"未设置 KEEPALIVE_ENABLED,按既有开关继承启用({legacy})"
        else:
            enabled = False
            reason = (
                "未启用:未设置 KEEPALIVE_ENABLED,且 COOKIE_REFRESH_ENABLED / "
                "CHECKIN_CRON_ENABLED 均非 true"
            )

    return KeepaliveConfig(
        enabled=enabled,
        enabled_reason=reason,
        interval_hours=max(0.1, _float_env("KEEPALIVE_INTERVAL_HOURS", 6.0)),
        policy=PolicyConfig(
            retry_max=max(0, _int_env("KEEPALIVE_RETRY_MAX", 3)),
            retry_base_seconds=max(1.0, _float_env("KEEPALIVE_RETRY_BASE_SECONDS", 300.0)),
            retry_cap_seconds=max(
                60.0, _float_env("KEEPALIVE_RETRY_CAP_SECONDS", 6 * 3600.0)
            ),
            alert_after_failures=max(1, _int_env("KEEPALIVE_ALERT_AFTER_FAILURES", 3)),
            alert_repeat_hours=max(0.0, _float_env("KEEPALIVE_ALERT_REPEAT_HOURS", 24.0)),
            expire_warn_days=max(0.0, _float_env("KEEPALIVE_EXPIRE_WARN_DAYS", 3.0)),
        ),
        alert_webhook=_env("KEEPALIVE_ALERT_WEBHOOK") or "",
        # 站内信告警默认开:关掉它等于"算出了告警但没有出口"(本模块存在的理由)。
        alert_inapp=_env("KEEPALIVE_ALERT_INAPP") in (None, "")
        or _truthy(_env("KEEPALIVE_ALERT_INAPP")),
        event_retention_days=max(1, _int_env("KEEPALIVE_EVENT_RETENTION_DAYS", 90)),
    )


def snapshot_of(update: StateUpdate) -> StateSnapshot:
    """状态写入后的快照(健康度要按**新**状态算,不是按旧的)。"""
    return StateSnapshot(
        consecutive_failures=update.consecutive_failures,
        last_ok_at=update.last_ok_at,
        last_fail_at=update.last_fail_at,
        expires_at=update.expires_at,
        warned_at=update.warned_at,
        alerted_at=update.alerted_at,
        next_retry_at=update.next_retry_at,
    )


class KeepaliveCenter:
    """统一保活中心(模块级单例 ``keepalive_center``)。"""

    def __init__(self, probes: list[Probe] | None = None) -> None:
        self._probes: list[Probe] = probes if probes is not None else build_probes()
        self._task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._last_round: RoundSummary | None = None
        self._running = False
        self._last_self_check: str = "尚未启动"

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------
    def ensure_started(self) -> None:
        """lifespan 调用(同步)。未启用时**明确打 warning**,不再静默返回。"""
        cfg = resolve_config()
        if not cfg.enabled:
            self._last_self_check = cfg.enabled_reason
            logger.warning("[keepalive] 账号保活未启用 —— %s", cfg.enabled_reason)
            return
        if self._task is not None and not self._task.done():
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            self._last_self_check = "无事件循环,跳过启动(同步上下文)"
            logger.warning("[keepalive] 无运行中的事件循环,保活中心未启动")
            return
        self._task = loop.create_task(self._run_loop(), name="keepalive-center")
        self._last_self_check = cfg.enabled_reason
        logger.info(
            "[keepalive] 保活中心已启动 —— %s,间隔 %s 小时",
            cfg.enabled_reason,
            cfg.interval_hours,
        )

    async def stop(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        self._task = None
        logger.info("[keepalive] 保活中心已停止")

    async def _run_loop(self) -> None:
        while True:
            cfg = resolve_config()
            if not cfg.enabled:
                # 运行中被关掉:不退出、不空转,退到较长的巡检间隔等配置回来。
                logger.warning("[keepalive] 运行中检测到未启用 —— %s", cfg.enabled_reason)
                await asyncio.sleep(300)
                continue
            try:
                summary = await self.run_round()
                await store.prune_events(retention_days=cfg.event_retention_days)
                logger.info(
                    "[keepalive] 本轮完成 total=%s ok=%s failed=%s unsupported=%s "
                    "skipped=%s alerted=%s",
                    summary.total,
                    summary.ok,
                    summary.failed,
                    summary.unsupported,
                    summary.skipped,
                    summary.alerted,
                )
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("[keepalive] 本轮保活异常(不影响下一轮)")
            await asyncio.sleep(cfg.interval_hours * 3600)

    # ------------------------------------------------------------------
    # 一轮
    # ------------------------------------------------------------------
    async def run_round(
        self,
        *,
        owner: str | None = None,
        force: bool = False,
        only_ref: str | None = None,
    ) -> RoundSummary:
        """跑一轮。``owner`` 限属主(用户面触发),``force`` 无视退避。

        两段式:先把"退避中"的账号单独记成 skipped(不探活),剩下的按**探针**分组
        批量执行 —— 批量才有并发。cookie 探活 19 个账号串行实测约 2.5 分钟(单个
        ~8s,其中 7s 是等 cookie 下发的固定等待),并发后压到同量级的 1/4。
        """
        async with self._lock:
            self._running = True
            cfg = resolve_config()
            summary = RoundSummary(started_at=datetime.now(UTC))
            alerts: list[dict[str, Any]] = []
            try:
                plan = await self._collect(owner)
                if only_ref:
                    plan = [(p, r) for p, r in plan if r.ref == only_ref]
                states = await store.fetch_states([r.ref for _p, r in plan])
                now = datetime.now(UTC)

                pending: dict[Probe, list[AccountRef]] = {}
                for probe, ref in plan:
                    snapshot = states.get(ref.ref, StateSnapshot())
                    if not force and snapshot.next_retry_at and snapshot.next_retry_at > now:
                        summary.add(
                            AccountReport(
                                ref=ref.ref,
                                source=ref.source,
                                platform=ref.platform,
                                display=ref.display,
                                outcome=ProbeOutcome(
                                    ok=False,
                                    kind=KIND_SKIPPED,
                                    message=(
                                        "退避中,下次重试 "
                                        f"{snapshot.next_retry_at.isoformat()}"
                                    ),
                                ),
                                action="skipped_backoff",
                                health=health_of(snapshot, now, cfg.policy),
                            )
                        )
                        continue
                    pending.setdefault(probe, []).append(ref)

                for probe, refs in pending.items():
                    outcomes = await self._probe_batch(probe, refs)
                    for ref in refs:
                        outcome = outcomes.get(ref.ref) or ProbeOutcome(
                            ok=False,
                            kind=KIND_ERROR,
                            message="探针未返回结果(内部缺陷)",
                            retryable=True,
                        )
                        snapshot = states.get(ref.ref, StateSnapshot())
                        update = decide(snapshot, outcome, now, cfg.policy)
                        await self._persist(ref, update, outcome)
                        summary.add(
                            AccountReport(
                                ref=ref.ref,
                                source=ref.source,
                                platform=ref.platform,
                                display=ref.display,
                                outcome=outcome,
                                action="probed",
                                health=health_of(snapshot_of(update), now, cfg.policy),
                                attempt=max(1, update.consecutive_failures),
                            )
                        )
                        if update.warn_now:
                            summary.warned += 1
                            logger.warning(
                                "[keepalive] 凭证临期 %s(%s):%s",
                                ref.ref,
                                ref.display or ref.platform,
                                outcome.message,
                            )
                        if update.alert_now:
                            summary.alerted += 1
                            alerts.append(
                                {
                                    "ref": ref.ref,
                                    "owner": ref.owner,
                                    "source": ref.source,
                                    "platform": ref.platform,
                                    "display": ref.display,
                                    "kind": outcome.kind,
                                    "message": outcome.message,
                                    "consecutive_failures": update.consecutive_failures,
                                }
                            )
                            logger.warning(
                                "[keepalive] 连续失败告警 %s(%s) 第 %s 次:%s",
                                ref.ref,
                                ref.display or ref.platform,
                                update.consecutive_failures,
                                outcome.message,
                            )

                summary.finished_at = datetime.now(UTC)
                self._last_round = summary
                if alerts:
                    await self._post_alerts(cfg, alerts)
                    if cfg.alert_inapp:
                        await publish_inapp_alerts(alerts)
                return summary
            finally:
                self._running = False

    async def _probe_batch(
        self, probe: Probe, refs: list[AccountRef]
    ) -> dict[str, ProbeOutcome]:
        """批量探活:探针支持 ``probe_many`` 就走批量(并发),否则逐个(仍有隔离)。

        批量失败时**退回逐个**而不是整批记失败 —— 否则"批量调度坏了一个字符"
        会被记成"N 个账号同时挂了",把真问题藏起来。
        """
        many = getattr(probe, "probe_many", None)
        if callable(many):
            try:
                result = await many(refs)
                if isinstance(result, dict):
                    return result
                logger.warning(
                    "[keepalive] probe_many 返回类型非 dict(%s),退回逐个", type(result)
                )
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception(
                    "[keepalive] 批量探活失败 source=%s,退回逐个", probe.source
                )
        return {ref.ref: await safe_probe(probe, ref) for ref in refs}

    async def _collect(self, owner: str | None) -> list[tuple[Probe, AccountRef]]:
        """问每个探针要账号列表。单个探针炸了不影响其他来源。"""
        plan: list[tuple[Probe, AccountRef]] = []
        for probe in self._probes:
            try:
                accounts = await probe.list_accounts(owner)
            except Exception:
                logger.exception("[keepalive] 列账号失败 source=%s(跳过该来源)", probe.source)
                continue
            plan.extend((probe, ref) for ref in accounts)
        return plan

    async def _persist(
        self, ref: AccountRef, update: StateUpdate, outcome: ProbeOutcome
    ) -> None:
        """落状态 + 流水。**失败不阻断本轮** —— 记账坏了不该让保活停摆。"""
        try:
            await store.upsert_state(
                ref=ref.ref,
                source=ref.source,
                account_id=ref.account_id,
                owner=ref.owner,
                display=ref.display,
                platform=ref.platform,
                update=update,
            )
            await store.record_event(
                ref=ref.ref,
                source=ref.source,
                owner=ref.owner,
                outcome=outcome,
                attempt=max(1, update.consecutive_failures),
            )
        except Exception:
            logger.exception("[keepalive] 落库失败 %s(保活结论不受影响)", ref.ref)

    async def _post_alerts(
        self, cfg: KeepaliveConfig, alerts: list[dict[str, Any]]
    ) -> None:
        """可选 webhook。没配就只留日志与流水 —— 绝不因为没配而假装"已通知"。"""
        if not cfg.alert_webhook:
            return
        try:
            import httpx

            async with httpx.AsyncClient(timeout=_WEBHOOK_TIMEOUT_SECONDS) as client:
                await client.post(
                    cfg.alert_webhook,
                    json={"source": "keepalive-center", "alerts": alerts},
                )
        except Exception as e:  # noqa: BLE001
            logger.warning("[keepalive] 告警 webhook 投递失败(不影响保活): %s", e)

    # ------------------------------------------------------------------
    # 只读状态(自检面)
    # ------------------------------------------------------------------
    def status(self) -> dict[str, Any]:
        cfg = resolve_config()
        task_alive = self._task is not None and not self._task.done()
        last = self._last_round
        return {
            "config": cfg.as_dict(),
            "self_check": self._last_self_check,
            "running": self._running,
            "scheduler_alive": task_alive,
            "probes": [getattr(p, "source", type(p).__name__) for p in self._probes],
            "last_round": last.as_dict() if last else None,
            "next_run_eta_hours": cfg.interval_hours if task_alive else None,
        }


# 模块级单例
keepalive_center = KeepaliveCenter()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

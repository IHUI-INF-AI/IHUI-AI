# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手每日调度器(Phase1b,2026-10-03 立)。

非 Qoder 账号每日 08:05(Asia/Shanghai)、Qoder 账号每日 10:05,分别遍历
enabled 账号逐个执行(平台分发引擎),结果落 checkin_records;错误按引擎
classify_error 的分类驱动冷却累积。

Qoder 独立 10:05 窗口的原因:官方领取活动每日 10:00(UTC+8)才开放
(docs.qoder.com/events/100credits),08:05 跑必然「活动未下发」且当天
不再重试 ⇒ 主 job 排除 qoder 账号(partition_platforms 拆分)。

冷却累积语义(与桌面端 auto_checkin.py 一致,引擎 docstring 明确要求):
- classified_error.type == "Server" → server_errors + 1;
  计数 < 3 只记错误不冷却;计数 ≥ 3 触发冷却(时长用引擎给的
  cooldown_seconds;-1 视为永久)并清零该计数;
- type == "Client" → client_errors 独立同规则累积;
- 其他类型(Unknown 等)不动计数;
- 签到成功 → 两类计数全部清零;
- 冷却中的账号(最近一次记录 cooldown_until > now)每日任务跳过。

挂载方式与 news_scheduler / ab_test_scheduler 一致:lifespan 启动时
await checkin_scheduler.start()(由 CHECKIN_CRON_ENABLED 控制开关,默认
false),shutdown steps 里 await stop()。status() 供
GET /api/checkin/scheduler/status 只读暴露运行状态(Phase1c)。
"""

from __future__ import annotations

import asyncio
import json
import os
import random
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.logging import get_logger
from app.services import (
    checkin_credits,
    checkin_minimax,
    checkin_proxy_pool,
    checkin_qoder,
    checkin_store,
    checkin_workbuddy,
)
from app.services.checkin_engine import client_for
from app.services.checkin_outbound import OutboundPaused, checkin_outbound_gate

_BATCH_JITTER_MIN = float(os.environ.get("CHECKIN_BATCH_JITTER_MIN", "8"))
_BATCH_JITTER_MAX = float(os.environ.get("CHECKIN_BATCH_JITTER_MAX", "45"))
from app.services.checkin_engine import checkin_account

logger = get_logger(__name__)

# 每日签到时刻:08:05 Asia/Shanghai(用 zoneinfo;APScheduler 3.x 接受 stdlib tzinfo)
# 积分快照 job 错开到 08:10(避开签到 job 的整轮网络窗口)
_CN_TZ = ZoneInfo("Asia/Shanghai")

# Server / Client 错误触发冷却的连击阈值(与桌面端一致)
_ERROR_COOLDOWN_THRESHOLD = 3

# 永久冷却(SessionDead,cooldown_seconds == -1)的落地时长:10 年
_PERMANENT_COOLDOWN_DAYS = 3650

_JOB_ID = "checkin_daily"
_CREDITS_JOB_ID = "checkin_credits_daily"
# 平台化(2026-10-10):Qoder 领取窗口每日 10:00(UTC+8)才开放(官方 docs.qoder.com
# /events/100credits),08:05 主 job 对 Qoder 账号必然「活动未下发」且当天不再重试
# ⇒ Qoder 账号独立 10:05 job,主 job 排除 qoder 账号。
_JOB_ID_QODER = "checkin_daily_qoder"

# 日级起批漂移(2026-10-16 风控第四件套):CronTrigger jitter = uniform(0, jitter)
# 加到触发时刻,每天起批时间在窗口内随机(08:05~08:12 / 10:05~10:10 / 08:10~08:15),
# 消除「每天同一秒起批」的机器信号(env CHECKIN_CRON_JITTER 可调,0 关闭)。
_CRON_JITTER = int(os.environ.get("CHECKIN_CRON_JITTER", "420"))


class RateLimitedError(RuntimeError):
    """平台限流/出站全局暂停中:手动入口映射 HTTP 429,调用方应立刻停手。"""

    def __init__(self, message: str, remaining: float = 0.0) -> None:
        self.remaining = remaining
        super().__init__(message)


class CooldownActiveError(RuntimeError):
    """账号处于冷却期:手动入口映射 HTTP 429(尊重冷却,不给绕过口子)。"""

    def __init__(self, account_name: str, until: datetime) -> None:
        self.until = until
        remaining = max(0.0, (until - datetime.now(UTC)).total_seconds())
        super().__init__(
            f"账号 {account_name} 处于冷却期, {remaining:.0f}s 后解冻({until.isoformat()})"
        )


def partition_platforms(
    accounts: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """按平台拆分账号列表,返回 (非 qoder 走 08:05 主窗口, qoder 走 10:05 窗口)。

    platform 缺失按 'trae' 处理(存量账号语义,与 store 默认列值一致)。
    workbuddy 随主窗口跑(2026-10-12:Buddy 加油站每日 00:00(UTC+8)后随时
    可领,无需独立窗口;引擎分发在 checkin_one 按 platform 进行)。纯函数。
    """
    main_side: list[dict[str, Any]] = []
    qoder_side: list[dict[str, Any]] = []
    for acc in accounts:
        if acc.get("platform") == "qoder":
            qoder_side.append(acc)
        else:
            main_side.append(acc)
    return main_side, qoder_side


def _cooldown_end(cooldown_seconds: int | None) -> datetime | None:
    """由引擎给的 cooldown_seconds 计算冷却结束时刻。0/None → 不冷却(None)。"""
    if not cooldown_seconds or cooldown_seconds <= 0:
        if cooldown_seconds is not None and cooldown_seconds < 0:
            return datetime.now(UTC) + timedelta(days=_PERMANENT_COOLDOWN_DAYS)
        return None
    return datetime.now(UTC) + timedelta(seconds=cooldown_seconds)


def _cron_enabled() -> bool:
    """CHECKIN_CRON_ENABLED 是否为 "true";start() 与 status() 共用同一读取,防漂移。"""
    return os.environ.get("CHECKIN_CRON_ENABLED", "false").lower() == "true"


class CheckinScheduler:
    """签到助手每日调度器(单例)。"""

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._started: bool = False

    # ===== 启停(lifespan 钩子) =====

    async def start(self) -> None:
        """启动每日 08:05(非 Qoder)/10:05(Qoder)定时任务(CHECKIN_CRON_ENABLED
        控制两个 job,默认 false)。

        建表 fail-open:表建不出来时只告警,不阻塞主服务启动。
        """
        if self._started:
            return
        enabled = _cron_enabled()
        if not enabled:
            logger.info("[checkin_scheduler] CHECKIN_CRON_ENABLED=false, 不启动每日签到调度")
            return
        try:
            await checkin_store.ensure_tables()
        except Exception as e:
            logger.warning("[checkin_scheduler] 签到建表异常(忽略,签到功能不可用): %s", e)
            return
        self._scheduler = AsyncIOScheduler(timezone=_CN_TZ)
        self._scheduler.add_job(
            self._daily_run,
            trigger=CronTrigger(hour=8, minute=5, timezone=_CN_TZ, jitter=_CRON_JITTER),
            id=_JOB_ID,
            replace_existing=True,
        )
        self._scheduler.add_job(
            self._daily_run_qoder,
            trigger=CronTrigger(hour=10, minute=5, timezone=_CN_TZ, jitter=_CRON_JITTER),
            id=_JOB_ID_QODER,
            replace_existing=True,
        )
        # WP-B(2026-10-09):每日积分快照 job,与签到 job 同一启用开关
        self._scheduler.add_job(
            self._daily_credits_snapshot,
            trigger=CronTrigger(hour=8, minute=10, timezone=_CN_TZ, jitter=_CRON_JITTER),
            id=_CREDITS_JOB_ID,
            replace_existing=True,
        )
        self._scheduler.start()
        self._started = True
        logger.info(
            "[checkin_scheduler] 已启动每日调度(08:05 签到 / 10:05 Qoder 签到 / 08:10 积分快照,起批漂移 ≤%ds)",
            _CRON_JITTER,
        )

    async def stop(self) -> None:
        if not self._started:
            return
        if self._scheduler is not None:
            try:
                self._scheduler.shutdown(wait=False)
            except Exception as e:
                logger.warning("[checkin_scheduler] shutdown 失败(忽略): %s", e)
        self._scheduler = None
        self._started = False

    def status(self) -> dict[str, Any]:
        """运行状态(公开只读视图,供 GET /api/checkin/scheduler/status)。

        enabled 与 start() 读同一环境变量(_cron_enabled 单一来源);started
        为本单例是否已 start;next_run / next_run_qoder 仅已启动时有值
        (APScheduler job 的 next_run_time,带 Asia/Shanghai 时区的 ISO8601),
        未启动为 None。
        """
        next_run: str | None = None
        next_run_qoder: str | None = None
        if self._started and self._scheduler is not None:
            job = self._scheduler.get_job(_JOB_ID)
            if job is not None:
                # apscheduler 无 py.typed ⇒ job 是 Any;next_run_time 钉真类型,
                # isoformat 的产出才有 str 看守(同 checkin_store :269 的钉法)。
                next_run_time: datetime | None = job.next_run_time
                next_run = next_run_time.isoformat() if next_run_time is not None else None
            job_q = self._scheduler.get_job(_JOB_ID_QODER)
            if job_q is not None:
                next_run_time_q: datetime | None = job_q.next_run_time
                next_run_qoder = (
                    next_run_time_q.isoformat() if next_run_time_q is not None else None
                )
        return {
            "enabled": _cron_enabled(),
            "started": self._started,
            "next_run": next_run,
            "next_run_qoder": next_run_qoder,
        }

    # ===== 每日任务 =====

    async def _load_accounts_and_cooldowns(
        self, label: str
    ) -> tuple[list[dict[str, Any]], dict[int, datetime]] | None:
        """读取 enabled 账号与活跃冷却;账号读失败返回 None(本轮放弃)。"""
        try:
            accounts = await checkin_store.list_enabled_accounts()
        except Exception as e:
            logger.warning("[checkin_scheduler] 读取签到账号失败(%s 本轮放弃): %s", label, e)
            return None
        try:
            cooldowns = await checkin_store.get_active_cooldowns()
        except Exception as e:
            logger.warning("[checkin_scheduler] 读取冷却状态失败(按无冷却处理): %s", e)
            cooldowns = {}
        return accounts, cooldowns

    async def _run_batch(
        self,
        accounts: list[dict[str, Any]],
        cooldowns: dict[int, datetime],
        label: str,
    ) -> None:
        """遍历账号逐个签到;冷却中的账号跳过。单账号失败不中断整轮。

        多账号风控三件套之三:错峰——批内账号顺序随机打散,账号之间随机
        间隔(默认 8~45s,环境变量 CHECKIN_BATCH_JITTER_MIN/MAX 可调),
        消除"所有账号同一秒签到"的机器信号,使批量签到的时间模式与
        多个真人各自操作无法区分。
        """
        now = datetime.now(UTC)
        ok_count = 0
        shuffled = list(accounts)
        random.shuffle(shuffled)
        accounts = shuffled
        _seen_any = False
        for acc in accounts:
            cd_end = cooldowns.get(acc["id"])
            if cd_end is not None and cd_end > now:
                logger.info(
                    "[checkin_scheduler] 账号冷却中跳过",
                    account=acc["name"],
                    until=cd_end.isoformat(),
                )
                continue
            if _seen_any:
                delay = random.uniform(_BATCH_JITTER_MIN, _BATCH_JITTER_MAX)
                logger.info(
                    "[checkin_scheduler] 错峰延迟 %.0fs 后签到", delay, account=acc.get("name")
                )
                await asyncio.sleep(delay)
            _seen_any = True
            try:
                result = await self.checkin_one(acc)
                await self.record_result(acc["id"], result)
                if result.get("ok"):
                    ok_count += 1
            except OutboundPaused as e:
                # 风控铁律:平台限流全局暂停中,整批立即中止(绝不换个账号继续打)
                logger.warning(
                    "[checkin_scheduler] %s出站限流暂停中(剩 %.0fs),整批中止: 共 %d 个账号,已签 %d",
                    label,
                    e.remaining,
                    len(accounts),
                    ok_count,
                )
                break
            except Exception as e:
                logger.warning(
                    "[checkin_scheduler] 账号 %s 签到异常(继续下一个): %s", acc.get("name"), e
                )
        logger.info(
            "[checkin_scheduler] %s本轮签到完成: 共 %d 个账号,成功 %d", label, len(accounts), ok_count
        )

    async def _daily_run(self) -> None:
        """08:05 主窗口:遍历非 Qoder 账号(Qoder 账号走 10:05 独立窗口)。"""
        loaded = await self._load_accounts_and_cooldowns("主窗口")
        if loaded is None:
            return
        main_side, _ = partition_platforms(loaded[0])
        await self._run_batch(main_side, loaded[1], "主窗口")

    async def _daily_run_qoder(self) -> None:
        """10:05 Qoder 窗口:官方领取活动每日 10:00(UTC+8)开放,08:05 跑必然空手。"""
        loaded = await self._load_accounts_and_cooldowns("Qoder窗口")
        if loaded is None:
            return
        _, qoder_side = partition_platforms(loaded[0])
        await self._run_batch(qoder_side, loaded[1], "Qoder窗口")

    async def _daily_credits_snapshot(self) -> None:
        """每日积分快照:遍历 enabled 账号逐个查余额并 upsert 当日快照。

        单账号失败(网络/解析/落库)只告警不中断整轮;收尾一行汇总日志。

        风控第五件套配套(2026-10-16):**跳过活跃冷却中的账号**。401 死号
        (SessionDead=10 年冷却)此前每天仍被查一次余额 = 天天拿死 token 打
        平台鉴权点,是最典型的封号前兆信号;SoftRate/PlanLimit 等即时冷却
        同理。快照缺一天只是趋势数据少一格,死打鉴权点是无谓风险。
        """
        try:
            accounts = await checkin_store.list_enabled_accounts_full()
        except Exception as e:
            logger.warning("[checkin_scheduler] 读取签到账号失败(积分快照本轮放弃): %s", e)
            return
        try:
            cooldowns = await checkin_store.get_active_cooldowns()
        except Exception as e:
            logger.warning("[checkin_scheduler] 读取冷却状态失败(按无冷却处理): %s", e)
            cooldowns = {}
        day = datetime.now(_CN_TZ).date().isoformat()
        ok_count = 0
        fail_count = 0
        skip_count = 0
        for acc in accounts:
            cd_end = cooldowns.get(acc["id"])
            if cd_end is not None and cd_end > datetime.now(UTC):
                skip_count += 1
                logger.info(
                    "[checkin_scheduler] 账号冷却中跳过积分查询",
                    account=acc["name"],
                    until=cd_end.isoformat(),
                )
                continue
            try:
                if acc.get("platform") == "qoder":
                    device_map = dict(acc.get("device_map") or {})
                    result = await checkin_qoder.qoder_query_credits(acc["jwt"], device_map)
                    # 401→refresh 会写回 device_map(新 token),落库持久化
                    try:
                        await checkin_store.save_device_map(acc["id"], device_map)
                    except Exception as e:
                        logger.warning("[checkin_scheduler] device_map 写回失败(忽略): %s", e)
                elif acc.get("platform") == "workbuddy":
                    wb_dm = dict(acc.get("device_map") or {})
                    result = await checkin_workbuddy.workbuddy_query_credits(acc["jwt"], wb_dm)
                else:
                    result = await checkin_credits.query_remaining_credits(acc["jwt"])
                if result.get("error") is not None or not isinstance(
                    result.get("remaining"), int
                ):
                    fail_count += 1
                    logger.warning(
                        "[checkin_scheduler] 账号 %s 积分查询失败: %s",
                        acc.get("name"),
                        result.get("error"),
                    )
                    continue
                gained = await checkin_store.sum_credits_delta_for_day(
                    acc["id"], acc["owner_user_id"], day
                )
                await checkin_store.upsert_credits_daily(
                    acc["id"], acc["owner_user_id"], day, result["remaining"], gained
                )
                ok_count += 1
            except OutboundPaused as e:
                # 平台限流全局暂停中:查询也会被闸门拒绝,整批中止(不空转刷警告)
                logger.warning(
                    "[checkin_scheduler] 出站限流暂停中(剩 %.0fs),积分快照整批中止: 已完成 %d,失败 %d",
                    e.remaining,
                    ok_count,
                    fail_count,
                )
                break
            except Exception as e:
                fail_count += 1
                logger.warning(
                    "[checkin_scheduler] 账号 %s 积分快照异常(继续下一个): %s", acc.get("name"), e
                )
        logger.info(
            "[checkin_scheduler] 本轮积分快照完成: 共 %d 个账号,成功 %d,失败 %d,冷却跳过 %d",
            len(accounts),
            ok_count,
            fail_count,
            skip_count,
        )

    # ===== 单账号执行 =====

    async def checkin_one(self, account: dict[str, Any]) -> dict[str, Any]:
        """对单个账号执行签到(按 platform 分发引擎),并把引擎可能补齐的
        device_map 写回存储(Qoder 的自刷新新 token 也经此通路落库)。"""
        device_map = dict(account.get("device_map") or {})
        platform = account.get("platform")
        # 多账号风控三件套之二:device_map.proxy 绑定独立出口 IP,
        # 有代理的账号全程走自己的 client(用完即关),无代理本机直连零变化。
        # 免费代理池自动分配(默认关;CHECKIN_FREE_PROXY_POOL=1 开):多账号自动绑独立出口
        if os.environ.get("CHECKIN_FREE_PROXY_POOL") == "1":
            try:
                await checkin_proxy_pool.ensure_proxy(device_map)
            except Exception as e:
                logger.warning("[checkin_scheduler] 免费代理分配失败(直连兜底): %s", e)
        client, owned = client_for(device_map)
        try:
            if platform == "qoder":
                result = await checkin_qoder.qoder_checkin_account(
                    account["name"], account["jwt"], device_map, client=client
                )
            elif platform == "workbuddy":
                # WorkBuddy 每日 00:00(UTC+8)后随时可领,随 08:05 主窗口跑
                result = await checkin_workbuddy.workbuddy_checkin_account(
                    account["name"], account["jwt"], device_map, client=client
                )
            elif platform == "minimax":
                # MiniMax 每日随时可领(幂等),随 08:05 主窗口跑
                result = await checkin_minimax.minimax_checkin_account(
                    account["name"], account["jwt"], device_map, client=client
                )
            else:
                result = await checkin_account(
                    account["name"], account["jwt"], device_map, client=client
                )
        finally:
            if owned:
                await client.aclose()
        try:
            await checkin_store.save_device_map(account["id"], device_map)
        except Exception as e:
            logger.warning("[checkin_scheduler] device_map 写回失败(忽略): %s", e)
        return result

    async def record_result(self, account_id: int, result: dict[str, Any]) -> dict[str, Any]:
        """引擎结果 → checkin_records + 冷却累积语义(见模块 docstring)。

        冷却缺口修复(2026-10-16):引擎 classify_error 给出的非计数类分类
        (SessionDead=-1 永久 / SoftRate=60s / PlanLimit=12h / NotFound /
        BusinessError)此前只进 records 的 classified_error,cooldown_until 恒为
        None ⇒ 401 死号每天仍被调度重打、429 后账号照样秒重试。此档按引擎
        cooldown_seconds **立即落冷却**(0/None 不冷却),与 Server/Client 的
        三连击档并行不冲突。SoftRate 另触发出站全局暂停(被限流就立刻停手)。
        """
        classified = result.get("classified_error")
        cooldown_until: datetime | None = None
        if classified:
            etype = classified.get("type")
            secs = classified.get("cooldown_seconds")
            if etype == "Server":
                count = await checkin_store.bump_error_count(account_id, "server_errors")
                if count >= _ERROR_COOLDOWN_THRESHOLD:
                    cooldown_until = _cooldown_end(secs)
                    await checkin_store.reset_error_count(account_id, "server_errors")
                    logger.warning(
                        "[checkin_scheduler] Server 错误连击 %d,触发冷却至 %s",
                        count,
                        cooldown_until.isoformat() if cooldown_until else "-",
                    )
            elif etype == "Client":
                count = await checkin_store.bump_error_count(account_id, "client_errors")
                if count >= _ERROR_COOLDOWN_THRESHOLD:
                    cooldown_until = _cooldown_end(secs)
                    await checkin_store.reset_error_count(account_id, "client_errors")
                    logger.warning(
                        "[checkin_scheduler] Client 错误连击 %d,触发冷却至 %s",
                        count,
                        cooldown_until.isoformat() if cooldown_until else "-",
                    )
            else:
                # 非计数类分类:立即按引擎给的时长冷却(-1 永久 → 10 年,0 不冷却)
                cooldown_until = _cooldown_end(secs if isinstance(secs, int) else 0)
                if cooldown_until is not None:
                    logger.warning(
                        "[checkin_scheduler] %s 触发即时冷却至 %s",
                        str(etype),
                        cooldown_until.isoformat(),
                    )
            if etype in ("SoftRate", "Challenge"):
                # 平台已回 429 / 挑战页拦截:全局暂停出站,整批/后续手动立即停手
                # (Challenge 分支 = 第五件套,2026-10-16:403 经 classify 落 Challenge
                #  的账号在此触持续暂停,与解析点 note_challenge 双保险不冲突——
                #  pause() 取更晚截止,叠加只会更晚,不会更早)
                checkin_outbound_gate.pause(reason=f"account {account_id} {etype}")
        code = result.get("code")
        record = await checkin_store.insert_record(
            account_id,
            ok=result.get("ok"),
            action=result.get("action"),
            http_status=result.get("http_status"),
            code=str(code) if code is not None else None,
            message=result.get("message"),
            classified_error=json.dumps(classified, ensure_ascii=False) if classified else None,
            cooldown_until=cooldown_until,
            credits=result.get("credits") if isinstance(result.get("credits"), int) else None,
            credits_delta=result.get("credits_delta")
            if isinstance(result.get("credits_delta"), int)
            else None,
        )
        if result.get("ok"):
            await checkin_store.reset_all_error_counts(account_id)
        return record

    # ===== 手动触发 =====

    async def run_checkin_now(self, account_id: int, owner_user_id: str) -> dict[str, Any]:
        """手动签到:尊重冷却与全局限流(2026-10-16 风控加固,原「无视冷却」废止)。

        - 出站全局暂停中(平台回过 429)→ RateLimitedError,路由映射 429 快速失败;
        - 账号仍在冷却期 → CooldownActiveError,路由映射 429(手动不给绕过冷却的
          后门:401 死号/429 限流账号被手动连点只会把风险放大到同 IP 全部账号);
        - 结果照写 records(冷却计数语义照常累积)。
        """
        remaining = checkin_outbound_gate.paused_remaining()
        if remaining > 0:
            raise RateLimitedError(
                f"签到接口限流冷却中({remaining:.0f}s),请稍后再试", remaining=remaining
            )
        account = await checkin_store.get_decrypted_jwt(account_id, owner_user_id)
        if account is None:
            raise LookupError(f"账号不存在: {account_id}")
        try:
            cooldowns = await checkin_store.get_active_cooldowns()
        except Exception as e:
            logger.warning("[checkin_scheduler] 手动签到读冷却状态失败(按无冷却放行): %s", e)
            cooldowns = {}
        cd_end = cooldowns.get(account_id)
        if cd_end is not None and cd_end > datetime.now(UTC):
            raise CooldownActiveError(str(account.get("name") or account_id), cd_end)
        try:
            result = await self.checkin_one(account)
        except OutboundPaused as e:
            raise RateLimitedError(
                f"签到接口限流冷却中({e.remaining:.0f}s),请稍后再试", remaining=e.remaining
            ) from e
        return await self.record_result(account_id, result)


checkin_scheduler = CheckinScheduler()
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

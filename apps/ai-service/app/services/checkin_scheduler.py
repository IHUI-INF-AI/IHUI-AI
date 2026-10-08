# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手每日调度器(Phase1b,2026-10-03 立)。

每日 08:05(Asia/Shanghai)遍历 enabled 账号逐个执行 checkin_account,
结果落 checkin_records;错误按引擎 classify_error 的分类驱动冷却累积。

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

import json
import os
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.logging import get_logger
from app.services import checkin_store
from app.services.checkin_engine import checkin_account

logger = get_logger(__name__)

# 每日签到时刻:08:05 Asia/Shanghai(用 zoneinfo;APScheduler 3.x 接受 stdlib tzinfo)
_CN_TZ = ZoneInfo("Asia/Shanghai")

# Server / Client 错误触发冷却的连击阈值(与桌面端一致)
_ERROR_COOLDOWN_THRESHOLD = 3

# 永久冷却(SessionDead,cooldown_seconds == -1)的落地时长:10 年
_PERMANENT_COOLDOWN_DAYS = 3650

_JOB_ID = "checkin_daily"


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
        """启动每日 08:05 定时任务(CHECKIN_CRON_ENABLED 控制,默认 false)。

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
            trigger=CronTrigger(hour=8, minute=5, timezone=_CN_TZ),
            id=_JOB_ID,
            replace_existing=True,
        )
        self._scheduler.start()
        self._started = True
        logger.info("[checkin_scheduler] 已启动每日签到调度(08:05 Asia/Shanghai)")

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
        为本单例是否已 start;next_run 仅已启动时有值(APScheduler job 的
        next_run_time,带 Asia/Shanghai 时区的 ISO8601),未启动为 None。
        """
        next_run: str | None = None
        if self._started and self._scheduler is not None:
            job = self._scheduler.get_job(_JOB_ID)
            if job is not None:
                # apscheduler 无 py.typed ⇒ job 是 Any;next_run_time 钉真类型,
                # isoformat 的产出才有 str 看守(同 checkin_store :269 的钉法)。
                next_run_time: datetime | None = job.next_run_time
                next_run = next_run_time.isoformat() if next_run_time is not None else None
        return {"enabled": _cron_enabled(), "started": self._started, "next_run": next_run}

    # ===== 每日任务 =====

    async def _daily_run(self) -> None:
        """遍历 enabled 账号逐个签到;冷却中的账号跳过。单账号失败不中断整轮。"""
        try:
            accounts = await checkin_store.list_enabled_accounts()
        except Exception as e:
            logger.warning("[checkin_scheduler] 读取签到账号失败(本轮放弃): %s", e)
            return
        try:
            cooldowns = await checkin_store.get_active_cooldowns()
        except Exception as e:
            logger.warning("[checkin_scheduler] 读取冷却状态失败(按无冷却处理): %s", e)
            cooldowns = {}
        now = datetime.now(UTC)
        ok_count = 0
        for acc in accounts:
            cd_end = cooldowns.get(acc["id"])
            if cd_end is not None and cd_end > now:
                logger.info(
                    "[checkin_scheduler] 账号冷却中跳过",
                    account=acc["name"],
                    until=cd_end.isoformat(),
                )
                continue
            try:
                result = await self.checkin_one(acc)
                await self.record_result(acc["id"], result)
                if result.get("ok"):
                    ok_count += 1
            except Exception as e:
                logger.warning(
                    "[checkin_scheduler] 账号 %s 签到异常(继续下一个): %s", acc.get("name"), e
                )
        logger.info("[checkin_scheduler] 本轮签到完成: 共 %d 个账号,成功 %d", len(accounts), ok_count)

    # ===== 单账号执行 =====

    async def checkin_one(self, account: dict[str, Any]) -> dict[str, Any]:
        """对单个账号执行 checkin_account,并把引擎可能补齐的 device_map 写回存储。"""
        device_map = dict(account.get("device_map") or {})
        result = await checkin_account(account["name"], account["jwt"], device_map)
        try:
            await checkin_store.save_device_map(account["id"], device_map)
        except Exception as e:
            logger.warning("[checkin_scheduler] device_map 写回失败(忽略): %s", e)
        return result

    async def record_result(self, account_id: int, result: dict[str, Any]) -> dict[str, Any]:
        """引擎结果 → checkin_records + 冷却累积语义(见模块 docstring)。"""
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
        """手动签到:无视冷却,结果照写 records(冷却计数语义照常累积)。"""
        account = await checkin_store.get_decrypted_jwt(account_id, owner_user_id)
        if account is None:
            raise LookupError(f"账号不存在: {account_id}")
        result = await self.checkin_one(account)
        return await self.record_result(account_id, result)


checkin_scheduler = CheckinScheduler()
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

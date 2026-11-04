# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手每日调度器(Phase1b,2026-10-03 立)。

非 Qoder 账号每日 00:05 与 08:05(Asia/Shanghai,2026-11-04 补零点窗口)、
Qoder 账号每日 10:05,分别遍历 enabled 账号逐个执行(平台分发引擎),结果落
checkin_records;错误按引擎 classify_error 的分类驱动冷却累积。08:05 保留为
兜底:零点跑若撞上平台尚未重置(假 skip_already),主窗口会再补一次。

Qoder 独立 10:05 窗口的原因:官方领取活动每日 10:00(UTC+8)才开放
(docs.qoder.com/events/100credits),08:05 跑必然「活动未下发」且当天
不再重试 ⇒ 主 job 排除 qoder 账号(partition_platforms 拆分)。

Qoder 补跑轮(2026-11-01 立):活动是 10:00 之后**异步下发**,10:05 单跑一次
会整池空手(当日 10:07 全池 8 个号一致「活动未下发或已结束」,12:53 同票同 uid
已是 CLAIMABLE)⇒ 按 CHECKIN_QODER_RETRY_TIMES(默认 11:00 / 12:30)再跑几轮,
只挑「今日还没有确定结果」的号,风控语义不放松(见 _daily_run_qoder_retry)。

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
from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.logging import get_logger
from app.services import (
    checkin_credits,
    checkin_minimax,
    checkin_pool_writeback,
    checkin_proxy_pool,
    checkin_qoder,
    checkin_store,
    checkin_workbuddy,
    checkin_workbuddy_local,
    workbuddy_tasks,
)
from app.services.checkin_engine import client_for, status_check
from app.services.checkin_outbound import (
    OutboundPaused,
    challenge_pause_seconds,
    checkin_outbound_gate,
    rate_limit_pause_seconds,
)

_BATCH_JITTER_MIN = float(os.environ.get("CHECKIN_BATCH_JITTER_MIN", "8"))
_BATCH_JITTER_MAX = float(os.environ.get("CHECKIN_BATCH_JITTER_MAX", "45"))
# WorkBuddy 本机重抽节流:失败/无效时至少隔这么久再拉起一次无头 Chrome
_WB_EXTRACT_INTERVAL_SECONDS = float(os.environ.get("CHECKIN_WB_EXTRACT_INTERVAL_SECONDS", "1800"))
# WorkBuddy 客户端内存令牌扫描节流(默认 6h;一次约 5s,只在临期时触发)
_WB_MEMORY_SCAN_INTERVAL_SECONDS = float(
    os.environ.get("CHECKIN_WB_MEMORY_SCAN_SECONDS", "21600")
)
# Bearer 剩余有效期低于该值才去客户端内存里捞新令牌(28 天票,提前 7 天足够)
_WB_TOKEN_REFRESH_AHEAD_HOURS = 24 * 7
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
# 零点窗口(2026-11-04 立):部分平台本地 0 点就刷新当日额度(WorkBuddy 00:00
# UTC+8 后可领),等 08:05 等于白晚 8 小时。新增 00:05 job 复用 _daily_run
# (partition_platforms 已把 Qoder 拆走,不会撞 10:00 窗口);08:05 主窗口保留
# 当兜底,两者都不做「今日已结算就跳过」过滤(假 skip_already 会永久挡掉当天真签到)。
_JOB_ID_MIDNIGHT = "checkin_daily_midnight"
_CREDITS_JOB_ID = "checkin_credits_daily"
# 平台化(2026-10-10):Qoder 领取窗口每日 10:00(UTC+8)才开放(官方 docs.qoder.com
# /events/100credits),08:05 主 job 对 Qoder 账号必然「活动未下发」且当天不再重试
# ⇒ Qoder 账号独立 10:05 job,主 job 排除 qoder 账号。
_JOB_ID_QODER = "checkin_daily_qoder"
# Qoder 补跑轮(2026-11-01 立,实证见下):10:05 主窗口每天只跑一次,**活动下发晚
# 的那天整池空手** —— 上游并非 10:00 准点下发,而是 10:00 之后异步下发,时刻不可
# 预期。2026-11-01 实测:10:07 全池 8 个号一致返回「活动未下发或已结束」;12:53
# 用同一张票、同一个 uid 重查已是 CLAIMABLE(票没坏、号没废,纯粹是跑早了)。
# 结论:Qoder 腿需要「只补今日还没有确定结果的号」的补跑轮,时刻由
# CHECKIN_QODER_RETRY_TIMES 给(默认 11:00 / 12:30)。
_JOB_ID_QODER_RETRY = "checkin_daily_qoder_retry"
# 补跑时刻默认值:11:00 覆盖"下发比 10:05 晚一小时"的常见情形;12:30 覆盖
# 2026-11-01 那种"12:53 才可领"的晚下发,同时仍在当日(不跨天、不占用次日额度)。
_QODER_RETRY_DEFAULT_TIMES = "11:00,12:30"
# 单轮补跑账号上限:异常数据(号池被灌进几千个 qoder 号)不得把上游一轮打爆;
# 超出的留给下一个补跑时刻,而不是放宽风控去追。
_QODER_RETRY_MAX_PER_ROUND = 200
# 状态探针(2026-10-16 李总需求):每日 06:00 先把平台侧「今日已签到」同步落库
# —— 半夜 0 点平台重置后用户常已在对应程序里手动签完,等 08:05 主窗口才落
# 记录 = UI 一早上都亮着可点按钮。探针只读不 claim,未签账号不落任何记录。
_JOB_ID_PROBE = "checkin_daily_status_probe"
# 本机客户端凭据同步(2026-10-24 立):第三方 access token 由客户端签发并自动刷新;
# 客户端与 ai-service 同机时,直接取客户端刷新后的凭据写回,客户端登录在 ⇒ 平台侧不过期。
_JOB_ID_LOCAL_SYNC = "checkin_local_creds_sync"
# O68 WorkBuddy 任务赚积分巡检(2026-10-29 立):四族 growth/travel/activity/blackcat,
# 双门控 WORKBUDDY_TASKS_ENABLED(节拍开关,默认 off)+ WORKBUDDY_TASKS_LIVE_RUN
# (写侧开关,默认 off ⇒ 调度轮只 dry-run)。
_JOB_ID_WB_TASKS = "workbuddy_task_sweep"
# MiniMax OAuth 换票端点(2026-10-24 抓包确认,客户端不在时的服务端续期出口)
_MINIMAX_TOKEN_URL = "https://account.minimax.cn/oauth2/token"

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
    """按平台拆分账号列表,返回 (非 qoder 走零点/主窗口, qoder 走 10:05 窗口)。

    platform 缺失按 'trae' 处理(存量账号语义,与 store 默认列值一致)。
    workbuddy 随零点/主窗口跑(2026-10-12:Buddy 加油站每日 00:00(UTC+8)后随时
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


def classify_checkin_result(result: dict[str, Any]) -> str:
    """签到结果三分类(可观测性口径唯一实现):claimed / skipped / failed。

    ok=true 同时覆盖「本次真的领取成功」与「平台侧今日已签、本次跳过」——
    前者引擎 action=checkin/claim,后者 action=skip_already。把两者都算「成功」
    会让运营面看不出自动签到到底有没有真领到东西(2026-10-24 实测:8 条 ok=true
    全是 skip_already、0 条 claim,汇总却报「成功 8」)。判定自动签到是否好使,
    只认 claimed 且 credits_delta > 0。
    """
    if not result.get("ok"):
        return "failed"
    action = str(result.get("action") or "")
    if action == "skip_already":
        return "skipped"
    return "claimed"


def _cooldown_end(cooldown_seconds: int | None) -> datetime | None:
    """由引擎给的 cooldown_seconds 计算冷却结束时刻。0/None → 不冷却(None)。"""
    if not cooldown_seconds or cooldown_seconds <= 0:
        if cooldown_seconds is not None and cooldown_seconds < 0:
            return datetime.now(UTC) + timedelta(days=_PERMANENT_COOLDOWN_DAYS)
        return None
    return datetime.now(UTC) + timedelta(seconds=cooldown_seconds)


def _cron_enabled() -> bool:
    """CHECKIN_CRON_ENABLED 是否为 "true";start() 与 status() 共用同一读取,防漂移。

    代码缺省为 false(测试/裸跑安全);部署入口(docker-compose.yml 与
    deploy\\scripts\\prod-bundle\\svc\\run-ai.ps1)以「未设置则 true」注入。
    """
    return os.environ.get("CHECKIN_CRON_ENABLED", "false").lower() == "true"


def _job_cron_expr(trigger: Any) -> str:
    """把 APScheduler trigger 压成 cron 表达式,供启动日志核对注册了什么。

    CronTrigger 只用 hour/minute(本调度器全部 job 均如此),其余位写 *;
    IntervalTrigger 压成 ``*/N * * * *`` 的分钟形态。
    """
    fields = getattr(trigger, "fields", None)
    if fields:
        named = {field.name: str(field) for field in fields}
        if "hour" in named and "minute" in named:
            return f"{named['minute']} {named['hour']} * * *"
    interval = getattr(trigger, "interval", None)
    if interval is not None:
        minutes = int(interval.total_seconds() // 60)
        return f"*/{max(minutes, 1)} * * * *"
    return str(trigger)


def _wb_tasks_sweep_minutes() -> int:
    """WorkBuddy 任务巡检节拍(分钟):单一真源,start() 注册 job 与 status() 展示共用。

    下限 5 分钟(六族一轮本身多次网络往返,再密就是自己打自己);上不封顶。
    两处各写一遍 int()/max() 必然漂移(前端显示 180、实际跑 5 之类),故抽此函数。
    """
    return max(5, int(settings.workbuddy_tasks_sweep_minutes))


# wb_tasks.not_running_reason 的机器枚举(三端按这个字符串分支,取值只此一份)
WbTasksNotRunningReason = Literal[
    "tasks_gate_off",
    "cron_gate_off",
    "scheduler_not_started",
    "job_not_registered",
]


def _wb_tasks_not_running_reason(
    *,
    tasks_enabled: bool,
    cron_enabled: bool,
    started: bool,
    job_registered: bool,
) -> WbTasksNotRunningReason | None:
    """WorkBuddy 任务巡检「为什么没在跑」的唯一判序(纯函数,自上而下第一个命中)。

    抽成纯函数的原因:判序一旦只写在 status() 的 if 链里,文档与前端各抄一份
    必然漂移(§0.6);用例直接喂参数验五档,不依赖真起调度器。

    1. job 现在真注册着(且调度器已 start)⇒ None:没有"为什么没跑"可说;
    2. 任务门关 ⇒ tasks_gate_off(WORKBUDDY_TASKS_ENABLED 是这条 job 的专闸,
       排在总闸前:红牌先指"能当场整改的那一格",总闸同时关时也是它更该先动);
    3. 任务门开而总闸关 ⇒ cron_gate_off(CHECKIN_CRON_ENABLED 关 ⇒ start() 直接
       return,整条函数体都进不去);
    4. 两门皆开但调度器没起来 ⇒ scheduler_not_started(建表失败 / start() 抛异常
       被 main.py 的 lifespan 吞掉 / 压根没跑到 lifespan ⇒ 进程里没有 scheduler);
    5. 调度器起来了但该 job 不在注册表 ⇒ job_not_registered(改完 .env 没重启这类
       进程内不一致:start() 有 `if self._started: return` 短路,热改环境变量不会
       补注册)。

    四档非 None 都是「配置看起来开了但活儿不会干」,必须让人一眼分辨卡在哪一层。
    """
    if started and job_registered:
        return None
    if not tasks_enabled:
        return "tasks_gate_off"
    if not cron_enabled:
        return "cron_gate_off"
    if not started:
        return "scheduler_not_started"
    return "job_not_registered"


# ---------------------------------------------------------------------------
# Qoder 补跑轮的口径(2026-11-01):时刻解析 / 北京自然日 / 「今日已有结果」判定
# ---------------------------------------------------------------------------


def _parse_hhmm(raw: str) -> tuple[int, int] | None:
    """把 "HH:MM" 解成 (hour, minute);任何不合规写法回 None(调用方整条忽略)。"""
    parts = raw.strip().split(":")
    if len(parts) != 2:
        return None
    hh, mm = parts
    # 分钟必须两位(11:5 这种含糊写法一律不认);小时容许 1~2 位(9:30 可读且无歧义)
    if len(hh) not in (1, 2) or len(mm) != 2:
        return None
    if not (hh.isdigit() and mm.isdigit()):
        return None
    hour, minute = int(hh), int(mm)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour, minute


def _qoder_retry_times() -> list[tuple[int, int]]:
    """CHECKIN_QODER_RETRY_TIMES 解析:start() 注册 job 与 status() 展示共用单一真源。

    逗号分隔的 HH:MM;非法条目**整条忽略并告警**,不抛异常也不拖累其它条目 ——
    一个手抖的 "25:00" 不该把整条补跑腿连带弄没(那等价于当天漏签)。空/未配置
    回落默认 11:00 / 12:30;重复时刻去重保序(同一个 id 不能注册两次)。
    """
    raw = os.environ.get("CHECKIN_QODER_RETRY_TIMES") or _QODER_RETRY_DEFAULT_TIMES
    out: list[tuple[int, int]] = []
    for item in raw.split(","):
        text = item.strip()
        if not text:
            continue
        parsed = _parse_hhmm(text)
        if parsed is None:
            logger.warning(
                "[checkin_scheduler] CHECKIN_QODER_RETRY_TIMES 条目非法已忽略: %r"
                "(应为 HH:MM,00:00~23:59)",
                text,
            )
            continue
        if parsed not in out:
            out.append(parsed)
    return out


def _qoder_retry_job_id(hour: int, minute: int) -> str:
    """补跑 job id:start() 注册与 status() 取 next_run_time 必须算出同一个名字。"""
    return f"{_JOB_ID_QODER_RETRY}_{hour:02d}{minute:02d}"


def _cn_day(instant: datetime) -> date:
    """把任意时刻折成 Asia/Shanghai 自然日(每日 00:00 UTC+8 换日,不是 UTC 0 点)。

    补跑判定必须按**北京日**折日:2026-11-01 的实证跨了 UTC 日界 —— UTC
    15:30 == 北京 11-01 23:30 仍属"今天";UTC 16:30 == 北京 11-02 00:30 已是
    "明天"。按 UTC 折日会把 00:00~08:00 的记录算到前一天,补跑就会对着昨天
    已领的号再打一遍。naive 时间按 UTC 解释(库里 created_at 是 timestamptz,
    恒为 aware;naive 只可能来自测试手写)。
    """
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=UTC)
    return instant.astimezone(_CN_TZ).date()


def _cn_day_start(day: date) -> datetime:
    """Asia/Shanghai 某自然日 00:00 的 aware datetime(给 store 当查询下界)。"""
    return datetime.combine(day, time.min, tzinfo=_CN_TZ)


def _settled_today(record: dict[str, Any], today: date) -> bool:
    """该记录是否构成「今日已有确定结果」:同一北京自然日 ∧ ok=true。

    ok=true 同时覆盖 claim/checkin(本次真领到)与 skip_already(平台侧今日
    已签)—— 两者都表示"这个号今天不用再打了"。失败记录、昨天的成功记录、
    created_at 读不出来的脏行,一律不算(宁可补一次,不可漏签)。
    """
    if record.get("ok") is not True:
        return False
    created = record.get("created_at")
    if not isinstance(created, datetime):
        return False
    return _cn_day(created) == today


class CheckinScheduler:
    """签到助手每日调度器(单例)。"""

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._started: bool = False
        # WorkBuddy 本机重抽节流(秒):失败也等这么久再试,避免每轮都拉起无头 Chrome
        self._wb_extract_at: float = 0.0
        # WorkBuddy 客户端内存令牌扫描节流(秒)
        self._wb_memory_scan_at: float = 0.0
        # WorkBuddy 任务巡检「上一轮摘要」(2026-10-31 补):巡检结果原本只进日志,
        # 前端无从得知「自动跑没跑、领到几分」。这里留一份进程内只读快照给
        # status() 暴露。**进程内**语义:重启即清空(不是持久账本,不写 checkin_records
        # —— 做任务 ≠ 每日签到,不混表);多 worker 部署下各进程各自一份。
        self._wb_sweep_last: dict[str, Any] | None = None
        # Qoder 补跑轮防重入(2026-11-01):单轮最坏 200 号 × 错峰 8~45s 可跑近两
        # 小时,可能跨过下一个补跑时刻;两轮叠打会把同一批待补号打两遍。标志位只
        # 在进程内(多 worker 部署各算各的,见报告残留风险)。
        self._qoder_retry_running: bool = False

    # ===== 启停(lifespan 钩子) =====

    async def start(self) -> None:
        """启动每日 00:05/08:05(非 Qoder)/10:05(Qoder)/补跑(CHECKIN_QODER_RETRY_TIMES,
        默认 11:00、12:30)定时任务(CHECKIN_CRON_ENABLED 控制全部 job;代码缺省 false,
        部署入口默认注入 true)。

        建表 fail-open:表建不出来时只告警,不阻塞主服务启动。
        """
        if self._started:
            return
        enabled = _cron_enabled()
        if not enabled:
            logger.warning(
                "[checkin_scheduler] CHECKIN_CRON_ENABLED=false, 每日签到 job 未注册"
                "(自动签到/积分快照都不会跑;开启:设置环境变量 CHECKIN_CRON_ENABLED=true 后重启服务)"
            )
            return
        try:
            await checkin_store.ensure_tables()
        except Exception as e:
            logger.warning("[checkin_scheduler] 签到建表异常(忽略,签到功能不可用): %s", e)
            return
        await self._restore_outbound_pause()
        # 本地变量持有实例:闭包里用 self._scheduler 会被 mypy 判成 Any|None(union-attr)
        scheduler = AsyncIOScheduler(timezone=_CN_TZ)
        self._scheduler = scheduler
        registered: list[str] = []

        def _add(func: Any, trigger: Any, job_id: str) -> None:
            """注册一个 job 并记账(启动日志用;不依赖具体 scheduler 的 get_jobs)。"""
            scheduler.add_job(func, trigger=trigger, id=job_id, replace_existing=True)
            registered.append(f"{job_id}={_job_cron_expr(trigger)}")

        _add(
            self._daily_run_midnight,
            CronTrigger(hour=0, minute=5, timezone=_CN_TZ, jitter=_CRON_JITTER),
            _JOB_ID_MIDNIGHT,
        )
        _add(
            self._daily_run,
            CronTrigger(hour=8, minute=5, timezone=_CN_TZ, jitter=_CRON_JITTER),
            _JOB_ID,
        )
        _add(
            self._daily_run_qoder,
            CronTrigger(hour=10, minute=5, timezone=_CN_TZ, jitter=_CRON_JITTER),
            _JOB_ID_QODER,
        )
        # Qoder 补跑轮(2026-11-01):10:05 单跑一次会撞上"活动还没下发",按
        # CHECKIN_QODER_RETRY_TIMES 逐个注册补跑 job(同一 jitter,与其它 job 一致);
        # 只挑今日无确定结果的号,风控语义不变(见 _daily_run_qoder_retry)。
        for retry_hour, retry_minute in _qoder_retry_times():
            _add(
                self._daily_run_qoder_retry,
                CronTrigger(
                    hour=retry_hour,
                    minute=retry_minute,
                    timezone=_CN_TZ,
                    jitter=_CRON_JITTER,
                ),
                _qoder_retry_job_id(retry_hour, retry_minute),
            )
        # 06:00 状态探针:先于主窗口同步平台侧「已签」状态(见 _JOB_ID_PROBE 注)
        _add(
            self._daily_status_probe,
            CronTrigger(hour=6, minute=0, timezone=_CN_TZ, jitter=_CRON_JITTER),
            _JOB_ID_PROBE,
        )
        # WP-B(2026-10-09):每日积分快照 job,与签到 job 同一启用开关
        _add(
            self._daily_credits_snapshot,
            CronTrigger(hour=8, minute=10, timezone=_CN_TZ, jitter=_CRON_JITTER),
            _CREDITS_JOB_ID,
        )
        # 本机凭据同步:与每日签到开关同一个门;客户端不在同机时任务内部直接跳过(不假装成功)
        _add(
            self._sync_local_credentials,
            IntervalTrigger(minutes=15),
            _JOB_ID_LOCAL_SYNC,
        )
        # O68 WorkBuddy 任务赚积分巡检:独立开关(默认 off),节拍可调;写侧另由
        # WORKBUDDY_TASKS_LIVE_RUN 把关,默认调度轮只 dry-run。
        if settings.workbuddy_tasks_enabled:
            _add(
                self._workbuddy_task_sweep,
                IntervalTrigger(minutes=_wb_tasks_sweep_minutes()),
                _JOB_ID_WB_TASKS,
            )
        scheduler.start()
        self._started = True
        retry_label = "/".join(f"{h:02d}:{m:02d}" for h, m in _qoder_retry_times())
        logger.info(
            "[checkin_scheduler] 已启动每日调度:注册 %d 个 job [%s]"
            "(06:00 状态探针 / 00:05 零点签到 / 08:05 签到 / 10:05 Qoder 签到 /"
            " Qoder 补跑 %s / 08:10 积分快照,起批漂移 ≤%ds)",
            len(registered),
            ", ".join(registered),
            retry_label or "未配置",
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

    async def _restore_outbound_pause(self) -> None:
        """重启后补回出站全局暂停(第五件套配套,2026-10-16)。

        全局暂停是**进程级易失状态**:NSSM 重启/部署即丢,而平台的限流
        (60s)/挑战(300s)窗口可能仍在有效期。若 DB 里最近一条 SoftRate/
        Challenge 记录的暂停窗口仍未走完,按原口径补一次暂停——否则重启后
        第一个定时批/手动签到立刻顶风打,前面所有暂停努力归零。

        只补「最近一条」信号(最新信号主导;窗口已剩 ≤5s 不补,无意义);
        fail-open:查询失败只告警不阻塞启动(每账号冷却已持久化,那是
        更细的兜底层)。
        """
        try:
            signal = await checkin_store.latest_outbound_pause_signal()
        except Exception as e:
            logger.warning("[checkin_scheduler] 读取最近限流信号失败(跳过暂停恢复): %s", e)
            return
        if signal is None:
            return
        etype, created_at = signal
        window = rate_limit_pause_seconds() if etype == "SoftRate" else challenge_pause_seconds()
        remaining = window - (datetime.now(UTC) - created_at).total_seconds()
        if remaining <= 5.0:
            return
        checkin_outbound_gate.pause(
            seconds=remaining, reason=f"重启恢复:{etype} 暂停窗口剩 {remaining:.0f}s"
        )
        logger.warning(
            "[checkin_scheduler] 重启恢复出站暂停:%s 窗口剩 %.0fs(记录于 %s)",
            etype,
            remaining,
            created_at.isoformat(),
        )

    def status(self) -> dict[str, Any]:
        """运行状态(公开只读视图,供 GET /api/checkin/scheduler/status)。

        enabled 与 start() 读同一环境变量(_cron_enabled 单一来源);started
        为本单例是否已 start;next_run / next_run_midnight / next_run_qoder /
        next_run_qoder_retry / next_run_probe / next_run_wb_tasks 仅已启动时有值
        (APScheduler job 的 next_run_time,带 Asia/Shanghai 时区的 ISO8601),未启动为 None。

        next_run_qoder_retry(2026-11-01 补):补跑轮按 env 逐个注册 job,这里取
        这些 job 中**最近一次**触发时刻(job id 由 _qoder_retry_job_id 单一真源
        算出,与 start() 注册的不许漂移);一个都没注册(env 全非法)则为 None。

        wb_tasks(2026-10-31 补):WorkBuddy 任务巡检这条 job 此前对前端完全不可见
        ⇒ 用户看不到「自动做任务」在不在跑、下次何时跑。这里与 start() 同源暴露。

        **enabled 是观测态,不是配置意图的与**(2026-10-31 二修,前一轮的"两门与"
        仍是假绿):两道闸都只回答"配置想不想跑",判不出"进程里到底有没有这条 job"。
        可复现的反例——start() 里 ensure_tables 抛异常直接 return,而 main.py 的
        lifespan 又把 start() 整包 try/except 忽略 ⇒ 进程里连 scheduler 都没有,
        两门 env 全 true 时旧口径照样报 enabled=true,面板显示「已启用 · 每 180
        分钟自动巡检」,而这条 job 永不执行(§0.3:没跑绝不写成在跑)。故:
        - `enabled`             = self._started ∧ 该 job 在 scheduler 注册表里
        - `tasks_enabled`       = WORKBUDDY_TASKS_ENABLED 原值(配置意图)
        - `cron_enabled`        = CHECKIN_CRON_ENABLED 原值(配置意图)
        - `not_running_reason`  = enabled 为 false 时点名卡在哪一层(机器枚举,
          判序唯一实现见 _wb_tasks_not_running_reason;enabled 为 true 时恒 None)

        sweep_minutes 走 _wb_tasks_sweep_minutes() 单一真源;claim/activity 路径
        是否配置也让前端能直说「领奖路径未配置 ⇒ 不会领奖」,不用用户猜为什么
        没领到分。
        """
        next_run: str | None = None
        next_run_midnight: str | None = None
        next_run_qoder: str | None = None
        next_run_qoder_retry: str | None = None
        next_run_probe: str | None = None
        next_run_wb_tasks: str | None = None
        # 观测态取材:调度器不存在 ⇒ job 必然没注册(不回落成"按配置猜")
        wb_job = self._scheduler.get_job(_JOB_ID_WB_TASKS) if self._scheduler is not None else None
        wb_job_registered = wb_job is not None
        if self._started and self._scheduler is not None:
            job = self._scheduler.get_job(_JOB_ID)
            if job is not None:
                # apscheduler 无 py.typed ⇒ job 是 Any;next_run_time 钉真类型,
                # isoformat 的产出才有 str 看守(同 checkin_store :269 的钉法)。
                next_run_time: datetime | None = job.next_run_time
                next_run = next_run_time.isoformat() if next_run_time is not None else None
            job_mid = self._scheduler.get_job(_JOB_ID_MIDNIGHT)
            if job_mid is not None:
                next_run_time_m: datetime | None = job_mid.next_run_time
                next_run_midnight = (
                    next_run_time_m.isoformat() if next_run_time_m is not None else None
                )
            job_q = self._scheduler.get_job(_JOB_ID_QODER)
            if job_q is not None:
                next_run_time_q: datetime | None = job_q.next_run_time
                next_run_qoder = (
                    next_run_time_q.isoformat() if next_run_time_q is not None else None
                )
            job_probe = self._scheduler.get_job(_JOB_ID_PROBE)
            if job_probe is not None:
                next_run_time_p: datetime | None = job_probe.next_run_time
                next_run_probe = (
                    next_run_time_p.isoformat() if next_run_time_p is not None else None
                )
            # 补跑轮可能注册多条 job(每个时刻一条):取最近的一次触发给前端
            retry_next: list[datetime] = []
            for retry_hour, retry_minute in _qoder_retry_times():
                job_retry = self._scheduler.get_job(
                    _qoder_retry_job_id(retry_hour, retry_minute)
                )
                if job_retry is None:
                    continue
                next_run_time_r: datetime | None = job_retry.next_run_time
                if next_run_time_r is not None:
                    retry_next.append(next_run_time_r)
            if retry_next:
                next_run_qoder_retry = min(retry_next).isoformat()
            if wb_job is not None:
                next_run_time_w: datetime | None = wb_job.next_run_time
                next_run_wb_tasks = (
                    next_run_time_w.isoformat() if next_run_time_w is not None else None
                )
        wb_tasks_enabled = bool(settings.workbuddy_tasks_enabled)
        wb_cron_enabled = _cron_enabled()
        return {
            "enabled": wb_cron_enabled,
            # 开关真实值(原样,不看 started):前端/运维据此判断「是没开还是开了没跑」
            "cron_enabled": wb_cron_enabled,
            "started": self._started,
            "next_run": next_run,
            "next_run_midnight": next_run_midnight,
            "next_run_qoder": next_run_qoder,
            "next_run_qoder_retry": next_run_qoder_retry,
            "next_run_probe": next_run_probe,
            "next_run_wb_tasks": next_run_wb_tasks,
            "wb_tasks": {
                # 观测态:只有"调度器已 start ∧ 这条 job 真在注册表里"才算在跑。
                # 配置意图另见 tasks_enabled / cron_enabled 与 not_running_reason。
                "enabled": bool(self._started and wb_job_registered),
                "tasks_enabled": wb_tasks_enabled,
                "cron_enabled": wb_cron_enabled,
                "not_running_reason": _wb_tasks_not_running_reason(
                    tasks_enabled=wb_tasks_enabled,
                    cron_enabled=wb_cron_enabled,
                    started=self._started,
                    job_registered=wb_job_registered,
                ),
                "live_run": bool(settings.workbuddy_tasks_live_run),
                "sweep_minutes": _wb_tasks_sweep_minutes(),
                "claim_path_configured": bool(
                    (settings.workbuddy_tasks_claim_path or "").strip()
                ),
                "activity_path_configured": bool(
                    (settings.workbuddy_tasks_activity_path or "").strip()
                ),
                # 上一轮巡检摘要(进程内;None = 本进程还没跑过)。前端据此说
                # 「上次跑了 N 家、领了 M 项」或「上次跳过:原因」,而不是一片空白。
                "last_sweep": self._wb_sweep_last,
            },
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
        claimed = 0
        skipped = 0
        failed = 0
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
                kind = classify_checkin_result(result)
                if kind == "claimed":
                    claimed += 1
                elif kind == "skipped":
                    skipped += 1
                else:
                    failed += 1
            except OutboundPaused as e:
                # 风控铁律:平台限流全局暂停中,整批立即中止(绝不换个账号继续打)
                logger.warning(
                    "[checkin_scheduler] %s出站限流暂停中(剩 %.0fs),整批中止: 共 %d 个账号,已领 %d / 已签跳过 %d / 失败 %d",
                    label,
                    e.remaining,
                    len(accounts),
                    claimed,
                    skipped,
                    failed,
                )
                break
            except Exception as e:
                logger.warning(
                    "[checkin_scheduler] 账号 %s 签到异常(继续下一个): %s", acc.get("name"), e
                )
        logger.info(
            "[checkin_scheduler] %s本轮签到完成: 共 %d 个账号,领取成功 %d / 今日已签跳过 %d / 失败 %d",
            label,
            len(accounts),
            claimed,
            skipped,
            failed,
        )

    async def _probe_platform(
        self,
        acc: dict[str, Any],
        device_map: dict[str, Any],
        client: httpx.AsyncClient | None,
    ) -> tuple[bool, bool | None, int | None, str]:
        """按平台分发探针,统一返回 (ok, checked_in|None, credits|None, message)。

        四型入口(2026-10-17 李总点名:官方没有查询口不是借口,各平台都要覆盖):
        - trae      : status 接口(checked_in 位)              —— 只读
        - qoder     : GET campaigns 按 claimStatus 判已领       —— 只读(不 claim)
        - workbuddy : checkin-status 的 today_checked_in **实测不可靠**(已签仍报
                      false)⇒ 走 daily-checkin 幂等 claim(已签自报 10001,未签顺带领)
        - minimax   : 官方 status 只有 7 天进度环、无日期 ⇒ 走幂等 claim 兜底,
                      已领自报 skip_already,未领会顺手领掉(官方幂等不重复发分)
        """
        name = acc.get("name") or str(acc["id"])
        platform = str(acc.get("platform") or "trae")
        if platform == "workbuddy":
            return await checkin_workbuddy.workbuddy_probe_status(
                acc["jwt"], device_map, client=client
            )
        if platform == "qoder":
            return await checkin_qoder.qoder_probe_status(
                name, acc["jwt"], device_map, client=client
            )
        if platform == "minimax":
            return await checkin_minimax.minimax_probe_status(
                name, acc["jwt"], device_map, client=client
            )
        ok_s, checked_in, credits, code_s, msg_s = await status_check(
            name, acc["jwt"], device_map, client=client
        )
        return ok_s, checked_in, credits, msg_s or ""

    async def _refresh_minimax_token(self, rec: dict[str, Any]) -> dict[str, Any] | None:
        """用 refreshToken 换新令牌 —— 客户端不在时的服务端续期。

        端点 2026-10-24 抓包确认:`POST https://account.minimax.cn/oauth2/token`
        (`grant_type=refresh_token` + `client_id` + `scope` + `audience`)。
        refreshToken 会轮换,成功结果必须写回 auth.json,否则下一次续期
        直接 invalid_grant(实测过的失效路径)。
        """
        rt = rec.get("refreshToken")
        if not isinstance(rt, str) or not rt:
            return None
        payload: dict[str, str] = {
            "grant_type": "refresh_token",
            "refresh_token": rt,
            "client_id": str(rec.get("clientId") or "mcode-public"),
        }
        scopes = rec.get("scopes")
        if isinstance(scopes, list) and scopes:
            payload["scope"] = " ".join(str(s) for s in scopes)
        audience = rec.get("audience")
        if isinstance(audience, str) and audience:
            payload["audience"] = audience
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(_MINIMAX_TOKEN_URL, data=payload)
            if resp.status_code >= 400:
                logger.warning(
                    "[checkin_scheduler] MiniMax 令牌续期失败 HTTP %s: %s",
                    resp.status_code,
                    resp.text[:160],
                )
                return None
            body = resp.json()
        except Exception as e:
            logger.warning("[checkin_scheduler] MiniMax 令牌续期异常: %s", e)
            return None
        token = body.get("access_token") if isinstance(body, dict) else None
        return body if isinstance(token, str) and token else None

    async def _sync_local_credentials(self) -> None:
        """本机凭据同步(每 15 分钟)。两条腿互相独立,任一条失败不影响另一条。"""
        for leg in (self._sync_minimax_local, self._sync_workbuddy_local):
            try:
                await leg()
            except Exception as e:  # noqa: BLE001 — 单腿异常不得拖垮另一条
                logger.warning("[checkin_scheduler] 本机凭据同步腿 %s 失败: %s", leg.__name__, e)

    async def _sync_minimax_local(self) -> None:
        """MiniMax 服务端续期 + 客户端凭据同步。

        1. **服务端续期**(客户端不在也生效):MiniMax 的 refreshToken 在
           `auth.json` 明文可读,临期(≤5 分钟)时直接调 OAuth 换新并写回文件;
        2. **客户端同步**:读取客户端刷新后的凭据写回签到账号并解除冷却。
        """
        path = os.path.expanduser("~/.minimax/auth/prod/cn/mcode-public/auth.json")
        if not os.path.exists(path):
            return
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            return
        records = data.get("records") or {}
        if not records:
            return
        rec = next(iter(records.values()))
        if not isinstance(rec, dict):
            return
        token = rec.get("accessToken")
        exp_ms = rec.get("expiresAtMs")
        exp = int(exp_ms / 1000) if isinstance(exp_ms, (int, float)) and exp_ms > 0 else None
        now = int(datetime.now(UTC).timestamp())
        if (not isinstance(token, str) or not token or exp is None or exp - now < 300) and rec.get(
            "refreshToken"
        ):
            refreshed = await self._refresh_minimax_token(rec)
            if refreshed:
                rec["accessToken"] = refreshed["access_token"]
                if isinstance(refreshed.get("refresh_token"), str) and refreshed["refresh_token"]:
                    rec["refreshToken"] = refreshed["refresh_token"]
                if isinstance(refreshed.get("expires_in"), (int, float)):
                    rec["expiresAtMs"] = (now + int(refreshed["expires_in"])) * 1000
                token = rec["accessToken"]
                exp_ms = rec.get("expiresAtMs")
                exp = (
                    int(exp_ms / 1000)
                    if isinstance(exp_ms, (int, float)) and exp_ms > 0
                    else exp
                )
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    logger.info(
                        "[checkin_scheduler] MiniMax 令牌已服务端续期并写回 auth.json(exp=%s)",
                        exp,
                    )
                except OSError as e:
                    logger.warning("[checkin_scheduler] MiniMax 续期结果写回失败: %s", e)
        if not isinstance(token, str) or not token:
            return
        rows = await checkin_store.list_accounts_by_platform("minimax")
        updated = 0
        for row in rows:
            dm = row["device_map"]
            if exp is not None and dm.get("expires_at") == exp:
                continue
            if not await checkin_store.update_jwt(row["id"], row["owner_user_id"], token):
                continue
            if exp is not None:
                dm["expires_at"] = exp
            refresh = rec.get("refreshToken")
            if isinstance(refresh, str) and refresh:
                dm["refresh_token"] = refresh
            await checkin_store.save_device_map(row["id"], dm)
            await checkin_store.clear_open_cooldowns(row["id"])
            updated += 1
        if updated:
            logger.info(
                "[checkin_scheduler] 本机 MiniMax 凭据已同步 %d 个账号(exp=%s)",
                updated,
                exp,
            )

    async def _sync_workbuddy_local(self) -> None:
        """WorkBuddy 凭据保活:客户端内存令牌(主)+ 网页会话 cookie(备)。

        客户端自己会持续自动刷新(用户实证:从不需要重登),运行期明文令牌就在
        主进程/守护进程堆上。故主路 = **只读**采集客户端当前 Bearer(28 天),
        临期 7 天内才扫一次;不拿它的 Offline refresh token 去换票 —— 那可能
        触发 Keycloak 轮换,反把客户端挤下线。

        备路 = 网页 `session` cookie(7 天,客户端长期不开时用):每 15 分钟探活,
        临期(<24h)或失效才重抽(VSS + 无头 Chrome 自解密 ABE);失败 30 分钟节流。
        两条路都只在探活/解出真令牌后才写库并解冷却;取不到只记日志,不冒充成功。
        """
        rows = await checkin_store.list_accounts_by_platform("workbuddy")
        if not rows:
            return
        now = datetime.now(UTC).timestamp()

        # ---- 主路:客户端内存令牌(只读) -------------------------------------
        need_tokens: list[dict[str, Any]] = []
        for row in rows:
            # dev-anonymous 是历史占位账号,uid 不在客户端令牌里,扫了也只会白跑
            if row["owner_user_id"] == "dev-anonymous":
                continue
            dm = row["device_map"]
            if not str(dm.get("uid") or ""):
                continue
            _, remaining = checkin_workbuddy.workbuddy_session_expiry(dm)
            if remaining is not None and remaining >= _WB_TOKEN_REFRESH_AHEAD_HOURS:
                continue
            need_tokens.append(row)
        if need_tokens and now - self._wb_memory_scan_at >= _WB_MEMORY_SCAN_INTERVAL_SECONDS:
            self._wb_memory_scan_at = now
            found = await checkin_workbuddy_local.extract_workbuddy_memory_tokens()
            updated = 0
            for row in need_tokens:
                dm = row["device_map"]
                uid = str(dm.get("uid") or "")
                entry = found.get(uid)
                if not isinstance(entry, dict):
                    continue
                bearer = entry.get("bearer")
                exp = int(entry.get("bearer_exp") or 0)
                if not isinstance(bearer, str) or not bearer or not exp:
                    continue
                _, cur_remaining = checkin_workbuddy.workbuddy_session_expiry(dm)
                cur_exp = int(now + cur_remaining * 3600) if cur_remaining is not None else 0
                if exp <= cur_exp:
                    continue
                if not await checkin_store.update_jwt(row["id"], row["owner_user_id"], bearer):
                    continue
                dm["expires_at"] = exp
                dm["token_source"] = "client-memory"
                offline = entry.get("offline")
                if isinstance(offline, str) and offline:
                    dm["refresh_token"] = offline
                    dm["refresh_expires_at"] = int(entry.get("offline_exp") or 0)
                await checkin_store.save_device_map(row["id"], dm)
                await checkin_store.clear_open_cooldowns(row["id"])
                updated += 1
            if updated:
                logger.info(
                    "[checkin_scheduler] WorkBuddy 客户端令牌已采集 %d 个账号(内存只读)",
                    updated,
                )

        # ---- 备路:网页会话 cookie -------------------------------------------
        need_extract = False
        for row in rows:
            dm = row["device_map"]
            cookie = checkin_workbuddy.workbuddy_web_cookie("", dm)
            if not cookie:
                # 纯 Bearer 账号(未声明网页登录)不强制拉起浏览器;只有显式
                # login_type=web 却没 cookie 才视为缺口(用户刚加号、尚未登录)。
                if checkin_workbuddy.workbuddy_is_web_mode(dm):
                    need_extract = True
                continue
            exp = dm.get("web_cookie_expires_at")
            if isinstance(exp, (int, float)) and 0 < exp - now < 86400:
                need_extract = True
                continue
            ok, alive_uid, http_status = await checkin_workbuddy.workbuddy_check_session(cookie, dm)
            if ok:
                if alive_uid and dm.get("uid") != alive_uid:
                    dm["uid"] = alive_uid
                    await checkin_store.save_device_map(row["id"], dm)
                continue
            if http_status in (302, 401, 403):
                logger.info(
                    "[checkin_scheduler] WorkBuddy 网页会话已失效(HTTP %s),准备本机重抽",
                    http_status,
                )
                need_extract = True
        if not need_extract:
            return
        if now - self._wb_extract_at < _WB_EXTRACT_INTERVAL_SECONDS:
            return
        self._wb_extract_at = now
        extracted = await checkin_workbuddy_local.extract_workbuddy_cookie()
        if not extracted:
            logger.info("[checkin_scheduler] WorkBuddy 网页会话重抽未取到(浏览器未登录或 Chrome 未运行)")
            return
        ok, alive_uid, http_status = await checkin_workbuddy.workbuddy_check_session(
            extracted["cookie"], {"user_agent": extracted.get("user_agent")}
        )
        if not ok or not alive_uid:
            logger.warning(
                "[checkin_scheduler] WorkBuddy 重抽凭据探活失败(HTTP %s),不写库", http_status
            )
            return
        updated = 0
        for row in rows:
            dm = row["device_map"]
            if str(dm.get("uid") or "") != alive_uid:
                continue
            dm["web_cookie"] = extracted["cookie"]
            if extracted.get("user_agent"):
                dm["user_agent"] = extracted["user_agent"]
            if extracted.get("expires_at"):
                dm["web_cookie_expires_at"] = extracted["expires_at"]
            dm["web_cookie_synced_at"] = int(now)
            await checkin_store.save_device_map(row["id"], dm)
            await checkin_store.clear_open_cooldowns(row["id"])
            updated += 1
        if updated:
            logger.info(
                "[checkin_scheduler] WorkBuddy 网页会话已同步 %d 个账号(uid=%s, exp=%s)",
                updated,
                uid,
                extracted.get("expires_at"),
            )
        else:
            logger.info(
                "[checkin_scheduler] WorkBuddy 抽到 uid=%s 的会话,但签到账号无对应 uid,未写库",
                uid,
            )

    def _record_wb_sweep(
        self,
        started_at: datetime,
        dry_run: bool,
        stats: dict[str, int],
        note: str | None,
    ) -> None:
        """落一份「上一轮巡检」进程内快照,供 status() 给前端看(只读,不改业务态)。

        note 非空 = 本轮没有真正跑完(出站暂停/账号读取失败/无账号/中途中止),
        前端据此直说「上次巡检跳过:原因」,而不是显示一个空白的「已启用」。
        """
        self._wb_sweep_last = {
            "at": started_at.isoformat(),
            "finished_at": datetime.now(UTC).isoformat(),
            "dry_run": dry_run,
            **stats,
            "note": note,
        }

    async def _workbuddy_task_sweep(self) -> None:
        """O68 WorkBuddy 任务赚积分巡检轮(六族,顺序取 workbuddy_tasks.SWEEP_ORDER)。

        双门控已由 start() 把关(WORKBUDDY_TASKS_ENABLED);写侧再隔一层
        WORKBUDDY_TASKS_LIVE_RUN=false ⇒ dry-run(引擎合同保证 dry_run 零写侧调用)。
        冷却中账号跳过(与积分快照/状态探针同口径);单账号异常不中断整轮;
        结果不进 checkin_records(做任务 ≠ 每日签到,语义不同不混表),但会落一份
        **进程内摘要** 到 self._wb_sweep_last,由 status() 暴露给前端 ——
        否则自动巡检等于黑盒,用户只能看到日志文件。
        """
        started_at = datetime.now(UTC)
        dry_run = not bool(settings.workbuddy_tasks_live_run)
        stats: dict[str, int] = {
            "accounts": 0,
            "families": 0,
            "accepted": 0,
            "claimed": 0,
            "unjudged": 0,
            "errors": 0,
            "skipped_cooldown": 0,
        }
        if checkin_outbound_gate.paused_remaining() > 0:
            logger.info("[checkin_scheduler] 出站限流暂停中,WorkBuddy 任务巡检本轮跳过")
            self._record_wb_sweep(started_at, dry_run, stats, "出站限流暂停")
            return
        loaded = await self._load_accounts_and_cooldowns("WB任务巡检")
        if loaded is None:
            self._record_wb_sweep(started_at, dry_run, stats, "账号读取失败")
            return
        accounts, cooldowns = loaded
        targets = [a for a in accounts if str(a.get("platform") or "") == "workbuddy"]
        if not targets:
            self._record_wb_sweep(started_at, dry_run, stats, "无 WorkBuddy 账号")
            return
        stats["accounts"] = len(targets)
        # 按积分紧迫度轮换(可选,默认 none = 沿用既有顺序,零行为变化)。开启后先在跑四族前
        # 按账号积分余额重排(lowest_balance=先补快枯竭的号 / highest_balance=先消耗高产号);
        # 取不到余额的号排最后(§0.3 不冒充 0),单账号探测失败不中断整轮。
        urgency = (settings.workbuddy_tasks_urgency_order or "none").strip().lower()
        if urgency in ("lowest_balance", "highest_balance"):
            balances: dict[str, int | None] = {}
            for acc in targets:
                try:
                    probe = await checkin_workbuddy.workbuddy_query_credits(
                        acc["jwt"],
                        dict(acc.get("device_map") or {}),
                        timeout=checkin_workbuddy.DEFAULT_TIMEOUT,
                    )
                    rem = probe.get("remaining")
                    balances[acc["id"]] = (
                        rem if isinstance(rem, int) and not isinstance(rem, bool) else None
                    )
                except Exception as e:  # noqa: BLE001 — 单账号余额探测失败不中断整轮
                    logger.warning(
                        "[checkin_scheduler] WB 任务巡检余额探测失败 account=%s: %s",
                        acc["id"], e,
                    )
                    balances[acc["id"]] = None
            ordered_ids = workbuddy_tasks.order_accounts_by_credit_urgency(
                [(a["id"], balances.get(a["id"])) for a in targets], urgency
            )
            by_id = {a["id"]: a for a in targets}
            targets = [by_id[i] for i in ordered_ids if i in by_id]
            logger.info("[checkin_scheduler] WB 任务巡检按 %s 排序: %s", urgency, ordered_ids)
        now = datetime.now(UTC)
        summary: list[str] = []
        for acc in targets:
            cd_end = cooldowns.get(acc["id"])
            if cd_end is not None and cd_end > now:
                stats["skipped_cooldown"] += 1
                continue
            device_map = dict(acc.get("device_map") or {})
            # 族顺序取 workbuddy_tasks.SWEEP_ORDER 单一真源:activity 在 growth 之前,
            # 上报计分先落地,growth 同轮列表即可看到「刚达标」的任务并在本轮 claim;
            # 反序(旧 growth→activity)要等下一轮(默认 180 分钟)才领,白丢一轮积分。
            for kind in workbuddy_tasks.SWEEP_ORDER:
                try:
                    result = await workbuddy_tasks.run_family(
                        kind, acc["jwt"], device_map, dry_run=dry_run
                    )
                except OutboundPaused:
                    logger.warning("[checkin_scheduler] WB 任务巡检撞出站暂停,整轮中止")
                    self._record_wb_sweep(started_at, dry_run, stats, "中途中止:出站限流")
                    return
                except Exception as e:
                    logger.warning(
                        "[checkin_scheduler] WB 任务巡检异常 account=%s kind=%s: %s",
                        acc["id"],
                        kind,
                        e,
                    )
                    stats["errors"] += 1
                    continue
                stats["families"] += 1
                stats["accepted"] += len(result.get("accepted") or [])
                stats["claimed"] += len(result.get("claimed") or [])
                if result.get("unjudged"):
                    stats["unjudged"] += 1
                summary.append(
                    f"{acc['id']}/{kind}:ok={result.get('ok')} "
                    f"accepted={len(result.get('accepted') or [])} "
                    f"claimed={len(result.get('claimed') or [])} "
                    f"unjudged={result.get('unjudged')}"
                )
                if result.get("unjudged"):
                    logger.info(
                        "[checkin_scheduler] WB 任务巡检未判定 account=%s kind=%s reason=%s",
                        acc["id"],
                        kind,
                        result.get("reason"),
                    )
                await asyncio.sleep(random.uniform(2.0, 8.0))
        self._record_wb_sweep(
            started_at, dry_run, stats, None if stats["families"] else "无可用账号(全部冷却)"
        )
        logger.info(
            "[checkin_scheduler] WB 任务巡检完成(dry_run=%s):%s",
            dry_run,
            "; ".join(summary) if summary else "无可用账号",
        )

    async def _daily_run(self, label: str = "主窗口") -> None:
        """08:05 主窗口:遍历非 Qoder 账号(Qoder 账号走 10:05 独立窗口)。

        label 只用于日志/文案(零点窗口复用同一腿时传「零点窗口」),不改业务逻辑。
        """
        loaded = await self._load_accounts_and_cooldowns(label)
        if loaded is None:
            return
        main_side, _ = partition_platforms(loaded[0])
        await self._run_batch(main_side, loaded[1], label)

    async def _daily_run_midnight(self) -> None:
        """00:05 零点窗口:与 08:05 主窗口同一条腿(复用 _daily_run),仅换轮次标签。

        平台 0 点刷新当日额度(WorkBuddy 00:00 UTC+8 后可领);08:05 仍保留作兜底,
        故这里**不筛「今日已结算」**——零点若撞上平台尚未重置(status 报昨日已签),
        8:05 会再跑一次补上。
        """
        await self._daily_run("零点窗口")

    async def _daily_status_probe(self) -> None:
        """06:00 状态探针(2026-10-16 李总需求):把平台侧「今日已签到」提前同步落库。

        半夜 0 点平台重置后,用户常已在对应程序里手动签完;等 08:05 主窗口才落
        记录,意味着 UI 一整个早上亮着可点按钮、一键签到还会对已签账号多打一次
        status 请求。探针在主窗口前只读查询(status 无副作用),已签才落
        skip_already 记录 —— UI 即时亮「今日已签到」,主窗口 status 预检命中
        直接跳过,不重复签。

        全平台覆盖(2026-10-17 李总点名「官方没有不是借口」):_probe_platform
        按平台分发 —— TRAE/Qoder 走只读查询口零副作用;WorkBuddy 的
        today_checked_in 实测不可靠(已签仍报 false)故走 daily-checkin 幂等 claim;
        MiniMax 官方 status 只有无日期的 7 天进度环 ⇒ 同样走幂等 claim 兜底
        (已领自报 skip_already,未领会顺手领掉,官方幂等不重复发分)。
        未签账号不落任何记录(留给主窗口签)。
        """
        if checkin_outbound_gate.paused_remaining() > 0:
            logger.info("[checkin_scheduler] 出站限流暂停中,状态探针本轮跳过")
            return
        loaded = await self._load_accounts_and_cooldowns("状态探针")
        if loaded is None:
            return
        accounts, cooldowns = loaded
        targets = list(accounts)
        if not targets:
            return
        now = datetime.now(UTC)
        synced = 0
        for acc in targets:
            cd_end = cooldowns.get(acc["id"])
            if cd_end is not None and cd_end > now:
                continue  # 冷却中(死号/限流)不探,与积分快照跳冷却同口径
            device_map = dict(acc.get("device_map") or {})
            client, owned = client_for(device_map)
            try:
                ok_s, checked_in, credits, msg_s = await self._probe_platform(
                    acc, device_map, client
                )
            except Exception as e:
                logger.warning(
                    "[checkin_scheduler] 状态探针异常 account=%s: %s", acc["id"], e
                )
                continue
            finally:
                if owned:
                    await client.aclose()
            if ok_s and checked_in:
                result: dict[str, Any] = {
                    "ok": True,
                    "status": "already",
                    "action": "skip_already",
                    "code": 0,
                    "message": msg_s or "已签到",
                    "http_status": 200,
                    "credits": credits if isinstance(credits, int) else None,
                    "credits_delta": None,
                    "classified_error": None,
                }
                try:
                    await self.record_result(acc["id"], result)
                    synced += 1
                except Exception as e:
                    logger.warning(
                        "[checkin_scheduler] 探针落记录失败 account=%s: %s", acc["id"], e
                    )
            if len(targets) > 1:
                await asyncio.sleep(random.uniform(0.5, 2.0))
        logger.info(
            "[checkin_scheduler] 06:00 状态探针完成:账号 %d 个,同步「已签到」%d 个",
            len(targets),
            synced,
        )

    async def _daily_run_qoder(self) -> None:
        """10:05 Qoder 窗口:官方领取活动每日 10:00(UTC+8)开放,08:05 跑必然空手。"""
        loaded = await self._load_accounts_and_cooldowns("Qoder窗口")
        if loaded is None:
            return
        _, qoder_side = partition_platforms(loaded[0])
        await self._run_batch(qoder_side, loaded[1], "Qoder窗口")

    async def _daily_run_qoder_retry(self) -> None:
        """Qoder 补跑轮(默认 11:00 / 12:30,CHECKIN_QODER_RETRY_TIMES 可调)。

        立因(2026-11-01 实证):Qoder 的 100 credits 活动由上游在 10:00 **之后
        异步下发**(不是准点):当日 10:07 全池 8 个号一致返回「活动未下发或已
        结束」,12:53 用同一张票、同一个 uid 重查已是 CLAIMABLE —— 票没坏、号没
        废,纯粹是跑早了。而 `_daily_run_qoder` 每天只跑一次(当天不再重试),活动
        下发晚的那天整池空手。故补跑轮只挑「今天还没有确定结果」的号再打一遍。

        **为什么补跑不会放大风控**(三条同时成立才动手):
        - 只挑今日无确定结果的号:今日已有 ok=true(claim / skip_already)的号
          一律跳过,补跑绝不对已落袋的号重复打接口,请求量上界 = 今日失败的号数;
        - 冷却与出站全局闸门照旧:本轮直接走 `_run_batch`,冷却中的号跳过、撞
          429 / 挑战页时整批立即中止,错峰抖动也是同一套 —— 补跑没有任何放宽,
          不允许为了补签破风控;
        - 单轮上限 _QODER_RETRY_MAX_PER_ROUND:异常数据(号池被灌进几千个 qoder
          号)也不会把上游一轮打爆,超出的顺延到下一个补跑时刻;
        - 防重入:上一轮还在跑(200 号 × 错峰可能跨过下一个补跑时刻)就整轮跳过,
          两轮叠打等于把同一批待补号打两遍。
        """
        if self._qoder_retry_running:
            logger.warning(
                "[checkin_scheduler] 上一轮 Qoder补跑 仍在跑,本次跳过(不叠打上游)"
            )
            return
        self._qoder_retry_running = True
        try:
            await self._run_qoder_retry_round()
        finally:
            self._qoder_retry_running = False

    async def _run_qoder_retry_round(self) -> None:
        """补跑轮的实际执行体(筛今日无结果的号 → 走上限 → 交给 _run_batch)。"""
        loaded = await self._load_accounts_and_cooldowns("Qoder补跑")
        if loaded is None:
            return
        accounts, cooldowns = loaded
        _, qoder_side = partition_platforms(accounts)
        if not qoder_side:
            logger.info("[checkin_scheduler] 补跑轮无待补账号(无 Qoder 账号)")
            return
        today = _cn_day(datetime.now(UTC))
        try:
            records = await checkin_store.list_records_since(_cn_day_start(today))
        except Exception as e:
            # 判不出"今天有没有结果"就绝不动手:宁可这天漏签一次,也不能对今日
            # 已领的号盲打一轮(风控红线高于补签收益)。
            logger.warning(
                "[checkin_scheduler] 补跑轮读取今日记录失败(本轮放弃,不盲打): %s", e
            )
            return
        settled = {r["account_id"] for r in records if _settled_today(r, today)}
        pending = [acc for acc in qoder_side if acc["id"] not in settled]
        pending_count = len(pending)
        if not pending:
            logger.info(
                "[checkin_scheduler] 补跑轮无待补账号(Qoder %d 个号今日均已有结果)",
                len(qoder_side),
            )
            return
        if pending_count > _QODER_RETRY_MAX_PER_ROUND:
            logger.warning(
                "[checkin_scheduler] Qoder补跑待补 %d 个号超单轮上限 %d,本轮只跑前 %d 个"
                "(其余顺延到下一个补跑时刻)",
                pending_count,
                _QODER_RETRY_MAX_PER_ROUND,
                _QODER_RETRY_MAX_PER_ROUND,
            )
            pending = pending[:_QODER_RETRY_MAX_PER_ROUND]
        logger.info(
            "[checkin_scheduler] Qoder补跑轮: Qoder 共 %d 个号,今日已有结果 %d 个,"
            "待补 %d 个,本轮执行 %d 个",
            len(qoder_side),
            len(qoder_side) - pending_count,
            pending_count,
            len(pending),
        )
        await self._run_batch(pending, cooldowns, "Qoder补跑")

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
        # 传 date 对象:asyncpg date 参数走客户端编码,str 必抛 DataError
        # (2026-10-17 实测积分快照 job 整轮 0 成功;详见 checkin_store._coerce_day)
        day = datetime.now(_CN_TZ).date()
        ok_count = 0
        fail_count = 0
        skip_count = 0
        na_count = 0
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
                    # 2026-11-04:与签到主路同源 —— relay 号池是 Qoder 凭证唯一真源。
                    # 快照此前直接用 acc["jwt"](本地副本可能已被其它入口分叉/过期)
                    # ⇒ 08:15 必 401。先取号池权威票覆盖;取不到则记「未判定」,
                    # 不拿未确认权威的本地票去判(既不无谓打鉴权点,也不把没判过
                    # 的 401 写成真实失败)。
                    qoder_cred = await checkin_store.load_qoder_cred(
                        str(device_map.get("uid") or acc.get("uid") or "")
                    )
                    if not qoder_cred or not qoder_cred.get("token"):
                        na_count += 1
                        logger.warning(
                            "[checkin_scheduler] 账号 %s 号池无权威票,积分快照未判定(不计失败)",
                            acc.get("name"),
                        )
                        continue
                    if qoder_cred.get("refresh_token"):
                        device_map["refresh_token"] = qoder_cred["refresh_token"]
                    if qoder_cred.get("expires_at"):
                        device_map["expires_at"] = qoder_cred["expires_at"]
                    _cosy = qoder_cred.get("cosy") or {}
                    if _cosy:
                        _merged = dict(device_map.get("cosy") or {})
                        _merged.update({k: v for k, v in _cosy.items() if v})
                        device_map["cosy"] = _merged
                    result = await checkin_qoder.qoder_query_credits(
                        qoder_cred["token"], device_map
                    )
                    # 401→refresh 会写回 device_map(新 token),落库持久化
                    try:
                        await checkin_store.save_device_map(acc["id"], device_map)
                    except Exception as e:
                        logger.warning("[checkin_scheduler] device_map 写回失败(忽略): %s", e)
                elif acc.get("platform") == "workbuddy":
                    wb_dm = dict(acc.get("device_map") or {})
                    result = await checkin_workbuddy.workbuddy_query_credits(acc["jwt"], wb_dm)
                elif acc.get("platform") == "minimax":
                    mm_dm = dict(acc.get("device_map") or {})
                    result = await checkin_minimax.minimax_query_credits(acc["jwt"], mm_dm)
                    # MiniMax 无公开余额端点(见 checkin_minimax.minimax_query_credits):
                    # err=None 且 remaining=None 属「平台无该指标」⇒ 记未判定:
                    # 不落快照(不伪装成成功),也不计失败(不是 401/网络故障)。
                    # err 有值(401/403/Challenge/网络)仍走下方失败分支。
                    if result.get("error") is None and not isinstance(
                        result.get("remaining"), int
                    ):
                        na_count += 1
                        logger.info(
                            "[checkin_scheduler] 账号 %s 平台无余额指标,快照未判定(不计失败)",
                            acc.get("name"),
                        )
                        continue
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
            "[checkin_scheduler] 本轮积分快照完成: 共 %d 个账号,成功 %d,失败 %d,"
            "冷却跳过 %d,无指标/未判定 %d",
            len(accounts),
            ok_count,
            fail_count,
            skip_count,
            na_count,
        )

    # ===== 单账号执行 =====

    async def checkin_one(self, account: dict[str, Any]) -> dict[str, Any]:
        """对单个账号执行签到(按 platform 分发引擎),并把引擎可能补齐的
        device_map 写回存储(Qoder 的自刷新新 token 也经此通路落库)。

        O64(2026-10-23):device_map 的凭证变化(refresh_token/expires_at) additionally
        回写号池(checkin_pool_writeback) —— 号池 = 凭证权威,签到刷新必须回流,
        否则号池拿旧 refresh_token 打官方白白消耗轮换次数。失败落待重试不阻塞。
        """
        device_map = dict(account.get("device_map") or {})
        # O64:凭证指纹快照(签到前)—— 引擎自刷新改写 refresh_token/expires_at
        # 时据此判定是否需要回写号池(CAS 双写不漂移的另一半)
        cred_before = checkin_pool_writeback.cred_fingerprint(device_map)
        platform = account.get("platform")
        # ── Qoder 凭证统一(2026-10-23):relay 池为唯一真源 ──
        # 签到前从 relay 拉最新票覆盖本地(避免用 checkin 侧过期/分叉票);
        # 刷新后统一回写 relay(唯一写点),checkin 侧不再独立轮换 refresh_token。
        qoder_cred: dict[str, Any] | None = None
        if platform == "qoder":
            _uid = str(device_map.get("uid") or account.get("uid") or "")
            qoder_cred = await checkin_store.load_qoder_cred(_uid)
            if qoder_cred:
                account = {**account, "jwt": qoder_cred["token"]}
                if qoder_cred.get("refresh_token"):
                    device_map["refresh_token"] = qoder_cred["refresh_token"]
                if qoder_cred.get("expires_at"):
                    device_map["expires_at"] = qoder_cred["expires_at"]
                _cosy = qoder_cred.get("cosy") or {}
                if _cosy:
                    _merged = dict(device_map.get("cosy") or {})
                    _merged.update({k: v for k, v in _cosy.items() if v})
                    device_map["cosy"] = _merged
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
                # WorkBuddy 每日 00:00(UTC+8)后随时可领,随零点/主窗口跑
                result = await checkin_workbuddy.workbuddy_checkin_account(
                    account["name"], account["jwt"], device_map, client=client
                )
            elif platform == "minimax":
                # MiniMax 每日随时可领(幂等),随零点/主窗口跑
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
        # 刷新回写 relay(唯一写点):引擎若轮换了票,把结果里的当前 token 同步回 relay
        if platform == "qoder" and qoder_cred is not None:
            _new_token = result.get("access_token")
            _new_rt = device_map.get("refresh_token")
            if _new_token and (
                _new_token != qoder_cred.get("token")
                or _new_rt != qoder_cred.get("refresh_token")
            ):
                try:
                    await checkin_store.save_qoder_cred(
                        str(device_map.get("uid") or account.get("uid") or ""),
                        str(_new_token),
                        str(_new_rt) if _new_rt else None,
                        int(device_map["expires_at"])
                        if isinstance(device_map.get("expires_at"), (int, float))
                        else None,
                    )
                except Exception as e:
                    logger.warning("[checkin_scheduler] qoder 凭证回写 relay 失败(忽略): %s", e)
        try:
            await checkin_store.save_device_map(account["id"], device_map)
        except Exception as e:
            logger.warning("[checkin_scheduler] device_map 写回失败(忽略): %s", e)
        # O64:凭证回写号池(签到刷新 → 号池 CAS 回流;失败落 device_map.pool_pending_cred
        # 下次重试,故 dirty 时需再持久化一次)。maybe_writeback 自身不抛,外层 try 双保险。
        try:
            dirty = await checkin_pool_writeback.maybe_writeback(
                device_map,
                cred_before,
                # 票主体 = account 上的 owner(run_checkin_now 由入参补齐;批量调度
                # 的 list_enabled_accounts 不 SELECT 该列 ⇒ None ⇒ 只发旧头)。
                owner_user_id=account.get("owner_user_id"),
            )
            if dirty:
                try:
                    await checkin_store.save_device_map(account["id"], device_map)
                except Exception as e:
                    logger.warning(
                        "[checkin_scheduler] 号池回写待推标记持久化失败(忽略): %s", e
                    )
        except Exception as e:
            logger.warning("[checkin_scheduler] 号池凭证回写异常(忽略): %s", e)
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
        # 号池凭证回写要内部票主体:owner 是本方法入参(承载层显式传入的真实值),
        # 原样带进 account 往下传 —— checkin_store.get_decrypted_jwt 的 SELECT 不含
        # 该列,故在调用点补齐,不在回写层编造/兜底身份。
        account = {**account, "owner_user_id": owner_user_id}
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

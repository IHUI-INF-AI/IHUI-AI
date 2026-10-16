# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到出站请求节流闸门(多账号风控第四件套,2026-10-16 立;第五件套 2026-10-16 增补)。

三件套(指纹/独立IP/批内错峰)只覆盖「定时批内」一条路径;手动一键签到、
积分快照、调度任务互相叠加时仍可能在同一毫秒对平台发多个请求。本闸门
把**进程内所有签到相关出站请求**(手动签到/定时签到/查余额)串行到一条
时间轴上:

- 全局随机间隔:每个请求放行前至少等 uniform(MIN, MAX)(env
  CHECKIN_OUTBOUND_MIN/MAX,默认 1.5~4.5s),任何两条出站请求之间恒有
  人类级间隔——手动连点、手动与定时叠加、批量查余额并发全部被压平。
- 全局暂停:平台回 429(SoftRate)时 pause() 把整条出站轴冻结 N 秒
  (默认 60s,对齐引擎 SoftRate 冷却);暂停期内 before_request 立即抛
  OutboundPaused(快速失败,绝不顶着 429 继续打)——调度批据此中止本轮,
  手动签到入口映射 429,积分查询映射失败说明。

第五件套(2026-10-16,挑战页/WAF 熔断):API 契约是 JSON,2xx 却拿到非
JSON 响应 = CDN/WAF 插页(人机挑战/拦截页),403 = 拦截墙——都是「平台
正在拦我们」的明确信号。note_challenge() 全局暂停(默认 300s,长于
429 档),各平台把该账号按 Challenge 即时冷却 30min;见
CHALLENGE_COOLDOWN_SECONDS 与 challenge_type()。

部署契约(钉死):本闸门是**进程级**单例,「全局」只在单进程内成立——
生产 uvicorn 必须单 worker(deploy/scripts/prod-bundle/svc/run-ai.ps1
有同文警告)。加 --workers 会让每个 worker 各持一套闸门与一份每日 job,
全局节流静默退化成各自为政,多账号同平台并发 = 风控面自杀。

调用约定:各平台 HTTP 发送函数(引擎 _http_post / qoder _api_call /
workbuddy / minimax / credits)在发请求前 await before_request(),
拿到响应后 note_status(status, label) 检测 429 自动 pause;解析点发现
2xx 非 JSON 时调 note_challenge(label)。

单 asyncio.Lock 串行取槽:等待者各自睡到自己的槽位,互不阻塞事件循环。
"""

from __future__ import annotations

import asyncio
import os
import random
import time

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

# 429 触发的全局暂停时长(秒);pause() 未显式给秒数时用此默认
_DEFAULT_PAUSE_ENV = "CHECKIN_RATE_LIMIT_PAUSE"
_DEFAULT_PAUSE = 60.0

# 间隔上下界环境变量名(运行时读取:测试用 monkeypatch.setenv 即可生效)
_MIN_GAP_ENV = "CHECKIN_OUTBOUND_MIN"
_MAX_GAP_ENV = "CHECKIN_OUTBOUND_MAX"
_MIN_GAP_DEFAULT = 1.5
_MAX_GAP_DEFAULT = 4.5

# ─── 第五件套:挑战页/WAF 熔断(2026-10-16)──────────────────────────────
# 单账号 Challenge 冷却时长:30 分钟。跨模块共用(引擎/四平台 classify 与
# 编排层都从这里取,禁各处字面量)。封号风险面前,被挑战的账号半小时内
# 不再出现在任何出站路径上。
CHALLENGE_COOLDOWN_SECONDS = 1800

# 挑战墙状态码:403=拦截墙(WAF/权限墙),418=I'm a teapot(部分 WAF 玩梗
# 拦截码)。2xx 非 JSON 的判定在各平台响应解析点(那里才看得见 body),
# 不在此集合。
_CHALLENGE_STATUSES = frozenset({403, 418})

# 挑战触发的全局暂停时长(默认 300s,长于 429 的 60s:被挑战说明平台正在
# 主动拦截我们,停手时间必须更久)
_CHALLENGE_PAUSE_ENV = "CHECKIN_CHALLENGE_PAUSE"
_CHALLENGE_PAUSE_DEFAULT = 300.0

# 限流/挑战告警(可选,默认关):env CHECKIN_ALERT_WEBHOOK 设为 webhook URL
# (Server酱 https://sctapi.ftqq.com/<SENDKEY>.send 兼容 form 提交)后,
# 每次全局暂停经该 URL 异步通知( title/desp )。未设置 = 零行为变化。
# fail-open:任何异常只吞掉;同一 kind 10 分钟去重,防暂停风暴炸群。
_ALERT_WEBHOOK_ENV = "CHECKIN_ALERT_WEBHOOK"
_ALERT_MIN_INTERVAL = 600.0
_alert_last_sent: dict[str, float] = {}
_alert_tasks: set[asyncio.Task[None]] = set()


class OutboundPaused(RuntimeError):
    """出站处于 429 全局暂停期:调用方应立刻停手(调度中止/手动 429/查询失败)。"""

    def __init__(self, remaining: float) -> None:
        self.remaining = remaining
        super().__init__(f"签到出站限流冷却中({remaining:.0f}s)")


def challenge_type(http_status: int | None) -> str | None:
    """状态码是否挑战墙信号(第五件套,纯函数,供 trae/qoder classify 取用)。

    403 = WAF/权限墙,418 = 部分 WAF 的拦截码。workbuddy/minimax 的
    403 有各自的 token 过期语义(SessionDead 永久冷却,比 Challenge 更保守),
    那两个平台不取用本函数。2xx 非 JSON 的挑战页判定在各平台响应解析点
    (那里才看得见 body),不在此函数。
    """
    return "Challenge" if http_status in _CHALLENGE_STATUSES else None


def _challenge_pause_seconds() -> float:
    """挑战全局暂停时长(env 运行时读;非法/非正回退默认 300s)。"""
    try:
        secs = float(os.environ.get(_CHALLENGE_PAUSE_ENV, str(_CHALLENGE_PAUSE_DEFAULT)))
    except ValueError:
        return _CHALLENGE_PAUSE_DEFAULT
    return secs if secs > 0 else _CHALLENGE_PAUSE_DEFAULT


async def _post_alert(url: str, kind: str, text: str) -> None:
    """告警投递(Server酱兼容 form:title/desp)。fail-open:异常只吞。"""
    try:
        async with httpx.AsyncClient(timeout=8.0, trust_env=False) as client:
            await client.post(url, data={"title": f"[签到风控] {kind}", "desp": text})
    except Exception as e:  # noqa: BLE001 — 告警链路任何失败都不得影响签到主链路
        logger.warning("[checkin-gate] 告警发送失败(忽略): %s", e)


def _fire_alert(kind: str, text: str) -> None:
    """按需发一条限流/挑战告警(同步入口,内部转异步任务)。

    env 未设 webhook = 直接返回(零行为变化);同一 kind 10 分钟去重;
    无运行中事件循环(同步测试上下文)时放弃告警,不阻断调用方。
    """
    url = os.environ.get(_ALERT_WEBHOOK_ENV, "").strip()
    if not url:
        return
    now = time.monotonic()
    if now - _alert_last_sent.get(kind, 0.0) < _ALERT_MIN_INTERVAL:
        return
    _alert_last_sent[kind] = now
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    task = loop.create_task(_post_alert(url, kind, text))
    _alert_tasks.add(task)
    task.add_done_callback(_alert_tasks.discard)


def _gap_bounds() -> tuple[float, float]:
    """当前间隔上下界(env 运行时读;非法/倒置回退默认)。"""
    try:
        lo = float(os.environ.get(_MIN_GAP_ENV, str(_MIN_GAP_DEFAULT)))
        hi = float(os.environ.get(_MAX_GAP_ENV, str(_MAX_GAP_DEFAULT)))
    except ValueError:
        return _MIN_GAP_DEFAULT, _MAX_GAP_DEFAULT
    if lo < 0 or hi < lo:
        return _MIN_GAP_DEFAULT, _MAX_GAP_DEFAULT
    return lo, hi


class OutboundGate:
    """进程级出站节流 + 限流暂停(单例见模块尾)。"""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._next_slot: float = 0.0
        self._paused_until: float = 0.0

    def paused_remaining(self) -> float:
        """全局暂停剩余秒数(0 = 未在暂停)。手动入口据此快速失败回 429。"""
        return max(0.0, self._paused_until - time.monotonic())

    async def before_request(self, label: str = "") -> None:
        """请求前占槽:暂停中立即抛 OutboundPaused;否则等到自己的槽位再放行。"""
        remaining = self.paused_remaining()
        if remaining > 0:
            raise OutboundPaused(remaining)
        lo, hi = _gap_bounds()
        async with self._lock:
            now = time.monotonic()
            # 取锁期间可能刚被 pause —— 复查,防暂停窗口内的排队请求漏出去
            remaining = self.paused_remaining()
            if remaining > 0:
                raise OutboundPaused(remaining)
            start = max(now, self._next_slot)
            gap = random.uniform(lo, hi)
            self._next_slot = start + gap
            wait = start - now
        if wait > 0:
            logger.info("[checkin-gate] 出站节流等待 %.1fs", wait, platform=label)
            await asyncio.sleep(wait)

    def note_status(self, status: int | None, label: str = "") -> None:
        """响应后检测:HTTP 429 → 全局暂停(被限流就立刻停手)。"""
        if status == 429:
            self.pause(reason=f"{label or 'checkin'} 返回 429")

    def note_challenge(self, label: str = "") -> None:
        """检测到挑战页/WAF 拦截(第五件套):全局暂停,默认 300s。

        由各平台响应解析点在「2xx 非 JSON」时调用;403 的挑战语义经
        challenge_type() 进 classify,再经调度层 record_result 的
        Challenge 分支落单账号冷却与本暂停,路径不重复。
        """
        self.pause(seconds=_challenge_pause_seconds(), reason=f"{label or 'checkin'} 挑战页/WAF 拦截")

    def pause(self, seconds: float | None = None, reason: str = "") -> None:
        """全局暂停出站(可叠加,取更晚的截止)。seconds 缺省用 429 默认档。"""
        if seconds is None or seconds <= 0:
            try:
                secs = float(os.environ.get(_DEFAULT_PAUSE_ENV, str(_DEFAULT_PAUSE)))
            except ValueError:
                secs = _DEFAULT_PAUSE
            if secs <= 0:
                secs = _DEFAULT_PAUSE
        else:
            secs = seconds
        self._paused_until = max(self._paused_until, time.monotonic() + secs)
        logger.warning("[checkin-gate] 出站全局暂停 %.0fs: %s", secs, reason)
        _fire_alert("出站全局暂停", f"签到出站已全局暂停 {secs:.0f}s:{reason or '未注明'}")

    def reset(self) -> None:
        """清空节流与暂停状态(仅测试用;连告警去重记忆一起清,例间零串扰)。"""
        self._next_slot = 0.0
        self._paused_until = 0.0
        _alert_last_sent.clear()


checkin_outbound_gate = OutboundGate()

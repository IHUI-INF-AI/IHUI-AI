# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到出站请求节流闸门(多账号风控第四件套,2026-10-16 立)。

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

调用约定:各平台 HTTP 发送函数(引擎 _http_post / qoder _http /
workbuddy / minimax / credits)在发请求前 await before_request(),
拿到响应后 note_status(status, label) 检测 429 自动 pause。

单 asyncio.Lock 串行取槽:等待者各自睡到自己的槽位,互不阻塞事件循环。
"""

from __future__ import annotations

import asyncio
import os
import random
import time

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


class OutboundPaused(RuntimeError):
    """出站处于 429 全局暂停期:调用方应立刻停手(调度中止/手动 429/查询失败)。"""

    def __init__(self, remaining: float) -> None:
        self.remaining = remaining
        super().__init__(f"签到出站限流冷却中({remaining:.0f}s)")


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

    def reset(self) -> None:
        """清空节流与暂停状态(仅测试用)。"""
        self._next_slot = 0.0
        self._paused_until = 0.0


checkin_outbound_gate = OutboundGate()

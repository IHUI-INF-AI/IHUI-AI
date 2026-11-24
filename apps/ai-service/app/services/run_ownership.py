# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0-O19(2026-09-21 立):run/session 属主登记表 —— SSE 事件流按用户过滤的唯一事实源。

背景(实测复现的越权链):`GET /api/agents/tasks/stream` 的事件源是 hook_engine 的
**进程级广播**,任何在跑的 agent 循环都会往同一批订阅队列里塞事件。旧实现只在显式
传 `agentId` 时按 `session_id`/`run_id` 过滤,`agentId=""` 时把**所有人**的实时工具
事件原样转发给匿名调用方 —— 属主信息在事件链路里根本不存在,于是无从判定"这条事件
是谁的"。本模块补齐的正是这块缺失的事实:run 启动时登记 `session_id/run_id → user_id`,
事件流侧据此过滤。

设计约束:
- **只存进程内事实**:登记表是内存态(带 TTL + 容量上限),不接管持久层属主。
  进程重启即失忆,因此调用方在"查不到属主"时**不得**当作"无主可放行",而应按
  fail-closed 处理(事件流不转发)。这是刻意选择:漏转发只是功能降级,漏放行是泄漏。
- **登记/清理成对**:与 `agent_loop_v2._approval_registry` 同一套清理纪律 ——
  登记在 run 启动处,释放在 run 结束的 finally,另加 TTL/容量兜底,防长期泄漏。
"""

from __future__ import annotations

import time
from dataclasses import dataclass

# 属主记录最长存活时间。取 2h:远大于单次 agent run 的常见时长(approval 超时 60s、
# 迭代上限 8~数十轮),又足以让"忘记 release"的路径在小时级内自愈。
_DEFAULT_TTL_SECONDS: float = 2 * 60 * 60.0
# 容量硬上限:防止异常流量把登记表撑成无界 dict(超限先清过期,再按写入序淘汰最旧)。
_MAX_ENTRIES: int = 20_000


@dataclass(frozen=True)
class _OwnerRecord:
    user_id: str
    expires_at: float


# key = session_id 或 run_id(两者在事件 payload 里语义等价,workbench 用同一 id)
_owners: dict[str, _OwnerRecord] = {}


def _purge_expired(now: float) -> None:
    """清理过期条目(O(1) 摊销:仅在写入路径触发,读路径不做全表扫描)。"""
    expired = [k for k, rec in _owners.items() if rec.expires_at <= now]
    for k in expired:
        _owners.pop(k, None)


def record_ownership(key: str, user_id: str, *, ttl: float = _DEFAULT_TTL_SECONDS) -> None:
    """登记一个 run/session 标识归属于 user_id。空标识或空属主一律忽略(不制造伪记录)。"""
    if not key or not user_id:
        return
    now = time.monotonic()
    if len(_owners) >= _MAX_ENTRIES:
        _purge_expired(now)
        # 清完仍超限(极端突发流量):按插入序淘汰最旧条目,保证有界内存
        while len(_owners) >= _MAX_ENTRIES:
            _owners.pop(next(iter(_owners)), None)
    _owners[key] = _OwnerRecord(user_id=user_id, expires_at=now + ttl)


def owner_of(key: str | None) -> str | None:
    """查属主;无记录/已过期一律返回 None(调用方必须 fail-closed,不得当作公共数据)。"""
    if not key:
        return None
    rec = _owners.get(key)
    if rec is None:
        return None
    if rec.expires_at <= time.monotonic():
        _owners.pop(key, None)
        return None
    return rec.user_id


def release_ownership(key: str | None) -> None:
    """run 结束时释放登记(与 record_ownership 成对调用,防内存泄漏)。"""
    if key:
        _owners.pop(key, None)


def clear_all() -> None:
    """清空登记表(仅测试用)。"""
    _owners.clear()


def entry_count() -> int:
    """当前登记条目数(仅测试/自检用)。"""
    return len(_owners)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

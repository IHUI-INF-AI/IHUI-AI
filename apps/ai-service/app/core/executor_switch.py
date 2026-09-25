# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D6① 多 agent 编排栈收敛开关(试点,默认 off)。

背景(2026-09-26 立票):仓库内并存多套编排实现
(routers/orchestration.py + services/orchestration_hub.py 事件中枢、
services/agent_orchestrator.py 旧多 agent 引擎、routers/team_orchestration.py
团队协作、apps/api 侧 agents-kanban / subagent-dispatch),而
services/agent_loop_v2.py 是收敛候选。**本模块只做"判定",不做"切换"**:
所有现网路径的默认档 = `legacy`(现状行为),把"是否向 agent_loop_v2 收敛"
变成一处可读、可灰度、可单测的决策点。

三条红线(与"未实现前默认绝不能是 enforce"同族):
1. ``DEFAULT_MODE`` 恒为 ``legacy`` —— 环境变量缺失/空/未识别值一律回 legacy,
   绝不默认命中新执行器;
2. 本模块**无副作用**:不 import settings / 任何 service(避免循环),只读
   传入或 ``os.environ`` 的字符串;
3. 开新档(loop_v2)时收敛路径尚未实现,故 ``guard_loop_v2_pilot`` **显式抛错**
   而不是静默走旧路径 —— 开关必须"有牙":设成 loop_v2 却什么都感知不到,
   等于造一台恒假的摆设(反向对照用例钉死这一点)。

灰度语义(后续批次按会话/按租户放量用,本票不启用):
- ``ORCHESTRATION_CONVERGENCE_EXECUTOR``:全局档,``legacy``(默认)/``loop_v2``;
- ``ORCHESTRATION_CONVERGENCE_SESSIONS``:逗号分隔 session id 白名单,命中 ⇒ 该
  请求按 loop_v2 判定(细粒度优先于全局);
- ``ORCHESTRATION_CONVERGENCE_TENANTS``:同上,租户维度。
注意与既有 ``AGENT_EXECUTOR``(routers/agents.py 的 execute/stream 执行器三档
语义,缺省即 v2)是**两个独立开关**,本票不改它的任何语义。
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Final, Literal

ConvergenceMode = Literal["legacy", "loop_v2"]

MODE_LEGACY: Final[ConvergenceMode] = "legacy"
MODE_LOOP_V2: Final[ConvergenceMode] = "loop_v2"

#: 缺省档:现状行为(旧编排栈)。任何解析失败都回落到它。
DEFAULT_MODE: Final[ConvergenceMode] = MODE_LEGACY

EXECUTOR_ENV: Final[str] = "ORCHESTRATION_CONVERGENCE_EXECUTOR"
SESSIONS_ENV: Final[str] = "ORCHESTRATION_CONVERGENCE_SESSIONS"
TENANTS_ENV: Final[str] = "ORCHESTRATION_CONVERGENCE_TENANTS"

#: 新档被命中时错误消息的稳定前缀(测试与日志检索都用它,不得改动)。
PILOT_ERROR_MARKER: Final[str] = "AGENT_LOOP_V2_PILOT_NOT_WIRED"


class LoopV2ConvergencePilotError(RuntimeError):
    """收敛开关被置为 loop_v2,但收敛执行器尚未落地(D6① 试点期)。

    刻意抛错而非回退旧路径:回退会让"打开开关"成为一个无观测的动作。
    """

    def __init__(self, surface: str, mode: str) -> None:
        super().__init__(
            f"{PILOT_ERROR_MARKER}: surface={surface} decided_mode={mode} — "
            "向 agent_loop_v2 收敛的适配层尚未承载执行(D6① 试点),拒绝静默回退旧编排栈"
        )
        self.surface = surface
        self.decided_mode = mode


def _normalize_raw(raw: str | None) -> str:
    """None/空串归一为空(供 == '' 判断);其余 strip().lower()。"""
    if raw is None:
        return ""
    return raw.strip().lower()


def parse_convergence_mode(raw: str | None) -> ConvergenceMode:
    """把环境变量原文解析为档位;未识别值一律 legacy(宁回退不误切)。"""
    val = _normalize_raw(raw)
    if val in (MODE_LOOP_V2, "v2", "agent_loop_v2"):
        return MODE_LOOP_V2
    return DEFAULT_MODE


def parse_allowlist(raw: str | None) -> frozenset[str]:
    """逗号分隔白名单 → 去空白、去空项的不可变集合。"""
    if raw is None:
        return frozenset()
    return frozenset(item.strip() for item in raw.split(",") if item.strip())


def resolve_convergence_mode(
    env: Mapping[str, str],
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> ConvergenceMode:
    """纯函数版决策:细粒度白名单(会话/租户)优先,其后看全局档。

    ``env`` 显式传入以便单测零 monkeypatch;运行时入口用 ``get_convergence_mode``。
    """
    if session_id and session_id in parse_allowlist(env.get(SESSIONS_ENV, "")):
        return MODE_LOOP_V2
    if tenant_id and tenant_id in parse_allowlist(env.get(TENANTS_ENV, "")):
        return MODE_LOOP_V2
    return parse_convergence_mode(env.get(EXECUTOR_ENV))


def get_convergence_mode(
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> ConvergenceMode:
    """从 os.environ 读档的便捷入口(行为与 resolve_* 传 os.environ 全等)。"""
    return resolve_convergence_mode(os.environ, session_id=session_id, tenant_id=tenant_id)


def is_loop_v2_convergence_enabled(
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> bool:
    """收敛档是否被命中(默认恒 False)。"""
    return get_convergence_mode(session_id=session_id, tenant_id=tenant_id) == MODE_LOOP_V2


def guard_loop_v2_pilot(
    surface: str,
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> None:
    """各编排栈入口的接线点:默认档直接返回(零侵入);命中 loop_v2 时显式抛错。

    ``surface`` 为稳定标识(如 "agent_orchestrator._run_agent"),进错误消息,
    供后续批次把"哪些入口已接线"变成机器可对账的事实。
    """
    if is_loop_v2_convergence_enabled(session_id=session_id, tenant_id=tenant_id):
        raise LoopV2ConvergencePilotError(surface, MODE_LOOP_V2)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

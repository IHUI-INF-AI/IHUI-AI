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
2. 本模块**模块级无副作用**:不 import settings / 任何 service(避免循环),
   只读传入或 ``os.environ`` 的字符串。唯一例外是 ``take_loop_v2_handoff`` 里
   **函数体内**的惰性 import —— 它只在"新档被显式选中 ∧ 该接线点已登记为消费者"
   两个条件同时成立时才发生,默认档一次也不会执行(由测试
   ``test_default_mode_never_imports_adapter`` 钉死);
3. 开新档(loop_v2)时的收敛执行器本体在 ``LOOP_V2_ADAPTER_MODULE`` 的
   ``LOOP_V2_ADAPTER_FUNC``(G1,2026-09-27 落地:真构造并真跑 AgentLoopV2)。
   但**接线点尚未改成消费 handoff 之前**,``guard_loop_v2_pilot`` 仍**显式抛错**
   而不是静默返回 —— 因为四个现存调用点都是"裸语句 + 依赖抛错中断旧路径"的形状
   (surface 名 ``agent_orchestrator._run_agent`` /
   ``orchestration_hub._call_pillar_action[subagent]`` /
   ``routers/orchestration.emit_event`` / ``routers/team_orchestration.run_team_round``),
   守卫一旦不抛,旧循环紧接着又跑一遍 =
   **双重执行**,比占位错误更坏。开关必须"有牙":设成 loop_v2 却什么都感知不到,
   等于造一台恒假的摆设(反向对照用例钉死这一点)。
   一个接线点从"抛错"变成"真执行"的**唯一合法姿势**:把它的 surface 名加进
   ``HANDOFF_CONSUMER_SURFACES``,并在该点改调 ``await take_loop_v2_handoff(...)``
   消费返回值(两件事必须同一枚提交,只做一半要么双重执行要么永不执行 —— 由
   ``test_registry_and_source_agree`` 双向对账钉住,登记表腐烂与消费者漏登记都红)。

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
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from importlib import import_module
from typing import Any, Final, Literal, cast

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

#: 收敛执行器本体的落点(G1,2026-09-27)。用**字符串**而非直接 import 声明:
#: 模块级 import 会把 services.agent_loop_v2 拖进 core 层的导入图(红线 2),
#: 而字符串既让"适配器在哪"成为一处可读事实,也允许测试 monkeypatch 该属性。
LOOP_V2_ADAPTER_MODULE: Final[str] = "app.services.agent_loop_v2"
LOOP_V2_ADAPTER_FUNC: Final[str] = "run_converged_agent"

#: 适配器在 handoff 上打的引擎标签(下游按它区分"真 v2"与"旧编排栈")。
LOOP_V2_ENGINE_TAG: Final[str] = "agent_loop_v2"

#: 已改成"消费 handoff"的接线点清单。**空 = 一个都没有**,于是 loop_v2 档在
#: 四个现存 surface 上仍然抛 ``PILOT_ERROR_MARKER``(防双重执行)。
#: 加一条的**同时**必须把那个调用点改成 ``await take_loop_v2_handoff(...)``;
#: 只做一半 = 要么双重执行、要么永不执行,两种都由
#: tests/test_executor_switch_v2_wired.py 的登记↔源码双向对账判红。
HANDOFF_CONSUMER_SURFACES: Final[frozenset[str]] = frozenset()


class LoopV2ConvergencePilotError(RuntimeError):
    """收敛开关被置为 loop_v2,但**该接线点**还不能安全地走新执行器。

    刻意抛错而非回退旧路径:回退会让"打开开关"成为一个无观测的动作。

    三种真实原因(都保留同一 ``PILOT_ERROR_MARKER`` 前缀,便于检索):
    1. surface 未登记进 ``HANDOFF_CONSUMER_SURFACES`` —— 它仍是"裸语句调守卫"
       的形状,不抛就会紧接着跑旧循环(双重执行);
    2. surface 已登记却仍调 ``guard_loop_v2_pilot`` —— 同一枚提交只做了一半;
    3. 调 ``take_loop_v2_handoff`` 却没给投影入参 —— 空 system_prompt 跑出个
       "看起来执行了"的空循环,比抛错更坏。
    """

    def __init__(self, surface: str, mode: str, reason: str | None = None) -> None:
        detail = (
            f"{PILOT_ERROR_MARKER}: surface={surface} decided_mode={mode} — "
            "该接线点尚未把执行交给收敛执行器,拒绝静默回退旧编排栈(D6①/G1)"
        )
        if reason:
            detail = f"{detail} | reason={reason}"
        super().__init__(detail)
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
    """各编排栈入口的**旧形状**接线点:默认档直接返回(零侵入);命中 loop_v2 时显式抛错。

    ``surface`` 为稳定标识(如 "agent_orchestrator._run_agent"),进错误消息,
    供后续批次把"哪些入口已接线"变成机器可对账的事实。

    ⚠️ 本函数**永远不会**去跑新执行器:它没有返回值可交,唯一能中断旧路径的手段
    就是抛错。要让某个接线点真的走 v2,改用 ``take_loop_v2_handoff`` 并把该 surface
    登记进 ``HANDOFF_CONSUMER_SURFACES``(两件事必须同一枚提交)。
    """
    if not is_loop_v2_convergence_enabled(session_id=session_id, tenant_id=tenant_id):
        return
    reason = (
        "该 surface 已登记为 handoff 消费者却仍调用裸守卫(同一枚提交只做了一半)"
        if surface in HANDOFF_CONSUMER_SURFACES
        else "该 surface 未登记进 HANDOFF_CONSUMER_SURFACES,不抛就会紧接着跑旧循环"
    )
    raise LoopV2ConvergencePilotError(surface, MODE_LOOP_V2, reason)


@dataclass(frozen=True)
class LoopV2Handoff:
    """``take_loop_v2_handoff`` 的产物:一次**真执行完**的 v2 结果。

    ``step_result`` 的键集合与旧编排栈的 ``AgentStepResult`` **逐字段同形**
    (agent_name/input/output/status/duration_ms/iterations/tool_calls/error),
    所以接线点可以直接 ``AgentStepResult(**handoff.step_result)`` —— 多一个键
    就会在那一行 TypeError,这条由测试 ``test_step_result_is_consumable`` 钉死。
    引擎侧的诊断(stop_reason / trace 等)放在 handoff 自己的字段里,不混进
    ``step_result``,避免把"响应形状不变"这条红线捅破。
    """

    surface: str
    decided_mode: str
    engine: str
    step_result: dict[str, Any]
    stop_reason: str | None = None
    total_tokens_used: int | None = None
    checkpoint_id: str | None = None
    compaction_events: list[dict[str, Any]] = field(default_factory=list)


#: 适配器签名(只为 mypy --strict 而声明;运行期由 getattr 取到的函数满足即可)。
_LoopV2Adapter = Callable[..., Awaitable[dict[str, Any]]]


def _resolve_loop_v2_adapter() -> _LoopV2Adapter:
    """按字符串落点取收敛执行器本体(函数级 import:模块级 import 会破坏红线 2)。

    取不到模块 / 取不到函数 **一律抛错并点名落点**,绝不"降级回旧路径" ——
    那会把"适配器被摘线"这一格伪装成"开关没打开"。
    """
    try:
        module = import_module(LOOP_V2_ADAPTER_MODULE)
    except ImportError as e:  # pragma: no cover - 只在落点被搬走时触发
        raise LoopV2ConvergencePilotError(
            LOOP_V2_ADAPTER_MODULE,
            MODE_LOOP_V2,
            f"收敛执行器模块取不到:{LOOP_V2_ADAPTER_MODULE} ({e})",
        ) from e
    adapter = getattr(module, LOOP_V2_ADAPTER_FUNC, None)
    if not callable(adapter):
        raise LoopV2ConvergencePilotError(
            LOOP_V2_ADAPTER_MODULE,
            MODE_LOOP_V2,
            f"收敛执行器函数不在位:{LOOP_V2_ADAPTER_MODULE}.{LOOP_V2_ADAPTER_FUNC}",
        )
    return cast("_LoopV2Adapter", adapter)


async def take_loop_v2_handoff(
    surface: str,
    *,
    agent_name: str = "",
    system_prompt: str = "",
    tool_names: Sequence[str] | None = None,
    model: str | None = None,
    max_iterations: int = 5,
    user_input: str = "",
    session_id: str | None = None,
    tenant_id: str | None = None,
    user_id: str | None = None,
    user_role: int = 0,
    permission_mode: str | None = None,
    progress_callback: Callable[[dict[str, Any]], Any] | None = None,
) -> LoopV2Handoff | None:
    """接线点的**新形状**入口:命中 loop_v2 就真的用 AgentLoopV2 跑一趟。

    返回值语义(调用方必须消费,否则等于没接线):
      - ``None`` —— 档位是 legacy,调用方**照旧**跑自己的旧路径(默认档行为一字未改);
      - ``LoopV2Handoff`` —— 新执行器已经跑完,调用方**必须立即 return** 它的结果,
        不得再跑旧循环。

    身份口径(AGENTS §5"认证不等于授权"在收敛链上的落点):
      - ``user_id`` / ``user_role`` 只能由**承载层显式入参**传进来,本函数绝不从
        被点名的 session/agent 记录里反推 principal;``user_role`` 默认 0 = fail-closed;
      - ``user_id=None`` 是**回退**(与改动前旧编排栈"无属主记忆"同形),
        不是"已授权"的结论 —— 记忆隔离与审批属主登记会因此不生效,调用方须自行保证
        在已鉴权的承载层里传真实主体。

    抛错而不是静默的三档见 ``LoopV2ConvergencePilotError`` 文档。
    """
    mode = get_convergence_mode(session_id=session_id, tenant_id=tenant_id)
    if mode != MODE_LOOP_V2:
        return None
    if surface not in HANDOFF_CONSUMER_SURFACES:
        raise LoopV2ConvergencePilotError(
            surface,
            mode,
            "该 surface 未登记进 HANDOFF_CONSUMER_SURFACES,拒绝执行新执行器"
            "(裸语句调守卫的旧接线点若在这里改跑 v2,旧循环仍会再跑一遍 = 双重执行)",
        )
    if not agent_name or not system_prompt.strip():
        raise LoopV2ConvergencePilotError(
            surface,
            mode,
            "缺少 AgentDefinition 投影入参(agent_name/system_prompt),"
            "空提示词跑出来的结果不可信,拒绝执行",
        )
    adapter = _resolve_loop_v2_adapter()
    projected = await adapter(
        agent_name=agent_name,
        system_prompt=system_prompt,
        user_input=user_input,
        tool_names=list(tool_names) if tool_names is not None else None,
        model=model,
        max_iterations=max_iterations,
        session_id=session_id,
        user_id=user_id,
        user_role=user_role,
        permission_mode=permission_mode,
        progress_callback=progress_callback,
    )
    step_result = projected.get("step_result")
    diagnostics = projected.get("diagnostics") or {}
    if not isinstance(step_result, dict):
        # 适配器返回形状坏了要**大声失败**:把"没跑成"写成"跑了且是空结果"
        # 是本仓最高频的失效型(见 AGENTS §30"没有终态就写已完成")。
        raise LoopV2ConvergencePilotError(
            surface,
            mode,
            f"收敛执行器返回形状不含 step_result(dict),实际键={sorted(projected)}",
        )
    return LoopV2Handoff(
        surface=surface,
        decided_mode=mode,
        engine=str(diagnostics.get("engine") or LOOP_V2_ENGINE_TAG),
        step_result=step_result,
        stop_reason=diagnostics.get("stop_reason"),
        total_tokens_used=diagnostics.get("total_tokens_used"),
        checkpoint_id=diagnostics.get("checkpoint_id"),
        compaction_events=list(diagnostics.get("compaction_events") or []),
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent 路由(9 端点)。

提供 agent 执行、状态查询、取消、trace 可视化,以及会话记忆管理。
新增 SSE 流式执行端点(事件缓冲 + 断线重连重放 + SSE event 字段 + 心跳保活)。
L5-10(2026-08-12):AgentLoopV2 执行器(env AGENT_EXECUTOR=loop_v2 启用,
重试/错误分类/元学习/事件总线),MCP 工具包装 + OpenAI tool_calls 格式转换。
"""

import asyncio
import json
import logging
import os
import re
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core.jwt_auth import require_request_user_id, resolve_request_role_id
from ..core.sse_buffer import REPLAY_HIT, sse_buffer

# D174/R3:帧级 traceId 的唯一注入点(与 llm 那条对话流共用一份实现,不在本路由再抄一遍判序)
from ..core.sse_frames import with_frame_trace_id
from ..services.agent_checkpoint import AgentLoopCheckpoint
from ..services.agent_deliverables import get_deliverables
from ..services.agent_events import (
    AGENT_SUBSCRIBE_EVENTS,
    HOOK_ERROR,
    HOOK_MESSAGE_RECEIVE,
    HOOK_PERMISSION_MODE,
    HOOK_PLAN_STEP,
    HOOK_SELF_HEAL,
    HOOK_SESSION_END,
    HOOK_SESSION_START,
    HOOK_THINKING_DELTA,
    HOOK_TOOL_AFTER,
    HOOK_TOOL_APPROVAL,
    HOOK_TOOL_BEFORE,
    SSE_DONE,
    SSE_ERROR,
    SSE_MESSAGE,
    SSE_START,
    map_hook_event_to_sse,
)
from ..services.agent_loop import agent_executor
from ..services.agent_orchestrator import AgentOrchestrator, agent_orchestrator
from ..services.agent_run_control import (
    PauseOutcome,
    ResumeOutcome,
    SessionNotFoundError,
    detach_run,
    pause_session,
    register_run,
    resume_session,
)

# V3 #84 生产者侧(2026-10-07):视野硬上限唯一真源,Field(le=) 直接引它,不抄第二份数字。
from ..services.durable_resume import DURABLE_HORIZON_MAX_SECONDS
from ..services.goal_completion_gate import (
    GoalCriterionSpec,
    GoalCriterionSpecError,
    gate_goal_completion,
    validate_specs,
)
from ..services.memory import memory_store
from ..services.run_ownership import owner_of, record_ownership, release_ownership
from ..services.skills import skill_evolution_service
from ..services.vector_memory import vector_memory

if TYPE_CHECKING:
    # 仅类型注解使用(运行时在函数内延迟导入,避免循环依赖)
    from ..services.agent_loop_v2 import AgentLoopResult, AgentLoopV2
    from ..services.mcp_tool_aggregator import SuperToolPool

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# L5-10 AgentLoopV2 执行器接线(2026-08-12 立)
# ---------------------------------------------------------------------------


def _convert_openai_tool_calls(
    tc_list: Any,
) -> list[dict[str, Any]] | None:
    """llm_gateway 返回的 OpenAI 格式 tool_calls → AgentLoopV2 格式。

    OpenAI: [{id, type, function: {name, arguments: JSON字符串}}]
    AgentLoopV2: [{id, name, args: dict}]
    """
    if not tc_list:
        return None
    result: list[dict[str, Any]] = []
    for tc in tc_list:
        if not isinstance(tc, dict):
            continue
        fn = tc.get("function") or {}
        args_raw = fn.get("arguments") or "{}"
        if isinstance(args_raw, str):
            try:
                args = json.loads(args_raw)
            except (ValueError, TypeError):
                args = {}
        else:
            args = args_raw
        result.append(
            {"id": tc.get("id", ""), "name": fn.get("name", ""), "args": args}
        )
    return result or None


def _shorten_description(desc: str, limit: int = 80) -> str:
    """把工具完整描述压缩成一行短描述(deferral 用,返回长度 ≤ limit 字符)。

    规则:
    - 取首行(按 \\n 切分)并去首尾空白,避免把多行说明/参数细节塞进上下文;
    - 去掉常见 markdown 前缀符号(# * ` > -)与行内 ` * _ 包裹,降低噪声;
    - 若清洗后为空(原文为空或纯 markdown 符号),回退为通用占位,
      避免在上下文里塞入空串导致模型误判;
    - 超长(>limit)截断并在尾部加 "…",保证返回长度严格 ≤ limit。
    """
    placeholder = "（工具描述暂无）"
    if not desc:
        return placeholder[:limit]
    first_line = desc.split("\n", 1)[0].strip()
    # 去除行首 markdown 前缀符号
    cleaned = re.sub(r"^[\s#*>`\-]+", "", first_line)
    # 去除行内 ` * _ 包裹符号
    cleaned = re.sub(r"[`*_]{1,2}", "", cleaned).strip()
    if not cleaned:
        return placeholder[:limit]
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: max(1, limit - 1)].rstrip() + "…"


# deferral 模式下,精简工具描述尾部统一追加的"取完整参数"提示(配合内置
# get_tool_schema 工具)。长度固定,供 _build_loop_v2_tools 预留尾部空间。
_TOOL_DEFERRAL_SUFFIX = " 〔完整参数用 get_tool_schema 查询〕"


def _is_tool_deferral_enabled() -> bool:
    """工具定义 deferral 开关(env TOOL_DEFERRAL,默认 on)。

    on/1/true/yes → 启用(只把短描述+占位参数放进上下文,完整 schema 按需反查);
    其他值(如 off)→ 关闭,行为与历史完全一致(完整 description + 完整 parameters)。
    """
    return os.environ.get("TOOL_DEFERRAL", "on").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _is_supertool_enabled() -> bool:
    """超级工具聚合器开关(env AGENT_SUPERTOOL_ENABLED,默认 on)。

    on/1/true/yes → 启用:存在已连接外部 MCP server 时,把内置 _TOOLS 与外部工具
    经 MCPSuperToolAggregator 去重/仲裁,以统一 manifest 暴露;无外部 server 或
    聚合异常时自动降级到现有路径(工具清单逐字节等价)。其他值 → 关闭。
    """
    return os.environ.get("AGENT_SUPERTOOL_ENABLED", "on").strip().lower() in (
        "on", "1", "true", "yes",
    )


# 内置工具在聚合器中的来源名(与外部 MCP server 名区分,避免 key 冲突)
_SUPERTOOL_INTERNAL_SOURCE = "__builtin__"


async def _build_supertool_pool(
    tool_names: list[str] | None, user_id: str
) -> "SuperToolPool | None":
    """聚合内置 + **该会话主体看得见的**外部 MCP 工具为统一超级工具池。

    仅在开关开启且存在已连接外部 MCP server 时返回非 None pool;否则(开关关闭 /
    无外部 server / 任意聚合异常)返回 None,调用方据此降级到现有工具装配路径。

    `user_id` 是必填的(G-371 格①,机主 2026-09-29 拍"隔离"):工具池此前把**所有人**注册的
    外部 server 混进每一个会话 —— 别人的工具名、描述、入参格式对全员可见,而且能被别人的会话
    调用(那台 server 的配置里可能带着他的凭据)。现在按 `MCPClientManager.is_visible` 收窄:
    自己注册的 + 部署级(owner 为空串)的。**行为变化如实登记**:某用户自己装的外部 server 工具
    不再出现在其他用户的会话里 —— 这正是隔离的目的;平台级预置的那批完全不受影响。
    空主体(`""`)⇒ 只看得到部署级,是 fail-closed 而不是"没限制"。
    """
    if not _is_supertool_enabled():
        return None
    try:
        from ..services.mcp_client import get_mcp_client_manager
        from ..services.mcp_server import mcp_server
        from ..services.mcp_tool_aggregator import (
            POLICY_FIRST,
            MCPSuperToolAggregator,
            ToolSource,
        )

        manager = get_mcp_client_manager()
        external = await manager.list_available_tools_async(user_id)
        if not external:
            return None  # 无外部 server → 降级

        sources = [
            ToolSource(
                server_name=_SUPERTOOL_INTERNAL_SOURCE,
                tools=list(mcp_server.list_tools()),
                # 内置工具显式最高优先级:同名冲突时裸名永远归内置,
                # 不受 POLICY_FIRST 的"描述长度优先"影响(保证白名单语义一致)。
                priority=100,
            )
        ]
        by_server: dict[str, list[Any]] = {}
        for t in external:
            by_server.setdefault(t.server_name or "external", []).append(t)
        for srv, tools in by_server.items():
            sources.append(ToolSource(server_name=srv, tools=tools))

        agg = MCPSuperToolAggregator()
        return agg.build(sources, collision_policy=POLICY_FIRST)
    except Exception:  # noqa: BLE001 - 任意聚合异常都降级,绝不阻断装配
        logger.exception("supertool 聚合失败,降级到现有工具装配路径")
        return None


async def _supertool_invoke(
    server_name: str,
    tool_name: str,
    args: dict[str, Any],
    user_role: int = 0,
    user_id: str = "",
) -> Any:
    """call_forward 的统一路由:内置工具走 mcp_server,外部工具走 mcp_client。

    V3 #47 第二格(2026-09-26):内置源那一支必须把角色透传给 `call_tool`,否则聚合路径
    与直连路径给出不同的授权答案 —— 默认 0 是 fail-closed(调用方没证明过身份就按
    普通用户处理),不是"默认放开"。签名带默认值,既有三方调用方(含测试)不破。

    G-371 格①(2026-09-29,机主拍"隔离"):外部源这一支现在也**必须带主体**。空 `user_id`
    只看得到部署级 server(fail-closed),别人注册的那台在这里既调不到也看不见 —— 与
    `_build_supertool_pool` 同一份 `is_visible` 判据,不在此处另写一遍 owner 比较。
    """
    from ..services.mcp_server import mcp_server

    if server_name == _SUPERTOOL_INTERNAL_SOURCE:
        return await mcp_server.call_tool(tool_name, args, user_role=user_role)
    from ..services.mcp_client import get_mcp_client_manager

    manager = get_mcp_client_manager()
    if not manager.is_visible(server_name, user_id):
        # 与"没这台 server"同模板(错误文本走未知那一个出口)
        return {"ok": False, "error": f"未知 MCP Server: {server_name}"}
    client = manager.get_client(server_name)
    if client is not None:
        return await client.call_tool(tool_name, args)
    return await manager.call_external_tool(server_name, tool_name, args, caller_user_id=user_id)


def _supertool_tools_from_pool(
    pool: "SuperToolPool",
    tool_names: list[str] | None,
    user_role: int = 0,
    user_id: str = "",
) -> list[Any]:
    """把超级工具池转换为 AgentLoopV2 的 ToolDefinition 列表(沿用 deferral 逻辑)。

    V3 #47 第二格:`user_role` 由 `_build_loop_v2_tools` 透传,经下面那个 `_invoke` 闭包
    固化进每个工具的执行器 —— 角色是**宿主事实**,不能由模型填,也不能在装配链上丢。
    G-371 格①(2026-09-29):`user_id` 同理也是宿主事实 —— 外部源那一支按它判可见性,
    漏传就等于"只看得到平台级"(fail-closed),不会变成"看得到所有人的"。
    这里刻意用闭包而不是 functools.partial:`call_forward` 的 invoke_fn 契约是
    `Callable[[str, str, dict], Awaitable[Any]]`(mcp_tool_aggregator.InvokeFn),
    闭包与该签名逐字同形,partial 会让类型层要额外解释。
    """
    from ..services.agent_loop_v2 import ToolDefinition
    from ..services.mcp_tool_aggregator import MCPSuperToolAggregator

    agg = MCPSuperToolAggregator()
    defer = _is_tool_deferral_enabled()
    forced = {"get_tool_schema"} if defer else set()
    tools: list[Any] = []

    async def _invoke(server_name: str, tool_name: str, args: dict[str, Any]) -> Any:
        return await _supertool_invoke(server_name, tool_name, args, user_role, user_id)

    for pt in pool.tools:
        key = pt.key
        if tool_names and key not in tool_names and key not in forced:
            continue

        async def _exec(args: dict[str, Any], _key: str = key) -> Any:
            return await agg.call_forward(pool, _key, args, invoke_fn=_invoke)

        if defer and key != "get_tool_schema":
            short = _shorten_description(
                pt.description, limit=80 - len(_TOOL_DEFERRAL_SUFFIX)
            )
            tools.append(
                ToolDefinition(
                    name=key,
                    description=short + _TOOL_DEFERRAL_SUFFIX,
                    parameters={"type": "object"},
                    executor=_exec,
                    mcp_annotations=pt.annotations,
                )
            )
        else:
            tools.append(
                ToolDefinition(
                    name=key,
                    description=pt.description,
                    parameters=pt.schema,
                    executor=_exec,
                    mcp_annotations=pt.annotations,
                )
            )
    return tools


async def _build_loop_v2_tools(
    tool_names: list[str] | None,
    user_role: int = 0,
    user_id: str = "",
    session_key: str = "",
) -> list[Any]:
    """把 MCP 工具包装为 AgentLoopV2 的 ToolDefinition 列表(白名单过滤)。

    工具执行器走 mcp_server.call_tool(与 v1 agent_executor 同源),
    失败抛异常由 AgentLoopV2 的瞬时错误重试/错误分类机制处理。

    V3 #47 第二格(2026-09-26):`user_role` 必须透传到 `call_tool`。此前两条装配支路
    (内置直连 / 超级工具聚合)都按 `call_tool` 的形参默认值 0 调用,于是**连管理员在
    引擎线程里也永远拿不到** run_command / write_file —— 反方向的坏:授权判定对
    三条执行内核给出不同答案。规矩与 `app/services/capability_gate.py` 立的那条同源:
    "Principal.role 透传给 call_tool(替代硬编码 user_role=0)"。默认 0 保持 fail-closed。

    超级工具聚合(AGENT_SUPERTOOL_ENABLED,默认开启):存在已连接外部 MCP server
    时,内置 _TOOLS 与外部工具经 MCPSuperToolAggregator 去重/仲裁后以统一 manifest
    暴露;无外部 server 或聚合异常时降级到下方现有路径(工具清单逐字节等价)。

    工具定义 deferral(瘦身,默认开启):当 TOOL_DEFERRAL=on 时,除 get_tool_schema
    自身外,所有工具的 description 替换为 ≤limit 的短描述、parameters 置为最小占位
    ("type": "object"),并在描述尾部追加"用 get_tool_schema 查询完整参数"的提示,
    从而大幅压低进入上下文的工具定义 token 占用(对标 Claude Code 的 deferral)。
    get_tool_schema 必须保持完整 schema 且无论 tool_names 过滤如何都强制纳入,
    否则模型无法反查其他工具的完整参数。env 关闭时行为与历史完全一致。
    """
    pool = await _build_supertool_pool(tool_names, user_id)
    if pool is not None:
        return _supertool_tools_from_pool(pool, tool_names, user_role, user_id)

    # —— 现有路径(无外部 server / 开关关闭 / 聚合异常时逐字节等价) ——
    from ..services.agent_loop_v2 import ToolDefinition
    from ..services.mcp_server import mcp_server

    defer = _is_tool_deferral_enabled()
    tools: list[Any] = []
    # deferral 开启时,get_tool_schema 自身必须保持完整 schema,故强制纳入。
    forced = {"get_tool_schema"} if defer else set()

    for mt in mcp_server.list_tools():
        if tool_names and mt.name not in tool_names and mt.name not in forced:
            continue

        async def _exec(args: dict[str, Any], _name: str = mt.name) -> Any:
            # 角色是宿主事实,随工具定义一起固化(与聚合支路 _invoke 同一形态)
            # D201(2026-10-02):session_key 一并过桥 —— mcp_server.call_tool 用它
            # 注入该会话的附加目录覆盖层(多根工作区);缺省 None = 无会话覆盖层,
            # 行为与历史逐字节一致(fail-closed 不受影响)。
            return await mcp_server.call_tool(
                _name, args, user_role=user_role, session_id=session_key or None
            )

        if defer and mt.name != "get_tool_schema":
            short = _shorten_description(
                mt.description, limit=80 - len(_TOOL_DEFERRAL_SUFFIX)
            )
            tools.append(
                ToolDefinition(
                    name=mt.name,
                    description=short + _TOOL_DEFERRAL_SUFFIX,
                    parameters={"type": "object"},
                    executor=_exec,
                )
            )
        else:
            tools.append(
                ToolDefinition(
                    name=mt.name,
                    description=mt.description,
                    parameters=mt.input_schema,
                    executor=_exec,
                )
            )
    return tools


def _make_loop_v2_llm(model: str | None) -> Any:
    """构造 AgentLoopV2 的 llm_complete_fn(包装 llm_gateway.complete/astream)。

    P0-B(2026-09-18):签名新增 on_chunk 关键字参数——AgentLoopV2 经签名探测
    (_detect_on_chunk_support)判定支持后,首试传入流式回调走 astream 通道:
    逐 chunk 回调(→ thinking.delta 增量),流结束聚合 content/usage/model 一次性
    返回;on_chunk 未传(重试降级轮)维持 complete 阻塞调用,行为与旧闭包一致。
    """

    async def _llm(
        messages: list[dict[str, Any]],
        tools: list[Any],
        *,
        on_chunk: Any = None,
        **model_kwargs: Any,
    ) -> dict[str, Any]:
        """model_kwargs(2026-09-18 第二批):AgentLoopV2 传入的生成参数透传面
        (temperature/top_p/max_tokens/reasoning_effort/...),经 llm_gateway
        的 **kwargs 直达 litellm;未配置时为空,签名与现状逐零差异。"""
        from ..core.llm_gateway import llm_gateway

        if on_chunk is None:
            result = await llm_gateway.complete(
                messages, model=model, **model_kwargs
            )
            return {
                "content": result.get("content", ""),
                "tool_calls": _convert_openai_tool_calls(result.get("tool_calls")),
                "usage": result.get("usage"),
                "model": result.get("model", ""),
            }

        # 流式通道:chunk 事件逐个回调;astream 已把分片 tool_calls 聚合为
        # tool_calls 事件、done 事件带 usage/model,结束一次性返回。
        # astream 异常原样上抛,由 AgentLoopV2._llm_call_with_retry 统一重试
        # (重试轮自动退化非流式,防增量重复拼接)。
        content_parts: list[str] = []
        raw_tool_calls: list[dict[str, Any]] = []
        usage: dict[str, Any] | None = None
        model_used = ""
        async for evt in llm_gateway.astream(messages, model=model, **model_kwargs):
            evt_type = evt.get("type")
            if evt_type == "chunk":
                text = evt.get("content") or ""
                if text:
                    content_parts.append(text)
                    await on_chunk(text)
            elif evt_type == "tool_calls":
                raw_tool_calls = evt.get("tool_calls") or []
            elif evt_type == "done":
                usage = evt.get("usage")
                model_used = evt.get("model", "")
        return {
            "content": "".join(content_parts),
            "tool_calls": _convert_openai_tool_calls(raw_tool_calls),
            "usage": usage,
            "model": model_used,
        }

    return _llm


def _is_loop_v2_enabled() -> bool:
    """生产执行器开关(三档语义,Phase 0 W1 默认翻转为 v2)。

    env AGENT_EXECUTOR 取值:
    - 缺省(未设置)→ True:默认启用 AgentLoopV2(完整 ReAct 循环 + checkpoint 续跑
      + 高危工具审批流 + 记忆/画像闭环 + GraphRAG/consolidate/Skill 自进化出口)。
    - "loop_v2" / "v2" → True:显式启用 v2。
    - "langgraph" → False:走 LangGraph 工作流,异常时降级 v1 run_stream 兜底。
    - "v1" / "legacy" → False:仅走 v1 单轮 run_stream(旧行为)。

    任何未识别值一律视为 False(回退到 langgraph/v1 旧链路),避免误配字面量
    直接命中 v2 主链路导致行为漂移。
    """
    val = os.environ.get("AGENT_EXECUTOR")
    if val is None:
        return True
    return val.strip().lower() in ("loop_v2", "v2")


async def _new_v2_loop(
    *,
    model: str | None,
    tools: list[str] | None,
    max_iterations: int | None,
    session_id: str | None,
    current_user: str,
    user_role: int,
    permission_mode: str | None = None,
    durable_horizon_seconds: int | None = None,
) -> "AgentLoopV2":
    """构造 AgentLoopV2 的**唯一**入口(D144③ 2026-09-29 从 execute/stream 抽出)。

    为什么必须是函数而不是"各调用点各写一份参数表":本文件此前有两处内联构造
    (execute/stream 的 v2 分支、`_resume_agent_loop_from_checkpoint`),两处参数表
    已经漂开 —— resume 那份没有 `permission_mode`,于是 G-161 修掉的"端上选了档
    却永远走 default"在断点续跑链上原地复发。第三处(非流式 execute)如果再抄一遍,
    就会长出第四个真相。§3「同一件事只许一处交集实现」在这条链上的落点就是本函数。

    Args:
        model: 请求模型名(用于 llm 包装与 V3 #55 压缩上限的动态解析)。
        tools: 客户端请求的工具白名单(经 `_build_loop_v2_tools` 过角色/矩阵)。
        max_iterations: 请求显式轮次上限;为空时沿用**请求级兜底 8**(与两处旧构造
            逐字同值)。注意它与引擎构造器默认档 `core/doom_loop.py`
            `AGENT_MAX_ITERATIONS=10` **不是同一档** —— 这一格差异由
            `scripts/check-doom-loop-parity.mjs` 的 P4 登记表逐条写明理由与到期日,
            不得读成"已归一"。
        session_id: 会话 ID;resume 链上不传(由 loop 自己从 checkpoint 恢复)。
        current_user: **令牌主体**(O19:审批属主登记与记忆隔离都据此),不得取请求体自报值。
        user_role: V3 #47 的角色桥;取不到 = 0 = 普通用户。
        permission_mode: G-161 权限档;None 时沿用 env 默认(与旧 resume 构造同语义)。
        durable_horizon_seconds: V3 #84 生产者侧的视野声明(秒);None = 非耐久,
            构造出的循环不写耐久键(与现状逐零差异)。

    Returns:
        构造好的 AgentLoopV2 实例(调用方负责 run / resume_from_checkpoint 与属主登记)。
    """
    from app.core.model_context_window import resolve_with_env_priority

    from ..services.agent_loop_v2 import AgentLoopV2

    return AgentLoopV2(
        _make_loop_v2_llm(model),
        tools=await _build_loop_v2_tools(tools, user_role=user_role, user_id=current_user),
        user_role=user_role,
        session_id=session_id,
        max_iterations=max_iterations or 8,
        enable_checkpoint=True,
        # G-161:此前根本没把请求里的 permission_mode 传进来 →
        # 端上选的权限档在这条主执行链上永远是 default。
        permission_mode=permission_mode,
        # O19:principal 贯通到执行路径 —— 高危工具审批条目据此登记属主
        # (agent_loop_v2._request_approval → self._user_id),并启用 P1-6
        # 记忆闭环的用户隔离。
        user_id=current_user,
        # V3 #55(2026-09-26):压缩上限缺省按请求模型动态解析
        # (env AGENT_COMPACTION_CONTEXT_LIMIT 显式配置仍优先;彻底关压缩
        # 走灰度总闸 AGENT_COMPACTION_MODE=off,语义正确且可放量)。
        # 此前缺省 0=永不压缩,放量基建(灰度/指标/回退)齐备但线上从未生效。
        compaction_context_limit=resolve_with_env_priority(model),
        # V3 #84 生产者侧:耐久视野声明透传(唯一构造入口,三处调用点共用这一份)。
        durable_horizon_seconds=durable_horizon_seconds,
    )


def _v2_result_to_execute_payload(session_id: str, result: Any) -> dict[str, Any]:
    """AgentLoopResult → 非流式 execute 的既有响应形状(**键集一字未改**)。

    D144③ 归一执行内核时,对外契约必须逐键保持 `agent_loop.py` V1 的形态:
    task_id / session_id / status / iterations / steps / result / error。
    调用方(apps/api 的 automations agent 执行器、packages/api-client 的
    `executeAgent`、v1-ai-core 的 /v1/agents/execute)读的就是这几个键,
    换内核不等于换响应形状 —— 新增键一律不加(加就是对外契约变化,另计票)。
    """
    stop_reason = getattr(result, "stop_reason", "") or ""
    success = bool(getattr(result, "success", False))
    if success:
        status = "completed"
    elif stop_reason in ("cancelled", "canceled", "paused"):
        # V1 的取消态用单 l("canceled"),这里两种拼写都归到既有取值上
        status = "canceled"
    else:
        status = "failed"

    steps: list[dict[str, Any]] = []
    for it in getattr(result, "iterations", []) or []:
        idx = getattr(it, "iteration", len(steps) + 1)
        reasoning = getattr(it, "reasoning", "") or ""
        if reasoning:
            steps.append(
                {
                    "iteration": idx,
                    "type": "assistant",
                    "tool_name": None,
                    "tool_args": None,
                    "content": reasoning,
                    "status": "completed",
                }
            )
        for tr in getattr(it, "tool_results", []) or []:
            err = getattr(tr, "error", None)
            steps.append(
                {
                    "iteration": idx,
                    "type": "tool",
                    "tool_name": getattr(tr, "name", ""),
                    "tool_args": None,
                    "content": err if err else getattr(tr, "result", ""),
                    "status": "failed" if err else "completed",
                }
            )

    error: str | None = getattr(result, "error", None)
    if error is None and not success:
        # 无 error 文本却未成功(如 max_iterations / budget_exceeded):把停止原因
        # 如实写进既有的 error 字段,而不是新增一个键或伪装成成功。
        error = f"stop_reason={stop_reason}" if stop_reason else "agent 未成功完成"
    return {
        # V2 没有 V1 的 task 自增号;task_id 由 session 派生,稳定且可在响应里回显。
        # ⚠️ 已知后果(如实登记):`/agents/{task_id}/status|cancel` 与 `/agents/running`
        # 读的是 V1 执行器的 `_running`,V2 跑法不在那张表里 ⇒ 归一后这些端点对
        # V2 run 返回 404。V2 时代的在飞索引是 `agent_run_control`(本端点已登记),
        # 把那几个端点改指它是**另一票**(不在 D144"只归一一处出口"的口径内)。
        "task_id": f"task-{session_id}",
        "session_id": session_id,
        "status": status,
        "iterations": len(getattr(result, "iterations", []) or []),
        "steps": steps,
        "result": getattr(result, "final_response", "") or "",
        "error": error,
    }


# 单一事实源迁移(2026-09-17):映射表移至 services/agent_events.HOOK_EVENT_TO_SSE
# (补齐 session.end/permission.mode/message.send 映射),此处保留别名供既有
# 调用点与 tests/test_agents.py 引用。
_map_hook_event_to_sse = map_hook_event_to_sse


@router.get("/agents/tasks/stream")
async def stream_agent_tasks(
    request: Request,
    agentId: str = "",
    current_user: str = Depends(require_request_user_id),
) -> StreamingResponse:
    """L5-10(2026-08-12):AgentLoopV2 实时事件订阅(workbench runtime 视图)。

    通过 hook_engine 订阅器实时推送 tool_call/tool_result/error/session 事件
    (按 agentId=session_id 过滤)。AgentLoopV2 执行器启用(AGENT_EXECUTOR=loop_v2)
    后,execute/stream 的事件会在此实时可见;未启用时无事件源(静默心跳)。

    O19(2026-09-21)属主过滤:hook_engine 是**进程级广播**,旧实现只在 agentId 非空时
    过滤,agentId="" 即把全站正在跑的会话事件(含工具入参/结果预览)推给任意订阅者。
    现在:
      ① 必须登录(拿不到 principal 直接 401,不再依赖中间件白名单是否放行);
      ② 只转发属主==当前请求者的事件,**无属主记录的事件一律不转发**(fail-closed;
         登记表 run_ownership 只在同进程 run 启动时写入,重启/跨进程查不到 ⇒ 不转发,
         宁可用不上实时视图也不泄漏他人事件);
      ③ 显式传 agentId 且该会话属主是**别人**(可判定)→ 403,让误用可见而非静默空流。
         属主未知(非本进程启动的会话)不进 403 分支,由 ② 兜住。
    心跳保留,连接不因过滤而关闭。
    """
    if agentId:
        known_owner = owner_of(agentId)
        if known_owner is not None and known_owner != current_user:
            raise HTTPException(
                status_code=403, detail="该会话不属于当前用户,无法订阅其事件流"
            )

    async def event_generator() -> AsyncIterator[str]:
        from ..services.hook_engine import hook_engine

        subs: dict[str, asyncio.Queue[Any]] = {}
        # 统一订阅集合(2026-09-17):services/agent_events.AGENT_SUBSCRIBE_EVENTS,
        # 补齐 message.receive/session.end/permission.mode(与另两个 SSE 端点一致)。
        for evt in AGENT_SUBSCRIBE_EVENTS:
            subs[evt] = hook_engine.subscribe(evt)
        try:
            # 心跳保活(30s) + 事件转发
            last_beat = asyncio.get_running_loop().time()
            while True:
                if await request.is_disconnected():
                    break
                got = False
                for evt, q in subs.items():
                    try:
                        payload = q.get_nowait()
                    except asyncio.QueueEmpty:
                        continue
                    got = True
                    # P0-5:thinking.delta/plan.step payload 以 run_id(=workbench
                    # session_id)承载,无 session_id 键 → 回退 run_id 参与会话过滤
                    key = str(payload.get("session_id") or payload.get("run_id") or "")
                    if agentId and key != agentId:
                        continue
                    # O19:属主不等于请求者(含"查无属主")一律不转发
                    if owner_of(key) != current_user:
                        continue
                    sse_evt = {
                        "type": map_hook_event_to_sse(evt),
                        "payload": payload,
                    }
                    yield f"event: {sse_evt['type']}\ndata: {json.dumps(with_frame_trace_id(str(sse_evt['type']), sse_evt), ensure_ascii=False)}\n\n"
                now = asyncio.get_running_loop().time()
                if not got and now - last_beat > 30:
                    yield ": keep-alive\n\n"
                    last_beat = now
                await asyncio.sleep(0.2)
        finally:
            for evt, q in subs.items():
                hook_engine.unsubscribe(evt, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/agents/{agent_id}/stream")
async def stream_agent_logs(
    request: Request,
    agent_id: str,
    current_user: str = Depends(require_request_user_id),
) -> StreamingResponse:
    """L5-12(2026-08-12):Agent 运行日志 SSE(AgentRuntimeLog 断线修复)。

    按 agent_id(=session_id)过滤 hook_engine 事件,映射为前端 AgentRuntimeLog
    期望的 LogEntry 格式 {type, content, ts, success}。此前双端无此路由,
    workbench AgentRuntimeLog 组件 404 断线——与 tasks/stream 同一事件源,
    不同展示格式(日志型 vs 事件型)。

    O19:与 tasks/stream 同一套属主过滤(共用 run_ownership 登记表)——
    ① 必须登录;② 属主可判定且非请求者 → 403;③ 逐事件 fail-closed,
    无属主记录的事件不转发(旧实现只比 session_id 字面量,猜到他人 session_id
    即可旁听其实时工具事件,这一层现在补上)。
    """
    known_owner = owner_of(agent_id)
    if known_owner is not None and known_owner != current_user:
        raise HTTPException(
            status_code=403, detail="该会话不属于当前用户,无法订阅其运行日志"
        )

    async def event_generator() -> AsyncIterator[str]:
        from ..services.hook_engine import hook_engine

        subs: dict[str, asyncio.Queue[Any]] = {}
        # 统一订阅集合(2026-09-17):补齐 thinking.delta/plan.step/session.end/
        # permission.mode(与 tasks/stream、execute/stream 一致)。
        for evt in AGENT_SUBSCRIBE_EVENTS:
            subs[evt] = hook_engine.subscribe(evt)
        try:
            last_beat = asyncio.get_running_loop().time()
            while True:
                if await request.is_disconnected():
                    break
                got = False
                for evt, q in subs.items():
                    try:
                        payload = q.get_nowait()
                    except asyncio.QueueEmpty:
                        continue
                    got = True
                    # thinking.delta/plan.step 以 run_id(=session_id)承载,无 session_id 键
                    key = str(payload.get("session_id") or payload.get("run_id") or "")
                    if key != agent_id or owner_of(key) != current_user:
                        continue
                    entry = _map_hook_event_to_log_entry(evt, payload)
                    if entry is None:
                        continue
                    yield f"data: {json.dumps(with_frame_trace_id(str(entry.get('type', '')), entry), ensure_ascii=False)}\n\n"
                now = asyncio.get_running_loop().time()
                if not got and now - last_beat > 30:
                    yield ": keep-alive\n\n"
                    last_beat = now
                await asyncio.sleep(0.2)
        finally:
            for evt, q in subs.items():
                hook_engine.unsubscribe(evt, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


def _map_hook_event_to_log_entry(event: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    """hook_engine 事件 → AgentRuntimeLog LogEntry 格式 {type, content, ts, success}。"""
    now = payload.get("ts") or payload.get("timestamp") or ""
    ts = now if isinstance(now, str) else ""
    content = ""
    success: bool | None = None
    if event == HOOK_SESSION_START:
        content = f"session {payload.get('session_id', '')} started"
    elif event == HOOK_SESSION_END:
        # 统一订阅补齐(2026-09-17):session 结束(success/stop_reason/迭代数)
        content = (
            f"session {payload.get('session_id', '')} ended"
            f"(success={payload.get('success')}, stop_reason={payload.get('stop_reason', '')})"
        )
        success = bool(payload.get("success"))
    elif event == HOOK_TOOL_APPROVAL:
        content = (
            f"工具 {payload.get('tool_name', '')} 请求审批"
            f"(danger={payload.get('danger_level', 'high')})"
        )
        success = None
    elif event == HOOK_TOOL_BEFORE:
        tools_count = payload.get("tools_count", "")
        content = f"LLM 推理完成,准备调用工具(tools_count={tools_count})"
    elif event == HOOK_TOOL_AFTER:
        results = payload.get("tool_results") or []
        if results:
            # 每个工具结果一行(含重试/错误分类明细)
            lines = []
            for tr in results:
                if not isinstance(tr, dict):
                    continue
                status = tr.get("status", "")
                name = tr.get("name", "")
                line = f"tool {name} -> {status}"
                if tr.get("error"):
                    line += f" error={str(tr['error'])[:120]}"
                if tr.get("error_type"):
                    line += f" [{tr['error_type']}]"
                if tr.get("retry_count"):
                    line += f" (retry x{tr['retry_count']})"
                if tr.get("duration_ms") is not None:
                    line += f" {tr['duration_ms']}ms"
                lines.append(line)
            content = "; ".join(lines)
            success = all(
                isinstance(tr, dict) and tr.get("status") == "success"
                for tr in results
            )
        else:
            content = "工具执行完成"
            success = None
    elif event == HOOK_MESSAGE_RECEIVE:
        content = f"回复完成(content_length={payload.get('content_length', '')})"
        success = True
    elif event == HOOK_SELF_HEAL:
        # 2-3(2026-09-12):自愈触发/完成(heal 引擎内联集成事件)
        if payload.get("phase") == "started":
            content = f"self-heal 触发: {str(payload.get('command', ''))[:120]}"
            success = None
        else:
            content = (
                f"self-heal 完成(ok={payload.get('ok')}, "
                f"attempts={payload.get('attempts')})"
            )
            success = bool(payload.get("ok"))
    elif event == HOOK_PERMISSION_MODE:
        # 统一订阅补齐(2026-09-17):权限模式决策(auto-deny/allow 等)
        content = (
            f"权限 {payload.get('mode', '')} → {payload.get('decision', '')}"
            f"(tool={payload.get('tool', '')})"
        )
        success = None
    elif event == HOOK_THINKING_DELTA:
        # 统一订阅补齐(2026-09-17):reasoning 整段透出(截断预览,正文走 thinking 事件)
        content = f"thinking: {str(payload.get('content', ''))[:120]}"
        success = None
    elif event == HOOK_PLAN_STEP:
        # 统一订阅补齐(2026-09-17):工具步骤时间线(started/completed)
        content = (
            f"plan step {payload.get('step_index', '')} "
            f"{payload.get('tool_name', '')} -> {payload.get('status', '')}"
        )
        success = payload.get("status") == "completed"
    elif event == HOOK_ERROR:
        content = f"error[{payload.get('error_type', 'unknown')}]: {str(payload.get('message', payload.get('error', '')))[:300]}"
        success = False
    else:
        return None
    return {"type": map_hook_event_to_sse(event), "content": content, "ts": ts, "success": success}

# ---------------------------------------------------------------------------
# Trace 存储(进程内 LRU,供 agent 执行轨迹可视化)
# ---------------------------------------------------------------------------

_trace_store: dict[str, dict[str, Any]] = {}
_MAX_TRACES = 100


def store_trace(session_id: str, trace_data: dict[str, Any]) -> None:
    """存储 agent 执行 trace。"""
    _trace_store[session_id] = trace_data
    if len(_trace_store) > _MAX_TRACES:
        oldest = min(_trace_store.keys(), key=lambda k: _trace_store[k].get("timestamp", 0))
        del _trace_store[oldest]


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class GoalCriterionIn(BaseModel):
    """一条执行前声明的硬性指标(§8"验证标准:命令退出码 / 测试输出 / 文件状态 / HTTP 响应")。

    `probeCommand` 非空 = 这条由**机器证据**定案(本轮必须真跑过该命令,退出码即结论,
    校验模型碰不到它);为空 = 只能靠语义,交独立校验轮逐条判 met/unmet 并引用证据 id。
    字段名沿用 goal_verification 端点的 camelCase 口径(同一机制的两种入口,不得两制)。
    """

    id: str = Field(min_length=1, max_length=64)
    statement: str = Field(min_length=1, max_length=2000)
    evidence_kind: str = Field(default="manual", max_length=32)
    required: bool = True
    probe_command: str = Field(default="", max_length=2000)
    expected_exit_code: int = 0

    def to_spec(self) -> GoalCriterionSpec:
        return GoalCriterionSpec(
            id=self.id,
            statement=self.statement,
            evidence_kind=self.evidence_kind,
            required=self.required,
            probe_command=self.probe_command,
            expected_exit_code=self.expected_exit_code,
        )


class AgentExecuteRequest(BaseModel):
    """执行 agent 请求。"""

    goal: str = Field(..., description="agent 目标/用户输入")
    session_id: str | None = Field(None, description="会话 ID,为空则新建")
    model: str | None = Field(None, description="指定模型,为空使用默认")
    max_iterations: int | None = Field(None, description="最大迭代次数")
    tools: list[str] | None = Field(None, description="允许调用的工具名列表")
    # V3 #76(2026-09-28 立):知识卡自动蒸馏的归属仓库。**刻意不做**服务端推断 ——
    # 卡片 repoName 在库侧 notNull,猜错就是把 A 仓的经验写进 B 仓的知识库。
    # 为空时回落到部署级 settings.knowledge_card_default_repo;仍为空则跳过蒸馏并打日志。
    repo_name: str | None = Field(
        None,
        max_length=200,
        description="知识卡蒸馏归属仓库名(为空则用部署级默认;默认也未配则跳过蒸馏)",
    )
    # G-161(2026-09-22):此字段此前**根本不存在**,apps/api 转发的 permission_mode
    # 被 Pydantic 静默丢弃 —— 客户端以为设了权限档,服务端一直按 default 跑。
    # 现声明并归一到唯一真源(app/core/permission_mode.py)。
    permission_mode: str | None = Field(
        None,
        description="权限模式:default / acceptEdits / bypassPermissions / plan / manual"
        "(历史别名 auto / accept-edits / accept-all / read-only / plan-only 自动归一)",
    )
    # AGENTS.md §8 第 3 步的调用点(2026-09-25 立):执行**前**声明的硬性指标。
    # 声明了才启用独立校验闸门;不声明 = 非 goal 模式,done 帧行为与接线前逐零差异。
    hard_criteria: list[GoalCriterionIn] | None = Field(
        None,
        description=(
            "goal 模式的硬性指标(执行前声明)。非空时,循环自宣完成后必须先过一次"
            "独立校验轮才允许把 done 帧的 success 写成 true;"
            "校验判未达成 / 未判定一律 success=false。"
        ),
        max_length=40,
    )
    # V3 #84 生产者侧(2026-10-07):发起侧耐久视野声明(秒)。声明后本 run 落的每行
    # checkpoint 元数据都带 durable_horizon_seconds + durable_launched_at,#84 的续期闸
    # 才有"这一行点名要耐久"的判据(此前判据全量在位、唯独没人写键,声明即轮空)。
    # 上限=7 天(DURABLE_HORIZON_MAX_SECONDS 唯一真源,续期侧对超限拒续并点名);
    # 省略 = 不声明 = 非耐久任务,与现状逐零差异。不做 env 全局缺省:
    # "要活多久"只能由点名要耐久的这一次请求自己说,服务端不代决定。
    durable_horizon_seconds: int | None = Field(
        None,
        ge=1,
        le=int(DURABLE_HORIZON_MAX_SECONDS),
        description=(
            "耐久任务视野声明(秒,1 ~ 7天)。声明后 checkpoint 元数据带耐久视野"
            "与发起时刻,停手等人回来时可按 #84 续期闸补差额;省略 = 非耐久任务"
        ),
    )


def _resolved_permission_mode(raw: str | None) -> str | None:
    """permission_mode → 规范标识;省略返回 None(交给 env/默认),认不出拒 400。

    绝不静默回退 default —— "发了"与"生效"必须同义,这是 G-161 的立规依据。
    """
    if raw is None or not raw.strip():
        return None
    from ..core.permission_mode import normalize_permission_mode, permission_mode_error

    mode = normalize_permission_mode(raw)
    if mode is None:
        raise HTTPException(status_code=400, detail=permission_mode_error(raw))
    return mode


class AgentResumeRequest(BaseModel):
    """resume agent 请求(checkpoint 断点续跑)。"""

    checkpoint_id: str = Field(..., description="checkpoint id(由 pause/cancel/异常时返回)")
    model: str | None = Field(None, description="指定模型,为空使用默认")
    max_iterations: int | None = Field(None, description="最大迭代次数(续跑上限)")
    tools: list[str] | None = Field(None, description="允许调用的工具名列表")
    # b76-11(2026-09-30):断点续跑重建 runtime 时必须沿用 create 的权限面 —— 此前
    # 本模型没有这个字段,请求里的档位被 Pydantic 静默丢弃(G-161 同型),resume 链
    # 永远走 env 默认档。省略 = 沿用 env 默认(与既有行为逐字同值,不动存量调用方)。
    permission_mode: str | None = Field(
        None,
        description="权限模式:default / acceptEdits / bypassPermissions / plan / manual"
        "(历史别名自动归一;省略沿用 env 默认)",
    )
    # V3 #84 生产者侧(2026-10-07):与 AgentExecuteRequest 同格 —— 续跑重建的循环
    # 落新 checkpoint 时同样可声明耐久视野(两条 resume 出口共用
    # `_resume_run_from_checkpoint`,字段面必须同形,否则又是第二份漂开的参数表)。
    # 省略 = 不声明 = 重建循环不写耐久键,与现状逐零差异。
    durable_horizon_seconds: int | None = Field(
        None,
        ge=1,
        le=int(DURABLE_HORIZON_MAX_SECONDS),
        description="耐久任务视野声明(秒,1 ~ 7天);续跑重建的循环落盘时携带,省略 = 非耐久",
    )


class MemorySearchRequest(BaseModel):
    """记忆语义搜索请求。"""

    query: str = Field(..., description="搜索查询文本")
    top_k: int = Field(5, description="返回最相关的 N 条")
    session_id: str | None = Field(None, description="限定会话内搜索,为空则跨所有会话")


class ApprovalResponseRequest(BaseModel):
    """工具审批响应请求(2026-08-30 立;D84 2026-09-23 补作用域与原因)。"""

    approval_id: str = Field(..., description="审批请求 id(tool-approval SSE 事件返回)")
    decision: str = Field(..., description="决策: approve=批准 / reject=拒绝(其他值视为拒绝)")
    scope: Literal["once", "session", "always"] = Field(
        "session",
        description=(
            "D84 审批作用域:once=仅本次(不落授权) / session=本会话同键免弹窗(默认,兼容旧客户端) / "
            "always=跨会话同键免弹窗(approval_grants.db 持久行)。授权按 cache_key 精确匹配,不放大到全局。"
        ),
    )
    reason: str | None = Field(
        None,
        max_length=500,
        description="用户附带原因(可选,拒绝理由为主);仅进决策提示/审计,不参与判定。",
    )
    use_safer_alternative: bool = Field(
        False,
        description=(
            "V3 #80:用户勾选'改用 guardian 复核建议的更安全等价路径'。"
            "默认 False=维持原请求(合法出口);True 仅在复核结论存在通过确定性校验的"
            "同工具替代参数时生效(approve 与 reject 共用本字段,拒绝时无意义、被忽略)。"
        ),
    )


class SecurityConfigUpdateRequest(BaseModel):
    """安全配置更新请求(P0-3,2026-09-12 立)。部分更新,未传字段保持不变。"""

    prompt_guard_enabled: bool | None = Field(None, description="提示注入防护总开关")
    prompt_guard_policy: str | None = Field(None, description="注入防护策略: flag|sanitize|refuse")
    exec_policy_mode: str | None = Field(None, description="命令执行策略: enforce|audit|off")
    input_scan_enabled: bool | None = Field(None, description="危险入参扫描总开关")
    pipeline_record_enabled: bool | None = Field(None, description="安全管线步骤录制开关")


@router.get("/agent/security-config")
async def get_agent_security_config(
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """读取 Agent 安全配置(P0-3 安全三件套单一事实源)。

    返回当前生效配置(env 默认 + 进程内更新;重启回 env 默认)。

    O19(2026-09-21):补端点级"必须登录"。此前该 router 全靠 JWT 中间件的
    路径白名单把关 —— `.env` 里一条 `/api/agents/` 前缀就把整个执行面(含本端点)
    匿名放行。中间件侧已把 /api/agents 定为"永不可公开",这里再钉一层端点级门槛,
    白名单配错也不会漏。注:本端点只到"登录即可读",更细的管理员档位
    (roleId>=1)属 apps/api 侧的授权模型,ai-service 不重复实现。
    """
    from ..services.security_config import get_security_config

    cfg = get_security_config()
    return {"code": 0, "message": "ok", "data": cfg.to_dict()}


@router.put("/agent/security-config")
async def update_agent_security_config(
    req: SecurityConfigUpdateRequest,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """更新 Agent 安全配置(P0-3 安全三件套单一事实源)。

    部分更新:仅传入字段被修改;非法值(未知枚举)返回 400;
    进程内生效(不落盘,重启回 env 默认;持久化属后续 P1)。

    O19:必须登录 —— 这是**策略写操作**(可关掉注入防护/命令执行策略),
    匿名可调 = 任何人在全站安全门上拔插销。改动会记日志并带上操作者身份。
    """
    from ..services.security_config import set_security_config

    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="无更新字段")
    try:
        cfg = set_security_config(**updates)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    logger.info("Agent 安全配置已更新(user=%s): %s", current_user, cfg.to_dict())
    return {"code": 0, "message": "ok", "data": cfg.to_dict()}


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/agents/approval-response")
async def agent_approval_response(
    req: ApprovalResponseRequest,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """工具审批响应端点(2026-08-30 立;O19 2026-09-21 补端点级属主鉴权)。

    前端审批弹窗点"批准/拒绝"后调用本端点,把用户决策写入审批注册表,
    唤醒 agent_loop_v2 中阻塞等待的高危工具执行协程。
    body: {approval_id, decision: "approve" | "reject"}

    O19 前的缺口:本端点零鉴权 —— 任何拿到 approval_id 的人(或盲猜)都能替他人
    批准高危工具,人工审批门形同虚设。现在决策只在**属主==当前请求者**时写入。

    返回:
      200 code=0  accepted=true  → 决策已写入,工具按决策继续/跳过
      404                        → approval_id 不存在(已超时清理或从未发起)
      403                        → 审批存在但属主不符;**以及属主为 None 的审批**
        (由非 HTTP 上下文创建,如引擎线程/直接库调用)。后者刻意不给 HTTP 侧结算:
        无法证明它属于谁,就不能让任何登录用户点头 —— 这类审批只应由其创建通道
        (agent_engine 的 approval.respond)按自己的 principal 回填。
    """
    from ..services.agent_loop_v2 import (
        ApprovalOutcome,
        resolve_approval_for_requester,
    )

    decision = "approve" if req.decision.lower() in ("approve", "allow", "approved") else "reject"
    outcome = resolve_approval_for_requester(
        req.approval_id,
        decision,
        current_user,
        scope=req.scope,
        reason=req.reason,
        # V3 #80:勾选"改用更安全等价路径"随 approve 决策一起写入;True 而复核没有
        # 可执行的同工具替代时会被 _request_approval 忽略(不猜、不放大)。
        accept_alternative=bool(req.use_safer_alternative),
    )
    if outcome is ApprovalOutcome.NOT_FOUND:
        raise HTTPException(status_code=404, detail="approval not found or expired")
    if outcome is ApprovalOutcome.FORBIDDEN:
        raise HTTPException(
            status_code=403, detail="该审批请求不属于当前用户(或无可证明的属主)"
        )
    logger.info(
        "工具审批响应: approval_id=%s decision=%s user=%s",
        req.approval_id,
        decision,
        current_user,
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {"accepted": True, "approval_id": req.approval_id, "decision": decision},
    }


@router.post("/agents/execute")
async def execute_agent(
    req: AgentExecuteRequest,
    request: Request,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """执行 agent(同步返回结果)。

    O19(2026-09-21):必须登录,且把 principal 贯通到执行路径 ——
    ① `user_id` 传给执行器,会话记忆按 P1-6 复合 key(memory:{user}:{sid})读写,
       本端点与 GET /agents/sessions* 的隔离口径一致;
    ② run 期间把 session→user 登记进 run_ownership,供事件流按属主过滤,run 结束即释放。

    D144③(2026-09-29 归一):执行内核改指 **AgentLoopV2**,与 execute/stream 共用
    `_new_v2_loop` 这一份构造 —— 此前本端点**无条件**调用 V1 的 `agent_executor.run`,
    于是"同一个 agent 有两种跑法"由入口决定而不是由部署档位决定:V1 从不构造 V2,
    所以 G-161 的审批门、V3 #55 的压缩上限、V3 #65 的 checkpoint/暂停控制面在这里
    全部缺席(上面那两条 400 拒答就是为了不把"发了≠生效"卖给调用方)。
    V1 只保留为**显式**回退档(env `AGENT_EXECUTOR=v1|legacy|langgraph`),灰度出口
    一字未改;响应键集逐字不变(见 `_v2_result_to_execute_payload`)。
    """
    owned: list[str] = []
    # G-161:本端点过去走的是已弃用的单轮执行器(AgentExecutor),它从不构造 AgentLoopV2,
    # 因此权限档在此**无法生效**。此前 permission_mode 字段干脆不存在 → 被静默丢弃,
    # 客户端以为自己设了 bypassPermissions。宁可拒 400,也不允许"发了≠生效"。
    # ⚠️ D144③ 归一后本条拒答**继续成立且理由换了**:非流式响应里没有任何通道能把
    # 高危审批送到人面前(V2 的审批要经 SSE/hook 帧下发,再由 POST /agents/approvals
    # 回执),所以"选了 acceptEdits/bypassPermissions 却没人能批"仍是"发了≠生效"。
    # default 档下若真撞到高危工具,由 V2 自带的 approval_timeout(默认 60s)判**不执行**
    # —— 失效方向是拒绝,不是放行。把审批投递通道接进本端点属另一票,不得顺手做。
    resolved_mode = _resolved_permission_mode(req.permission_mode)
    if resolved_mode is not None and resolved_mode != "default":
        raise HTTPException(
            status_code=400,
            detail=(
                "permissionMode=%s 仅在 POST /agents/execute/stream 生效"
                "(非流式端点没有审批投递通道,选了也没人能够得着)"
            )
            % resolved_mode,
        )
    # 同一条"发了≠生效就不许发"的规矩(§8 第 3 步):独立校验闸门只接在流式端点上,
    # 因为它是唯一留下 iterations 当机器事实入口的执行路径。此处若不拒,声明了
    # hard_criteria 的调用方会拿到一个"从没被校验过却写着 success"的结果 —— 那正是
    # 本票要堵的 fail-open,不能因为走了另一个入口就又开了。
    if req.hard_criteria:
        raise HTTPException(
            status_code=400,
            detail=(
                "hard_criteria 仅在 POST /agents/execute/stream 生效"
                "(独立校验闸门未接在非流式端点上,单轮响应不产出可取证的工具调用记录)"
            ),
        )
    if req.session_id:
        record_ownership(req.session_id, current_user)
        owned.append(req.session_id)

    if _is_loop_v2_enabled():
        # D144③ 主路径:与 execute/stream 同一份构造、同一个 run 控制面登记口径
        # (owner 取令牌主体 current_user,不是 req.session_id 之类的自报值)。
        session_id = req.session_id or f"session-{asyncio.get_running_loop().time()}"
        if session_id not in owned:
            record_ownership(session_id, current_user)
            owned.append(session_id)
        registered = False
        try:
            loop = await _new_v2_loop(
                model=req.model,
                tools=req.tools,
                max_iterations=req.max_iterations,
                session_id=session_id,
                current_user=current_user,
                user_role=resolve_request_role_id(request),
                permission_mode=resolved_mode,
                # V3 #84 生产者侧:耐久视野声明透传(省略 = None = 非耐久,零差异)。
                durable_horizon_seconds=req.durable_horizon_seconds,
            )
            await register_run(session_id, owner_user_id=current_user, loop=loop)
            registered = True
            v2_result = await loop.run([{"role": "user", "content": req.goal}])
        finally:
            if registered:
                await detach_run(session_id, owner_user_id=current_user)
            for sid in owned:
                release_ownership(sid)
        return _v2_result_to_execute_payload(session_id, v2_result)

    try:
        result = await agent_executor.run(
            goal=req.goal,
            session_id=req.session_id,
            model=req.model,
            max_iterations=req.max_iterations,
            tools=req.tools,
            user_id=current_user,
            repo_name=req.repo_name,
        )
        # 未显式传 session_id 时由执行器生成,补登记(此后同进程订阅者可判定属主)
        # 刻意不叫 `sid`:上面 v2 分支的 `for sid in owned` 已把该名字钉成 str,
        # 而复用同名会让 mypy 报"Any|None 赋给 str"——那是名字重叠的假冲突,不是缺陷。
        produced_sid = result.get("session_id")
        if isinstance(produced_sid, str) and produced_sid and produced_sid not in owned:
            record_ownership(produced_sid, current_user)
            owned.append(produced_sid)
        return result
    finally:
        for sid in owned:
            release_ownership(sid)


def _format_sse(event_id: str, event: dict[str, Any]) -> str:
    """格式化 SSE 事件(含 id + event + data 三行)。

    event 字段取自 payload 的 type,客户端可用 addEventListener 分发。

    D174/R3:任务流的帧此前**不带**帧级 traceId —— 注入点在 llm 的路由里,而这里是第二条
    拼帧路径。两处各写一遍迟早漂开,所以注入逻辑已提到 `core/sse_frames.py`,两条流共用一份
    (症状不是报错,是"主对话流的帧能对上对账键、任务流的帧对不上")。
    """
    event_type = event.get("type", SSE_MESSAGE)
    framed = with_frame_trace_id(event_type, event)
    return f"id: {event_id}\nevent: {event_type}\ndata: {json.dumps(framed, ensure_ascii=False)}\n\n"


@router.post("/agents/execute/stream")
async def execute_agent_stream(
    req: AgentExecuteRequest,
    request: Request,
    current_user: str = Depends(require_request_user_id),
) -> StreamingResponse:
    """流式执行 agent,通过 SSE 返回增量结果,支持断线重连重放。

    执行器(D6 第 1 步 2026-09-19 归一):AgentLoopV2 为唯一执行事实源——
    真流式(后台 run task + hook_engine 订阅转发),含完整 ReAct + checkpoint。
    原「LangGraph 工作流 → v1 run_stream」双兜底死分支已删除;显式关闭 v2
    (env AGENT_EXECUTOR≠loop_v2)时返回 EXECUTOR_DISABLED 错误帧,不再静默降级。

    断线重连机制:
    - 每个事件携带 id 字段,客户端重连时发送 Last-Event-ID header
    - 服务端通过 sse_buffer 缓冲事件:每 task 有双上限(500 条 / 1 MiB,溢出丢最旧并计数)
      与两条到期锚点(空闲 5 分钟 TTL + 首事件起 30 分钟存活上限)
    - 重连时按三态判定(hit / not_resumable / unknown_task):只有锚点仍在缓冲内才重放其后的
      事件;锚点不可用时**不重放历史**,结论与丢弃条数一并写进 start 帧的 `resume` 块,
      客户端改走会话快照 GET /api/agents/sessions/{session_id}/messages 重建界面
    - 所有事件使用 SSE event: 字段(取自 payload type),客户端可 addEventListener 分发
    """

    last_event_id = request.headers.get("last-event-id")
    # 硬性指标的声明层面校验放在**开始流式之前**:声明不合法是请求错(422),
    # 不该以一个 SSE 错误帧的形式让客户端在流里猜。校验口径复用 gate 的 validate_specs,
    # 不在端点里再抄一份"重复 id 怎么判"。
    if req.hard_criteria is not None:
        try:
            validate_specs([c.to_spec() for c in req.hard_criteria])
        except GoalCriterionSpecError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    async def event_generator() -> AsyncIterator[str]:
        task_id = f"task-{asyncio.get_running_loop().time()}"
        # O19:本次 run 登记进 run_ownership 的会话标识,finally 统一释放(防泄漏)
        owned_sessions: list[str] = []
        # V3 #65:登记进 run 控制面(agent_run_control)的会话标识,与上面同生命周期
        registered_sessions: list[str] = []

        # 断线重连: 先按**三态**判定续传(2026-09-27 修;病灶全文见 core/sse_buffer.py 头注)
        #   hit            ⇒ 锚点在缓冲内,只发其后的事件(与旧行为一致)
        #   not_resumable  ⇒ 锚点已被缓冲上限丢弃 / 不属于本 task。**一帧历史都不发** ——
        #                    旧实现在这里"返回全部(保守策略)",于是客户端按 id 追加就
        #                    出现"会话内容翻倍",而它自己的 docstring 承诺的恰恰是返回空
        #   unknown_task   ⇒ task 不存在或已到期(与旧行为一致:接着开一次新 run)
        # 三态结论一律随 start 帧的 `resume` 块回给客户端,不可续传时同时给出重取快照的
        # 出口 —— 让客户端知道"这次没给你历史是因为给不了",而不是让它以为拿到的是全量。
        resume: dict[str, Any] | None = None
        if last_event_id:
            # 从 last_event_id 所在的 task 提取(格式 task_id-seq)
            replay_task_id = last_event_id.rsplit("-", 1)[0] if "-" in last_event_id else task_id
            outcome = sse_buffer.replay_outcome(replay_task_id, last_event_id)
            resume = {
                "status": outcome.status,
                "replayed_events": len(outcome.events) if outcome.resumable else 0,
                # 该 task 至今被上限丢弃的累计条数 —— 少了多少必须说,静默变短等于伪造完整性
                "dropped_events": outcome.dropped,
                "reason": outcome.reason,
                # 回退通道(客户端用法):status 非 hit 时**不要**期待补齐历史,改为
                # 按 session_id 重取已落库的消息快照(GET /api/agents/sessions/{id}/messages)
                # 重建界面,再接本条流的实时事件;长 run 的断点续跑走 checkpoint
                # (POST /api/agents/execute/resume),不是走 SSE 内存缓冲。
                "snapshot_endpoint": (
                    f"/api/agents/sessions/{req.session_id}/messages" if req.session_id else None
                ),
            }
            if outcome.status == REPLAY_HIT:
                for item in outcome.events:
                    yield _format_sse(item["id"], item["event"])
                # 如果有重放事件且最后一个事件是 done/error,直接结束
                if outcome.events and outcome.events[-1]["event"].get("type") in (SSE_DONE, SSE_ERROR):
                    return
            else:
                logger.warning(
                    "SSE 续传不可用(status=%s): last_event_id=%s task=%s dropped=%d reason=%s",
                    outcome.status,
                    last_event_id,
                    replay_task_id,
                    outcome.dropped,
                    outcome.reason,
                )
            # 本次新 run 自己若发生溢出,当前读数是 0(还没写),它会在**下一次重连**的
            # resume.dropped_events 里现形 —— 丢弃数按 task 累计,不靠单条流的生命周期。

        try:
            # 发送开始事件(携带 resume_from 供客户端判断是否为重连;resume 块带三态续传结论)
            start_event: dict[str, Any] = {
                "type": SSE_START,
                "task_id": task_id,
                "session_id": req.session_id,
                "resume_from": last_event_id,
            }
            if resume is not None:
                start_event["resume"] = resume
            eid = sse_buffer.append(task_id, start_event)
            yield _format_sse(eid, start_event)

            # L5-10(2026-08-12):AgentLoopV2 执行器(env AGENT_EXECUTOR=loop_v2 启用)。
            # 重试/错误分类/元学习/事件总线,SSE 事件经 hook_engine 订阅器按 session 过滤。
            if _is_loop_v2_enabled():
                from ..services.hook_engine import hook_engine

                session_id = req.session_id or f"session-{asyncio.get_running_loop().time()}"

                # O19:登记属主,供 tasks/stream 与 /agents/{id}/stream 做事件级属主过滤
                record_ownership(session_id, current_user)
                owned_sessions.append(session_id)
                # V3 #47 第二格(2026-09-26):角色必须过桥。此前本端点从不读
                # request.state.role_id ⇒ `_build_loop_v2_tools` 与 call_tool 都按默认 0
                # 走,admin 在主执行链上永远拿不到 `_ADMIN_ONLY_TOOLS` 里的能力;
                # 而引擎自带工具连矩阵都不经过 —— 两头同时错。取不到角色 = 0 = 普通用户。
                user_role = resolve_request_role_id(request)
                # D144③(2026-09-29):构造参数表从本处**移出**到 `_new_v2_loop`,
                # 与非流式 execute、断点续跑三处共用一份 —— 逐参数取值一字未改。
                loop = await _new_v2_loop(
                    model=req.model,
                    tools=req.tools,
                    max_iterations=req.max_iterations,
                    session_id=session_id,
                    current_user=current_user,
                    user_role=user_role,
                    permission_mode=_resolved_permission_mode(req.permission_mode),
                    # V3 #84 生产者侧:耐久视野声明透传(省略 = None = 非耐久,零差异)。
                    durable_horizon_seconds=req.durable_horizon_seconds,
                )
                # V3 #65(2026-09-28):把这枚在飞循环登记进 run 控制面,`pause()` 从此
                # 才有人能够得着 —— 此前 loop 实例是生成器的局部变量,HTTP 面无任何
                # session→loop 索引,所以 loop_v2 里那个 `pause()` 是零调用方的死代码。
                # owner 取的是令牌主体 current_user,不是 req.session_id 之类的自报值。
                await register_run(session_id, owner_user_id=current_user, loop=loop)
                registered_sessions.append(session_id)
                # 订阅事件 → SSE(统一订阅集合 agent_events.AGENT_SUBSCRIBE_EVENTS,
                # 补齐 thinking.delta/plan.step/session.end/permission.mode,
                # 只转发本 session 的 hook 事件)
                subs: dict[str, asyncio.Queue[Any]] = {}
                for evt in AGENT_SUBSCRIBE_EVENTS:
                    subs[evt] = hook_engine.subscribe(evt)
                try:
                    # L5-10 打磨(2026-08-12):run() 与事件转发并发——
                    # 此前 run() 完成后才消费队列(3s 窗口),SSE 不实时;
                    # 现 run 在后台任务执行,主流程边跑边转发(真流式)。
                    run_task = asyncio.create_task(
                        loop.run([{"role": "user", "content": req.goal}])
                    )
                    while not run_task.done() or any(
                        not q.empty() for q in subs.values()
                    ):
                        drained = False
                        for evt, q in subs.items():
                            try:
                                payload = q.get_nowait()
                            except asyncio.QueueEmpty:
                                continue
                            drained = True
                            # thinking.delta/plan.step 以 run_id(=session_id)承载,无 session_id 键
                            if (payload.get("session_id") or payload.get("run_id")) not in (session_id, ""):
                                continue
                            sse_evt = {
                                "type": map_hook_event_to_sse(evt),
                                "session_id": session_id,
                                "payload": payload,
                            }
                            eid2 = sse_buffer.append(task_id, sse_evt)
                            yield _format_sse(eid2, sse_evt)
                        if not drained:
                            if run_task.done():
                                break
                            await asyncio.sleep(0.05)
                    result = run_task.result()
                    # ── AGENTS.md §8 第 3 步的调用点(2026-09-25 立)────────────────
                    # 循环在"LLM 不再发 tool_calls"那一轮就返回 success=True
                    # (agent_loop_v2.py:3574-3586) —— 那正是 §8 禁止的"模型自评 yes"。
                    # 声明了硬性指标时,达成宣告必须先过独立校验轮:闸门只允许把
                    # True 收成 False,任何"未判定"都不构成通过。异常同样 fail-closed
                    # (闸门内部已收敛,这里再兜一层防止 done 帧整个丢掉)。
                    verification_payload: dict[str, Any] | None = None
                    frame_success = result.success
                    frame_stop_reason = result.stop_reason
                    if req.hard_criteria:
                        try:
                            decision = await gate_goal_completion(
                                session_id=session_id,
                                specs=[c.to_spec() for c in req.hard_criteria],
                                iterations=result.iterations,
                                final_response=result.final_response,
                                executor_model=req.model,
                                loop_success=result.success,
                                loop_stop_reason=result.stop_reason,
                            )
                        except Exception as exc:  # noqa: BLE001 - 判不了就等于没达成
                            logger.exception("goal 独立校验闸门调用失败(按未判定处理)")
                            frame_success = False
                            frame_stop_reason = "verification_undetermined"
                            verification_payload = {
                                "status": "not_run",
                                "goal_status": "undetermined",
                                "treat_as_complete": False,
                                "criteria": [],
                                "independent_request_made": False,
                                "judge_model": None,
                                "unavailable_reason": (
                                    f"独立校验闸门调用失败: {type(exc).__name__}: {exc}"
                                ),
                                "independence_warnings": [],
                                "consecutive_failures": 0,
                                "max_consecutive_failures": 0,
                            }
                        else:
                            verification_payload = (
                                dict(decision.payload) if decision.payload else None
                            )
                            if not decision.allowed_complete:
                                frame_success = False
                                if decision.stop_reason:
                                    frame_stop_reason = decision.stop_reason
                    # 结果事件(唯一 done,含 success/stop_reason/output)
                    # 2026-09-17 修复:去掉 [:2000] 截断——长回复被静默截断,
                    # 前端拿不到完整 final_response;SSE 行大小由网关层保证。
                    result_evt = {
                        "type": SSE_DONE,
                        "task_id": task_id,
                        "session_id": session_id,
                        "success": frame_success,
                        "stop_reason": frame_stop_reason,
                        "output": getattr(result, "final_response", ""),
                        # W9#7(2026-09-18):done 回传 checkpoint_id —— 前端无需再
                        # 二次查询 /checkpoints 即可定位可回滚点(paused/cancelled/
                        # 异常中断时 AgentLoopResult 均携带;正常完成通常为 None)
                        "checkpoint_id": getattr(result, "checkpoint_id", None),
                        # §8 第 3 步:校验结论必须到人,不得只进日志。None = 本次未启用
                        # 独立校验(非 goal 模式);启用时逐条 verdict + reason 都在这里,
                        # 前端按 goal_status 渲染 goal 状态行即可。
                        "verification": verification_payload,
                        "goal_status": (
                            verification_payload.get("goal_status")
                            if verification_payload
                            else None
                        ),
                    }
                    eid3 = sse_buffer.append(task_id, result_evt)
                    yield _format_sse(eid3, result_evt)
                finally:
                    for evt, q in subs.items():
                        hook_engine.unsubscribe(evt, q)
                return

            # D6 第 1 步(2026-09-19 立):后端栈归一——langgraph fallback 与 v1 兜底已删除。
            # agent_loop_v2 为唯一执行事实源(审计报告 outputs/AI能力深度对标分析报告-2026-09-19.md):
            # 原「LangGraph 工作流 → v1 run_stream 降级」双兜底为死分支(langgraph_service 仅剩
            # 此处与 a2a_service 两处运行时消费),统一收敛到 AgentLoopV2。
            # 显式关闭 v2(env AGENT_EXECUTOR≠loop_v2)时返回错误帧,不再静默降级到旧引擎
            # (SSE 事件序列契约不变:错误帧与 done/error 语义一致,Last-Event-ID 重放兼容)。
            else:
                err_event = {
                    "type": SSE_ERROR,
                    "task_id": task_id,
                    "message": "agent executor disabled: AgentLoopV2 is the only supported executor (set AGENT_EXECUTOR=loop_v2)",
                    "errorCode": "EXECUTOR_DISABLED",
                }
                eid = sse_buffer.append(task_id, err_event)
                yield _format_sse(eid, err_event)

            # 发送结束事件
            done_event = {"type": SSE_DONE, "task_id": task_id}
            eid = sse_buffer.append(task_id, done_event)
            yield _format_sse(eid, done_event)
        except Exception as e:
            err_event = {"type": SSE_ERROR, "message": str(e)}
            eid = sse_buffer.append(task_id, err_event)
            yield _format_sse(eid, err_event)
        finally:
            # G9: 立即清理缓冲区,避免已完成会话的过期事件占内存(TTL 仍兜底重连场景)
            sse_buffer.clear(task_id)
            # V3 #65:解绑控制面里的 loop 引用。paused 记录**故意保留**
            # (detach_run 内部判定):流式作用域一退出,run_ownership 就被下面释放,
            # 若把暂停记录一并删掉,resume 就失去进程内属主依据、只能退回持久层。
            for sid in registered_sessions:
                await detach_run(sid, owner_user_id=current_user)
            # O19:run 结束即释放属主登记(与 record_ownership 成对;TTL 只作兜底)
            for sid in owned_sessions:
                release_ownership(sid)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲,确保实时流式
        },
    )


async def _resume_run_from_checkpoint(
    checkpoint_id: str,
    *,
    model: str | None,
    max_iterations: int | None,
    tools: list[str] | None,
    request: Request,
    current_user: str,
    permission_mode: str | None = None,
    durable_horizon_seconds: int | None = None,
) -> "AgentLoopResult":
    """构造与 execute/stream 同参的 AgentLoopV2 并从 checkpoint 续跑(**全仓唯一实现**)。

    V3 #65(2026-09-28)从 `resume_agent_execute` 体内抽出:新增的"按会话续跑"出口要跑
    的是同一件事,复制一份构造参数就会长出第二个真相 —— 漏掉其中任一参数就是
    V3 #47 / V3 #55 那两条"resume 链上被静默降档"的洞的再版本(§3 共享层优先)。

    Raises:
        ValueError: checkpoint 不存在 / 已过期,由 `resume_from_checkpoint` 抛出;
            调用方各自映射成自己的响应形态(不在此层决定 HTTP 语义)。
    """
    # V3 #47 第二格:角色在此取一次,下面两处(工具装配 + 循环构造)共用同一个值,
    # 不允许各取各的 —— 两次读取之间若身份被改,就会出现"工具按 A 角色装配、
    # 执行按 B 角色判定"的分叉。
    resumed_role = resolve_request_role_id(request)

    # b76-11(2026-09-30):resume 站现在真的带上权限档 —— 由两条 resume 出口
    # (/agents/execute/resume、/agents/{session_id}/resume)各自从请求解析后传入,
    # 冷恢复重建 runtime 时沿用 create 的权限面,不再永远回落 env 默认。
    # None = 请求没带 = 沿用 env 默认(与归一前行为逐字同值)。
    loop = await _new_v2_loop(
        model=model,
        tools=tools,
        max_iterations=max_iterations,
        session_id=None,
        current_user=current_user,
        user_role=resumed_role,
        permission_mode=permission_mode,
        # V3 #84 生产者侧:耐久视野声明透传(省略 = None = 非耐久,零差异)。
        durable_horizon_seconds=durable_horizon_seconds,
    )
    return await loop.resume_from_checkpoint(checkpoint_id)


def _resume_result_payload(
    result: "AgentLoopResult", requested_checkpoint_id: str
) -> dict[str, Any]:
    """续跑结果的响应体(两条 resume 出口共用,免得同一结果长出两种形状)。"""
    return {
        "success": result.success,
        "final_response": getattr(result, "final_response", ""),
        "stop_reason": result.stop_reason,
        # 续跑成功后 result.checkpoint_id 为 None(仅 pause/cancel/failed 落盘),
        # 故回显本次 resume 请求的 checkpoint_id,便于前端对齐续跑来源。
        "checkpoint_id": result.checkpoint_id or requested_checkpoint_id,
        "error": result.error,
        "total_iterations": len(result.iterations),
        "total_duration_ms": result.total_duration_ms,
    }


@router.post("/agents/execute/resume")
async def resume_agent_execute(
    req: AgentResumeRequest,
    request: Request,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """从 checkpoint 断点续跑 agent(MCP 工具包装 + AgentLoopV2.resume_from_checkpoint)。

    与 execute/stream 的 v2 分支使用同一套 AgentLoopV2 构造方式
    (_make_loop_v2_llm / _build_loop_v2_tools / enable_checkpoint=True),
    重建循环后调用 resume_from_checkpoint 从 checkpoint.iteration+1 继续执行。

    body: {checkpoint_id, model?, max_iterations?, tools?, permission_mode?}
    返回:{code:0, message:"ok", data:{success, final_response, stop_reason,
          checkpoint_id, error, total_iterations, total_duration_ms}}

    checkpoint 不存在 / 已过期 → code=404(与 v2 的 ValueError 语义对齐)。

    b76-11(2026-09-30):body 新增 permission_mode?—— 冷恢复重建 runtime 时沿用
    create 的权限面(此前请求档位被静默丢弃,永远回落 env 默认档)。注意本链仍是
    非流式:没有审批投递通道,default/acceptEdits 下若撞到需审批工具,按 V2 自带
    超时判**不执行**(失效方向是拒绝,不是放行);bypassPermissions 显式跳过审批,
    与创建时的选择同义。

    O19(2026-09-21):必须登录;principal 贯通到重建的循环(续跑期新产生的高危
    审批据此登记属主)。属主判定按可信度两级:
      ① **持久属主**:checkpoint 落盘时写入 `metadata.owner_user_id`(save_checkpoint
         的 owner_user_id 参数,由 AgentLoopV2 用 self._user_id 传入)—— 跨进程/重启
         后依然可判定,查得且非请求者 → 403;
      ② **在飞登记**:老 checkpoint(改造前写入)无 owner 字段,退到 run_ownership
         进程内登记比对;两者都判不出时只剩"必须登录"这一层地板(如实标注,不假装)。
    """
    from ..services.agent_checkpoint import get_agent_checkpoint_manager

    # b76-11(2026-09-30):档位在入口解析一次(认不出的值 400,绝不静默回落 default
    # —— G-161 立规),再贯通到 `_resume_run_from_checkpoint` → `_new_v2_loop`。
    resolved_mode = _resolved_permission_mode(req.permission_mode)

    # (V3 #65)AgentLoopV2 的构造已随续跑逻辑移入 `_resume_run_from_checkpoint`,
    # 本函数不再直接引它 —— 留着就是一句 F401,而它会让人误以为这里还有一份参数表。

    resumed_session: str | None = None
    try:
        existing = await get_agent_checkpoint_manager().load_checkpoint(
            req.checkpoint_id
        )
    except Exception as e:  # noqa: BLE001 - 探测失败按"属主不可判定"处理,不放大权限
        logger.warning("resume 属主探测失败(按不可判定继续,仅登录门槛): %s", e)
        existing = None
    if existing is not None:
        resumed_session = getattr(existing, "session_id", None) or None
        # ① 持久属主优先(跨进程可判定);② 无 owner 的旧数据退回在飞登记
        persistent_owner = existing.owner_user_id
        known_owner = persistent_owner or owner_of(resumed_session)
        if known_owner is not None and known_owner != current_user:
            raise HTTPException(
                status_code=403, detail="该 checkpoint 所属会话不属于当前用户"
            )
        # G-1058610③(2026-10-05 机主拍板):两级都判不出属主 ⇒ **不放行自动续跑**。
        # 旧口径是"只剩登录地板即放行"并顺手 record_ownership 把会话登记给请求者 ——
        # 那等于让第一个按下续跑的人无声取得归属。现在停在原地:报 409 等人确认归属,
        # **不登记归属**(登记即放行,放行即本次要关掉的那个口)。
        if known_owner is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "AGENT_RESUME_OWNER_UNVERIFIABLE: 该 checkpoint 没有可判定的属主"
                    "(既无持久 owner_user_id,也无进程内在飞登记),按机主拍板不自动放行续跑 —— "
                    "请先人工确认这条会话的归属再续跑"
                ),
            )
        if resumed_session:
            record_ownership(resumed_session, current_user)

    try:
        # V3 #65:构造 + 续跑已抽到 `_resume_run_from_checkpoint`(全仓唯一实现),
        # 与新的"按会话续跑"出口共用,不再有两份参数表。
        result = await _resume_run_from_checkpoint(
            req.checkpoint_id,
            model=req.model,
            max_iterations=req.max_iterations,
            tools=req.tools,
            request=request,
            current_user=current_user,
            permission_mode=resolved_mode,
            # V3 #84 生产者侧:耐久视野声明透传(省略 = None = 非耐久,零差异)。
            durable_horizon_seconds=req.durable_horizon_seconds,
        )
    except ValueError as e:
        return {
            "code": 404,
            "message": str(e),
            "data": None,
        }
    finally:
        if resumed_session:
            release_ownership(resumed_session)
    return {
        "code": 0,
        "message": "ok",
        "data": _resume_result_payload(result, req.checkpoint_id),
    }


# ---------------------------------------------------------------------------
# V3 #65(2026-09-28):按会话暂停 / 续跑 —— pause 的对外出口
# ---------------------------------------------------------------------------


class AgentSessionPauseRequest(BaseModel):
    """暂停请求(POST /agents/{session_id}/pause)。

    会话由 **路径** 寻址,身份由 **令牌** 提供 —— 本 body 里刻意没有任何
    `user_id` / `owner` 字段可填:可填就等于可冒充。
    """

    reason: str | None = Field(
        None,
        max_length=500,
        description="暂停原因(可选);仅进审计日志,不参与任何判定或鉴权",
    )


class AgentSessionResumeRequest(BaseModel):
    """续跑请求(POST /agents/{session_id}/resume)。"""

    model: str | None = Field(None, description="指定模型,为空沿用暂停时的默认解析")
    max_iterations: int | None = Field(
        None, ge=1, le=200, description="续跑轮次上限(越界拒 422,不做静默钳位)"
    )
    tools: list[str] | None = Field(None, description="允许调用的工具名列表")
    # b76-11(2026-09-30):与 AgentResumeRequest 同格 —— 冷恢复沿用 create 的权限面;
    # 两条 resume 出口共用 `_resume_run_from_checkpoint`,字段面也必须同形,否则
    # "按 checkpoint 续跑能带档、按会话续跑不能"就是第两份漂开的参数表。
    permission_mode: str | None = Field(
        None,
        description="权限模式:default / acceptEdits / bypassPermissions / plan / manual"
        "(历史别名自动归一;省略沿用 env 默认)",
    )
    # V3 #84 生产者侧(2026-10-07):与 AgentResumeRequest 同格,同因 —— 耐久视野
    # 声明面两条 resume 出口必须同形。省略 = 不声明 = 重建循环不写耐久键。
    durable_horizon_seconds: int | None = Field(
        None,
        ge=1,
        le=int(DURABLE_HORIZON_MAX_SECONDS),
        description="耐久任务视野声明(秒,1 ~ 7天);续跑重建的循环落盘时携带,省略 = 非耐久",
    )


_PAUSE_STATUS_BY_OUTCOME: dict[PauseOutcome, int] = {
    PauseOutcome.NOT_RUNNING: 409,
    PauseOutcome.UNKNOWN_SESSION: 404,
    PauseOutcome.FORBIDDEN: 403,
    PauseOutcome.CHECKPOINT_UNAVAILABLE: 503,
}

_RESUME_STATUS_BY_OUTCOME: dict[ResumeOutcome, int] = {
    ResumeOutcome.FORBIDDEN: 403,
    ResumeOutcome.NO_CHECKPOINT: 404,
    ResumeOutcome.NOT_PAUSED: 409,
    ResumeOutcome.OWNER_UNVERIFIABLE: 409,
    ResumeOutcome.RESUME_FAILED: 503,
}


def _pause_http_error(outcome: PauseOutcome, detail: str | None) -> HTTPException:
    """把非成功格映射成 HTTP 错误。

    状态码按结论枚举逐格映射,**不做 default→400 的兜底**:新增一格而忘了在这里
    登记,必须表现为一次 KeyError(测试立即红),而不是被悄悄归进一个通用码 ——
    那正是"响应分不出是哪一型失败"的成因。
    """
    status = _PAUSE_STATUS_BY_OUTCOME[outcome]
    return HTTPException(
        status_code=status,
        detail={"errorCode": f"AGENT_PAUSE_{outcome.name}", "message": detail or outcome.value},
    )


@router.post("/agents/{session_id}/pause")
async def pause_agent_session(
    session_id: str,
    req: AgentSessionPauseRequest | None = None,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """暂停某个会话正在跑的 agent loop(V3 #65 补的那一格 HTTP 出口)。

    `AgentLoopV2.pause()` 自 2026-09-18 起就在 `agent_loop_v2.py:4057`,但全仓零调用方、
    HTTP 面也没有本路由 —— loop 层的机制在位,外面没有人能够得着它。本端点接的正是
    这一格(`agent_run_control.register_run` 在流式执行处把在飞循环登记进控制面)。

    属主鉴权:判定发生在 `agent_run_control.pause_session` 里,**先判属主再动 I/O**,
    属主取令牌主体(`require_request_user_id`)与控制面登记时写入的那份比对;
    路径里的 `session_id` 只是被寻址的键,不构成任何身份声明。

    响应(每格可分辨,不把"没动"写成"动了"):
      200 code=0 outcome="paused"            changed=true  + checkpoint_id
      200 code=0 outcome="already_paused"    changed=false + checkpoint_id(幂等)
      403 AGENT_PAUSE_FORBIDDEN              会话属于别人(且未发出任何查询)
      404 AGENT_PAUSE_UNKNOWN_SESSION        本实例不认识该会话
      409 AGENT_PAUSE_NOT_RUNNING            认识但它现在不在跑
      503 AGENT_PAUSE_CHECKPOINT_UNAVAILABLE  暂停标志已置位而检查点没落盘
        —— 这一格刻意不记成功:run 会停下,但**没有恢复点**,后续 resume 必然
        拿不到东西。"改了 0 却回成功"是守门 134 立项的那一型,不得在这里复活。

    一次暂停会落两个检查点(loop 层既有形状,详见 `agent_run_control.pause_session`
    的注释):响应带回的是**按下暂停那一刻**的 `checkpoint_stage="eager"` 快照,循环
    随后在轮次边界还会落一个更完整的暂停点。因此续跑一律**按会话取最新暂停点**
    (`/agents/{session_id}/resume`),不要拿这里的 id 去 `/agents/execute/resume`,
    那会重跑一轮工具调用。
    """
    verdict = await pause_session(session_id, current_user)
    if verdict.outcome not in (PauseOutcome.PAUSED, PauseOutcome.ALREADY_PAUSED):
        raise _pause_http_error(verdict.outcome, verdict.detail)
    if req is not None and req.reason:
        # 只进审计日志;不回显到响应,避免把用户输入原样倒回前端(与 §5 凭据面同一取向)
        logger.info(
            "agent 暂停原因:user=%s session=%s reason=%s",
            current_user,
            session_id,
            req.reason,
        )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "session_id": session_id,
            "outcome": verdict.outcome.value,
            "changed": verdict.changed,
            "checkpoint_id": verdict.checkpoint_id,
            # "eager" = 这是**按下暂停那一刻**存的快照;循环随后在轮次边界还会再存一个
            # 更完整的暂停点,而"按会话续跑"取的是那一个。前端若要把 id 存下来自己续跑,
            # 必须知道它可能已被更新一轮的快照取代 —— 不标注就是让调用方拿旧 id 去 resume,
            # 结果是**重跑一轮工具调用**(带副作用的工具重跑一次就是真实事故)。
            "checkpoint_stage": (
                "eager"
                if verdict.outcome is PauseOutcome.PAUSED
                else "recorded"
            ),
        },
    }


@router.post("/agents/{session_id}/resume")
async def resume_agent_session(
    session_id: str,
    req: AgentSessionResumeRequest,
    request: Request,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """按**会话**从暂停点续跑(V3 #65)。

    与 `POST /agents/execute/resume` 的分工:那条按 `checkpoint_id` 续跑,要求调用方
    自己存住暂停时返回的 id;本条只需会话标识 —— 暂停点由控制面/持久层按 session 定位,
    前端"暂停 → 继续"不必先把 checkpoint_id 落地再传回来。
    两条共用同一个续跑实现 `_resume_run_from_checkpoint`,不存在第二份参数表。

    属主:进程内暂停记录在位时**零查询**即可拒绝他人;记录随进程重启消失时退回
    checkpoint 的持久属主(`metadata.owner_user_id`),与 `resume_agent_execute`
    的两级口径同形。

    响应:
      200 code=0 outcome="resumed"      + data.result(与 execute/resume 同形状)
      403 AGENT_RESUME_FORBIDDEN        会话/检查点属于别人
      404 AGENT_RESUME_NO_CHECKPOINT    没有可续跑的暂停点
      409 AGENT_RESUME_NOT_PAUSED       它正在跑(或最新检查点已不是 paused 态)
      503 AGENT_RESUME_RESUME_FAILED    存储/循环不可用(含"查不了"不等于"查不到")
    """

    # b76-11(2026-09-30):与 /agents/execute/resume 同一口径 —— 档位在入口解析
    # (认不出的值 400),解析失败发生在动任何存储之前;不放进 _runner,那里把
    # 异常一律映射成 404/503,会把"请求写错了"伪装成"资源没了"。
    resolved_mode = _resolved_permission_mode(req.permission_mode)

    async def _runner(
        checkpoint: AgentLoopCheckpoint, requester: str
    ) -> dict[str, object]:
        try:
            result = await _resume_run_from_checkpoint(
                checkpoint.checkpoint_id,
                model=req.model,
                max_iterations=req.max_iterations,
                tools=req.tools,
                request=request,
                current_user=requester,
                permission_mode=resolved_mode,
                # V3 #84 生产者侧:耐久视野声明透传(省略 = None = 非耐久,零差异)。
                durable_horizon_seconds=req.durable_horizon_seconds,
            )
        except ValueError as exc:
            # resume_from_checkpoint 的"这个 checkpoint 没了"在这里是**取用前的竞态失效**
            # (状态判定阶段已经确认它是 paused)。转成 SessionNotFoundError 交回控制面,
            # 由它判成 404 而不是 503 —— 两格的处置动作不同,不得合并。
            raise SessionNotFoundError(str(exc)) from exc
        return dict(_resume_result_payload(result, checkpoint.checkpoint_id))

    verdict = await resume_session(session_id, current_user, runner=_runner)
    if verdict.outcome is not ResumeOutcome.RESUMED:
        raise HTTPException(
            status_code=_RESUME_STATUS_BY_OUTCOME[verdict.outcome],
            detail={
                "errorCode": f"AGENT_RESUME_{verdict.outcome.name}",
                "message": verdict.detail or verdict.outcome.value,
            },
        )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "session_id": session_id,
            "outcome": verdict.outcome.value,
            "changed": verdict.changed,
            "checkpoint_id": verdict.checkpoint_id,
            "result": verdict.result,
        },
    }


# ---------------------------------------------------------------------------
# O19(2026-09-21)端点级属主辅助
# ---------------------------------------------------------------------------


def _assert_session_access(session_id: str | None, current_user: str) -> None:
    """尽力校验会话属主:可判定且不是请求者 → 403。

    **刻意不 fail-closed 到 403**:run_ownership 只登记本进程在飞的 run,进程重启 /
    跨实例 / 数据源本身无属主概念(如 checkpoint 表、_trace_store、deliverables LRU)
    时查不到记录,此时只能保留"必须登录"这一层地板。调用点必须在注释里如实写明
    "属主不可判定 ⇒ 不校验",不得把这条辅助当完整属主鉴权用。
    """
    if not session_id:
        return
    known_owner = owner_of(session_id)
    if known_owner is not None and known_owner != current_user:
        raise HTTPException(status_code=403, detail="该会话不属于当前用户")


def _owned_by_current_user(session_id: object, current_user: str) -> bool:
    """聚合视图的可见性判定:属主可判定且非请求者 → 不可见;属主未知 → 保留。

    用于 /agents/running、/agent/traces 这类"整表返回"的端点:它们的数据源
    (v1 AgentExecutor._running / 进程内 _trace_store)**没有 user_id 字段**,
    无法在写入侧归属;只能拿 run_ownership 的在飞登记做正向排除。
    属主未登记的条目仍会出现在结果里 —— 这是聚合视图的既有限制,已在各端点
    docstring 明示,不作为"已按属主隔离"的结论。
    """
    if not isinstance(session_id, str) or not session_id:
        return True
    known_owner = owner_of(session_id)
    return known_owner is None or known_owner == current_user


@router.get("/agents/running")
async def list_running(
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """列出所有运行中/已完成任务。

    O19:必须登录 + 正向排除他人任务。task 记录本身无 user_id 字段(v1 执行器
    不落属主),故只能按 run_ownership 在飞登记排除"确定属于别人"的条目;
    未登记的条目无法判定 ⇒ 仍可见 —— 返回的是聚合运行态视图,不是按用户隔离的清单。
    """
    tasks = agent_executor.list_running()
    visible = {
        task_id: info
        for task_id, info in tasks.items()
        if _owned_by_current_user(info.get("session_id"), current_user)
    }
    return {"tasks": visible}


@router.get("/agents/sessions")
async def list_sessions(
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """列出**当前用户**的会话 ID。

    O19:此前一处 user_id 都不传 ⇒ memory_store.list_sessions() 走"不传=列全站"
    分支,等于把所有人的 session id 泄露给匿名调用方。现在传 current_user,
    复用 memory.py 既有的 P1-6 复合 key 隔离(`memory:{user_id}:{session_id}`),
    不新造隔离机制。legacy 无前缀键(改造前写入的历史数据)因此不再可见 ——
    这是收口的预期代价,不得靠"回退列全站"绕过。
    """
    sessions = await memory_store.list_sessions(user_id=current_user)
    return {"sessions": sessions, "count": len(sessions)}


@router.get("/agents/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    limit: int = 100,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """获取指定会话的消息列表(按 current_user 的复合 key 读取,P1-6 隔离)。

    他人会话在隔离 key 下读不到内容;属主可判定为正错时直接 403(见
    _assert_session_access 的能力边界说明)。
    """
    _assert_session_access(session_id, current_user)
    messages = await memory_store.get(session_id, limit=limit, user_id=current_user)
    return {"session_id": session_id, "messages": messages, "count": len(messages)}


@router.get("/agents/sessions/{session_id}/deliverables")
async def get_session_deliverables(
    session_id: str,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """D27(2026-09)获取指定会话的任务完成交付清单。

    未命中(任务未成功结束 / 被 LRU 淘汰 / 进程重启)也返回 200,
    deliverables 为 null,前端按「暂无交付清单」渲染。

    O19:必须登录 + 属主可判定时正向排除(agent_deliverables 是进程内 LRU,
    存储本身没有 user_id 列 ⇒ 属主未知时只能退到"登录地板")。
    """
    _assert_session_access(session_id, current_user)
    return {"session_id": session_id, "deliverables": get_deliverables(session_id)}


@router.delete("/agents/sessions/{session_id}")
async def clear_session(
    session_id: str,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """清除指定会话的全部消息(按 current_user 的复合 key 删除,P1-6 隔离)。

    O19:向量层同样按属主裁剪 —— `vector_memory.clear(session_id, user_id)` 只删
    "该会话且属主为 current_user"的条目。改造前写入的无属主旧条目不会被本调用清除
    (也无从判定属于谁),但它们在按属主检索时已 fail-closed 不可见,不构成泄漏面。
    """
    _assert_session_access(session_id, current_user)
    await memory_store.clear(session_id, user_id=current_user)
    await vector_memory.clear(session_id, user_id=current_user)
    return {"session_id": session_id, "cleared": True}


@router.post("/agents/memory/search")
async def search_memory(
    req: MemorySearchRequest,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """语义搜索记忆(向量检索,按属主裁剪)。

    通过 LLM 嵌入向量 + 余弦相似度检索当前用户自己的历史记忆。
    O19(2026-09-21)收口:vector_memory 条目带 user_id 属主标记,search() 按
    认证身份精确过滤,不再返回全站聚合结果。兼容性:改造前写入的旧条目无
    user_id(属主未知),fail-closed 对任何用户不可见(漏返回只是功能降级,
    漏过滤就是跨用户泄漏)。req.session_id 仅为检索范围提示,不做属主校验
    (越权面已由属主过滤收敛)。
    """
    query_embedding = await vector_memory.embed(req.query)
    results = await vector_memory.search(
        query_embedding=query_embedding,
        top_k=req.top_k,
        user_id=current_user,
    )
    return {"query": req.query, "results": results, "count": len(results)}


@router.get("/agents/{task_id}/status")
async def get_task_status(
    task_id: str,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """查询任务状态。

    O19:必须登录;task 记录里带 session_id ⇒ 属主可判定时比对(见
    _assert_session_access 的能力边界)。v1 执行器不把 user_id 落到 task 记录,
    且 run 结束后 run_ownership 即释放 ⇒ 历史任务状态无法回溯属主。
    """
    info = agent_executor.status(task_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    _assert_session_access(info.get("session_id"), current_user)
    return info


@router.post("/agents/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """取消任务。

    O19:必须登录 + 属主可判定时比对。取消是**写操作**,但 v1 的 task 记录无
    user_id ⇒ 属主未知的在飞任务只能靠"必须登录"兜住(敞口已上报)。
    """
    info = agent_executor.status(task_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    _assert_session_access(info.get("session_id"), current_user)
    ok = agent_executor.cancel(task_id)
    latest_info = agent_executor.status(task_id)
    return {"task_id": task_id, "canceled": ok, "status": latest_info["status"] if latest_info else "cancelled"}


@router.post("/agents/skill-evolution")
async def trigger_skill_evolution(
    request: Request,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """手动触发 Skill 自进化评估。

    body: SkillEvolutionRequest 字典
    (taskId/sessionId/goal/steps/finalResult/existingSkills)。

    O19:必须登录(该端点会**消耗 LLM 并产出可复用 Skill**,匿名触发即白嫖 + 污染
    共享技能库)。body 里的 taskId/sessionId 由客户端自述,服务端无属主索引 ⇒
    不做属主比对(不假装能校验);Skill 归属维度属后续改造。
    """
    body = await request.json()
    result = await skill_evolution_service.evaluate(body)
    return {"code": 0, "message": "ok", "data": result}


@router.post("/agents/debate")
async def agent_debate(
    request: Request,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """多 Agent 协商辩论(debate/vote/critique 三模式,P1-2)。

    body: AgentDebateRequest 字典(mode/agents/topic/maxRounds/sessionId/modelOverride)。
    - mode="debate":多 Agent 多轮交替发言,LLM 综合结论
    - mode="vote":每个 Agent 出方案,所有 Agent 投票选最佳
    - mode="critique":第一个 Agent 出方案,其余批判,迭代改进

    O19:必须登录(一次调用 = N 个 Agent × maxRounds 轮 LLM 消耗,匿名可被刷)。
    body.sessionId 只是编排器的会话标签,无属主索引 ⇒ 不做属主比对。
    """
    body = await request.json()
    mode = body.get("mode", "debate")
    agents = body.get("agents", [])
    topic = body.get("topic", "")
    max_rounds = int(body.get("maxRounds", 3))
    session_id = body.get("sessionId")
    model_override = body.get("modelOverride")

    if len(agents) < 2:
        return {"code": 400, "message": "至少需要 2 个 Agent", "data": None}

    if mode == "debate":
        result = await agent_orchestrator.run_debate(
            agents, topic, max_rounds, session_id, model_override
        )
    elif mode == "vote":
        result = await agent_orchestrator.run_vote(
            agents, topic, session_id, model_override
        )
    elif mode == "critique":
        result = await agent_orchestrator.run_critique(
            agents, topic, max_rounds, session_id, model_override
        )
    else:
        return {"code": 400, "message": f"不支持的 mode: {mode}", "data": None}

    return {
        "code": 0,
        "message": "ok",
        "data": AgentOrchestrator.orchestration_to_dict(result),
    }


@router.get("/agent/trace/{session_id}")
async def get_agent_trace(
    session_id: str,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """获取 Agent 执行轨迹。

    返回该 session 的完整 trace(每轮迭代的推理/工具调用/结果/耗时)。
    数据由 AgentLoopV2 执行完成后通过 store_trace 写入。

    O19:必须登录 + 属主可判定时比对。_trace_store 是进程内 LRU 且条目**不含
    user_id**,故进程重启后(或该 run 不是本进程起的)属主无从判定 —— 此时只剩
    "必须登录"这一层地板,不假装已完成属主隔离。trace 含用户原文,是最需要
    属主绑定的数据面;根治要在 store_trace 时落 owner。
    """
    _assert_session_access(session_id, current_user)
    trace = _trace_store.get(session_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return {"code": 0, "message": "success", "data": trace}


@router.get("/agent/traces")
async def list_agent_traces(
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """列出所有可用的 Agent 执行轨迹。

    返回每个 trace 的元数据（session_id、timestamp、goal/task 摘要等），
    按 timestamp 降序排列，最多返回 50 条。

    O19:必须登录 + 正向排除"确定属于别人"的条目(见 _owned_by_current_user:
    trace 表无 owner 字段 ⇒ 未登记的条目仍可见,这是聚合清单的既有限制)。
    """
    traces: list[dict[str, Any]] = []
    for session_id, trace_data in _trace_store.items():
        if not _owned_by_current_user(session_id, current_user):
            continue
        goal_raw = trace_data.get("goal", "")
        goal = (goal_raw[:100] + "...") if len(goal_raw) > 100 else goal_raw
        traces.append({
            "session_id": session_id,
            "timestamp": trace_data.get("timestamp", 0),
            "goal": goal,
            "steps": trace_data.get("iterations", 0) or len(trace_data.get("steps", [])),
            "status": trace_data.get("status", "completed"),
        })

    traces.sort(key=lambda t: t["timestamp"], reverse=True)
    return {"code": 0, "message": "success", "data": traces[:50]}


@router.get("/agents/{agent_id}/tool-calls")
async def get_agent_tool_calls(
    agent_id: str,
    range: str = "24h",
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """Agent 工具调用链(agent-runtime ToolCallTree 数据源,2026-08-12 补缺)。

    此前 web 端调用 /api/agents/{id}/tool-calls 在 8802/8803 均 404。
    数据源:checkpoint trace(messages 中 assistant.tool_calls + tool 结果),
    缺失时降级进程内 _trace_store。

    O19:必须登录;agent_id 即 session_id ⇒ 在飞会话可按 run_ownership 比对属主。
    checkpoint / trace 存储本身无 user_id 列 ⇒ 属主未知的历史条目退化为"仅需登录"。
    """
    _assert_session_access(agent_id, current_user)
    calls: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cp = await get_agent_checkpoint_manager().load_latest_by_session(agent_id)
        if cp and cp.messages:
            for msg in cp.messages:
                if msg.get("role") == "assistant" and msg.get("tool_calls"):
                    for tc in msg["tool_calls"]:
                        calls.append({
                            "id": tc.get("id", ""),
                            "name": tc.get("name", ""),
                            "args": tc.get("args", {}),
                            "status": "called",
                            "result": "",
                        })
                elif msg.get("role") == "tool":
                    content = str(msg.get("content", ""))
                    matched = next(
                        (c for c in reversed(calls)
                         if c.get("id") == msg.get("tool_call_id")
                         and c.get("status") == "called"),
                        None,
                    )
                    if matched:
                        matched["status"] = "error" if "error" in content[:200] else "ok"
                        matched["result"] = content[:500]
    except Exception as e:
        logger.warning("get_agent_tool_calls checkpoint 提取失败(降级): %s", e)
    if not calls:
        trace = _trace_store.get(agent_id)
        if trace:
            for step in (trace.get("steps") or []):
                if isinstance(step, dict) and step.get("tool"):
                    calls.append({
                        "id": str(step.get("tool_call_id", "")),
                        "name": str(step.get("tool", "")),
                        "args": step.get("args", {}),
                        "status": "error" if step.get("error") else "ok",
                        "result": str(step.get("result", ""))[:500],
                    })
    return {"code": 0, "message": "success", "data": {"toolCalls": calls}}


@router.get("/agents/{agent_id}/errors")
async def get_agent_errors(
    agent_id: str,
    range: str = "24h",
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """Agent 错误事件(agent-runtime ErrorHeatmap 数据源,2026-08-12 补缺)。

    数据源:checkpoint(failed 状态 + metadata.error + tool 消息 error)。

    O19:必须登录 + 在飞会话按属主比对(同 tool-calls;checkpoint 无 user_id 列,
    属主未知的历史条目只剩登录地板)。
    """
    _assert_session_access(agent_id, current_user)
    errors: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cp = await get_agent_checkpoint_manager().load_latest_by_session(agent_id)
        if cp:
            meta = cp.metadata or {}
            if cp.status == "failed" or meta.get("error"):
                errors.append({
                    "type": str(meta.get("error_type", "unknown")),
                    "message": str(meta.get("error", "agent_loop failed"))[:300],
                    "timestamp": cp.created_at,
                })
            for msg in (cp.messages or []):
                if msg.get("role") == "tool":
                    content = str(msg.get("content", ""))
                    if content.startswith('{"error"'):
                        errors.append({
                            "type": "tool_error",
                            "message": content[:300],
                            "timestamp": cp.created_at,
                        })
    except Exception as e:
        logger.warning("get_agent_errors checkpoint 提取失败(降级): %s", e)
    if not errors:
        trace = _trace_store.get(agent_id)
        if trace:
            for step in (trace.get("steps") or []):
                if isinstance(step, dict) and step.get("error"):
                    errors.append({
                        "type": "step_error",
                        "message": str(step.get("error", ""))[:300],
                        "timestamp": trace.get("timestamp", 0),
                    })
    return {"code": 0, "message": "success", "data": {"errors": errors}}


@router.get("/agents/{agent_id}/sessions")
async def get_agent_sessions(
    agent_id: str,
    range: str = "24h",
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """Agent 会话树(agent-runtime SessionTree 数据源,2026-08-12 补缺)。

    此前 web 端调用 /api/agents/{id}/sessions 在 8802/8803 均 404
    (8802 的 sessions 注册在 /api/agent-runtime/ 前缀,路径不匹配)。
    数据源:checkpoint manager 按 session 过滤(created_at 升序),
    缺失时降级进程内 _trace_store。

    O19:必须登录 + 在飞会话按属主比对(checkpoint 无 user_id 列 ⇒ 历史条目
    属主不可判定)。
    """
    _assert_session_access(agent_id, current_user)
    nodes: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cps = await get_agent_checkpoint_manager().list_checkpoints(session_id=agent_id)
        for cp in cps:
            status_map = {
                "completed": "completed",
                "running": "active",
                "paused": "active",
                "failed": "error",
                "cancelled": "archived",
            }
            nodes.append({
                "id": cp.checkpoint_id,
                "startedAt": _ts_to_iso(cp.created_at),
                "messageCount": len(cp.messages or []),
                "status": status_map.get(cp.status, "archived"),
            })
    except Exception as e:
        logger.warning("get_agent_sessions checkpoint 提取失败(降级): %s", e)
    if not nodes:
        trace = _trace_store.get(agent_id)
        if trace:
            nodes.append({
                "id": agent_id,
                "startedAt": _ts_to_iso(trace.get("timestamp", 0)),
                "messageCount": len(trace.get("steps") or []),
                "status": "completed" if trace.get("status") != "failed" else "error",
            })
    return {"code": 0, "message": "success", "data": {"sessions": nodes}}


@router.get("/agents/{agent_id}/token-usage")
async def get_agent_token_usage(
    agent_id: str,
    range: str = "24h",
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """Agent Token 用量(agent-runtime TokenUsageChart 数据源,2026-08-12 补缺)。

    此前 web 端调用 /api/agents/{id}/token-usage 在 8802/8803 均 404。
    数据源:checkpoint messages 按轮估算(prompt=输入/工具结果,completion=
    输出),缺失时降级 _trace_store。估算公式:字符数/4(中文约 1 token/字)。

    O19:必须登录 + 在飞会话按属主比对。用量本身是配额/计费口径数据,但
    checkpoint 无 user_id 列 ⇒ 历史条目属主不可判定(敞口已上报)。
    """
    _assert_session_access(agent_id, current_user)
    items: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cps = await get_agent_checkpoint_manager().list_checkpoints(session_id=agent_id)
        for cp in cps:
            prompt = 0
            completion = 0
            for msg in (cp.messages or []):
                role = msg.get("role", "")
                content = str(msg.get("content", ""))
                if role in ("user", "tool", "system"):
                    prompt += max(1, len(content) // 4)
                elif role == "assistant":
                    completion += max(1, len(content) // 4)
                    for tc in (msg.get("tool_calls") or []):
                        if isinstance(tc, dict):
                            completion += max(1, len(str(tc.get("args", ""))) // 4)
            if prompt or completion:
                items.append({
                    "sessionLabel": f"I{cp.iteration}",
                    "prompt": prompt,
                    "completion": completion,
                })
    except Exception as e:
        logger.warning("get_agent_token_usage checkpoint 提取失败(降级): %s", e)
    if not items:
        trace = _trace_store.get(agent_id)
        if trace:
            prompt = 0
            completion = 0
            for step in (trace.get("steps") or []):
                if isinstance(step, dict):
                    prompt += max(1, len(str(step.get("args", ""))) // 4)
                    completion += max(1, len(str(step.get("result", ""))) // 4)
            if prompt or completion:
                items.append({
                    "sessionLabel": agent_id[:8],
                    "prompt": prompt,
                    "completion": completion,
                })
    return {"code": 0, "message": "success", "data": {"tokenUsage": items}}


def _ts_to_iso(ts: Any) -> str:
    """时间戳(秒) → ISO8601(带 Z);非数值原样返回。"""
    if isinstance(ts, (int, float)) and ts > 0:
        import datetime as _dt

        return _dt.datetime.fromtimestamp(ts, tz=_dt.UTC).isoformat()
    return ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

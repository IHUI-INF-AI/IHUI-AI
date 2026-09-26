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

from ..core.jwt_auth import require_request_user_id
from ..core.sse_buffer import sse_buffer
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
    tool_names: list[str] | None,
) -> "SuperToolPool | None":
    """聚合内置 + 外部 MCP 工具为统一超级工具池。

    仅在开关开启且存在已连接外部 MCP server 时返回非 None pool;否则(开关关闭 /
    无外部 server / 任意聚合异常)返回 None,调用方据此降级到现有工具装配路径。
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
        external = await manager.list_available_tools_async()
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
    server_name: str, tool_name: str, args: dict[str, Any]
) -> Any:
    """call_forward 的统一路由:内置工具走 mcp_server,外部工具走 mcp_client。"""
    from ..services.mcp_server import mcp_server

    if server_name == _SUPERTOOL_INTERNAL_SOURCE:
        return await mcp_server.call_tool(tool_name, args)
    from ..services.mcp_client import get_mcp_client_manager

    manager = get_mcp_client_manager()
    client = manager.get_client(server_name)
    if client is not None:
        return await client.call_tool(tool_name, args)
    return await manager.call_external_tool(server_name, tool_name, args)


def _supertool_tools_from_pool(
    pool: "SuperToolPool",
    tool_names: list[str] | None,
) -> list[Any]:
    """把超级工具池转换为 AgentLoopV2 的 ToolDefinition 列表(沿用 deferral 逻辑)。"""
    from ..services.agent_loop_v2 import ToolDefinition
    from ..services.mcp_tool_aggregator import MCPSuperToolAggregator

    agg = MCPSuperToolAggregator()
    defer = _is_tool_deferral_enabled()
    forced = {"get_tool_schema"} if defer else set()
    tools: list[Any] = []
    for pt in pool.tools:
        key = pt.key
        if tool_names and key not in tool_names and key not in forced:
            continue

        async def _exec(args: dict[str, Any], _key: str = key) -> Any:
            return await agg.call_forward(pool, _key, args, invoke_fn=_supertool_invoke)

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


async def _build_loop_v2_tools(tool_names: list[str] | None) -> list[Any]:
    """把 MCP 工具包装为 AgentLoopV2 的 ToolDefinition 列表(白名单过滤)。

    工具执行器走 mcp_server.call_tool(与 v1 agent_executor 同源),
    失败抛异常由 AgentLoopV2 的瞬时错误重试/错误分类机制处理。

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
    pool = await _build_supertool_pool(tool_names)
    if pool is not None:
        return _supertool_tools_from_pool(pool, tool_names)

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
            return await mcp_server.call_tool(_name, args)

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
                    yield f"event: {sse_evt['type']}\ndata: {json.dumps(sse_evt, ensure_ascii=False)}\n\n"
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
                    yield f"data: {json.dumps(entry, ensure_ascii=False)}\n\n"
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
        req.approval_id, decision, current_user, scope=req.scope, reason=req.reason
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
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """执行 agent(同步返回结果)。

    O19(2026-09-21):必须登录,且把 principal 贯通到执行路径 ——
    ① `user_id` 传给 v1 执行器,会话记忆按 P1-6 复合 key(memory:{user}:{sid})读写,
       与 GET /agents/sessions* 的隔离口径一致;
    ② run 期间把 session→user 登记进 run_ownership,供事件流按属主过滤,run 结束即释放。
    """
    owned: list[str] = []
    # G-161:本端点走的是已弃用的单轮执行器(AgentExecutor),它从不构造 AgentLoopV2,
    # 因此权限档在此**无法生效**。此前 permission_mode 字段干脆不存在 → 被静默丢弃,
    # 客户端以为自己设了 bypassPermissions。宁可拒 400,也不允许"发了≠生效"。
    resolved_mode = _resolved_permission_mode(req.permission_mode)
    if resolved_mode is not None and resolved_mode != "default":
        raise HTTPException(
            status_code=400,
            detail=(
                f"permissionMode={resolved_mode} 仅在 POST /agents/execute/stream 生效"
                "(非流式端点使用弃用的单轮执行器,不含审批门)"
            ),
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
                "(单轮执行器不产出工具调用记录,独立校验无从取证,宁可不答)"
            ),
        )
    if req.session_id:
        record_ownership(req.session_id, current_user)
        owned.append(req.session_id)
    try:
        result = await agent_executor.run(
            goal=req.goal,
            session_id=req.session_id,
            model=req.model,
            max_iterations=req.max_iterations,
            tools=req.tools,
            user_id=current_user,
        )
        # 未显式传 session_id 时由执行器生成,补登记(此后同进程订阅者可判定属主)
        sid = result.get("session_id")
        if isinstance(sid, str) and sid and sid not in owned:
            record_ownership(sid, current_user)
            owned.append(sid)
        return result
    finally:
        for sid in owned:
            release_ownership(sid)


def _format_sse(event_id: str, event: dict[str, Any]) -> str:
    """格式化 SSE 事件(含 id + event + data 三行)。

    event 字段取自 payload 的 type,客户端可用 addEventListener 分发。
    """
    event_type = event.get("type", SSE_MESSAGE)
    return f"id: {event_id}\nevent: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


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
    - 服务端通过 sse_buffer 缓冲事件(5 分钟 TTL)
    - 重连时重放 Last-Event-ID 之后的所有缺失事件,然后继续实时流
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

        # 断线重连: 先重放缺失事件
        if last_event_id:
            # 从 last_event_id 所在的 task 提取(格式 task_id-seq)
            replay_task_id = last_event_id.rsplit("-", 1)[0] if "-" in last_event_id else task_id
            missed = sse_buffer.replay_after(replay_task_id, last_event_id)
            for item in missed:
                yield _format_sse(item["id"], item["event"])
            # 如果有重放事件且最后一个事件是 done/error,直接结束
            if missed and missed[-1]["event"].get("type") in (SSE_DONE, SSE_ERROR):
                return

        try:
            # 发送开始事件(携带 resume_from 供客户端判断是否为重连)
            start_event = {"type": SSE_START, "task_id": task_id, "session_id": req.session_id, "resume_from": last_event_id}
            eid = sse_buffer.append(task_id, start_event)
            yield _format_sse(eid, start_event)

            # L5-10(2026-08-12):AgentLoopV2 执行器(env AGENT_EXECUTOR=loop_v2 启用)。
            # 重试/错误分类/元学习/事件总线,SSE 事件经 hook_engine 订阅器按 session 过滤。
            if _is_loop_v2_enabled():
                from ..services.agent_loop_v2 import AgentLoopV2
                from ..services.hook_engine import hook_engine

                session_id = req.session_id or f"session-{asyncio.get_running_loop().time()}"
                # V3 #55:压缩上限按模型动态解析(函数内局部 import,与本文件风格一致)
                from app.core.model_context_window import resolve_with_env_priority

                # O19:登记属主,供 tasks/stream 与 /agents/{id}/stream 做事件级属主过滤
                record_ownership(session_id, current_user)
                owned_sessions.append(session_id)
                loop = AgentLoopV2(
                    _make_loop_v2_llm(req.model),
                    tools=await _build_loop_v2_tools(req.tools),
                    session_id=session_id,
                    max_iterations=req.max_iterations or 8,
                    enable_checkpoint=True,
                    # G-161:此前根本没把请求里的 permission_mode 传进来 →
                    # 端上选的权限档在这条主执行链上永远是 default。
                    permission_mode=_resolved_permission_mode(req.permission_mode),
                    # O19:principal 贯通到执行路径 —— 高危工具审批条目据此登记属主
                    # (agent_loop_v2._request_approval → self._user_id),并启用 P1-6
                    # 记忆闭环的用户隔离。
                    user_id=current_user,
                    # V3 #55(2026-09-26):压缩上限缺省按请求模型动态解析
                    # (env AGENT_COMPACTION_CONTEXT_LIMIT 显式配置仍优先;彻底关压缩
                    # 走灰度总闸 AGENT_COMPACTION_MODE=off,语义正确且可放量)。
                    # 此前缺省 0=永不压缩,放量基建(灰度/指标/回退)齐备但线上从未生效。
                    compaction_context_limit=resolve_with_env_priority(req.model),
                )
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


@router.post("/agents/execute/resume")
async def resume_agent_execute(
    req: AgentResumeRequest,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """从 checkpoint 断点续跑 agent(MCP 工具包装 + AgentLoopV2.resume_from_checkpoint)。

    与 execute/stream 的 v2 分支使用同一套 AgentLoopV2 构造方式
    (_make_loop_v2_llm / _build_loop_v2_tools / enable_checkpoint=True),
    重建循环后调用 resume_from_checkpoint 从 checkpoint.iteration+1 继续执行。

    body: {checkpoint_id, model?, max_iterations?, tools?}
    返回:{code:0, message:"ok", data:{success, final_response, stop_reason,
          checkpoint_id, error, total_iterations, total_duration_ms}}

    checkpoint 不存在 / 已过期 → code=404(与 v2 的 ValueError 语义对齐)。

    O19(2026-09-21):必须登录;principal 贯通到重建的循环(续跑期新产生的高危
    审批据此登记属主)。属主判定按可信度两级:
      ① **持久属主**:checkpoint 落盘时写入 `metadata.owner_user_id`(save_checkpoint
         的 owner_user_id 参数,由 AgentLoopV2 用 self._user_id 传入)—— 跨进程/重启
         后依然可判定,查得且非请求者 → 403;
      ② **在飞登记**:老 checkpoint(改造前写入)无 owner 字段,退到 run_ownership
         进程内登记比对;两者都判不出时只剩"必须登录"这一层地板(如实标注,不假装)。
    """
    from ..services.agent_checkpoint import get_agent_checkpoint_manager
    from ..services.agent_loop_v2 import AgentLoopV2

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
        if resumed_session:
            record_ownership(resumed_session, current_user)

    try:
        from app.core.model_context_window import resolve_with_env_priority

        loop = AgentLoopV2(
            _make_loop_v2_llm(req.model),
            tools=await _build_loop_v2_tools(req.tools),
            max_iterations=req.max_iterations or 8,
            enable_checkpoint=True,
            # O19:principal 贯通(审批属主登记 + 记忆隔离口径与 execute 一致)
            user_id=current_user,
            # V3 #55(2026-09-26):与 execute/stream 同口径,压缩上限按模型动态解析
            # (env 显式配置优先;断点续跑恢复的历史消息同样受压缩保护)。
            compaction_context_limit=resolve_with_env_priority(req.model),
        )
        try:
            result = await loop.resume_from_checkpoint(req.checkpoint_id)
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
        "data": {
            "success": result.success,
            "final_response": getattr(result, "final_response", ""),
            "stop_reason": result.stop_reason,
            # 续跑成功后 result.checkpoint_id 为 None(仅 pause/cancel/failed 落盘),
            # 故回显本次 resume 请求的 checkpoint_id,便于前端对齐续跑来源。
            "checkpoint_id": result.checkpoint_id or req.checkpoint_id,
            "error": result.error,
            "total_iterations": len(result.iterations),
            "total_duration_ms": result.total_duration_ms,
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

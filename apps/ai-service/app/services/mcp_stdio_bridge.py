# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP stdio 子进程工具适配器(2026-09-01 立,P1-4)。

用官方 MCP Python SDK 的 stdio 传输启动本机 MCP server 子进程,把它暴露的工具
包装成内部 MCPTool 注册进 mcp_server 工具注册表,即"本机 stdio MCP server 作为
内部工具"接入 —— LLM/agent 无需感知工具是本地实现还是外部子进程。

与 mcp_client.py(自研出站 stdio/SSE 客户端)双轨并存:
- mcp_client: 面向"代理主动调外部 server"的场景(运行时管理端点注册,结果回传)
- 本模块:    面向"把外部 server 工具变成内部工具"的场景(启动时白名单注册,
              经既有 call_tool 权限矩阵 + 工具表暴露给 LLM)

设计:
- 单例连接池:每 server 一个持久 stdio session(首次 add 时启动,应用关闭时清理)
- 转发:内部 call_tool → session.call_tool 转发子进程 → 结果转 {ok, content, error}
- 异常自愈:单次调用异常时清理连接 + 重启一次并重试一次
- 安全:必须显式注册(白名单式,配置层调用,不暴露给模型工具输入路径);
        name/command 做基础校验,拒绝 shell 元字符拼接
- 幂等:同名 server 或同名工具重复注册均跳过
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from collections.abc import Awaitable, Callable
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from app.services import mcp_quality, mcp_server

logger = logging.getLogger(__name__)

# server name -> handle(单例连接池,进程内唯一)
_STDIO_SERVERS: dict[str, StdioServerHandle] = {}
# 注册/重启串行化锁,防并发 add 同名 server
_REGISTER_LOCK = asyncio.Lock()

# name 仅允许字母数字下划线连字符(与内部工具名一致,最长 64)
_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
# 内部注入参数前缀(call_tool 会注入 __user_role/__user_id/__session_id,不透传外部)
_INTERNAL_ARG_PREFIX = "__"
# 动态注册表工具名前缀(`mcp__{namespace}__`);namespace 段与 registry 的
# NAMESPACE_RE 同口径,此处只做二次防御,真源在 mcp_registry。
_TOOL_PREFIX_RE = re.compile(r"^mcp__[a-z][a-z0-9_-]{0,31}__$")


class StdioRegistrationError(RuntimeError):
    """命名空间式注册的具名失败(工具未声明/同名冲突/分级非法)。

    裸注册(商店/目录/legacy env)不抛此异常,保持原有幂等跳过语义;
    只有 mcp_registry 传入 tool_prefix 时才启用"整台原子、冲突即拒"的纪律。
    """

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class StdioServerHandle:
    """单个 stdio MCP server 的持久连接句柄。"""

    name: str
    command: str
    args: list[str]
    env: dict[str, str] | None
    stack: AsyncExitStack
    session: Any
    tools: list[Any]
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # 2026-09-02 立(P2-1):本 server 实际注册进 mcp_server 的工具名
    # (register_external_tool 返回 True 的才记入),卸载/停用时按此名单清理。
    registered_tools: list[str] = field(default_factory=list)
    # 动态注册表(2026-11-07):暴露名 -> 生效分级(read/write)。裸注册为空。
    # 重启后必须原样带回,否则写类工具会掉回无分级态(等于降权校验失效)。
    tool_tiers: dict[str, str] = field(default_factory=dict)


def _validate_server_config(name: str, command: str, args: list[str] | None) -> None:
    """基础安全校验(白名单式注册的防御层,非法配置直接拒绝)。"""
    if not name or not _NAME_RE.match(name):
        raise ValueError(
            f"stdio server name 非法: {name!r}(仅允许字母/数字/_/- 开头字母数字,最长 64)"
        )
    if not command or not str(command).strip():
        raise ValueError(f"stdio server '{name}' 缺少 command")
    # 拒绝 shell 拼接:stdio_client 走 subprocess(argv 模式)无 shell 注入,
    # 但防御性禁止常见 shell 元字符出现在 command(argv[0]) 上。
    for ch in (";", "&", "|", "$", "`", "\n", "\r"):
        if ch in str(command):
            raise ValueError(f"stdio server '{name}' command 含非法字符: {ch!r}")
    if args is not None and not isinstance(args, list):
        raise ValueError(f"stdio server '{name}' args 必须是数组")


async def _connect_server(
    name: str, command: str, args: list[str], env: dict[str, Any] | None
) -> StdioServerHandle:
    """启动子进程 + 建立 MCP session + 拉取工具清单,返回 handle(不注册工具)。"""
    stack = AsyncExitStack()
    params = StdioServerParameters(command=command, args=list(args), env={**(env or {})})
    read, write = await stack.enter_async_context(stdio_client(params))
    session = await stack.enter_async_context(ClientSession(read, write))
    await session.initialize()
    tools_result = await session.list_tools()
    tools = list(getattr(tools_result, "tools", []) or [])
    return StdioServerHandle(
        name=name,
        command=command,
        args=list(args),
        env={**(env or {})},
        stack=stack,
        session=session,
        tools=tools,
    )


def _extract_text(content_blocks: Any) -> str:
    """从官方 CallToolResult.content 提取纯文本(TextContent.text 拼接)。"""
    parts: list[str] = []
    for block in content_blocks or []:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            parts.append(text)
        else:
            try:
                parts.append(json.dumps(block, ensure_ascii=False, default=str))
            except Exception:
                parts.append(str(block))
    return "\n".join(parts)


def _convert_result(result: Any, tool_name: str) -> dict[str, Any]:
    """把官方 CallToolResult 转成自研 {ok, content/result, error} 结构。

    与本地 handler 返回结构对齐(mcp_official / agent_loop 均以 json.dumps 序列化),
    外部 server 的 isError 映射为 ok=False。
    """
    is_error = bool(getattr(result, "isError", False))
    text = _extract_text(getattr(result, "content", None))
    if is_error:
        return {
            "tool": tool_name,
            "ok": False,
            "error": text or "外部工具执行失败",
            "content": "",
        }
    return {"tool": tool_name, "ok": True, "content": text, "result": text}


async def _restart_server(name: str) -> None:
    """清理并重启一个 stdio server(异常自愈:丢弃坏连接,重新拉起子进程)。"""
    handle = _STDIO_SERVERS.get(name)
    if handle is None:
        return
    # 2026-09-02 fix(P2-1 卸载泄漏根因):重启前保留已注入工具名单,
    # 否则新 handle.registered_tools 为空,卸载/停用时 remove_stdio_server
    # 返回空名单 → unregister_external_tools 清不掉 _TOOLS → 外部工具泄漏。
    registered_tools = list(handle.registered_tools)
    # 分级映射同理:重启不得丢掉 write 标记,否则重启后的写类工具退回"无分级"。
    tool_tiers = dict(handle.tool_tiers)
    try:
        await handle.stack.aclose()
    except Exception as e:  # noqa: BLE001 - 清理失败不阻断重启
        logger.warning("[mcp_stdio] 关闭 server %s 旧连接异常(忽略): %s", name, e)
    _STDIO_SERVERS.pop(name, None)
    try:
        new_handle = await _connect_server(name, handle.command, handle.args, handle.env)
        new_handle.registered_tools = registered_tools
        new_handle.tool_tiers = tool_tiers
        _STDIO_SERVERS[name] = new_handle
        logger.info("[mcp_stdio] server '%s' 重启成功", name)
    except Exception as e:  # noqa: BLE001 - 重启失败仅记录,后续调用会继续报错
        logger.warning("[mcp_stdio] server '%s' 重启失败: %s", name, e)


def _make_forward_handler(
    server_name: str,
    tool_name: str,
    input_schema: dict[str, Any] | None = None,
    *,
    exposed_name: str | None = None,
    write_gate: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any] | None]] | None = None,
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    """构造转发 handler:内部 call_tool → 外部 stdio session.call_tool。

    2026-09-12(1-4):外层包装质量指标采集 —— 每次调用的延迟/成败/
    schema 兼容上报 mcp_quality(采集失败静默降级,不影响调用链)。
    2026-11-07:动态注册表路径增加 write_gate —— 写类工具在转发前先过
    "角色 + 审批"闸门,拒绝时**不发帧**(外部 server 零副作用)。
    """

    result_name = exposed_name or tool_name

    async def _forward(arguments: dict[str, Any]) -> dict[str, Any]:
        if write_gate is not None:
            denial = await write_gate(result_name, arguments or {})
            if denial is not None:
                return denial
        start = time.perf_counter()
        result = await _do_call(arguments)
        try:
            visible_args = {
                k: v
                for k, v in (arguments or {}).items()
                if not str(k).startswith(_INTERNAL_ARG_PREFIX)
            }
            schema_valid = mcp_quality.validate_arguments(input_schema, visible_args)
        except Exception:  # noqa: BLE001 - 校验异常视为兼容(不阻塞调用)
            schema_valid = True
        mcp_quality.record_tool_call(
            server_name,
            tool_name,
            time.perf_counter() - start,
            success=bool(result.get("ok")),
            schema_valid=schema_valid,
        )
        return result

    async def _do_call(arguments: dict[str, Any]) -> dict[str, Any]:
        handle = _STDIO_SERVERS.get(server_name)
        if handle is None:
            return {
                "tool": result_name,
                "ok": False,
                "error": f"stdio server '{server_name}' 未注册",
                "content": "",
            }
        # 剥离内部注入参数(__user_role 等),不暴露自研上下文给外部 server
        args = {
            k: v
            for k, v in (arguments or {}).items()
            if not str(k).startswith(_INTERNAL_ARG_PREFIX)
        }
        try:
            result = await handle.session.call_tool(tool_name, args)
            return _convert_result(result, result_name)
        except Exception as e:  # noqa: BLE001 - 调用异常走自愈路径
            logger.warning(
                "[mcp_stdio] server %s 工具 %s 调用异常,清理重启一次: %s",
                server_name,
                tool_name,
                e,
            )
            await _restart_server(server_name)
            handle2 = _STDIO_SERVERS.get(server_name)
            if handle2 is None:
                return {
                    "tool": result_name,
                    "ok": False,
                    "error": f"工具 {result_name} 调用失败且重启后未恢复: {e}",
                    "content": "",
                }
            try:
                retry = await handle2.session.call_tool(tool_name, args)
                return _convert_result(retry, result_name)
            except Exception as e2:  # noqa: BLE001 - 重试失败直接报错
                return {
                    "tool": result_name,
                    "ok": False,
                    "error": f"工具 {result_name} 重试仍失败: {e2}",
                    "content": "",
                }

    return _forward


async def add_stdio_server_tool(
    name: str,
    command: str,
    args: list[str] | None = None,
    env: dict[str, Any] | None = None,
    description: str = "",
    *,
    tool_prefix: str | None = None,
    tier_resolver: Callable[[str, Any], str] | None = None,
    write_gate: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any] | None]] | None = None,
) -> int:
    """注册一个 stdio MCP server 的全部工具为内部 MCPTool。

    白名单式注册:只有显式调用本函数(配置层/main.py lifespan)才能注册,不允许模型
    通过工具输入指定 command。连接成功后用 list_tools 拉取工具清单,逐个包装成
    MCPTool + 转发 handler 注入 mcp_server 注册表。

    Args:
        name: server 标识(唯一,幂等键)
        command: 子进程可执行文件(如 "npx")
        args: 子进程参数(如 ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"])
        env: 附加环境变量(可选,与 os.environ 合并传给子进程)
        description: 兜底描述(server 工具自带描述为空时使用)
        tool_prefix: 动态注册表的命名空间前缀(`mcp__{ns}__`)。传入即启用
            "整台原子注册"纪律:远端出现未声明工具、或工具名与既有工具冲突时,
            清理本次已注入的工具并抛 StdioRegistrationError(绝不静默跳过/覆盖)。
        tier_resolver: 暴露前的生效分级解析器(远端名, 原始 tool)-> read|write。
            分级真源在调用方(本地声明优先,远端 annotations 只能升级);抛出即整台拒绝。
            `tier_resolver` 为 None 时只能用于裸注册;命名空间路径必须提供。
        write_gate: 写类工具转发前的闸门(角色 + 审批);返回 None 放行,
            返回具名拒绝 dict 则**不转发**(外部 server 零副作用)。

    Returns:
        成功注册(新增)的工具数量;同名 server 已注册返回 0。
    """
    _validate_server_config(name, command, args)
    if tool_prefix is not None:
        if not _TOOL_PREFIX_RE.match(tool_prefix):
            raise ValueError(f"非法 tool_prefix: {tool_prefix!r}")
        if tier_resolver is None:
            raise ValueError("命名空间注册必须提供 tier_resolver(分级真源不得缺省)")
    async with _REGISTER_LOCK:
        if name in _STDIO_SERVERS:
            logger.info("[mcp_stdio] server '%s' 已注册,跳过(幂等)", name)
            return 0
        try:
            handle = await _connect_server(name, command, list(args or []), env)
        except Exception as e:  # noqa: BLE001 - 连接失败抛给配置层处理
            logger.warning("[mcp_stdio] server '%s' 连接失败: %s", name, e)
            raise RuntimeError(f"stdio server '{name}' 连接失败: {e}") from e
        _STDIO_SERVERS[name] = handle
        count = 0
        try:
            for t in handle.tools:
                tool_name = str(getattr(t, "name", "") or "").strip()
                if not tool_name:
                    continue
                exposed = f"{tool_prefix}{tool_name}" if tool_prefix else tool_name
                tier = "read"
                if tier_resolver is not None:
                    tier = tier_resolver(tool_name, t)
                    if tier not in ("read", "write"):
                        raise StdioRegistrationError(
                            "TIER_INVALID", f"工具 {tool_name} 分级非法: {tier!r}"
                        )
                tool_desc = str(getattr(t, "description", "") or "") or description
                tool_schema = getattr(t, "inputSchema", None) or {
                    "type": "object",
                    "properties": {},
                }
                registered = mcp_server.register_external_tool(
                    mcp_server.MCPTool(
                        name=exposed, description=tool_desc, input_schema=tool_schema
                    ),
                    _make_forward_handler(
                        name,
                        tool_name,
                        tool_schema,
                        exposed_name=exposed,
                        write_gate=write_gate if tier == "write" else None,
                    ),
                )
                if registered:
                    count += 1
                    handle.registered_tools.append(exposed)
                    handle.tool_tiers[exposed] = tier
                    logger.info("[mcp_stdio] 注册工具 %s <- server %s(%s)", exposed, name, tier)
                elif tool_prefix is not None:
                    # 命名空间路径:冲突必须整台拒绝,不得像裸注册那样静默跳过。
                    raise StdioRegistrationError(
                        "TOOL_CONFLICT",
                        f"工具名冲突,拒绝注册 server '{name}': {exposed}",
                    )
            # 登记/更新工具名集合(供跨 server 工具名冲突检测,1-4)
            mcp_quality.note_server_tools(name, list(handle.registered_tools))
        except Exception:
            # 原子回滚:断开子进程 + 摘掉本次已注入的全部工具 + 清冲突登记。
            registered_now = list(handle.registered_tools)
            try:
                await handle.stack.aclose()
            except Exception as e:  # noqa: BLE001 - 回滚中的清理失败不再覆盖原始错误
                logger.warning("[mcp_stdio] 注册回滚关闭 server %s 异常(忽略): %s", name, e)
            _STDIO_SERVERS.pop(name, None)
            if registered_now:
                mcp_server.unregister_external_tools(registered_now)
            mcp_quality.note_server_tools(name, [])
            raise
        logger.info("[mcp_stdio] server '%s' 注册完成,新增 %d 个工具", name, count)
        return count


async def remove_stdio_server(name: str) -> list[str]:
    """移除一个 stdio server 并关闭其子进程连接(2026-09-02 立,P2-1)。

    从单例池弹出句柄 → 关闭 AsyncExitStack(stdio session + 子进程)→ 返回该
    server 实际注入的工具名列表,供调用方从 mcp_server 工具注册表清理。
    幂等:name 未注册时返回空列表且无副作用。

    Args:
        name: 待移除的 server 名称

    Returns:
        该 server 注入过的工具名列表(可能为空)
    """
    handle = _STDIO_SERVERS.pop(name, None)
    if handle is None:
        return []
    try:
        await handle.stack.aclose()
    except Exception as e:  # noqa: BLE001 - 单连接关闭失败不阻断移除
        logger.warning("[mcp_stdio] 关闭 server %s 异常(忽略): %s", name, e)
    # 清空该 server 的工具名登记(跨 server 冲突检测,1-4)
    mcp_quality.note_server_tools(name, [])
    tools = list(handle.registered_tools)
    logger.info("[mcp_stdio] server '%s' 已移除,清理 %d 个工具", name, len(tools))
    return tools


def get_stdio_server_tools(name: str) -> list[str]:
    """返回指定 server 当前注入的工具名列表(2026-09-02 立,P2-1)。

    从未在池中注册的 server 返回空列表。只读,不产生副作用。
    """
    handle = _STDIO_SERVERS.get(name)
    if handle is None:
        return []
    return list(handle.registered_tools)


def get_stdio_server_tiers(name: str) -> dict[str, str]:
    """返回指定 server 的 暴露名 -> 生效分级(read/write)。

    动态注册表 reload 后据此写入状态/审计;裸注册 server 返回空 dict。
    """
    handle = _STDIO_SERVERS.get(name)
    if handle is None:
        return {}
    return dict(handle.tool_tiers)


def is_stdio_server_registered(name: str) -> bool:
    """判断指定 server 是否已在 stdio 单例池中注册(2026-09-02 立,P2-1)。

    用于商店页区分"已热挂载(运行中)"与"仅持久化但已停用"。
    """
    return name in _STDIO_SERVERS


async def shutdown_all() -> None:
    """关闭所有 stdio server 连接并杀掉子进程(应用关闭时调用)。"""
    for name, handle in list(_STDIO_SERVERS.items()):
        try:
            await handle.stack.aclose()
        except Exception as e:  # noqa: BLE001 - 单连接关闭失败不阻断整体清理
            logger.warning("[mcp_stdio] 关闭 server %s 异常(忽略): %s", name, e)
    _STDIO_SERVERS.clear()
    logger.info("[mcp_stdio] 全部 stdio server 已关闭")

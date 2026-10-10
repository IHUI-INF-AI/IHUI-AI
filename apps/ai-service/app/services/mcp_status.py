# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D154(2026-09-30 立)MCP 连接状态的运行态表与下行派发。

票第 1 栏要的行为:MCP server 连不上/正在重连时,对话里出现一句可操作的话,
而不是只有一行"某个工具调用失败了"。

时序决定了这一格为什么必须走 WS 常连而不是 SSE(票第 8 栏拍板①):
MCP 连接发生在 **会话初始化之前**(main.py 启动期播种 + 用户注册即连),
而 SSE 流是"一次回答"的生命周期 —— 状态变更大多落在没有流的期间,流首搭载结构上接不住。
所以生产点把状态 POST 给 apps/api 的 `/api/internal/user-broadcast/mcp-status`,
由那里 `broadcastToUser` 推给该用户的连接(载体与 D153 同一枚拍板,不得另开一条通道)。

三条不可漂的写法:
 ① **主体来自注册事实,不来自发帧方**:收信人是 `MCPClientManager._owners[name]`
    (注册时由 `require_request_user_id` 盖章,AGENTS §5「认证不等于授权」)。
    部署级 server(owner 为空串)**不派发** —— 没有主体就没有收信人,
    广播给"全表"等于把别人的基础设施配置推给所有人。
 ② **同 server 同 state 至多一条**(票第 8 栏去重):重连风暴不得刷屏。
    状态**变更**照发(connecting → failed → connecting 是三件事)。
 ③ **派发失败绝不打扰 MCP 生命周期**,但必须出声 + 计数(§5e「失败必须响」):
    这一格丢了,端上表现是"没有提示",而不是"报错";所以计数与"没派发"都要看得见。
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 与 @ihui/types 的 MCP_CONNECTION_STATES 逐项对应(两侧同笔新增;TS 侧是封闭集,
# 这里多一档或少一档都会在消费端表现为"某档永远不响")。
MCP_CONNECTION_STATES: tuple[str, ...] = ("connecting", "connected", "failed", "reconnecting")

INGEST_PATH = "/api/internal/user-broadcast/mcp-status"
_REQUEST_TIMEOUT_SECONDS = 5.0

# 运行态表:每个 (主体, server) 只记"上次已经发出去的那一档"。
# 这是**派发去重**表,不是连接状态的权威副本(权威在 MCPClient._connected),
# 所以进程重启后清空是正确行为,不需要持久化。
_last_state: dict[tuple[str, str], str] = {}
# 强引用集合:asyncio 只弱引用 task,不托住就可能在派发前被 GC 掉(静默丢帧的一种常见成因)。
_pending_tasks: set[asyncio.Task[None]] = set()

_dispatch_stats: dict[str, int] = {
    "sent": 0,
    "skipped_dedupe": 0,
    "skipped_no_principal": 0,
    "skipped_no_loop": 0,
    "failed": 0,
}


def dispatch_stats() -> dict[str, int]:
    """派读数(测试与 /mcp/store 类观测面用);返回副本,外部改不动真表。"""
    return dict(_dispatch_stats)


def reset_status_ledger() -> None:
    """清空去重表与计数(测试隔离用;生产代码不得调)。"""
    _last_state.clear()
    for key in _dispatch_stats:
        _dispatch_stats[key] = 0


def _validate(state: str, attempt: int | None, max_attempts: int | None) -> str | None:
    """返回拒发原因(None ⇒ 可以发)。

    未知 state 必须拒:消费端按 `state` 查五语言词表,未知档渲染出来是空白,
    而"发了一帧但端上什么也没显示"比不发更难排查(守门 121「声明必须有消费者」同族)。
    """
    if state not in MCP_CONNECTION_STATES:
        return f"未知 MCP 连接状态 {state!r}(封闭集见 MCP_CONNECTION_STATES)"
    if attempt is not None and max_attempts is None:
        return "带 attempt 必须同时带 max_attempts(否则界面文案只有分子)"
    return None


def report_mcp_status(
    user_id: str,
    server: str,
    state: str,
    *,
    reason: str | None = None,
    attempt: int | None = None,
    max_attempts: int | None = None,
    tools: list[str] | None = None,
) -> bool:
    """记录一次 MCP 连接状态变更并派发到 apps/api 的下行入口。

    @returns True 表示"这一帧已交给事件循环"(不等于已送达端上);
    False 表示按判据没派发(未知状态 / 无主体 / 与上一档相同 / 无运行中的事件循环),
    原因一律 warn/debug 出声并计入 `dispatch_stats()`,不得静默。
    """
    name = (server or "").strip()
    if not name:
        logger.warning("MCP 状态派发被拒:server 名为空(state=%s)", state)
        return False

    why = _validate(state, attempt, max_attempts)
    if why is not None:
        logger.warning("MCP 状态派发被拒(%s): %s", name, why)
        return False

    principal = (user_id or "").strip()
    if not principal:
        # 部署级 server:没有可通知的主体(见模块头①)。计数量出来,别让它读成"没发生过"。
        _dispatch_stats["skipped_no_principal"] += 1
        logger.debug("部署级 MCP %s 状态 %s 不派发(无归属主体)", name, state)
        return False

    key = (principal, name)
    if _last_state.get(key) == state:
        _dispatch_stats["skipped_dedupe"] += 1
        return False
    _last_state[key] = state

    payload: dict[str, Any] = {"server": name, "state": state}
    if reason:
        payload["reason"] = str(reason)[:500]
    if attempt is not None:
        payload["attempt"] = attempt
    if max_attempts is not None:
        payload["maxAttempts"] = max_attempts
    if tools:
        payload["tools"] = [str(t) for t in tools if str(t).strip()]

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # 启动期播种(main.py 同步段)确实可能没有 loop:如实计数,不抛错打断启动。
        _dispatch_stats["skipped_no_loop"] += 1
        logger.debug("无运行中的事件循环,MCP 状态未派发: %s/%s", name, state)
        return False

    task = loop.create_task(_dispatch(principal, payload))
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)
    return True


async def _dispatch(principal: str, payload: dict[str, Any]) -> None:
    """把一帧交给 apps/api;失败只 warn + 计数,绝不向上抛。

    `api_tools_bridge` 在**函数内**导入,不在模块顶部:它顶部 import 了 `mcp_server`,
    而 `mcp_server` 又 import `mcp_client` —— 本模块被 `mcp_client` 引用,
    顶部取就是一条循环导入链(启动期表现为 `partially initialized module`)。
    派发发生在事件循环里,那时两侧都已加载完毕,延迟导入没有代价。
    """
    from .api_tools_bridge import api_base_url, internal_headers

    url = f"{api_base_url()}{INGEST_PATH}"
    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload, headers=internal_headers(principal))
        if resp.status_code >= 400:
            _dispatch_stats["failed"] += 1
            logger.warning(
                "MCP 状态下行派发失败: %s → HTTP %s(状态: %s)",
                payload.get("server"),
                resp.status_code,
                payload.get("state"),
            )
            return
        _dispatch_stats["sent"] += 1
    except Exception as e:  # 网络/序列化任何异常都不能穿透到 MCP 生命周期
        _dispatch_stats["failed"] += 1
        logger.warning(
            "MCP 状态下行派发异常: %s(%s);端上退回下次打开时同步",
            payload.get("server"),
            e,
        )


__all__ = [
    "MCP_CONNECTION_STATES",
    "INGEST_PATH",
    "report_mcp_status",
    "dispatch_stats",
    "reset_status_ledger",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

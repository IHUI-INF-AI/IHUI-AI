# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 14 批:会话记忆资源按主体隔离(2026-10-31)。

现读缺陷(回源确认):
  `MCPServer.read_resource("memory://current")` 调 `memory_store.list_sessions()` 不传
  user_id ⇒ 返回**全站**会话 ID,再逐个 `get(sid, limit=10)` 回读最近 10 条消息。
  任何登录用户读一次该资源就拿到别人的对话内容(跨用户数据泄露)。

修法:主体取宿主注入的 `current_security_principal()`(与工具执行同一出口),
取不到一律拒;列表与回读都带同一个 user_id(否则 key 空间对不上,读到的仍是旧格式键)。

用例:
  A 无主体 ⇒ ok=False 且一次都不碰 memory_store(副作用必须没发生)。
  B 有主体 ⇒ list_sessions 收到该 user_id,get 也带同一 user_id。
  C 变异自证:摘掉 user_id 过滤时(把 principal 置空走旧路径不可达)⇒ 本用例的红
     由 B 的"两个调用都带 user_id"断言承担;B 失败即证明过滤没接上。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.services.mcp_server import MCPServer


@pytest.fixture
def server() -> MCPServer:
    return MCPServer()


async def test_memory_resource_denied_without_principal(server: MCPServer):
    """A 无主体 ⇒ 拒绝,且不产生任何 memory 读取。"""
    list_mock = AsyncMock(return_value=["s1"])
    get_mock = AsyncMock(return_value=[])
    with (
        patch(
            "app.services.agent_security_prefs.current_security_principal",
            return_value=None,
        ),
        patch("app.services.memory.memory_store.list_sessions", list_mock),
        patch("app.services.memory.memory_store.get", get_mock),
    ):
        out: dict[str, Any] = await server.read_resource("memory://current")

    assert out["ok"] is False
    assert "身份" in str(out.get("error", ""))
    list_mock.assert_not_called()
    get_mock.assert_not_called()


async def test_memory_resource_scoped_to_principal(server: MCPServer):
    """B 有主体 ⇒ 列表与回读都带同一 user_id。"""
    list_mock = AsyncMock(return_value=["s1", "s2"])
    get_mock = AsyncMock(return_value=[{"role": "user", "content": "hi"}])
    with (
        patch(
            "app.services.agent_security_prefs.current_security_principal",
            return_value="user-42",
        ),
        patch("app.services.memory.memory_store.list_sessions", list_mock),
        patch("app.services.memory.memory_store.get", get_mock),
    ):
        out = await server.read_resource("memory://current")

    assert out["ok"] is True
    list_mock.assert_awaited_once_with(user_id="user-42")
    # 前 5 个会话逐个回读,每个都必须带 user_id —— 少带一个就退回跨用户 key 空间
    assert get_mock.await_count == 2
    for call in get_mock.await_args_list:
        assert call.kwargs.get("user_id") == "user-42"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

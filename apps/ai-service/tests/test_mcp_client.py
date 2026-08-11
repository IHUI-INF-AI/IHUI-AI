"""mcp_client.py 单元测试: MCPClient + MCPClientManager。

测试覆盖:
- 数据模型: MCPClientTool/MCPClientConfig 字段
- MCPClient: stdio 连接/SSE 连接/工具发现/工具调用/超时/重连
- MCPClientManager: 注册/注销/多实例管理
"""

from __future__ import annotations

import asyncio
import json
import os as _os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# 项目根目录(tests/ -> ai-service/ -> IHUI-AI/)
_REPO = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))

from app.services.mcp_client import (
    MCPClientTool,
    MCPClientConfig,
    MCPClient,
    MCPClientManager,
    TRANSPORT_STDIO,
    TRANSPORT_SSE,
    DEFAULT_TIMEOUT,
)


# =============================================================================
# 辅助函数
# =============================================================================

def _make_mock_stdin() -> AsyncMock:
    """创建模拟的 stdin StreamWriter。"""
    m = AsyncMock()
    m.write = MagicMock()
    m.drain = AsyncMock()
    m.close = MagicMock()
    return m


def _make_mock_process(reader: asyncio.StreamReader) -> MagicMock:
    """创建模拟的子进程对象。"""
    proc = MagicMock()
    proc.stdout = reader
    proc.stderr = asyncio.StreamReader()
    proc.stderr.feed_eof()
    proc.stdin = _make_mock_stdin()
    proc.terminate = MagicMock()
    proc.wait = AsyncMock(return_value=0)
    proc.kill = MagicMock()
    proc.pid = 12345
    return proc


def _make_sse_writer() -> AsyncMock:
    """创建模拟的 SSE writer。"""
    w = AsyncMock()
    w.write = MagicMock()
    w.drain = AsyncMock()
    w.close = MagicMock()
    w.wait_closed = AsyncMock()
    return w


async def _feed_after_delay(reader: asyncio.StreamReader, data: bytes, delay: float = 0.05) -> None:
    """延迟后向 reader 喂数据，确保请求已注册到 _pending。"""
    await asyncio.sleep(delay)
    reader.feed_data(data)


# =============================================================================
# 数据模型
# =============================================================================

def test_mcp_client_tool_dataclass():
    """MCPClientTool 包含 name/description/input_schema/server_name。"""
    t = MCPClientTool(
        name="test_tool",
        description="测试工具",
        input_schema={"type": "object", "properties": {}},
        server_name="test_server",
    )
    assert t.name == "test_tool"
    assert t.description == "测试工具"
    assert t.input_schema == {"type": "object", "properties": {}}
    assert t.server_name == "test_server"


def test_mcp_client_tool_default_server_name():
    """MCPClientTool 默认 server_name 为空字符串。"""
    t = MCPClientTool(name="t", description="d", input_schema={})
    assert t.server_name == ""


def test_mcp_client_config_stdio():
    """MCPClientConfig stdio 模式。"""
    c = MCPClientConfig(
        name="test",
        transport=TRANSPORT_STDIO,
        command="python",
        args=["-m", "some_server"],
    )
    assert c.name == "test"
    assert c.transport == TRANSPORT_STDIO
    assert c.command == "python"
    assert c.args == ["-m", "some_server"]
    assert c.url == ""
    assert c.timeout == DEFAULT_TIMEOUT
    assert c.reconnect is True
    assert c.max_reconnect_attempts == 3
    assert c.env == {}


def test_mcp_client_config_sse():
    """MCPClientConfig SSE 模式。"""
    c = MCPClientConfig(
        name="test_sse",
        transport=TRANSPORT_SSE,
        url="http://localhost:3000/sse",
        timeout=10.0,
        reconnect=False,
    )
    assert c.name == "test_sse"
    assert c.transport == TRANSPORT_SSE
    assert c.url == "http://localhost:3000/sse"
    assert c.timeout == 10.0
    assert c.reconnect is False


# =============================================================================
# MCPClient 初始化
# =============================================================================

def test_mcp_client_init():
    """MCPClient 初始化后未连接。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo")
    client = MCPClient(config)
    assert client.config.name == "test"
    assert client.is_connected() is False


# =============================================================================
# MCPClient stdio 传输
# =============================================================================

@pytest.mark.asyncio
async def test_stdio_connect_success():
    """stdio 连接成功。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo")
    client = MCPClient(config)

    reader = asyncio.StreamReader()
    reader.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()

    assert client.is_connected() is True
    await client.disconnect()


@pytest.mark.asyncio
async def test_stdio_connect_failure():
    """stdio 连接失败(命令不存在)。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="nonexistent_cmd_xyz")
    client = MCPClient(config)

    with patch("asyncio.create_subprocess_exec", AsyncMock(side_effect=FileNotFoundError("命令不存在"))):
        await client.connect()

    assert client.is_connected() is False


@pytest.mark.asyncio
async def test_stdio_list_tools():
    """stdio 模式发现工具列表。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo", timeout=5.0)
    client = MCPClient(config)

    notification = b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    tools_response = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "result": {
            "tools": [
                {"name": "tool_a", "description": "工具 A", "inputSchema": {"type": "object"}},
                {"name": "tool_b", "description": "工具 B", "inputSchema": {"type": "object"}},
            ],
        },
    })

    reader = asyncio.StreamReader()
    reader.feed_data(notification)

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        # 延迟喂响应数据，确保 _pending 已注册
        feed_task = asyncio.create_task(
            _feed_after_delay(reader, f"{tools_response}\n".encode()),
        )
        tools = await client.list_tools()

    assert len(tools) == 2
    assert tools[0].name == "tool_a"
    assert tools[0].description == "工具 A"
    assert tools[0].input_schema == {"type": "object"}
    assert tools[0].server_name == "test"
    assert tools[1].name == "tool_b"
    assert tools[1].server_name == "test"

    await client.disconnect()


@pytest.mark.asyncio
async def test_stdio_call_tool():
    """stdio 模式调用工具。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo", timeout=5.0)
    client = MCPClient(config)

    notification = b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    call_response = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "result": {"content": [{"type": "text", "text": "ok"}]},
    })

    reader = asyncio.StreamReader()
    reader.feed_data(notification)

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        feed_task = asyncio.create_task(
            _feed_after_delay(reader, f"{call_response}\n".encode()),
        )
        result = await client.call_tool("test_tool", {"param": "value"})

    assert result == {"content": [{"type": "text", "text": "ok"}]}
    await client.disconnect()


@pytest.mark.asyncio
async def test_list_tools_empty_response():
    """工具列表为空时返回空列表。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo", timeout=5.0)
    client = MCPClient(config)

    notification = b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    resp = json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"tools": []}})

    reader = asyncio.StreamReader()
    reader.feed_data(notification)

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        feed_task = asyncio.create_task(
            _feed_after_delay(reader, f"{resp}\n".encode()),
        )
        tools = await client.list_tools()

    assert tools == []
    await client.disconnect()


@pytest.mark.asyncio
async def test_call_tool_error():
    """工具调用返回错误。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo", timeout=5.0)
    client = MCPClient(config)

    notification = b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    error_resp = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "error": {"code": -32603, "message": "内部错误"},
    })

    reader = asyncio.StreamReader()
    reader.feed_data(notification)

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        feed_task = asyncio.create_task(
            _feed_after_delay(reader, f"{error_resp}\n".encode()),
        )
        result = await client.call_tool("bad_tool", {})

    assert result["ok"] is False
    assert "内部错误" in result["error"]
    assert result["code"] == -32603
    await client.disconnect()


@pytest.mark.asyncio
async def test_ping_success():
    """ping 健康检查成功。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo", timeout=5.0)
    client = MCPClient(config)

    notification = b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    pong = json.dumps({"jsonrpc": "2.0", "id": 1, "result": {}})

    reader = asyncio.StreamReader()
    reader.feed_data(notification)

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        feed_task = asyncio.create_task(
            _feed_after_delay(reader, f"{pong}\n".encode()),
        )
        ok = await client.ping()

    assert ok is True
    await client.disconnect()


@pytest.mark.asyncio
async def test_ping_not_connected():
    """未连接时 ping 返回 False。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo")
    client = MCPClient(config)
    ok = await client.ping()
    assert ok is False


@pytest.mark.asyncio
async def test_disconnect_cleanup():
    """disconnect 清理资源。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo")
    client = MCPClient(config)

    reader = asyncio.StreamReader()
    reader.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        assert client.is_connected() is True
        await client.disconnect()

    assert client.is_connected() is False


@pytest.mark.asyncio
async def test_list_tools_not_connected():
    """未连接时 list_tools 返回空列表。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo")
    client = MCPClient(config)
    tools = await client.list_tools()
    assert tools == []


# =============================================================================
# SSE 传输
# =============================================================================

@pytest.mark.asyncio
async def test_sse_connect_success():
    """SSE 连接成功。"""
    config = MCPClientConfig(
        name="test_sse", transport=TRANSPORT_SSE,
        url="http://localhost:8800/sse", timeout=5.0,
    )
    client = MCPClient(config)

    http_response = (
        b"HTTP/1.1 200 OK\r\n"
        b"Content-Type: text/event-stream\r\n"
        b"\r\n"
        b'data: {"jsonrpc":"2.0","method":"notifications/initialized"}\n\n'
    )

    mock_reader = asyncio.StreamReader()
    mock_reader.feed_data(http_response)
    mock_writer = _make_sse_writer()

    with patch("asyncio.open_connection", AsyncMock(return_value=(mock_reader, mock_writer))):
        await client.connect()

    assert client.is_connected() is True
    await client.disconnect()


@pytest.mark.asyncio
async def test_sse_connect_bad_status():
    """SSE 连接返回非 200 状态码。"""
    config = MCPClientConfig(
        name="test_sse", transport=TRANSPORT_SSE,
        url="http://localhost:8800/sse", timeout=5.0,
    )
    client = MCPClient(config)

    http_response = (
        b"HTTP/1.1 404 Not Found\r\n"
        b"Content-Type: text/plain\r\n"
        b"\r\n"
    )

    mock_reader = asyncio.StreamReader()
    mock_reader.feed_data(http_response)
    mock_reader.feed_eof()
    mock_writer = _make_sse_writer()

    with patch("asyncio.open_connection", AsyncMock(return_value=(mock_reader, mock_writer))):
        await client.connect()

    assert client.is_connected() is False


@pytest.mark.asyncio
async def test_sse_no_url():
    """SSE 模式缺少 url 时连接失败。"""
    config = MCPClientConfig(
        name="test_sse", transport=TRANSPORT_SSE,
        url="", timeout=5.0,
    )
    client = MCPClient(config)
    await client.connect()
    assert client.is_connected() is False


# =============================================================================
# 超时处理
# =============================================================================

@pytest.mark.asyncio
async def test_request_timeout():
    """请求超时返回错误 dict。"""
    config = MCPClientConfig(
        name="test", transport=TRANSPORT_STDIO, command="echo",
        timeout=0.1, reconnect=False,
    )
    client = MCPClient(config)

    # 模拟连接成功，但读取循环不返回响应
    reader = asyncio.StreamReader()
    reader.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        # 不喂响应数据，让请求超时
        result = await client._send_request("tools/list", timeout=0.05)

    assert "error" in result
    assert result["error"]["code"] == -32001
    assert "超时" in result["error"]["message"]

    await client.disconnect()


# =============================================================================
# 重连逻辑
# =============================================================================

@pytest.mark.asyncio
async def test_reconnect_triggered():
    """stdio 读取循环因 EOF 退出时触发重连。"""
    config = MCPClientConfig(
        name="test", transport=TRANSPORT_STDIO, command="echo",
        reconnect=True, max_reconnect_attempts=1,
    )
    client = MCPClient(config)

    reader = asyncio.StreamReader()
    reader.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
    reader.feed_eof()

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        await asyncio.sleep(0.3)

    assert client._reconnect_attempts >= 1
    await client.disconnect()


@pytest.mark.asyncio
async def test_no_reconnect_when_disabled():
    """reconnect=False 时不触发重连。"""
    config = MCPClientConfig(
        name="test", transport=TRANSPORT_STDIO, command="echo",
        reconnect=False, max_reconnect_attempts=1,
    )
    client = MCPClient(config)

    reader = asyncio.StreamReader()
    reader.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
    reader.feed_eof()

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        await asyncio.sleep(0.2)

    assert client._reconnect_attempts == 0
    await client.disconnect()


# =============================================================================
# MCPClientManager
# =============================================================================

def test_manager_register():
    """注册 MCP Client 配置。"""
    manager = MCPClientManager()
    config = MCPClientConfig(name="svr1", transport=TRANSPORT_STDIO, command="echo")
    name = manager.register(config)
    assert name == "svr1"
    assert manager.get_client("svr1") is not None
    assert manager.get_client("nonexistent") is None


def test_manager_register_overwrite():
    """重复注册覆盖已有配置。"""
    manager = MCPClientManager()
    c1 = MCPClientConfig(name="svr", transport=TRANSPORT_STDIO, command="echo")
    c2 = MCPClientConfig(name="svr", transport=TRANSPORT_SSE, url="http://localhost/sse")
    manager.register(c1)
    manager.register(c2)
    client = manager.get_client("svr")
    assert client is not None
    assert client.config.transport == TRANSPORT_SSE


@pytest.mark.asyncio
async def test_manager_unregister():
    """注销 Client。"""
    manager = MCPClientManager()
    config = MCPClientConfig(name="svr1", transport=TRANSPORT_STDIO, command="echo")
    manager.register(config)
    assert manager.get_client("svr1") is not None
    manager.unregister("svr1")
    assert manager.get_client("svr1") is None


@pytest.mark.asyncio
async def test_manager_connect_all():
    """连接所有已注册的 Client。"""
    manager = MCPClientManager()
    manager.register(MCPClientConfig(
        name="svr1", transport=TRANSPORT_STDIO, command="echo",
    ))
    manager.register(MCPClientConfig(
        name="svr2", transport=TRANSPORT_STDIO, command="cat",
    ))

    # 每个 client 使用独立的 reader
    reader1 = asyncio.StreamReader()
    reader1.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
    reader2 = asyncio.StreamReader()
    reader2.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')

    proc1 = _make_mock_process(reader1)
    proc2 = _make_mock_process(reader2)

    # 使用 side_effect 让每次调用返回不同的 proc
    mock_exec = AsyncMock(side_effect=[proc1, proc2])

    with patch("asyncio.create_subprocess_exec", mock_exec):
        await manager.connect_all()

    client1 = manager.get_client("svr1")
    client2 = manager.get_client("svr2")
    assert client1 is not None and client1.is_connected()
    assert client2 is not None and client2.is_connected()

    await manager.disconnect_all()


@pytest.mark.asyncio
async def test_manager_disconnect_all():
    """断开所有连接并清空注册表。"""
    manager = MCPClientManager()
    manager.register(MCPClientConfig(name="svr1", transport=TRANSPORT_STDIO, command="echo"))

    reader = asyncio.StreamReader()
    reader.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await manager.connect_all()
        await manager.disconnect_all()

    assert manager.get_client("svr1") is None


@pytest.mark.asyncio
async def test_manager_call_external_tool():
    """通过 Manager 调用外部工具。"""
    manager = MCPClientManager()
    manager.register(MCPClientConfig(name="svr", transport=TRANSPORT_STDIO, command="echo", timeout=5.0))

    notification = b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    call_resp = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "result": {"content": [{"type": "text", "text": "done"}]},
    })

    reader = asyncio.StreamReader()
    reader.feed_data(notification)

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await manager.connect_all()
        feed_task = asyncio.create_task(
            _feed_after_delay(reader, f"{call_resp}\n".encode()),
        )
        result = await manager.call_external_tool("svr", "my_tool", {"x": 1})

    assert result == {"content": [{"type": "text", "text": "done"}]}
    await manager.disconnect_all()


@pytest.mark.asyncio
async def test_manager_call_external_tool_unknown_server():
    """调用未知 Server 的工具返回错误。"""
    manager = MCPClientManager()
    result = await manager.call_external_tool("unknown_svr", "tool", {})
    assert result["ok"] is False
    assert "未知" in result["error"]


@pytest.mark.asyncio
async def test_manager_call_external_tool_not_connected():
    """调用未连接的 Server 返回错误。"""
    manager = MCPClientManager()
    manager.register(MCPClientConfig(name="svr", transport=TRANSPORT_STDIO, command="echo"))
    # 不调用 connect_all
    result = await manager.call_external_tool("svr", "tool", {})
    assert result["ok"] is False
    assert "未连接" in result["error"]


@pytest.mark.asyncio
async def test_manager_list_available_tools_async():
    """异步列出所有已连接的工具。"""
    manager = MCPClientManager()
    manager.register(MCPClientConfig(name="svr", transport=TRANSPORT_STDIO, command="echo", timeout=5.0))

    notification = b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    tools_resp = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "result": {
            "tools": [{"name": "t1", "description": "d1", "inputSchema": {"type": "object"}}],
        },
    })

    reader = asyncio.StreamReader()
    reader.feed_data(notification)

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await manager.connect_all()
        feed_task = asyncio.create_task(
            _feed_after_delay(reader, f"{tools_resp}\n".encode()),
        )
        tools = await manager.list_available_tools_async()

    assert len(tools) == 1
    assert tools[0].name == "t1"
    assert tools[0].server_name == "svr"

    await manager.disconnect_all()


@pytest.mark.asyncio
async def test_double_connect():
    """重复 connect 不报错。"""
    config = MCPClientConfig(name="test", transport=TRANSPORT_STDIO, command="echo")
    client = MCPClient(config)

    reader = asyncio.StreamReader()
    reader.feed_data(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')

    proc = _make_mock_process(reader)

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        await client.connect()
        await client.connect()

    assert client.is_connected() is True
    await client.disconnect()
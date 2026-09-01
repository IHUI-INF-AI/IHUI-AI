# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""mcp_stdio_bridge 测试。

mock 官方 MCP SDK(不真实起子进程),覆盖:
- 工具包装注册进 mcp_server._TOOLS / _TOOL_HANDLERS
- 调用转发 + 内部参数剥离
- 结果转换(ok/content/error,isError 映射)
- 异常自愈(重启一次 + 重试)
- 幂等(同名 server / 同名工具跳过)
- 安全校验(name/command 非法拒绝)
- shutdown 清理
- 可选真实 npx 冒烟(本机有 node/npx + 网络可达时跑官方 filesystem server)
"""

import json
import shutil
import tempfile
from types import SimpleNamespace

import pytest

from app.services import mcp_server, mcp_stdio_bridge
from app.services.mcp_server import mcp_server as mcp_instance

# ---------------------------------------------------------------------------
# 假官方 MCP SDK
# ---------------------------------------------------------------------------


class FakeTextContent:
    def __init__(self, text: str) -> None:
        self.text = text


class FakeTool:
    def __init__(self, name: str, description: str = "", input_schema: dict | None = None) -> None:
        self.name = name
        self.description = description
        self.inputSchema = input_schema or {"type": "object", "properties": {}}


class FakeStdioCtx:
    """模拟 stdio_client 返回的 async context manager。"""

    def __init__(self, state) -> None:
        self._state = state

    async def __aenter__(self):
        # 记录一次"启动子进程"事件
        self._state.connects += 1
        return (object(), object())  # read, write

    async def __aexit__(self, *exc) -> bool:
        return False


class FakeSession:
    """模拟 ClientSession:list_tools 返回预置工具,call_tool 按 state 配置行为。"""

    def __init__(self, state) -> None:
        self._state = state
        self.closed = False
        self.initialized = False
        self.calls: list[tuple[str, dict]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc) -> bool:
        self.closed = True
        return False

    async def initialize(self) -> None:
        self.initialized = True

    async def list_tools(self):
        return SimpleNamespace(tools=list(self._state.tools))

    async def call_tool(self, name: str, arguments: dict):
        self._state.global_calls += 1
        self.calls.append((name, dict(arguments)))
        cfg = self._state.call_config.get(name, {})
        if cfg.get("fail_once") and self._state.global_calls == 1:
            raise ConnectionError("simulated call failure")
        if cfg.get("raise_always"):
            raise RuntimeError("simulated always fail")
        if cfg.get("connect_fail"):
            raise ConnectionError("simulated connect failure")
        if cfg.get("is_error"):
            return SimpleNamespace(isError=True, content=[FakeTextContent(f"ERR:{name}")])
        if "result" in cfg:
            return cfg["result"]
        return SimpleNamespace(
            isError=False,
            content=[FakeTextContent(f"ok:{name}:{json.dumps(arguments, sort_keys=True)}")],
        )


@pytest.fixture
def sdk_mock(monkeypatch):
    """替换 bridge 模块的 stdio_client / ClientSession 为假实现,并记录连接/调用。"""
    state = SimpleNamespace(
        tools=[],  # 假 list_tools 返回的工具
        call_config={},  # tool_name -> 行为配置
        sessions=[],  # 已创建的 FakeSession
        connects=0,  # stdio_client.__aenter__ 次数(即子进程启动次数)
        global_calls=0,  # 跨 session 的调用总数(fail_once 用它判断"仅首次失败")
        last_params=None,
    )

    def fake_stdio_client(params):
        state.last_params = params
        return FakeStdioCtx(state)

    def fake_client_session(read, write):
        session = FakeSession(state)
        state.sessions.append(session)
        return session

    monkeypatch.setattr(mcp_stdio_bridge, "stdio_client", fake_stdio_client)
    monkeypatch.setattr(mcp_stdio_bridge, "ClientSession", fake_client_session)
    return state


@pytest.fixture
def clean_registry():
    """测试后清理注册表新增的工具/连接,避免污染其他测试。"""
    before_handlers = set(mcp_server._TOOL_HANDLERS.keys())
    before_tool_names = {t.name for t in mcp_server._TOOLS}
    before_servers = dict(mcp_stdio_bridge._STDIO_SERVERS)
    yield
    for name in list(mcp_server._TOOL_HANDLERS.keys()):
        if name not in before_handlers:
            del mcp_server._TOOL_HANDLERS[name]
    mcp_server._TOOLS[:] = [t for t in mcp_server._TOOLS if t.name in before_tool_names]
    mcp_stdio_bridge._STDIO_SERVERS.clear()
    mcp_stdio_bridge._STDIO_SERVERS.update(before_servers)


def _two_tools() -> list[FakeTool]:
    schema = {"type": "object", "properties": {"path": {"type": "string"}}}
    return [
        FakeTool("fs_read_file", "读取文件", schema),
        FakeTool("fs_write_file", "写文件", schema),
    ]


# ---------------------------------------------------------------------------
# 注册
# ---------------------------------------------------------------------------


async def test_add_stdio_server_tool_registers_tools(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = _two_tools()
    count = await mcp_stdio_bridge.add_stdio_server_tool(
        "filesystem", "npx", ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        description="fs server",
    )
    assert count == 2
    assert "fs_read_file" in mcp_server.get_registered_tool_names()
    assert "fs_write_file" in mcp_server.get_registered_tool_names()
    tool = next(t for t in mcp_server._TOOLS if t.name == "fs_read_file")
    assert tool.description == "读取文件"
    assert tool.input_schema["properties"]["path"]["type"] == "string"
    # 兜底描述:工具自带空描述时用配置 description
    sdk_mock.tools = [FakeTool("no_desc", "", None)]
    await mcp_stdio_bridge.add_stdio_server_tool("fs2", "npx", ["-y", "x"], description="fallback")
    t2 = next(t for t in mcp_server._TOOLS if t.name == "no_desc")
    assert t2.description == "fallback"


async def test_add_connects_and_initializes(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = _two_tools()
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", ["-y", "x"])
    assert sdk_mock.connects == 1
    assert len(sdk_mock.sessions) == 1
    assert sdk_mock.sessions[0].initialized is True
    assert "fs" in mcp_stdio_bridge._STDIO_SERVERS


async def test_duplicate_server_skipped(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = _two_tools()
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", ["-y", "x"])
    second = await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", ["-y", "x"])
    assert second == 0  # 幂等:不重复注册
    assert sdk_mock.connects == 1  # 未再次启动子进程


async def test_duplicate_tool_name_skipped(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = [FakeTool("shared_tool", "第一个 server")]
    await mcp_stdio_bridge.add_stdio_server_tool("srv_a", "cmd_a", [])
    # 第二个 server 提供同名工具:注册跳过(不覆盖第一个的 handler)
    sdk_mock.tools = [FakeTool("shared_tool", "第二个 server")]
    count = await mcp_stdio_bridge.add_stdio_server_tool("srv_b", "cmd_b", [])
    assert count == 0
    assert len(mcp_stdio_bridge._STDIO_SERVERS) == 2
    tool = next(t for t in mcp_server._TOOLS if t.name == "shared_tool")
    assert tool.description == "第一个 server"  # 未被覆盖


async def test_invalid_name_rejected(sdk_mock, clean_registry) -> None:
    with pytest.raises(ValueError):
        await mcp_stdio_bridge.add_stdio_server_tool("bad name!", "npx", [])
    with pytest.raises(ValueError):
        await mcp_stdio_bridge.add_stdio_server_tool("", "npx", [])


async def test_invalid_command_rejected(sdk_mock, clean_registry) -> None:
    with pytest.raises(ValueError):
        await mcp_stdio_bridge.add_stdio_server_tool("fs", "", [])
    with pytest.raises(ValueError):
        await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx; rm -rf /", [])
    with pytest.raises(ValueError):
        await mcp_stdio_bridge.add_stdio_server_tool("fs", "sh", "-c")
        # args 非 list → 拒绝(不会走到 -c 分支)


async def test_connect_failure_raises(sdk_mock, clean_registry, monkeypatch) -> None:
    sdk_mock.tools = [FakeTool("t")]

    class BoomCtx:
        async def __aenter__(self):
            raise ConnectionError("spawn failed")

        async def __aexit__(self, *exc):
            return False

    def _boom_client(params):
        return BoomCtx()

    monkeypatch.setattr(mcp_stdio_bridge, "stdio_client", _boom_client)
    with pytest.raises(RuntimeError):
        await mcp_stdio_bridge.add_stdio_server_tool("boom", "npx", [])


# ---------------------------------------------------------------------------
# 调用转发
# ---------------------------------------------------------------------------


async def test_call_forwarding_and_result_conversion(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = [FakeTool("fs_read_file")]
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", [])
    result = await mcp_instance.call_tool("fs_read_file", {"path": "/tmp/a.txt"})
    assert result["ok"] is True
    assert "fs_read_file" in result["content"]
    assert result["tool"] == "fs_read_file"
    session = sdk_mock.sessions[0]
    assert session.calls[-1] == ("fs_read_file", {"path": "/tmp/a.txt"})


async def test_internal_args_stripped(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = [FakeTool("fs_read_file")]
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", [])
    await mcp_instance.call_tool("fs_read_file", {"path": "/tmp/a.txt"}, user_role=1, user_id="u1")
    session = sdk_mock.sessions[0]
    forwarded = session.calls[-1][1]
    assert forwarded == {"path": "/tmp/a.txt"}
    assert not any(k.startswith("__") for k in forwarded)


async def test_is_error_mapped(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = [FakeTool("bad_tool")]
    sdk_mock.call_config["bad_tool"] = {"is_error": True}
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", [])
    result = await mcp_instance.call_tool("bad_tool", {})
    assert result["ok"] is False
    assert result["error"] == "ERR:bad_tool"
    assert result["content"] == ""


async def test_call_failure_restarts_and_retries(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = [FakeTool("flaky")]
    sdk_mock.call_config["flaky"] = {"fail_once": True}
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", [])
    result = await mcp_instance.call_tool("flaky", {"a": 1})
    assert result["ok"] is True  # 异常 → 重启 → 重试成功
    assert sdk_mock.connects == 2  # 首次连接 + 重启一次
    assert len(sdk_mock.sessions) == 2


async def test_call_failure_restart_recovery_fails(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = [FakeTool("doomed")]
    sdk_mock.call_config["doomed"] = {"raise_always": True}
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", [])
    result = await mcp_instance.call_tool("doomed", {})
    assert result["ok"] is False
    assert "重试仍失败" in result["error"]


# ---------------------------------------------------------------------------
# shutdown
# ---------------------------------------------------------------------------


async def test_shutdown_all(sdk_mock, clean_registry) -> None:
    sdk_mock.tools = _two_tools()
    await mcp_stdio_bridge.add_stdio_server_tool("fs", "npx", [])
    assert "fs" in mcp_stdio_bridge._STDIO_SERVERS
    await mcp_stdio_bridge.shutdown_all()
    assert mcp_stdio_bridge._STDIO_SERVERS == {}
    assert sdk_mock.sessions[0].closed is True


# ---------------------------------------------------------------------------
# 真实 npx 冒烟(可选,需本机 node/npx + npm registry 网络可达)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    shutil.which("npx") is None,
    reason="本机无 npx,跳过真实 MCP server 冒烟",
)
async def test_real_filesystem_server_roundtrip() -> None:
    """用官方 @modelcontextprotocol/server-filesystem 真实起子进程,验证注册 + 调用。"""
    tmpdir = tempfile.mkdtemp(prefix="ihui_mcp_fs_")
    try:
        try:
            count = await mcp_stdio_bridge.add_stdio_server_tool(
                "fs_real",
                "npx",
                ["-y", "@modelcontextprotocol/server-filesystem", tmpdir],
                env={"NODE_NO_WARNINGS": "1"},
                description="官方 filesystem server",
            )
        except RuntimeError as e:
            pytest.skip(f"npx 拉取/启动失败(网络或环境问题),跳过: {e}")
        assert count >= 1
        result = await mcp_instance.call_tool("list_directory", {"path": tmpdir})
        assert result["ok"] is True, f"真实 server 调用失败: {result}"
    finally:
        await mcp_stdio_bridge.shutdown_all()
        shutil.rmtree(tmpdir, ignore_errors=True)

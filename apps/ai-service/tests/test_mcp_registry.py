# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""mcp_registry 动态注册信任模型测试(2026-11-07 立)。

覆盖硬要求:
- 来源只认"仓库受版本控制文件 + 用户显式配置目录";未 tracked / 符号链接 /
  未知键 / 仓库字面量 env / env 引用缺失 ⇒ 拒载,且拒绝事件进审计。
- 同名 namespace / 与既有工具同名 ⇒ **整台拒绝**,不覆盖、不部分注入。
- 远端 `tools/list` 出现未声明工具 ⇒ 整台拒绝(连接也要回滚)。
- 远端 `annotations` 只能升级(read→write),不能降级。
- read tier 普通用户可调;write tier:role<1 ⇒ ROLE_DENIED,role>=1 无审批
  ⇒ APPROVAL_REQUIRED,一次性交接/持久授权后才放行。
- 审计只记来源路径/sha256/键名,不记 env 值。
- 注册后经 `mcp_server.call_tool` **真实发现并真实调用**。
- `write_tool_approval_key` 与 `agent_loop_v2._tool_approval_cache_key` 同形。

隔离策略:mock 官方 MCP SDK(不真起子进程),mock 远端 client manager
(不发出站请求),测试实例用 tmp_path 的两份来源目录,不碰进程级单例。
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.services import mcp_registry as registry_mod
from app.services import mcp_server, mcp_stdio_bridge
from app.services.mcp_registry import (
    AUDIT_DENIED,
    AUDIT_LOADED,
    AUDIT_REJECTED,
    AUDIT_UNLOADED,
    ERR_DUPLICATE_NAMESPACE,
    ERR_ENV_REF_MISSING,
    ERR_NOT_TRUSTED,
    ERR_SECRET_IN_REPO_CONFIG,
    ERR_TOOL_CONFLICT,
    ERR_UNDECLARED_REMOTE_TOOL,
    ERR_UNKNOWN_KEY,
    McpRegistry,
    write_tool_approval_key,
)
from app.services.mcp_server import mcp_server as mcp_instance

# ---------------------------------------------------------------------------
# 假 MCP SDK(stdio)
# ---------------------------------------------------------------------------


class FakeTextContent:
    def __init__(self, text: str) -> None:
        self.text = text


class FakeTool:
    def __init__(
        self,
        name: str,
        *,
        annotations: Any = None,
        schema: dict[str, Any] | None = None,
    ) -> None:
        self.name = name
        self.description = ""
        self.inputSchema = schema or {
            "type": "object",
            "properties": {"value": {"type": "string"}},
        }
        self.annotations = annotations


class FakeStdioCtx:
    def __init__(self, state: SimpleNamespace) -> None:
        self._state = state

    async def __aenter__(self) -> tuple[object, object]:
        self._state.connects += 1
        return (object(), object())

    async def __aexit__(self, *exc: object) -> bool:
        return False


class FakeSession:
    def __init__(self, state: SimpleNamespace) -> None:
        self._state = state
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def __aenter__(self) -> FakeSession:
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False

    async def initialize(self) -> None:
        return None

    async def list_tools(self) -> SimpleNamespace:
        return SimpleNamespace(tools=list(self._state.tools))

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> SimpleNamespace:
        self.calls.append((name, dict(arguments)))
        return SimpleNamespace(
            isError=False,
            content=[FakeTextContent(f"ok:{name}:{json.dumps(arguments, sort_keys=True)}")],
        )


@pytest.fixture
def sdk_mock(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    state = SimpleNamespace(tools=[], connects=0, sessions=[])

    def fake_stdio_client(params: Any) -> FakeStdioCtx:
        return FakeStdioCtx(state)

    def fake_client_session(read: Any, write: Any) -> FakeSession:
        session = FakeSession(state)
        state.sessions.append(session)
        return session

    monkeypatch.setattr(mcp_stdio_bridge, "stdio_client", fake_stdio_client)
    monkeypatch.setattr(mcp_stdio_bridge, "ClientSession", fake_client_session)
    return state


# ---------------------------------------------------------------------------
# 假远端 client manager(不发出站请求)
# ---------------------------------------------------------------------------


class FakeRemoteClient:
    def __init__(self, config: Any, tools: list[Any]) -> None:
        self.config = config
        self._tools = tools
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def connect(self) -> None:
        return None

    async def list_tools(self) -> list[Any]:
        return list(self._tools)

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        self.calls.append((name, dict(arguments)))
        return {
            "ok": True,
            "isError": False,
            "content": [SimpleNamespace(text=f"ok:{name}")],
        }


class FakeRemoteManager:
    def __init__(self, tools: list[Any]) -> None:
        self._tools = tools
        self.clients: dict[str, FakeRemoteClient] = {}
        self.unregistered: list[str] = []

    def register(self, config: Any, owner_user_id: str = "") -> None:
        self.clients[config.name] = FakeRemoteClient(config, self._tools)

    def get_client(self, name: str) -> FakeRemoteClient | None:
        return self.clients.get(name)

    async def unregister_async(self, name: str) -> None:
        self.unregistered.append(name)
        self.clients.pop(name, None)

    def restart(self, name: str) -> None:
        """模拟运行期重载:丢弃客户端(注册表 reload 应重新连接)。"""
        self.clients.pop(name, None)


# ---------------------------------------------------------------------------
# fixtures / helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def audit_spy(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    def fake_log(
        *,
        agent_id: str,
        action: str,
        details: dict[str, Any],
        user_id: str | None = None,
        **_: Any,
    ) -> None:
        records.append({"agent_id": agent_id, "action": action, "details": details, "user_id": user_id})

    monkeypatch.setattr(registry_mod.audit_service, "log_agent_action", fake_log)
    return records


@pytest.fixture(autouse=True)
def clean_registry_state() -> Any:
    before_handlers = set(mcp_server._TOOL_HANDLERS.keys())
    before_tools = {t.name for t in mcp_server._TOOLS}
    before_external = set(mcp_server._EXTERNAL_TOOL_NAMES)
    before_servers = dict(mcp_stdio_bridge._STDIO_SERVERS)
    yield
    for name in list(mcp_server._TOOL_HANDLERS.keys()):
        if name not in before_handlers:
            del mcp_server._TOOL_HANDLERS[name]
    mcp_server._TOOLS[:] = [t for t in mcp_server._TOOLS if t.name in before_tools]
    mcp_server._EXTERNAL_TOOL_NAMES.clear()
    mcp_server._EXTERNAL_TOOL_NAMES.update(before_external)
    mcp_stdio_bridge._STDIO_SERVERS.clear()
    mcp_stdio_bridge._STDIO_SERVERS.update(before_servers)


@pytest.fixture
def sources(tmp_path: Path) -> tuple[Path, Path]:
    repo = tmp_path / "repo"
    user = tmp_path / "user"
    repo.mkdir()
    user.mkdir()
    return repo, user


def _write(path: Path, payload: dict[str, Any] | str) -> Path:
    raw = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    path.write_text(raw, encoding="utf-8")
    return path


def _registry(repo: Path, user: Path, *, tracked: bool = True) -> McpRegistry:
    return McpRegistry(repo_dir=repo, user_dir=user, tracked_checker=lambda _: tracked)


def _stdio_manifest(
    namespace: str = "demo",
    *,
    tools: list[dict[str, str]] | None = None,
    description: str = "demo server",
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "namespace": namespace,
        "transport": "stdio",
        "description": description,
        "command": "npx",
        "args": ["-y", "demo-pkg"],
        "tools": tools
        or [
            {"name": "lookup", "tier": "read"},
            {"name": "mutate", "tier": "write"},
        ],
    }


def _remote_manifest(
    namespace: str = "rem",
    *,
    tools: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "namespace": namespace,
        "transport": "sse",
        "description": "remote server",
        "url": "https://example.invalid/sse",
        "tools": tools
        or [
            {"name": "peek", "tier": "read"},
            {"name": "edit", "tier": "read"},
        ],
    }


def _two_fake_tools() -> list[FakeTool]:
    return [
        FakeTool("lookup", annotations=SimpleNamespace(readOnlyHint=True)),
        FakeTool("mutate", annotations=None),
    ]


async def _reload_and_return(registry: McpRegistry) -> dict[str, Any]:
    return await registry.reload(actor="tester")


# ---------------------------------------------------------------------------
# ① 来源不可信 ⇒ 拒载
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repo_file_not_git_tracked_is_rejected(
    sources: tuple[Path, Path], audit_spy: list[dict[str, Any]], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    _write(repo / "demo.json", _stdio_manifest())
    registry = _registry(repo, user, tracked=False)

    status = await registry.reload(actor="tester")

    assert status["loaded"] == []
    assert [r["code"] for r in status["rejected"]] == [ERR_NOT_TRUSTED]
    assert sdk_mock.connects == 0
    assert AUDIT_REJECTED in [r["action"] for r in audit_spy]


@pytest.mark.asyncio
async def test_repo_literal_env_is_rejected_and_audit_has_no_value(
    sources: tuple[Path, Path], audit_spy: list[dict[str, Any]], sdk_mock: SimpleNamespace
) -> None:
    """仓库受版本控制 ⇒ env 只允许 ${ENV};字面量(哪怕不是密钥)一律拒,审计不得出现值。"""
    repo, user = sources
    secret = "literal-secret-value"
    payload = _stdio_manifest()
    payload["env"] = {"API_KEY": secret}
    _write(repo / "demo.json", payload)

    status = await _reload_and_return(_registry(repo, user))

    assert [r["code"] for r in status["rejected"]] == [ERR_SECRET_IN_REPO_CONFIG]
    dumped = json.dumps([r["details"] for r in audit_spy], ensure_ascii=False)
    assert secret not in dumped
    assert "API_KEY" in dumped


@pytest.mark.asyncio
async def test_unknown_manifest_key_is_rejected(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    payload = _stdio_manifest()
    payload["autoApprove"] = ["everything"]
    _write(repo / "demo.json", payload)

    status = await _reload_and_return(_registry(repo, user))

    assert [r["code"] for r in status["rejected"]] == [ERR_UNKNOWN_KEY]
    assert status["loaded"] == []


@pytest.mark.asyncio
async def test_user_env_ref_missing_is_rejected(
    sources: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch, sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    monkeypatch.delenv("IHUI_TEST_TOKEN", raising=False)
    payload = _stdio_manifest()
    payload["env"] = {"TOKEN": "${IHUI_TEST_TOKEN}"}
    _write(user / "demo.json", payload)

    status = await _reload_and_return(_registry(repo, user))

    assert [r["code"] for r in status["rejected"]] == [ERR_ENV_REF_MISSING]
    assert sdk_mock.connects == 0


@pytest.mark.asyncio
async def test_user_env_ref_resolved_and_loaded(
    sources: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
    sdk_mock: SimpleNamespace,
    audit_spy: list[dict[str, Any]],
) -> None:
    """正向对照:用户目录的 `${ENV}` 能解析时必须真的加载(防"恒拒绝"假绿)。

    上一条只证缺变量被拒;这条证同一规则在变量存在时不误伤,且审计仍只记键名。
    """
    repo, user = sources
    resolved = "resolved-token-value"
    monkeypatch.setenv("IHUI_TEST_TOKEN", resolved)
    payload = _stdio_manifest()
    payload["env"] = {"TOKEN": "${IHUI_TEST_TOKEN}"}
    _write(user / "demo.json", payload)
    sdk_mock.tools = _two_fake_tools()

    status = await _reload_and_return(_registry(repo, user))

    assert [s["namespace"] for s in status["loaded"]] == ["demo"]
    assert sdk_mock.connects == 1
    assert "mcp__demo__lookup" in mcp_server.get_registered_tool_names()
    details = [r for r in audit_spy if r["action"] == AUDIT_LOADED][0]["details"]
    assert details["envKeys"] == ["TOKEN"]
    assert resolved not in json.dumps(details, ensure_ascii=False)


@pytest.mark.asyncio
async def test_user_symlink_is_rejected(
    sources: tuple[Path, Path], tmp_path: Path, sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    real = _write(tmp_path / "outside.json", _stdio_manifest())
    link = user / "demo.json"
    try:
        link.symlink_to(real)
    except (OSError, NotImplementedError):  # pragma: no cover - Windows 无权限时跳过
        pytest.skip("当前环境无法创建符号链接")

    status = await _reload_and_return(_registry(repo, user))

    assert [r["code"] for r in status["rejected"]] == [ERR_NOT_TRUSTED]
    assert sdk_mock.connects == 0


# ---------------------------------------------------------------------------
# ② 冲突 ⇒ 整台拒绝,不覆盖、不部分注入
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_duplicate_namespace_rejects_second_without_overwrite(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    _write(repo / "a.json", _stdio_manifest(tools=[{"name": "first", "tier": "read"}]))
    _write(repo / "b.json", _stdio_manifest(tools=[{"name": "second", "tier": "read"}]))
    sdk_mock.tools = [FakeTool("first")]

    status = await _reload_and_return(_registry(repo, user))

    assert [s["namespace"] for s in status["loaded"]] == ["demo"]
    assert status["loaded"][0]["tools"][0]["name"] == "first"
    assert [r["code"] for r in status["rejected"]] == [ERR_DUPLICATE_NAMESPACE]
    assert "mcp__demo__first" in mcp_server.get_registered_tool_names()
    assert "mcp__demo__second" not in mcp_server.get_registered_tool_names()


@pytest.mark.asyncio
async def test_existing_tool_conflict_rejects_whole_server(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    """预检冲突在连接之前:必须整台拒绝,且不能留下任何一个已注入工具。"""
    repo, user = sources
    _write(repo / "demo.json", _stdio_manifest())
    mcp_server.register_external_tool(
        mcp_server.MCPTool(name="mcp__demo__lookup", description="", input_schema={}),
        lambda _args: {},
    )

    status = await _reload_and_return(_registry(repo, user))

    assert [r["code"] for r in status["rejected"]] == [ERR_TOOL_CONFLICT]
    assert sdk_mock.connects == 0
    assert "mcp__demo__mutate" not in mcp_server.get_registered_tool_names()


# ---------------------------------------------------------------------------
# ③ 注册后可真实发现、真实调用 + 分级
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stdio_registration_discovers_and_calls_read_tool(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    _write(repo / "demo.json", _stdio_manifest())
    sdk_mock.tools = _two_fake_tools()
    registry = _registry(repo, user)

    status = await _reload_and_return(registry)

    assert [s["namespace"] for s in status["loaded"]] == ["demo"]
    assert sdk_mock.connects == 1
    result = await mcp_instance.call_tool("mcp__demo__lookup", {"value": "x"}, user_role=0, user_id="u")
    assert result["ok"] is True
    assert "ok:lookup" in result["content"]


@pytest.mark.asyncio
async def test_write_tool_denies_plain_user(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace, audit_spy: list[dict[str, Any]]
) -> None:
    repo, user = sources
    _write(repo / "demo.json", _stdio_manifest())
    sdk_mock.tools = _two_fake_tools()
    registry = _registry(repo, user)
    await _reload_and_return(registry)

    result = await mcp_instance.call_tool(
        "mcp__demo__mutate", {"value": "x"}, user_role=0, user_id="u"
    )

    assert result["ok"] is False
    assert result["errorCode"] == "ROLE_DENIED"
    assert "管理员" in result["error"] or "admin" in result["error"]
    # 拒绝发生在转发之前:外部 server 零调用
    assert all(session.calls == [] for session in sdk_mock.sessions)
    denied = [r for r in audit_spy if r["action"] == AUDIT_DENIED]
    assert denied and denied[-1]["details"]["code"] == "ROLE_DENIED"


@pytest.mark.asyncio
async def test_write_tool_requires_approval_then_one_shot_allows(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    _write(repo / "demo.json", _stdio_manifest())
    sdk_mock.tools = _two_fake_tools()
    registry = _registry(repo, user)
    await _reload_and_return(registry)

    first = await mcp_instance.call_tool(
        "mcp__demo__mutate", {"value": "x"}, user_role=1, user_id="admin"
    )
    assert first["errorCode"] == "APPROVAL_REQUIRED"
    assert all(session.calls == [] for session in sdk_mock.sessions)

    registry.note_approved_write_call("mcp__demo__mutate", {"value": "x"})
    second = await mcp_instance.call_tool(
        "mcp__demo__mutate", {"value": "x"}, user_role=1, user_id="admin"
    )
    assert second["ok"] is True
    assert sdk_mock.sessions[0].calls == [("mutate", {"value": "x"})]


@pytest.mark.asyncio
async def test_write_tool_persistent_approval_allows(
    sources: tuple[Path, Path],
    sdk_mock: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import approval_persistence

    repo, user = sources
    _write(repo / "demo.json", _stdio_manifest())
    sdk_mock.tools = _two_fake_tools()
    registry = _registry(repo, user)
    await _reload_and_return(registry)
    monkeypatch.setattr(approval_persistence, "check", lambda _key, _kind: "always")

    result = await mcp_instance.call_tool(
        "mcp__demo__mutate", {"value": "x"}, user_role=1, user_id="admin"
    )

    assert result["ok"] is True


@pytest.mark.asyncio
async def test_write_tool_is_marked_high_risk_for_agent(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    _write(repo / "demo.json", _stdio_manifest())
    sdk_mock.tools = _two_fake_tools()
    registry = _registry(repo, user)
    await _reload_and_return(registry)

    assert registry.is_write_tier_tool("mcp__demo__mutate") is True
    assert registry.is_write_tier_tool("mcp__demo__lookup") is False


# ---------------------------------------------------------------------------
# ④ 远端:未声明工具整台拒绝 / annotations 只能升级
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remote_undeclared_tool_rejects_whole_server(
    sources: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, user = sources
    _write(repo / "rem.json", _remote_manifest())
    manager = FakeRemoteManager(
        [
            SimpleNamespace(
                name="peek",
                description="",
                input_schema={},
                annotations=SimpleNamespace(readOnlyHint=True),
            ),
            SimpleNamespace(
                name="tamper",
                description="",
                input_schema={},
                annotations=SimpleNamespace(readOnlyHint=True),
            ),
        ]
    )
    monkeypatch.setattr(registry_mod, "get_mcp_client_manager", lambda: manager)
    registry = _registry(repo, user)

    status = await _reload_and_return(registry)

    assert [r["code"] for r in status["rejected"]] == [ERR_UNDECLARED_REMOTE_TOOL]
    assert "mcp__rem__peek" not in mcp_server.get_registered_tool_names()
    assert manager.unregistered == ["mcpreg_rem"]


@pytest.mark.asyncio
async def test_remote_annotations_upgrade_only(
    sources: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    """声明的 read + 远端 readOnlyHint=false ⇒ 升 write;声明的 write 不得被降级。"""
    repo, user = sources
    _write(
        repo / "rem.json",
        _remote_manifest(tools=[{"name": "peek", "tier": "read"}, {"name": "edit", "tier": "write"}]),
    )
    manager = FakeRemoteManager(
        [
            SimpleNamespace(
                name="peek",
                description="",
                input_schema={},
                annotations=SimpleNamespace(readOnlyHint=False),
            ),
            SimpleNamespace(
                name="edit",
                description="",
                input_schema={},
                annotations=SimpleNamespace(readOnlyHint=True),
            ),
        ]
    )
    monkeypatch.setattr(registry_mod, "get_mcp_client_manager", lambda: manager)
    registry = _registry(repo, user)

    status = await _reload_and_return(registry)

    assert [s["namespace"] for s in status["loaded"]] == ["rem"]
    assert registry.is_write_tier_tool("mcp__rem__peek") is True
    assert registry.is_write_tier_tool("mcp__rem__edit") is True


@pytest.mark.asyncio
async def test_remote_tools_callable_through_internal_registry(
    sources: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, user = sources
    _write(repo / "rem.json", _remote_manifest(tools=[{"name": "peek", "tier": "read"}]))
    manager = FakeRemoteManager(
        [
            SimpleNamespace(
                name="peek",
                description="",
                input_schema={},
                annotations=SimpleNamespace(readOnlyHint=True),
            )
        ]
    )
    monkeypatch.setattr(registry_mod, "get_mcp_client_manager", lambda: manager)
    await _reload_and_return(_registry(repo, user))

    result = await mcp_instance.call_tool("mcp__rem__peek", {"q": "1"}, user_role=0, user_id="u")

    assert result["ok"] is True
    assert "ok:peek" in result["content"]
    assert manager.clients["mcpreg_rem"].calls == [("peek", {"q": "1"})]


# ---------------------------------------------------------------------------
# ⑤ 审计 / reload 原子性 / 审批键同形
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_audit_loaded_records_source_and_tools_without_env_values(
    sources: tuple[Path, Path],
    audit_spy: list[dict[str, Any]],
    sdk_mock: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import hashlib

    repo, user = sources
    secret = "user-secret-value"
    payload = _stdio_manifest()
    payload["env"] = {"TOKEN": secret}
    _write(user / "demo.json", payload)
    sdk_mock.tools = _two_fake_tools()

    await _reload_and_return(_registry(repo, user))

    loaded = [r for r in audit_spy if r["action"] == AUDIT_LOADED]
    assert len(loaded) == 1
    details = loaded[0]["details"]
    assert details["actor"] == "tester"
    assert details["sourceKind"] == "user"
    assert details["sourcePath"].endswith("demo.json")
    assert details["fileSha256"] == hashlib.sha256(
        (user / "demo.json").read_bytes()
    ).hexdigest()
    assert details["envKeys"] == ["TOKEN"]
    assert {t["name"]: t["tier"] for t in details["tools"]} == {
        "lookup": "read",
        "mutate": "write",
    }
    assert secret not in json.dumps(details, ensure_ascii=False)


# ---------------------------------------------------------------------------
# ④ craft-anything(github.com/storytold/craft-anything)stdio MCP 接入
# ---------------------------------------------------------------------------

CRAFT_MANIFEST = (
    Path(__file__).resolve().parents[1] / "config" / "mcp" / "servers" / "craft-anything.json"
)

# 取自 craft-anything 引擎 Effects:只有 read_only_hint 为真的工具落 read。
CRAFT_READ_TOOLS = {
    "core_session_show",
    "core_targets_list",
    "core_evidence_show",
    "core_unknowns_show",
    "core_unknown_verify",
    "core_investigation_show",
    "core_journal_read",
    "list_toolsets",
}

# Clean room(默认 Deep mode off)不列出的 Essentials 工具;清单仍声明,以便 Deep mode 重载后可用。
CRAFT_DEEP_ONLY_TOOLS = {
    "core_target_open",
    "core_archive_show",
    "core_archive_extract",
    "core_archives_compare",
    "core_overview_show",
    "native_function_study",
    "core_feature_find",
    "core_target_triage",
}


def _craft_declaration() -> dict[str, Any]:
    return json.loads(CRAFT_MANIFEST.read_text(encoding="utf-8"))


def _craft_remote_tools(
    *,
    extra: tuple[str, ...] = (),
    deep_mode: bool = False,
    read_only: dict[str, bool] | None = None,
) -> list[FakeTool]:
    """按清单声明构造远端 tools/list:默认模拟 Clean room 的可见集。"""
    overrides = read_only or {}
    tools: list[FakeTool] = []
    for decl in _craft_declaration()["tools"]:
        name = decl["name"]
        if not deep_mode and name in CRAFT_DEEP_ONLY_TOOLS:
            continue
        if name in overrides:
            # 显式覆盖:远端真的带上了该 annotations(False 才构成"只能升级"的输入)
            tools.append(
                FakeTool(name, annotations=SimpleNamespace(readOnlyHint=overrides[name]))
            )
        elif decl["tier"] == "read":
            tools.append(FakeTool(name, annotations=SimpleNamespace(readOnlyHint=True)))
        else:
            tools.append(FakeTool(name, annotations=None))
    tools.extend(FakeTool(name, annotations=None) for name in extra)
    return tools


def _craft_registry(user: Path) -> McpRegistry:
    # 真实仓库受控清单 + 显式 tracked=True(测试里不依赖 git 状态)。
    return McpRegistry(
        repo_dir=CRAFT_MANIFEST.parent,
        user_dir=user,
        tracked_checker=lambda _: True,
    )


def test_craft_anything_manifest_declares_core_and_meta_tools() -> None:
    data = _craft_declaration()

    assert data["schemaVersion"] == 1
    assert data["namespace"] == "craft_anything"
    assert data["transport"] == "stdio"
    assert data["command"] == "craft-anything-cli"
    assert data["args"] == ["mcp"]
    assert len(data["description"]) <= 200

    declared = {t["name"]: t["tier"] for t in data["tools"]}
    # Essentials 35 + list_toolsets/enable_toolset 2
    assert len(declared) == 37
    assert {name for name, tier in declared.items() if tier == "read"} == CRAFT_READ_TOOLS
    assert declared["enable_toolset"] == "write"
    assert "core_target_open" in declared
    assert "core_targets_list" in declared


@pytest.mark.asyncio
async def test_craft_anything_registers_and_calls_read_tool(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    sdk_mock.tools = _craft_remote_tools()
    registry = _craft_registry(user)

    status = await registry.reload(actor="tester")

    assert [s["namespace"] for s in status["loaded"]] == ["craft_anything"]
    names = mcp_server.get_registered_tool_names()
    assert "mcp__craft_anything__core_targets_list" in names
    assert "mcp__craft_anything__core_report_write" in names
    # 绝不按裸名注册,避免与内置工具冲突
    assert "core_targets_list" not in names
    # Clean room 默认不列出 Deep-only 工具
    assert "mcp__craft_anything__core_target_open" not in names

    result = await mcp_instance.call_tool(
        "mcp__craft_anything__core_targets_list", {}, user_role=0, user_id="u"
    )

    assert result["ok"] is True
    assert sdk_mock.sessions[0].calls == [("core_targets_list", {})]
    assert "ok:core_targets_list" in result["content"]


@pytest.mark.asyncio
async def test_craft_anything_write_tool_needs_admin_then_approval(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    sdk_mock.tools = _craft_remote_tools()
    registry = _craft_registry(user)
    await registry.reload(actor="tester")
    tool_key = "mcp__craft_anything__core_report_write"

    denied = await mcp_instance.call_tool(tool_key, {"value": "x"}, user_role=0, user_id="u")
    assert denied["errorCode"] == "ROLE_DENIED"
    assert all(session.calls == [] for session in sdk_mock.sessions)

    pending = await mcp_instance.call_tool(tool_key, {"value": "x"}, user_role=1, user_id="admin")
    assert pending["errorCode"] == "APPROVAL_REQUIRED"
    assert all(session.calls == [] for session in sdk_mock.sessions)

    registry.note_approved_write_call(tool_key, {"value": "x"})
    allowed = await mcp_instance.call_tool(tool_key, {"value": "x"}, user_role=1, user_id="admin")
    assert allowed["ok"] is True
    assert sdk_mock.sessions[0].calls == [("core_report_write", {"value": "x"})]


@pytest.mark.asyncio
async def test_craft_anything_undeclared_remote_tool_rejects_whole_server(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    # 清单只声明 Essentials + 元工具;远端多列一个未声明的 native 工具 ⇒ 整台拒绝
    sdk_mock.tools = _craft_remote_tools(extra=("native_sections_list",))

    status = await _reload_and_return(_craft_registry(user))

    assert status["loaded"] == []
    assert [r["code"] for r in status["rejected"]] == [ERR_UNDECLARED_REMOTE_TOOL]
    assert not any(
        name.startswith("mcp__craft_anything__")
        for name in mcp_server.get_registered_tool_names()
    )


@pytest.mark.asyncio
async def test_craft_anything_remote_annotation_only_upgrades_read(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace
) -> None:
    repo, user = sources
    # 清单声明 core_session_show 为 read;远端 readOnlyHint=false ⇒ 只能升级为 write
    sdk_mock.tools = _craft_remote_tools(read_only={"core_session_show": False})
    registry = _craft_registry(user)
    await registry.reload(actor="tester")

    result = await mcp_instance.call_tool(
        "mcp__craft_anything__core_session_show", {}, user_role=0, user_id="u"
    )

    assert result["errorCode"] == "ROLE_DENIED"
    assert all(session.calls == [] for session in sdk_mock.sessions)


@pytest.mark.asyncio
async def test_reload_is_idempotent_and_unloads_removed(
    sources: tuple[Path, Path], sdk_mock: SimpleNamespace, audit_spy: list[dict[str, Any]]
) -> None:
    repo, user = sources
    path = _write(repo / "demo.json", _stdio_manifest())
    sdk_mock.tools = _two_fake_tools()
    registry = _registry(repo, user)

    await _reload_and_return(registry)
    await _reload_and_return(registry)
    assert sdk_mock.connects == 1  # 指纹不变 ⇒ 不重连(原子差量)

    path.unlink()
    status = await _reload_and_return(registry)

    assert status["loaded"] == []
    assert "mcp__demo__lookup" not in mcp_server.get_registered_tool_names()
    assert AUDIT_UNLOADED in [r["action"] for r in audit_spy]


def test_approval_key_parity_with_agent_loop() -> None:
    from app.services.agent_loop_v2 import _tool_approval_cache_key

    args = {"z": 1, "a": [2, 3], "nested": {"b": "中文"}}
    assert write_tool_approval_key("mcp__demo__mutate", args) == _tool_approval_cache_key(
        "mcp__demo__mutate", {"nested": {"b": "中文"}, "a": [2, 3], "z": 1}
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

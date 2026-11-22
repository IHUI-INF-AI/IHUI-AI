# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 MCP 资源 / 资源模板 / 提示词客户端面(2026-11-23 立)。

对照取证:`@deepseek-ai/dsh-mcp-resources`(外部 server 的资源作为独立一等公民,
不与工具面混在一起)。本仓此前 client 侧只有 `tools/list` + `tools/call`,
`resources/*` 与 `prompts/*` 完全不可达;服务端侧(internal mcp_server)一直是全的。

本文件钉住四件事:
1. 协议帧名与解析字段(`resources/list` / `resources/templates/list` /
   `resources/read` / `prompts/list` / `prompts/get`)—— server 少给字段时取空值,
   `uri`/`name` 缺失的条目直接跳过(不拿半条记录冒充一条资源)。
2. `resources/read` 超限截断必须**显式可见**(`truncated: true`),不静默降级。
3. 失败形状与 `call_tool` 一致(`{"ok": False, "error", "code"}`),调用方一处判据。
4. 聚合面的可见性判据唯一:`MCPClientManager.is_visible` —— 别人的 server 资源
   对自己的清单不可见,读取回"未知 MCP Server"(与"没这台"同形,不作存在性预言机)。
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.services.mcp_client import (
    RESOURCE_CONTENT_LIMIT_CHARS,
    RESOURCE_UPDATE_LIMIT,
    TRANSPORT_STDIO,
    MCPClient,
    MCPClientConfig,
    MCPClientManager,
)


def _client(name: str = "gh") -> MCPClient:
    return MCPClient(MCPClientConfig(name=name, transport=TRANSPORT_STDIO))


# =============================================================================
# 1. resources/list
# =============================================================================


async def test_list_resources_parses(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    seen: list[tuple[str, dict[str, Any] | None]] = []

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        seen.append((method, params))
        return {
            "result": {
                "resources": [
                    {
                        "uri": "file:///repo/README.md",
                        "name": "README",
                        "description": "项目说明",
                        "mimeType": "text/markdown",
                    },
                    {"uri": "file:///repo/AGENTS.md"},  # 只有 uri 也算一条
                    {"name": "缺 uri 的半条"},  # 必须被跳过
                    "不是 dict",  # 必须被跳过
                ]
            }
        }

    monkeypatch.setattr(client, "_send_request", fake_send)
    items = await client.list_resources()

    assert seen == [("resources/list", None)]
    assert [r.uri for r in items] == ["file:///repo/README.md", "file:///repo/AGENTS.md"]
    assert items[0].mime_type == "text/markdown"
    assert items[0].server_name == "gh"
    assert items[1].name == ""


async def test_list_resources_error_returns_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"error": {"code": -32601, "message": "Method not found"}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    assert await client.list_resources() == []


async def test_list_resource_templates_parses(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "result": {
                "resourceTemplates": [
                    {
                        "uriTemplate": "memory://sessions/{sessionId}",
                        "name": "会话记忆",
                        "mimeType": "text/plain",
                    },
                    {"name": "缺模板"},  # 跳过
                ]
            }
        }

    monkeypatch.setattr(client, "_send_request", fake_send)
    items = await client.list_resource_templates()

    assert len(items) == 1
    assert items[0].uri_template == "memory://sessions/{sessionId}"
    assert items[0].name == "会话记忆"


# =============================================================================
# 2. resources/read(含截断显式可见)
# =============================================================================


async def test_read_resource_returns_contents(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    seen: list[tuple[str, dict[str, Any] | None]] = []

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        seen.append((method, params))
        return {
            "result": {
                "contents": [
                    {"uri": "file:///a.md", "mimeType": "text/markdown", "text": "# A"}
                ]
            }
        }

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.read_resource("file:///a.md")

    assert seen == [("resources/read", {"uri": "file:///a.md"})]
    assert out["uri"] == "file:///a.md"
    assert out["truncated"] is False
    assert out["contents"][0]["text"] == "# A"


async def test_read_resource_truncates_and_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    huge = "x" * (RESOURCE_CONTENT_LIMIT_CHARS + 10)

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"result": {"contents": [{"uri": "file:///huge.txt", "text": huge}]}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.read_resource("file:///huge.txt")

    assert out["truncated"] is True
    assert len(out["contents"][0]["text"]) == RESOURCE_CONTENT_LIMIT_CHARS
    assert out["uri"] == "file:///huge.txt"


async def test_read_resource_error_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"error": {"code": -32002, "message": "资源不存在"}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.read_resource("file:///missing")

    assert out == {"ok": False, "error": "资源不存在", "code": -32002}


# =============================================================================
# 3. prompts/*
# =============================================================================


async def test_list_prompts_parses(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "result": {
                "prompts": [
                    {
                        "name": "code_review",
                        "description": "代码审查",
                        "arguments": [{"name": "diff", "required": True}],
                    },
                    {"description": "缺 name"},  # 跳过
                ]
            }
        }

    monkeypatch.setattr(client, "_send_request", fake_send)
    items = await client.list_prompts()

    assert len(items) == 1
    assert items[0].name == "code_review"
    assert items[0].arguments == [{"name": "diff", "required": True}]
    assert items[0].server_name == "gh"


async def test_get_prompt_forwards_arguments(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    seen: list[tuple[str, dict[str, Any] | None]] = []

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        seen.append((method, params))
        return {
            "result": {
                "description": "代码审查",
                "messages": [{"role": "user", "content": {"type": "text", "text": "看这段"}}],
            }
        }

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.get_prompt("code_review", {"diff": "@@"})

    assert seen == [("prompts/get", {"name": "code_review", "arguments": {"diff": "@@"}})]
    assert out["messages"][0]["role"] == "user"


async def test_get_prompt_omits_empty_arguments(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    seen: list[tuple[str, dict[str, Any] | None]] = []

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        seen.append((method, params))
        return {"result": {"messages": []}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    await client.get_prompt("no_args", {})

    assert seen == [("prompts/get", {"name": "no_args"})]


# =============================================================================
# 3b. completion / subscribe(2026-11-23 第二批)
# =============================================================================


async def test_complete_argument_passthrough(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    seen: list[tuple[str, dict[str, Any] | None]] = []

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        seen.append((method, params))
        return {"result": {"values": ["diff", "commit"], "total": 2, "hasMore": False}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.complete_argument(
        {"type": "ref/prompt", "name": "code_review"},
        {"name": "mode", "value": "d"},
    )

    assert seen == [
        (
            "completion/complete",
            {
                "ref": {"type": "ref/prompt", "name": "code_review"},
                "argument": {"name": "mode", "value": "d"},
            },
        )
    ]
    assert out["values"] == ["diff", "commit"]
    assert out["hasMore"] is False


async def test_complete_argument_error_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"error": {"code": -32601, "message": "Method not found"}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.complete_argument({"type": "ref/prompt", "name": "x"}, {})
    assert out == {"ok": False, "error": "Method not found", "code": -32601}


async def test_subscribe_records_notification_updates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"result": {}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.subscribe_resource("file:///x.md")
    assert out == {"ok": True, "uri": "file:///x.md"}

    client._handle_message(  # noqa: SLF001 - 直接喂一帧 server 通知
        json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "notifications/resources/updated",
                "params": {"uri": "file:///x.md"},
            }
        )
    )
    updates = client.resource_updates()
    assert updates[0]["uri"] == "file:///x.md"
    assert updates[0]["subscribed"] is True


async def test_unsubscribe_drops_subscription_and_updates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"result": {}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    await client.subscribe_resource("file:///y.md")
    client._resource_updates["file:///y.md"] = 1.0  # noqa: SLF001
    out = await client.unsubscribe_resource("file:///y.md")

    assert out == {"ok": True, "uri": "file:///y.md"}
    assert client.resource_updates() == []


async def test_subscribe_error_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    async def fake_send(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"error": {"code": -32601, "message": "不支持订阅"}}

    monkeypatch.setattr(client, "_send_request", fake_send)
    out = await client.subscribe_resource("file:///z")
    assert out == {"ok": False, "error": "不支持订阅", "code": -32601}
    assert client.resource_updates() == []


def test_resource_updates_are_bounded() -> None:
    client = _client()
    for i in range(RESOURCE_UPDATE_LIMIT + 20):
        client._resource_updates[f"file:///{i}"] = float(i)  # noqa: SLF001
    client._prune_resource_updates()  # noqa: SLF001
    assert len(client._resource_updates) == RESOURCE_UPDATE_LIMIT  # noqa: SLF001
    # 留下的是最新的一批(最旧的 20 条被丢)
    assert "file:///0" not in client._resource_updates  # noqa: SLF001
    assert f"file:///{RESOURCE_UPDATE_LIMIT + 19}" in client._resource_updates  # noqa: SLF001


# =============================================================================
# 4. Manager 聚合面:可见性唯一判据 + 失败同形
# =============================================================================


class _FakeClient:
    """只实现聚合面用到的那几格;`is_connected` 可关,用于验证"未连接不进清单"。"""

    def __init__(
        self,
        *,
        resources: list[Any] | None = None,
        prompts: list[Any] | None = None,
        connected: bool = True,
        fail: bool = False,
    ) -> None:
        self._resources = resources or []
        self._prompts = prompts or []
        self._connected = connected
        self._fail = fail

    def is_connected(self) -> bool:
        return self._connected

    async def complete_argument(
        self, ref: dict[str, Any], argument: dict[str, Any]
    ) -> dict[str, Any]:
        if self._fail:
            raise RuntimeError("boom")
        return {"values": ["v1"], "total": 1, "hasMore": False}

    async def subscribe_resource(self, uri: str) -> dict[str, Any]:
        if self._fail:
            raise RuntimeError("boom")
        return {"ok": True, "uri": uri}

    async def unsubscribe_resource(self, uri: str) -> dict[str, Any]:
        if self._fail:
            raise RuntimeError("boom")
        return {"ok": True, "uri": uri}

    def resource_updates(self, *, limit: int = 64) -> list[dict[str, Any]]:
        return [{"uri": "file:///mine", "updatedAt": 1.0, "subscribed": True}]

    async def list_resources(self) -> list[Any]:
        if self._fail:
            raise RuntimeError("boom")
        return self._resources

    async def list_resource_templates(self) -> list[Any]:
        if self._fail:
            raise RuntimeError("boom")
        return []

    async def list_prompts(self) -> list[Any]:
        if self._fail:
            raise RuntimeError("boom")
        return self._prompts

    async def read_resource(self, uri: str) -> dict[str, Any]:
        return {"uri": uri, "contents": [{"text": "ok"}], "truncated": False}


def _manager_with(
    entries: dict[str, tuple[Any, str]], *, budget_governor: Any = None
) -> MCPClientManager:
    manager = MCPClientManager(budget_governor=budget_governor)
    for name, (client, owner) in entries.items():
        manager._clients[name] = client  # noqa: SLF001 - 测试注入,绕开 connect
        manager._owners[name] = owner  # noqa: SLF001
    return manager


async def test_manager_resources_only_visible_and_connected() -> None:
    from app.services.mcp_client import MCPClientResource

    mine = MCPClientResource(uri="file:///mine", name="mine", server_name="mine")
    shared = MCPClientResource(uri="file:///shared", name="shared", server_name="shared")
    theirs = MCPClientResource(uri="file:///theirs", name="theirs", server_name="theirs")
    offline = MCPClientResource(uri="file:///offline", name="offline", server_name="off")

    manager = _manager_with(
        {
            "mine": (_FakeClient(resources=[mine]), "u1"),
            "shared": (_FakeClient(resources=[shared]), ""),  # 部署级
            "theirs": (_FakeClient(resources=[theirs]), "u2"),  # 别人的
            "off": (_FakeClient(resources=[offline], connected=False), "u1"),
        }
    )

    items = await manager.list_available_resources("u1")
    assert [r.uri for r in items] == ["file:///mine", "file:///shared"]


async def test_manager_prompts_only_visible() -> None:
    from app.services.mcp_client import MCPClientPrompt

    p1 = MCPClientPrompt(name="review", server_name="mine")
    p2 = MCPClientPrompt(name="secret", server_name="theirs")

    manager = _manager_with(
        {
            "mine": (_FakeClient(prompts=[p1]), "u1"),
            "theirs": (_FakeClient(prompts=[p2]), "u2"),
        }
    )

    items = await manager.list_available_prompts("u1")
    assert [p.name for p in items] == ["review"]


async def test_manager_single_server_failure_does_not_poison_list() -> None:
    from app.services.mcp_client import MCPClientResource

    good = MCPClientResource(uri="file:///good", name="good", server_name="good")
    manager = _manager_with(
        {
            "good": (_FakeClient(resources=[good]), "u1"),
            "bad": (_FakeClient(fail=True), "u1"),
        }
    )

    items = await manager.list_available_resources("u1")
    assert [r.uri for r in items] == ["file:///good"]


async def test_manager_read_resource_unknown_server_same_shape() -> None:
    manager = _manager_with({"mine": (_FakeClient(), "u1")})

    hidden = await manager.read_external_resource(
        "theirs", "file:///x", caller_user_id="u1"
    )
    absent = await manager.read_external_resource(
        "nope", "file:///x", caller_user_id="u1"
    )
    assert hidden == {"ok": False, "error": "未知 MCP Server: theirs"}
    assert absent == {"ok": False, "error": "未知 MCP Server: nope"}

    ok = await manager.read_external_resource("mine", "file:///x", caller_user_id="u1")
    assert ok["uri"] == "file:///x"
    assert ok["truncated"] is False


async def test_manager_get_prompt_visibility_and_passthrough() -> None:
    from app.services.mcp_client import MCPClientPrompt

    manager = _manager_with(
        {"mine": (_FakeClient(prompts=[MCPClientPrompt(name="p")]), "u1")}
    )

    blocked = await manager.get_external_prompt("theirs", "p", {}, caller_user_id="u1")
    assert blocked["ok"] is False
    assert "未知 MCP Server" in blocked["error"]

    # 真实 MCPClient 的 get_prompt 由 3. 覆盖;这里只钉聚合面的可见性闸先于取词
    out = await manager.list_available_prompts("u1")
    assert [p.name for p in out] == ["p"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

async def test_manager_completion_visibility() -> None:
    manager = _manager_with(
        {
            "mine": (_FakeClient(), "u1"),
            "theirs": (_FakeClient(), "u2"),
        }
    )

    ok = await manager.complete_external_argument(
        "mine", {"type": "ref/prompt", "name": "p"}, {"name": "x", "value": ""}, caller_user_id="u1"
    )
    assert ok["values"] == ["v1"]

    refused = await manager.complete_external_argument(
        "theirs", {"type": "ref/prompt", "name": "p"}, {}, caller_user_id="u1"
    )
    assert refused["ok"] is False


async def test_manager_subscribe_and_updates_visibility() -> None:
    manager = _manager_with({"mine": (_FakeClient(), "u1"), "theirs": (_FakeClient(), "u2")})

    sub = await manager.subscribe_external_resource("mine", "file:///x", caller_user_id="u1")
    assert sub == {"ok": True, "uri": "file:///x"}

    refused = await manager.subscribe_external_resource("theirs", "file:///x", caller_user_id="u1")
    assert refused["ok"] is False

    updates = manager.external_resource_updates("mine", caller_user_id="u1")
    assert updates["ok"] is True
    assert updates["updates"][0]["uri"] == "file:///mine"

    denied = manager.external_resource_updates("theirs", caller_user_id="u1")
    assert denied["ok"] is False

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D09 意图自动路由专家包:规则分类 + 白名单并入 + 交代帧。

每格判据都成对:正例证明"该发生的发生了",反例证明"不该发生的没发生"。
反例不是弱断言 —— 例如 off 档的反例要求连帧都为零,而不是"帧里没有某个字段"。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.expert_route import (
    EXPERT_PACKS,
    classify_intent,
    frame_payload,
    merge_tools,
    plan_route,
    resolve_mode,
    system_hint,
)

ENV_KEY = "IHUI_EXPERT_AUTO_ROUTE"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """每个用例从"部署方未设开关"的干净环境起步,避免机主 env 串进判定。"""
    monkeypatch.delenv(ENV_KEY, raising=False)


class TestModeResolution:
    def test_default_is_hint(self):
        # 正例:没传字段 = 温和提示档(不改工具/提示词),不是 off、也不是 auto。
        assert resolve_mode(None) == "hint"

    def test_requested_off_beats_default(self):
        # 反例对照:用户显式关掉,必须是 off(不能回落成 hint 继续发帧)。
        assert resolve_mode("off") == "off"

    def test_env_off_beats_requested_auto(self, monkeypatch):
        # 部署级硬关优先于请求字段:env=off 时调用方传 auto 也不生效。
        monkeypatch.setenv(ENV_KEY, "off")
        assert resolve_mode("auto") == "off"

    def test_invalid_value_falls_back_not_auto(self):
        # 写错值不得被当成 auto(那等于偷偷改工具清单),回落默认档。
        assert resolve_mode("Auto!") == "hint"


class TestClassifyIntent:
    def test_code_review_positive(self):
        pack, matched = classify_intent("帮我做一次代码审查,重点看错误处理")
        assert pack is not None and pack.slug == "code-review"
        assert "代码审查" in matched

    def test_unrelated_text_negative(self):
        # 反例:普通闲聊不得路由到任何专家包(空匹配,不是"最像的那个")。
        pack, matched = classify_intent("今天天气怎么样")
        assert pack is None
        assert matched == ()

    def test_empty_text_negative(self):
        assert classify_intent("   ") == (None, ())

    def test_all_pack_tools_are_declared_strings(self):
        # 反向锁:包里每个工具名必须是非空字符串,且包不重复(接线处按名字查 schema)。
        slugs = [pack.slug for pack in EXPERT_PACKS]
        assert len(slugs) == len(set(slugs))
        for pack in EXPERT_PACKS:
            assert pack.tools, pack.slug
            assert all(isinstance(tool, str) and tool.strip() for tool in pack.tools)

    def test_pack_tools_resolve_to_registered_mcp_tools(self):
        # 反向锁:包内工具名必须真能在 mcp_server 注册表里查到(写错名字只会静默少给工具)。
        from app.services.mcp_server import mcp_server

        registered = {tool.name for tool in mcp_server.list_tools()}
        assert "not_a_real_tool_xyz" not in registered  # 对照:本检查确实能判假
        for pack in EXPERT_PACKS:
            missing = [tool for tool in pack.tools if tool not in registered]
            assert not missing, f"{pack.slug} 引用了未注册工具: {missing}"


class TestRouteEffects:
    def test_off_has_no_pack_and_no_frame(self):
        # 反例:off 档即便文本命中,也不分类、不发帧。
        route = plan_route("这段代码报错了,帮我调试", "off")
        assert route.mode == "off"
        assert route.pack is None
        assert frame_payload(route) is None

    def test_hint_frame_but_no_tool_or_prompt_change(self):
        # 正例:hint 档发交代帧(fullText 报出命中词),但工具与系统提示逐字不变。
        route = plan_route("这段代码报错了,帮我调试", "hint")
        assert route.pack is not None and route.pack.slug == "debug-fix"
        payload = frame_payload(route)
        assert payload is not None
        assert payload["type"] == "injection_applied"
        assert payload["kind"] == "expert_pack"
        assert "报错" in payload["fullText"]
        assert "未改动工具清单与系统提示" in payload["fullText"]
        assert system_hint(route) is None
        tools = ["read_file"]
        assert merge_tools(route, tools) == ["read_file"]

    def test_auto_merges_tools_as_union_and_adds_hint(self):
        route = plan_route("这段代码报错了,帮我调试", "auto")
        tools = merge_tools(route, ["read_file", "write_file"])
        assert tools is not None
        # 并集:调用方原有顺序保留,包内工具补齐,且不出现重复项。
        assert tools[:2] == ["read_file", "write_file"]
        assert len(tools) == len(set(tools))
        assert "generate_test" in tools and "run_command" in tools
        assert system_hint(route) and "debug-fix" in system_hint(route)

    def test_auto_without_hit_keeps_tools_negative(self):
        # 反例:auto 档但文本不命中,工具清单必须原样(不能因为开了 auto 就乱加)。
        route = plan_route("今天天气怎么样", "auto")
        assert route.pack is None
        assert frame_payload(route) is None
        assert merge_tools(route, ["read_file"]) == ["read_file"]
        assert merge_tools(route, None) is None


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


async def _fake_gateway(monkeypatch) -> None:
    from app.routers import llm as llm_router

    async def fake_astream(messages, model=None, owner_uuid=None):
        yield {"type": "chunk", "content": "好的"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestStreamFrame:
    async def test_hit_emits_expert_pack_frame_before_chunk(self, client, monkeypatch):
        await _fake_gateway(monkeypatch)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "这段代码报错了,帮我调试一下"}],
                "expert_auto_route": "hint",
            },
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        injections = [e for e in events if e["event"] == "injection_applied"]
        assert len(injections) == 1
        data = injections[0]["data"]
        assert data["kind"] == "expert_pack"
        assert isinstance(data["collapsed"], str) and data["collapsed"]
        # 与既有注入帧同一守卫口径:缺 messageId 会被前端丢弃。
        assert "messageId" in data
        names = [e["event"] for e in events if e["event"]]
        assert names.index("injection_applied") < names.index("chunk")

    async def test_off_suppresses_frame_even_on_hit(self, client, monkeypatch):
        # 反例:同一段命中词 + off 档 ⇒ 一帧都不许发(用户关掉就必须真的安静)。
        await _fake_gateway(monkeypatch)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "这段代码报错了,帮我调试一下"}],
                "expert_auto_route": "off",
            },
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        assert [e for e in events if e["event"] == "injection_applied"] == []

    async def test_unrelated_text_emits_no_frame(self, client, monkeypatch):
        # 反例(默认档):不命中就不发空帧,与 D34"无注入不产生噪声帧"同口径。
        await _fake_gateway(monkeypatch)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "今天天气怎么样"}]},
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        assert [e for e in events if e["event"] == "injection_applied"] == []


class TestToolWhitelistWiring:
    """白名单真并入必须在**发给模型的 tools 载荷**上验证,不能只看纯函数返回值。"""

    @staticmethod
    async def _capture_tools(monkeypatch, payload: dict[str, Any]) -> list[str]:
        from app.routers import llm as llm_router

        captured: dict[str, Any] = {}

        async def fake_astream(messages, model=None, owner_uuid=None, **kwargs):
            if kwargs.get("tools") is not None and "tools" not in captured:
                captured["tools"] = kwargs["tools"]
            yield {"type": "chunk", "content": "好的"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post("/api/llm/complete/stream", json=payload)
        assert resp.status_code == 200
        return [tool["function"]["name"] for tool in captured.get("tools") or []]

    async def test_auto_adds_pack_tools_to_wire(self, monkeypatch):
        # 正例:auto 档命中 debug-fix ⇒ 上游 tools 里真出现包内写类工具。
        names = await self._capture_tools(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "这段代码报错了,帮我调试一下"}],
                "agent_tools": ["read_file"],
                "expert_auto_route": "auto",
            },
        )
        assert "read_file" in names
        assert {"generate_test", "run_command"} <= set(names)

    async def test_hint_adds_nothing_to_wire(self, monkeypatch):
        # 反例:同一段文本、同一份 agent_tools,hint 档上游 tools 必须逐字只有调用方给的那个。
        names = await self._capture_tools(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "这段代码报错了,帮我调试一下"}],
                "agent_tools": ["read_file"],
                "expert_auto_route": "hint",
            },
        )
        assert names == ["read_file"]

    async def test_auto_cannot_bypass_plan_mode_readonly(self, monkeypatch):
        # 反例(顺序锁):并入发生在 chat_mode 收窄之前,所以 plan 档下包内写类工具
        # 仍被 READONLY_TOOLS 交集摘掉 —— 专家包不能成为绕过只读承诺的后门。
        names = await self._capture_tools(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "这段代码报错了,帮我调试一下"}],
                "agent_tools": ["read_file"],
                "mode": "plan",
                "expert_auto_route": "auto",
            },
        )
        assert "read_file" in names
        assert "bug_fix" not in names
        assert "write_file" not in names


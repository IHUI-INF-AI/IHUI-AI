# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D34(2026-09-22,G-40):上下文注入交代帧的生产侧集成测试。

判据两问:① 生效的注入必须在流上产出 injection_applied,且**先于任何 chunk**;
② 没有任何注入时不得产生噪声帧(不发空帧)。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


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


async def _fake_gateway(monkeypatch):
    from app.routers import llm as llm_router

    async def fake_astream(messages, model=None, owner_uuid=None):
        yield {"type": "chunk", "content": "好的"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


class TestInjectionAppliedFrames:
    async def test_custom_system_prompt_yields_developer_instructions_first(
        self, client: AsyncClient, monkeypatch
    ):
        await _fake_gateway(monkeypatch)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "system_prompt": "始终以简体中文回答,并保持简短。",
            },
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)

        injections = [e for e in events if e["event"] == "injection_applied"]
        assert len(injections) == 1
        data = injections[0]["data"]
        assert data["type"] == "injection_applied"
        assert data["kind"] == "developer_instructions"
        assert isinstance(data["collapsed"], str) and data["collapsed"]
        # 与 plan_updated / terminal_* 同一守卫口径:缺 messageId 会被前端丢弃
        assert "messageId" in data

        # 必须是流上最早的业务帧(先于任何 chunk)
        names = [e["event"] for e in events if e["event"]]
        assert names.index("injection_applied") < names.index("chunk")

    async def test_no_injection_produces_no_frame(self, client: AsyncClient, monkeypatch):
        await _fake_gateway(monkeypatch)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "test"}]},
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        assert [e for e in events if e["event"] == "injection_applied"] == []


class TestRetryScheduledForwarding:
    """D34/G-44:网关在换 key 重试处 yield retry_scheduled,路由必须**原样转发上流**而非丢弃。

    网关侧的真实触发要 mock provider 失败(成本高于收益),这里锁住最易静默失效的一段:
    llm.py 的事件循环对非 chunk/done/error 类型的兜底转发。丢帧的表现是"界面毫无提示地卡住",
    正是本帧要消灭的失败模式。
    """

    async def test_retry_scheduled_frame_reaches_the_wire(self, client: AsyncClient, monkeypatch):
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {
                "type": "retry_scheduled",
                "attempt": 1,
                "maxRetries": 3,
                "retryInMs": 0,
                "httpStatus": 429,
            }
            yield {"type": "chunk", "content": "恢复后的正文"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "test"}]},
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        retries = [e for e in events if e["event"] == "retry_scheduled"]
        assert len(retries) == 1
        data = retries[0]["data"]
        assert data["type"] == "retry_scheduled"
        assert data["attempt"] == 1
        assert data["maxRetries"] == 3
        assert data["retryInMs"] == 0
        assert data["httpStatus"] == 429
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


class TestInjectionFullTextHonesty:
    """fullText 上限纪律(第 42 轮):超限**整字段省略**,但交代帧本身必须仍在。

    两件事不能混:① 告诉用户"这轮带了自定义指令"——任何长度都要说;
    ② 把全文随流下发——只在可完整给出时才做。发一段截断文本冒充全文是骗人,
    因长度超限就干脆不发帧也是骗人(方向相反)。
    """

    async def test_短自定义指令携带全文(self, client: AsyncClient, monkeypatch) -> None:

        await _fake_gateway(monkeypatch)
        prompt = "始终以简体中文回答,并保持简短。"
        resp = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "test"}], "system_prompt": prompt},
        )
        data = [e["data"] for e in _parse_sse_events(resp.text) if e["event"] == "injection_applied"]
        assert [d["kind"] for d in data] == ["developer_instructions"]
        assert data[0]["fullText"] == prompt

    async def test_超上限时省略全文但照常交代(self, client: AsyncClient, monkeypatch) -> None:
        from app.routers import llm as llm_router

        await _fake_gateway(monkeypatch)
        long_prompt = "指" * (llm_router.INJECTION_FULLTEXT_LIMIT + 10)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "test"}], "system_prompt": long_prompt},
        )
        data = [e["data"] for e in _parse_sse_events(resp.text) if e["event"] == "injection_applied"]
        assert len(data) == 1, "长度超限不得让交代帧一起消失"
        assert data[0]["kind"] == "developer_instructions"
        assert "fullText" not in data[0]

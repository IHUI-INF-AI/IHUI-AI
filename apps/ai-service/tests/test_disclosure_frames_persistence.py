# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""G-166 交代帧持久化(citations / injections)—— ai-service 侧单测。

覆盖:
- 落库 citations 与 SSE citations 帧**同一真相源**(_collect_citations 的两条出口逐字段等价)
- injections 与 SSE injection_applied 帧同源,持久化时剥掉帧判别字 "type"
- 空列表 / 未传 → body 不写该 key(与"本轮无引用/无注入"区分,也不覆盖 worker 已合并字段)
- 两条通道与 toolCalls / planSteps 共存,互不挤掉

测试隔离(AGENTS.md §5):全程 monkeypatch httpx.AsyncClient + settings,
不触网、不连任何 PostgreSQL / Redis。
"""

from __future__ import annotations

import json

import pytest

from app.routers.llm import _collect_citations, _fire_callback, _format_citations_event

_FRAME_PREFIX = "event: citations\ndata: "

_HISTORY_WITH_CITATIONS: list[dict[str, object]] = [
    {
        "toolCallId": "tc-1",
        "toolName": "knowledge_lookup",
        "args": {"query": "架构"},
        "result": {
            "hits": [
                {"source": "knowledge", "citations": ["架构说明 §2", "去重重复项"]},
                {"source": "knowledge", "citations": ["架构说明 §2"]},
            ]
        },
    },
    # 出错的那次调用不得贡献引用
    {
        "toolCallId": "tc-2",
        "toolName": "knowledge_lookup",
        "result": {"hits": [{"source": "knowledge", "citations": ["不该出现"]}]},
        "isError": True,
    },
]

_INJECTIONS: list[dict[str, object]] = [
    {
        "type": "injection_applied",
        "kind": "developer_instructions",
        "collapsed": "已应用会话级自定义指令",
        "fullText": "按仓库规范回答",
    },
    {
        "type": "injection_applied",
        "kind": "auto_context",
        "collapsed": "已自动检索并注入 3 段代码上下文",
        "count": 3,
    },
]


def _sse_citations(message_id: str | None = None) -> list[dict[str, str]]:
    frame = _format_citations_event(_HISTORY_WITH_CITATIONS, message_id)  # type: ignore[arg-type]
    assert frame is not None
    assert frame.startswith(_FRAME_PREFIX)
    payload = json.loads(frame[len(_FRAME_PREFIX) :])
    assert payload["type"] == "citations"
    return list(payload["citations"])


class _FakeResp:
    status_code = 200
    text = ""


class _FakeClient:
    captured: list[dict] = []  # type: ignore[type-arg]

    def __init__(self, *args: object, **kwargs: object) -> None:
        pass

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def post(
        self, url: str, json: dict | None = None, headers: dict | None = None  # type: ignore[type-arg]
    ) -> _FakeResp:
        _FakeClient.captured.append(json or {})
        return _FakeResp()


@pytest.fixture(autouse=True)
def _cb_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_callback_secret", "test-secret")
    monkeypatch.setattr("app.routers.llm.httpx.AsyncClient", _FakeClient)
    _FakeClient.captured = []


async def _fire(**kwargs: object) -> dict:  # type: ignore[type-arg]
    await _fire_callback(
        "http://cb",
        {"content": "hi", "model": "m1", "usage": {"total_tokens": 5}, "stub": False},
        {"conversationId": "c1", "userId": "u1", "messageId": "msg-1"},
        **kwargs,
    )
    assert _FakeClient.captured, "回调未发出:测试夹具或 secret 配置失效"
    return _FakeClient.captured[0]


class TestCitationsSingleSource:
    def test_dedup_and_error_call_excluded(self) -> None:
        got = _collect_citations(_HISTORY_WITH_CITATIONS)  # type: ignore[arg-type]
        assert [c["label"] for c in got] == ["架构说明 §2", "去重重复项"]

    async def test_body_equals_sse_frame(self) -> None:
        """落库通道与 SSE 通道逐字段等价(同一个 _collect_citations 的两条出口)。"""
        body = await _fire(tool_calls_history=_HISTORY_WITH_CITATIONS)
        assert body["citations"] == _sse_citations("msg-1")


class TestFireCallbackDisclosureFrames:
    async def test_writes_citations_from_tool_history(self) -> None:
        body = await _fire(tool_calls_history=_HISTORY_WITH_CITATIONS)
        assert body["citations"] == _sse_citations()

    async def test_writes_injections_without_frame_type(self) -> None:
        body = await _fire(injections=_INJECTIONS)
        assert body["injections"] == [
            {
                "kind": "developer_instructions",
                "collapsed": "已应用会话级自定义指令",
                "fullText": "按仓库规范回答",
            },
            {
                "kind": "auto_context",
                "collapsed": "已自动检索并注入 3 段代码上下文",
                "count": 3,
            },
        ]
        assert all("type" not in item for item in body["injections"])

    async def test_coexists_with_tool_calls_and_plan_steps(self) -> None:
        body = await _fire(
            tool_calls_history=_HISTORY_WITH_CITATIONS, injections=_INJECTIONS
        )
        assert [c["id"] for c in body["toolCalls"]] == ["tc-1", "tc-2"]
        assert body["planSteps"]
        assert body["citations"]
        assert body["injections"]
        assert body["metadata"]["conversationId"] == "c1"

    async def test_omits_keys_when_nothing_to_disclose(self) -> None:
        body = await _fire(tool_calls_history=[], injections=[])
        assert "citations" not in body
        assert "injections" not in body

    async def test_omits_keys_when_not_passed(self) -> None:
        """非流式端点(/llm/complete)不传参数 → 字段缺省,向后兼容。"""
        body = await _fire()
        assert "citations" not in body
        assert "injections" not in body
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

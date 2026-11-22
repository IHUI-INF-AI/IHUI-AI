# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-012 回归:Ollama 流内 {"error": ...} 帧必须按失败收口。

票面:`app/providers/ollama_provider.py` 的 astream 只读 message/done,
上游 OOM / 模型加载失败时吐出的 `{"error": "..."}` 行被当普通 chunk 跳过,
生成器耗尽后兜底 `yield done + usage={}` → 失败被判成功。

本文件用假 async iterator 模拟 /api/chat 的 NDJSON 行流(不连本机 Ollama),
覆盖三种形态:内容后报错、纯正常流、仅错误行。
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.providers import ollama_provider as mod
from app.providers.ollama_provider import OllamaProvider

_MODEL = "llama3.2"


class _FakeStreamResponse:
    """模拟 httpx.Response 的流式读取(逐行 NDJSON)。"""

    def __init__(self, lines: list[str], status_code: int = 200):
        self._lines = lines
        self.status_code = status_code

    async def aread(self) -> bytes:
        return b""

    async def aiter_lines(self):
        for line in self._lines:
            yield line


class _FakeStreamContext:
    def __init__(self, response: _FakeStreamResponse):
        self._response = response

    async def __aenter__(self) -> _FakeStreamResponse:
        return self._response

    async def __aexit__(self, *args: Any) -> None:
        return None


class _FakeHttpClient:
    """只实现 stream(),按给定行流返回异步上下文管理器。"""

    def __init__(self, lines: list[str], status_code: int = 200):
        self._lines = lines
        self._status_code = status_code

    def stream(self, method: str, url: str, **kwargs: Any) -> _FakeStreamContext:
        return _FakeStreamContext(_FakeStreamResponse(self._lines, self._status_code))


def _install_fake_client(monkeypatch, lines: list[str]) -> None:
    monkeypatch.setattr(mod, "get_http_client", lambda: _FakeHttpClient(lines))


async def _collect() -> list[dict[str, Any]]:
    return [
        evt
        async for evt in OllamaProvider().astream(
            [{"role": "user", "content": "hi"}], model=_MODEL
        )
    ]


async def test_stream_error_after_content_yields_error_without_done(monkeypatch):
    """内容后报错 → 产出 error 帧,无 done、无空 usage。"""
    _install_fake_client(
        monkeypatch,
        [
            json.dumps({"message": {"content": "hi"}, "done": False}),
            json.dumps({"error": "model requires more system memory"}),
        ],
    )

    events = await _collect()

    assert [e["type"] for e in events] == ["chunk", "error"]
    assert events[0]["content"] == "hi"
    assert "model requires more system memory" in events[1]["message"]
    assert events[1]["model"] == _MODEL
    assert not [e for e in events if e["type"] == "done"]
    assert not [e for e in events if "usage" in e]


async def test_normal_stream_keeps_done_and_usage(monkeypatch):
    """纯正常流 → chunk 顺序与 done/usage 保持不变。"""
    _install_fake_client(
        monkeypatch,
        [
            json.dumps({"message": {"content": "Hello"}, "done": False}),
            json.dumps({"message": {"content": " world"}, "done": False}),
            json.dumps({
                "message": {},
                "done": True,
                "model": _MODEL,
                "eval_count": 5,
                "prompt_eval_count": 10,
            }),
        ],
    )

    events = await _collect()

    assert [e["type"] for e in events] == ["chunk", "chunk", "done"]
    assert [e.get("content") for e in events if e["type"] == "chunk"] == ["Hello", " world"]
    assert events[-1]["model"] == _MODEL
    assert events[-1]["usage"] == {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
    }


async def test_error_only_stream_yields_single_error_frame(monkeypatch):
    """仅有一行 error → 只产出 error 帧,不补 done。"""
    _install_fake_client(
        monkeypatch,
        [json.dumps({"error": "failed to load model: out of memory"})],
    )

    events = await _collect()

    assert [e["type"] for e in events] == ["error"]
    assert "failed to load model: out of memory" in events[0]["message"]
    assert not [e for e in events if e["type"] == "done"]


@pytest.mark.parametrize("chunk", [{"message": {"content": "x"}}, {"done": True}])
async def test_non_error_chunk_is_not_flagged(monkeypatch, chunk):
    """非错误帧不会被误判为 error(小函数本身的边界)。"""
    assert OllamaProvider._stream_error_frame(chunk, _MODEL) is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

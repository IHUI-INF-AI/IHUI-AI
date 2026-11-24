# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器运行时观测(console / network)单测(2026-11-08)。

钉住四件事:
  ① 环形缓冲有界:超上限丢最旧并累计 dropped,单条文本按 EVENT_TEXT_LIMIT 截断;
  ② console 归一化:CDP 类型 → 五个稳定 level,未知不丢(按 log);
  ③ network 合并:request→response→finish/fail 合成一行,未完成的不落库;
  ④ 会话接线:enable 幂等、失败降级、读取面过滤不改录制。

注释:这里用替身 CDP,不启动真浏览器;行为判据(容量/截断/归一化/过滤)与
Chromium 无关,可稳定单测。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services import browser_hub as bh


class FakeCdp:
    """sync CDPSession 替身:记录 send,支持 on/emit。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.handlers: dict[str, list] = {}

    def send(self, method: str, params: dict | None = None) -> None:
        self.calls.append((method, params or {}))

    def on(self, event: str, handler) -> None:
        self.handlers.setdefault(event, []).append(handler)

    def emit(self, event: str, params: dict[str, Any] | None = None) -> None:
        for handler in self.handlers.get(event, []):
            handler(params or {})


class BrokenCdp(FakeCdp):
    """注册回调即失败(模拟 CDP 已断):用于验证观测降级不抛。"""

    def on(self, event: str, handler) -> None:
        raise RuntimeError("cdp detached")


class FakeContext:
    def __init__(self) -> None:
        self.cdp = FakeCdp()
        self.cdp_session_calls = 0

    def new_cdp_session(self, page) -> FakeCdp:
        self.cdp_session_calls += 1
        return self.cdp


class BrokenContext(FakeContext):
    def __init__(self) -> None:
        super().__init__()
        self.cdp = BrokenCdp()


class FakePage:
    url = "about:blank"


@pytest.fixture(autouse=True)
def _direct_run_sync(monkeypatch):
    """把 _run_sync 换成直接执行,避免测试里起线程池。"""

    async def _direct(self, func):
        return func()

    monkeypatch.setattr(bh.BrowserSession, "_run_sync", _direct)


def _make_session(context: FakeContext | None = None) -> bh.BrowserSession:
    ctx = context or FakeContext()
    return bh.BrowserSession(
        "sess-obs",
        ctx,  # type: ignore[arg-type]
        FakePage(),  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        asyncio.get_running_loop(),
    )


# ---------------------------------------------------------------------------
# ① 环形缓冲
# ---------------------------------------------------------------------------


def test_event_buffer_is_bounded_and_counts_dropped():
    buf = bh.BrowserEventBuffer(max_events=3, text_limit=20)
    for index in range(5):
        buf.append({"text": f"line-{index}"})

    snapshot = buf.snapshot(limit=10)
    assert [item["text"] for item in snapshot] == ["line-2", "line-3", "line-4"]
    assert buf.dropped == 2
    assert len(buf) == 3
    assert [item["seq"] for item in snapshot] == [3, 4, 5]


def test_event_buffer_truncates_text_and_clamps_limit():
    buf = bh.BrowserEventBuffer(max_events=10, text_limit=5)
    stored = buf.append({"text": "x" * 50, "url": "https://example.com/very/long"})
    assert stored["text"] == "xxxxx"
    assert stored["url"] == "https"
    # limit 至少 1,不能因为传 0 返回空
    assert len(buf.snapshot(limit=0)) == 1


def test_event_buffer_predicate_runs_before_limit():
    buf = bh.BrowserEventBuffer(max_events=10)
    for level in ("log", "error", "log", "error"):
        buf.append({"level": level, "text": level})
    only_errors = buf.snapshot(limit=10, predicate=lambda item: item["level"] == "error")
    assert [item["level"] for item in only_errors] == ["error", "error"]


# ---------------------------------------------------------------------------
# ② console 归一化
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("warn", "warning"),
        ("verbose", "debug"),
        ("trace", "debug"),
        ("assert", "error"),
        ("ERROR", "error"),
        ("what", "log"),
        (None, "log"),
    ],
)
def test_normalize_console_level(raw, expected):
    assert bh.normalize_console_level(raw) == expected


def test_console_event_from_cdp_joins_remote_objects():
    event = bh._console_event_from_cdp(
        {
            "type": "assert",
            "args": [{"value": "a"}, {"value": 2}, {"description": "Object"}],
            "url": "https://x/app.js",
            "lineNumber": 3,
            "columnNumber": 4,
        }
    )
    assert event["level"] == "error"
    assert event["text"] == "a 2 Object"
    assert event["url"] == "https://x/app.js"
    assert (event["line"], event["column"]) == (3, 4)


def test_exception_event_from_cdp_is_error():
    event = bh._exception_event_from_cdp(
        {"exceptionDetails": {"text": "Uncaught TypeError", "lineNumber": 7}}
    )
    assert event["level"] == "error"
    assert event["source"] == "exception"
    assert event["text"] == "Uncaught TypeError"
    assert event["line"] == 7


def test_log_entry_event_from_cdp_keeps_level():
    event = bh._log_entry_event_from_cdp(
        {"entry": {"level": "warning", "text": "deprecated api", "url": "https://x"}}
    )
    assert event["level"] == "warning"
    assert event["source"] == "log"
    assert event["text"] == "deprecated api"


# ---------------------------------------------------------------------------
# ③ network 合并
# ---------------------------------------------------------------------------


def test_network_recorder_merges_events_and_skips_unfinished():
    buf = bh.BrowserEventBuffer(max_events=10)
    recorder = bh.NetworkRecorder(buf)
    recorder.on_request_will_be_sent(
        {
            "requestId": "r1",
            "timestamp": 10.0,
            "type": "Fetch",
            "request": {"method": "POST", "url": "https://api/x"},
        }
    )
    recorder.on_request_will_be_sent(
        {
            "requestId": "r2",
            "timestamp": 10.0,
            "type": "Document",
            "request": {"method": "GET", "url": "https://api/y"},
        }
    )
    assert recorder.pending_count == 2

    recorder.on_response_received(
        {
            "requestId": "r1",
            "response": {"status": 503, "mimeType": "application/json", "url": "https://api/x"},
        }
    )
    recorder.on_loading_finished({"requestId": "r1", "timestamp": 10.25, "encodedDataLength": 2048})
    recorder.on_loading_failed(
        {"requestId": "r2", "timestamp": 10.5, "errorText": "net::ERR_FAILED"}
    )

    assert recorder.pending_count == 0
    events = buf.snapshot(limit=10)
    assert events[0]["requestId"] == "r1"
    assert (events[0]["method"], events[0]["url"], events[0]["status"]) == (
        "POST",
        "https://api/x",
        503,
    )
    assert events[0]["durationMs"] == 250.0
    assert events[0]["size"] == 2048
    assert events[0]["failed"] is False
    assert events[1]["failed"] is True
    assert events[1]["status"] == 0
    assert events[1]["errorText"] == "net::ERR_FAILED"


def test_network_recorder_response_without_request_is_kept():
    buf = bh.BrowserEventBuffer()
    recorder = bh.NetworkRecorder(buf)
    recorder.on_response_received(
        {"requestId": "r9", "response": {"status": 200, "url": "https://api/z"}}
    )
    recorder.on_loading_finished({"requestId": "r9", "timestamp": 1.0})
    events = buf.snapshot(limit=10)
    assert events[0]["url"] == "https://api/z"
    assert events[0]["status"] == 200


# ---------------------------------------------------------------------------
# ④ 会话接线
# ---------------------------------------------------------------------------


async def test_session_enable_is_idempotent():
    ctx = FakeContext()
    session = _make_session(ctx)

    assert await session.enable_observability() is True
    assert [call[0] for call in ctx.cdp.calls] == ["Runtime.enable", "Log.enable", "Network.enable"]
    assert len(ctx.cdp.handlers["Runtime.consoleAPICalled"]) == 1
    assert len(ctx.cdp.handlers["Network.loadingFinished"]) == 1

    assert await session.enable_observability() is True
    assert len(ctx.cdp.calls) == 3
    assert len(ctx.cdp.handlers["Runtime.consoleAPICalled"]) == 1


async def test_session_console_reads_and_filters():
    ctx = FakeContext()
    session = _make_session(ctx)
    await session.enable_observability()

    ctx.cdp.emit(
        "Runtime.consoleAPICalled",
        {"type": "error", "args": [{"value": "boom"}], "url": "u", "lineNumber": 1, "columnNumber": 2},
    )
    ctx.cdp.emit(
        "Runtime.exceptionThrown", {"exceptionDetails": {"text": "Uncaught TypeError"}}
    )
    ctx.cdp.emit("Log.entryAdded", {"entry": {"level": "warning", "text": "deprecated", "url": "u"}})
    ctx.cdp.emit("Runtime.consoleAPICalled", {"type": "log", "args": [{"value": "hello"}]})

    everything = await session.console_messages(limit=10)
    assert everything["enabled"] is True
    assert everything["count"] == 4

    errors = await session.console_messages(level="error")
    assert [item["text"] for item in errors["events"]] == ["boom", "Uncaught TypeError"]

    matched = await session.console_messages(text_contains="DEPRE")
    assert matched["count"] == 1

    # 过滤是读取面的行为,录制面不丢事件
    assert await session.console_messages(level="all") == everything


async def test_session_network_reads_and_filters():
    ctx = FakeContext()
    session = _make_session(ctx)
    await session.enable_observability()

    ctx.cdp.emit(
        "Network.requestWillBeSent",
        {
            "requestId": "ok-1",
            "timestamp": 1.0,
            "type": "Fetch",
            "request": {"method": "GET", "url": "https://api/users"},
        },
    )
    ctx.cdp.emit(
        "Network.responseReceived",
        {"requestId": "ok-1", "response": {"status": 200, "mimeType": "application/json"}},
    )
    ctx.cdp.emit("Network.loadingFinished", {"requestId": "ok-1", "timestamp": 1.1})
    ctx.cdp.emit(
        "Network.requestWillBeSent",
        {
            "requestId": "bad-1",
            "timestamp": 2.0,
            "type": "XHR",
            "request": {"method": "POST", "url": "https://api/users"},
        },
    )
    ctx.cdp.emit(
        "Network.responseReceived",
        {"requestId": "bad-1", "response": {"status": 500, "mimeType": "text/plain"}},
    )
    ctx.cdp.emit("Network.loadingFinished", {"requestId": "bad-1", "timestamp": 2.5})
    # 在途请求:不落库,只体现在 pending
    ctx.cdp.emit(
        "Network.requestWillBeSent",
        {
            "requestId": "flight-1",
            "timestamp": 3.0,
            "type": "Fetch",
            "request": {"method": "GET", "url": "https://api/pending"},
        },
    )

    assert (await session.network_requests())["count"] == 2
    pending = await session.network_requests(url_contains="pending")
    assert pending["count"] == 0
    assert pending["pending"] == 1

    failures = await session.network_requests(status_min=400)
    assert [item["requestId"] for item in failures["events"]] == ["bad-1"]

    by_method = await session.network_requests(method="post")
    assert [item["requestId"] for item in by_method["events"]] == ["bad-1"]

    # 已完成的失败请求(loadingFailed)也走 failed_only
    ctx.cdp.emit(
        "Network.requestWillBeSent",
        {
            "requestId": "broken-1",
            "timestamp": 4.0,
            "type": "Fetch",
            "request": {"method": "GET", "url": "https://api/broken"},
        },
    )
    ctx.cdp.emit("Network.loadingFailed", {"requestId": "broken-1", "errorText": "net::ERR"})
    failed = await session.network_requests(failed_only=True)
    assert [item["requestId"] for item in failed["events"]] == ["broken-1"]


async def test_session_observability_failure_degrades_without_raising():
    session = _make_session(BrokenContext())

    assert await session.enable_observability() is False
    console = await session.console_messages()
    assert console == {"enabled": False, "count": 0, "dropped": 0, "events": []}
    network = await session.network_requests()
    assert network["enabled"] is False
    assert network["count"] == 0
    assert network["pending"] == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

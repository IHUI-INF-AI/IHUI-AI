# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P2-04/V2-04 运行账本客户端：先落盘、再重放、去重与 orphan。"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from app.services.run_ledger import RunLedgerClient, RunOutbox


@pytest.mark.asyncio
async def test_session_append_flushes_outbox_and_clears_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    requests: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path))
        return httpx.Response(201, json={"code": 0, "message": "success", "data": {}})

    client = RunLedgerClient(
        user_id="user-1",
        base_url="http://test",
        outbox_root=tmp_path,
        transport=httpx.MockTransport(handler),
    )
    session = client.session("run-1")
    result = await session.append("status", {"status": "running"})

    assert result == {"accepted": True, "seq": 1}
    assert requests == [
        ("POST", "/api/internal/agent-registry/runs/run-1/events"),
    ]
    assert not (tmp_path / "run-1.jsonl").exists()


@pytest.mark.asyncio
async def test_retry_exhaustion_marks_orphan(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    sleeps: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"code": 503, "message": "down"})

    client = RunLedgerClient(
        user_id="user-1",
        base_url="http://test",
        outbox_root=tmp_path,
        transport=httpx.MockTransport(handler),
        sleep=fake_sleep,
    )
    session = client.session("run-2")
    await session.append("status", {"status": "failed"})

    assert sleeps == [1.0, 2.0, 4.0, 8.0]
    assert not (tmp_path / "run-2.jsonl").exists()
    orphan = tmp_path / "run-2.orphan"
    assert orphan.exists()
    raw = [json.loads(line) for line in orphan.read_text(encoding="utf-8").splitlines()]
    assert raw[0]["attempt"] == 5


def test_outbox_drops_low_priority_step_when_full(tmp_path: Path) -> None:
    outbox = RunOutbox("run-3", root=tmp_path, max_events=2)
    assert outbox.enqueue(1, "step", {"step": 1}) is True
    assert outbox.enqueue(2, "step", {"step": 2}) is True
    assert outbox.enqueue(3, "step", {"step": 3}) is False

    assert outbox.enqueue(4, "status", {"status": "succeeded"}) is True
    pending = outbox.pending()
    assert [item.type for item in pending] == ["status"]


def test_outbox_rewrite_is_atomic(tmp_path: Path) -> None:
    outbox = RunOutbox("run-4", root=tmp_path)
    outbox.enqueue(1, "step", {"x": 1})
    items = outbox.pending()
    items[0].attempt = 2
    outbox.rewrite(items)
    assert outbox.pending()[0].attempt == 2
    outbox.rewrite([])
    assert not outbox.path.exists()

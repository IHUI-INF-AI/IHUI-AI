# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话交接导出 / 会话诊断端点单测(2026-11-20,第 15–16 项)。

覆盖:
1. 交接包 → Markdown 四段齐备、单条裁剪、超量只列前 N 并报总数。
2. 端点属主:本人 200 形态(含 packet/markdown/markdownChars)/ 他人与不存在同形 404。
3. download=true 回 text/markdown 附件且带 Content-Disposition。
4. 诊断:窗口拿不到 ⇒ percent_left=None(未判定);给窗口 ⇒ 有百分比。
5. 诊断缓存:无账目 ⇒ matched=false、hitRate=None(不拿 0 冒充 0%)。

假 store 零 DB;cost_ledger 用替身注入,不触真实账本。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.responses import PlainTextResponse

from app.routers import sessions as sessions_api
from app.services.session_handoff import (
    HANDOFF_MARKDOWN_MAX_ITEMS,
    HandoffPacket,
    HandoffRecommendation,
    render_handoff_markdown,
)
from app.services.session_store import CompactionBoundaryItem, LLMMessage, Thread, UserMessageItem


class FakeStore:
    def __init__(self, owner: str = "u1") -> None:
        self.thread = Thread(thread_id="th-1", title="对话", metadata={"userId": owner})
        self.messages = [
            LLMMessage(role="user", content="以后都用中文回复"),
            LLMMessage(role="assistant", content="好的,记住这条规范"),
        ]
        self.items = [
            UserMessageItem(content="以后都用中文回复"),
            CompactionBoundaryItem(summary="早前 20 条被压缩", tokens_before=900, tokens_after=120),
        ]

    def get_thread(self, thread_id: str) -> Thread | None:
        return self.thread if thread_id == "th-1" else None

    def resume(self, thread_id: str) -> list[LLMMessage]:
        return list(self.messages)

    def get_thread_goal_state(self, thread_id: str) -> dict[str, Any] | None:
        return {"objective": "把交接能力装车"}

    def list_items(self, thread_id: str, **kw: Any) -> list[Any]:
        return list(self.items)


class FakeLedger:
    def __init__(self, rows: dict[str, Any] | None = None) -> None:
        self.rows = rows or {}

    def aggregate(self, filter: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.rows


@pytest.fixture()
def store() -> FakeStore:
    return FakeStore()


@pytest.fixture(autouse=True)
def ledger(monkeypatch: pytest.MonkeyPatch) -> FakeLedger:
    fake = FakeLedger()
    monkeypatch.setattr(sessions_api, "cost_ledger", fake)
    return fake


def test_render_markdown_sections_and_caps() -> None:
    packet = HandoffPacket(
        packet_id="p1",
        created_at="2026-11-20T00:00:00+00:00",
        session_id="th-1",
        pending_tasks=[{"title": f"任务{i}", "status": "pending"} for i in range(25)],
        learnings=[{"content": "x" * 500}],
        context_blocks=[{"kind": "memory", "text": "偏好中文"}],
        recommendations=[HandoffRecommendation(action="跑测试", reason="验证", priority="high")],
    )
    md = render_handoff_markdown(packet)
    for section in ("## 待接任务", "## 本轮学习", "## 上下文残留", "## 下一步建议"):
        assert section in md
    assert f"…另有 {25 - HANDOFF_MARKDOWN_MAX_ITEMS} 条" in md
    assert md.count("任务") <= HANDOFF_MARKDOWN_MAX_ITEMS + 2
    assert "…" in md  # 单条 400 字符上限生效
    assert "[high] 跑测试 —— 验证" in md


def test_export_endpoint_ok_and_markdown(store: FakeStore) -> None:
    out = sessions_api.export_handoff("th-1", download=False, user_id="u1", store=store)
    assert isinstance(out, dict) and out["code"] == 0
    data = out["data"]
    assert data["packet"]["session_id"] == "th-1"
    assert data["markdown"].startswith("# 会话交接")
    assert data["markdownChars"] == len(data["markdown"])


def test_export_download_is_attachment(store: FakeStore) -> None:
    res = sessions_api.export_handoff("th-1", download=True, user_id="u1", store=store)
    assert isinstance(res, PlainTextResponse)
    assert res.media_type.startswith("text/markdown")
    assert "attachment" in res.headers["content-disposition"]


def test_export_foreign_is_same_404(store: FakeStore) -> None:
    with pytest.raises(HTTPException) as err:
        sessions_api.export_handoff("th-1", download=False, user_id="u2", store=store)
    assert err.value.status_code == 404
    with pytest.raises(HTTPException) as err2:
        sessions_api.export_handoff("nope", download=False, user_id="u2", store=store)
    assert err2.value.status_code == 404
    # 同一种被拒形态:前缀一致,只有 id 不同(不新造可分辨信号)
    assert str(err.value.detail).split(":")[0] == str(err2.value.detail).split(":")[0]


def test_diagnostics_context_pressure(store: FakeStore) -> None:
    unknown = sessions_api.thread_diagnostics("th-1", context_limit=0, user_id="u1", store=store)["data"]
    assert unknown["context"]["estimatedTokens"] > 0
    assert unknown["context"]["pressure"]["percent_left"] is None
    assert unknown["compaction"]["boundaries"] == 1
    assert unknown["compaction"]["lastBoundary"]["tokens_after"] == 120

    known = sessions_api.thread_diagnostics("th-1", context_limit=100_000, user_id="u1", store=store)["data"]
    assert known["context"]["pressure"]["percent_left"] is not None


def test_diagnostics_cache_unmatched_is_not_zero(store: FakeStore) -> None:
    data = sessions_api.thread_diagnostics("th-1", context_limit=0, user_id="u1", store=store)["data"]
    assert data["cache"]["matched"] is False
    assert data["cache"]["hitRate"] is None


def test_diagnostics_cache_counts(store: FakeStore, ledger: FakeLedger) -> None:
    ledger.rows = {"count": 4, "total_cached_tokens": 3000, "cache_hit_count": 3}
    data = sessions_api.thread_diagnostics("th-1", context_limit=0, user_id="u1", store=store)["data"]
    assert data["cache"]["matched"] is True
    assert data["cache"]["hitRate"] == 0.75
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

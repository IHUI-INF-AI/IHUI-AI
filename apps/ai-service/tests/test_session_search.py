# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‍⁠

"""session_search 跨会话检索契约(2026-11-14 立,对标 DSH dsh-tool-session-query)。

① 只看当前用户自己的会话(属主过滤在 SQL 里),别人的会话不可见;
② 始终省略调用方会话;显式 thread_id 时按属主校验,越权与不存在同形;
③ 无宿主身份直接拒绝,不退回全量检索;
④ 空 query 结构化拒绝;返回标题/摘录/类型/score;limit 收敛到 1..50。
"""

from __future__ import annotations

import pytest

from app.routers import sessions as sessions_router
from app.services.mcp_server import _tool_session_search
from app.services.session_store import SessionStore, UserMessageItem


@pytest.fixture
def store(tmp_path, monkeypatch):
    st = SessionStore(str(tmp_path / "session-search.db"))
    monkeypatch.setattr(sessions_router, "get_session_store", lambda: st)
    yield st
    st.close()


def _thread_with(store: SessionStore, owner: str, text: str, title: str) -> str:
    thread = store.create_thread(title=title, metadata={}, user_id=owner)
    turn = store.start_turn(thread.thread_id)
    store.append_item(
        turn.turn_id, UserMessageItem(content=text), thread_id=thread.thread_id
    )
    return thread.thread_id


@pytest.mark.asyncio
async def test_searches_other_sessions_of_same_user_only(store: SessionStore) -> None:
    caller = _thread_with(store, "u1", "alpha caller secret", "当前会话")
    other = _thread_with(store, "u1", "alpha beta 上次的结论", "上次的结论")
    _thread_with(store, "u2", "alpha 别人的会话", "别人的会话")

    result = await _tool_session_search(
        {"query": "alpha", "__user_id": "u1", "__session_id": caller}
    )
    assert result["ok"] is True
    assert result["total"] == 1
    hit = result["hits"][0]
    assert hit["thread_id"] == other
    assert hit["title"] == "上次的结论"
    assert "alpha" in hit["snippet"]
    assert "item_type" in hit and "seq" in hit
    assert isinstance(result["fts_enabled"], bool)


@pytest.mark.asyncio
async def test_explicit_thread_id_is_owner_checked(store: SessionStore) -> None:
    mine = _thread_with(store, "u1", "alpha mine", "我的")
    foreign = _thread_with(store, "u2", "alpha foreign", "别人的")

    ok = await _tool_session_search(
        {"query": "alpha", "thread_id": mine, "__user_id": "u1", "__session_id": "x"}
    )
    assert ok["ok"] is True and ok["hits"][0]["thread_id"] == mine

    denied = await _tool_session_search(
        {"query": "alpha", "thread_id": foreign, "__user_id": "u1", "__session_id": "x"}
    )
    missing = await _tool_session_search(
        {"query": "alpha", "thread_id": "no-such-thread", "__user_id": "u1"}
    )
    assert denied["ok"] is False and missing["ok"] is False
    assert denied["errorCode"] == missing["errorCode"] == "SESSION_SEARCH_UNAUTHORIZED"
    assert denied["error"] == missing["error"]


@pytest.mark.asyncio
async def test_requires_host_identity(store: SessionStore) -> None:
    _thread_with(store, "u1", "alpha", "t")
    result = await _tool_session_search({"query": "alpha"})
    assert result["ok"] is False
    assert result["errorCode"] == "SESSION_SEARCH_UNAUTHORIZED"


@pytest.mark.asyncio
async def test_empty_query_is_rejected(store: SessionStore) -> None:
    result = await _tool_session_search({"query": "   ", "__user_id": "u1"})
    assert result["ok"] is False
    assert result["errorCode"] == "MISSING_PARAMS"


@pytest.mark.asyncio
async def test_limit_is_bounded(store: SessionStore) -> None:
    for i in range(3):
        _thread_with(store, "u1", f"alpha {i}", f"t{i}")
    result = await _tool_session_search(
        {"query": "alpha", "limit": 1, "__user_id": "u1", "__session_id": "caller"}
    )
    assert result["ok"] is True
    assert len(result["hits"]) == 1

    clamped = await _tool_session_search(
        {"query": "alpha", "limit": 9999, "__user_id": "u1", "__session_id": "caller"}
    )
    assert clamped["ok"] is True
    assert len(clamped["hits"]) <= 3

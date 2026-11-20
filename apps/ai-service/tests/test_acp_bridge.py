# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ACP(Agent Client Protocol)HTTP 桥单测(2026-11-20,第 14 项)。

覆盖:
1. initialize 能力回包形状(v1 + loadSession + promptCapabilities)。
2. session/new 建线程、身份只从入参进(请求体自报 userId 无效)。
3. session/load 属主通过;别人的会话与不存在同形(同一句 message)。
4. session/list 只回本人的会话。
5. session/prompt 返回 -32001(不假装支持流式)+ 点名既有 SSE 端点。
6. 未实现方法 -32601 / 非法信封 -32600 / authenticate 空结果。
7. 批量数组逐条独立回包;空批量与超上限整批拒。

用假 store(零 DB),判据只依赖协议形状与 session_store 的属主单一真相源。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.acp_bridge import (
    ACP_MAX_BATCH,
    INVALID_REQUEST,
    METHOD_NOT_FOUND,
    UNSUPPORTED_STREAMING,
    handle_acp_payload,
)
from app.services.session_store import (
    CompactionBoundaryItem,
    Thread,
    ThreadPage,
    UserMessageItem,
)


class FakeStore:
    """最小会话面替身:只实现 ACP 桥用到的四个方法。"""

    def __init__(self) -> None:
        self.threads: dict[str, Thread] = {}
        self.created_calls: list[dict[str, Any]] = []
        self.items: dict[str, list[Any]] = {}

    def add_thread(self, thread_id: str, owner: str, title: str = "t") -> None:
        self.threads[thread_id] = Thread(thread_id=thread_id, title=title, metadata={"userId": owner})

    def create_thread(self, *, title: str = "", metadata: dict[str, Any] | None = None,
                      user_id: str | None = None, **kw: Any) -> Thread:
        self.created_calls.append({"title": title, "metadata": metadata, "user_id": user_id})
        tid = f"th-{len(self.created_calls)}"
        t = Thread(thread_id=tid, title=title, metadata={"userId": user_id or ""})
        self.threads[tid] = t
        return t

    def get_thread(self, thread_id: str) -> Thread | None:
        return self.threads.get(thread_id)

    def list_items(self, thread_id: str, **kw: Any) -> list[Any]:
        return self.items.get(thread_id, [])

    def list_threads(self, *, limit: int = 50, offset: int = 0,
                     include_archived: bool = False, owner_user_id: str | None = None) -> ThreadPage:
        rows = [t for t in self.threads.values()
                if owner_user_id is None or t.metadata.get("userId") == owner_user_id]
        return ThreadPage(threads=rows[:limit], total=len(rows), limit=limit)


@pytest.fixture()
def store() -> FakeStore:
    s = FakeStore()
    s.add_thread("th-mine", owner="u1")
    s.add_thread("th-other", owner="u2")
    s.add_thread("th-mine2", owner="u1", title="second")
    s.items["th-mine"] = [
        UserMessageItem(content="hi"),
        CompactionBoundaryItem(summary="s", tokens_before=10, tokens_after=2),
    ]
    return s


def _call(store: FakeStore, method: str, params: dict[str, Any] | None = None, *, rid: Any = 1,
          user: str = "u1") -> dict[str, Any]:
    out = handle_acp_payload(
        {"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}},
        store=store,
        user_id=user,
    )
    assert isinstance(out, dict)
    return out


def test_initialize_capabilities(store: FakeStore) -> None:
    res = _call(store, "initialize", {"protocolVersion": 1})["result"]
    assert res["protocolVersion"] == 1
    assert res["agentCapabilities"]["loadSession"] is True
    assert res["agentCapabilities"]["promptCapabilities"]["embeddedContext"] is True
    assert res["clientProtocolVersion"] == 1


def test_authenticate_is_noop(store: FakeStore) -> None:
    assert _call(store, "authenticate", {})["result"] == {}


def test_session_new_identity_from_layer_not_body(store: FakeStore) -> None:
    out = _call(store, "session/new", {"title": "x", "_meta": {"userId": "u2"}}, user="u1")
    sid = out["result"]["sessionId"]
    assert store.created_calls[0]["user_id"] == "u1"
    assert store.threads[sid].metadata["userId"] == "u1"


def test_session_load_owner_ok_vs_foreign(store: FakeStore) -> None:
    ok = _call(store, "session/load", {"sessionId": "th-mine"}, user="u1")
    assert ok["result"]["itemCount"] == 2
    assert [i["itemType"] for i in ok["result"]["items"]] == ["user_message", "compaction_boundary"]
    foreign = _call(store, "session/load", {"sessionId": "th-other"}, user="u1")
    missing = _call(store, "session/load", {"sessionId": "nope"}, user="u1")
    # 同一句形态(前缀一致),只有 id 不同 —— 不新造「存在但不能给你」的可分辨信号
    assert foreign["error"]["message"].startswith(missing["error"]["message"].split(":")[0])
    assert foreign["error"]["code"] == missing["error"]["code"]


def test_session_list_scoped(store: FakeStore) -> None:
    res = _call(store, "session/list", {}, user="u1")["result"]
    ids = {s["sessionId"] for s in res["sessions"]}
    assert ids == {"th-mine", "th-mine2"}
    assert res["total"] == 2


def test_prompt_is_explicitly_unsupported(store: FakeStore) -> None:
    out = _call(store, "session/prompt", {"sessionId": "th-mine"})
    assert out["error"]["code"] == UNSUPPORTED_STREAMING
    assert "event-stream" in out["error"]["data"]["hint"]


def test_method_not_found_and_bad_envelope(store: FakeStore) -> None:
    assert _call(store, "session/whatever")["error"]["code"] == METHOD_NOT_FOUND
    bad = handle_acp_payload({"id": 7, "method": "initialize"}, store=store, user_id="u1")
    assert isinstance(bad, dict) and bad["error"]["code"] == INVALID_REQUEST
    assert bad["id"] == 7


def test_batch_and_limits(store: FakeStore) -> None:
    batch = handle_acp_payload(
        [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
            {"jsonrpc": "2.0", "id": 2, "method": "authenticate", "params": {}},
        ],
        store=store,
        user_id="u1",
    )
    assert isinstance(batch, list) and len(batch) == 2
    empty = handle_acp_payload([], store=store, user_id="u1")
    assert isinstance(empty, dict) and empty["error"]["code"] == INVALID_REQUEST
    too_many = handle_acp_payload(
        [{"jsonrpc": "2.0", "id": i, "method": "authenticate"} for i in range(ACP_MAX_BATCH + 1)],
        store=store,
        user_id="u1",
    )
    assert isinstance(too_many, dict) and too_many["error"]["code"] == INVALID_REQUEST
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

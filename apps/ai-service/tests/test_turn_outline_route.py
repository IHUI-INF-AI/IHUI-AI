# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""turn outline 路由层契约:属主闸、条目投影、显式截断。"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers.sessions import thread_outline
from app.services.session_store import (
    AgentMessageItem,
    Thread,
    ToolCallItem,
    Turn,
    UserMessageItem,
)


class _Store:
    def __init__(self, thread: Thread, turns: list[Turn], items: list) -> None:
        self._thread = thread
        self._turns = turns
        self._items = items

    def get_thread(self, thread_id: str):
        return self._thread if thread_id == self._thread.thread_id else None

    def list_turns(self, thread_id: str, status=None):
        return list(self._turns)

    def list_items(self, thread_id: str):
        return list(self._items)


def _fixture(turns_count: int = 2):
    thread = Thread(thread_id="t1", metadata={"userId": "u1"})
    turns = [
        Turn(
            turn_id=f"turn{i}",
            thread_id="t1",
            turn_seq=i,
            status="completed",
            started_at=100.0,
            ended_at=101.0,
        )
        for i in range(1, turns_count + 1)
    ]
    items = [
        UserMessageItem(seq=1, thread_id="t1", turn_id="turn1", content="第一轮做什么"),
        ToolCallItem(
            seq=2,
            thread_id="t1",
            turn_id="turn1",
            call_id="c1",
            tool="read_file",
            arguments={"path": "a.py"},
        ),
        AgentMessageItem(seq=3, thread_id="t1", turn_id="turn1", content="做完了"),
        UserMessageItem(seq=4, thread_id="t1", turn_id="turn2", content="第二轮继续"),
    ]
    return thread, turns, items


def test_outline_route_projects_turns_and_counts():
    thread, turns, items = _fixture()
    store = _Store(thread, turns, items)

    response = thread_outline("t1", limit=100, user_id="u1", store=store)

    data = response["data"]
    assert data["threadId"] == "t1"
    assert data["total"] == 2
    assert data["truncated"] is False
    assert [entry["intent"] for entry in data["turns"]] == ["第一轮做什么", "第二轮继续"]
    assert data["turns"][0]["toolCalls"] == 1
    assert data["turns"][0]["agentMessages"] == 1
    assert data["turns"][1]["toolCalls"] == 0


def test_outline_route_truncates_last_n_and_declares_it():
    thread, turns, items = _fixture(3)
    store = _Store(thread, turns, items)

    data = thread_outline("t1", limit=2, user_id="u1", store=store)["data"]

    assert data["total"] == 3
    assert data["limit"] == 2
    assert data["truncated"] is True
    assert [entry["turnId"] for entry in data["turns"]] == ["turn2", "turn3"]


def test_outline_route_hides_foreign_thread_as_404():
    thread, turns, items = _fixture()
    store = _Store(thread, turns, items)

    with pytest.raises(HTTPException) as exc:
        thread_outline("t1", limit=100, user_id="intruder", store=store)
    assert exc.value.status_code == 404
    assert "t1" in str(exc.value.detail)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-94 残余②:v2 通道(thread.prompt / thread.interrupt)取消后是否落库。

判据只钉既有的两条事实,不改产品语义:
- 取消后 turn 落库为 failed,正文 = 循环递出的半截快照,G-94 的"显式落库"在 v2 腿成立;
- AgentMessageItem 没有 metadata 槽,中断标注在 v2 腿无容器可挂 —— 这是本票未闭环的
  那一格,写入这里防止日后有人以为"标注已经有了"。
"""

from __future__ import annotations

import os
import sys
from typing import Any

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.agent_engine import AgentEngine
from app.services.session_store import (
    AgentMessageItem,
    ErrorItem,
    SessionStore,
    UserMessageItem,
)

PARTIAL = "半截回答,已经到达本进程"


class _InterruptedResult:
    """_LoopInterrupted 归一后的形态(agent_loop_v2 的同名字段)。"""

    success = False
    stop_reason = "cancelled"
    final_response = PARTIAL
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 7
    checkpoint_id = None
    error = "用户取消(iteration 0,循环内中断)"
    budget = None
    compaction_events: list[Any] = []


class _Loop:
    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return _InterruptedResult()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        raise AssertionError("本用例不走续跑")

    async def cancel(self) -> Any:
        return "ckp_cancel"

    async def pause(self) -> Any:
        return "ckp_pause"


def _engine(tmp_path):
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _Loop:
        return _Loop()

    store = SessionStore(str(tmp_path / "g94.db"))
    return AgentEngine(loop_factory=factory, store=store), store


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


@pytest.mark.asyncio
async def test_v2_cancel_path_persists_partial_assistant_turn(tmp_path):
    engine, store = _engine(tmp_path)
    tid = (await _rpc(engine, "thread.start", {}))["threadId"]

    result = await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "写点什么"}, req_id=2)

    assert result["success"] is False
    assert result["stopReason"] == "cancelled"
    assert result["finalResponse"] == PARTIAL

    turns = store.list_turns(tid)
    assert len(turns) == 1
    turn = turns[0]
    # 既有语义:中断走 end_turn(status="failed"),账上不区分"用户取消"与"引擎失败"。
    # 取消原因不进 turn.error(_persist_turn_end 只改状态),只落在 ErrorItem.code 上。
    assert turn.status == "failed"
    assert turn.error is None

    items = store.list_items(tid)
    assert [i.item_type for i in items] == ["user_message", "agent_message", "error"]
    user = items[0]
    agent = items[1]
    err = items[2]
    assert isinstance(user, UserMessageItem) and user.content == "写点什么"
    assert isinstance(agent, AgentMessageItem)
    assert agent.content == PARTIAL
    assert isinstance(err, ErrorItem)
    assert err.code == "cancelled"
    # 残余②:中断标注在 v2 腿没有容器 —— AgentMessageItem 的字段集 = 信封 + content/model,
    # 既无 metadata 也无 interrupted。
    from app.services.session_store import ITEM_ENVELOPE_FIELDS

    assert set(type(agent).model_fields) == set(ITEM_ENVELOPE_FIELDS) | {"content", "model"}


@pytest.mark.asyncio
async def test_v2_cancel_with_zero_text_writes_no_empty_assistant(tmp_path):
    engine, store = _engine(tmp_path)
    empty = _InterruptedResult()
    empty.final_response = ""

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
        class _Empty(_Loop):
            async def run(self, messages: list[dict[str, Any]]) -> Any:
                return empty

        return _Empty()

    engine._loop_factory = factory
    tid = (await _rpc(engine, "thread.start", {}))["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "随便"}, req_id=2)

    kinds = [i.item_type for i in store.list_items(tid)]
    # 票面②的 v2 对应:零字符取消不得落空 assistant 气泡
    assert kinds == ["user_message", "error"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

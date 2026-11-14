# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""round 8 生产接线验收:AgentCheckpointManager.restore 的前置一致性闸(2026-11-14 立)。

钉住两件事:
1. **显式 opt-in**:判据装进真跑它的那条链(§0.9「造好没装车 = 没有」),但只在
   调用方随 checkpoint.metadata 显式写入 `revert_check_inputs` 三面输入时启用;
   启用后一律 fail-closed(§0.3),缺面判 `unjudged` 并点名原因,绝不编造、
   绝不静默覆盖在途改动。
2. **不破坏旧契约**:未 opt-in 时既有调用方(`routers/checkpoint_rewind.py` 的
   restore / impact 预览端点、`tests/test_checkpoint_rewind.py` 既有用例)直调
   `restore` 仍拿到原会话快照。无条件启用曾实测 9 例回归(`KeyError: 'messages'`),
   本文件钉住这一回归不再发生,并断言此时结果里**没有** verdict —— 没判绝不写成判过。

反向变异:把 restore 里 opt-in 分支的阻断语句临时禁用,负例必须转红;恢复后复绿
—— 证明测试真的绑在生产接线上,而不是自说自话。
"""

from __future__ import annotations

import asyncio
from copy import deepcopy

import pytest

from app.core.revert_check import REVERT_CHECK_CRITERION, RevertVerdict
from app.services.agent_checkpoint import AgentCheckpointManager

ON: dict[str, object] = {"enabled": True}
SNAP: dict[str, object] = {"files": {"a.txt": "A", "b.txt": "B"}}
SAME: dict[str, object] = {"files": {"a.txt": "A", "b.txt": "B"}}
DIVERGED: dict[str, object] = {"files": {"a.txt": "A2", "b.txt": "B"}}  # 在途改动
BAD_SHAPE: dict[str, object] = {"files": ["a.txt", "b.txt"]}  # files 不是映射


def _inputs(snapshot: object, workspace: object, policy: object) -> dict[str, object]:
    return {
        "target_snapshot": snapshot,
        "current_workspace": workspace,
        "policy": policy,
    }


@pytest.fixture
def manager(monkeypatch):
    """纯内存 manager + 关掉归位对账(避免 load 顺手改 status 干扰「状态未被改写」断言)。"""
    monkeypatch.setenv("IHUI_CHECKPOINT_RECONCILE", "0")
    return AgentCheckpointManager(max_in_memory=10, ttl_seconds=100_000)


async def _save(manager: AgentCheckpointManager, inputs: dict[str, object] | None) -> str:
    metadata = {} if inputs is None else {"revert_check_inputs": inputs}
    return await manager.save_checkpoint(
        session_id="s1",
        iteration=1,
        messages=[{"role": "user", "content": "in-flight"}],
        tool_state={"marker": "original"},
        status="running",
        metadata=metadata,
    )


async def _save_and_restore(manager, inputs):
    cid = await _save(manager, inputs)
    return cid, await manager.restore("s1", cid)


def test_consistent_allows_original_restore(manager):
    """一致 ⇒ 原逻辑照常放行:返回会话快照(含 messages),不是阻断 verdict。"""
    cid, result = asyncio.run(_save_and_restore(manager, _inputs(SNAP, SAME, ON)))
    assert result["checkpoint_id"] == cid
    assert result["messages"] == [{"role": "user", "content": "in-flight"}]
    assert result["restored_message_count"] == 1
    assert "verdict" not in result
    assert result.get("allow") is not False


def test_diverged_blocks_restore(manager):
    """差异 ⇒ 阻断:返回结构化 verdict(allow=False + reason),绝不交出快照覆盖在途改动。"""
    _, result = asyncio.run(_save_and_restore(manager, _inputs(SNAP, DIVERGED, ON)))
    assert result.get("allow") is False
    assert result.get("verdict") == RevertVerdict.DIVERGED.value
    assert result.get("judged") is True
    assert "不一致" in str(result.get("reason", ""))
    assert result.get("diff", {}).get("changed") == ["a.txt"]
    assert "messages" not in result


def test_unjudged_shape_blocks_restore(manager):
    """形状不认 ⇒ unjudged 阻断(§0.3 没判绝不写成判过)。"""
    _, result = asyncio.run(_save_and_restore(manager, _inputs(SNAP, BAD_SHAPE, ON)))
    assert result.get("allow") is False
    assert result.get("verdict") == RevertVerdict.UNJUDGED.value
    assert result.get("judged") is False
    assert "形状不认" in str(result.get("reason", ""))
    assert "messages" not in result


def test_no_optin_keeps_legacy_restore_contract(manager):
    """未显式 opt-in ⇒ 判据本轮**没有跑**,既有 restore 契约一字不变(防 9 例回归)。

    既有调用方不带三面输入直调 restore;若闸无条件启用,它们全被判成 unjudged
    阻断。本例断言仍拿到原会话快照,且结果里**没有** verdict(§0.3 没判不写判过)。
    """
    cid, result = asyncio.run(_save_and_restore(manager, None))
    assert result["checkpoint_id"] == cid
    assert result["messages"] == [{"role": "user", "content": "in-flight"}]
    assert "verdict" not in result
    assert result.get("allow") is not False


def test_optin_with_missing_fields_blocks_restore(manager):
    """显式 opt-in 但三面输入残缺 ⇒ 不编造 ⇒ unjudged 阻断并点名原因(§0.3)。

    这是灰度接入后仍保持严格的一轴:只要调用方声明了要用闸,就别想靠半份输入
    混过一致性校验。
    """
    _, result = asyncio.run(_save_and_restore(manager, {"target_snapshot": SNAP}))
    assert result.get("allow") is False
    assert result.get("verdict") == RevertVerdict.UNJUDGED.value
    assert result.get("judged") is False
    assert str(result.get("reason", ""))
    assert "messages" not in result


def test_blocked_restore_does_not_mutate_state(manager):
    """阻断时原状态未被改写:checkpoint 的 messages/tool_state/metadata/status 全不变,
    且没有新增或删除任何 checkpoint(绝不静默覆盖在途改动)。"""

    async def scenario():
        cid = await _save(manager, _inputs(SNAP, DIVERGED, ON))
        cp = manager._checkpoints[cid]
        before = (
            deepcopy(cp.messages),
            deepcopy(cp.tool_state),
            deepcopy(cp.metadata),
            cp.status,
            dict(manager._checkpoints),
        )
        result = await manager.restore("s1", cid)
        return cid, before, result

    cid, before, result = asyncio.run(scenario())
    assert result.get("allow") is False
    cp = manager._checkpoints[cid]
    assert deepcopy(cp.messages) == before[0]
    assert deepcopy(cp.tool_state) == before[1]
    assert deepcopy(cp.metadata) == before[2]
    assert cp.status == before[3]
    assert dict(manager._checkpoints) == before[4]
    assert "messages" not in result


def test_verdict_from_single_source(manager):
    """反向:阻断 verdict 带判据来源与完整可审计字段,证明接线没有自造第二份判据(§0.6)。"""
    _, result = asyncio.run(_save_and_restore(manager, _inputs(SNAP, DIVERGED, ON)))
    assert result.get("criterion") == REVERT_CHECK_CRITERION
    assert set(result) == {"verdict", "judged", "allow", "reason", "criterion", "diff"}
    assert set(result.get("diff", {})) == {"changed", "added", "removed"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

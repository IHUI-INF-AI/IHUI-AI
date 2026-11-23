# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B3-07 patches 增量编辑契约。"""

from __future__ import annotations

from app.services.chat_patch import (
    ChatPatch,
    ChatPatchList,
    PatchAction,
    apply_chat_patches,
    apply_patch_map,
)


def _patch(**kw):
    return ChatPatch(**kw)


def test_add_update_rename_delete_in_one_pass():
    items = [{"cache_id": "m1", "role": "user", "content": "hi"}]
    patches = [
        _patch(cache_id="m2", action=PatchAction.ADD, position=1, content={"role": "assistant", "content": "yo"}),
        _patch(cache_id="m1", action=PatchAction.UPDATE, content={"content": "hello"}),
        _patch(cache_id="m2", action=PatchAction.RENAME, rename_to="m2-renamed"),
        _patch(cache_id="m1", action=PatchAction.DELETE),
    ]
    result = apply_chat_patches(items, patches)
    assert result.ok is True
    assert result.changed == ["m2", "m1", "m2", "m1"]
    assert result.items == [
        {"cache_id": "m2", "role": "assistant", "content": "yo", "name": "m2-renamed"}
    ]
    # 原列表不被就地修改
    assert items[0]["content"] == "hi"


def test_duplicate_add_rejected_and_state_unchanged():
    items = [{"cache_id": "m1"}]
    result = apply_chat_patches(
        items, [_patch(cache_id="m1", action=PatchAction.ADD)]
    )
    assert result.ok is False
    assert result.error_code == "PATCH_CACHE_ID_DUPLICATE"
    assert result.items == items


def test_missing_target_rejected():
    result = apply_chat_patches(
        [{"cache_id": "m1"}],
        [_patch(cache_id="ghost", action=PatchAction.UPDATE, content={"x": 1})],
    )
    assert result.ok is False
    assert result.error_code == "PATCH_TARGET_MISSING"


def test_rename_conflict_rejected():
    result = apply_chat_patches(
        [{"cache_id": "m1", "name": "a"}, {"cache_id": "m2", "name": "b"}],
        [_patch(cache_id="m1", action=PatchAction.RENAME, rename_to="b")],
    )
    assert result.ok is False
    assert result.error_code == "PATCH_RENAME_CONFLICT"


def test_rename_requires_target_name():
    result = apply_chat_patches(
        [{"cache_id": "m1", "name": "a"}],
        [_patch(cache_id="m1", action=PatchAction.RENAME)],
    )
    assert result.ok is False
    assert result.error_code == "PATCH_RENAME_TARGET_REQUIRED"


def test_position_out_of_range_rejected():
    result = apply_chat_patches(
        [],
        [_patch(cache_id="m1", action=PatchAction.ADD, position=5)],
    )
    assert result.ok is False
    assert result.error_code == "PATCH_POSITION_OUT_OF_RANGE"


def test_patch_map_is_atomic_across_channels():
    state = {
        "messages": [{"cache_id": "m1", "content": "a"}],
        "tools": [{"cache_id": "t1", "name": "read"}],
    }
    patch_map = {
        "messages": ChatPatchList(
            patches=[_patch(cache_id="m1", action=PatchAction.UPDATE, content={"content": "b"})]
        ),
        "tools": ChatPatchList(
            patches=[_patch(cache_id="ghost", action=PatchAction.DELETE)]
        ),
    }
    next_state, results = apply_patch_map(state, patch_map)
    assert results["messages"].ok is True
    assert results["tools"].ok is False
    # 工具通道失败 ⇒ 消息通道的改动也不落地
    assert next_state["messages"][0]["content"] == "a"
    assert state["messages"][0]["content"] == "a"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

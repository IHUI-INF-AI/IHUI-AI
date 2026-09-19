# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 批41水印占位
# 批 41 实战接线测试 — 审批缓存键规范化接线 + 回合 diff 跟踪器接线
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import pytest

from app.core.command_canonicalization import canonicalize_command_for_approval


def test_canonical_key_same_for_shell_wrapped():
    """同一命令不同 shell 包装 → 同一审批键(免二次弹窗)。"""
    from app.services.mcp_server import (
        _canonical_approval_key,
        approve_exec_command,
        _consume_exec_approval,
    )

    direct = "git status"
    wrapped = "bash -lc 'git status'"
    k1 = _canonical_approval_key(direct)
    k2 = _canonical_approval_key(wrapped)
    assert k1 == k2, f"键不一致: {k1!r} vs {k2!r}"
    # 登记 wrapped 形态 → 直接形态命中
    approve_exec_command(wrapped)
    assert _consume_exec_approval(direct) is True
    # 消费后不再命中
    assert _consume_exec_approval(direct) is False


def test_canonical_complex_scripts_not_cross_matched():
    """复杂脚本间不误互相命中(固定前缀形态)。"""
    from app.services.mcp_server import (
        approve_exec_command,
        _consume_exec_approval,
    )

    a = "bash -lc 'echo hi && rm -rf /tmp/x'"
    b = "bash -lc 'echo other && rm -rf /tmp/y'"
    approve_exec_command(a)
    assert _consume_exec_approval(a) is True
    assert _consume_exec_approval(b) is False


def test_prefix_rule_via_canonical():
    """前缀规则:包装形态登记,直接形态命中(键空间一致)。"""
    from app.services.mcp_server import (
        approve_exec_prefix,
        _matches_exec_prefix,
        revoke_exec_prefix,
    )

    prefix = approve_exec_prefix("bash -lc 'git push origin main'")
    assert prefix is not None
    try:
        assert _matches_exec_prefix("git push origin main") is True
        assert _matches_exec_prefix("git status") is False
    finally:
        assert revoke_exec_prefix(list(prefix)) is True


def test_empty_and_degenerate_inputs():
    """空命令/退化输入不抛、不放松。"""
    from app.services.mcp_server import _canonical_approval_key

    assert _canonical_approval_key("") == ""
    assert isinstance(_canonical_approval_key("ls"), str)


def test_turn_diff_tracker_wiring():
    """turn_diff_tracker:补丁累计净 diff,invalidate 后拒绝渲染(接线冒烟)。"""
    from app.core.turn_diff_tracker import FileChange, PatchDelta, TurnDiffTracker

    tracker = TurnDiffTracker()
    # 新建文件补丁
    tracker.track_delta(
        PatchDelta(
            environment_id="workspace",
            changes=[FileChange(kind="add", path="a.txt", content="line1\nline2\n")],
            exact=True,
        )
    )
    diff = tracker.get_unified_diff()
    assert diff is not None and "a.txt" in diff
    assert tracker.valid is True
    # 非精确变更 → 整体失效
    tracker.invalidate()
    assert tracker.valid is False
    assert tracker.get_unified_diff() is None


def test_engine_thread_has_tracker_field():
    """EngineThread 带 turn_diff_tracker 字段(默认 None,批 41 接线)。"""
    from dataclasses import fields

    from app.services.agent_engine import EngineThread

    names = {f.name for f in fields(EngineThread)}
    assert "turn_diff_tracker" in names
    assert EngineThread.__dataclass_fields__["turn_diff_tracker"].default is None

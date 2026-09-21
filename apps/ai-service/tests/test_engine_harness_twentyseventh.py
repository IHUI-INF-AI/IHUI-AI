# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/turn_diff_tracker.py + rollout_truncation.py +
# installation_id.py + network_policy_decision.py 第二十七批测试。

import tempfile
import uuid
from pathlib import Path

import pytest

from app.core.installation_id import INSTALLATION_ID_FILENAME, resolve_installation_id
from app.core.network_policy_decision import (
    denied_network_policy_message,
    parse_network_decision,
    should_surface_as_ask,
)
from app.core.rollout_truncation import (
    RollbackMarker,
    fork_turn_positions,
    has_prior_user_turns,
    truncate_after_turn_id,
    truncate_before_nth_user_message,
    truncate_to_last_n_fork_turns,
    user_message_positions,
)
from app.core.turn_diff_tracker import (
    ZERO_OID,
    FileChange,
    PatchDelta,
    TurnDiffTracker,
    git_blob_oid,
)


def _is_user_msg(item):
    return isinstance(item, str) and item.startswith("user:")


# ======================================================================
# turn_diff_tracker
# ======================================================================
class TestTurnDiffTracker:
    def test_git_blob_oid_matches_git_hash_object(self):
        # 与 git hash-object 算法一致:sha1("blob <len>\0" + content)
        assert git_blob_oid("") == "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
        assert git_blob_oid("hello\n") == "ce013625030ba8dba906f756967f9e9ca394464a"

    def test_add_then_get_diff_new_file(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="add", path="/ws/a.txt", content="line1\n")],
            )
        )
        diff = t.get_unified_diff()
        assert diff is not None
        assert "diff --git a/ws/a.txt b/ws/a.txt" in diff
        assert "new file mode 100644" in diff
        assert diff.index(ZERO_OID) < diff.index("..")
        assert "+line1" in diff
        assert "--- /dev/null" in diff

    def test_update_existing_file(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[
                    FileChange(
                        kind="update",
                        path="/ws/a.txt",
                        old_content="old\n",
                        content="new\n",
                    )
                ],
            )
        )
        diff = t.get_unified_diff()
        assert "-old" in diff and "+new" in diff
        assert "new file mode" not in diff

    def test_delete_file(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="delete", path="/ws/a.txt", content="x\n")],
            )
        )
        diff = t.get_unified_diff()
        assert "deleted file mode 100644" in diff
        assert "+++ /dev/null" in diff

    def test_add_overwrites_baseline(self):
        # add 覆盖了已存在文件(带 overwritten_content)→ 净 diff 是"修改"不是"新增"
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[
                    FileChange(
                        kind="add",
                        path="/ws/a.txt",
                        content="new\n",
                        overwritten_content="old\n",
                    )
                ],
            )
        )
        diff = t.get_unified_diff()
        assert "new file mode" not in diff
        assert "-old" in diff and "+new" in diff

    def test_create_then_delete_is_net_zero(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[
                    FileChange(kind="add", path="/ws/tmp.txt", content="temp\n"),
                    FileChange(kind="delete", path="/ws/tmp.txt", content="temp\n"),
                ],
            )
        )
        assert t.get_unified_diff() is None
        assert not t.has_unified_diff()

    def test_rename_renders_single_git_diff(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[
                    FileChange(
                        kind="update",
                        path="/ws/old.txt",
                        old_content="data\n",
                        move_path="/ws/new.txt",
                        content="data2\n",
                    )
                ],
            )
        )
        diff = t.get_unified_diff()
        assert diff is not None
        assert "diff --git a/ws/old.txt b/ws/new.txt" in diff
        # 不应出现对 new.txt 的独立"新增文件"段
        assert diff.count("diff --git") == 1

    def test_inexact_delta_invalidates_everything(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="add", path="/ws/a.txt", content="x")],
            )
        )
        t.track_delta(PatchDelta(environment_id="", changes=[], exact=False))
        assert not t.valid
        assert t.get_unified_diff() is None
        # 失效后继续 no-op
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="add", path="/ws/b.txt", content="y")],
            )
        )
        assert t.get_unified_diff() is None

    def test_no_change_no_diff(self):
        t = TurnDiffTracker()
        t.track_delta(PatchDelta(environment_id="", changes=[]))
        assert t.get_unified_diff() is None

    def test_display_root_relative_and_multi_env_prefix(self):
        t = TurnDiffTracker(display_roots={"env1": "/ws"})
        t.track_delta(
            PatchDelta(
                environment_id="env1",
                changes=[FileChange(kind="add", path="/ws/sub/a.txt", content="x")],
            )
        )
        assert "a/sub/a.txt" in t.get_unified_diff()

        t2 = TurnDiffTracker(display_roots={"e1": "/ws1", "e2": "/ws2"})
        t2.track_delta(
            PatchDelta(
                environment_id="e1",
                changes=[FileChange(kind="add", path="/ws1/a.txt", content="x")],
            )
        )
        t2.track_delta(
            PatchDelta(
                environment_id="e2",
                changes=[FileChange(kind="add", path="/ws2/b.txt", content="y")],
            )
        )
        diff = t2.get_unified_diff()
        assert "e1/a.txt" in diff
        assert "e2/b.txt" in diff

    def test_windows_path_normalized(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="add", path="C:\\ws\\a.txt", content="x")],
            )
        )
        assert "diff --git a/C:/ws/a.txt" in t.get_unified_diff()

    def test_revision_cache_no_change_after_retrack(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="add", path="/ws/a.txt", content="x\n")],
            )
        )
        d1 = t.get_unified_diff()
        # 同内容重复提交 → diff 稳定
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="add", path="/ws/a.txt", content="x\n")],
            )
        )
        assert t.get_unified_diff() == d1

    def test_unknown_change_kind_invalidates(self):
        t = TurnDiffTracker()
        t.track_delta(
            PatchDelta(
                environment_id="",
                changes=[FileChange(kind="mystery", path="/ws/a.txt")],
            )
        )
        assert not t.valid


# ======================================================================
# rollout_truncation
# ======================================================================
def _mk_items():
    return [
        "user:first",       # 0
        "assistant:a1",     # 1
        "user:second",      # 2
        "assistant:a2",     # 3
        "user:third",       # 4
    ]


class TestRolloutTruncation:
    def test_user_positions(self):
        assert user_message_positions(_mk_items(), _is_user_msg) == [0, 2, 4]

    def test_rollback_marker_shrinks_positions(self):
        items = _mk_items() + [RollbackMarker(num_turns=2)]
        # 回滚最近 2 个用户回合 → 只剩第一个
        assert user_message_positions(items, _is_user_msg) == [0]

    def test_rollback_more_than_exists(self):
        items = ["user:a", RollbackMarker(num_turns=99)]
        assert user_message_positions(items, _is_user_msg) == []

    def test_truncate_before_nth(self):
        items = _mk_items()
        out = truncate_before_nth_user_message(items, 1, _is_user_msg)
        assert out == items[:2]  # 严格早于第 2 个用户消息(保留其前所有项)
        out0 = truncate_before_nth_user_message(items, 0, _is_user_msg)
        assert out0 == []  # 不含第一个用户消息本身
        # 不足 n → 原样
        assert truncate_before_nth_user_message(items, 5, _is_user_msg) == items

    def test_fork_positions_with_trigger_turn(self):
        items = [
            "user:a",
            "assistant:plain",
            "assistant:trigger",  # trigger_turn 代理消息
            "user:b",
        ]
        def is_trigger(it):
            return it == "assistant:trigger"
        pos = fork_turn_positions(items, _is_user_msg, is_trigger)
        assert pos == [0, 2, 3]

    def test_fork_positions_rollback_by_instruction_turns(self):
        items = [
            "user:a",              # 边界 0
            "assistant:trigger",   # 边界 1 (trigger)
            "user:b",              # 边界 2
            RollbackMarker(num_turns=2),  # 回滚最近 2 个指令回合 → 移除边界 1、2
            "user:c",              # 边界 3
        ]
        def is_trigger(it):
            return it == "assistant:trigger"
        pos = fork_turn_positions(items, _is_user_msg, is_trigger)
        # 边界 0(最早被回滚的指令回合边界)之后的 fork 全部失效;
        # "user:c" 位于下标 4,正常成为新边界
        assert pos == [0, 4]

    def test_truncate_to_last_n_fork_turns(self):
        items = _mk_items()
        out = truncate_to_last_n_fork_turns(items, 2, _is_user_msg)
        assert out == items[2:]
        out1 = truncate_to_last_n_fork_turns(items, 1, _is_user_msg)
        assert out1 == items[4:]
        assert truncate_to_last_n_fork_turns(items, 0, _is_user_msg) == []
        # 不足 n → 从首个边界起保留
        outbig = truncate_to_last_n_fork_turns(items, 99, _is_user_msg)
        assert outbig == items

    def test_has_prior_user_turns(self):
        assert has_prior_user_turns(_mk_items(), _is_user_msg) is True
        assert has_prior_user_turns(["assistant:x"], _is_user_msg) is False
        assert has_prior_user_turns([], _is_user_msg) is False

    def test_truncate_after_turn_id(self):
        def turn_of(item):
            if isinstance(item, tuple):
                return item[1]
            return None

        items = [
            ("start", "t1"),
            "assistant:work",
            ("start", "t2"),
            "assistant:more",
        ]
        out = truncate_after_turn_id(items, "t1", turn_of)
        assert out == items[:2]
        out_full = truncate_after_turn_id(items, "t2", turn_of)
        assert out_full == items
        with pytest.raises(ValueError):
            truncate_after_turn_id(items, "nope", turn_of)
        with pytest.raises(ValueError):
            truncate_after_turn_id(
                items, "t1", turn_of, turn_status=lambda t: "in_progress"
            )


# ======================================================================
# installation_id
# ======================================================================
class TestInstallationId:
    def test_generates_and_persists(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            iid = resolve_installation_id(base)
            assert uuid.UUID(iid)  # 合法 UUID
            assert (base / INSTALLATION_ID_FILENAME).read_text().strip() == iid

    def test_reuses_existing_case_insensitive(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            existing = str(uuid.uuid4()).upper()
            (base / INSTALLATION_ID_FILENAME).write_text(existing)
            got = resolve_installation_id(base)
            assert got == existing.lower()

    def test_rewrites_invalid_content(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            (base / INSTALLATION_ID_FILENAME).write_text("not-a-uuid")
            got = resolve_installation_id(base)
            assert uuid.UUID(got)
            assert (base / INSTALLATION_ID_FILENAME).read_text().strip() == got

    def test_idempotent_across_calls(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            a = resolve_installation_id(base)
            b = resolve_installation_id(base)
            assert a == b

    def test_creates_missing_directory(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d) / "nested" / "deep"
            iid = resolve_installation_id(base)
            assert uuid.UUID(iid)
            assert (base / INSTALLATION_ID_FILENAME).exists()


# ======================================================================
# network_policy_decision
# ======================================================================
class TestNetworkPolicyDecision:
    def test_parse_decision_whitelist(self):
        assert parse_network_decision("deny") == "deny"
        assert parse_network_decision("ask") == "ask"
        assert parse_network_decision("allow") is None  # 未知/未列值安全返回 None
        assert parse_network_decision(None) is None
        assert parse_network_decision("") is None

    def test_denied_message_with_host(self):
        msg = denied_network_policy_message("denied", " evil.example.com ")
        assert 'Network access to "evil.example.com" was blocked' in msg
        assert "explicitly denied" in msg
        assert "cannot be approved from this prompt" in msg

    def test_denied_message_reason_variants(self):
        assert "allowlist" in denied_network_policy_message("not_allowed", "h")
        assert "local/private" in denied_network_policy_message("not_allowed_local", "127.0.0.1")
        assert "request method" in denied_network_policy_message("method_not_allowed", "h")
        assert "proxy is disabled" in denied_network_policy_message("proxy_disabled", "h")
        assert "blocked by network policy" in denied_network_policy_message("mystery", "h")

    def test_denied_message_without_host(self):
        assert denied_network_policy_message("denied", "") == "Network access was blocked by policy."
        assert denied_network_policy_message("denied", None).startswith("Network access")

    def test_should_surface_as_ask(self):
        assert should_surface_as_ask("ask", True) is True
        assert should_surface_as_ask("ask", False) is False
        assert should_surface_as_ask("deny", True) is False
        assert should_surface_as_ask(None, True) is False

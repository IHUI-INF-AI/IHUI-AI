# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""team_task_board 单测 — 钉住共享任务板 revision CAS、授权、8 action、依赖图、writeScope。"""

from __future__ import annotations

import pytest

from app.services.team_task_board import (
    TeamError,
    TeamState,
    TeamTaskBoard,
    UpdateRequest,
    project_task_view,
    required_text,
    write_scope,
)


def _enabled_board(max_tasks: int = 200) -> TeamTaskBoard:
    return TeamTaskBoard(TeamState(id="root-1", enabled=True), max_tasks=max_tasks)


def _rev(board: TeamTaskBoard, task_id: str) -> int:
    return board.get(task_id).revision


# ── 启用门 ─────────────────────────────────────────────────────────────────


class TestEnabled:
    def test_disabled_raises(self) -> None:
        board = TeamTaskBoard(TeamState(id="root-1", enabled=False))
        with pytest.raises(TeamError) as ei:
            board.create(subject="s", description="d")
        assert ei.value.code == "TEAM_DISABLED"


# ── create ─────────────────────────────────────────────────────────────────


class TestCreate:
    def test_create_basic(self) -> None:
        board = _enabled_board()
        v = board.create(subject="修 bug", description="详细描述")
        assert v.id == "task-1"
        assert v.revision == 1
        assert v.status == "pending"
        assert v.owner_id is None
        assert v.ready is True

    def test_subject_required(self) -> None:
        board = _enabled_board()
        with pytest.raises(TeamError) as ei:
            board.create(subject="   ", description="d")
        assert ei.value.code == "TEAM_INVALID_ARGUMENT"

    def test_subject_too_long(self) -> None:
        board = _enabled_board()
        with pytest.raises(TeamError):
            board.create(subject="x" * 201, description="d")

    def test_description_too_long(self) -> None:
        board = _enabled_board()
        with pytest.raises(TeamError):
            board.create(subject="s", description="d" * 16385)

    def test_limit(self) -> None:
        board = _enabled_board(max_tasks=1)
        board.create(subject="a", description="d")
        with pytest.raises(TeamError) as ei:
            board.create(subject="b", description="d")
        assert ei.value.code == "TEAM_TASK_LIMIT"

    def test_id_increments(self) -> None:
        board = _enabled_board()
        assert board.create(subject="a", description="d").id == "task-1"
        assert board.create(subject="b", description="d").id == "task-2"


# ── required_text / write_scope ────────────────────────────────────────────


class TestValidation:
    def test_required_text_ok(self) -> None:
        assert required_text("  hi  ", "f", 10) == "hi"

    def test_write_scope_normalizes(self) -> None:
        assert write_scope("./a\\b/") == "a/b"

    @pytest.mark.parametrize(
        "bad",
        ["/abs/path", "C:/win", "", ".", "a/../b", "./"],
    )
    def test_write_scope_invalid(self, bad: str) -> None:
        with pytest.raises(TeamError) as ei:
            write_scope(bad)
        assert ei.value.code == "TEAM_INVALID_WRITE_SCOPE"


# ── update: revision CAS ───────────────────────────────────────────────────


class TestCas:
    def test_stale_revision(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(
                    task_id="task-1", expected_revision=99, action="edit", subject="new"
                ),
            )
        assert ei.value.code == "TEAM_TASK_STALE_REVISION"

    def test_not_found(self) -> None:
        board = _enabled_board()
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(
                    task_id="task-999", expected_revision=1, action="edit", subject="x"
                ),
            )
        assert ei.value.code == "TEAM_TASK_NOT_FOUND"


# ── 授权 ───────────────────────────────────────────────────────────────────


class TestAuthorization:
    def test_non_owner_non_lead_blocked(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        # 他 agent claim
        board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=1, action="claim"),
        )
        # 第三个 agent 想 edit（非 owner 非 lead）
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="c",
                is_lead=False,
                request=UpdateRequest(
                    task_id="task-1", expected_revision=2, action="edit", subject="hijack"
                ),
            )
        assert ei.value.code == "TEAM_TASK_UNAUTHORIZED"

    def test_lead_can_edit_others_task(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=1, action="claim"),
        )
        v = board.update(
            caller_id="lead",
            is_lead=True,
            request=UpdateRequest(
                task_id="task-1", expected_revision=2, action="edit", subject="lead edit"
            ),
        )
        assert v.subject == "lead edit"


# ── 8 action 转换 ──────────────────────────────────────────────────────────


class TestActions:
    def test_full_lifecycle(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        # claim
        v = board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=1, action="claim"),
        )
        assert v.status == "in_progress"
        assert v.owner_id == "a"
        # complete
        v = board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=2, action="complete"),
        )
        assert v.status == "completed"
        # reopen
        v = board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=3, action="reopen"),
        )
        assert v.status == "pending"
        assert v.owner_id is None

    def test_claim_twice_by_other_blocked(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=1, action="claim"),
        )
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="b",
                is_lead=False,
                request=UpdateRequest(task_id="task-1", expected_revision=2, action="claim"),
            )
        assert ei.value.code == "TEAM_TASK_ALREADY_CLAIMED"

    def test_claim_blocked_by_dependency(self) -> None:
        board = _enabled_board()
        board.create(subject="dep", description="d")  # task-1
        board.create(subject="main", description="d", blocked_by=("task-1",))  # task-2
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="a",
                is_lead=False,
                request=UpdateRequest(task_id="task-2", expected_revision=1, action="claim"),
            )
        assert ei.value.code == "TEAM_TASK_BLOCKED"

    def test_complete_pending_invalid(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(task_id="task-1", expected_revision=1, action="complete"),
            )
        assert ei.value.code == "TEAM_TASK_INVALID_TRANSITION"

    def test_release_and_reopen_owner_required(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=1, action="claim"),
        )
        # release
        v = board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=2, action="release"),
        )
        assert v.status == "pending"

    def test_reassign_lead_only(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        board.update(
            caller_id="a",
            is_lead=False,
            request=UpdateRequest(task_id="task-1", expected_revision=1, action="claim"),
        )
        # 非 lead reassign 被拒
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="b",
                is_lead=False,
                request=UpdateRequest(
                    task_id="task-1", expected_revision=2, action="reassign", owner="c"
                ),
            )
        assert ei.value.code == "TEAM_LEAD_REQUIRED"
        # lead reassign
        v = board.update(
            caller_id="lead",
            is_lead=True,
            request=UpdateRequest(
                task_id="task-1", expected_revision=2, action="reassign", owner="c"
            ),
        )
        assert v.owner_id == "c"
        assert v.status == "in_progress"

    def test_reopen_only_completed(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(task_id="task-1", expected_revision=1, action="reopen"),
            )
        assert ei.value.code == "TEAM_TASK_INVALID_TRANSITION"

    def test_set_dependencies_and_cycle(self) -> None:
        board = _enabled_board()
        board.create(subject="a", description="d")  # task-1
        board.create(subject="b", description="d")  # task-2
        board.update(
            caller_id="lead",
            is_lead=True,
            request=UpdateRequest(
                task_id="task-2", expected_revision=1, action="set_dependencies",
                blocked_by=("task-1",),
            ),
        )
        # 自依赖
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(
                    task_id="task-1", expected_revision=1, action="set_dependencies",
                    blocked_by=("task-1",),
                ),
            )
        assert ei.value.code == "TEAM_TASK_DEPENDENCY_CYCLE"

    def test_delete_with_dependents_blocked(self) -> None:
        board = _enabled_board()
        board.create(subject="dep", description="d")  # task-1
        board.create(subject="main", description="d", blocked_by=("task-1",))  # task-2
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(task_id="task-1", expected_revision=1, action="delete"),
            )
        assert ei.value.code == "TEAM_TASK_HAS_DEPENDENTS"

    def test_edit_requires_something(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(task_id="task-1", expected_revision=1, action="edit"),
            )
        assert ei.value.code == "TEAM_INVALID_ARGUMENT"

    def test_unknown_action(self) -> None:
        board = _enabled_board()
        board.create(subject="s", description="d")
        with pytest.raises(TeamError) as ei:
            board.update(
                caller_id="lead",
                is_lead=True,
                request=UpdateRequest(task_id="task-1", expected_revision=1, action="bogus"),
            )
        assert ei.value.code == "TEAM_INVALID_ARGUMENT"


# ── writeScope 警告 ────────────────────────────────────────────────────────


class TestWriteScopeWarnings:
    def test_overlap_warning(self) -> None:
        board = _enabled_board()
        board.create(subject="a", description="d", write_scopes=("src/auth",))
        board.create(subject="b", description="d", write_scopes=("src/auth/login",))
        # 第二个任务被 claim 进 in_progress 才触发对其它 in_progress 的警告
        board.update(
            caller_id="x",
            is_lead=False,
            request=UpdateRequest(task_id="task-2", expected_revision=1, action="claim"),
        )
        v1 = project_task_view(board.state, board.state.tasks[0])
        assert any("task-2" in w for w in v1.write_scope_warnings)

    def test_no_overlap_no_warning(self) -> None:
        board = _enabled_board()
        board.create(subject="a", description="d", write_scopes=("src/auth",))
        board.create(subject="b", description="d", write_scopes=("docs/",))
        board.update(
            caller_id="x",
            is_lead=False,
            request=UpdateRequest(task_id="task-2", expected_revision=1, action="claim"),
        )
        v1 = project_task_view(board.state, board.state.tasks[0])
        assert v1.write_scope_warnings == ()


# ── ready 推导 ─────────────────────────────────────────────────────────────


class TestReady:
    def test_ready_follows_blockers(self) -> None:
        board = _enabled_board()
        board.create(subject="dep", description="d")  # task-1
        board.create(subject="main", description="d", blocked_by=("task-1",))  # task-2
        assert board.get("task-2").ready is False
        # 完成 task-1
        board.update(
            caller_id="lead",
            is_lead=True,
            request=UpdateRequest(task_id="task-1", expected_revision=1, action="claim"),
        )
        board.update(
            caller_id="lead",
            is_lead=True,
            request=UpdateRequest(task_id="task-1", expected_revision=2, action="complete"),
        )
        assert board.get("task-2").ready is True


if __name__ == "__main__":
    import pytest as _p

    _p.main([__file__, "-q"])

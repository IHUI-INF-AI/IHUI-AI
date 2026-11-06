# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""批4(2026-11-06):按轮变更集 + inputAttempt 兼容的纯单测(不连真库)。

全部用 fake pool:断言的是**语句形状/聚合语义/磁盘副作用**,不是 asyncpg 行为。
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

import pytest

from app.services import change_set_store as store


def _sha(text: str | None) -> str | None:
    if text is None:
        return None
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False


class _FakeConn:
    """记录所有 SQL;fetchrow 按"是否按 id 查变更集"分流。"""

    def __init__(
        self, change_set: dict[str, Any] | None = None, files: list[dict[str, Any]] | None = None
    ) -> None:
        self.change_set = change_set
        self.files = files or []
        self.fetchrow_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetch_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self.executemany_calls: list[tuple[str, list[tuple[Any, ...]]]] = []
        # 跨方法(execute / executemany)的全局顺序记录:用于断言 prune 落在 upsert 之后、
        # recompute 之前(两个分数组无法自证先后)。
        self.events: list[tuple[str, str, Any]] = []

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_calls.append((sql, args))
        self.events.append(("fetchrow", sql, args))
        if "chat_turn_change_sets" in sql and "WHERE id = $1" in sql:
            return self.change_set
        return {"id": uuid.UUID("00000000-0000-0000-0000-0000000000aa")}

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        self.fetch_calls.append((sql, args))
        self.events.append(("fetch", sql, args))
        return self.files

    async def execute(self, sql: str, *args: Any) -> str:
        self.executed.append((sql, args))
        self.events.append(("execute", sql, args))
        return "UPDATE 1"

    async def executemany(self, sql: str, args_list: list[tuple[Any, ...]]) -> None:
        self.executemany_calls.append((sql, list(args_list)))
        self.events.append(("executemany", sql, list(args_list)))

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> Any:
        class _Acquire:
            async def __aenter__(self_inner) -> _FakeConn:
                return self.conn

            async def __aexit__(self_inner, *exc: Any) -> bool:
                return False

        return _Acquire()


@pytest.fixture(autouse=True)
def _clean_turn_context():
    """每条用例前后清空 ContextVar,防止轮上下文跨用例串账。"""
    store._CURRENT.set(None)
    yield
    store._CURRENT.set(None)


@pytest.fixture
def patch_pool(monkeypatch):
    def _patch(conn: _FakeConn) -> _FakeConn:
        async def _get_pool() -> _FakePool:
            return _FakePool(conn)

        monkeypatch.setattr(store, "get_shared_pool", _get_pool)
        return conn

    return _patch


class TestRecordAggregation:
    def test_multiple_edits_collapse_to_earliest_before_latest_after(self, tmp_path):
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-1",
                workspace_root=str(tmp_path),
            )
        )
        p = str(tmp_path / "a.txt")
        store.record_file_change(p, None, "v1")
        store.record_file_change(p, "v1", "v2")
        store.record_file_change(p, "v2", "v3")

        state = store._CURRENT.get()
        assert state is not None
        (entry,) = state.files.values()
        assert entry["before"] is None, "最早 before 必须是首次观测的 None(本文件是新建)"
        assert entry["after"] == "v3", "after 必须是最晚一次写盘的内容"
        assert entry["operation"] == "add"
        assert entry["before_sha256"] is None
        assert entry["after_sha256"] == _sha("v3")
        assert entry["additions"] == 1 and entry["deletions"] == 0, (
            "diff 是(最早 before=空)→(最晚 after),不是逐次累加"
        )
        assert entry["rewind_tracked"] is True

    def test_add_modify_delete_classification(self, tmp_path):
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-2",
                workspace_root=str(tmp_path),
            )
        )
        store.record_file_change(str(tmp_path / "new.txt"), None, "hello")
        store.record_file_change(str(tmp_path / "mod.txt"), "old\n", "new\n")
        store.record_file_change(str(tmp_path / "gone.txt"), "bye\n", None)

        state = store._CURRENT.get()
        assert state is not None
        by_path = {e["path"]: e for e in state.files.values()}
        assert by_path["new.txt"]["operation"] == "add"
        assert by_path["mod.txt"]["operation"] == "modify"
        assert by_path["gone.txt"]["operation"] == "delete"
        assert by_path["mod.txt"]["additions"] == 1
        assert by_path["mod.txt"]["deletions"] == 1
        assert by_path["gone.txt"]["before_sha256"] == _sha("bye\n")
        assert by_path["gone.txt"]["after_sha256"] is None
        assert "--- a/gone.txt" in by_path["gone.txt"]["unified_diff"]

    def test_noop_change_skipped(self, tmp_path):
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-3",
                workspace_root=str(tmp_path),
            )
        )
        p = str(tmp_path / "same.txt")
        store.record_file_change(p, "same", "same")
        store.record_file_change(p, "same", "same")
        state = store._CURRENT.get()
        assert state is not None
        assert state.files == {}

    def test_outside_workspace_path_rejected(self, tmp_path):
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-4",
                workspace_root=str(tmp_path),
            )
        )
        outside = str(tmp_path.parent / "escape.txt")
        store.record_file_change(outside, "x", "y")
        store.record_file_change(str(tmp_path / ".." / "escape2.txt"), "x", "y")
        state = store._CURRENT.get()
        assert state is not None
        assert state.files == {}, "工作区外路径一律不记账"

    def test_no_turn_context_is_total_noop(self, tmp_path):
        store.record_file_change(str(tmp_path / "x.txt"), "a", "b")
        assert store._CURRENT.get() is None
        assert store.current_turn_context() is None

    def test_large_before_is_truncated_and_not_rewinnable(self, tmp_path):
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-5",
                workspace_root=str(tmp_path),
            )
        )
        big = "x" * (store._MAX_BEFORE_CONTENT_BYTES + 1)
        store.record_file_change(str(tmp_path / "big.txt"), big, "small")
        state = store._CURRENT.get()
        assert state is not None
        (entry,) = state.files.values()
        assert entry["content_truncated"] is True
        assert entry["rewind_tracked"] is False
        assert entry["before"] is None, "超限正文不得落库(避免把 1MB+ 副本当可回滚材料)"
        assert entry["before_sha256"] == _sha(big), "sha 仍要算:冲突判定还要靠它"

    def test_exactly_1mb_before_still_tracked(self, tmp_path):
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-6",
                workspace_root=str(tmp_path),
            )
        )
        exact = "x" * store._MAX_BEFORE_CONTENT_BYTES
        store.record_file_change(str(tmp_path / "exact.txt"), exact, "small")
        state = store._CURRENT.get()
        assert state is not None
        (entry,) = state.files.values()
        assert entry["content_truncated"] is False
        assert entry["rewind_tracked"] is True


class TestEndTurnPersistence:
    async def test_flush_upserts_set_then_files_then_recomputes(self, tmp_path, patch_pool):
        conn = patch_pool(_FakeConn())
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-flush",
                session_id="sess-1",
                workspace_root=str(tmp_path),
            )
        )
        store.record_file_change(str(tmp_path / "mod.txt"), "old\n", "new\n")
        store.record_file_change(str(tmp_path / "new.txt"), None, "fresh\n")
        await store.end_turn("committed")

        assert store._CURRENT.get() is None, "end_turn 必须摘掉轮上下文(同 task 成对)"
        insert_sql, insert_args = conn.fetchrow_calls[0]
        assert "INSERT INTO chat_turn_change_sets" in insert_sql
        assert "ON CONFLICT (conversation_id, turn_id) DO UPDATE" in insert_sql
        assert insert_args[2] == "turn-flush"
        assert insert_args[5] == "committed"

        upsert_sql, rows = conn.executemany_calls[0]
        assert "ON CONFLICT (change_set_id, path) DO UPDATE" in upsert_sql
        by_path = {row[1]: row for row in rows}
        assert by_path["mod.txt"][2] == "modify"
        assert by_path["mod.txt"][8] == "old\n"
        assert by_path["new.txt"][2] == "add"
        assert by_path["new.txt"][8] is None
        assert "FROM chat_turn_change_files" in conn.executed[-1][0], "计数必须由库内明细重算"

    async def test_same_turn_retry_prunes_stale_paths(self, tmp_path, patch_pool):
        """同一 turn_id 重试:上一次 flush 写过的 a.txt 不在本轮集合里,必须被 prune 掉。"""
        conn = patch_pool(_FakeConn())
        ctx = store.ChangeTurnContext(
            conversation_id=str(uuid.uuid4()),
            user_id=str(uuid.uuid4()),
            turn_id="turn-retry",
            workspace_root=str(tmp_path),
        )
        store.begin_turn(ctx)
        store.record_file_change(str(tmp_path / "a.txt"), None, "a\n")
        await store.end_turn("committed")

        # 同 conversation/user/turn_id 再来一轮,这次只含 b.txt
        store.begin_turn(ctx)
        store.record_file_change(str(tmp_path / "b.txt"), None, "b\n")
        await store.end_turn("committed")

        prune_calls = [
            args
            for sql, args in conn.executed
            if "DELETE FROM chat_turn_change_files" in sql
        ]
        assert len(prune_calls) == 2, "两次 flush 都必须执行 prune"
        assert prune_calls[0][1] == ["a.txt"]
        assert prune_calls[1][1] == ["b.txt"], "第二次 flush 的完整集合只有 b.txt,旧 a.txt 应被删"
        assert "FROM chat_turn_change_files" in conn.executed[-1][0], (
            "recompute 仍是最后一条 execute(prune 之后才重算计数)"
        )

    async def test_flush_with_empty_state_prunes_all_rows(self, tmp_path, patch_pool):
        """本轮没有任何可记账改动:prune 传空数组,清空该 set 的全部旧行。"""
        conn = patch_pool(_FakeConn())
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-empty",
                workspace_root=str(tmp_path),
            )
        )
        await store.end_turn("committed")

        assert conn.executemany_calls == [], "空集合不必 upsert 明细"
        (prune_args,) = [
            args
            for sql, args in conn.executed
            if "DELETE FROM chat_turn_change_files" in sql
        ]
        assert prune_args[1] == [], "空数组 ⇒ 删除该 set 全部旧行"
        assert "FROM chat_turn_change_files" in conn.executed[-1][0]

    async def test_prune_ordered_after_upsert_before_recompute(self, tmp_path, patch_pool):
        """语义顺序:prune 先 upsert 完成之后、recompute 之前。"""
        conn = patch_pool(_FakeConn())
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-order",
                workspace_root=str(tmp_path),
            )
        )
        store.record_file_change(str(tmp_path / "b.txt"), None, "b\n")
        await store.end_turn("committed")

        upsert_idx = next(
            i
            for i, (kind, sql, _) in enumerate(conn.events)
            if kind == "executemany" and "INSERT INTO chat_turn_change_files" in sql
        )
        prune_idx = next(
            i
            for i, (kind, sql, _) in enumerate(conn.events)
            if kind == "execute" and "DELETE FROM chat_turn_change_files" in sql
        )
        recompute_idx = next(
            i
            for i, (kind, sql, _) in enumerate(conn.events)
            if kind == "execute" and "UPDATE chat_turn_change_sets" in sql
        )
        assert upsert_idx < prune_idx, "prune 不得发生在 upsert 之前(否则中途失败会空账)"
        assert prune_idx < recompute_idx, "prune 必须在 recompute 之前完成"
        assert conn.events[-1][0] == "execute", "最后一条语句必须是 recompute"
        assert "UPDATE chat_turn_change_sets" in conn.events[-1][1]

    async def test_flush_failure_does_not_raise(self, tmp_path, monkeypatch):
        async def _boom() -> Any:
            raise RuntimeError("db down")

        monkeypatch.setattr(store, "get_shared_pool", _boom)
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4()),
                turn_id="turn-boom",
                workspace_root=str(tmp_path),
            )
        )
        store.record_file_change(str(tmp_path / "a.txt"), "a", "b")
        await store.end_turn("committed")  # 不应抛出

    async def test_non_uuid_identity_skips_flush(self, tmp_path, patch_pool):
        conn = patch_pool(_FakeConn())
        store.begin_turn(
            store.ChangeTurnContext(
                conversation_id="not-a-uuid",
                user_id="dev-anonymous",
                turn_id="turn-anon",
                workspace_root=str(tmp_path),
            )
        )
        store.record_file_change(str(tmp_path / "a.txt"), "a", "b")
        await store.end_turn("committed")
        assert conn.fetchrow_calls == [] and conn.executed == []


def _change_set(root: str, rewind_status: str = "available") -> dict[str, Any]:
    return {
        "id": uuid.UUID("00000000-0000-0000-0000-0000000000aa"),
        "conversation_id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "turn_id": "turn-rewind",
        "session_id": None,
        "workspace_root": root,
        "status": "committed",
        "file_count": 2,
        "additions": 1,
        "deletions": 1,
        "rewind_status": rewind_status,
        "created_at": None,
        "updated_at": None,
    }


def _file_row(
    path: str,
    operation: str,
    before: str | None,
    after: str | None,
    *,
    tracked: bool = True,
    truncated: bool = False,
) -> dict[str, Any]:
    return {
        "id": uuid.uuid4(),
        "change_set_id": uuid.UUID("00000000-0000-0000-0000-0000000000aa"),
        "path": path,
        "operation": operation,
        "before_sha256": _sha(before),
        "after_sha256": _sha(after),
        "additions": 0,
        "deletions": 0,
        "unified_diff": "",
        "before_content": before,
        "content_truncated": truncated,
        "rewind_tracked": tracked,
        "rewind_applied_at": None,
        "created_at": None,
    }


class TestRewind:
    async def test_dry_run_reports_actions_and_writes_nothing(self, tmp_path, patch_pool):
        (tmp_path / "mod.txt").write_text("new\n", encoding="utf-8")
        (tmp_path / "new.txt").write_text("fresh\n", encoding="utf-8")
        conn = patch_pool(
            _FakeConn(
                _change_set(str(tmp_path)),
                [
                    _file_row("mod.txt", "modify", "old\n", "new\n"),
                    _file_row("new.txt", "add", None, "fresh\n"),
                ],
            )
        )

        result = await store.rewind_change_set(str(_change_set_id()), dry_run=True)

        assert result["status"] == "ok"
        assert result["applied"] == 0
        assert [(a["path"], a["action"]) for a in result["actions"]] == [
            ("mod.txt", "restore"),
            ("new.txt", "delete"),
        ]
        assert conn.executed == [], "dry_run 不得改库"
        assert (tmp_path / "mod.txt").read_text(encoding="utf-8") == "new\n"
        assert (tmp_path / "new.txt").exists()

    async def test_execute_restores_modify_and_deletes_add(self, tmp_path, patch_pool):
        (tmp_path / "mod.txt").write_text("new\n", encoding="utf-8")
        (tmp_path / "new.txt").write_text("fresh\n", encoding="utf-8")
        conn = patch_pool(
            _FakeConn(
                _change_set(str(tmp_path)),
                [
                    _file_row("mod.txt", "modify", "old\n", "new\n"),
                    _file_row("new.txt", "add", None, "fresh\n"),
                ],
            )
        )

        result = await store.rewind_change_set(str(_change_set_id()), dry_run=False)

        assert result["status"] == "ok"
        assert result["applied"] == 2
        assert (tmp_path / "mod.txt").read_text(encoding="utf-8") == "old\n"
        assert not (tmp_path / "new.txt").exists()
        status_updates = [args[1] for sql, args in conn.executed if "rewind_status" in sql]
        assert status_updates == ["rewinding", "rewound"]
        assert conn.executed[-1][1][1] == "rewound"

    async def test_execute_restores_deleted_file(self, tmp_path, patch_pool):
        patch_pool(
            _FakeConn(
                _change_set(str(tmp_path)),
                [_file_row("gone.txt", "delete", "bye\n", None)],
            )
        )
        result = await store.rewind_change_set(str(_change_set_id()), dry_run=False)
        assert result["status"] == "ok"
        assert (tmp_path / "gone.txt").read_text(encoding="utf-8") == "bye\n"

    async def test_conflict_aborts_all_or_nothing(self, tmp_path, patch_pool):
        (tmp_path / "mod.txt").write_text("new\n", encoding="utf-8")
        (tmp_path / "tampered.txt").write_text("user-edited\n", encoding="utf-8")
        conn = patch_pool(
            _FakeConn(
                _change_set(str(tmp_path)),
                [
                    _file_row("mod.txt", "modify", "old\n", "new\n"),
                    _file_row("tampered.txt", "modify", "before\n", "expected\n"),
                ],
            )
        )

        result = await store.rewind_change_set(str(_change_set_id()), dry_run=False)

        assert result["status"] == "conflict"
        assert result["applied"] == 0
        assert result["conflicts"] == [
            {"path": "tampered.txt", "reason": "current_content_mismatch"}
        ]
        # 全有全无:干净的那份也不许动
        assert (tmp_path / "mod.txt").read_text(encoding="utf-8") == "new\n"
        assert (tmp_path / "tampered.txt").read_text(encoding="utf-8") == "user-edited\n"
        assert conn.executed[-1][1][1] == "conflict"

    async def test_missing_after_file_is_conflict(self, tmp_path, patch_pool):
        patch_pool(
            _FakeConn(
                _change_set(str(tmp_path)),
                [_file_row("missing.txt", "modify", "old\n", "new\n")],
            )
        )
        result = await store.rewind_change_set(str(_change_set_id()), dry_run=False)
        assert result["status"] == "conflict"
        assert result["conflicts"][0]["reason"] == "current_file_missing"

    async def test_path_traversal_is_conflict(self, tmp_path, patch_pool):
        conn = patch_pool(
            _FakeConn(
                _change_set(str(tmp_path)),
                [_file_row("../escape.txt", "add", None, "evil\n")],
            )
        )
        result = await store.rewind_change_set(str(_change_set_id()), dry_run=False)
        assert result["status"] == "conflict"
        assert result["conflicts"][0]["reason"] == "path_outside_workspace"
        assert conn.executed[-1][1][1] == "conflict"
        assert not (tmp_path.parent / "escape.txt").exists()

    async def test_already_rewound_is_idempotent(self, tmp_path, patch_pool):
        (tmp_path / "mod.txt").write_text("new\n", encoding="utf-8")
        conn = patch_pool(
            _FakeConn(
                _change_set(str(tmp_path), rewind_status="rewound"),
                [_file_row("mod.txt", "modify", "old\n", "new\n")],
            )
        )
        result = await store.rewind_change_set(str(_change_set_id()), dry_run=False)
        assert result["status"] == "already_rewound"
        assert result["applied"] == 0
        assert conn.executed == []
        assert (tmp_path / "mod.txt").read_text(encoding="utf-8") == "new\n"

    async def test_untracked_row_makes_set_unavailable(self, tmp_path, patch_pool):
        conn = patch_pool(
            _FakeConn(
                _change_set(str(tmp_path)),
                [
                    _file_row("mod.txt", "modify", "old\n", "new\n"),
                    _file_row("big.txt", "modify", None, "new\n", tracked=False, truncated=True),
                ],
            )
        )
        result = await store.rewind_change_set(str(_change_set_id()), dry_run=False)
        assert result["status"] == "unavailable"
        assert result["applied"] == 0
        assert conn.executed == []

    async def test_missing_change_set_raises(self, patch_pool):
        patch_pool(_FakeConn(None, []))
        with pytest.raises(store.ChangeSetNotFoundError):
            await store.rewind_change_set(str(_change_set_id()), dry_run=True)


def _change_set_id() -> uuid.UUID:
    return uuid.UUID("00000000-0000-0000-0000-0000000000aa")


class TestInputAttemptAdmission:
    def test_attempt1_duplicate_but_attempt2_accepted(self):
        from app.routers.llm import _admission_disposition, _admission_seen

        conv = f"conv-{uuid.uuid4()}"
        try:
            assert _admission_disposition(conv, "i1", 1) == "accepted"
            assert _admission_disposition(conv, "i1", 1) == "duplicate"
            # 网关裁决的重试:同一 inputId 的 attempt=2 必须放行,且重新登记
            assert _admission_disposition(conv, "i1", 2) == "accepted"
            assert _admission_disposition(conv, "i1", 1) == "duplicate"
        finally:
            _admission_seen.pop(conv, None)

    def test_request_model_has_input_attempt_default_1(self):
        from app.routers.llm import LLMCompleteRequest

        assert LLMCompleteRequest.model_fields["inputAttempt"].default == 1

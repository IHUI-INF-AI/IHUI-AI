# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R93: `state_5.sqlite` as the persisted `Thread` struct."""

from __future__ import annotations

import pytest

from app.core import codex_runtime_state_schema as mod


def test_table_and_column_totals() -> None:
    assert mod.TABLE_COUNT == 15
    assert mod.TOTAL_COLUMNS == 109
    assert sum(len(v) for v in mod.TABLES.values()) == 109
    mod.validate_schema()


def test_threads_has_43_columns_matching_the_binary_walk() -> None:
    assert len(mod.THREAD_COLUMNS) == 43
    assert len(mod.TABLES["threads"]) == 43
    assert mod.THREAD_COLUMNS[0] == "id"
    assert "rollout_path" in mod.THREAD_COLUMNS


def test_persistence_plumbing_is_separated() -> None:
    assert set(mod.PERSISTENCE_ONLY) <= set(mod.THREAD_COLUMNS)
    for name in ("created_at_ms", "project_id", "thread_section_id"):
        assert name in mod.PERSISTENCE_ONLY


def test_db_only_names_are_the_ones_the_binary_missed() -> None:
    expected = {
        "memory_mode", "agent_role", "reasoning_effort", "history_mode", "thread_source",
        "daybreak_enabled", "creator_user_id", "creator_account_id", "is_pinned",
        "originator", "attached_thread_parent_id",
    }
    assert set(mod.DB_ONLY_NAMES) == expected
    assert all(n in mod.THREAD_COLUMNS for n in expected)


def test_sixty_two_migrations_in_order() -> None:
    assert mod.MIGRATION_COUNT == 62
    assert mod.migration(1) == "threads"
    assert mod.migration(4) == "thread dynamic tools"
    assert mod.migration(21) == "thread spawn edges"
    assert mod.migration(49) == "projects"
    assert mod.migration(62) == "threads attached parent"


def test_dropped_tables_are_still_in_the_history() -> None:
    dropped = [d for _v, d in sorted(mod.MIGRATIONS.items()) if d.startswith("drop ")]
    assert dropped == ["drop logs", "drop device key bindings", "drop thread goals",
                       "drop memory tables", "drop agent jobs"]


def test_column_lookup_and_reverse_lookup() -> None:
    assert mod.column_of("threads", "memory_mode")
    assert not mod.column_of("threads", "no_such_column")
    rev = mod.tables_with_column("thread_id")
    assert "thread_dynamic_tools" in rev
    assert "thread_attachments" in rev
    assert len(rev) >= 3
    with pytest.raises(mod.SchemaError):
        mod.column_of("no_table", "x")


def test_validator_rejects_a_drifted_thread_column_count(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "THREAD_COLUMNS", mod.THREAD_COLUMNS[:-1])
    with pytest.raises(mod.SchemaError, match="threads columns changed"):
        mod.validate_schema()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

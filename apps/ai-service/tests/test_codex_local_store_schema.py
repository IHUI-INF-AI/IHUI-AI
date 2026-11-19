# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R131 — locks the local store schema that had been counted but never read.

The mutations target the facts that only exist because the databases were actually opened: the
43-column ``threads`` row, the 62-migration lead, the lease protocol on memory jobs, and the
cross-check that experimental protocol families already have persisted tables.
"""

from __future__ import annotations

import pytest

from app.core import codex_local_store_schema as s


def test_validate_contract_is_clean() -> None:
    assert s.validate_contract() == []


def test_six_databases() -> None:
    assert s.DATABASE_COUNT == 6
    assert s.DATABASES == (
        "goals_1.sqlite",
        "logs_2.sqlite",
        "memories_1.sqlite",
        "queue_1.sqlite",
        "state_5.sqlite",
        "thread_history_1.sqlite",
    )
    assert s.OPENED_READ_ONLY is True
    assert s.QUERY_ONLY_PRAGMA is True


def test_table_counts_sum() -> None:
    assert s.TOTAL_TABLE_COUNT == 36
    assert sum(s.TABLE_COUNT.values()) == 36
    assert s.table_count("state_5.sqlite") == 17
    assert s.table_count("goals_1.sqlite") == 3


def test_unknown_database_is_minus_one() -> None:
    assert s.table_count("nope.sqlite") == -1
    assert s.migration_count("nope.sqlite") == -1


def test_migration_lead_is_state5() -> None:
    assert s.MIGRATION_COUNT["state_5.sqlite"] == 62
    assert s.MIGRATION_COUNT["thread_history_1.sqlite"] == 8
    assert max(s.MIGRATION_COUNT.values()) == 62
    assert min(s.MIGRATION_COUNT.values()) == 2


def test_state5_table_list() -> None:
    assert len(s.STATE5_TABLES) == 17
    assert "threads" in s.STATE5_TABLES
    assert "thread_dynamic_tools" in s.STATE5_TABLES
    assert "remote_control_enrollments" in s.STATE5_TABLES


def test_threads_is_43_columns() -> None:
    assert s.THREADS_COLUMN_COUNT == 43
    assert len(s.THREADS_COLUMNS) == 43
    assert len(set(s.THREADS_COLUMNS)) == 43


def test_threads_keeps_legacy_timestamps() -> None:
    assert s.has_dual_timestamps(s.THREADS_COLUMNS) is True
    assert s.DUAL_TIMESTAMP_IS_A_KEPT_LEGACY is True
    assert "created_at" in s.THREADS_COLUMNS
    assert "created_at_ms" in s.THREADS_COLUMNS


def test_dual_timestamp_helper_rejects_partial_sets() -> None:
    assert s.has_dual_timestamps(("created_at", "created_at_ms")) is False
    assert s.has_dual_timestamps(("x",)) is False


def test_item_and_turn_columns() -> None:
    assert len(s.THREAD_ITEMS_COLUMNS) == s.THREAD_ITEMS_COLUMN_COUNT == 10
    assert len(s.THREAD_TURNS_COLUMNS) == s.THREAD_TURNS_COLUMN_COUNT == 14
    assert "rollout_ordinal" in s.THREAD_ITEMS_COLUMNS
    assert "root_turn_id" in s.THREAD_TURNS_COLUMNS


def test_goal_runtime_has_two_ledgers() -> None:
    assert s.THREAD_GOALS_COLUMN_COUNT == 9
    assert s.GOAL_RUNTIME_HAS_TOKEN_AND_TIME_LEDGERS is True
    for col in ("objective", "status", "token_budget", "tokens_used", "time_used_seconds"):
        assert col in s.THREAD_GOALS_COLUMNS
    assert s.GOAL_DEFERRALS_KEYED_BY_THREAD_ONLY is True


def test_dynamic_tools_are_defer_loaded() -> None:
    assert s.DYNAMIC_TOOLS_HAVE_DEFER_FLAG is True
    assert s.DYNAMIC_TOOLS_ARE_POSITION_ORDERED is True
    assert "defer_loading" in s.THREAD_DYNAMIC_TOOLS_COLUMNS
    assert "input_schema" in s.THREAD_DYNAMIC_TOOLS_COLUMNS
    assert "namespace" in s.THREAD_DYNAMIC_TOOLS_COLUMNS


def test_memory_is_two_phase_with_a_lease() -> None:
    assert s.MEMORY_IS_TWO_PHASE is True
    assert s.MEMORY_JOBS_USE_A_LEASE is True
    assert "raw_memory" in s.MEMORY_STAGE1_COLUMNS
    assert "selected_for_phase2" in s.MEMORY_STAGE1_COLUMNS
    for col in ("worker_id", "ownership_token", "lease_until", "retry_at", "retry_remaining"):
        assert col in s.MEMORY_JOB_COLUMNS
    assert s.CONSOLIDATION_PROGRESS_IS_SINGLETON is True


def test_logs_self_account_bytes() -> None:
    assert len(s.LOG_COLUMNS) == s.LOG_COLUMN_COUNT == 12
    assert s.LOG_SELF_ACCOUNTS_BYTES is True
    assert "estimated_bytes" in s.LOG_COLUMNS
    assert "ts_nanos" in s.LOG_COLUMNS


def test_experimental_families_have_tables() -> None:
    assert len(s.EXPERIMENTAL_FAMILIES_WITH_TABLES) == s.EXPERIMENTAL_TABLE_BACKED_FAMILY_COUNT == 4
    assert s.PERSISTENCE_PRECEDES_THE_WIRE_FLAG is True
    assert s.is_experimental_family_with_tables("project") is True
    assert s.is_experimental_family_with_tables("remoteControl") is True
    assert s.is_experimental_family_with_tables("thread/queue") is True
    assert s.is_experimental_family_with_tables("thread/goal") is True
    assert s.is_experimental_family_with_tables("fuzzyFileSearch") is False


def test_tables_for_family() -> None:
    assert s.tables_for_family("remoteControl") == ("remote_control_enrollments",)
    assert s.tables_for_family("project") == (
        "projects",
        "project_roots",
        "project_idempotency_keys",
    )
    assert s.tables_for_family("nothing") == ()


def test_queue_and_project_columns() -> None:
    assert "payload_json" in s.QUEUE_COLUMNS
    assert s.QUEUE_REVISION_COLUMNS == ("revision", "thread_id")
    assert s.PROJECT_COLUMNS[0] == "id"
    assert s.PROJECT_ROOT_COLUMNS == ("project_id", "position", "path")
    assert "remote_control_enabled" in s.REMOTE_CONTROL_ENROLLMENT_COLUMNS
    assert s.SPAWN_EDGE_COLUMNS == ("parent_thread_id", "child_thread_id", "status")


def test_coverage_shape() -> None:
    cov = s.coverage()
    assert cov["databases"] == 6
    assert cov["tables"] == 36
    assert cov["state5_tables"] == 17
    assert cov["threads_columns"] == 43
    assert cov["migrated_faces"] == 2
    assert cov["experimental_table_backed_families"] == 4


# --- reverse mutations ----------------------------------------------------------------


def test_mutation_threads_widens_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(s, "THREADS_COLUMNS", s.THREADS_COLUMNS + ("made_up_column",))
    problems = s.validate_contract()
    assert problems, "a threads table that no longer matches its measured width must be reported"


def test_mutation_migration_lead_flatlines_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(s, "MIGRATION_COUNT", {**s.MIGRATION_COUNT, "state_5.sqlite": 8})
    problems = s.validate_contract()
    assert any("62" in x for x in problems)


def test_mutation_lease_loses_ownership_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        s, "MEMORY_JOB_COLUMNS", tuple(c for c in s.MEMORY_JOB_COLUMNS if c != "ownership_token")
    )
    problems = s.validate_contract()
    assert any("ownership_token" in x for x in problems)


def test_mutation_family_table_claim_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        s,
        "EXPERIMENTAL_FAMILIES_WITH_TABLES",
        s.EXPERIMENTAL_FAMILIES_WITH_TABLES + (("fuzzyFileSearch", ()),),
    )
    problems = s.validate_contract()
    assert problems, "a family claimed without a table must be reported"


def test_mutation_table_total_drops_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(s, "TABLE_COUNT", {**s.TABLE_COUNT, "state_5.sqlite": 16})
    problems = s.validate_contract()
    assert any("state_5" in x for x in problems)


def test_mutation_dual_timestamp_dropped_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        s, "THREADS_COLUMNS", tuple(c for c in s.THREADS_COLUMNS if c != "created_at_ms")
    )
    problems = s.validate_contract()
    assert any("millisecond" in x for x in problems)


def test_mutation_read_only_flag_dropped_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(s, "OPENED_READ_ONLY", False)
    problems = s.validate_contract()
    assert problems
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

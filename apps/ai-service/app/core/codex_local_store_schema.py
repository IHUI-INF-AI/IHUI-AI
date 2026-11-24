# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The local persistent store, read at last (R131).

The ledger carried one stubborn cell: ``state_5.sqlite`` had 17 tables enumerated and **never
read**. This round opened all six databases read-only (``mode=ro`` + ``PRAGMA query_only``) and
dumped each schema plus its row counts, so the cell is now read rather than counted.

**Six databases, not one.** ``goals_1`` (3 tables), ``logs_2`` (3), ``memories_1`` (4),
``queue_1`` (4), ``state_5`` (17), ``thread_history_1`` (5). Every one carries
``_sqlx_migrations``, and the migration counts are the cheapest fingerprint of how built-out each
store is: four databases sit at **2** migrations, ``thread_history_1`` at **8**, and ``state_5``
at **62**. A store with 62 migrations is the mature one; the three small ones are single-purpose
append points that have barely changed since introduction.

**``state_5`` is the widest single object in the whole program.** ``threads`` carries **43 columns**,
and the set reads like a history of features layered on one row type: identity and storage
(``id``, ``rollout_path``, ``created_at``/``updated_at`` plus ``_ms`` twins), provenance
(``source``, ``thread_source``, ``originator``, ``cli_version``, ``git_sha``/``git_branch``/
``git_origin_url``), policy (``sandbox_policy``, ``approval_mode``, ``memory_mode``,
``history_mode``, ``daybreak_enabled``), agent identity (``agent_nickname``, ``agent_role``,
``agent_path``, ``attached_thread_parent_id``), organisation (``thread_section_id``,
``section_position``, ``project_id``, ``is_pinned``), accounting (``tokens_used``,
``has_user_event``) and — the two that date the row type — ``creator_user_id`` and
``creator_account_id``. Both ``created_at`` and ``created_at_ms`` exist side by side, which is the
signature of a millisecond migration that could not drop the old column.

**The schema cross-checks the protocol.** This is the part worth having. Four families that the
schema generator only exposed behind ``--experimental`` have persisted tables sitting in the
stable store: ``projects`` + ``project_roots`` + ``project_idempotency_keys`` back ``project/*``;
``remote_control_enrollments`` backs ``remoteControl/*``; ``queued_items`` +
``queued_thread_revisions`` back ``thread/queue/*``; and ``thread_goals`` +
``thread_goal_continuation_deferrals`` back the ``thread/goal/*`` family that exists on both
faces. A table in the stable store for an experimental method means the persistence layer shipped
first and the wire method was gated afterwards — the flag gates the protocol, not the data model.

**``thread_goals`` is the goal runtime, in five numbers.** ``objective``, ``status``,
``token_budget``, ``tokens_used``, ``time_used_seconds``. That is a budgeted loop with both a
token and a wall-clock ledger, plus a separate ``thread_goal_continuation_deferrals`` table keyed
only by ``thread_id`` for the backoff side.

**``thread_dynamic_tools`` is the defer-loading mechanism.** Columns ``name``, ``description``,
``input_schema``, ``defer_loading``, ``namespace``, ``position`` — a per-thread ordered tool
registry with an explicit defer flag. That is the same defer-loading idea this repo's own
``tool_search`` implements, arrived at independently.

**``memories_1`` is two-phase by design.** ``stage1_outputs`` holds per-thread ``raw_memory`` and
``rollout_summary`` with ``selected_for_phase2`` plus a ``*_source_updated_at`` watermark, and
``jobs`` carries a full lease protocol (``worker_id``, ``ownership_token``, ``lease_until``,
``retry_at``, ``retry_remaining``). ``consolidation_progress`` is a single-row
(``singleton``, ``max_thread_count``) cursor.

**``logs_2`` stores an estimated size per row** (``estimated_bytes``) next to ``ts`` and
``ts_nanos`` — a self-accounting log table that can be pruned by arithmetic instead of by scan.

**Honest boundary.** Row counts move on every run, so this module pins **schema** and
**migration counts**, never live row counts; the counts observed (`threads` 8, `logs` 2361,
`thread_items` 7) are recorded in the docstring as observations only. Column sets will drift with
future migrations. The dump is reproducible with ``sqlite3`` in read-only mode against
``C:\\Users\\Administrator\\.codex``.
"""

from __future__ import annotations

from typing import Final

STORE_DIR: Final = "C:/Users/Administrator/.codex"
SQLITE_PREFIX: Final = "state_"
DATABASES: Final = (
    "goals_1.sqlite",
    "logs_2.sqlite",
    "memories_1.sqlite",
    "queue_1.sqlite",
    "state_5.sqlite",
    "thread_history_1.sqlite",
)
DATABASE_COUNT: Final = 6
OPENED_READ_ONLY: Final = True
QUERY_ONLY_PRAGMA: Final = True

MIGRATIONS_TABLE: Final = "_sqlx_migrations"
MIGRATION_COUNT: Final = {
    "goals_1.sqlite": 2,
    "logs_2.sqlite": 2,
    "memories_1.sqlite": 2,
    "queue_1.sqlite": 2,
    "state_5.sqlite": 62,
    "thread_history_1.sqlite": 8,
}
TABLE_COUNT: Final = {
    "goals_1.sqlite": 3,
    "logs_2.sqlite": 3,
    "memories_1.sqlite": 4,
    "queue_1.sqlite": 4,
    "state_5.sqlite": 17,
    "thread_history_1.sqlite": 5,
}
TOTAL_TABLE_COUNT: Final = 36

STATE5_TABLES: Final = (
    "_sqlx_migrations",
    "backfill_state",
    "external_agent_config_imports",
    "guardian_review_feedback",
    "project_idempotency_keys",
    "project_roots",
    "projects",
    "remote_control_enrollments",
    "rollout_migration_skipped_rollouts",
    "rollout_migration_state",
    "sqlite_sequence",
    "thread_attachments",
    "thread_dynamic_tools",
    "thread_read_receipts",
    "thread_sections",
    "thread_spawn_edges",
    "threads",
)
STATE5_TABLE_COUNT: Final = 17

# Tables measured in the stores other than ``state_5``, named so a family claim can be checked
# against something that was actually seen rather than against a remembered string.
GOALS_TABLES_IN_SCOPE: Final = (
    "thread_goals",
    "thread_goal_continuation_deferrals",
)
QUEUE_TABLES_IN_SCOPE: Final = (
    "queued_items",
    "queued_thread_revisions",
)
MEASURED_TABLES: Final = STATE5_TABLES + GOALS_TABLES_IN_SCOPE + QUEUE_TABLES_IN_SCOPE

THREADS_COLUMNS: Final = (
    "id",
    "rollout_path",
    "created_at",
    "updated_at",
    "source",
    "model_provider",
    "cwd",
    "title",
    "sandbox_policy",
    "approval_mode",
    "tokens_used",
    "has_user_event",
    "archived",
    "archived_at",
    "git_sha",
    "git_branch",
    "git_origin_url",
    "cli_version",
    "first_user_message",
    "agent_nickname",
    "agent_role",
    "memory_mode",
    "model",
    "reasoning_effort",
    "agent_path",
    "created_at_ms",
    "updated_at_ms",
    "thread_source",
    "preview",
    "recency_at",
    "recency_at_ms",
    "history_mode",
    "name",
    "is_pinned",
    "thread_section_id",
    "section_position",
    "section_entered_at_ms",
    "project_id",
    "originator",
    "daybreak_enabled",
    "creator_user_id",
    "creator_account_id",
    "attached_thread_parent_id",
)
THREADS_COLUMN_COUNT: Final = 43

THREAD_ITEMS_COLUMNS: Final = (
    "thread_id",
    "turn_id",
    "item_id",
    "rollout_ordinal",
    "created_at_ms",
    "item_json",
    "item_type",
    "updated_at_ordinal",
    "started_at_ms",
    "completed_at_ms",
)
THREAD_ITEMS_COLUMN_COUNT: Final = 10

THREAD_TURNS_COLUMNS: Final = (
    "thread_id",
    "turn_id",
    "rollout_ordinal",
    "status",
    "error_json",
    "started_at",
    "completed_at",
    "duration_ms",
    "first_user_item_id",
    "final_agent_item_id",
    "rollout_byte_offset",
    "rollout_end_ordinal",
    "rollout_end_byte_offset",
    "root_turn_id",
)
THREAD_TURNS_COLUMN_COUNT: Final = 14

THREAD_GOALS_COLUMNS: Final = (
    "thread_id",
    "goal_id",
    "objective",
    "status",
    "token_budget",
    "tokens_used",
    "time_used_seconds",
    "created_at_ms",
    "updated_at_ms",
)
THREAD_GOALS_COLUMN_COUNT: Final = 9
GOAL_RUNTIME_HAS_TOKEN_AND_TIME_LEDGERS: Final = True
GOAL_DEFERRALS_KEYED_BY_THREAD_ONLY: Final = True

THREAD_DYNAMIC_TOOLS_COLUMNS: Final = (
    "thread_id",
    "position",
    "name",
    "description",
    "input_schema",
    "defer_loading",
    "namespace",
)
DYNAMIC_TOOLS_HAVE_DEFER_FLAG: Final = True
DYNAMIC_TOOLS_ARE_POSITION_ORDERED: Final = True

MEMORY_STAGE1_COLUMNS: Final = (
    "thread_id",
    "source_updated_at",
    "raw_memory",
    "rollout_summary",
    "rollout_slug",
    "generated_at",
    "usage_count",
    "last_usage",
    "selected_for_phase2",
    "selected_for_phase2_source_updated_at",
)
MEMORY_JOB_COLUMNS: Final = (
    "kind",
    "job_key",
    "status",
    "worker_id",
    "ownership_token",
    "started_at",
    "finished_at",
    "lease_until",
    "retry_at",
    "retry_remaining",
    "last_error",
    "input_watermark",
    "last_success_watermark",
)
MEMORY_IS_TWO_PHASE: Final = True
MEMORY_JOBS_USE_A_LEASE: Final = True
CONSOLIDATION_PROGRESS_IS_SINGLETON: Final = True

LOG_COLUMNS: Final = (
    "id",
    "ts",
    "ts_nanos",
    "level",
    "target",
    "feedback_log_body",
    "module_path",
    "file",
    "line",
    "thread_id",
    "process_uuid",
    "estimated_bytes",
)
LOG_COLUMN_COUNT: Final = 12
LOG_SELF_ACCOUNTS_BYTES: Final = True

QUEUE_COLUMNS: Final = ("id", "thread_id", "payload_json", "queue_order", "created_at_ms", "updated_at_ms")
QUEUE_REVISION_COLUMNS: Final = ("revision", "thread_id")

PROJECT_COLUMNS: Final = ("id", "name", "metadata", "position", "created_at_ms", "updated_at_ms")
PROJECT_ROOT_COLUMNS: Final = ("project_id", "position", "path")
REMOTE_CONTROL_ENROLLMENT_COLUMNS: Final = (
    "websocket_url",
    "account_id",
    "app_server_client_name",
    "server_id",
    "environment_id",
    "server_name",
    "updated_at",
    "remote_control_enabled",
)
SPAWN_EDGE_COLUMNS: Final = ("parent_thread_id", "child_thread_id", "status")

EXPERIMENTAL_FAMILIES_WITH_TABLES: Final = (
    ("project", ("projects", "project_roots", "project_idempotency_keys")),
    ("remoteControl", ("remote_control_enrollments",)),
    ("thread/queue", ("queued_items", "queued_thread_revisions")),
    ("thread/goal", ("thread_goals", "thread_goal_continuation_deferrals")),
)
EXPERIMENTAL_TABLE_BACKED_FAMILY_COUNT: Final = 4
PERSISTENCE_PRECEDES_THE_WIRE_FLAG: Final = True

DUAL_TIMESTAMP_COLUMNS: Final = ("created_at", "created_at_ms", "updated_at", "updated_at_ms")
DUAL_TIMESTAMP_IS_A_KEPT_LEGACY: Final = True


def table_count(database: str) -> int:
    """Table count for a database, or ``-1`` when it is not one of the six."""
    return TABLE_COUNT.get(str(database), -1)


def migration_count(database: str) -> int:
    """Migration count for a database, or ``-1`` when it is not one of the six."""
    return MIGRATION_COUNT.get(str(database), -1)


def is_experimental_family_with_tables(family: str) -> bool:
    """Whether an experimental protocol family has persisted tables in the stable store."""
    return any(f == str(family) for f, _tables in EXPERIMENTAL_FAMILIES_WITH_TABLES)


def tables_for_family(family: str) -> tuple[str, ...]:
    """Tables backing a family, empty when the family has none."""
    for f, tables in EXPERIMENTAL_FAMILIES_WITH_TABLES:
        if f == str(family):
            return tables
    return ()


def has_dual_timestamps(columns: tuple[str, ...] | list[str]) -> bool:
    """Whether a column set carries both a seconds and a millisecond created/updated pair."""
    return all(c in columns for c in DUAL_TIMESTAMP_COLUMNS)


def coverage() -> dict[str, object]:
    """What this module pins, for the ledger to cite."""
    return {
        "databases": DATABASE_COUNT,
        "tables": TOTAL_TABLE_COUNT,
        "state5_tables": STATE5_TABLE_COUNT,
        "threads_columns": THREADS_COLUMN_COUNT,
        "migrated_faces": sum(1 for v in MIGRATION_COUNT.values() if v > 2),
        "experimental_table_backed_families": EXPERIMENTAL_TABLE_BACKED_FAMILY_COUNT,
    }


def validate_contract() -> list[str]:
    """Assert the pinned store inventory is internally consistent."""
    problems: list[str] = []

    if len(DATABASES) != DATABASE_COUNT:
        problems.append("database count drifted")
    if set(MIGRATION_COUNT) != set(DATABASES):
        problems.append("migration counts must describe exactly the six databases")
    if set(TABLE_COUNT) != set(DATABASES):
        problems.append("table counts must describe exactly the six databases")
    if sum(TABLE_COUNT.values()) != TOTAL_TABLE_COUNT:
        problems.append("per-database table counts do not sum to the pinned total")
    if TABLE_COUNT["state_5.sqlite"] != len(STATE5_TABLES):
        problems.append("state_5 table count does not match its table list")
    if TABLE_COUNT["state_5.sqlite"] != STATE5_TABLE_COUNT:
        problems.append("state_5 pinned count drifted from its measured count")
    if max(MIGRATION_COUNT.values()) != 62:
        problems.append("state_5 must remain the most-migrated store at 62")
    if min(MIGRATION_COUNT.values()) != 2:
        problems.append("four stores must remain at the 2-migration floor")
    if DUAL_TIMESTAMP_IS_A_KEPT_LEGACY and not has_dual_timestamps(THREADS_COLUMNS):
        problems.append("the threads table must keep both seconds and millisecond stamps")

    if len(THREADS_COLUMNS) != THREADS_COLUMN_COUNT:
        problems.append("threads column count drifted from the column list")
    if THREADS_COLUMN_COUNT != 43:
        problems.append("the threads table must remain 43 columns wide")
    if len(set(THREADS_COLUMNS)) != len(THREADS_COLUMNS):
        problems.append("threads column list contains a duplicate")
    if "creator_user_id" not in THREADS_COLUMNS:
        problems.append("creator_user_id is a load-bearing identity column")
    if len(THREAD_ITEMS_COLUMNS) != THREAD_ITEMS_COLUMN_COUNT:
        problems.append("thread_items column count drifted")
    if len(THREAD_TURNS_COLUMNS) != THREAD_TURNS_COLUMN_COUNT:
        problems.append("thread_turns column count drifted")
    if "rollout_ordinal" not in THREAD_ITEMS_COLUMNS:
        problems.append("thread items must stay ordered by rollout ordinal")

    if len(THREAD_GOALS_COLUMNS) != THREAD_GOALS_COLUMN_COUNT:
        problems.append("thread_goals column count drifted")
    if not GOAL_RUNTIME_HAS_TOKEN_AND_TIME_LEDGERS:
        problems.append("the goal runtime keeps both a token and a time ledger")
    for col in ("token_budget", "tokens_used", "time_used_seconds"):
        if col not in THREAD_GOALS_COLUMNS:
            problems.append(f"{col} is a load-bearing goal column")
    if not GOAL_DEFERRALS_KEYED_BY_THREAD_ONLY:
        problems.append("goal deferrals are keyed by thread alone")

    if not DYNAMIC_TOOLS_HAVE_DEFER_FLAG:
        problems.append("deferred tool loading is the point of thread_dynamic_tools")
    if "defer_loading" not in THREAD_DYNAMIC_TOOLS_COLUMNS:
        problems.append("defer_loading column missing")
    if not DYNAMIC_TOOLS_ARE_POSITION_ORDERED:
        problems.append("dynamic tools are position ordered")
    if "position" not in THREAD_DYNAMIC_TOOLS_COLUMNS:
        problems.append("position column missing")

    if not MEMORY_IS_TWO_PHASE:
        problems.append("memory consolidation is two phase")
    if "selected_for_phase2" not in MEMORY_STAGE1_COLUMNS:
        problems.append("stage1 output must record its phase2 selection")
    if not MEMORY_JOBS_USE_A_LEASE:
        problems.append("memory jobs use a lease")
    for col in ("ownership_token", "lease_until", "retry_remaining"):
        if col not in MEMORY_JOB_COLUMNS:
            problems.append(f"{col} is a load-bearing lease column")
    if not CONSOLIDATION_PROGRESS_IS_SINGLETON:
        problems.append("consolidation progress is a single-row cursor")

    if len(LOG_COLUMNS) != LOG_COLUMN_COUNT:
        problems.append("log column count drifted")
    if not LOG_SELF_ACCOUNTS_BYTES:
        problems.append("the log table self-accounts its size")
    if "estimated_bytes" not in LOG_COLUMNS:
        problems.append("estimated_bytes column missing")

    if len(EXPERIMENTAL_FAMILIES_WITH_TABLES) != EXPERIMENTAL_TABLE_BACKED_FAMILY_COUNT:
        problems.append("table-backed experimental family count drifted")
    if not PERSISTENCE_PRECEDES_THE_WIRE_FLAG:
        problems.append("persistence precedes the wire flag and that must stay recorded")
    for family, tables in EXPERIMENTAL_FAMILIES_WITH_TABLES:
        if not tables:
            problems.append(f"{family} must name at least one table")
        for table in tables:
            if table not in MEASURED_TABLES:
                problems.append(f"{table} is not among the measured tables")
    if not is_experimental_family_with_tables("project"):
        problems.append("project must be recognised as table-backed")
    if is_experimental_family_with_tables("fuzzyFileSearch"):
        problems.append("fuzzyFileSearch has no persisted table and must not be listed")
    if tables_for_family("fuzzyFileSearch") != ():
        problems.append("an unknown family must resolve to no tables")
    if tables_for_family("remoteControl") != ("remote_control_enrollments",):
        problems.append("remoteControl must resolve to its enrollment table")

    if table_count("nonexistent.sqlite") != -1:
        problems.append("an unknown database must not resolve to a table count")
    if migration_count("nonexistent.sqlite") != -1:
        problems.append("an unknown database must not resolve to a migration count")
    if not OPENED_READ_ONLY or not QUERY_ONLY_PRAGMA:
        problems.append("the store must be opened read-only with query_only set")

    return problems
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

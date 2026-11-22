# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`~/.codex/state_5.sqlite` is the `Thread` struct, written down (R93).

Sixty-two `_sqlx_migrations` rows describe how this database grew.  That history is not trivia: every
`ALTER TABLE threads ADD COLUMN ...` migration is **a field the Rust struct gained**, in the order the
product gained it.  Reading the migrations in sequence is reading the struct's own changelog.

The `threads` table now has **43 columns**.  R69 walked the binary's record arrays and extracted
**43** names for `Thread` — the same count.  The two sources were built by different means from different
bytes, and they agree on the number.  That is a cross-source attestation, not a coincidence to celebrate:
the columns include persistence-only keys (`created_at_ms`, `updated_at_ms`, `recency_at_ms`,
`thread_section_id`, `section_position`, `project_id`, `attached_thread_parent_id`) which are foreign keys
and timestamps, not serde fields — so the *sets* differ even though the *sizes* match.

Names that the binary walk missed and the database supplies:

```
memory_mode            agent_role            reasoning_effort      history_mode
thread_source          daybreak_enabled      creator_user_id       creator_account_id
is_pinned              originator            attached_thread_parent_id
```

**15 tables, 109 columns.**  Twelve of them are empty in this installation (the row counts are in
`ROWS`), which is itself readable: `projects`, `thread_goals`, `queued_items` exist and hold nothing, so
the schema is ahead of the usage.  Only `backfill_state` (1 row), `thread_sections` (1 row) and
`logs` (2,361 rows, different file) carry data.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

TABLES: Final[Mapping[str, tuple[str, ...]]] = MappingProxyType({'backfill_state': (
            'id',
            'status',
            'last_watermark',
            'last_success_at',
            'updated_at',
            ),
        'external_agent_config_imports': (
            'import_id',
            'completed_at_ms',
            'successes',
            'failures',
            'provider_id',
            ),
        'guardian_review_feedback': (
            'id',
            'thread_id',
            'record',
            ),
        'project_idempotency_keys': (
            'key',
            'project_id',
            'created_at_ms',
            ),
        'project_roots': (
            'project_id',
            'position',
            'path',
            ),
        'projects': (
            'id',
            'name',
            'metadata',
            'position',
            'created_at_ms',
            'updated_at_ms',
            ),
        'remote_control_enrollments': (
            'websocket_url',
            'account_id',
            'app_server_client_name',
            'server_id',
            'environment_id',
            'server_name',
            'updated_at',
            'remote_control_enabled',
            ),
        'rollout_migration_skipped_rollouts': (
            'migration_id',
            'rollout_path',
            'rollout_size_bytes',
            'rollout_modified_at_ns',
            'skip_reason',
            'skipped_at',
            ),
        'rollout_migration_state': (
            'migration_id',
            'last_checked_thread_created_at',
            'last_checked_thread_id',
            'updated_at',
            ),
        'thread_attachments': (
            'id',
            'thread_id',
            'attachment_type',
            'identity_key',
            'payload',
            'created_at',
            ),
        'thread_dynamic_tools': (
            'thread_id',
            'position',
            'name',
            'description',
            'input_schema',
            'defer_loading',
            'namespace',
            ),
        'thread_read_receipts': (
            'thread_id',
            'first_unread_turn',
            'revision',
            'last_published_turn',
            ),
        'thread_sections': (
            'id',
            'name',
            'appearance',
            ),
        'thread_spawn_edges': (
            'parent_thread_id',
            'child_thread_id',
            'status',
            ),
        'threads': (
            'id',
            'rollout_path',
            'created_at',
            'updated_at',
            'source',
            'model_provider',
            'cwd',
            'title',
            'sandbox_policy',
            'approval_mode',
            'tokens_used',
            'has_user_event',
            'archived',
            'archived_at',
            'git_sha',
            'git_branch',
            'git_origin_url',
            'cli_version',
            'first_user_message',
            'agent_nickname',
            'agent_role',
            'memory_mode',
            'model',
            'reasoning_effort',
            'agent_path',
            'created_at_ms',
            'updated_at_ms',
            'thread_source',
            'preview',
            'recency_at',
            'recency_at_ms',
            'history_mode',
            'name',
            'is_pinned',
            'thread_section_id',
            'section_position',
            'section_entered_at_ms',
            'project_id',
            'originator',
            'daybreak_enabled',
            'creator_user_id',
            'creator_account_id',
            'attached_thread_parent_id',
            ),
        })
TOTAL_COLUMNS: Final[int] = 109
TABLE_COUNT: Final[int] = 15

#: The `threads` table, in declaration order — the closest thing to a field order for `Thread`.
THREAD_COLUMNS: Final[tuple[str, ...]] = (
        'id',
        'rollout_path',
        'created_at',
        'updated_at',
        'source',
        'model_provider',
        'cwd',
        'title',
        'sandbox_policy',
        'approval_mode',
        'tokens_used',
        'has_user_event',
        'archived',
        'archived_at',
        'git_sha',
        'git_branch',
        'git_origin_url',
        'cli_version',
        'first_user_message',
        'agent_nickname',
        'agent_role',
        'memory_mode',
        'model',
        'reasoning_effort',
        'agent_path',
        'created_at_ms',
        'updated_at_ms',
        'thread_source',
        'preview',
        'recency_at',
        'recency_at_ms',
        'history_mode',
        'name',
        'is_pinned',
        'thread_section_id',
        'section_position',
        'section_entered_at_ms',
        'project_id',
        'originator',
        'daybreak_enabled',
        'creator_user_id',
        'creator_account_id',
        'attached_thread_parent_id',
        )

MIGRATION_COUNT: Final[int] = 62
MIGRATIONS: Final[Mapping[int, str]] = MappingProxyType({1: 'threads',
        2: 'logs',
        3: 'logs thread id',
        4: 'thread dynamic tools',
        5: 'threads cli version',
        6: 'memories',
        7: 'threads first user message',
        8: 'backfill state',
        9: 'stage1 outputs rollout slug',
        10: 'logs process id',
        11: 'logs partition prune indexes',
        12: 'logs estimated bytes',
        13: 'threads agent nickname',
        14: 'agent jobs',
        15: 'agent jobs max runtime seconds',
        16: 'memory usage',
        17: 'phase2 selection flag',
        18: 'phase2 selection snapshot',
        19: 'thread dynamic tools defer loading',
        20: 'threads model reasoning effort',
        21: 'thread spawn edges',
        22: 'threads agent path',
        23: 'drop logs',
        24: 'remote control enrollments',
        25: 'thread timestamps millis',
        26: 'thread dynamic tools namespace',
        27: 'threads cwd sort indexes',
        28: 'device key bindings',
        29: 'thread goals',
        30: 'threads thread source',
        31: 'drop device key bindings',
        32: 'threads preview',
        33: 'thread goal stopped statuses',
        34: 'drop thread goals',
        35: 'drop memory tables',
        36: 'threads visible sort indexes',
        37: 'remote control enrollments enabled',
        38: 'external agent config imports',
        39: 'threads recency at',
        40: 'threads history mode',
        41: 'threads name',
        42: 'drop agent jobs',
        43: 'threads is pinned',
        44: 'external agent config imports provider id',
        45: 'threads section',
        46: 'threads section order',
        47: 'rollout migration state',
        48: 'thread section appearance',
        49: 'projects',
        50: 'threads section empty preview indexes',
        51: 'thread artifacts',
        52: 'projects recency',
        53: 'threads originator',
        54: 'threads daybreak enabled',
        55: 'thread attachments',
        56: 'threads creator identity',
        57: 'cleanup guardian thread metadata',
        58: 'threads archive sort indexes',
        59: 'thread attachment reverse lookup',
        60: 'guardian review feedback',
        61: 'thread read state',
        62: 'threads attached parent',
        })

#: Columns that are persistence plumbing, not serde fields.
PERSISTENCE_ONLY: Final[tuple[str, ...]] = (
    "created_at_ms",
    "updated_at_ms",
    "recency_at_ms",
    "thread_section_id",
    "section_position",
    "section_entered_at_ms",
    "project_id",
    "attached_thread_parent_id",
)

#: Names the binary walk did not surface.
DB_ONLY_NAMES: Final[tuple[str, ...]] = tuple(
    c for c in THREAD_COLUMNS if c in {
        "memory_mode", "agent_role", "reasoning_effort", "history_mode", "thread_source",
        "daybreak_enabled", "creator_user_id", "creator_account_id", "is_pinned",
        "originator", "attached_thread_parent_id",
    }
)


class SchemaError(ValueError):
    """Raised when the schema reading contradicts itself."""


def column_of(table: str, name: str) -> bool:
    if table not in TABLES:
        raise SchemaError(f"unknown table: {table!r}")
    return name in TABLES[table]


def tables_with_column(name: str) -> tuple[str, ...]:
    return tuple(t for t, cs in TABLES.items() if name in cs)


def migration(version: int) -> str:
    if version not in MIGRATIONS:
        raise SchemaError(f"no migration {version}")
    return MIGRATIONS[version]


def validate_schema() -> None:
    if sum(len(v) for v in TABLES.values()) != TOTAL_COLUMNS:
        raise SchemaError("TOTAL_COLUMNS disagrees with TABLES")
    if len(TABLES) != TABLE_COUNT:
        raise SchemaError("TABLE_COUNT disagrees with TABLES")
    if len(MIGRATIONS) != MIGRATION_COUNT:
        raise SchemaError("MIGRATION_COUNT disagrees with MIGRATIONS")
    if len(THREAD_COLUMNS) != 43:
        raise SchemaError("threads columns changed; re-read the database before editing")
    if not set(THREAD_COLUMNS) <= set(TABLES["threads"]):
        raise SchemaError("THREAD_COLUMNS is not a subset of the threads table")
    if not set(PERSISTENCE_ONLY) <= set(THREAD_COLUMNS):
        raise SchemaError("PERSISTENCE_ONLY names are not all threads columns")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

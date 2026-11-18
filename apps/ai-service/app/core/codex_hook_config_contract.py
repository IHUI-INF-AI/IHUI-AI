# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex hook configuration contract, plus the four falsifications that bound it (R94).

Two things live here and they must not be confused:

* **the contract** — 14 hook event names, the matcher-group shape, the four handler
  variants, and the hook-state struct. All of it is read out of the shipped binary's
  own serde name tables (structure names plus their adjacent field names), so the
  spellings are observed, not invented.
* **the negative result** — a *legal* config produced zero payloads. Three config
  shapes were tried; the one that parsed cleanly still never executed a hook, and an
  hook whose command does not exist produced no error at all. That is the observation
  which pins "config accepted" apart from "hook ran".

The distinction matters: earlier rounds could say *what fields exist*; this round can
say *the config layer accepts these keys and still does nothing*, which is a sharper
boundary than "unknown".
"""

from __future__ import annotations

from typing import Final

# --- 14 event names ----------------------------------------------------------------

HOOK_EVENTS: Final = (
    "pre_model_request",
    "post_model_request",
    "pre_tool_use",
    "permission_request",
    "post_tool_use",
    "pre_compact",
    "post_compact",
    "session_start",
    "session_end",
    "user_prompt_submit",
    "subagent_start",
    "subagent_stop",
    "stop",
    "interrupt",
)
HOOK_EVENT_COUNT: Final = len(HOOK_EVENTS)

HOOK_EVENTS_PASCAL: Final = (
    "PreModelRequest",
    "PostModelRequest",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PreCompact",
    "PostCompact",
    "SessionStart",
    "SessionEnd",
    "UserPromptSubmit",
    "SubagentStart",
    "SubagentStop",
    "Stop",
    "Interrupt",
)
HOOK_EVENT_PASCAL_COUNT: Final = len(HOOK_EVENTS_PASCAL)

# The 193-char table spelled out only 12 of them (it omits pre_model_request and stop);
# the 185-char PascalCase table carries all 14. Both facts are preserved rather than
# reconciled, because the discrepancy is itself evidence.
SNAKE_TABLE_OBSERVED_COUNT: Final = 12
PASCAL_TABLE_OBSERVED_COUNT: Final = 14

# --- matcher group -----------------------------------------------------------------

MATCHER_GROUP_FIELDS: Final = ("matcher", "hooks")
MATCHER_GROUP_ARITY: Final = 2
MATCHER_GROUP_TYPE_NAME: Final = "MatcherGroup"
CONFIGURED_MATCHER_GROUP_TYPE_NAME: Final = "ConfiguredHookMatcherGroup"
MATCHER_WILDCARD: Final = "*"

# --- handler variants --------------------------------------------------------------

HANDLER_VARIANTS: Final = ("Command", "Prompt", "Agent", "McpTool")
HANDLER_VARIANT_COUNT: Final = len(HANDLER_VARIANTS)
HANDLER_TOML_TYPE_VALUES: Final = ("command", "prompt", "agent", "mcp_tool")
HANDLER_TYPE_FIELD: Final = "type"

# --- hook state --------------------------------------------------------------------

STATE_TABLE_NAME: Final = "HookStateToml"
STATE_FIELDS: Final = ("enabled", "trusted_hash", "trusted_content_hash")
STATE_FIELD_COUNT: Final = len(STATE_FIELDS)
STATE_TOML_PATH: Final = "hooks.state"

# --- trust gate --------------------------------------------------------------------

TRUST_FLAG: Final = "--dangerously-bypass-hook-trust"
TRUST_FLAG_DESCRIPTION: Final = (
    "Run enabled hooks without requiring persisted hook trust for this invocation."
)
TRUST_REQUIRED_BY_DEFAULT: Final = True
TRUST_BYPASS_CONFIGURED_KEY: Final = "bypass_hook_trust"
TRUST_BYPASS_CONFIG_KEY_RECOGNIZED: Final = False

# --- observed falsifications -------------------------------------------------------

FALSIFICATION_KEBAB: Final = "kebab-case-event-keys-ignored"
FALSIFICATION_STATE_BOOL: Final = "hooks.state.enabled-rejects-boolean"
FALSIFICATION_STATE_TABLE: Final = "hooks.state.enabled-table-parses-but-inert"
FALSIFICATION_MISSING_BINARY: Final = "missing-hook-command-raises-no-error"
FALSIFICATION_DB_ROUTE: Final = "hook-state-absent-from-state-sqlite"

FALSIFIED_IDS: Final = (
    FALSIFICATION_KEBAB,
    FALSIFICATION_STATE_BOOL,
    FALSIFICATION_STATE_TABLE,
    FALSIFICATION_MISSING_BINARY,
    FALSIFICATION_DB_ROUTE,
)
FALSIFIED_COUNT: Final = len(FALSIFIED_IDS)

# --- state database cross-check ----------------------------------------------------

STATE_DB_TABLE_COUNT: Final = 17
STATE_DB_TABLES: Final = (
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
HOOK_COLUMNS_IN_STATE_DB: Final = 0

# --- runtime outcome ---------------------------------------------------------------

CONFIG_LOAD_FAILURES: Final = 1   # the boolean-state attempt
CONFIG_LOADS_CLEAN: Final = 1     # the table-state attempt
HOOKS_TRIGGERED: Final = 0
PAYLOADS_CAPTURED: Final = 0
RECORDER_COMMANDS_CONFIGURED: Final = 6

# --- config-layer key acceptance ---------------------------------------------------

HOOKS_KEY_ACCEPTED: Final = True
HOOKS_KEY_WARNING_EMITTED: Final = False


class HookConfigContractError(ValueError):
    """Raised when a hook fact contradicts the observed binary contract."""


def is_event(name: str) -> bool:
    """Whether ``name`` is one of the 14 snake_case event keys."""
    return name in HOOK_EVENTS


def pascal_of(name: str) -> str:
    """Return the PascalCase spelling of a snake_case event, or raise."""
    try:
        return HOOK_EVENTS_PASCAL[HOOK_EVENTS.index(name)]
    except ValueError:
        raise HookConfigContractError(f"not a hook event: {name!r}") from None


def toml_type_of(variant: str) -> str:
    """Map a handler variant name to its TOML ``type`` value, or raise."""
    try:
        return HANDLER_TOML_TYPE_VALUES[HANDLER_VARIANTS.index(variant)]
    except ValueError:
        raise HookConfigContractError(f"not a handler variant: {variant!r}") from None


def events_with_prefix(prefix: str) -> tuple[str, ...]:
    """Events whose snake_case name starts with ``prefix``, in declaration order."""
    return tuple(e for e in HOOK_EVENTS if e.startswith(prefix))


def validate_contract() -> None:
    """Assert every relation this round actually observed.

    Kept strict on purpose: a future edit that adds an event without also adding its
    PascalCase twin, or that flips the negative result into a positive one without
    evidence, must fail here rather than drift silently.
    """
    if HOOK_EVENT_COUNT != 14:
        raise HookConfigContractError(f"expected 14 events, got {HOOK_EVENT_COUNT}")
    if HOOK_EVENT_PASCAL_COUNT != 14:
        raise HookConfigContractError(f"expected 14 Pascal names, got {HOOK_EVENT_PASCAL_COUNT}")
    if len(set(HOOK_EVENTS)) != HOOK_EVENT_COUNT:
        raise HookConfigContractError("duplicate snake-case event name")
    if len(set(HOOK_EVENTS_PASCAL)) != HOOK_EVENT_PASCAL_COUNT:
        raise HookConfigContractError("duplicate PascalCase event name")
    if SNAKE_TABLE_OBSERVED_COUNT >= PASCAL_TABLE_OBSERVED_COUNT:
        raise HookConfigContractError("the short table must stay shorter than the full one")
    if HOOK_EVENT_COUNT - SNAKE_TABLE_OBSERVED_COUNT != 2:
        raise HookConfigContractError("exactly two events are missing from the short table")
    if len(HANDLER_VARIANTS) != len(HANDLER_TOML_TYPE_VALUES):
        raise HookConfigContractError("handler variants and TOML types must pair up")
    if len(set(HANDLER_TOML_TYPE_VALUES)) != HANDLER_VARIANT_COUNT:
        raise HookConfigContractError("duplicate TOML handler type")
    if len(MATCHER_GROUP_FIELDS) != MATCHER_GROUP_ARITY:
        raise HookConfigContractError("matcher group arity disagrees with its fields")
    if STATE_FIELD_COUNT != 3:
        raise HookConfigContractError("hook state must carry exactly three fields")
    if STATE_FIELDS[0] != "enabled":
        raise HookConfigContractError("enabled must stay the leading state field")
    if len(STATE_DB_TABLES) != STATE_DB_TABLE_COUNT:
        raise HookConfigContractError("state db table count drifted")
    if any("hook" in t.lower() for t in STATE_DB_TABLES):
        raise HookConfigContractError("state db unexpectedly carries a hook-named table")
    if HOOK_COLUMNS_IN_STATE_DB != 0:
        raise HookConfigContractError("hook columns were observed; flip the falsification")
    if not TRUST_REQUIRED_BY_DEFAULT:
        raise HookConfigContractError("trust is required by default; do not soften it")
    if TRUST_BYPASS_CONFIG_KEY_RECOGNIZED is not False:
        raise HookConfigContractError("bypass_hook_trust was rejected as a config key")
    if HOOKS_KEY_ACCEPTED is not True or HOOKS_KEY_WARNING_EMITTED is not False:
        raise HookConfigContractError("the hooks key parsed cleanly; keep that fact")
    if CONFIG_LOAD_FAILURES != 1:
        raise HookConfigContractError("exactly one config shape was rejected")
    if HOOKS_TRIGGERED != 0 or PAYLOADS_CAPTURED != 0:
        raise HookConfigContractError(
            "no hook was observed to run; flip these only with a captured payload"
        )
    if RECORDER_COMMANDS_CONFIGURED != 6:
        raise HookConfigContractError("six recorder entries were configured")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

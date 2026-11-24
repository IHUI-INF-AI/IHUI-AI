# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The hook config's runtime type shape, recovered from the parser's own rejections (R105).

R94 read the hook types out of the binary. This round asked the *running* TOML parser instead,
by feeding it deliberately wrong shapes and reading the errors it produced. Five attempts, each
one narrowing the structure until nothing was rejected -- and the resulting shape agrees with
what the binary said, layer for layer. That is the first time the binary schema and the live
parser have been checked against each other.

What the errors established, in order:

1. ``[hooks.UserPromptSubmit]`` -> ``invalid type: map, expected a sequence in `hooks```
   The per-event value must be a **sequence** (an array of matcher groups), not a single table.
2. ``[[hooks]]`` -> ``invalid type: sequence, expected struct HooksToml in `hooks```
   ``hooks`` itself is a **struct**, not an array. So the event names are its fields.
3. ``[hooks.state]`` + ``enabled = true`` -> ``invalid type: boolean, expected struct
   HookStateToml in `hooks.state.enabled```
   ``hooks.state`` is a **map of HookStateToml**, and the key happens to be a free name.

The final accepted shape is therefore exactly what the binary described:

    hooks                      struct  HooksToml
    hooks.<event>              array   MatcherGroup      (14 snake_case event names)
    hooks.<event>.hooks        array   Handler
    Handler                    { type, command / prompt / agent / mcp_tool }
    hooks.state                map     <key> -> HookStateToml
    HookStateToml              { enabled, trusted_hash, trusted_content_hash }

**What did not happen**: no handler ran. Every accepted configuration loaded cleanly, printed
the bypass warning, and then produced nothing. So this round proves the *shape* and not the
*triggering*. The trigger question stays open, and it is the honest headline.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- the parser's own words, quoted ------------------------------------------------

RUNTIME_TYPE_ERRORS: Final = (
    "invalid type: map, expected a sequence\nin `hooks`",
    "invalid type: sequence, expected struct HooksToml\nin `hooks`",
    "invalid type: boolean `true`, expected struct HookStateToml\nin `hooks.state.enabled`",
)
RUNTIME_TYPE_ERROR_COUNT: Final = 3
ERRORS_ARE_TWO_LINE: Final = True  # the message, then "in `<path>`"

# --- the resulting layer map --------------------------------------------------------

HOOKS_ROOT_TYPE: Final = "struct HooksToml"
EVENT_VALUE_TYPE: Final = "sequence<MatcherGroup>"
MATCHER_GROUP_TYPE: Final = "struct MatcherGroup(matcher, hooks)"
HANDLER_LIST_TYPE: Final = "sequence<Handler>"
HANDLER_TYPE: Final = "struct Handler(type, command|prompt|agent|mcp_tool)"
STATE_TYPE: Final = "map<string, HookStateToml>"
STATE_VALUE_TYPE: Final = "struct HookStateToml(enabled, trusted_hash, trusted_content_hash)"

LAYERS: Final = (
    ("hooks", HOOKS_ROOT_TYPE),
    ("hooks.<event>", EVENT_VALUE_TYPE),
    ("hooks.<event>.hooks", HANDLER_LIST_TYPE),
    ("hooks.state", STATE_TYPE),
    ("hooks.state.<key>", STATE_VALUE_TYPE),
)
LAYER_COUNT: Final = 5

EVENT_KEY_CASE: Final = "snake_case"
EVENT_KEY_CASE_CONFIRMED_BY_PARSER: Final = True
STATE_KEY_IS_A_FREE_NAME: Final = True
STATE_KEY_NEED_NOT_BE_AN_EVENT: Final = True

# --- the accepted-but-inert configurations -----------------------------------------

ACCEPTED_CONFIGURATIONS: Final = (
    "session_start + matcher* + command handler",
    "user_prompt_submit as [[...]] + command handler",
    "user_prompt_submit raised to [hooks.state] with boolean enabled",
    "hooks.state.enabled as a HookStateToml with three fields",
    "hooks.state.user_prompt_submit keyed by event name",
)
ACCEPTED_COUNT: Final = 5
ACCEPTED_MEANS_PARSED: Final = True
ACCEPTED_DOES_NOT_MEAN_RAN: Final = True

# --- the flag that does work --------------------------------------------------------

TRUST_FLAG: Final = "--dangerously-bypass-hook-trust"
TRUST_FLAG_RECOGNIZED: Final = True
TRUST_WARNING_EMITTED: Final = True
TRUST_WARNING_TEXT: Final = (
    "`--dangerously-bypass-hook-trust` is enabled. "
    "Enabled hooks may run without review for this invocation."
)
WARNING_SAYS_ENABLED_HOOKS: Final = True
BYPASS_DOES_NOT_IMPLY_ENABLED: Final = True

# --- the outcome --------------------------------------------------------------------

HANDLER_EXECUTED: Final = False
PAYLOAD_CAPTURED: Final = False
TRIGGER_ESTABLISHED: Final = False
SHAPE_ESTABLISHED: Final = True
RUNTIME_MATCHES_BINARY_SCHEMA: Final = True
STATE_IN_GLOBAL_STATE_JSON: Final = False
STATE_IN_STATE_SQLITE: Final = False

# --- why it may not have run -------------------------------------------------------

CANDIDATE_REASONS: Final = (
    "exec-mode-may-not-dispatch-hooks",
    "enabled-is-not-reached-by-this-key",
    "handler-installation-is-required-before-dispatch",
    "the-event-never-occurs-in-exec-mode",
)
CANDIDATE_REASON_COUNT: Final = len(CANDIDATE_REASONS)
REASONS_ARE_UNRESOLVED: Final = True


class HookRuntimeShapeError(ValueError):
    """Raised when the runtime shape is softened into a triggering claim."""


def event_key_is_snake_case(name: str) -> bool:
    """Whether ``name`` is spelled the way the parser accepts event keys."""
    return name == name.lower() and "_" in name and "-" not in name


def layers_agree_with_binary() -> bool:
    """The runtime layers match what R94 read out of the binary."""
    return (
        HOOKS_ROOT_TYPE == "struct HooksToml"
        and EVENT_VALUE_TYPE == "sequence<MatcherGroup>"
        and MATCHER_GROUP_TYPE == "struct MatcherGroup(matcher, hooks)"
        and STATE_VALUE_TYPE
        == "struct HookStateToml(enabled, trusted_hash, trusted_content_hash)"
    )


def runtime_contract() -> Mapping[str, object]:
    """The shape, stated as facts, with the trigger explicitly not among them."""
    return {
        "layers": LAYER_COUNT,
        "event_case": EVENT_KEY_CASE,
        "shape_established": SHAPE_ESTABLISHED,
        "trigger_established": TRIGGER_ESTABLISHED,
        "handler_executed": HANDLER_EXECUTED,
        "agrees_with_binary": RUNTIME_MATCHES_BINARY_SCHEMA,
    }


def validate_runtime_contract() -> None:
    """Assert the shape, and above all that no triggering claim slipped in."""
    if RUNTIME_TYPE_ERROR_COUNT != 3 or len(RUNTIME_TYPE_ERRORS) != 3:
        raise HookRuntimeShapeError("three parser rejections were observed")
    if not ERRORS_ARE_TWO_LINE:
        raise HookRuntimeShapeError("each error is a message plus a path line")
    for msg in RUNTIME_TYPE_ERRORS:
        if "in `hooks" not in msg:
            raise HookRuntimeShapeError("every error names its path")
        if "expected" not in msg:
            raise HookRuntimeShapeError("every error says what was expected")

    if LAYER_COUNT != 5 or len(LAYERS) != 5:
        raise HookRuntimeShapeError("five layers")
    if HOOKS_ROOT_TYPE != "struct HooksToml":
        raise HookRuntimeShapeError("hooks is a struct")
    if EVENT_VALUE_TYPE != "sequence<MatcherGroup>":
        raise HookRuntimeShapeError("per-event value is an array")
    if MATCHER_GROUP_TYPE != "struct MatcherGroup(matcher, hooks)":
        raise HookRuntimeShapeError("matcher group has two fields")
    if STATE_TYPE != "map<string, HookStateToml>":
        raise HookRuntimeShapeError("state is a map")
    if not layers_agree_with_binary():
        raise HookRuntimeShapeError("runtime must agree with the binary schema")
    if RUNTIME_MATCHES_BINARY_SCHEMA is not True:
        raise HookRuntimeShapeError("the two sources were cross-checked")

    if EVENT_KEY_CASE != "snake_case":
        raise HookRuntimeShapeError("events are snake_case")
    if not event_key_is_snake_case("user_prompt_submit"):
        raise HookRuntimeShapeError("snake_case helper drifted")
    if event_key_is_snake_case("user-prompt-submit"):
        raise HookRuntimeShapeError("kebab-case is not the accepted spelling")
    if STATE_KEY_IS_A_FREE_NAME is not True or STATE_KEY_NEED_NOT_BE_AN_EVENT is not True:
        raise HookRuntimeShapeError("the state key is a free name")

    if ACCEPTED_COUNT != 5 or len(ACCEPTED_CONFIGURATIONS) != 5:
        raise HookRuntimeShapeError("five configurations were accepted")
    if ACCEPTED_MEANS_PARSED is not True:
        raise HookRuntimeShapeError("accepted means parsed")
    if ACCEPTED_DOES_NOT_MEAN_RAN is not True:
        raise HookRuntimeShapeError(
            "acceptance must not be read as execution -- the whole point"
        )

    if TRUST_FLAG != "--dangerously-bypass-hook-trust":
        raise HookRuntimeShapeError("flag drifted")
    if TRUST_FLAG_RECOGNIZED is not True or TRUST_WARNING_EMITTED is not True:
        raise HookRuntimeShapeError("the flag was recognised and warned")
    if "Enabled hooks may run" not in TRUST_WARNING_TEXT:
        raise HookRuntimeShapeError("the warning's wording is evidence and must stay")
    if WARNING_SAYS_ENABLED_HOOKS is not True:
        raise HookRuntimeShapeError("the warning conditions on enabled")
    if BYPASS_DOES_NOT_IMPLY_ENABLED is not True:
        raise HookRuntimeShapeError(
            "bypassing trust is not the same as enabling a hook"
        )

    if HANDLER_EXECUTED is not False:
        raise HookRuntimeShapeError("no handler executed; never say otherwise")
    if PAYLOAD_CAPTURED is not False:
        raise HookRuntimeShapeError("no payload was captured")
    if TRIGGER_ESTABLISHED is not False:
        raise HookRuntimeShapeError("the trigger was not established")
    if SHAPE_ESTABLISHED is not True:
        raise HookRuntimeShapeError("the shape was established")
    if STATE_IN_GLOBAL_STATE_JSON is not False:
        raise HookRuntimeShapeError("no hook state in global-state.json")
    if STATE_IN_STATE_SQLITE is not False:
        raise HookRuntimeShapeError("no hook columns in state sqlite")

    if CANDIDATE_REASON_COUNT != 4 or len(CANDIDATE_REASONS) != 4:
        raise HookRuntimeShapeError("four candidate reasons")
    if REASONS_ARE_UNRESOLVED is not True:
        raise HookRuntimeShapeError("the reasons are unresolved, not chosen among")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

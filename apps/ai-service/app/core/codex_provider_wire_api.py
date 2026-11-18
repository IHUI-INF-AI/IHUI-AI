# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex's provider wire protocol, and why a local model pool cannot serve it (R106).

R105 left one question open: ``exec`` never reached the model (401 straight to
``api.openai.com``), so maybe the hook never had a chance to fire. This round went after that
premise -- point codex at a local provider -- and found that the premise cannot be fixed the
way it was fixed before.

Two findings, both from the binary's own words rather than from guessing:

**1. Chat completions is gone.** This build rejects it outright:

    Error loading config.toml: `wire_api = "chat"` is no longer supported.
    How to fix: set `wire_api = "responses"` in your provider config.
    More info: https://github.com/openai/codex/discussions/7782
    in `model_providers.<name>.wire_api`

So ``responses`` is not the preferred protocol, it is the *only* protocol. R93's relay
arrangement (chat completions) is invalidated by this build.

**2. The local model pool does not implement Responses.** Probing the endpoint that codex
would now have to talk to:

    POST /v1/responses          -> 502  {"code":502,"message":"AI service unavailable (502)"}
    POST /v1/chat/completions   -> 400  {"code":400,"message":"upstream 400 (client error)"}
                                -> 503  {"code":503,"message":"AI service unavailable (502)"}

Chat exists as a route but its upstream fails; responses does not exist at all. So the
capability codex now requires is exactly the one the local pool lacks, and the one it still
supports is exactly the one codex no longer accepts.

**Conclusion**: a local provider cannot back this build without an adapter that presents
Responses and translates to chat underneath. That adapter does not exist here, and building it
is a separate piece of work. The premise behind R105's "the hook never ran" therefore stays
unfixed -- and, importantly, *unfalsified*: the 401 was a real blocker, not a symptom of
something else.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- finding 1: the only remaining wire protocol ------------------------------------

SUPPORTED_WIRE_APIS: Final = ("responses",)
REMOVED_WIRE_APIS: Final = ("chat",)
DEFAULT_WIRE_API: Final = "responses"
CHAT_REMOVED_IN_THIS_BUILD: Final = True

REMOVAL_ERROR_TEXT: Final = (
    'Error loading config.toml: `wire_api = "chat"` is no longer supported.\n'
    'How to fix: set `wire_api = "responses"` in your provider config.\n'
    "More info: https://github.com/openai/codex/discussions/7782"
)
REMOVAL_POINTS_AT_A_DISCUSSION: Final = True
REMOVAL_NAMES_THE_PATH: Final = "model_providers.<name>.wire_api"

RESPONSES_PATH: Final = "/v1/responses"
CHAT_PATH: Final = "/v1/chat/completions"
PROVIDER_ENV_KEY: Final = "env_key"
PROVIDER_BASE_URL_KEY: Final = "base_url"

# --- finding 2: what the local pool actually answers --------------------------------

LOCAL_RESPONSES_STATUS: Final = 502
LOCAL_RESPONSES_BODY: Final = '{"code":502,"message":"AI service unavailable (502)"}'
LOCAL_CHAT_STATUSES: Final = (400, 503)
LOCAL_CHAT_BODY_400: Final = '{"code":400,"message":"upstream 400 (client error)"}'
LOCAL_CHAT_BODY_503: Final = '{"code":503,"message":"AI service unavailable (502)"}'

LOCAL_RESPONSES_IMPLEMENTED: Final = False
LOCAL_CHAT_ROUTE_EXISTS: Final = True
LOCAL_CHAT_UPSTREAM_WORKING: Final = False
LOCAL_POOL_MODEL_COUNT: Final = 1043
MODEL_LIST_WORKS: Final = True  # GET /v1/models is 200 and returns ids

# --- the two sides are exactly inverted ---------------------------------------------

CAPABILITY_MATRIX: Final = (
    ("local-pool", "chat", True),
    ("local-pool", "responses", False),
    ("codex-build", "chat", False),
    ("codex-build", "responses", True),
)
MATRIX_IS_INVERTED: Final = True

# --- what this means for R105 -------------------------------------------------------

ADAPTER_REQUIRED: Final = True
ADAPTER_EXISTS_HERE: Final = False
LOCAL_PROVIDER_USABLE_BY_THIS_BUILD: Final = False
R93_RELAY_STILL_VALID: Final = False
R93_INVALIDATED_BY_BUILD_UPGRADE: Final = True

# The premise R105 flagged is real and remains unresolved.
NETWORK_BLOCKER_CONFIRMED: Final = True
NETWORK_BLOCKER_FIXED: Final = False
HOOK_PREMISE_RESOLVED: Final = False


class ProviderWireError(ValueError):
    """Raised when the protocol findings are softened into a 'it works' claim."""


def provider_accepts(wire_api: str) -> bool:
    """Whether this build accepts the given wire protocol."""
    return wire_api in SUPPORTED_WIRE_APIS


def local_pool_serves(wire_api: str) -> bool:
    """Whether the local pool can answer the given wire protocol."""
    if wire_api == "chat":
        return LOCAL_CHAT_ROUTE_EXISTS and LOCAL_CHAT_UPSTREAM_WORKING
    if wire_api == "responses":
        return LOCAL_RESPONSES_IMPLEMENTED
    return False


def adapter_can_bridge() -> bool:
    """Only an adapter could join the two inverted sides."""
    return ADAPTER_REQUIRED and not ADAPTER_EXISTS_HERE


def provider_contract() -> Mapping[str, object]:
    """The findings, stated as facts."""
    return {
        "supported": SUPPORTED_WIRE_APIS,
        "removed": REMOVED_WIRE_APIS,
        "local_responses_status": LOCAL_RESPONSES_STATUS,
        "matrix_inverted": MATRIX_IS_INVERTED,
        "adapter_required": ADAPTER_REQUIRED,
        "r93_still_valid": R93_RELAY_STILL_VALID,
        "hook_premise_resolved": HOOK_PREMISE_RESOLVED,
    }


def validate_provider_contract() -> None:
    """Assert the two findings and the inversion between them."""
    if SUPPORTED_WIRE_APIS != ("responses",):
        raise ProviderWireError("responses is the only supported protocol")
    if len(SUPPORTED_WIRE_APIS) != 1:
        raise ProviderWireError("exactly one protocol remains")
    if REMOVED_WIRE_APIS != ("chat",):
        raise ProviderWireError("chat is the removed one")
    if DEFAULT_WIRE_API != "responses":
        raise ProviderWireError("default matches the only supported one")
    if CHAT_REMOVED_IN_THIS_BUILD is not True:
        raise ProviderWireError("chat removal is a fact of this build")

    if "is no longer supported" not in REMOVAL_ERROR_TEXT:
        raise ProviderWireError("the removal text is evidence and must stay verbatim")
    if 'set `wire_api = "responses"`' not in REMOVAL_ERROR_TEXT:
        raise ProviderWireError("the text names the fix")
    if REMOVAL_NAMES_THE_PATH != "model_providers.<name>.wire_api":
        raise ProviderWireError("the path is the provider block")

    if RESPONSES_PATH != "/v1/responses" or CHAT_PATH != "/v1/chat/completions":
        raise ProviderWireError("paths drifted")

    if LOCAL_RESPONSES_STATUS != 502:
        raise ProviderWireError("responses answered 502")
    if LOCAL_RESPONSES_IMPLEMENTED is not False:
        raise ProviderWireError("responses is not implemented locally")
    if LOCAL_CHAT_STATUSES != (400, 503):
        raise ProviderWireError("chat answered 400 then 503")
    if LOCAL_CHAT_ROUTE_EXISTS is not True:
        raise ProviderWireError("the chat route exists")
    if LOCAL_CHAT_UPSTREAM_WORKING is not False:
        raise ProviderWireError("but its upstream does not work")
    if LOCAL_POOL_MODEL_COUNT != 1043 or MODEL_LIST_WORKS is not True:
        raise ProviderWireError("listing works; generation does not")

    if len(CAPABILITY_MATRIX) != 4 or MATRIX_IS_INVERTED is not True:
        raise ProviderWireError("four cells, and the two sides are inverted")
    if provider_accepts("chat"):
        raise ProviderWireError("this build rejects chat")
    if not provider_accepts("responses"):
        raise ProviderWireError("this build accepts responses")
    if local_pool_serves("chat"):
        raise ProviderWireError("the local chat upstream does not work")
    if local_pool_serves("responses"):
        raise ProviderWireError("the local responses route is absent")

    if ADAPTER_REQUIRED is not True or ADAPTER_EXISTS_HERE is not False:
        raise ProviderWireError("an adapter is required and absent")
    if adapter_can_bridge() is not True:
        raise ProviderWireError("the adapter framing drifted")
    if LOCAL_PROVIDER_USABLE_BY_THIS_BUILD is not False:
        raise ProviderWireError("the local pool cannot back this build as-is")

    if R93_RELAY_STILL_VALID is not False:
        raise ProviderWireError("the R93 relay arrangement no longer holds")
    if R93_INVALIDATED_BY_BUILD_UPGRADE is not True:
        raise ProviderWireError("it was invalidated by the protocol removal")

    if NETWORK_BLOCKER_CONFIRMED is not True:
        raise ProviderWireError("the 401 was a real blocker")
    if NETWORK_BLOCKER_FIXED is not False:
        raise ProviderWireError("it was not fixed this round")
    if HOOK_PREMISE_RESOLVED is not False:
        raise ProviderWireError(
            "the hook remained untested; do not claim the premise was settled"
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

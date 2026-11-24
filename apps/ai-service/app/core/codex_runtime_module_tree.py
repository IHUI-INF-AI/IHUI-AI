# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The crate tree codex.exe actually logs from (R93).

`~/.codex/logs_2.sqlite` holds 2,361 rows of `tracing` events.  The `target` and `module_path` columns are
not free text: `tracing` fills them from the **crate and module path of the emitting code**.  Reading them
is therefore reading the binary's own module tree, one level above what the symbol table gave us.

**12 distinct targets, belonging to 7 crates.**

The traffic is lopsided:

```
codex_login::auth::manager          1402   (auth retry loop, mostly INFO)
codex_app_server_transport::...      707   (websocket transport)
codex_app_server::message_processor  217  (JSON-RPC dispatch)
```

Those three carry **2326 of 2,361** rows; everything else
is startup noise.  That distribution is itself the finding: this binary spends most of its log bandwidth
in an auth manager loop, which is why the earlier static work saw so many retry-shaped strings.

The crate split also settles a question the strings could not: `codex_skills` and `codex_skills_extension`
are **two separate crates**, not one module with a sub-module.  Splitting only on the first `::` proves it —
`codex_skills_extension::host_service` cannot be a child of `codex_skills`, because a sibling crate name
would then be missing its own prefix.

Nothing in this module derives from event bodies.  The `codex_login::auth::manager` rows exist here as
a **name and a count**, which is all that the module tree needs.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

LOG_ROWS: Final[int] = 2361
DISTINCT_TARGETS: Final[int] = 12
TARGETS: Final[Mapping[str, int]] = MappingProxyType({'codex_app_server::message_processor': 217,
        'codex_app_server::outgoing_message': 3,
        'codex_app_server::request_processors::initialize_processor': 3,
        'codex_app_server_transport::transport::remote_control::websocket': 707,
        'codex_core_plugins::loader': 3,
        'codex_core_plugins::manager': 2,
        'codex_core_plugins::manifest': 3,
        'codex_core_plugins::startup_sync': 2,
        'codex_http_client::custom_ca': 4,
        'codex_login::auth::manager': 1402,
        'codex_skills::interface': 6,
        'codex_skills_extension::host_service': 9,
        })
LEVELS: Final[Mapping[str, int]] = MappingProxyType({'INFO': 2122,
        'TRACE': 220,
        'WARN': 19,
        })

CRATES: Final[tuple[str, ...]] = (
        'codex_app_server',
        'codex_app_server_transport',
        'codex_core_plugins',
        'codex_http_client',
        'codex_login',
        'codex_skills',
        'codex_skills_extension',
        )

#: Crates that exist as siblings but share a name prefix.
SIBLING_CRATES: Final[tuple[tuple[str, str], ...]] = (
    ("codex_skills", "codex_skills_extension"),
    ("codex_app_server", "codex_app_server_transport"),
)


class ModuleTreeError(ValueError):
    """Raised when a target cannot be attributed to a crate."""


def crate_of(target: str) -> str:
    """Return the crate for a `tracing` target.

    Splits on the first `::` only.  A longer prefix match would mis-attribute
    `codex_skills_extension::host_service` to `codex_skills`.
    """
    if "::" not in target:
        raise ModuleTreeError(f"target has no module separator: {target!r}")
    return target.split("::", 1)[0]


def targets_by_crate() -> Mapping[str, int]:
    counts: dict[str, int] = {}
    for target, n in TARGETS.items():
        crate = crate_of(target)
        counts[crate] = counts.get(crate, 0) + n
    return MappingProxyType(counts)


def module_of(target: str) -> str:
    """Return the module path after the crate, e.g. `auth::manager`."""
    if "::" not in target:
        raise ModuleTreeError(f"target has no module separator: {target!r}")
    return target.split("::", 1)[1]


def validate_tree() -> None:
    if sum(TARGETS.values()) != LOG_ROWS:
        raise ModuleTreeError("target counts do not sum to LOG_ROWS")
    if len(TARGETS) != DISTINCT_TARGETS:
        raise ModuleTreeError("DISTINCT_TARGETS disagrees with TARGETS")
    for target in TARGETS:
        if crate_of(target) not in CRATES:
            raise ModuleTreeError(f"crate missing from CRATES: {crate_of(target)}")
    if sum(LEVELS.values()) != LOG_ROWS:
        raise ModuleTreeError("level counts do not sum to LOG_ROWS")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

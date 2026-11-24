# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The desktop shell's state keys, and the fact that it is signed out (R93).

`~/.codex/.codex-global-state.json` holds **17 keys**, and every one is prefixed `electron-` (or is
`desktop-`/`local-`/`primary-runtime-`, which are the same shell's other namespaces).  That settles the
front-end question that A10 deferred: the UI is **Electron**, and this file is its atom store.

Two keys carry an account-state suffix:

```
'electron-account-remote-preference:remote-project-connection-backfill-completed:signed-out'
'electron-owner-atoms:signed-out'
```

This is **per-account partitioning inside the key name**, not a value.  The store seeds a separate atom
for each account state, and `signed-out` is the one present here.  `electron-renderer-content-owner` reads
`signed-out` as well, so the whole store is in its logged-out branch.

That is the operationally important fact: **this installation is not signed in**, so nothing that needs a
model call can be exercised — which is exactly why the runtime work stopped at "read what the shell wrote"
instead of "drive codex and capture hooks".

Values are deliberately not copied.  Two of the 17 are identifiers (an installation id and a window geometry),
and a repository is the wrong place for either.  What a reader needs from this file is its **shape**: key
names, namespaces, and which account branch is live.
"""

from __future__ import annotations

from typing import Final

ELECTRON_KEYS: Final[tuple[str, ...]] = (
        'desktop-first-seen-at-ms',
        'electron-persisted-atom-state',
        'electron-completed-local-data-migration-ids',
        'local-projects',
        'electron-initial-follow-up-queue-mode',
        'electron-local-remote-control-installation-id',
        'electron-remote-control-config-migration-completed',
        'electron-renderer-content-owner',
        'electron-account-remote-preference:remote-project-connection-backfill-completed:signed-out',
        'electron-desktop-otraces-sample-rate',
        'electron-owner-atoms:signed-out',
        'primary-runtime-update-jitter-ms',
        'electron-internal-update-cdn-enabled',
        'electron-prefer-mxc-enabled',
        'electron-windows-core-runtime-frameworks-enabled',
        'electron-windows-primary-runtime-frameworks-enabled',
        'electron-main-window-bounds',
        )

KEY_COUNT: Final[int] = 17

#: Namespaces seen in the key set, by prefix.
NAMESPACES: Final[tuple[str, ...]] = (
    "desktop-",
    "electron-",
    "local-",
    "primary-runtime-",
)

#: Keys carrying an account-state suffix after the last ':'.
ACCOUNT_SCOPED: Final[tuple[str, ...]] = (
        'electron-account-remote-preference:remote-project-connection-backfill-completed:signed-out',
        'electron-owner-atoms:signed-out',
        )

#: The live account branch, read from `electron-renderer-content-owner`.
LIVE_ACCOUNT_BRANCH: Final[str] = "signed-out"
SIGNED_IN: Final[bool] = False

#: Sample rates and toggles that were all off in this installation.
OTRACES_SAMPLE_RATE: Final[int] = 0
UPDATE_CDN_ENABLED: Final[bool] = False
PREFER_MXC: Final[bool] = False
WINDOWS_CORE_FRAMEWORKS: Final[bool] = False
WINDOWS_PRIMARY_FRAMEWORKS: Final[bool] = False
QUEUE_MODE: Final[str] = "steer"


class DesktopStateError(ValueError):
    """Raised when a key cannot be classified."""


def namespace_of(key: str) -> str:
    for ns in NAMESPACES:
        if key.startswith(ns):
            return ns.rstrip("-")
    raise DesktopStateError(f"key has no known namespace: {key!r}")


def account_scope_of(key: str) -> str | None:
    if ":" not in key:
        return None
    return key.rsplit(":", 1)[1]


def keys_in(namespace: str) -> tuple[str, ...]:
    return tuple(k for k in ELECTRON_KEYS if namespace_of(k) == namespace)


def validate_keys() -> None:
    if len(set(ELECTRON_KEYS)) != len(ELECTRON_KEYS):
        raise DesktopStateError("duplicate keys")
    if len(ELECTRON_KEYS) != KEY_COUNT:
        raise DesktopStateError("KEY_COUNT disagrees with ELECTRON_KEYS")
    for k in ELECTRON_KEYS:
        namespace_of(k)
    if not set(ACCOUNT_SCOPED) <= set(ELECTRON_KEYS):
        raise DesktopStateError("ACCOUNT_SCOPED is not a subset of ELECTRON_KEYS")
    for k in ACCOUNT_SCOPED:
        if account_scope_of(k) != LIVE_ACCOUNT_BRANCH:
            raise DesktopStateError(f"account scope mismatch: {k!r}")
    if SIGNED_IN:
        raise DesktopStateError("the store is in its signed-out branch")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

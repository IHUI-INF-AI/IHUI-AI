# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Shell detection and exec-arg derivation - Python port of codex shell_detect.rs / shell.rs.

Pure functions, zero side effects, fully typed. Mirrors codex's detect/derive
semantics so the IHUI unified-exec runtime can select and invoke a shell
deterministically.
"""

from __future__ import annotations

import os
import shutil
import sys
from enum import StrEnum


class ShellType(StrEnum):
    """Shell family identifier (value is the lowercase shell name)."""

    Zsh = "zsh"
    Bash = "bash"
    PowerShell = "powershell"
    Sh = "sh"
    Cmd = "cmd"

    def name(self) -> str:  # type: ignore[override]
        """Lowercase shell name, e.g. ``ShellType.Zsh.name() == "zsh"``."""
        return self.value


# Ordered lookup used by detect_shell_type. Keyed on the file stem (lower-cased).
_KNOWN_STEMS: dict[str, ShellType] = {
    "powershell": ShellType.PowerShell,
    "pwsh": ShellType.PowerShell,
    "cmd": ShellType.Cmd,
    "zsh": ShellType.Zsh,
    "bash": ShellType.Bash,
    "sh": ShellType.Sh,
}


def _detect_strict(shell_path: str) -> ShellType | None:
    """Return the ShellType for ``shell_path`` or ``None`` when unknown.

    Matches codex's behaviour: strip the directory and a single extension, then
    compare the lower-cased stem case-insensitively.
    """
    current = shell_path
    while True:
        base = os.path.basename(current)
        stem = os.path.splitext(base)[0].lower()
        if stem in _KNOWN_STEMS:
            return _KNOWN_STEMS[stem]
        if stem != base:
            current = stem
            continue
        return None


def detect_shell_type(shell_path: str) -> ShellType:
    """Identify the shell family from a path/name. Unknown -> Sh fallback."""
    return _detect_strict(shell_path) or ShellType.Sh


def derive_exec_args(
    shell_type: ShellType,
    shell_path: str,
    command: str,
    use_login_shell: bool = False,
) -> list[str]:
    """Build the argv used to ``exec`` ``command`` under ``shell_path``.

    Mirrors codex ``Shell::derive_exec_args`` exactly:
      * Zsh/Bash/Sh -> [shell_path, "-lc"|"-c", command]
      * PowerShell   -> [shell_path] (+ "-NoProfile" unless login) + ["-Command", command]
      * Cmd          -> [shell_path, "/c", command]
    """
    if shell_type in (ShellType.Zsh, ShellType.Bash, ShellType.Sh):
        flag = "-lc" if use_login_shell else "-c"
        return [shell_path, flag, command]
    if shell_type == ShellType.PowerShell:
        args: list[str] = [shell_path]
        if not use_login_shell:
            args.append("-NoProfile")
        args.append("-Command")
        args.append(command)
        return args
    if shell_type == ShellType.Cmd:
        return [shell_path, "/c", command]
    return [shell_path, "-c", command]


def _is_inaccessible_windows_apps_powershell(path: str) -> bool:
    """Detect Store-delivered PowerShell paths the elevated sandbox can't use.

    Mirrors codex ``targets_inaccessible_windows_apps_powershell``: a component
    equal to ``WindowsApps`` followed by a pwsh/powershell or ``Microsoft.PowerShell*``
    component is rejected.
    """
    norm = path.replace("\\", "/")
    parts = norm.split("/")
    try:
        idx = next(i for i, part in enumerate(parts) if part.lower() == "windowsapps")
    except StopIteration:
        return False
    if idx + 1 >= len(parts):
        return False
    component = parts[idx + 1].lower()
    return component in ("pwsh.exe", "powershell.exe") or component.startswith(
        "microsoft.powershell"
    )


# Hardcoded fallback table (OS-agnostic; existence verified via os.path.isfile).
_FALLBACK_PATHS: dict[ShellType, list[str]] = {
    ShellType.Zsh: ["/bin/zsh"],
    ShellType.Bash: ["/bin/bash", "/usr/bin/bash"],
    ShellType.Sh: ["/bin/sh"],
    ShellType.PowerShell: [
        r"C:\Program Files\PowerShell\7\pwsh.exe",
        r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
    ],
    ShellType.Cmd: [],
}


def find_shell(shell_type: ShellType) -> str | None:
    """Locate an executable for ``shell_type``: ``shutil.which`` then fallbacks.

    Store PowerShell (WindowsApps) paths are rejected for the PowerShell type.
    """
    bin_name = shell_type.name()
    candidate = shutil.which(bin_name)
    if candidate and not (
        shell_type == ShellType.PowerShell
        and _is_inaccessible_windows_apps_powershell(candidate)
    ):
        return candidate
    for path in _FALLBACK_PATHS[shell_type]:
        if os.path.isfile(path) and not (
            shell_type == ShellType.PowerShell
            and _is_inaccessible_windows_apps_powershell(path)
        ):
            return path
    return None


def ultimate_fallback_shell() -> str:
    """Last-resort shell: ``cmd.exe`` on Windows, ``/bin/sh`` elsewhere."""
    if os.name == "nt":
        return "cmd.exe"
    return "/bin/sh"


def default_user_shell(
    platform: str | None = None,
    user_shell: str | None = None,
) -> tuple[ShellType, str]:
    """Resolve the default interactive shell for the current platform.

    Windows        -> PowerShell (else Cmd, else ``cmd.exe``).
    macOS (darwin) -> $SHELL -> zsh -> bash.
    Other POSIX     -> $SHELL -> bash -> zsh.
    ``user_shell`` (when given) overrides ``$SHELL`` and must detect to a known
    type and exist on disk (``os.path.isfile``).
    """
    plat = platform if platform is not None else sys.platform

    if plat == "win32":
        pwsh = find_shell(ShellType.PowerShell)
        if pwsh is not None:
            return (ShellType.PowerShell, pwsh)
        cmd = find_shell(ShellType.Cmd)
        if cmd is not None:
            return (ShellType.Cmd, cmd)
        return (ShellType.Cmd, ultimate_fallback_shell())

    resolved_user: str | None = (
        user_shell if user_shell is not None else os.environ.get("SHELL")
    )
    user_type: ShellType | None = None
    if resolved_user:
        detected = _detect_strict(resolved_user)
        if detected is not None and os.path.isfile(resolved_user):
            user_type = detected

    if plat == "darwin":
        preference: list[ShellType | None] = [user_type, ShellType.Zsh, ShellType.Bash]
    else:
        preference = [user_type, ShellType.Bash, ShellType.Zsh]

    seen: set[ShellType] = set()
    ordered: list[ShellType] = []
    for candidate_type in preference:
        if candidate_type is None:
            continue
        if candidate_type not in seen:
            seen.add(candidate_type)
            ordered.append(candidate_type)

    for shell_t in ordered:
        path = find_shell(shell_t)
        if path is not None:
            return (shell_t, path)
    return (ShellType.Sh, ultimate_fallback_shell())


def get_shell_by_model_provided_path(path: str) -> tuple[ShellType, str]:
    """Model-supplied shell path: detect its type, then discover its executable.

    Falls back to ``ultimate_fallback_shell`` when the discovered type has no
    usable binary on disk.
    """
    shell_t = detect_shell_type(path)
    found = find_shell(shell_t)
    if found is not None:
        return (shell_t, found)
    return (shell_t, ultimate_fallback_shell())

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Tests for app.core.shell_detect (port of codex shell_detect.rs / shell.rs)."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from app.core import shell_detect
from app.core.shell_detect import (
    ShellType,
    default_user_shell,
    derive_exec_args,
    detect_shell_type,
    find_shell,
    get_shell_by_model_provided_path,
    ultimate_fallback_shell,
)


# --- ShellType.name() -------------------------------------------------------


def test_shelltype_name_returns_lowercase():
    assert ShellType.Zsh.name() == "zsh"
    assert ShellType.Bash.name() == "bash"
    assert ShellType.PowerShell.name() == "powershell"
    assert ShellType.Sh.name() == "sh"
    assert ShellType.Cmd.name() == "cmd"


# --- detect_shell_type ------------------------------------------------------


def test_detect_zsh_variants():
    assert detect_shell_type("zsh") == ShellType.Zsh
    assert detect_shell_type("/bin/zsh") == ShellType.Zsh
    assert detect_shell_type("ZSH") == ShellType.Zsh
    assert detect_shell_type("/usr/local/bin/ZSH") == ShellType.Zsh


def test_detect_bash_variants():
    assert detect_shell_type("bash") == ShellType.Bash
    assert detect_shell_type("/usr/bin/bash") == ShellType.Bash
    assert detect_shell_type("BASH.EXE") == ShellType.Bash


def test_detect_sh_variants():
    assert detect_shell_type("sh") == ShellType.Sh
    assert detect_shell_type("/bin/sh") == ShellType.Sh
    assert detect_shell_type("SH") == ShellType.Sh


def test_detect_cmd_variants():
    assert detect_shell_type("cmd") == ShellType.Cmd
    assert detect_shell_type("cmd.exe") == ShellType.Cmd
    assert detect_shell_type("CMD.EXE") == ShellType.Cmd


def test_detect_powershell_variants():
    assert detect_shell_type("powershell") == ShellType.PowerShell
    assert detect_shell_type("powershell.exe") == ShellType.PowerShell
    assert detect_shell_type("pwsh") == ShellType.PowerShell
    assert detect_shell_type("pwsh.exe") == ShellType.PowerShell
    assert detect_shell_type("/usr/local/bin/pwsh") == ShellType.PowerShell
    assert detect_shell_type("POWERSHELL.EXE") == ShellType.PowerShell


def test_detect_unknown_falls_back_to_sh():
    assert detect_shell_type("fish") == ShellType.Sh
    assert detect_shell_type("unknown-shell") == ShellType.Sh
    assert detect_shell_type("/opt/bin/weird") == ShellType.Sh


# --- derive_exec_args -------------------------------------------------------


def test_derive_zsh_login_and_nonlogin():
    assert derive_exec_args(ShellType.Zsh, "/bin/zsh", "ls", use_login_shell=True) == [
        "/bin/zsh",
        "-lc",
        "ls",
    ]
    assert derive_exec_args(ShellType.Zsh, "/bin/zsh", "ls") == ["/bin/zsh", "-c", "ls"]


def test_derive_bash_and_sh():
    assert derive_exec_args(ShellType.Bash, "bash", "echo hi") == ["bash", "-c", "echo hi"]
    assert derive_exec_args(ShellType.Sh, "sh", "echo hi", use_login_shell=True) == [
        "sh",
        "-lc",
        "echo hi",
    ]


def test_derive_powershell_nonlogin_has_noprofile():
    args = derive_exec_args(ShellType.PowerShell, "pwsh", "Get-Date")
    assert args == ["pwsh", "-NoProfile", "-Command", "Get-Date"]


def test_derive_powershell_login_omits_noprofile():
    args = derive_exec_args(
        ShellType.PowerShell, "pwsh", "Get-Date", use_login_shell=True
    )
    assert args == ["pwsh", "-Command", "Get-Date"]
    assert "-NoProfile" not in args


def test_derive_cmd():
    assert derive_exec_args(ShellType.Cmd, "cmd.exe", "dir") == [
        "cmd.exe",
        "/c",
        "dir",
    ]


# --- find_shell -------------------------------------------------------------


def test_find_shell_uses_which(monkeypatch):
    monkeypatch.setattr(shell_detect.shutil, "which", lambda name: f"/usr/bin/{name}")
    monkeypatch.setattr(shell_detect.os.path, "isfile", lambda p: True)
    assert find_shell(ShellType.Bash) == "/usr/bin/bash"
    assert find_shell(ShellType.Zsh) == "/usr/bin/zsh"


def test_find_shell_falls_back_to_hardcoded_paths(monkeypatch):
    monkeypatch.setattr(shell_detect.shutil, "which", lambda name: None)
    monkeypatch.setattr(shell_detect.os.path, "isfile", lambda p: p == "/bin/zsh")
    assert find_shell(ShellType.Zsh) == "/bin/zsh"
    assert find_shell(ShellType.Bash) is None


def test_find_shell_rejects_windowsapps_store_powershell(monkeypatch):
    store = r"C:\Users\user\AppData\Local\Microsoft\WindowsApps\pwsh.exe"
    monkeypatch.setattr(shell_detect.shutil, "which", lambda name: store)
    # Only the Store path "exists"; the hardcoded fallback must NOT be selected.
    monkeypatch.setattr(shell_detect.os.path, "isfile", lambda p: p == store)
    assert find_shell(ShellType.PowerShell) is None


def test_find_shell_accepts_system_powershell(monkeypatch):
    system = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    monkeypatch.setattr(shell_detect.shutil, "which", lambda name: system)
    monkeypatch.setattr(shell_detect.os.path, "isfile", lambda p: True)
    assert find_shell(ShellType.PowerShell) == system


# --- ultimate_fallback_shell ------------------------------------------------


def test_ultimate_fallback_windows():
    with patch("app.core.shell_detect.os.name", "nt"):
        assert ultimate_fallback_shell() == "cmd.exe"


def test_ultimate_fallback_posix():
    with patch("app.core.shell_detect.os.name", "posix"):
        assert ultimate_fallback_shell() == "/bin/sh"


# --- default_user_shell -----------------------------------------------------


def test_default_user_shell_windows_powershell(monkeypatch):
    with patch("app.core.shell_detect.sys.platform", "win32"), patch(
        "app.core.shell_detect.shutil.which", lambda n: r"C:\PowerShell\7\pwsh.exe"
    ), patch("app.core.shell_detect.os.path.isfile", lambda p: True):
        shell_t, path = default_user_shell()
    assert shell_t == ShellType.PowerShell
    assert path.endswith("pwsh.exe")


def test_default_user_shell_windows_falls_back_to_cmd(monkeypatch):
    with patch("app.core.shell_detect.sys.platform", "win32"), patch(
        "app.core.shell_detect.shutil.which", lambda n: None
    ), patch("app.core.shell_detect.os.path.isfile", lambda p: False):
        shell_t, path = default_user_shell()
    assert shell_t == ShellType.Cmd
    assert path == "cmd.exe"


def test_default_user_shell_macos_uses_user_shell(monkeypatch):
    with patch("app.core.shell_detect.sys.platform", "darwin"), patch.dict(
        os.environ, {"SHELL": "/bin/bash"}
    ), patch("app.core.shell_detect.shutil.which", lambda n: f"/bin/{n}"), patch(
        "app.core.shell_detect.os.path.isfile", lambda p: True
    ):
        shell_t, path = default_user_shell()
    assert shell_t == ShellType.Bash
    assert path == "/bin/bash"


def test_default_user_shell_macos_falls_back_to_zsh(monkeypatch):
    with patch("app.core.shell_detect.sys.platform", "darwin"), patch.dict(
        os.environ, {"SHELL": ""}
    ), patch("app.core.shell_detect.shutil.which", lambda n: f"/bin/{n}"), patch(
        "app.core.shell_detect.os.path.isfile", lambda p: True
    ):
        shell_t, path = default_user_shell()
    assert shell_t == ShellType.Zsh


def test_default_user_shell_linux_uses_bash_fallback(monkeypatch):
    with patch("app.core.shell_detect.sys.platform", "linux"), patch.dict(
        os.environ, {"SHELL": ""}
    ), patch("app.core.shell_detect.shutil.which", lambda n: f"/bin/{n}"), patch(
        "app.core.shell_detect.os.path.isfile", lambda p: True
    ):
        shell_t, path = default_user_shell()
    assert shell_t == ShellType.Bash


def test_default_user_shell_linux_respects_user_shell(monkeypatch):
    with patch("app.core.shell_detect.sys.platform", "linux"), patch.dict(
        os.environ, {"SHELL": "/bin/zsh"}
    ), patch("app.core.shell_detect.shutil.which", lambda n: f"/bin/{n}"), patch(
        "app.core.shell_detect.os.path.isfile", lambda p: True
    ):
        shell_t, path = default_user_shell()
    assert shell_t == ShellType.Zsh
    assert path == "/bin/zsh"


def test_default_user_shell_ignores_unknown_user_shell(monkeypatch):
    with patch("app.core.shell_detect.sys.platform", "linux"), patch.dict(
        os.environ, {"SHELL": "/usr/bin/fish"}
    ), patch("app.core.shell_detect.shutil.which", lambda n: f"/bin/{n}"), patch(
        "app.core.shell_detect.os.path.isfile", lambda p: True
    ):
        shell_t, _ = default_user_shell()
    # fish is unknown -> not used; falls back to bash
    assert shell_t == ShellType.Bash


# --- get_shell_by_model_provided_path ---------------------------------------


def test_get_shell_by_model_provided_path_detects_and_finds(monkeypatch):
    monkeypatch.setattr(shell_detect.shutil, "which", lambda n: f"/bin/{n}")
    monkeypatch.setattr(shell_detect.os.path, "isfile", lambda p: True)
    shell_t, path = get_shell_by_model_provided_path("/usr/local/bin/pwsh")
    assert shell_t == ShellType.PowerShell
    assert path == "/bin/powershell"


def test_get_shell_by_model_provided_path_unknown_falls_back(monkeypatch):
    monkeypatch.setattr(shell_detect.shutil, "which", lambda n: None)
    monkeypatch.setattr(shell_detect.os.path, "isfile", lambda p: False)
    with patch("app.core.shell_detect.os.name", "posix"):
        shell_t, path = get_shell_by_model_provided_path("/weird/thing")
    assert shell_t == ShellType.Sh
    assert path == "/bin/sh"

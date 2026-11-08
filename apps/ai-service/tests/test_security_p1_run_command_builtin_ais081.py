# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P1 AIS-081:Windows 内置命令分支把原始整串交给 cmd /c,单个 `&` 即可拼接任意命令。

旧写法:危险模式表只认 `&&`/`|`/`;`,`echo x & powershell -c ...` 能通过前缀白名单
(只看 first_token=echo)并整串进 cmd /c。本夹具钉住:命中 shell 元字符 → 结构化拒绝
且**未 spawn**;合法 `echo hello` / `dir` 仍可用。判据常量从源模块 import,不复制。
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.services import mcp_server


def _metacharacters() -> tuple[str, ...]:
    # 唯一判据源 = mcp_server;测试不复制第二份表(AGENTS §0.6)
    return mcp_server.WIN_BUILTIN_SHELL_METACHARACTERS


def _install_policy_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mcp_server, "_is_dangerous_command_blocked", lambda: False)

    async def _cfg(principal):
        return SimpleNamespace(exec_policy_mode="off")

    monkeypatch.setattr(mcp_server, "resolve_security_config", _cfg)


def _spy_spawn(monkeypatch: pytest.MonkeyPatch) -> list[tuple]:
    spawned: list[tuple] = []

    async def _spawn(*args, **kwargs):
        spawned.append((args, kwargs))
        raise FileNotFoundError("spawn blocked by test")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _spawn)
    return spawned


async def test_single_ampersand_chaining_is_blocked_before_spawn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_policy_off(monkeypatch)
    spawned = _spy_spawn(monkeypatch)

    out = await mcp_server._tool_run_command(
        {"command": 'echo x & powershell -c "Write-Output pwn"'}
    )

    assert out["ok"] is False
    assert out["errorCode"] == "SHELL_METACHARACTER_BLOCKED"
    assert spawned == []


@pytest.mark.parametrize("metachar", ["&", "^", "|", "<", ">", ";", "\r", "\n"])
async def test_each_shell_metacharacter_is_blocked_before_spawn(
    monkeypatch: pytest.MonkeyPatch, metachar: str
) -> None:
    _install_policy_off(monkeypatch)
    spawned = _spy_spawn(monkeypatch)

    assert metachar in _metacharacters()
    out = await mcp_server._tool_run_command({"command": f"echo hello {metachar} whoami"})

    assert out["ok"] is False
    assert out["errorCode"] in ("SHELL_METACHARACTER_BLOCKED", "DANGEROUS_COMMAND")
    assert spawned == []


async def test_all_declared_metacharacters_cover_required_set() -> None:
    # 必需集合 = cmd 的命令分隔/转义符;`%` 只是变量展开、`` ` `` 与 `$(` 在 cmd 下是
    # 字面量,均无注入语义,刻意不纳入(否则误伤 `echo %PATH%` 等合法用法)
    required = {"&", "^", "|", "<", ">", ";", "\r", "\n"}
    assert required <= set(_metacharacters())


async def test_legit_builtin_commands_still_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_policy_off(monkeypatch)

    echo = await mcp_server._tool_run_command({"command": "echo hello"})
    assert echo["ok"] is True
    assert "hello" in echo["stdout"]

    dir_out = await mcp_server._tool_run_command({"command": "dir"})
    assert dir_out["ok"] is True

    # `%VAR%` 变量展开是 cmd 内置合法用法,不得被元字符闸误挡
    expanded = await mcp_server._tool_run_command({"command": "echo %PATH%"})
    assert expanded["ok"] is True
    assert "PATH" not in expanded["stdout"] and len(expanded["stdout"]) > 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

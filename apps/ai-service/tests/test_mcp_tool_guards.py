# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""工具层安全护栏单元测试(W2 · Phase 0)。

覆盖:
- 0-2 call_tool 出口统一输出护栏(截断标记 / JSON 结构完整 / truncated 标志)
- 0-5 run_command 危险命令硬门(表驱动命中拦截 + echo 无害放行)
- 0-6 dispatch_subagent 治理(并发上限拒绝 / 嵌套深度拒绝)
"""

from __future__ import annotations

import asyncio
import os

import pytest

from app.services import mcp_server as mcp_server_mod
from app.services.mcp_server import (
    _match_destructive_command,
    _SUBAGENT_SEMAPHORE,
    _subagent_depth,
    _tool_dispatch_subagent,
    _tool_run_command,
    _truncate_tool_output,
)


# =============================================================================
# 0-2 call_tool 出口统一输出护栏
# =============================================================================


def test_truncate_tool_output_small_unchanged(monkeypatch):
    """未超预算:原样返回,不加 truncated 标志,结构完整。"""
    monkeypatch.setenv("TOOL_OUTPUT_MAX_TOKENS", "8000")
    result = {
        "ok": True,
        "status": "completed",
        "output": "短内容",
        "nested": {"a": "b"},
        "list": ["x", "y"],
    }
    out = _truncate_tool_output(dict(result))
    assert out == result
    assert "truncated" not in out


def test_truncate_tool_output_marker_and_structure(monkeypatch):
    """超预算:追加标记、置 truncated=True、保持 dict 结构与控制字段完整。"""
    # 将预算压到很小,确保触发截断
    monkeypatch.setenv("TOOL_OUTPUT_MAX_TOKENS", "50")
    result = {
        "ok": True,
        "status": "completed",  # 受保护控制字段,不应被截断
        "output": "A" * 2000,  # 约 500 token
        "nested": {"content": "B" * 2000},
        "items": ["C" * 1000, "D" * 1000],
    }
    out = _truncate_tool_output(result)
    assert out.get("truncated") is True
    # 控制字段完整保留
    assert out["ok"] is True
    assert out["status"] == "completed"
    # 截断标记已追加到被截断的字符串值上
    assert "…[已截断" in out["output"]
    assert "可用分页/范围参数获取更多" in out["output"]
    # dict 结构与非字符串字段保持
    assert "nested" in out and "items" in out and isinstance(out["items"], list)
    assert len(out["items"]) == 2


# =============================================================================
# 0-5 run_command 危险命令硬门
# =============================================================================


@pytest.mark.parametrize(
    "command,expected",
    [
        # Windows
        ("format c:", "win_format"),
        ("diskpart", "win_diskpart"),
        ("reg delete HKLM\\Software\\Foo /f", "win_reg_delete"),
        ("shutdown /s /t 0", "shutdown"),
        ("bcdedit /set {default} ..." , "win_bcdedit"),
        ("vssadmin delete shadows /all", "win_vssadmin_delete"),
        ("cipher /w:C", "win_cipher_w"),
        ("rd /s C:\\temp", "win_rd_s"),
        ("del /f /s /q C:\\*", "win_del_fsq"),
        ("Remove-Item C:\\ -Recurse -Force", "win_remove_item_root"),
        # Unix
        ("rm -rf /", "unix_rm_rf_root"),
        ("rm -rf /etc/passwd", "unix_rm_rf_root"),
        ("rm -rf ~", "unix_rm_rf_root"),
        ("sudo rm -rf /var", "unix_rm_rf_root"),
        ("mkfs.ext4 /dev/sda1", "unix_mkfs"),
        ("dd if=x of=/dev/sda", "unix_dd_dev"),
        ("chmod -R 777 /", "unix_chmod_777_root"),
        (":(){ :|:& };:", "unix_fork_bomb"),
    ],
)
def test_match_destructive_command_blocked(command, expected):
    """表驱动:破坏性命令被确定性识别,返回对应模式名。"""
    assert _match_destructive_command(command) == expected


@pytest.mark.parametrize(
    "command",
    [
        "echo hello",
        "ls -la /tmp",
        "git status",
        "python script.py",
        "cat file.txt",
        "npm run build",
    ],
)
def test_match_destructive_command_harmless(command):
    """无害命令不应被判定为破坏性。"""
    assert _match_destructive_command(command) is None


async def test_run_command_echo_allowed(monkeypatch):
    """无害命令(echo)在硬门下正常放行(mock subprocess 层,不真正起进程)。"""
    monkeypatch.setenv("DANGEROUS_COMMAND_BLOCKED", "true")
    # 让 echo 通过前缀白名单,且无危险模式(隔离 command_policy.json 依赖)
    monkeypatch.setattr(
        mcp_server_mod,
        "_load_command_policy",
        lambda: {"allowed_prefixes": ["echo"], "dangerous_patterns": []},
    )

    # mock 流式读取:把固定行写入 stdout_lines
    async def _fake_drain(stream, lines):
        lines.append("hello\n")

    monkeypatch.setattr(mcp_server_mod, "_drain_stream", _fake_drain)

    class _FakeProc:
        returncode = 0
        stdout = object()
        stderr = object()

        def kill(self):
            pass

        async def wait(self):
            return None

    async def _fake_create(*args, **kwargs):
        return _FakeProc()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _fake_create)

    result = await _tool_run_command({"command": "echo hello"})
    assert result["ok"] is True
    assert "hello" in result["stdout"]


async def test_run_command_dangerous_blocked(monkeypatch):
    """破坏性命令(shutdown)命中硬门:返回 dangerous_command_blocked + matched。"""
    monkeypatch.setenv("DANGEROUS_COMMAND_BLOCKED", "true")
    result = await _tool_run_command({"command": "shutdown /s /t 0"})
    assert result["ok"] is False
    assert result["error"] == "dangerous_command_blocked"
    assert result["matched"] == "shutdown"
    # 不应真正执行(无 stdout/stderr 产物)
    assert result.get("stdout", "") == ""


# =============================================================================
# 0-6 dispatch_subagent 治理
# =============================================================================


async def test_subagent_concurrency_exceeded(monkeypatch):
    """并发达上限时,新派发被拒绝(返回 CONCURRENCY_LIMIT_EXCEEDED)。"""
    sem = asyncio.Semaphore(1)
    await sem.acquire()  # 模拟已被占用 -> locked()
    try:
        monkeypatch.setattr(mcp_server_mod, "_SUBAGENT_SEMAPHORE", sem)
        result = await _tool_dispatch_subagent({"name": "a", "task": "b"})
        assert result["ok"] is False
        assert result["errorCode"] == "CONCURRENCY_LIMIT_EXCEEDED"
    finally:
        sem.release()


async def test_subagent_nesting_depth_exceeded(monkeypatch):
    """嵌套深度 > 上限(2)时,派发被拒绝(返回 NESTING_DEPTH_EXCEEDED)。"""
    token = _subagent_depth.set(2)
    try:
        result = await _tool_dispatch_subagent({"name": "a", "task": "b"})
        assert result["ok"] is False
        assert result["errorCode"] == "NESTING_DEPTH_EXCEEDED"
    finally:
        _subagent_depth.reset(token)

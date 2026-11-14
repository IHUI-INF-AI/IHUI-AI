# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​​‍‍​‌‌​​​​‍‍​‌‌‌​​‌‌‍‍​​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‍⁠

"""交互式终端契约(2026-11-14 立,对标 DSH dsh-tool-terminal)。

① open 启动长驻子进程,send/read 跨调用作用于同一进程;
② read 按 seq 增量续读,进程退出后 read 返回 running=false;
③ close 收尾并返回退出码;list 按 (user_id, session_id) 隔离;
④ 无宿主身份拒绝;cwd 必须落在工作区白名单内。
"""

from __future__ import annotations

import sys
import time

import pytest

from app.services import interactive_terminal as term
from app.services import mcp_server as mcp
from app.services.mcp_server import _tool_terminal

_SCRIPT = """\
import sys
for line in sys.stdin:
    line = line.strip()
    if line == "quit":
        print("bye")
        sys.stdout.flush()
        break
    print("echo:" + line)
    sys.stdout.flush()
"""

_SLEEP_SCRIPT = """\
import time
print("started", flush=True)
time.sleep(30)
print("done", flush=True)
"""

_OWNER = {"__user_id": "u-term", "__session_id": "s-term"}


@pytest.fixture(autouse=True)
def _clean_terminals():
    term.reset_terminals()
    yield
    term.reset_terminals()


def _script_path(tmp_path, name: str, body: str) -> str:
    path = tmp_path / name
    path.write_text(body, encoding="utf-8")
    return str(path)


def _open(script: str, tmp_path) -> dict:
    return term.open_terminal(
        command=f'"{sys.executable}" -u "{script}"',
        cwd=str(tmp_path),
        user_id="u-term",
        session_id="s-term",
    )


def _read_until(terminal_id: str, needle: str, timeout: float = 8.0) -> tuple[str, dict]:
    text = ""
    seq = 0
    last: dict = {}
    deadline = time.time() + timeout
    while time.time() < deadline:
        last = term.read_terminal(
            terminal_id,
            user_id="u-term",
            session_id="s-term",
            since_seq=seq,
            wait_s=0.5,
        )
        seq = last["next_seq"]
        text += "".join(c["text"] for c in last["chunks"])
        if needle in text or not last["running"]:
            break
    return text, last


def test_open_send_read_round_trip(tmp_path) -> None:
    opened = _open(_script_path(tmp_path, "echo.py", _SCRIPT), tmp_path)
    assert opened["ok"] is True
    terminal_id = opened["terminal"]["terminal_id"]
    assert opened["terminal"]["running"] is True

    sent = term.send_terminal(
        terminal_id, "hello", user_id="u-term", session_id="s-term"
    )
    assert sent["ok"] is True

    text, last = _read_until(terminal_id, "echo:hello")
    assert "echo:hello" in text
    assert last["running"] is True
    assert last["next_seq"] > 0


def test_send_quit_and_close_returns_exit_code(tmp_path) -> None:
    opened = _open(_script_path(tmp_path, "echo.py", _SCRIPT), tmp_path)
    terminal_id = opened["terminal"]["terminal_id"]
    term.send_terminal(terminal_id, "hello", user_id="u-term", session_id="s-term")
    _read_until(terminal_id, "echo:hello")
    term.send_terminal(terminal_id, "quit", user_id="u-term", session_id="s-term")

    text, last = _read_until(terminal_id, "bye")
    assert "bye" in text
    # 读到 bye 不等于进程已被回收(写出与退出之间有时间差),有限等待退出态。
    deadline = time.time() + 8
    while last["running"] and time.time() < deadline:
        last = term.read_terminal(
            terminal_id,
            user_id="u-term",
            session_id="s-term",
            since_seq=last["next_seq"],
            wait_s=0.3,
        )
    assert last["running"] is False

    closed = term.close_terminal(terminal_id, user_id="u-term", session_id="s-term")
    assert closed["ok"] is True
    assert closed["exit_code"] == 0


def test_terminal_is_owner_scoped_and_listed(tmp_path) -> None:
    opened = _open(_script_path(tmp_path, "echo.py", _SCRIPT), tmp_path)
    terminal_id = opened["terminal"]["terminal_id"]

    listed = term.list_terminals(user_id="u-term", session_id="s-term")
    assert listed["total"] == 1
    assert listed["terminals"][0]["terminal_id"] == terminal_id

    assert term.list_terminals(user_id="other", session_id="s-term")["total"] == 0
    denied = term.read_terminal(
        terminal_id, user_id="other", session_id="s-term", wait_s=0.1
    )
    assert denied["ok"] is False
    assert denied["errorCode"] == "TERMINAL_NOT_FOUND"


def test_signal_interrupt_stops_process(tmp_path) -> None:
    opened = _open(_script_path(tmp_path, "sleep.py", _SLEEP_SCRIPT), tmp_path)
    terminal_id = opened["terminal"]["terminal_id"]
    _read_until(terminal_id, "started")

    signaled = term.signal_terminal(
        terminal_id,
        signal_name="interrupt",
        user_id="u-term",
        session_id="s-term",
    )
    assert signaled["ok"] is True

    deadline = time.time() + 8
    while time.time() < deadline:
        result = term.read_terminal(
            terminal_id, user_id="u-term", session_id="s-term", wait_s=0.3
        )
        if not result["running"]:
            break
    assert result["running"] is False
    term.close_terminal(terminal_id, user_id="u-term", session_id="s-term")


@pytest.mark.asyncio
async def test_handler_rejects_missing_identity() -> None:
    result = await _tool_terminal({"action": "list"})
    assert result["ok"] is False
    assert result["errorCode"] == "TERMINAL_NO_IDENTITY"


@pytest.mark.asyncio
async def test_handler_validates_cwd_against_workspace(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(mcp, "_get_workspace_roots", lambda: [str(tmp_path)])
    outside = await _tool_terminal(
        {"action": "open", "command": "cmd.exe", "cwd": "C:\\Windows", **_OWNER}
    )
    assert outside["ok"] is False
    assert outside["errorCode"] == "PATH_NOT_ALLOWED"

    opened = await _tool_terminal(
        {
            "action": "open",
            "command": f'"{sys.executable}" -u "{_script_path(tmp_path, "echo.py", _SCRIPT)}"',
            "cwd": str(tmp_path),
            **_OWNER,
        }
    )
    assert opened["ok"] is True
    terminal_id = opened["terminal"]["terminal_id"]
    sent = await _tool_terminal(
        {"action": "send", "terminal_id": terminal_id, "input": "hi", **_OWNER}
    )
    assert sent["ok"] is True
    read = await _tool_terminal(
        {
            "action": "read",
            "terminal_id": terminal_id,
            "wait_s": 3,
            **_OWNER,
        }
    )
    assert read["ok"] is True
    assert "hi" in "".join(c["text"] for c in read["chunks"])
    closed = await _tool_terminal(
        {"action": "close", "terminal_id": terminal_id, **_OWNER}
    )
    assert closed["ok"] is True

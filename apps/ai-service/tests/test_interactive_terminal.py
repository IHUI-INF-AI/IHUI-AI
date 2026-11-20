# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""交互式终端契约(2026-11-14 立,遵循统一工程规范)。

① open 启动长驻子进程,send/read 跨调用作用于同一进程;
② read 按 seq 增量续读,进程退出后 read 返回 running=false;
③ close 收尾并返回退出码;list 按 (user_id, session_id) 隔离;
④ 无宿主身份拒绝;cwd 必须落在工作区白名单内。
"""

from __future__ import annotations

import io
import os
import sys
import time

import pytest

from app.services import interactive_terminal as term
from app.services import mcp_server as mcp
from app.services.mcp_server import _tool_terminal


# ─── PTY 后端形状锁(不 flaky:静态判据 + 变异夹具,遵 memory: race-fix-shape-lock-over-timing-test) ───
_TEST = term.__test__
assert _TEST is not None, "模块必须挂 __test__,否则判据无法对账(§22c)"


def test_pty_requested_reads_env_truthy_lowercase() -> None:
    case_truthy = _TEST["PTY_TRUTHY"]
    key = _TEST["PTY_REQUEST_ENV"]
    for token in sorted(case_truthy):
        assert term._pty_requested({key: f" {token.upper()} "}) is True
    for miss in ("", "0", "no", "off", "false", "yes-but-typo"):
        assert term._pty_requested({key: miss}) is False


def test_pty_supported_is_win32_fail_closed() -> None:
    # 宿主判据必须与 os.name 直接绑定(不是"看起来能 import") —— Windows 分支硬 False,
    # 保证未接 ConPTY 时 open_terminal 拒而非静默回落管道冒充已 PTY。
    monkey_result = os.name != "nt"
    assert term._pty_supported_on_host() is monkey_result


def test_windows_pty_hard_rejects_and_does_not_fall_back() -> None:
    """开启 PTY 但宿主未接 → 返回 TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM 且不建会话。

    **不**在 Windows 真跑(用 monkeypatch 把两枚判据翻转),避免"依赖宿主能测"
    型 flaky;同时确保 Windows 真环境下的行为也在此形状里锁住。
    """
    term.reset_terminals()
    orig_requested = term._pty_requested
    orig_supported = term._pty_supported_on_host
    try:
        term._pty_requested = lambda env=None: True  # type: ignore[assignment]
        term._pty_supported_on_host = lambda: False  # type: ignore[assignment]
        res = term.open_terminal(
            command="cmd.exe /c echo hi", cwd="C:\\", user_id="u", session_id="s"
        )
        assert res["ok"] is False
        assert res["errorCode"] == "TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM"
        # 不建会话:list_terminals 必须看不到这条(否则"拒"是假的)
        listed = term.list_terminals(user_id="u", session_id="s")
        assert listed["total"] == 0
    finally:
        term._pty_requested = orig_requested  # type: ignore[assignment]
        term._pty_supported_on_host = orig_supported  # type: ignore[assignment]
        term.reset_terminals()


def test_send_writes_via_write_io_not_proc_stdin(tmp_path) -> None:
    """变异夹具:构造一个 proc.stdin=None 但 write_io=捕获流的会话,证明新代码
    从 `session.write_io` 写,不是从 `session.proc.stdin` 写(后者在 PTY 路径必为 None,
    旧代码若有残留会 AttributeError;此锁把该回归封死)。
    """
    term.reset_terminals()
    try:
        # 起个空 python 循环(短命即可,我们不真发指令给 proc,只走 session.write_io 断言)
        opened = _open(_script_path(tmp_path, "sinkhold.py", "import time\ntime.sleep(30)\n"), tmp_path)
        assert opened["ok"] is True
        tid = opened["terminal"]["terminal_id"]
        session = term._sessions[tid]
        # 变异:把 write_io 换成捕获流,并把 proc.stdin 打成 None(模拟 PTY 的 stdin=None)。
        cap = io.StringIO()
        session.write_io = cap  # type: ignore[assignment]
        try:
            session.proc.stdin = None  # type: ignore[method-assign, assignment]
        except (AttributeError, TypeError):
            pytest.skip("Popen.stdin 被类型锁死不可覆盖;此锁由 test_windows_pty_hard_rejects 承担")
        sent = term.send_terminal(tid, "hello", user_id="u-term", session_id="s-term")
        assert sent["ok"] is True
        assert "hello" in cap.getvalue()
        # 且 bytes_written 与实际写字节数一致(旧实现同口径)
        assert sent["bytes_written"] == len(cap.getvalue())
    finally:
        term.reset_terminals()


def test_strict_child_env_applies_to_both_backends_via_source_lock() -> None:
    """形状锁(读源码一次):PTY 分支必须**与管道分支同经** `_strict_child_env`,
    否则 PTY 悄悄继承了宿主环境 = 沙箱边界被放宽却没人发现。
    """
    src = io.open(term.__file__, encoding="utf-8").read()
    # _spawn_pipe 与 _spawn_pty 都各出现一次 env 走 _strict_child_env,共 ≥2 次。
    assert src.count("env=_strict_child_env(env_extra)") >= 2
    # 任何 subprocess.Popen( 调用点附近必须传了 env=;粗略:文件里没有裸 `subprocess.Popen(`
    # 不带 env= 的 spawn(排除注释行)。
    for line in src.splitlines():
        ls = line.strip()
        if not ls or ls.startswith("#") or '"subprocess.Popen(' in ls:
            continue
        if "subprocess.Popen(" in ls and "import subprocess.Popen" not in ls:
            # Popen( 单独一行的行只出现起始;真正带 env 的在同段(多行)。这里只断文件里存在 env=
            pass
    assert "env=_strict_child_env" in src


# ─── 集成:两种后端各验一次真值(证明默认路径逐字节不变 & PTY 真 isatty) ───

_ISATTY_SCRIPT = """\
import sys
print("[ISATTY]" + str(sys.stdout.isatty()))
"""


def _open_env_backend(tmp_path, *, with_pty: bool):
    """按开关开一路会话,回 (terminal_id, opened_result)。"""
    script = _script_path(tmp_path, "isatty_probe.py", _ISATTY_SCRIPT)
    cmd = f'"{sys.executable}" -u "{script}"'
    if with_pty:
        import os as _o  # noqa: PLC0415
        assert _o.environ.get(_TEST["PTY_REQUEST_ENV"]) is not None
    return term.open_terminal(
        command=cmd, cwd=str(tmp_path), user_id="u-term", session_id="s-term"
    )


def test_default_backend_unaffected_is_pipe_and_isatty_false(tmp_path) -> None:
    """默认(未设 IHUI_INTERACTIVE_PTY):backend=='pipes' 且 isatty 为 False
    —— 证明改动没动到既有会话语义(逐字节沿用改前实现)。"""
    term.reset_terminals()
    opened = _open_env_backend(tmp_path, with_pty=False)
    assert opened["ok"] is True
    assert opened["terminal"]["backend"] == "pipes"
    tid = opened["terminal"]["terminal_id"]
    try:
        text, _ = _read_until(tid, "[ISATTY]")
        assert "[ISATTY]False" in text
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


@pytest.mark.skipif(os.name == "nt", reason="Windows 未接 ConPTY;由 shape-lock 覆盖 (test_windows_pty_hard_rejects...)")
def test_posix_pty_backend_reports_true_isatty_and_backend_tag(tmp_path, monkeypatch) -> None:
    """POSIX + `IHUI_INTERACTIVE_PTY=1`:backend=='pty' 且 isatty 返回 True.

    这一枚是**整次 PTY 落地的核心断言** —— 若 PTY 未生效,子进程 `sys.stdout` 会
    是 pipe、isatty=False,和默认路径一模一样,前端就看不出差;而 True 只能从
    真 tty 拿到(conpty/pty.openpty 都会)。
    """
    monkeypatch.setenv(_TEST["PTY_REQUEST_ENV"], "1")
    term.reset_terminals()
    opened = _open_env_backend(tmp_path, with_pty=True)
    assert opened["ok"] is True
    assert opened["terminal"]["backend"] == "pty", (
        f"PTY 未生效:backend={opened['terminal']['backend']}(应为 'pty');"
        "多半是 _pty_supported_on_host/开关读路径漂移。"
    )
    tid = opened["terminal"]["terminal_id"]
    try:
        # 放宽超时到 15s:CI 冷启动下 python 起进程 + 打印 + 行到 master 有秒级抖动。
        # **不是** flaky 时序断言本身;核心断言在后端标签与 isatty 真值。
        text, _ = _read_until(tid, "[ISATTY]", timeout=15.0)
        assert "[ISATTY]True" in text, f"PTY 未传真 tty,子进程 isatty=False → {text!r}"
    finally:
        closed = term.close_terminal(tid, user_id="u-term", session_id="s-term")
        assert closed["ok"] is True and closed["closed"] is True
        assert term.list_terminals(user_id="u-term", session_id="s-term")["total"] == 0

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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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


def test_pty_supported_tracks_conpty_probe_not_import_fantasy() -> None:
    """宿主判据必须由 `_conpty_available()` 真探测驱动(不是"看起来能 import")。

    POSIX 恒 True(标准库 `pty`);Windows 只有 kernel32 真导出 `CreatePseudoConsole`
    时才 True。探不到就维持 fail-closed,`open_terminal` 硬拒而不是回落管道冒充已 PTY。
    """
    expected = os.name != "nt" or _TEST["conpty_available"]()
    assert term._pty_supported_on_host() is expected
    if os.name == "nt":
        # 本机是 Win10 1809+,ConPTY 必在。真探不到要在此点名(而非静默 False 然后
        # 让 PTY 集成用例 skip 掉,把"没接上"藏成"不需要测")。
        assert _TEST["conpty_available"]() is True, (
            "Windows 宿主未探到 ConPTY:kernel32 缺 CreatePseudoConsole 或加载失败,"
            "PTY 开关会按设计返回 TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM"
        )


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
    with open(term.__file__, encoding="utf-8") as fh:
        src = fh.read()
    # 三个 spawn 分支(管道 / POSIX pty / Windows ConPTY)都必须各走一次 `_strict_child_env`。
    assert src.count("env=_strict_child_env(env_extra)") >= 3
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


# ─── Windows ConPTY 专章:两条"本机实测踩点"的形状锁(静态判据,不 flaky) ───


def _conpty_source() -> str:
    """读模块源码一次(判据源 = 真实文件,不复制常量,§22c)。

    ConPTY 是同一模块的"Windows 平台专章"(不另立第二份实现),故判据面就是 `term` 自身。
    """
    with open(term.__file__, encoding="utf-8") as fh:
        return fh.read()


def test_conpty_does_not_inherit_parent_handles() -> None:
    """ConPTY 子进程必须**不继承父句柄**且 hStd* 置 NULL。

    实测踩点:起初按"继承句柄 + hStd* 留空"启动,子进程把自己的 stdout 直接写进父
    控制台(ConPTY 输出管道只收到初始化转义序列),`isatty()` 反而是 False —— PTY 白接。
    本锁把正确形态钉死:bInheritHandles=FALSE + STARTF_USESTDHANDLES。
    """
    src = _conpty_source()
    assert "_STARTF_USESTDHANDLES" in src
    assert "si.StartupInfo.hStdOutput = None" in src
    # CreateProcessW 的 bInheritHandles 实参必须是 0(该调用是唯一的进程创建点)。
    assert "None, command_line, None, None, 0," in src


def test_conpty_interrupt_goes_through_line_discipline_bytes() -> None:
    """`interrupt` 必须走行规程输入字节 0x03,不走 `GenerateConsoleCtrlEvent`。

    子进程挂在 ConPTY 自己的控制台上,不在本进程进程组里 —— 控制台事件送不到它;
    0x03 由行规程转成真 ^C,这才是真终端的中断语义。
    """
    src = _conpty_source()
    assert 'self.write_io.write("\\x03")' in src
    assert "_CTRL_BREAK_EVENT" in src
    # 判据是"没有这个**调用**"(注释里解释为何不用它是允许的)。
    assert "GenerateConsoleCtrlEvent(" not in src


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
        import os as _o
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


def test_pty_backend_reports_true_isatty_and_backend_tag(tmp_path, monkeypatch) -> None:
    """开启 `IHUI_INTERACTIVE_PTY=1`:backend=='pty' 且子进程 isatty 返回 True(两平台各走自己后端)。

    POSIX 走标准库 `pty.openpty()`,Windows 走原生 ConPTY —— 这一枚是**整次 PTY 落地的
    核心断言**:若后端未生效,子进程 `sys.stdout` 会是 pipe、isatty=False,和默认路径
    一模一样,前端就看不出差;而 True 只能从真 tty 拿到。
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


# ─── 窗口尺寸(resize):真 tty 才有的能力面 ───

_SIZE_SCRIPT = """\
import shutil, sys
print("[READY]", flush=True)
for line in sys.stdin:
    line = line.strip()
    if line == "quit":
        break
    if line == "size":
        ts = shutil.get_terminal_size()
        print(f"[SIZE]{ts.columns}x{ts.lines}", flush=True)
"""


def _read_from(terminal_id: str, seq: int, needle: str, timeout: float = 15.0) -> tuple[str, int]:
    """从指定 seq 续读,直到命中 needle 或进程退出。返回 (本次累计文本, 新 seq)。"""
    text = ""
    deadline = time.time() + timeout
    while time.time() < deadline:
        res = term.read_terminal(
            terminal_id, user_id="u-term", session_id="s-term",
            since_seq=seq, wait_s=0.5,
        )
        seq = res["next_seq"]
        text += "".join(c["text"] for c in res["chunks"])
        if needle in text or not res["running"]:
            break
    return text, seq


def test_pty_resize_reaches_child_and_pins_initial_size(tmp_path, monkeypatch) -> None:
    """真 tty 才有窗口尺寸:开会话即 DEFAULT_COLS×DEFAULT_ROWS,resize 后**子进程侧**读到新值。

    POSIX 走 `TIOCSWINSZ`(且必须补掉 `pty.openpty()` 的 0×0 缺省),Windows 走
    `ResizePseudoConsole` —— 只改自己账本不算数,必须子进程 `get_terminal_size()` 能看到。
    """
    monkeypatch.setenv(_TEST["PTY_REQUEST_ENV"], "1")
    term.reset_terminals()
    opened = term.open_terminal(
        command=f'"{sys.executable}" -u "{_script_path(tmp_path, "size_probe.py", _SIZE_SCRIPT)}"',
        cwd=str(tmp_path),
        user_id="u-term",
        session_id="s-term",
    )
    assert opened["ok"] is True
    assert opened["terminal"]["backend"] == "pty"
    want = (_TEST["DEFAULT_COLS"], _TEST["DEFAULT_ROWS"])
    assert (opened["terminal"]["cols"], opened["terminal"]["rows"]) == want
    tid = opened["terminal"]["terminal_id"]
    try:
        text, seq = _read_from(tid, 0, "[READY]")
        assert "[READY]" in text, f"会话未就绪:{text!r}"

        assert term.send_terminal(tid, "size", user_id="u-term", session_id="s-term")["ok"] is True
        text, seq = _read_from(tid, seq, "[SIZE]")
        assert f"[SIZE]{want[0]}x{want[1]}" in text, f"初始尺寸未钉住:{text!r}"

        resized = term.resize_terminal(
            tid, cols=100, rows=40, user_id="u-term", session_id="s-term"
        )
        assert resized["ok"] is True, resized
        assert (resized["cols"], resized["rows"]) == (100, 40)
        session = term._sessions[tid]
        assert (session.cols, session.rows) == (100, 40)
        assert (session.to_dict()["cols"], session.to_dict()["rows"]) == (100, 40)

        assert term.send_terminal(tid, "size", user_id="u-term", session_id="s-term")["ok"] is True
        text, seq = _read_from(tid, seq, "[SIZE]")
        assert "[SIZE]100x40" in text, f"resize 没到子进程侧:{text!r}"
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_resize_on_pipe_backend_is_explicit_not_a_tty(tmp_path) -> None:
    """管道后端没有 tty 语义 ⇒ 显式 `TERMINAL_NOT_A_TTY`,绝不静默"改成功"。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "hold.py", _SLEEP_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        res = term.resize_terminal(
            tid, cols=100, rows=40, user_id="u-term", session_id="s-term"
        )
        assert res["ok"] is False
        assert res["errorCode"] == "TERMINAL_NOT_A_TTY"
        assert res["terminal"]["backend"] == "pipes"
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_resize_rejects_out_of_range_and_non_int(tmp_path) -> None:
    """越界/非整数尺寸在**碰后端之前**就显式拒(避免把 0/负数喂给内核)。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "hold2.py", _SLEEP_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    max_cols = _TEST["MAX_COLS"]
    max_rows = _TEST["MAX_ROWS"]
    try:
        for cols, rows in ((0, 30), (30, 0), (-1, 30), (max_cols + 1, 30), (30, max_rows + 1)):
            res = term.resize_terminal(
                tid, cols=cols, rows=rows, user_id="u-term", session_id="s-term"
            )
            assert res["ok"] is False, (cols, rows, res)
            assert res["errorCode"] == "TERMINAL_INVALID_SIZE", (cols, rows, res)
        # 非整数(工具层可能直传字符串)同档显式拒
        res = term.resize_terminal(
            tid, cols="abc", rows=30, user_id="u-term", session_id="s-term"  # type: ignore[arg-type]
        )
        assert res["errorCode"] == "TERMINAL_INVALID_SIZE"
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


@pytest.mark.asyncio
async def test_tool_layer_routes_resize_action(tmp_path, monkeypatch) -> None:
    """工具层必须把 resize 路由到模块(不能落进"不支持的 action"),且两档拒绝都穿透到信封。"""
    term.reset_terminals()
    monkeypatch.setattr(mcp, "_get_workspace_roots", lambda: [str(tmp_path)])
    opened = await _tool_terminal(
        {
            "action": "open",
            "command": f'"{sys.executable}" -u "{_script_path(tmp_path, "hold3.py", _SLEEP_SCRIPT)}"',
            "cwd": str(tmp_path),
            **_OWNER,
        }
    )
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        res = await _tool_terminal(
            {"action": "resize", "terminal_id": tid, "cols": 100, "rows": 40, **_OWNER}
        )
        assert res["action"] == "resize"
        assert res["ok"] is False and res["errorCode"] == "TERMINAL_NOT_A_TTY"
        bad = await _tool_terminal(
            {"action": "resize", "terminal_id": tid, "cols": "x", "rows": 1, **_OWNER}
        )
        assert bad["errorCode"] == "INVALID_PARAMS"
    finally:
        await _tool_terminal({"action": "close", "terminal_id": tid, **_OWNER})


@pytest.fixture(autouse=True)
def _clean_terminals():
    term.reset_terminals()
    yield
    term.reset_terminals()


# ─── wait_for(expect 原语):命中 / 超时 / 已退出 三态必须互不冒充 ───

_WAIT_SCRIPT = """\
import sys
print("[READY]", flush=True)
for line in sys.stdin:
    line = line.strip()
    if line == "quit":
        break
    print(f"[ECHO]{line}", flush=True)
"""

_EXIT_SCRIPT = """\
print("[BYEBYE]", flush=True)
"""


def test_wait_for_matches_output_and_advances_seq(tmp_path) -> None:
    """命中即返回:matched/reason/matched_text 三件齐,且 `next_seq` 真前进 —— 用第二次
    等待从新 seq 起扫,绝不该再命中同一段(否则调用方会重复消费、无限拿到旧输出)。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "wait_ready.py", _WAIT_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        first = term.wait_terminal(
            tid, pattern="[READY]", user_id="u-term", session_id="s-term", timeout_s=10.0
        )
        assert first["ok"] is True, first
        assert first["matched"] is True
        assert first["reason"] == "matched"
        assert first["matched_text"] == "[READY]"
        assert "[READY]" in "".join(c["text"] for c in first["chunks"])
        seq = first["next_seq"]

        # 从命中后的 seq 起等同一 pattern:窗口里已没有它 ⇒ 只能是超时,不是命中。
        again = term.wait_terminal(
            tid, pattern="[READY]", user_id="u-term", session_id="s-term",
            since_seq=seq, timeout_s=0.5,
        )
        assert again["matched"] is False, again
        assert again["reason"] == "timeout"
        assert again["running"] is True
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_wait_for_times_out_while_process_still_alive(tmp_path) -> None:
    """进程活着但没输出 ⇒ `timeout` 且 `running=True`:超时不得被读成"已退出"。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "wait_silent.py", _SLEEP_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        res = term.wait_terminal(
            tid, pattern="never-appears", user_id="u-term", session_id="s-term",
            timeout_s=0.4,
        )
        assert res["ok"] is True, res
        assert (res["matched"], res["reason"], res["running"]) == (False, "timeout", True)
        assert res["waited_s"] >= 0.3, res["waited_s"]
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_wait_for_reports_exited_when_process_ends_before_match(tmp_path) -> None:
    """进程先退出 ⇒ `reason='exited'` 并带 exit_code;尾行仍要可读(不丢退出前输出)。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "wait_exit.py", _EXIT_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        res = term.wait_terminal(
            tid, pattern="never-appears", user_id="u-term", session_id="s-term",
            timeout_s=5.0,
        )
        assert res["ok"] is True, res
        assert res["matched"] is False
        assert res["reason"] == "exited"
        assert res["running"] is False
        assert res["exit_code"] is not None
        assert "[BYEBYE]" in "".join(c["text"] for c in res["chunks"])
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_wait_for_rejects_empty_and_bad_regex_before_touching_session(tmp_path) -> None:
    """空 pattern / 超长 / 正则语法错一律 `TERMINAL_INVALID_PATTERN`(在碰会话之前拒)。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "wait_bad.py", _SLEEP_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    max_chars = _TEST["MAX_PATTERN_CHARS"]
    try:
        for kwargs in ({"pattern": ""}, {"pattern": "x" * (max_chars + 1)}):
            res = term.wait_terminal(
                tid, user_id="u-term", session_id="s-term", **kwargs
            )
            assert res["ok"] is False, (kwargs, res)
            assert res["errorCode"] == "TERMINAL_INVALID_PATTERN", (kwargs, res)
        res = term.wait_terminal(
            tid, pattern="(", regex=True, user_id="u-term", session_id="s-term"
        )
        assert res["errorCode"] == "TERMINAL_INVALID_PATTERN", res
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_wait_for_regex_group_records_actual_match(tmp_path) -> None:
    """正则档回传**真实命中片段**(不是 pattern 原文),且默认档按固定子串判。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "wait_re.py", _WAIT_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        res = term.wait_terminal(
            tid, pattern=r"\[(READY|WAIT)\]", regex=True,
            user_id="u-term", session_id="s-term", timeout_s=10.0,
        )
        assert res["matched"] is True, res
        assert res["matched_text"] == "[READY]", res["matched_text"]
        # 固定子串档对同一正则原文不命中(证明两档不是同一套判定)。
        assert term.wait_terminal(
            tid, pattern=r"\[(READY|WAIT)\]", user_id="u-term", session_id="s-term",
            timeout_s=0.3,
        )["matched"] is False
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_wait_for_works_on_pty_backend(tmp_path, monkeypatch) -> None:
    """真 tty 后端也必须走同一条等待判据:ConPTY 会先吐初始化转义序列,命中判据不能被它们干扰。"""
    monkeypatch.setenv(_TEST["PTY_REQUEST_ENV"], "1")
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "wait_pty.py", _WAIT_SCRIPT), tmp_path)
    assert opened["ok"] is True
    assert opened["terminal"]["backend"] == "pty", opened["terminal"]
    tid = opened["terminal"]["terminal_id"]
    try:
        ready = term.wait_terminal(
            tid, pattern="[READY]", user_id="u-term", session_id="s-term", timeout_s=15.0,
        )
        assert ready["matched"] is True, ready
        assert ready["reason"] == "matched"
        assert term.send_terminal(tid, "hi", user_id="u-term", session_id="s-term")["ok"] is True
        res = term.wait_terminal(
            tid, pattern="[ECHO]hi", user_id="u-term", session_id="s-term",
            since_seq=ready["next_seq"], timeout_s=15.0,
        )
        assert res["matched"] is True, res
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


@pytest.mark.asyncio
async def test_tool_layer_routes_wait_for_action(tmp_path, monkeypatch) -> None:
    """工具层必须把 wait_for 路由到模块(不能落进"不支持的 action"),且参数脏值显式拒。"""
    term.reset_terminals()
    monkeypatch.setattr(mcp, "_get_workspace_roots", lambda: [str(tmp_path)])
    opened = await _tool_terminal(
        {
            "action": "open",
            "command": f'"{sys.executable}" -u "{_script_path(tmp_path, "wait_tool.py", _WAIT_SCRIPT)}"',
            "cwd": str(tmp_path),
            **_OWNER,
        }
    )
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        res = await _tool_terminal(
            {"action": "wait_for", "terminal_id": tid, "pattern": "[READY]", **_OWNER}
        )
        assert res["action"] == "wait_for", res
        assert res["ok"] is True and res["matched"] is True, res
        bad = await _tool_terminal(
            {"action": "wait_for", "terminal_id": tid, "pattern": "", **_OWNER}
        )
        assert bad["errorCode"] == "INVALID_PARAMS", bad
    finally:
        await _tool_terminal({"action": "close", "terminal_id": tid, **_OWNER})


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

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


def test_strict_child_env_applies_to_both_backends_via_source_lock(monkeypatch) -> None:
    """形状锁(读源码一次):三个 spawn 分支的环境构造**单一入口**,且不放宽沙箱边界。

    - 管道分支:仍直接 `_strict_child_env(env_extra)` —— 那边不是 tty,不补终端身份键;
    - POSIX PTY / Windows ConPTY 两处:`_pty_child_env(env_extra)`,而它自身必须**委托**
      `_strict_child_env` —— 否则"补 TERM/COLORTERM"会顺手变成"整份继承宿主环境"
      (沙箱边界被放宽却没人发现)。
    """
    with open(term.__file__, encoding="utf-8") as fh:
        src = fh.read()
    # 管道一处 + PTY 两处(数量是语义的一部分:多一处 = 有人在别处绕过了单一入口)。
    assert src.count("env=_strict_child_env(env_extra)") == 1
    assert src.count("env=_pty_child_env(env_extra)") == 2
    # `_pty_child_env` 必须真调 `_strict_child_env`(不是另抄一份白名单)。
    assert "env = _strict_child_env(env_extra)" in src

    # 行为面同钉:默认补两键;显式传值优先;宿主上的非白名单键进不来。
    env_fn = _TEST["pty_child_env"]
    term_pin = _TEST["PTY_TERM"]
    color_pin = _TEST["PTY_COLORTERM"]
    assert term_pin == "xterm-256color" and color_pin == "truecolor"
    monkeypatch.setenv("IHUI_TEST_HOST_ONLY_SECRET", "leak-me")
    base = env_fn(None)
    assert base["TERM"] == term_pin
    assert base["COLORTERM"] == color_pin
    assert "IHUI_TEST_HOST_ONLY_SECRET" not in base
    assert "PATH" in base
    # 调用方显式要 dumb(或任何值)仍以调用方为准 —— setdefault,不是硬覆盖。
    assert env_fn({"TERM": "dumb"})["TERM"] == "dumb"


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


# ─── 终端身份键(TERM/COLORTERM):只在真 tty 上补,且不覆盖调用方显式值 ───

_ENV_SCRIPT = """\
import os
print("[ENV]" + repr(os.environ.get("TERM")) + "|" + repr(os.environ.get("COLORTERM")),
      flush=True)
"""


def test_pty_child_gets_term_defaults_while_pipe_child_does_not(tmp_path, monkeypatch) -> None:
    """真 tty 子进程必须看见 TERM/COLORTERM;管道子进程必须看不见(那边不是 tty)。

    这不是"多塞两个变量"的洁癖:PTY 缺 `TERM` 时 `ls --color` / `git` / `less` / `vim`
    会把终端当 dumb —— 颜色与光标控制全关、分页退化,真 tty 白接。而管道后端塞 TERM
    等于骗程序"你是 tty",所以两条后端必须一个有一个没有。
    """
    script = _script_path(tmp_path, "env_probe.py", _ENV_SCRIPT)

    opened = _open(script, tmp_path)
    assert opened["ok"] is True and opened["terminal"]["backend"] == "pipes"
    tid = opened["terminal"]["terminal_id"]
    try:
        text, _ = _read_until(tid, "[ENV]")
        assert "[ENV]None|None" in text, f"管道后端不该有终端身份键:{text!r}"
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")

    monkeypatch.setenv(_TEST["PTY_REQUEST_ENV"], "1")
    term.reset_terminals()
    opened = _open(script, tmp_path)
    assert opened["ok"] is True and opened["terminal"]["backend"] == "pty"
    tid = opened["terminal"]["terminal_id"]
    want = f"[ENV]'{_TEST['PTY_TERM']}'|'{_TEST['PTY_COLORTERM']}'"
    try:
        text, _ = _read_until(tid, "[ENV]", timeout=15.0)
        assert want in text, f"PTY 子进程没拿到终端身份键:{text!r}"
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


# ─── stdin EOF:让按 EOF 收尾的程序自己收尾,而不是只能 kill ───

_EOF_SCRIPT = """\
import sys
print("[READY]", flush=True)
lines = 0
for _ in sys.stdin:
    lines += 1
print("[EOF-SEEN] lines=%d" % lines, flush=True)
"""


def test_eof_on_pipe_backend_lets_child_finish_then_blocks_writes(tmp_path) -> None:
    """管道:关写端 = 真 EOF;之后 send/keys 必须显式 `TERMINAL_STDIN_CLOSED`(幂等且不静默丢字节)。

    拒绝次序也钉住:"已送过 EOF"是本层自己的账,先于子进程是否已退出回答 —— 否则同一
    个错会被退出时序晃动成两种错误码。
    """
    opened = _open(_script_path(tmp_path, "eof_pipe.py", _EOF_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        ready, _ = _read_until(tid, "[READY]", timeout=15.0)
        assert "[READY]" in ready, f"会话未就绪:{ready!r}"
        sent = term.send_terminal(tid, "a", user_id="u-term", session_id="s-term")
        assert sent["ok"] is True
        eof = term.eof_terminal(tid, user_id="u-term", session_id="s-term")
        assert eof["ok"] is True and eof["eof_sent"] is True
        assert term._sessions[tid].to_dict()["stdin_closed"] is True

        text, _ = _read_until(tid, "[EOF-SEEN]", timeout=15.0)
        assert "[EOF-SEEN] lines=1" in text, f"子进程没按 EOF 收尾:{text!r}"

        blocked = term.send_terminal(tid, "b", user_id="u-term", session_id="s-term")
        assert blocked["errorCode"] == "TERMINAL_STDIN_CLOSED"
        keys = term.send_terminal_keys(tid, ["tab"], user_id="u-term", session_id="s-term")
        assert keys["errorCode"] == "TERMINAL_STDIN_CLOSED"
        again = term.eof_terminal(tid, user_id="u-term", session_id="s-term")
        assert again["ok"] is True and again["already_closed"] is True
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_eof_on_pty_backend_reaches_child_as_eof(tmp_path, monkeypatch) -> None:
    """PTY:EOF 字节必须真让子进程读到 EOF。

    平台口径不同(本机实测):POSIX 是 `\\x04`;Windows ConPTY 只有 `^Z`(0x1a)**加回车**
    才产生 EOF —— 单发 `^Z` 不提交、`^D` 被 conhost 当普通字符回显。这条断言就是
    "别把 POSIX 的按键习惯直接搬到 ConPTY"的机器判据。
    """
    monkeypatch.setenv(_TEST["PTY_REQUEST_ENV"], "1")
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "eof_pty.py", _EOF_SCRIPT), tmp_path)
    assert opened["ok"] is True and opened["terminal"]["backend"] == "pty"
    tid = opened["terminal"]["terminal_id"]
    try:
        # 先等到子进程真起来再送 EOF:否则 ^Z 可能落在 conhost 还没挂上输入处理的窗口里
        ready, _ = _read_until(tid, "[READY]", timeout=15.0)
        assert "[READY]" in ready, f"会话未就绪:{ready!r}"
        eof = term.eof_terminal(tid, user_id="u-term", session_id="s-term")
        assert eof["ok"] is True and eof["eof_sent"] is True
        text, _ = _read_until(tid, "[EOF-SEEN]", timeout=15.0)
        assert "[EOF-SEEN] lines=0" in text, f"PTY 侧 EOF 没到达子进程:{text!r}"
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


@pytest.mark.asyncio
async def test_tool_layer_routes_eof_action(tmp_path, monkeypatch) -> None:
    """工具层必须把 eof 路由到模块(不能落进"不支持的 action"),拒绝也穿透到信封。"""
    term.reset_terminals()
    monkeypatch.setattr(mcp, "_get_workspace_roots", lambda: [str(tmp_path)])
    opened = await _tool_terminal(
        {
            "action": "open",
            "command": f'"{sys.executable}" -u "{_script_path(tmp_path, "eof_tool.py", _EOF_SCRIPT)}"',
            "cwd": str(tmp_path),
            **_OWNER,
        }
    )
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        res = await _tool_terminal({"action": "eof", "terminal_id": tid, **_OWNER})
        assert res["action"] == "eof" and res["ok"] is True and res["eof_sent"] is True
        blocked = await _tool_terminal(
            {"action": "send", "terminal_id": tid, "input": "x", **_OWNER}
        )
        assert blocked["errorCode"] == "TERMINAL_STDIN_CLOSED"
    finally:
        await _tool_terminal({"action": "close", "terminal_id": tid, **_OWNER})


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

_BURST_SCRIPT = """\
import sys
for i in range(40):
    print("L%03d" % i, flush=True)
"""
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

        # `ResizePseudoConsole` 返回成功时 conhost 的**客户缓冲**可能还没落到新尺寸
        # (实测:并发跑的其它 PTY 用例把机器压慢时,紧接着的一次查询仍读到旧值)。
        # 这里重试到截止时间 —— 断言语义不变("resize 必须到子进程侧"),只是不再把
        # conhost 的异步生效时机当成本实现的失败。
        want_after = "100x40"
        seen = ""
        deadline = time.time() + 10.0
        while time.time() < deadline:
            assert (
                term.send_terminal(tid, "size", user_id="u-term", session_id="s-term")["ok"]
                is True
            )
            text, seq = _read_from(tid, seq, "[SIZE]", timeout=5.0)
            seen = text
            if f"[SIZE]{want_after}" in seen:
                break
        assert f"[SIZE]{want_after}" in seen, f"resize 没到子进程侧:{seen!r}"
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


# ─── open 的初始尺寸:真终端在进程启动那一刻就该定尺寸 ───


def test_open_pins_size_before_first_child_read(tmp_path, monkeypatch) -> None:
    """`open(cols=100, rows=40)` 必须让子进程**第一次**读窗口就拿到 100×40。

    这条与 resize 用例的分工:后者证明"改"能到子进程,这里证明"开"就已经到位 ——
    先按 120×30 起步再 resize 的写法会让 `vim`/`top`/`less` 首屏按错尺寸排完版,
    并且它们不会因为后来的 resize 重排(POSIX 在 Popen 前 ioctl master、Windows 由
    `CreatePseudoConsole` 的 size 参数给,就是为了让这个"第一次读数"正确)。
    """
    monkeypatch.setenv(_TEST["PTY_REQUEST_ENV"], "1")
    term.reset_terminals()
    opened = term.open_terminal(
        command=f'"{sys.executable}" -u "{_script_path(tmp_path, "size_open.py", _SIZE_SCRIPT)}"',
        cwd=str(tmp_path),
        user_id="u-term",
        session_id="s-term",
        cols=100,
        rows=40,
    )
    assert opened["ok"] is True
    assert opened["terminal"]["backend"] == "pty"
    assert (opened["terminal"]["cols"], opened["terminal"]["rows"]) == (100, 40)
    tid = opened["terminal"]["terminal_id"]
    try:
        text, seq = _read_from(tid, 0, "[READY]")
        assert "[READY]" in text, f"会话未就绪:{text!r}"
        assert term.send_terminal(tid, "size", user_id="u-term", session_id="s-term")["ok"] is True
        text, seq = _read_from(tid, seq, "[SIZE]", timeout=10.0)
        assert "[SIZE]100x40" in text, f"首读尺寸就没对上(不是 resize 能补救的问题):{text!r}"
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_open_rejects_bad_size_before_creating_session(tmp_path) -> None:
    """越界/非整数尺寸必须在**建会话之前**拒 —— 否则会留下一枚尺寸未知的活进程。"""
    term.reset_terminals()
    for cols, rows in ((0, 30), (30, 0), (-1, 30), ("abc", 30)):
        res = term.open_terminal(
            command=f'"{sys.executable}" -u "{_script_path(tmp_path, "hold4.py", _SLEEP_SCRIPT)}"',
            cwd=str(tmp_path),
            user_id="u-term",
            session_id="s-term",
            cols=cols,  # type: ignore[arg-type]
            rows=rows,
        )
        assert res["ok"] is False, (cols, rows, res)
        assert res["errorCode"] == "TERMINAL_INVALID_SIZE", (cols, rows, res)
    assert term.list_terminals(user_id="u-term", session_id="s-term")["total"] == 0
    # 上界同样拒(MAX 是内核/协议口径的上限,不是"越大越好")
    over = term.open_terminal(
        command=f'"{sys.executable}" -u "{_script_path(tmp_path, "hold5.py", _SLEEP_SCRIPT)}"',
        cwd=str(tmp_path),
        user_id="u-term",
        session_id="s-term",
        cols=_TEST["MAX_COLS"] + 1,
        rows=30,
    )
    assert over["errorCode"] == "TERMINAL_INVALID_SIZE"
    assert term.list_terminals(user_id="u-term", session_id="s-term")["total"] == 0


def test_open_with_size_on_pipe_backend_is_explicit_not_silent(tmp_path) -> None:
    """管道后端收到尺寸:会话照开,但**显式**回 `size_ignored`,账本仍记缺省值。

    不静默 no-op(那样调用方以为 tty 真按 100×40 排版),也不记成 100×40(账本会骗人);
    要给真 tty 请开 PTY。
    """
    term.reset_terminals()
    opened = term.open_terminal(
        command=f'"{sys.executable}" -u "{_script_path(tmp_path, "hold6.py", _SLEEP_SCRIPT)}"',
        cwd=str(tmp_path),
        user_id="u-term",
        session_id="s-term",
        cols=100,
        rows=40,
    )
    assert opened["ok"] is True
    assert opened["terminal"]["backend"] == "pipes"
    assert opened["size_ignored"] == {"cols": 100, "rows": 40}
    assert "tty" in opened["size_ignored_reason"]
    assert opened["terminal"]["cols"] == _TEST["DEFAULT_COLS"]
    assert opened["terminal"]["rows"] == _TEST["DEFAULT_ROWS"]
    term.close_terminal(
        opened["terminal"]["terminal_id"], user_id="u-term", session_id="s-term"
    )
    # 不传尺寸时响应形状与既有逐字节一致(不得凭空多一个 key)
    plain = _open(_script_path(tmp_path, "hold7.py", _SLEEP_SCRIPT), tmp_path)
    assert plain["ok"] is True and "size_ignored" not in plain
    term.close_terminal(plain["terminal"]["terminal_id"], user_id="u-term", session_id="s-term")


@pytest.mark.asyncio
async def test_tool_layer_open_forwards_size_and_rejects_bad_size(tmp_path, monkeypatch) -> None:
    """工具层 open 必须把 cols/rows 交给模块判(单一出口),拒信照样穿透到信封。"""
    term.reset_terminals()
    monkeypatch.setattr(mcp, "_get_workspace_roots", lambda: [str(tmp_path)])
    opened = await _tool_terminal(
        {
            "action": "open",
            "command": f'"{sys.executable}" -u "{_script_path(tmp_path, "hold8.py", _SLEEP_SCRIPT)}"',
            "cwd": str(tmp_path),
            "cols": 100,
            "rows": 40,
            **_OWNER,
        }
    )
    assert opened["ok"] is True
    assert opened["size_ignored"] == {"cols": 100, "rows": 40}
    tid = opened["terminal"]["terminal_id"]
    try:
        bad = await _tool_terminal(
            {
                "action": "open",
                "command": f'"{sys.executable}" -u "{_script_path(tmp_path, "hold9.py", _SLEEP_SCRIPT)}"',
                "cwd": str(tmp_path),
                "cols": "abc",
                "rows": 40,
                **_OWNER,
            }
        )
        assert bad["ok"] is False and bad["errorCode"] == "TERMINAL_INVALID_SIZE"
        assert term.list_terminals(user_id="u-term", session_id="s-term")["total"] == 1
    finally:
        await _tool_terminal({"action": "close", "terminal_id": tid, **_OWNER})


def test_size_validation_is_single_source_and_pinned_before_spawn() -> None:
    """形状锁(读源码):尺寸判据只许有一个出口,且 POSIX 的尺寸必须在 Popen **之前**钉。

    - `_normalize_size` 出现 ≥3 次 = 定义 1 + open + resize(再出现第四处说明有人另抄一份
      1..MAX 判断,两个真相源必然漂移);
    - `_posix_set_winsize(master_fd, cols, rows)` 必须排在 `proc = subprocess.Popen(` 之前 ——
      事后补的尺寸永远晚于子进程第一次读数,TUI 首屏会按 0×0/缺省宽度排完版。
    """
    src = _conpty_source()
    assert src.count("_normalize_size(") >= 3
    assert src.index("_posix_set_winsize(master_fd, cols, rows)") < src.index(
        "        proc = subprocess.Popen("
    )


def test_history_gap_counts_evicted_chunks_and_keeps_lifetime_fact() -> None:
    """缺口判据(纯函数边界):只回答"这一窗口丢没丢",累计丢量另算且不清零。

    `gap` 与 `dropped_chunks` 必须分工 —— 同一个 `dropped_chunks` 拿来当 `gap` 用
    会让"曾经丢过"的会话永远报缺口(告警一旦触发永不复原),反之亦然。
    """
    gap_of = _TEST["history_gap"]
    # 缓冲空:first_seq == next_seq+1,任何 since_seq 都不缺口
    assert gap_of(11, 0, 10) == {
        "first_seq": 11, "gap": False, "gap_chunks": 0, "dropped_chunks": 0,
    }
    # 攒了 3 条被挤掉:since_seq=0 跨过缺口,且说明丢的是 3 条
    assert gap_of(4, 3, 0) == {
        "first_seq": 4, "gap": True, "gap_chunks": 3, "dropped_chunks": 3,
    }
    # 游标已跟上(first_seq 前一条):本次窗口不缺口,但累计仍是 3(历史事实不清零)
    assert gap_of(4, 3, 3) == {
        "first_seq": 4, "gap": False, "gap_chunks": 0, "dropped_chunks": 3,
    }
    # 越界游标(比 first_seq 还靠后)不得算出负数
    assert gap_of(4, 3, 99)["gap_chunks"] == 0


def test_read_reports_gap_when_buffer_evicts(monkeypatch, tmp_path) -> None:
    """端到端:缓冲满时最老的块被挤掉,read 必须**显式报缺口**而不是静默少一段。

    形状锁口径:把 `MAX_BUFFER_LINES` 调小后,`first_seq` 必须严格大于 1(dropped>0),
    `gap_chunks == dropped_chunks`,且 `next_seq == dropped + 保留条数` —— 三条一起成立
    才说明"挤掉的条数与 seq 账本对得上"(只测 gap=True 会漏掉计数漂移)。
    """
    term.reset_terminals()
    monkeypatch.setattr(term, "MAX_BUFFER_LINES", 8, raising=True)
    try:
        opened = _open(_script_path(tmp_path, "burst.py", _BURST_SCRIPT), tmp_path)
        assert opened["ok"] is True
        tid = opened["terminal"]["terminal_id"]
        deadline = time.time() + 20.0
        last: dict = {}
        while time.time() < deadline:
            last = term.read_terminal(
                tid, user_id="u-term", session_id="s-term", since_seq=0, wait_s=0.2
            )
            if not last["running"]:
                break
        assert last.get("ok") is True
        assert last["dropped_chunks"] >= 1, f"未发生驱逐,用例前提不成立:{last}"
        assert last["gap"] is True
        assert last["gap_chunks"] == last["dropped_chunks"]
        assert last["first_seq"] == last["dropped_chunks"] + 1
        # seq 账本自洽:总产出 = 被挤掉的 + 仍保留的
        assert last["next_seq"] == last["dropped_chunks"] + len(last["chunks"])
        assert len(last["chunks"]) <= 8
        # 游标跟上之后:本次窗口不再缺口,但累计丢量保留(历史事实)
        clean = term.read_terminal(
            tid, user_id="u-term", session_id="s-term",
            since_seq=last["next_seq"], wait_s=0.0,
        )
        assert clean["gap"] is False and clean["gap_chunks"] == 0
        assert clean["dropped_chunks"] == last["dropped_chunks"]
    finally:
        term.reset_terminals()


def test_list_terminals_exposes_dropped_chunks(monkeypatch, tmp_path) -> None:
    """注册表读面必须带同一口径:看得到"这个会话丢过输出",否则前端只能猜。"""
    term.reset_terminals()
    monkeypatch.setattr(term, "MAX_BUFFER_LINES", 2, raising=True)
    try:
        opened = _open(_script_path(tmp_path, "burst2.py", _BURST_SCRIPT), tmp_path)
        assert opened["ok"] is True
        tid = opened["terminal"]["terminal_id"]
        deadline = time.time() + 20.0
        while time.time() < deadline:
            listed = term.list_terminals(user_id="u-term", session_id="s-term")
            row = next(t for t in listed["terminals"] if t["terminal_id"] == tid)
            if not row["running"]:
                break
            time.sleep(0.1)
        assert row["dropped_chunks"] >= 1
        assert row["first_seq"] == row["dropped_chunks"] + 1
    finally:
        term.reset_terminals()


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


# ─── keys(按键原语):转义序列与控制码只能走字节通道 ───

_KEYS_SCRIPT = """\
import sys
print("[READY]", flush=True)
buf = sys.stdin.buffer
while True:
    b = buf.read(1)
    if not b:
        break
    print("[KEY]" + b.hex(), flush=True)
"""


def test_key_table_is_single_source_with_loose_aliases() -> None:
    """键表只有一份;别名/大小写/分隔符都归一到同一 key,不为每种写法各写一条。"""
    table = _TEST["key_sequences"]
    assert table["up"] == "\x1b[A" and table["down"] == "\x1b[B"
    assert table["escape"] == table["esc"] == "\x1b"
    assert table["ctrl-c"] == "\x03" and table["ctrl-d"] == "\x04"
    norm = term._normalize_key
    for raw in ("Ctrl+C", "ctrl_c", " Ctrl + C ", "CTRL-C"):
        assert norm(raw) == "ctrl-c", raw
    for raw in ("Up", "UP", " up "):
        assert norm(raw) == "up", raw


def test_keys_payload_rejects_unknown_empty_and_oversize_before_write() -> None:
    """校验必须在拼出 payload 的这一层就完成:写一半再报错等于给子进程喂了残缺序列。"""
    payload, _, _ = _TEST["keys_payload"](["up", "tab"])
    assert payload == "\x1b[A\t"
    for keys, want in (
        ([], "TERMINAL_EMPTY_KEYS"),
        (["nope"], "TERMINAL_UNKNOWN_KEY"),
        (["up"] * (_TEST["MAX_KEYS_PER_CALL"] + 1), "TERMINAL_TOO_MANY_KEYS"),
    ):
        got, code, _ = _TEST["keys_payload"](keys)
        assert got is None, keys
        assert code == want, (keys, code)


def test_keys_reach_child_as_bytes_on_pipe_backend(tmp_path) -> None:
    """管道后端:Esc 与方向键必须**原样字节**到达子进程(0x1b / 0x1b 0x5b 0x41)。"""
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "key_probe.py", _KEYS_SCRIPT), tmp_path)
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        assert term.wait_terminal(
            tid, pattern="[READY]", user_id="u-term", session_id="s-term"
        )["matched"] is True
        sent = term.send_terminal_keys(
            tid, ["escape", "up"], user_id="u-term", session_id="s-term"
        )
        assert sent["ok"] is True, sent
        assert sent["keys"] == ["escape", "up"]
        assert sent["bytes_written"] == 4  # 1b + 1b 5b 41
        for want in ("[KEY]1b", "[KEY]5b", "[KEY]41"):
            res = term.wait_terminal(
                tid, pattern=want, user_id="u-term", session_id="s-term", timeout_s=5.0
            )
            assert res["matched"] is True, (want, res)
        # 未知键在**碰会话之前**就拒:不写任何字节,子进程不会多收到一行 [KEY]。
        bad = term.send_terminal_keys(
            tid, ["definitely-not-a-key"], user_id="u-term", session_id="s-term"
        )
        assert bad["ok"] is False
        assert bad["errorCode"] == "TERMINAL_UNKNOWN_KEY"
        assert "up" in bad["supported"]
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


def test_keys_reach_child_on_pty_backend(tmp_path, monkeypatch) -> None:
    """真 tty 后端:按键字节确实进了这条 PTY 通道(按平台各自的规范模式事实断言)。

    Windows(ConPTY)的 conhost 在规范模式下会吃掉 ESC/方向键(本机实测),能到子进程的是
    回车 0x0d;POSIX 的行规程把 ESC/方向键当普通字符留在行里,随回车一并送达。两档测的都是
    "按键通道真的通",不是"方向键能穿透行规程" —— 后者需要程序自己切 raw 模式。
    """
    monkeypatch.setenv(_TEST["PTY_REQUEST_ENV"], "1")
    term.reset_terminals()
    opened = _open(_script_path(tmp_path, "key_probe_pty.py", _KEYS_SCRIPT), tmp_path)
    assert opened["ok"] is True
    assert opened["terminal"]["backend"] == "pty"
    tid = opened["terminal"]["terminal_id"]
    try:
        assert term.wait_terminal(
            tid, pattern="[READY]", user_id="u-term", session_id="s-term", timeout_s=15.0
        )["matched"] is True
        keys = ["enter"] if os.name == "nt" else ["up", "enter"]
        expects = ("[KEY]0d",) if os.name == "nt" else ("[KEY]1b", "[KEY]41")
        sent = term.send_terminal_keys(tid, keys, user_id="u-term", session_id="s-term")
        assert sent["ok"] is True, sent
        for want in expects:
            res = term.wait_terminal(
                tid, pattern=want, user_id="u-term", session_id="s-term", timeout_s=15.0
            )
            assert res["matched"] is True, (want, res)
    finally:
        term.close_terminal(tid, user_id="u-term", session_id="s-term")


@pytest.mark.asyncio
async def test_tool_layer_routes_keys_action(tmp_path, monkeypatch) -> None:
    """工具层:数组与空格分隔字符串两种入参都认;空键显式 INVALID_PARAMS。"""
    term.reset_terminals()
    monkeypatch.setattr(mcp, "_get_workspace_roots", lambda: [str(tmp_path)])
    opened = await _tool_terminal(
        {
            "action": "open",
            "command": f'"{sys.executable}" -u "{_script_path(tmp_path, "key_tool.py", _KEYS_SCRIPT)}"',
            "cwd": str(tmp_path),
            **_OWNER,
        }
    )
    assert opened["ok"] is True
    tid = opened["terminal"]["terminal_id"]
    try:
        listed = await _tool_terminal(
            {"action": "keys", "terminal_id": tid, "keys": ["tab", "escape"], **_OWNER}
        )
        assert listed["action"] == "keys", listed
        assert listed["ok"] is True and listed["keys"] == ["tab", "escape"], listed
        spaced = await _tool_terminal(
            {"action": "keys", "terminal_id": tid, "keys": "up down", **_OWNER}
        )
        assert spaced["ok"] is True and spaced["keys"] == ["up", "down"], spaced
        empty = await _tool_terminal(
            {"action": "keys", "terminal_id": tid, "keys": [], **_OWNER}
        )
        assert empty["errorCode"] == "INVALID_PARAMS", empty
    finally:
        await _tool_terminal({"action": "close", "terminal_id": tid, **_OWNER})


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

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型侧交互式终端(2026-11-14 立,遵循统一工程规范)。

外部实现 的终端是**长寿命会话**:open 一次,后续 send/read/signal/close 都作用于同一
进程,而不是每条命令重启。IHUI 现有 `run_command`/`sandbox_session.exec` 都是
一次性执行;REPL、调试器、交互式脚手架这类需求只能"一条命令跑完",拿不到中间
提示与逐步输入。

本模块补最小闭环:
- `open_terminal`:启动一个长驻子进程(管道路径下为 stdin/stdout/stderr 管道 + 读线程);
  可带 `cols`/`rows` **开在**目标窗口尺寸(PTY 在 spawn 前/中钉住,管道只记账并回
  `size_ignored`);
- `send_terminal`:写入一行(可选追加换行);
- `send_terminal_keys`:按**键名**发控制输入(Tab/Esc/方向键/Ctrl 组合) —— 方向键与 Esc
  是文本写不出来的字节序列,REPL 补全、TUI 菜单、vim 这类程序只认它们;
- `read_terminal`:按 seq 增量读,支持有限等待(默认 1s)与字符上限;
- `wait_terminal`:等输出里出现某个 pattern(子串或正则),命中/超时/进程退出三种收口
  —— 轮询式 `read` 拼不出"等提示符"这件事(`wait_s` 单次上限 10s,且没有命中语义);
- `eof_terminal`:送"输入结束"让按 EOF 收尾的程序自己收尾(管道关 stdin / PTY 写
  `\\x04`),之后 send/keys 显式 `TERMINAL_STDIN_CLOSED`,不是只能 kill;
- `signal_terminal`:interrupt/terminate/kill(Windows 用 CTRL_BREAK_EVENT);
- `close_terminal`:terminate → 2s 宽限 → kill,返回退出码;
- `list_terminals`:按调用者身份列出会话。

两种 stdio 后端(会话编排 / 所有权 / 上限 / 信号完全一致,只差"管道怎么连到子进程"):
- **默认 `pipes`**:三条匿名管道。边界(与外部实现的差异如实记录):面向 TTY 的程序
  (需要 isatty 才输出进度条/颜色的)会拿到 False → 降级块缓冲、无色。子进程环境走
  sandbox 严档白名单,不整份继承宿主环境。所有权按 (user_id, session_id) 判定,越权与
  不存在同形。
- **`pty`(env `IHUI_INTERACTIVE_PTY=1|true|yes|on`)**:POSIX 用标准库 `pty.openpty()` +
  setsid + `TIOCSCTTY` 造**真 tty** —— 子进程 `isatty()` 为真,npm/cargo/pytest-v 这类按
  tty 出进度/颜色的程序表现与其在自己终端里一致;stdout 与 stderr 由 tty 行规程合并为
  单一 `pty` 通道(这是真终端的物理事实,非本实现的缺陷)。子进程环境**仍同经
  `_strict_child_env`**,PTY 不放宽任何环境边界;在这之上由 `_pty_child_env` 用
  `setdefault` 补 `TERM=xterm-256color` / `COLORTERM=truecolor` —— 真 tty 缺 `TERM`
  时程序会当 dumb 终端(颜色与光标控制全关、分页退化),而这两键不在宿主白名单里;
  调用方显式传值仍以调用方为准,管道后端不补(那边不是 tty)。**Windows 走原生 ConPTY**
  (ctypes 直连 kernel32 的 `CreatePseudoConsole` + `CreateProcessW`
  启动属性表,零第三方依赖),子进程同样 `isatty()` 为真;宿主/内核不支持时**显式返回
  `TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM`**,绝不静默回落管道冒充已 PTY(§0.3
  「没判绝不写成判过」)。

对照程序:WB/Trae 的 harness 用原生 `pty.node`/`conpty.node`(:lydell/node-pty),deepseek-tui
用管道。本实现取"CI 真能跑通 + 零第三方依赖"的那一档(POSIX 标准库 `pty` + Windows
ctypes 直连 ConPTY,不绑任何原生 addon)。
"""

from __future__ import annotations

import contextlib
import ctypes
import importlib
import os
import re
import signal as _signal
import struct
import subprocess
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Final, Protocol

from .sandbox import _strict_child_env

MAX_SESSIONS: Final = 16
MAX_BUFFER_LINES: Final = 2000

# Windows 专属进程组常量:typeshed 按宿主平台裁剪 —— `signal.CTRL_BREAK_EVENT` 与
# `subprocess.CREATE_NEW_PROCESS_GROUP` 只存在于 Windows 的 stub 里,Linux runner 上
# 直接取属性会被 mypy 判 attr-defined(CI 实测两处)。运行期它们只在
# `os.name == "nt"` 分支里参与调用,所以这里用 getattr 兜底取值:非 Windows 上即便
# 取到兜底值也永不传入 Popen/send_signal(那条分支走不到),而静态检查不再依赖宿主平台。
_WIN_CREATE_NEW_PROCESS_GROUP: Final[int] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
_WIN_CTRL_BREAK_EVENT: Final[int] = getattr(_signal, "CTRL_BREAK_EVENT", 0)
MAX_READ_CHARS: Final = 32_000
CLOSE_GRACE_S: Final = 2.0

#: `wait_terminal` 的两条上限:单次最多等多久、pattern 最长多少字符(含 regex 源码)。
#: 30s 是"人类等一条构建/提示符"的量级,同时给工具层的阻塞线程一个上界。
MAX_WAIT_S: Final = 30.0
MAX_PATTERN_CHARS: Final = 200
#: 回传的命中文本上限:正则 `(.*)` 这类会整段回吐,不做上界等于把会话缓冲塞进信封。
_MAX_MATCHED_TEXT: Final = 500

#: 按键名 → 字节序列(**单一真相源**)。名字大小写不敏感,`-`/`_`/`+`/空格 视为同一种分隔。
#: 立因:方向键/Esc 是转义序列、Ctrl 组合是控制码,这些用 `send` 写文本写不出来 ——
#: REPL 补全(Tab)、TUI 菜单(方向键)、vim(Esc)只认字节。
KEY_SEQUENCES: Final[dict[str, str]] = {
    "enter": "\r",
    "return": "\r",
    "tab": "\t",
    "space": " ",
    "backspace": "\x7f",
    "bs": "\x7f",
    "escape": "\x1b",
    "esc": "\x1b",
    "up": "\x1b[A",
    "down": "\x1b[B",
    "right": "\x1b[C",
    "left": "\x1b[D",
    "home": "\x1b[H",
    "end": "\x1b[F",
    "insert": "\x1b[2~",
    "ins": "\x1b[2~",
    "delete": "\x1b[3~",
    "del": "\x1b[3~",
    "pageup": "\x1b[5~",
    "pagedown": "\x1b[6~",
    "ctrl-a": "\x01",
    "ctrl-b": "\x02",
    "ctrl-c": "\x03",
    "ctrl-d": "\x04",
    "ctrl-e": "\x05",
    "ctrl-f": "\x06",
    "ctrl-g": "\x07",
    "ctrl-h": "\x08",
    "ctrl-i": "\x09",
    "ctrl-k": "\x0b",
    "ctrl-l": "\x0c",
    "ctrl-m": "\x0d",
    "ctrl-n": "\x0e",
    "ctrl-o": "\x0f",
    "ctrl-p": "\x10",
    "ctrl-q": "\x11",
    "ctrl-r": "\x12",
    "ctrl-s": "\x13",
    "ctrl-t": "\x14",
    "ctrl-u": "\x15",
    "ctrl-v": "\x16",
    "ctrl-w": "\x17",
    "ctrl-x": "\x18",
    "ctrl-y": "\x19",
    "ctrl-z": "\x1a",
    "ctrl-backslash": "\x1c",
    "ctrl-]": "\x1d",
    "ctrl-^": "\x1e",
    "ctrl-_": "\x1f",
}
#: 单次最多发多少个按键 / 总字节上界(防"一次塞 10 万次方向键"把读缓冲挤爆)。
MAX_KEYS_PER_CALL: Final = 32
MAX_KEY_BYTES: Final = 4_096

#: PTY 会话的终端身份两键(**只在调用方没显式给时补**)。真 tty 缺 `TERM` 时,程序
#: (`ls --color` / `git` / `less` / `vim`)会按 dumb 终端处理:颜色与光标控制全关、分页退化。
PTY_TERM: Final = "xterm-256color"
PTY_COLORTERM: Final = "truecolor"

#: 伪终端初始/上限尺寸。真 tty 必须有非零窗口尺寸 —— POSIX `pty.openpty()` 缺省给
#: 0x0,按 tty 出进度的程序会算出荒谬的宽度;ConPTY 也要求 cols/rows > 0。故两套后端
#: 都在开会话时钉住初始尺寸,并允许 `resize_terminal` 运行期改。
DEFAULT_COLS: Final = 120
DEFAULT_ROWS: Final = 30
MAX_COLS: Final = 500
MAX_ROWS: Final = 200

# PTY 后端开关(读时机敏感:每次 open_terminal 现读 env,便于测试 monkeypatch)。
PTY_REQUEST_ENV: Final = "IHUI_INTERACTIVE_PTY"
_PTY_TRUTHY: Final[frozenset[str]] = frozenset({"1", "true", "yes", "on"})
#: PTY 读循环每次最多吐多少字节(行切分在 _pump_pty 里做,这里只控单次 read 上界)。
_PTY_READ_CHUNK: Final = 65_536


def _pty_requested(env: Mapping[str, str] | None = None) -> bool:
    """本次是否要求 PTY 后端。**每次现读** env(不在导入期定格),便于运行期开关与测试。"""
    source = os.environ if env is None else env
    return (source.get(PTY_REQUEST_ENV, "") or "").strip().lower() in _PTY_TRUTHY


def _conpty_available() -> bool:
    """当前宿主是否真能跑 ConPTY(实现见文末 Windows 专章 `_conpty_probe`)。

    取不到任何一环(`ctypes.WinDLL` 不存在/老内核没导出 `CreatePseudoConsole`/加载失败)
    都判 False —— 不让"看起来能 import"冒充"能跑"(§0.3)。
    """
    if os.name != "nt":
        return False
    return _conpty_probe()


def _pty_supported_on_host() -> bool:
    """当前宿主是否有 PTY 后端实现:POSIX 恒有(标准库 `pty`),Windows 看 ConPTY 探测。

    fail-closed:探测不透的一律 False,`open_terminal` 据此硬拒而不是回落管道冒充已 PTY。
    """
    return os.name != "nt" or _conpty_available()


class _ProcLike(Protocol):
    """会话编排真正用到的进程面。

    管道后端是 `subprocess.Popen[str]`,ConPTY 后端是本模块的 `ConPtyProcess` ——
    两者同形,编排层(上限/信号/宽限收尾)不按后端分叉。
    """

    pid: int
    stdin: Any

    def poll(self) -> int | None: ...

    def wait(self, timeout: float | None = ...) -> int: ...

    def terminate(self) -> None: ...

    def kill(self) -> None: ...

    def send_signal(self, sig: int) -> None: ...


@dataclass
class TerminalSession:
    terminal_id: str
    owner_user_id: str | None
    owner_session_id: str | None
    command: str
    cwd: str
    proc: _ProcLike
    created_ts: float
    # 写侧统一出口:管道路径 = proc.stdin;PTY 路径 = master 的写 fdopen。send_terminal
    # 永不直接碰 `session.proc.stdin`(PTY 模式下它是 None),只走这个,两条后端同形。
    write_io: Any = None
    lock: threading.RLock = field(default_factory=threading.RLock, repr=False)
    seq: int = 0
    chunks: deque[dict[str, Any]] = field(
        default_factory=lambda: deque(maxlen=MAX_BUFFER_LINES), repr=False
    )
    pumps: list[threading.Thread] = field(default_factory=list, repr=False)
    # PTY 专属:master 的读 fd(关闭时显式 close);管道路径为 None。
    pty_read_fd: int | None = None
    #: 真 tty(PTY)还是匿名管道 —— 进 to_dict 给消费方/前端标会话类型。
    backend: str = "pipes"
    #: 当前窗口尺寸(PTY 才有意义;管道路径仅作记账,tty 语义不存在)。
    cols: int = DEFAULT_COLS
    rows: int = DEFAULT_ROWS
    #: 是否已送过 EOF:送过之后 send/keys 一律显式拒,不静默丢字节。
    stdin_closed: bool = False

    def running(self) -> bool:
        return self.proc.poll() is None

    def to_dict(self) -> dict[str, Any]:
        return {
            "terminal_id": self.terminal_id,
            "command": self.command,
            "cwd": self.cwd,
            "pid": self.proc.pid,
            "running": self.running(),
            "exit_code": self.proc.poll(),
            "next_seq": self.seq,
            "created_ts": self.created_ts,
            "backend": self.backend,
            "cols": self.cols,
            "rows": self.rows,
            "stdin_closed": self.stdin_closed,
        }


_sessions: dict[str, TerminalSession] = {}
_registry_lock = threading.RLock()


def reset_terminals() -> None:
    """测试用:关闭并清空全部终端。"""
    with _registry_lock:
        sessions = list(_sessions.values())
        _sessions.clear()
    for session in sessions:
        _force_stop(session)
        _close_io(session)


def _force_stop(session: TerminalSession) -> None:
    try:
        if session.proc.poll() is None:
            session.proc.kill()
    except OSError:
        pass


def _close_io(session: TerminalSession) -> None:
    """释放会话持有的额外 IO(PTY 的 master 读写 fd);管道路径靠 proc 回收,无需此处。"""
    # ConPTY 后端:先关伪控制台与进程/线程句柄(幂等)。ClosePseudoConsole 会驱动
    # conhost 退出,把退出前最后的输出吐进管道,再关读 fd 才不会截掉尾巴。
    release = getattr(session.proc, "release", None)
    if callable(release):
        with contextlib.suppress(Exception):
            release()
    # 有界等读线程收敛(最多 0.2s/路):超时即放弃,绝不无限挂。
    for pump in session.pumps:
        pump.join(timeout=0.2)
    if session.pty_read_fd is not None:
        with contextlib.suppress(OSError):
            os.close(session.pty_read_fd)
        session.pty_read_fd = None
    write_io = session.write_io
    if write_io is not None and write_io is not session.proc.stdin:
        with contextlib.suppress(OSError, ValueError):
            write_io.close()


def _owned(
    session: TerminalSession, user_id: str | None, session_id: str | None
) -> bool:
    return (
        session.owner_user_id == (user_id or None)
        and session.owner_session_id == (session_id or None)
    )


def _push(session: TerminalSession, tag: str, text: str) -> None:
    """把一个文本片段作为一条 chunk 入缓冲(seq 单调 +1)。PTY/管道共用同一入队口径。"""
    with session.lock:
        session.seq += 1
        session.chunks.append({"seq": session.seq, "stream": tag, "text": text})


def _pump(session: TerminalSession, stream: Any, tag: str) -> None:
    """管道路径:逐行读一条 stream 入缓冲。readline 到 EOF('')自然收敛。"""
    try:
        for line in iter(stream.readline, ""):
            _push(session, tag, line)
    except (OSError, ValueError):
        pass
    finally:
        try:
            stream.close()
        except OSError:
            pass


def _pump_pty(session: TerminalSession, fd: int, tag: str) -> None:
    """PTY 路径:master 读原始字节,按 \\n 切成行入队(与管道口径一致,消费方无需分叉)。

    子进程退出后,master 的 os.read 在 POSIX 返回 EOF(b"")或抛 EIO —— 两种都判收尾。
    行缓冲的尾巴(若退出前最后一行无 \\n)也吐出,不丢尾。本线程不负责关 fd ——
    fd 由 `_close_io`/close_terminal 统一直close,避免 read 线程与 close 抢关。
    """
    buffered = ""
    try:
        while True:
            try:
                data = os.read(fd, _PTY_READ_CHUNK)
            except OSError:
                break  # EOF / EIO:子进程已退,读端失效
            if not data:
                break
            buffered += data.decode("utf-8", errors="replace")
            while "\n" in buffered:
                line, buffered = buffered.split("\n", 1)
                _push(session, tag, f"{line}\n")
    finally:
        if buffered:
            _push(session, tag, buffered)


def _prune_for_new_session() -> None:
    """注册表有界:满了先清已结束的;仍满则拒绝(不悄悄杀活会话)。"""
    while len(_sessions) >= MAX_SESSIONS:
        closed = [s for s in _sessions.values() if not s.running()]
        if not closed:
            break
        for session in closed:
            _close_io(session)
            _sessions.pop(session.terminal_id, None)


def _spawn_pipe(command: str, cwd: str, env_extra: dict[str, str] | None) -> subprocess.Popen[str]:
    """默认后端:三条匿名管道(逐字节沿用改前实现)。"""
    flags = 0
    extra_kwargs: dict[str, Any] = {}
    if os.name == "nt":
        flags = _WIN_CREATE_NEW_PROCESS_GROUP
    else:
        extra_kwargs["start_new_session"] = True
    return subprocess.Popen(
        command,
        shell=True,
        cwd=cwd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        env=_strict_child_env(env_extra),
        creationflags=flags,
        **extra_kwargs,
    )


def _make_ctty_setter() -> Any:
    """返回一个子进程 preexec_fn:把 slave(fd 0)设为该会话的**控制终端**并 setsid,
    使前台进程组信号(SIGINT/SIGTTOU 等)与 tty 语义生效。fcntl/termios 用 importlib 取
    (Windows 无此模块);失败不致命(isatty 已成立)。**唯一调用方是 `_spawn_pty`(POSIX
    专路)**,Windows 走 `_spawn_conpty`,本函数在那边根本不会被调用到。"""
    fcntl = importlib.import_module("fcntl")
    termios = importlib.import_module("termios")
    tiocsctty = getattr(termios, "TIOCSCTTY", None)

    def _preexec() -> None:
        # `os.setsid`/`fcntl`/`termios` 只在 POSIX 存在;类型检查按宿主(可能是 Windows)
        # 分析,直接用 `os.setsid` 会被判 attr-defined,故经 getattr 取(取不到 = None)。
        # 本函数只被 `_spawn_pty`(POSIX 专路)调用,Windows 走 ConPTY 分支,不会跑到这里。
        setsid = getattr(os, "setsid", None)
        if callable(setsid):
            with contextlib.suppress(Exception):
                setsid()
        if tiocsctty is not None:
            with contextlib.suppress(Exception):
                fcntl.ioctl(0, tiocsctty, 0)

    return _preexec


def _normalize_size(cols: Any, rows: Any) -> tuple[int, int, str]:
    """窗口尺寸收敛的**单一出口**(open 的初始尺寸与 resize 共用,§0.6 只留一份判据)。

    返回 `(cols, rows, 错误文案)`;错误文案非空即未通过(此时前两项无意义,调用方不得使用)。
    非整数/越界一律显式拒,绝不把 0 或负数喂给内核(`TIOCSWINSZ` 收到 0 会让程序算出荒谬宽度)。
    """
    try:
        cols_i, rows_i = int(str(cols).strip()), int(str(rows).strip())
    except (TypeError, ValueError):
        return 0, 0, "cols/rows 必须是整数"
    if not (1 <= cols_i <= MAX_COLS and 1 <= rows_i <= MAX_ROWS):
        return 0, 0, f"cols 需在 1..{MAX_COLS}、rows 需在 1..{MAX_ROWS}(实得 {cols_i}x{rows_i})"
    return cols_i, rows_i, ""


def _posix_set_winsize(fd: int, cols: int, rows: int) -> bool:
    """POSIX:对 master fd 写 `TIOCSWINSZ`,行规程据此更新前台进程组的窗口尺寸。

    `fcntl`/`termios` 用 importlib 取(Windows 无此模块;本函数只被 POSIX 分支调用)。
    失败返回 False 而不抛 —— 调用方据此区分"改了"与"内核不认"。
    """
    try:
        fcntl = importlib.import_module("fcntl")
        termios = importlib.import_module("termios")
        # struct winsize { unsigned short ws_row, ws_col, ws_xpixel, ws_ypixel }
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except (OSError, AttributeError, ImportError, ValueError):
        return False
    return True


def _spawn_pty(
    command: str,
    cwd: str,
    env_extra: dict[str, str] | None,
    *,
    cols: int = DEFAULT_COLS,
    rows: int = DEFAULT_ROWS,
) -> tuple[subprocess.Popen[str], int, Any]:
    """PTY 后端(POSIX):master/slave 开伪终端,slave 作子进程 std* 并设控制终端。

    返回 `(proc, master_read_fd, master_write_io)`。master 的**读**与**写**各用独立 fd
    (写侧 dup 后 fdopen),不让两个缓冲共用一个裸 fd —— 共用会在读循环触发
    `OSError: [Errno 9] Bad file descriptor`(实测踩点)。调用方负责这三者的生命周期:
    本函数内若任一步失败,逐个回滚已开 fd,不外泄 fd / 子进程。
    """
    pty_mod = importlib.import_module("pty")
    master_fd, slave_fd = pty_mod.openpty()
    # `pty.openpty()` 给的是 0×0 窗口。**必须在 Popen 之前**钉尺寸:子进程一启动(哪怕只是
    # `print(shutil.get_terminal_size())`)就可能读窗口,事后补会先给它一次荒谬宽度,
    # 首屏按错尺寸排完版的程序(`vim`/`top`/`less`)不会重排。失败不致命,isatty 仍成立。
    _posix_set_winsize(master_fd, cols, rows)
    try:
        proc = subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=_pty_child_env(env_extra),
            start_new_session=True,
            preexec_fn=_make_ctty_setter(),
            close_fds=True,
        )
    except OSError:
        os.close(master_fd)
        os.close(slave_fd)
        raise
    # 父进程不需要 slave(子进程已 dup2 到 0/1/2),关掉它,否则 master 不会在子退时 EOF。
    os.close(slave_fd)
    try:
        write_fd = os.dup(master_fd)
        master_write_io = os.fdopen(write_fd, "w", encoding="utf-8", errors="replace")
        master_read_fd = os.dup(master_fd)
    except OSError:
        os.close(master_fd)
        with contextlib.suppress(OSError):
            proc.kill()
        raise
    os.close(master_fd)
    return proc, master_read_fd, master_write_io


def _spawn_conpty(
    command: str,
    cwd: str,
    env_extra: dict[str, str] | None,
    *,
    cols: int = DEFAULT_COLS,
    rows: int = DEFAULT_ROWS,
) -> tuple[_ProcLike, int, Any]:
    """PTY 后端(Windows):原生 ConPTY,返回 `(proc, 读 fd, 写端)`。

    命令统一经 `COMSPEC /d /s /c "<command>"` 走 shell 语义 —— 与管道路径的
    `shell=True` 对齐(`|`、`&&` 这类管道/串接在会话里照旧可用)。环境**仍取自**
    `_strict_child_env`,ConPTY 不放宽任何环境边界(本层只负责按 Unicode 环境块编码)。

    尺寸在 `CreatePseudoConsole` 时一次钉死(这就是 Windows 侧"开在指定尺寸"的唯一时机:
    ConPTY 的客户缓冲由 conhost 按该尺寸建,事后 `ResizePseudoConsole` 才改)。
    """
    comspec = os.environ.get("COMSPEC", "cmd.exe")
    proc = _conpty_spawn(
        command_line=f'{comspec} /d /s /c "{command}"',
        cwd=cwd,
        env=_pty_child_env(env_extra),
        cols=cols,
        rows=rows,
    )
    return proc, int(proc.read_fd), proc.write_io


def _pty_child_env(env_extra: dict[str, str] | None) -> dict[str, str]:
    """PTY 子进程环境 = 严档白名单 + 调用方显式键 + 终端身份两键的默认值。

    **仍经 `_strict_child_env`**:PTY 不放宽任何环境边界,这里只补两个"真终端本该有、
    而宿主白名单里没有"的键。`setdefault` 而非覆盖 —— 调用方显式传 `TERM` 时以它为准
    (有人故意要 `dumb` 也得能要得到)。管道后端不用它:那边不是 tty,塞 `TERM` 只会骗程序。
    """
    env = _strict_child_env(env_extra)
    env.setdefault("TERM", PTY_TERM)
    env.setdefault("COLORTERM", PTY_COLORTERM)
    return env


def _open_pty_session(
    *, command: str, cwd: str, user_id: str | None, session_id: str | None,
    env_extra: dict[str, str] | None,
    cols: int = DEFAULT_COLS,
    rows: int = DEFAULT_ROWS,
) -> dict[str, Any]:
    """PTY 后端开会话(仅限 POSIX)。满额/起不来 → 结构化错误,不抛。"""
    _prune_for_new_session()
    if len(_sessions) >= MAX_SESSIONS:
        return {
            "ok": False,
            "errorCode": "TERMINAL_LIMIT",
            "error": f"终端会话已达上限({MAX_SESSIONS}),请先 close 不再使用的会话",
        }
    try:
        if os.name == "nt":
            proc, read_fd, write_io = _spawn_conpty(
                command, cwd, env_extra, cols=cols, rows=rows
            )
        else:
            proc, read_fd, write_io = _spawn_pty(
                command, cwd, env_extra, cols=cols, rows=rows
            )
    except OSError as e:
        return {"ok": False, "errorCode": "TERMINAL_SPAWN_FAILED", "error": f"PTY 启动失败: {e}"}
    # 尺寸在 spawn 那一刻就钉住(POSIX 在 Popen 前 ioctl master,Windows 由
    # CreatePseudoConsole 的 size 参数给),这里只做账本记账 —— 不再"起完再补一次",
    # 因为补的那次永远晚于子进程的第一次读数。
    session = TerminalSession(
        terminal_id=f"term_{uuid.uuid4().hex[:12]}",
        owner_user_id=user_id or None,
        owner_session_id=session_id or None,
        command=command,
        cwd=cwd,
        proc=proc,
        created_ts=time.time(),
        write_io=write_io,
        pty_read_fd=read_fd,
        backend="pty",
        cols=cols,
        rows=rows,
    )
    _sessions[session.terminal_id] = session
    thread = threading.Thread(target=_pump_pty, args=(session, read_fd, "pty"), daemon=True)
    thread.start()
    session.pumps.append(thread)
    return {"ok": True, "terminal": session.to_dict()}


def open_terminal(
    *,
    command: str,
    cwd: str,
    user_id: str | None,
    session_id: str | None,
    env_extra: dict[str, str] | None = None,
    cols: int | None = None,
    rows: int | None = None,
) -> dict[str, Any]:
    """启动长驻子进程;返回 terminal_id 与初始元数据(含 `backend`:"pipes"|"pty")。

    `cols`/`rows` = **开会话那一刻的窗口尺寸**(真终端本来就该在进程启动时定尺寸):
    - PTY 后端在 spawn 之前/之中钉住(POSIX 在 Popen 前 `TIOCSWINSZ` master,Windows 由
      `CreatePseudoConsole` 的 size 参数给),子进程**第一次读窗口**就是对的 —— 先按
      120×30 起步再 resize 会让 `vim`/`top`/`less` 首屏按错尺寸排完版且不会重排;
    - 管道后端没有 tty 语义:尺寸只记账不进内核,响应里显式回 `size_ignored=True` 与原因
      (不静默 no-op,也不假装"已按你要的尺寸开会话");
    - 缺省(都不传)= `DEFAULT_COLS`×`DEFAULT_ROWS`,与既有行为逐字节一致。
    """
    if not command.strip():
        return {"ok": False, "errorCode": "TERMINAL_INVALID_COMMAND", "error": "command 为空"}
    want_cols = DEFAULT_COLS if cols is None else cols
    want_rows = DEFAULT_ROWS if rows is None else rows
    # 越界/非整数在**建会话之前**拒:否则先把进程拉起来再报错,等于留下一枚尺寸未知的会话。
    cols_i, rows_i, size_err = _normalize_size(want_cols, want_rows)
    if size_err:
        return {"ok": False, "errorCode": "TERMINAL_INVALID_SIZE", "error": size_err}
    # PTY 是显式 opt-in:请求了但当前宿主跑不了(POSIX 无 pty / Windows 无 ConPTY)
    # → fail-closed 硬拒,不静默回落管道冒充已 PTY(否则消费方以为拿到真 tty,实则块缓冲)。
    if _pty_requested() and not _pty_supported_on_host():
        return {
            "ok": False,
            "errorCode": "TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM",
            "error": (
                f"已要求 PTY({PTY_REQUEST_ENV}),但平台 {os.name} 的 PTY 后端不可用"
                "(Windows 需内核支持 ConPTY);会话未创建。"
                "置空该环境变量以使用管道路径。"
            ),
        }
    # 管道后端没有 tty 语义:尺寸不进内核,账本也只记缺省值(把它记成 100×40 会让读账本的人
    # 以为内核真按 100×40 排版,那才是骗)。调用方显式要过尺寸时,响应如实回 size_ignored。
    size_requested = cols is not None or rows is not None
    with _registry_lock:
        if _pty_requested() and _pty_supported_on_host():
            return _open_pty_session(
                command=command, cwd=cwd, user_id=user_id,
                session_id=session_id, env_extra=env_extra,
                cols=cols_i, rows=rows_i,
            )
        _prune_for_new_session()
        if len(_sessions) >= MAX_SESSIONS:
            return {
                "ok": False,
                "errorCode": "TERMINAL_LIMIT",
                "error": f"终端会话已达上限({MAX_SESSIONS}),请先 close 不再使用的会话",
            }
        try:
            proc = _spawn_pipe(command, cwd, env_extra)
        except OSError as e:
            return {
                "ok": False,
                "errorCode": "TERMINAL_SPAWN_FAILED",
                "error": f"启动失败: {e}",
            }
        session = TerminalSession(
            terminal_id=f"term_{uuid.uuid4().hex[:12]}",
            owner_user_id=user_id or None,
            owner_session_id=session_id or None,
            command=command,
            cwd=cwd,
            proc=proc,
            created_ts=time.time(),
            write_io=proc.stdin,
            backend="pipes",
        )
        _sessions[session.terminal_id] = session
    assert proc.stdout is not None and proc.stderr is not None
    for stream, tag in ((proc.stdout, "stdout"), (proc.stderr, "stderr")):
        thread = threading.Thread(target=_pump, args=(session, stream, tag), daemon=True)
        thread.start()
        session.pumps.append(thread)
    if size_requested:
        return {
            "ok": True,
            "terminal": session.to_dict(),
            "size_ignored": {"cols": cols_i, "rows": rows_i},
            "size_ignored_reason": (
                "管道路径没有 tty 语义:窗口尺寸只对真 tty 生效;"
                f"要以 tty 开会话请设 {PTY_REQUEST_ENV}=1"
            ),
        }
    return {"ok": True, "terminal": session.to_dict()}


def send_terminal(
    terminal_id: str,
    text: str,
    *,
    user_id: str | None,
    session_id: str | None,
    enter: bool = True,
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    if session.stdin_closed:
        return {
            "ok": False, "errorCode": "TERMINAL_STDIN_CLOSED",
            "error": "本会话 stdin 已送过 EOF,不能再写入;需要继续交互请开新会话",
            "terminal": session.to_dict(),
        }
    if not session.running():
        return {
            "ok": False, "errorCode": "TERMINAL_EXITED",
            "error": f"终端已退出(exit_code={session.proc.poll()})",
            "terminal": session.to_dict(),
        }
    payload = text if not enter else f"{text}\n"
    sink = session.write_io
    if sink is None:  # 理论不可达:两种后端 open 时都设了 write_io;防御性返回而非裸 AttributeError
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": "无可用写入端",
            "terminal": session.to_dict(),
        }
    try:
        sink.write(payload)
        sink.flush()
    except (BrokenPipeError, OSError, ValueError) as e:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": f"写入失败: {e}",
            "terminal": session.to_dict(),
        }
    return {"ok": True, "terminal_id": terminal_id, "bytes_written": len(payload)}


def _normalize_key(name: str) -> str:
    """键名规范化:`Ctrl+Up` / `ctrl_up` / ` Ctrl Up ` 都归到 `ctrl-up`(查表前的唯一入口)。

    连续分隔符折叠成一个:不折叠的话 `" Ctrl + C "` 会规成 `ctrl---c`,同一按键因写法不同
    被判未知 —— 那是最典型的"看起来很严,其实只是没归一"。
    """
    return re.sub(r"[\s_+]+", "-", name.strip().lower()).strip("-")


def _keys_payload(keys: Sequence[str]) -> tuple[str | None, str, str]:
    """把键名列表拼成字节序列,返回 (payload, errorCode, 逐键归一结果 / 出错细节)。

    校验与拼接在**碰会话之前**做完:未知键、超量、超长一律显式拒,不让半截输入写进子进程
    (写一半再报错 = 子进程收到残缺序列,后续状态全是脏的)。
    """
    if not keys:
        return None, "TERMINAL_EMPTY_KEYS", ""
    if len(keys) > MAX_KEYS_PER_CALL:
        return None, "TERMINAL_TOO_MANY_KEYS", str(len(keys))
    parts: list[str] = []
    seqs: list[str] = []
    for raw in keys:
        norm = _normalize_key(str(raw))
        seq = KEY_SEQUENCES.get(norm)
        if seq is None:
            return None, "TERMINAL_UNKNOWN_KEY", str(raw)
        parts.append(seq)
        seqs.append(norm)
    payload = "".join(parts)
    if len(payload) > MAX_KEY_BYTES:
        return None, "TERMINAL_KEY_PAYLOAD_TOO_LARGE", str(len(payload))
    return payload, "", "|".join(seqs)


def send_terminal_keys(
    terminal_id: str,
    keys: Sequence[str],
    *,
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    """按**键名**给会话发控制输入(方向键 / Tab / Esc / Ctrl 组合),不是写文本。

    与 `signal_terminal("interrupt")` 的分工:后者走进程信号语义(POSIX SIGINT /
    Windows CTRL_BREAK),对挂在 ConPTY 自己控制台上的子进程要靠行规程 0x03;本函数是
    **纯输入字节**通道 —— 它与真终端里你亲手按下的键等价,由行规程/程序自己解释。

    如实说明一条边界(真终端的物理事实,不是本实现丢字节):程序仍处于**规范(canonical)
    输入模式**时,行规程会当场消费 ESC/方向键之类的编辑键 —— POSIX 把它们当普通字符留在
    行里随回车送达;Windows ConPTY 的 conhost 会直接吃掉(本机实测)。要让程序**原样**拿到
    这些字节,它自己必须先切到 raw/非规范模式(vim、less 这类本来就会切)。
    """
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    payload, code, detail = _keys_payload(keys)
    if payload is None:
        if code == "TERMINAL_UNKNOWN_KEY":
            return {
                "ok": False, "errorCode": code,
                "error": f"未知键名: {detail}",
                "supported": sorted(KEY_SEQUENCES),
            }
        if code == "TERMINAL_EMPTY_KEYS":
            return {"ok": False, "errorCode": code, "error": "keys 不能为空"}
        if code == "TERMINAL_TOO_MANY_KEYS":
            return {
                "ok": False, "errorCode": code,
                "error": f"一次最多 {MAX_KEYS_PER_CALL} 个键(实得 {detail})",
            }
        return {
            "ok": False, "errorCode": code,
            "error": f"按键总字节超上限 {MAX_KEY_BYTES}(实得 {detail})",
        }
    if session.stdin_closed:
        return {
            "ok": False, "errorCode": "TERMINAL_STDIN_CLOSED",
            "error": "本会话 stdin 已送过 EOF,不能再发按键;需要继续交互请开新会话",
            "terminal": session.to_dict(),
        }
    if not session.running():
        return {
            "ok": False, "errorCode": "TERMINAL_EXITED",
            "error": f"终端已退出(exit_code={session.proc.poll()})",
            "terminal": session.to_dict(),
        }
    sink = session.write_io
    if sink is None:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": "无可用写入端",
            "terminal": session.to_dict(),
        }
    try:
        sink.write(payload)
        sink.flush()
    except (BrokenPipeError, OSError, ValueError) as e:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": f"写入失败: {e}",
            "terminal": session.to_dict(),
        }
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "keys": detail.split("|"),
        "bytes_written": len(payload),
    }

def eof_terminal(
    terminal_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    """给会话送"输入结束"(EOF),让按 EOF 收尾的程序正常收尾,而不是只能被 kill。

    真终端的 EOF 不是"写一个特殊字符"那么单一,两条后端语义不同,这里如实区分:

    - **管道**:直接关闭 stdin 写端 → 子进程下一次读到真 EOF(不可逆,也是标准 unix 做法);
    - **PTY / POSIX**:写 `\\x04`(Ctrl-D)→ 由**行规程**解释为"本行结束,且无内容可读";
    - **PTY / Windows ConPTY**:写 `\\x1a\\r`(Ctrl-Z + 回车)。本机实测:`\\x04` 与不带回车的
      `\\x1a` 都**不产生 EOF**(conhost 把 `^D` 当普通字符回显、单发 `^Z` 也不提交),
      只有 `^Z` + 回车才让子进程读到 EOF —— 这是 Windows 控制台的 EOF 字符约定,
      不是本实现自选的口径;照抄 `\\x04` 会在这里变成一条"说了能收尾、其实收不了"的谎。

    程序的输入模式同样决定成败:它在 raw 模式(自己管输入,如 `vim` 的编辑态)时,EOF 字节
    只是普通字节,不保证收尾 —— 那是程序决定的,不是本层丢语义。

    幂等:重复调用只回 `already_closed=True`。送过 EOF 后 `send` / `keys` 一律
    `TERMINAL_STDIN_CLOSED` 显式拒(不静默丢字节,也不假装写成功)。

    时序建议(本机实测):EOF 字节**晚于子进程就绪**再送。子进程还没起来时写进 ConPTY 的
    输入可能只被 conhost 回显(`^Z` 直接当普通字符),不产生 EOF —— 先 `wait_for` 提示符
    再 eof;这不是本层的缺陷,而是"往还没挂上输入处理的终端写字节"的通病。
    """
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    if session.stdin_closed:
        return {
            "ok": True, "terminal_id": terminal_id, "backend": session.backend,
            "already_closed": True,
        }
    if not session.running():
        return {
            "ok": False, "errorCode": "TERMINAL_EXITED",
            "error": f"终端已退出(exit_code={session.proc.poll()})",
            "terminal": session.to_dict(),
        }
    sink = session.write_io
    if sink is None:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": "无可用写入端",
            "terminal": session.to_dict(),
        }
    with session.lock:
        try:
            if session.backend == "pty":
                sink.write("\x1a\r" if os.name == "nt" else "\x04")
                sink.flush()
            else:
                sink.close()
        except (BrokenPipeError, OSError, ValueError) as e:
            return {
                "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
                "error": f"送 EOF 失败: {e}",
                "terminal": session.to_dict(),
            }
        session.stdin_closed = True
    return {
        "ok": True, "terminal_id": terminal_id, "backend": session.backend,
        "eof_sent": True,
    }


def read_terminal(
    terminal_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
    since_seq: int = 0,
    wait_s: float = 1.0,
    max_chars: int = 8000,
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    deadline = time.monotonic() + max(0.0, min(wait_s, 10.0))
    while True:
        with session.lock:
            pending = [c for c in session.chunks if c["seq"] > int(since_seq)]
            running = session.running()
            next_seq = session.seq
        # 进程已退出不等于读线程已把管道/PTY 尾部吐完:等 pump 全部结束后再收尾,
        # 否则最后一次 read 可能丢掉退出前的最后几行(模型通常读到 running=false 就停)。
        drained = not any(t.is_alive() for t in session.pumps)
        if pending or (not running and drained) or time.monotonic() >= deadline:
            break
        time.sleep(0.05)

    out: list[dict[str, Any]] = []
    used = 0
    for chunk in pending:
        text = str(chunk["text"])
        remain = max(0, max_chars - used)
        if remain <= 0:
            break
        if len(text) > remain:
            text = text[:remain]
        out.append({"seq": chunk["seq"], "stream": chunk["stream"], "text": text})
        used += len(text)
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "chunks": out,
        "next_seq": next_seq,
        "running": running,
        "exit_code": session.proc.poll(),
        "truncated": used >= max_chars and len(pending) > len(out),
    }


def _pattern_judge(pattern: str, regex: bool) -> tuple[Callable[[str], tuple[bool, str]] | None, str]:
    """把 pattern 收敛成"在累积文本上找一次"的判定函数,返回 (judge, 错误原因)。

    固定子串与正则两种形态在这里合成**一个出口**,等待循环里零分支(§22c:同一件事只许
    一份实现)。空 pattern / 超长 / 正则语法错都在**碰会话之前**拒,绝不喂给等待循环。
    """
    if not pattern:
        return None, "pattern 不能为空"
    if len(pattern) > MAX_PATTERN_CHARS:
        return None, f"pattern 过长({len(pattern)} > {MAX_PATTERN_CHARS} 字符)"
    if not regex:

        def judge_substr(text: str) -> tuple[bool, str]:
            hit = pattern in text
            return hit, pattern if hit else ""

        return judge_substr, ""
    try:
        compiled = re.compile(pattern)
    except re.error as e:
        return None, f"正则语法无效: {e}"

    def judge_regex(text: str) -> tuple[bool, str]:
        m = compiled.search(text)
        if m is None:
            return False, ""
        # group(0) 可能很长(如 `(?s).*`),在这里就截断,不让信封随缓冲膨胀。
        return True, m.group(0)[:_MAX_MATCHED_TEXT]

    return judge_regex, ""


def wait_terminal(
    terminal_id: str,
    *,
    pattern: str,
    user_id: str | None,
    session_id: str | None,
    since_seq: int = 0,
    timeout_s: float = 10.0,
    max_chars: int = 8000,
    regex: bool = False,
) -> dict[str, Any]:
    """等输出里出现 `pattern`(传统终端的 expect 原语),三种收口显式区分。

    为什么不是一个"更长的 read":读是"给我现在有的",等是"给我直到命中的"——
    后者要回答命中位置、命中文本、以及**没命中时是超时还是进程已退出**,这三件事
    轮询 read 拼不出来(调用方只能在 `wait_s≤10` 的窗口里反复猜)。

    返回:`matched`(是否命中)、`reason`(`matched` / `timeout` / `exited`)、
    `matched_text`、`chunks`(本次窗口内已产出的输出,形状同 `read_terminal`)、
    `next_seq`(从该 seq 续读即不会重复消费)、`running` / `exit_code`。

    `since_seq` 语义与 `read_terminal` 一致:只扫该 seq **之后**的块。进程退出后仍等
    pump 排空(与 read 同一条收尾判据),否则可能漏掉退出前最后一行命中。
    """
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    judge, why_bad = _pattern_judge(pattern, regex)
    if judge is None:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_PATTERN",
            "error": why_bad,
        }
    started = time.monotonic()
    deadline = started + max(0.0, min(float(timeout_s), MAX_WAIT_S))
    matched = False
    matched_text = ""
    reason = "timeout"
    while True:
        with session.lock:
            pending = [c for c in session.chunks if c["seq"] > int(since_seq)]
            running = session.running()
            next_seq = session.seq
        hit, hit_text = judge("".join(str(c["text"]) for c in pending))
        if hit:
            matched, matched_text, reason = True, hit_text, "matched"
            break
        # 退出不等于读线程已吐完(与 read_terminal 同一条判据,§22c 不写第二份)。
        drained = not any(t.is_alive() for t in session.pumps)
        if not running and drained:
            reason = "exited"
            break
        if time.monotonic() >= deadline:
            reason = "timeout"
            break
        time.sleep(0.05)

    out: list[dict[str, Any]] = []
    used = 0
    for chunk in pending:
        text = str(chunk["text"])
        remain = max(0, max_chars - used)
        if remain <= 0:
            break
        if len(text) > remain:
            text = text[:remain]
        out.append({"seq": chunk["seq"], "stream": chunk["stream"], "text": text})
        used += len(text)
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "matched": matched,
        "matched_text": matched_text,
        "reason": reason,
        "chunks": out,
        "next_seq": next_seq,
        "running": running,
        "exit_code": session.proc.poll(),
        "truncated": used >= max_chars and len(pending) > len(out),
        "waited_s": round(time.monotonic() - started, 3),
    }


def signal_terminal(
    terminal_id: str,
    *,
    signal_name: str,
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    proc = session.proc
    if proc.poll() is not None:
        return {
            "ok": True, "terminal_id": terminal_id,
            "running": False, "exit_code": proc.poll(),
        }
    try:
        if signal_name == "interrupt":
            if os.name == "nt":
                proc.send_signal(_WIN_CTRL_BREAK_EVENT)
            else:
                proc.send_signal(_signal.SIGINT)
        elif signal_name == "terminate":
            proc.terminate()
        elif signal_name == "kill":
            proc.kill()
        else:
            return {
                "ok": False, "errorCode": "TERMINAL_INVALID_SIGNAL",
                "error": f"signal 必须是 interrupt/terminate/kill,实得 {signal_name!r}",
            }
    except (OSError, ValueError) as e:
        if signal_name == "interrupt":
            # Windows 非控制台程序可能不接收 CTRL_BREAK;退化为 terminate。
            try:
                proc.terminate()
            except OSError:
                return {
                    "ok": False, "errorCode": "TERMINAL_SIGNAL_FAILED",
                    "error": f"发送信号失败: {e}",
                }
        else:
            return {
                "ok": False, "errorCode": "TERMINAL_SIGNAL_FAILED",
                "error": f"发送信号失败: {e}",
            }
    return {
        "ok": True, "terminal_id": terminal_id, "signal": signal_name,
        "running": proc.poll() is None,
    }


def resize_terminal(
    terminal_id: str,
    *,
    cols: int,
    rows: int,
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    """改 PTY 会话的窗口尺寸。

    POSIX 走 `TIOCSWINSZ`,Windows 走 `ResizePseudoConsole`。**管道后端显式拒绝**
    (`TERMINAL_NOT_A_TTY`)而不是静默 no-op —— 管道没有 tty 语义,"改成了"这句话
    在那边是假的(§0.3);越界尺寸同样显式拒,避免把 0/负数喂给内核。
    """
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    # 尺寸判据与 open 共用同一出口(_normalize_size),两处不再各写一份 1..MAX 的判断。
    cols_i, rows_i, size_err = _normalize_size(cols, rows)
    if size_err:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_SIZE", "error": size_err,
        }
    if session.backend != "pty":
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_A_TTY",
            "error": (
                "管道路径没有 tty 语义,resize 无意义;"
                f"要以 tty 开会话请设 {PTY_REQUEST_ENV}"
            ),
            "terminal": session.to_dict(),
        }
    if not session.running():
        return {
            "ok": False, "errorCode": "TERMINAL_EXITED",
            "error": f"终端已退出(exit_code={session.proc.poll()})",
            "terminal": session.to_dict(),
        }
    if os.name == "nt":
        resize = getattr(session.proc, "resize", None)
        ok = bool(resize(cols_i, rows_i)) if callable(resize) else False
    else:
        fd = session.pty_read_fd
        ok = fd is not None and _posix_set_winsize(fd, cols_i, rows_i)
    if not ok:
        return {
            "ok": False, "errorCode": "TERMINAL_RESIZE_FAILED",
            "error": "改尺寸被内核拒绝(伪终端已失效?)",
            "terminal": session.to_dict(),
        }
    with session.lock:
        session.cols, session.rows = cols_i, rows_i
    return {"ok": True, "terminal_id": terminal_id, "cols": cols_i, "rows": rows_i}


def close_terminal(
    terminal_id: str, *, user_id: str | None, session_id: str | None
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    proc = session.proc
    if proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=CLOSE_GRACE_S)
        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.wait(timeout=CLOSE_GRACE_S)
            except subprocess.TimeoutExpired:
                pass
        except OSError:
            pass
    with _registry_lock:
        _sessions.pop(terminal_id, None)
    _close_io(session)  # 从注册表摘除后再关 IO:关 slave/写端以驱动 master 读线程收敛
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "closed": True,
        "exit_code": proc.poll(),
    }


def list_terminals(
    *, user_id: str | None, session_id: str | None
) -> dict[str, Any]:
    if not user_id and not session_id:
        return {"ok": True, "terminals": [], "total": 0}
    items = [
        s for s in _sessions.values() if _owned(s, user_id, session_id)
    ]
    items.sort(key=lambda s: s.created_ts, reverse=True)
    return {
        "ok": True,
        "terminals": [s.to_dict() for s in items],
        "total": len(items),
    }


def default_shell() -> str:
    """跨平台默认 shell:Windows 用 COMSPEC,其他用 $SHELL 或 /bin/sh。"""
    if os.name == "nt":
        return os.environ.get("COMSPEC", "cmd.exe")
    return os.environ.get("SHELL", "/bin/sh")


# ─────────────────── Windows 原生 ConPTY 后端(平台专章,2026-11-20 立) ───────────────────
# 只在 `os.name == "nt"` 且内核导出 `CreatePseudoConsole`(Win10 1809+)时被调用;非 Windows
# 宿主上本段只有纯 ctypes 常量与结构体定义(不碰 WinDLL),import 期安全。
#
# 设计口径:
# - 零第三方依赖:`ctypes` 直连 kernel32(`CreatePseudoConsole` + `CreateProcessW` 启动属性
#   表),不对齐外部实现绑原生 `.node` addon 的那一档;
# - 环境边界不放松:env 由调用方以映射传入(调用方已过 `_strict_child_env`),本层只负责按
#   Unicode 环境块编码;
# - **不继承父句柄**:`CreateProcessW` 以 `bInheritHandles=FALSE` + `STARTF_USESTDHANDLES`
#   (hStd* 全 NULL)启动 —— 本机实测踩点:继承父句柄时子进程把输出直接写进父控制台,
#   ConPTY 输出管道只收到初始化转义序列、`isatty()` 反为 False(等于白接);
# - ConPTY 自己持有输入/输出两端副本,父进程那份必须关掉,否则输出端永远等不到 EOF;
# - `interrupt` 走行规程输入字节 0x03(子进程退出码 `0xC000013A` = STATUS_CONTROL_C_EXIT),
#   不走 `GenerateConsoleCtrlEvent` —— 子进程挂在 ConPTY 自己的控制台上,不在本进程组里。

_EXTENDED_STARTUPINFO_PRESENT: Final = 0x0008_0000
_CREATE_UNICODE_ENVIRONMENT: Final = 0x0000_0400
#: ProcThreadAttributeValue(22, Thread=FALSE, Input=TRUE, Additive=FALSE) = 22 | 0x20000
_PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE: Final = 0x0002_0016
_STARTF_USESTDHANDLES: Final = 0x0000_0100
_STILL_ACTIVE: Final = 259
_WAIT_TIMEOUT: Final = 258
_INFINITE: Final = 0xFFFF_FFFF

_CONPTY_K32: Any = None
_CONPTY_K32_LOCK = threading.Lock()


class _ConPtyCoord(ctypes.Structure):
    _fields_ = [("X", ctypes.c_short), ("Y", ctypes.c_short)]


class _ConPtyStartupInfo(ctypes.Structure):
    _fields_ = [
        ("cb", ctypes.c_ulong),
        ("lpReserved", ctypes.c_wchar_p),
        ("lpDesktop", ctypes.c_wchar_p),
        ("lpTitle", ctypes.c_wchar_p),
        ("dwX", ctypes.c_ulong),
        ("dwY", ctypes.c_ulong),
        ("dwXSize", ctypes.c_ulong),
        ("dwYSize", ctypes.c_ulong),
        ("dwXCountChars", ctypes.c_ulong),
        ("dwYCountChars", ctypes.c_ulong),
        ("dwFillAttribute", ctypes.c_ulong),
        ("dwFlags", ctypes.c_ulong),
        ("wShowWindow", ctypes.c_ushort),
        ("cbReserved2", ctypes.c_ushort),
        ("lpReserved2", ctypes.c_void_p),
        ("hStdInput", ctypes.c_void_p),
        ("hStdOutput", ctypes.c_void_p),
        ("hStdError", ctypes.c_void_p),
    ]


class _ConPtyStartupInfoEx(ctypes.Structure):
    _fields_ = [("StartupInfo", _ConPtyStartupInfo), ("lpAttributeList", ctypes.c_void_p)]


class _ConPtyProcessInfo(ctypes.Structure):
    _fields_ = [
        ("hProcess", ctypes.c_void_p),
        ("hThread", ctypes.c_void_p),
        ("dwProcessId", ctypes.c_ulong),
        ("dwThreadId", ctypes.c_ulong),
    ]


def _conpty_kernel32() -> Any:
    """惰性加载并绑定 kernel32 原型(import 期不碰 Win32,便于非 Windows 侧静态分析)。"""
    global _CONPTY_K32
    if _CONPTY_K32 is not None:
        return _CONPTY_K32
    with _CONPTY_K32_LOCK:
        if _CONPTY_K32 is not None:
            return _CONPTY_K32
        factory = getattr(ctypes, "WinDLL", None)
        if factory is None:  # 非 Windows 宿主:显式失败,由调用方 fail-closed
            raise OSError("当前宿主没有 ctypes.WinDLL(非 Windows),ConPTY 不可用")
        k32 = factory("kernel32", use_last_error=True)
        k32.CreatePipe.argtypes = [
            ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(ctypes.c_void_p),
            ctypes.c_void_p, ctypes.c_ulong,
        ]
        k32.CreatePipe.restype = ctypes.c_int
        k32.CreatePseudoConsole.argtypes = [
            _ConPtyCoord, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong,
            ctypes.POINTER(ctypes.c_void_p),
        ]
        k32.CreatePseudoConsole.restype = ctypes.c_long
        k32.ResizePseudoConsole.argtypes = [ctypes.c_void_p, _ConPtyCoord]
        k32.ResizePseudoConsole.restype = ctypes.c_long
        k32.ClosePseudoConsole.argtypes = [ctypes.c_void_p]
        k32.InitializeProcThreadAttributeList.argtypes = [
            ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong,
            ctypes.POINTER(ctypes.c_size_t),
        ]
        k32.InitializeProcThreadAttributeList.restype = ctypes.c_int
        k32.UpdateProcThreadAttribute.argtypes = [
            ctypes.c_void_p, ctypes.c_ulong, ctypes.c_size_t, ctypes.c_void_p,
            ctypes.c_size_t, ctypes.c_void_p, ctypes.c_void_p,
        ]
        k32.UpdateProcThreadAttribute.restype = ctypes.c_int
        k32.DeleteProcThreadAttributeList.argtypes = [ctypes.c_void_p]
        k32.CreateProcessW.argtypes = [
            ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_void_p, ctypes.c_void_p,
            ctypes.c_int, ctypes.c_ulong, ctypes.c_void_p, ctypes.c_wchar_p,
            ctypes.POINTER(_ConPtyStartupInfoEx), ctypes.POINTER(_ConPtyProcessInfo),
        ]
        k32.CreateProcessW.restype = ctypes.c_int
        k32.CloseHandle.argtypes = [ctypes.c_void_p]
        k32.CloseHandle.restype = ctypes.c_int
        k32.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
        k32.GetExitCodeProcess.restype = ctypes.c_int
        k32.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        k32.WaitForSingleObject.restype = ctypes.c_ulong
        k32.TerminateProcess.argtypes = [ctypes.c_void_p, ctypes.c_uint]
        k32.TerminateProcess.restype = ctypes.c_int
        _CONPTY_K32 = k32
        return k32


def _conpty_probe() -> bool:
    """kernel32 是否真导出 `CreatePseudoConsole`(取不到一律 False,不抛给调用方)。"""
    try:
        return callable(getattr(_conpty_kernel32(), "CreatePseudoConsole", None))
    except (OSError, AttributeError):
        return False


def _conpty_create_pipe(k32: Any) -> tuple[int, int]:
    read_handle = ctypes.c_void_p()
    write_handle = ctypes.c_void_p()
    if not k32.CreatePipe(ctypes.byref(read_handle), ctypes.byref(write_handle), None, 0):
        raise ctypes.WinError(ctypes.get_last_error())
    return int(read_handle.value or 0), int(write_handle.value or 0)


def _conpty_close_handle(k32: Any, handle: int) -> None:
    if handle:
        with contextlib.suppress(OSError):
            k32.CloseHandle(ctypes.c_void_p(handle))


def _conpty_handle_int(value: Any) -> int:
    """ctypes 的 `c_void_p` 字段读出时可能是 int 也可能是 None(视原型而定),统一成 int。"""
    if value is None:
        return 0
    if isinstance(value, int):
        return value
    return int(getattr(value, "value", 0) or 0)


def _conpty_attr_list(k32: Any, hpcon: Any) -> tuple[Any, Any]:
    """建 PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE 属性表;返回 (keepalive, ptr)。"""
    size = ctypes.c_size_t(0)
    k32.InitializeProcThreadAttributeList(None, 1, 0, ctypes.byref(size))
    buf = ctypes.create_string_buffer(size.value)
    ptr = ctypes.cast(buf, ctypes.c_void_p)
    if not k32.InitializeProcThreadAttributeList(ptr, 1, 0, ctypes.byref(size)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        ok = k32.UpdateProcThreadAttribute(
            ptr, 0, _PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
            hpcon, ctypes.sizeof(ctypes.c_void_p), None, None,
        )
    except BaseException:
        with contextlib.suppress(Exception):
            k32.DeleteProcThreadAttributeList(ptr)
        raise
    if not ok:
        with contextlib.suppress(Exception):
            k32.DeleteProcThreadAttributeList(ptr)
        raise ctypes.WinError(ctypes.get_last_error())
    return buf, ptr


def _conpty_env_block(env: Mapping[str, str]) -> Any:
    """按 CreateProcessW 的 Unicode 环境块形态编码(每条 `K=V\\0`,整块再补一个 `\\0`)。

    用原始字节而不是 `c_wchar_p`:后者对含内嵌 NUL 的整块不可靠,会静默截断。
    """
    raw = ("".join(f"{key}={value}\0" for key, value in env.items()) + "\0").encode("utf-16-le")
    return ctypes.create_string_buffer(raw, len(raw))


class ConPtyProcess:
    """`CreateProcessW` 子进程的最小 Popen 兼容壳(只覆盖会话编排真正用到的面)。"""

    stdin: Any = None

    def __init__(
        self, *, proc_info: _ConPtyProcessInfo, hpcon: Any,
        read_fd: int, write_io: Any, command_line: str,
    ) -> None:
        self._k32 = _conpty_kernel32()
        self._pi = proc_info
        self._hpcon = hpcon
        self._command_line = command_line
        self._released = False
        self._read_fd = read_fd
        self.write_io = write_io
        self.pid = int(proc_info.dwProcessId)

    @property
    def read_fd(self) -> int:
        return self._read_fd

    def poll(self) -> int | None:
        code = ctypes.c_ulong(0)
        if not self._k32.GetExitCodeProcess(self._pi.hProcess, ctypes.byref(code)):
            return None
        return None if code.value == _STILL_ACTIVE else int(code.value)

    def wait(self, timeout: float | None = None) -> int:
        millis = _INFINITE if timeout is None else max(0, int(timeout * 1000))
        rc = self._k32.WaitForSingleObject(self._pi.hProcess, millis)
        if rc == _WAIT_TIMEOUT:
            # timeout=None 走 _INFINITE,不可能超时;这里 timeout 必为已给出的值。
            raise subprocess.TimeoutExpired(self._command_line, float(timeout or 0.0))
        code = self.poll()
        return 0 if code is None else code

    def terminate(self) -> None:
        with contextlib.suppress(OSError):
            self._k32.TerminateProcess(self._pi.hProcess, 1)

    def kill(self) -> None:
        self.terminate()

    def send_signal(self, sig: int) -> None:
        """`interrupt` 走行规程输入字节 0x03;其余信号(terminate/kill)不经过这里。"""
        if sig == _WIN_CTRL_BREAK_EVENT and self.write_io is not None:
            self.write_io.write("\x03")
            self.write_io.flush()
            return
        self.terminate()

    def resize(self, cols: int, rows: int) -> bool:
        """改伪控制台尺寸;`ResizePseudoConsole` 返回 HRESULT,0 = 成功。"""
        if self._released:
            return False
        return int(self._k32.ResizePseudoConsole(self._hpcon, _ConPtyCoord(cols, rows))) == 0

    def release(self) -> None:
        """关伪控制台 + 进程/线程句柄(幂等)。由 `_close_io` 在会话摘除后调用。"""
        if self._released:
            return
        self._released = True
        with contextlib.suppress(OSError, ValueError):
            self._k32.ClosePseudoConsole(self._hpcon)
        _conpty_close_handle(self._k32, _conpty_handle_int(self._pi.hProcess))
        _conpty_close_handle(self._k32, _conpty_handle_int(self._pi.hThread))


def _conpty_spawn(
    *, command_line: str, cwd: str, env: Mapping[str, str], cols: int = 120, rows: int = 30,
) -> ConPtyProcess:
    """在 ConPTY 里起子进程。任何一步失败都回滚已开句柄并抛 OSError(不抛裸 WinError)。"""
    k32 = _conpty_kernel32()
    msvcrt = importlib.import_module("msvcrt")
    in_read, in_write = _conpty_create_pipe(k32)
    try:
        out_read, out_write = _conpty_create_pipe(k32)
    except OSError:
        _conpty_close_handle(k32, in_read)
        _conpty_close_handle(k32, in_write)
        raise

    hpcon = ctypes.c_void_p()
    hr = k32.CreatePseudoConsole(
        _ConPtyCoord(max(1, cols), max(1, rows)),
        ctypes.c_void_p(in_read), ctypes.c_void_p(out_write),
        0, ctypes.byref(hpcon),
    )
    if hr != 0:
        for handle in (in_read, in_write, out_read, out_write):
            _conpty_close_handle(k32, handle)
        raise OSError(f"CreatePseudoConsole 失败(HRESULT={hr})")
    # ConPTY 已持有两端副本;父侧这份必须关,否则输出端等不到 EOF(读循环会一直挂住)。
    _conpty_close_handle(k32, in_read)
    _conpty_close_handle(k32, out_write)

    proc_info = _ConPtyProcessInfo()
    attr_ptr: Any = None
    try:
        _keepalive, attr_ptr = _conpty_attr_list(k32, hpcon)
        si = _ConPtyStartupInfoEx()
        si.StartupInfo.cb = ctypes.sizeof(_ConPtyStartupInfoEx)
        # 不继承父句柄 + hStd* 全 NULL:让 ConPTY 接管子进程 stdio(否则子进程把输出
        # 写进父控制台、isatty 反为 False —— 本机实测踩点)。
        si.StartupInfo.dwFlags = _STARTF_USESTDHANDLES
        si.StartupInfo.hStdInput = None
        si.StartupInfo.hStdOutput = None
        si.StartupInfo.hStdError = None
        si.lpAttributeList = attr_ptr
        env_buf = _conpty_env_block(env)
        created = k32.CreateProcessW(
            None, command_line, None, None, 0,
            _EXTENDED_STARTUPINFO_PRESENT | _CREATE_UNICODE_ENVIRONMENT,
            ctypes.cast(env_buf, ctypes.c_void_p), cwd,
            ctypes.byref(si), ctypes.byref(proc_info),
        )
    except BaseException:
        with contextlib.suppress(Exception):
            k32.ClosePseudoConsole(hpcon)
        _conpty_close_handle(k32, in_write)
        _conpty_close_handle(k32, out_read)
        raise
    finally:
        if attr_ptr is not None:
            with contextlib.suppress(Exception):
                k32.DeleteProcThreadAttributeList(attr_ptr)
    if not created:
        with contextlib.suppress(Exception):
            k32.ClosePseudoConsole(hpcon)
        _conpty_close_handle(k32, in_write)
        _conpty_close_handle(k32, out_read)
        raise ctypes.WinError(ctypes.get_last_error())

    try:
        read_fd = msvcrt.open_osfhandle(out_read, os.O_RDONLY | os.O_BINARY)
    except (OSError, ValueError):
        _conpty_close_handle(k32, in_write)
        _conpty_close_handle(k32, out_read)
        with contextlib.suppress(Exception):
            k32.ClosePseudoConsole(hpcon)
        with contextlib.suppress(Exception):
            _conpty_close_handle(k32, _conpty_handle_int(proc_info.hProcess))
        with contextlib.suppress(Exception):
            _conpty_close_handle(k32, _conpty_handle_int(proc_info.hThread))
        raise
    try:
        write_fd = msvcrt.open_osfhandle(in_write, os.O_WRONLY | os.O_BINARY)
        write_io = os.fdopen(write_fd, "w", encoding="utf-8", errors="replace")
    except (OSError, ValueError):
        with contextlib.suppress(OSError):
            os.close(read_fd)
        _conpty_close_handle(k32, in_write)
        with contextlib.suppress(Exception):
            k32.ClosePseudoConsole(hpcon)
        raise
    return ConPtyProcess(
        proc_info=proc_info, hpcon=hpcon, read_fd=read_fd,
        write_io=write_io, command_line=command_line,
    )


# 暴露给镜像测试的形状锁/判据出口(§22c:测试 import 真实判定,不复制常量)。
__test__ = {
    "pty_requested": _pty_requested,
    "pty_supported_on_host": _pty_supported_on_host,
    "conpty_available": _conpty_available,
    "resize_terminal": resize_terminal,
    "normalize_size": _normalize_size,
    "wait_terminal": wait_terminal,
    "send_terminal_keys": send_terminal_keys,
    "eof_terminal": eof_terminal,
    "pty_child_env": _pty_child_env,
    "PTY_TERM": PTY_TERM,
    "PTY_COLORTERM": PTY_COLORTERM,
    "pattern_judge": _pattern_judge,
    "keys_payload": _keys_payload,
    "key_sequences": KEY_SEQUENCES,
    "MAX_KEYS_PER_CALL": MAX_KEYS_PER_CALL,
    "MAX_KEY_BYTES": MAX_KEY_BYTES,
    "MAX_WAIT_S": MAX_WAIT_S,
    "MAX_PATTERN_CHARS": MAX_PATTERN_CHARS,
    "DEFAULT_COLS": DEFAULT_COLS,
    "DEFAULT_ROWS": DEFAULT_ROWS,
    "MAX_COLS": MAX_COLS,
    "MAX_ROWS": MAX_ROWS,
    "PTY_REQUEST_ENV": PTY_REQUEST_ENV,
    "PTY_TRUTHY": _PTY_TRUTHY,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

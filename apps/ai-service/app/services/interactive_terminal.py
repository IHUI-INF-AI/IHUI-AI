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
- `send_terminal`:写入一行(可选追加换行);
- `read_terminal`:按 seq 增量读,支持有限等待(默认 1s)与字符上限;
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
  `_strict_child_env`**,PTY 不放宽任何环境边界。**Windows 走原生 ConPTY**
  (`conpty_win.py`:ctypes 直连 kernel32 的 `CreatePseudoConsole` + `CreateProcessW`
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
import signal as _signal
import subprocess
import threading
import time
import uuid
from collections import deque
from collections.abc import Mapping
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

    管道后端是 `subprocess.Popen[str]`,ConPTY 后端是 `conpty_win.ConPtyProcess` ——
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


def _spawn_pty(
    command: str, cwd: str, env_extra: dict[str, str] | None
) -> tuple[subprocess.Popen[str], int, Any]:
    """PTY 后端(POSIX):master/slave 开伪终端,slave 作子进程 std* 并设控制终端。

    返回 `(proc, master_read_fd, master_write_io)`。master 的**读**与**写**各用独立 fd
    (写侧 dup 后 fdopen),不让两个缓冲共用一个裸 fd —— 共用会在读循环触发
    `OSError: [Errno 9] Bad file descriptor`(实测踩点)。调用方负责这三者的生命周期:
    本函数内若任一步失败,逐个回滚已开 fd,不外泄 fd / 子进程。
    """
    pty_mod = importlib.import_module("pty")
    master_fd, slave_fd = pty_mod.openpty()
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
            env=_strict_child_env(env_extra),
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
    command: str, cwd: str, env_extra: dict[str, str] | None
) -> tuple[_ProcLike, int, Any]:
    """PTY 后端(Windows):原生 ConPTY,返回 `(proc, 读 fd, 写端)`。

    命令统一经 `COMSPEC /d /s /c "<command>"` 走 shell 语义 —— 与管道路径的
    `shell=True` 对齐(`|`、`&&` 这类管道/串接在会话里照旧可用)。环境**仍取自**
    `_strict_child_env`,ConPTY 不放宽任何环境边界(本层只负责按 Unicode 环境块编码)。
    """
    comspec = os.environ.get("COMSPEC", "cmd.exe")
    proc = _conpty_spawn(
        command_line=f'{comspec} /d /s /c "{command}"',
        cwd=cwd,
        env=_strict_child_env(env_extra),
        cols=120,
        rows=30,
    )
    return proc, int(proc.read_fd), proc.write_io


def _open_pty_session(
    *, command: str, cwd: str, user_id: str | None, session_id: str | None,
    env_extra: dict[str, str] | None,
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
            proc, read_fd, write_io = _spawn_conpty(command, cwd, env_extra)
        else:
            proc, read_fd, write_io = _spawn_pty(command, cwd, env_extra)
    except OSError as e:
        return {"ok": False, "errorCode": "TERMINAL_SPAWN_FAILED", "error": f"PTY 启动失败: {e}"}
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
) -> dict[str, Any]:
    """启动长驻子进程;返回 terminal_id 与初始元数据(含 `backend`:"pipes"|"pty")。"""
    if not command.strip():
        return {"ok": False, "errorCode": "TERMINAL_INVALID_COMMAND", "error": "command 为空"}
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
    with _registry_lock:
        if _pty_requested() and _pty_supported_on_host():
            return _open_pty_session(
                command=command, cwd=cwd, user_id=user_id,
                session_id=session_id, env_extra=env_extra,
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
    "PTY_REQUEST_ENV": PTY_REQUEST_ENV,
    "PTY_TRUTHY": _PTY_TRUTHY,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

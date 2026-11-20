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
- `read_terminal`:按 seq 增量读,支持有限等待(默认 1s)与字符上限;缓冲是有界的,
  消费方太慢时最老的块被挤掉 —— 此时回 `gap`/`gap_chunks`/`dropped_chunks` 明说丢了多少,
  绝不"按 next_seq 续读却凭空少段落还装没事";
- `wait_terminal`:等输出里出现某个 pattern(子串或正则),命中/超时/进程退出三种收口
  —— 轮询式 `read` 拼不出"等提示符"这件事(`wait_s` 单次上限 10s,且没有命中语义);
- `eof_terminal`:送"输入结束"让按 EOF 收尾的程序自己收尾(管道关 stdin / PTY 写
  `\\x04`),之后 send/keys 显式 `TERMINAL_STDIN_CLOSED`,不是只能 kill;
- `reap_idle_terminals`:闲置回收(env `IHUI_TERMINAL_IDLE_TTL_S` > 0 才启用,默认关闭;
  开新会话前自动跑一次),回收了谁/闲了多久逐条回报,不静默杀;
- `signal_terminal`:interrupt/terminate/kill;**interrupt 在 PTY 后端写 `^C` 输入字节**
  0x03(等价于用户亲手按 Ctrl+C,由行规程/程序自己解释),只有管道后端才走进程信号
  (POSIX SIGINT / Windows CTRL_BREAK);
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
  「没判绝不写成判过」)。PTY 输出的行切同样不按"死等换行":整行即时吐,末尾不完整
  片段在静默 `PTY_IDLE_FLUSH_S` 后当一帧吐出 —— TUI(htop/vim/进度条)的刷新帧只写
  `\\r` 不写 `\\n`,死等换行会让读端在"子进程活着、屏幕明明有内容"时读到空。

对照程序:WB/Trae 的 harness 用原生 `pty.node`/`conpty.node`(:lydell/node-pty),deepseek-tui
用管道。本实现取"CI 真能跑通 + 零第三方依赖"的那一档(POSIX 标准库 `pty` + Windows
ctypes 直连 ConPTY,不绑任何原生 addon)。
"""

from __future__ import annotations

import contextlib
import ctypes
import importlib
import io
import os
import re
import select
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
from .terminal_grid import Grid

MAX_SESSIONS: Final = 16
MAX_BUFFER_LINES: Final = 2000
#: 缓冲块数上限的运行期旋钮(默认就是 `MAX_BUFFER_LINES`,设了这个 env 才变):
#: 长跑会话(output 量大但消费方慢)可以把窗口放大;反过来把显存/内存吃紧的部署可以调小。
#: 上界 `MAX_BUFFER_LINES_CEILING` 是硬护栏 —— 一个 50 万块的 deque 就是一次 OOM 事故。
TERMINAL_BUFFER_LINES_ENV: Final = "IHUI_TERMINAL_BUFFER_LINES"
MAX_BUFFER_LINES_CEILING: Final = 20_000
MIN_BUFFER_LINES: Final = 100

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

#: 真终端里 Ctrl+C 的输入字节。PTY 后端的 `interrupt` 统一写这一个字节
#: (规范模式下由行规程转成前台进程组的 SIGINT,raw 模式下由程序自己解释);
#: 键表里的 `ctrl-c` 也取它 —— 两处必须是同一个字节,不是两份字面量。
TTY_INTERRUPT_BYTE: Final = "\x03"

#: bracketed paste(DEC 2004):程序先发 `DECSET 2004` 表示"请把整段粘贴包起来",终端侧
#: 用 START/END 包裹后,程序不会把粘贴里的换行当成回车逐条执行(vim 的 "-- INSERT --"、
#: readline 的整段插入都靠这一位)。四枚常量是同一机制的**单一真相源**。
BRACKETED_PASTE_ON: Final = "\x1b[?2004h"
BRACKETED_PASTE_OFF: Final = "\x1b[?2004l"
BRACKETED_PASTE_START: Final = "\x1b[200~"
BRACKETED_PASTE_END: Final = "\x1b[201~"
#: 一次粘贴的字节上限:超过就拒(不静默截断 —— 截断的粘贴比拒绝更难查)。
MAX_PASTE_BYTES: Final = 65_536

#: 鼠标上报(DEC 私有模式 1000/1002/1003 + 坐标编码 1006/1005/1015)。**发不发事件是程序说了算**:
#: vim/htop/less 用 `DECSET 1000/1002/1003` 明确"把鼠标给我",终端侧只能跟随;程序没请求就发,
#: 那些字节只会变成它的输入垃圾。三档模式位 + 三档编码位是同一机制的**单一真相源**。
MOUSE_CLICK_MODE: Final = 1000  # 只报按下/松开(点选)
MOUSE_DRAG_MODE: Final = 1002  # 按下期间的拖动
MOUSE_MOVE_MODE: Final = 1003  # 任何移动(不看按键)
MOUSE_SGR_ENCODING: Final = 1006  # `ESC[<b;x;yM|m`:十进制坐标,无 223 上限
MOUSE_UTF8_ENCODING: Final = 1005  # 老形状 + UTF-8 承载远坐标
MOUSE_URXVT_ENCODING: Final = 1015  # `ESC[b;x;yM`:十进制坐标

#: 鼠标键名 → 基础码(sgr 与老编码同码,只有封装方式不同)。滚轮是 64/65,与按键位并行。
MOUSE_BUTTON_CODES: Final[dict[str, int]] = {
    "left": 0,
    "middle": 1,
    "right": 2,
    "wheel-up": 64,
    "wheel-down": 65,
}
MOUSE_MODIFIER_BITS: Final[dict[str, int]] = {"shift": 4, "alt": 8, "meta": 8, "ctrl": 16}
#: 无按键的移动(1003 any-motion)与老编码的"松开"都取 3。
MOUSE_NO_BUTTON: Final = 3
MOUSE_MOTION_FLAG: Final = 32
#: 老 x10 编码把「码 + 32」塞进单字节:单字节上限 255 ⇒ 坐标上限 223。更远的坐标必须由程序
#: 先点 1005/1015/1006,否则只能如实拒 —— 截断/夹紧的坐标比报错更难查。
MOUSE_LEGACY_MAX_COORD: Final = 223
MOUSE_MAX_COORD: Final = 65_535

#: 备用屏幕(DEC 私有模式 1049 / 1047 / 47)。1049 = 保存光标 + 清屏 + 切 alt(现代 xterm 默认),
#: 1047 = 切 alt(退出清屏),47 = 老式 alt(不保存光标)。三者**任一**在位就视为"现在在 alt 屏"。
#: 这条位的物理意义:全屏程序(vim/htop/less)的画面**不进主屏 scrollback** —— 退出后往回翻
#: 主屏历史,不该翻出 vim 那一屏。快照/检索必须按当前屏面取,不能把两块屏拼成一条流水。
ALT_SCREEN_MODES: Final[frozenset[int]] = frozenset({1049, 1047, 47})

#: 终端转义序列的归一正则(**单一真相源**)。快照与检索只回"人读得到的字",但**不能**靠
#: "顺手 replace 掉 ESC":那样 OSC 的标题串(`ESC]0;…BEL`)会把路径漏成正文。三档分开收:
#: ① OSC(`ESC ] … BEL|ST`),② CSI(`ESC [ 参数 中间字节 终止字节`),③ 其余两字节 ESC 序列。
ANSI_ESCAPE_RE: Final = re.compile(
    r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)"  # OSC:… BEL 或 … ESC \
    r"|\x1b\[[0-?]*[ -/]*[@-~]"  # CSI:颜色/光标/清屏/DECSET 全在这一族
    r"|\x1b[@-_]"  # 其余 bare-ESC 两字节序列
)
#: 归一后仍然剩下的单字节控制符(除 `\n`/`\t`):`\x00`–`\x08`、`\x0b`/`\x0c`、`\x0e`–`\x1f` 与 DEL。
#: 这些字节对"人读文本"没有语义(光标控制已由 `\r`/`\n` 归一覆盖),留着只会让检索正则踩空。
ANSI_NOISE_RE: Final = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

#: **一次扫描**取代"先 subs 再 replace"的三趟处理(2026-11-21):同一条终端流要同时回答三件事
#: —— 人读文本长什么样、这段文字链到哪个 URL、链接落在第几行。三趟各扫一遍必然在行号上漂开
#: (先剥 OSC 再数 `\r` 与"边扫边数"在跨转义序列的 `\r\n` 边界上给出不同行号),所以在
#: 字符流上只走一次:`esc` = 控制序列(按 `ANSI_ESCAPE_RE` 同一份定义取材),`noise` = 残余控制符。
#: 两个命名组都**不带捕获组里层**,所以整条正则不会打乱调用方的 group 编号。
_SCAN_RE: Final = re.compile(
    f"(?P<esc>{ANSI_ESCAPE_RE.pattern})|(?P<noise>{ANSI_NOISE_RE.pattern})"
)

#: 窗口标题(`OSC 0/1/2 ; <title> BEL|ST`):xterm 用 `OSC 2` 设标签页名字,`OSC 0` 同时设图标名与
#: 标题,`OSC 1` 只设图标名 —— 三种在"这块屏叫什么"这件事上等价,统一记成 `session.title`。
_OSC_TITLE_RE: Final = re.compile(r"\x1b\][012];([^\x07\x1b]*)(?:\x07|\x1b\\)")
#: **任何** OSC 序列(数响铃前先把整段吃掉):OSC 的终止符本身就是 BEL,先数后吃会凭空多出响铃。
_OSC_ANY_RE: Final = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")
#: 标题长度上界:失控程序连发 OSC 时不让会话账本跟着膨胀。
MAX_TITLE_CHARS: Final = 200

#: OSC 8 超链接:`ESC ] 8 ; <params> ; <URI> ST|BEL`,URI 为空的那一条表示"链接到此结束"。
#: 参数段(`id=xxx` 之类)被刻意只做透传判据不进台账:台账只关心"哪段文字链到哪个地址"。
#: 为什么值得单独记:终端里"点一下能打开什么"是**程序**给的,而 OSC 8 有一个已知钓鱼面 ——
#: 显示文字与真实目标是两回事(可以显示 `https://bank.com` 却链到别处)。本模块的立场是把
#: `text` 与 `url` **一起**回给调用方,让"看到的就是要打开的"这件事可校验;绝不代替调用方打开。
_OSC_HYPERLINK_RE: Final = re.compile(r"\x1b\]8;([^;]*);([^\x07\x1b]*)(?:\x07|\x1b\\)")
#: 台账上界:失控程序连发链接时不让会话账本/信封膨胀。
MAX_LINKS: Final = 100
MAX_LINK_URL_CHARS: Final = 2048
MAX_LINK_TEXT_CHARS: Final = 300
#: URI 协议名的取值形态(RFC 3986 scheme);取不到就当"没有协议头"(相对地址/裸词)。
_LINK_SCHEME_RE: Final = re.compile(r"^(?P<scheme>[a-zA-Z][a-zA-Z0-9+.\-]*):")

#: DEC 私有模式位(`DECSET`=`?…h` / `DECRST`=`?…l`)。一条序列可带多个模式(`?1002;1006h`),
#: 所以按"整段取数再逐枚落账"解析;只由输出驱动(**模式位从来不是调用方声明的**)。
_DEC_PRIVATE_MODE_RE: Final = re.compile(r"\x1b\[\?([0-9;]+)([hl])")

#: 快照最多回多少行(超过就只回**末尾**那段,并在信封里说 `truncated`)。
MAX_SNAPSHOT_LINES: Final = 500
#: 检索最多回多少条命中(超出回 `truncated=True`,不静默截断)。
MAX_SEARCH_MATCHES: Final = 100
#: 检索命中的**那一行**回传时的字符上限(一行可能极长,不做上界等于把缓冲塞进信封)。
_MAX_SEARCH_LINE_CHARS: Final = 400

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
    "ctrl-c": TTY_INTERRUPT_BYTE,
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

#: 应用光标键模式(DEC 私有模式 1,DECCKM)。程序点 `DECSET 1` 后,方向键/Home/End 改发 SS3
#: (`ESC O A` …)而不是 CSI(`ESC [ A` …);VT100 起就是两套编码,只认其中一套的程序收到另一套
#: 会当普通字符。表**只覆盖被 DECCKM 影响的那 6 个键**,其余键照 `KEY_SEQUENCES` ——
#: 把整表复制一份才是第二真相源(§22c),这里刻意只写增量。
APP_CURSOR_KEY_SEQUENCES: Final[dict[str, str]] = {
    "up": "\x1bOA",
    "down": "\x1bOB",
    "right": "\x1bOC",
    "left": "\x1bOD",
    "home": "\x1bOH",
    "end": "\x1bOF",
}
APP_CURSOR_MODE: Final = 1

#: 焦点事件上报(DEC 私有模式 1004)。与鼠标同族:程序自己发 `DECSET 1004` 点单后,终端才在
#: 窗口获得/失去焦点时各上报一次 —— tmux 用它决定"这块窗格现在收不收键",vim 用它刷光标形状。
#: 两条序列是协议常量(`ESC[I` = 进焦点,`ESC[O` = 出焦点),不是随手拼的字节;和鼠标一样,
#: 程序没点单就发,到了程序那边只是垃圾输入,所以本模块显式拒(`TERMINAL_FOCUS_DISABLED`)。
FOCUS_MODE: Final = 1004
FOCUS_IN_SEQUENCE: Final = "\x1b[I"
FOCUS_OUT_SEQUENCE: Final = "\x1b[O"

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
#: 闲置会话回收窗口(秒)。**默认关闭(空/0)** —— 既有会话语义逐字节不变;设成 >0 的
#: 秒数才启用:任何超过该窗口没被交互碰过的会话会被回收(子进程 terminate + 释放 fd)。
#: 这是防"跑着没人管"的会话把 MAX_SESSIONS 占满、把句柄泄漏出去的根治手段。
TERMINAL_IDLE_TTL_ENV: Final = "IHUI_TERMINAL_IDLE_TTL_S"
#: PTY 读循环每次最多吐多少字节(行切分在 _pump_pty 里做,这里只控单次 read 上界)。
_PTY_READ_CHUNK: Final = 65_536
#: 管道路径的"有没有新字节"轮询间隔:POSIX 走 `select` 超时,Windows 走"睡一下再问"。
#: 50ms 是"读端感知不到延迟、又不把 CPU 空转满"的折中;与 `PTY_IDLE_FLUSH_S`(吐帧窗口)
#: 是两件事,不共用一个数。
_PIPE_POLL_S: Final = 0.05
#: PTY 输出"静默多久算一帧"。TUI 只写 `\r` 不写 `\n`,死等换行会让读端在子进程
#: 活着时读到空;0.25s 是"人能感知为一帧、又不把真正的慢输出切碎"的折中值。
PTY_IDLE_FLUSH_S: Final = 0.25


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
    #: 缓冲满时被挤掉的块数(deque maxlen 会**静默**丢弃最老的)。这是唯一能让
    #: "按 next_seq 续读却读不到中间那段"变成可判事实的计数;恒为 0 才说明零丢失。
    dropped_chunks: int = 0
    #: 最近一次"被交互碰到"的单调时刻(open/send/keys/eof/read/wait/resize/signal 刷新)。
    #: 闲置回收只认这一个时钟 —— 用 wall clock 会在系统改时间时误杀/漏杀。
    last_activity_ts: float = field(default_factory=time.monotonic)
    #: 程序是否已请求 bracketed paste(DECSET 2004)。由输出解析驱动,不靠调用方声明。
    bracketed_paste: bool = False
    #: 输出缓冲的块数上限(open 那一刻从 `IHUI_TERMINAL_BUFFER_LINES` 现读,缺省 2000)。
    #: 只记账:**改它要重开会话** —— 已存在的 deque 的 maxlen 不能就地改(`deque.maxlen` 只读)。
    buffer_lines: int = MAX_BUFFER_LINES
    #: 窗口标题(程序的 `OSC 0/1/2` 设;空串 = 程序没设过)。前端标签页/日志抬头用它。
    title: str = ""
    #: 响铃次数(程序发 BEL)。累计值,不清零 —— 回答"这个会话闹过几次",不是"刚才那一下"。
    bell_count: int = 0
    #: 程序请求过的 DEC 私有模式位集合(鼠标 1000/1002/1003、编码 1006/1005/1015、粘贴 2004 …)。
    #: 只由输出解析写入;`mouse_mode`/`mouse_encoding` 是它的**派生视图**(不另存一份状态)。
    private_modes: set[int] = field(default_factory=set)
    #: 屏幕网格(VT 记账)。它回答的是缓冲**回答不了**的那类问题:「光标现在停在哪」
    #: 「屏幕上第 3 行第 12 列是什么」。缓冲是行流水,`\r` 刷新在流水里是换行、在屏幕上是
    #: 同一格被改写 —— 拿流水冒充屏幕算光标,答案必然是错的,所以这块网格是真的。
    grid: Any = field(default=None, repr=False)

    def __post_init__(self) -> None:
        # deque 的 default_factory 拿不到实例字段,所以"上限"必须在这里落到缓冲上;
        # 两处各写一份 `deque(maxlen=…)` 就会漂开(§22c)。
        if self.chunks.maxlen != self.buffer_lines:
            self.chunks = deque(maxlen=self.buffer_lines)
        # 网格按 open 那一刻的窗口尺寸建;之后只经 `resize_terminal` 改(单一入口)
        if self.grid is None:
            self.grid = Grid(self.cols, self.rows)

    def touch(self) -> None:
        """刷新闲置计时。**所有**交互入口都要调(见 `_touch` 单出口)。"""
        self.last_activity_ts = time.monotonic()

    def idle_s(self) -> float:
        return round(time.monotonic() - self.last_activity_ts, 1)

    def running(self) -> bool:
        return self.proc.poll() is None

    @property
    def mouse_mode(self) -> str:
        """程序请求的鼠标上报档:`move`(1003)/`drag`(1002)/`click`(1000)/空串(没请求)。

        1003 ⊃ 1002 ⊃ 1000(能报"任何移动"的必然也能报拖动),所以取**最宽**的那一档,
        而不是把三个位分别回给调用方 —— 调用方只需要知道"现在能发哪类事件"。
        """
        if MOUSE_MOVE_MODE in self.private_modes:
            return "move"
        if MOUSE_DRAG_MODE in self.private_modes:
            return "drag"
        if MOUSE_CLICK_MODE in self.private_modes:
            return "click"
        return ""

    @property
    def mouse_encoding(self) -> str:
        """坐标封装:`sgr`(1006)优先,其次 `urxvt`(1015)/`utf8`(1005),都没点则是老 `x10`。

        优先级不是偏好而是兼容序:程序同时点 1006 与 1005 时,SGR 是它真正能解的那一种
        (1005 只影响老形状的坐标承载)。回给调用方的是**真要用的那一种**,不是"点过哪些"。
        """
        if MOUSE_SGR_ENCODING in self.private_modes:
            return "sgr"
        if MOUSE_URXVT_ENCODING in self.private_modes:
            return "urxvt"
        if MOUSE_UTF8_ENCODING in self.private_modes:
            return "utf8"
        return "x10"

    @property
    def alt_screen(self) -> bool:
        """当前是否在**备用屏幕**(全屏程序切屏;DEC 1049/1047/47 任一在位即真)。

        alt 屏的画面不进主屏 scrollback —— 这是真终端的行为,不是取舍:退出 vim 后往上翻,
        看到的应当是进 vim 之前的 shell 历史,而不是 vim 那一屏。快照/检索据此按屏面取。
        """
        return bool(ALT_SCREEN_MODES & self.private_modes)

    @property
    def focus_events(self) -> bool:
        """程序是否请求了焦点事件上报(`DECSET 1004`)。与 `mouse_mode` 同族:输出驱动,不由调用方声明。"""
        return FOCUS_MODE in self.private_modes

    def first_seq(self) -> int:
        """当前仍可读到的**最早** seq(缓冲空时 = 下一个将要产出的 seq)。"""
        with self.lock:
            if self.chunks:
                return int(self.chunks[0]["seq"])
            return self.seq + 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "terminal_id": self.terminal_id,
            "command": self.command,
            "cwd": self.cwd,
            "pid": self.proc.pid,
            "running": self.running(),
            "exit_code": self.proc.poll(),
            "next_seq": self.seq,
            "first_seq": self.first_seq(),
            "dropped_chunks": self.dropped_chunks,
            "idle_s": self.idle_s(),
            "bracketed_paste": self.bracketed_paste,
            "buffer_lines": self.buffer_lines,
            "title": self.title,
            "bell_count": self.bell_count,
            "mouse_mode": self.mouse_mode,
            "mouse_encoding": self.mouse_encoding,
            "alt_screen": self.alt_screen,
            "focus_events": self.focus_events,
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


def _buffer_lines(env: Mapping[str, str] | None = None) -> int:
    """输出缓冲块数上限:未设/空/非法/非正一律回落 `MAX_BUFFER_LINES`(**fail-safe,不猜**)。

    合法值夹在 `[MIN_BUFFER_LINES, MAX_BUFFER_LINES_CEILING]` 之间:下限挡住"把窗口调到
    0 条 ⇒ 每次 read 都丢光"的自伤,上限挡住"50 万块 deque"的 OOM。每次现读 env,不在导入期定格。
    """
    source = os.environ if env is None else env
    raw = (source.get(TERMINAL_BUFFER_LINES_ENV, "") or "").strip()
    if not raw:
        return MAX_BUFFER_LINES
    try:
        value = int(raw)
    except ValueError:
        return MAX_BUFFER_LINES
    if value <= 0:
        return MAX_BUFFER_LINES
    return max(MIN_BUFFER_LINES, min(value, MAX_BUFFER_LINES_CEILING))


def _idle_ttl_s(env: Mapping[str, str] | None = None) -> float:
    """闲置回收窗口(秒)。未设/空/非法/负数一律 0.0 = **关闭**(fail-safe,不猜)。

    每次现读 env(不在导入期定格),便于运行期调参与测试。
    """
    source = os.environ if env is None else env
    raw = (source.get(TERMINAL_IDLE_TTL_ENV, "") or "").strip()
    if not raw:
        return 0.0
    try:
        value = float(raw)
    except ValueError:
        return 0.0
    if value != value or value <= 0:  # NaN / 负数 / 零 都当"关闭"
        return 0.0
    return value


def reap_idle_terminals(*, ttl_s: float | None = None) -> dict[str, Any]:
    """回收闲置会话,并把"回收了谁、闲了多久"原样回报(**不静默杀**)。

    `ttl_s` 显式传入时优先;否则读 `IHUI_TERMINAL_IDLE_TTL_S`。十字段:
    - `disabled`:窗口未启用,一条也不动(既有语义不变);
    - `ttl`:窗口启用,按 `last_activity_ts` 判;每条回收都带回 `terminal_id` / `idle_s` /
      `exit_code`(回收前先 terminate,所以这个码是"被我们打断后"的真实退出码)。
    """
    ttl = _idle_ttl_s() if ttl_s is None else (ttl_s if ttl_s > 0 else 0.0)
    if ttl <= 0:
        return {"ok": True, "ttl_s": 0.0, "reason": "disabled", "reaped": []}
    now = time.monotonic()
    with _registry_lock:
        victims = [
            s for s in _sessions.values() if now - s.last_activity_ts >= ttl
        ]
        for session in victims:
            _sessions.pop(session.terminal_id, None)
    reaped: list[dict[str, Any]] = []
    for session in victims:
        idle = round(now - session.last_activity_ts, 1)
        was_running = session.running()
        _force_stop(session)
        _close_io(session)
        reaped.append(
            {
                "terminal_id": session.terminal_id,
                "idle_s": idle,
                "was_running": was_running,
                "exit_code": session.proc.poll(),
            }
        )
    return {"ok": True, "ttl_s": ttl, "reason": "ttl", "reaped": reaped}


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


def _with_reaped(payload: dict[str, Any], reaped: list[dict[str, Any]]) -> dict[str, Any]:
    """只有真回收了东西才加 `reaped_idle` —— TTL 未启用时响应形状与既有**逐字节一致**。"""
    if reaped:
        payload["reaped_idle"] = reaped
    return payload


def _owned(
    session: TerminalSession, user_id: str | None, session_id: str | None
) -> bool:
    return (
        session.owner_user_id == (user_id or None)
        and session.owner_session_id == (session_id or None)
    )


def _touch(session: TerminalSession) -> None:
    """刷新闲置计时的**唯一出口**(§22c:不在各 API 各写一份 `time.monotonic`)。"""
    session.touch()


def _live(
    terminal_id: str, user_id: str | None, session_id: str | None
) -> TerminalSession | None:
    """取会话 + 归属校验 + 刷新闲置计时,三件事一个出口。

    闲置回收(`reap_idle_terminals`)只认 `last_activity_ts`;若各入口各写一份赋值,
    迟早漏一处 ⇒ 正在用的会话被当闲置杀掉(误杀比泄漏更坏)。
    """
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return None
    _touch(session)
    return session


def _push(session: TerminalSession, tag: str, text: str) -> None:
    """把一个文本片段作为一条 chunk 入缓冲(seq 单调 +1)。PTY/管道共用同一入队口径。

    deque 满载时 python 会**静默**挤掉最老的一条 —— 对读端来说这就是"按 next_seq
    续读却凭空少了一段"。所以驱逐必须在同一个出口里记数(`dropped_chunks`),
    由 read/wait 回信封里的 `gap` 显式告知(§0.3:丢过就说丢过)。
    """
    with session.lock:
        maxlen = session.chunks.maxlen
        if maxlen is not None and len(session.chunks) >= maxlen:
            session.dropped_chunks += 1
        session.seq += 1
        # `alt` 在**入队那一刻**定格:同一条 chunk 里既切屏又写内容时,先由
        # `_track_terminal_state` 更新模式位、再到这里落标志(顺序由 `_push_output` 保证)。
        session.chunks.append(
            {"seq": session.seq, "stream": tag, "text": text, "alt": session.alt_screen}
        )


def _pump(session: TerminalSession, stream: Any, tag: str) -> None:
    """管道路径:**按行切 + 空闲即吐**,与 PTY 共用同一份 `_PtyLineSplitter` 与同一个窗口。

    为什么不能只 `readline` 循环:`readline` 在"没有 `\\n`"时永不返回,子进程只写 `\\r`
    刷帧(TUI/进度条/密码提示/单行进度)时读端拿到的是空 —— 这是"屏上写着却读不到"的真缺陷。

    读法按宿主分两条(系统能力不同,不是偏好):
    - Windows:管道没有 `select` 语义,用 `PeekNamedPipe` 先问"现在可读多少字节",
      有才 `os.read`(读不阻塞);没数据就让 CPU 让出 `_PIPE_POLL_S`。
    - POSIX:管道可用 `select` 等 `_PIPE_POLL_S`,可读才 read;read 回 `b""` = 写端关闭 = EOF。
    收尾时 pending 尾巴一律吐出,不丢尾。
    """
    splitter = _PtyLineSplitter()
    try:
        fd = stream.fileno()
    except (AttributeError, OSError, ValueError):
        return
    try:
        while True:
            try:
                data: bytes | None
                if os.name == "nt":
                    avail = _pipe_available(fd)
                    if avail > 0:
                        data = os.read(fd, min(avail, _PTY_READ_CHUNK))
                    elif session.proc.poll() is not None:
                        break  # 进程已退且管道已空 ⇒ 读端收尾(不空转)
                    else:
                        data = None
                else:
                    readable, _, _ = select.select([fd], [], [], _PIPE_POLL_S)
                    data = os.read(fd, _PTY_READ_CHUNK) if readable else None
            except (OSError, ValueError):
                break  # close_terminal 关了 fd,或写端断裂
            if data is None:
                idle = splitter.take_idle(PTY_IDLE_FLUSH_S)
                if idle:
                    _push_output(session, tag, idle)
                continue
            if not data:
                break  # EOF:写端已关闭
            for line in splitter.feed(data):
                _push_output(session, tag, line)
    finally:
        tail = splitter.take_all()
        if tail:
            _push_output(session, tag, tail)
        with contextlib.suppress(OSError, ValueError):
            stream.close()


def _pipe_available(fd: int) -> int:
    """Windows 管道当前**可读字节数**(`PeekNamedPipe`)。

    POSIX 不走这条(那边用 `select`)。`PeekNamedPipe` 只窥视不消费,所以"有才读"不会阻塞;
    句柄必须按指针宽度传(`c_void_p`),否则 64 位句柄被截成 32 位会指向错的管道。
    """
    k32 = _conpty_kernel32()
    msvcrt = importlib.import_module("msvcrt")
    handle = msvcrt.get_osfhandle(fd)
    avail = ctypes.c_ulong(0)
    ok = k32.PeekNamedPipe(
        ctypes.c_void_p(handle), None, 0, None, ctypes.byref(avail), None
    )
    if not ok:
        raise OSError("PeekNamedPipe 失败(管道已关闭或句柄无效)")
    return int(avail.value)


class _PtyLineSplitter:
    """PTY 输出的行切器:**按 `\\n` 切,空闲即吐**。

    为什么不能只按 `\\n` 切:TUI(htop/vim/进度条)的刷新帧经常只写 `\\r` 重绘、
    **一个 `\\n` 都不写**。纯行切会把整帧滞留在 pending 里,直到程序某天换行或退出 ——
    读端在"子进程活着、屏幕上明明有内容"的那一刻读到空,这是真缺陷,不是延迟问题。

    所以口径改为:完整行(`\\n`)即时吐出;末尾不完整片段由看门狗线程在"距上次收到
    字节 ≥ `PTY_IDLE_FLUSH_S`"时当作一条 chunk 吐出(**不带 `\\n`**,不伪造换行)。

    pending 存**字节**不存已解码文本:一次 read 可能把多字节字符切成两半,先解码就会把
    半个 `中` 变成替换字符(读端看到 `�` 而不是 `中`)。按 `\\n`(单字节)切行后再整行解码,
    跨 read 的字符自然拼得回来。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending = b""
        self._last_feed = time.monotonic()

    def feed(self, data: bytes) -> list[str]:
        """喂入原始字节,回已完成的整行(每行自带 `\\n`)。"""
        with self._lock:
            self._pending += data
            self._last_feed = time.monotonic()
            lines: list[str] = []
            while b"\n" in self._pending:
                line, self._pending = self._pending.split(b"\n", 1)
                lines.append(line.decode("utf-8", errors="replace") + "\n")
            return lines

    def take_idle(self, idle_s: float) -> str:
        """静默够久就把 pending 交出去(空串 = 还没到点/没东西)。"""
        with self._lock:
            if not self._pending or time.monotonic() - self._last_feed < idle_s:
                return ""
            data, self._pending = self._pending, b""
            return data.decode("utf-8", errors="replace")

    def take_all(self) -> str:
        with self._lock:
            data, self._pending = self._pending, b""
            return data.decode("utf-8", errors="replace")


def _track_private_modes(session: TerminalSession, text: str) -> None:
    """按输出里的 `DECSET`/`DECRST` 记私有模式位(鼠标上报靠它,不靠调用方声明)。

    一条序列可带多个模式(`?1002;1006h`),所以先把整段数字拆开再一次性落账:逐字节扫
    "h/l 前面那个数"会把 `1002;1006` 只认出 1006。`h` 置位、`l` 清位,与 DEC 语义一致。
    """
    for m in _DEC_PRIVATE_MODE_RE.finditer(text):
        modes = {int(p) for p in m.group(1).split(";") if p.isdigit()}
        if not modes:
            continue
        # 两个 pump(stdout/stderr)会并发调到这里:`|=` / `-=` 是读-改-写,不加锁会丢位。
        with session.lock:
            if m.group(2) == "h":
                session.private_modes |= modes
            else:
                session.private_modes -= modes


def _track_terminal_state(session: TerminalSession, text: str) -> None:
    """从输出里读**终端状态信号**(单一出口):bracketed paste 模式位、窗口标题、响铃次数。

    为什么读输出而不是"由调用方声明":这三件事全部是**程序**决定的 —— bracketed paste 由
    readline/vim/less 自己 `DECSET 2004`;窗口标题由程序的 `OSC 0/1/2` 设(xterm 用它做标签页
    名字);BEL 是程序主动闹的那一声。终端侧只能跟着记,不读就只能靠猜。

    顺序有意为之:先吃掉 OSC 整段,**再**数剩下的 BEL —— OSC 的终止符本身就是一个 BEL,
    先数后吃会把"每次设标题"都记成一次响铃(假信号比没信号更坏)。

    标题只留可打印字符并截到 `MAX_TITLE_CHARS`:`OSC` 可以由一个失控的程序连发,不设上界
    等于让它把会话账本撑爆;控制字符进信封还会破坏调用方的版式。

    私有模式位(`DECSET`/`DECRST`)在同一出口落账:鼠标上报(1000/1002/1003 + 编码
    1006/1005/1015)是程序点了才允许发的,终端侧不读这一位就只能靠猜。
    """
    _track_private_modes(session, text)
    if BRACKETED_PASTE_ON in text:
        session.bracketed_paste = True
    if BRACKETED_PASTE_OFF in text:
        session.bracketed_paste = False
    for m in _OSC_TITLE_RE.finditer(text):
        title = ANSI_NOISE_RE.sub("", m.group(1)).strip()
        if title:
            session.title = title[:MAX_TITLE_CHARS]
    bells = _OSC_ANY_RE.sub("", text).count("\x07")
    if bells:
        session.bell_count += bells


def _push_output(session: TerminalSession, tag: str, text: str) -> None:
    """输出入缓冲的**唯一出口**:先读状态信号,再喂屏幕网格,最后入队(三件事不会各自被忘掉)。

    屏面必须在**入队就喂**(而不是等 `snapshot` 时从缓冲重放):网格要的是原始字节序,
    而缓冲在 deque 满时会把最老的块静默挤掉 —— 那时重放已经少了开头,光标会算错。
    喂网格持 `session.lock`:网格不是线程安全的,PTY 读线程与空闲看门狗都会往这里送。
    """
    _track_terminal_state(session, text)
    if session.grid is not None:
        with session.lock:
            session.grid.feed(text)
    _push(session, tag, text)


def _pump_pty(session: TerminalSession, fd: int, tag: str) -> None:
    """PTY 路径:master 读原始字节,按行切 + **空闲即吐**(见 `_PtyLineSplitter`)。

    子进程退出后,master 的 os.read 在 POSIX 返回 EOF(b"")或抛 EIO —— 两种都判收尾。
    收尾时把 pending 尾巴一律吐出,不丢尾。本线程不负责关 fd ——
    fd 由 `_close_io`/close_terminal 统一直close,避免 read 线程与 close 抢关。
    """
    splitter = _PtyLineSplitter()
    stop = threading.Event()

    def _watch_idle() -> None:
        # 看门狗只负责"静默吐 pending";读线程一结束就停(收尾 flush 由 finally 负责),
        # 所以不会出现"读线程已退出、尾巴永远留在 pending"的窗口。
        while not stop.wait(PTY_IDLE_FLUSH_S / 2):
            idle_text = splitter.take_idle(PTY_IDLE_FLUSH_S)
            if idle_text:
                _push_output(session, tag, idle_text)

    watcher = threading.Thread(
        target=_watch_idle, name=f"pty-idle-{session.terminal_id}", daemon=True
    )
    watcher.start()
    try:
        while True:
            try:
                data = os.read(fd, _PTY_READ_CHUNK)
            except OSError:
                break  # EOF / EIO:子进程已退,读端失效
            if not data:
                break
            for line in splitter.feed(data):
                _push_output(session, tag, line)
    finally:
        stop.set()
        tail = splitter.take_all()
        if tail:
            _push_output(session, tag, tail)


def _prune_for_new_session() -> None:
    """注册表有界:满了先清已结束的;仍满则拒绝(不悄悄杀活会话)。"""
    while len(_sessions) >= MAX_SESSIONS:
        closed = [s for s in _sessions.values() if not s.running()]
        if not closed:
            break
        for session in closed:
            _close_io(session)
            _sessions.pop(session.terminal_id, None)


def _pipe_stdin_text(proc: subprocess.Popen[bytes]) -> Any:
    """管道路径 stdin 的**文本**写面(`send`/`paste`/`eof` 一律写 str)。

    为什么要在这一层适配:读侧必须拿到**无缓冲的裸 fd**(Windows 要 `PeekNamedPipe` 判断可读、
    POSIX 要 `select`+`os.read`),而 `text=True` 会把三条管道都包成文本流、还会自带行缓冲
    (`bufsize=1`),读侧一混用就踩"数据躺在缓冲里、`os.read` 却读不到"的竞态。所以管道整体
    走二进制无缓冲,只在**写入口**包一层文本适配(编码/异常策略与改前一致)。
    """
    if proc.stdin is None:  # 理论不可达(Popen 指定了 PIPE);防御性返回 None
        return None
    return io.TextIOWrapper(
        proc.stdin, encoding="utf-8", errors="replace", write_through=True
    )


def _spawn_pipe(command: str, cwd: str, env_extra: dict[str, str] | None) -> subprocess.Popen[bytes]:
    """默认后端:三条匿名管道(**二进制 + 无缓冲**,读侧要能非阻塞探询)。"""
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
        text=False,
        bufsize=0,
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
        buffer_lines=_buffer_lines(),
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
    # 开新会话之前先回收闲置会话(仅 `IHUI_TERMINAL_IDLE_TTL_S` 启用时生效,默认 0 = 不动),
    # 免得"跑着没人管"的会话把 MAX_SESSIONS 占死;回收了谁一律在响应里点名,不静默杀。
    reaped_idle = reap_idle_terminals()["reaped"]
    with _registry_lock:
        if _pty_requested() and _pty_supported_on_host():
            return _with_reaped(
                _open_pty_session(
                    command=command, cwd=cwd, user_id=user_id,
                    session_id=session_id, env_extra=env_extra,
                    cols=cols_i, rows=rows_i,
                ),
                reaped_idle,
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
            write_io=_pipe_stdin_text(proc),
            backend="pipes",
            buffer_lines=_buffer_lines(),
        )
        _sessions[session.terminal_id] = session
    assert proc.stdout is not None and proc.stderr is not None
    for stream, tag in ((proc.stdout, "stdout"), (proc.stderr, "stderr")):
        thread = threading.Thread(target=_pump, args=(session, stream, tag), daemon=True)
        thread.start()
        session.pumps.append(thread)
    if size_requested:
        return _with_reaped(
            {
                "ok": True,
                "terminal": session.to_dict(),
                "size_ignored": {"cols": cols_i, "rows": rows_i},
                "size_ignored_reason": (
                    "管道路径没有 tty 语义:窗口尺寸只对真 tty 生效;"
                    f"要以 tty 开会话请设 {PTY_REQUEST_ENV}=1"
                ),
            },
            reaped_idle,
        )
    return _with_reaped({"ok": True, "terminal": session.to_dict()}, reaped_idle)


def send_terminal(
    terminal_id: str,
    text: str,
    *,
    user_id: str | None,
    session_id: str | None,
    enter: bool = True,
) -> dict[str, Any]:
    session = _live(terminal_id, user_id, session_id)
    if session is None:
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


def _keys_payload(
    keys: Sequence[str], *, app_cursor: bool = False
) -> tuple[str | None, str, str]:
    """把键名列表拼成字节序列,返回 (payload, errorCode, 逐键归一结果 / 出错细节)。

    校验与拼接在**碰会话之前**做完:未知键、超量、超长一律显式拒,不让半截输入写进子进程
    (写一半再报错 = 子进程收到残缺序列,后续状态全是脏的)。

    `app_cursor` 只影响 `APP_CURSOR_KEY_SEQUENCES` 覆盖的那 6 个键(方向键/Home/End):
    程序 `DECSET 1` 后它们必须发 SS3,否则只认应用模式的程序会把 `ESC[A` 当垃圾字符。
    """
    if not keys:
        return None, "TERMINAL_EMPTY_KEYS", ""
    if len(keys) > MAX_KEYS_PER_CALL:
        return None, "TERMINAL_TOO_MANY_KEYS", str(len(keys))
    table = (
        {**KEY_SEQUENCES, **APP_CURSOR_KEY_SEQUENCES} if app_cursor else KEY_SEQUENCES
    )
    parts: list[str] = []
    seqs: list[str] = []
    for raw in keys:
        norm = _normalize_key(str(raw))
        seq = table.get(norm)
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

    与 `signal_terminal("interrupt")` 的分工:后者在 **PTY 后端**同样走"输入字节"路线
    (`TTY_INTERRUPT_BYTE` = 0x03,经行规程/程序自己解释,等价于用户亲手按 Ctrl+C);
    只有**管道后端**才走进程信号语义(POSIX SIGINT / Windows CTRL_BREAK)。本函数是
    **纯输入字节**通道 —— 由行规程/程序自己解释。

    如实说明一条边界(真终端的物理事实,不是本实现丢字节):程序仍处于**规范(canonical)
    输入模式**时,行规程会当场消费 ESC/方向键之类的编辑键 —— POSIX 把它们当普通字符留在
    行里随回车送达;Windows ConPTY 的 conhost 会直接吃掉(本机实测)。要让程序**原样**拿到
    这些字节,它自己必须先切到 raw/非规范模式(vim、less 这类本来就会切)。

    光标键形态跟着程序走:程序点过 `DECSET 1`(DECCKM,应用光标键模式)后,方向键/Home/End
    改发 SS3(`ESC O A` …),否则发 CSI(`ESC [ A` …)。回执里的 `app_cursor` 如实说明这次
    实际用的是哪一种 —— 不靠调用方假设。
    """
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    with session.lock:
        app_cursor = APP_CURSOR_MODE in session.private_modes
    payload, code, detail = _keys_payload(keys, app_cursor=app_cursor)
    if payload is None:
        if code == "TERMINAL_UNKNOWN_KEY":
            return {
                "ok": False, "errorCode": code,
                "error": f"未知键名: {detail}",
                "supported": sorted({**KEY_SEQUENCES, **APP_CURSOR_KEY_SEQUENCES}),
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
        "app_cursor": app_cursor,
    }

def paste_terminal(
    terminal_id: str,
    text: str,
    *,
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    """粘贴一段**多行**文本:整段一次性写入,**不追加回车、不逐行执行**。

    与 `send_terminal` 的分工:send 是"敲一行 + 回车",粘贴是"把剪贴板倒进去"。多行内容
    走 send 会被程序当成多次回车(shell 里一条粘贴炸成三条命令),这不是延迟问题而是语义问题。

    包裹口径照真终端:程序发过 `DECSET 2004`(`session.bracketed_paste=True`)才用
    `ESC[200~ … ESC[201~` 包;没请求就原样写(此时写入 `ESC[200~` 只会被当垃圾字符)。
    `bracketed` 字段如实回答"这次到底包了没有",不靠调用方假设。

    上限 `MAX_PASTE_BYTES`:超了显式拒,不静默截断(截断的粘贴比拒绝更难查)。
    """
    session = _live(terminal_id, user_id, session_id)
    if session is None:
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
    if not text:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": "paste 的内容不能为空",
        }
    payload = text
    if len(payload.encode("utf-8")) > MAX_PASTE_BYTES:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"paste 内容过大(> {MAX_PASTE_BYTES} 字节),请分批粘贴",
        }
    bracketed = session.bracketed_paste
    if bracketed:
        payload = f"{BRACKETED_PASTE_START}{payload}{BRACKETED_PASTE_END}"
    sink = session.write_io
    if sink is None:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": "本会话没有可写输入通道", "terminal": session.to_dict(),
        }
    try:
        sink.write(payload)
        sink.flush()
    except (OSError, ValueError) as e:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": f"粘贴写入失败: {e}", "terminal": session.to_dict(),
        }
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "bytes_written": len(payload.encode("utf-8")),
        "bracketed": bracketed,
        "lines": len(text.split("\n")),
        "running": session.running(),
    }


def _mouse_sequence(*, code: int, x: int, y: int, release: bool, encoding: str) -> str:
    """把一次鼠标事件编成字节序列(**单一真相源**)。

    四种封装不是四种风格而是四代协议:
    - `sgr`(1006):`ESC[<code;x;yM`(松开用 `m` 收尾)。十进制坐标、无 223 上限,现代默认。
    - `urxvt`(1015):`ESC[code;x;yM`,十进制坐标但松开仍是"码 3 + M"。
    - `utf8`(1005) / `x10`:老形状 `ESC[M` + 三字节。1005 靠 UTF-8 多字节承载远坐标;
      什么都没点时就是单字节 x10(**坐标上限 223**,由调用方先校验)。
    """
    if encoding == "sgr":
        return f"\x1b[<{code};{x};{y}{'m' if release else 'M'}"
    if encoding == "urxvt":
        return f"\x1b[{code + 32};{x + 32};{y + 32}M"
    return "\x1b[M" + "".join(chr(v) for v in (code + 32, x + 32, y + 32))


def mouse_terminal(
    terminal_id: str,
    *,
    event: str = "press",
    button: str | None = None,
    x: int | str = 1,
    y: int | str = 1,
    modifiers: Sequence[str] = (),
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    """把一次鼠标事件作为**输入字节**上报给真 tty 程序(vim/htop/less 的鼠标交互入口)。

    为什么必须由程序先"点单":鼠标上报是 DEC 私有模式(1000 点击 / 1002 拖动 / 1003 任何
    移动),只有程序自己发 `DECSET` 请求后,终端发的 `ESC[M…` / `ESC[<…M` 才会被它当事件解;
    没请求就发的字节在规范模式下只是垃圾输入。所以本函数先读会话账本里由输出解析出来的
    `mouse_mode`,程序没请求就显式拒(错误码 `TERMINAL_MOUSE_DISABLED`),不"先发发看"。

    坐标是**1 基单元格**(与 `snapshot` 的行号口径同族),上界 `cols/rows` 由调用方自己按屏宽
    换算;这里只挡非正数与超过 `MOUSE_MAX_COORD` 的值。老 x10 编码的单字节上限 223 属协议
    事实:超了只能拒(让程序先点 1005/1015/1006),夹紧或截断会让点击落到错误格子上。

    `event="click"` 是一次按下+松开的**成对**序列(不是两次独立调用):程序按 `press` 收到后
    期待同一坐标的 `release`,中间插进别的输入会被当成拖动。
    """
    event_name = str(event or "press").strip().lower()
    if event_name not in {"press", "release", "move", "click"}:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"未知鼠标事件: {event_name}(支持 press/release/move/click)",
        }
    button_name = re.sub(r"[\s_]+", "-", str(button or "").strip().lower())
    if event_name == "move":
        if button_name in {"", "none"}:
            base = MOUSE_NO_BUTTON
        elif button_name in MOUSE_BUTTON_CODES:
            base = MOUSE_BUTTON_CODES[button_name]
        else:
            return {
                "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
                "error": f"未知鼠标键: {button_name}(支持 left/middle/right/wheel-up/wheel-down,"
                         "移动可省 button)",
            }
    elif button_name not in MOUSE_BUTTON_CODES:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"未知鼠标键: {button_name}(支持 left/middle/right/wheel-up/wheel-down)",
        }
    else:
        base = MOUSE_BUTTON_CODES[button_name]
    try:
        xi = int(str(x).strip())
        yi = int(str(y).strip())
    except (TypeError, ValueError):
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": "x/y 需要正整数单元格坐标",
        }
    if xi < 1 or yi < 1 or xi > MOUSE_MAX_COORD or yi > MOUSE_MAX_COORD:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"x/y 超出可用范围(1..{MOUSE_MAX_COORD},实得 {xi}/{yi})",
        }
    bits = 0
    for raw in modifiers:
        norm = re.sub(r"[\s_]+", "-", str(raw).strip().lower())
        bit = MOUSE_MODIFIER_BITS.get(norm)
        if bit is None:
            return {
                "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
                "error": f"未知修饰键: {norm}(支持 shift/alt/ctrl)",
            }
        bits |= bit

    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    if session.backend != "pty":
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_A_TTY",
            "error": "管道路径不是 tty:鼠标事件只能作为输入字节上报给真 tty 程序"
                     "(用 IHUI_INTERACTIVE_PTY=1 开会话)",
            "terminal": session.to_dict(),
        }
    mode = session.mouse_mode
    if not mode:
        return {
            "ok": False, "errorCode": "TERMINAL_MOUSE_DISABLED",
            "error": "程序没有请求鼠标(DECSET 1000/1002/1003);现在发过去只会变成垃圾输入",
            "terminal": session.to_dict(),
        }
    if event_name == "move" and mode == "click":
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": "程序只请求了点击(1000),没有请求移动(1002/1003)",
            "terminal": session.to_dict(),
        }
    if button_name in {"wheel-up", "wheel-down"} and event_name != "press":
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": "滚轮只有 press:一次滚动就是一格,协议里没有滚轮松开",
            "terminal": session.to_dict(),
        }
    encoding = session.mouse_encoding
    if encoding == "x10" and max(xi, yi) > MOUSE_LEGACY_MAX_COORD:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"老 x10 编码的单字节坐标上限是 {MOUSE_LEGACY_MAX_COORD}(实得 {xi}/{yi});"
                     "请让程序先开 1005/1015/1006",
            "terminal": session.to_dict(),
        }
    if session.stdin_closed:
        return {
            "ok": False, "errorCode": "TERMINAL_STDIN_CLOSED",
            "error": "本会话 stdin 已送过 EOF,不能再发鼠标事件;需要继续交互请开新会话",
            "terminal": session.to_dict(),
        }
    if not session.running():
        return {
            "ok": False, "errorCode": "TERMINAL_EXITED",
            "error": f"终端已退出(exit_code={session.proc.poll()})",
            "terminal": session.to_dict(),
        }
    code = base | bits | (MOUSE_MOTION_FLAG if event_name == "move" else 0)
    release_code = code if encoding == "sgr" else (MOUSE_NO_BUTTON | bits)
    if event_name == "click":
        sequences = [
            _mouse_sequence(code=code, x=xi, y=yi, release=False, encoding=encoding),
            _mouse_sequence(code=release_code, x=xi, y=yi, release=True, encoding=encoding),
        ]
    elif event_name == "release":
        sequences = [
            _mouse_sequence(code=release_code, x=xi, y=yi, release=True, encoding=encoding)
        ]
    else:
        sequences = [_mouse_sequence(code=code, x=xi, y=yi, release=False, encoding=encoding)]
    payload = "".join(sequences)
    sink = session.write_io
    if sink is None:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": "本会话没有可写输入通道", "terminal": session.to_dict(),
        }
    try:
        sink.write(payload)
        sink.flush()
    except (BrokenPipeError, OSError, ValueError) as e:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": f"鼠标事件写入失败: {e}", "terminal": session.to_dict(),
        }
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "event": event_name,
        "button": button_name,
        "x": xi,
        "y": yi,
        "mouse_mode": mode,
        "encoding": encoding,
        "bytes_written": len(payload.encode("utf-8")),
        "sequences": sequences,
    }


def focus_terminal(
    terminal_id: str,
    *,
    state: str = "in",
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    """把一次**窗口焦点变化**作为输入字节上报给程序(`ESC[I` 进焦点 / `ESC[O` 出焦点)。

    为什么是由服务端发而不是程序自己知道:焦点是**终端侧**的事实(用户的窗口/标签页切走了),
    子进程看不见。DEC 私有模式 1004 就是程序对终端说的"有人切走/切回来时告我一声":tmux 靠它
    决定这块窗格收不收键,vim 靠它刷光标形状。程序没点 `DECSET 1004` 就发过去,这两条序列在
    它眼里只是两串垃圾输入 —— 所以先读账本,没点单显式拒(`TERMINAL_FOCUS_DISABLED`)。

    **两条后端都支持**(与 `mouse_terminal` 的 `TERMINAL_NOT_A_TTY` 不同,这是有意的):
    鼠标坐标落在**屏幕网格**上,没有 tty 就没有格子,报表无意义;焦点是一个纯粹的**事件字节**,
    不依附任何网格 —— 管道路径下字节同样原样落到子进程 stdin,语义不打折。

    `state` 除 `in`/`out` 也接受 `focus`/`blur` 两个同义写法(模型侧更容易自然表述),
    归一后回执里的 `state` 只有 `in`/`out` 两种,不做第三态。
    """
    raw = re.sub(r"[\s_]+", "-", str(state or "").strip().lower())
    normal = {"in": "in", "focus": "in", "gain": "in", "out": "out", "blur": "out", "lose": "out"}
    state_name = normal.get(raw)
    if state_name is None:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"未知焦点状态: {state}(支持 in/out,亦接受 focus/blur)",
        }
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    if not session.focus_events:
        return {
            "ok": False, "errorCode": "TERMINAL_FOCUS_DISABLED",
            "error": "程序没有请求焦点事件(DECSET 1004);现在发过去只会变成垃圾输入",
            "terminal": session.to_dict(),
        }
    if session.stdin_closed:
        return {
            "ok": False, "errorCode": "TERMINAL_STDIN_CLOSED",
            "error": "本会话 stdin 已送过 EOF,不能再报焦点事件;需要继续交互请开新会话",
            "terminal": session.to_dict(),
        }
    if not session.running():
        return {
            "ok": False, "errorCode": "TERMINAL_EXITED",
            "error": f"终端已退出(exit_code={session.proc.poll()})",
            "terminal": session.to_dict(),
        }
    sequence = FOCUS_IN_SEQUENCE if state_name == "in" else FOCUS_OUT_SEQUENCE
    sink = session.write_io
    if sink is None:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": "本会话没有可写输入通道", "terminal": session.to_dict(),
        }
    try:
        sink.write(sequence)
        sink.flush()
    except (BrokenPipeError, OSError, ValueError) as e:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": f"焦点事件写入失败: {e}", "terminal": session.to_dict(),
        }
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "state": state_name,
        "sequence": sequence,
        "bytes_written": len(sequence.encode("utf-8")),
        "focus_events": True,
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
    session = _live(terminal_id, user_id, session_id)
    if session is None:
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


def _history_gap(first_seq: int, dropped_chunks: int, since_seq: int) -> dict[str, Any]:
    """读窗口缺口判据(**唯一**出口,read/wait 共用,§22c 不写第二份)。

    `since_seq` 之后本该有 `first_seq - 1 - since_seq` 条,但缓冲里最早的已经是
    `first_seq` ⇒ 中间那段被 deque 挤掉了。三个字段分工:
    - `gap`:本次窗口**有没有**跨过缺口(消费方据此决定要不要告警);
    - `gap_chunks`:本次窗口跨过多少条;
    - `dropped_chunks`:生命周期累计丢过多少条(回答"曾经丢过没有",不随窗口清零)。
    """
    lost = max(0, first_seq - 1 - max(0, since_seq))
    return {
        "first_seq": first_seq,
        "gap": lost > 0,
        "gap_chunks": lost,
        "dropped_chunks": dropped_chunks,
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
    """读增量输出(`since_seq` 之后的所有块)。

    缓冲是有界的(`MAX_BUFFER_LINES`):消费方太慢时最老的块会被挤掉。此时**不会**
    假装"什么都没发生"——信封里 `gap=True` / `gap_chunks` / `dropped_chunks` 明说丢了多少。
    """
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    since = max(0, int(since_seq))
    deadline = time.monotonic() + max(0.0, min(wait_s, 10.0))
    while True:
        with session.lock:
            pending = [c for c in session.chunks if c["seq"] > since]
            running = session.running()
            next_seq = session.seq
            first_seq = int(session.chunks[0]["seq"]) if session.chunks else session.seq + 1
            dropped = session.dropped_chunks
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
        **_history_gap(first_seq, dropped, since),
        "running": running,
        "exit_code": session.proc.poll(),
        "truncated": used >= max_chars and len(pending) > len(out),
    }


def _buffer_face(session: TerminalSession) -> tuple[str, int, int]:
    """一次取齐"当前屏面全文 / 缓冲最早 seq / 累计丢块数"(快照与检索共用的**唯一**取样出口)。

    在锁内一次取完:三样分别取会读到"两次取样之间被 pump 推过"的拼接面,那样快照的行号
    与 `first_seq` 就对不上,k 检索命中也会落在已被挤掉的窗口里而无人自知。

    **按屏面取**(真终端语义):在主屏时排除 alt 屏的块,在 alt 屏时只取 alt 块 —— 全屏程序
    的画面不进主屏 scrollback,退出 vim 往上翻不应翻出 vim 那一屏。`first_seq`/`dropped_chunks`
    仍报整条缓冲的读窗口事实(read 那一侧的口径),不随屏面收窄。
    """
    with session.lock:
        want_alt = session.alt_screen
        shown = [c for c in session.chunks if bool(c.get("alt", False)) == want_alt]
        text = "".join(str(c["text"]) for c in shown)
        first_seq = int(session.chunks[0]["seq"]) if session.chunks else session.seq + 1
        dropped = session.dropped_chunks
    return text, first_seq, dropped


def _scan_face(text: str) -> tuple[str, list[dict[str, Any]]]:
    """**一次**从左到右扫完整条终端流,同时产出「人读文本」与「OSC 8 链接台账」(唯一出口)。

    为什么必须是一次:同一条流上有三个互相牵动的量 —— 可见文字、这段文字链到哪个地址、
    它在归一后文本的第几行。分三趟做(先 `sub` 掉 OSC 再 `sub` 掉 `\\r` 再数行)会在
    "转义序列内部/外部恰好夹着 `\\r\\n`"这类边界上给出互相矛盾的行号(链接落在第 3 行、
    快照却说第 4 行)。一次扫完就没有这个缝:两边同源、逐字对得上。

    归一规则与旧版 `strip_ansi` **逐字等价**(它有 85 条用例与 `check-replacement-chars`
    盯着,不能悄悄改口径):
    - 控制序列(`_SCAN_RE` 的 `esc` 支)整段丢弃,但 OSC 8 那一条先记进台账;
    - 残余单字节控制符(`noise` 支)丢弃;
    - `\\r` 折行:`\\r+\\n` 折成**一个** `\\n`(子进程在文本模式下把 `\\r\\n` 又翻成 `\\r\\r\\n`
      也走这条),纯 `\\r` 串(行内回车刷新)按个数折成同样多的 `\\n`,绝不能反过来做 ——
      反过来会把 `\\r\\r\\n` 分成两行。

    链接台账:URI 为空的那条 `ESC]8;;` 表示"链接结束";一段链接的正文取**可见字符**(已归一),
    起始行号取链接开启那一刻的行号。按 `(url, text)` 去重并保留首次出现 —— TUI 每帧重绘
    同一个链接上百次,不去重就等于把一屏变成一整本书。
    """
    links: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    out: list[str] = []
    line = 1
    pending_cr = 0
    # 当前链接状态(不在链接里时 url 为 None)
    cur_url: str | None = None
    cur_chars: list[str] = []
    cur_line = 1

    def _flush_link() -> None:
        nonlocal cur_url, cur_chars
        if cur_url is None:
            return
        body = "".join(cur_chars)
        # 空正文的链接没有可点的东西,不进台账(程序常先开链接再写文字)
        if body.strip():
            body = body[:MAX_LINK_TEXT_CHARS]
            key = (cur_url, body)
            if key not in seen:
                seen.add(key)
                match = _LINK_SCHEME_RE.match(cur_url)
                links.append(
                    {
                        "url": cur_url,
                        "text": body,
                        "line_no": cur_line,
                        "scheme": match.group("scheme").lower() if match else "",
                    }
                )
        cur_url = None
        cur_chars = []

    def _emit(visible: str) -> None:
        """把一段**已归一**的可见文字落到正文与当前链接正文上。"""
        nonlocal pending_cr, line
        for ch in visible:
            if ch == "\r":
                pending_cr += 1
                continue
            if ch == "\n":
                # `\r+\n` 折成一个换行;没有待折的 `\r` 时 `\n` 本身就是换行
                out.append("\n")
                if cur_url is not None:
                    cur_chars.append("\n")
                line += 1
                pending_cr = 0
                continue
            if pending_cr:
                # 纯 `\r` 串:每个都是一个换行(与 `re.sub("\\r", "\\n")` 同口径)
                out.append("\n" * pending_cr)
                if cur_url is not None:
                    cur_chars.append("\n" * pending_cr)
                line += pending_cr
                pending_cr = 0
            out.append(ch)
            if cur_url is not None:
                cur_chars.append(ch)

    last = 0
    for m in _SCAN_RE.finditer(text):
        seg = text[last : m.start()]
        if seg:
            _emit(seg)
        last = m.end()
        esc = m.group("esc")
        if esc is None:
            continue  # noise 支:丢弃
        if esc.startswith("\x1b]8;"):
            hyper = _OSC_HYPERLINK_RE.match(esc)
            if hyper is not None:
                uri = hyper.group(2).strip()
                _flush_link()
                if uri:
                    cur_url = uri[:MAX_LINK_URL_CHARS]
                    cur_line = line
                    cur_chars = []
                # uri 为空 ⇒ 只关闭上一段(上面已经 flush)
    if text[last:]:
        _emit(text[last:])
    # 收尾:`\r` 串末尾没有后续字符时,每个 `\r` 也是一个换行
    if pending_cr:
        out.append("\n" * pending_cr)
        if cur_url is not None:
            cur_chars.append("\n" * pending_cr)
        line += pending_cr
        pending_cr = 0
    _flush_link()
    return "".join(out), links


def strip_ansi(text: str) -> str:
    """把终端流归一成**人读文本**(快照/检索的唯一出口,§22c 不写第二份)。

    实现在 `_scan_face` 里:剥控制序列、`\\r` 折行、丢残余控制符三件事在**一次**扫描中完成,
    与 `hyperlinks` 共用同一次扫描 ⇒ 链接行号与快照行号天然同源。宽字符与颜色文本的内容
    本身不受影响 —— 剥的是控制序列,不是字。
    """
    # 快速路径:既没有 ESC 也没有 `\r`/残余控制符 ⇒ 原文就是人读文本(零拷贝)
    if "\x1b" not in text and "\r" not in text and ANSI_NOISE_RE.search(text) is None:
        return text
    return _scan_face(text)[0]


def hyperlinks(text: str) -> list[dict[str, Any]]:
    """OSC 8 链接台账(`url` / `text` / `line_no` / `scheme`),按 `(url, text)` 去重。"""
    return _scan_face(text)[1]



def _lines_of(plain: str) -> list[str]:
    """把**已归一**的文本按行切,并遵守"文末换行不是一个空行"(与读侧的计行口径同源)。"""
    if plain == "":
        return []
    parts = plain.split("\n")
    if parts and parts[-1] == "":
        parts.pop()
    return parts


def _plain_lines(text: str) -> list[str]:
    """`strip_ansi` 之后按行切(`_lines_of` 的原文入参版本;同一份计行口径)。"""
    return _lines_of(strip_ansi(text))


def snapshot_terminal(
    terminal_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
    max_lines: int = 200,
) -> dict[str, Any]:
    """给**屏幕快照**:缓冲里去掉转义序列后的纯文本,只要末尾 `max_lines` 行。

    与 `read_terminal` 的分工:read 是"增量、带 seq、给程序读";snapshot 是"现在这块屏长什么样",
    给**人和模型**看 —— 带 `\\x1b[2J`/光标移动的帧直接读出来是一团控制符,渲染方还得自己剥一次。
    剥法只有 `strip_ansi` 一份(检索也用同一份),不存在"快照剥一套、检索再剥一套"的漂移面。

    `truncated=True` 表示缓冲里的行比你要求的多,回的是**末尾**那段(屏幕语义:最新的在下面)。
    """
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    try:
        keep = int(max_lines)
    except (TypeError, ValueError):
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"max_lines 必须是整数(实得 {max_lines!r})",
        }
    keep = max(1, min(keep, MAX_SNAPSHOT_LINES))
    text, first_seq, dropped = _buffer_face(session)
    # 与行数同一次扫描取:`_scan_face` 同时给出可见文本与链接台账(两处不各扫一遍)
    plain, found_links = _scan_face(text)
    all_lines = _lines_of(plain)
    truncated = len(all_lines) > keep
    lines = all_lines[-keep:]
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "text": "\n".join(lines),
        "lines": len(lines),
        "total_lines": len(all_lines),
        "truncated": truncated,
        "link_count": len(found_links),
        "first_seq": first_seq,
        "dropped_chunks": dropped,
        "running": session.running(),
        "exit_code": session.proc.poll(),
        "cols": session.cols,
        "rows": session.rows,
        "bracketed_paste": session.bracketed_paste,
        "title": session.title,
        "bell_count": session.bell_count,
        "alt_screen": session.alt_screen,
    }


def cursor_terminal(
    terminal_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
    include_screen: bool = False,
) -> dict[str, Any]:
    """回**光标现在停在哪**(行列 1 起)+ 它所在那一行,可选连整块屏面一起回。

    这是"屏幕网格"这条线的对外出口。它回答的问题与 `snapshot` **不是一回事**:
    snapshot 给的是"输出流里最近的 N 行"(行流水,`\\r` 刷新在里面是换行);cursor 给的是
    "程序此刻把光标摆在哪一格"。两者都需要,但拿前者去推后者必然错 —— 一帧全屏重绘在流水里
    是几十行,在屏幕上只有一屏;`\\r` 刷新在流水里是换行,在屏幕上是同一格被改写。

    回执里 `pending_wrap` 是 xterm 的边界态:光标**停在**末格且"下一字符要折行"。
    它必须如实给出 —— 把 pending 当成"还没到头"去算"这一行还剩几格可写",差一格就会
    把后续文本的落点算错。`visible` 是程序自己点的 `?25`(隐藏光标在 TUI 里很常见)。
    `include_screen=True` 时附 `screen`(整屏按行,行内空白保留、右侧空白裁掉),
    它是**屏幕**,不是缓冲 —— 与 `snapshot` 的 `total_lines` 对不上是正常的、也是对的。

    缓冲被挤掉(`dropped_chunks > 0`)时网格**仍然准确**:网格在输出入队那一刻就喂过了
    (见 `_push_output`),不依赖缓冲留存。
    """
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    if session.grid is None:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": "该会话没有屏幕网格(未启用 VT 记账)",
        }
    with session.lock:
        cur = session.grid.cursor()
        screen = session.grid.lines() if include_screen else None
    out: dict[str, Any] = {
        "ok": True,
        "terminal_id": terminal_id,
        "cols": cur["cols"],
        "rows": cur["rows"],
        "row": cur["row"],
        "col": cur["col"],
        "pending_wrap": cur["pending_wrap"],
        "visible": cur["visible"],
        "alt_screen": cur["alt_screen"],
        "line": cur["line"],
        "running": session.running(),
        "exit_code": session.proc.poll(),
        "dropped_chunks": session.dropped_chunks,
    }
    if screen is not None:
        out["screen"] = screen
        out["screen_lines"] = len(screen)
    return out


def links_terminal(
    terminal_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
    max_links: int = 20,
) -> dict[str, Any]:
    """回**这一屏上的超链接**(OSC 8):每条给出 `url` / `text` / `line_no` / `scheme`。

    为什么值得单列一个原语:超链接是"屏幕上可点的那一层",它与人读文本是两套东西 ——
    剥掉转义序列之后,`<https://…|点我>` 的对应关系就没了;而 CLI 程序(构建日志、
    `gh`、`ls --hyperlink`、现代 `grep`)越来越多地在输出里带 OSC 8。要在"点第 3 行那个链接"
    这件事上做自动化,就必须能把链接单独取出来。

    **安全立场(必须与 `text` 一起用)**:OSC 8 有一个众所周知的钓鱼面 —— 显示的字符与真实
    目标可以完全不同(写 `https://bank.com` 却链到别处是合法的 OSC 8)。所以本函数的回执
    **同时**给 `text` 与 `url`,让调用方/渲染方有机会把两者摆在一起核对;本模块**从不**代替
    调用方打开任何地址,也不过滤 `scheme`(它只如实汇报,拦不拦由上层决定)。

    `line_no` 与 `snapshot`/`search` 的行号是**同一个扫描器**算出来的(`_scan_face`),
    所以"链接在第 N 行"与"快照第 N 行"逐字对得上,不存在两套数法。
    去重口径 = `(url, text)`:全屏程序每帧重绘同一个链接,不去重会把一屏变成一整本书;
    这也意味着同一链接在屏幕不同行重复出现时只报**首次**那一行。
    """
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    try:
        cap = int(max_links)
    except (TypeError, ValueError):
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"max_links 必须是整数(实得 {max_links!r})",
        }
    cap = max(1, min(cap, MAX_LINKS))
    text, first_seq, dropped = _buffer_face(session)
    found = hyperlinks(text)
    shown = found[:cap]
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "links": shown,
        "count": len(shown),
        "total": len(found),
        "truncated": len(found) > len(shown),
        "first_seq": first_seq,
        "dropped_chunks": dropped,
        "running": session.running(),
        "exit_code": session.proc.poll(),
        "alt_screen": session.alt_screen,
        "title": session.title,
        "bell_count": session.bell_count,
    }


def _search_matcher(
    pattern: str, *, regex: bool, ignore_case: bool
) -> tuple[Callable[[str], str | None] | None, str]:
    """把 pattern 收敛成"在一段文本里找一次"的匹配函数,返回 (matcher, 错误原因)。

    **单行检索与整段等待共用这一份**(`_pattern_judge` 就是它的整段包装):两处各写一套
    "空/超长/正则语法"校验,必然在某一处漏掉一条拒法(§22c)。
    """
    if not pattern:
        return None, "pattern 不能为空"
    if len(pattern) > MAX_PATTERN_CHARS:
        return None, f"pattern 过长({len(pattern)} > {MAX_PATTERN_CHARS} 字符)"
    flags = re.IGNORECASE if ignore_case else 0
    if regex:
        try:
            compiled = re.compile(pattern, flags)
        except re.error as e:
            return None, f"正则语法无效: {e}"

        def match_regex(line: str) -> str | None:
            m = compiled.search(line)
            if m is None:
                return None
            # group(0) 可能很长(如 `(?s).*`),在这里就截断,不让信封随缓冲膨胀。
            return m.group(0)[:_MAX_MATCHED_TEXT]

        return match_regex, ""
    needle = pattern.casefold() if ignore_case else pattern

    def match_substr(line: str) -> str | None:
        hay = line.casefold() if ignore_case else line
        idx = hay.find(needle)
        if idx < 0:
            return None
        return line[idx : idx + len(pattern)]

    return match_substr, ""


def search_terminal(
    terminal_id: str,
    *,
    pattern: str,
    user_id: str | None,
    session_id: str | None,
    regex: bool = False,
    ignore_case: bool = False,
    max_matches: int = 20,
) -> dict[str, Any]:
    """在**归一后**的缓冲里按行检索(传统终端的 scrollback search)。

    与 `wait_terminal` 的分工:wait 是"等未来那一下出现",search 是"在**已经发生**的输出里找"
    —— TUI 程序把提示符刷在屏幕某处时,等不到新输出,只能回头搜。

    判定面是 `strip_ansi` 后的纯文本,所以带颜色的 `\\x1b[32mError\\x1b[0m` 也能按 `Error` 搜到;
    `line_no` 是该行在**整个归一缓冲**里的 1 基行号(不是本次窗口内的相对行号)。
    找不到不是错误:`matched=False` + `count=0`(空缓冲/越界/版式不符都是这条正常结论)。
    """
    matcher, err = _search_matcher(pattern, regex=regex, ignore_case=ignore_case)
    if matcher is None:
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_PATTERN",
            "error": err,
        }
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    try:
        cap = int(max_matches)
    except (TypeError, ValueError):
        return {
            "ok": False, "errorCode": "TERMINAL_INVALID_INPUT",
            "error": f"max_matches 必须是整数(实得 {max_matches!r})",
        }
    cap = max(1, min(cap, MAX_SEARCH_MATCHES))
    text, first_seq, dropped = _buffer_face(session)
    plain, _links = _scan_face(text)
    matches: list[dict[str, Any]] = []
    for idx, line in enumerate(_lines_of(plain), start=1):
        hit = matcher(line)
        if hit is None:
            continue
        if len(matches) >= cap:
            break
        matches.append({"line_no": idx, "text": line[:_MAX_SEARCH_LINE_CHARS], "match": hit})
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "pattern": pattern,
        "matched": bool(matches),
        "count": len(matches),
        "matches": matches,
        "truncated": len(matches) >= cap,
        "first_seq": first_seq,
        "dropped_chunks": dropped,
        "running": session.running(),
        "exit_code": session.proc.poll(),
        "title": session.title,
        "bell_count": session.bell_count,
        "alt_screen": session.alt_screen,
    }


def _pattern_judge(pattern: str, regex: bool) -> tuple[Callable[[str], tuple[bool, str]] | None, str]:
    """把 pattern 收敛成"在累积文本上找一次"的判定函数,返回 (judge, 错误原因)。

    固定子串与正则两种形态在 `_search_matcher` 里合成**一个出口**,等待循环里零分支
    (§22c:同一件事只许一份实现)。空 pattern / 超长 / 正则语法错都在**碰会话之前**拒,
    绝不喂给等待循环。
    """
    matcher, err = _search_matcher(pattern, regex=regex, ignore_case=False)
    if matcher is None:
        return None, err

    def judge(text: str) -> tuple[bool, str]:
        hit = matcher(text)
        return (hit is not None), (hit or "")

    return judge, ""


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
    plain: bool = False,
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

    `plain=True` 把判定面换成**归一文本**(`strip_ansi`):TUI 把一句话拆在几条颜色/光标序列
    之间时,按原文字节永远匹配不到,而屏上明明写着 —— 这种"看得见、等不到"的假超时是本参
    存在的唯一理由。回执里的 `chunks` 仍是**原文**,不因判定面换了视图而改写消费方读到的字节。
    """
    session = _live(terminal_id, user_id, session_id)
    if session is None:
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
    since = max(0, int(since_seq))
    deadline = started + max(0.0, min(float(timeout_s), MAX_WAIT_S))
    matched = False
    matched_text = ""
    reason = "timeout"
    while True:
        with session.lock:
            pending = [c for c in session.chunks if c["seq"] > since]
            running = session.running()
            next_seq = session.seq
            first_seq = int(session.chunks[0]["seq"]) if session.chunks else session.seq + 1
            dropped = session.dropped_chunks
            acc = "".join(str(c["text"]) for c in pending)
        # `plain=True` 的判定面是**归一文本**:TUI 把提示符拆在几条颜色序列之间时,
        # 原文按定义匹配不到,人眼却看得到 —— 那时该问"屏上写了什么",不是"字节怎么排"。
        hit, hit_text = judge(strip_ansi(acc) if plain else acc)
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
        **_history_gap(first_seq, dropped, since),
        "running": running,
        "exit_code": session.proc.poll(),
        "truncated": used >= max_chars and len(pending) > len(out),
        "waited_s": round(time.monotonic() - started, 3),
        "plain": plain,
    }


def _tty_interrupt(session: TerminalSession) -> tuple[bool, str]:
    """真终端里的 Ctrl+C = **写输入字节 0x03**,由行规程(规范模式)/程序(raw 模式)自己解释。

    这是 `interrupt` 在 PTY 后端上的**唯一出口**。为什么不能绕过 tty 直接 `send_signal`:
    子进程是 `setsid` 出来的会话首进程,**前台进程组**才是行规程送 SIGINT 的对象;直接给
    单个 pid 发信号会让"shell 里正在跑的前台命令"收不到(用户视角就是"按了 Ctrl+C 没停"),
    而 raw 模式里自己处理 `^C` 的程序(vim/less)则永远看不到这次按键。
    与 Windows ConPTY 同语义(那边也是往输入写 0x03),两平台只差"字节怎么送进子进程"。
    """
    sink = session.write_io
    if sink is None:
        return False, "本会话没有可写输入通道"
    try:
        sink.write(TTY_INTERRUPT_BYTE)
        sink.flush()
    except (OSError, ValueError) as e:
        return False, f"写入 ^C 字节失败: {e}"
    return True, ""


def signal_terminal(
    terminal_id: str,
    *,
    signal_name: str,
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    session = _live(terminal_id, user_id, session_id)
    if session is None:
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
            if session.backend == "pty":
                ok, why = _tty_interrupt(session)
                if not ok:
                    return {
                        "ok": False, "errorCode": "TERMINAL_SIGNAL_FAILED",
                        "error": why, "terminal": session.to_dict(),
                    }
                return {
                    "ok": True, "terminal_id": terminal_id, "signal": "interrupt",
                    "delivery": "tty-byte",
                    "running": proc.poll() is None,
                }
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
    session = _live(terminal_id, user_id, session_id)
    if session is None:
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
        # 网格跟着新尺寸走(不做 reflow:旧内容按新窗口裁切 —— 重排会把程序当年按
        # 80 列排的版改成另一种内容,那是另一件事,不该在"改尺寸"里偷偷发生)
        if session.grid is not None:
            session.grid.resize(cols_i, rows_i)
    return {"ok": True, "terminal_id": terminal_id, "cols": cols_i, "rows": rows_i}


def close_terminal(
    terminal_id: str, *, user_id: str | None, session_id: str | None
) -> dict[str, Any]:
    session = _live(terminal_id, user_id, session_id)
    if session is None:
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    proc = session.proc
    # 收尾阶梯:`terminate`(给程序体面收尾的机会)→ 超时 `kill` → 再等一个宽限。
    # 两件事必须如实回报:**升到 kill 了吗**(`forced`)**、kill 之后还活着吗**(`survived`)。
    # 不报这两项等于把"我发了信号"写成"进程死了" —— 后者要 `proc.poll()` 才知道(§0.3)。
    forced = False
    if proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=CLOSE_GRACE_S)
        except subprocess.TimeoutExpired:
            forced = True
            proc.kill()
            try:
                proc.wait(timeout=CLOSE_GRACE_S)
            except subprocess.TimeoutExpired:
                pass
        except OSError:
            pass
    exit_code = proc.poll()
    with _registry_lock:
        _sessions.pop(terminal_id, None)
    _close_io(session)  # 从注册表摘除后再关 IO:关 slave/写端以驱动 master 读线程收敛
    payload: dict[str, Any] = {
        "ok": True,
        "terminal_id": terminal_id,
        "closed": True,
        "exit_code": exit_code,
        "forced": forced,
        "survived": exit_code is None,
    }
    if exit_code is None:
        payload["warning"] = (
            f"已升级到 kill 但子进程在 {CLOSE_GRACE_S}s 内仍未退出(exit_code=None);"
            "会话已从注册表摘除,进程是否需要外部清理请按平台处理"
        )
    return payload


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
        # 管道"现在有没有可读字节"(管道路径的读端轮询用;只窥视不消费)。
        k32.PeekNamedPipe.argtypes = [
            ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong,
            ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong), ctypes.c_void_p,
        ]
        k32.PeekNamedPipe.restype = ctypes.c_int
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
        """`interrupt` 走行规程输入字节(`TTY_INTERRUPT_BYTE`);其余信号不经过这里。

        注:`signal_terminal` 现在**统一**在 PTY 分支调 `_tty_interrupt`(两平台同一出口),
        本方法保留只为满足 `_ProcLike` 协议形状;字节值仍取自同一常量(不另抄一份字面量)。
        """
        if sig == _WIN_CTRL_BREAK_EVENT and self.write_io is not None:
            self.write_io.write(TTY_INTERRUPT_BYTE)
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
    "history_gap": _history_gap,
    "pty_line_splitter": _PtyLineSplitter,
    "PTY_IDLE_FLUSH_S": PTY_IDLE_FLUSH_S,
    "reap_idle_terminals": reap_idle_terminals,
    "idle_ttl_s": _idle_ttl_s,
    "TERMINAL_IDLE_TTL_ENV": TERMINAL_IDLE_TTL_ENV,
    "tty_interrupt": _tty_interrupt,
    "TTY_INTERRUPT_BYTE": TTY_INTERRUPT_BYTE,
    "paste_terminal": paste_terminal,
    "snapshot_terminal": snapshot_terminal,
    "search_terminal": search_terminal,
    "strip_ansi": strip_ansi,
    "track_terminal_state": _track_terminal_state,
    "MAX_TITLE_CHARS": MAX_TITLE_CHARS,
    "buffer_lines": _buffer_lines,
    "TERMINAL_BUFFER_LINES_ENV": TERMINAL_BUFFER_LINES_ENV,
    "MAX_BUFFER_LINES_CEILING": MAX_BUFFER_LINES_CEILING,
    "MIN_BUFFER_LINES": MIN_BUFFER_LINES,
    "search_matcher": _search_matcher,
    "buffer_face": _buffer_face,
    "plain_lines": _plain_lines,
    "scan_face": _scan_face,
    "hyperlinks": hyperlinks,
    "links_terminal": links_terminal,
    "cursor_terminal": cursor_terminal,
    "Grid": Grid,
    "OSC_HYPERLINK_RE": _OSC_HYPERLINK_RE,
    "MAX_LINKS": MAX_LINKS,
    "MAX_LINK_TEXT_CHARS": MAX_LINK_TEXT_CHARS,
    "ANSI_ESCAPE_RE": ANSI_ESCAPE_RE,
    "MAX_SNAPSHOT_LINES": MAX_SNAPSHOT_LINES,
    "MAX_SEARCH_MATCHES": MAX_SEARCH_MATCHES,
    "BRACKETED_PASTE_ON": BRACKETED_PASTE_ON,
    "BRACKETED_PASTE_OFF": BRACKETED_PASTE_OFF,
    "BRACKETED_PASTE_START": BRACKETED_PASTE_START,
    "BRACKETED_PASTE_END": BRACKETED_PASTE_END,
    "MAX_PASTE_BYTES": MAX_PASTE_BYTES,
    "read_terminal": read_terminal,
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
    "mouse_terminal": mouse_terminal,
    "mouse_sequence": _mouse_sequence,
    "track_private_modes": _track_private_modes,
    "DEC_PRIVATE_MODE_RE": _DEC_PRIVATE_MODE_RE,
    "MOUSE_CLICK_MODE": MOUSE_CLICK_MODE,
    "MOUSE_DRAG_MODE": MOUSE_DRAG_MODE,
    "MOUSE_MOVE_MODE": MOUSE_MOVE_MODE,
    "MOUSE_SGR_ENCODING": MOUSE_SGR_ENCODING,
    "MOUSE_UTF8_ENCODING": MOUSE_UTF8_ENCODING,
    "MOUSE_URXVT_ENCODING": MOUSE_URXVT_ENCODING,
    "MOUSE_BUTTON_CODES": MOUSE_BUTTON_CODES,
    "MOUSE_MODIFIER_BITS": MOUSE_MODIFIER_BITS,
    "MOUSE_LEGACY_MAX_COORD": MOUSE_LEGACY_MAX_COORD,
    "MOUSE_MAX_COORD": MOUSE_MAX_COORD,
    "ALT_SCREEN_MODES": ALT_SCREEN_MODES,
    "push_output": _push_output,
    "APP_CURSOR_KEY_SEQUENCES": APP_CURSOR_KEY_SEQUENCES,
    "APP_CURSOR_MODE": APP_CURSOR_MODE,
    "focus_terminal": focus_terminal,
    "FOCUS_MODE": FOCUS_MODE,
    "FOCUS_IN_SEQUENCE": FOCUS_IN_SEQUENCE,
    "FOCUS_OUT_SEQUENCE": FOCUS_OUT_SEQUENCE,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

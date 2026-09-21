# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""命令安全分类器(2026-09-19 第二十一批,对标 Codex shell-command/command_safety)。

忠实移植 codex 的危险命令判定语义:
- dangerous_command_match: 主入口,返回 "forced_rm" / "other" / None
- 穿越层: sudo 直通 / env 跳过 VAR=val 与 -- / trap 把 action 当 sh -c 源 /
  bash|sh|zsh -c 脚本字面量命令逐段递归 / 嵌套深度上限 8(超限即 Other)
- rm force 检测: 参数重排容忍(--force 或组合旗标含 f,-- 之后的视为路径)
- Windows 专项: cmd /c 段切分(含 & 内嵌运算符)、del|erase /f、rd|rmdir /s /q、
  start|explorer|mshta|browser|rundll32 带 URL、PowerShell 删除 cmdlet -Force
取舍:codex 用 tree-sitter 解析 sh 脚本,我方用 shlex+运算符切分的最佳努力近似;
PowerShell 同为 shlex 近似(非完整解析器),与 codex 注释声明一致。
"""

from __future__ import annotations

import shlex
from urllib.parse import urlparse

MAX_WRAPPER_DEPTH = 8

_WINDOWS_EXE_SUFFIXES = (".exe", ".cmd", ".bat", ".com")
_CMD_SEPARATORS = {"&", "&&", "|", "||"}
_PS_DELETE_CMDLETS = {"remove-item", "ri", "rm", "del", "erase", "rd", "rmdir"}


def _host_platform() -> str:
    import sys

    return "windows" if sys.platform == "win32" else "posix"


def dangerous_command_match(
    command: list[str], platform: str | None = None
) -> str | None:
    """判定已分词命令是否危险;返回 "forced_rm"/"other"/None(安全)。"""
    return _match_with_depth(command, 0, platform or _host_platform())


def dangerous_powershell_words_match(
    words: list[str], platform: str | None = None
) -> str | None:
    """PowerShell 词序列的专项判定(仅 Windows 平台语义生效)。"""
    if (platform or _host_platform()) != "windows":
        return None
    return "other" if _ps_words_dangerous(words) else None


def _match_with_depth(command: list[str], depth: int, platform: str) -> str | None:
    if depth > MAX_WRAPPER_DEPTH:
        return "other"
    if not command:
        return None

    key = _executable_key(command[0], platform)
    if key is None:
        return None

    if platform == "windows":
        if _windows_dangerous(command):
            return "other"
        # Windows 下继续走 POSIX 通用规则(rm/强度旗标同样适用,如 Git Bash)
    if key == "rm" and _rm_args_include_force(command[1:]):
        return "forced_rm"
    if key == "sudo":
        return _match_with_depth(command[1:], depth + 1, platform)
    if key == "env":
        return _match_with_depth(command[_skip_env_prefix(command):], depth + 1, platform)
    if key == "trap":
        return _match_with_depth(_trap_action_command(command), depth + 1, platform)
    if key in {"sh", "bash", "zsh", "dash", "ksh"} and len(command) >= 3 and command[1] == "-c":
        # 脚本字面量:按运算符切分后逐段递归(树解析的最佳努力近似)
        for segment in _split_script_into_commands(command[2]):
            hit = _match_with_depth(segment, depth + 1, platform)
            if hit is not None:
                return hit
    return None


def _executable_key(raw: str, platform: str) -> str | None:
    """取可执行名归一键:POSIX 去路径;Windows 另去盘符/后缀并小写。"""
    name = raw.rsplit("\\", 1)[-1] if platform == "windows" else raw
    name = name.rsplit("/", 1)[-1]
    if not name:
        return None
    if platform == "windows":
        if len(name) >= 2 and name[1] == ":" and name[0].isascii() and name[0].isalpha():
            name = name[2:]
        name = name.lower()
        for suffix in _WINDOWS_EXE_SUFFIXES:
            if name.endswith(suffix):
                name = name[: -len(suffix)]
                break
    return name or None


def _rm_args_include_force(args: list[str]) -> bool:
    for arg in args:
        if arg == "--":
            break
        if arg == "--force" or (
            arg.startswith("-")
            and not arg.startswith("--")
            and "f" in arg[1:]
        ):
            return True
    return False


def _skip_env_prefix(command: list[str]) -> int:
    index = 1
    while index < len(command):
        arg = command[index]
        if arg == "--":
            return index + 1
        if arg in {"-i", "--ignore-environment"} or (
            "=" in arg and arg.split("=", 1)[0] and not arg.startswith("-")
        ):
            index += 1
            continue
        break
    return index


def _trap_action_command(command: list[str]) -> list[str]:
    """trap 的 action 参数本质是 shell 源码,按 sh -c 语义递归判定。"""
    index = 1
    if index < len(command) and command[index] == "--":
        index += 1
    action = command[index] if index < len(command) else None
    if action is None or action.startswith("-"):
        return []
    return ["sh", "-c", action]


def _split_script_into_commands(script: str) -> list[list[str]]:
    """把 sh 脚本切成字面量命令词列表(token 级分组,保留内层引号层级)。"""
    try:
        lexer = shlex.shlex(script, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = "#"
        tokens = list(lexer)
    except ValueError:
        tokens = script.split()
    commands: list[list[str]] = []
    current: list[str] = []
    for token in tokens:
        for part in _split_embedded_operators(token):
            if part in _CMD_SEPARATORS:
                if current:
                    commands.append(current)
                    current = []
            else:
                current.append(part)
    if current:
        commands.append(current)
    return commands


def _split_embedded_operators(token: str) -> list[str]:
    """切分内嵌 CMD 运算符: 'echo hi&del' -> ['echo hi', '&', 'del']。"""
    parts: list[str] = []
    start = 0
    index = 0
    while index < len(token):
        ch = token[index]
        if ch in {"&", "|"}:
            if index > start:
                parts.append(token[start:index])
            op_len = 2 if index + 1 < len(token) and token[index + 1] == ch else 1
            parts.append(token[index : index + op_len])
            index += op_len
            start = index
        else:
            index += 1
    if start < len(token):
        parts.append(token[start:])
    return [p for p in parts if p.strip()]


# ── Windows 专项(cmd / PowerShell / GUI 拉起) ────────────────────────────


def _windows_dangerous(command: list[str]) -> bool:
    if _ps_invocation_dangerous(command):
        return True
    if _cmd_dangerous(command):
        return True
    return _direct_gui_launch_dangerous(command)


def _ps_invocation_dangerous(command: list[str]) -> bool:
    if not command:
        return False
    if _executable_key(command[0], "windows") not in {"powershell", "pwsh"}:
        return False
    script = _extract_powershell_script(command[1:])
    if script is None:
        return False
    try:
        tokens = shlex.split(script)
    except ValueError:
        tokens = script.split()
    return _ps_words_dangerous(tokens)


def _extract_powershell_script(args: list[str]) -> str | None:
    index = 0
    while index < len(args):
        lower = args[index].lower()
        if lower in {"-command", "/command", "-c"}:
            if index + 2 != len(args):
                return None
            return args[index + 1]
        if lower.startswith(("-command:", "/command:")):
            if index + 1 != len(args):
                return None
            return args[index].split(":", 1)[1]
        if lower in {"-nologo", "-noprofile", "-noninteractive", "-mta", "-sta"}:
            index += 1
            continue
        return None
    return None


def _ps_words_dangerous(words: list[str]) -> bool:
    tokens_lc = [w.strip("'\"").lower() for w in words]
    has_url = _args_have_url(words)
    if has_url and any(
        t in {"start-process", "start", "saps", "invoke-item", "ii"}
        or "start-process" in t
        or "invoke-item" in t
        for t in tokens_lc
    ):
        return True
    if has_url and any("shellexecute" in t or "shell.application" in t for t in tokens_lc):
        return True
    first = tokens_lc[0] if tokens_lc else ""
    if first == "rundll32" and has_url and any(
        "url.dll,fileprotocolhandler" in t for t in tokens_lc
    ):
        return True
    if first == "mshta" and has_url:
        return True
    if first in _BROWSER_BASENAMES and has_url:
        return True
    if first in {"explorer"} and has_url:
        return True
    return _ps_has_force_delete(tokens_lc)


_BROWSER_BASENAMES = {"chrome", "msedge", "firefox", "iexplore"}


def _ps_has_force_delete(tokens_lc: list[str]) -> bool:
    """按段(硬分隔符切分)归组,-Force 必须与删除 cmdlet 同段。"""
    seg_seps = {";", "|", "&", "\n", "\r", "\t"}
    soft_seps = {"{", "}", "(", ")", "[", "]", ","}
    segments: list[list[str]] = [[]]
    for token in tokens_lc:
        cur = ""
        for ch in token:
            if ch in seg_seps:
                if cur.strip() and segments[-1] is not None:
                    segments[-1].append(cur.strip())
                cur = ""
                if segments[-1]:
                    segments.append([])
            else:
                cur += ch
        if cur.strip():
            segments[-1].append(cur.strip())
    return any(
        any(a in _PS_DELETE_CMDLETS for a in atoms)
        and any(a == "-force" or a.startswith("-force:") for a in atoms)
        for atoms in (
            [x for t in seg for x in _split_soft(t, soft_seps) if x] for seg in segments
        )
    )


def _split_soft(text: str, seps: set[str]) -> list[str]:
    out: list[str] = []
    cur = ""
    for ch in text:
        if ch in seps:
            if cur.strip():
                out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def _cmd_dangerous(command: list[str]) -> bool:
    if not command:
        return False
    if _executable_key(command[0], "windows") != "cmd":
        return False
    index = 1
    while index < len(command):
        lower = command[index].lower()
        if lower in {"/c", "/r", "-c"}:
            index += 1
            break
        if lower.startswith("/"):
            index += 1
            continue
        return False
    remaining = command[index:]
    if not remaining:
        return False
    if len(remaining) == 1:
        try:
            tokens = shlex.split(remaining[0])
        except ValueError:
            tokens = [remaining[0]]
    else:
        tokens = list(remaining)
    refined: list[str] = []
    for t in tokens:
        refined.extend(_split_embedded_operators(t))
    segments: list[list[str]] = [[]]
    for t in refined:
        if t in _CMD_SEPARATORS:
            segments.append([])
        else:
            segments[-1].append(t)
    for segment in segments:
        if not segment:
            continue
        cmd = segment[0].lower()
        args = segment[1:]
        if cmd == "start" and _args_have_url(segment):
            return True
        if cmd in {"del", "erase"} and any(a.lower() == "/f" for a in args):
            return True
        if cmd in {"rd", "rmdir"} and any(
            a.lower() == "/s" for a in args
        ) and any(a.lower() == "/q" for a in args):
            return True
    return False


def _direct_gui_launch_dangerous(command: list[str]) -> bool:
    if not command:
        return False
    base = _executable_key(command[0], "windows")
    rest = command[1:]
    has_url = _args_have_url(rest)
    if base in {"explorer"} and has_url:
        return True
    if base == "mshta" and has_url:
        return True
    if base == "rundll32" and has_url and any(
        "url.dll,fileprotocolhandler" in t.lower() for t in rest
    ):
        return True
    return base in _BROWSER_BASENAMES and has_url


def _args_have_url(args: list[str]) -> bool:
    return any(_looks_like_url(a) for a in args)


# strip 的多字符参数是「字符集合」语义(从两端逐字符剥离),并非剥离子串;
# 提取为常量以明确意图(空格/单双引号/圆括号/制表与换行控制符/分号)。
_URL_EDGE_CHARS = " '\"( \t\r\n;)"


def _looks_like_url(token: str) -> bool:
    lowered = token.lower()
    urlish = token
    for prefix in ("https://", "http://"):
        pos = lowered.find(prefix)
        if pos >= 0:
            urlish = token[pos:]
            break
    candidate = urlish.strip(_URL_EDGE_CHARS)
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)

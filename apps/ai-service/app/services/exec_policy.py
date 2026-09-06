# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令执行策略引擎(对标 Codex execpolicy)。

核心概念:
- ``PrefixRule``: 前缀规则,``pattern`` 为 token 列表,支持两种通配:
  - 单 token 通配: ``*`` / ``?`` / ``[...]`` 按 fnmatch 语义匹配一个 token;
  - 序列通配: ``...`` 匹配零个或多个任意 token(用于 ``curl ... | sh`` 类管道规则)。
- 裁决合成: 命令先解析为若干**原子命令**(POSIX 按 ``&& || ; &`` 拆命令、``|`` 拆
  管道段并保留整条管道作为复合原子,同时剥离 sudo/doas/env 前缀;PowerShell 按
  ``;``/换行拆命令、做 cmdlet 别名归一化并同样保留管道原子),每个原子独立做前缀
  匹配,最终取**最严格裁决**(deny > prompt > allow),同级别由**最长前缀**胜出。
- ``ExecPolicy.evaluate(command, shell) -> PolicyDecision``,
  ``PolicyDecision.to_explanation()`` 输出中文可解释裁决。
- 规则加载时做**遮蔽冲突检测**(``detect_shadows``):若规则 A 覆盖规则 B
  (命中 B 必命中 A)且 A 不比 B 宽松,则 B 永远不会影响裁决,记为
  ``ShadowWarning``,可通过 ``ExecPolicy.shadows`` 读取。

纯标准库实现,无全局可变状态,mypy --strict 通过。
"""

from __future__ import annotations

import re
import shlex
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import Enum
from fnmatch import fnmatchcase

__all__ = [
    "ANY_TOKEN",
    "Atom",
    "DEFAULT_DANGEROUS_RULES",
    "Decision",
    "ExecPolicy",
    "PolicyDecision",
    "PrefixRule",
    "RuleDecision",
    "RuleMatch",
    "ShadowWarning",
    "detect_shadows",
    "evaluate",
    "parse_command",
    "parse_powershell",
    "parse_posix",
    "prefix_rule",
]

# ---------------------------------------------------------------------------
# 裁决模型
# ---------------------------------------------------------------------------

_SEVERITY: dict[str, int] = {"allow": 0, "prompt": 1, "deny": 2}
_DECISION_LABEL_ZH: dict[str, str] = {"allow": "允许", "prompt": "需人工确认", "deny": "拒绝"}

# 序列通配 token:匹配零个或多个任意 token
ANY_TOKEN = "..."

_WILDCARD_CHARS = frozenset("*?[")


class Decision(str, Enum):
    """三态裁决,严重度排序 deny > prompt > allow。"""

    ALLOW = "allow"
    PROMPT = "prompt"
    DENY = "deny"

    @property
    def severity(self) -> int:
        """数值化严重度(allow=0 < prompt=1 < deny=2),用于取最严格者。"""
        return _SEVERITY[self.value]

    @property
    def label_zh(self) -> str:
        """中文标签,用于可解释裁决输出。"""
        return _DECISION_LABEL_ZH[self.value]


# 兼容别名:mcp_server 以 `RuleDecision.DENY` 形式引用裁决枚举
RuleDecision = Decision


def _has_wildcard(token: str) -> bool:
    return token != ANY_TOKEN and any(c in token for c in _WILDCARD_CHARS)


def _token_match(token: str, pattern_token: str) -> bool:
    """单 token 匹配:无通配符时精确相等,有通配符时按 fnmatch 语义。"""
    if _has_wildcard(pattern_token):
        return fnmatchcase(token, pattern_token)
    return token == pattern_token


def _match_pattern(pattern: tuple[str, ...], tokens: Sequence[str]) -> bool:
    """pattern 是否匹配 tokens 的前缀(``...`` 可吞任意长度)。"""
    return _match_from(pattern, tokens, 0, 0)


def _match_from(
    pattern: tuple[str, ...], tokens: Sequence[str], pi: int, ti: int
) -> bool:
    while pi < len(pattern):
        p = pattern[pi]
        if p == ANY_TOKEN:
            # 贪心回溯:尝试让 ... 吞掉 k 个 token
            return any(
                _match_from(pattern, tokens, pi + 1, k) for k in range(ti, len(tokens) + 1)
            )
            return False
        if ti >= len(tokens):
            return False
        if not _token_match(tokens[ti], p):
            return False
        pi += 1
        ti += 1
    return True  # pattern 耗尽即前缀命中,尾部多余 token 不影响


@dataclass(frozen=True)
class PrefixRule:
    """前缀规则:pattern 逐 token 前缀匹配原子命令。"""

    pattern: tuple[str, ...]
    decision: Decision
    reason: str = ""
    source: str = "custom"

    def __post_init__(self) -> None:
        if not self.pattern:
            raise ValueError("prefix_rule 的 pattern 不能为空")

    @property
    def display(self) -> str:
        """规则的可读形式(token 以空格拼接)。"""
        return " ".join(self.pattern)

    def matches(self, tokens: Sequence[str]) -> bool:
        """原子命令 tokens 是否命中本规则(pattern 为其前缀)。"""
        return _match_pattern(self.pattern, tokens)

    def covers(self, other: PrefixRule) -> bool:
        """保守判断:凡命中 other 的命令必命中 self(用于遮蔽检测)。

        规则: self 不更长;逐 token,双方均字面量须相等;self 通配而 other 字面量
        时 other 须匹配 self;字面量不覆盖通配符(通配符匹配面更广)。
        含 ``...`` 的规则仅与完全相同的规则互相覆盖(保守处理)。
        """
        if ANY_TOKEN in self.pattern or ANY_TOKEN in other.pattern:
            return self.pattern == other.pattern
        if len(self.pattern) > len(other.pattern):
            return False
        for a, b in zip(self.pattern, other.pattern, strict=False):
            a_wild, b_wild = _has_wildcard(a), _has_wildcard(b)
            if a_wild and not b_wild:
                if not fnmatchcase(b, a):
                    return False
            else:
                if a != b:
                    return False
        return True


def prefix_rule(
    pattern: Sequence[str],
    decision: Decision | str,
    reason: str = "",
    source: str = "custom",
) -> PrefixRule:
    """构造前缀规则(工厂函数)。decision 接受字符串并做合法性校验。"""
    if not pattern:
        raise ValueError("prefix_rule 的 pattern 不能为空")
    return PrefixRule(tuple(pattern), Decision(decision), reason, source)


# ---------------------------------------------------------------------------
# 内建默认危险命令规则集(POSIX + PowerShell)
# ---------------------------------------------------------------------------


def _builtin_rules() -> tuple[PrefixRule, ...]:
    rules: list[PrefixRule] = []
    add = rules.append

    # --- POSIX:拒绝级 ---
    deny_posix: list[tuple[tuple[str, ...], str]] = [
        (("rm", "-rf", "/"), "递归强制删除根文件系统"),
        (("rm", "-fr", "/"), "递归强制删除根文件系统"),
        (("rm", "-rf", "/*"), "递归强制删除根目录下内容"),
        (("rm", "-rf", "~"), "递归强制删除用户主目录"),
        (("rm", "--no-preserve-root"), "显式解除 rm 对根目录的保护"),
        (("mkfs*",), "格式化磁盘分区"),
        (("dd", "...", "of=/dev/*"), "直接写入裸块设备"),
        (("curl", "...", "|", "sh"), "远程脚本经管道直接交给 sh 执行"),
        (("curl", "...", "|", "bash"), "远程脚本经管道直接交给 bash 执行"),
        (("wget", "...", "|", "sh"), "远程脚本经管道直接交给 sh 执行"),
        (("wget", "...", "|", "bash"), "远程脚本经管道直接交给 bash 执行"),
        (("shutdown",), "关机"),
        (("reboot",), "重启系统"),
        (("halt",), "停机"),
        (("poweroff",), "断电关机"),
        (("chmod", "777", "/"), "放开根目录权限"),
        (("chmod", "-R", "777", "/"), "递归放开根目录权限"),
        (("chown", "-R", "/"), "递归变更根目录属主"),
        (("iptables", "-F"), "清空防火墙规则"),
        (("docker", "run", "--privileged"), "启动特权容器"),
        (("nc", "-e"), "netcat 反弹 shell"),
    ]
    for pattern, reason in deny_posix:
        add(prefix_rule(pattern, Decision.DENY, reason, source="builtin"))

    # --- POSIX:确认级 ---
    prompt_posix: list[tuple[tuple[str, ...], str]] = [
        (("sudo",), "特权提升"),
        (("doas",), "特权提升"),
        (("su",), "切换特权用户"),
        (("passwd",), "修改用户口令"),
        (("dd",), "磁盘读写工具,存在覆盖数据风险"),
        (("git", "push", "--force"), "强制推送覆盖远端历史"),
        (("git", "push", "-f"), "强制推送覆盖远端历史"),
        (("git", "push", "...", "--force"), "强制推送覆盖远端历史"),
        (("git", "push", "--force-with-lease"), "强制推送(带租约)改写远端历史"),
        (("git", "reset", "--hard"), "硬重置丢弃本地改动"),
        (("git", "clean", "-f"), "强制删除未跟踪文件"),
        (("sh", "-c"), "间接执行任意 shell 片段"),
        (("bash", "-c"), "间接执行任意 shell 片段"),
        (("eval",), "动态求值任意字符串"),
        (("killall",), "批量终止进程"),
        (("pkill",), "批量终止进程"),
        (("crontab", "-r"), "清空当前用户 crontab"),
        (("ufw", "disable"), "关闭防火墙"),
        (("history", "-c"), "清空命令历史"),
    ]
    for pattern, reason in prompt_posix:
        add(prefix_rule(pattern, Decision.PROMPT, reason))

    # --- PowerShell:拒绝级(别名已归一化,token 全小写) ---
    deny_ps: list[tuple[tuple[str, ...], str]] = [
        (("set-executionpolicy",), "降低脚本执行策略"),
        (("format-volume",), "格式化卷"),
        (("clear-disk",), "清空磁盘"),
        (("stop-computer",), "关闭远程/本地计算机"),
        (("invoke-webrequest", "...", "|", "invoke-expression"), "远程脚本经管道直接执行"),
        (("invoke-restmethod", "...", "|", "invoke-expression"), "远程脚本经管道直接执行"),
    ]
    for pattern, reason in deny_ps:
        add(prefix_rule(pattern, Decision.DENY, reason, source="builtin"))

    # --- PowerShell:确认级 ---
    prompt_ps: list[tuple[tuple[str, ...], str]] = [
        (("remove-item",), "删除文件/注册表项"),
        (("invoke-expression",), "动态执行任意表达式"),
        (("invoke-command",), "远程/脚本块执行"),
        (("invoke-webrequest",), "网络下载"),
        (("invoke-restmethod",), "网络下载"),
        (("stop-process",), "终止进程"),
        (("restart-computer",), "重启计算机"),
        (("certutil",), "Windows 下载/解码工具,常被滥用"),
        (("reg", "add"), "修改注册表"),
        (("regedit",), "导入注册表脚本"),
        (("new-scheduledtask",), "创建计划任务(持久化)"),
        (("register-scheduledtask",), "注册计划任务(持久化)"),
    ]
    for pattern, reason in prompt_ps:
        add(prefix_rule(pattern, Decision.PROMPT, reason))

    return tuple(rules)


DEFAULT_DANGEROUS_RULES: tuple[PrefixRule, ...] = _builtin_rules()

# ---------------------------------------------------------------------------
# 遮蔽冲突检测
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ShadowWarning:
    """一条遮蔽冲突:``rule`` 被 ``shadowed_by`` 遮蔽,永远不会影响裁决结果。"""

    rule: PrefixRule
    shadowed_by: PrefixRule
    message: str


def detect_shadows(rules: Sequence[PrefixRule]) -> tuple[ShadowWarning, ...]:
    """检测规则集内的遮蔽冲突。

    B 被 A 遮蔽当且仅当: A covers B(命中 B 必命中 A)且 A 不比 B 宽松
    (A 更严格;或同级但 A 先加载使 B 冗余)。
    """
    warnings: list[ShadowWarning] = []
    for i, a in enumerate(rules):
        for j, b in enumerate(rules):
            if i == j or not a.covers(b):
                continue
            if a.decision.severity > b.decision.severity:
                why = "更严格的前缀规则已覆盖它"
            elif a.decision.severity == b.decision.severity and i < j:
                why = "同级别前缀规则已先加载,本规则冗余"
            else:
                continue
            warnings.append(
                ShadowWarning(
                    rule=b,
                    shadowed_by=a,
                    message=(
                        f"规则 `{b.display}`({b.decision.label_zh})被规则 "
                        f"`{a.display}`({a.decision.label_zh})遮蔽:{why}。"
                    ),
                )
            )
    return tuple(warnings)


# ---------------------------------------------------------------------------
# 命令解析(POSIX / PowerShell)
# ---------------------------------------------------------------------------

_ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
# sudo/doas 需要吞掉下一个 token 作为参数的短选项(-u user 等)
_SUDO_OPT_WITH_ARG = frozenset({"-u", "-g", "-C", "-p", "-T", "-t"})

_PS_ALIAS: dict[str, str] = {
    "rm": "remove-item",
    "del": "remove-item",
    "erase": "remove-item",
    "rd": "remove-item",
    "rmdir": "remove-item",
    "ri": "remove-item",
    "dir": "get-childitem",
    "ls": "get-childitem",
    "gci": "get-childitem",
    "cd": "set-location",
    "sl": "set-location",
    "cat": "get-content",
    "type": "get-content",
    "gc": "get-content",
    "sc": "set-content",
    "sic": "set-content",
    "gps": "get-process",
    "ps": "get-process",
    "kill": "stop-process",
    "spps": "stop-process",
    "saps": "start-process",
    "curl": "invoke-webrequest",
    "wget": "invoke-webrequest",
    "iwr": "invoke-webrequest",
    "irm": "invoke-restmethod",
    "iex": "invoke-expression",
    "icm": "invoke-command",
    "echo": "write-output",
    "cls": "clear-host",
    "clear": "clear-host",
    "select": "select-object",
    "where": "where-object",
    "?": "where-object",
    "foreach": "for-each-object",
    "%": "for-each-object",
    "ni": "new-item",
    "mkdir": "new-item",
    "gcm": "get-command",
    "gm": "get-member",
    "sp": "set-itemproperty",
    "gp": "get-itemproperty",
    "sasv": "start-service",
    "gsv": "get-service",
}

_PS_OP_CHARS = ";&|\n\r"


@dataclass(frozen=True)
class Atom:
    """一条原子命令(已归一化/剥离特权前缀)。"""

    tokens: tuple[str, ...]
    fragment: str


def _classify_posix(token: str) -> str:
    """POSIX 控制操作符分类:pipe(管道)/ break(命令分隔)/ keep(普通 token)。

    纯 ``;&|`` 组成的任意 token(含畸形连写如 ``;;``)都视为分隔符;
    ``|`` / ``|&`` 为管道;``||`` 是短路或而非管道,归 break。
    """
    if token in ("|", "|&"):
        return "pipe"
    if token and set(token) <= set(";&|"):
        return "break"
    return "keep"


def _classify_powershell(token: str) -> str:
    """PowerShell 操作符分类(``&`` 是调用运算符而非分隔符,归 keep)。"""
    if set(token) <= {"|", "&"} and "|" in token:
        return "pipe"
    if set(token) <= {";", "\n", "\r", "&"} and token != "&":
        return "break"
    return "keep"


def _split_commands(
    tokens: Sequence[str], classify: Callable[[str], str]
) -> list[list[list[str]]]:
    """token 流 → 命令列表;每个命令是管道段列表(段内为该段 token)。"""
    commands: list[list[list[str]]] = []
    segments: list[list[str]] = [[]]
    for tok in tokens:
        kind = classify(tok)
        if kind == "pipe":
            segments.append([])
        elif kind == "break":
            commands.append(segments)
            segments = [[]]
        else:
            segments[-1].append(tok)
    commands.append(segments)
    return commands


def _fallback_tokenize_posix(command: str) -> list[str]:
    """未闭合引号等畸形输入的降级分词:引号视为空白,按空白+操作符粗切。

    宁可过度拆分(把引号内的 ; 也拆出来)也不漏掉藏在畸形引号后的危险命令。
    """
    rough = command.replace('"', " ").replace("'", " ")
    tokens: list[str] = []
    word: list[str] = []

    def flush() -> None:
        if word:
            tokens.append("".join(word))
            word.clear()

    i, n = 0, len(rough)
    while i < n:
        ch = rough[i]
        if ch in "()<>|&;":
            flush()
            j = i
            while j < n and rough[j] in "()<>|&;":
                j += 1
            tokens.append(rough[i:j])
            i = j
        elif ch.isspace():
            flush()
            i += 1
        else:
            word.append(ch)
            i += 1
    flush()
    return tokens


def _tokenize_posix(command: str) -> list[str]:
    """shlex 分词。

    shlex 默认 punctuation_chars='();<>|&' 不含 ``;``,这里显式补上,使 ``a;rm`` 无空格
    也能正确拆分为 ``a``/``;``/``rm``;引号内的 ;/| 因处于引用态不会被误拆。
    畸形输入(未闭合引号)降级到粗粒度分词,绝不抛异常。
    """
    punct = "();<>|&;"
    try:
        lex = shlex.shlex(command, posix=True, punctuation_chars=punct)
        lex.whitespace_split = True
        return list(lex)
    except ValueError:
        return _fallback_tokenize_posix(command)


def _strip_privilege_prefix(tokens: Sequence[str]) -> list[str]:
    """循环剥离 sudo/doas(含选项)、``NAME=value`` 赋值与 env 前缀。"""
    out = list(tokens)
    while out:
        head = out[0]
        if head in ("sudo", "doas"):
            out.pop(0)
            while out and out[0].startswith("-"):
                opt = out.pop(0)
                if opt in _SUDO_OPT_WITH_ARG and out and not out[0].startswith("-"):
                    out.pop(0)  # -u user 等带参选项,吞掉参数
                if opt == "--":
                    break
        elif _ENV_ASSIGN_RE.match(head):
            out.pop(0)
        elif head == "env":
            out.pop(0)
            while out and (out[0].startswith("-") or _ENV_ASSIGN_RE.match(out[0])):
                out.pop(0)
        else:
            break
    return out


def _normalize_posix(tokens: Sequence[str]) -> list[str]:
    return list(tokens)


def _normalize_powershell(tokens: Sequence[str]) -> list[str]:
    """PowerShell 大小写不敏感 + cmdlet 别名归一化(命令名与管道后 token)。"""
    out = [t.lower() for t in tokens]
    while out and out[0] in ("&", "."):
        out.pop(0)  # 调用运算符 & 与点源 .
    for i, tok in enumerate(out):
        if i == 0 or (i > 0 and out[i - 1] == "|"):
            out[i] = _PS_ALIAS.get(tok, tok)
    return out


def _collect_atoms(
    commands: Sequence[Sequence[Sequence[str]]],
    normalize: Callable[[Sequence[str]], list[str]],
) -> list[Atom]:
    """命令列表 → 原子列表:管道段各成原子,多段时整条管道也作为复合原子保留。"""
    atoms: list[Atom] = []
    seen: set[tuple[str, ...]] = set()

    def _emit(raw_tokens: Sequence[str]) -> None:
        def _add(tokens: Sequence[str]) -> None:
            key = tuple(normalize(tokens))
            if not key or key in seen:
                return
            seen.add(key)
            atoms.append(Atom(key, " ".join(key)))

        # 原始形态:让 sudo/doas/环境变量前缀自身也能命中规则(如 sudo → 需确认)
        _add(raw_tokens)
        # 剥离形态:确保藏在特权/环境变量前缀后的危险命令仍被识别(如 sudo rm -rf /)
        _add(_strip_privilege_prefix(raw_tokens))

    for segments in commands:
        non_empty = [seg for seg in segments if seg]
        if not non_empty:
            continue
        whole: list[str] = []
        for idx, seg in enumerate(non_empty):
            if idx > 0:
                whole.append("|")
            whole.extend(seg)
        if len(non_empty) > 1:
            _emit(whole)  # 管道复合原子:供 curl ... | sh 类跨管道规则命中
        for seg in non_empty:
            _emit(seg)
    return atoms


def parse_posix(command: str) -> list[Atom]:
    """解析 POSIX shell 命令为原子命令列表。"""
    tokens = _tokenize_posix(command)
    return _collect_atoms(_split_commands(tokens, _classify_posix), _normalize_posix)


def _tokenize_powershell(command: str) -> list[str]:
    """手写 PowerShell 分词器:支持 '' / "" 双写转义、反引号转义、未闭合引号容忍。"""
    tokens: list[str] = []
    word: list[str] = []
    i, n = 0, len(command)

    def flush() -> None:
        if word:
            tokens.append("".join(word))
            word.clear()

    while i < n:
        ch = command[i]
        if ch == "'":
            j = i + 1
            while j < n:
                if command[j] == "'":
                    if j + 1 < n and command[j + 1] == "'":
                        word.append("'")
                        j += 2
                        continue
                    break
                word.append(command[j])
                j += 1
            i = j + 1
        elif ch == '"':
            j = i + 1
            while j < n:
                c = command[j]
                if c == "`" and j + 1 < n:
                    word.append(command[j + 1])
                    j += 2
                    continue
                if c == '"':
                    if j + 1 < n and command[j + 1] == '"':
                        word.append('"')
                        j += 2
                        continue
                    break
                word.append(c)
                j += 1
            i = j + 1
        elif ch == "`" and i + 1 < n:
            word.append(command[i + 1])
            i += 2
        elif ch in _PS_OP_CHARS:
            flush()
            j = i
            while j < n and command[j] in _PS_OP_CHARS:
                j += 1
            tokens.append(command[i:j])
            i = j
        elif ch.isspace():
            flush()
            i += 1
        else:
            word.append(ch)
            i += 1
    flush()
    return tokens


def parse_powershell(command: str) -> list[Atom]:
    """解析 PowerShell 命令为原子命令列表(别名归一化后)。"""
    tokens = _tokenize_powershell(command)
    return _collect_atoms(
        _split_commands(tokens, _classify_powershell), _normalize_powershell
    )


_SHELL_ALIASES: dict[str, str] = {
    "posix": "posix",
    "sh": "posix",
    "bash": "posix",
    "zsh": "posix",
    "powershell": "powershell",
    "pwsh": "powershell",
    "ps": "powershell",
    "ps1": "powershell",
}


def parse_command(command: str, shell: str = "posix") -> list[Atom]:
    """按 shell 类型解析命令为原子列表。未知 shell 抛 ValueError。"""
    kind = _SHELL_ALIASES.get(shell.strip().lower())
    if kind is None:
        raise ValueError(f"不支持的 shell 类型: {shell!r}(可选: posix/sh/bash/zsh/powershell/pwsh)")
    return parse_posix(command) if kind == "posix" else parse_powershell(command)


# ---------------------------------------------------------------------------
# 裁决结果
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RuleMatch:
    """一次命中:原子命令片段 + 命中规则。"""

    atom: str
    rule: PrefixRule


@dataclass(frozen=True)
class PolicyDecision:
    """策略裁决结果。

    除核心字段外,另提供 ``action`` / ``matched_rules`` / ``risk_notes`` 兼容属性,
    供 mcp_server.run_command 以旧契约消费。
    """

    decision: Decision
    command: str
    shell: str
    atoms: tuple[str, ...]
    matches: tuple[RuleMatch, ...]
    winning_match: RuleMatch | None
    default_applied: bool

    @property
    def action(self) -> Decision:
        """兼容属性:裁决结果别名(mcp_server 旧契约)。"""
        return self.decision

    @property
    def matched_rules(self) -> tuple[PrefixRule, ...]:
        """兼容属性:全部命中规则,按严重度降序、同级最长前缀优先。"""
        ordered = sorted(
            self.matches,
            key=lambda m: (-m.rule.decision.severity, -len(m.rule.pattern)),
        )
        return tuple(m.rule for m in ordered)

    @property
    def risk_notes(self) -> tuple[str, ...]:
        """兼容属性:命中规则的风险说明列表(去重,保持顺序)。"""
        notes: list[str] = []
        for rule in self.matched_rules:
            if rule.reason and rule.reason not in notes:
                notes.append(rule.reason)
        return tuple(notes)

    def to_explanation(self) -> str:
        """生成中文可解释裁决文本。"""
        lines: list[str] = [f"【裁决】{self.decision.label_zh}({self.decision.value})"]
        lines.append(f"【命令】[{self.shell}] {self.command}")
        if self.atoms:
            lines.append(f"【原子命令】共 {len(self.atoms)} 条:" + "、".join(self.atoms))
        else:
            lines.append("【原子命令】未解析出可执行原子(空命令或畸形输入)")
        if self.matches:
            hit_lines = []
            for m in self.matches:
                reason = m.rule.reason or "无说明"
                hit_lines.append(
                    f"  - `{m.atom}` 命中规则 `{m.rule.display}`"
                    f"({m.rule.decision.label_zh}):{reason}"
                )
            lines.append("【命中规则】")
            lines.extend(hit_lines)
        if self.default_applied:
            lines.append(f"【依据】无任何规则命中,采用默认裁决 {self.decision.label_zh}。")
        elif self.winning_match is not None:
            w = self.winning_match
            lines.append(
                f"【依据】按「最严格裁决优先、同级最长前缀胜出」,"
                f"最终由规则 `{w.rule.display}`({w.rule.decision.label_zh})决定。"
            )
        if self.decision is Decision.DENY:
            lines.append("【结论】该命令被策略拒绝,禁止执行。")
        elif self.decision is Decision.PROMPT:
            lines.append("【结论】该命令需人工确认后方可执行。")
        else:
            lines.append("【结论】该命令允许执行。")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# 策略引擎
# ---------------------------------------------------------------------------


class ExecPolicy:
    """命令执行策略引擎。

    用法::

        policy = ExecPolicy()  # 载入内建危险命令规则集
        decision = policy.evaluate("sudo rm -rf /", shell="bash")
        if decision.decision is Decision.DENY:
            print(decision.to_explanation())
    """

    def __init__(
        self,
        rules: Sequence[PrefixRule] | None = None,
        *,
        include_defaults: bool = True,
        default_decision: Decision = Decision.ALLOW,
    ) -> None:
        base: list[PrefixRule] = list(DEFAULT_DANGEROUS_RULES) if include_defaults else []
        if rules is not None:
            base.extend(rules)
        self._rules: tuple[PrefixRule, ...] = tuple(base)
        self._default: Decision = default_decision
        # 加载时遮蔽冲突检测(不抛错,只记录,供调用方审查)
        self.shadows: tuple[ShadowWarning, ...] = detect_shadows(self._rules)

    @property
    def rules(self) -> tuple[PrefixRule, ...]:
        """当前生效的规则序列(内建在前,自定义在后)。"""
        return self._rules

    @property
    def default_decision(self) -> Decision:
        """无规则命中时的默认裁决。"""
        return self._default

    def match_atoms(self, atoms: Sequence[Atom]) -> list[RuleMatch]:
        """对原子列表逐条做规则匹配,返回全部命中(按规则加载顺序)。"""
        hits: list[RuleMatch] = []
        for atom in atoms:
            for rule in self._rules:
                if rule.matches(atom.tokens):
                    hits.append(RuleMatch(atom.fragment, rule))
        return hits

    def evaluate(self, command: str, shell: str = "posix") -> PolicyDecision:
        """评估命令,返回最严格裁决(各原子取最严格者,同级最长前缀胜出)。"""
        atoms = parse_command(command, shell)
        hits = self.match_atoms(atoms)
        winning: RuleMatch | None = None
        if hits:
            # 排序键:严重度最高 → pattern 最长 → 加载最早
            def _rank(m: RuleMatch) -> tuple[int, int, int]:
                return (m.rule.decision.severity, len(m.rule.pattern), -self._index_of(m.rule))

            winning = max(hits, key=_rank)
            decision = winning.rule.decision
            default_applied = False
        else:
            decision = self._default
            default_applied = True
        return PolicyDecision(
            decision=decision,
            command=command,
            shell=shell,
            atoms=tuple(a.fragment for a in atoms),
            matches=tuple(hits),
            winning_match=winning,
            default_applied=default_applied,
        )

    def _index_of(self, rule: PrefixRule) -> int:
        for idx, r in enumerate(self._rules):
            if r is rule:
                return idx
        return len(self._rules)


# ---------------------------------------------------------------------------
# 模块级便捷入口(兼容 mcp_server 旧契约:evaluate(command, cwd=...))
# ---------------------------------------------------------------------------

_PS_CMDLET_RE = re.compile(r"\b(?:Get|Set|New|Remove|Invoke|Write|Start|Stop|Clear)-[A-Za-z]")


def _detect_shell(command: str) -> str:
    """auto 模式的轻量 shell 启发式:出现 PowerShell cmdlet 动词形态即判 PowerShell。"""
    if _PS_CMDLET_RE.search(command):
        return "powershell"
    return "posix"


_default_policy = ExecPolicy()


def evaluate(command: str, shell: str = "auto", cwd: str | None = None) -> PolicyDecision:
    """用默认策略(内建危险命令规则集)评估命令。

    shell="auto" 时按启发式猜测 POSIX / PowerShell;``cwd`` 仅为兼容旧调用方
    接收,当前不参与前缀裁决(路径级策略由上层沙箱负责)。
    """
    resolved = _detect_shell(command) if shell.strip().lower() == "auto" else shell
    return _default_policy.evaluate(command, resolved)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

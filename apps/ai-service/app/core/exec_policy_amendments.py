# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/exec_policy_amendments.py
# -*- coding: utf-8 -*-
"""exec_policy_amendments.py — 逐语义移植 codex-rs 的 exec policy 追加（amend）能力。

对标文件与函数：
- execpolicy/src/amend.rs (全文 ~337 行)：
    * AmendError 各变体            -> 下方异常体系 (AmendError / EmptyPrefixError / ...)
    * blocking_append_allow_prefix_rule (amend.rs:65) -> append_allow_prefix_rule
    * blocking_append_network_rule      (amend.rs:85) -> append_network_rule
    * append_rule_line / append_locked_line (amend.rs:127/147) -> append_rule_line
- execpolicy/src/rule.rs:
    * normalize_network_rule_host (rule.rs:156) -> normalize_network_rule_host
    * NetworkRuleProtocol::as_policy_string (rule.rs:138) -> NetworkRuleProtocol.as_policy_string
- core/src/exec_policy.rs:57 BANNED_PREFIX_SUGGESTIONS -> BANNED_PREFIX_SUGGESTIONS
"""

from __future__ import annotations

import json
import os
from enum import StrEnum
from pathlib import Path
from typing import Any, Optional, Sequence

__all__ = [
    "AmendError",
    "EmptyPrefixError",
    "InvalidNetworkRuleError",
    "MissingParentError",
    "PolicyFileIOError",
    "NetworkRuleProtocol",
    "BANNED_PREFIX_SUGGESTIONS",
    "is_banned_prefix_suggestion",
    "normalize_network_rule_host",
    "format_allow_prefix_rule",
    "format_network_rule",
    "append_rule_line",
    "append_allow_prefix_rule",
    "append_network_rule",
]


# ===========================================================================
# A. BANNED_PREFIX_SUGGESTIONS（对标 core/src/exec_policy.rs:57，共 88 条）
#    逐条从源文件解析，顺序与条数保持一致；不要凭记忆改写。
# ===========================================================================
BANNED_PREFIX_SUGGESTIONS: tuple[tuple[str, ...], ...] = (
    ("/bin/bash",),
    ("/bin/bash", "-c",),
    ("/bin/bash", "-lc",),
    ("/bin/sh",),
    ("/bin/sh", "-c",),
    ("/bin/sh", "-lc",),
    ("/bin/zsh",),
    ("/bin/zsh", "-c",),
    ("/bin/zsh", "-lc",),
    ("Rscript",),
    ("bash",),
    ("bash", "-c",),
    ("bash", "-lc",),
    ("bun",),
    ("bun", "-e",),
    ("bun", "run",),
    ("cmd",),
    ("cmd", "/c",),
    ("cmd", "/k",),
    ("cmd.exe",),
    ("cmd.exe", "/c",),
    ("cmd.exe", "/k",),
    ("dash",),
    ("dash", "-c",),
    ("deno",),
    ("deno", "eval",),
    ("env",),
    ("fish",),
    ("fish", "-c",),
    ("git",),
    ("julia",),
    ("julia", "-e",),
    ("ksh",),
    ("ksh", "-c",),
    ("lua",),
    ("lua", "-e",),
    ("node",),
    ("node", "-e",),
    ("nodejs",),
    ("nodejs", "-e",),
    ("npm", "run",),
    ("osascript",),
    ("perl",),
    ("perl", "-e",),
    ("php",),
    ("php", "-r",),
    ("pnpm", "run",),
    ("powershell",),
    ("powershell", "-Command",),
    ("powershell", "-EncodedCommand",),
    ("powershell", "-File",),
    ("powershell", "-c",),
    ("powershell.exe",),
    ("powershell.exe", "-Command",),
    ("powershell.exe", "-EncodedCommand",),
    ("powershell.exe", "-File",),
    ("powershell.exe", "-c",),
    ("pwsh",),
    ("pwsh", "-Command",),
    ("pwsh", "-EncodedCommand",),
    ("pwsh", "-File",),
    ("pwsh", "-c",),
    ("pwsh", "-e",),
    ("pwsh", "-ec",),
    ("pwsh", "-f",),
    ("py",),
    ("py", "-3",),
    ("pypy",),
    ("pypy3",),
    ("python",),
    ("python", "-",),
    ("python", "-c",),
    ("python3",),
    ("python3", "-",),
    ("python3", "-c",),
    ("pythonw",),
    ("pyw",),
    ("rm",),
    ("ruby",),
    ("ruby", "-e",),
    ("sh",),
    ("sh", "-c",),
    ("sh", "-lc",),
    ("sudo",),
    ("yarn", "run",),
    ("zsh",),
    ("zsh", "-c",),
    ("zsh", "-lc",),
)


def is_banned_prefix_suggestion(prefix: Sequence[str]) -> bool:
    """对标 codex 对 BANNED_PREFIX_SUGGESTIONS 的判定：长度相等 且 逐元素相等。

    注意：这是「精确匹配」，不是前缀包含关系。只有 prefix 与某条建议
    长度相同且每个元素逐一相等时才返回 True。
    """
    prefix_tuple = tuple(prefix)
    return any(prefix_tuple == banned for banned in BANNED_PREFIX_SUGGESTIONS)


# ===========================================================================
# B. 异常体系（对标 execpolicy/src/amend.rs:14 AmendError 各变体的 #.error 文案）
# ===========================================================================
class AmendError(Exception):
    """对标 amend.rs:14 AmendError（基类）。"""


class EmptyPrefixError(AmendError):
    """对标 amend.rs:16/#[error] AmendError::EmptyPrefix。"""

    def __str__(self) -> str:
        return "prefix rule requires at least one token"


class InvalidNetworkRuleError(AmendError):
    """对标 amend.rs:18/#[error] AmendError::InvalidNetworkRule("{0}")。

    外层包装文案：'invalid network rule: {detail}'，其中 detail 来自
    normalize_network_rule_host 抛出的 'invalid rule: ...'（rule.rs/error.rs）。
    """

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail

    def __str__(self) -> str:
        return f"invalid network rule: {self.detail}"


class MissingParentError(AmendError):
    """对标 amend.rs:20/#[error] AmendError::MissingParent {{ path }}。"""

    def __init__(self, path: Path) -> None:
        self.path = path

    def __str__(self) -> str:
        return f"policy path has no parent: {self.path}"


class PolicyFileIOError(AmendError):
    """对标 amend.rs 的 IO 类变体（CreatePolicyDir/OpenPolicyFile/WritePolicyFile/
    LockPolicyFile/SeekPolicyFile/ReadPolicyFile/PolicyMetadata）。

    action 文案：create policy directory / open policy file / write to policy file /
    lock policy file / seek policy file / read policy file。
    """

    def __init__(self, action: str, path: Path, source: Exception) -> None:
        self.action = action
        self.path = path
        self.source = source

    def __str__(self) -> str:
        return f"failed to {self.action} {self.path}: {self.source}"


# ===========================================================================
# C. NetworkRuleProtocol（对标 execpolicy/src/rule.rs:117）
# ===========================================================================
class NetworkRuleProtocol(StrEnum):
    """对标 rule.rs:117 NetworkRuleProtocol。"""

    HTTP = "http"
    HTTPS = "https"
    SOCKS5_TCP = "socks5_tcp"
    SOCKS5_UDP = "socks5_udp"

    def as_policy_string(self) -> str:
        """对标 rule.rs:138 as_policy_string。"""
        return self.value


# ===========================================================================
# D. normalize_network_rule_host（对标 execpolicy/src/rule.rs:156）
#    内部异常文案逐字对齐 execpolicy/src/error.rs:32 Error::InvalidRule
#    (显示形态为 'invalid rule: {msg}')。
# ===========================================================================
class _NetworkRuleError(Exception):
    """内部错误：对标 error.rs:32 Error::InvalidRule（'invalid rule: {0}'）。"""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return f"invalid rule: {self.message}"


def _is_ascii_digit(value: str) -> bool:
    return all("0" <= c <= "9" for c in value)


def _ascii_lower(value: str) -> str:
    # 对标 Rust 的 to_ascii_lowercase：仅 ASCII 大写转小写，不触及非 ASCII 字符。
    return "".join(chr(ord(c) + 32) if "A" <= c <= "Z" else c for c in value)


def normalize_network_rule_host(raw: str) -> str:
    """对标 rule.rs:156 normalize_network_rule_host，判定顺序与文案逐字一致。"""
    host = raw.strip()
    if host == "":
        raise _NetworkRuleError("network_rule host cannot be empty")
    if "://" in host or "/" in host or "?" in host or "#" in host:
        raise _NetworkRuleError(
            "network_rule host must be a hostname or IP literal (without scheme or path)"
        )

    if host.startswith("["):
        stripped = host[1:]
        if "]" not in stripped:
            raise _NetworkRuleError(
                "network_rule host has an invalid bracketed IPv6 literal"
            )
        inside, rest = stripped.split("]", 1)
        # rest 为空，或 ':纯数字端口'
        port_ok = False
        if rest.startswith(":"):
            port = rest[1:]
            port_ok = port != "" and _is_ascii_digit(port)
        if rest != "" and not port_ok:
            raise _NetworkRuleError(
                f"network_rule host contains an unsupported suffix: {raw}"
            )
        host = inside
    elif host.count(":") == 1:
        candidate, port = host.rsplit(":", 1)
        if candidate != "" and port != "" and _is_ascii_digit(port):
            host = candidate

    normalized = _ascii_lower(host.rstrip(".").strip())
    if normalized == "":
        raise _NetworkRuleError("network_rule host cannot be empty")
    if "*" in normalized:
        raise _NetworkRuleError(
            "network_rule host must be a specific host; wildcards are not allowed"
        )
    if any(c.isspace() for c in normalized):
        raise _NetworkRuleError("network_rule host cannot contain whitespace")

    return normalized


# ===========================================================================
# E. 规则行格式化（对标 amend.rs:65 / amend.rs:85 的格式化部分）
# ===========================================================================
def format_allow_prefix_rule(prefix: Sequence[str]) -> str:
    """对标 amend.rs:65 blocking_append_allow_prefix_rule 的格式化部分。

    每个 token 用 json.dumps(tok, ensure_ascii=False) 转义（等价 serde_json::to_string），
    token 间以 ', ' 连接，外层方括号。空 prefix -> EmptyPrefixError。
    """
    if not prefix:
        raise EmptyPrefixError()
    tokens = [json.dumps(tok, ensure_ascii=False) for tok in prefix]
    pattern = "[" + ", ".join(tokens) + "]"
    return f'prefix_rule(pattern={pattern}, decision="allow")'


# decision 入参语义对齐 codex Decision：allow/prompt/forbidden，其中 forbidden 序列化为 deny。
_DECISION_MAPPING: dict[str, str] = {
    "allow": "allow",
    "prompt": "prompt",
    "forbidden": "deny",
}


def format_network_rule(
    host: str,
    protocol: NetworkRuleProtocol,
    decision: str,
    justification: Optional[str] = None,
) -> str:
    """对标 amend.rs:85 blocking_append_network_rule 的格式化部分。

    参数拼接顺序固定为 host -> protocol -> decision -> justification
    （justification 为 None 则整项省略）。
    """
    try:
        norm = normalize_network_rule_host(host)
    except _NetworkRuleError as exc:
        raise InvalidNetworkRuleError(str(exc)) from exc

    if justification is not None and justification.strip() == "":
        raise InvalidNetworkRuleError("justification cannot be empty")

    host_json = json.dumps(norm, ensure_ascii=False)
    protocol_json = json.dumps(protocol.as_policy_string(), ensure_ascii=False)
    decision_out = _DECISION_MAPPING.get(decision, decision)
    decision_json = json.dumps(decision_out, ensure_ascii=False)

    args = [
        f"host={host_json}",
        f"protocol={protocol_json}",
        f"decision={decision_json}",
    ]
    if justification is not None:
        justification_json = json.dumps(justification, ensure_ascii=False)
        args.append(f"justification={justification_json}")

    return "network_rule(" + ", ".join(args) + ")"


# ===========================================================================
# F. 追加落盘（对标 amend.rs:127 append_rule_line / amend.rs:147 append_locked_line）
# ===========================================================================
def _try_advisory_lock(handle: Any) -> None:
    """对标 amend.rs:157 file.lock()：建议性文件锁，拿不到也不阻断写入。

    POSIX 用 fcntl.flock；Windows 用 msvcrt.locking。两者都 try/except 兜底，
    失败时保留异常文案但不抛出（不阻断写入）。
    """
    try:
        if os.name == "posix":
            import fcntl

            flock = getattr(fcntl, "flock", None)
            if flock is not None:
                flock(handle.fileno(), getattr(fcntl, "LOCK_EX", 0))
        else:  # Windows
            import msvcrt

            locking = getattr(msvcrt, "locking", None)
            if locking is not None:
                locking(handle.fileno(), getattr(msvcrt, "LK_NBLCK", 0), 1)
    except (OSError, ImportError):
        # 建议性锁获取失败：保留失败信息但不阻断写入。
        pass


def append_rule_line(policy_path: Path, line: str) -> None:
    """对标 amend.rs:127 append_rule_line + amend.rs:147 append_locked_line。

    1) 取 parent；无 parent -> MissingParentError
    2) 创建父目录（已存在不算错）
    3) 以 append+read 打开（不存在则创建），加建议性锁
    4) 读全文；若已有任一行 == line 则幂等返回
    5) 全文非空且不以 '\n' 结尾 -> 先写一个 '\n'
    6) 写 line + '\n'
    """
    parent = policy_path.parent
    if parent is None:
        raise MissingParentError(policy_path)

    try:
        parent.mkdir(parents=True, exist_ok=True)
    except OSError as source:
        raise PolicyFileIOError("create policy directory", parent, source) from source

    try:
        handle = open(policy_path, "a+", encoding="utf-8", newline="")
    except OSError as source:
        raise PolicyFileIOError("open policy file", policy_path, source) from source

    try:
        _try_advisory_lock(handle)
        try:
            handle.seek(0)
        except OSError as source:
            raise PolicyFileIOError("seek policy file", policy_path, source) from source
        try:
            contents = handle.read()
        except OSError as source:
            raise PolicyFileIOError("read policy file", policy_path, source) from source

        if any(existing == line for existing in contents.splitlines()):
            return

        try:
            if contents != "" and not contents.endswith("\n"):
                handle.write("\n")
            handle.write(line + "\n")
        except OSError as source:
            raise PolicyFileIOError("write to policy file", policy_path, source) from source
    finally:
        handle.close()


def append_allow_prefix_rule(policy_path: Path, prefix: Sequence[str]) -> None:
    """对标 amend.rs:65 blocking_append_allow_prefix_rule。"""
    rule = format_allow_prefix_rule(prefix)
    append_rule_line(policy_path, rule)


def append_network_rule(
    policy_path: Path,
    host: str,
    protocol: NetworkRuleProtocol,
    decision: str,
    justification: Optional[str] = None,
) -> None:
    """对标 amend.rs:85 blocking_append_network_rule。"""
    rule = format_network_rule(host, protocol, decision, justification)
    append_rule_line(policy_path, rule)

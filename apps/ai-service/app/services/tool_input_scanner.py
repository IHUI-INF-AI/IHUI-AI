# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具入参危险模式静态探测 — 命令注入 / 路径穿越 / SSRF 回环 / 超长入参(2026-09-03 立)。

对标 Claude Code / Codex 对工具入参的静态安全扫描:在工具实际执行前,对入参
中所有字符串做启发式危险模式匹配,命中即打标(调用方可拒绝或继续,由策略决定)。
默认只读探测、不改写入参,命中不影响既有合法流程。

复用已有防护,不重复造轮子:
- 命令注入模式  ← 复用 services/sandbox._DANGEROUS_PATTERNS(与沙箱黑名单同源)
- SSRF 回环判断 ← 复用 services/network_guard.NetworkEgressPolicy._is_localhost

探测类别(按 flags 开关,默认全开):
    command_injection — shell 元字符 / 命令替换(; && || ` $() ${} rm|curl|wget 等)
    path_traversal    — .. 路径分段(含 Windows ..\\)
    ssrf_loopback     — URL 指向 localhost / 127.x / ::1 / 0.0.0.0 / 链路本地元数据 IP
    arg_too_long      — 单个入参超长(防资源耗尽)
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from .network_guard import NetworkEgressPolicy
from .sandbox import _DANGEROUS_PATTERNS

logger = logging.getLogger(__name__)

# 默认探测类别
DEFAULT_FLAGS = frozenset(
    {"command_injection", "path_traversal", "ssrf_loopback", "arg_too_long"}
)

# 默认单条入参长度上限(字符)
DEFAULT_MAX_ARG_LEN = 2000

# 路径穿越:.. 作为路径分段(含 ..\ 、/../)
_PATH_TRAVERSAL = re.compile(r"(?:^|[/\\])\.\.(?=[/\\]|$)")
# 绝对绝对路径逃逸辅助(leading ~/ 也常是越权信号,此处只报 .. 分段)
# 链路本地元数据/APIPA IP(云环境 SSRF 高危,如 169.254.169.254)
_LINK_LOCAL_METADATA = frozenset(
    {"169.254.169.254", "169.254.170.2", "fd00:ec2::254", "metadata.google.internal"}
)


@dataclass
class ScanFinding:
    """单条命中记录。kind 用稳定字符串供调用方结构化匹配。"""

    kind: str            # command_injection / path_traversal / ssrf_loopback / arg_too_long
    field: str           # 入参中的字段路径(如 "command" / "path.url")
    value: str           # 命中的原始值(截断展示)
    detail: str = ""


@dataclass
class ScanResult:
    """一次扫描结果。"""

    dangerous: bool
    findings: list[ScanFinding] = field(default_factory=list)
    tool_name: str = ""

    @property
    def kinds(self) -> set[str]:
        return {f.kind for f in self.findings}

    def with_findings(self) -> ScanResult:
        return self


def _iter_strings(data: Any, path: str = "") -> Iterable[tuple[str, str]]:
    """递归遍历入参对象(嵌套 dict/list),产出 (字段路径, 字符串值)。"""
    if isinstance(data, str):
        yield path, data
    elif isinstance(data, list):
        for i, item in enumerate(data):
            yield from _iter_strings(item, f"{path}[{i}]" if path else f"[{i}]")
    elif isinstance(data, dict):
        for k, v in data.items():
            # 键名不参与扫描(通常为字段名,非用户输入值)
            sub = f"{path}.{k}" if path else f"{k}"
            yield from _iter_strings(v, sub)


def _analyze(value: str, flags: frozenset[str], max_arg_len: int) -> list[tuple[str, str]]:
    """对单条字符串做各类探测,返回 [(kind, detail)] 列表。"""
    hits: list[tuple[str, str]] = []

    if "arg_too_long" in flags and len(value) > max_arg_len:
        hits.append(("arg_too_long", f"len={len(value)} > {max_arg_len}"))

    if "command_injection" in flags:
        for pat in _DANGEROUS_PATTERNS:
            if re.search(pat, value):
                hits.append(("command_injection", str(pat)))
                break  # 每条值只记第一个命令注入模式,避免噪音

    if "path_traversal" in flags and _PATH_TRAVERSAL.search(value):
        hits.append(("path_traversal", "dot-dot path segment"))

    if "ssrf_loopback" in flags and "://" in value:
        host = _extract_host(value)
        if host is not None and _is_forbidden_host(host):
            hits.append(("ssrf_loopback", f"host={host}"))

    return hits


def _extract_host(text: str) -> str | None:
    """从疑似 URL 中提取 hostname,非 URL 返回 None。"""
    # 去掉协议头与(可能的)凭据,再交由 urlparse 解析
    m = re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", text)
    if not m:
        return None
    try:
        parsed = urlparse(text)
        return parsed.hostname
    except ValueError:
        return None


def _is_forbidden_host(host: str) -> bool:
    """是否回环 / 本机 / 云元数据地址(SSRF 高危)。"""
    h = host.lower().rstrip(".").strip("[]")
    # 云元数据链路本地地址
    if h in _LINK_LOCAL_METADATA or h.startswith("169.254."):
        return True
    # 复用 network_guard 的回环判定(localhost / 127.x / ::1 / 0.0.0.0)
    return NetworkEgressPolicy()._is_localhost(h)


def scan_tool_args(
    args: Any,
    *,
    tool_name: str = "",
    flags: Iterable[str] | None = None,
    max_arg_len: int = DEFAULT_MAX_ARG_LEN,
) -> ScanResult:
    """扫描工具入参,返回命中集合与 dangerous 布尔。

    Args:
        args: 工具调用入参(dict / list / 标量均可)
        tool_name: 工具名(用于结果标注)
        flags: 启用的探测类别子集(默认全部)
        max_arg_len: 单条入参长度上限
    """
    active = frozenset(flags) if flags is not None else DEFAULT_FLAGS
    active = active & DEFAULT_FLAGS  # 只保留已知类别
    findings: list[ScanFinding] = []
    for field_path, value in _iter_strings(args):
        for kind, detail in _analyze(value, active, max_arg_len):
            findings.append(
                ScanFinding(
                    kind=kind,
                    field=field_path,
                    value=value[:60] + ("…" if len(value) > 60 else ""),
                    detail=detail,
                )
            )
    return ScanResult(dangerous=bool(findings), findings=findings, tool_name=tool_name)


def first_finding_kind(result: ScanResult) -> str | None:
    """取首个命中的类别(供调用方做统一拒绝决策)。无命中返回 None。"""
    if result.findings:
        return result.findings[0].kind
    return None

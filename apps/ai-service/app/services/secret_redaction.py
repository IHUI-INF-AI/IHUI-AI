# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""多类型分级凭据脱敏核心。

设计依据
--------
脱敏规则与字面量集合（按行为规格）::

    脱敏函数:
      "Bearer <redacted>", "$1=<redacted>",
      "<url-redacted>", "<path-redacted>", "<host-redacted>",
      "<opaque-redacted>", " [truncated]"
    属性处理: stripVTControlCharacters + 链式 replace()
    请求签名头识别集群: "REDACTED", "sig", "Signature",
      "AWSAccessKeyId", "X-Goog-Signature"

设计要点（本仓实现）
--------------------
1. **先剥 ANSI/VT 再脱敏**: 攻击者可用终端控制字符拆开敏感词绕过正则,
   因此脱敏前必须先 ``strip_vt`` 清洗。
2. **分级占位符**: 不同载体用不同占位符, 便于事后审计判断泄露面 ——
   token/url/path/host/opaque 各异, 而非一律 ``***``。
3. **签名头识别**: 独立给出需要整值脱敏的 HTTP 头集合（含 AWS/Google 请求签名）。
4. **纯函数**: 无 IO、无服务依赖、确定性; 同输入恒同输出, 便于单测钉住。

安全边界
--------
本模块只做**模式识别与占位替换**, 不存储、不回传任何真实凭据; 替换后的
占位符不含原始秘密的任何片段。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

__all__ = [
    "SENSITIVE_HEADER_NAMES",
    "RedactionLevel",
    "strip_vt",
    "redact_secrets",
    "redact_text",
    "is_sensitive_header",
]

# ---------------------------------------------------------------------------
# 请求签名 / 凭据头识别（整值脱敏）
# ---------------------------------------------------------------------------
# 取证: WorkBuddy 请求钩子集群实测字符串。规范化为小写无连字符比较。
SENSITIVE_HEADER_NAMES: frozenset[str] = frozenset(
    {
        "authorization",
        "proxy-authorization",
        "www-authenticate",
        "cookie",
        "set-cookie",
        "sig",
        "signature",
        "awsaccesskeyid",
        "x-amz-signature",
        "x-amz-credential",
        "x-amz-security-token",
        "x-goog-signature",
        "x-goog-api-key",
    }
)


def is_sensitive_header(name: str) -> bool:
    """判断 HTTP 头名是否需整值脱敏。大小写/连字符不敏感。"""
    if not name:
        return False
    norm = name.strip().lower().replace("_", "-")
    if norm in SENSITIVE_HEADER_NAMES:
        return True
    # 规范化: 去连字符再比一次, 覆盖 awsaccesskeyid 等无连字符形态
    return norm.replace("-", "") in {h.replace("-", "") for h in SENSITIVE_HEADER_NAMES}


# ---------------------------------------------------------------------------
# ANSI / VT 控制字符剥离（防绕过前置）
# ---------------------------------------------------------------------------
# CSI/OSC 序列 + 其余 C0/C1 控制字符。保留 \\t 与 \\n（日志可读性）。
_VT_PATTERN = re.compile(
    r"""
    \x1b\[[0-?]*[ -/]*[@-~]   # CSI  ...m / ...K 等
    | \x1b\][^\x07\x1b]*(?:\x07|\x1b\\)  # OSC ... BEL / ST
    | [\x00-\x08\x0b-\x1f\x7f-\x9f]       # 其余 C0/C1（保留 \\t=09 \\n=0a）
    """,
    re.VERBOSE,
)


def strip_vt(text: str) -> str:
    """剥离 ANSI/VT 控制字符, 保留制表符与换行。"""
    if not text:
        return text
    return _VT_PATTERN.sub("", text)


# ---------------------------------------------------------------------------
# 分级脱敏
# ---------------------------------------------------------------------------
class RedactionLevel:
    """占位符常量。分级载体各异, 便于审计判断泄露面。"""

    BEARER = "Bearer <redacted>"
    KEYVALUE = "$1=<redacted>"
    URL = "<url-redacted>"
    PATH = "<path-redacted>"
    HOST = "<host-redacted>"
    OPAQUE = "<opaque-redacted>"


@dataclass(frozen=True)
class _Rule:
    pattern: re.Pattern[str]
    placeholder: str


def _compile_rules() -> list[_Rule]:
    # 注意: 各规则 placeholder 内含 $, 用函数替换避免 re.sub 把 $1 当组引用。
    return [
        # Bearer / Token 头值: "Authorization: Bearer xxxx" / "Bearer <tok>"
        _Rule(
            re.compile(r"(?i)\b(bearer)\s+[A-Za-z0-9._~+/\-]+=*"),
            RedactionLevel.BEARER,
        ),
        # URL: scheme://host... 整段（先于 host/path, 整体优先）
        _Rule(
            re.compile(r"\b[a-z][a-z0-9+.\-]*://[^\s\"'<>]+", re.IGNORECASE),
            RedactionLevel.URL,
        ),
        # POSIX 路径: /开头且含路径段; 排除单独 "/"
        _Rule(
            re.compile(r"(?<![\w:])/(?:[\w.\-]+/)+[\w.\-]*"),
            RedactionLevel.PATH,
        ),
        # Windows 路径: 盘符:\...
        _Rule(
            re.compile(r"\b[A-Za-z]:\\(?:[^\\/:*?\"<>|\r\n]+\\?)+"),
            RedactionLevel.PATH,
        ),
        # Host: domain.tld (含子域), 需边界且后随 TLD
        _Rule(
            re.compile(
                r"\b(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b",
                re.IGNORECASE,
            ),
            RedactionLevel.HOST,
        ),
    ]


_RULES: list[_Rule] | None = None


def _rules() -> list[_Rule]:
    global _RULES
    if _RULES is None:
        _RULES = _compile_rules()
    return _RULES


# key=value 形态的敏感键（key 本身提示这是凭据）
_SENSITIVE_KV_KEYS = re.compile(
    r"(?i)\b(api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key|"
    r"private[_-]?key|client[_-]?secret|refresh[_-]?token|session[_-]?token|"
    r"auth|credential[s]?)\b"
)
# key=value 的值部分: 包含 key 名, 才能在替换函数里判断敏感键
_KV_VALUE = re.compile(
    r"""(\b\w[\w.\-]*\b\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;]+)"""
)

# 长串截断阈值
_TRUNCATE_LEN = 4096
_TRUNCATE_SUFFIX = " [truncated]"


def _sub_literal(match: re.Match[str], placeholder: str) -> str:
    del match
    return placeholder


def redact_text(text: str) -> str:
    """对单段文本做分级脱敏: 先剥 VT, 再按 token/url/path/host/kv 替换。

    返回不含任何原始凭据片段的字符串。确定性纯函数。
    """
    if not text:
        return text
    out = strip_vt(text)
    for rule in _rules():
        out = rule.pattern.sub(
            lambda m, ph=rule.placeholder: _sub_literal(m, ph), out
        )
    # key=value / key: value: 敏感键的值整段脱敏
    def _kv_repl(m: re.Match[str]) -> str:
        key_part = m.group(1)          # e.g. "api_key=" 或 "token : "
        value = m.group(2)
        key_name = re.split(r"[=:]", key_part, maxsplit=1)[0].strip()
        if _SENSITIVE_KV_KEYS.search(key_name):
            sep = "=" if "=" in key_part else ":"
            return f"{key_name}{sep} <redacted>"
        del value
        return m.group(0)

    out = _KV_VALUE.sub(_kv_repl, out)
    # 兜底 opaque: 疑似高熵长 token（>=32 连续 base64url 字符且未被上面命中）
    out = re.sub(
        r"\b[A-Za-z0-9_\-]{32,}\b", RedactionLevel.OPAQUE, out
    )
    # 知名前缀 API key（sk-... / sk-proj-... / ghp_... / AKIA...）整段脱敏
    out = re.sub(
        r"\b(?:sk|rk)-[A-Za-z0-9_\-]{6,}\b"
        r"|\bgh[pousr]_[A-Za-z0-9]{20,}\b"
        r"|\bAKIA[0-9A-Z]{12,}\b",
        RedactionLevel.OPAQUE,
        out,
    )
    # 长串截断
    if len(out) > _TRUNCATE_LEN:
        out = out[:_TRUNCATE_LEN] + _TRUNCATE_SUFFIX
    return out


def redact_secrets(text: str) -> str:
    """``redact_text`` 的显式别名, 语义化入口。"""
    return redact_text(text)

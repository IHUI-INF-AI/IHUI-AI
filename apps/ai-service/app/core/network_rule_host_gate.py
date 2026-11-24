# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""网络规则 host/protocol 建规则时验证 gate —— 遵循统一工程规范。

## 设计依据（2026-11-15，本轮 round 11 深潜）

对照物：``codex-command-runner.exe``（MSIX ``26.1111.2228.0``，Rust）。strings 定向抽取
命中 `network_rule` 建规则时的**六条 host 拒绝判据**（逐字）：

```
network_rule host cannot be empty
network_rule host cannot contain whitespace
network_rule host must be a specific host; wildcards are not allowed
network_rule host contains an unsupported suffix: <suffix>
network_rule host has an invalid bracketed IPv6 literal
network_rule host must be a hostname or IP literal (without scheme or path)
```

及协议枚举（逐字）：``network_rule protocol must be one of http, https, socks5_tcp, socks5_udp``。
``unsupported suffix`` 的具体值取证到 ``.localhost``（含去尾点 ``.localhost.`` 形态）。

## 它管什么 / 不管什么

* **管**：给定一条待保存的网络规则 ``{host, protocol}``，判断它**能不能合法建规则**。
  输出结构化 verdict：``accepted`` / ``rejected`` + 命中哪条 codex 错误。**纯函数验证层**。
* **不管**：规则保存后的审批流（``network_rule_amendments.py`` 射程）、host 归一化
  （``permission_profiles.normalize_host`` 射程）、真实代理转发/拦截。

## 与既有模块的分工（不重复造轮子）

``permission_profiles.normalize_host`` 是**归一化**（转换：剥端口/剥括号/去尾点/小写），
回答「这个 host 归一后长什么样」。本 gate 是**建规则时的拒绝判据**（验证：带通配符/带
非法 suffix/带 scheme 的 host 直接拒），回答「这个 host 能不能进规则表」。前者转换、
后者把关，互补不重复。

## 一轴超越

对照把校验埋在 Rust 引擎的 serde 反序列化层，错误只在**引擎加载规则那一刻**抛。本仓
把六条判据抽成**策略下发前**的纯函数 gate，结论可 diff、可单测、可在规则表写入前拦下
非法 host——且把「拒绝原因」结构化成 rule id + codex 错误锚，审计可追溯。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "NetworkRuleProtocol",
    "NetworkRuleValidation",
    "NetworkRuleVerdict",
    "CODEX_ERR_HOST_EMPTY",
    "CODEX_ERR_HOST_WHITESPACE",
    "CODEX_ERR_HOST_WILDCARD",
    "CODEX_ERR_HOST_UNSUPPORTED_SUFFIX",
    "CODEX_ERR_HOST_BAD_IPV6",
    "CODEX_ERR_HOST_NOT_HOSTNAME",
    "CODEX_ERR_PROTOCOL_INVALID",
    "REJECTED_SUFFIXES",
    "validate_network_rule",
    "validate_network_rule_host",
]

# ---------------------------------------------------------------------------
# 逐字错误锚（测试按常量断言，不手抄字符串）
# ---------------------------------------------------------------------------
CODEX_ERR_HOST_EMPTY = "network_rule host cannot be empty"
CODEX_ERR_HOST_WHITESPACE = "network_rule host cannot contain whitespace"
CODEX_ERR_HOST_WILDCARD = (
    "network_rule host must be a specific host; wildcards are not allowed"
)
CODEX_ERR_HOST_UNSUPPORTED_SUFFIX = (
    "network_rule host contains an unsupported suffix: "
)
CODEX_ERR_HOST_BAD_IPV6 = "network_rule host has an invalid bracketed IPv6 literal"
CODEX_ERR_HOST_NOT_HOSTNAME = (
    "network_rule host must be a hostname or IP literal (without scheme or path)"
)
CODEX_ERR_PROTOCOL_INVALID = (
    "network_rule protocol must be one of http, https, socks5_tcp, socks5_udp"
)

# 取证到的「unsupported suffix」拒绝列表（.localhost 含去尾点形态）
REJECTED_SUFFIXES: tuple[str, ...] = (".localhost", ".localhost.")

class NetworkRuleProtocol(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """网络规则协议枚举（遵循统一工程规范）。"""

    HTTP = "http"
    HTTPS = "https"
    SOCKS5_TCP = "socks5_tcp"
    SOCKS5_UDP = "socks5_udp"

    @classmethod
    def parse(cls, value: object) -> NetworkRuleProtocol | None:
        """解析协议（含别名），认不出返回 None（不回落默认值）。"""
        if not isinstance(value, str):
            return None
        key = value.strip().lower().replace("-", "_")
        aliases = {
            "http": cls.HTTP,
            "https": cls.HTTPS,
            "https_connect": cls.HTTPS,  # codex serde alias (approvals.rs:68)
            "http_connect": cls.HTTPS,  # codex serde alias "http-connect" 归一后形态
            "socks5_tcp": cls.SOCKS5_TCP,
            "socks5_udp": cls.SOCKS5_UDP,
            "socks5": cls.SOCKS5_TCP,
        }
        return aliases.get(key)


class NetworkRuleVerdict(str, Enum):  # noqa: UP042 — 同上
    """规则验证三态：ACCEPTED / REJECTED / UNDETERMINED。"""

    ACCEPTED = "accepted"
    REJECTED = "rejected"
    UNDETERMINED = "undetermined"


@dataclass(frozen=True)
class NetworkRuleValidation:
    """结构化结论：三态 + 命中的 codex 错误锚（rejected 时非空）+ 规则 id。"""

    state: NetworkRuleVerdict
    rule_id: str | None = None
    codex_error: str | None = None
    detail: str = ""


def _has_whitespace(host: str) -> bool:
    return any(ch.isspace() for ch in host)


def _has_wildcard(host: str) -> bool:
    return "*" in host or "?" in host


def _has_scheme_or_path(host: str) -> bool:
    """带 scheme（``://``）或 path（``/``）⇒ 不是裸 host。"""
    return "://" in host or "/" in host


def _bracketed_ipv6_invalid(host: str) -> bool:
    """``[...]`` 形态但括号内不是合法 IPv6 ⇒ invalid bracketed IPv6 literal。"""
    if not (host.startswith("[") and "]" in host):
        return False
    from ipaddress import ip_address

    inner = host[1 : host.index("]")]
    try:
        ip_address(inner)
    except ValueError:
        return True
    return False

# ---------------------------------------------------------------------------
# 核心验证：一条网络规则能否合法建规则（纯函数，遵循统一工程规范）
# ---------------------------------------------------------------------------

# 六条 host 判据的固定检查顺序（先拦语法非法，再拦语义非法）：
#   1 空值 → 2 空白 → 3 通配符 → 4 scheme/path → 5 非法 bracketed IPv6 →
#   6 unsupported suffix → ACCEPTED
# 与 codex serde 反序列化时的逐字段校验顺序对齐：让"更具体/更靠前"的错误优先暴露。


def validate_network_rule_host(host: object) -> NetworkRuleValidation:
    """校验单条 host 是否满足 codex network_rule 的六条建规则判据。

    六条判据（按行为规格 ``外部实现-command-runner.exe`` strings）：
      1. ``network_rule host cannot be empty``
      2. ``network_rule host cannot contain whitespace``
      3. ``network_rule host must be a specific host; wildcards are not allowed``
      4. ``network_rule host must be a hostname or IP literal (without scheme or path)``
      5. ``network_rule host has an invalid bracketed IPv6 literal``
      6. ``network_rule host contains an unsupported suffix: <suffix>``

    失效方向恒为「多要一次定向说明」：``host`` 不是字符串 ⇒ ``UNDETERMINED`` 点名
    原因（不冒充结论，§0.3「没判绝不写成判过」）。
    """
    if not isinstance(host, str):
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.UNDETERMINED,
            rule_id="network_rule.host",
            detail=f"未判定: host 不是字符串（got {type(host).__name__}）",
        )

    # 判据 1：空值
    if not host.strip():
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.REJECTED,
            rule_id="network_rule.host.empty",
            codex_error=CODEX_ERR_HOST_EMPTY,
        )

    # 判据 2：含空白（空格/tab/换行等任意 Unicode 空白）
    if _has_whitespace(host):
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.REJECTED,
            rule_id="network_rule.host.whitespace",
            codex_error=CODEX_ERR_HOST_WHITESPACE,
        )

    # 判据 3：通配符（codex 只接受 specific host，不接受 *.example.com 或 10.*.*.*）
    if _has_wildcard(host):
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.REJECTED,
            rule_id="network_rule.host.wildcard",
            codex_error=CODEX_ERR_HOST_WILDCARD,
        )

    # 判据 4：scheme / path（必须是裸 host，不能带 http:// 或 /path）
    if _has_scheme_or_path(host):
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.REJECTED,
            rule_id="network_rule.host.scheme_or_path",
            codex_error=CODEX_ERR_HOST_NOT_HOSTNAME,
        )

    # 判据 5：``[...]`` 形态但括号内不是合法 IPv6
    if _bracketed_ipv6_invalid(host):
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.REJECTED,
            rule_id="network_rule.host.bad_ipv6",
            codex_error=CODEX_ERR_HOST_BAD_IPV6,
        )

    # 判据 6：unsupported suffix（.localhost / .localhost.，含去尾点形态）
    lowered = host.lower()
    for suffix in REJECTED_SUFFIXES:
        if lowered.endswith(suffix):
            return NetworkRuleValidation(
                state=NetworkRuleVerdict.REJECTED,
                rule_id="network_rule.host.unsupported_suffix",
                codex_error=CODEX_ERR_HOST_UNSUPPORTED_SUFFIX + suffix,
                detail=f"命中拒绝后缀: {suffix}",
            )

    return NetworkRuleValidation(state=NetworkRuleVerdict.ACCEPTED)


def validate_network_rule(
    host: object, protocol: object
) -> NetworkRuleValidation:
    """校验一条完整网络规则 ``{host, protocol}`` 能否建规则。

    host 走 :func:`validate_network_rule_host` 的六条判据；protocol 走
    :class:`NetworkRuleProtocol` 四值枚举（含别名解析，认不出即拒）。

    检查顺序：**先 protocol 再 host**——protocol 是有限枚举、判据最便宜且最具体
    （codex 错误直接给出四值列表），host 有六条子判据较贵；先拦枚举能让调用方
    第一时间看到「协议写错了」而非淹没在 host 细节里。

    protocol 不是字符串 ⇒ ``UNDETERMINED``（不冒充结论）。
    """
    if not isinstance(protocol, str):
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.UNDETERMINED,
            rule_id="network_rule.protocol",
            detail=f"未判定: protocol 不是字符串（got {type(protocol).__name__}）",
        )

    parsed_proto = NetworkRuleProtocol.parse(protocol)
    if parsed_proto is None:
        return NetworkRuleValidation(
            state=NetworkRuleVerdict.REJECTED,
            rule_id="network_rule.protocol.invalid",
            codex_error=CODEX_ERR_PROTOCOL_INVALID + f" (got {protocol!r})",
        )

    host_result = validate_network_rule_host(host)
    if host_result.state is not NetworkRuleVerdict.ACCEPTED:
        # 透传 host 的 REJECTED / UNDETERMINED（保留其 rule_id 与 codex_error）
        return host_result

    return NetworkRuleValidation(
        state=NetworkRuleVerdict.ACCEPTED,
        rule_id="network_rule.ok",
        detail=f"host={host!r} protocol={parsed_proto.value!r} 可建规则",
    )

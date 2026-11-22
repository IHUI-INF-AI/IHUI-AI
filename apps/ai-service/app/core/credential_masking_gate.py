# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""凭据遮蔽（credential masking）前置门控 —— 遵循统一工程规范。

设计依据（2026-11-15，下潜 外部程序 主引擎 382MB）。对照物 外部程序（MSIX
26.1111.2228.0）内嵌 network-proxy crate，strings 定向抽取命中 credential masking 的
启用前置链 + 失败/降级原因（逐字，见下方 CODEX_ERR_* 常量）。功能开关：
features.network_proxy.credential_masking / credential_broker。

管：给定一次命令执行请求的运行环境（沙箱是否启用 / 执行器代理是否启用 / 代理模式 /
声明的 provider keys），判定凭据遮蔽能不能生效；不能时给出结构化降级原因（而非静默
放行明文凭据）。纯函数门控层。

不管：真实代理转发、dummy 凭据生成/注入算法、MITM TLS 终止、凭据存储（vault.py）、
日志脱敏（log_redaction / output_cleaning）。

与既有模块分工：log_redaction / output_cleaning.redact_secrets 是日志/输出层脱敏
（日志里怎么不漏）；本 gate 是执行前置层门控（子进程拿到真凭据还是 dummy、不能时为
什么降级）。层级不同互补。

一轴超越：对照把降级原因散在 unified_exec.rs / launch.rs 的运行时分支（命令快跑了才
提示将用未遮蔽凭据）。本仓把门控提前到执行下发前作为纯函数判据：结论可 diff、可单测、
可在审批/预检阶段拦下"看似遮蔽实则明文"的配置，每条降级带 codex 错误锚 + reason。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "MaskingVerdict",
    "MaskingDecision",
    "ProxyMode",
    "CODEX_ERR_SANDBOXING_DISABLED",
    "CODEX_ERR_PROXY_DISABLED",
    "CODEX_ERR_PLAINTEXT_UNSUPPORTED",
    "CODEX_ERR_BROKERAGE_UNIQUE_DUMMY",
    "CODEX_ERR_BROKERAGE_OVERLAP",
    "CODEX_ERR_CONFLICTING_PROVIDER_KEYS",
    "evaluate_credential_masking",
]

# 逐字错误锚（测试按常量断言，不手抄字符串）
CODEX_ERR_SANDBOXING_DISABLED = (
    "Credential masking is inactive because sandboxing is disabled. "
    "Commands will receive unmasked credentials."
)
CODEX_ERR_PROXY_DISABLED = (
    "Credential masking is inactive because the network proxy is disabled. "
    "Commands will receive unmasked credentials."
)
CODEX_ERR_PLAINTEXT_UNSUPPORTED = (
    "executor credential masking does not support plaintext injection, "
    "MITM hooks, or external CAs"
)
CODEX_ERR_BROKERAGE_UNIQUE_DUMMY = (
    "credential brokerage skipped: unable to generate a unique dummy credential"
)
CODEX_ERR_BROKERAGE_OVERLAP = (
    "credential brokerage skipped: credential overlaps an existing dummy"
)
CODEX_ERR_CONFLICTING_PROVIDER_KEYS = (
    "credential brokerage disabled because shell environment overrides "
    "contain conflicting case-insensitive provider keys"
)


class MaskingVerdict(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """遮蔽门控三态：ACTIVE（可遮蔽）/ INACTIVE（降级明文）/ UNDETERMINED。"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDETERMINED = "undetermined"


class ProxyMode(str, Enum):  # noqa: UP042 — 同上
    """执行器代理模式（对齐 execution_scope.rs 的代理形态枚举）。"""

    PLAINTEXT = "plaintext"  # 明文注入
    MITM_HOOK = "mitm_hook"  # MITM 钩子
    EXTERNAL_CA = "external_ca"  # 外部 CA
    MANAGED = "managed"  # 托管代理（唯一支持遮蔽的形态）


@dataclass(frozen=True)
class MaskingDecision:
    """结构化结论：三态 + 命中的 codex 错误锚（INACTIVE 时非空）+ 规则 id。"""

    state: MaskingVerdict
    rule_id: str | None = None
    codex_error: str | None = None
    detail: str = ""


def evaluate_credential_masking(
    *,
    sandbox_enabled: bool,
    proxy_enabled: bool,
    proxy_mode: ProxyMode | None,
    provider_keys: frozenset[str],
) -> MaskingDecision:
    """按 codex network-proxy 启用前置链判定本次执行能否启用凭据遮蔽。

    前置链（命中即短路的优先级）：

    1. 无沙箱 => INACTIVE，codex 明确不遮蔽（SANDBOXING_DISABLED）。
    2. 执行器代理未启用 => INACTIVE（PROXY_DISABLED）。
    3. 代理模式是明文注入/MITM 钩子/外部 CA => INACTIVE（PLAINTEXT_UNSUPPORTED）。
    4. 声明的 provider keys 存在大小写冲突 => INACTIVE（CONFLICTING_PROVIDER_KEYS）。
    5. 以上全过 => ACTIVE。
    """
    if not sandbox_enabled:
        return MaskingDecision(
            state=MaskingVerdict.INACTIVE,
            rule_id="sandboxing_disabled",
            codex_error=CODEX_ERR_SANDBOXING_DISABLED,
            detail="sandboxing disabled; commands would receive unmasked credentials",
        )
    if not proxy_enabled:
        return MaskingDecision(
            state=MaskingVerdict.INACTIVE,
            rule_id="proxy_disabled",
            codex_error=CODEX_ERR_PROXY_DISABLED,
            detail="executor network proxy disabled",
        )
    if proxy_mode is None:
        return MaskingDecision(
            state=MaskingVerdict.UNDETERMINED,
            rule_id="proxy_mode_missing",
            detail="proxy enabled but mode unset; masking applicability unknown",
        )
    if proxy_mode is not ProxyMode.MANAGED:
        return MaskingDecision(
            state=MaskingVerdict.INACTIVE,
            rule_id="plaintext_mode_unsupported",
            codex_error=CODEX_ERR_PLAINTEXT_UNSUPPORTED,
            detail=f"proxy_mode={proxy_mode.value} cannot carry masked credentials",
        )
    lowered: dict[str, str] = {}
    for key in provider_keys:
        low = key.lower()
        if low in lowered and lowered[low] != key:
            return MaskingDecision(
                state=MaskingVerdict.INACTIVE,
                rule_id="conflicting_provider_keys",
                codex_error=CODEX_ERR_CONFLICTING_PROVIDER_KEYS,
                detail=f"provider keys {lowered[low]} and {key} collide case-insensitively",
            )
        lowered[low] = key
    return MaskingDecision(
        state=MaskingVerdict.ACTIVE,
        rule_id="all_preconditions_met",
        detail="sandboxed managed-proxy execution with non-conflicting provider keys",
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱网络模式(离线范式)— 逆向复现自 Codex execpolicy 的 sandbox network-mode 三层设计。

## 证据来源(2026-11-15,源自 codex.exe 二进制字符串抽取)

逆向对象:`C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/codex.exe`
(382 MB PE,Rust 编译,_RDATA/.fptable/.eh_frame 段特征)

从二进制字符串抽取到三份 Starlark 配置的真源路径与默认值常量,逐条对应:

1. ``execpolicy/src/starlark/virtual/config/sandbox/starlark/network_mode_config.star``:
   默认值常量 ``DEFAULT_NETWORK_MODE = "ALLOWLIST"``、``OFFLINE_NETWORK_MODE = "BLOCKED"``。
2. ``execpolicy/src/starlark/virtual/config/sandbox/starlark/sandbox_network_mode.star``:
   符号 ``SandboxNetworkMode``,取值 BLOCKED / ALLOW_LOCALHOST / ALLOWLIST / UNRESTRICTED,
   属性 ``is_offline``。
3. ``execpolicy/src/starlark/virtual/config/sandbox/starlark/offline/config.star``:
   符号 ``SandboxConfigNetworkMode`` 与方法 ``validate_for_online_use() -> Result<(), Error>``。

## 范式与本仓现有 egress 的区别

本仓 ``apps/cli/src/sandbox/egress/`` 是**在线裁决**层:每个网络请求过 DNS 解析 →
规则匹配 → 放行/拒绝;``network_policy_decision.py`` 是**单请求拒绝**的文案层。

离线沙箱是**状态层**,高一阶:
- ``BLOCKED`` 模式下,WFP 栈级直接 BLOCK,TCP/UDP/DNS 查询直接报 "network unreachable",
  **不是** "connection refused by policy" —— 连裁决都不进,连 DNS 解析都不发;
- 这是内核态语义,与用户态规则表(本仓 builtin-rules.ts)正交;
- 复现的是**模式枚举 + 语义判定**,不是 WFP 驱动本身(Windows 平台实现由 proc_sandbox.py
  的 Job Object 体系承担;本模块只负责"当前沙箱处于何种网络模式"的纯规则)。

## 移植范围

- ``SandboxNetworkMode`` 四变体 + kebab-case 序列化名 + lowercase str 值;
- ``is_offline`` 属性:仅 BLOCKED 为真;
- ``requires_online()`` 方法:仅 ALLOWLIST 需要在线规则表(DNS + 域名裁决);
- ``validate_for_online_use()``:ALLOWLIST 且规则表为空时报错(不允许"在线模式但无规则");
- ``DEFAULT_NETWORK_MODE = "ALLOWLIST"`` / ``OFFLINE_NETWORK_MODE = "BLOCKED"`` 默认值常量。

判定跳过:WFP 驱动调用、DNS 钩子注入、进程级 filter attach/detach(平台执行层)。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

__all__ = [
    "SandboxNetworkMode",
    "DEFAULT_NETWORK_MODE",
    "OFFLINE_NETWORK_MODE",
    "NetworkModeValidationError",
]


class NetworkModeValidationError(Exception):
    """模式校验失败(对标 codex Result<(), Error>)。"""


class SandboxNetworkMode(StrEnum):
    """Codex SandboxNetworkMode 四变体。

    - ``BLOCKED``:WFP 栈级全 BLOCK,离线,连 DNS 都不解析;
    - ``ALLOW_LOCALHOST``:仅本机回环放行(localhost/127.0.0.1/::1);
    - ``ALLOWLIST``:按域名规则表放行,需要在线 DNS 裁决;
    - ``UNRESTRICTED``:全放行(仅 danger-full-access 沙箱允许)。
    """

    BLOCKED = "blocked"
    ALLOW_LOCALHOST = "allow_localhost"
    ALLOWLIST = "allowlist"
    UNRESTRICTED = "unrestricted"

    @classmethod
    def default(cls) -> "SandboxNetworkMode":
        """对标 network_mode_config.star 的 DEFAULT_NETWORK_MODE = ALLOWLIST。"""
        return cls.ALLOWLIST

    @classmethod
    def offline_default(cls) -> "SandboxNetworkMode":
        """对标 network_mode_config.star 的 OFFLINE_NETWORK_MODE = BLOCKED。"""
        return cls.BLOCKED

    @classmethod
    def from_str(cls, value: str | None) -> "SandboxNetworkMode":
        """解析模式字符串;未知值安全回落 default(不猜成 UNRESTRICTED)。"""
        if not value:
            return cls.default()
        normalized = value.strip().lower().replace("-", "_")
        for member in cls:
            if member.value == normalized:
                return member
        return cls.default()

    @property
    def is_offline(self) -> bool:
        """对标 sandbox_network_mode.star 的 is_offline:仅 BLOCKED 为真。"""
        return self is SandboxNetworkMode.BLOCKED

    def requires_online(self) -> bool:
        """是否需要在线规则表(DNS + 域名裁决)才能运作。

        仅 ALLOWLIST 需要在线规则;BLOCKED/ALLOW_LOCALHOST/UNRESTRICTED
        都不依赖外部域名表(BLOCKED 全拒、ALLOW_LOCALHOST 仅回环、UNRESTRICTED 全放)。
        """
        return self is SandboxNetworkMode.ALLOWLIST

    def validate_for_online_use(self, *, has_online_rules: bool) -> None:
        """对标 offline/config.star 的 validate_for_online_use -> Result<(), Error>。

        ALLOWLIST 模式但没有在线规则表时报错——这是"在线模式但零规则"的
        不一致状态:名义上要在线裁决,实际无表可查,只会 fall through 到
        default_decision,违反最小权限原则。BLOCKED/ALLOW_LOCALHOST/UNRESTRICTED
        三者不依赖规则表,恒通过。
        """
        if self is SandboxNetworkMode.ALLOWLIST and not has_online_rules:
            raise NetworkModeValidationError(
                "network_mode=ALLOWLIST requires a non-empty online rule table; "
                "switch to BLOCKED for offline sandboxes or provide rules"
            )


# Codex network_mode_config.star 的两个默认值常量,逐字对齐。
DEFAULT_NETWORK_MODE: SandboxNetworkMode = SandboxNetworkMode.ALLOWLIST
OFFLINE_NETWORK_MODE: SandboxNetworkMode = SandboxNetworkMode.BLOCKED


@dataclass(frozen=True)
class SandboxNetworkModeBinding:
    """沙箱运行时绑定:模式 + 规则表是否就绪,用于裁决前的快速短路。

    ``blocked_processes_can_skip_dns`` 是本仓对 Codex "WFP 栈级 BLOCK 连 DNS 都不发"
    这条语义的显式化:模式为 BLOCKED 时,调用方(egress 层)应在进入 DNS 解析**之前**
    直接短路返回 unreachable,而不是先解析再拒绝。
    """

    mode: SandboxNetworkMode = DEFAULT_NETWORK_MODE
    has_online_rules: bool = False

    def __post_init__(self) -> None:
        # 在线模式但零规则 = 配置错误,构造期即报(对标 validate_for_online_use)
        if self.mode.requires_online():
            self.mode.validate_for_online_use(has_online_rules=self.has_online_rules)

    @property
    def is_offline(self) -> bool:
        return self.mode.is_offline

    @property
    def blocked_processes_can_skip_dns(self) -> bool:
        """BLOCKED 模式下调用方应在 DNS 解析前短路;其他模式必须走正常裁决。"""
        return self.mode is SandboxNetworkMode.BLOCKED
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

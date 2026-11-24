# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""sandbox_network_mode 的纯函数判据（R11，独立实现 外部实现 SandboxNetworkMode）。

对齐证据：外部程序 382MB PE 内嵌三份 starlark 配置真源路径与默认值常量
（见 app/core/sandbox_network_mode.py 模块头注 + `内部规格`）。
本文件钉住：四变体枚举、is_offline 语义、requires_online、默认值常量、
from_str 安全回落、BLOCKED 短路、validate_for_online_use fail-closed。
"""

from __future__ import annotations

import pytest

from app.core.sandbox_network_mode import (
    DEFAULT_NETWORK_MODE,
    OFFLINE_NETWORK_MODE,
    NetworkModeValidationError,
    SandboxNetworkMode,
    SandboxNetworkModeBinding,
)


def test_default_and_offline_constants():
    """network_mode_config.star: DEFAULT=ALLOWLIST, OFFLINE=BLOCKED。"""
    assert DEFAULT_NETWORK_MODE is SandboxNetworkMode.ALLOWLIST
    assert OFFLINE_NETWORK_MODE is SandboxNetworkMode.BLOCKED
    assert SandboxNetworkMode.default() is SandboxNetworkMode.ALLOWLIST
    assert SandboxNetworkMode.offline_default() is SandboxNetworkMode.BLOCKED


def test_four_variants_kebab_serialization():
    """四变体 + Codex kebab-case 序列化名对齐。"""
    assert SandboxNetworkMode.BLOCKED.value == "blocked"
    assert SandboxNetworkMode.ALLOW_LOCALHOST.value == "allow_localhost"
    assert SandboxNetworkMode.ALLOWLIST.value == "allowlist"
    assert SandboxNetworkMode.UNRESTRICTED.value == "unrestricted"
    assert len(list(SandboxNetworkMode)) == 4


def test_is_offline_only_blocked():
    """sandbox_network_mode.star: 仅 BLOCKED 的 is_offline 为真。"""
    assert SandboxNetworkMode.BLOCKED.is_offline is True
    assert SandboxNetworkMode.ALLOW_LOCALHOST.is_offline is False
    assert SandboxNetworkMode.ALLOWLIST.is_offline is False
    assert SandboxNetworkMode.UNRESTRICTED.is_offline is False


def test_requires_online_only_allowlist():
    """仅 ALLOWLIST 需要在线规则表（DNS+域名裁决）。"""
    assert SandboxNetworkMode.ALLOWLIST.requires_online() is True
    assert SandboxNetworkMode.BLOCKED.requires_online() is False
    assert SandboxNetworkMode.ALLOW_LOCALHOST.requires_online() is False
    assert SandboxNetworkMode.UNRESTRICTED.requires_online() is False


def test_from_str_safe_fallback():
    """kebab/underscore/大写归一；未知值回落 default（绝不猜成 UNRESTRICTED）。"""
    assert SandboxNetworkMode.from_str("blocked") is SandboxNetworkMode.BLOCKED
    assert SandboxNetworkMode.from_str("ALLOW-LOCALHOST") is SandboxNetworkMode.ALLOW_LOCALHOST
    assert SandboxNetworkMode.from_str("allow_localhost") is SandboxNetworkMode.ALLOW_LOCALHOST
    assert SandboxNetworkMode.from_str(None) is SandboxNetworkMode.ALLOWLIST
    assert SandboxNetworkMode.from_str("") is SandboxNetworkMode.ALLOWLIST
    assert SandboxNetworkMode.from_str("nonsense-mode") is SandboxNetworkMode.ALLOWLIST
    # 安全默认：未知绝不猜成 UNRESTRICTED
    assert SandboxNetworkMode.from_str("nonsense-mode") is not SandboxNetworkMode.UNRESTRICTED


def test_blocked_binding_skips_dns():
    """BLOCKED 模式下调用方应在 DNS 解析前短路返回 unreachable。"""
    b = SandboxNetworkModeBinding(mode=SandboxNetworkMode.BLOCKED, has_online_rules=False)
    assert b.is_offline is True
    assert b.blocked_processes_can_skip_dns is True


def test_allowlist_without_rules_fails_closed():
    """validate_for_online_use: ALLOWLIST + 零规则表 = 配置错误，构造期即报。"""
    with pytest.raises(NetworkModeValidationError):
        SandboxNetworkModeBinding(mode=SandboxNetworkMode.ALLOWLIST, has_online_rules=False)


def test_allowlist_with_rules_and_unrestricted_pass():
    """ALLOWLIST 有规则通过；UNRESTRICTED 不依赖规则表恒通过。"""
    b = SandboxNetworkModeBinding(mode=SandboxNetworkMode.ALLOWLIST, has_online_rules=True)
    assert b.is_offline is False
    assert b.blocked_processes_can_skip_dns is False
    b2 = SandboxNetworkModeBinding(mode=SandboxNetworkMode.UNRESTRICTED, has_online_rules=False)
    assert b2.is_offline is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

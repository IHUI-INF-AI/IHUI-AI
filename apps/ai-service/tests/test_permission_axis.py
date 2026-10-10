# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""79 号票双轴注册表 Python 侧测试:成员/别名/预设/Legacy 映射/归一化,与 TS 侧同判据。"""

from app.core.permission_axis import (
    APPROVAL_POLICIES,
    APPROVAL_POLICY_ALIASES,
    APPROVAL_POLICY_DEFAULT,
    APPROVAL_PRESET_IDS,
    APPROVAL_PRESETS,
    GRANULAR_APPROVAL_KEYS,
    PERMISSION_MODE_TO_AXIS,
    SANDBOX_MODE_ALIASES,
    SANDBOX_MODE_DEFAULT,
    SANDBOX_MODES,
    normalize_approval_policy,
    normalize_sandbox_mode,
)
from app.core.permission_mode import PERMISSION_MODES


def test_two_axis_members_and_defaults():
    assert list(SANDBOX_MODES) == ["read-only", "workspace-write", "danger-full-access"]
    assert list(APPROVAL_POLICIES) == ["untrusted", "on-failure", "on-request", "never"]
    assert SANDBOX_MODE_DEFAULT == "read-only"
    assert APPROVAL_POLICY_DEFAULT == "on-request"


def test_alias_closure():
    for target in SANDBOX_MODE_ALIASES.values():
        assert target in SANDBOX_MODES
    for target in APPROVAL_POLICY_ALIASES.values():
        assert target in APPROVAL_POLICIES
    for m in SANDBOX_MODES:
        assert SANDBOX_MODE_ALIASES[m] == m
    for m in APPROVAL_POLICIES:
        assert APPROVAL_POLICY_ALIASES[m] == m


def test_normalize_fail_closed():
    assert normalize_sandbox_mode(" READ-ONLY ") == "read-only"
    assert normalize_sandbox_mode("readonly") == "read-only"
    assert normalize_sandbox_mode("unrestricted") is None
    assert normalize_sandbox_mode(42) is None
    assert normalize_sandbox_mode("") is None
    assert normalize_approval_policy("unless-trusted") == "untrusted"
    assert normalize_approval_policy("NEVER") == "never"
    assert normalize_approval_policy("always") is None


def test_codex_presets():
    assert list(APPROVAL_PRESET_IDS) == ["readOnly", "auto", "fullAccess"]
    assert APPROVAL_PRESETS["readOnly"] == ("read-only", "on-request")
    assert APPROVAL_PRESETS["auto"] == ("workspace-write", "on-request")
    assert APPROVAL_PRESETS["fullAccess"] == ("danger-full-access", "never")


def test_legacy_mapping_fail_closed():
    assert sorted(PERMISSION_MODE_TO_AXIS.keys()) == sorted(PERMISSION_MODES)
    assert PERMISSION_MODE_TO_AXIS["plan"] == ("read-only", "on-request")
    assert PERMISSION_MODE_TO_AXIS["default"] == ("workspace-write", "on-request")
    assert PERMISSION_MODE_TO_AXIS["bypassPermissions"] == ("danger-full-access", "never")
    # 伪造等价的防线:这两档的双轴表达不存在,必须保持 None
    assert PERMISSION_MODE_TO_AXIS["acceptEdits"] is None
    assert PERMISSION_MODE_TO_AXIS["manual"] is None


def test_granular_keys_not_members():
    assert list(GRANULAR_APPROVAL_KEYS) == [
        "sandbox_approval",
        "rules",
        "skill_approval",
        "request_permissions",
        "mcp_elicitations",
    ]
    for k in GRANULAR_APPROVAL_KEYS:
        assert k not in APPROVAL_POLICIES
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

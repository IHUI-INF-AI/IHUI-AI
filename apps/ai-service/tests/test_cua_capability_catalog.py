# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""cua_capability_catalog 判据钉(复现 Codex "能力即数据" 运行时自描述)。

钉住:CUA 能力面全集逐项对齐取证、按级筛选、id 查找、灌进通用 registry 后
get/list 可用、每条能力带实现指针(不写空承诺)。零 IO。
"""

from app.services.capability_registry import CapabilityRegistry
from app.services.cua_capability_catalog import (
    CUA_CAPABILITIES,
    build_cua_registry,
    describe_namespace,
    find_capability,
)


def test_capability_set_matches_evidence():
    """CUA 能力面 = Codex 26.1111 已取证 7 条,逐项对齐不私自增删。"""
    ids = {c.id for c in CUA_CAPABILITIES}
    assert ids == {
        "browser.management",
        "browser.visibility",
        "tab.botDetection",
        "browser.proofOfWork",
        "browser.cdp",
        "tab.elementSnapshot",
        "tab.interaction",
    }


def test_describe_namespace_splits_levels():
    """按 browser/tab 级筛选能力面。"""
    browser_caps = describe_namespace("browser")
    tab_caps = describe_namespace("tab")
    assert {c.id for c in browser_caps} == {
        "browser.management",
        "browser.visibility",
        "browser.proofOfWork",
        "browser.cdp",
    }
    assert {c.id for c in tab_caps} == {
        "tab.botDetection",
        "tab.elementSnapshot",
        "tab.interaction",
    }


def test_find_capability_hit_and_miss():
    """find 命中返回能力;缺失返回 None(不抛)。"""
    hit = find_capability("tab.botDetection")
    assert hit is not None
    assert "hostname" in " ".join(hit.boundaries)  # hostname-only 隐私边界在案
    assert find_capability("nope.nope") is None


def test_bot_detection_boundaries_preserved():
    """botDetection 的 7 reason + hostname-only + 裸状态码排除边界逐条在案。"""
    cap = find_capability("tab.botDetection")
    assert cap is not None
    assert cap.implementation.endswith("browser_bot_detection")
    assert cap.methods == ("report",)


def test_build_registry_integrates_with_generic():
    """CUA 能力面灌进通用 CapabilityRegistry,get/list/ids 可用。"""
    reg = build_cua_registry()
    assert isinstance(reg, CapabilityRegistry)
    assert len(reg) == len(CUA_CAPABILITIES)
    hit = reg.get("browser.visibility")
    assert hit is not None
    assert "[browser]" in hit.description
    assert "browser.visibility" in reg.ids()


def test_every_capability_has_implementation_pointer():
    """每条能力带实现指针 —— 不写跑不通的空承诺(能力目录↔实际实现对得上)。"""
    for cap in CUA_CAPABILITIES:
        assert cap.implementation, f"{cap.id} 缺实现指针"
        assert cap.implementation.startswith("app.services.")


def test_management_boundaries_include_injection_defense():
    """management 的 prompt-injection 防线 + 共享组保护 + 二次确认边界在案。"""
    cap = find_capability("browser.management")
    assert cap is not None
    joined = " ".join(cap.boundaries)
    assert "共享 tab group" in joined
    assert "二次确认" in joined
    assert "不可信数据" in joined

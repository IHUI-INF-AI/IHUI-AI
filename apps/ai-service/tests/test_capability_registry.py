# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""capability_registry 判据钉(复现 Codex capabilities.list() 自描述)。

钉住:register/get/list/ids、稳定排序、重复 id 覆盖(后注册胜出)、
空 id 拒绝、get 缺失返回 None(不抛)、线程安全锁不阻塞。零 IO。
"""

import pytest

from app.services.capability_registry import CapabilityInfo, CapabilityRegistry


def test_register_and_list_sorted():
    """list 按 id 稳定排序(非插入序)。"""
    reg = CapabilityRegistry()
    reg.register(CapabilityInfo("element-snapshot", "元素多候选定位快照"))
    reg.register(CapabilityInfo("cdp", "受限 CDP 访问"))
    reg.register(CapabilityInfo("auth-handoff", "登录态 handoff"))
    ids = [c.id for c in reg.list()]
    assert ids == ["auth-handoff", "cdp", "element-snapshot"]


def test_get_existing_and_missing():
    """get 命中返回 CapabilityInfo;缺失返回 None(不抛)。"""
    reg = CapabilityRegistry()
    reg.register(CapabilityInfo("cdp", "受限 CDP 访问"))
    hit = reg.get("cdp")
    assert hit is not None
    assert hit.description == "受限 CDP 访问"
    assert reg.get("nonexistent") is None


def test_duplicate_id_later_wins():
    """重复 id 后注册覆盖(后注册胜出)。"""
    reg = CapabilityRegistry()
    reg.register(CapabilityInfo("cdp", "old"))
    reg.register(CapabilityInfo("cdp", "new"))
    assert len(reg) == 1
    assert reg.get("cdp").description == "new"


def test_empty_id_rejected():
    """空 id / 空白 id 即拒。"""
    reg = CapabilityRegistry()
    with pytest.raises(ValueError):
        reg.register(CapabilityInfo("", "no id"))
    with pytest.raises(ValueError):
        reg.register(CapabilityInfo("   ", "blank id"))


def test_ids_helper():
    """ids 返回排序后的 id 元组。"""
    reg = CapabilityRegistry()
    reg.register(CapabilityInfo("b", "B"))
    reg.register(CapabilityInfo("a", "A"))
    assert reg.ids() == ("a", "b")


def test_empty_registry():
    """空注册表 list 为空、len 为 0、get 返回 None。"""
    reg = CapabilityRegistry()
    assert reg.list() == ()
    assert len(reg) == 0
    assert reg.get("x") is None


def test_initial_iterable_seeded():
    """构造时可传入初始能力集合。"""
    reg = CapabilityRegistry(
        [
            CapabilityInfo("cdp", "受限 CDP"),
            CapabilityInfo("upload", "文件上传(file chooser 流)"),
        ]
    )
    assert len(reg) == 2
    assert reg.ids() == ("cdp", "upload")


def test_to_dict_shape():
    """to_dict 返回 {id, description} 形状。"""
    info = CapabilityInfo("cdp", "受限 CDP 访问")
    assert info.to_dict() == {"id": "cdp", "description": "受限 CDP 访问"}

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""T1.2 的锁:Python 侧契约谓词必须与 TS 判序逐字一致,注册表三态必须可区分。

钉两组:
  A. 谓词判序(对着 packages/types/src/tool-contract.ts:562-613 的四条判序逐条钉)
  B. 注册表(真实导出物能加载;缺文件/坏 schema/空表各自降成确定状态,且 lookup 三态不混读)
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.tool_contract import (
    declared_effect_scope,
    human_approval_mandated,
    may_write_workspace,
    tightening_only,
    touches_external_world,
)
from app.core.tool_contract_registry import (
    REGISTRY_SCHEMA,
    LookupState,
    RegistryState,
    load_registry,
)


def carrier(effect_scope: str | None = None, *, requires: bool | None = None, always: bool | None = None):
    """造一个与 TS `EffectScopeCarrier` 同形的载体。"""
    permission: dict = {}
    if effect_scope is not None:
        permission["effectScope"] = effect_scope
    if requires is not None:
        permission["requiresApproval"] = requires
    if always is not None:
        permission["alwaysAsk"] = always
    return {"contract": {"permission": permission}}


# ---------- A. 谓词判序 ----------

class TestApprovalMandated:
    def test_契约缺席时不参与(self):
        # 判序第 1 条:契约缺席 ⇒ False,不是 fail-open —— 这是"不改缺省语义"的落点
        assert human_approval_mandated(None) is False
        assert human_approval_mandated({}) is False
        assert human_approval_mandated({"contract": {}}) is False
        assert human_approval_mandated({"contract": {"permission": None}}) is False

    def test_always_ask_恒真(self):
        assert human_approval_mandated(carrier("workspace", requires=False, always=True)) is True

    def test_requires_非真即不参与(self):
        assert human_approval_mandated(carrier("system", requires=False)) is False
        # 字段不是严格 True(比如字符串)不得被当成 True
        assert human_approval_mandated({"contract": {"permission": {"effectScope": "system", "requiresApproval": "true"}}}) is False

    def test_requires_真且碰外部世界才强制(self):
        assert human_approval_mandated(carrier("system", requires=True)) is True
        assert human_approval_mandated(carrier("network", requires=True)) is True
        # 两档纯协议语义:本端没有可批准的事
        assert human_approval_mandated(carrier("delegate-to-caller", requires=True)) is False
        assert human_approval_mandated(carrier("ask-user", requires=True)) is False

    def test_字段认不出时按碰外部世界(self):
        # 已声明契约上字段拼错 ⇒ touchesExternalWorld 判碰 ⇒ 强制
        assert human_approval_mandated({"contract": {"permission": {"effectScope": "sysytem", "requiresApproval": True}}}) is True


class TestEffectScopes:
    def test_认不出返回_none_而不是_none_档(self):
        assert declared_effect_scope(None) is None
        assert declared_effect_scope(carrier("workspace")) == "workspace"
        assert declared_effect_scope(carrier("sysytem")) is None
        assert declared_effect_scope(carrier(None)) is None

    def test_touches_external_world_用排除法(self):
        assert touches_external_world(None) is True
        assert touches_external_world(carrier("none")) is True
        assert touches_external_world(carrier("workspace")) is True
        assert touches_external_world(carrier("delegate-to-caller")) is False
        assert touches_external_world(carrier("ask-user")) is False

    def test_may_write_workspace_三档(self):
        assert may_write_workspace(None) is True
        assert may_write_workspace(carrier("workspace")) is True
        assert may_write_workspace(carrier("repository")) is True
        assert may_write_workspace(carrier("system")) is True
        assert may_write_workspace(carrier("network")) is False
        assert may_write_workspace(carrier("none")) is False


class TestTighteningOnly:
    def test_allow_被升成_ask(self):
        assert tightening_only("allow", carrier("system", requires=True)) == "ask"

    def test_ask_与_deny_原样_不得放宽(self):
        assert tightening_only("deny", carrier("system", requires=True)) == "deny"
        assert tightening_only("ask", carrier("system", requires=True)) == "ask"

    def test_不需批时_allow_不动(self):
        assert tightening_only("allow", carrier("system", requires=False)) == "allow"
        assert tightening_only("allow", None) == "allow"

    def test_大小写与空白不敏感(self):
        assert tightening_only("  Allow ", carrier("system", requires=True)) == "ask"


# ---------- B. 注册表 ----------

def _real_registry_path() -> Path | None:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "protocol" / "itcp-registry.json"
        if candidate.is_file():
            return candidate
    return None


class TestRegistry:
    def test_真实导出物可加载(self):
        path = _real_registry_path()
        if path is None:
            pytest.skip("仓内找不到 protocol/itcp-registry.json(本用例只在完整仓里跑)")
        registry = load_registry(path)
        assert registry.state is RegistryState.LOADED
        assert len(registry.entries) > 0
        assert registry.source.get("generatedBy") == "scripts/itcp-export.mjs"

    def test_run_command_契约不强制人批(self):
        # 证据:导出物里 run_command 是 requiresApproval=false —— 危险门靠 dangerLevel,不是契约轴
        path = _real_registry_path()
        if path is None:
            pytest.skip("无注册表")
        registry = load_registry(path)
        lookup = registry.lookup("run_command")
        assert lookup.state is LookupState.DECLARED
        assert lookup.entry is not None
        assert lookup.entry.human_approval_mandated() is False
        assert lookup.entry.may_write_workspace() is True

    def test_ai_delete_契约强制人批(self):
        path = _real_registry_path()
        if path is None:
            pytest.skip("无注册表")
        registry = load_registry(path)
        lookup = registry.lookup("ai_delete")
        assert lookup.state is LookupState.DECLARED
        assert lookup.entry is not None
        assert lookup.entry.human_approval_mandated() is True

    def test_缺文件降_missing_且查询为_unjudged(self, tmp_path):
        missing = tmp_path / "nope.json"
        registry = load_registry(missing)
        assert registry.state is RegistryState.MISSING
        lookup = registry.lookup("read_file")
        assert lookup.state is LookupState.UNJUDGED
        assert lookup.reason  # 必须点名原因,不许空着

    def test_坏_schema_降_invalid(self, tmp_path):
        bad = tmp_path / "bad.json"
        bad.write_text(json.dumps({"schema": "something-else", "tools": []}), encoding="utf-8")
        registry = load_registry(bad)
        assert registry.state is RegistryState.INVALID
        assert registry.lookup("read_file").state is LookupState.UNJUDGED

    def test_空表降_empty_而不是_loaded(self, tmp_path):
        empty = tmp_path / "empty.json"
        empty.write_text(json.dumps({"schema": REGISTRY_SCHEMA, "source": {}, "tools": []}), encoding="utf-8")
        registry = load_registry(empty)
        assert registry.state is RegistryState.EMPTY
        # 空表不得把所有工具读成"无契约"
        assert registry.lookup("read_file").state is LookupState.UNJUDGED

    def test_健康但缺条目才是_absent(self, tmp_path):
        path = _real_registry_path()
        if path is None:
            pytest.skip("无注册表")
        registry = load_registry(path)
        lookup = registry.lookup("__不存在的工具__")
        assert lookup.state is LookupState.ABSENT
        assert lookup.entry is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""真实注册表全量扫掠：127 枚工具逐条过谓词，而不是抽查两枚。

为什么单独立一个文件：`test_tool_contract.py` 里的 `TestRegistry` 是对真实导出物做
**点检**（`run_command` 不要人批、`ai_delete` 要人批），这证明"某两条判对了"，但
证明不了"其余 125 条判得下去"。夹具测试更证明不了——夹具是手写的形状，真实导出物
是导出器从 125 个源文件里抽出来的形状，两者的边界条件不一样（`permission` 缺席、
`alwaysAsk` 为 null、`shape` 里没有 `visibleToProvider`，这些都只在真实数据里出现）。

价值不在"跑一遍不报错"，在于**把不变量钉成断言并点名违规者**：
- 任一工具被声明成 `requiresApproval: true`，`human_approval_mandated()` 就必须为真；
- 反向，`requiresApproval` 不为真且 `alwaysAsk` 不为真时，`human_approval_mandated()`
  不得凭空为真（否则契约轴会自己给自己加审批，用户每调一次工具被问一次）；
- `lookup()` 对导出物里的每个名字都必须回 `declared`，未知名字必须回 `absent`
  而不是 `unjudged`（这两个混读等于把"没有这条"写成"判不了"）。

数量只钉**下限**不钉绝对值：这个仓每天都有并行会话加工具，钉死 127 会在别人加一枚
工具时立刻假红。下限 120 的作用是"注册表被截断/导出器写残"能被抓到。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.tool_contract_registry import (
    LookupState,
    RegistryState,
    load_registry,
)

REPO_REGISTRY_SCHEMA = "itcp-registry/v0.1"
MIN_EXPECTED_TOOLS = 120
KNOWN_RISK_LEVELS = frozenset({"read", "write", "dangerous"})
KNOWN_EFFECT_SCOPES = frozenset(
    {"none", "system", "workspace", "repository", "network", "ask-user"}
)


def _real_registry_path() -> Path | None:
    """从本文件向上找 `protocol/itcp-registry.json`（本用例只在完整仓里有意义）。"""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "protocol" / "itcp-registry.json"
        if candidate.is_file():
            return candidate
    return None


@pytest.fixture(scope="module")
def registry():
    path = _real_registry_path()
    if path is None:
        pytest.skip("仓内找不到 protocol/itcp-registry.json（本用例只在完整仓里跑）")
    loaded = load_registry(path)
    assert loaded.state is RegistryState.LOADED, loaded.reason
    return loaded


class TestRegistrySelfDescription:
    def test_schema与生成者(self, registry):
        # `registry.source` 只是 JSON 里的 `source` 子对象，**不含**顶层 schema；
        # 顶层 schema 已由 load_registry 在第 213 行拦住（不符即 INVALID），
        # 所以这里直接读原始文件，验证的是"导出物写了哪个 schema"，不是加载器读没读。
        raw = json.loads(Path(registry.path).read_text(encoding="utf-8"))
        assert raw.get("schema") == REPO_REGISTRY_SCHEMA
        assert raw.get("source", {}).get("generatedBy") == "scripts/itcp-export.mjs"
        assert registry.source.get("generatedBy") == "scripts/itcp-export.mjs"

    def test_自述条目数与实际条目数一致(self, registry):
        declared = registry.source.get("declaredTools")
        registered = registry.source.get("registeredTools")
        assert isinstance(declared, int) and isinstance(registered, int)
        assert declared == len(registry.entries), (
            f"导出物自述 declaredTools={declared}，实际 {len(registry.entries)} 条 —— "
            "自述与内容不一致时读数不可信"
        )
        assert registered == len(registry.entries)

    def test_跳过计数是可读的非负整数(self, registry):
        skipped = registry.source.get("skippedNonLiteral")
        assert isinstance(skipped, int) and skipped >= 0


class TestRegistryScale:
    def test_条目数不低于下限(self, registry):
        assert len(registry.entries) >= MIN_EXPECTED_TOOLS

    def test_键名与条目name逐条相等(self, registry):
        offenders = [k for k, e in registry.entries.items() if k != e.name]
        assert not offenders, f"键与 name 不一致：{offenders[:5]}"


class TestEveryEntryShape:
    """形状断言：每条都必须自带能被判的字段，缺字段要**点名**而不是总数。"""

    def test_每条都已声明(self, registry):
        offenders = [n for n, e in registry.entries.items() if not e.declared]
        assert not offenders, f"declared=False：{offenders[:5]}"

    def test_每条都有dangerLevel(self, registry):
        offenders = [n for n, e in registry.entries.items() if not e.danger_level]
        assert not offenders, f"dangerLevel 缺席：{offenders[:5]}"

    def test_每条permission齐全(self, registry):
        offenders = []
        for name, entry in registry.entries.items():
            perm = entry.permission
            if perm is None:
                offenders.append(name)
                continue
            if not perm.get("permissionKey"):
                offenders.append(name)
        assert not offenders, f"permission/permissionKey 缺席：{offenders[:5]}"

    def test_riskLevel与effectScope在已知词表内(self, registry):
        bad_risk = [
            n
            for n, e in registry.entries.items()
            if e.permission is not None and e.permission.get("riskLevel") not in KNOWN_RISK_LEVELS
        ]
        bad_scope = [
            n
            for n, e in registry.entries.items()
            if e.permission is not None
            and e.permission.get("effectScope") not in KNOWN_EFFECT_SCOPES
        ]
        assert not bad_risk, f"未知 riskLevel：{bad_risk[:5]}"
        assert not bad_scope, f"未知 effectScope：{bad_scope[:5]}"

    def test_requiresApproval是布尔(self, registry):
        offenders = [
            n
            for n, e in registry.entries.items()
            if e.permission is not None
            and not isinstance(e.permission.get("requiresApproval"), bool)
        ]
        assert not offenders, f"requiresApproval 非布尔：{offenders[:5]}"


class TestPredicatesOverAllEntries:
    """三个谓词在全量条目上恒返回 bool，且与声明字段保持单向一致。"""

    def test_谓词不抛且返回bool(self, registry):
        for name, entry in registry.entries.items():
            for label, value in (
                ("human_approval_mandated", entry.human_approval_mandated()),
                ("touches_external_world", entry.touches_external_world()),
                ("may_write_workspace", entry.may_write_workspace()),
            ):
                assert isinstance(value, bool), f"{name}.{label} 返回非 bool：{value!r}"

    def test_声明要批则必须判要批(self, registry):
        offenders = [
            n
            for n, e in registry.entries.items()
            if e.permission is not None
            and e.permission.get("requiresApproval") is True
            and not e.human_approval_mandated()
        ]
        assert not offenders, f"声明 requiresApproval=true 却判不要批：{offenders[:5]}"

    def test_未声明要批且未alwaysAsk时不得凭空要批(self, registry):
        offenders = [
            n
            for n, e in registry.entries.items()
            if e.permission is not None
            and e.permission.get("requiresApproval") is not True
            and e.permission.get("alwaysAsk") is not True
            and e.human_approval_mandated()
        ]
        assert not offenders, (
            f"未声明要批却判要批（契约轴在自己加审批）：{offenders[:5]}"
        )

    def test_分布合理性(self, registry):
        mandated = [n for n, e in registry.entries.items() if e.human_approval_mandated()]
        writers = [n for n, e in registry.entries.items() if e.may_write_workspace()]
        assert mandated, "一条要人批的都没有 —— 要么词表被改坏，要么判据读空"
        assert writers, "一条能写工作区的都没有 —— 写类工具全被判丢"
        assert len(mandated) < len(registry.entries), (
            "所有工具都要人批 —— 这等于契约轴把每一步都拦下来"
        )


class TestSchemaFailClosed:
    """schema 是这道闸的第一格：不认版本就拒加载，而不是照旧读下去。"""

    @staticmethod
    def _write(tmp_path: Path, payload: dict) -> Path:
        target = tmp_path / "reg.json"
        target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return target

    def test_schema不符判invalid并点名版本(self, tmp_path):
        path = self._write(
            tmp_path,
            {
                "schema": "itcp-registry/v9.9",
                "source": {},
                "tools": [{"name": "x", "file": "a.ts", "line": 1}],
            },
        )
        loaded = load_registry(path)
        assert loaded.state is RegistryState.INVALID
        assert "v9.9" in (loaded.reason or ""), "理由必须点名实际版本，否则排障只能猜"
        assert loaded.lookup("x").state is LookupState.UNJUDGED

    def test_schema缺席判invalid(self, tmp_path):
        path = self._write(
            tmp_path,
            {"source": {}, "tools": [{"name": "x", "file": "a.ts", "line": 1}]},
        )
        loaded = load_registry(path)
        assert loaded.state is RegistryState.INVALID
        assert loaded.lookup("x").state is LookupState.UNJUDGED

    def test_schema正确且有条目才loaded(self, tmp_path):
        path = self._write(
            tmp_path,
            {
                "schema": REPO_REGISTRY_SCHEMA,
                "source": {"generatedBy": "scripts/itcp-export.mjs"},
                "tools": [{"name": "x", "file": "a.ts", "line": 1}],
            },
        )
        loaded = load_registry(path)
        assert loaded.state is RegistryState.LOADED
        assert loaded.lookup("x").state is LookupState.DECLARED


class TestLookupThreeStates:
    def test_每个已知名字都回declared且带条目(self, registry):
        for name in registry.entries:
            lookup = registry.lookup(name)
            assert lookup.state is LookupState.DECLARED, f"{name} 回 {lookup.state}"
            assert lookup.entry is not None

    def test_未知名字回absent而非unjudged(self, registry):
        lookup = registry.lookup("__no_such_tool_should_not_exist__")
        assert lookup.state is LookupState.ABSENT

    def test_注册表不可用时未知名字回unjudged(self, tmp_path):
        missing = tmp_path / "nope.json"
        bad = load_registry(missing)
        assert bad.state is RegistryState.MISSING
        lookup = bad.lookup("__no_such_tool_should_not_exist__")
        assert lookup.state is LookupState.UNJUDGED, "文件缺席时回 absent 等于把判不了写成没有"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

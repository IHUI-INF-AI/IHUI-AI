# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Inventory of the Codex reverse-engineering programme, R56-R103 (index module).

Forty-eight rounds produced ~55 modules and ~83 reports. This module is the single map of
them, grouped by the capability axis each round attacked rather than by round number -- a
round-by-round list grows without telling anyone what is covered.

The grouping is declarative, but it does not rot: the accompanying test asserts that every
module named here exists on disk. Renaming or deleting a module breaks the test, so the index
cannot quietly drift out of date the way a hand-maintained table would.

``UNEXHAUSTED`` is the honest other half. Every entry names something the programme knows it
has not established, with the reason, so "we analysed everything" is never implied.
"""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import Final

CORE_DIR: Final = Path(__file__).resolve().parent

# --- the six capability axes, plus the bookkeeping ------------------------------------

STRUCTURAL_METHOD_AXIS: Final = "structural"
HOOK_CONTRACT_AXIS: Final = "hook"
RUNTIME_STATE_AXIS: Final = "runtime"
PLUGIN_AXIS: Final = "plugin"
SKILL_ENGINE_AXIS: Final = "skill"
GATE_AXIS: Final = "gate"
LEDGER_AXIS: Final = "ledger"

AXES: Final = (
    STRUCTURAL_METHOD_AXIS,
    HOOK_CONTRACT_AXIS,
    RUNTIME_STATE_AXIS,
    PLUGIN_AXIS,
    SKILL_ENGINE_AXIS,
    GATE_AXIS,
    LEDGER_AXIS,
)
AXIS_COUNT: Final = 7

MODULES_BY_AXIS: Final[Mapping[str, tuple[str, ...]]] = {
    # Field names, declaration order, type contracts, pool residue -- the long grind on structs.
    STRUCTURAL_METHOD_AXIS: (
        "struct_strict_reconstruction",
        "struct_field_name_contract",
        "struct_declaration_order",
        "struct_contract_drift",
        "struct_attribution_frontier",
        "struct_visitor_key_evidence",
        "struct_pool_residue",
        "struct_pool_a_candidates",
        "struct_fields_fat_pointer",
        "struct_bidirectional_pool",
        "struct_pool_order_falsified",
        "struct_partial_run_claims",
        "struct_fields_run_pairs",
        "struct_template_fields_adjacency",
        "struct_window_claims",
        "struct_pool_address_attribution",
        "struct_gap_ledger",
        "serde_struct_catalog",
        "single_variant_enum_evidence",
        "enum_variant_route_falsified",
        "code_route_falsified",
    ),
    # JSON Schema, event kinds, field spellings, exit codes, ordering.
    HOOK_CONTRACT_AXIS: (
        "hook_contract_schema",
        "hook_event_kind",
        "hook_field_name",
        "hook_field_type_contract",
        "hook_field_description",
        "hook_default_semantics",
        "hook_definition_contract",
        "hook_definition_binary_crosscheck",
        "hook_enum_binary_lookup",
        "hook_segment_binary_lookup",
        "hook_contract_runtime_check",
        "hook_event_ordering",
        "hook_exit_contract",
        "hook_runtime",
        "codex_hook_config_contract",
    ),
    # What the app knows about itself: module tree, state schema, desktop keys, error info.
    RUNTIME_STATE_AXIS: (
        "codex_runtime_module_tree",
        "codex_runtime_state_schema",
        "codex_desktop_state_keys",
        "codex_error_info",
    ),
    # The shipped plugin bundle: manifest, marketplace, and the licence that governs it.
    # codex_plugin_license_audit(R96)已随 e6cfc77db5「排除 8 个陈旧回写件」连同其测试与
    # R96 文档一并退役 ⇒ 索引必须同步移除,否则本模块自己违反「每条登记都在磁盘上」的承诺。
    PLUGIN_AXIS: (
        "codex_plugin_manifest",
    ),
    # Skill engines and their artefact contracts.
    SKILL_ENGINE_AXIS: (
        "codex_skill_artifact_contract",
    ),
    # Six gates: behaviour, findings, chart contracts, rejection codes, targets, exceptions.
    GATE_AXIS: (
        "codex_presentation_gate_contract",
        "codex_presentation_gate_behavior",
        "codex_presentation_gate_findings",
        "codex_chart_gate_contract",
        "codex_chart_workbook_verification",
        "codex_chart_rejection_codes",
        "codex_chart_target_application",
        "codex_source_figure_exception",
    ),
    # The closed-item ledger shared across rounds.
    LEDGER_AXIS: ("backlog_closure_ledger",),
}


def module_count() -> int:
    """How many distinct modules the programme produced."""
    return sum(len(m) for m in MODULES_BY_AXIS.values())


def modules_for(axis: str) -> tuple[str, ...]:
    """The modules on a given axis."""
    return MODULES_BY_AXIS[axis]


def module_path(name: str) -> Path:
    """The on-disk location of a module named in this index."""
    return CORE_DIR / f"{name}.py"


def describe_axes() -> Mapping[str, int]:
    """Module count per axis, for reporting."""
    return {axis: len(MODULES_BY_AXIS[axis]) for axis in AXES}


# --- the honest other half -----------------------------------------------------------
#
# Each entry is (area, what is not established, why it is not). Nothing here is a to-do;
# they are boundaries of the current evidence.

UNEXHAUSTED: Final = (
    (
        "hook 触发",
        "没有任何一次 hook 真正被触发执行",
        "enabled 的真实结构（map key 形态）未解；kebab-case 键静默接受且零 payload",
    ),
    (
        "hook 字段类型",
        "字段级 type/format/enum 未纳入契约",
        "R63 只拿到字段名与 required，类型层未进入 schema 提取",
    ),
    (
        "chart receipt",
        "--receipt 的 owner-private enforcement directory 未定位",
        "试过 30 个目录名全部 rc=2；--help 里该 flag 描述为空，属隐藏 flag",
    ),
    (
        "chart 类型覆盖",
        "只观测到 barChart",
        "lineChart/pieChart 在两种 target 下的计数与校验行为未测",
    ),
    (
        "powerpoint 完整性",
        "powerpoint 模式要求的 complete 具体指什么未测",
        "只给了 tx/cat/val 三件；少一件是否失败未知",
    ),
    (
        "披露措辞",
        "只测了英文的四种 non-editable 拼法",
        "read-only、flat image 等别的词，以及其他语言，未测",
    ),
    (
        "gate 数量",
        "六道门已覆盖，presentations 另有 10 个工具契约未提",
        "artifact_tool_utils 55 KB、materialize_literal_chart_workbooks 37 KB 等",
    ),
    (
        "CLI 子命令",
        "codex plugin／exec／review／login／mcp／app-server 未实测",
        "只从 --help 见到名字",
    ),
    (
        "非 hook struct",
        "非 hook 结构体的字段名仍需 disasm LEA xref",
        "R65-R92 的池归因只覆盖到一部分",
    ),
    (
        "schema 片段",
        "R63 的 23 段 schema 之外还有 7 段片段未解析",
        "严格 JSON 校验把不完整对象滤掉了",
    ),
    (
        "推送",
        "本地提交一直未推送",
        "origin 分叉扩大中；按纪律交守护统一推送",
    ),
    (
        "许可",
        "LICENSE.txt 禁止反向工程，与本项目工作存在冲突",
        "R96 已记录；替代路线是黑盒观测，已全程遵守",
    ),
)
UNEXHAUSTED_COUNT: Final = len(UNEXHAUSTED)

# --- what the index does and does not claim -------------------------------------------

GROUPED_BY_CAPABILITY_NOT_BY_ROUND: Final = True
INDEX_DOES_NOT_ROT: Final = True  # enforced by the test that checks each path exists
COMPLETENESS_NOT_CLAIMED: Final = True
BLACK_BOX_ONLY: Final = True


class InventoryError(ValueError):
    """Raised when the inventory contradicts itself."""


def validate_inventory() -> None:
    """Assert the index's own shape, above all that it never claims completeness."""
    if AXIS_COUNT != 7 or len(AXES) != 7:
        raise InventoryError("seven axes")
    if set(MODULES_BY_AXIS) != set(AXES):
        raise InventoryError("every axis must have a module list")
    for axis in AXES:
        mods = MODULES_BY_AXIS[axis]
        if not mods:
            raise InventoryError(f"axis {axis} is empty")
        if len(set(mods)) != len(mods):
            raise InventoryError(f"axis {axis} lists a module twice")

    all_mods = [m for axis in AXES for m in MODULES_BY_AXIS[axis]]
    if len(set(all_mods)) != len(all_mods):
        raise InventoryError("a module appears on two axes")
    if module_count() != len(all_mods):
        raise InventoryError("module_count disagrees with the lists")

    if GROUPED_BY_CAPABILITY_NOT_BY_ROUND is not True:
        raise InventoryError("grouping is by capability")
    if INDEX_DOES_NOT_ROT is not True:
        raise InventoryError("the index must be test-enforced")
    if COMPLETENESS_NOT_CLAIMED is not True:
        raise InventoryError("the index never claims completeness")
    if BLACK_BOX_ONLY is not True:
        raise InventoryError("all gate evidence is black-box")

    if len(UNEXHAUSTED) != UNEXHAUSTED_COUNT:
        raise InventoryError("unexhausted count drifted")
    if UNEXHAUSTED_COUNT < 10:
        raise InventoryError(
            "the boundaries list is implausibly short; it must not be trimmed to look clean"
        )
    for entry in UNEXHAUSTED:
        if len(entry) != 3:
            raise InventoryError("each entry is (area, gap, reason)")
        if not all(part.strip() for part in entry):
            raise InventoryError("no entry may be blank")

    for mod in all_mods:
        if not module_path(mod).exists():
            raise InventoryError(f"index names a module that is not on disk: {mod}")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""round 8 能力复现 / 席位 A:快照回退独立一致性闸的验收(2026-11-14 立)。

钉住四件事,方向不能反:
1. **两道判据解耦**:本闸只判「目标检查点 vs 当前工作区是否一致」,不挑回退点;
   快照里的 checkpoint 元数据被忽略(test_does_not_pick_checkpoint)。
2. **三档 verdict**:一致放行 / 有差异阻断并给结构化差异清单 / 输入取不到或形状不认
   一律未判定并**阻断**(绝不记绿,§0.3)。
3. **失效方向**:策略关闭、缺字段、类型错、None 输入,全是「多要一次定向说明」,
   不是「多放一次跳门」(§0.10)。
4. **一轴超越**:每档 verdict 都带差异清单 + 判据来源 + 可审计留痕
   (verdict/allow/judged/reason/criterion 同帧),不是只有一个布尔。

隔离:被测为纯函数模块,无 IO、无 DB、无网络。
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.core.revert_check import (
    REVERT_CHECK_CRITERION,
    RevertVerdict,
    evaluate_revert_check,
)

ON: dict[str, object] = {"enabled": True}
SNAP: dict[str, object] = {"files": {"a.txt": "A", "b.txt": "B"}}
SAME: dict[str, object] = {"files": {"a.txt": "A", "b.txt": "B"}}
EMPTY_DIFF: dict[str, list[str]] = {"changed": [], "added": [], "removed": []}


@dataclass(frozen=True)
class Case:
    """一条表驱动用例:输入三元组 + 期望的结构化 verdict。"""

    case_id: str
    snapshot: object
    workspace: object
    policy: object
    verdict: str
    allow: bool
    judged: bool
    diff: dict[str, list[str]]
    reason_keyword: str


CASES: list[Case] = [
    Case(
        "consistent",
        SNAP, SAME, ON,
        RevertVerdict.CONSISTENT.value, True, True, EMPTY_DIFF, "逐文件一致",
    ),
    Case(
        "single_changed",
        SNAP, {"files": {"a.txt": "A2", "b.txt": "B"}}, ON,
        RevertVerdict.DIVERGED.value, False, True,
        {"changed": ["a.txt"], "added": [], "removed": []}, "不一致",
    ),
    Case(
        "multi_changed",
        SNAP, {"files": {"a.txt": "A2", "b.txt": "B2"}}, ON,
        RevertVerdict.DIVERGED.value, False, True,
        {"changed": ["a.txt", "b.txt"], "added": [], "removed": []}, "不一致",
    ),
    Case(
        "added",
        SNAP, {"files": {"a.txt": "A", "b.txt": "B", "c.txt": "C"}}, ON,
        RevertVerdict.DIVERGED.value, False, True,
        {"changed": [], "added": ["c.txt"], "removed": []}, "不一致",
    ),
    Case(
        "removed",
        SNAP, {"files": {"a.txt": "A"}}, ON,
        RevertVerdict.DIVERGED.value, False, True,
        {"changed": [], "added": [], "removed": ["b.txt"]}, "不一致",
    ),
    Case(
        "mixed_changed_added_removed",
        SNAP, {"files": {"a.txt": "A2", "c.txt": "C"}}, ON,
        RevertVerdict.DIVERGED.value, False, True,
        {"changed": ["a.txt"], "added": ["c.txt"], "removed": ["b.txt"]}, "不一致",
    ),
    Case(
        "missing_field",
        {"checkpoint_id": "old", "created_at": 1}, SAME, ON,
        RevertVerdict.UNJUDGED.value, False, False, EMPTY_DIFF, "缺字段",
    ),
    Case(
        "type_error_files_not_mapping",
        SNAP, {"files": ["a.txt", "b.txt"]}, ON,
        RevertVerdict.UNJUDGED.value, False, False, EMPTY_DIFF, "形状不认",
    ),
    Case(
        "type_error_content_not_str",
        SNAP, {"files": {"a.txt": 123, "b.txt": "B"}}, ON,
        RevertVerdict.UNJUDGED.value, False, False, EMPTY_DIFF, "内容不是字符串",
    ),
    Case(
        "empty_workspace_is_judged_not_unreadable",
        SNAP, {"files": {}}, ON,
        RevertVerdict.DIVERGED.value, False, True,
        {"changed": [], "added": [], "removed": ["a.txt", "b.txt"]}, "不一致",
    ),
    Case(
        "both_empty_consistent",
        {"files": {}}, {"files": {}}, ON,
        RevertVerdict.CONSISTENT.value, True, True, EMPTY_DIFF, "逐文件一致",
    ),
    Case(
        "policy_off_is_block_not_skip",
        SNAP, SAME, {"enabled": False},
        RevertVerdict.UNJUDGED.value, False, False, EMPTY_DIFF, "未启用",
    ),
    Case(
        "policy_missing_field",
        SNAP, SAME, {},
        RevertVerdict.UNJUDGED.value, False, False, EMPTY_DIFF, "缺字段",
    ),
    Case(
        "policy_enabled_not_bool",
        SNAP, SAME, {"enabled": 1},
        RevertVerdict.UNJUDGED.value, False, False, EMPTY_DIFF, "不是布尔",
    ),
    Case(
        "snapshot_none_unobtainable",
        None, SAME, ON,
        RevertVerdict.UNJUDGED.value, False, False, EMPTY_DIFF, "取不到",
    ),
]


@pytest.mark.parametrize("case", CASES, ids=[c.case_id for c in CASES])
def test_evaluate_revert_check_table(case: Case) -> None:
    """≥8 例表驱动:每例断言结构化 verdict / allow / judged / diff / reason / 判据来源。

    负例(未判定与阻断)额外断言 ``reason`` 点名了具体原因、``verdict`` 为字符串档位,
    绝不静默放行成 ``consistent``。
    """
    result = evaluate_revert_check(case.snapshot, case.workspace, case.policy)
    assert isinstance(result, dict)
    assert result["verdict"] == case.verdict
    assert isinstance(result["verdict"], str)
    assert result["allow"] is case.allow
    assert result["judged"] is case.judged
    assert result["diff"] == case.diff
    assert isinstance(result["reason"], str)
    assert case.reason_keyword in result["reason"]
    assert result["criterion"] == REVERT_CHECK_CRITERION


def test_unjudged_is_never_green() -> None:
    """§0.3:取不到 / 形状不认 / 策略不可用一律「未判定 + 阻断」,绝不记绿。"""
    bad_inputs: list[tuple[object, object, object]] = [
        (None, SAME, ON),
        (SNAP, None, ON),
        (SNAP, SAME, None),
        (SNAP, SAME, {"enabled": False}),
        (SNAP, SAME, {"enabled": 1}),
        (SNAP, SAME, {}),
        ({"no_files": 1}, SAME, ON),
        (SNAP, {"files": [1]}, ON),
        (SNAP, SAME, "enabled"),
    ]
    for snap, ws, pol in bad_inputs:
        result = evaluate_revert_check(snap, ws, pol)
        assert result["verdict"] == RevertVerdict.UNJUDGED.value
        assert result["allow"] is False
        assert result["judged"] is False
        assert result["reason"]
        assert result["criterion"] == REVERT_CHECK_CRITERION
        assert result["diff"] == EMPTY_DIFF


def test_does_not_pick_checkpoint() -> None:
    """解耦:选点是 pickRevertCheckpoint 的职责。快照带不同 checkpoint 元数据、
    files 相同 ⇒ verdict 必须逐字段相同(元数据被忽略,不参与判定)。"""
    with_meta_old = {"checkpoint_id": "old", "created_at": 1, "files": {"a.txt": "A"}}
    with_meta_new = {"checkpoint_id": "new", "created_at": 999, "files": {"a.txt": "A"}}
    workspace = {"files": {"a.txt": "A"}}
    a = evaluate_revert_check(with_meta_old, workspace, ON)
    b = evaluate_revert_check(with_meta_new, workspace, ON)
    assert a == b
    assert a["verdict"] == RevertVerdict.CONSISTENT.value


def test_pure_no_input_mutation() -> None:
    """纯函数:调用不得改写任何入参(快照 / 工作区 / 策略)。"""
    snap: dict[str, object] = {"files": {"a.txt": "A", "b.txt": "B"}}
    ws: dict[str, object] = {"files": {"a.txt": "A"}}
    pol: dict[str, object] = {"enabled": True}
    snap_before: dict[str, object] = {"files": {"a.txt": "A", "b.txt": "B"}}
    ws_before: dict[str, object] = {"files": {"a.txt": "A"}}
    pol_before: dict[str, object] = {"enabled": True}
    evaluate_revert_check(snap, ws, pol)
    assert snap == snap_before
    assert ws == ws_before
    assert pol == pol_before


def test_verdict_envelope_is_auditable() -> None:
    """可审计 verdict:字段集固定、判据来源单一、差异清单三维齐备。"""
    result = evaluate_revert_check(SNAP, SAME, ON)
    assert set(result) == {"verdict", "judged", "allow", "reason", "criterion", "diff"}
    assert set(result["diff"]) == {"changed", "added", "removed"}
    assert result["criterion"] == REVERT_CHECK_CRITERION
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

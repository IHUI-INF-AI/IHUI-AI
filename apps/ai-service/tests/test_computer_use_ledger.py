# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""桌面操控可解释轨迹账（round 8 实现席 D）——纯判据测试。

覆盖（对照立因见 computer_use_ledger.py 模块 docstring）：
    · evaluate_step：先用后动 / 坐标溯源 / 缺字段 / 当轮读数取不到（§0.3 unjudged）
    · append_step：正常步进 / 序号断档 / 重复 sha / 失败后 ledger 不变（原子）
    · replay_audit：回放一致性 + 回放检出坐标来源戳被篡改

立因：对照 TraeRecordReplayRuntime.exe / Qoder recordAndReplay 的产物是不透明
二进制，无法逐字段审计；本席复现「录制 → 逐步可回放」的行为契约，并用下列
用例把「每步 sha256 + 坐标来源可追溯 + 写入原子」钉死。
刻意不做什么：不 import 对照程序的任何产物、不反编译、不碰凭据（§0.12 红线）；
测试只吃本模块的生产实现（判据不复制，§0.6）。
"""

from __future__ import annotations

import hashlib

import pytest

from app.services.computer_use_ledger import (
    ACCEPTED,
    REJECTED,
    ROW_FIELDS,
    UNJUDGED,
    append_step,
    evaluate_step,
    replay_audit,
)

# ---------------------------------------------------------------------------
# 夹具：构造「当轮截图读数」与「一步」；sha256 用标准库生成（零第三方依赖）
# ---------------------------------------------------------------------------


def _sha(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _frame(seq: int, payload: str) -> dict:
    """当轮 current_frame：带合法 sha256 截图指纹 + 帧号。"""
    return {"seq": seq, "screenshot_sha256": _sha(payload)}


def _step(
    seq: int,
    frame_sha: str,
    *,
    coord_sha: str | None = None,
    action: str = "click",
    with_sha: bool = True,
    with_coord: bool = True,
) -> dict:
    """一步：seq / action / coord(自带来源戳 frame_sha256) / screenshot_sha256。

    coord_sha 默认 = frame_sha（坐标溯源到当轮）；显式传旧指纹即构造
    「坐标不来自当轮」的失形态。
    """
    step: dict = {"seq": seq, "action": action}
    if with_coord:
        step["coord"] = {
            "x": 10 + seq,
            "y": 20 + seq,
            "frame_sha256": coord_sha if coord_sha is not None else frame_sha,
        }
    if with_sha:
        step["screenshot_sha256"] = frame_sha
    return step


# ---------------------------------------------------------------------------
# 1. 正常步进
# ---------------------------------------------------------------------------


def test_normal_step_appends_one_row_with_audit_fields():
    """单步全过：accepted，追加一行且行含 seq/action/coord/sha/verdict。"""
    f1 = _frame(1, "shot-1")
    ledger, v = append_step([], _step(1, f1["screenshot_sha256"]), f1)
    assert v["status"] == ACCEPTED
    assert v["accepted"] is True
    assert v["checks"]["coord_traceable"] is True
    assert v["checks"]["seq_continuous"] is True
    assert v["checks"]["sha_unique"] is True
    assert len(ledger) == 1
    row = ledger[0]
    for key in ROW_FIELDS:
        assert key in row
    assert row["seq"] == 1
    assert row["action"] == "click"
    assert row["screenshot_sha256"] == f1["screenshot_sha256"]
    assert row["verdict"] == ACCEPTED
    assert row["coord"]["frame_sha256"] == f1["screenshot_sha256"]


# ---------------------------------------------------------------------------
# 2. 坐标不来自当轮（反向变异验证的核心钉子）
# ---------------------------------------------------------------------------


def test_coord_not_from_current_frame_is_unjudged():
    """坐标来源戳 != 当轮指纹 ⇒ unjudged 并拒绝写入（§0.3 + 多要一次定向说明）。

    注：本步 screenshot_sha256 仍等于当轮（C5 过），只有 coord.frame_sha256
    是旧指纹 —— 单独钉住 C6 坐标溯源这一维；把 C6 注释/禁用后本例必转红。
    """
    f1 = _frame(1, "shot-1")
    stale = _sha("older-shot")
    s = _step(1, f1["screenshot_sha256"], coord_sha=stale)
    v = evaluate_step(s, f1)
    assert v["status"] == UNJUDGED
    assert v["checks"]["coord_traceable"] is False
    assert v["needs_direction"]  # 失效方向 = 多要一次定向说明，而非放行
    ledger, v2 = append_step([], s, f1)
    assert v2["status"] == UNJUDGED
    assert ledger == []  # 拒绝写入，不留半行


# ---------------------------------------------------------------------------
# 3. 缺 sha
# ---------------------------------------------------------------------------


def test_missing_sha_is_unjudged():
    """缺 screenshot_sha256 ⇒ 取不到输入判 unjudged，不静默放行。"""
    f1 = _frame(1, "shot-1")
    v = evaluate_step(_step(1, f1["screenshot_sha256"], with_sha=False), f1)
    assert v["status"] == UNJUDGED
    assert v["checks"]["has_sha"] is False
    assert v["needs_direction"]


# ---------------------------------------------------------------------------
# 4. 空 step
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("bad", [None, {}, {"action": ""}])
def test_empty_step_is_unjudged(bad):
    """空 step / 缺 action ⇒ unjudged（无从判定）。"""
    f1 = _frame(1, "shot-1")
    v = evaluate_step(bad, f1)
    assert v["status"] == UNJUDGED
    assert v["checks"]["step_nonempty"] is False
    assert v["needs_direction"]


# ---------------------------------------------------------------------------
# 5. 序号断档
# ---------------------------------------------------------------------------


def test_seq_gap_is_rejected():
    """账已有 1 行，下一步 seq=3 ⇒ 序号断档 rejected，账不增长。"""
    f1, f2 = _frame(1, "shot-1"), _frame(2, "shot-2")
    l1, v1 = append_step([], _step(1, f1["screenshot_sha256"]), f1)
    assert v1["status"] == ACCEPTED
    l2, v2 = append_step(l1, _step(3, f2["screenshot_sha256"]), f2)
    assert v2["status"] == REJECTED
    assert v2["checks"]["seq_continuous"] is False
    assert len(l2) == 1


# ---------------------------------------------------------------------------
# 6. 重复 sha
# ---------------------------------------------------------------------------


def test_duplicate_sha_is_rejected():
    """第二步复用第一步的指纹（未重新取当轮截图）⇒ rejected。"""
    f1 = _frame(1, "shot-1")
    l1, _ = append_step([], _step(1, f1["screenshot_sha256"]), f1)
    l2, v2 = append_step(l1, _step(2, f1["screenshot_sha256"]), f1)
    assert v2["status"] == REJECTED
    assert v2["checks"]["sha_unique"] is False
    assert len(l2) == 1


# ---------------------------------------------------------------------------
# 7. 失败后 ledger 不变（不可变风格 / 写入原子）
# ---------------------------------------------------------------------------


def test_failure_returns_same_ledger_object_without_partial_row():
    """三类失败都返回**入参原对象**、不留半行：原子写入的核心保证。"""
    f1 = _frame(1, "shot-1")
    original: list = []
    bad_steps = [
        _step(1, f1["screenshot_sha256"], coord_sha=_sha("stale")),  # C6 unjudged
        _step(1, f1["screenshot_sha256"], with_sha=False),  # C3 unjudged
        _step(9, f1["screenshot_sha256"]),  # C7 序号断档 rejected
    ]
    for bad in bad_steps:
        new, v = append_step(original, bad, f1)
        assert new is original  # 同一对象
        assert new == []  # 不留半行
        assert v["status"] != ACCEPTED


# ---------------------------------------------------------------------------
# 8. 当轮读数取不到（§0.3）
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad_frame",
    [None, {}, {"screenshot_sha256": "not-a-sha"}, {"screenshot_sha256": ""}],
)
def test_current_frame_unavailable_is_unjudged(bad_frame):
    """current_frame 取不到或指纹非法 ⇒ unjudged 并点名原因，绝不静默放行。"""
    v = evaluate_step(_step(1, _sha("shot-1")), bad_frame)
    assert v["status"] == UNJUDGED
    assert v["checks"]["frame_available"] is False
    assert v["needs_direction"]


# ---------------------------------------------------------------------------
# 9. 先用后动（动作依据不是当轮读数）
# ---------------------------------------------------------------------------


def test_first_use_then_action_sha_not_current_is_rejected():
    """动作 screenshot_sha256 是旧指纹 ⇒ 先用后动判 rejected（C5 先于 C6）。"""
    f1 = _frame(1, "shot-1")
    s = _step(1, _sha("older"), coord_sha=f1["screenshot_sha256"])
    v = evaluate_step(s, f1)
    assert v["status"] == REJECTED
    assert v["checks"]["sha_matches_frame"] is False


# ---------------------------------------------------------------------------
# 10. 回放一致性
# ---------------------------------------------------------------------------


def test_replay_audit_consistent():
    """三步正常账逐行回放：consistent，steps/replayed=3，无 first_failure。"""
    frames = [_frame(i, f"shot-{i}") for i in range(1, 4)]
    ledger: list = []
    for i, fr in enumerate(frames, start=1):
        ledger, v = append_step(ledger, _step(i, fr["screenshot_sha256"]), fr)
        assert v["status"] == ACCEPTED
    audit = replay_audit(ledger)
    assert audit["status"] == "consistent"
    assert audit["steps"] == 3
    assert audit["replayed"] == 3
    assert audit["first_failure"] is None


# ---------------------------------------------------------------------------
# 11. 回放检出篡改（一轴超越：坐标来源戳可审计）
# ---------------------------------------------------------------------------


def test_replay_detects_coord_frame_tamper():
    """篡改某行 coord.frame_sha256 ⇒ 回放用同一份 evaluate_step 立即判不一致。"""
    f1 = _frame(1, "shot-1")
    ledger, _ = append_step([], _step(1, f1["screenshot_sha256"]), f1)
    tampered = [dict(ledger[0])]
    tampered[0]["coord"] = {**tampered[0]["coord"], "frame_sha256": _sha("forged")}
    audit = replay_audit(tampered)
    assert audit["status"] == "inconsistent"
    assert audit["first_failure"]["seq"] == 1
    assert "重放判据不通过" in audit["first_failure"]["reason"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话帧级可追溯判据测试（round 9「能力复现」实现席 E）——纯判据测试。

覆盖（立因见 realtime_voice_session.py 模块 docstring）：
    · evaluate_frame：正常帧 / 先用后动合法（barge_in / commit）/ 指纹不符 /
      缺指纹 / 超过 ttl / 未登记 kind / closed 后帧 / 取不到当轮帧读数（§0.3）
    · append_frame：失败后 ledger 不变（原子）/ seq 断档 / 重复 seq
    · 回放一致性 + 回放检出输出动作指纹被篡改（一轴超越：逐帧可审计）

立因：对照 Qoder / Trae 实时语音只有「流式收发」能力；本席复现「帧准入 →
逐帧可回放」的行为契约，并用下列用例把「帧指纹溯源 + 先用后动 + 序号 / TTL
单调 + 原子写入 + 可回放 + 取不到当轮读数一律阻断」钉死。
刻意不做什么：不 import 对照程序的任何产物、不反编译、不碰凭据（§0.12 红线）；
测试只吃本模块的生产实现（判据不复制，§0.6）；回放复用 evaluate_frame，
不在测试里另写一份判据。零第三方依赖，sha256 用标准库 hashlib 生成。
"""

from __future__ import annotations

import hashlib

import pytest

from app.core.realtime_voice_session import (
    ACCEPTED,
    BARGED_IN,
    DENIED,
    ROW_FIELDS,
    UNJUDGED,
    append_frame,
    evaluate_frame,
)

# ---------------------------------------------------------------------------
# 夹具：当轮基准帧指纹 / session / policy / frame；sha256 用标准库生成
# ---------------------------------------------------------------------------


def _sha(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


ANCHOR = _sha("current-round")  # 当轮基准帧指纹（输出类动作必须溯源到它）


def _session(state: str = "listening", ttl: int = 10, anchor: str = ANCHOR) -> dict:
    """会话：state / current_frame_sha256 / ttl 三件齐备。"""
    return {"state": state, "current_frame_sha256": anchor, "ttl": ttl}


def _policy() -> dict:
    """判据策略：注册 kind / 输出类 kind / 状态转移表（closed 为终态，空集）。"""
    return {
        "registered_kinds": frozenset({"audio", "vad", "barge_in", "commit"}),
        "output_kinds": frozenset({"barge_in", "commit"}),
        "transitions": {
            "idle": frozenset({"audio", "vad"}),
            "listening": frozenset({"audio", "vad", "commit"}),
            "speaking": frozenset({"barge_in", "commit", "vad"}),
            "closed": frozenset(),
        },
    }


def _frame(seq: int = 1, kind: str = "audio", fp: str | None = None) -> dict:
    """一帧：seq / kind / frame_sha256。fp 缺省为本帧自身身份指纹（非当轮）。"""
    if fp is None:
        fp = _sha(f"frame-{seq}-{kind}")
    return {"seq": seq, "kind": kind, "frame_sha256": fp}


def _output_frame(seq: int, kind: str) -> dict:
    """合法输出类动作：frame_sha256 溯源到当轮基准帧指纹 ANCHOR。"""
    return _frame(seq, kind, fp=ANCHOR)


def _replay(ledger: list[dict], policy: dict) -> tuple[bool, int | None]:
    """逐行回放：用行自带上下文重建 frame + session，复用唯一判据复核（§0.6）。

    复核三件事：seq 连续、ttl_remaining 严格递减且 >= 0（TTL 单调）、
    verdict 可重放稳定。任一不符返回 (False, 出错行下标)。
    """
    prev_remaining: int | None = None
    for i, row in enumerate(ledger):
        if row["seq"] != i + 1:
            return False, i
        rem = row["ttl_remaining"]
        if rem < 0 or (prev_remaining is not None and rem >= prev_remaining):
            return False, i
        prev_remaining = rem
        frame = {
            "seq": row["seq"],
            "kind": row["kind"],
            "frame_sha256": row["frame_sha256"],
        }
        session = {
            "state": row["state"],
            "current_frame_sha256": row["current_frame_sha256"],
            "ttl": row["ttl"],
        }
        v = evaluate_frame(frame, session, policy)
        if v["verdict"] != row["verdict"] or v["verdict"] not in (ACCEPTED, BARGED_IN):
            return False, i
    return True, None


# ---------------------------------------------------------------------------
# 1. 正常输入帧
# ---------------------------------------------------------------------------


def test_normal_audio_frame_accepted():
    """单帧全过：accepted，追加一行且行含 seq/kind/frame_sha256/verdict/reason。"""
    v = evaluate_frame(_frame(1, "audio"), _session(), _policy())
    assert v["verdict"] == ACCEPTED
    assert v["tier"] == "stream"
    assert v["checks"]["use_then_act"] is True  # 输入帧不触发先用后动
    assert v["direction"] == ""  # 准入态不需要补定向说明

    ledger, v2 = append_frame([], _frame(1, "audio"), _session(), _policy())
    assert v2["verdict"] == ACCEPTED
    assert v2["checks"]["seq_strict"] is True
    assert len(ledger) == 1
    row = ledger[0]
    for key in ROW_FIELDS:
        assert key in row
    assert row["seq"] == 1
    assert row["kind"] == "audio"
    assert row["verdict"] == ACCEPTED
    assert row["ttl_remaining"] == 9  # ttl=10, seq=1


# ---------------------------------------------------------------------------
# 2. 先用后动合法（输出类动作 barge_in / commit）
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("kind", ["barge_in", "commit"])
def test_legal_output_action_is_barged_in(kind):
    """输出类动作溯源到当轮指纹 ⇒ barged_in，行被原子写入。"""
    fr = _output_frame(1, kind)
    sess = _session(state="speaking")
    v = evaluate_frame(fr, sess, _policy())
    assert v["verdict"] == BARGED_IN
    assert v["tier"] == "action"
    assert v["checks"]["use_then_act"] is True

    ledger, v2 = append_frame([], fr, sess, _policy())
    assert v2["verdict"] == BARGED_IN
    assert len(ledger) == 1
    assert ledger[0]["frame_sha256"] == ANCHOR


# ---------------------------------------------------------------------------
# 3. 指纹不符（反向变异验证的核心钉子）
# ---------------------------------------------------------------------------


def test_fingerprint_mismatch_is_unjudged_and_refuses_write():
    """输出类动作 frame_sha256 是旧指纹 ⇒ unjudged 并拒绝写入（§0.3 + §0.10）。

    把 V7「先用后动」守卫临时禁用后本例必转红 —— 指纹不符会被错放成
    barged_in 并写入一行，正是要钉住的失效方向。
    """
    fr = _frame(1, "barge_in", fp=_sha("stale-round"))
    sess = _session(state="speaking")
    v = evaluate_frame(fr, sess, _policy())
    assert v["verdict"] == UNJUDGED
    assert "先用后动" in v["reason"]
    assert v["tier"] == "action"
    assert v["checks"]["use_then_act"] is False
    assert v["direction"]  # 失效方向 = 多要一次定向说明，而非放行

    original: list = []
    ledger, v2 = append_frame(original, fr, sess, _policy())
    assert ledger is original  # 同一对象、不留半行
    assert ledger == []
    assert v2["verdict"] == UNJUDGED


# ---------------------------------------------------------------------------
# 4. 缺指纹
# ---------------------------------------------------------------------------


def test_missing_fingerprint_is_unjudged():
    """缺 frame_sha256 ⇒ 取不到输入判 unjudged，结构化点名「缺指纹」。"""
    fr = {"seq": 1, "kind": "audio"}
    v = evaluate_frame(fr, _session(), _policy())
    assert v["verdict"] == UNJUDGED
    assert "缺指纹" in v["reason"]
    assert v["checks"]["frame_shape"] is False
    assert v["direction"]


# ---------------------------------------------------------------------------
# 5. seq 断档
# ---------------------------------------------------------------------------


def test_seq_gap_is_denied():
    """账已有 1 行，下一帧 seq=3 ⇒ seq 断档 denied，原账本不变。"""
    sess = _session()
    l1, v1 = append_frame([], _frame(1, "audio"), sess, _policy())
    assert v1["verdict"] == ACCEPTED
    l2, v2 = append_frame(l1, _frame(3, "audio"), sess, _policy())
    assert v2["verdict"] == DENIED
    assert "seq 断档" in v2["reason"]
    assert v2["tier"] == "ledger"
    assert v2["checks"]["seq_strict"] is False
    assert v2["direction"]
    assert l2 is l1


# ---------------------------------------------------------------------------
# 6. 重复 seq
# ---------------------------------------------------------------------------


def test_duplicate_seq_is_denied():
    """复用已出现的 seq ⇒ 重复 seq denied，原账本不变。"""
    sess = _session()
    l1, _ = append_frame([], _frame(1, "audio"), sess, _policy())
    l2, v2 = append_frame(l1, _frame(1, "audio"), sess, _policy())
    assert v2["verdict"] == DENIED
    assert "重复 seq" in v2["reason"]
    assert v2["checks"]["seq_strict"] is False
    assert l2 is l1


# ---------------------------------------------------------------------------
# 7. 超过 ttl
# ---------------------------------------------------------------------------


def test_over_ttl_is_denied():
    """ttl=2 收满两帧后，第 3 帧 seq=3 越过窗口上界 ⇒ 超过 ttl denied。"""
    sess = _session(ttl=2)
    l1, v1 = append_frame([], _frame(1, "audio"), sess, _policy())
    assert v1["verdict"] == ACCEPTED
    l2, v2 = append_frame(l1, _frame(2, "audio"), sess, _policy())
    assert v2["verdict"] == ACCEPTED
    l3, v3 = append_frame(l2, _frame(3, "audio"), sess, _policy())
    assert v3["verdict"] == DENIED
    assert "超过 ttl" in v3["reason"]
    assert v3["checks"]["ttl_window"] is False
    assert v3["direction"]
    assert l3 is l2


# ---------------------------------------------------------------------------
# 8. 未登记 kind
# ---------------------------------------------------------------------------


def test_unregistered_kind_is_denied():
    """kind 不在 registered_kinds ⇒ 未登记 kind denied，点名原因。"""
    v = evaluate_frame(_frame(1, "unknown"), _session(), _policy())
    assert v["verdict"] == DENIED
    assert "未登记 kind" in v["reason"]
    assert v["checks"]["kind_known"] is False
    assert v["direction"]


# ---------------------------------------------------------------------------
# 9. closed 后收到音频帧（状态机非法转移）
# ---------------------------------------------------------------------------


def test_closed_state_frame_is_denied():
    """state=closed（终态空集）后收到 audio 帧 ⇒ 状态机非法转移 denied。"""
    v = evaluate_frame(_frame(1, "audio"), _session(state="closed"), _policy())
    assert v["verdict"] == DENIED
    assert "状态机非法转移" in v["reason"]
    assert v["checks"]["state_legal"] is False
    assert v["direction"]


# ---------------------------------------------------------------------------
# 10. 失败后 ledger 不变（原子写入）
# ---------------------------------------------------------------------------


def test_all_failures_return_original_ledger():
    """多类失败都返回**入参原对象**、不留半行、且都给结构化 reason/direction。"""
    sess = _session(state="speaking")
    original: list = []
    bad_cases = [
        (_frame(1, "barge_in", fp=_sha("stale")), sess),  # 先用后动不符 unjudged
        ({"seq": 1, "kind": "audio"}, sess),  # 缺指纹 unjudged
        (_frame(1, "unknown"), sess),  # 未登记 kind denied
        (_frame(1, "audio"), _session(state="closed")),  # 非法转移 denied
    ]
    for fr, ss in bad_cases:
        new, v = append_frame(original, fr, ss, _policy())
        assert new is original
        assert new == []
        assert v["verdict"] not in (ACCEPTED, BARGED_IN)
        assert v["reason"]
        assert v["direction"]
        assert v["tier"]


# ---------------------------------------------------------------------------
# 11. 取不到当轮帧读数（§0.3 + 一轴超越）
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad_session",
    [
        {"state": "listening", "ttl": 10},  # 缺 current_frame_sha256
        {"state": "listening", "current_frame_sha256": "", "ttl": 10},  # 空指纹
        {"state": "listening", "current_frame_sha256": "not-a-sha", "ttl": 10},  # 非法指纹
    ],
)
def test_current_round_unavailable_is_unjudged(bad_session):
    """当轮读数取不到 ⇒ 一律 unjudged 阻断而非放行（对照流式能力缺此闸）。"""
    v = evaluate_frame(_frame(1, "audio"), bad_session, _policy())
    assert v["verdict"] == UNJUDGED
    assert "取不到当轮帧读数" in v["reason"]
    assert v["checks"]["current_round"] is False
    assert v["direction"]


# ---------------------------------------------------------------------------
# 12. 回放一致性
# ---------------------------------------------------------------------------


def test_replay_consistency():
    """正常账逐行回放：同一判据复核 verdict 稳定，TTL 单调递减。"""
    policy = _policy()
    sess = _session(ttl=10)
    ledger: list = []

    ledger, v1 = append_frame(ledger, _frame(1, "audio"), sess, policy)
    assert v1["verdict"] == ACCEPTED
    ledger, v2 = append_frame(ledger, _frame(2, "vad"), sess, policy)
    assert v2["verdict"] == ACCEPTED
    ledger, v3 = append_frame(
        ledger, _output_frame(3, "barge_in"), _session(state="speaking", ttl=10), policy
    )
    assert v3["verdict"] == BARGED_IN

    ok, fail = _replay(ledger, policy)
    assert ok is True
    assert fail is None
    assert [row["ttl_remaining"] for row in ledger] == [9, 8, 7]  # TTL 严格单调


# ---------------------------------------------------------------------------
# 13. 回放检出输出动作指纹被篡改（一轴超越：逐帧可审计）
# ---------------------------------------------------------------------------


def test_replay_detects_tampered_fingerprint():
    """篡改 barged_in 行的 frame_sha256（仍合型但非当轮）⇒ 回放判不一致。"""
    policy = _policy()
    sess = _session(state="speaking", ttl=10)
    ledger, v = append_frame([], _output_frame(1, "barge_in"), sess, policy)
    assert v["verdict"] == BARGED_IN

    tampered = [dict(ledger[0])]
    tampered[0]["frame_sha256"] = _sha("forged-round")
    ok, fail = _replay(tampered, policy)
    assert ok is False
    assert fail == 0  # 先用后动（V7）立即判出重放不一致
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

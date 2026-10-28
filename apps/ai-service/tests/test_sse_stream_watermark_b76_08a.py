# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-08a 票3:流式摄入的"ACK≠base"与缺口恢复分级 —— 生产侧判据钉子。

断言打在生产判据出口 app/core/sse_contract.py 的 StreamWatermark/apply_frame 上
(真正进生产组装的那份,不是平行导出)。三条核心断言与票面验收草案逐字同族:
  ① fromSeq != 本地 seq 的 delta ⇒ resync 且该 delta 不写入水位;
  ② ACK 已到但首帧未齐 ⇒ has_applied_base=False,任何 delta 都走 gap 分支;
  ③ 恢复期注入 online delta ⇒ 只置 post_recovery_gap_pending、不推进 seq。
"""

from importlib import import_module

sc = import_module("app.core.sse_contract")


def test_snapshot_with_nonzero_fromseq_is_invalid_frame():
    st = sc.StreamWatermark()
    d = sc.apply_frame(
        st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=7, to_seq=9
    )
    assert d.action == sc.ACTION_REJECT_INVALID_FRAME
    assert st.has_applied_base is False  # 畸形 snapshot 不得当基线


def test_gap_resync_delta_not_written_to_watermark():
    """① fromSeq != 本地 seq ⇒ resync,且该 delta 不推进水位。"""
    st = sc.StreamWatermark(subscription_id="sub-1")
    base = sc.apply_frame(
        st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=5
    )
    assert base.applied is True
    d = sc.apply_frame(
        st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=1, from_seq=9, to_seq=10
    )
    assert d.action == sc.ACTION_RESYNC
    assert d.applied is False
    assert st.last_seq == 5  # 该 delta 不写入水位
    assert st.has_applied_base is True


def test_continuous_frames_advance_watermark():
    st = sc.StreamWatermark(subscription_id="sub-1")
    sc.apply_frame(st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=5)
    for lo, hi in ((5, 6), (6, 7), (7, 8)):
        d = sc.apply_frame(st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=1, from_seq=lo, to_seq=hi)
        assert d.action == sc.ACTION_APPLY
    assert st.last_seq == 8


def test_ack_alone_does_not_establish_base():
    """② ACK 已到但首帧未齐:has_applied_base=False,任何 delta 都走 gap 分支。"""
    st = sc.StreamWatermark()
    sc.mark_admission_acked(st)
    assert st.admission_acked is True
    d = sc.apply_frame(
        st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=1, from_seq=0, to_seq=2
    )
    assert d.action == sc.ACTION_REJECT_NO_BASE
    assert st.has_applied_base is False
    assert st.last_seq is None  # 不得当成基线


def test_epoch_change_escalates_to_force_snapshot():
    st = sc.StreamWatermark(subscription_id="sub-1")
    sc.apply_frame(st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=5)
    d = sc.apply_frame(st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=2, from_seq=5, to_seq=6)
    assert d.action == sc.ACTION_FORCE_SNAPSHOT
    assert st.last_seq == 5  # 旧纪元帧不落水位


def test_subscription_generation_change_requires_resubscribe():
    st = sc.StreamWatermark(subscription_id="sub-1")
    sc.apply_frame(st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=5)
    d = sc.apply_frame(
        st,
        frame_kind=sc.FRAME_KIND_DELTA,
        log_epoch=1,
        from_seq=5,
        to_seq=6,
        subscription_id="sub-2",
    )
    assert d.action == sc.ACTION_RESUBSCRIBE


def test_online_delta_during_recovery_is_deferred():
    """③ 恢复期注入 online delta ⇒ 只置 post_recovery_gap_pending、不推进 seq。"""
    st = sc.StreamWatermark(subscription_id="sub-1")
    sc.apply_frame(st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=5)
    sc.begin_recovery(st, deadline_ms=300_000)
    d = sc.apply_frame(st, frame_kind=sc.FRAME_KIND_DELTA, log_epoch=1, from_seq=5, to_seq=6)
    assert d.action == sc.ACTION_DEFER_RECOVERY
    assert d.applied is False
    assert st.post_recovery_gap_pending is True
    assert st.last_seq == 5  # 水位不推进
    # 恢复结束:owned snapshot 落地即出恢复态,pending 归零
    sc.apply_frame(st, frame_kind=sc.FRAME_KIND_SNAPSHOT, log_epoch=1, from_seq=0, to_seq=7)
    assert st.recovering is False
    assert st.last_seq == 7
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

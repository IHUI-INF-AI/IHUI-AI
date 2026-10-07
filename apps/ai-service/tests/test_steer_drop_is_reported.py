# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815975:steer 队列的类型轴吸收 + 未消费显式回报(dropped 帧)。

正反成对(台账验收):
① 流结束时仍有 1 条未消费引导 ⇒ 客户端必须收到点名该条目的 dropped 通知;
② 全部消费完 ⇒ 不得发任何 dropped 帧(防做成"每条都喊");
③ 不可 inline 那条**之后**的普通引导仍不得被吸收(break 不得写成 continue)。
"""

from __future__ import annotations

import pytest

from app.routers.llm import (
    STEER_KINDS,
    _drain_inlineable_steers,
    _report_dropped_steers,
    _steer_dropped_frame,
    _steer_sessions,
    post_steer_message,
)


@pytest.fixture(autouse=True)
def _clean_steer_buckets():
    """每用例前后清空模块级 steer 注册表(单例 dict,防跨用例串桶)。"""
    _steer_sessions.clear()
    yield
    _steer_sessions.clear()


def _seed(session_id: str, *kinds: str) -> None:
    _steer_sessions[session_id] = [
        {"text": f"note-{i}", "queuedAt": f"2026-10-07T00:00:0{i}Z", "kind": k}
        for i, k in enumerate(kinds)
    ]


def test_type_axis_stops_at_non_inlineable_entry():
    """③ 队首 guide 可吸收,吸收在 control 条目前停;其后的 guide 同样不得被吸收。"""
    _seed("s1", "guide", "control", "guide")
    consumed = _drain_inlineable_steers("s1")
    assert [c["text"] for c in consumed] == ["note-0"]
    remaining = _steer_sessions["s1"]
    assert [r["kind"] for r in remaining] == ["control", "guide"]


def test_type_axis_absorbs_nothing_past_control_head():
    """③ 反面:control 打头 ⇒ 本轮什么都不吸收(break,不是 continue)。"""
    _seed("s2", "control", "guide")
    assert _drain_inlineable_steers("s2") == []
    assert len(_steer_sessions["s2"]) == 2


def test_all_inlineable_consumed_bucket_empty():
    """② 全部消费完 ⇒ 桶空,收口回报一帧不发。"""
    _seed("s3", "guide", "guide")
    consumed = _drain_inlineable_steers("s3")
    assert len(consumed) == 2
    assert _drain_inlineable_steers("s3") == []
    assert _report_dropped_steers("s3") == []


def test_missing_kind_defaults_to_guide():
    """历史条目(无 kind 字段)按 guide 兼容,不被类型轴误拦。"""
    _steer_sessions["s4"] = [{"text": "legacy", "queuedAt": "2026-10-07T00:00:00Z"}]
    consumed = _drain_inlineable_steers("s4")
    assert [c["text"] for c in consumed] == ["legacy"]


def test_dropped_report_names_each_entry():
    """① 收口时未消费条目 ⇒ 逐条 dropped 帧且点名 text/kind,control 在前顺序保持。"""
    _seed("s5", "guide", "control", "guide")
    _drain_inlineable_steers("s5")  # 只吃掉 note-0
    frames = _report_dropped_steers("s5")
    assert [f["phase"] for f in frames] == ["dropped", "dropped"]
    assert [f["text"] for f in frames] == ["note-1", "note-2"]
    assert [f["kind"] for f in frames] == ["control", "guide"]
    assert all(f["reason"] == "stream_closed_unconsumed" for f in frames)
    assert all(f["timestamp"] for f in frames)
    # 回报即摘桶:二次回报不再有帧(不做"每条都喊"的复读)
    assert _report_dropped_steers("s5") == []


def test_dropped_frame_reuses_registered_steer_event_shape():
    """dropped 帧复用已登记的 steer 事件名,phase/kind 为合法形状。"""
    frame = _steer_dropped_frame({"text": "t", "kind": "control", "queuedAt": "x"})
    assert frame["type"] == "steer"
    assert frame["phase"] == "dropped"
    assert frame["kind"] in STEER_KINDS


async def test_steer_endpoint_rejects_unknown_kind():
    """端点:kind 非法 ⇒ 422,不入队。"""
    resp = await post_steer_message("s6", {"text": "hi", "kind": "boom"})
    assert resp.status_code == 422
    assert "s6" not in _steer_sessions


async def test_steer_endpoint_stores_kind_and_defaults_guide():
    """端点:缺省 kind=guide;显式 control 原样入队(ACK 带 kind)。"""
    _steer_sessions["s7"] = []  # 桶由流生成器在流首创建,端点只往里追加
    resp_default = await post_steer_message("s7", {"text": "a"})
    assert resp_default == {"ok": True, "queued": 1, "kind": "guide"}
    resp_control = await post_steer_message("s7", {"text": "b", "kind": "control"})
    assert resp_control == {"ok": True, "queued": 2, "kind": "control"}
    assert [item["kind"] for item in _steer_sessions["s7"]] == ["guide", "control"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

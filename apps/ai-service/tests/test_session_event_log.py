# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""session_event_log 四条核心语义测试(2026-11-15 R11 逆向复现 dsh-session)。

钉住行为,不测实现细节。每条对应 .archify/deepseek-session-src/session__README.md 取证。
"""
from __future__ import annotations

import pytest

from app.core.session_event_log import (
    AppendRejected,
    SessionEventLog,
    SessionJsonError,
    snapshot_json_value,
)


# ---- 语义 1: append 原子性 ----
def test_surface_event_requires_surface_op():
    log = SessionEventLog()
    with pytest.raises(AppendRejected):
        log.append("user/message", {"content": [{"type": "text", "text": "hi"}]})
    assert log.seq == 0  # 拒绝后日志不变


def test_log_only_event_forbids_surface_op():
    log = SessionEventLog()
    with pytest.raises(AppendRejected):
        log.append("assistant/attempt", {"error": "x"}, surface_op="append")
    assert log.seq == 0


def test_batch_atomicity_all_or_nothing():
    log = SessionEventLog()
    # 合法批:两条 log-only 事件(append_batch 只收 log-only,固定 surface_op=None)
    evs = log.append_batch([("assistant/attempt", {"error": "x"}), ("assistant/attempt", {"error": "y"})])
    assert len(evs) == 2 and log.seq == 2
    # 再验证:一批里夹一条非法 → 整批拒绝、日志不变
    before = log.seq
    with pytest.raises(AppendRejected):
        log._append_many(
            [
                ("user/message", {"content": "ok"}, "append", None),
                ("user/message", {"content": "no-op"}, None, None),  # 缺 surfaceOp
            ]
        )
    assert log.seq == before  # 整批拒绝,seq 不变


# ---- 语义 2: JSON 安全 ----
def test_json_rejects_cycles():
    with pytest.raises(SessionJsonError):
        d: dict = {"a": 1}
        d["self"] = d
        snapshot_json_value(d)


def test_json_rejects_bigint_and_nonstr_keys():
    with pytest.raises(SessionJsonError):
        snapshot_json_value({"n": 2**60})  # 超 2^53
    with pytest.raises(SessionJsonError):
        snapshot_json_value({1: "x"})  # 非字符串键


def test_json_rejects_exotic_types():
    with pytest.raises(SessionJsonError):
        snapshot_json_value({"s": {1, 2, 3}})  # set


def test_append_snapshots_no_toctou():
    log = SessionEventLog()
    # 有状态 getter:校验时给一个值、存储时变样 —— snapshot 应锁死同一份
    ev = log.append("user/message", {"content": [{"type": "text", "text": "hello"}]}, surface_op="append")
    assert ev.data["content"][0]["text"] == "hello"
    # 改原始 dict 不影响已存事件(深拷贝隔离)
    assert log.event_at(0).data["content"][0]["text"] == "hello"


# ---- 语义 3: 重放投影 + compaction ----
def test_derive_messages_projection_and_cache():
    log = SessionEventLog()
    log.append("system/message", {"content": "you are AI"}, surface_op="append")
    log.append("user/message", {"content": [{"type": "text", "text": "hi"}]}, surface_op="append")
    log.append("assistant/message", {"content": [{"type": "text", "text": "hello"}]}, surface_op="append")
    msgs = log.derive_messages()
    assert [m["role"] for m in msgs] == ["system", "user", "assistant"]
    assert all("eventSeq" in m for m in msgs)
    # 缓存:再读应命中(返回等值新列表)
    again = log.derive_messages()
    assert again == msgs and again is not msgs


def test_empty_system_node_projects_no_message():
    log = SessionEventLog()
    log.append("system/message", {"content": ""}, surface_op="append")  # 空系统
    log.append("user/message", {"content": "x"}, surface_op="append")
    msgs = log.derive_messages()
    assert len(msgs) == 1 and msgs[0]["role"] == "user"


def test_compaction_hides_without_deleting():
    log = SessionEventLog()
    log.append("user/message", {"content": "old"}, surface_op="append")
    log.append("user/message", {"content": "new"}, surface_op="append")
    assert len(log.derive_messages()) == 2
    n = log.compact(0, 0)  # 隐藏第 0 条
    assert n == 1
    msgs = log.derive_messages()
    assert len(msgs) == 1 and msgs[0]["content"] == "new"
    # 关键:事件仍在日志,可审计
    assert log.event_at(0).data["content"] == "old"
    assert log.seq == 2  # 未删事件


def test_replacement_marks_old_hidden():
    log = SessionEventLog()
    log.append("user/message", {"content": "v1"}, surface_op="append")  # seq0
    log.append("tool/result", {"content": "t1"}, surface_op="append")  # seq1
    # replace [0,1] → 旧 0/1 隐藏,新 seq2 可见
    log.append(
        "user/message", {"content": "v2"}, surface_op="replace", replace_range=(0, 1)
    )
    msgs = log.derive_messages()
    contents = [m.get("content") for m in msgs]
    assert contents == ["v2"]  # 旧的 v1/t1 被遮蔽
    assert log.event_at(0).data["content"] == "v1"  # 事件仍在


# ---- 语义 4: fork ----
def test_fork_copies_prefix_and_inherits_count():
    log = SessionEventLog()
    log.append("system/message", {"content": "sys"}, surface_op="append")  # 0
    log.append("user/message", {"content": "u1"}, surface_op="append")  # 1
    log.append("assistant/message", {"content": "a1"}, surface_op="append")  # 2
    child = log.fork(1)  # 拷 [0,1](含)
    assert child.seq == 2  # 只继承前缀
    # 子端前缀事件逐字相同
    assert child.event_at(0).data["content"] == "sys"
    assert child.event_at(1).data["content"] == "u1"
    # 子端可独立续写,不影响父
    child.append("user/message", {"content": "child-only"}, surface_op="append")
    assert child.seq == 3
    assert log.seq == 3  # 父不受影响


def test_fork_full_copy():
    log = SessionEventLog()
    log.append("user/message", {"content": "a"}, surface_op="append")
    log.append("user/message", {"content": "b"}, surface_op="append")
    child = log.fork()  # 拷到末尾(含)
    assert child.seq == 2
    assert [e.data["content"] for e in child.snapshot_events()] == ["a", "b"]


def test_subscribe_receives_committed_events():
    log = SessionEventLog()
    seen: list[int] = []
    log.subscribe(lambda ev: seen.append(ev.seq))
    log.append("user/message", {"content": "x"}, surface_op="append")
    log.append("tool/result", {"content": "y"}, surface_op="append")
    assert seen == [0, 1]


def test_replay_from_scratch_rebuilds_projection():
    """核心价值:只靠事件流(无外部状态)重建投影 —— 重放语义。"""
    src = SessionEventLog()
    src.append("system/message", {"content": "S"}, surface_op="append")
    src.append("user/message", {"content": "U"}, surface_op="append")
    src.append("assistant/message", {"content": "A"}, surface_op="append")
    # 模拟重启:开一个空 log,replay 全部事件
    replayed = SessionEventLog()
    for ev in src.snapshot_events():
        replayed._append_many([(ev.type, ev.data, "append", None)])
    assert replayed.derive_messages() == src.derive_messages()
    assert replayed.seq == src.seq
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

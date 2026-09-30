# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-659 队列 durable admission 账本测试(2026-09-29 立项)。

票面判据逐条:
① 状态机 admitted → promoted / cancelled / discarded / failed,终态不可逆;
② 重启对账不得把 failed 改写成 discarded(逐字守);
③ kill 于 ACK 后(模拟进程重启)必留一行 discarded,不丢不改写;
④ promotion 与 user message 同事务的跨服务约束 → promoted_pending 桥,
   回调确认落 promoted,无确认重启判孤儿。
"""

import json

from app.core.queue_ledger import QueueLedger

# ---------------------------------------------------------------------------
# ① 状态机与终态不可逆
# ---------------------------------------------------------------------------


def test_happy_path_admit_ack_confirm(tmp_path):
    led = QueueLedger(tmp_path / "l.jsonl")
    assert led.record_admit("t1", "q1", text="你好", created_at=1700000000000)
    assert led.record_ack("t1", "q1")
    assert led.state_of("t1", "q1") == "promoted_pending"
    assert led.record_confirmed("t1", "q1")
    assert led.state_of("t1", "q1") == "promoted"


def test_cancel_from_admitted(tmp_path):
    led = QueueLedger(tmp_path / "l.jsonl")
    led.record_admit("t1", "q1")
    assert led.record_cancel("t1", "q1")
    assert led.state_of("t1", "q1") == "cancelled"


def test_terminal_states_irreversible(tmp_path):
    led = QueueLedger(tmp_path / "l.jsonl")
    led.record_admit("t1", "q1")
    led.record_ack("t1", "q1")
    led.record_confirmed("t1", "q1")
    # promoted(终态)之后任何事件一律拒写 —— 包括 discard / fail / ack。
    assert led.record_ack("t1", "q1") is False
    assert led.record_discard("t1", "q1") is False
    assert led.record_fail("t1", "q1") is False
    assert led.record_admit("t1", "q1") is False
    assert led.state_of("t1", "q1") == "promoted"
    # cancelled(终态)同样封死。
    led.record_admit("t2", "q2")
    led.record_cancel("t2", "q2")
    assert led.record_fail("t2", "q2") is False
    assert led.state_of("t2", "q2") == "cancelled"


def test_illegal_transition_rejected(tmp_path):
    led = QueueLedger(tmp_path / "l.jsonl")
    led.record_admit("t1", "q1")
    # admitted 不能一步跳 promoted(必须经 ack → confirm 的 pending 桥)。
    assert led.record_confirmed("t1", "q1") is False
    assert led.state_of("t1", "q1") == "admitted"
    # admitted 不能重复 admit。
    assert led.record_admit("t1", "q1") is False
    # admitted 不能直接 fail(fail 只属于已 ACK 项:轮没跑谈不上失败)。
    assert led.record_fail("t1", "q1") is False


# ---------------------------------------------------------------------------
# ③ 验收主用例:kill 于 ACK 后(模拟进程重启)必留一行 discarded
# ---------------------------------------------------------------------------


def test_kill_after_ack_leaves_discarded_line(tmp_path):
    """模拟:进程 A admit+ack 后被 kill;进程 B(新 QueueLedger 同路径)对账。"""
    path = tmp_path / "l.jsonl"
    proc_a = QueueLedger(path)
    proc_a.record_admit("t1", "q1", text="排队消息", created_at=1700000000000)
    proc_a.record_ack("t1", "q1")  # pop 即 ACK,此刻被 kill
    lines_before = path.read_text(encoding="utf-8").splitlines()

    proc_b = QueueLedger(path)  # 重启:回放
    result = proc_b.recover()
    assert result["discarded"] == [("t1", "q1")]
    assert proc_b.state_of("t1", "q1") == "discarded"

    # 必留一行 discarded:新行追加,原 admit/ack 行不丢不改写。
    lines_after = path.read_text(encoding="utf-8").splitlines()
    assert lines_after[: len(lines_before)] == lines_before
    last = json.loads(lines_after[-1])
    assert last["event"] == "discard"
    assert last["itemId"] == "q1"
    # 再重启一次:已是终态,不再产生新 discard 行(幂等,不改写)。
    proc_c = QueueLedger(path)
    assert proc_c.recover()["discarded"] == []
    assert proc_c.state_of("t1", "q1") == "discarded"


# ---------------------------------------------------------------------------
# ② 逐字守票面:重启不得把 failed 改写成 discarded
# ---------------------------------------------------------------------------


def test_recover_never_rewrites_failed_to_discarded(tmp_path):
    path = tmp_path / "l.jsonl"
    proc_a = QueueLedger(path)
    proc_a.record_admit("t1", "q1")
    proc_a.record_ack("t1", "q1")
    proc_a.record_fail("t1", "q1")  # 轮跑了但失败

    proc_b = QueueLedger(path)  # 重启
    result = proc_b.recover()
    assert result["failed_preserved"] == [("t1", "q1")]
    assert result["discarded"] == []
    assert proc_b.state_of("t1", "q1") == "failed"
    # 账本文件里不得出现该 item 的 discard 行。
    events = [json.loads(l)["event"] for l in path.read_text(encoding="utf-8").splitlines()]
    assert "discard" not in events


def test_recover_mixed_orphans_and_failed(tmp_path):
    """孤儿(admitted / promoted_pending)补 discarded;failed 原样;终态不动。"""
    led = QueueLedger(tmp_path / "l.jsonl")
    led.record_admit("t1", "a1")            # 从未 ACK → 孤儿
    led.record_admit("t1", "a2")
    led.record_ack("t1", "a2")              # ACK 后 kill → 孤儿
    led.record_admit("t1", "a3")
    led.record_ack("t1", "a3")
    led.record_fail("t1", "a3")             # failed → 保留
    led.record_admit("t1", "a4")
    led.record_cancel("t1", "a4")           # 终态 → 不动

    result = led.recover()
    assert sorted(result["discarded"]) == [("t1", "a1"), ("t1", "a2")]
    assert result["failed_preserved"] == [("t1", "a3")]
    snap = led.snapshot()
    assert snap[("t1", "a1")] == "discarded"
    assert snap[("t1", "a2")] == "discarded"
    assert snap[("t1", "a3")] == "failed"
    assert snap[("t1", "a4")] == "cancelled"


# ---------------------------------------------------------------------------
# 持久性与容错
# ---------------------------------------------------------------------------


def test_ledger_lines_survive_and_replay(tmp_path):
    """每行 flush+fsync:重启(新实例回放)后状态逐项还原。"""
    path = tmp_path / "l.jsonl"
    a = QueueLedger(path)
    a.record_admit("t1", "q1", text="正文", created_at=1)
    a.record_ack("t1", "q1")
    a.record_confirmed("t1", "q1")
    a.record_admit("t1", "q2")

    b = QueueLedger(path)
    assert b.state_of("t1", "q1") == "promoted"
    assert b.state_of("t1", "q2") == "admitted"
    rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines()]
    assert [r["event"] for r in rows] == ["admit", "ack", "confirm", "admit"]
    assert rows[0]["text"] == "正文"


def test_corrupt_lines_skipped_on_replay(tmp_path):
    """坏行跳过不抛错(沿用 message_history 容错降级)。"""
    path = tmp_path / "l.jsonl"
    a = QueueLedger(path)
    a.record_admit("t1", "q1")
    with path.open("a", encoding="utf-8") as f:
        f.write("{not json\n")
        f.write("[]\n")
    a.record_ack("t1", "q1")

    b = QueueLedger(path)
    assert b.state_of("t1", "q1") == "promoted_pending"


# ---------------------------------------------------------------------------
# 进程级单例(不触真实 ~/.ihui:预先注入临时实例)
# ---------------------------------------------------------------------------


def test_get_queue_ledger_singleton(monkeypatch, tmp_path):
    import app.core.queue_ledger as ql

    inst = ql.QueueLedger(tmp_path / "s.jsonl")
    monkeypatch.setattr(ql, "_ledger", inst)
    assert ql.get_queue_ledger() is inst
    assert ql.get_queue_ledger() is inst


# ---------------------------------------------------------------------------
# 接线冒烟:agent_engine 引入账本出口(import 级,不启动引擎)
# ---------------------------------------------------------------------------


def test_agent_engine_wired_to_ledger():
    import inspect

    from app.services import agent_engine

    src = inspect.getsource(agent_engine)
    # ACK / admit / cancel / fail 四个接线点都在(防接线被无声移除)。
    assert "record_ack(" in src
    assert "record_admit(" in src
    assert "record_cancel(" in src
    assert "record_fail(" in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

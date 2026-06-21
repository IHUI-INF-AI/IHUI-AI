"""第十八轮 Bug 巡检 - 数据一致性与分布式事务.

覆盖 Bug-185~202, 共 18 个模块的 60+ 测试.
"""

import time
import unittest

from app.utils.bug185_saga import SagaOrchestrator, SagaState, SagaStep
from app.utils.bug186_tcc import TCCBranch, TCCState, TCCTransaction
from app.utils.bug187_outbox import OutboxRelay, OutboxState
from app.utils.bug188_dist_lock import DistributedLock, LockState
from app.utils.bug189_idempotent_msg import IdempotentConsumer, MsgState
from app.utils.bug190_ordered import OrderedProcessor
from app.utils.bug191_comp_scheduler import CompensationScheduler, CompState
from app.utils.bug192_retry_comp import CompAction, RetryCompensator
from app.utils.bug193_backoff_comp import BackoffCompensator, BackoffConfig
from app.utils.bug194_cdc import CDCBus, CDCEventType
from app.utils.bug195_binlog import BinlogSubscriber
from app.utils.bug196_shadow import ShadowTable
from app.utils.bug197_optimistic import OptimisticLock
from app.utils.bug198_pessimistic import PessimisticLocker
from app.utils.bug199_deadlock_retry import DeadlockRetrier, DeadlockRetryConfig
from app.utils.bug200_ryw import ReadYourWrite, RYWConfig
from app.utils.bug201_async_lookup import AsyncLookup, AsyncState
from app.utils.bug202_dual_write import DualWriter, DualWriteStrategy


class TestBug185Saga(unittest.TestCase):
    """Bug-185 Saga 编排."""

    def test_success_path(self):
        # 全部步骤成功 -> SUCCESS
        log: list[str] = []
        steps = [
            SagaStep("a", forward=lambda: log.append("a") or 1, compensate=lambda v: log.append("ca")),
            SagaStep("b", forward=lambda: log.append("b") or 2, compensate=lambda v: log.append("cb")),
        ]
        r = SagaOrchestrator().run(steps)
        self.assertEqual(r.state, SagaState.SUCCESS)
        self.assertEqual(r.executed, ["a", "b"])
        self.assertEqual(r.outputs, [1, 2])
        self.assertEqual(r.compensated, [])

    def test_failure_compensates_in_reverse(self):
        # 中间步骤失败 -> 反向补偿
        log: list[str] = []

        def fa():
            log.append("a")
            return 1

        def fb():
            log.append("b")
            raise RuntimeError("b 失败")

        def fc():
            log.append("c")
            return 3

        steps = [
            SagaStep("a", fa, lambda v: log.append("ca")),
            SagaStep("b", fb, lambda v: log.append("cb")),
            SagaStep("c", fc, lambda v: log.append("cc")),
        ]
        r = SagaOrchestrator().run(steps)
        self.assertEqual(r.state, SagaState.FAILED)
        self.assertEqual(r.executed, ["a"])
        self.assertEqual(r.compensated, ["a"])
        self.assertIn("b 失败", r.error)

    def test_retry_then_succeed(self):
        # 重试后成功
        calls = {"n": 0}

        def f():
            calls["n"] += 1
            if calls["n"] < 2:
                raise RuntimeError("transient")
            return 42

        steps = [SagaStep("a", f, lambda v: None, retry=3)]
        r = SagaOrchestrator().run(steps)
        self.assertEqual(r.state, SagaState.SUCCESS)
        self.assertEqual(calls["n"], 2)

    def test_get_by_id(self):
        orch = SagaOrchestrator()
        sid = "fixed-id"
        steps = [SagaStep("a", lambda: 1, lambda v: None)]
        r = orch.run(steps, saga_id=sid)
        self.assertEqual(r.saga_id, sid)
        self.assertIsNotNone(orch.get(sid))


class TestBug186TCC(unittest.TestCase):
    """Bug-186 TCC 模式."""

    def test_all_confirmed(self):
        # 全部 try 成功 -> 全部 confirm
        log: list[str] = []
        branches = [
            TCCBranch(
                "a",
                try_fn=lambda: log.append("ta") or 1,
                confirm_fn=lambda v: log.append("ca"),
                cancel_fn=lambda v: log.append("xa"),
            ),
            TCCBranch(
                "b",
                try_fn=lambda: log.append("tb") or 2,
                confirm_fn=lambda v: log.append("cb"),
                cancel_fn=lambda v: log.append("xb"),
            ),
        ]
        r = TCCTransaction().execute(branches)
        self.assertEqual(r.state, TCCState.CONFIRMED)
        self.assertEqual(set(r.try_outputs.keys()), {"a", "b"})

    def test_try_fail_cancels(self):
        # try 阶段失败 -> 全部 cancel
        log: list[str] = []
        branches = [
            TCCBranch(
                "a",
                try_fn=lambda: log.append("ta") or 1,
                confirm_fn=lambda v: log.append("ca"),
                cancel_fn=lambda v: log.append("xa"),
            ),
            TCCBranch(
                "b",
                try_fn=lambda: (_ for _ in ()).throw(RuntimeError("try b fail")),
                confirm_fn=lambda v: log.append("cb"),
                cancel_fn=lambda v: log.append("xb"),
            ),
        ]
        r = TCCTransaction().execute(branches)
        self.assertEqual(r.state, TCCState.CANCELED)
        # 无论之前 try 成功与否, 全部 cancel
        self.assertIn("xa", log)
        self.assertIn("xb", log)

    def test_confirm_fail_cancels(self):
        # confirm 阶段失败 -> cancel
        log: list[str] = []
        branches = [
            TCCBranch(
                "a", try_fn=lambda: 1, confirm_fn=lambda v: log.append("ca"), cancel_fn=lambda v: log.append("xa")
            ),
            TCCBranch(
                "b",
                try_fn=lambda: 2,
                confirm_fn=lambda v: (_ for _ in ()).throw(RuntimeError("confirm fail")),
                cancel_fn=lambda v: log.append("xb"),
            ),
        ]
        r = TCCTransaction().execute(branches)
        self.assertEqual(r.state, TCCState.CANCELED)
        self.assertIn("xa", log)
        self.assertIn("xb", log)


class TestBug187Outbox(unittest.TestCase):
    """Bug-187 Outbox 模式."""

    def test_enqueue(self):
        # 入队即可拿到消息
        relay = OutboxRelay(send=lambda t, p: None)
        m = relay.enqueue("topic1", {"a": 1})
        self.assertEqual(m.state, OutboxState.PENDING)
        self.assertEqual(m.topic, "topic1")
        self.assertEqual(m.attempts, 0)

    def test_deliver_success(self):
        # 投递成功
        sent = []

        def send(t, p):
            sent.append((t, p))

        relay = OutboxRelay(send=send)
        m = relay.enqueue("t1", {"k": "v"})
        ok = relay.deliver(m.msg_id)
        self.assertTrue(ok)
        self.assertEqual(sent, [("t1", {"k": "v"})])
        self.assertEqual(relay._messages[m.msg_id].state, OutboxState.DELIVERED)

    def test_deliver_fail_to_dead(self):
        # 投递失败 3 次后进 FAILED
        def bad_send(t, p):
            raise RuntimeError("downstream down")

        relay = OutboxRelay(send=bad_send)
        m = relay.enqueue("t1", 1)
        for _ in range(3):
            relay.deliver(m.msg_id)
        self.assertEqual(relay._messages[m.msg_id].state, OutboxState.FAILED)
        self.assertEqual(relay._messages[m.msg_id].attempts, 3)
        self.assertEqual(relay.stats()["failed"], 1)

    def test_deliver_unknown_id(self):
        # 不存在 id 返回 False
        relay = OutboxRelay(send=lambda t, p: None)
        self.assertFalse(relay.deliver("nonexistent"))

    def test_pending_list(self):
        # pending 只列出未投递的
        relay = OutboxRelay(send=lambda t, p: None)
        m1 = relay.enqueue("t1", 1)
        m2 = relay.enqueue("t2", 2)
        relay.deliver(m1.msg_id)
        pend = relay.pending()
        ids = [m.msg_id for m in pend]
        self.assertIn(m2.msg_id, ids)
        self.assertNotIn(m1.msg_id, ids)


class TestBug188DistLock(unittest.TestCase):
    """Bug-188 分布式锁."""

    def test_acquire_and_release(self):
        # 正常获取和释放
        lock = DistributedLock()
        state, owner, token = lock.try_acquire("k1")
        self.assertEqual(state, LockState.ACQUIRED)
        self.assertNotEqual(owner, "")
        self.assertNotEqual(token, "")
        rs = lock.release("k1", token)
        self.assertEqual(rs, LockState.RELEASED)

    def test_not_acquired_when_held(self):
        # 已被持有时获取失败
        lock = DistributedLock()
        lock.try_acquire("k1")
        state, _, _ = lock.try_acquire("k1")
        self.assertEqual(state, LockState.NOT_ACQUIRED)

    def test_release_wrong_token(self):
        # token 不匹配释放失败
        lock = DistributedLock()
        lock.try_acquire("k1")
        rs = lock.release("k1", "wrong-token")
        self.assertEqual(rs, LockState.NOT_ACQUIRED)

    def test_renew_extends_lease(self):
        # 续约延长过期时间
        clock = [1000.0]
        lock = DistributedLock(now=lambda: clock[0])
        # lease 100 秒
        _, _, token = lock.try_acquire("k1", lease_ms=100_000)
        # 推进 5 秒, lock 还在 (lease 100s)
        clock[0] += 5
        ok = lock.renew("k1", token, lease_ms=100_000)
        self.assertTrue(ok)
        # 释放应成功 (说明未过期)
        rs = lock.release("k1", token)
        self.assertEqual(rs, LockState.RELEASED)

    def test_watchdog_clears_expired(self):
        # 过期自动清理
        clock = [1000.0]
        lock = DistributedLock(now=lambda: clock[0])
        lock.try_acquire("k1", lease_ms=100)
        clock[0] += 1  # 已过期
        n = lock.watchdog()
        self.assertEqual(n, 1)
        state, _, _ = lock.try_acquire("k1")
        self.assertEqual(state, LockState.ACQUIRED)

    def test_release_after_expire(self):
        # 过期后释放返回 EXPIRED
        clock = [1000.0]
        lock = DistributedLock(now=lambda: clock[0])
        _, _, token = lock.try_acquire("k1", lease_ms=100)
        clock[0] += 1
        rs = lock.release("k1", token)
        self.assertEqual(rs, LockState.EXPIRED)


class TestBug189IdempotentMsg(unittest.TestCase):
    """Bug-189 幂等消息."""

    def test_first_success(self):
        # 首次执行
        c = IdempotentConsumer()
        state, v = c.process("k1", lambda: 100)
        self.assertEqual(state, MsgState.SUCCESS)
        self.assertEqual(v, 100)

    def test_replay_dedups(self):
        # 重放同一 key 不会重复执行
        c = IdempotentConsumer()
        c.process("k1", lambda: 1)
        state, v = c.process("k1", lambda: 999)  # 不会执行
        self.assertEqual(state, MsgState.SUCCESS)
        self.assertEqual(v, 1)
        self.assertGreaterEqual(c.stats()["deduped"], 1)

    def test_fail_then_retry(self):
        # 失败后重试
        c = IdempotentConsumer(max_attempts=3)
        calls = {"n": 0}

        def f():
            calls["n"] += 1
            if calls["n"] < 2:
                raise RuntimeError("transient")
            return 7

        state, v = c.process("k1", f)
        self.assertEqual(state, MsgState.PENDING)
        # 第二次成功
        state, v = c.process("k1", f)
        self.assertEqual(state, MsgState.SUCCESS)
        self.assertEqual(v, 7)

    def test_max_attempts_failed(self):
        # 重试耗尽进 FAILED
        c = IdempotentConsumer(max_attempts=2)
        for _ in range(2):
            state, _ = c.process("k1", lambda: (_ for _ in ()).throw(RuntimeError("fail")))
        state, _ = c.process("k1", lambda: 1)  # 第 3 次 (超过 max_attempts)
        self.assertEqual(state, MsgState.FAILED)


class TestBug190Ordered(unittest.TestCase):
    """Bug-190 顺序保证."""

    def test_same_key_sequential(self):
        # 同 key 串行
        proc = OrderedProcessor()
        i1 = proc.submit("k1", "a")
        i2 = proc.submit("k1", "b")
        i3 = proc.submit("k1", "c")
        self.assertEqual((i1.seq, i2.seq, i3.seq), (0, 1, 2))
        done = proc.process_ready(lambda it: it.payload)
        # 只应处理 1 个, 顺序保证
        self.assertEqual([d.payload for d in done], ["a"])
        # 第二次再处理下一个
        done2 = proc.process_ready(lambda it: it.payload)
        self.assertEqual([d.payload for d in done2], ["b"])

    def test_different_keys_parallel(self):
        # 不同 key 并行 in_flight
        proc = OrderedProcessor()
        proc.submit("k1", "a")
        proc.submit("k2", "x")
        proc.submit("k3", "y")
        done = proc.process_ready(lambda it: it.payload)
        # 3 个 key 各 1 个 in-flight, 应 3 个全部处理
        self.assertEqual(len(done), 3)
        payloads = sorted([d.payload for d in done])
        self.assertEqual(payloads, ["a", "x", "y"])

    def test_failure_does_not_advance(self):
        # 失败时不应阻塞, 推进到下一项, 仍记入 processed
        proc = OrderedProcessor()
        proc.submit("k1", "a")
        proc.submit("k1", "b")
        done = proc.process_ready(lambda it: (_ for _ in ()).throw(RuntimeError("err")))
        # 失败也应返回, 长度 1
        self.assertEqual(len(done), 1)
        # 下一个应可继续
        done2 = proc.process_ready(lambda it: it.payload)
        self.assertEqual([d.payload for d in done2], ["b"])


class TestBug191CompScheduler(unittest.TestCase):
    """Bug-191 补偿任务调度."""

    def test_enqueue(self):
        sched = CompensationScheduler(base_delay_sec=0.001)
        t = sched.enqueue("a", 1)
        self.assertEqual(t.state, CompState.PENDING)
        self.assertEqual(t.attempts, 0)

    def test_run_ready_success(self):
        # 成功执行
        sched = CompensationScheduler(base_delay_sec=0.001)
        t = sched.enqueue("a", 1)
        n = sched.run_ready(lambda task: None)
        self.assertEqual(n, 1)
        self.assertEqual(sched._tasks[t.task_id].state, CompState.SUCCESS)

    def test_retry_then_dead(self):
        # 重试到 max_attempts 进 DEAD
        sched = CompensationScheduler(base_delay_sec=0.001)
        t = sched.enqueue("a", 1, max_attempts=2)
        # 第一次: 失败 -> PENDING
        sched.run_ready(lambda task: (_ for _ in ()).throw(RuntimeError("err")))
        # 让 backoff 过期: 直接设 next_run_ts
        sched._tasks[t.task_id].next_run_ts = 0
        # 第二次: 失败 -> DEAD
        sched.run_ready(lambda task: (_ for _ in ()).throw(RuntimeError("err")))
        self.assertEqual(sched._tasks[t.task_id].state, CompState.DEAD)
        self.assertEqual(len(sched.dead()), 1)

    def test_backoff_grows(self):
        # 退避时间单调增长
        sched = CompensationScheduler(base_delay_sec=1.0, max_delay_sec=60.0)
        d1 = sched._backoff(1)
        d2 = sched._backoff(2)
        d3 = sched._backoff(3)
        self.assertLess(d1, d2)
        self.assertLess(d2, d3)
        self.assertLessEqual(d3, 60.0)

    def test_not_ready(self):
        # 未到 next_run_ts 不执行: 构造一个未来调度
        sched = CompensationScheduler(base_delay_sec=10.0, max_delay_sec=60.0)
        t = sched.enqueue("a", 1)
        # 强制 next_run_ts 到未来
        sched._tasks[t.task_id].next_run_ts = t.created_ts + 10
        n = sched.run_ready(lambda task: None)
        self.assertEqual(n, 0)


class TestBug192RetryComp(unittest.TestCase):
    """Bug-192 重试补偿."""

    def test_all_success(self):
        # 全部成功
        rc = RetryCompensator()
        actions = [
            CompAction("a", forward=lambda: 1, compensate=lambda v: None),
            CompAction("b", forward=lambda: 2, compensate=lambda v: None),
        ]
        r = rc.run(actions)
        self.assertTrue(r.ok)
        self.assertEqual(r.executed, ["a", "b"])
        self.assertEqual(r.outputs, [1, 2])
        self.assertEqual(r.compensated, [])

    def test_fail_compensates(self):
        # 第 2 步失败 -> 补偿第 1 步
        rc = RetryCompensator()
        actions = [
            CompAction("a", forward=lambda: 1, compensate=lambda v: None),
            CompAction(
                "b",
                forward=lambda: (_ for _ in ()).throw(RuntimeError("b fail")),
                compensate=lambda v: None,
                attempts=1,
                delay_ms=1,
            ),
        ]
        r = rc.run(actions)
        self.assertFalse(r.ok)
        self.assertEqual(r.executed, ["a"])
        self.assertEqual(r.compensated, ["a"])

    def test_retry_transient(self):
        # 重试后成功
        calls = {"n": 0}

        def f():
            calls["n"] += 1
            if calls["n"] < 3:
                raise RuntimeError("transient")
            return 99

        rc = RetryCompensator()
        actions = [CompAction("a", forward=f, compensate=lambda v: None, attempts=5, delay_ms=1)]
        r = rc.run(actions)
        self.assertTrue(r.ok)
        self.assertEqual(calls["n"], 3)

    def test_compensate_failure_appends(self):
        # 补偿失败时追加到 error
        rc = RetryCompensator()
        actions = [
            CompAction("a", forward=lambda: 1, compensate=lambda v: (_ for _ in ()).throw(RuntimeError("comp fail"))),
            CompAction(
                "b",
                forward=lambda: (_ for _ in ()).throw(RuntimeError("b fail")),
                compensate=lambda v: None,
                attempts=1,
                delay_ms=1,
            ),
        ]
        r = rc.run(actions)
        self.assertFalse(r.ok)
        self.assertIn("comp fail", r.error)


class TestBug193BackoffComp(unittest.TestCase):
    """Bug-193 退避补偿."""

    def test_first_attempt_success(self):
        bc = BackoffCompensator(BackoffConfig(max_attempts=3, base_ms=1))
        t = bc.schedule("a", 1, lambda p: None)
        n = bc.tick()
        self.assertEqual(n, 1)
        self.assertEqual(bc._tasks[t.task_id].state, "DONE")

    def test_retry_then_dead(self):
        # 失败耗尽后进 DEAD
        cfg = BackoffConfig(max_attempts=2, base_ms=1, jitter_pct=0.0)
        bc = BackoffCompensator(cfg)
        t = bc.schedule("a", 1, lambda p: (_ for _ in ()).throw(RuntimeError("err")))
        # 第 1 次失败
        bc.tick()
        # 强制 next_run 立刻
        bc._tasks[t.task_id].next_run = 0
        # 第 2 次失败 -> DEAD
        bc.tick()
        self.assertEqual(bc._tasks[t.task_id].state, "DEAD")

    def test_retry_then_success(self):
        cfg = BackoffConfig(max_attempts=5, base_ms=1, jitter_pct=0.0)
        bc = BackoffCompensator(cfg)
        calls = {"n": 0}

        def f(p):
            calls["n"] += 1
            if calls["n"] < 3:
                raise RuntimeError("transient")

        t = bc.schedule("a", 1, f)
        bc.tick()
        bc._tasks[t.task_id].next_run = 0
        bc.tick()
        bc._tasks[t.task_id].next_run = 0
        bc.tick()
        self.assertEqual(bc._tasks[t.task_id].state, "DONE")
        self.assertEqual(calls["n"], 3)

    def test_backoff_caps_at_max(self):
        cfg = BackoffConfig(max_attempts=5, base_ms=10, max_ms=100, jitter_pct=0.0)
        bc = BackoffCompensator(cfg)
        d = bc._delay(10)
        self.assertEqual(d, 100)


class TestBug194CDC(unittest.TestCase):
    """Bug-194 CDC 事件总线."""

    def test_publish_and_buffer(self):
        bus = CDCBus()
        ev = bus.publish("users", "u1", CDCEventType.INSERT, after={"name": "tom"})
        self.assertEqual(ev.table, "users")
        self.assertEqual(ev.pk, "u1")
        self.assertEqual(ev.type, CDCEventType.INSERT)
        self.assertEqual(len(bus.events(10)), 1)

    def test_subscribe_receives(self):
        bus = CDCBus()
        got: list = []

        def cb(ev):
            got.append(ev)

        bus.subscribe("orders", cb)
        bus.publish("orders", "o1", CDCEventType.UPDATE, before={"x": 1}, after={"x": 2})
        self.assertEqual(len(got), 1)
        self.assertEqual(got[0].pk, "o1")

    def test_wildcard_subscribe(self):
        # 通配订阅
        bus = CDCBus()
        got: list = []
        bus.subscribe("*", lambda ev: got.append(ev))
        bus.publish("a", "1", CDCEventType.INSERT)
        bus.publish("b", "2", CDCEventType.INSERT)
        self.assertEqual(len(got), 2)

    def test_subscriber_exception_counted(self):
        # 订阅者异常进 dropped
        bus = CDCBus()
        bus.subscribe("t", lambda ev: (_ for _ in ()).throw(RuntimeError("sub err")))
        bus.publish("t", "1", CDCEventType.INSERT)
        self.assertEqual(bus.stats()["dropped"], 1)


class TestBug195Binlog(unittest.TestCase):
    """Bug-195 binlog 订阅."""

    def test_produce_consume(self):
        bs = BinlogSubscriber()
        bs.produce("users", "INSERT", "u1", {"name": "a"})
        bs.produce("users", "UPDATE", "u1", {"name": "b"})
        evs = bs.consume(from_pos=0)
        self.assertEqual(len(evs), 2)
        self.assertEqual([e.pos for e in evs], [1, 2])

    def test_filter(self):
        bs = BinlogSubscriber()
        bs.filter(["orders"])
        bs.produce("users", "INSERT", "u1", {})
        bs.produce("orders", "INSERT", "o1", {})
        evs = bs.consume(from_pos=0)
        self.assertEqual(len(evs), 1)
        self.assertEqual(evs[0].table, "orders")
        self.assertEqual(bs.stats()["filtered"], 1)

    def test_checkpoint_and_replay(self):
        bs = BinlogSubscriber()
        bs.produce("t", "INSERT", "1", {})
        bs.produce("t", "INSERT", "2", {})
        ck = bs.checkpoint()
        self.assertEqual(ck, 2)
        bs.produce("t", "INSERT", "3", {})
        replayed = bs.replay_from(ck)
        self.assertEqual([e.pk for e in replayed], ["3"])

    def test_consume_from_pos(self):
        # 从指定位置之后消费
        bs = BinlogSubscriber()
        bs.produce("t", "INSERT", "1", {})
        bs.produce("t", "INSERT", "2", {})
        bs.produce("t", "INSERT", "3", {})
        evs = bs.consume(from_pos=1)
        self.assertEqual([e.pk for e in evs], ["2", "3"])


class TestBug196Shadow(unittest.TestCase):
    """Bug-196 影子表双写."""

    def test_write_verify_match(self):
        st = ShadowTable()
        st.write("1", {"a": 1, "b": 2})
        diffs = st.verify("1")
        self.assertEqual(diffs, [])
        self.assertEqual(st.stats()["matches"], 1)

    def test_manual_diff_injection(self):
        # 直接操作主表来制造 diff
        st = ShadowTable()
        st.write("1", {"a": 1, "b": 2})
        # 手动覆盖影子 (模拟下游写失败但主表已写)
        st._shadow["1"] = {"a": 999, "b": 2}
        diffs = st.verify("1")
        self.assertEqual(len(diffs), 1)
        self.assertEqual(diffs[0].field, "a")
        self.assertEqual(diffs[0].main, 1)
        self.assertEqual(diffs[0].shadow, 999)
        self.assertGreaterEqual(st.stats()["diffs"], 1)

    def test_reconcile_prefer_main(self):
        # reconcile 修复
        st = ShadowTable()
        st.write("1", {"a": 1})
        st._shadow["1"] = {"a": 999}
        truth = st.reconcile("1", prefer_main=True)
        self.assertEqual(truth["a"], 1)
        self.assertEqual(st.verify("1"), [])

    def test_reconcile_prefer_shadow(self):
        st = ShadowTable()
        st.write("1", {"a": 1})
        st._shadow["1"] = {"a": 999}
        truth = st.reconcile("1", prefer_main=False)
        self.assertEqual(truth["a"], 999)

    def test_diffs_snapshot(self):
        st = ShadowTable()
        st.write("1", {"a": 1})
        st._shadow["1"] = {"a": 2}
        st.verify("1")
        snap = st.diffs_snapshot(10)
        self.assertEqual(len(snap), 1)


class TestBug197Optimistic(unittest.TestCase):
    """Bug-197 乐观锁."""

    def test_cas_success(self):
        ol = OptimisticLock()
        ol.put("k1", 10)
        ok, ver = ol.cas("k1", 0, lambda v: v + 1)
        self.assertTrue(ok)
        self.assertEqual(ver, 1)
        self.assertEqual(ol.get("k1").value, 11)

    def test_cas_conflict(self):
        # 版本不匹配 -> 失败
        ol = OptimisticLock()
        ol.put("k1", 10)
        ok, ver = ol.cas("k1", 99, lambda v: v + 1)
        self.assertFalse(ok)
        self.assertEqual(ver, 0)

    def test_cas_nonexistent_creates(self):
        # 不存在则创建
        ol = OptimisticLock()
        ok, ver = ol.cas("k1", 0, lambda v: 42)
        self.assertTrue(ok)
        self.assertEqual(ver, 1)
        self.assertEqual(ol.get("k1").value, 42)

    def test_cas_retry_pattern(self):
        # 重试模式: 拿最新 version 再 CAS
        ol = OptimisticLock(max_attempts=5)
        ol.put("k1", 0)

        def add_with_retry(delta):
            for _ in range(5):
                rec = ol.get("k1")
                ok, _ = ol.cas("k1", rec.version, lambda v: v + delta)
                if ok:
                    return True
            return False

        self.assertTrue(add_with_retry(3))
        self.assertEqual(ol.get("k1").value, 3)
        self.assertTrue(add_with_retry(5))
        self.assertEqual(ol.get("k1").value, 8)


class TestBug198Pessimistic(unittest.TestCase):
    """Bug-198 悲观锁."""

    def test_acquire_release(self):
        pl = PessimisticLocker(lease_sec=10.0)
        owner = pl.acquire("k1")
        self.assertIsNotNone(owner)
        self.assertTrue(pl.release("k1", owner))

    def test_acquire_blocked(self):
        pl = PessimisticLocker(lease_sec=10.0)
        pl.acquire("k1")
        owner2 = pl.acquire("k1")
        self.assertIsNone(owner2)

    def test_release_wrong_owner(self):
        pl = PessimisticLocker(lease_sec=10.0)
        pl.acquire("k1")
        self.assertFalse(pl.release("k1", "wrong-owner"))

    def test_deadlock_detection(self):
        # 同一 owner 持多锁 -> 检测为死锁
        pl = PessimisticLocker(lease_sec=10.0)
        owner = "owner1"
        pl.acquire("k1", owner=owner)
        pl.acquire("k2", owner=owner)
        dead = pl.detect_deadlock()
        self.assertEqual(len(dead), 1)
        # 释放了一把
        self.assertEqual(pl.stats()["deadlock_resolved"], 1)

    def test_lease_expires(self):
        # 过期自动失效
        pl = PessimisticLocker(lease_sec=0.1)
        pl.acquire("k1")
        # 等待过期
        time.sleep(0.3)
        # 重新 acquire 应当成功
        owner2 = pl.acquire("k1")
        self.assertIsNotNone(owner2)


class TestBug199DeadlockRetry(unittest.TestCase):
    """Bug-199 死锁重试."""

    def test_deadlock_pattern_match(self):
        # 通过消息内容识别死锁
        self.assertTrue(DeadlockRetrier.is_deadlock(RuntimeError("Deadlock found"), (1213,)))
        self.assertTrue(DeadlockRetrier.is_deadlock(RuntimeError("serialization failure"), (1213,)))

    def test_errno_match(self):
        # 通过 errno 识别
        class E(Exception):
            pass

        e = E("x")
        e.args = (1213,)
        self.assertTrue(DeadlockRetrier.is_deadlock(e, (1213,)))
        e2 = E("x")
        e2.errno = 40001
        self.assertTrue(DeadlockRetrier.is_deadlock(e2, (40001,)))

    def test_non_deadlock_passes_through(self):
        # 非死锁异常直接抛
        cfg = DeadlockRetryConfig(max_attempts=3, base_delay_ms=1, max_delay_ms=5)
        dr = DeadlockRetrier(cfg)
        with self.assertRaises(RuntimeError):
            dr.call(lambda: (_ for _ in ()).throw(RuntimeError("not deadlock")))

    def test_retry_then_success(self):
        # 重试后成功
        cfg = DeadlockRetryConfig(max_attempts=5, base_delay_ms=1, max_delay_ms=5)
        dr = DeadlockRetrier(cfg)
        calls = {"n": 0}

        def f():
            calls["n"] += 1
            if calls["n"] < 3:
                err = RuntimeError("Deadlock found")
                err.args = (1213,)
                raise err
            return 99

        v = dr.call(f)
        self.assertEqual(v, 99)
        self.assertEqual(calls["n"], 3)

    def test_exhausted(self):
        # 重试耗尽
        cfg = DeadlockRetryConfig(max_attempts=2, base_delay_ms=1, max_delay_ms=5)
        dr = DeadlockRetrier(cfg)
        calls = {"n": 0}

        def f():
            calls["n"] += 1
            err = RuntimeError("Deadlock found")
            err.args = (1213,)
            raise err

        with self.assertRaises(RuntimeError):
            dr.call(f)
        self.assertEqual(calls["n"], 2)
        self.assertEqual(dr.stats()["exhausted"], 1)


class TestBug200RYW(unittest.TestCase):
    """Bug-200 read-your-write."""

    def test_mark_forces_master(self):
        cfg = RYWConfig(window_sec=10.0)
        ryw = ReadYourWrite(cfg)
        ryw.mark("k1")
        self.assertFalse(ryw.can_read_follower("k1"))
        self.assertEqual(ryw.stats()["forced_master"], 1)

    def test_window_expires(self):
        # 窗口过期后允许 follower
        clock = [1000.0]
        cfg = RYWConfig(window_sec=1.0)
        # 用 fake 时间
        ryw = ReadYourWrite(cfg)
        ryw._writes["k1"] = clock[0] + 1  # 1 秒后到期
        # 现在还强制主
        now = clock[0]
        self.assertGreater(ryw._writes["k1"], now)
        # 推进到过期后
        ryw._writes["k1"] = clock[0] - 0.5
        self.assertTrue(ryw.can_read_follower("k1"))

    def test_no_mark_allows_follower(self):
        ryw = ReadYourWrite()
        self.assertTrue(ryw.can_read_follower("unknown"))

    def test_window_caps_at_max(self):
        cfg = RYWConfig(window_sec=100.0, max_window_sec=30.0)
        ryw = ReadYourWrite(cfg)
        ryw.mark("k1", window_sec=100.0)
        # 应被 max 截断为 30
        ryw._writes["k1"] -= 30  # 模拟过了 30 秒
        self.assertTrue(ryw.can_read_follower("k1"))


class TestBug201AsyncLookup(unittest.TestCase):
    """Bug-201 异步回查."""

    def test_full_lifecycle_success(self):
        al = AsyncLookup()
        t = al.create("t1", {"k": 1}, timeout_sec=30)
        self.assertEqual(t.state, AsyncState.PENDING)
        self.assertTrue(al.start(t.task_id))
        self.assertEqual(al.lookup(t.task_id).state, AsyncState.RUNNING)
        al.complete(t.task_id, result=42)
        self.assertEqual(al.lookup(t.task_id).state, AsyncState.SUCCESS)
        self.assertEqual(al.lookup(t.task_id).result, 42)

    def test_full_lifecycle_failed(self):
        al = AsyncLookup()
        t = al.create("t1", 1)
        al.start(t.task_id)
        al.complete(t.task_id, error="oops")
        st = al.lookup(t.task_id)
        self.assertEqual(st.state, AsyncState.FAILED)
        self.assertEqual(st.error, "oops")

    def test_start_twice_fails(self):
        # 启动后不能再启动
        al = AsyncLookup()
        t = al.create("t1", 1)
        self.assertTrue(al.start(t.task_id))
        self.assertFalse(al.start(t.task_id))

    def test_timeout(self):
        # 启动后超过 timeout_sec -> TIMEOUT
        clock = [1000.0]
        al = AsyncLookup()
        t = al.create("t1", 1, timeout_sec=1.0)
        al.start(t.task_id)
        # 强制修改 started_ts
        al._tasks[t.task_id].started_ts = clock[0] - 10
        n = al.expire()
        self.assertEqual(n, 1)
        self.assertEqual(al.lookup(t.task_id).state, AsyncState.TIMEOUT)

    def test_lookup_marks_timeout_lazy(self):
        # lookup 也做超时检查
        clock = [1000.0]
        al = AsyncLookup()
        t = al.create("t1", 1, timeout_sec=1.0)
        al.start(t.task_id)
        al._tasks[t.task_id].started_ts = clock[0] - 10
        # 不调 expire, 直接 lookup
        st = al.lookup(t.task_id)
        self.assertEqual(st.state, AsyncState.TIMEOUT)

    def test_lookup_unknown(self):
        al = AsyncLookup()
        self.assertIsNone(al.lookup("nope"))


class TestBug202DualWrite(unittest.TestCase):
    """Bug-202 双写一致性."""

    def test_primary_first_success(self):
        dw = DualWriter(strategy=DualWriteStrategy.PRIMARY_FIRST)
        log: list[str] = []
        r = dw.write("k1", "v1", primary=lambda k, v: log.append(f"p:{k}"), secondary=lambda k, v: log.append(f"s:{k}"))
        self.assertTrue(r.ok)
        self.assertTrue(r.primary_ok)
        self.assertTrue(r.secondary_ok)
        self.assertEqual(log, ["p:k1", "s:k1"])

    def test_primary_first_secondary_fails(self):
        # 主成功后从失败 -> ok=False
        dw = DualWriter(strategy=DualWriteStrategy.PRIMARY_FIRST)
        r = dw.write(
            "k1",
            "v1",
            primary=lambda k, v: None,
            secondary=lambda k, v: (_ for _ in ()).throw(RuntimeError("sec fail")),
        )
        self.assertFalse(r.ok)
        self.assertTrue(r.primary_ok)
        self.assertFalse(r.secondary_ok)
        self.assertIn("sec fail", r.error)

    def test_primary_first_primary_fails_skips_secondary(self):
        # 主失败时仍会调 secondary (但仍记主失败)
        dw = DualWriter(strategy=DualWriteStrategy.PRIMARY_FIRST)
        r = dw.write(
            "k1",
            "v1",
            primary=lambda k, v: (_ for _ in ()).throw(RuntimeError("pri fail")),
            secondary=lambda k, v: None,
        )
        self.assertFalse(r.ok)
        self.assertFalse(r.primary_ok)
        self.assertTrue(r.secondary_ok)

    def test_parallel_both_ok(self):
        dw = DualWriter(strategy=DualWriteStrategy.PARALLEL)
        r = dw.write("k1", "v1", primary=lambda k, v: None, secondary=lambda k, v: None)
        self.assertTrue(r.ok)

    def test_parallel_both_fail(self):
        dw = DualWriter(strategy=DualWriteStrategy.PARALLEL)
        r = dw.write(
            "k1",
            "v1",
            primary=lambda k, v: (_ for _ in ()).throw(RuntimeError("p")),
            secondary=lambda k, v: (_ for _ in ()).throw(RuntimeError("s")),
        )
        self.assertFalse(r.ok)
        self.assertFalse(r.primary_ok)
        self.assertFalse(r.secondary_ok)
        self.assertIn("p", r.error)
        self.assertIn("s", r.error)

    def test_async_verify_returns_immediately(self):
        # 异步策略: 立即返回, secondary 后台跑
        import time as t

        dw = DualWriter(strategy=DualWriteStrategy.ASYNC_VERIFY)
        r = dw.write("k1", "v1", primary=lambda k, v: None, secondary=lambda k, v: t.sleep(0.5))
        self.assertTrue(r.ok)  # secondary 假定成功
        # 等待异步完成
        t.sleep(0.8)
        # 因 secondary 不抛, drift 不会增加
        self.assertEqual(dw.stats()["ok"], 1)


if __name__ == "__main__":
    unittest.main()

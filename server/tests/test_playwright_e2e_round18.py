"""第十八轮 数据一致性与分布式事务 端到端测试 (Bug-185 ~ Bug-202).

6 维度巡检端到端验证:
  - 分布式事务模式: Bug-185 Saga 编排 / Bug-186 TCC 模式 / Bug-187 Outbox 模式
  - 分布式锁与幂等: Bug-188 分布式锁 / Bug-189 幂等消息 / Bug-190 顺序保证
  - 补偿任务:        Bug-191 补偿调度 / Bug-192 重试补偿 / Bug-193 退避补偿
  - 数据同步:        Bug-194 CDC / Bug-195 binlog / Bug-196 影子表
  - 锁与重试:        Bug-197 乐观锁 / Bug-198 悲观锁 / Bug-199 死锁重试
  - 一致性保证:      Bug-200 read-your-write / Bug-201 异步回查 / Bug-202 双写一致性
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("ENV", "test")
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# =====================================================================
# 维度 1: 分布式事务模式
# =====================================================================
class TestTxPatternE2E:
    def test_bug185_saga_compensation_chain(self):
        """订单支付 + 库存扣减 + 物流下单, 中间失败回滚已成功步骤."""
        from app.utils.bug185_saga import SagaOrchestrator, SagaStep

        log: list = []
        orch = SagaOrchestrator()
        steps = [
            SagaStep(
                "扣款", forward=lambda: log.append("deduct") or 100, compensate=lambda v: log.append(f"refund:{v}")
            ),
            SagaStep(
                "扣库存",
                forward=lambda: log.append("dec_stock") or 5,
                compensate=lambda v: log.append(f"add_stock:{v}"),
            ),
            SagaStep(
                "创建物流单",
                forward=lambda: (_ for _ in ()).throw(RuntimeError("物流服务不可用")),
                compensate=lambda v: log.append("cancel_logistics"),
            ),
        ]
        r = orch.run(steps, saga_id="order_001")
        assert r.state.value == "FAILED"
        assert "deduct" in log
        assert "refund:100" in log
        assert "add_stock:5" in log
        assert "物流服务不可用" in r.error

    def test_bug186_tcc_try_confirm_cancel(self):
        """账户扣款 + 红包扣减 + 积分扣减, TCC 三阶段全流程."""
        from app.utils.bug186_tcc import TCCBranch, TCCTransaction

        log: list = []
        branches = [
            TCCBranch(
                "account",
                try_fn=lambda: log.append("try_acc") or "res_acc",
                confirm_fn=lambda v: log.append(f"confirm_acc:{v}"),
                cancel_fn=lambda v: log.append("cancel_acc"),
            ),
            TCCBranch(
                "coupon",
                try_fn=lambda: log.append("try_coupon") or "res_coupon",
                confirm_fn=lambda v: log.append(f"confirm_coupon:{v}"),
                cancel_fn=lambda v: log.append("cancel_coupon"),
            ),
        ]
        r = TCCTransaction().execute(branches, tx_id="pay_001")
        assert r.state.value == "CONFIRMED"
        assert "try_acc" in log
        assert "confirm_acc:res_acc" in log
        assert "confirm_coupon:res_coupon" in log

    def test_bug187_outbox_atomic(self):
        """下单事务 outbox, 异步发送, 失败重试到 FAILED."""
        from app.utils.bug187_outbox import OutboxRelay

        sent: list = []

        def send(topic, payload):
            if payload.get("fail"):
                raise RuntimeError("downstream")
            sent.append((topic, payload))

        relay = OutboxRelay(send=send)
        m1 = relay.enqueue("order.created", {"order_id": 1})
        m2 = relay.enqueue("order.created", {"order_id": 2, "fail": True})
        # 投递
        relay.deliver(m1.msg_id)
        relay.deliver(m2.msg_id)
        relay.deliver(m2.msg_id)
        relay.deliver(m2.msg_id)
        # m1 成功, m2 第 3 次入 FAILED
        assert sent == [("order.created", {"order_id": 1})]
        st = relay.stats()
        assert st["delivered"] == 1
        assert st["failed"] == 1


# =====================================================================
# 维度 2: 分布式锁与幂等
# =====================================================================
class TestLockIdempotentE2E:
    def test_bug188_dist_lock_mutual_exclusion(self):
        """分布式锁互斥 + 续约 + watchdog."""
        from app.utils.bug188_dist_lock import DistributedLock

        lock = DistributedLock()
        s1, o1, t1 = lock.try_acquire("order:1:process")
        assert s1.value == "ACQUIRED"
        s2, _, _ = lock.try_acquire("order:1:process")
        assert s2.value == "NOT_ACQUIRED"
        # 续约
        assert lock.renew("order:1:process", t1, lease_ms=5000)
        # 释放
        rs = lock.release("order:1:process", t1)
        assert rs.value == "RELEASED"
        # 可被重新获取
        s3, _, _ = lock.try_acquire("order:1:process")
        assert s3.value == "ACQUIRED"

    def test_bug189_idempotent_msg_exactly_once(self):
        """消息幂等: 同 key 多次处理只执行 1 次, 失败可重试."""
        from app.utils.bug189_idempotent_msg import IdempotentConsumer

        consumer = IdempotentConsumer(max_attempts=3)
        n = {"c": 0}

        def fn():
            n["c"] += 1
            if n["c"] < 2:
                raise RuntimeError("transient")
            return {"order": 1, "amount": 99}

        # 失败 1 次, 成功 1 次
        consumer.process("msg_001", fn)
        st, v = consumer.process("msg_001", fn)
        assert st.value == "SUCCESS"
        assert v["amount"] == 99
        # 第 3 次直接返回缓存
        st2, v2 = consumer.process("msg_001", fn)
        assert st2.value == "SUCCESS"
        assert v2 == v
        assert n["c"] == 2  # 只真正执行 2 次

    def test_bug190_ordered_per_key(self):
        """顺序保证: 同 partition 串行, 不同 partition 并行."""
        from app.utils.bug190_ordered import OrderedProcessor

        proc = OrderedProcessor()
        # 同一 partition 提交 3 个
        proc.submit("user:1", 1)
        proc.submit("user:1", 2)
        proc.submit("user:1", 3)
        # 不同 partition 提交 1 个
        proc.submit("user:2", 100)
        # 第一轮: 每个 partition 1 个 in-flight, 共 2 个
        done = proc.process_ready(lambda it: it.payload)
        assert len(done) == 2
        # 第二轮: user:1 推进到 seq=1, user:2 已完
        done2 = proc.process_ready(lambda it: it.payload)
        payloads = [d.payload for d in done2]
        assert 2 in payloads
        # 第三轮: user:1 推进到 seq=2
        done3 = proc.process_ready(lambda it: it.payload)
        assert [d.payload for d in done3] == [3]


# =====================================================================
# 维度 3: 补偿任务
# =====================================================================
class TestCompensationE2E:
    def test_bug191_comp_scheduler_lifecycle(self):
        """补偿调度: 失败重试 + 死信队列."""
        from app.utils.bug191_comp_scheduler import CompensationScheduler

        sched = CompensationScheduler(base_delay_sec=0.001, max_delay_sec=0.01)
        # 永远失败的任务 -> 应进入 DEAD
        t = sched.enqueue("retry_forever", 1, max_attempts=2)
        # 手工推进 next_run_ts
        for _ in range(3):
            sched._tasks[t.task_id].next_run_ts = 0
            sched.run_ready(lambda task: (_ for _ in ()).throw(RuntimeError("err")))
        assert sched._tasks[t.task_id].state.value == "DEAD"
        assert len(sched.dead()) == 1

    def test_bug192_retry_comp_with_compensation(self):
        """重试补偿链: 第 1 步成功, 第 2 步失败, 反向补偿第 1 步."""
        from app.utils.bug192_retry_comp import CompAction, RetryCompensator

        log: list = []
        actions = [
            CompAction(
                "扣款", forward=lambda: log.append("deduct") or 100, compensate=lambda v: log.append(f"refund:{v}")
            ),
            CompAction(
                "发短信",
                forward=lambda: (_ for _ in ()).throw(RuntimeError("SMS 失败")),
                compensate=lambda v: log.append("cancel_sms"),
                attempts=1,
                delay_ms=1,
            ),
        ]
        r = RetryCompensator().run(actions)
        assert not r.ok
        assert log == ["deduct", "refund:100"]

    def test_bug193_backoff_jitter(self):
        """退避补偿: 指数退避 + jitter, max_attempts 进 DEAD."""
        from app.utils.bug193_backoff_comp import BackoffCompensator, BackoffConfig

        cfg = BackoffConfig(max_attempts=3, base_ms=1, max_ms=10, jitter_pct=0.0)
        bc = BackoffCompensator(cfg)
        t = bc.schedule("无限重试", 1, lambda p: (_ for _ in ()).throw(RuntimeError("err")))
        # 跑 3 次 tick (max_attempts=3)
        for _ in range(3):
            bc._tasks[t.task_id].next_run = 0
            bc.tick()
        assert bc._tasks[t.task_id].state == "DEAD"
        assert bc.stats()["dead"] == 1


# =====================================================================
# 维度 4: 数据同步
# =====================================================================
class TestDataSyncE2E:
    def test_bug194_cdc_publish_subscribe(self):
        """CDC 事件: 业务表 INSERT/UPDATE/DELETE 推送给订阅者."""
        from app.utils.bug194_cdc import CDCBus, CDCEventType

        bus = CDCBus()
        received: list = []
        bus.subscribe("users", lambda ev: received.append(ev))
        bus.publish("users", "u1", CDCEventType.INSERT, after={"name": "tom"})
        bus.publish("users", "u1", CDCEventType.UPDATE, before={"name": "tom"}, after={"name": "jerry"})
        bus.publish("users", "u1", CDCEventType.DELETE, before={"name": "jerry"})
        assert len(received) == 3
        assert [e.type.value for e in received] == ["INSERT", "UPDATE", "DELETE"]
        # 事件快照
        evs = bus.events(10)
        assert len(evs) == 3

    def test_bug195_binlog_position_checkpoint(self):
        """binlog 位点推进 + checkpoint + replay."""
        from app.utils.bug195_binlog import BinlogSubscriber

        bs = BinlogSubscriber()
        bs.produce("orders", "INSERT", "o1", {"amount": 100})
        bs.produce("orders", "UPDATE", "o1", {"amount": 200})
        bs.produce("orders", "INSERT", "o2", {"amount": 300})
        # checkpoint
        ck = bs.checkpoint()
        assert ck == 3
        # 再来 2 个
        bs.produce("orders", "UPDATE", "o2", {"amount": 400})
        bs.produce("orders", "INSERT", "o3", {"amount": 500})
        # 从 ck 重放 -> 应拿到 2 个
        replayed = bs.replay_from(ck)
        assert len(replayed) == 2
        assert [e.pk for e in replayed] == ["o2", "o3"]

    def test_bug196_shadow_reconcile(self):
        """影子表: 双写 + 校验 + 自动修复."""
        from app.utils.bug196_shadow import ShadowTable

        st = ShadowTable()
        # 写入 3 行
        st.write("u1", {"name": "tom", "age": 20})
        st.write("u2", {"name": "jerry", "age": 22})
        st.write("u3", {"name": "alice", "age": 25})
        # 模拟 u1 主从不一致
        st._shadow["u1"] = {"name": "tom", "age": 21}
        diffs = st.verify("u1")
        assert len(diffs) == 1
        assert diffs[0].field == "age"
        # 修复 (prefer_main)
        st.reconcile("u1", prefer_main=True)
        assert st.verify("u1") == []
        st_snap = st.diffs_snapshot(10)
        assert len(st_snap) == 1


# =====================================================================
# 维度 5: 锁与重试
# =====================================================================
class TestLockRetryE2E:
    def test_bug197_optimistic_cas_retry(self):
        """乐观锁: CAS 更新 + 失败重试."""
        from app.utils.bug197_optimistic import OptimisticLock

        ol = OptimisticLock(max_attempts=5)
        ol.put("stock:item1", 100)

        def dec_stock():
            rec = ol.get("stock:item1")
            ok, ver = ol.cas("stock:item1", rec.version, lambda v: v - 1)
            return ok, ver

        ok1, _ = dec_stock()
        ok2, _ = dec_stock()
        ok3, _ = dec_stock()
        assert ok1 and ok2 and ok3
        assert ol.get("stock:item1").value == 97

    def test_bug198_pessimistic_deadlock_detect(self):
        """悲观锁: 加锁 + 死锁检测 + 释放."""
        from app.utils.bug198_pessimistic import PessimisticLocker

        pl = PessimisticLocker(lease_sec=10.0)
        owner1 = pl.acquire("k1", owner="worker1")
        assert owner1 == "worker1"
        # 同一 owner 取多锁 -> 触发死锁
        pl.acquire("k2", owner="worker1")
        dead = pl.detect_deadlock()
        assert len(dead) == 1
        assert pl.stats()["deadlock_resolved"] == 1

    def test_bug199_deadlock_retry(self):
        """死锁重试: 异常码匹配 + 退避 + 抖动."""
        from app.utils.bug199_deadlock_retry import DeadlockRetrier, DeadlockRetryConfig

        cfg = DeadlockRetryConfig(max_attempts=5, base_delay_ms=1, max_delay_ms=5)
        dr = DeadlockRetrier(cfg)
        n = {"c": 0}

        def fn():
            n["c"] += 1
            if n["c"] < 3:
                # PostgreSQL SQLSTATE 40P01 = deadlock_detected
                err = RuntimeError("Deadlock found when trying to get lock")
                err.args = ("40P01",)
                raise err
            return "success"

        v = dr.call(fn)
        assert v == "success"
        assert n["c"] == 3
        assert dr.stats()["success"] == 1
        # 非死锁直接抛
        try:
            dr.call(lambda: (_ for _ in ()).throw(RuntimeError("普通错误")))
        except RuntimeError:
            pass


# =====================================================================
# 维度 6: 一致性保证
# =====================================================================
class TestConsistencyE2E:
    def test_bug200_read_your_write(self):
        """read-your-write: 写后窗口内强制主读."""
        from app.utils.bug200_ryw import ReadYourWrite, RYWConfig

        ryw = ReadYourWrite(RYWConfig(window_sec=10.0))
        # 写入 user:1
        ryw.mark("user:1")
        # 自己读: 强制主
        assert not ryw.can_read_follower("user:1")
        # 其他 key 可走从
        assert ryw.can_read_follower("user:2")
        # 窗口过期 (覆盖时间)
        ryw._writes["user:1"] = 0
        assert ryw.can_read_follower("user:1")

    def test_bug201_async_lookup_lifecycle(self):
        """异步回查: 5 态生命周期 PENDING/RUNNING/SUCCESS/FAILED/TIMEOUT."""
        from app.utils.bug201_async_lookup import AsyncLookup, AsyncState

        al = AsyncLookup()
        # 1) PENDING
        t = al.create("payment", {"order": 1}, timeout_sec=0.1)
        assert t.state == AsyncState.PENDING
        # 2) RUNNING
        assert al.start(t.task_id)
        assert al.lookup(t.task_id).state == AsyncState.RUNNING
        # 3) SUCCESS
        al.complete(t.task_id, result={"tx_id": "tx_001"})
        st = al.lookup(t.task_id)
        assert st.state == AsyncState.SUCCESS
        assert st.result["tx_id"] == "tx_001"
        # 4) FAILED (新任务)
        t2 = al.create("refund", {"order": 2})
        al.start(t2.task_id)
        al.complete(t2.task_id, error="银行通道维护")
        assert al.lookup(t2.task_id).state == AsyncState.FAILED
        # 5) TIMEOUT (新任务, 启动后过期)
        t3 = al.create("withdraw", {"order": 3}, timeout_sec=0.1)
        al.start(t3.task_id)
        al._tasks[t3.task_id].started_ts = 0
        al.expire()
        assert al.lookup(t3.task_id).state == AsyncState.TIMEOUT

    def test_bug202_dual_write_strategies(self):
        """双写一致性: PRIMARY_FIRST / PARALLEL / ASYNC_VERIFY 三策略."""
        from app.utils.bug202_dual_write import DualWriter, DualWriteStrategy

        log: list = []
        # PRIMARY_FIRST
        dw1 = DualWriter(strategy=DualWriteStrategy.PRIMARY_FIRST)
        r1 = dw1.write("k1", "v1", primary=lambda k, v: log.append("p"), secondary=lambda k, v: log.append("s"))
        assert r1.ok
        assert log == ["p", "s"]

        # PARALLEL (都成功)
        log2: list = []
        dw2 = DualWriter(strategy=DualWriteStrategy.PARALLEL)
        r2 = dw2.write("k2", "v2", primary=lambda k, v: log2.append("p"), secondary=lambda k, v: log2.append("s"))
        assert r2.ok
        # PARALLEL 顺序不定, 但都应执行
        assert set(log2) == {"p", "s"}

        # PRIMARY_FIRST secondary 失败
        dw3 = DualWriter(strategy=DualWriteStrategy.PRIMARY_FIRST)
        r3 = dw3.write(
            "k3",
            "v3",
            primary=lambda k, v: None,
            secondary=lambda k, v: (_ for _ in ()).throw(RuntimeError("从库挂了")),
        )
        assert not r3.ok
        assert r3.primary_ok
        assert not r3.secondary_ok


if __name__ == "__main__":
    import pytest

    pytest.main([__file__, "-v"])

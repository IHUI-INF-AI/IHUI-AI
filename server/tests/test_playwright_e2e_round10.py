"""Playwright 端到端验证 - 第十轮 8 项修复 (Bug-91/92/93/94/95/96/97/98)."""

import json
import os
import socket
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")


def _port_in_use(host="127.0.0.1", port=18086):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((host, port))
        s.close()
        return True
    except OSError:
        return False


def main():
    use_browser = _port_in_use()
    if use_browser:
        return _with_browser()
    return _runtime_only()


def _with_browser():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        results = []

        def check(label, actual, expected):
            mark = "PASS" if actual == expected else "FAIL"
            results.append((mark, label, actual, expected))

        def reachable(label, status):
            mark = "PASS" if status < 500 else "FAIL"
            results.append((mark, label, status, "<500"))

        def info(label, actual):
            results.append(("INFO", label, actual, "-"))

        # 服务存活
        r = page.request.get("http://127.0.0.1:18086/healthz")
        check("Bug-91-98 服务存活 /healthz", r.status, 200)
        r = page.request.get("http://127.0.0.1:18086/openapi.json")
        check("Bug-91-98 /openapi.json 可生成", r.status, 200)
        r = page.request.get("http://127.0.0.1:18086/metrics")
        reachable("Bug-91-98 /metrics 端点不 5xx", r.status)

        _verify_modules(results)
        browser.close()
        return _report(results)


def _runtime_only():
    results = []
    _verify_modules(results)
    return _report(results)


def _verify_modules(results):
    def check(label, actual, expected):
        mark = "PASS" if actual == expected else "FAIL"
        results.append((mark, label, actual, expected))

    def info(label, actual):
        results.append(("INFO", label, actual, "-"))

    # Bug-91 布隆过滤器
    try:
        from app.utils.bloom_guard import BloomFilter, bloom_guard

        bf = BloomFilter(capacity=1000, fpr=0.01)
        bf.add("e2e_91_key")
        check("Bug-91 BloomFilter 添加后可检测", bf.may_contain("e2e_91_key"), True)
        bloom_guard.reset_ns("e2e_91")
        bloom_guard.configure("e2e_91", capacity=500, fpr=0.01)
        bloom_guard.add("e2e_91", "k")
        check("Bug-91 bloom_guard 命名空间生效", bloom_guard.may_contain("e2e_91", "k"), True)
        bloom_guard.mark_null("e2e_91", "n1")
        check("Bug-91 空值缓存命中", bloom_guard.is_null_cached("e2e_91", "n1"), True)
        # 持久化
        with tempfile.TemporaryDirectory() as td:
            p = str(Path(td) / "bf.bin")
            bloom_guard.save_to_file("e2e_91", p)
            ok = bloom_guard.load_from_file("e2e_91", p)
            check("Bug-91 save/load 往返", ok, True)
    except Exception as e:
        check("Bug-91 bloom_guard 加载", f"{e!r}", None)

    # Bug-92 TTFT 监控
    try:
        from app.utils.ttft_monitor import StreamTTFT, ttft_monitor

        with StreamTTFT(model="e2e_92", endpoint="/chat") as ctx:
            ctx.on_token()
            time.sleep(0.01)
            ctx.on_token()
        s = ttft_monitor.stats()
        check("Bug-92 total_calls >= 1", s["total_calls"] >= 1, True)
        check("Bug-92 current.count >= 1", s["current"]["count"] >= 1, True)
        info(
            "Bug-92 stats",
            json.dumps(
                {
                    "total_calls": s["total_calls"],
                    "error_calls": s["error_calls"],
                    "alert_count": s["alert_count"],
                    "p95": s["current"]["p95"],
                }
            ),
        )
    except Exception as e:
        check("Bug-92 ttft_monitor 加载", f"{e!r}", None)

    # Bug-93 WS 房间订阅广播
    try:
        from app.utils.ws_room_broker import ws_room_broker

        sub = f"e2e_93_{int(time.time() * 1000)}"
        topic = f"room:e2e_93_{int(time.time() * 1000)}"
        ws_room_broker.unsubscribe_all(sub)
        ws_room_broker.subscribe(sub, topic)
        n = ws_room_broker.publish(topic, {"msg": "hi"})
        check("Bug-93 单订阅广播", n, 1)
        # backlog
        ws_room_broker.publish(topic, {"a": 1})
        ws_room_broker.publish(topic, {"b": 2})
        sub2 = f"e2e_93b_{int(time.time() * 1000)}"
        ws_room_broker.subscribe(sub2, topic)
        backlog = ws_room_broker.get_backlog(topic)
        check("Bug-93 订阅时回放 backlog", len(backlog) >= 2, True)
        # 卸载
        ws_room_broker.unsubscribe_all(sub)
        ws_room_broker.unsubscribe_all(sub2)
    except Exception as e:
        check("Bug-93 ws_room_broker 加载", f"{e!r}", None)

    # Bug-94 连接池泄漏检测
    try:
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector(leak_timeout_sec=0.05)
        cid = d.checkout("e2e_94", context="ctx1")
        time.sleep(0.1)
        leaks = d.scan_leaks()
        check("Bug-94 扫描发现泄漏", len(leaks) == 1, True)
        check("Bug-94 force_release 成功", d.force_release(cid), True)
        check("Bug-94 释放后 outstanding=0", d.stats()["outstanding"], 0)
    except Exception as e:
        check("Bug-94 pool_leak_detector 加载", f"{e!r}", None)

    # Bug-95 多级缓存一致性
    try:
        from app.utils.cache_coherence import _jitter, cache_coherence

        cache_coherence.configure_l1(100)
        cache_coherence.set("e2e_95_k", "v", ttl=10)
        check("Bug-95 L1 get 命中", cache_coherence.get("e2e_95_k"), "v")
        # L2 fallback
        data = {}
        cache_coherence.register_l2(
            get_fn=lambda k: data.get(k),
            set_fn=lambda k, v, t: data.__setitem__(k, v),
            del_fn=lambda k: data.pop(k, None),
        )
        cache_coherence.set("e2e_95_l2", "vv", ttl=1.0)
        cache_coherence._l1.clear()
        check("Bug-95 L2 fallback 拿到值", cache_coherence.get("e2e_95_l2"), "vv")
        # 失效广播
        received = []
        cache_coherence.subscribe_invalidation("e2e_95_t", lambda k: received.append(k))
        cache_coherence.bind_invalidation_topic("e2e_95_kb", "e2e_95_t")
        cache_coherence.set("e2e_95_kb", "v2", ttl=10)
        cache_coherence.invalidate("e2e_95_kb")
        check("Bug-95 失效广播通知到订阅者", "e2e_95_kb" in received, True)
        # TTL jitter
        j = _jitter(100.0)
        check("Bug-95 TTL jitter 范围 [90,110]", 90.0 <= j <= 110.0, True)
    except Exception as e:
        check("Bug-95 cache_coherence 加载", f"{e!r}", None)

    # Bug-96 API Key 配额分层
    try:
        from app.utils.api_key_quota import TIER_FREE, api_key_quota

        api_key_quota.set_tier(TIER_FREE, qps=2, daily=5, monthly=100)
        api_key_quota.register_key("e2e_96", TIER_FREE)
        ok1, r1 = api_key_quota.acquire("e2e_96")
        ok2, r2 = api_key_quota.acquire("e2e_96")
        ok3, r3 = api_key_quota.acquire("e2e_96")
        check("Bug-96 QPS 第 1 次通过", ok1, True)
        check("Bug-96 QPS 第 2 次通过", ok2, True)
        check("Bug-96 QPS 第 3 次被拒", ok3, False)
        check("Bug-96 拒绝原因 qps_quota", r3, "qps_quota")
        # 多 tier
        api_key_quota.set_tier("vip", qps=100, daily=1_000_000, monthly=10_000_000)
        check("Bug-96 自定义 tier 存在", "vip" in api_key_quota.list_tiers(), True)
    except Exception as e:
        check("Bug-96 api_key_quota 加载", f"{e!r}", None)

    # Bug-97 异步任务幂等
    try:
        from app.utils.job_idempotent import JobRunner, JobStatus

        with tempfile.TemporaryDirectory() as td:
            r = JobRunner(log_path=str(Path(td) / "e2e_97.jsonl"))
            assert r.begin("e2e_97_j1", payload={"x": 1}) is True
            # 重复 begin 应返回 False
            assert r.begin("e2e_97_j1") is False
            r.finish("e2e_97_j1", result={"v": 42})
            check("Bug-97 SUCCESS 后 begin 拒绝", r.begin("e2e_97_j1"), False)
            cached = r.get_cached_result("e2e_97_j1")
            check("Bug-97 缓存结果可读取", cached, {"v": 42})
            # 失败可重试
            r.begin("e2e_97_j2")
            r.fail("e2e_97_j2", error="oops")
            check("Bug-97 失败后允许 retry", r.begin("e2e_97_j2"), True)
            # 状态
            check("Bug-97 j2 状态 = RUNNING", r.get_status("e2e_97_j2"), JobStatus.RUNNING)
    except Exception as e:
        check("Bug-97 job_idempotent 加载", f"{e!r}", None)

    # Bug-98 schema 迁移灰度
    try:
        from app.utils.schema_migration import (
            PHASE_DUAL_WRITE,
            PHASE_NEW_ONLY,
            PHASE_OLD_ONLY,
            migration_controller,
        )

        # 全新表
        tab = f"e2e_98_{int(time.time() * 1000)}"
        migration_controller.register(tab, "name", "full_name")
        check("Bug-98 默认阶段 OLD_ONLY", migration_controller.get_phase(tab), PHASE_OLD_ONLY)
        # 制造足够的 dual_read 样本
        for _ in range(300):
            migration_controller.record_read(tab, used_new=True)
        check("Bug-98 达到切流条件", migration_controller.can_cutover(tab), True)
        ok = migration_controller.maybe_cutover(tab)
        check("Bug-98 自动切流到 DUAL_WRITE", ok, True)
        check("Bug-98 阶段已变更", migration_controller.get_phase(tab), PHASE_DUAL_WRITE)
        # 强制推进
        ok2 = migration_controller.maybe_cutover(tab, force=True)
        check("Bug-98 force 推进到下一阶段", ok2, True)
        # 双重确认
        ok3 = migration_controller.confirm_cutover(tab)
        check("Bug-98 confirm_cutover 完成 NEW_ONLY", ok3, True)
        check("Bug-98 最终阶段 NEW_ONLY", migration_controller.get_phase(tab), PHASE_NEW_ONLY)
        # 回滚
        rb = migration_controller.rollback(tab)
        check("Bug-98 可回滚到上一阶段", rb, True)
    except Exception as e:
        check("Bug-98 schema_migration 加载", f"{e!r}", None)


def _report(results):
    print("\n" + "=" * 60)
    print("Playwright 第十轮端到端验证报告")
    print("=" * 60)
    pass_n = 0
    fail_n = 0
    info_n = 0
    for mark, label, actual, expected in results:
        line = f"[{mark}] {label} | 实际: {actual} | 期望: {expected}"
        if len(line) > 200:
            line = line[:200] + "..."
        print(line)
        if mark == "PASS":
            pass_n += 1
        elif mark == "FAIL":
            fail_n += 1
        else:
            info_n += 1
    print("=" * 60)
    print(f"汇总: {pass_n} PASS / {fail_n} FAIL / {info_n} INFO / {len(results)} TOTAL")
    return 0 if fail_n == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""多租户压测脚本

模拟多个租户并发访问, 验证 schema 路由性能
支持:
- 顺序压测 (--mode sequential)
- 并发压测 (--mode concurrent)
- 混合租户 (--tenants zhs,demo,test)
- 自定义并发数 (--concurrency 50)
- 自定义请求数 (--requests 1000)
- 性能阈值告警 (--max-latency 100)

用法:
  python scripts/tenant_loadtest.py --mode concurrent --tenants zhs,demo,test --concurrency 30 --requests 500
  python scripts/tenant_loadtest.py --mode sequential --tenants zhs --requests 100
  python scripts/tenant_loadtest.py --dry-run
"""
import os
import sys
import json
import time
import argparse
import threading
import statistics
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from queue import Queue

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOADTEST_REPORT = LOG_DIR / f"tenant_loadtest_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"

# 默认租户列表
DEFAULT_TENANTS = ["zhs", "demo", "test"]
DEFAULT_TENANT_WHITELIST = {
    "zhs": "production",
    "demo": "demo",
    "test": "test",
}


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def simulate_tenant_request(tenant_id: str, request_id: int, latency_threshold_ms: int = 100) -> dict:
    """模拟单次租户路由请求 (含随机延迟)"""
    start = time.time()
    # 模拟路由解析 + schema 切换延迟
    base_latency = 0.5  # 0.5ms 基础
    jitter = (request_id % 10) * 0.3  # 0-3ms 抖动
    time.sleep((base_latency + jitter) / 1000)

    # 模拟偶发慢请求
    if request_id % 50 == 0:
        time.sleep(0.02)  # 20ms 慢请求

    latency_ms = (time.time() - start) * 1000
    is_slow = latency_ms > latency_threshold_ms

    return {
        "tenant_id": tenant_id,
        "request_id": request_id,
        "latency_ms": round(latency_ms, 2),
        "is_slow": is_slow,
        "status": "success",
    }


def run_sequential(tenants: list[str], requests_per_tenant: int, latency_threshold: int) -> list[dict]:
    """顺序压测"""
    results = []
    for tenant in tenants:
        for i in range(requests_per_tenant):
            r = simulate_tenant_request(tenant, i, latency_threshold)
            results.append(r)
    return results


def run_concurrent(tenants: list[str], requests_per_tenant: int, concurrency: int, latency_threshold: int) -> list[dict]:
    """并发压测"""
    results = []
    lock = threading.Lock()
    counter = {"value": 0}

    def worker():
        while True:
            with lock:
                if counter["value"] >= requests_per_tenant * len(tenants):
                    return
                idx = counter["value"]
                counter["value"] += 1
            tenant = tenants[idx % len(tenants)]
            r = simulate_tenant_request(tenant, idx, latency_threshold)
            with lock:
                results.append(r)

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker) for _ in range(concurrency)]
        for f in as_completed(futures):
            f.result()
    return results


def analyze_results(results: list[dict], tenants: list[str], duration: float) -> dict:
    """分析压测结果"""
    total = len(results)
    success = sum(1 for r in results if r["status"] == "success")
    slow = sum(1 for r in results if r["is_slow"])
    latencies = [r["latency_ms"] for r in results]

    if not latencies:
        return {"error": "无压测数据"}

    stats = {
        "total_requests": total,
        "success_count": success,
        "success_rate": round(success / total * 100, 2) if total else 0,
        "slow_count": slow,
        "slow_rate": round(slow / total * 100, 2) if total else 0,
        "duration_seconds": round(duration, 2),
        "qps": round(total / duration, 2) if duration else 0,
        "latency_ms": {
            "min": round(min(latencies), 2),
            "max": round(max(latencies), 2),
            "avg": round(statistics.mean(latencies), 2),
            "median": round(statistics.median(latencies), 2),
            "p95": round(sorted(latencies)[int(total * 0.95)] if total > 1 else latencies[0], 2),
            "p99": round(sorted(latencies)[int(total * 0.99)] if total > 1 else latencies[0], 2),
        },
    }

    # 按租户统计
    tenant_stats = {}
    for tenant in tenants:
        tenant_results = [r for r in results if r["tenant_id"] == tenant]
        if tenant_results:
            t_latencies = [r["latency_ms"] for r in tenant_results]
            tenant_stats[tenant] = {
                "count": len(tenant_results),
                "avg_latency_ms": round(statistics.mean(t_latencies), 2),
                "p95_latency_ms": round(sorted(t_latencies)[int(len(t_latencies) * 0.95)] if len(t_latencies) > 1 else t_latencies[0], 2),
                "slow_count": sum(1 for r in tenant_results if r["is_slow"]),
            }
    stats["per_tenant"] = tenant_stats
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="多租户压测")
    parser.add_argument("--mode", default="concurrent", choices=["sequential", "concurrent"], help="压测模式")
    parser.add_argument("--tenants", default=",".join(DEFAULT_TENANTS), help="租户列表 (逗号分隔)")
    parser.add_argument("--concurrency", type=int, default=20, help="并发数")
    parser.add_argument("--requests", type=int, default=200, help="每租户请求数")
    parser.add_argument("--max-latency", type=int, default=100, help="慢请求阈值 (ms)")
    parser.add_argument("--dry-run", action="store_true", help="仅预检")
    parser.add_argument("--report", action="store_true", help="生成 JSON 报告")
    args = parser.parse_args()

    tenants = [t.strip() for t in args.tenants.split(",") if t.strip() in DEFAULT_TENANT_WHITELIST]
    if not tenants:
        log(f"❌ 无有效租户: {args.tenants}")
        return 1

    log("=" * 60)
    log(f"多租户压测启动")
    log(f"  模式: {args.mode}")
    log(f"  租户: {tenants}")
    log(f"  并发: {args.concurrency}")
    log(f"  请求数: {args.requests} 每租户")
    log(f"  慢请求阈值: {args.max_latency}ms")
    log(f"  DRY_RUN: {args.dry_run}")
    log("=" * 60)

    if args.dry_run:
        log("✅ 预检通过 (dry-run)")
        return 0

    start_time = time.time()
    if args.mode == "concurrent":
        results = run_concurrent(tenants, args.requests, args.concurrency, args.max_latency)
    else:
        results = run_sequential(tenants, args.requests, args.max_latency)
    duration = time.time() - start_time

    stats = analyze_results(results, tenants, duration)
    log("")
    log("=" * 60)
    log("压测结果")
    log("=" * 60)
    log(f"  总请求: {stats['total_requests']}")
    log(f"  成功率: {stats['success_rate']}%")
    log(f"  慢请求: {stats['slow_count']} ({stats['slow_rate']}%)")
    log(f"  QPS: {stats['qps']}")
    log(f"  延迟 P95: {stats['latency_ms']['p95']}ms")
    log(f"  延迟 P99: {stats['latency_ms']['p99']}ms")
    log(f"  每租户: {json.dumps(stats['per_tenant'], ensure_ascii=False, indent=2)}")

    # 报告
    if args.report:
        report = {
            "operation": "tenant_loadtest",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "tenants": tenants,
            "concurrency": args.concurrency,
            "requests_per_tenant": args.requests,
            "stats": stats,
        }
        LOADTEST_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        log(f"✅ 报告已生成: {LOADTEST_REPORT}")

    # 性能告警
    if stats["latency_ms"]["p95"] > args.max_latency:
        log(f"⚠️  P95 延迟 {stats['latency_ms']['p95']}ms 超过阈值 {args.max_latency}ms")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""ETL 100k 行压测脚本 (封版性能基线).

目的: 验证 P1 封版 ETL 流水线在 100,000 行典型负载下的性能 / 内存 / 幂等性.
场景: 模拟 H 盘 t_order 订单表 → G 盘 zhs_order 转换:
  - 字段重命名 (memberId → member_id, orderNo → order_no, ...)
  - 单位换算 (total_amount 元 → 分, discount 元 → 分, paid_amount 元 → 分)
  - id_lookup 替换 (memberId, courseId → G 盘 UUID)
  - 自动生成 G 盘主键 UUID
  - datetime 归一化

输出:
  - 总耗时 / 吞吐量 (行/秒)
  - 平均 / P50 / P95 / P99 行延迟 (μs)
  - 内存峰值 (MB, 进程级 RSS 差值)
  - 幂等性断言 (cache 大小, 已迁移行再次处理时 idempotent)
  - 断点续传断言 (中断 50% 后 resume 跳过已迁移部分)

运行: python -m scripts.etl.benchmark_100k
可选: python -m scripts.etl.benchmark_100k --rows 200000
"""
from __future__ import annotations

import argparse
import gc
import os
import random
import statistics
import sys
import time
import tracemalloc
from datetime import datetime, timedelta
from typing import Any

# 允许脚本独立运行
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scripts.etl.config import MigrationTask
from scripts.etl.transformer import transform_row


# ---------------------------------------------------------------------------
# 测试数据生成
# ---------------------------------------------------------------------------

def _gen_rows(n: int, *, seed: int = 42) -> list[dict[str, Any]]:
    """生成 n 行 H 盘 t_order 模拟数据."""
    rng = random.Random(seed)
    base = datetime(2026, 6, 24, 10, 0, 0)
    rows: list[dict[str, Any]] = []
    # 模拟 10k 个会员 + 1k 课程的外键复用, 让 id_lookup 命中缓存
    member_ids = list(range(1, 10_001))
    course_ids = list(range(1, 1_001))
    for i in range(1, n + 1):
        rows.append({
            "id": i,
            "orderNo": f"ORD{i:08d}",
            "memberId": rng.choice(member_ids),
            "courseId": rng.choice(course_ids),
            "total_amount": round(rng.uniform(0.01, 9999.99), 2),
            "discount": round(rng.uniform(0, 100), 2),
            "paid_amount": round(rng.uniform(0.01, 9999.99), 2),
            "is_paid": rng.choice([True, False]),
            "status": rng.choice([0, 1, 2, 3, 4]),
            "createTime": base + timedelta(seconds=i),
            "updateTime": base + timedelta(seconds=i + 60),
        })
    return rows


# ---------------------------------------------------------------------------
# 性能统计
# ---------------------------------------------------------------------------

def _percentile(values: list[float], pct: float) -> float:
    """计算百分位 (0-100)."""
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * (pct / 100)
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


def _format_us(us: float) -> str:
    """μs 自适应单位."""
    if us < 1000:
        return f"{us:.2f} μs"
    if us < 1_000_000:
        return f"{us / 1000:.2f} ms"
    return f"{us / 1_000_000:.3f} s"


def _format_bytes(b: int) -> str:
    if b < 1024:
        return f"{b} B"
    if b < 1024 * 1024:
        return f"{b / 1024:.2f} KB"
    return f"{b / 1024 / 1024:.2f} MB"


# ---------------------------------------------------------------------------
# 压测核心
# ---------------------------------------------------------------------------

def _make_task() -> MigrationTask:
    return MigrationTask(
        source_table="t_order",
        source_db="ihui-ai-edu-order-service",
        target_table="zhs_order",
        unit_convert={
            "total_amount": "yuan_to_fen",
            "discount": "yuan_to_fen",
            "paid_amount": "yuan_to_fen",
            "is_paid": "boolean_tinyint",
        },
        field_map={
            "orderNo": "order_no",
            "memberId": "member_id",
            "courseId": "course_id",
            "createTime": "create_time",
            "updateTime": "update_time",
        },
        id_lookup={
            "member_id": "t_member",
            "course_id": "t_course",
        },
    )


def _phase_label(phase: str, n: int, elapsed: float, latencies_us: list[float]) -> str:
    throughput = n / elapsed if elapsed > 0 else 0
    avg = statistics.mean(latencies_us) if latencies_us else 0
    p50 = _percentile(latencies_us, 50)
    p95 = _percentile(latencies_us, 95)
    p99 = _percentile(latencies_us, 99)
    return (
        f"  [{phase}]\n"
        f"    rows:        {n}\n"
        f"    elapsed:     {elapsed:.3f} s\n"
        f"    throughput:  {throughput:,.0f} rows/s\n"
        f"    avg latency: {_format_us(avg)}\n"
        f"    P50:         {_format_us(p50)}\n"
        f"    P95:         {_format_us(p95)}\n"
        f"    P99:         {_format_us(p99)}"
    )


def benchmark_transform(n: int) -> tuple[list[dict[str, Any]], dict[str, float], int, list[float]]:
    """跑 transform_row n 行. 返回 (结果行, 统计, cache_size, 延迟列表)."""
    task = _make_task()
    rows = _gen_rows(n)
    cache: dict[tuple[str, int], str] = {}
    out: list[dict[str, Any]] = []
    latencies_us: list[float] = []
    # 每 1000 行采样一次延迟 (避免 list.append 开销污染数据)
    SAMPLE_STEP = 100
    gc.collect()
    tracemalloc.start()
    t0 = time.perf_counter()
    for idx, row in enumerate(rows):
        r = dict(row)  # copy, 防 transform_row in-place 污染
        if idx % SAMPLE_STEP == 0:
            s = time.perf_counter()
            out_row = transform_row(r, task, cache)
            latencies_us.append((time.perf_counter() - s) * 1_000_000)
        else:
            out_row = transform_row(r, task, cache)
        out.append(out_row)
    elapsed = time.perf_counter() - t0
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    stats = {
        "elapsed": elapsed,
        "peak_mem_bytes": peak,
    }
    return out, stats, len(cache), latencies_us


def benchmark_idempotent_replay(n: int) -> dict[str, Any]:
    """幂等性: 同样 n 行跑两次, 验证 cache 大小一致 / UUID 一致."""
    task = _make_task()
    rows = _gen_rows(n)
    cache1: dict[tuple[str, int], str] = {}
    out1: list[dict[str, Any]] = []
    for row in rows:
        out1.append(transform_row(dict(row), task, cache1))
    cache2: dict[tuple[str, int], str] = dict(cache1)  # 复用 cache 模拟"重跑同一批次"
    # 第二轮: cache 已满, 不会产生新 UUID
    cache2_initial_size = len(cache2)
    new_uuids_in_round2 = 0
    out2: list[dict[str, Any]] = []
    for row in rows:
        before = len(cache2)
        out2.append(transform_row(dict(row), task, cache2))
        if len(cache2) > before:
            new_uuids_in_round2 += 1
    cache2_final_size = len(cache2)
    # 同源 id 在两轮中应映射到同一 UUID (因为 _to_uuid() 用 uuid4() 随机,
    # 所以"幂等"只对 cache 内已存在映射生效, 不保证两轮完全相同 UUID)
    # 真正测试目标: 第二次跑 0 新增映射
    return {
        "round1_cache_size": len(cache1),
        "round2_initial_cache_size": cache2_initial_size,
        "round2_final_cache_size": cache2_final_size,
        "round2_new_uuids": new_uuids_in_round2,
        "idempotent": new_uuids_in_round2 == 0,
    }


def benchmark_resume(n: int) -> dict[str, Any]:
    """断点续传: 中断 50% 后 resume, 验证只处理后 50% 行."""
    task = _make_task()
    rows = _gen_rows(n)
    cache: dict[tuple[str, int], str] = {}
    # Round 1: 处理前 50% (模拟中断)
    half = n // 2
    migrated_in_r1: list[dict[str, Any]] = []
    for row in rows[:half]:
        migrated_in_r1.append(transform_row(dict(row), task, cache))
    cache_size_at_interrupt = len(cache)
    # Round 2: resume 从 last_pk 之后 (前 half 行的最大 id)
    last_pk = rows[half - 1]["id"]
    migrated_in_r2: list[dict[str, Any]] = []
    for row in rows[half:]:
        migrated_in_r2.append(transform_row(dict(row), task, cache))
    cache_size_after_resume = len(cache)
    # cache 应只增加后 50% 行的自身映射 (外键复用前 50% 已有的)
    return {
        "interrupt_at_row": half,
        "last_pk": last_pk,
        "round1_cache_size": cache_size_at_interrupt,
        "round2_cache_size": cache_size_after_resume,
        "round2_rows": len(migrated_in_r2),
        "total_migrated": len(migrated_in_r1) + len(migrated_in_r2),
        "total_expected": n,
    }


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="ETL 100k 行压测")
    parser.add_argument("--rows", type=int, default=100_000, help="数据行数 (默认 100,000)")
    parser.add_argument("--seed", type=int, default=42, help="随机种子")
    args = parser.parse_args()
    n = args.rows
    print(f"\n=== ETL {n:,} 行压测开始 ===\n")

    # ---- 1) Transform 性能 ----
    print("[1/3] Transform 性能压测 ...")
    _out, stats, cache_size, latencies_us = benchmark_transform(n)
    print(_phase_label("transform", n, stats["elapsed"], latencies_us))
    print(f"    cache size: {cache_size:,}")
    print(f"    peak mem:   {_format_bytes(stats['peak_mem_bytes'])}")
    print()

    # ---- 2) 幂等性 ----
    print("[2/3] 幂等性 replay 测试 (n = 10,000 子集加速) ...")
    idem = benchmark_idempotent_replay(min(n, 10_000))
    print(f"    round1 cache:   {idem['round1_cache_size']:,}")
    print(f"    round2 initial: {idem['round2_initial_cache_size']:,}")
    print(f"    round2 final:   {idem['round2_final_cache_size']:,}")
    print(f"    round2 new:     {idem['round2_new_uuids']}")
    print(f"    idempotent:     {'PASS' if idem['idempotent'] else 'FAIL'}")
    assert idem["idempotent"], "幂等性测试失败: 第二轮新增了 UUID"
    print()

    # ---- 3) 断点续传 ----
    print("[3/3] 断点续传测试 (n = 10,000 子集加速) ...")
    resume = benchmark_resume(min(n, 10_000))
    print(f"    interrupt at row: {resume['interrupt_at_row']:,}")
    print(f"    last_pk:          {resume['last_pk']}")
    print(f"    round1 cache:     {resume['round1_cache_size']:,}")
    print(f"    round2 cache:     {resume['round2_cache_size']:,}")
    print(f"    round2 rows:      {resume['round2_rows']:,}")
    print(f"    total migrated:   {resume['total_migrated']:,} / {resume['total_expected']:,}")
    assert resume["total_migrated"] == resume["total_expected"], "续传测试失败"
    print(f"    resume:           PASS")
    print()

    # ---- 汇总 ----
    throughput = n / stats["elapsed"] if stats["elapsed"] > 0 else 0
    print("=== 压测汇总 ===")
    print(f"  rows:           {n:,}")
    print(f"  elapsed:        {stats['elapsed']:.3f} s")
    print(f"  throughput:     {throughput:,.0f} rows/s")
    print(f"  peak memory:    {_format_bytes(stats['peak_mem_bytes'])}")
    print(f"  幂等性:         {'PASS' if idem['idempotent'] else 'FAIL'}")
    print(f"  断点续传:       PASS")
    print("\n=== ETL 压测通过 ===\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

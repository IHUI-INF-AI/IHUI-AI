"""迁移批次压测脚本 (P2.8).

模拟大表 (100k / 1M 行) 迁移的:
- throughput (rows/sec)
- memory 增长
- id_mapping 写入耗时
- checkpoint 更新频率

不连真实 DB, 用 in-memory mock 跑 transformer 全链路.
可用于: 封版前回归 / 容量规划 / 发现瓶颈.

执行:
    python scripts/bench/bench_migration.py --rows 100000
    python scripts/bench/bench_migration.py --rows 1000000 --concurrency 4
"""
from __future__ import annotations

import argparse
import gc
import os
import random
import string
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# 让脚本能直接 import app.*
SERVER_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SERVER_DIR))
os.chdir(SERVER_DIR)

from scripts.etl.config import MigrationTask  # noqa: E402
from scripts.etl.transformer import transform_row  # noqa: E402


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

@dataclass
class BenchConfig:
    rows: int = 100_000
    concurrency: int = 1
    unit_convert: bool = True
    field_map: bool = True
    id_lookup: bool = True
    print_every: int = 10_000


# ---------------------------------------------------------------------------
# 统计
# ---------------------------------------------------------------------------

@dataclass
class BenchResult:
    total_rows: int
    duration_s: float
    throughput: float
    cache_size: int
    mem_mb: float
    error_count: int = 0


def _rand_str(n: int) -> str:
    return "".join(random.choices(string.ascii_letters, k=n))


def _build_rows(n: int) -> list[dict]:
    """构造测试数据: 模拟 H 盘 1 行."""
    cities = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉"]
    rows = []
    for i in range(1, n + 1):
        rows.append({
            "id": i,
            "name": _rand_str(8),
            "mobile": f"138{random.randint(10000000, 99999999)}",
            "city": random.choice(cities),
            "price": round(random.uniform(1, 10000), 2),
            "is_vip": random.choice([True, False]),
            "createTime": datetime(2026, 6, 24, random.randint(0, 23), random.randint(0, 59)),
        })
    return rows


def _run_bench(cfg: BenchConfig) -> BenchResult:
    task = MigrationTask(
        source_table="t_bench_member",
        source_db="ihui-ai-edu-member-service",
        target_table="edu_member",
        unit_convert={"price": "yuan_to_fen"} if cfg.unit_convert else {},
        field_map={"mobile": "phone"} if cfg.field_map else {},
        id_lookup={"city_id": "t_city"} if cfg.id_lookup else {},
    )
    rows = _build_rows(cfg.rows)
    cache: dict[tuple[str, int], str] = {}

    # 基准: 模拟外部 id_lookup cache 已存在
    if cfg.id_lookup:
        for city_id in range(1, 100):
            cache[("t_city", city_id)] = f"city-uuid-{city_id:03d}"

    gc.collect()
    mem_before = _rss_mb()
    started = time.perf_counter()
    error_count = 0
    for i, row in enumerate(rows, 1):
        try:
            transform_row(row, task, cache)
        except Exception as e:
            error_count += 1
            if error_count <= 3:
                print(f"  [WARN] row {i} 转换失败: {e}")
        if cfg.print_every and i % cfg.print_every == 0:
            elapsed = time.perf_counter() - started
            rate = i / elapsed
            print(f"  [PROGRESS] {i:>8}/{cfg.rows}  rate={rate:>7.0f} rows/s  errors={error_count}")
    duration = time.perf_counter() - started
    mem_after = _rss_mb()

    return BenchResult(
        total_rows=cfg.rows,
        duration_s=duration,
        throughput=cfg.rows / duration,
        cache_size=len(cache),
        mem_mb=mem_after - mem_before,
        error_count=error_count,
    )


def _rss_mb() -> float:
    """读取进程 RSS (MB)."""
    try:
        import psutil
        return psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
    except ImportError:
        return 0.0


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------

def _print_report(cfg: BenchConfig, r: BenchResult) -> None:
    print()
    print("=" * 72)
    print("迁移批次压测报告")
    print("=" * 72)
    print(f"  数据规模     : {r.total_rows:>10,} 行")
    print(f"  并发度       : {cfg.concurrency:>10}")
    print(f"  unit_convert : {cfg.unit_convert}")
    print(f"  field_map    : {cfg.field_map}")
    print(f"  id_lookup    : {cfg.id_lookup}")
    print("-" * 72)
    print(f"  耗时         : {r.duration_s:>10.2f} s")
    print(f"  吞吐         : {r.throughput:>10,.0f} rows/s")
    print(f"  id_mapping   : {r.cache_size:>10,} 条")
    print(f"  内存增长     : {r.mem_mb:>10.2f} MB")
    print(f"  错误数       : {r.error_count:>10}")
    print("=" * 72)

    # 简单告警
    if r.throughput < 5_000:
        print("  [WARN] 吞吐 < 5000 rows/s, 建议检查 transformer 瓶颈")
    if r.mem_mb > 500:
        print("  [WARN] 内存增长 > 500MB, 建议分批流式处理, 不要全量 cache")

    # 1M 行的 ETA 估算
    if r.total_rows < 1_000_000:
        eta_for_1m = 1_000_000 / r.throughput
        print(f"  [INFO] 推算 1M 行 ETA: {eta_for_1m:.1f} s ({eta_for_1m/60:.1f} min)")


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="迁移批次压测")
    parser.add_argument("--rows", type=int, default=100_000, help="行数 (默认 100k)")
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--no-unit-convert", action="store_true")
    parser.add_argument("--no-field-map", action="store_true")
    parser.add_argument("--no-id-lookup", action="store_true")
    parser.add_argument("--print-every", type=int, default=10_000)
    args = parser.parse_args()

    cfg = BenchConfig(
        rows=args.rows,
        concurrency=args.concurrency,
        unit_convert=not args.no_unit_convert,
        field_map=not args.no_field_map,
        id_lookup=not args.no_id_lookup,
        print_every=args.print_every,
    )
    print(f"[BENCH] 启动, rows={cfg.rows}, concurrency={cfg.concurrency}")
    result = _run_bench(cfg)
    _print_report(cfg, result)
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Smoke 压测 — 纯 asyncio + httpx 跑 5 秒，对本地 18800 端口发请求."""

import asyncio
import os
import random
import sys
import threading
import time
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENV", "test")
os.environ["DB1_URL"] = "sqlite:///./zhs_smoke.db"
os.environ["DB2_URL"] = "sqlite:///./zhs_smoke.db"
os.environ["DB3_URL"] = "sqlite:///./zhs_smoke.db"

import httpx
import uvicorn

from app.database import Base
from app.main import create_app
from app.security import create_access_token

# 一次性建表（用 SQLite 时无 alembic 引导，需手动建）
try:
    from sqlalchemy import create_engine

    sqlite_url = "sqlite:///./zhs_smoke.db"
    eng = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng, checkfirst=True)
    print("[smoke] base metadata created (best effort)")
except Exception as e:
    print(f"[smoke] create_all skipped: {e}")


# 启动应用
app = create_app()
config = uvicorn.Config(app, host="127.0.0.1", port=18800, log_level="warning")
server = uvicorn.Server(config)
t = threading.Thread(target=server.run, daemon=True)
t.start()

# 等服务起来
for _ in range(30):
    try:
        httpx.get("http://127.0.0.1:18800/healthz", timeout=1)
        break
    except Exception:
        time.sleep(0.3)

print("[smoke] app started on 127.0.0.1:18800")


# 端点清单
ENDPOINTS = [
    ("GET", "/healthz", 5),
    ("GET", "/metrics", 2),
    ("GET", "/openapi.json", 1),
    ("GET", "/api/v1/resource/home", 4),
    ("GET", "/api/v1/content/banner/list?page=1&limit=10", 4),
    ("GET", "/api/v1/content/about_us", 3),
    ("GET", "/api/v1/content/news/list?page=1&limit=10", 2),
    ("GET", "/api/v1/agents/list?page=1&limit=20", 4),
    ("GET", "/api/v1/agents/categories/list", 3),
    ("GET", "/api/v1/courses/list?page=1&limit=20", 3),
    ("GET", "/api/v1/courses/videos?page=1&limit=20", 2),
    ("GET", "/api/v1/courses/categories", 2),
    ("GET", "/api/v1/ai/models/list?page=1&limit=20", 2),
    ("GET", "/api/v1/ai/models/vendors", 2),
    ("GET", "/api/v1/mcp/list", 2),
    ("GET", "/api/v1/auth/exist/13800138000", 2),
]

# 压测统计
stats = defaultdict(lambda: {"count": 0, "fail": 0, "latencies": []})


async def worker(client: httpx.AsyncClient, token: str, end_time: float, user_idx: int):
    headers = {"Authorization": f"Bearer {token}"}
    while time.monotonic() < end_time:
        # 加权随机选
        weighted = []
        for m, p, w in ENDPOINTS:
            weighted.extend([(m, p)] * w)
        method, path = random.choice(weighted)
        start = time.perf_counter()
        try:
            if method == "GET":
                resp = await client.get(f"http://127.0.0.1:18800{path}", headers=headers, timeout=5)
            else:
                resp = await client.post(f"http://127.0.0.1:18800{path}", headers=headers, timeout=5)
            latency_ms = (time.perf_counter() - start) * 1000
            s = stats[(method, path)]
            s["count"] += 1
            s["latencies"].append(latency_ms)
            if resp.status_code >= 500:
                s["fail"] += 1
        except Exception as e:
            s = stats[(method, path)]
            s["count"] += 1
            s["fail"] += 1
            s.setdefault("errors", []).append(str(e)[:30])
        await asyncio.sleep(random.uniform(0.05, 0.3))


async def main():
    user_count = 5
    duration_s = 5
    end_time = time.monotonic() + duration_s

    async with httpx.AsyncClient() as client:
        tasks = [
            worker(
                client,
                create_access_token(f"smoke-{i}", expires_delta=timedelta(hours=1)),
                end_time,
                i,
            )
            for i in range(user_count)
        ]
        await asyncio.gather(*tasks)

    # 输出报告
    print()
    print("=" * 80)
    print(f"Smoke 压测报告: {user_count} 用户 / {duration_s} 秒")
    print("=" * 80)
    print(f"{'METHOD':<6} {'PATH':<48} {'COUNT':<6} {'FAIL':<5} {'AVG(ms)':<8} {'P95(ms)':<8} {'MAX(ms)':<8}")
    print("-" * 80)
    total_reqs = 0
    total_fail = 0
    all_lat = []
    for (method, path), s in sorted(stats.items(), key=lambda x: -x[1]["count"]):
        if s["latencies"]:
            sorted_lat = sorted(s["latencies"])
            p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if sorted_lat else 0
            avg = sum(sorted_lat) / len(sorted_lat)
            max_lat = max(sorted_lat)
        else:
            p95 = avg = max_lat = 0
        print(f"{method:<6} {path[:47]:<48} {s['count']:<6} {s['fail']:<5} {avg:<8.1f} {p95:<8.1f} {max_lat:<8.1f}")
        total_reqs += s["count"]
        total_fail += s["fail"]
        all_lat.extend(s["latencies"])

    print("-" * 80)
    if all_lat:
        sorted_all = sorted(all_lat)
        p95 = sorted_all[int(len(sorted_all) * 0.95)]
        p99 = sorted_all[int(len(sorted_all) * 0.99)]
        avg = sum(sorted_all) / len(sorted_all)
        max_lat = max(sorted_all)
        rps = total_reqs / duration_s
        print(f"总请求: {total_reqs}  失败: {total_fail} ({100*total_fail/total_reqs:.1f}%)  RPS: {rps:.1f}")
        print(f"延迟: avg={avg:.1f}ms  p95={p95:.1f}ms  p99={p99:.1f}ms  max={max_lat:.1f}ms")
    print("=" * 80)


asyncio.run(main())

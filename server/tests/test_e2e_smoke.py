"""端到端压测：5 用户 / 5 秒 / 验证高负载下无 5xx."""

import asyncio
import os
import sys
import threading
import time
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

import pytest
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENV", "test")
SQLITE_PATH = "./zhs_smoke_pytest.db"
SQLITE_URL = f"sqlite:///{SQLITE_PATH}"
os.environ["DB1_URL"] = SQLITE_URL
os.environ["DB2_URL"] = SQLITE_URL
os.environ["DB3_URL"] = SQLITE_URL

import httpx

from app.main import create_app
from app.security import create_access_token


@pytest.fixture(scope="module")
def smoke_server():
    """启动 uvicorn 在 18801 端口."""
    from sqlalchemy import create_engine

    from app.database import Base

    eng = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
    try:
        Base.metadata.create_all(eng, checkfirst=True)
    except Exception:
        pass
    app = create_app()
    config = uvicorn.Config(app, host="127.0.0.1", port=18801, log_level="warning")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    # 等待 WS pub/sub 超时 (约 5s) + buffer
    for _ in range(60):
        try:
            httpx.get("http://127.0.0.1:18801/healthz", timeout=2)
            break
        except Exception:
            time.sleep(0.5)
    yield "http://127.0.0.1:18801"


@pytest.mark.asyncio
async def test_smoke_5_users_5_seconds(smoke_server):
    """5 用户并发 5 秒，所有端点 5xx 错误率 < 5%."""
    user_count = 5
    duration_s = 5
    end_time = time.monotonic() + duration_s

    endpoints = [
        ("GET", "/healthz", 5),
        ("GET", "/metrics", 2),
        ("GET", "/api/v1/agents/categories/list", 3),
        ("GET", "/api/v1/ai/models/vendors", 2),
        ("GET", "/api/v1/content/banner/list?page=1&limit=10", 4),
        ("GET", "/api/v1/courses/categories", 3),
    ]

    stats = defaultdict(lambda: {"count": 0, "fail": 0})

    async def worker(client, token):
        headers = {"Authorization": f"Bearer {token}"}
        while time.monotonic() < end_time:
            weighted = []
            for m, p, w in endpoints:
                weighted.extend([(m, p)] * w)
            method, path = __import__("random").choice(weighted)
            try:
                resp = await client.get(f"{smoke_server}{path}", headers=headers, timeout=5)
                stats[(method, path)]["count"] += 1
                if resp.status_code >= 500:
                    stats[(method, path)]["fail"] += 1
            except Exception:
                stats[(method, path)]["count"] += 1
                stats[(method, path)]["fail"] += 1
            await asyncio.sleep(0.05)

    async with httpx.AsyncClient(transport=httpx.AsyncHTTPTransport(local_address="0.0.0.0")) as client:
        tasks = [
            worker(client, create_access_token(f"smoke-{i}", expires_delta=timedelta(hours=1)))
            for i in range(user_count)
        ]
        await asyncio.gather(*tasks)

    total = sum(s["count"] for s in stats.values())
    fail = sum(s["fail"] for s in stats.values())
    assert total > 0, "压测没发出任何请求"
    fail_rate = fail / total
    print(f"\n  [smoke] total={total} fail={fail} fail_rate={fail_rate*100:.2f}%")
    assert fail_rate < 0.05, f"5xx 错误率 {fail_rate*100:.1f}% 超过 5% 阈值"

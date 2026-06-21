"""Smoke 测试 — 启动本地 FastAPI 应用并跑 5 秒 locust 压测."""

import os
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENV", "test")

import uvicorn

from app.main import create_app

# 启动应用
app = create_app()
config = uvicorn.Config(app, host="127.0.0.1", port=18800, log_level="warning")
server = uvicorn.Server(config)

t = threading.Thread(target=server.run, daemon=True)
t.start()

# 等服务起来
for _ in range(20):
    try:
        import urllib.request

        urllib.request.urlopen("http://127.0.0.1:18800/healthz", timeout=1).read()
        break
    except Exception:
        time.sleep(0.3)

print("[smoke] app started on 127.0.0.1:18800")

# 跑 locust
from locust.env import Environment

from locustfile import ZHSChatUser, ZHSPayUser, ZHSUser

env = Environment(user_classes=[ZHSUser, ZHSChatUser, ZHSPayUser], host="http://127.0.0.1:18800")
env.create_local_runner()
env.runner.start(user_count=5, spawn_rate=2)

# 跑 6 秒
import gevent

gevent.sleep(6)
env.runner.quit()

# 输出统计
print("\n" + "=" * 60)
print("Smoke 压测报告 (5 用户 / 6 秒 / 127.0.0.1:18800)")
print("=" * 60)
print(f"总请求数: {env.stats.total.num_requests}")
print(f"失败数: {env.stats.total.num_failures}")
print(f"平均 RPS: {env.stats.total.current_rps:.2f}")
print(f"P50 延迟: {env.stats.total.get_response_time_percentile(0.5):.0f} ms")
print(f"P95 延迟: {env.stats.total.get_response_time_percentile(0.95):.0f} ms")
print(f"最大 延迟: {env.stats.total.max_response_time:.0f} ms")
print("=" * 60)

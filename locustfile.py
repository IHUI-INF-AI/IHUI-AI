"""Locust 压测脚本 — 等价自旧架构 server/locustfile.py

覆盖 4 类核心端点：
  1. 认证类（/api/auth/*）
  2. AI 对话类（/api/chat/*）
  3. 内容浏览类（/api/content/*、/api/news/*）
  4. 文件上传类（/api/files/upload）

用法：
  locust -f locustfile.py --headless \
      --host http://localhost:3000 \
      --users 100 --spawn-rate 10 --run-time 60s

支持环境变量配置（便于 CI 注入）：
  LOCUST_HOST / LOCUST_TOKEN / LOCUST_USERS / LOCUST_SPAWN_RATE / LOCUST_RUN_TIME
"""

import os
from locust import HttpUser, task, between, events


# 通过环境变量注入测试账号 token（CI 场景）
TEST_TOKEN = os.getenv("LOCUST_TOKEN", "")


class IhuiApiUser(HttpUser):
    """IHUI-AI 核心端点压测用户。"""

    wait_time = between(0.5, 2)

    def on_start(self):
        # 注入鉴权头，模拟已登录用户
        if TEST_TOKEN:
            self.client.headers.update({"Authorization": f"Bearer {TEST_TOKEN}"})

    # 1. 认证类：获取当前用户信息（轻量级，验证鉴权链路）
    @task(3)
    def get_profile(self):
        with self.client.get("/api/auth/me", name="认证/获取当前用户", catch_response=True) as resp:
            if resp.status_code == 401:
                resp.failure("鉴权失败：token 无效或过期")
            elif resp.elapsed.total_seconds() > 1:
                resp.failure("鉴权响应超过 1s")

    # 2. AI 对话类：获取会话列表（中等负载，验证 DB + 缓存）
    @task(2)
    def list_chat_sessions(self):
        self.client.get("/api/chat/sessions", name="AI对话/会话列表")

    # 3. 内容浏览类：新闻/内容列表（高频读，验证查询性能）
    @task(4)
    def list_content(self):
        self.client.get("/api/content/list?page=1&pageSize=20", name="内容浏览/列表")

    @task(2)
    def list_news(self):
        self.client.get("/api/news/list?page=1&pageSize=20", name="内容浏览/新闻列表")

    # 4. 文件上传类：模拟小文件上传（重负载，验证 OSS + 限流）
    @task(1)
    def upload_file(self):
        import io
        payload = io.BytesIO(b"locust-loadtest-" * 64)
        files = {"file": ("loadtest.txt", payload, "text/plain")}
        with self.client.post(
            "/api/files/upload",
            files=files,
            name="文件上传/小文件",
            catch_response=True,
        ) as resp:
            if resp.status_code >= 500:
                resp.failure(f"上传服务端错误: {resp.status_code}")


@events.test_start.add_listener
def _on_test_start(environment, **kwargs):
    host = environment.host or "未设置"
    print(f"\n[L-START] IHUI-AI 压测开始 → 目标: {host}")


@events.test_stop.add_listener
def _on_test_stop(environment, **kwargs):
    stats = environment.stats.total
    print(
        f"\n[L-STOP] 压测结束 → 请求数: {stats.num_requests} "
        f"失败: {stats.num_failures} "
        f"RPS: {stats.total_rps:.1f} "
        f"平均延迟: {stats.avg_response_time:.0f}ms"
    )

"""Locust 压测脚本 — 覆盖 4 类核心端点.

使用方式:
    locust -f locustfile.py --host=http://localhost:8000
    locust -f locustfile.py --host=http://localhost:8000 --users 100 --spawn-rate 10 --run-time 5m
    locust -f locustfile.py --host=http://localhost:8000 --headless -u 50 -r 5 -t 60s
"""

import random
import uuid

from locust import HttpUser, between, events, task


def make_token(uid: str) -> str:
    """生成一个 JWT token（生产用真 token；压测可用此 fake token 看 401 路径）."""
    from datetime import timedelta

    from app.security import create_access_token

    return create_access_token(uid, expires_delta=timedelta(hours=1))


class ZHSUser(HttpUser):
    """通用用户行为 — 浏览 / 查询为主."""

    wait_time = between(1, 3)

    def on_start(self):
        """压测开始前为每个虚拟用户生成 token."""
        self.uid = f"locust-user-{uuid.uuid4().hex[:8]}"
        self.token = make_token(self.uid)
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "X-User-UUID": self.uid,
        }
        # 候选 agent_id / category_id 池
        self.agent_ids = [f"agent-{i:04d}" for i in range(1, 51)]
        self.course_ids = [f"course-{i:04d}" for i in range(1, 31)]

    # ------------------------------------------------------------------
    # 健康 / 元信息（无鉴权）
    # ------------------------------------------------------------------
    @task(5)
    def health(self):
        self.client.get("/healthz", name="GET /healthz")

    @task(3)
    def metrics(self):
        self.client.get("/metrics", name="GET /metrics")

    @task(2)
    def openapi(self):
        self.client.get("/openapi.json", name="GET /openapi.json")

    # ------------------------------------------------------------------
    # 内容浏览（公开接口）
    # ------------------------------------------------------------------
    @task(8)
    def home(self):
        self.client.get(
            "/api/v1/resource/home",
            headers=self.headers,
            name="GET /resource/home",
        )

    @task(10)
    def banner_list(self):
        self.client.get(
            "/api/v1/content/banner/list",
            params={"page": 1, "limit": 10},
            name="GET /content/banner/list",
        )

    @task(8)
    def about_us(self):
        self.client.get(
            "/api/v1/content/about_us",
            name="GET /content/about_us",
        )

    @task(6)
    def news_list(self):
        self.client.get(
            "/api/v1/content/news/list",
            params={"page": 1, "limit": 10},
            name="GET /content/news/list",
        )

    # ------------------------------------------------------------------
    # Agent 浏览
    # ------------------------------------------------------------------
    @task(10)
    def agents_list(self):
        self.client.get(
            "/api/v1/agents/list",
            params={"page": 1, "limit": 20},
            headers=self.headers,
            name="GET /agents/list",
        )

    @task(8)
    def agents_categories(self):
        self.client.get(
            "/api/v1/agents/categories/list",
            headers=self.headers,
            name="GET /agents/categories/list",
        )

    @task(6)
    def agents_heat(self):
        agent_id = random.choice(self.agent_ids)
        self.client.get(
            f"/api/v1/agents/heat/agent/{agent_id}",
            params={"days": 7},
            headers=self.headers,
            name="GET /agents/heat/agent/{id}",
        )

    # ------------------------------------------------------------------
    # 课程浏览
    # ------------------------------------------------------------------
    @task(8)
    def courses_list(self):
        self.client.get(
            "/api/v1/courses/list",
            params={"page": 1, "limit": 20},
            headers=self.headers,
            name="GET /courses/list",
        )

    @task(5)
    def courses_videos(self):
        self.client.get(
            "/api/v1/courses/videos",
            params={"page": 1, "limit": 20},
            headers=self.headers,
            name="GET /courses/videos",
        )

    @task(4)
    def courses_categories(self):
        self.client.get(
            "/api/v1/courses/categories",
            headers=self.headers,
            name="GET /courses/categories",
        )

    # ------------------------------------------------------------------
    # AI 模型 / 厂商
    # ------------------------------------------------------------------
    @task(6)
    def ai_models_list(self):
        self.client.get(
            "/api/v1/ai/models/list",
            params={"page": 1, "limit": 20},
            headers=self.headers,
            name="GET /ai/models/list",
        )

    @task(4)
    def ai_models_vendors(self):
        self.client.get(
            "/api/v1/ai/models/vendors",
            headers=self.headers,
            name="GET /ai/models/vendors",
        )

    @task(5)
    def mcp_list(self):
        self.client.get(
            "/api/v1/mcp/list",
            headers=self.headers,
            name="GET /mcp/list",
        )

    # ------------------------------------------------------------------
    # 认证
    # ------------------------------------------------------------------
    @task(3)
    def auth_exist(self):
        self.client.get(
            f"/api/v1/auth/exist/138{random.randint(10000000, 99999999)}",
            name="GET /auth/exist/{phone}",
        )

    @task(2)
    def user_info(self):
        self.client.get(
            "/api/v1/user/info",
            headers=self.headers,
            name="GET /user/info",
        )


class ZHSChatUser(HttpUser):
    """AI 聊天用户 — 模拟聊天调用，权重放聊天路由."""

    wait_time = between(2, 5)

    def on_start(self):
        self.uid = f"locust-chat-{uuid.uuid4().hex[:8]}"
        self.token = make_token(self.uid)
        self.headers = {
            "Authorization": f"Bearer {self.token}",
        }
        self.vendors = ["zhipu", "openrouter", "bailian", "coze_workflow", "n8n"]
        self.bots = [f"bot-{i:04d}" for i in range(1, 21)]
        self.questions = [
            "你好，请自我介绍",
            "今天北京天气如何？",
            "请用 50 字介绍 FastAPI",
            "Python 和 Go 的主要区别？",
            "写一个冒泡排序的伪代码",
        ]

    @task(5)
    def chat_multi(self):
        """多厂商聊天（非流式）."""
        vendor = random.choice(self.vendors)
        question = random.choice(self.questions)
        self.client.post(
            f"/api/v1/chat/multi/{vendor}",
            params={"message": question, "stream": "false"},
            headers=self.headers,
            name="POST /chat/multi/{vendor}",
        )

    @task(3)
    def bots_list(self):
        self.client.get(
            "/api/v1/bots/list",
            params={"page": 1, "limit": 10},
            headers=self.headers,
            name="GET /bots/list",
        )

    @task(2)
    def bot_chat(self):
        bot_id = random.choice(self.bots)
        question = random.choice(self.questions)
        self.client.post(
            f"/api/v1/bots/chat/{bot_id}",
            params={"message": question},
            headers=self.headers,
            name="POST /bots/chat/{bot_id}",
        )


class ZHSPayUser(HttpUser):
    """支付用户 — 模拟下单/查询路径."""

    wait_time = between(3, 7)

    def on_start(self):
        self.uid = f"locust-pay-{uuid.uuid4().hex[:8]}"
        self.token = make_token(self.uid)
        self.headers = {
            "Authorization": f"Bearer {self.token}",
        }

    @task(3)
    def alipay_create(self):
        self.client.post(
            "/api/v1/payments/alipay/create",
            params={
                "amount": round(random.uniform(0.01, 100.0), 2),
                "subject": "压测订单",
            },
            headers=self.headers,
            name="POST /payments/alipay/create",
        )

    @task(3)
    def wechat_create(self):
        self.client.post(
            "/api/v1/payments/wechat/create",
            params={
                "amount": random.randint(100, 10000),
                "open_id": f"locust-oid-{uuid.uuid4().hex[:8]}",
                "description": "压测订单",
            },
            headers=self.headers,
            name="POST /payments/wechat/create",
        )

    @task(2)
    def wechat_query(self):
        self.client.post(
            "/api/v1/payments/wechat/query",
            params={"out_trade_no": f"LOCUST{uuid.uuid4().hex[:12]}"},
            headers=self.headers,
            name="POST /payments/wechat/query",
        )

    @task(2)
    def finance_margin(self):
        self.client.get(
            "/api/v1/finance/margin/info",
            headers=self.headers,
            name="GET /finance/margin/info",
        )


# ---------------------------------------------------------------------------
# 事件钩子
# ---------------------------------------------------------------------------
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("=" * 60)
    print("ZHS Platform 压测开始")
    print(f"Host: {environment.host}")
    print(f"Users: {environment.runner.target_user_count if environment.runner else 'N/A'}")
    print("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("=" * 60)
    print("ZHS Platform 压测结束")
    print("=" * 60)

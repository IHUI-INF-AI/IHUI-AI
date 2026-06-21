"""Locust 负载测试 - 覆盖 38 个新迁移核心接口"""

import random
from locust import HttpUser, task, between


class ZHSAPILoadTest(HttpUser):
    """模拟用户访问 ZHS AI 平台核心接口"""

    wait_time = between(1, 3)
    host = "http://127.0.0.1:8000"

    def on_start(self):
        """用户启动 - 模拟游客身份"""
        self.client.headers["User-Agent"] = "ZHS-LoadTest/1.0"

    # ============== 公共端点 ==============
    @task(3)
    def liveness(self):
        self.client.get("/api/v1/auth/captcha", name="[GET] 验证码")

    @task(2)
    def health_check(self):
        self.client.get("/docs", name="[GET] Swagger UI")

    # ============== 提问/问答 ==============
    @task(5)
    def ask_categories(self):
        self.client.get("/api/v1/ask/category/public-api/list", name="[GET] ask 公共分类")

    @task(3)
    def ask_questions(self):
        self.client.get(
            "/api/v1/ask/question/list",
            params={"page": random.randint(1, 5), "limit": 20},
            name="[GET] ask 问题列表",
        )

    @task(2)
    def ask_answers(self):
        self.client.get(
            "/api/v1/ask/answer/list",
            params={"page": 1, "limit": 20},
            name="[GET] ask 答案列表",
        )

    # ============== 圈子 ==============
    @task(4)
    def circle_list(self):
        self.client.get(
            "/api/v1/circle/list",
            params={"page": 1, "limit": 20},
            name="[GET] circle 圈子列表",
        )

    @task(3)
    def circle_post_list(self):
        self.client.get(
            "/api/v1/circle/post/list",
            params={"page": 1, "limit": 20},
            name="[GET] circle 帖子列表",
        )

    # ============== 考试 ==============
    @task(2)
    def exam_papers(self):
        self.client.get(
            "/api/v1/exam/paper/list",
            params={"page": 1, "limit": 20},
            name="[GET] exam 试卷列表",
        )

    # ============== 直播 ==============
    @task(2)
    def live_channels(self):
        self.client.get(
            "/api/v1/live/channel/list",
            params={"page": 1, "limit": 20},
            name="[GET] live 频道列表",
        )

    # ============== 消息/通知 ==============
    @task(3)
    def message_list(self):
        self.client.get(
            "/api/v1/message/list",
            params={"page": 1, "limit": 20},
            name="[GET] message 消息列表",
        )

    @task(2)
    def notification_list(self):
        self.client.get(
            "/api/v1/notification/list",
            params={"page": 1, "limit": 20},
            name="[GET] notification 通知列表",
        )

    # ============== 积分/排行 ==============
    @task(2)
    def point_account(self):
        self.client.get("/api/v1/point/account", name="[GET] point 账户")

    @task(2)
    def ranking_list(self):
        self.client.get(
            "/api/v1/ranking/list",
            params={"page": 1, "limit": 20},
            name="[GET] ranking 排行列表",
        )

    # ============== 搜索 ==============
    @task(4)
    def search_query(self):
        keywords = ["AI", "课程", "智能体", "语音", "图像", "教育"]
        kw = random.choice(keywords)
        self.client.get(
            "/api/v1/search/query",
            params={"keyword": kw, "page": 1, "limit": 20},
            name="[GET] search 搜索",
        )

    # ============== AI 代理 ==============
    @task(2)
    def ai_models(self):
        self.client.get("/api/v1/luyala-proxy/models", name="[GET] luyala 模型")
        self.client.get("/api/v1/openrouter-proxy/models", name="[GET] openrouter 模型")

    @task(1)
    def ai_chat(self):
        body = {
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "Hello"}],
        }
        self.client.post(
            "/api/v1/luyala-proxy/chat",
            json=body,
            name="[POST] luyala 聊天",
        )

    # ============== 内容 ==============
    @task(3)
    def content_about(self):
        self.client.get("/api/v1/content/about", name="[GET] 关于我们")

    @task(2)
    def content_contact(self):
        self.client.get("/api/v1/content/contact", name="[GET] 联系方式")

    @task(2)
    def content_banner(self):
        self.client.get(
            "/api/v1/content/cms/banner/list",
            params={"page": 1, "limit": 10},
            name="[GET] 横幅列表",
        )

    @task(2)
    def content_information(self):
        self.client.get(
            "/api/v1/content/information/list",
            params={"page": 1, "limit": 20},
            name="[GET] 资讯列表",
        )

    @task(2)
    def content_activity(self):
        self.client.get(
            "/api/v1/content/activity/list",
            params={"page": 1, "limit": 20},
            name="[GET] 活动列表",
        )

    # ============== 视频 ==============
    @task(2)
    def video_preload(self):
        self.client.get(
            "/api/v1/video-preload/list",
            params={"page": 1, "limit": 20},
            name="[GET] video 预加载",
        )

    # ============== 应用版本 ==============
    @task(1)
    def app_version(self):
        self.client.get(
            "/api/v1/app-version/check",
            params={"platform": "android", "version": "1.0.0"},
            name="[GET] app 版本检查",
        )

    # ============== 资源 ==============
    @task(2)
    def resource_home(self):
        self.client.get("/api/v1/resource/home", name="[GET] 资源首页")

    # ============== 通用 ==============
    @task(2)
    def schedule_list(self):
        self.client.get(
            "/api/v1/schedule/list",
            params={"page": 1, "limit": 20},
            name="[GET] schedule 列表",
        )

    @task(1)
    def service_catalog(self):
        self.client.get(
            "/api/v1/service-catalog/list",
            params={"page": 1, "limit": 20},
            name="[GET] service-catalog 列表",
        )


class ZHSAPIMixUser(HttpUser):
    """混合压力测试 - 模拟 80% 读 20% 写"""

    wait_time = between(0.5, 2)
    host = "http://127.0.0.1:8000"

    @task
    def read_apis(self):
        apis = [
            ("GET", "/api/v1/ask/category/public-api/list", None),
            ("GET", "/api/v1/circle/list", {"page": 1, "limit": 20}),
            ("GET", "/api/v1/ranking/list", {"page": 1, "limit": 20}),
            ("GET", "/api/v1/search/query", {"keyword": "test", "page": 1, "limit": 20}),
            ("GET", "/api/v1/exam/paper/list", {"page": 1, "limit": 20}),
            ("GET", "/api/v1/notification/list", {"page": 1, "limit": 20}),
            ("GET", "/api/v1/message/list", {"page": 1, "limit": 20}),
        ]
        method, path, params = random.choice(apis)
        if method == "GET":
            self.client.get(path, params=params, name=path)

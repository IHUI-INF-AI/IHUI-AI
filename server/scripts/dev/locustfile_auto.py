"""自动生成的 Locust 压测路径 - 从 /openapi.json 动态同步.

  生成时间: 1781718614.843077
  端点数: 363
  数据源: http://127.0.0.1:8000/openapi.json

用法:
    locust -f scripts/dev/locustfile_auto.py --host=http://127.0.0.1:8000
"""

import random
import uuid

from locust import HttpUser, between, task


def make_token(uid: str) -> str:
    """生成一个 JWT token."""
    from datetime import timedelta
    from app.security import create_access_token

    return create_access_token(uid, expires_delta=timedelta(hours=1))


class ZHSAutoUser(HttpUser):
    """自动从 OpenAPI 同步的压测用户 - 覆盖所有 GET 端点."""

    wait_time = between(1, 3)

    def on_start(self):
        self.uid = f"locust-{uuid.uuid4().hex[:8]}"
        self.token = make_token(self.uid)
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "X-User-UUID": self.uid,
        }

    @task(10)
    def task_000(self):  # # [Content] 获取联系信息
        self.client.get(
            "/api/v1/content/contact",
            headers=self.headers,
            name="/api/v1/content/contact",
        )

    @task(10)
    def task_001(self):  # # [Content] Get about us
        self.client.get(
            "/api/v1/content/about",
            headers=self.headers,
            name="/api/v1/content/about",
        )

    @task(10)
    def task_002(self):  # # [Content] List news
        self.client.get(
            "/api/v1/content/news",
            headers=self.headers,
            name="/api/v1/content/news",
        )

    @task(10)
    def task_003(self):  # # [Content] Get news detail
        self.client.get(
            "/api/v1/content/news/1",
            params={"news_id": "1"},
            headers=self.headers,
            name="/api/v1/content/news/1",
        )

    @task(10)
    def task_004(self):  # # [Content] List banners
        self.client.get(
            "/api/v1/content/banners",
            headers=self.headers,
            name="/api/v1/content/banners",
        )

    @task(10)
    def task_005(self):  # # [Content] Get latest app version
        self.client.get(
            "/api/v1/content/version",
            headers=self.headers,
            name="/api/v1/content/version",
        )

    @task(10)
    def task_006(self):  # # [Content] App 版本列表
        self.client.get(
            "/api/v1/content/version/list",
            headers=self.headers,
            name="/api/v1/content/version/list",
        )

    @task(10)
    def task_007(self):  # # [Content] 反馈列表
        self.client.get(
            "/api/v1/content/feedback/list",
            headers=self.headers,
            name="/api/v1/content/feedback/list",
        )

    @task(10)
    def task_008(self):  # # [Resource] 首页资源聚合
        self.client.get(
            "/api/v1/resource/home",
            headers=self.headers,
            name="/api/v1/resource/home",
        )

    @task(10)
    def task_009(self):  # # [Resource] 获取用户 token 余量
        self.client.get(
            "/api/v1/resource/token/count",
            headers=self.headers,
            name="/api/v1/resource/token/count",
        )

    @task(10)
    def task_010(self):  # # [Resource] 查询 Agent 开发者价格
        self.client.get(
            "/api/v1/resource/developer/price",
            headers=self.headers,
            name="/api/v1/resource/developer/price",
        )

    @task(10)
    def task_011(self):  # # [Resource] 商品及汇率列表
        self.client.get(
            "/api/v1/resource/goods",
            headers=self.headers,
            name="/api/v1/resource/goods",
        )

    @task(10)
    def task_012(self):  # # [Resource] 课程星球列表
        self.client.get(
            "/api/v1/resource/planets/course",
            headers=self.headers,
            name="/api/v1/resource/planets/course",
        )

    @task(10)
    def task_013(self):  # # [Resource] 知识星球列表
        self.client.get(
            "/api/v1/resource/planets/knowledge",
            headers=self.headers,
            name="/api/v1/resource/planets/knowledge",
        )

    @task(10)
    def task_014(self):  # # [Resource] 获取用户 Agent 免费次数
        self.client.get(
            "/api/v1/resource/agent/free-time",
            headers=self.headers,
            name="/api/v1/resource/agent/free-time",
        )

    @task(10)
    def task_015(self):  # # [Resource] 判断是否为会员
        self.client.get(
            "/api/v1/resource/recharge",
            headers=self.headers,
            name="/api/v1/resource/recharge",
        )

    @task(10)
    def task_016(self):  # # [Resource] 获取 Coze AccessToken
        self.client.get(
            "/api/v1/resource/coze-access-token",
            headers=self.headers,
            name="/api/v1/resource/coze-access-token",
        )

    @task(10)
    def task_017(self):  # # [Search/Search] 全文搜索
        self.client.get(
            "/api/v1/search/query",
            headers=self.headers,
            name="/api/v1/search/query",
        )

    @task(10)
    def task_018(self):  # # [Search/Search] 热搜词
        self.client.get(
            "/api/v1/search/hot",
            headers=self.headers,
            name="/api/v1/search/hot",
        )

    @task(10)
    def task_019(self):  # # [Search/Search] 搜索建议
        self.client.get(
            "/api/v1/search/suggest",
            headers=self.headers,
            name="/api/v1/search/suggest",
        )

    @task(5)
    def task_020(self):  # # [Search/Search] 搜索日志
        self.client.get(
            "/api/v1/search/log/list",
            headers=self.headers,
            name="/api/v1/search/log/list",
        )

    @task(5)
    def task_021(self):  # # [Agent Use Detail/Agent Use Detail] 使用明细
        self.client.get(
            "/api/v1/agent-usedetail/list",
            headers=self.headers,
            name="/api/v1/agent-usedetail/list",
        )

    @task(5)
    def task_022(self):  # # [Agent Use Detail/Agent Use Detail] 日统计
        self.client.get(
            "/api/v1/agent-usedetail/stats/daily",
            headers=self.headers,
            name="/api/v1/agent-usedetail/stats/daily",
        )

    @task(5)
    def task_023(self):  # # [Agent Use Detail/Agent Use Detail] 汇总统计
        self.client.get(
            "/api/v1/agent-usedetail/stats/summary",
            headers=self.headers,
            name="/api/v1/agent-usedetail/stats/summary",
        )

    @task(5)
    def task_024(self):  # # [Authentication/Authentication] Get current user info
        self.client.get(
            "/api/v1/auth/auth/info",
            headers=self.headers,
            name="/api/v1/auth/auth/info",
        )

    @task(5)
    def task_025(self):  # # [Authentication/Authentication] Check if phone is registered
        self.client.get(
            "/api/v1/auth/auth/exist/1",
            params={"phone": "1"},
            headers=self.headers,
            name="/api/v1/auth/auth/exist/1",
        )

    @task(5)
    def task_026(self):  # # [Authentication/Authentication] Get personal profile with roles and posts
        self.client.get(
            "/api/v1/auth/auth/profile",
            headers=self.headers,
            name="/api/v1/auth/auth/profile",
        )

    @task(5)
    def task_027(self):  # # [Google OAuth/Google 鉴权] Google PC 登录 (用 code 换 token)
        self.client.get(
            "/api/v1/auth/google/pc/wxCode",
            headers=self.headers,
            name="/api/v1/auth/google/pc/wxCode",
        )

    @task(5)
    def task_028(self):  # # [Google OAuth/Google 鉴权] Google Android 登录 (id_token 直接登录)
        self.client.get(
            "/api/v1/auth/google/android/wxCode",
            headers=self.headers,
            name="/api/v1/auth/google/android/wxCode",
        )

    @task(5)
    def task_029(self):  # # [Google OAuth/Google 鉴权] 返回当前 Google OAuth 配置 (脱敏)
        self.client.get(
            "/api/v1/auth/google/config",
            headers=self.headers,
            name="/api/v1/auth/google/config",
        )

    @task(5)
    def task_030(self):  # # [OAuth/OAuth] OAuth authorize
        self.client.get(
            "/api/v1/auth/oauth/authorize",
            headers=self.headers,
            name="/api/v1/auth/oauth/authorize",
        )

    @task(5)
    def task_031(self):  # # [OAuth/OAuth] List OAuth applications
        self.client.get(
            "/api/v1/auth/oauth/apps/list",
            headers=self.headers,
            name="/api/v1/auth/oauth/apps/list",
        )

    @task(5)
    def task_032(self):  # # [OAuth/OAuth] Get OAuth application by client_id
        self.client.get(
            "/api/v1/auth/oauth/apps/1",
            params={"client_id": "1"},
            headers=self.headers,
            name="/api/v1/auth/oauth/apps/1",
        )

    @task(5)
    def task_033(self):  # # [OAuth/OAuth] OAuth 用户列表
        self.client.get(
            "/api/v1/auth/oauth/users/list",
            headers=self.headers,
            name="/api/v1/auth/oauth/users/list",
        )

    @task(5)
    def task_034(self):  # # [OAuth/OAuth] OAuth 用户详情
        self.client.get(
            "/api/v1/auth/oauth/users/1",
            params={"user_id": "1"},
            headers=self.headers,
            name="/api/v1/auth/oauth/users/1",
        )

    @task(5)
    def task_035(self):  # # [WeChat Auth/WeChat Auth] WeChat mini-program login
        self.client.get(
            "/api/v1/auth/auth/wechat/mini/login",
            headers=self.headers,
            name="/api/v1/auth/auth/wechat/mini/login",
        )

    @task(5)
    def task_036(self):  # # [WeChat Auth/WeChat Auth] Get WeChat mini-program QR code
        self.client.get(
            "/api/v1/auth/auth/wechat/mini/qrcode",
            headers=self.headers,
            name="/api/v1/auth/auth/wechat/mini/qrcode",
        )

    @task(5)
    def task_037(self):  # # [Account Bindings/Account Bindings] List all third-party bindings
        self.client.get(
            "/api/v1/auth/auth/bindings/",
            headers=self.headers,
            name="/api/v1/auth/auth/bindings/",
        )

    @task(5)
    def task_038(self):  # # [User SK/User SK] List user secret keys
        self.client.get(
            "/api/v1/auth/user-sk/list",
            headers=self.headers,
            name="/api/v1/auth/user-sk/list",
        )

    @task(5)
    def task_039(self):  # # [Users] Get current user profile
        self.client.get(
            "/api/v1/user/info",
            headers=self.headers,
            name="/api/v1/user/info",
        )

    @task(5)
    def task_040(self):  # # [VIP] Get all VIP levels
        self.client.get(
            "/api/v1/user/levels",
            headers=self.headers,
            name="/api/v1/user/levels",
        )

    @task(5)
    def task_041(self):  # # [VIP] Get VIP level detail
        self.client.get(
            "/api/v1/user/level/1",
            params={"vip_id": "1"},
            headers=self.headers,
            name="/api/v1/user/level/1",
        )

    @task(5)
    def task_042(self):  # # [VIP] Get current user VIP info
        self.client.get(
            "/api/v1/user/my",
            headers=self.headers,
            name="/api/v1/user/my",
        )

    @task(5)
    def task_043(self):  # # [VIP] Check current user VIP status
        self.client.get(
            "/api/v1/user/check",
            headers=self.headers,
            name="/api/v1/user/check",
        )

    @task(5)
    def task_044(self):  # # [Agent Identity] 身份订单列表
        self.client.get(
            "/api/v1/agents/list",
            headers=self.headers,
            name="/api/v1/agents/list",
        )

    @task(5)
    def task_045(self):  # # [Agents] Get agent detail
        self.client.get(
            "/api/v1/agents/1",
            params={"agent_id": "1"},
            headers=self.headers,
            name="/api/v1/agents/1",
        )

    @task(5)
    def task_046(self):  # # [Agent Developers] 开发者记录详情
        self.client.get(
            "/api/v1/agents/1",
            params={"record_id": "1"},
            headers=self.headers,
            name="/api/v1/agents/1",
        )

    @task(5)
    def task_047(self):  # # [Agent Purchase] Query by user and agent
        self.client.get(
            "/api/v1/agents/user/1/agent/1",
            params={"user_uuid": "1", "agent_id": "1"},
            headers=self.headers,
            name="/api/v1/agents/user/1/agent/1",
        )

    @task(5)
    def task_048(self):  # # [Agent Purchase] Query by order number
        self.client.get(
            "/api/v1/agents/order/1",
            params={"order_no": "1"},
            headers=self.headers,
            name="/api/v1/agents/order/1",
        )

    @task(5)
    def task_049(self):  # # [Agent Purchase] List expired purchase records
        self.client.get(
            "/api/v1/agents/expired",
            headers=self.headers,
            name="/api/v1/agents/expired",
        )

    @task(2)
    def task_050(self):  # # [Agent Categories] Get category detail
        self.client.get(
            "/api/v1/agents/1",
            params={"category_id": "1"},
            headers=self.headers,
            name="/api/v1/agents/1",
        )

    @task(2)
    def task_051(self):  # # [Agent Review] Examination statistics
        self.client.get(
            "/api/v1/agents/stats/summary",
            headers=self.headers,
            name="/api/v1/agents/stats/summary",
        )

    @task(2)
    def task_052(self):  # # [Agent Developers] 我作为开发者的所有 Agent
        self.client.get(
            "/api/v1/agents/my",
            headers=self.headers,
            name="/api/v1/agents/my",
        )

    @task(2)
    def task_053(self):  # # [Agent Developers] 查询 Coze 账号绑定
        self.client.get(
            "/api/v1/agents/coze-link",
            headers=self.headers,
            name="/api/v1/agents/coze-link",
        )

    @task(2)
    def task_054(self):  # # [Agent Settlement] 结算汇总
        self.client.get(
            "/api/v1/agents/summary",
            headers=self.headers,
            name="/api/v1/agents/summary",
        )

    @task(2)
    def task_055(self):  # # [Agent Settlement] 查询未结算记录
        self.client.get(
            "/api/v1/agents/unsettled",
            headers=self.headers,
            name="/api/v1/agents/unsettled",
        )

    @task(2)
    def task_056(self):  # # [Agent Withdrawal] 提现详情
        self.client.get(
            "/api/v1/agents/1",
            params={"withdrawal_id": "1"},
            headers=self.headers,
            name="/api/v1/agents/1",
        )

    @task(2)
    def task_057(self):  # # [Agent Cache] Search categories in cache
        self.client.get(
            "/api/v1/agents/search",
            headers=self.headers,
            name="/api/v1/agents/search",
        )

    @task(2)
    def task_058(self):  # # [Agent Rules] 需求任务列表
        self.client.get(
            "/api/v1/agents/need-task/list",
            headers=self.headers,
            name="/api/v1/agents/need-task/list",
        )

    @task(2)
    def task_059(self):  # # [Agent Heat Stats] 查询 Agent 热度（按日聚合）
        self.client.get(
            "/api/v1/agents/agent/1",
            params={"agent_id": "1"},
            headers=self.headers,
            name="/api/v1/agents/agent/1",
        )

    @task(2)
    def task_060(self):  # # [Agent Heat Stats] 热度 TOP 榜
        self.client.get(
            "/api/v1/agents/top",
            headers=self.headers,
            name="/api/v1/agents/top",
        )

    @task(2)
    def task_061(self):  # # [Agent Cache] Get category cache info
        self.client.get(
            "/api/v1/agents/info",
            headers=self.headers,
            name="/api/v1/agents/info",
        )

    @task(2)
    def task_062(self):  # # [Agent Identity] 身份比例列表
        self.client.get(
            "/api/v1/agents/proportion/list",
            headers=self.headers,
            name="/api/v1/agents/proportion/list",
        )

    @task(2)
    def task_063(self):  # # [Agent Creation] 点赞/收藏操作
        self.client.get(
            "/api/v1/agents/operate/1/1",
            params={"gc_id": "1", "type": "1"},
            headers=self.headers,
            name="/api/v1/agents/operate/1/1",
        )

    @task(2)
    def task_064(self):  # # [Agent Creation] 通过分享码获取创作
        self.client.get(
            "/api/v1/agents/share/third/1",
            params={"code": "1"},
            headers=self.headers,
            name="/api/v1/agents/share/third/1",
        )

    @task(2)
    def task_065(self):  # # [Agent Rule Params] List rule params
        self.client.get(
            "/api/v1/list",
            headers=self.headers,
            name="/api/v1/list",
        )

    @task(2)
    def task_066(self):  # # [Agent Rule Params] Get rule param detail
        self.client.get(
            "/api/v1/1",
            params={"item_id": "1"},
            headers=self.headers,
            name="/api/v1/1",
        )

    @task(2)
    def task_067(self):  # # [Bots] Bot 列表
        self.client.get(
            "/api/v1/bots/list",
            headers=self.headers,
            name="/api/v1/bots/list",
        )

    @task(2)
    def task_068(self):  # # [Bots] Bot 详情
        self.client.get(
            "/api/v1/bots/1",
            params={"bot_id": "1"},
            headers=self.headers,
            name="/api/v1/bots/1",
        )

    @task(2)
    def task_069(self):  # # [Bots] Bot 关联知识库列表
        self.client.get(
            "/api/v1/bots/datasets/list",
            headers=self.headers,
            name="/api/v1/bots/datasets/list",
        )

    @task(2)
    def task_070(self):  # # [Bot Chat] List conversations
        self.client.get(
            "/api/v1/bots/conversations",
            headers=self.headers,
            name="/api/v1/bots/conversations",
        )

    @task(2)
    def task_071(self):  # # [Kling Chat] Query Kling task status
        self.client.get(
            "/api/v1/chat/task/1",
            params={"task_id": "1"},
            headers=self.headers,
            name="/api/v1/chat/task/1",
        )

    @task(2)
    def task_072(self):  # # [Multi-Model Chat] 列出支持的 AI 厂商
        self.client.get(
            "/api/v1/chat/vendors",
            headers=self.headers,
            name="/api/v1/chat/vendors",
        )

    @task(2)
    def task_073(self):  # # [AI: DashScope] Query image generation task status
        self.client.get(
            "/api/v1/ai/dashscope/image/task/1",
            params={"task_id": "1"},
            headers=self.headers,
            name="/api/v1/ai/dashscope/image/task/1",
        )

    @task(2)
    def task_074(self):  # # [AI: DashScope] List supported ASR models
        self.client.get(
            "/api/v1/ai/dashscope/audio/models",
            headers=self.headers,
            name="/api/v1/ai/dashscope/audio/models",
        )

    @task(2)
    def task_075(self):  # # [AI: DashScope] Query video synthesis task status
        self.client.get(
            "/api/v1/ai/dashscope/video/tasks/1",
            params={"task_id": "1"},
            headers=self.headers,
            name="/api/v1/ai/dashscope/video/tasks/1",
        )

    @task(2)
    def task_076(self):  # # [AI: VolcEngine] Health check
        self.client.get(
            "/api/v1/ai/volcengine/ping",
            headers=self.headers,
            name="/api/v1/ai/volcengine/ping",
        )

    @task(2)
    def task_077(self):  # # [AI: Video Tasks] 视频任务列表
        self.client.get(
            "/api/v1/ai/list",
            headers=self.headers,
            name="/api/v1/ai/list",
        )

    @task(2)
    def task_078(self):  # # [AI: Model Info] 支持的厂商统计
        self.client.get(
            "/api/v1/ai/vendors",
            headers=self.headers,
            name="/api/v1/ai/vendors",
        )

    @task(2)
    def task_079(self):  # # [AI: Model Info] [兼容] 删除模型 (前端 aiModelInfo.delete)
        self.client.get(
            "/api/v1/ai/compat/delete",
            headers=self.headers,
            name="/api/v1/ai/compat/delete",
        )

    @task(2)
    def task_080(self):  # # [AI: Tencent] 查询混元3D任务状态
        self.client.get(
            "/api/v1/ai/tencent/hunyuan3d/task/1",
            params={"task_id": "1"},
            headers=self.headers,
            name="/api/v1/ai/tencent/hunyuan3d/task/1",
        )

    @task(2)
    def task_081(self):  # # [AI: Tencent] 查看当前活跃任务
        self.client.get(
            "/api/v1/ai/tencent/hunyuan3d/active-jobs",
            headers=self.headers,
            name="/api/v1/ai/tencent/hunyuan3d/active-jobs",
        )

    @task(2)
    def task_082(self):  # # [AI: Suno] 查询Suno音乐任务状态
        self.client.get(
            "/api/v1/ai/suno/query/music/1",
            params={"task_id": "1"},
            headers=self.headers,
            name="/api/v1/ai/suno/query/music/1",
        )

    @task(2)
    def task_083(self):  # # [AI: Sora2] 查询Sora2视频生成任务状态
        self.client.get(
            "/api/v1/ai/sora2/video/1",
            params={"task_id": "1"},
            headers=self.headers,
            name="/api/v1/ai/sora2/video/1",
        )

    @task(2)
    def task_084(self):  # # [AI: Video Tasks] 任务详情
        self.client.get(
            "/api/v1/ai/1",
            params={"task_id": "1"},
            headers=self.headers,
            name="/api/v1/ai/1",
        )

    @task(2)
    def task_085(self):  # # [AI: Audio] List available TTS voices
        self.client.get(
            "/api/v1/ai/audio/voices",
            headers=self.headers,
            name="/api/v1/ai/audio/voices",
        )

    @task(2)
    def task_086(self):  # # [AI: Audio] Download audio by task_id
        self.client.get(
            "/api/v1/ai/audio/audio/download",
            headers=self.headers,
            name="/api/v1/ai/audio/audio/download",
        )

    @task(2)
    def task_087(self):  # # [AI: Voiceprint] List voiceprint groups
        self.client.get(
            "/api/v1/ai/audio/groups/list",
            headers=self.headers,
            name="/api/v1/ai/audio/groups/list",
        )

    @task(2)
    def task_088(self):  # # [AI: Voiceprint] List voiceprints in group
        self.client.get(
            "/api/v1/ai/audio/groups/1/users",
            params={"group_id": "1"},
            headers=self.headers,
            name="/api/v1/ai/audio/groups/1/users",
        )

    @task(2)
    def task_089(self):  # # [WeChat Pay] Check payment status
        self.client.get(
            "/api/v1/payments/wechat/status/1",
            params={"out_trade_no": "1"},
            headers=self.headers,
            name="/api/v1/payments/wechat/status/1",
        )

    @task(2)
    def task_090(self):  # # [WeChat Pay] Query consecutive subscription products
        self.client.get(
            "/api/v1/payments/wechat/consecutive/product",
            headers=self.headers,
            name="/api/v1/payments/wechat/consecutive/product",
        )

    @task(2)
    def task_091(self):  # # [Reconciliation] 拉取支付宝某天账单并对账
        self.client.get(
            "/api/v1/payments/alipay",
            headers=self.headers,
            name="/api/v1/payments/alipay",
        )

    @task(2)
    def task_092(self):  # # [Reconciliation] 拉取微信某天账单并对账
        self.client.get(
            "/api/v1/payments/wechat",
            headers=self.headers,
            name="/api/v1/payments/wechat",
        )

    @task(2)
    def task_093(self):  # # [Reconciliation] 拉取支付宝 + 微信双边对账
        self.client.get(
            "/api/v1/payments/all",
            headers=self.headers,
            name="/api/v1/payments/all",
        )

    @task(2)
    def task_094(self):  # # [Reconciliation] 查询超时未支付订单
        self.client.get(
            "/api/v1/payments/pending",
            headers=self.headers,
            name="/api/v1/payments/pending",
        )

    @task(2)
    def task_095(self):  # # [Alipay Fund/Alipay Fund] Alipay Return
        self.client.get(
            "/api/v1/payments/alipay/return",
            headers=self.headers,
            name="/api/v1/payments/alipay/return",
        )

    @task(2)
    def task_096(self):  # # [Alipay Fund/Alipay Fund] Pay Success
        self.client.get(
            "/api/v1/payments/success",
            headers=self.headers,
            name="/api/v1/payments/success",
        )

    @task(2)
    def task_097(self):  # # [Alipay Fund/Alipay Fund] Pay Fail
        self.client.get(
            "/api/v1/payments/fail",
            headers=self.headers,
            name="/api/v1/payments/fail",
        )

    @task(2)
    def task_098(self):  # # [Finance: Withdrawal] 我的提现记录
        self.client.get(
            "/api/v1/finance/list",
            headers=self.headers,
            name="/api/v1/finance/list",
        )

    @task(2)
    def task_099(self):  # # [Finance: Withdrawal] 提现详情面板数据（总提现/待审核/已到账）
        self.client.get(
            "/api/v1/finance/summary",
            headers=self.headers,
            name="/api/v1/finance/summary",
        )

    @task(1)
    def task_100(self):  # # [Finance: Commission] 我的订单列表（分页+筛选）
        self.client.get(
            "/api/v1/finance/orders",
            headers=self.headers,
            name="/api/v1/finance/orders",
        )

    @task(1)
    def task_101(self):  # # [Finance: Margin] 查询用户 token 余额（Redis 缓存 5 分钟）
        self.client.get(
            "/api/v1/finance/balance",
            headers=self.headers,
            name="/api/v1/finance/balance",
        )

    @task(1)
    def task_102(self):  # # [Finance: Margin] 检查余额是否充足
        self.client.get(
            "/api/v1/finance/check",
            headers=self.headers,
            name="/api/v1/finance/check",
        )

    @task(1)
    def task_103(self):  # # [Finance: Margin] 用户 token 流水（支持按类型过滤）
        self.client.get(
            "/api/v1/finance/flows",
            headers=self.headers,
            name="/api/v1/finance/flows",
        )

    @task(1)
    def task_104(self):  # # [Finance: Margin] Token 操作流水列表（管理员）
        self.client.get(
            "/api/v1/finance/flow/list",
            headers=self.headers,
            name="/api/v1/finance/flow/list",
        )

    @task(1)
    def task_105(self):  # # [Finance: Withdrawal] 个人可收款查询
        self.client.get(
            "/api/v1/finance/available",
            headers=self.headers,
            name="/api/v1/finance/available",
        )

    @task(1)
    def task_106(self):  # # [Finance: Withdrawal] Agent 提现记录
        self.client.get(
            "/api/v1/finance/agent/list",
            headers=self.headers,
            name="/api/v1/finance/agent/list",
        )

    @task(1)
    def task_107(self):  # # [Finance: Distribution] 我的下级用户列表
        self.client.get(
            "/api/v1/finance/subordinates",
            headers=self.headers,
            name="/api/v1/finance/subordinates",
        )

    @task(1)
    def task_108(self):  # # [Finance: Distribution] 我的团队（下属列表+搜索排序）
        self.client.get(
            "/api/v1/finance/team",
            headers=self.headers,
            name="/api/v1/finance/team",
        )

    @task(1)
    def task_109(self):  # # [Finance: Distribution] 个人中心我的团队（概要）
        self.client.get(
            "/api/v1/finance/team/center",
            headers=self.headers,
            name="/api/v1/finance/team/center",
        )

    @task(1)
    def task_110(self):  # # [Finance: Distribution] 邀请统计
        self.client.get(
            "/api/v1/finance/invitee-stats",
            headers=self.headers,
            name="/api/v1/finance/invitee-stats",
        )

    @task(1)
    def task_111(self):  # # [Finance: Distribution] 佣金明细
        self.client.get(
            "/api/v1/finance/commission-detail",
            headers=self.headers,
            name="/api/v1/finance/commission-detail",
        )

    @task(1)
    def task_112(self):  # # [Finance: Distribution] 操盘手数据卡片统计
        self.client.get(
            "/api/v1/finance/operator-card",
            headers=self.headers,
            name="/api/v1/finance/operator-card",
        )

    @task(1)
    def task_113(self):  # # [Finance: Distribution] 下级用户订单统计
        self.client.get(
            "/api/v1/finance/invitee-order-stats",
            headers=self.headers,
            name="/api/v1/finance/invitee-order-stats",
        )

    @task(1)
    def task_114(self):  # # [Finance: Distribution] 用户及下级的订单列表
        self.client.get(
            "/api/v1/finance/user-and-children-orders",
            headers=self.headers,
            name="/api/v1/finance/user-and-children-orders",
        )

    @task(1)
    def task_115(self):  # # [Finance: Fund/Fund Management] Get Info
        self.client.get(
            "/api/v1/finance/fund/getInfo",
            headers=self.headers,
            name="/api/v1/finance/fund/getInfo",
        )

    @task(1)
    def task_116(self):  # # [Finance: Fund/Fund Management] Get Product
        self.client.get(
            "/api/v1/finance/fund/getProduct",
            headers=self.headers,
            name="/api/v1/finance/fund/getProduct",
        )

    @task(1)
    def task_117(self):  # # [Finance: Fund/Fund Management] Get Statistics
        self.client.get(
            "/api/v1/finance/fund/getStatistics",
            headers=self.headers,
            name="/api/v1/finance/fund/getStatistics",
        )

    @task(1)
    def task_118(self):  # # [Courses] List courses
        self.client.get(
            "/api/v1/courses/list",
            headers=self.headers,
            name="/api/v1/courses/list",
        )

    @task(1)
    def task_119(self):  # # [Courses] Get course detail
        self.client.get(
            "/api/v1/courses/1",
            params={"course_id": "1"},
            headers=self.headers,
            name="/api/v1/courses/1",
        )

    @task(1)
    def task_120(self):  # # [Courses Ext] 课程视频列表
        self.client.get(
            "/api/v1/courses/videos",
            headers=self.headers,
            name="/api/v1/courses/videos",
        )

    @task(1)
    def task_121(self):  # # [Courses Ext] 视频详情
        self.client.get(
            "/api/v1/courses/videos/1",
            params={"video_id": "1"},
            headers=self.headers,
            name="/api/v1/courses/videos/1",
        )

    @task(1)
    def task_122(self):  # # [Courses Ext] 我创建的视频
        self.client.get(
            "/api/v1/courses/videos/my",
            headers=self.headers,
            name="/api/v1/courses/videos/my",
        )

    @task(1)
    def task_123(self):  # # [Courses Ext] 课程分类列表
        self.client.get(
            "/api/v1/courses/categories",
            headers=self.headers,
            name="/api/v1/courses/categories",
        )

    @task(1)
    def task_124(self):  # # [Courses Ext] 查询分类的父级链
        self.client.get(
            "/api/v1/courses/categories/1/parent",
            params={"category_id": "1"},
            headers=self.headers,
            name="/api/v1/courses/categories/1/parent",
        )

    @task(1)
    def task_125(self):  # # [Courses Ext] 教育平台列表
        self.client.get(
            "/api/v1/courses/platforms",
            headers=self.headers,
            name="/api/v1/courses/platforms",
        )

    @task(1)
    def task_126(self):  # # [Courses Ext] 教育平台详情
        self.client.get(
            "/api/v1/courses/platforms/1",
            params={"code": "1"},
            headers=self.headers,
            name="/api/v1/courses/platforms/1",
        )

    @task(1)
    def task_127(self):  # # [Courses Ext] 课程支付日志列表
        self.client.get(
            "/api/v1/courses/pay-logs",
            headers=self.headers,
            name="/api/v1/courses/pay-logs",
        )

    @task(1)
    def task_128(self):  # # [Courses Ext] 课程评论列表
        self.client.get(
            "/api/v1/courses/comments",
            headers=self.headers,
            name="/api/v1/courses/comments",
        )

    @task(1)
    def task_129(self):  # # [Courses Ext] 查询评论的父级评论
        self.client.get(
            "/api/v1/courses/comments/parent",
            headers=self.headers,
            name="/api/v1/courses/comments/parent",
        )

    @task(1)
    def task_130(self):  # # [Courses Ext] 用户视频观看日志列表
        self.client.get(
            "/api/v1/courses/video-log/list",
            headers=self.headers,
            name="/api/v1/courses/video-log/list",
        )

    @task(1)
    def task_131(self):  # # [Courses Ext] 用户操作日志列表
        self.client.get(
            "/api/v1/courses/operate/list",
            headers=self.headers,
            name="/api/v1/courses/operate/list",
        )

    @task(1)
    def task_132(self):  # # [Courses Ext] 平台操作日志列表
        self.client.get(
            "/api/v1/courses/platform-logs",
            headers=self.headers,
            name="/api/v1/courses/platform-logs",
        )

    @task(1)
    def task_133(self):  # # [Courses Ext] 我的平台绑定列表
        self.client.get(
            "/api/v1/courses/user-platform/my",
            headers=self.headers,
            name="/api/v1/courses/user-platform/my",
        )

    @task(1)
    def task_134(self):  # # [Content: CMS] Banner list (public)
        self.client.get(
            "/api/v1/content/cms/banner/list",
            headers=self.headers,
            name="/api/v1/content/cms/banner/list",
        )

    @task(1)
    def task_135(self):  # # [Content: CMS] News list (public)
        self.client.get(
            "/api/v1/content/cms/news/list",
            headers=self.headers,
            name="/api/v1/content/cms/news/list",
        )

    @task(1)
    def task_136(self):  # # [Content: CMS] System notice list (public)
        self.client.get(
            "/api/v1/content/cms/notice/list",
            headers=self.headers,
            name="/api/v1/content/cms/notice/list",
        )

    @task(1)
    def task_137(self):  # # [Content: CMS] Popular recommendations (public)
        self.client.get(
            "/api/v1/content/cms/popular/list",
            headers=self.headers,
            name="/api/v1/content/cms/popular/list",
        )

    @task(1)
    def task_138(self):  # # [Content: Activity] 活动列表
        self.client.get(
            "/api/v1/content/activity/list",
            headers=self.headers,
            name="/api/v1/content/activity/list",
        )

    @task(1)
    def task_139(self):  # # [Content: Activity] 活动详情
        self.client.get(
            "/api/v1/content/activity/1",
            params={"activity_id": "1"},
            headers=self.headers,
            name="/api/v1/content/activity/1",
        )

    @task(1)
    def task_140(self):  # # [Content: Information] 资讯分类字典
        self.client.get(
            "/api/v1/content/information/dictionary",
            headers=self.headers,
            name="/api/v1/content/information/dictionary",
        )

    @task(1)
    def task_141(self):  # # [Content: Information] 资讯列表
        self.client.get(
            "/api/v1/content/information/list",
            headers=self.headers,
            name="/api/v1/content/information/list",
        )

    @task(1)
    def task_142(self):  # # [Content: File Storage] 文件列表
        self.client.get(
            "/api/v1/content/files/list",
            headers=self.headers,
            name="/api/v1/content/files/list",
        )

    @task(1)
    def task_143(self):  # # [Content: Contact/Contact (About Us)] Contact List
        self.client.get(
            "/api/v1/content/contact/list",
            headers=self.headers,
            name="/api/v1/content/contact/list",
        )

    @task(1)
    def task_144(self):  # # [Content: Contact/Contact (About Us)] Contact Get Info
        self.client.get(
            "/api/v1/content/contact/1",
            params={"item_id": "1"},
            headers=self.headers,
            name="/api/v1/content/contact/1",
        )

    @task(1)
    def task_145(self):  # # [Product] List products
        self.client.get(
            "/api/v1/zhs_product/list",
            headers=self.headers,
            name="/api/v1/zhs_product/list",
        )

    @task(1)
    def task_146(self):  # # [Product] Get product detail
        self.client.get(
            "/api/v1/zhs_product/1",
            params={"item_id": "1"},
            headers=self.headers,
            name="/api/v1/zhs_product/1",
        )

    @task(1)
    def task_147(self):  # # [Product Identity] List product identities
        self.client.get(
            "/api/v1/product_identity/list",
            headers=self.headers,
            name="/api/v1/product_identity/list",
        )

    @task(1)
    def task_148(self):  # # [Product Identity] Get product identity detail
        self.client.get(
            "/api/v1/product_identity/1",
            params={"item_id": "1"},
            headers=self.headers,
            name="/api/v1/product_identity/1",
        )

    @task(1)
    def task_149(self):  # # [Developer Link] List developer links
        self.client.get(
            "/api/v1/developerLink/list",
            headers=self.headers,
            name="/api/v1/developerLink/list",
        )

    @task(1)
    def task_150(self):  # # [Developer Link] Get developer link detail
        self.client.get(
            "/api/v1/developerLink/1",
            params={"item_id": "1"},
            headers=self.headers,
            name="/api/v1/developerLink/1",
        )

    @task(1)
    def task_151(self):  # # [AIGC] List AIGC records
        self.client.get(
            "/api/v1/content/aigc/list",
            headers=self.headers,
            name="/api/v1/content/aigc/list",
        )

    @task(1)
    def task_152(self):  # # [AIGC] Get AIGC detail
        self.client.get(
            "/api/v1/content/aigc/1",
            params={"item_id": "1"},
            headers=self.headers,
            name="/api/v1/content/aigc/1",
        )

    @task(1)
    def task_153(self):  # # [System] List system users
        self.client.get(
            "/api/v1/system/user/list",
            headers=self.headers,
            name="/api/v1/system/user/list",
        )

    @task(1)
    def task_154(self):  # # [System] 导出用户列表到Excel
        self.client.get(
            "/api/v1/system/user/export",
            headers=self.headers,
            name="/api/v1/system/user/export",
        )

    @task(1)
    def task_155(self):  # # [System] 获取当前登录用户信息(含角色与权限)
        self.client.get(
            "/api/v1/system/getInfo",
            headers=self.headers,
            name="/api/v1/system/getInfo",
        )

    @task(1)
    def task_156(self):  # # [System] 获取当前登录用户信息 (别名)
        self.client.get(
            "/api/v1/system/user/getInfo",
            headers=self.headers,
            name="/api/v1/system/user/getInfo",
        )

    @task(1)
    def task_157(self):  # # [System] 获取个人详细资料
        self.client.get(
            "/api/v1/system/user/profile",
            headers=self.headers,
            name="/api/v1/system/user/profile",
        )

    @task(1)
    def task_158(self):  # # [System] List roles
        self.client.get(
            "/api/v1/system/role/list",
            headers=self.headers,
            name="/api/v1/system/role/list",
        )

    @task(1)
    def task_159(self):  # # [System] List menus
        self.client.get(
            "/api/v1/system/menu/list",
            headers=self.headers,
            name="/api/v1/system/menu/list",
        )

    @task(1)
    def task_160(self):  # # [System] 获取路由菜单树 (RuoYi 兼容)
        self.client.get(
            "/api/v1/system/menu/getRouters",
            headers=self.headers,
            name="/api/v1/system/menu/getRouters",
        )

    @task(1)
    def task_161(self):  # # [System] 菜单树选择
        self.client.get(
            "/api/v1/system/menu/treeselect",
            headers=self.headers,
            name="/api/v1/system/menu/treeselect",
        )

    @task(1)
    def task_162(self):  # # [System] 部门列表
        self.client.get(
            "/api/v1/system/dept/list",
            headers=self.headers,
            name="/api/v1/system/dept/list",
        )

    @task(1)
    def task_163(self):  # # [System] 岗位列表
        self.client.get(
            "/api/v1/system/post/list",
            headers=self.headers,
            name="/api/v1/system/post/list",
        )

    @task(1)
    def task_164(self):  # # [System] 字典类型列表
        self.client.get(
            "/api/v1/system/dict/type/list",
            headers=self.headers,
            name="/api/v1/system/dict/type/list",
        )

    @task(1)
    def task_165(self):  # # [System] 字典数据列表
        self.client.get(
            "/api/v1/system/dict/data/list",
            headers=self.headers,
            name="/api/v1/system/dict/data/list",
        )

    @task(1)
    def task_166(self):  # # [System] 按字典类型获取数据
        self.client.get(
            "/api/v1/system/dict/data/type/1",
            params={"dict_type": "1"},
            headers=self.headers,
            name="/api/v1/system/dict/data/type/1",
        )

    @task(1)
    def task_167(self):  # # [System] List system configs
        self.client.get(
            "/api/v1/system/config/list",
            headers=self.headers,
            name="/api/v1/system/config/list",
        )

    @task(1)
    def task_168(self):  # # [System] Get dictionary data
        self.client.get(
            "/api/v1/system/dict/1",
            params={"dict_type": "1"},
            headers=self.headers,
            name="/api/v1/system/dict/1",
        )

    @task(1)
    def task_169(self):  # # [System Admin] 角色列表
        self.client.get(
            "/api/v1/system/admin/role/list",
            headers=self.headers,
            name="/api/v1/system/admin/role/list",
        )

    @task(1)
    def task_170(self):  # # [System Admin] 菜单列表
        self.client.get(
            "/api/v1/system/admin/menu/list",
            headers=self.headers,
            name="/api/v1/system/admin/menu/list",
        )

    @task(1)
    def task_171(self):  # # [System Admin] 获取路由菜单树 (RuoYi 兼容)
        self.client.get(
            "/api/v1/system/admin/menu/getRouters",
            headers=self.headers,
            name="/api/v1/system/admin/menu/getRouters",
        )

    @task(1)
    def task_172(self):  # # [System Admin] 菜单树选择 (RuoYi 兼容)
        self.client.get(
            "/api/v1/system/admin/menu/treeselect",
            headers=self.headers,
            name="/api/v1/system/admin/menu/treeselect",
        )

    @task(1)
    def task_173(self):  # # [System Admin] 角色菜单树
        self.client.get(
            "/api/v1/system/admin/menu/roleMenuTreeselect/1",
            params={"role_id": "1"},
            headers=self.headers,
            name="/api/v1/system/admin/menu/roleMenuTreeselect/1",
        )

    @task(1)
    def task_174(self):  # # [System Admin] 部门列表
        self.client.get(
            "/api/v1/system/admin/dept/list",
            headers=self.headers,
            name="/api/v1/system/admin/dept/list",
        )

    @task(1)
    def task_175(self):  # # [System Admin] 岗位列表
        self.client.get(
            "/api/v1/system/admin/post/list",
            headers=self.headers,
            name="/api/v1/system/admin/post/list",
        )

    @task(1)
    def task_176(self):  # # [System Admin] 参数配置列表
        self.client.get(
            "/api/v1/system/admin/config/list",
            headers=self.headers,
            name="/api/v1/system/admin/config/list",
        )

    @task(1)
    def task_177(self):  # # [System Admin] 按 key 查配置
        self.client.get(
            "/api/v1/system/admin/config/key/1",
            params={"config_key": "1"},
            headers=self.headers,
            name="/api/v1/system/admin/config/key/1",
        )

    @task(1)
    def task_178(self):  # # [System Admin] 字典类型列表
        self.client.get(
            "/api/v1/system/admin/dict/type/list",
            headers=self.headers,
            name="/api/v1/system/admin/dict/type/list",
        )

    @task(1)
    def task_179(self):  # # [System Admin] 字典数据列表
        self.client.get(
            "/api/v1/system/admin/dict/data/list",
            headers=self.headers,
            name="/api/v1/system/admin/dict/data/list",
        )

    @task(1)
    def task_180(self):  # # [System Admin] 按字典类型获取数据 (RuoYi 兼容)
        self.client.get(
            "/api/v1/system/admin/dict/data/type/1",
            params={"dict_type": "1"},
            headers=self.headers,
            name="/api/v1/system/admin/dict/data/type/1",
        )

    @task(1)
    def task_181(self):  # # [System Admin] 导出角色列表到Excel
        self.client.get(
            "/api/v1/system/admin/role/export",
            headers=self.headers,
            name="/api/v1/system/admin/role/export",
        )

    @task(1)
    def task_182(self):  # # [System Admin] 导出菜单列表到Excel
        self.client.get(
            "/api/v1/system/admin/menu/export",
            headers=self.headers,
            name="/api/v1/system/admin/menu/export",
        )

    @task(1)
    def task_183(self):  # # [System Admin] 导出部门列表到Excel
        self.client.get(
            "/api/v1/system/admin/dept/export",
            headers=self.headers,
            name="/api/v1/system/admin/dept/export",
        )

    @task(1)
    def task_184(self):  # # [System Admin] 导出岗位列表到Excel
        self.client.get(
            "/api/v1/system/admin/post/export",
            headers=self.headers,
            name="/api/v1/system/admin/post/export",
        )

    @task(1)
    def task_185(self):  # # [System Admin] 导出参数配置到Excel
        self.client.get(
            "/api/v1/system/admin/config/export",
            headers=self.headers,
            name="/api/v1/system/admin/config/export",
        )

    @task(1)
    def task_186(self):  # # [System Admin] 导出字典类型到Excel
        self.client.get(
            "/api/v1/system/admin/dict/type/export",
            headers=self.headers,
            name="/api/v1/system/admin/dict/type/export",
        )

    @task(1)
    def task_187(self):  # # [System: Audit] 操作日志列表
        self.client.get(
            "/api/v1/system/audit/operlog/list",
            headers=self.headers,
            name="/api/v1/system/audit/operlog/list",
        )

    @task(1)
    def task_188(self):  # # [System: Audit] 登录日志列表
        self.client.get(
            "/api/v1/system/audit/logininfor/list",
            headers=self.headers,
            name="/api/v1/system/audit/logininfor/list",
        )

    @task(1)
    def task_189(self):  # # [System: Audit] 导出操作日志到Excel
        self.client.get(
            "/api/v1/system/audit/operlog/export",
            headers=self.headers,
            name="/api/v1/system/audit/operlog/export",
        )

    @task(1)
    def task_190(self):  # # [System: Audit] 导出登录日志到Excel
        self.client.get(
            "/api/v1/system/audit/logininfor/export",
            headers=self.headers,
            name="/api/v1/system/audit/logininfor/export",
        )

    @task(1)
    def task_191(self):  # # [System: Codegen] List imported codegen tables
        self.client.get(
            "/api/v1/system/gen/list",
            headers=self.headers,
            name="/api/v1/system/gen/list",
        )

    @task(1)
    def task_192(self):  # # [System: Codegen] List database tables from information_schema
        self.client.get(
            "/api/v1/system/gen/db/list",
            headers=self.headers,
            name="/api/v1/system/gen/db/list",
        )

    @task(1)
    def task_193(self):  # # [System: Codegen] List columns for an imported table
        self.client.get(
            "/api/v1/system/gen/column/1",
            params={"table_id": "1"},
            headers=self.headers,
            name="/api/v1/system/gen/column/1",
        )

    @task(1)
    def task_194(self):  # # [System: Codegen] Preview generated code for a table
        self.client.get(
            "/api/v1/system/gen/preview/1",
            params={"table_id": "1"},
            headers=self.headers,
            name="/api/v1/system/gen/preview/1",
        )

    @task(1)
    def task_195(self):  # # [System: Codegen] Download generated code as zip
        self.client.get(
            "/api/v1/system/gen/download/1",
            params={"table_name": "1"},
            headers=self.headers,
            name="/api/v1/system/gen/download/1",
        )

    @task(1)
    def task_196(self):  # # [Monitor: Alerts] 最近告警历史（内存中）
        self.client.get(
            "/api/v1/monitor/alerts/history",
            headers=self.headers,
            name="/api/v1/monitor/alerts/history",
        )

    @task(1)
    def task_197(self):  # # [Monitor: Backfill Progress] Backfill 状态快照
        self.client.get(
            "/api/v1/monitor/backfill/status",
            headers=self.headers,
            name="/api/v1/monitor/backfill/status",
        )

    @task(1)
    def task_198(self):  # # [Monitor: Backfill Progress] Backfill 最近历史事件
        self.client.get(
            "/api/v1/monitor/backfill/history",
            headers=self.headers,
            name="/api/v1/monitor/backfill/history",
        )

    @task(1)
    def task_199(self):  # # [Monitor: Backfill Progress] Backfill 实时进度 (SSE)
        self.client.get(
            "/api/v1/monitor/backfill/progress",
            headers=self.headers,
            name="/api/v1/monitor/backfill/progress",
        )

    @task(1)
    def task_200(self):  # # [Monitor: Canary Promoter Override/Monitor: Canary Promoter] Get Promoter Status
        self.client.get(
            "/api/v1/monitor/canary-promoter/status",
            headers=self.headers,
            name="/api/v1/monitor/canary-promoter/status",
        )

    @task(1)
    def task_201(self):  # # [Monitor: Canary Promoter Override/Monitor: Canary Promoter] Get Override
        self.client.get(
            "/api/v1/monitor/canary-promoter/override",
            headers=self.headers,
            name="/api/v1/monitor/canary-promoter/override",
        )

    @task(1)
    def task_202(self):  # # [Monitor: Canary Audit/Monitor: Canary Audit] Query Canary Audit
        self.client.get(
            "/api/v1/monitor/canary-audit",
            headers=self.headers,
            name="/api/v1/monitor/canary-audit",
        )

    @task(1)
    def task_203(self):  # # [Monitor: Canary Audit/Monitor: Canary Audit] Canary Audit Stats
        self.client.get(
            "/api/v1/monitor/canary-audit/stats",
            headers=self.headers,
            name="/api/v1/monitor/canary-audit/stats",
        )

    @task(1)
    def task_204(self):  # # [Monitor: Inhibition Playground/Monitor: Inhibition Playground] List Presets
        self.client.get(
            "/api/v1/monitor/inhibition/presets",
            headers=self.headers,
            name="/api/v1/monitor/inhibition/presets",
        )

    @task(1)
    def task_205(self):  # # [Canary/Canary] Get Canary Stage
        self.client.get(
            "/api/v1/canary/canary/stage",
            headers=self.headers,
            name="/api/v1/canary/canary/stage",
        )

    @task(1)
    def task_206(self):  # # [Resource: Context] 获取用户上下文
        self.client.get(
            "/api/v1/resource/context/get",
            headers=self.headers,
            name="/api/v1/resource/context/get",
        )

    @task(1)
    def task_207(self):  # # [Resource: Context] 获取指定字段值
        self.client.get(
            "/api/v1/resource/context/field",
            headers=self.headers,
            name="/api/v1/resource/context/field",
        )

    @task(1)
    def task_208(self):  # # [Resource: Context] 获取Agent调用（含token扣除）
        self.client.get(
            "/api/v1/resource/context/agent/1",
            params={"agent_id": "1"},
            headers=self.headers,
            name="/api/v1/resource/context/agent/1",
        )

    @task(1)
    def task_209(self):  # # [Resource: Context] Get sample context data
        self.client.get(
            "/api/v1/resource/context/sample",
            headers=self.headers,
            name="/api/v1/resource/context/sample",
        )

    @task(1)
    def task_210(self):  # # [Tools] 获取工具列表
        self.client.get(
            "/api/v1/tools/list",
            headers=self.headers,
            name="/api/v1/tools/list",
        )

    @task(1)
    def task_211(self):  # # [Tools] 获取工具分类列表
        self.client.get(
            "/api/v1/tools/categories",
            headers=self.headers,
            name="/api/v1/tools/categories",
        )

    @task(1)
    def task_212(self):  # # [Captcha] 获取验证码图片
        self.client.get(
            "/api/v1/auth/captcha",
            headers=self.headers,
            name="/api/v1/auth/captcha",
        )

    @task(1)
    def task_213(self):  # # [Ali Login/Auth: Alipay] Ali Pc Wx Code
        self.client.get(
            "/api/v1/auth/login/ali/pc/wxCode",
            headers=self.headers,
            name="/api/v1/auth/login/ali/pc/wxCode",
        )

    @task(1)
    def task_214(self):  # # [Ali Login/Auth: Alipay] Ali Web Wx Code
        self.client.get(
            "/api/v1/auth/login/ali/web/wxCode",
            headers=self.headers,
            name="/api/v1/auth/login/ali/web/wxCode",
        )

    @task(1)
    def task_215(self):  # # [Enterprise WeChat/Auth: Enterprise WeChat] Enterprise Pc Wx Code
        self.client.get(
            "/api/v1/auth/login/enterprise/pc/wxCode",
            headers=self.headers,
            name="/api/v1/auth/login/enterprise/pc/wxCode",
        )

    @task(1)
    def task_216(self):  # # [Feishu Auth/Auth: Feishu] Feishu Pc Wx Code
        self.client.get(
            "/api/v1/auth/login/feishu/pc/wxCode",
            headers=self.headers,
            name="/api/v1/auth/login/feishu/pc/wxCode",
        )

    @task(1)
    def task_217(self):  # # [Feishu Auth/Auth: Feishu] Feishu Pc Test
        self.client.get(
            "/api/v1/auth/login/feishu/pc/test",
            headers=self.headers,
            name="/api/v1/auth/login/feishu/pc/test",
        )

    @task(1)
    def task_218(self):  # # [LLM: Models Unify] 大模型统一列表 (兼容 ihui-ai-api)
        self.client.get(
            "/api/v1/llm/models-unify",
            headers=self.headers,
            name="/api/v1/llm/models-unify",
        )

    @task(1)
    def task_219(self):  # # [Coze: Templates/Coze Templates] List Templates
        self.client.get(
            "/api/v1/coze/templates/templates/list",
            headers=self.headers,
            name="/api/v1/coze/templates/templates/list",
        )

    @task(1)
    def task_220(self):  # # [Coze: Variables/Coze Variables] Retrieve Variable
        self.client.get(
            "/api/v1/coze/variables/variables/retrieve",
            headers=self.headers,
            name="/api/v1/coze/variables/variables/retrieve",
        )

    @task(1)
    def task_221(self):  # # [Coze: Variables/Coze Variables] List Variables
        self.client.get(
            "/api/v1/coze/variables/variables/list",
            headers=self.headers,
            name="/api/v1/coze/variables/variables/list",
        )

    @task(1)
    def task_222(self):  # # [Coze: Workspaces/Coze Workspaces] List Workspaces
        self.client.get(
            "/api/v1/coze/workspaces/workspaces/list",
            headers=self.headers,
            name="/api/v1/coze/workspaces/workspaces/list",
        )

    @task(1)
    def task_223(self):  # # [Coze: Review/Coze Review] Get Review Status
        self.client.get(
            "/api/v1/coze/review/review/status",
            headers=self.headers,
            name="/api/v1/coze/review/review/status",
        )

    @task(1)
    def task_224(self):  # # [Coze: Apps/Coze Apps] List Apps
        self.client.get(
            "/api/v1/coze/apps/apps/list",
            headers=self.headers,
            name="/api/v1/coze/apps/apps/list",
        )

    @task(1)
    def task_225(self):  # # [Coze: Apps/Coze Apps] List Api Apps
        self.client.get(
            "/api/v1/coze/apps/apps/list_api_apps",
            headers=self.headers,
            name="/api/v1/coze/apps/apps/list_api_apps",
        )

    @task(1)
    def task_226(self):  # # [Coze: Apps/Coze Apps] List App Events
        self.client.get(
            "/api/v1/coze/apps/apps/events",
            headers=self.headers,
            name="/api/v1/coze/apps/apps/events",
        )

    @task(1)
    def task_227(self):  # # [Coze: Audio/Coze Audio] List Voices
        self.client.get(
            "/api/v1/coze/audio/audio/voices",
            headers=self.headers,
            name="/api/v1/coze/audio/audio/voices",
        )

    @task(1)
    def task_228(self):  # # [Coze: Audio/Coze Audio] List Voiceprints
        self.client.get(
            "/api/v1/coze/audio/audio/voiceprints",
            headers=self.headers,
            name="/api/v1/coze/audio/audio/voiceprints",
        )

    @task(1)
    def task_229(self):  # # [MCP] 列出所有 MCP 工具
        self.client.get(
            "/api/v1/mcp/list",
            headers=self.headers,
            name="/api/v1/mcp/list",
        )

    @task(1)
    def task_230(self):  # # [MCP] 工具健康检查
        self.client.get(
            "/api/v1/mcp/1/health",
            params={"tool": "1"},
            headers=self.headers,
            name="/api/v1/mcp/1/health",
        )

    @task(1)
    def task_231(self):  # # [WS Timbre] 音色列表
        self.client.get(
            "/api/v1/ws/timbre/list",
            headers=self.headers,
            name="/api/v1/ws/timbre/list",
        )

    @task(1)
    def task_232(self):  # # [WS Admin/WS Admin] WebSocket连接统计
        self.client.get(
            "/api/v1/ws/stats",
            headers=self.headers,
            name="/api/v1/ws/stats",
        )

    @task(1)
    def task_233(self):  # # [WS Admin/WS Admin] WebSocket健康检查
        self.client.get(
            "/api/v1/ws/health",
            headers=self.headers,
            name="/api/v1/ws/health",
        )

    @task(1)
    def task_234(self):  # # [WS Admin/WS Admin] 系统状态（内存、CPU、连接数）
        self.client.get(
            "/api/v1/ws/system-status",
            headers=self.headers,
            name="/api/v1/ws/system-status",
        )

    @task(1)
    def task_235(self):  # # [WS Admin/WS Admin] 当前连接列表
        self.client.get(
            "/api/v1/ws/connections",
            headers=self.headers,
            name="/api/v1/ws/connections",
        )

    @task(1)
    def task_236(self):  # # [Remote Device/Remote Device] Get Info
        self.client.get(
            "/api/v1/remote/info/1",
            params={"uuid": "1"},
            headers=self.headers,
            name="/api/v1/remote/info/1",
        )

    @task(1)
    def task_237(self):  # # [Remote Device/Remote Device] Get Role
        self.client.get(
            "/api/v1/remote/role",
            headers=self.headers,
            name="/api/v1/remote/role",
        )

    @task(1)
    def task_238(self):  # # [Remote Device/Remote Device] Agent Category
        self.client.get(
            "/api/v1/remote/agent/category",
            headers=self.headers,
            name="/api/v1/remote/agent/category",
        )

    @task(1)
    def task_239(self):  # # [Remote Device/Remote Device] Agent Category2
        self.client.get(
            "/api/v1/remote/agent/category2",
            headers=self.headers,
            name="/api/v1/remote/agent/category2",
        )

    @task(1)
    def task_240(self):  # # [Remote Device/Remote Device] Agent By Type
        self.client.get(
            "/api/v1/remote/agent/by/type",
            headers=self.headers,
            name="/api/v1/remote/agent/by/type",
        )

    @task(1)
    def task_241(self):  # # [Remote Device/Remote Device] Agent By Collect
        self.client.get(
            "/api/v1/remote/agent/by/collect/1",
            params={"uuid": "1"},
            headers=self.headers,
            name="/api/v1/remote/agent/by/collect/1",
        )

    @task(1)
    def task_242(self):  # # [Remote Device/Remote Device] Agent By Pay
        self.client.get(
            "/api/v1/remote/agent/by/pay",
            headers=self.headers,
            name="/api/v1/remote/agent/by/pay",
        )

    @task(1)
    def task_243(self):  # # [Remote Device/Remote Device] Get Withdrawal Open
        self.client.get(
            "/api/v1/remote/get/true",
            headers=self.headers,
            name="/api/v1/remote/get/true",
        )

    @task(1)
    def task_244(self):  # # [Remote Third/Remote Third] Third Group List
        self.client.get(
            "/api/v1/remote/third/group/list",
            headers=self.headers,
            name="/api/v1/remote/third/group/list",
        )

    @task(1)
    def task_245(self):  # # [Video Preload & Breakpoint/Video: Preload & Breakpoint] 查询断点
        self.client.get(
            "/api/v1/video/breakpoint/get",
            headers=self.headers,
            name="/api/v1/video/breakpoint/get",
        )

    @task(1)
    def task_246(self):  # # [Video Preload & Breakpoint/Video: Preload & Breakpoint] 取 HLS master.m3u8 文本 (含 .ts 预签名 URL)
        self.client.get(
            "/api/v1/video/hls/manifest/1",
            params={"videoId": "1"},
            headers=self.headers,
            name="/api/v1/video/hls/manifest/1",
        )

    @task(1)
    def task_247(self):  # # [Video Preload & Breakpoint/Video: Preload & Breakpoint] 取单档 m3u8 文本
        self.client.get(
            "/api/v1/video/hls/playlist/1/1",
            params={"videoId": "1", "bitrate": "1"},
            headers=self.headers,
            name="/api/v1/video/hls/playlist/1/1",
        )

    @task(1)
    def task_248(self):  # # [SMS Proxy] Get Proxy Config
        self.client.get(
            "/api/v1/api/sms-proxy/config",
            headers=self.headers,
            name="/api/v1/api/sms-proxy/config",
        )

    @task(1)
    def task_249(self):  # # [Ask/Ask: Category] 分类列表(管理员)
        self.client.get(
            "/api/v1/ask/category/admin/list",
            headers=self.headers,
            name="/api/v1/ask/category/admin/list",
        )

    @task(1)
    def task_250(self):  # # [Ask/Ask: Category] 分类列表(公开)
        self.client.get(
            "/api/v1/ask/category/public-api/list",
            headers=self.headers,
            name="/api/v1/ask/category/public-api/list",
        )

    @task(1)
    def task_251(self):  # # [Ask/Ask: Category] 分类详情
        self.client.get(
            "/api/v1/ask/category/1",
            params={"cat_id": "1"},
            headers=self.headers,
            name="/api/v1/ask/category/1",
        )

    @task(1)
    def task_252(self):  # # [Ask/Ask: Question] 问题列表(需权限)
        self.client.get(
            "/api/v1/ask/question/list",
            headers=self.headers,
            name="/api/v1/ask/question/list",
        )

    @task(1)
    def task_253(self):  # # [Ask/Ask: Question] 问题列表(公开)
        self.client.get(
            "/api/v1/ask/question/public-api/list",
            headers=self.headers,
            name="/api/v1/ask/question/public-api/list",
        )

    @task(1)
    def task_254(self):  # # [Ask/Ask: Question] 问题详情
        self.client.get(
            "/api/v1/ask/question/public-api",
            headers=self.headers,
            name="/api/v1/ask/question/public-api",
        )

    @task(1)
    def task_255(self):  # # [Ask/Ask: Question] 会员问题数
        self.client.get(
            "/api/v1/ask/question/public-api/member/count",
            headers=self.headers,
            name="/api/v1/ask/question/public-api/member/count",
        )

    @task(1)
    def task_256(self):  # # [Ask/Ask: Answer] 回答列表(需权限)
        self.client.get(
            "/api/v1/ask/answer/list",
            headers=self.headers,
            name="/api/v1/ask/answer/list",
        )

    @task(1)
    def task_257(self):  # # [Ask/Ask: Answer] 回答列表(公开)
        self.client.get(
            "/api/v1/ask/answer/public-api/list",
            headers=self.headers,
            name="/api/v1/ask/answer/public-api/list",
        )

    @task(1)
    def task_258(self):  # # [Ask/Ask: Answer] 回答详情
        self.client.get(
            "/api/v1/ask/answer/public-api",
            headers=self.headers,
            name="/api/v1/ask/answer/public-api",
        )

    @task(1)
    def task_259(self):  # # [Ask/Ask: Answer] 会员回答数
        self.client.get(
            "/api/v1/ask/answer/public-api/member/count",
            headers=self.headers,
            name="/api/v1/ask/answer/public-api/member/count",
        )

    @task(1)
    def task_260(self):  # # [Circle/Circle: Circle] 圈子列表
        self.client.get(
            "/api/v1/circle/list",
            headers=self.headers,
            name="/api/v1/circle/list",
        )

    @task(1)
    def task_261(self):  # # [Circle/Circle: Circle] 圈子详情
        self.client.get(
            "/api/v1/circle/1",
            params={"cid": "1"},
            headers=self.headers,
            name="/api/v1/circle/1",
        )

    @task(1)
    def task_262(self):  # # [Circle/Circle: Circle] 成员列表
        self.client.get(
            "/api/v1/circle/1/members",
            params={"cid": "1"},
            headers=self.headers,
            name="/api/v1/circle/1/members",
        )

    @task(1)
    def task_263(self):  # # [Circle/Circle: Circle] 圈子分类列表
        self.client.get(
            "/api/v1/circle/category/list",
            headers=self.headers,
            name="/api/v1/circle/category/list",
        )

    @task(1)
    def task_264(self):  # # [Circle/Circle: Post] 帖子列表
        self.client.get(
            "/api/v1/circle/post/list",
            headers=self.headers,
            name="/api/v1/circle/post/list",
        )

    @task(1)
    def task_265(self):  # # [Circle/Circle: Post] 帖子详情
        self.client.get(
            "/api/v1/circle/post/1",
            params={"pid": "1"},
            headers=self.headers,
            name="/api/v1/circle/post/1",
        )

    @task(1)
    def task_266(self):  # # [Circle/Circle: Post] 评论列表
        self.client.get(
            "/api/v1/circle/post/1/comments",
            params={"pid": "1"},
            headers=self.headers,
            name="/api/v1/circle/post/1/comments",
        )

    @task(1)
    def task_267(self):  # # [Exam/Exam] 试卷列表
        self.client.get(
            "/api/v1/exam/paper/list",
            headers=self.headers,
            name="/api/v1/exam/paper/list",
        )

    @task(1)
    def task_268(self):  # # [Exam/Exam] 试卷详情
        self.client.get(
            "/api/v1/exam/paper/1",
            params={"pid": "1"},
            headers=self.headers,
            name="/api/v1/exam/paper/1",
        )

    @task(1)
    def task_269(self):  # # [Exam/Exam] 题目列表
        self.client.get(
            "/api/v1/exam/question/list",
            headers=self.headers,
            name="/api/v1/exam/question/list",
        )

    @task(1)
    def task_270(self):  # # [Exam/Exam] 考试记录列表
        self.client.get(
            "/api/v1/exam/record/list",
            headers=self.headers,
            name="/api/v1/exam/record/list",
        )

    @task(1)
    def task_271(self):  # # [Exam/Exam] 考试记录详情
        self.client.get(
            "/api/v1/exam/record/1",
            params={"rid": "1"},
            headers=self.headers,
            name="/api/v1/exam/record/1",
        )

    @task(1)
    def task_272(self):  # # [Exam/Exam] 错题本
        self.client.get(
            "/api/v1/exam/wrong/list",
            headers=self.headers,
            name="/api/v1/exam/wrong/list",
        )

    @task(1)
    def task_273(self):  # # [Exam/Exam] 考试分类列表
        self.client.get(
            "/api/v1/exam/category/list",
            headers=self.headers,
            name="/api/v1/exam/category/list",
        )

    @task(1)
    def task_274(self):  # # [Live/Live] 直播列表
        self.client.get(
            "/api/v1/live/channel/list",
            headers=self.headers,
            name="/api/v1/live/channel/list",
        )

    @task(1)
    def task_275(self):  # # [Live/Live] 直播详情
        self.client.get(
            "/api/v1/live/channel/1",
            params={"cid": "1"},
            headers=self.headers,
            name="/api/v1/live/channel/1",
        )

    @task(1)
    def task_276(self):  # # [Live/Live] 评论列表
        self.client.get(
            "/api/v1/live/channel/1/comments",
            params={"cid": "1"},
            headers=self.headers,
            name="/api/v1/live/channel/1/comments",
        )

    @task(1)
    def task_277(self):  # # [Live/Live] 直播分类
        self.client.get(
            "/api/v1/live/category/list",
            headers=self.headers,
            name="/api/v1/live/category/list",
        )

    @task(1)
    def task_278(self):  # # [Message/Message] 我的消息列表
        self.client.get(
            "/api/v1/message/list",
            headers=self.headers,
            name="/api/v1/message/list",
        )

    @task(1)
    def task_279(self):  # # [Message/Message] 未读消息数
        self.client.get(
            "/api/v1/message/unread-count",
            headers=self.headers,
            name="/api/v1/message/unread-count",
        )

    @task(1)
    def task_280(self):  # # [Message/Message] 公告列表
        self.client.get(
            "/api/v1/message/announcement/list",
            headers=self.headers,
            name="/api/v1/message/announcement/list",
        )

    @task(1)
    def task_281(self):  # # [Message/Message] 公告详情
        self.client.get(
            "/api/v1/message/announcement/1",
            params={"aid": "1"},
            headers=self.headers,
            name="/api/v1/message/announcement/1",
        )

    @task(1)
    def task_282(self):  # # [Message/Message] 消息模板列表
        self.client.get(
            "/api/v1/message/template/list",
            headers=self.headers,
            name="/api/v1/message/template/list",
        )

    @task(1)
    def task_283(self):  # # [Notification/Notification] 我的通知列表
        self.client.get(
            "/api/v1/notification/list",
            headers=self.headers,
            name="/api/v1/notification/list",
        )

    @task(1)
    def task_284(self):  # # [Notification/Notification] 未读通知数
        self.client.get(
            "/api/v1/notification/unread-count",
            headers=self.headers,
            name="/api/v1/notification/unread-count",
        )

    @task(1)
    def task_285(self):  # # [Notification/Notification] 通知渠道列表
        self.client.get(
            "/api/v1/notification/channel/list",
            headers=self.headers,
            name="/api/v1/notification/channel/list",
        )

    @task(1)
    def task_286(self):  # # [Notification/Notification] 我的订阅偏好
        self.client.get(
            "/api/v1/notification/subscription/list",
            headers=self.headers,
            name="/api/v1/notification/subscription/list",
        )

    @task(1)
    def task_287(self):  # # [Notification/Notification] 通知发送日志
        self.client.get(
            "/api/v1/notification/log/list",
            headers=self.headers,
            name="/api/v1/notification/log/list",
        )

    @task(1)
    def task_288(self):  # # [Point/Point] 我的积分账户
        self.client.get(
            "/api/v1/point/account",
            headers=self.headers,
            name="/api/v1/point/account",
        )

    @task(1)
    def task_289(self):  # # [Point/Point] 指定用户积分账户
        self.client.get(
            "/api/v1/point/account/1",
            params={"user_id": "1"},
            headers=self.headers,
            name="/api/v1/point/account/1",
        )

    @task(1)
    def task_290(self):  # # [Point/Point] 积分流水
        self.client.get(
            "/api/v1/point/log/list",
            headers=self.headers,
            name="/api/v1/point/log/list",
        )

    @task(1)
    def task_291(self):  # # [Point/Point] 积分规则列表
        self.client.get(
            "/api/v1/point/rule/list",
            headers=self.headers,
            name="/api/v1/point/rule/list",
        )

    @task(1)
    def task_292(self):  # # [Point/Point] 积分商品列表
        self.client.get(
            "/api/v1/point/goods/list",
            headers=self.headers,
            name="/api/v1/point/goods/list",
        )

    @task(1)
    def task_293(self):  # # [Point/Point] 积分商品详情
        self.client.get(
            "/api/v1/point/goods/1",
            params={"gid": "1"},
            headers=self.headers,
            name="/api/v1/point/goods/1",
        )

    @task(1)
    def task_294(self):  # # [Point/Point] 兑换记录
        self.client.get(
            "/api/v1/point/exchange/list",
            headers=self.headers,
            name="/api/v1/point/exchange/list",
        )

    @task(1)
    def task_295(self):  # # [Visit Tracking/Visit Tracking] 访问日志
        self.client.get(
            "/api/v1/visit/log/list",
            headers=self.headers,
            name="/api/v1/visit/log/list",
        )

    @task(1)
    def task_296(self):  # # [Visit Tracking/Visit Tracking] 每日访问统计
        self.client.get(
            "/api/v1/visit/stats/daily",
            headers=self.headers,
            name="/api/v1/visit/stats/daily",
        )

    @task(1)
    def task_297(self):  # # [Visit Tracking/Visit Tracking] 今日实时统计
        self.client.get(
            "/api/v1/visit/stats/today",
            headers=self.headers,
            name="/api/v1/visit/stats/today",
        )

    @task(1)
    def task_298(self):  # # [Visit Tracking/Visit Tracking] 来源统计
        self.client.get(
            "/api/v1/visit/stats/source",
            headers=self.headers,
            name="/api/v1/visit/stats/source",
        )

    @task(1)
    def task_299(self):  # # [Visit Tracking/Visit Tracking] 页面统计
        self.client.get(
            "/api/v1/visit/stats/page",
            headers=self.headers,
            name="/api/v1/visit/stats/page",
        )

    @task(1)
    def task_300(self):  # # [Behavior/Behavior] 点赞列表
        self.client.get(
            "/api/v1/behavior/like/list",
            headers=self.headers,
            name="/api/v1/behavior/like/list",
        )

    @task(1)
    def task_301(self):  # # [Behavior/Behavior] 收藏列表
        self.client.get(
            "/api/v1/behavior/favorite/list",
            headers=self.headers,
            name="/api/v1/behavior/favorite/list",
        )

    @task(1)
    def task_302(self):  # # [Behavior/Behavior] 评论列表
        self.client.get(
            "/api/v1/behavior/comment/list",
            headers=self.headers,
            name="/api/v1/behavior/comment/list",
        )

    @task(1)
    def task_303(self):  # # [Behavior/Behavior] 举报列表
        self.client.get(
            "/api/v1/behavior/report/list",
            headers=self.headers,
            name="/api/v1/behavior/report/list",
        )

    @task(1)
    def task_304(self):  # # [Behavior/Behavior] 敏感词列表
        self.client.get(
            "/api/v1/behavior/sensitive/list",
            headers=self.headers,
            name="/api/v1/behavior/sensitive/list",
        )

    @task(1)
    def task_305(self):  # # [Behavior/Behavior] 关注列表
        self.client.get(
            "/api/v1/behavior/follow/list",
            headers=self.headers,
            name="/api/v1/behavior/follow/list",
        )

    @task(1)
    def task_306(self):  # # [Schedule/Schedule] 我的日程
        self.client.get(
            "/api/v1/schedule/list",
            headers=self.headers,
            name="/api/v1/schedule/list",
        )

    @task(1)
    def task_307(self):  # # [Ranking/Ranking] 排行榜列表
        self.client.get(
            "/api/v1/ranking/list",
            headers=self.headers,
            name="/api/v1/ranking/list",
        )

    @task(1)
    def task_308(self):  # # [Ranking/Ranking] 用户积分排行榜
        self.client.get(
            "/api/v1/ranking/user",
            headers=self.headers,
            name="/api/v1/ranking/user",
        )

    @task(1)
    def task_309(self):  # # [Ranking/Ranking] Agent排行榜
        self.client.get(
            "/api/v1/ranking/agent",
            headers=self.headers,
            name="/api/v1/ranking/agent",
        )

    @task(1)
    def task_310(self):  # # [Ranking/Ranking] 课程排行榜
        self.client.get(
            "/api/v1/ranking/course",
            headers=self.headers,
            name="/api/v1/ranking/course",
        )

    @task(1)
    def task_311(self):  # # [Advertise/Advertise] 广告位列表
        self.client.get(
            "/api/v1/advertise/position/list",
            headers=self.headers,
            name="/api/v1/advertise/position/list",
        )

    @task(1)
    def task_312(self):  # # [Advertise/Advertise] 广告列表
        self.client.get(
            "/api/v1/advertise/list",
            headers=self.headers,
            name="/api/v1/advertise/list",
        )

    @task(1)
    def task_313(self):  # # [Advertise/Advertise] 广告详情
        self.client.get(
            "/api/v1/advertise/1",
            params={"aid": "1"},
            headers=self.headers,
            name="/api/v1/advertise/1",
        )

    @task(1)
    def task_314(self):  # # [Organization/Organization] 组织列表
        self.client.get(
            "/api/v1/organization/list",
            headers=self.headers,
            name="/api/v1/organization/list",
        )

    @task(1)
    def task_315(self):  # # [Organization/Organization] 组织树
        self.client.get(
            "/api/v1/organization/tree",
            headers=self.headers,
            name="/api/v1/organization/tree",
        )

    @task(1)
    def task_316(self):  # # [Organization/Organization] 组织详情
        self.client.get(
            "/api/v1/organization/1",
            params={"oid": "1"},
            headers=self.headers,
            name="/api/v1/organization/1",
        )

    @task(1)
    def task_317(self):  # # [Organization/Organization] 组织成员
        self.client.get(
            "/api/v1/organization/1/members",
            params={"oid": "1"},
            headers=self.headers,
            name="/api/v1/organization/1/members",
        )

    @task(1)
    def task_318(self):  # # [Feedback/Feedback] 我的反馈
        self.client.get(
            "/api/v1/feedback/list",
            headers=self.headers,
            name="/api/v1/feedback/list",
        )

    @task(1)
    def task_319(self):  # # [Feedback/Feedback] 反馈列表(管理员)
        self.client.get(
            "/api/v1/feedback/admin/list",
            headers=self.headers,
            name="/api/v1/feedback/admin/list",
        )

    @task(1)
    def task_320(self):  # # [Feedback/Feedback] 反馈详情
        self.client.get(
            "/api/v1/feedback/1",
            params={"fid": "1"},
            headers=self.headers,
            name="/api/v1/feedback/1",
        )

    @task(1)
    def task_321(self):  # # [Auth Identity/Auth Identity] 我的认证
        self.client.get(
            "/api/v1/auth-identity/my",
            headers=self.headers,
            name="/api/v1/auth-identity/my",
        )

    @task(1)
    def task_322(self):  # # [Auth Identity/Auth Identity] 认证列表(管理员)
        self.client.get(
            "/api/v1/auth-identity/list",
            headers=self.headers,
            name="/api/v1/auth-identity/list",
        )

    @task(1)
    def task_323(self):  # # [App Version/App Version] 版本列表
        self.client.get(
            "/api/v1/app-version/list",
            headers=self.headers,
            name="/api/v1/app-version/list",
        )

    @task(1)
    def task_324(self):  # # [App Version/App Version] 检查更新
        self.client.get(
            "/api/v1/app-version/check",
            headers=self.headers,
            name="/api/v1/app-version/check",
        )

    @task(1)
    def task_325(self):  # # [Agent Upload/Agent Upload] 我的上传
        self.client.get(
            "/api/v1/agent-upload/list",
            headers=self.headers,
            name="/api/v1/agent-upload/list",
        )

    @task(1)
    def task_326(self):  # # [Category Dictionary/Category Dictionary] 字典列表
        self.client.get(
            "/api/v1/category-dictionary/list",
            headers=self.headers,
            name="/api/v1/category-dictionary/list",
        )

    @task(1)
    def task_327(self):  # # [Category Dictionary/Category Dictionary] 字典类型列表
        self.client.get(
            "/api/v1/category-dictionary/type",
            headers=self.headers,
            name="/api/v1/category-dictionary/type",
        )

    @task(1)
    def task_328(self):  # # [Category Dictionary/Category Dictionary] 字典详情
        self.client.get(
            "/api/v1/category-dictionary/1",
            params={"did": "1"},
            headers=self.headers,
            name="/api/v1/category-dictionary/1",
        )

    @task(1)
    def task_329(self):  # # [Education Platform/Education Platform] 教育平台列表
        self.client.get(
            "/api/v1/education-platform/list",
            headers=self.headers,
            name="/api/v1/education-platform/list",
        )

    @task(1)
    def task_330(self):  # # [Education Platform/Education Platform] 同步日志
        self.client.get(
            "/api/v1/education-platform/sync/log",
            headers=self.headers,
            name="/api/v1/education-platform/sync/log",
        )

    @task(1)
    def task_331(self):  # # [Course Audit/Course Audit] 审核列表
        self.client.get(
            "/api/v1/course-audit/list",
            headers=self.headers,
            name="/api/v1/course-audit/list",
        )

    @task(1)
    def task_332(self):  # # [Course Audit/Course Audit] 审核详情
        self.client.get(
            "/api/v1/course-audit/1",
            params={"aid": "1"},
            headers=self.headers,
            name="/api/v1/course-audit/1",
        )

    @task(1)
    def task_333(self):  # # [User Comment Log/User Comment Log] 评论日志
        self.client.get(
            "/api/v1/user-comment-log/list",
            headers=self.headers,
            name="/api/v1/user-comment-log/list",
        )

    @task(1)
    def task_334(self):  # # [User Video Log/User Video Log] 我的观看记录
        self.client.get(
            "/api/v1/user-video-log/list",
            headers=self.headers,
            name="/api/v1/user-video-log/list",
        )

    @task(1)
    def task_335(self):  # # [User Video Log/User Video Log] 观看统计
        self.client.get(
            "/api/v1/user-video-log/stats",
            headers=self.headers,
            name="/api/v1/user-video-log/stats",
        )

    @task(1)
    def task_336(self):  # # [User Video Comment/User Video Comment] 视频评论列表
        self.client.get(
            "/api/v1/user-video-comment/list",
            headers=self.headers,
            name="/api/v1/user-video-comment/list",
        )

    @task(1)
    def task_337(self):  # # [TBox/TBox] 设备列表
        self.client.get(
            "/api/v1/tbox/device/list",
            headers=self.headers,
            name="/api/v1/tbox/device/list",
        )

    @task(1)
    def task_338(self):  # # [TBox/TBox] 设备详情
        self.client.get(
            "/api/v1/tbox/device/1",
            params={"device_no": "1"},
            headers=self.headers,
            name="/api/v1/tbox/device/1",
        )

    @task(1)
    def task_339(self):  # # [TBox/TBox] 指令列表
        self.client.get(
            "/api/v1/tbox/command/list",
            headers=self.headers,
            name="/api/v1/tbox/command/list",
        )

    @task(1)
    def task_340(self):  # # [Agent Need Task/Agent Need Task] 需求列表
        self.client.get(
            "/api/v1/agent-need-task/list",
            headers=self.headers,
            name="/api/v1/agent-need-task/list",
        )

    @task(1)
    def task_341(self):  # # [Agent Need Task/Agent Need Task] 需求详情
        self.client.get(
            "/api/v1/agent-need-task/1",
            params={"tid": "1"},
            headers=self.headers,
            name="/api/v1/agent-need-task/1",
        )

    @task(1)
    def task_342(self):  # # [Agent Need Task/Agent Need Task] 任务报价列表
        self.client.get(
            "/api/v1/agent-need-task/1/bids",
            params={"tid": "1"},
            headers=self.headers,
            name="/api/v1/agent-need-task/1/bids",
        )

    @task(1)
    def task_343(self):  # # [User Agent Context/User Agent Context] 获取上下文
        self.client.get(
            "/api/v1/user-agent-context/list",
            headers=self.headers,
            name="/api/v1/user-agent-context/list",
        )

    @task(1)
    def task_344(self):  # # [User Agent Context/User Agent Context] 总结列表
        self.client.get(
            "/api/v1/user-agent-context/summary/list",
            headers=self.headers,
            name="/api/v1/user-agent-context/summary/list",
        )

    @task(1)
    def task_345(self):  # # [User Agent Image/User Agent Image] 我的图片交互
        self.client.get(
            "/api/v1/user-agent-image/list",
            headers=self.headers,
            name="/api/v1/user-agent-image/list",
        )

    @task(1)
    def task_346(self):  # # [User Agent Image/User Agent Image] 图片详情
        self.client.get(
            "/api/v1/user-agent-image/1",
            params={"iid": "1"},
            headers=self.headers,
            name="/api/v1/user-agent-image/1",
        )

    @task(1)
    def task_347(self):  # # [Video Preload/Video Preload] 我的预读任务
        self.client.get(
            "/api/v1/video-preload/list",
            headers=self.headers,
            name="/api/v1/video-preload/list",
        )

    @task(1)
    def task_348(self):  # # [Luyala Proxy/Luyala Proxy] 可用模型列表
        self.client.get(
            "/api/v1/luyala-proxy/models",
            headers=self.headers,
            name="/api/v1/luyala-proxy/models",
        )

    @task(1)
    def task_349(self):  # # [OpenRouter Proxy/OpenRouter Proxy] 可用模型列表
        self.client.get(
            "/api/v1/openrouter-proxy/models",
            headers=self.headers,
            name="/api/v1/openrouter-proxy/models",
        )

    @task(1)
    def task_350(self):  # # [OpenRouter Proxy/OpenRouter Proxy] 账户额度
        self.client.get(
            "/api/v1/openrouter-proxy/credits",
            headers=self.headers,
            name="/api/v1/openrouter-proxy/credits",
        )

    @task(1)
    def task_351(self):  # # [Callback/Callback] 回调日志
        self.client.get(
            "/api/v1/callback/log/list",
            headers=self.headers,
            name="/api/v1/callback/log/list",
        )

    @task(1)
    def task_352(self):  # # [Callback/Callback] 回调详情
        self.client.get(
            "/api/v1/callback/log/1",
            params={"lid": "1"},
            headers=self.headers,
            name="/api/v1/callback/log/1",
        )

    @task(1)
    def task_353(self):  # # [User Model Chat/User Model Chat] 可用模型列表
        self.client.get(
            "/api/v1/user-model-chat/list",
            headers=self.headers,
            name="/api/v1/user-model-chat/list",
        )

    @task(1)
    def task_354(self):  # # [Doubao Image Edit/Doubao Image Edit] 豆包可用模型
        self.client.get(
            "/api/v1/doubao-image-edit/models",
            headers=self.headers,
            name="/api/v1/doubao-image-edit/models",
        )

    @task(1)
    def task_355(self):  # # [Tongyi Image Edit/Tongyi Image Edit] 通义可用模型
        self.client.get(
            "/api/v1/tongyi-image-edit/models",
            headers=self.headers,
            name="/api/v1/tongyi-image-edit/models",
        )

    @task(1)
    def task_356(self):  # # [Tongyi Image2Image/Tongyi Image2Image] 通义图生图可用模型
        self.client.get(
            "/api/v1/tongyi-image2image/models",
            headers=self.headers,
            name="/api/v1/tongyi-image2image/models",
        )

    @task(1)
    def task_357(self):  # # [Service Catalog/Service Catalog] 服务列表
        self.client.get(
            "/api/v1/service-catalog/list",
            headers=self.headers,
            name="/api/v1/service-catalog/list",
        )

    @task(1)
    def task_358(self):  # # [Service Catalog/Service Catalog] 服务详情
        self.client.get(
            "/api/v1/service-catalog/1",
            params={"sid": "1"},
            headers=self.headers,
            name="/api/v1/service-catalog/1",
        )

    @task(1)
    def task_359(self):  # # [Service Catalog/Service Catalog] 服务调用日志
        self.client.get(
            "/api/v1/service-catalog/log/list",
            headers=self.headers,
            name="/api/v1/service-catalog/log/list",
        )

    @task(1)
    def task_360(self):  # # [Test/Test] 测试页面首页
        self.client.get(
            "/api/v1/test",
            headers=self.headers,
            name="/api/v1/test",
        )

    @task(1)
    def task_361(self):  # # [Test/Test] 健康检查
        self.client.get(
            "/api/v1/test/health",
            headers=self.headers,
            name="/api/v1/test/health",
        )

    @task(1)
    def task_362(self):  # # [Test/Test] API文档页面
        self.client.get(
            "/api/v1/test/docs-page",
            headers=self.headers,
            name="/api/v1/test/docs-page",
        )

"""
Unified configuration using Pydantic Settings.
Reads from .env files and environment variables.
"""


try:
    from pydantic import BaseSettings, Field
    from pydantic import validator as _validator
except ImportError:
    from pydantic import Field
    from pydantic import field_validator as _validator
    from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings -- loaded from .env file and environment variables."""

    # ===================================================================
    # DATABASE (PostgreSQL)
    # ===================================================================
    DB1_URL: str = ""
    DB1_POOL_SIZE: int = 50
    DB1_MAX_OVERFLOW: int = 200
    DB1_POOL_RECYCLE: int = 3600
    DB1_PRE_PING: bool = True

    DB2_URL: str = ""
    DB2_POOL_SIZE: int = 20
    DB2_MAX_OVERFLOW: int = 80
    DB2_POOL_RECYCLE: int = 3600
    DB2_PRE_PING: bool = True

    DB3_URL: str = ""
    DB3_POOL_SIZE: int = 15
    DB3_MAX_OVERFLOW: int = 45
    DB3_POOL_RECYCLE: int = 3600
    DB3_PRE_PING: bool = True

    # ===================================================================
    # MULTI-TENANT (建议 102 阶段 1)
    # ===================================================================
    # 单租户模式: False (默认, 与原 PG 行为一致)
    # 多租户模式: True, SQLAlchemy event hook 自动切 search_path 到 tenant_{tid} schema
    MULTI_TENANT_ENABLED: bool = False
    # PostgreSQL 主库 URL (阶段 0 PG 迁移后启用)
    PG_HOST: str = "127.0.0.1"
    PG_PORT: int = 5432
    PG_USER: str = "zhs"
    PG_PASSWORD: str = ""
    PG_DATABASE: str = "zhs_platform"

    # ===================================================================
    # REDIS
    # ===================================================================
    # 优先使用 REDIS_URL 完整连接串 (生产推荐: redis://:password@host:port/db)
    # 未提供时使用分项配置
    REDIS_URL: str = ""
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0
    REDIS_PREFIX: str = "public_socket:"

    # ===================================================================
    # COZE
    # ===================================================================
    COZE_API_BASE: str = "https://api.coze.cn"
    COZE_COM_BASE_URL: str = "https://api.coze.com"
    COZE_OAUTH_APP_ID: str = ""
    COZE_OAUTH_APP_AUD: str = "api.coze.cn"
    COZE_OAUTH_TOKEN_URL: str = "https://api.coze.cn/api/permission/oauth2/token"
    COZE_PUBLIC_KEY_ID: str = ""
    COZE_ACCOUNT_ID: str = ""
    DOUBAO_IMAGE_API_URL: str = ""
    COZE_PRIVATE_KEY: str = ""
    # Coze 模型搜索工作流 ID (供 coze_workflow.run_model_search_workflow 使用)
    COZE_MODEL_SEARCH_WORKFLOW_ID: str = "7575433446743375907"

    # -------------------------------------------------------------------
    # COZE OAuth 多模式 (设备端 / Web / PKCE / JWT 独立凭证)
    # 参考: 历史 coze_zhs_py/config.py 第 116-124 行
    # -------------------------------------------------------------------
    COZE_DEVICE_OAUTH_CLIENT_ID: str = Field(default="", description="设备端 OAuth 客户端 ID")
    COZE_WEB_OAUTH_CLIENT_ID: str = Field(default="", description="Web OAuth 客户端 ID")
    COZE_WEB_OAUTH_CLIENT_SECRET: str = Field(default="", description="Web OAuth 客户端密钥")
    COZE_WEB_OAUTH_REDIRECT_URI: str = Field(default="", description="Web OAuth 重定向 URI")
    COZE_PKCE_OAUTH_CLIENT_ID: str = Field(default="", description="PKCE OAuth 客户端 ID")
    COZE_JWT_OAUTH_CLIENT_ID: str = Field(default="", description="JWT OAuth 客户端 ID（独立于 COZE_OAUTH_APP_ID）")
    COZE_JWT_OAUTH_PRIVATE_KEY: str = Field(default="", description="JWT OAuth 私钥（独立于 COZE_PRIVATE_KEY）")
    COZE_JWT_OAUTH_PRIVATE_KEY_FILE_PATH: str = Field(default="", description="JWT OAuth 私钥文件路径")
    COZE_JWT_OAUTH_PUBLIC_KEY_ID: str = Field(default="", description="JWT OAuth 公钥 ID（独立于 COZE_PUBLIC_KEY_ID）")

    # ===================================================================
    # SPECIAL BOT (特殊 bot 缓存配置, 对应历史 SpecialBotCache)
    # ===================================================================
    SPECIAL_BOT_IDS: str = ""  # 逗号分隔的特殊智能体 ID 列表

    # ===================================================================
    # WECHAT
    # ===================================================================
    WX_MINI_APPID: str = ""
    WX_MINI_SECRET: str = ""
    WX_PC_APPID: str = ""
    WX_PC_SECRET: str = ""
    WX_APP_APPID: str = ""  # app.apply.id - Android APP ID
    WX_SHOP_ID: str = ""
    WX_PAY_V3_KEY: str = ""
    WX_PAY_PUB_KEY_ID: str = ""
    WX_PAY_CERT_SERIAL: str = ""
    WX_PAY_PRIVATE_KEY_PATH: str = "/ai_zhs/cert/zhsLogin_private.pem"
    WX_PAY_CERT_PASS: str = ""
    WX_PAY_NOTIFY_URL: str = ""
    WX_PAY_COURSE_NOTIFY_URL: str = ""
    WX_ANDROID_NOTIFY_URL: str = ""
    WX_PAY_PLATFORM_CERT_PATH: str = "/ai_zhs/cert/wxpay_cert.pem"
    WX_API_BASE: str = "https://api.mch.weixin.qq.com"

    # ===================================================================
    # AI Multi-Vendor
    # ===================================================================
    N8N_BASE_URL: str = ""
    N8N_WEBHOOK_PATH: str = "/webhook/chat"
    N8N_API_KEY: str = ""
    LANGCHAIN_BASE_URL: str = ""
    LANGCHAIN_API_KEY: str = ""

    # ===================================================================
    # 火山引擎实时语音
    # ===================================================================
    VOLC_APP_ID: str = Field(default="", description="火山引擎应用 ID")
    VOLC_ACCESS_KEY: str = Field(default="", description="火山引擎访问密钥")
    VOLC_RESOURCE_ID: str = Field(default="volc.speech.dialog", description="火山引擎资源 ID")
    VOLC_APP_KEY: str = Field(default="", description="火山引擎应用密钥")

    # ===================================================================
    # MCP 工具
    # ===================================================================
    MINIO_ENDPOINT: str = "http://minio:9000"

    # ===================================================================
    # ALIPAY
    # ===================================================================
    ALIPAY_APP_ID: str = ""
    ALIPAY_GATEWAY: str = "https://openapi.alipay.com/gateway.do"
    ALIPAY_PRIVATE_KEY_PATH: str = "/ai_zhs/cert/appSecretRSA2048.txt"
    ALIPAY_PUBLIC_KEY_PATH: str = "/ai_zhs/cert/alipayPublicKey_RSA2.txt"
    ALIPAY_NOTIFY_URL: str = ""
    ALIPAY_RETURN_URL: str = ""

    # ===================================================================
    # MINIO
    # ===================================================================
    MINIO_URL: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET: str = "sys-mini"
    MINIO_FILE_URL: str = ""

    # ===================================================================
    # 告警通道(钉钉 / 企业微信 / 飞书 / 邮件 / PagerDuty)
    # ===================================================================
    DINGTALK_WEBHOOK: str = ""
    DINGTALK_SECRET: str = ""
    WECHAT_WORK_WEBHOOK: str = ""
    FEISHU_WEBHOOK: str = ""
    ALERT_EMAIL_TO: str = ""  # 多个用逗号分隔
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    # PagerDuty Events API v2
    PAGERDUTY_API_URL: str = "https://events.pagerduty.com/v2/enqueue"
    PAGERDUTY_ROUTING_KEY: str = ""
    # Slack / Teams / Generic webhook (告警通道扩展)
    SLACK_WEBHOOK: str = ""
    TEAMS_WEBHOOK: str = ""
    GENERIC_WEBHOOK_URL: str = ""
    GENERIC_WEBHOOK_AUTH_HEADER: str = ""

    # ===================================================================
    # AI PROVIDERS
    # ===================================================================
    DASHSCOPE_API_KEY: str = ""
    ZHIPU_API_KEY: str = ""
    DOUBAO_API_KEY: str = ""
    DOUBAO_MODEL_URL: str = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    DOUBAO_JM_API_KEY: str = ""
    DOUBAO_JM_SECRET_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    KLING_ACCESS_KEY: str = ""
    KLING_SECRET_KEY: str = ""
    KLING_ALT_ACCESS_KEY: str = ""
    KLING_ALT_SECRET_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    LUYALA_API_KEY: str = ""
    TENCENT_SECRET_ID: str = ""
    TENCENT_SECRET_KEY: str = ""
    BAIDU_API_KEY: str = ""
    SUNO_API_KEY: str = ""
    SORA2_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    BAILIAN_APP_ID: str = ""

    # ===================================================================
    # DOUBAO STREAM EVENTS (豆包流式事件配置)
    # ===================================================================
    DOUBAO_STREAM_EVENT_THINKING: str = "conversation.message.delta"  # 思考过程事件
    DOUBAO_STREAM_EVENT_COMPLETED: str = "conversation.chat.completed"  # 结果完成事件
    COMMON_STREAM_EVENT_ERROR: str = "system.error"  # 通用错误事件 (WebSocket/LangChain 通用)

    # Google OAuth
    # Google OAuth 客户端 ID (支持多 client, 逗号分隔, 校验 aud 用)
    GOOGLE_APP_IDS: str = ""  # 逗号分隔, 如 "id1.apps.googleusercontent.com,id2.apps.googleusercontent.com"
    GOOGLE_ANDROID_IDS: str = ""
    # 兼容单 client 模式
    GOOGLE_APP_ID: str = ""
    GOOGLE_ANDROID_ID: str = ""
    GOOGLE_SECRET: str = ""
    GOOGLE_TOKEN_ENDPOINT: str = "https://oauth2.googleapis.com/token"
    GOOGLE_PC_REDIRECT_URI: str = "https://bsm.aizhs.top/prod-api/ai/login/google/pc/wxCode"

    # 视频存储
    VIDEO_ROOT: str = "/data/videos"

    # ===================================================================
    # OBJECT STORAGE (OSS / S3)
    # ===================================================================
    OSS_ENDPOINT: str = ""
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET: str = ""

    # ===================================================================
    # ALIYUN SMS
    # ===================================================================
    ALI_SMS_ACCESS_KEY_ID: str = ""
    ALI_SMS_ACCESS_KEY_SECRET: str = ""
    ALI_SMS_TEMP_ID: int = 1
    ALI_AUTH_APP_URL: str = ""
    ALI_AUTH_APP_KEY: str = ""
    ALI_AUTH_APP_SECRET: str = ""
    ALI_AUTH_APP_CODE: str = ""
    ALI_ACCESS_KEY: str = ""
    ALI_ACCESS_SECRET: str = ""

    # ===================================================================
    # THIRD PARTY
    # ===================================================================
    WECOM_SUITE_SECRET: str = ""

    # ===================================================================
    # APP
    # ===================================================================
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_DEBUG: bool = False
    API_RELOAD: bool = False
    API_WORKERS: int = 4
    API_TITLE: str = "ZHS Platform"
    ENV: str = "dev"  # dev / test / staging / production
    JWT_SECRET_KEY: str = ""
    JWT_EXPIRE_MINUTES: int = 60
    SESSION_SECRET_KEY: str = ""
    CHAT_ROOM_ADMIN_UUID: str = ""

    # ===================================================================
    # SSL / HTTPS
    # ===================================================================
    SSL_ENABLED: bool = Field(default=False, description="是否启用 SSL")
    SSL_CERT_FILE: str = Field(default="", description="SSL 证书文件路径")
    SSL_KEY_FILE: str = Field(default="", description="SSL 私钥文件路径")
    HTTPS_PORT: int = Field(default=8443, description="HTTPS 端口")

    # ===================================================================
    # SMS
    # ===================================================================
    SMS_API_BASE_URL: str = ""
    SMS_VERIFY_ENDPOINT: str = "/ai/login/pwd/smsVerify"
    SMS_CODE_VERIFY_ENDPOINT: str = "/ai/login/pwd/verify"

    # -------------------------------------------------------------------
    # SMS 扩展 (模板 / 验证码 / 代理)
    # -------------------------------------------------------------------
    SMS_TEMP_ID: int = Field(default=1, description="短信模板 ID")
    SMS_TEMP_CODE: str = Field(default="", description="短信验证码模板")
    SMS_CODE_EXPIRE_SECONDS: int = Field(default=300, description="短信验证码过期秒数")
    SMS_SEND_INTERVAL_SECONDS: int = Field(default=60, description="短信发送间隔秒数")
    SMS_API_USE_PROXY: bool = Field(default=False, description="短信 API 是否使用代理")
    SMS_API_ALLOW_INSECURE: bool = Field(default=False, description="短信 API 是否允许不安全连接")
    SMS_PROXY_ENDPOINT: str = Field(default="", description="短信 API 代理端点")

    # ===================================================================
    # 邮箱验证码登录 (EMAIL LOGIN)
    # 复用 SMTP_HOST/PORT/USER/PASSWORD 配置; 此处为验证码业务配置
    # ===================================================================
    EMAIL_CODE_EXPIRE_SECONDS: int = Field(default=300, description="邮箱验证码过期秒数")
    EMAIL_SEND_INTERVAL_SECONDS: int = Field(default=60, description="邮箱发送间隔秒数")
    EMAIL_CODE_LENGTH: int = Field(default=6, description="邮箱验证码长度")
    EMAIL_LOGIN_ENABLED: bool = Field(default=True, description="是否启用邮箱验证码登录")
    EMAIL_FROM_NAME: str = Field(default="智汇AI", description="发件人显示名称")

    # ===================================================================
    # EMAIL API Providers (免费邮件 API 服务, 用于生产环境发送真实邮件)
    # 优先级: BREVO_API_KEY > RESEND_API_KEY > SMTP > 本地 SMTP (开发模式)
    # 注册指南见 .env 文件注释
    # ===================================================================
    BREVO_API_KEY: str = Field(default="", description="Brevo API Key (免费300封/天)")
    BREVO_SENDER_EMAIL: str = Field(default="", description="Brevo 发件人邮箱 (需在 Brevo 验证)")
    BREVO_SENDER_NAME: str = Field(default="智汇AI", description="Brevo 发件人显示名称")
    RESEND_API_KEY: str = Field(default="", description="Resend API Key (免费100封/天)")
    RESEND_SENDER_EMAIL: str = Field(default="", description="Resend 发件人邮箱 (需在 Resend 验证)")

    # ===================================================================
    # FILE UPLOAD
    # ===================================================================
    FILE_UPLOAD_BASE_URL: str = ""
    FILE_UPLOAD_URL: str = ""
    FILE_UPLOAD_NETWORK_URL: str = ""

    # ===================================================================
    # SRS MEDIA SERVER
    # ===================================================================
    # 历史项目中仅定义未使用（srs_manager.py 缺失），保留供未来扩展
    # 适用字段: SRS_HOST/SRS_RTMP_PORT/SRS_HTTP_API_PORT/SRS_BIN_PATH/SRS_CONF_PATH/START_SRS_WITH_APP/FFMPEG_BIN
    # 注: STOP_SRS_ON_SHUTDOWN 历史中有调用, 不在此列; SRS_RTC_UDP_RANGE 仅供文档参考
    SRS_HOST: str = "127.0.0.1"
    SRS_RTMP_PORT: int = 1935
    SRS_HTTP_API_PORT: int = 1985
    SRS_RTC_UDP_RANGE: str = "8000-8100"  # WebRTC UDP 端口区间 (仅文档用途)
    FFMPEG_BIN: str = "ffmpeg"  # ffmpeg 可执行文件路径
    SRS_BIN_PATH: str = "srs/trunk/objs/srs"  # SRS 二进制路径 (相对项目根)
    SRS_CONF_PATH: str = "srs/conf/srs_rtc.conf"  # SRS 配置路径 (相对项目根)
    START_SRS_WITH_APP: bool = True  # 启动应用时自动启动 SRS
    STOP_SRS_ON_SHUTDOWN: bool = True  # 关闭应用时自动停止 SRS

    # ===================================================================
    # TOKEN PRICING
    # ===================================================================
    TOKEN_NORMAL_USER_PER_YUAN: int = 20000
    TOKEN_VIP_USER_PER_YUAN: int = 20000
    TOKEN_TRADER_USER_PER_YUAN: int = 80000
    TOKEN_PROMOTION_PER_YUAN: int = 80000
    TOKEN_BASE_MULTIPLIER: float = 2.0

    # ===================================================================
    # FEATURE FLAGS
    # ===================================================================
    FEATURE_AUTH_ENABLED: bool = True
    FEATURE_AGENTS_ENABLED: bool = True
    FEATURE_COZE_BOTS_ENABLED: bool = True
    FEATURE_PAYMENTS_ENABLED: bool = True
    FEATURE_AI_PROXIES_ENABLED: bool = True
    FEATURE_COURSES_ENABLED: bool = True
    FEATURE_WEBSOCKET_ENABLED: bool = True
    FEATURE_CMS_ENABLED: bool = True

    # ===================================================================
    # AI
    # ===================================================================
    AI_FIRST_GIFT_ID: str = "20954cb5-7179-4985-b9d8-1d0b5c956005"
    AI_FIRST_GIFT_TOKENS: int = 18888
    AI_COMMISSION_DAY: int = 7

    # ===================================================================
    # MODEL LIST (模型列表配置, 对应历史 modelList)
    # ===================================================================
    # 历史项目中仅定义未使用（死配置），保留供未来扩展
    MODEL_LIST: dict = Field(
        default_factory=lambda: {
            "qianwen": [
                {"Qwen-Image-Edit": "图片编辑"},
                {"Qwen-Image": "文生图"},
                {"wan2.2-t2v-plus": "文生视频"},
                {"wan2.2-i2v-flash": "图生视频"},
            ],
            "即梦": [
                {"jimeng_t2i_v31": "即梦文生图"},
                {"jimeng_ti2v_v30_pro": "即梦图生视频"},
            ],
            "混元3D": [{"ai3d.tencentcloudapi.com": "混元3D"}],
        }
    )

    CORS_ORIGINS: str = ""  # 逗号分隔的域名列表,空则允许所有

    # ===================================================================
    # STOCK ANALYSE
    # ===================================================================
    STOCK_ANALYSE_API_URL: str = ""
    STOCK_ANALYSE_API_TOKEN: str = ""
    STOCK_ANALYSE_PROJECT_ID: int = 7598128573479862282

    # ===================================================================
    # PERSONALITY (n8n agent)
    # ===================================================================
    PERSONALITY_N8N_URL: str = ""
    PERSONALITY_N8N_TOKEN: str = ""

    # ===================================================================
    # ENTERPRISE WECHAT
    # ===================================================================
    WECOM_CORP_ID: str = ""
    WECOM_AGENT_ID: str = ""
    WECOM_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=(".env.production", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @_validator("JWT_SECRET_KEY")
    def _validate_jwt_secret(cls, v: str) -> str:  # type: ignore[no-redef]  # noqa: N805
        """Validate JWT secret is not empty or placeholder."""
        if not v or v == "YOUR_JWT_SECRET_KEY_HERE":
            import os
            import warnings
            fallback = os.environ.get("JWT_SECRET_KEY", "")
            if fallback and fallback != "YOUR_JWT_SECRET_KEY_HERE":
                return fallback
            warnings.warn("JWT_SECRET_KEY 未配置或为占位符, 使用默认开发密钥", stacklevel=2)
            return "dev-only-insecure-key-do-not-use-in-production"
        return v


# Global settings instance
settings = Settings()


class SpecialBotCache:
    """特殊智能体缓存管理器 (ported from historical config.py).

    维护一份从 SPECIAL_BOT_IDS 解析出的特殊智能体 ID 集合，支持懒加载。
    """

    def __init__(self) -> None:
        self._special_bot_ids: set = set()
        self._initialized: bool = False

    def initialize(self) -> None:
        """从 settings.SPECIAL_BOT_IDS 解析并填充缓存。"""
        raw = getattr(settings, "SPECIAL_BOT_IDS", "") or ""
        ids = [s.strip() for s in raw.split(",") if s.strip()]
        self._special_bot_ids = set(ids)
        self._initialized = True

    def is_special_bot(self, bot_id: str) -> bool:
        """检查是否为特殊智能体。"""
        if not self._initialized:
            self.initialize()
        return bot_id in self._special_bot_ids

    def add_special_bot(self, bot_id: str) -> None:
        """添加特殊智能体。

        注: 历史项目 (coze_zhs_py) 中也未调用该方法, 保留供未来运行时动态注册特殊智能体扩展。
        """
        if not self._initialized:
            self.initialize()
        self._special_bot_ids.add(bot_id)

    def remove_special_bot(self, bot_id: str) -> None:
        """移除特殊智能体。

        注: 历史项目 (coze_zhs_py) 中也未调用该方法, 保留供未来运行时动态注销特殊智能体扩展。
        """
        if not self._initialized:
            self.initialize()
        self._special_bot_ids.discard(bot_id)

    def get_all_special_bots(self) -> set:
        """获取所有特殊智能体 ID (副本)。

        注: 历史项目 (coze_zhs_py) 中也未调用该方法, 保留供未来调试 / 运维查询场景扩展。
        """
        if not self._initialized:
            self.initialize()
        return set(self._special_bot_ids)


# Global special bot cache instance (lazy-initialized on first use)
special_bot_cache = SpecialBotCache()

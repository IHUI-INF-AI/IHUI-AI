"""
Unified configuration using Pydantic Settings.
Reads from .env files and environment variables.
"""

import os
from typing import Any

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
    # 支持直接配置密钥字符串 (历史 edu server 迁移, 优先于文件路径)
    ALIPAY_MERCHANT_PRIVATE_KEY: str = ""
    ALIPAY_PUBLIC_KEY: str = ""
    ALIPAY_SIGN_TYPE: str = "RSA2"
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
    # TBox 事件通知 HMAC 签名密钥 (用于校验 X-Signature 头)
    TBOX_NOTIFY_SECRET: str = ""
    BAIDU_API_KEY: str = ""
    SUNO_API_KEY: str = ""
    SORA2_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    BAILIAN_APP_ID: str = ""
    # 智谱 API Key (兼容 GLM_API_KEY)
    ZHIPU_API_KEY: str = ""
    # 火山引擎 Volc App Key (豆包实时语音)
    VOLC_APP_KEY: str = ""
    # 特殊智能体ID列表 (逗号分隔, 使用特殊扣费规则)
    SPECIAL_BOT_IDS: str = ""
    # 聊天室系统管理员UUID
    CHAT_ROOM_ADMIN_UUID: str = ""
    # n8n Token 计算单位
    N8N_TOKEN_COUNTING_UNIT: int = 3
    # AI 智能体历史记录数
    AI_AGENT_USE_HISTORY: int = 10
    # AI 水印图片路径
    AI_WATERMARK_PATH: str = ""
    # 豆包图像生成 API URL
    DOUBAO_IMAGE_API_URL: str = ""
    # 短信API基础URL (历史 coze_zhs_py 迁移)
    SMS_API_BASE_URL: str = ""
    # 文件上传基础URL
    FILE_UPLOAD_BASE_URL: str = ""
    # 文件上传URL
    FILE_UPLOAD_URL: str = ""

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
    # OBJECT STORAGE (OSS / S3 / Tencent COS)
    # ===================================================================
    OSS_ENDPOINT: str = ""
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET: str = ""
    OSS_VISIT_PATH: str = ""  # 阿里云 OSS 访问域名 (如 https://yjs-learning.oss-cn-guangzhou.aliyuncs.com/)

    # 腾讯云 COS 对象存储 (历史 ihui-ai-edu-oss-service 迁移)
    TENCENT_COS_SECRET_ID: str = ""
    TENCENT_COS_SECRET_KEY: str = ""
    TENCENT_COS_BUCKET: str = ""  # 如 learning-1331526801
    TENCENT_COS_REGION: str = ""  # 如 ap-shanghai
    TENCENT_COS_VISIT_PATH: str = ""  # https://learning-1331526801.cos.ap-shanghai.myqcloud.com
    TENCENT_COS_CDN_VISIT_PATH: str = ""  # https://lcdn.space-iot.net

    # 文件存储模式: Local / AliYun / Minio / TencentCOS
    OSS_FILE_MODE: str = "AliYun"
    OSS_FILE_ROOT_PATH: str = "cloud-learning"
    LOCAL_FILE_DIR: str = "/tmp/filetmp"

    # ===================================================================
    # TENCENT LIVE (腾讯云直播 - 历史 ihui-ai-edu-live-service 迁移)
    # ===================================================================
    TENCENT_LIVE_SECRET_ID: str = ""
    TENCENT_LIVE_SECRET_KEY: str = ""
    TENCENT_LIVE_ENDPOINT: str = "live.ap-guangzhou.tencentcloudapi.com"
    TENCENT_LIVE_REGION: str = "ap-guangzhou"
    TENCENT_LIVE_PUSH_DOMAIN: str = ""  # 如 push.chawind.com
    TENCENT_LIVE_PULL_DOMAIN: str = ""  # 如 http://pull.chawind.com
    TENCENT_LIVE_CALLBACK_KEY: str = ""  # 如 learningLive

    # ===================================================================
    # NOTIFICATION EMAIL (业务通知邮件 - 历史 ihui-ai-edu-notification-service 迁移)
    # 与告警 SMTP 分开, 用于业务通知 (注册/订单/课程等)
    # ===================================================================
    NOTIFY_SMTP_HOST: str = ""  # 如 smtp.exmail.qq.com
    NOTIFY_SMTP_PORT: int = 465
    NOTIFY_SMTP_USER: str = ""  # 如 notice@chawind.com
    NOTIFY_SMTP_PASSWORD: str = ""
    NOTIFY_SMTP_PROTOCOL: str = "smtps"
    NOTIFY_SMTP_DEFAULT_ENCODING: str = "utf-8"
    NOTIFY_EMAIL_FROM: str = ""  # 发件人地址, 默认同 NOTIFY_SMTP_USER

    # ===================================================================
    # 253 SMS PLATFORM (253短信平台 - 历史 ihui-ai-edu-notification-service 迁移)
    # ===================================================================
    SMS_253_URL: str = "http://smssh1.253.com/msg/send/json"
    SMS_253_ACCOUNT: str = ""
    SMS_253_PASSWORD: str = ""
    SMS_253_TEMPLATE: str = "Your verification code is: "
    # 无锡物业短信 (备用通道)
    SMS_WUXI_API_HOST: str = ""
    SMS_WUXI_CLIENT_ID: str = ""
    SMS_WUXI_CLIENT_SECRET: str = ""
    SMS_WUXI_PREFIX: str = "[Notice]"
    SMS_WUXI_REGISTER_TEMPLATE: str = "Your verification code is %s, valid for 5 minutes."

    # ===================================================================
    # MESSAGE QUEUE (消息队列 - 历史 RocketMQ 替代方案)
    # 使用 Redis Stream 作为轻量消息队列 (无需额外部署 RabbitMQ)
    # ===================================================================
    MQ_ENABLED: bool = False  # 是否启用消息队列
    MQ_BACKEND: str = "redis_stream"  # redis_stream / rabbitmq
    MQ_REDIS_STREAM_PREFIX: str = "learning_"  # 历史 topic.prefix
    MQ_RABBIT_URL: str = ""  # RabbitMQ 连接串 (如使用 rabbitmq 后端)

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
    FEISHU_SECRET: str = ""
    FEISHU_OAUTH: str = ""
    FEISHU_INFO: str = ""
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
    # 内网调用签名密钥 (用于校验 SSO uuid_login 等内部端点的 X-Internal-Auth 头)
    INTERNAL_AUTH_KEY: str = ""

    # ===================================================================
    # SMS
    # ===================================================================
    # SMS_API_BASE_URL 已在 AI Providers 部分定义
    SMS_VERIFY_ENDPOINT: str = "/ai/login/pwd/smsVerify"
    SMS_CODE_VERIFY_ENDPOINT: str = "/ai/login/pwd/verify"

    # ===================================================================
    # FILE UPLOAD
    # ===================================================================
    # FILE_UPLOAD_BASE_URL 和 FILE_UPLOAD_URL 已在 AI Providers 部分定义
    FILE_UPLOAD_NETWORK_URL: str = ""

    # ===================================================================
    # SRS MEDIA SERVER
    # ===================================================================
    SRS_HOST: str = "127.0.0.1"
    SRS_RTMP_PORT: int = 1935
    SRS_HTTP_API_PORT: int = 1985

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
    # ENTERPRISE WECHAT / FEISHU / ALI LOGIN
    # ===================================================================
    WECOM_CORP_ID: str = ""
    WECOM_AGENT_ID: str = ""
    WECOM_SECRET: str = ""
    FEISHU_APP_ID: str = ""
    FEISHU_APP_SECRET: str = ""
    ALI_LOGIN_APP_ID: str = ""
    ALI_LOGIN_APP_SECRET: str = ""
    ALI_LOGIN_PRIVATE_KEY: str = ""  # PEM 格式的 RSA2 应用私钥, 用于支付宝登录签名

    # ===================================================================
    # DINGTALK LOGIN (钉钉登录)
    # ===================================================================
    DINGTALK_API_HOST: str = "https://oapi.dingtalk.com"
    DINGTALK_CORP_ID: str = ""
    DINGTALK_APP_KEY: str = ""
    DINGTALK_APP_SECRET: str = ""
    DINGTALK_LOGIN_APP_ID: str = ""
    DINGTALK_LOGIN_APP_SECRET: str = ""
    DINGTALK_AGENT_ID: str = ""

    # ===================================================================
    # NOTIFICATION (站内信 - P1 封版 047)
    # ===================================================================
    # admin 接收方 UUID (站内信推送统一进他的 inbox, 多副本必须一致)
    # 默认值: 00000000-0000-0000-0000-000000000001 (固定 admin UUID)
    NOTIFY_RECIPIENT_UUID: str = "00000000-0000-0000-0000-000000000001"
    # 站内信最大保留数 (FIFO 淘汰, 默认 1000)
    NOTIFY_MAX: int = 1000

    model_config = SettingsConfigDict(
        env_file=".env.production" if os.getenv("ENV", "").lower() in ("production", "prod") else ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    def model_post_init(self, __context: Any) -> None:
        """启动后校验: SESSION_SECRET_KEY 为空时回退到 JWT_SECRET_KEY.

        避免会话签名密钥默认空字符串导致的安全风险。
        生产环境应由 .env 显式配置; 此处仅作兜底, 防止启动后 SESSION_SECRET_KEY 仍为空。
        """
        super().model_post_init(__context)
        if not self.SESSION_SECRET_KEY:
            self.SESSION_SECRET_KEY = self.JWT_SECRET_KEY


# Global settings instance
settings = Settings()

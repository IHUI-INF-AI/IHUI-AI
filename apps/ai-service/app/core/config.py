"""AI 服务配置。

字段名统一使用小写,与 app/services/ 和 app/routers/ 中既有代码保持一致。
Pydantic Settings 默认大小写不敏感匹配环境变量,因此小写字段仍可正确加载
.env 中的大写环境变量(如 REDIS_URL → settings.redis_url)。
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AI 服务配置,从环境变量加载。"""

    # 运行环境
    app_name: str = "IHUI AI Service"
    node_env: str = "development"
    debug: bool = False
    port: int = 8000
    host: str = "0.0.0.0"
    log_level: str = "info"
    cors_origin: str = "http://localhost:3000"

    # 数据存储
    database_url: str = "postgres://postgres:postgres@localhost:5432/ihui_ai"
    redis_url: str = "redis://localhost:6379"

    # LLM 配置(多 provider 支持,OpenAI 兼容 endpoint 优先)
    # 任意一个 key 配置即激活真实调用,全部为空降级 stub
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""  # 免费 https://console.groq.com/keys
    gemini_api_key: str = ""  # 免费 https://aistudio.google.com/apikey
    openrouter_api_key: str = ""  # 有 free tier https://openrouter.ai/keys
    # OpenAI 兼容 endpoint(用户提供的 plan 套餐)
    agnes_api_key: str = ""  # https://apihub.agnes-ai.com/v1
    agnes_api_base: str = "https://apihub.agnes-ai.com/v1"
    stepfun_api_key: str = ""  # https://api.stepfun.com/step_plan/v1
    stepfun_api_base: str = "https://api.stepfun.com/step_plan/v1"

    # 免费 / 试用 credits provider(2026-07-22 接入,参考 cheahjs/free-llm-api-resources)
    # Cloudflare Workers AI(10,000 neurons/day 免费,需 API Token + Account ID)
    cloudflare_api_token: str = ""  # https://dash.cloudflare.com/profile/api-tokens
    cloudflare_account_id: str = ""  # https://dash.cloudflare.com/ 右侧 Account ID
    # NVIDIA NIM(40 req/min,需手机号验证)
    nvidia_api_key: str = ""  # https://build.nvidia.com/explore/discover
    # GitHub Models(Copilot Free tier 可用)
    github_token: str = ""  # https://github.com/settings/tokens
    # Vercel AI Gateway($5/月免费额度)
    vercel_ai_gateway_key: str = ""  # https://vercel.com/docs/ai-gateway
    # OpenCode Zen(完全免费,公开示例 key 见 .env.example 注释)
    opencode_zen_key: str = ""  # https://opencode.ai/docs/zen/
    # Modal($5/月注册赠送,加支付方式 $30/月)
    modal_api_key: str = ""  # https://modal.com/settings/tokens
    # Inference.net($1 注册送 + 回邮件调查 +$25)
    inference_net_api_key: str = ""  # https://inference.net
    # NLP Cloud($15 注册送,需手机号验证)
    nlp_cloud_api_key: str = ""  # https://nlpcloud.com/home
    # Scaleway(1M tokens 免费)
    scaleway_api_key: str = ""  # https://console.scaleway.com/generative-api/models
    # Alibaba Cloud International Model Studio(1M tokens/模型免费)
    alibaba_intl_api_key: str = ""  # https://bailian.console.alibabacloud.com/

    litellm_model: str = "stepfun/step-3.7-flash"  # 默认用 stepfun(已验证连通)
    max_agent_iterations: int = 10
    # Sliding window:系统消息始终保留 + 最近 N 轮 user/assistant + 当前输入
    # 默认 6 轮,总消息数 ≤ 13(1 system + 12 turn + 1 current,实际 N*2+1)
    chat_history_window: int = 6

    # 后端 API
    api_service_url: str = "http://localhost:8080"
    # AI 回调共享密钥(可选,与后端 AI_CALLBACK_SECRET 一致;为空则不发送 X-Internal-Secret 头)
    ai_callback_secret: str = ""

    # 凭据加密密钥(与 apps/api 的 CREDENTIALS_ENCRYPTION_KEY 共享,用于解密 ai_model_config.api_key_enc)
    credentials_encryption_key: str = ""

    # JWT 验证(与 apps/api 共享 JWT_SECRET,用于 SSO 跨服务认证)
    jwt_secret: str = ""
    jwt_issuer: str = "ihui-ai"
    # 不验签的白名单路径(正则匹配)
    jwt_public_paths: str = "/api/health,/api/legacy,/health,/metrics"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

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
    litellm_model: str = "stepfun/step-3.7-flash"  # 默认用 stepfun(已验证连通)
    max_agent_iterations: int = 10

    # 后端 API
    api_service_url: str = "http://localhost:8080"
    # AI 回调共享密钥(可选,与后端 AI_CALLBACK_SECRET 一致;为空则不发送 X-Internal-Secret 头)
    ai_callback_secret: str = ""

    # JWT 验证(与 apps/api 共享 JWT_SECRET,用于 SSO 跨服务认证)
    jwt_secret: str = ""
    jwt_issuer: str = "ihui-ai"
    # 不验签的白名单路径(正则匹配)
    jwt_public_paths: str = "/api/health,/api/legacy,/health,/metrics"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

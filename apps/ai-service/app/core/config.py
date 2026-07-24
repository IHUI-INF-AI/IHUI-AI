"""AI 服务配置。

字段名统一使用小写,与 app/services/ 和 app/routers/ 中既有代码保持一致。
Pydantic Settings 默认大小写不敏感匹配环境变量,因此小写字段仍可正确加载
.env 中的大写环境变量(如 REDIS_URL → settings.redis_url)。
"""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AI 服务配置,从环境变量加载。"""

    # 运行环境
    app_name: str = "IHUI AI Service"
    node_env: str = "development"
    debug: bool = False
    port: int = 8803
    host: str = "0.0.0.0"
    log_level: str = "info"
    # CORS 允许源(逗号分隔)。默认空字符串:生产环境启动时校验非空(强制配置),
    # 任何环境禁止 "*" 通配符。本地开发请在 .env 中配置 CORS_ORIGIN=http://localhost:8801
    cors_origin: str = ""

    # 数据存储
    database_url: str = "postgres://postgres:postgres@localhost:8810/ihui_ai"
    redis_url: str = "redis://localhost:8811"

    # 定时任务调度(schedule_task 工具,对标 Codex Automations,2026-07-24 立)
    # schedule_enabled=False 时 ai-service 启动不挂载 BackgroundScheduler
    # schedule_redis_url 为空则复用 redis_url
    schedule_enabled: bool = True
    schedule_redis_url: str = ""

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

    # 默认主力模型:step-router-v1(StepFun 智能路由,自动选 plan 套餐内最优模型,
    # 比 step-3.7-flash 更适合复杂 tool calling 决策;两者均已实测连通)
    litellm_model: str = "stepfun/step-router-v1"
    # Agent tool loop 最大轮数(被 llm.py /llm/complete/stream 读取,2026-07-24 修复硬编码 3 的 bug)
    # 8 轮可覆盖"截图→识别→点击→再截图→输入→提交"等多步操作,同时留 2 轮余量防失控
    max_agent_iterations: int = 8
    # Sliding window:系统消息始终保留 + 最近 N 轮 user/assistant + 当前输入
    # 默认 6 轮,总消息数 ≤ 13(1 system + 12 turn + 1 current,实际 N*2+1)
    chat_history_window: int = 6

    # 后端 API
    api_service_url: str = "http://localhost:8802"
    # AI 回调共享密钥(可选,与后端 AI_CALLBACK_SECRET 一致;为空则不发送 X-Internal-Secret 头)
    ai_callback_secret: str = ""

    # 凭据加密密钥(与 apps/api 的 CREDENTIALS_ENCRYPTION_KEY 共享,用于解密 ai_model_config.api_key_enc)
    credentials_encryption_key: str = ""

    # JWT 验证(与 apps/api 共享 JWT_SECRET,用于 SSO 跨服务认证)
    jwt_secret: str = ""
    jwt_issuer: str = "ihui-ai"
    # 不验签的白名单路径(正则匹配)
    jwt_public_paths: str = "/api/health,/api/legacy,/health,/metrics"
    # agent_control 内部调用密钥(ai-service → api /execute,2026-07-22)
    agent_control_internal_secret: str = ""

    # mTLS 双向证书认证(2026-07-24 立,打通 api ↔ ai-service 链路)
    # MTLS_ENABLED=true 时,ai-service 调用 api 必须携带客户端证书 + 校验服务端证书
    # MTLS_ENABLED=false(默认)→ 降级模式,httpx 正常无证书请求(开发环境)
    # 证书路径默认指向 apps/api/certs/mtls/(与服务端 mtls.ts 共享同一套证书)
    mtls_enabled: bool = False
    mtls_client_cert_path: str = "apps/api/certs/mtls/client.crt"
    mtls_client_key_path: str = "apps/api/certs/mtls/client.key"
    mtls_ca_cert_path: str = "apps/api/certs/mtls/ca.crt"

    model_config = {"env_file": ".env", "extra": "ignore"}

    def validate_cors_origin(self) -> None:
        """启动时校验 CORS_ORIGIN:任何环境禁止 "*" 通配符,生产环境禁止空值。"""
        origins = [o.strip() for o in self.cors_origin.split(",") if o.strip()]
        if any(o == "*" for o in origins):
            raise ValueError(
                'CORS_ORIGIN 不允许使用 "*" 通配符,必须显式列出允许的源(逗号分隔)'
            )
        if self.node_env == "production" and not origins:
            raise ValueError(
                "生产环境 CORS_ORIGIN 必填(禁止空值),请配置允许的前端源(逗号分隔)"
            )

    def validate_mtls_config(self) -> None:
        """启动时校验 mTLS 配置(fail-fast)。

        MTLS_ENABLED=true 时必须同时满足:
        1. 3 个证书路径(client_cert / client_key / ca_cert)均非空
        2. 3 个证书文件均存在(防 typo / 部署遗漏)

        MTLS_ENABLED=false 时跳过校验(开发环境降级模式)。
        """
        if not self.mtls_enabled:
            return
        missing_paths: list[str] = []
        for label, p in (
            ("MTLS_CLIENT_CERT_PATH", self.mtls_client_cert_path),
            ("MTLS_CLIENT_KEY_PATH", self.mtls_client_key_path),
            ("MTLS_CA_CERT_PATH", self.mtls_ca_cert_path),
        ):
            if not p:
                missing_paths.append(f"{label}(空值)")
            elif not Path(p).is_file():
                missing_paths.append(f"{label}(文件不存在: {p})")
        if missing_paths:
            raise ValueError(
                "MTLS_ENABLED=true 但 mTLS 证书配置异常,启动失败:\n  - "
                + "\n  - ".join(missing_paths)
                + "\n请配置正确的证书路径,或设置 MTLS_ENABLED=false 进入降级模式(仅开发环境)"
            )


settings = Settings()

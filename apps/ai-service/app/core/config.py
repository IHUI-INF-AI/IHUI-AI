"""AI 服务配置。

字段名统一使用小写,与 app/services/ 和 app/routers/ 中既有代码保持一致。
Pydantic Settings 默认大小写不敏感匹配环境变量,因此小写字段仍可正确加载
.env 中的大写环境变量(如 REDIS_URL → settings.redis_url)。
"""

import json
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic_settings import BaseSettings

if TYPE_CHECKING:
    # 延迟 import 避免循环依赖(config.py → provider_config.py),仅用于类型注解
    from app.core.provider_config import ProviderConfig


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

    # LLM 配置(阶段 3 主体:已完全字典化,旧 24+7 扁平字段 + _PROVIDER_KEY_ALIASES 已删除)
    # 唯一配置源:LLM_PROVIDERS JSON 字符串
    # 格式:{"<provider_name>": {"api_key": "...", "api_base": "..."}, ...}
    # 新增 provider 只需改 .env 的 LLM_PROVIDERS,零代码改动(config.py 自动识别)
    llm_providers: str = ""

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

    # CSDN 自动发布凭证(content_engine skill 使用,逆向自 editor.csdn.net 内部 API)
    # 空字符串=未配置,签名会失败并提示用户配置;非生产必填项,按需启用
    csdn_app_key: str = ""
    csdn_app_secret: str = ""

    # mTLS 双向证书认证(2026-07-24 立,打通 api ↔ ai-service 链路)
    # MTLS_ENABLED=true 时,ai-service 调用 api 必须携带客户端证书 + 校验服务端证书
    # MTLS_ENABLED=false(默认)→ 降级模式,httpx 正常无证书请求(开发环境)
    # 证书路径默认指向 apps/api/certs/mtls/(与服务端 mtls.ts 共享同一套证书)
    mtls_enabled: bool = False
    mtls_client_cert_path: str = "apps/api/certs/mtls/client.crt"
    mtls_client_key_path: str = "apps/api/certs/mtls/client.key"
    mtls_ca_cert_path: str = "apps/api/certs/mtls/ca.crt"

    # 本地 LLM 服务(LiteLLM 原生,2026-07-27 统一 secret 管理)
    # _resolve_provider 中 ollama/lmstudio/llamacpp/azure/bedrock 前缀走这些字段
    # 默认值与 LiteLLM 库内部约定一致(用户在 .env 覆盖即激活)
    ollama_api_key: str = ""
    ollama_api_base: str = "http://localhost:11434"
    lmstudio_api_key: str = ""
    lmstudio_api_base: str = "http://localhost:1234"
    llamacpp_api_base: str = "http://localhost:8080"
    azure_api_key: str = ""
    azure_api_base: str = ""
    aws_access_key_id: str = ""

    # MCP / Publish 工具配置(2026-07-27 统一 secret 管理)
    # MCP_WORKSPACE_ROOTS:工作区根目录白名单(分隔符 os.pathsep),空=用当前工作目录
    mcp_workspace_roots: str = ""
    # PUBLISH_UPLOAD_DIR:发布上传根目录,空=默认 .uploads/publish(已在 .gitignore)
    publish_upload_dir: str = ""
    # GITHUB_TOKEN:MCP review_pr 工具调 GitHub API,空=匿名调用受 rate limit(60/h)
    github_token: str = ""

    # LLM 出站代理(2026-07-30 立,商业化上线运营刚需)
    # 国内服务器访问 OpenAI/Anthropic/OpenRouter 等境外 provider 时必须走代理
    # 配置后自动写入 os.environ[HTTP_PROXY/HTTPS_PROXY],litellm/httpx 自动读取
    # 格式:http://user:pass@host:port 或 http://host:port  空字符串=不使用代理
    llm_proxy_url: str = ""

    # Token 压缩(2026-07-30 立,P2-A TokenCompactor 配套配置)
    # 启用后 llm_gateway.complete/astream 在 trim_messages 后、litellm.acompletion 前
    # 自动调用 RTK+Caveman 双算法压缩(策略=rtk_caveman,keep_recent=6)。
    # 启用条件(全部满足才压缩):① token_compaction_enabled=True ② 非 stub 模式
    # ③ 不含 tools 参数(保护 function calling) ④ 总 token 数 > token_compaction_min_tokens
    # 压缩失败降级用原 messages(不阻塞主流程),压缩率记录到 LLM_TOKEN_COMPACTION_RATIO metric
    # Combo 多级 fallback 链(COMBO_CHAINS 环境变量)由 combo_router.py 直接走
    # os.environ 读取,不走 settings 字段(避免重复配置入口)
    token_compaction_enabled: bool = False
    token_compaction_min_tokens: int = 2000

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

    def get_provider_config(self, name: str) -> "ProviderConfig":
        """读取 provider 配置(阶段 3 主体:只走 JSON 路径,扁平字段已删除)。

        name 示例: 'openai' / 'anthropic' / 'stepfun' / 'agnes' / 'groq' / ...
        返回: ProviderConfig(强类型)

        配置来源:settings.llm_providers JSON 字符串
        JSON 格式: {"<provider_name>": {"api_key": "...", "api_base": "..."}, ...}

        JSON 解析失败时返回空 ProviderConfig(不抛异常,避免启动崩溃)。
        未知 provider 返回空 ProviderConfig(不抛 KeyError,便于调用方 fallback)。
        """
        # 延迟 import 避免循环依赖(config.py → provider_config.py)
        from pydantic import ValidationError

        from app.core.provider_config import ProviderConfig

        if not self.llm_providers:
            return ProviderConfig()  # 空 ProviderConfig(api_key='', api_base=None)

        try:
            providers = json.loads(self.llm_providers)
            if isinstance(providers, dict) and isinstance(providers.get(name), dict):
                return ProviderConfig(**providers[name])
        except (json.JSONDecodeError, TypeError, ValueError, ValidationError):
            pass  # 解析失败返回空配置

        return ProviderConfig()  # 未知 provider 或解析失败


settings = Settings()

"""免费 LLM provider 注册表(2026-07-30 立,对齐 OmniRoute 免费 provider 矩阵 + 超越)。

参考 cheahjs/free-llm-api-resources 项目,聚合 30+ 免费 LLM provider 的申请入口、
免费额度、限制、key 配置字段名、默认 base_url。用户在 admin 后台填 key 后自动激活,
Dashboard 可视化展示"已配置 / 未配置 / 本地"三态。

超越 OmniRoute 的点:
- **本地 LLM 兜底**:Ollama / LMStudio / LlamaCpp / vLLM 列入注册表,OmniRoute 仅列云端
- **国内 provider 全覆盖**:Moonshot/智谱/DeepSeek/MiniMax/Qwen/豆包/混元/文心/阶跃 等中文场景 provider
- **key 状态感知**:从 .env / ai_model_config 表 双源检测 key 配置状态,Dashboard 直接展示
- **默认 base_url 内置**:用户未填 api_base 时,从注册表查默认值(避免手动查文档)

数据结构:
    FreeProvider(
        provider_code="moonshot",          # 与 ai_model_config.provider_code 一致
        display_name="Moonshot Kimi",      # Dashboard 展示名
        category="domestic",               # domestic/international/local/credits
        signup_url="https://...",          # 申请入口
        free_quota="Kimi-K2 免费 / 1M tokens/月",  # 免费额度描述
        rate_limit="60 RPM",               # 限制(RPM/TPM/daily)
        default_base_url="https://api.moonshot.cn/v1",  # 默认 base_url
        key_env_vars=["MOONSHOT_API_KEY"],  # 环境变量名(.env)
        default_models=["kimi-k2"],        # 推荐免费模型
        protocol="openai_chat",            # 协议类型(openai_chat/anthropic_messages/gemini_generate_content)
        docs_url="https://platform.moonshot.cn/docs",  # 文档链接
    )

查询 API:
    from .free_provider_registry import free_provider_registry
    all_providers = free_provider_registry.list_all()
    moonshot = free_provider_registry.get_by_code("moonshot")
    configured = free_provider_registry.list_configured()  # 从 env + DB 检测已配置
    local = free_provider_registry.list_local()  # 本地 LLM(无需 key)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ProviderCategory(str, Enum):
    """provider 分类。"""

    DOMESTIC = "domestic"  # 国内 provider(中文场景优化)
    INTERNATIONAL = "international"  # 国际 provider(英文场景优化)
    LOCAL = "local"  # 本地 LLM(无需 key,自托管)
    CREDITS = "credits"  # 试用 credits provider(注册送额度)


class ProviderStatus(str, Enum):
    """provider 配置状态。"""

    CONFIGURED = "configured"  # 已配置 key(可用)
    NOT_CONFIGURED = "not_configured"  # 未配置 key(需用户填)
    LOCAL = "local"  # 本地 LLM(无需 key,启动即用)


@dataclass
class FreeProvider:
    """免费 LLM provider 注册项。

    Attributes:
        provider_code: provider 唯一标识(与 ai_model_config.provider_code 一致)。
        display_name: Dashboard 展示名。
        category: 分类(domestic/international/local/credits)。
        signup_url: 申请入口 URL。
        free_quota: 免费额度描述(如 "1M tokens/月" / "Kimi-K2 免费")。
        rate_limit: 速率限制描述(如 "60 RPM")。
        default_base_url: 默认 API base_url(用户未填 api_base 时用此值)。
        key_env_vars: 环境变量名列表(从 .env 检测 key 是否配置)。
        default_models: 推荐免费模型列表。
        protocol: 协议类型(openai_chat / anthropic_messages / gemini_generate_content)。
        docs_url: 文档链接。
        notes: 备注(特殊说明,如"需信用卡验证" / "仅限美国 IP")。
        zero_cost: 真·零成本(无需 key 即可调用,如 pollinations/llm7/aihorde)。
        free_tier: 有免费额度但需注册 key(如 groq/zhipu/cloudflare)。
    """

    provider_code: str
    display_name: str
    category: ProviderCategory
    signup_url: str
    free_quota: str
    rate_limit: str = ""
    default_base_url: str = ""
    key_env_vars: list[str] = field(default_factory=list)
    default_models: list[str] = field(default_factory=list)
    protocol: str = "openai_chat"
    docs_url: str = ""
    notes: str = ""
    zero_cost: bool = False
    free_tier: bool = False
    # 2026-07-31 新增(用户规则:账户没钱需在管理端可视化 + 跳转充值按钮)
    # 充值/billing 页面 URL(管理端"去充值"按钮跳转;未配置时降级用 signup_url)
    recharge_url: str = ""
    # 余额查询端点路径(支持 openrouter/deepseek/siliconcloud 等;空表示该 provider 无余额端点,降级用推理请求 ping)
    # 完整 URL 或相对路径(若相对路径,自动拼接到 default_base_url)
    balance_endpoint: str = ""


# ============================================================================
# 30+ 免费 provider 注册表(2026-07-30 快照,数据来源:各 provider 官网)
# ============================================================================

_REGISTRY: list[FreeProvider] = [
    # ---------------- 国内 provider(中文场景优化) ----------------
    FreeProvider(
        provider_code="moonshot",
        display_name="Moonshot Kimi(月之暗面)",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://platform.moonshot.cn/console",
        free_quota="Kimi-K2 免费(8B 模型永久免费)/ 15M tokens/月体验额度",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://api.moonshot.cn/v1",
        key_env_vars=["MOONSHOT_API_KEY"],
        default_models=["kimi-k2", "moonshot-v1-8k"],
        docs_url="https://platform.moonshot.cn/docs",
        notes="国内长上下文最强(200K),支持 function calling",
    ),
    FreeProvider(
        provider_code="zhipu",
        display_name="智谱 GLM(清言)",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://open.bigmodel.cn/console",
        free_quota="glm-4-flash 永久免费 / glm-4-air 100M tokens 免费额度",
        rate_limit="100 RPM(免费层)",
        default_base_url="https://open.bigmodel.cn/api/paas/v4",
        key_env_vars=["ZHIPU_API_KEY"],
        default_models=["glm-4-flash", "glm-4-air"],
        docs_url="https://open.bigmodel.cn/dev/api",
        notes="清华系,中文场景表现优,支持 function calling",
    ),
    FreeProvider(
        provider_code="deepseek",
        display_name="DeepSeek(深度求索)",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://platform.deepseek.com",
        free_quota="1 元体验额度(约 7M tokens)/ 价格极低",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://api.deepseek.com/v1",
        key_env_vars=["DEEPSEEK_API_KEY"],
        default_models=["deepseek-chat", "deepseek-reasoner"],
        docs_url="https://platform.deepseek.com/docs",
        notes="R1 推理模型对标 o1,价格仅 OpenAI 1/30",
        recharge_url="https://platform.deepseek.com/usage",
        balance_endpoint="https://api.deepseek.com/user/balance",
    ),
    FreeProvider(
        provider_code="minimax",
        display_name="MiniMax",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://platform.minimaxi.com/user-center",
        free_quota="abab6.5s 聊天 1M tokens 免费 / 30M tokens 体验额度",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://api.minimax.chat/v1",
        key_env_vars=["MINIMAX_API_KEY", "MINIMAX_GROUP_ID"],
        default_models=["abab6.5s-chat", "abab6.5-chat"],
        docs_url="https://platform.minimaxi.com/document",
        notes="需要 group_id 参数,声音克隆强",
    ),
    FreeProvider(
        provider_code="qwen",
        display_name="阿里通义千问(DashScope)",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://dashscope.console.aliyun.com",
        free_quota="qwen-turbo 100M tokens 免费 / qwen-long 1M tokens 体验",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        key_env_vars=["DASHSCOPE_API_KEY"],
        default_models=["qwen-turbo", "qwen-plus", "qwen-long"],
        docs_url="https://help.aliyun.com/zh/dashscope",
        notes="阿里云,OpenAI 兼容模式,multimodal 支持",
    ),
    FreeProvider(
        provider_code="doubao",
        display_name="字节豆包(火山引擎)",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://console.volcengine.com/ark",
        free_quota="doubao-pro 5M tokens 免费体验 / 新用户 50 元额度",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://ark.cn-beijing.volces.com/api/v3",
        key_env_vars=["VOLC_API_KEY", "ARK_API_KEY"],
        default_models=["doubao-pro-32k", "doubao-pro-4k"],
        docs_url="https://www.volcengine.com/docs/82379",
        notes="字节跳动,OpenAI 兼容,需 endpoint_id 调用",
    ),
    FreeProvider(
        provider_code="wenxin",
        display_name="百度文心一言",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://console.bce.baidu.com/qianfan",
        free_quota="ERNIE-Speed-8K 永久免费 / ERNIE-Lite-8K 免费",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://qianfan.baidubce.com/v2",
        key_env_vars=["QIANFAN_API_KEY", "QIANFAN_SECRET_KEY"],
        default_models=["ernie-speed-8k", "ernie-lite-8k"],
        docs_url="https://cloud.baidu.com/doc/WENXINWORKSHOP",
        notes="百度,需 API Key + Secret Key 双参数",
    ),
    FreeProvider(
        provider_code="hunyuan",
        display_name="腾讯混元",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://cloud.tencent.com/product/hunyuan",
        free_quota="hunyuan-lite 永久免费 / hunyuan-pro 10M tokens 体验",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://api.hunyuan.cloud.tencent.com/v1",
        key_env_vars=["HUNYUAN_API_KEY", "TENCENT_CLOUD_SECRET_ID"],
        default_models=["hunyuan-lite", "hunyuan-pro"],
        docs_url="https://cloud.tencent.com/document/product/1729",
        notes="腾讯云,需 SecretId + SecretKey 签名",
    ),
    FreeProvider(
        provider_code="stepfun",
        display_name="阶跃星辰 StepFun",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://platform.stepfun.com",
        free_quota="step_plan 套餐(已配置,免费 plan 模式)",
        rate_limit="无限制(plan 套餐)",
        default_base_url="https://api.stepfun.com/step_plan/v1",
        key_env_vars=["STEPFUN_API_KEY"],
        default_models=["stepfun/step-3.7-flash", "stepfun/step-3.5-flash", "stepfun/step-router-v1"],
        docs_url="https://platform.stepfun.com/docs",
        notes="项目已配置 plan 套餐 key,默认模型 step-3.7-flash",
        # 2026-07-31 P1:补余额查询端点(https://platform.stepfun.com/docs/api-reference/accounts/get)
        # 返回 {balance, type, total_cash_balance, total_voucher_balance},balance=可用余额(CNY)
        recharge_url="https://platform.stepfun.com/step-plan",
        balance_endpoint="https://api.stepfun.com/v1/accounts",
    ),
    FreeProvider(
        provider_code="agnes",
        display_name="Agnes AI",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://agnes-ai.com",
        free_quota="plan 套餐(已配置)",
        rate_limit="无限制(plan 套餐)",
        default_base_url="https://apihub.agnes-ai.com/v1",
        key_env_vars=["AGNES_API_KEY"],
        default_models=["agnes/step-3.7-flash"],
        docs_url="https://agnes-ai.com/docs",
        notes="项目已配置 plan 套餐 key,本地连通性待验证",
    ),
    FreeProvider(
        provider_code="siliconcloud",
        display_name="SiliconCloud 硅基流动",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://siliconflow.cn",
        free_quota="14 元新用户额度 / Qwen2.5-7B 等小模型永久免费",
        rate_limit="100 RPM(免费层)",
        default_base_url="https://api.siliconflow.cn/v1",
        key_env_vars=["SILICONCLOUD_API_KEY"],
        default_models=["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V2-Chat"],
        docs_url="https://docs.siliconflow.cn",
        notes="国内聚合平台,聚合 200+ 国内外模型",
        recharge_url="https://cloud.siliconflow.cn/account/billing",
        balance_endpoint="https://api.siliconflow.cn/v1/user/info",
    ),
    FreeProvider(
        provider_code="modelscope",
        display_name="魔搭 ModelScope",
        category=ProviderCategory.DOMESTIC,
        signup_url="https://modelscope.cn",
        free_quota="Qwen 系列免费 / 1M tokens 体验额度",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        key_env_vars=["MODELSCOPE_API_KEY", "DASHSCOPE_API_KEY"],
        default_models=["Qwen/Qwen2.5-7B-Instruct"],
        docs_url="https://www.modelscope.cn/docs",
        notes="阿里达摩院,与 DashScope 共用 key",
    ),

    # ---------------- 国际 provider(英文场景优化) ----------------
    FreeProvider(
        provider_code="groq",
        display_name="Groq",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://console.groq.com",
        free_quota="Llama 系列免费 / 100 RPD(每天请求数)开发者层",
        rate_limit="100 RPM / 14400 RPD(免费层)",
        default_base_url="https://api.groq.com/openai/v1",
        key_env_vars=["GROQ_API_KEY"],
        default_models=["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
        docs_url="https://console.groq.com/docs",
        notes="LPU 推理芯片,500+ tokens/s,免费层最快",
    ),
    FreeProvider(
        provider_code="mistral",
        display_name="Mistral AI",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://console.mistral.ai",
        free_quota="mistral-large-latest 500K tokens/周 / Codestral 1M tokens/周",
        rate_limit="50 RPM(免费层)",
        default_base_url="https://api.mistral.ai/v1",
        key_env_vars=["MISTRAL_API_KEY"],
        default_models=["mistral-large-latest", "codestral-latest", "pixtral-12b-2409"],
        docs_url="https://docs.mistral.ai",
        notes="欧洲厂商,代码模型强,multimodal 支持",
    ),
    FreeProvider(
        provider_code="cohere",
        display_name="Cohere",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://dashboard.cohere.com",
        free_quota="Command-R 1000 API calls/月(开发者层)",
        rate_limit="100 RPM(免费层)",
        default_base_url="https://api.cohere.ai/v1",
        key_env_vars=["COHERE_API_KEY"],
        default_models=["command-r", "command-r-plus"],
        docs_url="https://docs.cohere.com",
        notes="RAG 场景强,支持 web search 工具",
    ),
    FreeProvider(
        provider_code="togetherai",
        display_name="Together AI",
        category=ProviderCategory.CREDITS,
        signup_url="https://api.together.xyz",
        free_quota="新用户 $5 credits(约 25M tokens Llama-3)",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://api.together.xyz/v1",
        key_env_vars=["TOGETHER_API_KEY"],
        default_models=["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
        docs_url="https://docs.together.ai",
        notes="聚合平台,支持 200+ 开源模型",
    ),
    FreeProvider(
        provider_code="huggingface",
        display_name="Hugging Face Inference API",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://huggingface.co/register",
        free_quota="免费层 1000 requests/天 / Serverless Inference",
        rate_limit="1000 RPD(免费层)",
        default_base_url="https://api-inference.huggingface.co",
        key_env_vars=["HUGGINGFACE_API_KEY", "HF_API_TOKEN"],
        default_models=["meta-llama/Llama-3.3-70B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
        docs_url="https://huggingface.co/docs/api-inference",
        notes="开源模型库,免费层负载较高(冷启动)",
    ),
    FreeProvider(
        provider_code="openrouter",
        display_name="OpenRouter",
        category=ProviderCategory.CREDITS,
        signup_url="https://openrouter.ai/keys",
        free_quota="多个 :free 后缀模型免费(Llama-3.3-70B-Instruct:free 等)",
        rate_limit="20 RPM(免费层)",
        default_base_url="https://openrouter.ai/api/v1",
        key_env_vars=["OPENROUTER_API_KEY"],
        default_models=["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-flash-1.5:free"],
        docs_url="https://openrouter.ai/docs",
        notes="聚合 290+ 模型,:free 后缀完全免费",
        recharge_url="https://openrouter.ai/credits",
        balance_endpoint="https://openrouter.ai/api/v1/credits",
    ),
    FreeProvider(
        provider_code="cloudflare_workers_ai",
        display_name="Cloudflare Workers AI",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://dash.cloudflare.com",
        free_quota="10000 neurons/天(免费层,约 10M tokens)",
        rate_limit="50 RPM(免费层)",
        default_base_url="https://api.cloudflare.com/client/v4/accounts",
        key_env_vars=["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
        default_models=["@cf/zai-org/glm-5.2", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwq-32b"],
        docs_url="https://developers.cloudflare.com/workers-ai",
        notes="边缘推理,需 account_id,模型名 @cf/ 前缀",
    ),
    FreeProvider(
        provider_code="nvidia_nim",
        display_name="NVIDIA NIM",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://build.nvidia.com",
        free_quota="1000 credits(约 1000 次调用)/ 永久免费层",
        rate_limit="40 RPM(免费层)",
        default_base_url="https://integrate.api.nvidia.com/v1",
        key_env_vars=["NVIDIA_API_KEY", "NIM_API_KEY"],
        default_models=["deepseek-ai/deepseek-v4-pro", "deepseek-ai/deepseek-v4-flash", "meta/llama-3.3-70b-instruct"],
        docs_url="https://docs.api.nvidia.com",
        notes=(
            "NVIDIA DGX 推理,Llama / DeepSeek / Qwen 全系列。"
            "⚠️ 2026-07-31 实测:deepseek-v4-pro 200 OK ✅(主力推荐);"
            "deepseek-r1 / qwen2.5-7b 间歇性 502(provider 限流,模型未下线);"
            "llama-3.3-70b 间歇性超时(大模型冷启动,模型可用);"
            "nemotron-4-340b-instruct 需 nvidia/nvidia/ 前缀且 NIM 1.14 docs 未列出(可能已下线,改用 llama-3.1-nemotron-70b-instruct)。"
            "模型清单由 ModelSyncService 从 NVIDIA /v1/models 自动同步。"
        ),
    ),
    FreeProvider(
        provider_code="github_models",
        display_name="GitHub Models",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://github.com/marketplace/models",
        free_quota="免费层 150 requests/天 / GitHub PAT 直接用",
        rate_limit="150 RPD(免费层)",
        default_base_url="https://models.inference.ai.azure.com",
        key_env_vars=["GITHUB_TOKEN", "GITHUB_API_KEY"],
        default_models=["gpt-4o", "Mistral-large", "Phi-3.5-mini-instruct"],
        docs_url="https://docs.github.com/en/models",
        notes="⚠️ 2026-06-16 后新用户无法注册,老用户保留( OmniRoute FREE_TIERS.md v3.8.49 标注);GitHub PAT 即可用,聚合 OpenAI/Mistral/Phi",
    ),
    FreeProvider(
        provider_code="vercel_ai_gateway",
        display_name="Vercel AI Gateway",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://vercel.com/dashboard",
        free_quota="Hobby plan 免费 / 1000 requests/月",
        rate_limit="30 RPM(免费层)",
        default_base_url="https://ai-gateway.vercel.sh/v1",
        key_env_vars=["VERCEL_AI_GATEWAY_API_KEY"],
        default_models=["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"],
        docs_url="https://vercel.com/docs/ai-gateway",
        notes="Vercel 托管,聚合多 provider",
    ),
    FreeProvider(
        provider_code="cerebras",
        display_name="Cerebras",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://cerebras.ai",
        free_quota="Llama-3.1-8B 免费 / 2000 RPM(免费层最快)",
        rate_limit="2000 RPM(免费层)",
        default_base_url="https://api.cerebras.ai/v1",
        key_env_vars=["CEREBRAS_API_KEY"],
        default_models=["llama3.1-8b", "llama-3.3-70b"],
        docs_url="https://docs.cerebras.ai",
        notes="Wafer-Scale Engine,2600 tokens/s,免费层 RPM 最高",
    ),
    FreeProvider(
        provider_code="sambanova",
        display_name="SambaNova",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://cloud.sambanova.ai",
        free_quota="Llama-3.3-70B 免费 / DeepSeek-R1 免费",
        rate_limit="100 RPM(免费层)",
        default_base_url="https://api.sambanova.ai/v1",
        key_env_vars=["SAMBANOVA_API_KEY"],
        default_models=["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1"],
        docs_url="https://docs.sambanova.ai",
        notes="RDA 芯片,免费层支持 R1 推理模型",
    ),
    FreeProvider(
        provider_code="fireworksai",
        display_name="Fireworks AI",
        category=ProviderCategory.CREDITS,
        signup_url="https://fireworks.ai",
        free_quota="新用户 $1 credits(约 5M tokens)",
        rate_limit="60 RPM(免费层)",
        default_base_url="https://api.fireworks.ai/inference/v1",
        key_env_vars=["FIREWORKS_API_KEY"],
        default_models=["accounts/fireworks/models/llama-v3p3-70b-instruct"],
        docs_url="https://docs.fireworks.ai",
        notes="⚠️ ToS §2.1/§2.2 禁止 proxy/中介使用(OmniRoute 标注 caution);开源模型托管,推理速度快",
    ),

    # ---------------- credits provider(注册送额度) ----------------
    FreeProvider(
        provider_code="lambda",
        display_name="Lambda Labs",
        category=ProviderCategory.CREDITS,
        signup_url="https://cloud.lambdalabs.com",
        free_quota="新用户 250 credits",
        rate_limit="60 RPM",
        default_base_url="https://api.lambdalabs.com/v1",
        key_env_vars=["LAMBDA_API_KEY"],
        default_models=["llama3.1-405b-instruct", "llama3.1-70b-instruct"],
        docs_url="https://docs.lambdalabs.com",
        notes="GPU 云厂商,Llama 405B 可用",
    ),
    FreeProvider(
        provider_code="baseten",
        display_name="Baseten",
        category=ProviderCategory.CREDITS,
        signup_url="https://baseten.co",
        free_quota="新用户 $30 credits",
        rate_limit="60 RPM",
        default_base_url="https://api.baseten.co/v1",
        key_env_vars=["BASETEN_API_KEY"],
        default_models=["llama-3.1-70b", "qwen2.5-72b"],
        docs_url="https://docs.baseten.co",
        notes="无服务器 GPU 推理",
    ),
    FreeProvider(
        provider_code="crusoe",
        display_name="Crusoe Cloud",
        category=ProviderCategory.CREDITS,
        signup_url="https://crusoe.ai",
        free_quota="新用户 $10 credits",
        rate_limit="60 RPM",
        default_base_url="https://api.crusoe.ai/v1",
        key_env_vars=["CRUSOE_API_KEY"],
        default_models=["llama-3.3-70b-instruct"],
        docs_url="https://docs.crusoe.ai",
        notes="清洁能源数据中心",
    ),
    FreeProvider(
        provider_code="hyperbolic",
        display_name="Hyperbolic",
        category=ProviderCategory.CREDITS,
        signup_url="https://hyperbolic.xyz",
        free_quota="新用户 $5 credits",
        rate_limit="60 RPM",
        default_base_url="https://api.hyperbolic.xyz/v1",
        key_env_vars=["HYPERBOLIC_API_KEY"],
        default_models=["meta-llama/Meta-Llama-3.1-405B-Instruct"],
        docs_url="https://docs.hyperbolic.xyz",
        notes="GPU 聚合市场,405B 可用",
    ),
    FreeProvider(
        provider_code="nebius",
        display_name="Nebius AI",
        category=ProviderCategory.CREDITS,
        signup_url="https://nebius.ai",
        free_quota="新用户 $10 credits",
        rate_limit="60 RPM",
        default_base_url="https://api.studio.nebius.ai/v1",
        key_env_vars=["NEBIUS_API_KEY"],
        default_models=["meta-llama/Meta-Llama-3.1-70B-Instruct"],
        docs_url="https://docs.nebius.ai",
        notes="欧洲 GPU 云,Llama 系列",
    ),

    # ---------------- 本地 LLM(无需 key) ----------------
    FreeProvider(
        provider_code="ollama",
        display_name="Ollama(本地)",
        category=ProviderCategory.LOCAL,
        signup_url="https://ollama.com/download",
        free_quota="永久免费(本地部署,无配额)",
        rate_limit="无限制(本地)",
        default_base_url="http://localhost:11434",
        key_env_vars=[],  # 本地无需 key
        default_models=["ollama/llama3.2", "ollama/qwen2.5:32b", "ollama/deepseek-r1"],
        docs_url="https://ollama.com/library",
        notes="本地 LLM 首选,一键拉模型,支持 function calling",
    ),
    FreeProvider(
        provider_code="lmstudio",
        display_name="LM Studio(本地)",
        category=ProviderCategory.LOCAL,
        signup_url="https://lmstudio.ai",
        free_quota="永久免费(本地部署)",
        rate_limit="无限制(本地)",
        default_base_url="http://localhost:1234/v1",
        key_env_vars=[],
        default_models=["lmstudio/llama-3.3-70b", "lmstudio/qwen2.5-32b"],
        docs_url="https://lmstudio.ai/docs",
        notes="GUI 客户端,OpenAI 兼容 API",
    ),
    FreeProvider(
        provider_code="llamacpp",
        display_name="llama.cpp(本地)",
        category=ProviderCategory.LOCAL,
        signup_url="https://github.com/ggerganov/llama.cpp",
        free_quota="永久免费(本地部署)",
        rate_limit="无限制(本地)",
        default_base_url="http://localhost:8080",
        key_env_vars=[],
        default_models=["llamacpp/llama-3.3-70b", "llamacpp/qwen2.5"],
        docs_url="https://github.com/ggerganov/llama.cpp/tree/main/tools/server",
        notes="C++ 推理引擎,GPU 加速,极轻量",
    ),
    FreeProvider(
        provider_code="vllm",
        display_name="vLLM(本地)",
        category=ProviderCategory.LOCAL,
        signup_url="https://github.com/vllm-project/vllm",
        free_quota="永久免费(本地部署)",
        rate_limit="无限制(本地)",
        default_base_url="http://localhost:8000/v1",
        key_env_vars=[],
        default_models=["vllm/llama-3.3-70b", "vllm/qwen2.5-72b"],
        docs_url="https://docs.vllm.ai",
        notes="高吞吐推理,PagedAttention,生产级本地 LLM",
    ),

    # ---------------- OmniRoute 独有 provider(2026-07-30 补,对齐 v3.8.49) ----------------
    FreeProvider(
        provider_code="llm7",
        display_name="LLM7(免费镜像)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://llm7.io",
        free_quota="5M tokens/天(约 150M/月),无需 key",
        rate_limit="无明确限制(共享池)",
        default_base_url="https://api.llm7.io/v1",
        key_env_vars=[],  # 无需 key
        default_models=["qwen3-235b", "mistral-small-3.2", "codestral-latest"],
        docs_url="https://llm7.io",
        notes=(
            "OmniRoute 第二大免费 token 来源(150M/月);免费镜像服务,有下线风险,建议兜底用。"
            "2026-07-31 修复:旧模型名 gpt-4o/gpt-4.1/gpt-5.6/claude-sonnet-4.5 已不可用"
            "(返回 'Model currently unavailable')。从 /v1/models 实时拉取的免费(无 tier=pro 标记)模型:"
            "qwen3-235b / mistral-small-3.2 / codestral-latest / devstral-small-2:24b。"
            "Pro 模型(kimi-k2.6/minimax-m2.7/deepseek-v4-flash 等)需 dash.llm7.io 申请 key。"
            "匿名限 500K tokens/天, 60 r/h, 10 r/m, 1 r/s。"
        ),
    ),
    FreeProvider(
        provider_code="pollinations",
        display_name="Pollinations(无 key 免费)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://pollinations.ai",
        free_quota="永久免费,无需注册无需 API 密钥",
        rate_limit="1 req/6-15 秒(匿名,极低速率)",
        default_base_url="https://text.pollinations.ai/openai",
        key_env_vars=[],  # 无需 key
        default_models=["openai-fast"],
        docs_url="https://pollinations.ai/docs",
        notes=(
            "OmniRoute 11 forever free 之一;无 key 免费顶级模型,速率极低仅适合兜底验证。"
            "2026-07-31 修复:模型清单从 /models 端点实时获取,当前唯一可用免费模型为 openai-fast"
            "(GPT-OSS 20B Reasoning LLM by OVH,别名 openai/gpt-oss/gpt-oss-20b/ovh-reasoning)。"
            "旧模型名 gpt-5/claude/deepseek/llama-4/gemini 已下线(返回 404 Model not found)。"
            "text.pollinations.ai 为 legacy API,enter.pollinations.ai 为新平台(需 sk_ key,无速率限制)。"
        ),
    ),
    FreeProvider(
        provider_code="qoder",
        display_name="Qoder AI(unlimited free)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://qoder.ai",
        free_quota="unlimited free(Kimi K2 / DeepSeek R1 / Qwen3 Coder Plus)",
        rate_limit="无明确限制",
        default_base_url="https://api.qoder.ai/v1",
        key_env_vars=["QODER_API_KEY"],
        default_models=["if/kimi-k2-thinking", "if/deepseek-r1", "if/qwen3-coder-plus"],
        docs_url="https://docs.qoder.ai",
        notes="OmniRoute 11 forever free 之一;unlimited free 编码模型",
    ),
    FreeProvider(
        provider_code="aihorde",
        display_name="AI Horde(众包 GPU)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://aihorde.net/register",
        free_quota="完全免费,众包 GPU 推理",
        rate_limit="按贡献度排队(匿名慢,注册+贡献快)",
        default_base_url="https://aihorde.net/api/v2",
        key_env_vars=["AIHORDE_API_KEY"],  # 可选,匿名也可用
        default_models=["auto"],  # 众包模型随机
        docs_url="https://github.com/Haidra-Org/horde-sdk",
        notes=(
            "OmniRoute v3.8.49 新增;众包 GPU,模型随机,适合低成本兜底。"
            "⚠️ 2026-07-31 评估:AI Horde 不是 OpenAI 兼容协议,使用异步流程"
            "(POST /api/v2/generate/text/async → 轮询 /api/v2/generate/text/status/{id}),"
            "LiteLLM openai/ 路径无法调通(返回 404)。需专用 SDK(horde-sdk / @zeldafan0225/ai_horde)"
            "或原生 provider 适配器才能使用。当前 llm_gateway._resolve_provider 路由不可用,待移除/重写。"
            "服务本身仍在线(https://aihorde.net),仅协议不兼容。"
        ),
    ),
    FreeProvider(
        provider_code="ovhcloud",
        display_name="OVHcloud AI(欧洲节点)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://www.ovhcloud.com/en/public-cloud/ai/",
        free_quota="免费层(需 OVH 账号)",
        rate_limit="60 RPM",
        default_base_url="https://gra.ai.cloud.ovh.net/v1",
        key_env_vars=["OVH_AI_API_KEY"],
        default_models=["meta-llama/Llama-3.3-70B-Instruct"],
        docs_url="https://docs.ovh.com/gb/en/public-cloud/ai/",
        notes="OmniRoute v3.8.49 新增;欧洲 GPU 云,GDPR 合规节点",
    ),
    FreeProvider(
        provider_code="requesty",
        display_name="Requesty(路由聚合)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://requesty.ai",
        free_quota="免费层(透明路由聚合)",
        rate_limit="60 RPM",
        default_base_url="https://router.requesty.ai/v1",
        key_env_vars=["REQUESTY_API_KEY"],
        default_models=["auto"],  # 路由聚合,模型自动选
        docs_url="https://docs.requesty.ai",
        notes="OmniRoute v3.8.49 新增;透明路由聚合,类似 OpenRouter",
    ),

    # ---------------- default_models.json 已有但 registry 未注册(2026-07-30 补) ----------------
    FreeProvider(
        provider_code="opencode_zen",
        display_name="OpenCode Zen(免费编码模型)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://opencode.ai/auth",
        free_quota="recurring-uncapped(轮换免费编码模型,实际免费模型 2 个)",
        rate_limit="无明确限制",
        default_base_url="https://opencode.ai/zen/v1",
        key_env_vars=[],  # 无需 key(免费模型层已验证无 key 可调)
        default_models=["big-pickle", "glm-4.7-free"],
        docs_url="https://opencode.ai/docs/zen",
        notes=(
            "OmniRoute 标注 recurring-uncapped;正确 base_url 为 https://opencode.ai/zen/v1(非 api.opencode.ai)。"
            "2026-07-31 修复:从 /zen/v1/models 实时拉取,当前实际免费模型仅 2 个:big-pickle / glm-4.7-free。"
            "旧 default_models 中的 deepseek-v4-flash-free / mimo-v2.5-free / qwen3.6-plus-free / minimax-m3-free"
            "不在实际模型列表中(返回 'Not Found')。big-pickle-stealth 也不存在,正确名为 big-pickle。"
            "其他模型(gpt-5.x/claude-*/gemini-*/kimi-k2/qwen3-coder/glm-4.6 等)需 OPENCODE_API_KEY 付费调用。"
        ),
    ),
    FreeProvider(
        provider_code="scaleway",
        display_name="Scaleway(1M/月免费)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://console.scaleway.com",
        free_quota="1M tokens/月免费",
        rate_limit="60 RPM",
        default_base_url="https://api.scaleway.ai/ai-models/v1",
        key_env_vars=["SCALEWAY_API_KEY"],
        default_models=[
            "scaleway/mistral-small-3.2-24b-instruct-2506",
            "scaleway/qwen3-coder-30b-a3b-instruct",
            "scaleway/llama-3.3-70b-instruct",
        ],
        docs_url="https://www.scaleway.com/en/docs/ai-models/",
        notes="default_models.json 已预置 3 个模型,registry 本批次补齐;欧洲节点",
    ),
    FreeProvider(
        provider_code="alibaba_intl",
        display_name="Alibaba Intl(阿里国际,1M/模型/月)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://www.alibabacloud.com/en/en/dashscope",
        free_quota="1M tokens/模型/月免费(Qwen3 235B / Qwen3 Coder Plus)",
        rate_limit="60 RPM",
        default_base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        key_env_vars=["ALIBABA_INTL_API_KEY", "DASHSCOPE_API_KEY"],
        default_models=[
            "alibaba-intl/qwen3-235b-a22b",
            "alibaba-intl/qwen3-coder-plus",
            "alibaba-intl/qwen-max",
            "alibaba-intl/qwen-plus",
            "alibaba-intl/qwen-turbo",
        ],
        docs_url="https://www.alibabacloud.com/help/en/dashscope/",
        notes="default_models.json 已预置 5 个模型,registry 本批次补齐;阿里国际版,与国内 dashscope 互补",
    ),
    FreeProvider(
        provider_code="navy",
        display_name="Navy(新免费 provider)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://navy.ai",
        free_quota="免费层(OmniRoute v3.8.49 新增)",
        rate_limit="60 RPM",
        default_base_url="https://api.navy.ai/v1",
        key_env_vars=["NAVY_API_KEY"],
        default_models=["auto"],
        docs_url="https://docs.navy.ai",
        notes="OmniRoute v3.8.49 新增;信息有限,建议先小流量测试",
    ),

    # ---------------- P3-2 法务评估:ToS 禁止接入的 provider(2026-07-30 立) ----------------
    FreeProvider(
        provider_code="kiro",
        display_name="Kiro(AWS,AI IDE,免费 Claude)",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://kiro.dev",
        free_quota="免费 Claude 接入(AI IDE 内置,通过 AWS Bedrock)",
        rate_limit="未公开(IDE 内使用)",
        default_base_url="",  # 无公开 API endpoint(IDE 内置,非独立 API 服务)
        key_env_vars=[],  # 无独立 API key(IDE 内置认证,不支持外部调用)
        default_models=["claude-sonnet-4", "claude-3.7-sonnet"],
        docs_url="https://kiro.dev/docs",
        notes=(
            "⚠️ 法务风险(2026-07-30 P3-2 评估):Kiro ToS §3.2 明确禁止第三方集成 / "
            "自动化调用 / 绕过 IDE 界面访问,违反可能导致账号封禁 + 法律追责。"
            "本注册表仅记录该 provider 存在(法务评估存档),不提供技术接入路径。"
            "用户如需使用 Claude,请走 anthropic/ 前缀(官方 API)或 agnes/ 前缀(中转)。"
        ),
    ),
]


# ============================================================================
# 零成本 / 免费额度标注(2026-07-30 立,零成本引流路径 1)
# zero_cost:真·零成本,无需 key 即可调用(众包 / 免费镜像 / keyless API)
# free_tier:有免费额度但需注册 key(永久免费模型 / 试用 credits / 免费层 RPM)
# 本地 LLM(ollama/lmstudio/llamacpp/vllm)不标 zero_cost(category=LOCAL 已区分)
# stepfun/agnes 不标 free_tier(项目已配置付费 plan 套餐,非免费层)
# kiro 不标(法务风险,不接入技术路径)
# ============================================================================
_ZERO_COST_CODES: set[str] = {
    "pollinations",  # 无需 key,免费顶级模型(速率极低)
    "llm7",  # 无需 key,免费镜像(5M tokens/天)
    "aihorde",  # 众包 GPU,匿名可用(注册+贡献可加速)
    "opencode_zen",  # 无需 key,轮换免费编码模型
}

_FREE_TIER_CODES: set[str] = {
    # 国内(永久免费模型 / 体验额度)
    "moonshot",  # Kimi-K2 永久免费
    "zhipu",  # glm-4-flash 永久免费
    "deepseek",  # 1 元体验额度
    "minimax",  # 1M tokens 免费
    "qwen",  # 100M tokens 免费
    "doubao",  # 5M tokens 免费体验
    "wenxin",  # ERNIE-Speed-8K 永久免费
    "hunyuan",  # hunyuan-lite 永久免费
    "siliconcloud",  # 小模型永久免费 + 14 元额度
    "modelscope",  # 1M tokens 体验
    # 国际(免费层 RPM/TPM 限制)
    "groq",  # 100 RPM 免费
    "mistral",  # 500K tokens/周
    "cohere",  # 1000 calls/月
    "togetherai",  # $5 credits
    "huggingface",  # 1000 requests/天
    "openrouter",  # :free 后缀模型免费
    "cloudflare_workers_ai",  # 10000 neurons/天
    "nvidia_nim",  # 1000 credits
    "github_models",  # 150 requests/天
    "vercel_ai_gateway",  # 1000 requests/月
    "cerebras",  # Llama-3.1-8B 免费
    "sambanova",  # Llama-3.3-70B 免费
    "fireworksai",  # $1 credits
    # credits provider(注册送额度)
    "lambda",  # 250 credits
    "baseten",  # $30 credits
    "crusoe",  # $10 credits
    "hyperbolic",  # $5 credits
    "nebius",  # $10 credits
    # OmniRoute 补充 provider
    "qoder",  # unlimited free 编码模型
    "ovhcloud",  # 免费层
    "requesty",  # 免费层
    "scaleway",  # 1M/月免费
    "alibaba_intl",  # 1M/模型/月免费
    "navy",  # 免费层
}

for _p in _REGISTRY:
    if _p.provider_code in _ZERO_COST_CODES:
        _p.zero_cost = True
    if _p.provider_code in _FREE_TIER_CODES:
        _p.free_tier = True


class FreeProviderRegistry:
    """免费 provider 注册表查询 API。

    用法:
        from .free_provider_registry import free_provider_registry
        all_providers = free_provider_registry.list_all()
        moonshot = free_provider_registry.get_by_code("moonshot")
        configured = free_provider_registry.list_configured()
        local = free_provider_registry.list_local()
    """

    def __init__(self, registry: list[FreeProvider] | None = None) -> None:
        self._registry = registry or _REGISTRY
        self._by_code: dict[str, FreeProvider] = {p.provider_code: p for p in self._registry}

    def list_all(self) -> list[FreeProvider]:
        """列出所有免费 provider。"""
        return list(self._registry)

    def list_by_category(self, category: ProviderCategory) -> list[FreeProvider]:
        """按分类列出 provider。"""
        return [p for p in self._registry if p.category == category]

    def list_domestic(self) -> list[FreeProvider]:
        """列出国内 provider。"""
        return self.list_by_category(ProviderCategory.DOMESTIC)

    def list_international(self) -> list[FreeProvider]:
        """列出国际 provider。"""
        return self.list_by_category(ProviderCategory.INTERNATIONAL)

    def list_credits(self) -> list[FreeProvider]:
        """列出 credits 类 provider(注册送额度)。"""
        return self.list_by_category(ProviderCategory.CREDITS)

    def list_local(self) -> list[FreeProvider]:
        """列出本地 LLM(无需 key)。"""
        return self.list_by_category(ProviderCategory.LOCAL)

    def list_zero_cost(self) -> list[FreeProvider]:
        """列出真·零成本 provider(无需 key 即可调用,零成本引流核心)。"""
        return [p for p in self._registry if p.zero_cost]

    def list_free_tier(self) -> list[FreeProvider]:
        """列出有免费额度的 provider(需注册 key,但有免费层/永久免费模型)。"""
        return [p for p in self._registry if p.free_tier]

    def get_by_code(self, provider_code: str) -> Optional[FreeProvider]:
        """按 provider_code 查询。"""
        return self._by_code.get(provider_code)

    def get_default_base_url(self, provider_code: str) -> Optional[str]:
        """获取 provider 的默认 base_url(用户未填 api_base 时用此值)。"""
        p = self._by_code.get(provider_code)
        return p.default_base_url if p else None

    def get_default_models(self, provider_code: str) -> list[str]:
        """获取 provider 的推荐免费模型列表。"""
        p = self._by_code.get(provider_code)
        return p.default_models if p else []

    def get_recharge_url(self, provider_code: str) -> str:
        """获取 provider 的充值/billing 页面 URL(管理端"去充值"按钮跳转用)。

        降级策略(2026-07-31 立,用户规则:账户没钱需可视化 + 跳转充值):
        1. 优先用 FreeProvider.recharge_url(显式配置的充值页)
        2. 降级用 FreeProvider.signup_url(注册/控制台页,通常也能找到充值入口)
        3. 都没有 → 返回空字符串(管理端"去充值"按钮不显示)

        本地 LLM / zero_cost provider 返回空(无需充值)。
        """
        p = self._by_code.get(provider_code)
        if not p:
            return ""
        if p.category == ProviderCategory.LOCAL or p.zero_cost:
            return ""
        return p.recharge_url or p.signup_url or ""

    def get_balance_endpoint(self, provider_code: str) -> str:
        """获取 provider 的余额查询端点 URL(完整 URL,用于 HTTP 调用)。

        返回空字符串表示该 provider 不支持余额查询,应降级到推理请求 ping。
        balance_endpoint 字段可以是完整 URL 或相对路径(自动拼接到 default_base_url)。
        """
        p = self._by_code.get(provider_code)
        if not p:
            return ""
        ep = p.balance_endpoint
        if not ep:
            return ""
        if ep.startswith(("http://", "https://")):
            return ep
        if not p.default_base_url:
            return ""
        return p.default_base_url.rstrip("/") + "/" + ep.lstrip("/")

    def is_key_configured(self, provider_code: str) -> ProviderStatus:
        """检测 provider 的 key 配置状态。

        判定规则:
        1. 本地 LLM(ollama/lmstudio/llamacpp/vllm)→ LOCAL(无需 key)
        2. 任一 key_env_vars 在环境变量中配置且非空 → CONFIGURED
        3. 否则 → NOT_CONFIGURED

        注意:本函数只检测环境变量(.env),不查 DB 的 ai_model_config 表。
        完整状态检测应在 API 层(同时查 env + DB),由 Dashboard 调用。
        """
        p = self._by_code.get(provider_code)
        if not p:
            return ProviderStatus.NOT_CONFIGURED

        if p.category == ProviderCategory.LOCAL:
            return ProviderStatus.LOCAL

        if not p.key_env_vars:
            return ProviderStatus.NOT_CONFIGURED

        for env_var in p.key_env_vars:
            val = os.environ.get(env_var, "").strip()
            if val:
                return ProviderStatus.CONFIGURED
        return ProviderStatus.NOT_CONFIGURED

    def list_configured(self) -> list[FreeProvider]:
        """列出已配置 key 的 provider(从环境变量检测)。"""
        return [
            p for p in self._registry
            if self.is_key_configured(p.provider_code) == ProviderStatus.CONFIGURED
        ]

    def list_not_configured(self) -> list[FreeProvider]:
        """列出未配置 key 的 provider(需用户填 key)。"""
        return [
            p for p in self._registry
            if self.is_key_configured(p.provider_code) == ProviderStatus.NOT_CONFIGURED
        ]

    def to_dashboard_dict(self) -> list[dict[str, Any]]:
        """转为 Dashboard 展示用的 list[dict](含 status 字段)。"""
        result: list[dict[str, Any]] = []
        for p in self._registry:
            result.append({
                "provider_code": p.provider_code,
                "display_name": p.display_name,
                "category": p.category.value,
                "signup_url": p.signup_url,
                "free_quota": p.free_quota,
                "rate_limit": p.rate_limit,
                "default_base_url": p.default_base_url,
                "key_env_vars": p.key_env_vars,
                "default_models": p.default_models,
                "protocol": p.protocol,
                "docs_url": p.docs_url,
                "notes": p.notes,
                "zero_cost": p.zero_cost,
                "free_tier": p.free_tier,
                "status": self.is_key_configured(p.provider_code).value,
            })
        return result

    def __len__(self) -> int:
        return len(self._registry)


# 模块级单例
free_provider_registry = FreeProviderRegistry()


# ============================================================================
# 积分消耗倍数推断(2026-07-31 立,P0: /llm/models 端点为每个模型附加 points_multiplier)
# 5 档梯度:免费(0x)/ 经济(1x)/ 标准(3x)/ 高级(10x)/ 旗舰(30x)。
# 优先级:旗舰 > 高级 > 标准 > 经济 > 免费 > 默认(经济)。
# 注:档位判定基于 model_id 关键词子串匹配,旗舰层 "opus" 会覆盖高级层 "claude-3-opus"
#     (claude-3-opus 实际归类为旗舰 30x,符合"opus 系列=旗舰"语义)。
# ============================================================================

# 旗舰(30x):最强推理 / 顶级模型
_FLAGSHIP_KEYWORDS: tuple[str, ...] = ("opus", "thinking", "o1-preview", "o1", "o3", "gpt-5")
# 高级(10x):pro / max / turbo / 长上下文旗舰
_PREMIUM_KEYWORDS: tuple[str, ...] = (
    "gpt-4-turbo", "gpt-4.5", "claude-3-opus", "gemini-pro",
    "o1-mini", "o3-mini", "qwen-max-longcontext",
)
# 标准(3x):主流中端模型
_STANDARD_KEYWORDS: tuple[str, ...] = (
    "sonnet", "gpt-4o", "gpt-4.1", "deepseek", "glm-4", "qwen-max",
)
# 经济(1x):轻量 / 快速 / 低成本
_ECONOMY_KEYWORDS: tuple[str, ...] = ("mini", "flash", "lite", "nano", "haiku")
# 免费(0x):本地 / zero_cost provider
_FREE_KEYWORDS: tuple[str, ...] = (
    "ollama", "llama", "llm7", "pollinations", "aihorde", "opencode_zen",
)


def infer_points_multiplier(model_id: str) -> float:
    """根据 model_id 推断积分消耗倍数(5 档梯度)。

    返回值:
    - 0.0: 免费模型(本地 / zero_cost provider)
    - 1.0: 经济模型(mini / flash / lite / nano / haiku)
    - 3.0: 标准模型(sonnet / gpt-4o / deepseek / glm-4 / qwen-max)
    - 10.0: 高级模型(pro / max / turbo / 长上下文旗舰)
    - 30.0: 旗舰模型(opus / thinking / o1 / o3 / gpt-5)

    无法匹配任何关键词时返回 1.0(默认经济档,避免高估用户消耗)。

    Args:
        model_id: 模型标识(如 "claude-3-5-sonnet-20241022" / "gpt-4o-mini" /
            "ollama/llama3" / "deepseek-chat")。大小写不敏感,允许传空字符串。

    Returns:
        积分消耗倍数(0.0 / 1.0 / 3.0 / 10.0 / 30.0)。

    Examples:
        >>> infer_points_multiplier("claude-3-opus-20240229")
        30.0
        >>> infer_points_multiplier("gpt-4o-mini")
        1.0
        >>> infer_points_multiplier("deepseek-chat")
        3.0
        >>> infer_points_multiplier("ollama/llama3")
        0.0
        >>> infer_points_multiplier("")
        1.0
    """
    mid = (model_id or "").lower()
    # 优先处理 mini/nano/haiku 后缀(避免 gpt-4o-mini 被标准层 gpt-4o 遮蔽,o1-mini 被 o1 遮蔽)
    # mini 版本永远归经济档(1x),不论父型号
    if "mini" in mid or "nano" in mid or "haiku" in mid:
        return 1.0
    # 旗舰(30x)
    if any(k in mid for k in _FLAGSHIP_KEYWORDS):
        return 30.0
    # 高级(10x)
    if any(k in mid for k in _PREMIUM_KEYWORDS):
        return 10.0
    # 标准(3x)
    if any(k in mid for k in _STANDARD_KEYWORDS):
        return 3.0
    # 经济(1x):flash/lite(mini/nano/haiku 已提前返回)
    if any(k in mid for k in _ECONOMY_KEYWORDS):
        return 1.0
    # 免费(0x)
    if any(k in mid for k in _FREE_KEYWORDS):
        return 0.0
    # 默认经济(1x)
    return 1.0

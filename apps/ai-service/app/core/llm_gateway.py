# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LiteLLM 网关。

配置优先级:ai_model_config 表(ownerUuid/providerCode 匹配) > .env 环境变量 > stub 降级。
无 key 时降级为 stub(返回固定响应),便于本地开发与测试。
支持流式输出(litellm.acompletion stream=True),stub 模式下模拟分块。
"""

import asyncio
import base64
import json
import logging
import os
import random
import re
import socket
import time
from collections.abc import AsyncIterator
from collections.abc import AsyncIterator as AsyncIteratorType
from contextlib import asynccontextmanager
from contextlib import suppress as _ctx_suppress
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import asyncpg
import httpx

from ..middleware.llm_metrics import (
    LLM_FALLBACK_FAILURE,
    LLM_FALLBACK_SUCCESS,
    LLM_FALLBACK_TRIGGERED,
    LLM_TOKEN_COMPACTION_FAILURE,
    LLM_TOKEN_COMPACTION_RATIO,
    LLM_TOKEN_COMPACTION_SUCCESS,
    LLM_TOKEN_COMPACTION_TRIGGERED,
    classify_fallback_reason,
    describe_quota_error,
    is_quota_exhaustion_error,
)
from ..services.tls_stealth import create_stealth_client
from .config import settings
from .context_compaction import estimate_messages_tokens
from .db_pool import get_shared_pool
from .provider_caps import (
    apply_provider_headers,
    apply_provider_overrides,
    filter_call_kwargs,
    get_provider_cap,
)
from .usage_cache import normalize_usage

# Combo 多级 fallback 路由器(2026-07-30 立,P0-1 Combo 接入 LLM 调用链)
# 延迟导入避免循环依赖(combo_router.py 内部反向 import llm_gateway)
_COMBO_ROUTER = None  # type: Any | None


def _get_combo_router() -> Any:
    """懒加载 ComboRouter 单例(避免循环导入)。"""
    global _COMBO_ROUTER
    if _COMBO_ROUTER is None:
        try:
            from ..services.combo_router import combo_router
            _COMBO_ROUTER = combo_router
        except ImportError as e:
            logger.warning("ComboRouter 加载失败,P0-1 Combo fallback 不可用: %s", e)
            _COMBO_ROUTER = False  # 标记加载失败,避免重复尝试
    return _COMBO_ROUTER

# TEMP-FIX(ai-feed): 循环导入临时绕过(llm_gateway → providers → base_provider → llm_gateway)
# 跑完 LLM 批处理后回退。原代码:
# from ..providers import get_provider as _get_native_provider
# from ..providers.base_provider import BaseProvider, ProviderError
if TYPE_CHECKING:
    from ..providers.base_provider import BaseProvider

logger = logging.getLogger(__name__)

# ============================================================================
# ihui_relay api_base 自动检测(国内/海外端点竞速)
# ============================================================================
# 根据网络延迟自动选择更快的端点,5 分钟缓存,避免每次请求都检测
# IHUI_RELAY_REGION=auto(默认) → TCP 竞速选最低延迟
# IHUI_RELAY_REGION=cn         → 强制国内端点
# IHUI_RELAY_REGION=us         → 强制海外端点
_ihui_relay_base_cache: dict[str, Any] = {"base": None, "expires_at": 0.0}
_IHUI_RELAY_BASE_TTL = 300  # 5 分钟
_IHUI_RELAY_BASES = [
    "https://api.x5m5x.com/v1",     # 国内主节点
    "https://us-api.x5m5x.com/v1",  # 海外备用节点
]


def _check_tcp_latency(url: str, timeout: float = 2.0) -> float:
    """TCP 连接延迟检测(秒),不可达返回 inf。"""
    try:
        parsed = httpx.URL(url)
        host = parsed.host
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        start = time.time()
        with socket.create_connection((host, port), timeout=timeout):
            return time.time() - start
    except Exception:
        return float("inf")


def _detect_ihui_relay_base() -> str:
    """自动检测最佳 ihui_relay api_base。

    优先级:
    1. IHUI_RELAY_REGION=cn → 强制国内
    2. IHUI_RELAY_REGION=us → 强制海外
    3. auto(默认) → TCP 竞速,选延迟最低的
    4. 全部不可达 → 默认国内

    结果缓存 5 分钟,避免每次请求都检测。
    """
    now = time.time()
    cached = _ihui_relay_base_cache.get("base")
    if cached and now < _ihui_relay_base_cache.get("expires_at", 0):
        return cast(str, cached)

    region = os.environ.get("IHUI_RELAY_REGION", "auto").lower().strip()
    if region == "cn":
        base = _IHUI_RELAY_BASES[0]
    elif region == "us":
        base = _IHUI_RELAY_BASES[1]
    else:
        # auto: TCP 竞速两个端点
        latencies = [(url, _check_tcp_latency(url)) for url in _IHUI_RELAY_BASES]
        reachable = [(url, lat) for url, lat in latencies if lat < float("inf")]
        if reachable:
            base = min(reachable, key=lambda x: x[1])[0]
        else:
            base = _IHUI_RELAY_BASES[0]  # 全部不可达,默认国内

    _ihui_relay_base_cache["base"] = base
    _ihui_relay_base_cache["expires_at"] = now + _IHUI_RELAY_BASE_TTL
    logger.info("[llm_gateway] ihui_relay 自动检测 api_base=%s (region=%s)", base, region)
    return base

def _is_stream_timeout_guard(chunk: Any) -> bool:
    """识别极速API(x5m5x)上游流式降级的超时占位 chunk。

    特征(2026-09-18 实测):上游「流式+工具调用」模式整体降级时,约 45s 后仅回
    id="chatcmpl-timeout-guard" 的占位 chunk(delta.content 形如
    "[req_xxx] [model]\\n**Request exceeded ...**"),随后直接 [DONE];
    同参数非流式请求完全正常。命中后由 astream 自动回退非流式重试。
    """
    return getattr(chunk, "id", None) == "chatcmpl-timeout-guard"


# LLM 出站代理(2026-07-30 立):settings.llm_proxy_url 非空时写入 os.environ,
# litellm 底层 httpx 自动读取 HTTP_PROXY/HTTPS_PROXY,无需在每个调用处传 proxy 参数
# 国内服务器访问 OpenAI/Anthropic/OpenRouter 等境外 provider 时必须配置
_llm_proxy = settings.llm_proxy_url.strip()
if _llm_proxy:
    os.environ.setdefault("HTTP_PROXY", _llm_proxy)
    os.environ.setdefault("HTTPS_PROXY", _llm_proxy)
    os.environ.setdefault("http_proxy", _llm_proxy)
    os.environ.setdefault("https_proxy", _llm_proxy)
    logger.info("LLM 出站代理已启用: %s", _llm_proxy)
    # 全局共享 httpx.AsyncClient 需显式传入 proxy(环境变量对已创建的 client 无效)
    _PROXY_KWARGS: dict[str, Any] = {"proxy": _llm_proxy}
else:
    _PROXY_KWARGS = {}


# 全局共享 httpx.AsyncClient(连接池复用,避免每次请求新建 client)
# provider 通过 get_http_client() 获取,在 main.py lifespan shutdown 中 close_http_client()
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """获取全局共享 httpx.AsyncClient(懒初始化,连接池复用,自动应用 LLM 代理)。

    P3-1(2026-07-30):用 create_stealth_client() 替代普通 httpx.AsyncClient,
    全局 client 含 stealth 头(UA 伪装 + Accept 随机化),降低 WAF 拦截概率。
    厂商原生适配器(providers/*)通过本函数获取 client,自动继承 stealth 能力。
    """
    global _http_client
    if _http_client is None:
        # P3-1:用 stealth client 工厂(含 UA 伪装 + 默认浏览器头)
        # proxy 优先用全局 llm_proxy_url(LiteLLM 也读这个 env var)
        _http_client = create_stealth_client(
            timeout=60.0,
            proxy=_llm_proxy or None,
        )
    return _http_client


async def close_http_client() -> None:
    """关闭全局 httpx.AsyncClient(main.py shutdown 调用)。

    先置空引用再关闭(2026-09-18 顺序相关 flake 根治):跨事件循环场景下
    (测试每个用例新建 loop,前一用例在旧 loop 里创建的全局 client 归属已
    关闭的 loop)``aclose()`` 会抛 RuntimeError("Event loop is closed");
    旧实现先 await 再置空,异常会让引用残留,后续 get_http_client() 拿到
    坏 client(实测 test_native_fc_e2e_real → test_tls_stealth 顺序复现)。
    关闭失败只降级告警:client 本体随旧 loop 销毁,不影响下次重建。
    """
    global _http_client
    client, _http_client = _http_client, None
    if client is None:
        return
    try:
        await client.aclose()
        logger.info("global httpx.AsyncClient closed")
    except Exception as e:  # noqa: BLE001 - 关闭失败降级,不影响调用方
        logger.warning("httpx.AsyncClient 关闭异常(跨 loop 场景可忽略): %s", e)


# 修复(2026-07-28):复用 app.core.db_pool 共享 pool,避免 14 个独立 pool 打满 max_connections。
# 保留 _get_pool 函数签名(向后兼容),内部委托给 get_shared_pool()。
async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(复用 app.core.db_pool 共享 pool)。"""
    return await get_shared_pool()


# P0-5c(2026-07-30):中转站 Key 池选择器(查 ai_relay_key_pool 表,多 key 负载均衡 + 故障转移)
# 模块级导入安全:key_pool_selector.py 内部对 llm_gateway 符号用懒导入,无循环依赖
from ..services.key_pool_selector import KeyPoolSelector


def _decrypt_api_key(api_key_enc: str | None) -> str | None:
    """解密 ai_model_config.api_key_enc。

    格式:JSON {"iv","ciphertext","tag"} base64,AES-256-GCM(与 apps/api/utils/crypto.ts 对应)。
    向后兼容:非加密 payload 格式视为明文。
    """
    if not api_key_enc:
        return None
    try:
        payload = json.loads(api_key_enc)
        if not (isinstance(payload, dict) and all(k in payload for k in ("iv", "ciphertext", "tag"))):
            # JSON 解析成功但不是加密 dict(可能是 JSON 字符串带引号)→ 返回解析后的值
            if isinstance(payload, str):
                return payload.strip().strip('"').strip("'")
            return api_key_enc
    except (json.JSONDecodeError, TypeError):
        # 非 JSON 格式,视为明文(同时 strip 首尾引号/空白,防御 seed 脚本引号包裹)
        return api_key_enc.strip().strip('"').strip("'")

    key_str = settings.credentials_encryption_key
    if not key_str or len(key_str) < 32:
        logger.warning("credentials_encryption_key 未配置或长度不足 32,无法解密 api_key_enc")
        return None
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        key = key_str.encode("utf-8")[:32]
        iv = base64.b64decode(payload["iv"])
        ciphertext = base64.b64decode(payload["ciphertext"])
        tag = base64.b64decode(payload["tag"])
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
        decoded = plaintext.decode("utf-8")
        # P0-5m(2026-07-30):strip 首尾引号(防御 seed 脚本把 key 用 JSON.stringify 包裹导致引号残留)
        return decoded.strip().strip('"').strip("'")
    except Exception as e:
        logger.warning("解密 api_key_enc 失败: %s", e)
        return None


_PREFIX_TO_PROVIDER_CODE: dict[str, str] = {
    # 2026-07 扩展:覆盖 LiteLLM 支持的所有 LLM 厂商前缀
    # BYOK 平台模式(2026-07-30):用户自带 key 的私有配置统一用 byok/ 前缀,
    # _resolve_from_db 会按 owner_uuid 优先匹配用户私有 aiModelConfig。
    "byok/": "byok",
    "siliconflow-byok/": "siliconflow-byok",
    # 国内
    "stepfun/": "stepfun",
    "agnes/": "agnes",
    "t6688/": "token6688",
    "ihui/": "ihui_relay",
    "qwen": "qwen",
    "qwen-": "qwen",
    # 小米 MiMo 官方 /v1/models 返回裸名(mimo-v2.5 等,无 vendor 前缀)。缺这条则
    # _model_to_provider_code 落到默认 'openai',_resolve_from_db 查不到 ai_model_config
    # 里的 mimo 行 → 列表里能选中但一调用即 LiteLLM "LLM Provider NOT provided" 502。
    "mimo": "mimo",
    "mimo-": "mimo",
    # agnes 官方回裸名(agnes-2.0-flash / agnes-3.0-flash);缺这条则 `_resolve_from_db` 按
    # 'openai' 查不到行、`_resolve_provider` 落到 openai 默认位 → 选择器里看得见即 502。
    "agnes": "agnes",
    "agnes-": "agnes",
    "doubao-": "doubao",
    "hunyuan-": "hunyuan",
    "glm-": "zhipu",
    "volcengine-": "volcengine",
    "moonshot-": "moonshot",
    "kimi-": "moonshot",
    "deepseek-": "deepseek",
    "ernie-": "wenxin",
    "abab": "minimax",
    "minimax-": "minimax",
    "baichuan-": "baichuan",
    "spark-": "spark",
    "yi-": "yi",
    "internlm": "internlm",
    "sensenova-": "sensenova",
    "skywork-": "skywork",
    "jimeng-": "jimeng",
    "kling-": "kling",
    "luyala-": "luyala",
    # 免费无 key provider(2026-07-30 P0-5p 补充)
    "pollinations/": "pollinations",
    "llm7/": "llm7",
    "hf-qwen/": "hf_qwen",
    # 国际原厂
    "groq/": "groq",
    "gemini/": "gemini",
    "gemini-": "google",
    "openrouter/": "openrouter",
    "anthropic/": "anthropic",
    "claude-": "anthropic",
    "claude": "anthropic",
    "gpt-": "openai",
    "o1-": "openai",
    "o3-": "openai",
    "o4-": "openai",
    "openai/": "openai",
    # 云 / 聚合平台
    "ollama/": "ollama",
    "azure/": "azure",
    "bedrock/": "bedrock",
    "watsonx/": "ibm",
    "vertex/": "vertexai",
    "huggingface/": "huggingface",
    "replicate/": "replicate",
    "together-": "togetherai",
    "cerebras/": "cerebras",
    "sambanova/": "sambanova",
    "deepinfra/": "deepinfra",
    "friendli/": "friendli",
    "anyscale/": "anyscale",
    "infermatic/": "infermatic",
    "fireworks/": "fireworksai",
    "leptonai/": "leptonai",
    "featherless/": "featherless",
    "parasail/": "parasail",
    "openwebui/": "openwebui",
    "lmstudio/": "lmstudio",
    "llamacpp/": "llamacpp",
    # 第三方模型系列(走对应厂商)
    "command-": "cohere",
    "sonar-": "perplexity",
    "grok-": "xai",
    "mistral-": "mistral",
    "mistral/": "mistral",
    "codestral-": "mistral",
    "pixtral-": "mistral",
    "jamba-": "ai21",
    "stability-": "stability",
    "phi-": "microsoft",
    "nemotron-": "nvidia",
    "llama-": "meta",
    "gemma-": "gemma",
    "amazon-nova-": "aws",
    "inflection-": "inflection",
    "snowflake-": "snowflake",
    "stablelm-": "stability",
    "nous-": "nous",
    "ornith-": "ornith",
    "codebrain-": "codebrain",
    "mai-": "mai",
    # LiteLLM OpenAI 兼容聚合(免厂商专属 key)
    "novita/": "novita",
    "lambda/": "lambda",
    "baseten/": "baseten",
    "crusoe/": "crusoe",
    "targon/": "targon",
    "centml/": "centml",
    "nebius/": "nebius",
    "siliconcloud/": "siliconflow",
    "siliconflow/": "siliconflow",
    "modelscope/": "modelscope",
    "ppio/": "ppio",
    "bailian/": "bailian",
    "baai/": "baai",
    "tii/": "tii",
    "liquid/": "liquid",
    "ai2/": "ai2",
    "upstage/": "upstage",
    "hyperbolic/": "hyperbolic",
    # 2026-07-22 接入:免费 / 试用 credits provider(参考 cheahjs/free-llm-api-resources)
    "cloudflare/": "cloudflare_workers_ai",
    "@cf/": "cloudflare_workers_ai",
    "nvidia/": "nvidia_nim",
    "github/": "github_models",
    "vercel/": "vercel_ai_gateway",
    "opencode/": "opencode_zen",
    "modal/": "modal",
    "inferencenet/": "inferencenet",
    "nlpcloud/": "nlpcloud",
    "scaleway/": "scaleway",
    "alibaba-intl/": "alibaba_intl",
    # 2026-07-24 接入:14 个免费 LLM provider 内化
    # cerebras/ mistral/ mistral- codestral- pixtral- huggingface/ command- 已存在,不重复加
    "cohere/": "cohere",  # 补充 cohere/ 前缀(现有只有 command- 前缀)
    "zai/": "zai",
    "kilo/": "kilo",
    "ovh/": "ovh",
    "aihorde/": "aihorde",
    "reka/": "reka",
    "routeway/": "routeway",
    "bazaarlink/": "bazaarlink",
    "ainative/": "ainative",
}


def _llm_responses_headers_enabled_from_env() -> bool:
    """Responses 模型级 header 注入开关(批58 接线,对标 codex responses_headers.rs)。

    默认 off:请求头与接线前逐字节一致;设为 on/1/true/yes 时于 call_kwargs 装配末尾
    经 build_responses_headers 追加 beta 特性头 / turn-state sticky 头。
    """
    return os.environ.get("LLM_RESPONSES_HEADERS_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _llm_responses_assembly_enabled_from_env() -> bool:
    """Responses 请求装配开关(批58 接线,对标 codex responses_request_assembly.rs)。

    默认 off:不追加 stream_options(逐字节一致);设为 on/1/true/yes 时于流式
    装配处经 build_stream_options 追加推理摘要投递选项(三条件齐备才产出)。
    """
    return os.environ.get("LLM_RESPONSES_ASSEMBLY_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _llm_provider_config_enabled_from_env() -> bool:
    """provider 强类型配置归一开关(批58 接线)。

    默认 off:api_base 原样透传(逐字节一致);设为 on/1/true/yes 时经
    ProviderConfig 校验并去掉 api_base 末尾斜杠(避免拼接出 //v1 双斜杠)。
    """
    return os.environ.get("LLM_PROVIDER_CONFIG_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _apply_responses_headers(call_kwargs: dict[str, Any]) -> None:
    """批58:把 build_responses_headers 产出的头并入 call_kwargs['extra_headers']。

    与 apply_provider_headers 一样合并在调用方 kwargs 之后,避免被整体覆盖;
    任何异常均降级跳过,绝不改变既有头、绝不阻塞请求。
    """
    try:
        from app.core.responses_headers import build_responses_headers

        beta_raw = os.environ.get("LLM_CODEX_BETA_FEATURES", "")
        beta_features = [s.strip() for s in beta_raw.split(",") if s.strip()]
        turn_state = os.environ.get("LLM_CODEX_TURN_STATE", "").strip() or None
        extra = build_responses_headers(beta_features=beta_features, turn_state=turn_state)
        if not extra:
            return
        merged = dict(call_kwargs.get("extra_headers") or {})
        merged.update(extra)
        call_kwargs["extra_headers"] = merged
    except Exception as e:  # noqa: BLE001 - 头注入失败降级跳过
        logger.warning("responses_headers 注入失败(降级跳过): %s", e)


def _apply_responses_stream_options(call_kwargs: dict[str, Any]) -> None:
    """批58:流式装配处追加 build_stream_options 产出的流选项。

    仅在三个条件(并发推理摘要开关开启 + OpenAI 系 + 存在推理摘要)齐备时才产出
    非空值;未产出时不写键(逐字节等价)。异常降级跳过。
    """
    try:
        from app.core.responses_request_assembly import build_stream_options

        model = str(call_kwargs.get("model") or "")
        is_openai = (not model.startswith("anthropic/")) and "gemini/" not in model
        opts = build_stream_options(
            concurrent_reasoning_summaries_enabled=os.environ.get(
                "LLM_CONCURRENT_REASONING_SUMMARIES", "false"
            ).strip().lower()
            in ("on", "1", "true", "yes"),
            is_openai=is_openai,
            reasoning_summary_present=bool(call_kwargs.get("reasoning_effort")),
        )
        if opts:
            call_kwargs["stream_options"] = opts
    except Exception as e:  # noqa: BLE001 - 流选项注入失败降级跳过
        logger.warning("responses stream_options 注入失败(降级跳过): %s", e)


def _normalize_provider_api_base(api_base: str | None) -> str | None:
    """批58:经 ProviderConfig 强类型校验归一门禁 api_base(去末尾斜杠)。

    off 由调用方保证不进入此函数;校验失败时返回原值(降级,绝不改坏地址)。
    """
    try:
        from app.core.provider_config import ProviderConfig

        cfg = ProviderConfig(api_base=api_base)
        return cfg.api_base
    except Exception as e:  # noqa: BLE001 - 校验失败降级返回原值
        logger.warning("provider_config 归一失败(降级返回原值): %s", e)
        return api_base


def _explicit_provider_code_of(model: str) -> str:
    """模型 ID 显式命中的 provider_code;未命中前缀表返回空串。

    额度标记是全局状态,不能把无法归因的模型兜底算到 openai 头上
    (那会误伤一整家厂商的可用性判定),故与 _model_to_provider_code 的默认值区分。
    """
    m = model.lower()
    for prefix, code in _PREFIX_TO_PROVIDER_CODE.items():
        if m.startswith(prefix):
            return code
    return ""


def _model_to_provider_code(model: str) -> str:
    return _explicit_provider_code_of(model) or "openai"


# ============================================================================
# 厂商归属:DB 实证优先于名字前缀(2026-09-22 批次 60 立)
# ============================================================================
# _PREFIX_TO_PROVIDER_CODE 是"看模型名长什么样猜厂商",对不带 vendor 路径的裸名必然出错:
# mimo-v2.5-free 在库里只挂在 provider_code='opencode_zen'(base https://opencode.ai/zen/v1)
# 名下,按裸前缀判成 mimo 后打到小米公网端点 → 上游回 "Unsupported model mimo-v2.5-free"。
# 故归属判定固定三级:显式厂商路径 > ai_model_config 实证 > 名字前缀兜底。
# 前缀层原样保留:这是全链路热路径,DB 不可用/查不到时必须逐字节退回改动前的行为。

_PROVIDER_OWNERSHIP_TTL = 300  # 与 _IHUI_RELAY_BASE_TTL 同档(模型同步 6h 一轮,5 分钟够跟上新行)
_PROVIDER_OWNERSHIP_MAX = 512  # 键是调用方传入的模型串,给上限防爆;整表清,不做 LRU
_provider_ownership_cache: dict[str, tuple[str, float]] = {}


def _declared_provider_code_of(model: str) -> str:
    """模型 ID 里用户**显式写出**的厂商(只认 `vendor/` 这类含斜杠的路径前缀)。

    裸名规则("qwen" / "mimo-" / "glm-")是"按名字猜",不构成用户点名,
    所以只有含斜杠前缀才享有"压倒 DB 实证"的优先级
    (openrouter/… 不能被 DB 猜成别的厂商,ihui/… 同理)。
    """
    m = (model or "").lower()
    for prefix, code in _PREFIX_TO_PROVIDER_CODE.items():
        if "/" in prefix and m.startswith(prefix):
            return code
    return ""


def _provider_looks_unavailable(provider_code: str) -> bool:
    """该厂商此刻是否明显调不通(刚判欠费 / ping 判 DOWN / 未配置)。

    只用于**同序裁决**(多行命中时挑哪个归属),不是过滤条件:
    全都不可用时仍返回排序第一的 provider —— 归属是"这一行属于谁"的事实,
    不该随 ping 结果漂移,否则同一次故障里归因会来回变。
    """
    from ..services.model_availability import ProviderHealthStatus, model_availability

    if model_availability.is_provider_quota_blocked(provider_code):
        return True
    return model_availability.get_provider_health(provider_code).status in (
        ProviderHealthStatus.DOWN,
        ProviderHealthStatus.NOT_CONFIGURED,
    )


async def _query_provider_ownership(model: str) -> str:
    """一次带 JOIN 的查询:这个 model_id 实际存在于哪个已启用的全局配置行。

    表与条件与 _find_quota_alternate_channels 完全一致(ai_model_config_models ⋈
    ai_model_config,enabled + owner_uuid IS NULL)。不使用 m.is_relay_public:
    那一列是"进不进模型选择器"的展示开关,不是"这一行是否存在"的归属事实。
    """
    bare = model.split("/", 1)[-1] if "/" in model else model
    # 查询键保留原始大小写(DB 里存的就是厂商返回的原始 model_id,如 Qwen/Qwen3-Max)
    keys = [model] if bare == model else [model, bare]
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT c.provider_code, m.model_id
                   FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE m.enabled = true AND c.enabled = true AND c.owner_uuid IS NULL
                     AND m.model_id = ANY($1::text[])
                   ORDER BY c.sort_order NULLS LAST, m.relay_sort_order
                   LIMIT 40""",
                keys,
            )
    except Exception as e:
        logger.warning("[provider-ownership] 查询失败(model=%s),退回名字前缀判定: %s", model, e)
        return ""

    # 排序键:① 整串精确匹配优先于"去厂商路径后的末段匹配"(用户给的就是整串时不该被别家抢走)
    #       ② 可用性(欠费/DOWN 的厂商排后面,同一 model_id 常同时挂在多家名下)
    #       ③ SQL 已给的 (c.sort_order, m.relay_sort_order) —— 与 /llm/models 同序
    ranked: list[tuple[int, int, int, str]] = []
    lowered = model.lower()
    for idx, row in enumerate(rows):
        code = str(row["provider_code"] or "")
        if not code:
            continue
        exact = 0 if str(row["model_id"] or "").lower() == lowered else 1
        ranked.append((exact, 1 if _provider_looks_unavailable(code) else 0, idx, code))
    return min(ranked)[3] if ranked else ""


def _cache_provider_ownership(model: str, code: str, now: float) -> None:
    """写归属缓存(未命中也写空串,避免热路径反复打 DB)。"""
    if len(_provider_ownership_cache) >= _PROVIDER_OWNERSHIP_MAX:
        _provider_ownership_cache.clear()
    _provider_ownership_cache[model] = (code, now + _PROVIDER_OWNERSHIP_TTL)


async def _db_provider_code_for_model(model: str) -> str:
    """带进程内 TTL 缓存的归属查询(缓存键小写:同一 ID 的大小写变体不各查一次)。"""
    raw = (model or "").strip()
    if not raw:
        return ""
    key = raw.lower()
    cached = _provider_ownership_cache.get(key)
    now = time.time()
    if cached and cached[1] > now:
        return cached[0]
    code = await _query_provider_ownership(raw)
    _cache_provider_ownership(key, code, now)
    return code


async def _resolve_provider_code(model: str) -> str:
    """权威归属:显式厂商路径 > DB 实证 > 名字前缀;返回 "" 表示无法归因。

    与 _explicit_provider_code_of 同语义(不兜底成 openai),供额度归因使用;
    需要 openai 兜底的调用方自行 `or "openai"`(见 _resolve_from_db)。
    """
    return (
        _declared_provider_code_of(model)
        or await _db_provider_code_for_model(model)
        or _explicit_provider_code_of(model)
    )


# ============================================================================
# 账号额度耗尽 → 跨厂商换通道(2026-09-22 批次 59 立)
# ============================================================================
# 判据在 ..middleware.llm_metrics.is_quota_exhaustion_error(状态码 + 额度错误码双条件)。
# 降级本身走既有 FallbackRouter.complete_with_fallback(唯一一条换通道链路),这里只
# 为额度这一类补一份"同一模型在其他厂商的可用通道"候选来源。

# 兜底路径不宜无界放大请求数(每次尝试都是真实上游调用)
_MAX_QUOTA_FAILOVER_CHANNELS = 5


def _provider_prefix_for_code(provider_code: str) -> str | None:
    """provider_code → 模型 ID 前缀(反查 _PREFIX_TO_PROVIDER_CODE + 正查回环校验)。

    只接受带 '/' 的路径前缀("qwen" 这类裸模型名规则不能当前缀用),且拼出的 ID 必须
    能被 _model_to_provider_code 反解回同一 provider,否则丢弃该候选。
    """
    for prefix, code in _PREFIX_TO_PROVIDER_CODE.items():
        if code != provider_code or not prefix.endswith("/"):
            continue
        if _model_to_provider_code(f"{prefix}x") == provider_code:
            return prefix
    return None


async def _find_quota_alternate_channels(
    model_id: str,
    exclude_providers: set[str],
) -> list[str]:
    """同一模型在其他厂商的可用通道(额度耗尽时改道用)。

    数据源与 /llm/models 同表(ai_model_config_models JOIN ai_model_config),因此
    "不充值也能调到 qwen 系"的既有替代通道(openrouter / token6688 / siliconflow …)
    无需任何新配置即可被复用。DB 不可用时返回空列表 —— 行为等同于未启用该特性。
    """
    bare_model = model_id.split("/", 1)[-1] if "/" in model_id else model_id
    if not bare_model:
        return []
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT c.provider_code, m.model_id
                   FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE m.enabled = true AND c.enabled = true AND c.owner_uuid IS NULL
                     AND (m.model_id = $1 OR m.model_id LIKE '%/' || $1)
                   ORDER BY c.sort_order NULLS LAST, m.id
                   LIMIT 40""",
                bare_model,
            )
    except Exception as e:
        logger.warning("[quota-failover] 查询替代通道失败(model=%s): %s", model_id, e)
        return []

    # 延迟导入避免循环(llm_gateway ↔ model_availability),与 _resolve_auto_model 同源
    from ..services.model_availability import model_availability

    channels: list[str] = []
    seen: set[str] = {model_id}
    for row in rows:
        provider_code = str(row["provider_code"] or "")
        if not provider_code or provider_code in exclude_providers:
            continue
        if model_availability.is_provider_quota_blocked(provider_code):
            continue
        prefix = _provider_prefix_for_code(provider_code)
        if not prefix:
            continue
        candidate = f"{prefix}{str(row['model_id'])}"
        if candidate in seen or any(candidate.startswith(p) for p in _LOCAL_PREFIXES):
            continue
        seen.add(candidate)
        channels.append(candidate)
        if len(channels) >= _MAX_QUOTA_FAILOVER_CHANNELS:
            break
    return channels


# ============================================================================
# 额度耗尽 → 同族等效模型降级(2026-09-22 批次 60 立)
# ============================================================================
# 批次 59 只换"同名其他厂商",qwen-plus 在别家没有同名通道时用户仍只能看到一个报错。
# 这里补第二档:同名通道全部用尽后,挑同族(family 词干相同)且当前可用的替代模型。
# 硬性约束是"不许静默替换" —— 换道结果必须经既有 fallback 事件 / model 字段回给调用方。

_MAX_QUOTA_EQUIVALENT_CHANNELS = 3
_MIN_FAMILY_STEM_LEN = 3  # 'yi' 这类短词干 LIKE 会命中一大片,宁可不换

# 额度耗尽的稳定错误码(命名对齐既有 MODEL_NOT_CONFIGURED / BUDGET_EXHAUSTED 先例;
# apps/api/src/routes/ai-chat-stream.ts 把上游 {errorCode,message} 原样透传,前端按码精准提示)
PROVIDER_QUOTA_EXHAUSTED = "PROVIDER_QUOTA_EXHAUSTED"
# fallback 事件 reason 的取值:同名换厂商仍是 'quota',换到不同模型才加 '_equivalent' 后缀
FALLBACK_REASON_QUOTA_EQUIVALENT = "quota_equivalent"

_TIER_RANK: dict[str, int] = {"latest": 0, "standard": 1, "legacy": 2}
# 家族词干:模型名开头那段连续字母(model_catalog 的 family 里 'qwen' / 'mimo' / 'deepseek')
_RE_FAMILY_STEM = re.compile(r"^[a-z]+")


def _generation_rank(origin: str | None, candidate: str | None) -> int:
    """代次接近度:0=同大版本,1=任一侧无版本信息(不可比,不奖励也不惩罚),2=不同大版本。

    只比大版本:qwen3-max 的替代取 qwen3.5-flash 仍然同代,而掉到 qwen-plus
    是跨代降级(能力差距明显),放后面。
    """
    if not origin or not candidate:
        return 1
    return 0 if origin.split(".", 1)[0] == candidate.split(".", 1)[0] else 2


def _family_stem(model_name: str) -> str:
    """家族词干:取 model_catalog 判出的 family 开头那段字母。

    为什么不用 family 原值:qwen-plus 的 family 就是 'qwen-plus'(名字里没有版本号,
    family 退化成整名),拿它当家族判据只能匹配到同名模型,等效降级等于没做;
    取词干后 qwen-plus / qwen3-max / qwen3.5-397b-a17b 同归 'qwen' 家族。
    """
    from ..services.model_catalog import classify_model

    family = classify_model(model_name).family or ""
    m = _RE_FAMILY_STEM.match(family.lower())
    stem = m.group(0) if m else ""
    return stem if len(stem) >= _MIN_FAMILY_STEM_LEN else ""


async def _find_quota_equivalent_channels(
    model_id: str,
    exclude_providers: set[str],
) -> list[str]:
    """同族等效替代(同名通道全部用尽后再退一档)。

    筛选:同 family 词干 + 不是原模型本身 + 厂商未被判欠费 + model_availability
    判"当前可用"(未配 key / DOWN 的厂商直接排除)。

    排序即优先级:① 免费额度通道(zero_cost / free_tier)优先 —— 本分支的起因就是
    "账号没钱",换到另一家也要挑不额外烧钱的;② 代次接近度(同大版本 > 任一侧无版本
    信息 > 跨大版本) —— qwen3-max 的替代应当还是 qwen3.x,而不是掉到 qwen-plus;
    ③ 代次档位 latest > standard > legacy;④ 以上全同时保持 SQL 的
    (c.sort_order, m.relay_sort_order) —— 与 /llm/models 同序,结果可测。
    """
    bare = model_id.split("/", 1)[-1] if "/" in model_id else model_id
    stem = _family_stem(bare)
    if not stem:
        return []
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            # family 是 model_catalog 的算法概念,SQL 算不出来:用词干做粗筛(同一张表同一套
            # enabled/owner_uuid 条件),再由 _family_stem 逐行精确判定,误命中不会漏进结果。
            rows = await conn.fetch(
                """SELECT c.provider_code, m.model_id
                   FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE m.enabled = true AND c.enabled = true AND c.owner_uuid IS NULL
                     AND m.model_id ILIKE '%' || $1 || '%'
                   ORDER BY c.sort_order NULLS LAST, m.relay_sort_order
                   LIMIT 200""",
                stem,
            )
    except Exception as e:
        logger.warning("[quota-equivalent] 同族模型查询失败(model=%s): %s", model_id, e)
        return []

    from ..services.free_provider_registry import free_provider_registry
    from ..services.model_availability import model_availability
    from ..services.model_catalog import classify_model

    scored: list[tuple[int, int, int, int, str]] = []
    seen: set[str] = set()
    # 只用于诊断:命中 SQL 粗筛却被逐出的行数。没有它,"为什么没给我换到可用通道"
    # 在日志里完全看不出来(实测:进程刚起完、模型同步未跑完时全部候选会被可用性闸排除)。
    dropped_unavailable = 0
    origin_generation = classify_model(bare).generation
    for idx, row in enumerate(rows):
        provider_code = str(row["provider_code"] or "")
        db_model = str(row["model_id"] or "")
        if not provider_code or provider_code in exclude_providers:
            continue
        if model_availability.is_provider_quota_blocked(provider_code):
            continue
        cand_bare = db_model.rsplit("/", 1)[-1]
        if not cand_bare or cand_bare.lower() == bare.lower():
            continue  # 同名属于第一档(跨厂商同名通道),不在这里重复
        if _family_stem(cand_bare) != stem:
            continue
        prefix = _provider_prefix_for_code(provider_code)
        if not prefix:
            continue
        candidate = f"{prefix}{db_model}"
        if candidate.lower() in seen or any(candidate.startswith(p) for p in _LOCAL_PREFIXES):
            continue
        if not model_availability.is_model_available(candidate):
            dropped_unavailable += 1
            continue
        seen.add(candidate.lower())
        provider = free_provider_registry.get_by_code(provider_code)
        free_rank = 0 if provider is not None and (provider.zero_cost or provider.free_tier) else 1
        cls = classify_model(cand_bare)
        gen_rank = _generation_rank(origin_generation, cls.generation)
        scored.append((free_rank, gen_rank, _TIER_RANK.get(cls.tier.value, 2), idx, candidate))
    scored.sort()
    if not scored and rows:
        logger.info(
            "[quota-equivalent] %s 粗筛命中 %d 行同族候选,全部被逐出:"
            " 可用性闸未放行=%d,其他原因(未配 key/前缀不可路由/同名/家族词干不符)=%d",
            model_id,
            len(rows),
            dropped_unavailable,
            len(rows) - len(scored) - dropped_unavailable,
        )
    return [c for _, _, _, _, c in scored[:_MAX_QUOTA_EQUIVALENT_CHANNELS]]


# ============================================================================
# 跨厂商自动路由(2026-08-06 立,用户反馈"应该是自动切换所有可使用的模型")
# ============================================================================
# 触发条件:model == 'auto' 或 model 为空
# 策略:从 model_availability 拿全厂商可用模型清单,按 tier 优先级选择
#   - tier 3(0.12x 标准)→ tier 1(0.05x 经济)→ tier 10(0.40x 高级)→ tier 30(0.77x 旗舰)→ free
#   - 优先 zero_cost / LOCAL(免费),其次 cheap plan(stepfun/agnes),最后按需升级
#   - tool calling 场景:有 tools 参数时优先选支持 function calling 的模型
# 兜底:无可用模型时回退 settings.litellm_model
# ============================================================================

# 模型名关键词 → 推断该模型是否支持 function calling
_TOOL_CALLING_KEYWORDS = (
    "gpt-", "o1", "o3", "claude-3", "claude-3.5", "claude-3.7", "claude-sonnet-4",
    "gemini-1.5", "gemini-2", "qwen2", "qwen3", "deepseek", "glm-4", "kimi",
    "step-2", "step-3", "mistral", "llama-3.1", "llama-3.2", "llama-3.3",
    "command-r", "phi-3", "phi-4", "gemma-2",
)

# 模型名关键词 → 推断 tier(对齐 model-selector.tsx TIER_TO_DISPLAY 5 档)
_AUTO_TIER_HINTS: list[tuple[tuple[str, ...], int]] = [
    # (关键词, tier) 顺序敏感,优先匹配更具体
    (("opus", "gpt-5", "o1-preview", "o3", "thinking", "kimi-k3"), 30),
    (("sonnet", "gpt-4o", "gpt-4.1", "gpt-4-turbo", "claude-3-opus",
      "gemini-pro", "gemini-2.5-pro", "deepseek-r1", "qwen-max",
      "glm-4-plus", "glm-5", "claude-sonnet"), 10),
    (("deepseek", "qwen-plus", "glm-4", "command-r-plus", "llama-3.1-70b",
      "llama-3.3-70b", "mixtral-8x22b"), 3),
    (("flash", "lite", "mini", "nano", "haiku", "small",
      "gemma", "llama-3.1-8b", "llama-3.2-3b"), 1),
]

# zero_cost provider 前缀(免费模型,无 key 即可调用,且 ping 通过)
# 2026-08-06 修复:移除 LOCAL provider(ollama/lmstudio/llamacpp)——本地服务可用性
# model_availability 无法准确判定(is_model_available 对 LOCAL 直接返回 True,仅 UI 显示用),
# auto 路由选了会 MODEL_NOT_CONFIGURED。LOCAL 模型用户可手动选,auto 优先 zero_cost + 已配 key。
_AUTO_FREE_PREFIXES = (
    "@cf/", "pollinations/", "llm7/", "aihorde/", "opencode/",
)
# LOCAL provider 前缀(本地 LLM):is_model_available 直接返回 True,但本地服务未必在跑,
# auto 路由需排除,避免选了不可用模型(详见 _resolve_auto_model available 过滤)。
_LOCAL_PREFIXES = ("ollama/", "lmstudio/", "llamacpp/", "vllm/")

# 自动路由显式排除模型(2026-09-05 立):本部署 openai key 无余额(no credits)且
# agnes 聚合端点无 gpt-4o 通道,任何把任务升级到 gpt-4o 的尝试都会失败
# (Connection error / No available channel)。auto-route 直接选 stepfun 稳定模型即可,
# 避免无效升级 + 兜底重试浪费。仅影响 auto 路由候选;显式指定 gpt-4o 的请求仍走
# FallbackRouter(gpt-4o -> stepfun/step-3.7-flash 兜底)。
_AUTO_ROUTE_EXCLUDED = ("gpt-4o", "openai/gpt-4o")


def _infer_tier_from_model_id(model_id: str) -> int:
    """根据 model_id 关键词推断 tier(0=免费 / 1=经济 / 3=标准 / 10=高级 / 30=旗舰)。"""
    mid = (model_id or "").lower()
    for keywords, tier in _AUTO_TIER_HINTS:
        if any(k in mid for k in keywords):
            return tier
    return 3  # 默认标准档


def _supports_tool_calling(model_id: str) -> bool:
    """根据 model_id 关键词推断是否支持 function calling。"""
    mid = (model_id or "").lower()
    return any(k in mid for k in _TOOL_CALLING_KEYWORDS)


def _resolve_ihui_auto_model() -> str:
    """智汇 Auto-Model 服务端随机路由(成本可控版,2026-08-31 立)。

    极速套餐的 'Auto-Model'(1:1) 若透传,由极速服务端随机选模型,
    可能随机到 1:5~1:10 高成本模型,按标称 3x 积分计费会压缩利润。
    改为网关层拦截:从低档池(极速扣费 1:1~1:2,倍率<=6,Auto-Model 自身剔除)
    随机选具体模型,收入 3x vs 成本最高 1:2 档,利润恒为正。
    """
    from ..services.free_provider_registry import get_ihui_auto_pool

    # 延迟导入避免循环(llm_gateway ↔ model_availability),与 _resolve_auto_model 同源
    from ..services.model_availability import model_availability

    pool = [m for m in get_ihui_auto_pool() if model_availability.is_model_available(m)]
    if not pool:
        # 全部不可用时仍用池内定义,交由上游 provider 报错兜底
        pool = get_ihui_auto_pool()
    if not pool:
        return "ihui/MiniMax-M2.7"  # 理论不可达:池定义保证非空
    chosen = random.choice(pool)
    logger.info("ihui Auto-Model 服务端随机路由 -> %s", chosen)
    return chosen


# ============================================================================
# D16:成本感知智能路由接线(2026-09-25 立)
# ----------------------------------------------------------------------------
# `app/services/model_router.py` 早已具备 assess_complexity / route / route_live /
# from_catalog / budget_usd 五块能力,但生产链只调了 assess_complexity ⇒
# "选哪个模型"仍走静态优先级,成本感知与预算降级对用户不可达。以下三个入口把
# route_live()/from_catalog() 接进 `_resolve_auto_model` 的候选池收口处。
#
# 安全前提(不可放宽):路由器**只能在网关已经过滤过的候选池里重排**,不得引入
# 池外模型 —— from_catalog 在过滤后为空时会兜底回 DEFAULT_MODELS(gpt-4o 等本部署
# 明确不可用的模型,见 _AUTO_ROUTE_EXCLUDED 注释),所以决策结果必须回查池成员,
# 不在池内即维持既有顺序。路由层任何异常同样只维持既有结果:一次路由失败绝不
# 能变成一次用户请求失败。
# ============================================================================

def _model_router_wiring_enabled() -> bool:
    """成本感知路由接线开关(D16)。

    默认 on:实测本部署默认目录/凭据状态下,路由器给出的首选与接线前
    `candidates[0]`(运维预设 settings.litellm_model)**逐字相同**(由
    tests/test_model_router_wiring.py::test_real_catalog_path_consumed_and_safe 钉住),
    所以默认启用不构成行为回退;真正的差异只在目录带上真实价格后才会显现。
    设为 off/0/false/no 即逐字回到接线前的选择顺序(应急回退通道,无需改码)。
    """
    return os.environ.get("LLM_MODEL_ROUTER_WIRING_ENABLED", "true").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _auto_route_budget_usd_from_env() -> float | None:
    """本轮 auto 路由的花费上限(美元),来自 LLM_AUTO_ROUTE_BUDGET_USD。

    未设 / 非数 / 非正 ⇒ None(不施加预算降级,行为与未加该参数前一致)。
    """
    raw = os.environ.get("LLM_AUTO_ROUTE_BUDGET_USD", "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        logger.warning("[auto-route] LLM_AUTO_ROUTE_BUDGET_USD=%r 无法解析,忽略预算降级", raw)
        return None
    return value if value > 0 else None


def _apply_cost_aware_routing(
    candidates: list[str],
    models_by_id: dict[str, dict[str, Any]],
    prompt_text: str,
    *,
    has_tools: bool,
    budget_usd: float | None,
) -> list[str]:
    """用 ModelRouter 对**已有候选池**做成本感知重排,返回新的候选顺序。

    - 入参 `candidates` 即接线前网关已经过可用性/LOCAL/预设过滤的有序候选;
      本函数只会重排它,绝不新增、绝不删除 ⇒ 决策不可能指向池外(不可调用)的模型。
    - `budget_usd` 给出时走 `route(budget_usd=...)`(预算降级会把选择往下截,
      并在全部超预算时落到最便宜档 + `budget_exceeded=True`,据实 warn);
      未给出时走语义化的实时入口 `route_live()`。
    - 开关关闭 / 候选不足 2 / 目录取不到 / 决策模型不在池内 / 任何异常
      ⇒ 原样返回入参列表(降级不阻塞)。
    """
    original = list(candidates)
    if len(original) < 2 or not _model_router_wiring_enabled():
        return original
    try:
        from ..services.model_router import ModelRouter

        pool = [models_by_id[mid] for mid in original if mid in models_by_id]
        if len(pool) < 2:
            return original
        token_count = max(0, len(prompt_text) // 4)
        router = ModelRouter.from_catalog(models=pool)
        kwargs: dict[str, Any] = {
            "prompt": prompt_text[:20000],  # 截断避免超大 prompt 评估开销(与 assess_complexity 同口径)
            "token_count": token_count,
            "has_tools": has_tools,
            "has_code": "```" in prompt_text,
        }
        if budget_usd is None:
            decision = router.route_live(**kwargs)
        else:
            decision = router.route(**kwargs, budget_usd=budget_usd)
        picked = decision.selected_model
        if picked not in set(original):
            # from_catalog 兜底会带回 DEFAULT_MODELS(本部署不可用),这里必须挡住
            logger.info(
                "[auto-route] 成本感知路由决策 %r 不在可用候选池内,维持既有顺序", picked
            )
            return original
        if decision.budget_exceeded:
            logger.warning(
                "[auto-route] 预算 $%g 已超且无更省可选,落到最便宜档 %r (est_cost=$%.6f)",
                budget_usd or 0.0, picked, decision.estimated_cost,
            )
        else:
            logger.info(
                "[auto-route] 成本感知路由 %r -> %r (complexity=%s, est_cost=$%.6f, "
                "budget=%s, reason=%s)",
                original[0], picked, decision.complexity.value, decision.estimated_cost,
                f"${budget_usd:g}" if budget_usd is not None else "none", decision.reason,
            )
        if picked == original[0]:
            return original
        return [picked] + [c for c in original if c != picked]
    except Exception as e:  # noqa: BLE001 - 路由失败绝不允许打穿到用户请求
        logger.warning("[auto-route] 成本感知路由失败,维持既有顺序(降级): %s", e)
        return original


async def _resolve_auto_model(
    has_tools: bool = False,
    messages: list[dict[str, Any]] | None = None,
    budget_usd: float | None = None,
) -> str:
    """跨厂商自动路由:从 model_availability 全量可用模型中选最优。

    选择策略(2026-08-06 立):
    1. 调用 model_availability.get_available_models() 拿全量可用模型(已过滤 DOWN provider)
    2. 优先 zero_cost / LOCAL(完全免费)
    3. 按 tier 选最小可用档(0/1 → 3 → 10 → 30,逐步升级,避免一开始就烧高级模型)
    4. tool calling 场景(has_tools=True):在前 3 名候选中筛掉不支持 function calling 的
    5. D16(2026-09-25):对上面收口出的候选池再做一次**成本感知重排**
       (model_router.route_live()/route(budget_usd=)),只重排不扩池
    6. 全部失败:回退 settings.litellm_model(由运维预设,通常是稳定的 plan 套餐模型)

    `budget_usd` 缺省时取环境变量 LLM_AUTO_ROUTE_BUDGET_USD(未设即不施预算)。

    行为日志:返回前 logger.info 记录「auto → X」便于审计,生产环境可观测路由决策。
    """
    fallback = settings.litellm_model or "stepfun/step-3.7-flash"
    try:
        # 延迟导入避免循环(llm_gateway ↔ model_availability)
        from ..services.model_availability import model_availability
        from .provider_caps import get_provider_cap

        # 加载 default_models.json(保留完整条目:D16 起 model_router 需要
        # context_length / input_price / caps 等元数据做成本感知打分)
        default_file = Path(__file__).resolve().parent.parent / "data" / "default_models.json"
        all_models: list[dict[str, Any]] = []
        if default_file.exists():
            try:
                raw = json.loads(default_file.read_text(encoding="utf-8"))
                for m in raw.get("models", []):
                    if isinstance(m, dict) and m.get("id"):
                        all_models.append(m)
            except Exception as e:
                logger.warning("[auto-route] 读取 default_models.json 失败: %s", e)
        models_by_id: dict[str, dict[str, Any]] = {
            str(m["id"]): m for m in all_models if m.get("id")
        }

        # 过滤:只保留 model_availability 判定为可用的,且排除 LOCAL provider
        # (ollama/lmstudio/llamacpp/vllm):is_model_available 对 LOCAL 直接返回 True(UI 显示用),
        # 但本地服务未必在跑,auto 选了会 MODEL_NOT_CONFIGURED。LOCAL 模型用户可手动选。
        available = [
            m
            for m in all_models
            if model_availability.is_model_available(m["id"])
            and not any(m["id"].startswith(p) for p in _LOCAL_PREFIXES)
            # ihui/Auto-Model 是极速服务端自动随机模型:全局 auto 路由需选具体模型,
            # 避免双重随机(系统 auto → ihui auto → 极速随机)导致路由行为不可预测
            and m["id"].lower() != "ihui/auto-model"
        ]
        if not available:
            logger.info("[auto-route] 无可用模型,降级到 settings.litellm_model=%r", fallback)
            return fallback

        # 分桶:free / cheap plan / premium
        free_pool: list[str] = []
        cheap_pool: list[dict[str, Any]] = []  # tier 1-3
        premium_pool: list[dict[str, Any]] = []  # tier 10-30
        for m in available:
            mid = m["id"]
            # 显式排除本部署不可用的 gpt-4o(openai 无额度 + agnes 无通道)
            if mid in _AUTO_ROUTE_EXCLUDED:
                continue
            if any(mid.startswith(p) or mid.startswith(p.rstrip("/"))
                   for p in _AUTO_FREE_PREFIXES):
                free_pool.append(mid)
                continue
            tier = _infer_tier_from_model_id(mid)
            if tier >= 10:
                premium_pool.append({"id": mid, "tier": tier})
            else:
                cheap_pool.append({"id": mid, "tier": tier})

        # 默认优先使用运维预设的可靠模型(settings.litellm_model),避免 auto 路由误选
        # 不可达 / 未配置 key 的社区免费 provider(opencode_zen/llm7/pollinations/aihorde/@cf 等,
        # 本部署均不在 LLM_PROVIDERS 配置,选中即 MODEL_NOT_CONFIGURED)。免费模型仍可在 UI 手动选择。
        # 优先级:运维预设默认 > free > cheap tier 1 > cheap tier 3 > premium
        candidates: list[str] = []
        if settings.litellm_model:
            candidates.append(settings.litellm_model)
        candidates.extend(free_pool)
        candidates.extend(x["id"] for x in sorted(cheap_pool, key=lambda x: x["tier"])[:5])
        # 高级模型保留 1 个作为最后兜底(用于前面 cheap/free 全部失败的极端场景)
        if premium_pool:
            candidates.append(min(premium_pool, key=lambda x: x["tier"])["id"])

        # L5-6(2026-08-12):任务复杂度感知路由——复杂/专家任务跳过免费与廉价模型,
        # 直接给高级模型(能力匹配),简单任务维持免费优先(成本优先)。
        # 评估失败/无高级模型时静默维持原候选(降级不阻塞)。
        prompt_text = ""
        if messages:
            for m in messages:
                if isinstance(m, dict) and isinstance(m.get("content"), str):
                    prompt_text += m["content"] + "\n"
        try:
            from ..services.model_router import TaskComplexity, model_router

            complexity = model_router.assess_complexity(
                prompt=prompt_text[:20000],  # 截断避免超大 prompt 评估开销
                token_count=max(0, len(prompt_text) // 4),
                has_tools=has_tools,
            )
            if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT):
                if premium_pool:
                    candidates = [min(premium_pool, key=lambda x: x["tier"])["id"]]
                    logger.info(
                        "[auto-route] 任务复杂度=%s,路由升级到高级模型 %s",
                        complexity.value, candidates[0],
                    )
        except Exception as e:
            logger.debug("[auto-route] 复杂度评估失败,维持原路由(降级): %s", e)

        # tool calling 场景:筛掉不支持 function calling 的模型
        if has_tools and candidates:
            len(candidates)
            tool_candidates: list[str] = []
            for c in candidates:
                # 先用关键词启发(快路径),再调 provider_caps 二次确认(权威)
                if not _supports_tool_calling(c):
                    continue
                # 从 model id 推断 provider_code,查 cap
                provider_code = _model_to_provider_code(c)
                cap = get_provider_cap(provider_code)
                if cap.supports_tools:
                    tool_candidates.append(c)
            if tool_candidates:
                candidates = tool_candidates
            else:
                # 全部被过滤:放宽,不强制 function calling
                logger.warning(
                    "[auto-route] tool calling 场景下无可用模型,放宽 function calling 限制"
                )
                candidates = free_pool + [c["id"] for c in cheap_pool[:3]]
                if not candidates:
                    return fallback

        # D16(2026-09-25):成本感知智能路由 —— 对上一步收口出的候选池做重排
        # (model_router.route_live()/route(budget_usd=))。只重排不扩池,
        # 失败/决策模型不在池内一律维持既有顺序,绝不让一次路由失败变成请求失败。
        if budget_usd is None:
            budget_usd = _auto_route_budget_usd_from_env()
        candidates = _apply_cost_aware_routing(
            candidates,
            models_by_id,
            prompt_text,
            has_tools=has_tools,
            budget_usd=budget_usd,
        )

        chosen = candidates[0] if candidates else fallback
        logger.info(
            "[auto-route] auto → %r (candidates=%d, free=%d, cheap=%d, premium=%d, has_tools=%s)",
            chosen, len(candidates), len(free_pool), len(cheap_pool),
            len(premium_pool), has_tools,
        )
        return chosen
    except Exception as e:
        logger.warning("[auto-route] 自动路由失败,降级到 fallback=%r: %s", fallback, e)
        return fallback


# 免费/试用 credits provider 的 endpoint 解析表(2026-08-01 立,P0 Phase A H2)。
# 替代旧硬编码 nvidia/cloudflare 前缀条件判断,新增 provider 只需加 entry。
# prefix → (provider_code, default_api_base, require_full_api_base, strip_prefix)
# - require_full_api_base=True:api_base 必须配置完整 URL(如 Cloudflare 含 account_id)
# - strip_prefix=True:real_model 去掉前缀(cloudflare/x → x);False:保留原样(@cf/x → @cf/x)
_FREE_PROVIDER_ENDPOINT_RESOLVERS: dict[str, tuple[str, str | None, bool, bool]] = {
    "cloudflare/": ("cloudflare", None, True, True),
    "@cf/": ("cloudflare", None, True, False),
    "nvidia/": ("nvidia", "https://integrate.api.nvidia.com/v1", False, True),
    "github/": ("github", "https://models.inference.ai.azure.com", False, True),
    "vercel/": ("vercel", "https://ai-gateway.vercel.sh/v1", False, True),
    "opencode/": ("opencode", "https://opencode.ai/zen/v1", False, True),
    "modal/": ("modal", "https://modal.com/v1", False, True),
    "inferencenet/": ("inference_net", "https://api.inference.net/v1", False, True),
    "nlpcloud/": ("nlp_cloud", "https://api.nlpcloud.io/v1", False, True),
    "scaleway/": ("scaleway", "https://api.scaleway.ai/ai-platform/v1", False, True),
    "alibaba-intl/": ("alibaba_intl", "https://bailian-intl.alibabacloud.com/compatible-mode/v1", False, True),
    # 2026-09-18:HF Victor 免费公共端点(Qwen3.8-Flash-Next),免 key("none"),端点生命周期短(可能 paused)
    "hf-qwen/": ("hf_qwen", "https://pnywsahxhac1qjbo.us-east-2.aws.endpoints.huggingface.cloud/v1", False, True),
}


async def _resolve_from_db(
    model: str,
    owner_uuid: str | None = None,
) -> tuple[str | None, str | None, str | None] | None:
    """从 ai_model_config 表查询配置,返回 (api_key, api_base, litellm_model) 或 None。

    优先 owner_uuid 匹配的用户私有配置,兜底 owner_uuid IS NULL 的全局配置。
    """
    provider_code = await _resolve_provider_code(model) or "openai"
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            if owner_uuid:
                row = await conn.fetchrow(
                    """SELECT api_key_enc, base_url, api_format
                       FROM ai_model_config
                       WHERE enabled = true AND provider_code = $1
                         AND (owner_uuid IS NULL OR owner_uuid = $2)
                       ORDER BY owner_uuid DESC NULLS LAST, sort_order ASC, id ASC
                       LIMIT 1""",
                    provider_code,
                    owner_uuid,
                )
            else:
                row = await conn.fetchrow(
                    """SELECT api_key_enc, base_url, api_format
                       FROM ai_model_config
                       WHERE enabled = true AND provider_code = $1 AND owner_uuid IS NULL
                       ORDER BY sort_order ASC, id ASC
                       LIMIT 1""",
                    provider_code,
                )
        if not row:
            return None
        api_key = _decrypt_api_key(row["api_key_enc"])
        if not api_key:
            return None
        # H7(Phase D):占位符 key 不覆盖 .env
        # 解密后的 api_key 若为占位符(以 '<' 开头如 <your-key> / 以 'sk-placeholder' 开头 / 空),
        # 视为未配置,返回 None 降级到 .env 真实配置。双保险:SQL migration 已把占位符记录
        # enabled=false,这里再加运行时检测防止管理员手动 enabled=true 但 key 仍是占位符。
        if api_key.startswith("<") or api_key.startswith("sk-placeholder"):
            logger.info(
                "H7: provider=%s 的 api_key 为占位符(%s...),降级到 .env 配置",
                provider_code, api_key[:16],
            )
            return None
        base_url = row["base_url"] or None
        api_format = row["api_format"] or "openai_chat"
        real_model = model.split("/", 1)[1] if "/" in model else model
        if api_format == "anthropic_messages":
            litellm_model = model if "/" in model else f"anthropic/{model}"
        elif provider_code == "openrouter":
            # P0-5m(2026-07-30):OpenRouter 需要走 LiteLLM 原生 openrouter/ 路由,
            # 不能转成 openai/(否则 LiteLLM 走 OpenAI 路由不传 Auth header)。
            # 归属改由 DB 实证后,模型串可能只是 'qwen/qwen3-max'(库里存的路径形态),
            # 此时必须补上 openrouter/ 才能被 LiteLLM 认出来。
            litellm_model = model if model.lower().startswith("openrouter/") else f"openrouter/{model}"
        else:
            litellm_model = f"openai/{real_model}"
        return api_key, base_url, litellm_model
    except Exception as e:
        logger.warning("从 ai_model_config 查询失败(provider=%s): %s", provider_code, e)
        return None


def trim_messages(
    messages: list[dict[str, Any]],
    window: int | None = None,
) -> list[dict[str, Any]]:
    """Sliding window 修剪消息列表,防止长对话超出上下文窗口。

    规则:
    1. 始终保留 system 消息(可能有多条,顺序不变)
    2. 保留最后 N 轮 user/assistant 配对(一轮 = 1 user + 1 assistant)
    3. 若最后一条是 user/tool(等待回复的当前输入),始终保留

    Args:
        messages: 原始消息列表。
        window: 保留轮数,None 时用 settings.chat_history_window(默认 6)。

    Returns:
        修剪后的消息列表。
    """
    n = window if window is not None else settings.chat_history_window
    if n <= 0 or len(messages) <= 1:
        return list(messages)

    system_msgs: list[dict[str, Any]] = []
    turn_msgs: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role")
        if role == "system":
            system_msgs.append(m)
        else:
            turn_msgs.append(m)

    if not turn_msgs:
        return list(messages)

    # 保留最后 N*2 条 turn(user/assistant/tool),确保配对完整
    max_keep = n * 2
    last_msg_role = turn_msgs[-1].get("role")
    is_current_input = last_msg_role in ("user", "tool")

    if len(turn_msgs) <= max_keep + (1 if is_current_input else 0):
        trimmed_turns = turn_msgs
    else:
        if is_current_input:
            current = turn_msgs[-1]
            history = turn_msgs[-max_keep - 1 : -1]
            trimmed_turns = history + [current]
        else:
            trimmed_turns = turn_msgs[-max_keep:]

    return system_msgs + trimmed_turns


_VALID_ROLES = {"system", "user", "assistant"}


def _normalize_agent_tool_calls(tool_calls: Any) -> Any:
    """把 agent loop 自定义 tool_calls 形态 {id,name,args} 转成 OpenAI 原生形态。

    OpenAI 原生: [{id, type:"function", function:{name, arguments: JSON字符串}}]
    AgentLoopV2 自定义: [{id, name, args: dict}](消息累积与旧 checkpoint 的存储形态)

    已是 OpenAI 形态(含 "function" 键)或无法识别的项原样返回,交由下游处理。
    """
    if not isinstance(tool_calls, list):
        return tool_calls
    out: list[dict[str, Any]] = []
    for tc in tool_calls:
        if not isinstance(tc, dict):
            out.append(tc)
            continue
        if "function" in tc:
            out.append(tc)
            continue
        name = tc.get("name")
        if not isinstance(name, str) or not name:
            out.append(tc)
            continue
        args = tc.get("args")
        if isinstance(args, str):
            arguments = args
        elif args is not None:
            try:
                arguments = json.dumps(args, ensure_ascii=False)
            except (TypeError, ValueError):
                arguments = "{}"
        else:
            arguments = "{}"
        out.append({
            "id": tc.get("id", ""),
            "type": "function",
            "function": {"name": name, "arguments": arguments},
        })
    return out


def _is_agent_loop_messages(messages: list[dict[str, Any]]) -> bool:
    """判定是否 agent loop 内部消息流(tool role 或自定义 assistant.tool_calls)。

    tool role 只由 AgentLoopV2 累积产生(chat API 入口无 tool role);自定义
    {id,name,args} 形态的 assistant.tool_calls 也只出现在 AgentLoopV2 消息累积
    与旧 checkpoint。命中时 complete() 走 agent 专用修复路径(保留 tool role +
    归一化 tool_calls),否则走原 repair_messages(过滤 tool role,兼容 chat API)。
    """
    for m in messages:
        if not isinstance(m, dict):
            continue
        if m.get("role") == "tool":
            return True
        if m.get("role") == "assistant":
            tcs = m.get("tool_calls")
            if isinstance(tcs, list) and tcs:
                first = tcs[0]
                if isinstance(first, dict) and "function" not in first:
                    return True
    return False


def _repair_agent_loop_messages(
    messages: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """agent loop 消息流专用修复:保留 tool role 与消息次序,归一化 tool_calls 形态。

    与 repair_messages(面向 chat API)的关键差异:
    - 不按 _VALID_ROLES 过滤:tool role 必须保留,否则第 2 轮起工具结果到不了 LLM;
    - 不去重连续相同 role:并行工具结果是连续多条 tool 消息且各自带 tool_call_id,
      合并会打乱 tool_call_id ↔ assistant.tool_calls 的对应关系;
    - 不重排首尾:agent loop 自建消息序,user 开头 / tool 结尾均合法;
    - 空 content 只清 system/user(结构性垃圾),assistant 可能只带 tool_calls
      (content 为空但必须保留以维持 tool_call 配对),tool 消息全部保留。

    Returns:
        (repaired, repair_count) — repair_count≈修复/丢弃动作数。
    """
    cleaned: list[dict[str, Any]] = []
    for m in messages:
        if not isinstance(m, dict):
            continue  # 非 dict 结构性垃圾,丢弃(与 repair_messages 同策略)
        role = m.get("role")
        if role not in ("system", "user", "assistant", "tool"):
            continue
        if role in ("system", "user"):
            content = m.get("content")
            if not isinstance(content, str) or content.strip() == "":
                continue
        out = dict(m)
        if role == "assistant" and out.get("tool_calls"):
            out["tool_calls"] = _normalize_agent_tool_calls(out["tool_calls"])
        cleaned.append(out)
    return cleaned, len(messages) - len(cleaned)


def repair_messages(
    messages: list[dict[str, Any]], keep_trailing_user: bool = False
) -> tuple[list[dict[str, Any]], int, list[str]]:
    """修复 messages 数组结构异常(P38 跨端同步,与 @ihui/types/message-repair 同源)。

    防御性兜底:在 trim_messages 之前调用,处理来自 API 的 messages 数组结构异常,
    避免 LLM 400 错误。注意:本函数过滤 tool role(tool role 只在 agent_loop 内部用,
    不应出现在 API 入口)。

    修复规则:
      1. 过滤非法 role(只保留 system/user/assistant)
      2. 过滤空 content(空字符串/纯空白)
      3. 去重连续相同 role(合并 content,用 \\n\\n 连接)
      4. 确保首条是 system 或 user(丢弃开头的 assistant)
      5. 移除末尾无响应的 user 消息(前面有 assistant 响应时才移除,首轮 user 保留)
         ⚠️ LLM 请求链路必须传 keep_trailing_user=True:末尾 user 是"当前正在发送的
         输入"而非 interjection 残留,移除会导致模型只看到旧上下文、回复旧内容。

    Args:
        messages: 待修复的消息数组。
        keep_trailing_user: 保留末尾的 user 消息(跳过 Rule 5)。LLM 请求链路必须为 True。

    Returns:
        (repaired, removed, reasons) 三元组。
    """
    reasons: list[str] = []
    removed = 0

    # Rule 1+2:过滤非法 role + 空 content
    cleaned: list[dict[str, Any]] = []
    for m in messages:
        if not isinstance(m, dict):
            removed += 1
            continue
        role = m.get("role")
        if role not in _VALID_ROLES:
            reasons.append(f"移除非法 role: {role}")
            removed += 1
            continue
        content = m.get("content")
        if not isinstance(content, str) or content.strip() == "":
            reasons.append(f"移除空 content(role={role})")
            removed += 1
            continue
        cleaned.append(dict(m))

    # Rule 3:去重连续相同 role(合并 content)
    deduped: list[dict[str, Any]] = []
    for m in cleaned:
        if deduped and deduped[-1].get("role") == m.get("role"):
            reasons.append(f"合并连续 {m.get('role')} 消息")
            deduped[-1]["content"] = f"{deduped[-1].get('content', '')}\n\n{m.get('content', '')}"
        else:
            deduped.append(m)
    cleaned = deduped

    # Rule 4:确保首条是 system 或 user(丢弃开头的 assistant)
    while cleaned and cleaned[0].get("role") == "assistant":
        reasons.append("移除开头的 assistant 消息(无前置 user)")
        cleaned.pop(0)
        removed += 1

    # Rule 5:移除末尾无响应的 user 消息(前面有 assistant 响应时才移除,首轮 user 保留)
    # LLM 请求链路必须传 keep_trailing_user=True,否则当前输入会被误删
    if not keep_trailing_user and cleaned and cleaned[-1].get("role") == "user":
        has_assistant = any(m.get("role") == "assistant" for m in cleaned)
        if has_assistant:
            reasons.append("移除末尾无 assistant 响应的 user 消息(可能是 interjection 残留)")
            cleaned.pop()
            removed += 1

    return cleaned, removed, reasons


# ============================================================================
# P3-3 OpenRouter 403 代理 + failover 辅助函数(2026-07-30 立)
# ============================================================================


def _is_openrouter_403_error(model: str, error: Exception) -> bool:
    """检测是否为 OpenRouter 403 错误(可 failover 到 agnes)。

    OpenRouter 对国内 IP / 非浏览器 UA 常返回 403 Forbidden(Cloudflare WAF),
    本函数从错误类型 + 错误消息双维度判断是否为可 failover 的 403 错误。

    Args:
        model: 模型名(需以 openrouter/ 开头才考虑 failover)。
        error: LiteLLM 抛出的异常。

    Returns:
        True 表示是 OpenRouter 403 错误,可 failover 到 agnes。
    """
    if not model.lower().startswith("openrouter/"):
        return False
    err_msg = str(error).lower()
    # 错误消息特征:含 "403" / "forbidden" / "access denied"
    if "403" in err_msg or "forbidden" in err_msg or "access denied" in err_msg:
        return True
    # LiteLLM 异常类型特征:AuthenticationError / PermissionDeniedError
    err_type = type(error).__name__.lower()
    return bool("auth" in err_type or "forbidden" in err_type or "permission" in err_type)


def _failover_openrouter_to_agnes(model: str) -> str | None:
    """将 openrouter/<model> 转换为 agnes/<model>(用于 403 failover)。

    Args:
        model: 原始模型名(如 openrouter/llama-3.3-70b)。

    Returns:
        agnes/ 前缀的模型名(如 agnes/llama-3.3-70b),或 None(无法转换)。
    """
    if not model.lower().startswith("openrouter/"):
        return None
    real_model = model.split("/", 1)[1] if "/" in model else model
    return f"agnes/{real_model}"


# OpenRouter 专用代理锁(2026-08-01 P0 修复):
# 防止并发 OpenRouter 请求通过 os.environ 互相干扰 + 泄漏代理设置给非 OpenRouter 请求。
# asyncio.Lock 串行化 env var 的 set/restore,确保同一时刻只有一个 OpenRouter 请求持有代理。
_openrouter_proxy_lock = asyncio.Lock()


@asynccontextmanager
async def _openrouter_proxy_context(model: str) -> AsyncIteratorType[None]:
    """临时为 OpenRouter 请求设置专用代理(P3-3,2026-08-01 P0 并发修复)。

    LiteLLM 底层 httpx 读取 HTTPS_PROXY / HTTP_PROXY env var,
    本函数在 openrouter/ 前缀调用期间临时设置 settings.openrouter_proxy_url,
    调用结束后恢复原值。仅对 openrouter/ 前缀模型生效,其他模型直接 yield。

    并发安全:asyncio.Lock 串行化 env var 修改,防止并发 OpenRouter 请求互相覆盖
    saved_https/saved_http 导致代理永久泄漏给非 OpenRouter 请求。

    Args:
        model: 模型名(仅 openrouter/ 前缀触发代理设置)。

    Yields:
        None(上下文管理器无返回值)。
    """
    if not model.lower().startswith("openrouter/"):
        yield
        return
    proxy_url = settings.openrouter_proxy_url.strip()
    if not proxy_url:
        yield
        return
    # 串行化:同一时刻只有一个 OpenRouter 请求持有代理 env var
    async with _openrouter_proxy_lock:
        # 保存原值(可能为 None,即未设置)
        saved_https = os.environ.get("HTTPS_PROXY")
        saved_http = os.environ.get("HTTP_PROXY")
        try:
            os.environ["HTTPS_PROXY"] = proxy_url
            os.environ["HTTP_PROXY"] = proxy_url
            logger.debug("OpenRouter 专用代理已设置: %s", proxy_url)
            yield
        finally:
            # 恢复原值(原值可能为 None → pop 掉;原值非 None → 还原)
            if saved_https is not None:
                os.environ["HTTPS_PROXY"] = saved_https
            else:
                os.environ.pop("HTTPS_PROXY", None)
            if saved_http is not None:
                os.environ["HTTP_PROXY"] = saved_http
            else:
                os.environ.pop("HTTP_PROXY", None)


# ============================================================================
# stub 判定(第二层)厂商 env key 单一来源(2026-08-31 立)
# ============================================================================
# LLMGateway._is_stub_mode 的 os.environ 层与 tests/conftest.py 环境隔离共用此列表。
# 此前 conftest 维护一份副本,漏 CLOUDFLARE_API_TOKEN / NVIDIA_API_KEY /
# OPENCODE_ZEN_KEY / GITHUB_TOKEN 等免费 provider key → .env 含这些 key 时
# conftest 未清空 → stub 测试被误判非 stub(pre-flight 422)而批量失败。
# 新增厂商 key 只改这里,禁止在别处复制列表。
VENDOR_ENV_KEYS: list[str] = [
    # 国际原厂
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY",
    "OPENROUTER_API_KEY", "COHERE_API_KEY", "MISTRAL_API_KEY", "XAI_API_KEY",
    "PERPLEXITY_API_KEY", "DEEPSEEK_API_KEY", "TOGETHERAI_API_KEY",
    "HUGGINGFACE_API_KEY", "REPLICATE_API_KEY", "AI21_API_KEY",
    "FIREWORKS_API_KEY", "WATSONX_API_KEY", "UPSTAGE_API_KEY",
    # 国内厂商
    "DASHSCOPE_API_KEY",  # 阿里通义
    "ZHIPUAI_API_KEY",  # 智谱
    "MOONSHOT_API_KEY",
    "BAIDU_API_KEY",  # 文心
    "YI_API_KEY",  # 零一万物
    "MINIMAX_API_KEY",  # MiniMax
    "SPARK_API_KEY",  # 讯飞星火
    "BAICHUAN_API_KEY",
    "HUNYUAN_API_KEY",  # 腾讯混元
    "STEPFUN_API_KEY",
    "AGNES_API_KEY",
    "DOUBAO_API_KEY",  # 字节豆包(火山方舟)
    "ARK_API_KEY",  # 火山方舟(即梦 Seedream/Seedance 图像视频)
    "ARK_ACCESS_KEY", "ARK_SECRET_KEY",  # 火山引擎视觉服务 V4 签名
    "KLING_ACCESS_KEY", "KLING_SECRET_KEY",  # 快手可灵(JWT AK/SK)
    # 云 / 聚合平台
    "AZURE_OPENAI_API_KEY", "AZURE_API_KEY",
    "AWS_ACCESS_KEY_ID", "AWS_BEDROCK_API_KEY",
    "VERTEX_API_KEY", "VERTEX_AI_API_KEY",
    "OLLAMA_API_BASE",  # 本地 ollama 不需 key,有 base 即激活
    "ANTHROPIC_VERTEX_API_KEY",
    # OpenAI 兼容聚合
    "NOVITA_API_KEY", "LAMBDA_API_KEY", "BASETEN_API_KEY",
    "CEREBRAS_API_KEY", "SAMBANOVA_API_KEY", "DEEPINFRA_API_KEY",
    "FRIENDLI_API_KEY", "ANYSCALE_API_KEY", "LEPTONAI_API_KEY",
    "PPIO_API_KEY", "SILICONCLOUD_API_KEY", "MODELSCOPE_API_KEY",
    "NEBIUS_API_KEY", "FEATHERLESS_API_KEY", "PARASAIL_API_KEY",
    "OPENWEBUI_API_KEY", "LMSTUDIO_API_KEY", "LLAMACPP_API_BASE",
    # 2026-07-22 接入:免费 / 试用 credits provider(参考 cheahjs/free-llm-api-resources)
    "CLOUDFLARE_API_TOKEN",  # Workers AI(需配合 CLOUDFLARE_ACCOUNT_ID)
    "NVIDIA_API_KEY",  # NIM
    "GITHUB_TOKEN",  # GitHub Models
    "VERCEL_AI_GATEWAY_KEY",  # Vercel AI Gateway
    "OPENCODE_ZEN_KEY",  # OpenCode Zen
    "MODAL_API_KEY",  # Modal
    "INFERENCE_NET_API_KEY",  # Inference.net
    "NLP_CLOUD_API_KEY",  # NLP Cloud
    "SCALEWAY_API_KEY",  # Scaleway
    "ALIBABA_INTL_API_KEY",  # Alibaba Cloud International Model Studio
    # 2026-07-24 接入:14 个免费 LLM provider 内化
    # CEREBRAS_API_KEY / MISTRAL_API_KEY / COHERE_API_KEY / HUGGINGFACE_API_KEY 已在上方存在,不重复加
    "ZAI_API_KEY",  # Z.ai / 智谱 OpenAI 兼容
    "KILO_API_BASE",  # Kilo Gateway(keyless,有 base 即激活)
    "POLLINATIONS_API_BASE",  # Pollinations(keyless)
    "LLM7_API_KEY",  # LLM7(可选 key)
    "OVH_API_BASE",  # OVH AI Endpoints(keyless)
    "AIHORDE_API_KEY",  # AI Horde(默认匿名 key)
    "REKA_API_KEY",  # Reka(每月免费 credit)
    "ROUTEWAY_API_KEY",  # Routeway(:free 后缀模型免费)
    "BAZAARLINK_API_KEY",  # BazaarLink(auto:free 路由)
    "AINATIVE_API_KEY",  # AINative Studio(每月 ~10M tokens 免费)
    "IHUI_RELAY_API_KEY",  # 智汇AI 官方中转(国内/海外自动切换)
]


class LLMGateway:
    """LLM 调用网关,封装 LiteLLM 并提供 stub 降级。"""

    # 2026-08-01 P0 修复:移除 _current_key_pool_id 类属性(共享可变状态),
    # 改为 _resolve 直接返回 key_pool_id 作为元组第 4 个元素,消除并发脆弱性。

    @staticmethod
    def _is_stub_mode() -> bool:
        """未配置任何 .env API key 时为 stub 模式(仍可被 DB 配置覆盖)。

        2026-07 扩展:覆盖 LiteLLM 支持的所有厂商 .env key,任一存在即视为"已配置"。
        直接读 os.environ 而非 settings 字段,避免给 Pydantic Settings 加 30+ 字段。
        注意:key 已用任何厂商(国内/国际/云/聚合)即解除 stub,无需重启。
        """
        # 第一层:LLM_PROVIDERS JSON 配置(7 个核心 OpenAI 兼容厂商,任一有 api_key 即非 stub)
        # 阶段 3 主体(2026-07-26):扁平字段已删除,统一走 get_provider_config
        if any(
            settings.get_provider_config(name).api_key
            for name in ("openai", "anthropic", "groq", "gemini", "openrouter", "agnes", "stepfun")
        ):
            return False
        # P1 修复(2026-08-06): 遍历 LLM_PROVIDERS 全量 provider,任一配置了 api_key
        # 即非 stub —— 避免固定 7 名列表漏掉 cloudflare/nvidia/mistral 等已配置厂商,
        # 导致 .env 实际已配置 key 仍误判 stub 模式。
        if settings.llm_providers:
            try:
                all_providers = json.loads(settings.llm_providers)
                if isinstance(all_providers, dict) and any(
                    isinstance(cfg, dict)
                    and (cfg.get("api_key") or cfg.get("apiKey") or cfg.get("token"))
                    for cfg in all_providers.values()
                ):
                    return False
            except (json.JSONDecodeError, TypeError, ValueError):
                pass  # 解析失败走下一层 os.environ 判断
        # 第二层:os.environ 检查所有 LiteLLM 一等公民厂商 key
        # 用户在 .env 直接配 GROQ_API_KEY / XAI_API_KEY / DEEPSEEK_API_KEY 等也立即激活
        # 前缀列表对应 _PREFIX_TO_PROVIDER_CODE 全部 30+ 厂商
        # 第二层:vendor key 列表已提取为模块级 VENDOR_ENV_KEYS(conftest 单一来源引用)
        return not any(os.environ.get(k) for k in VENDOR_ENV_KEYS)

    @staticmethod
    def _resolve_provider(model: str) -> tuple[str | None, str | None, str | None]:
        """根据 model 前缀匹配 .env provider,返回 (api_key, api_base, litellm_model)。

        2026-07-25 改造:统一走 settings.get_provider_config(name),优先 LLM_PROVIDERS
        JSON 配置,降级旧扁平字段(向后兼容)。新增 provider 只需改 .env,零代码改动。

        前缀约定:
        - stepfun/*  → STEPFUN_API_KEY + STEPFUN_API_BASE(OpenAI 兼容)
        - agnes/*    → AGNES_API_KEY + AGNES_API_BASE(OpenAI 兼容)
        - groq/*     → GROQ_API_KEY(LiteLLM 原生)
        - gemini/*   → GEMINI_API_KEY(Google AI Studio OpenAI 兼容接口,走 openai/<real_model>)
        - openrouter/* → OPENROUTER_API_KEY(LiteLLM 原生)
        - claude-*/anthropic/* → ANTHROPIC_API_KEY(LiteLLM 原生)
        - ollama/*   → OLLAMA_API_BASE(LiteLLM 原生,默认 http://localhost:11434)
        - azure/*    → AZURE_API_KEY + AZURE_API_BASE + AZURE_API_VERSION(LiteLLM 原生)
        - bedrock/*  → AWS_ACCESS_KEY_ID 等(LiteLLM 原生)
        - gpt-*/o1-* 等 → OPENAI_API_KEY(默认)
        """
        # 2026-08-06 立:'auto' 或空 model 走跨厂商自动路由(用户反馈"应该是自动切换所有可使用的模型")
        # 修复历史:之前 fallback 到 settings.litellm_model(默认 stepfun/step-router-v1),
        # step-router-v1 是 Step 厂家路由只路由 Step 内部模型,违背"全模型智能路由"语义。
        # 注:_resolve_provider 是 sync staticmethod,真正的 auto 解析在
        # LLMGateway.complete() / astream() 入口处执行,解析完成后再调 _resolve_provider。
        if model == "auto" or not model:
            real_model = settings.litellm_model or "stepfun/step-3.7-flash"
            logger.info("[llm_gateway] model=%r 占位(实际路由在 complete() 入口处理),占位模型 %r",
                       model, real_model)
            model = real_model
        m = model.lower()
        if m.startswith("stepfun/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("stepfun")
            return cfg.api_key, cfg.api_base, f"openai/{real_model}"
        if m.startswith("agnes/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("agnes")
            return cfg.api_key, cfg.api_base, f"openai/{real_model}"
        # Token6688 聚合网关(单 key 全模态)。⚠ LiteLLM openai/ 直连要求 api_base 以
        # /v1 结尾(否则请求 {base}/chat/completions 落到网站首页 HTML,2026-09-08 假 key
        # 实测:无 /v1 → "Empty or invalid response";有 /v1 → 401 Invalid API key 正确命中),
        # 故默认带 /v1,且用户误配无 /v1 时自动补齐(防呆)。
        if m.startswith("t6688/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("token6688")
            base = (cfg.api_base or "https://k.token6688.com").rstrip("/")
            if not base.endswith("/v1"):
                base += "/v1"
            return cfg.api_key, base, f"openai/{real_model}"
        if m.startswith("ihui/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("ihui_relay")
            # api_base 自动检测:根据网络延迟切换国内/海外端点
            api_base = _detect_ihui_relay_base()
            return cfg.api_key, api_base, f"openai/{real_model}"
        if m.startswith("groq/"):
            cfg = settings.get_provider_config("groq")
            return cfg.api_key, cfg.api_base or None, model
        if m.startswith("gemini/"):
            # 2026-08-02 接入 Google AI Studio:走 OpenAI 兼容接口
            # api_base = https://generativelanguage.googleapis.com/v1beta/openai
            # 模型名去 gemini/ 前缀(如 gemini/gemini-2.5-flash → gemini-2.5-flash)
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("gemini")
            return cfg.api_key, cfg.api_base, f"openai/{real_model}"
        if m.startswith("openrouter/"):
            cfg = settings.get_provider_config("openrouter")
            return cfg.api_key, cfg.api_base or None, model
        if m.startswith("claude-") or m.startswith("anthropic/"):
            cfg = settings.get_provider_config("anthropic")
            return cfg.api_key, cfg.api_base or None, model
        if m.startswith("ollama/"):
            return settings.ollama_api_key or None, settings.ollama_api_base, model
        if m.startswith("lmstudio/"):
            return settings.lmstudio_api_key or "lm-studio", settings.lmstudio_api_base, model
        if m.startswith("llamacpp/"):
            return None, settings.llamacpp_api_base, model
        if m.startswith("azure/"):
            return settings.azure_api_key or None, settings.azure_api_base or None, model
        if m.startswith("bedrock/"):
            return settings.aws_access_key_id or None, None, model
        # 2026-07-22 接入:免费 / 试用 credits provider(均为 OpenAI 兼容,走 LiteLLM openai/{model} 路径)
        # 2026-08-01 重构(P0 Phase A H2):消灭硬编码 nvidia/cloudflare 前缀判断,改为 dict 查表
        # 新增 provider 只需在 _FREE_PROVIDER_ENDPOINT_RESOLVERS 加 entry,零代码改动
        for prefix, (code, default_base, require_base, strip_prefix) in _FREE_PROVIDER_ENDPOINT_RESOLVERS.items():
            if m.startswith(prefix):
                real_model = model.split("/", 1)[1] if strip_prefix else model
                cfg = settings.get_provider_config(code)
                if require_base:
                    # Cloudflare Workers AI:cloudflare_account_id 字段已删除,api_base 必须配置完整 URL
                    # (含 account_id,如 https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1)
                    if not cfg.api_key or not cfg.api_base:
                        return None, None, real_model
                    return cfg.api_key, cfg.api_base, f"openai/{real_model}"
                return cfg.api_key or None, cfg.api_base or default_base, f"openai/{real_model}"
        # 2026-08-13 修复:deepseek-chat/deepseek-reasoner 无前缀,key 配置在 deepseek provider。
        # 此前落到 openai 默认分支 → LiteLLM "Provider NOT provided" 502,模型列表可选但一调用即失败。
        if m.startswith("deepseek-"):
            real_model = model.split("/", 1)[1] if "/" in model else model
            cfg = settings.get_provider_config("deepseek")
            return cfg.api_key or None, cfg.api_base or "https://api.deepseek.com", f"openai/{real_model}"
        # 2026-08-13 修复:glm-4-plus/glm-5 无前缀,key 配置在 zhipu(智谱),此前同样 502。
        if m.startswith("glm-"):
            real_model = model.split("/", 1)[1] if "/" in model else model
            cfg = settings.get_provider_config("zhipu")
            return cfg.api_key or None, cfg.api_base or "https://open.bigmodel.cn/api/paas/v4", f"openai/{real_model}"
        # 2026-09-21 同型修复:模型选择器发的是裸 id(/llm/models 的 m.id),而这两家的模型名
        # 不带 vendor 前缀(qwen-plus / mimo-v2.5),此前落到末尾 openai 默认分支 →
        # LiteLLM "LLM Provider NOT provided" 502,列表里选得到、一调用即失败。
        # LLM_PROVIDERS 里这两家只配了 api_key 没配 api_base,故默认值写死在代码里。
        if m.startswith("qwen"):
            real_model = model.split("/", 1)[1] if "/" in model else model
            cfg = settings.get_provider_config("qwen")
            return (
                cfg.api_key or None,
                cfg.api_base or "https://dashscope.aliyuncs.com/compatible-mode/v1",
                f"openai/{real_model}",
            )
        if m.startswith("mimo"):
            real_model = model.split("/", 1)[1] if "/" in model else model
            cfg = settings.get_provider_config("mimo")
            return (
                cfg.api_key or None,
                cfg.api_base or "https://api.xiaomimimo.com/v1",
                f"openai/{real_model}",
            )
        if m.startswith("agnes"):
            real_model = model.split("/", 1)[1] if "/" in model else model
            cfg = settings.get_provider_config("agnes")
            return (
                cfg.api_key or None,
                cfg.api_base or "https://apihub.agnes-ai.com/v1",
                f"openai/{real_model}",
            )
        # 2026-07-24 接入:10 个免费 LLM provider 内化(均为 OpenAI 兼容)
        if m.startswith("cerebras/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("cerebras")
            return cfg.api_key or None, cfg.api_base or "https://api.cerebras.ai/v1", f"openai/{real_model}"
        if m.startswith("mistral/") or m.startswith("mistral-") or m.startswith("codestral-") or m.startswith("pixtral-"):
            real_model = model.split("/", 1)[1] if "/" in model else model
            cfg = settings.get_provider_config("mistral")
            return cfg.api_key or None, cfg.api_base or "https://api.mistral.ai/v1", f"openai/{real_model}"
        if m.startswith("cohere/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("cohere")
            return cfg.api_key or None, cfg.api_base or "https://api.cohere.ai/v1", f"openai/{real_model}"
        if m.startswith("huggingface/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("huggingface")
            return cfg.api_key or None, cfg.api_base or "https://router.huggingface.co/v1", f"openai/{real_model}"
        if m.startswith("zai/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("zai")
            return cfg.api_key or None, cfg.api_base or "https://open.bigmodel.cn/api/paas/v4", f"openai/{real_model}"
        # keyless provider:无需 key,有 base_url 即可用
        if m.startswith("kilo/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("kilo")
            return None, cfg.api_base, f"openai/{real_model}"
        if m.startswith("pollinations/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("pollinations")
            return None, cfg.api_base, f"openai/{real_model}"
        if m.startswith("llm7/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("llm7")
            return cfg.api_key or None, cfg.api_base, f"openai/{real_model}"
        if m.startswith("ovh/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("ovh")
            return None, cfg.api_base, f"openai/{real_model}"
        if m.startswith("aihorde/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("aihorde")
            return cfg.api_key or "0000000000", cfg.api_base, f"openai/{real_model}"
        # Reka(每月免费 credit,OpenAI 兼容;reka-flash-3 / reka-edge-2603)
        if m.startswith("reka/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("reka")
            return cfg.api_key or None, cfg.api_base or "https://api.reka.ai/v1", f"openai/{real_model}"
        # Routeway(OpenAI 兼容聚合,:free 后缀模型 $0)
        if m.startswith("routeway/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("routeway")
            return cfg.api_key or None, cfg.api_base or "https://api.routeway.ai/v1", f"openai/{real_model}"
        # BazaarLink(OpenAI 兼容聚合,auto:free 路由零成本)
        if m.startswith("bazaarlink/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("bazaarlink")
            return cfg.api_key or None, cfg.api_base or "https://bazaarlink.ai/api/v1", f"openai/{real_model}"
        # AINative Studio(OpenAI 兼容聚合,每月 ~10M tokens 免费)
        if m.startswith("ainative/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("ainative")
            return cfg.api_key or None, cfg.api_base or "https://api.ainative.studio/api/v1", f"openai/{real_model}"
        cfg = settings.get_provider_config("openai")
        return cfg.api_key or None, cfg.api_base or None, model

# ============================================================================
# 批 58:provider_config 强类型配置接线(env LLM_PROVIDER_CONFIG_ENABLED,默认 off)
# ============================================================================


    async def _get_provider(
        self,
        model: str,
        owner_uuid: str | None = None,
    ) -> "BaseProvider | None":
        """根据模型前缀返回厂商原生适配器(可选增强)。

        适配器封装厂商特有能力(function calling 格式 / system prompt / safety_settings),
        未配置 API key 或无匹配前缀时返回 None,调用方应 fallback 到 LiteLLM。

        Args:
            model: 模型名称(含厂商前缀,如 stepfun/step-3.7-flash)。
            owner_uuid: 用户 UUID,用于匹配 ai_model_config 表私有配置。

        Returns:
            BaseProvider 实例或 None(无 key / 无匹配前缀 → fallback LiteLLM)。
        """
        if self._is_stub_mode():
            db_result = await _resolve_from_db(model, owner_uuid)
            if not db_result:
                return None
            api_key, api_base, _ = db_result
        else:
            api_key, api_base, _, _ = await self._resolve(model, owner_uuid)
        if not api_key:
            return None
        # 批 58:on 时用 ProviderConfig 强类型校验归一 api_base(去末尾斜杠);off 原样透传
        if _llm_provider_config_enabled_from_env():
            api_base = _normalize_provider_api_base(api_base)
        try:
            # TEMP-FIX(ai-feed): lazy import 绕过循环导入,跑完回退
            from ..providers import get_provider as _get_native_provider
            return _get_native_provider(model, api_key, api_base)
        except Exception as e:
            logger.warning("厂商适配器初始化失败(model=%s): %s, fallback LiteLLM", model, e)
            return None

    async def _resolve(
        self,
        model: str,
        owner_uuid: str | None = None,
    ) -> tuple[str | None, str | None, str | None, str | None]:
        """优先 BYOK → 号池 → .env(三层优先级)。

        1. BYOK 用户私有配置(_resolve_from_db 查 ai_model_config WHERE owner_uuid=?)
        2. 中转站号池(KeyPoolSelector 查 ai_relay_key_pool WHERE provider_code=?)
        3. .env 单 key(_resolve_provider 兜底)

        Returns:
            (api_key, api_base, litellm_model, key_pool_id)
            key_pool_id 非空表示命中号池,供 complete/astream 故障转移标记用。
            2026-08-01 P0 修复:改为返回值而非设置类属性,消除并发共享状态。
        """
        # 1. BYOK 用户私有配置
        db_result = await _resolve_from_db(model, owner_uuid)
        if db_result:
            return (*db_result, None)

        # 2. 号池(中转站模式):查 ai_relay_key_pool
        provider_code = KeyPoolSelector.model_to_provider_code(model)
        pool_key = await KeyPoolSelector.select_key(provider_code)
        if pool_key is not None:
            # base_url 仍从 .env provider config 读(号池只管 key 轮换)
            # litellm_model 走 _resolve_provider 的前缀处理(去前缀 + 加 openai/ 等)
            cfg = settings.get_provider_config(provider_code)
            _, _, litellm_model = self._resolve_provider(model)
            return pool_key["api_key"], cfg.api_base or None, litellm_model, pool_key["key_pool_id"]

        # 3. .env 单 key 兜底
        return (*self._resolve_provider(model), None)

    async def _apply_token_compaction(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        has_tools: bool = False,
    ) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
        """可选 token 压缩步骤:trim_messages 之后、litellm.acompletion 之前。

        启用条件(全部满足):
        1. settings.token_compaction_enabled == True(默认 False,getattr 安全读取)
        2. messages 总 token 数 > settings.token_compaction_min_tokens(默认 2000)
        3. 非 stub 模式(stub 模式返回模拟响应,无需压缩)
        4. 不含 tools 参数(function calling 对消息结构敏感,压缩可能破坏 tool_calls)

        Args:
            messages: trim_messages 后的消息列表(不会被修改,内部会做深拷贝)
            model: 模型名(用于 Prometheus 指标标签)
            has_tools: 是否含 tools 参数(True 时跳过压缩,保护 function calling)

        Returns:
            (compressed_messages, compaction_info) 二元组:
            - 启用且成功:compressed_messages 为压缩后消息,info 含 original/compressed/ratio/strategy
            - 未启用或跳过:返回原 messages,info 为 None
            - 压缩失败:降级用原 messages(不阻塞主流程),info 为 None
        """
        enabled = bool(getattr(settings, "token_compaction_enabled", False))
        if not enabled:
            return messages, None

        # stub 模式返回模拟响应,无需压缩
        if self._is_stub_mode():
            return messages, None

        # tools 调用对消息结构敏感,压缩可能破坏 function calling
        if has_tools:
            return messages, None

        # 阈值检查:总 token 数 ≤ min_tokens 时不压缩
        min_tokens = int(getattr(settings, "token_compaction_min_tokens", 2000))
        total_tokens = estimate_messages_tokens(messages)
        if total_tokens <= min_tokens:
            return messages, None

        # 延迟导入避免 token_compaction 模块在 stub 模式下加载 tiktoken(首次 ~50ms)
        from ..services.token_compaction import (
            CompactionStrategy,
            token_compactor,
        )

        strategy = CompactionStrategy.RTK_CAVEMAN
        strategy_str = strategy.value
        try:
            LLM_TOKEN_COMPACTION_TRIGGERED.labels(strategy=strategy_str, model=model).inc()
            result = token_compactor.compact_messages(
                messages, strategy=strategy, keep_recent=6
            )
            LLM_TOKEN_COMPACTION_SUCCESS.labels(strategy=strategy_str, model=model).inc()
            LLM_TOKEN_COMPACTION_RATIO.labels(strategy=strategy_str).observe(
                result.compression_ratio
            )
            info: dict[str, Any] = {
                "original_tokens": result.original_tokens,
                "compressed_tokens": result.compressed_tokens,
                "compression_ratio": result.compression_ratio,
                "strategy": strategy_str,
            }
            # Message 类型 dict[str, object] → dict[str, Any](运行时同形状,
            # litellm 期望 list[dict[str, Any]];cast 而非深拷贝,避免无谓开销)
            return cast(list[dict[str, Any]], result.compressed_messages), info
        except Exception as e:
            logger.warning(
                "Token compaction 失败,降级用原 messages(model=%s): %s",
                model,
                e,
            )
            try:
                LLM_TOKEN_COMPACTION_FAILURE.labels(
                    strategy=strategy_str,
                    model=model,
                    reason=type(e).__name__,
                ).inc()
            except Exception as metric_err:
                logger.warning("LLM_TOKEN_COMPACTION_FAILURE 指标记录失败(忽略): %s", metric_err)
            return messages, None

    async def _emit_model_reroute(
        self, requested: str | None, resolved: str
    ) -> None:
        """ModelReroute 事件(2026-09-18 第三批,对标 Codex ModelReroute)。

        auto / ihui/auto-model 路由把请求模型改道到实际模型时发出,客户端与
        审计侧可感知"实际用了哪个模型";失败降级绝不影响主链路。
        """
        try:
            from ..services.hook_engine import hook_engine

            with _ctx_suppress(Exception):
                await hook_engine.emit(
                    "model.reroute",
                    {"requested": requested, "resolved": resolved},
                )
        except Exception:  # noqa: BLE001 - 事件发射绝不阻塞推理主链路
            pass

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        _skip_fallback: bool = False,
        _pool_retry: int = 0,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """调用 LLM 完成对话。

        Args:
            messages: OpenAI 格式的消息列表。
            model: 模型名称,为空则使用默认模型。
            owner_uuid: 用户 UUID,用于匹配 ai_model_config 表中的用户私有配置。
            _skip_fallback: 内部参数,True 时跳过 FallbackRouter(防递归)。
            _pool_retry: 内部参数,号池故障转移重试计数(最多 3 次)。
            **kwargs: 透传给 litellm 的额外参数。

        Returns:
            包含 content/model/usage/stub 字段的字典。
        """
        # 2026-08-06 立:'auto' 模型走跨厂商自动路由(用户反馈"应该是自动切换所有可使用的模型")
        # 历史:之前 fallback 到 settings.litellm_model(默认 stepfun/step-router-v1),
        #       step-router-v1 只在 Step 厂家内部路由,不跨厂商,违背"全模型智能路由"语义。
        # 修复:调 _resolve_auto_model 从 model_availability 全量可用模型池选最优,
        #       优先 zero_cost / LOCAL → cheap plan → premium,tool calling 场景额外筛 function calling 支持。
        if not model or model == "auto":
            used_model = await _resolve_auto_model(
                has_tools=bool(kwargs.get("tools")),
                messages=messages,
            )
            # ModelReroute:改道可观测(2026-09-18 第三批)
            await self._emit_model_reroute(model, used_model)
        elif model.lower() == "ihui/auto-model":
            # 2026-08-31 立:智汇 Auto-Model 服务端随机(成本可控版),
            # 不透传给极速随机,避免随机到 1:5~1:10 高成本模型压缩利润
            used_model = _resolve_ihui_auto_model()
            await self._emit_model_reroute(model, used_model)
        else:
            used_model = model
        # P38 跨端同步:先修复结构异常,再修剪窗口(防御性兜底,与 API /chat/stream 同源)
        # keep_trailing_user=True: 末尾 user 是当前发送的输入,必须保留
        # agent loop 内部消息流(tool role / 自定义 tool_calls)走专用修复:
        # 保留 tool 结果并归一化 assistant.tool_calls 为 OpenAI 原生形态,否则
        # 第 2 轮起请求必 400(此前 tool 结果被剥 + tool_calls 缺 type/function)。
        # chat API 消息(无 tool role)走原 repair_messages,行为不变。
        if _is_agent_loop_messages(messages):
            repaired_messages, repair_removed = _repair_agent_loop_messages(messages)
            if repair_removed > 0:
                logger.info("agent_loop repair 修复 %d 条异常消息", repair_removed)
        else:
            repaired_messages, repair_removed, _ = repair_messages(messages, keep_trailing_user=True)
            if repair_removed > 0:
                logger.info("repair_messages 修复 %d 条异常消息", repair_removed)
        trimmed_messages = trim_messages(repaired_messages)

        # 可选 token 压缩(P3-1,token_compaction.py 集成):
        # 在 trim_messages 之后、litellm.acompletion 之前调用,压缩长上下文。
        # 启用条件:settings.token_compaction_enabled=True 且 token 数 > 阈值 且 非 stub 且无 tools
        # 失败时降级用原 messages,不阻塞主流程
        trimmed_messages, compaction_info = await self._apply_token_compaction(
            trimmed_messages, used_model, has_tools="tools" in kwargs
        )

        # 厂商原生适配器(可选增强):当请求含 tools(function calling)时,
        # 优先用厂商原生 API 以保留格式差异(Anthropic tool_use / Gemini functionDeclarations 等),
        # 失败时 fallback 到 LiteLLM 通用路径。
        if "tools" in kwargs and not self._is_stub_mode():
            provider = await self._get_provider(used_model, owner_uuid)
            if provider is not None:
                # TEMP-FIX(ai-feed): lazy import 绕过循环导入,跑完回退
                from ..providers.base_provider import ProviderError
                try:
                    # P1 修复(2026-08-06): 用浅拷贝再 pop,避免破坏原 kwargs,
                    # 防止 ProviderError fallback 到 LiteLLM 时 tools 丢失导致 function calling 失效。
                    provider_kwargs = dict(kwargs)
                    tools = provider_kwargs.pop("tools", None)
                    return await provider.complete(
                        trimmed_messages, used_model, tools=tools, **provider_kwargs
                    )
                except ProviderError as e:
                    logger.warning(
                        "厂商适配器调用失败(model=%s): %s, fallback LiteLLM",
                        used_model,
                        e,
                    )

        if self._is_stub_mode():
            db_result = await _resolve_from_db(used_model, owner_uuid)
            if not db_result:
                last_user = ""
                for msg in reversed(messages):
                    if msg.get("role") == "user":
                        last_user = str(msg.get("content", ""))
                        break
                return {
                    "content": (
                        "[stub] AI 服务未配置 API key,返回模拟响应。"
                        f"最后一条用户消息: {last_user[:200]}"
                    ),
                    "model": used_model,
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    "stub": True,
                }
            api_key, api_base, real_model = db_result
            current_key_pool_id: str | None = None
        else:
            api_key, api_base, real_model, current_key_pool_id = await self._resolve(used_model, owner_uuid)

        try:
            import litellm

            if not api_key:
                raise ValueError(
                    f"模型 {used_model} 对应的 provider API key 未配置,请在 .env 或 ai_model_config 表中设置"
                )
            call_kwargs: dict[str, Any] = {"model": real_model, "messages": trimmed_messages}
            call_kwargs["api_key"] = api_key
            if api_base:
                call_kwargs["api_base"] = api_base
            # 按 provider capability 设默认 timeout(NVIDIA NIM=120s / Cloudflare=60s / 其他=30s)
            # 替代旧硬编码 nvidia 前缀 120s timeout 判断(P0 Phase A)
            provider_code = _model_to_provider_code(used_model)
            cap = get_provider_cap(provider_code)
            call_kwargs["timeout"] = cap.default_timeout
            # 第十七批(对标 Codex ModelProviderInfo):provider 级韧性参数取代
            # 全局硬编码 num_retries=2 —— 排队型与低延迟 provider 不再同档。
            # 只补调用方没显式给的键,显式值永远优先。
            apply_provider_overrides(call_kwargs, provider_code)
            call_kwargs.update(kwargs)
            # 表头必须在调用方 kwargs 合并之后再合,否则会被调用方的
            # extra_headers 整个覆盖掉(env_headers 的值只存在于服务端环境变量)
            apply_provider_headers(call_kwargs, provider_code)
            # 批58:Responses 模型级 header 注入(默认 off,on 时才追加)
            if _llm_responses_headers_enabled_from_env():
                _apply_responses_headers(call_kwargs)
            # 按 capability 过滤不支持的参数(stream_usage/tools/response_format/temperature)
            filter_call_kwargs(call_kwargs, provider_code, used_model)
            # P3-3(2026-07-30):openrouter/ 前缀请求临时设置专用代理
            # 2026-08-01 P0:改为 async with + asyncio.Lock 防止并发 env var 竞态
            async with _openrouter_proxy_context(used_model):
                response = await litellm.acompletion(**call_kwargs)
            usage = response.usage
            usage_dict: dict[str, Any] = {}
            if usage is not None:
                usage_dict = (
                    usage.model_dump() if hasattr(usage, "model_dump") else dict(usage)
                )
            # P0-①(2026-09-18):LiteLLM 路径 usage 归一化——各厂商缓存字段
            # (OpenAI prompt_tokens_details.cached_tokens / Anthropic cache_read_*)
            # 统一为 cached_tokens/cache_creation_tokens,供 cost_ledger 缓存计价。
            usage_dict = normalize_usage(usage_dict)
            result: dict[str, Any] = {
                "content": response.choices[0].message.content,
                "model": response.model or used_model,
                "usage": usage_dict,
                "stub": False,
            }
            # P3-1 token 压缩信息(仅在压缩启用且成功时存在,前端/监控可读)
            if compaction_info is not None:
                result["compaction"] = compaction_info
            reasoning = getattr(response.choices[0].message, "reasoning_content", None)
            if reasoning:
                result["reasoning"] = reasoning
            # 2026-08-07 修复(stepfun 推理模型兼容):推理模型的 message.content 常为空,
            # 实际回复在 reasoning_content。ai_tutor 等 JSON 服务依赖 content,
            # content 为空会导致 _extract_json('') 解析失败 → 返回空 answer。
            # 降级策略:content 为空且 reasoning 存在时,用 reasoning 兜底 content。
            if not (result.get("content") or "").strip() and reasoning:
                result["content"] = reasoning
            # 提取 tool_calls(OpenAI function calling 格式)
            raw_tool_calls = getattr(response.choices[0].message, "tool_calls", None)
            if raw_tool_calls:
                result["tool_calls"] = [
                    {
                        "id": getattr(tc, "id", ""),
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "",
                        },
                    }
                    for tc in raw_tool_calls
                ]
            # P0-5c:号池 key 调用成功 → 标记 healthy(恢复 degraded/unknown 状态)
            if current_key_pool_id:
                await KeyPoolSelector.mark_key_healthy(current_key_pool_id)
            return result
        except Exception as e:
            # P0-5c:号池故障转移 — 标记失败 + 递归重试(最多 3 次,换 key 再试)
            # 重试优先于 FallbackRouter/ComboRouter(同模型换 key < 换模型兜底)
            if current_key_pool_id is not None and _pool_retry < 3:
                await KeyPoolSelector.mark_key_failed(current_key_pool_id, str(e))
                logger.info(
                    "[key_pool] key %s 失败(retry %d/3),换 key 重试: %s",
                    current_key_pool_id, _pool_retry + 1, str(e)[:200],
                )
                return await self.complete(
                    messages,
                    model=model,
                    owner_uuid=owner_uuid,
                    _skip_fallback=_skip_fallback,
                    _pool_retry=_pool_retry + 1,
                    **kwargs,
                )
            safe_msg = str(e)
            err_code = "LLM_ERROR"
            if "API key 未配置" in safe_msg or "未配置" in safe_msg:
                err_code = "MODEL_NOT_CONFIGURED"
            elif "NotImplemented" in safe_msg:
                err_code = "PROVIDER_NOT_IMPLEMENTED"
            else:
                for key_field in ("api_key", "apikey", "authorization"):
                    if key_field in safe_msg.lower():
                        safe_msg = f"LLM 调用失败(含敏感信息已脱敏): {type(e).__name__}"
                        break
            # P3-3 OpenRouter 403 failover(2026-07-30):openrouter/<model> 返回 403 时,
            # 自动 failover 到 agnes/<model>(同模型换 provider,优先于 FallbackRouter 换模型)
            # _is_openrouter_403_error 天然防递归:agnes/ 前缀不匹配 openrouter/ 判断
            if (
                settings.openrouter_failover_to_agnes
                and _is_openrouter_403_error(used_model, e)
                and not _skip_fallback
            ):
                agnes_model = _failover_openrouter_to_agnes(used_model)
                if agnes_model:
                    logger.info(
                        "OpenRouter 403 failover: %s → %s",
                        used_model, agnes_model,
                    )
                    try:
                        LLM_FALLBACK_TRIGGERED.labels(
                            primary_model=used_model,
                            backup_model=agnes_model,
                            reason="openrouter_403",
                        ).inc()
                    except Exception as metric_err:
                        logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
                    return await self.complete(
                        messages,
                        model=agnes_model,
                        owner_uuid=owner_uuid,
                        **kwargs,
                    )
            # FallbackRouter 接入:LLM_ERROR 且未跳过 fallback 时,
            # 自动尝试 fallbacks 配置中的备用 provider(如 stepfun 故障 → agnes 兜底)
            # 额度耗尽时即使没配静态 fallbacks 也要进(候选由替代通道动态补齐)
            quota_exhausted_hit = False
            if (
                err_code == "LLM_ERROR"
                and not _skip_fallback
                and (fallback_router._configs or is_quota_exhaustion_error(e))
            ):
                fb_result = await fallback_router.complete_with_fallback(
                    trimmed_messages, used_model, primary_error=e
                )
                if not fb_result.get("error"):
                    fb_result["fallback_used"] = True
                    fb_result["fallback_primary"] = used_model
                    # P3-2 指标埋点:fallback 触发 + 成功
                    backup_model = fb_result.get("model", "unknown")
                    try:
                        LLM_FALLBACK_TRIGGERED.labels(
                            primary_model=used_model,
                            backup_model=backup_model,
                            reason=classify_fallback_reason(e),
                        ).inc()
                        LLM_FALLBACK_SUCCESS.labels(
                            primary_model=used_model,
                            backup_model=backup_model,
                        ).inc()
                    except Exception as metric_err:
                        logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
                    return fb_result
                # P3-2 指标埋点:fallback 触发 + 失败(所有备用 provider 均失败)
                try:
                    LLM_FALLBACK_TRIGGERED.labels(
                        primary_model=used_model,
                        backup_model="all_failed",
                        reason=classify_fallback_reason(e),
                    ).inc()
                    LLM_FALLBACK_FAILURE.labels(
                        primary_model=used_model,
                        backup_model="all_failed",
                    ).inc()
                except Exception as metric_err:
                    logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
                if fb_result.get("quota_exhausted"):
                    # 透传"哪家、因为什么",否则调用方只看到主通道那一条上游错误
                    safe_msg = f"{safe_msg} | {fb_result.get('error')}"
                    # 单独标记而非直接改 err_code:err_code 还兼作下面 ComboRouter 分支的闸门,
                    # combo 是显式配置的多级链,额度穷尽后仍应照试。
                    quota_exhausted_hit = True

            # P0-1 Combo 多级 fallback 接入(2026-07-30 立,超越 OmniRoute):
            # FallbackRouter 单层 fallback 失败后,若 primary model 在某个 combo 链中,
            # 尝试 ComboRouter(priority/cheapest/fusion 三策略)。ComboRouter 内部会
            # 透传 _skip_fallback=True 防递归。
            if err_code == "LLM_ERROR" and not _skip_fallback:
                combo = _get_combo_router()
                if combo:
                    # 找到 primary 所属的 combo 链(若配置了)
                    combo_name = combo.find_combo_for_model(used_model)
                    if combo_name:
                        logger.info(
                            "Combo fallback 触发: primary=%s combo=%s",
                            used_model, combo_name,
                        )
                        try:
                            combo_result = cast(
                                "dict[str, Any]",
                                await combo.route_with_combo(
                                    messages=trimmed_messages,
                                    combo_name=combo_name,
                                    primary=used_model,
                                    **kwargs,
                                ),
                            )
                            if not combo_result.get("error"):
                                combo_result["combo_used"] = combo_name
                                combo_result["combo_primary"] = used_model
                                return combo_result
                            logger.warning(
                                "Combo fallback 全部失败(combo=%s): %s",
                                combo_name,
                                combo_result.get("error") or combo_result.get("error_message"),
                            )
                        except Exception as combo_err:
                            logger.warning(
                                "Combo fallback 异常(combo=%s): %s",
                                combo_name, combo_err,
                            )
            return {
                "content": "",
                "model": used_model,
                "usage": {},
                "stub": False,
                "error": True,
                "error_message": safe_msg,
                # 只在"确实因额度且同名+同族改道已穷尽"时给稳定码;普通 LLM 错误不受影响
                "errorCode": PROVIDER_QUOTA_EXHAUSTED if quota_exhausted_hit else err_code,
            }

    async def structured_completion(
        self,
        messages: list[dict[str, Any]],
        schema: dict[str, Any],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        schema_name: str = "structured_response",
        max_retries: int = 1,
    ) -> dict[str, Any]:
        """强制 LLM 返回符合 JSON Schema 的结构化输出(G2 字典化闭环 PoC)。

        走 OpenAI 原生 `response_format: { type: "json_schema" }` 协议(其他厂商通过
        LiteLLM 适配)。返回解析后的 dict + 强 schema 校验,失败时返回 error dict(由
        调用方决定降级策略)。

        Args:
            messages: OpenAI 格式消息列表。
            schema: JSON Schema(Draft-07 子集),约束 LLM 输出结构。
            model: 模型名称,为空则使用默认模型。
            owner_uuid: 用户 UUID(走 ai_model_config 私有配置)。
            schema_name: schema 标识符(部分厂商用 name 区分不同 schema)。
            max_retries: 解析失败时的重试次数(不含首次)。

        Returns:
            成功:`{"tasks": [...], ...}` 解析后的 dict(无 error 字段)。
            失败:`{"error": True, "error_message": "..."}` 错误 dict。
        """
        # OpenAI 原生 json_schema 协议(LiteLLM 透传给各厂商)
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "schema": schema,
                "strict": True,
            },
        }

        last_error: str = ""
        for attempt in range(max_retries + 1):
            result = await self.complete(
                messages,
                model=model,
                owner_uuid=owner_uuid,
                response_format=response_format,
            )

            if result.get("error"):
                last_error = result.get("error_message", "LLM 调用失败")
                if attempt < max_retries:
                    continue
                return {"error": True, "error_message": last_error}

            content = result.get("content", "")
            if not content:
                last_error = "LLM 返回空内容"
                if attempt < max_retries:
                    continue
                return {"error": True, "error_message": last_error}

            try:
                parsed = json.loads(content)
            except (json.JSONDecodeError, TypeError) as e:
                last_error = f"JSON 解析失败: {e}"
                if attempt < max_retries:
                    continue
                return {"error": True, "error_message": last_error}

            if not isinstance(parsed, dict):
                last_error = f"JSON 顶层非 object,实际类型: {type(parsed).__name__}"
                if attempt < max_retries:
                    continue
                return {"error": True, "error_message": last_error}

            # required 字段校验(JSON Schema 强制约束)
            if isinstance(schema, dict):
                required = schema.get("required", [])
                missing = [k for k in required if k not in parsed]
                if missing:
                    last_error = f"missing required fields: {missing}"
                    if attempt < max_retries:
                        continue
                    return {"error": True, "error_message": last_error}

                # additionalProperties: False 校验
                if schema.get("additionalProperties") is False:
                    allowed = set(schema.get("properties", {}).keys())
                    extra = [k for k in parsed if k not in allowed]
                    if extra:
                        last_error = f"unexpected fields: {extra}"
                        if attempt < max_retries:
                            continue
                        return {"error": True, "error_message": last_error}

            return parsed

        return {"error": True, "error_message": last_error or "unknown"}

    async def _astream_fallback_events(
        self,
        trimmed_messages: list[dict[str, Any]],
        used_model: str,
        error_message: str,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式主路径失败(未发任何 chunk)时的 FallbackRouter 兜底事件流。

        2026-08-22 立:厂商原生适配器路径(stepfun/* 必走 / 带 tools)此前直接透传
        error 事件并 return,绕过 LiteLLM 路径的流式兜底契约,导致默认模型
        stepfun/* 流式失败时零兜底。本 helper 与 LiteLLM 路径 except 块中的
        fallback 分支保持同一事件契约:
          fallback 通知事件(P4-2,前端感知模型切换)
          → chunk(10 字符/块)
          → done(fallback_used=True, fallback_primary=主模型);
        兜底不可用 / 全部失败时透传 error 事件(errorCode=LLM_ERROR)。
        """
        error_evt = {"type": "error", "message": error_message, "errorCode": "LLM_ERROR"}
        if not fallback_router._configs and not is_quota_exhaustion_error(error_message):
            yield error_evt
            return
        fb_reason = classify_fallback_reason(Exception(error_message))
        try:
            fb_result = await fallback_router.complete_with_fallback(
                trimmed_messages, used_model, primary_error=error_message
            )
            if not fb_result.get("error"):
                fb_content = fb_result.get("content", "") or ""
                backup_model = fb_result.get("model", "unknown")
                try:
                    LLM_FALLBACK_TRIGGERED.labels(
                        primary_model=used_model,
                        backup_model=backup_model,
                        reason=fb_reason,
                    ).inc()
                    LLM_FALLBACK_SUCCESS.labels(
                        primary_model=used_model,
                        backup_model=backup_model,
                    ).inc()
                except Exception as metric_err:
                    logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
                # P4-2: 提前发送 fallback 通知事件,让前端感知模型切换(与 LiteLLM 路径一致)
                yield {
                    "type": "fallback",
                    "primary_model": used_model,
                    "backup_model": backup_model,
                    # 换到同族等效模型时 reason 变 'quota_equivalent'(既有字段,不新增键)
                    "reason": str(fb_result.get("fallback_reason") or fb_reason),
                }
                chunk_size = 10
                for i in range(0, len(fb_content), chunk_size):
                    yield {"type": "chunk", "content": fb_content[i : i + chunk_size]}
                yield {
                    "type": "done",
                    "model": backup_model,
                    "usage": fb_result.get("usage", {}),
                    "stub": False,
                    "fallback_used": True,
                    "fallback_primary": used_model,
                }
                return
            # 所有 fallback 均失败 → 指标埋点 + 透传原 error
            if fb_result.get("quota_exhausted"):
                # 透传"哪家、因为什么",否则调用方只看到主通道那一条上游错误
                error_evt = {
                    **error_evt,
                    "message": f"{error_message} | {fb_result.get('error')}",
                    "errorCode": str(fb_result.get("errorCode") or PROVIDER_QUOTA_EXHAUSTED),
                }
            try:
                LLM_FALLBACK_TRIGGERED.labels(
                    primary_model=used_model,
                    backup_model="all_failed",
                    reason=fb_reason,
                ).inc()
                LLM_FALLBACK_FAILURE.labels(
                    primary_model=used_model,
                    backup_model="all_failed",
                ).inc()
            except Exception as metric_err:
                logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
        except Exception as fb_err:
            logger.warning("astream fallback 失败: %s", fb_err)
            try:
                LLM_FALLBACK_TRIGGERED.labels(
                    primary_model=used_model,
                    backup_model="all_failed",
                    reason=fb_reason,
                ).inc()
                LLM_FALLBACK_FAILURE.labels(
                    primary_model=used_model,
                    backup_model="all_failed",
                ).inc()
            except Exception as metric_err:
                logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
        yield error_evt

    # 2026-08-29 修复:流式 tool_calls 分片累积函数(供 astream 两条路径共用)。
    # 此前 openai/stepfun 原生适配器把 {"type": "tool_call", "tool_calls": [分片]} 直接透传,
    # litellm 路径直接忽略 delta.tool_calls,导致调用方拿不到完整工具参数。
    # 统一改为按 index 累积,由 astream 在流结束前以完整 tool_calls 事件产出。
    @staticmethod
    def _accumulate_tool_calls(
        acc: dict[int, dict[str, Any]],
        fragments: list[Any],
    ) -> None:
        """累积流式 tool_calls 分片为完整工具调用列表。

        OpenAI 流式 function calling 分片规则:
        - 同一 index 的首个分片携带 id/type/function.name,arguments 从首段开始;
        - 后续分片仅含该 index 的 arguments 增量片段(可能跨多个 chunk);
        - 因此同 index 的 id/type 直接覆盖,function.name 直接覆盖,function.arguments 字符串拼接。

        支持两种分片形态:
        - provider 适配器产出的 dict 列表(openai_provider/stepfun_provider 的 tool_call 事件);
        - litellm delta.tool_calls 对象列表(遍历时归一化为 dict 再处理)。

        Args:
            acc: 累积字典 {index: 已合并的工具调用 dict},调用方在流开始时初始化。
            fragments: 单个 chunk 内的 tool_calls 分片列表。
        """
        for frag in fragments:
            if frag is None:
                continue
            if not isinstance(frag, dict):
                # litellm delta.tool_calls 为对象 → 归一化为 dict
                fn = getattr(frag, "function", None)
                frag = {
                    "index": getattr(frag, "index", 0),
                    "id": getattr(frag, "id", None),
                    "type": getattr(frag, "type", None),
                    "function": {
                        "name": getattr(fn, "name", None) if fn is not None else None,
                        "arguments": getattr(fn, "arguments", None) if fn is not None else None,
                    },
                }
            try:
                idx = int(frag.get("index", 0))
            except (TypeError, ValueError):
                idx = 0
            # 2026-08-29 修复:非 OpenAI 分片格式(gemini/ollama 等)不带 index 字段,
            # 且一次事件给完整调用。若多个调用全部落到 index 0 会互相覆盖(name 被覆盖、
            # arguments 被错误拼接),故缺 index 时自动分配递增序号。
            if "index" not in frag or frag.get("index") is None:
                idx = max(acc.keys()) + 1 if acc else 0
            entry = acc.setdefault(idx, {
                "index": idx,
                "id": "",
                "type": "function",
                "function": {"name": "", "arguments": ""},
            })
            if frag.get("id"):
                entry["id"] = frag["id"]
            if frag.get("type"):
                entry["type"] = frag["type"]
            fn = frag.get("function") or {}
            if isinstance(fn, dict):
                if fn.get("name"):
                    entry["function"]["name"] = fn["name"]
                arg_piece = fn.get("arguments") or ""
                if not isinstance(arg_piece, str):
                    # 非 OpenAI 流式分片(gemini/ollama 等)arguments 为 dict → 序列化拼接
                    try:
                        arg_piece = json.dumps(arg_piece, ensure_ascii=False)
                    except (TypeError, ValueError):
                        arg_piece = ""
                if arg_piece:
                    entry["function"]["arguments"] += arg_piece

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        _pool_retry: int = 0,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式调用 LLM,逐 token 产出。

        Yields:
            - {"type": "chunk", "content": "token 文本"}
            - {"type": "done", "model": ..., "usage": ..., "stub": bool}
            - {"type": "error", "message": ...}
        """
        # 2026-08-06 立:'auto' 模型走跨厂商自动路由(用户反馈"应该是自动切换所有可使用的模型")
        # 历史:之前 fallback 到 settings.litellm_model(默认 stepfun/step-router-v1),
        #       step-router-v1 只在 Step 厂家内部路由,不跨厂商,违背"全模型智能路由"语义。
        # 修复:调 _resolve_auto_model 从 model_availability 全量可用模型池选最优,
        #       优先 zero_cost / LOCAL → cheap plan → premium,tool calling 场景额外筛 function calling 支持。
        if not model or model == "auto":
            used_model = await _resolve_auto_model(
                has_tools=bool(kwargs.get("tools")),
                messages=messages,
            )
        elif model.lower() == "ihui/auto-model":
            # 2026-08-31 立:智汇 Auto-Model 服务端随机(成本可控版),与 complete() 同源
            used_model = _resolve_ihui_auto_model()
        else:
            used_model = model
        # P38 跨端同步:先修复结构异常,再修剪窗口(防御性兜底,与 complete() 同源)。
        # agent loop 消息流(tool role / 自定义 tool_calls)走专用修复(见 complete()),
        # chat API 消息走原 repair_messages,行为不变。
        if _is_agent_loop_messages(messages):
            repaired_messages, repair_removed = _repair_agent_loop_messages(messages)
            if repair_removed > 0:
                logger.info("agent_loop repair 修复 %d 条异常消息(astream)", repair_removed)
        else:
            repaired_messages, repair_removed, _ = repair_messages(messages, keep_trailing_user=True)
            if repair_removed > 0:
                logger.info("repair_messages 修复 %d 条异常消息(astream)", repair_removed)
        trimmed_messages = trim_messages(repaired_messages)

        # 可选 token 压缩(P3-1,与 complete() 同源):流式也要支持压缩
        trimmed_messages, compaction_info = await self._apply_token_compaction(
            trimmed_messages, used_model, has_tools="tools" in kwargs
        )

        # 厂商原生适配器(可选增强):tools 存在或 StepFun 模型时优先用厂商原生流式 API。
        # StepFun 的 LiteLLM 集成存在 buffering 问题,直接使用原生 httpx 流式可确保逐 chunk 输出。
        provider_code = _model_to_provider_code(used_model)
        if (("tools" in kwargs) or provider_code == "stepfun") and not self._is_stub_mode():
            provider = await self._get_provider(used_model, owner_uuid)
            if provider is not None:
                # P1 修复(2026-08-06): 用浅拷贝再 pop,避免破坏原 kwargs 的 tools,
                # 确保后续 LiteLLM 路径仍能透传 tools(function calling)。
                provider_kwargs = dict(kwargs)
                tools = provider_kwargs.pop("tools", None)
                astream_iter = provider.astream(
                    trimmed_messages, used_model, tools=tools, **provider_kwargs
                )
                # 2026-08-22 修复:原生适配器路径此前直接透传全部事件并 return,
                # error 事件绕过 LiteLLM 路径的流式兜底契约(默认模型 stepfun/* 必走
                # 本路径,流式失败时零兜底)。对齐契约:未发任何 chunk 前收到 error →
                # _astream_fallback_events 兜底;已发 chunk 后的 error 透传(不可撤回)。
                native_sent_content = False
                # 2026-08-29 修复:tool_calls 分片累积(此前把分片事件直接透传,
                # 调用方拿不到完整参数)。分片不透传,循环结束后统一 yield。
                native_tool_acc: dict[int, dict[str, Any]] = {}
                async for evt in astream_iter:
                    if (
                        isinstance(evt, dict)
                        and evt.get("type") == "error"
                        and not native_sent_content
                    ):
                        async for fb_evt in self._astream_fallback_events(
                            trimmed_messages,
                            used_model,
                            str(evt.get("message", "")) or "native provider stream failed",
                        ):
                            yield fb_evt
                        return
                    if isinstance(evt, dict) and evt.get("type") == "tool_call":
                        # 2026-08-29 修复:tool_call 分片按 index 累积,不透传
                        self._accumulate_tool_calls(
                            native_tool_acc, evt.get("tool_calls") or []
                        )
                        continue
                    if isinstance(evt, dict) and evt.get("type") in ("chunk", "reasoning"):
                        native_sent_content = True
                    yield evt
                # 2026-08-29 修复:流结束前统一产出累积后的完整 tool_calls(按 index 排序)
                if native_tool_acc:
                    yield {
                        "type": "tool_calls",
                        "tool_calls": [native_tool_acc[k] for k in sorted(native_tool_acc)],
                    }
                return

        if self._is_stub_mode():
            db_result = await _resolve_from_db(used_model, owner_uuid)
            if not db_result:
                result = await self.complete(messages, model=model, owner_uuid=owner_uuid)
                content = result.get("content", "")
                chunk_size = 10
                for i in range(0, len(content), chunk_size):
                    yield {"type": "chunk", "content": content[i : i + chunk_size]}
                # P0-B(2026-09-18):stub 兜底转发 complete 的 tool_calls(此前只转发
                # content,function calling 场景经 astream 会静默丢工具调用,与
                # complete() 契约不一致;对齐原生适配器/litellm 路径的聚合 tool_calls
                # 事件形状)。
                if result.get("tool_calls"):
                    yield {"type": "tool_calls", "tool_calls": result["tool_calls"]}
                yield {
                    "type": "done",
                    "model": result.get("model", used_model),
                    "usage": result.get("usage", {}),
                    "stub": True,
                }
                return
            api_key, api_base, real_model = db_result
            current_key_pool_id: str | None = None
        else:
            api_key, api_base, real_model, current_key_pool_id = await self._resolve(used_model, owner_uuid)

        # 累积 content/reasoning,用于 provider 不返回 stream_usage 时估算 token
        # 必须在 try 块之前初始化:若 try 内 import/raise 在赋值前抛异常,
        # except 块需引用 accumulated_content 判断是否已发送 chunk(决定是否 fallback)
        # (2026-07-27 修复 UnboundLocalError:之前在 try 内 line 1048 赋值,
        #  litellm import 失败或 api_key 校验 raise 时 except 引用未定义变量)
        accumulated_content = ""
        accumulated_reasoning = ""
        try:
            import litellm

            if not api_key:
                raise ValueError(
                    f"模型 {used_model} 对应的 provider API key 未配置,请在 .env 或 ai_model_config 表中设置"
                )
            call_kwargs: dict[str, Any] = {
                "model": real_model,
                "messages": trimmed_messages,
                "stream": True,
            }
            # 默认开启 stream_usage 用于流式 usage 统计,
            # 不支持的 provider(NVIDIA/StepFun/Agnes/Ollama/CF)由下方 filter_call_kwargs 自动移除
            call_kwargs["stream_usage"] = True
            # 按 provider capability 设默认 timeout(NVIDIA NIM=120s / Cloudflare=60s / 其他=30s)
            # 替代旧硬编码 nvidia 前缀 120s timeout 判断(P0 Phase A)
            provider_code = _model_to_provider_code(used_model)
            cap = get_provider_cap(provider_code)
            call_kwargs["timeout"] = cap.default_timeout
            # 免费 provider (api_key 为占位符) 不传 api_key,走匿名访问避免 402
            if api_key and api_key not in ("no-key-required", "free"):
                call_kwargs["api_key"] = api_key
            if api_base:
                # 批58:LLM_PROVIDER_CONFIG_ENABLED on 时经强类型配置归一(去末尾斜杠)
                call_kwargs["api_base"] = (
                    _normalize_provider_api_base(api_base)
                    if _llm_provider_config_enabled_from_env()
                    else api_base
                )
            call_kwargs.update(kwargs)
            # 批58:Responses header 注入 + 流式装配流选项(默认 off,on 时才追加)
            if _llm_responses_headers_enabled_from_env():
                _apply_responses_headers(call_kwargs)
            if _llm_responses_assembly_enabled_from_env():
                _apply_responses_stream_options(call_kwargs)
            # 按 capability 过滤不支持的参数(stream_usage/tools/response_format/temperature)
            filter_call_kwargs(call_kwargs, provider_code, used_model)
            # P3-3(2026-07-30):openrouter/ 前缀请求临时设置专用代理
            # 2026-08-01 P0:改为 async with + asyncio.Lock 防止并发 env var 竞态
            async with _openrouter_proxy_context(used_model):
                response = await litellm.acompletion(**call_kwargs)
            final_model = used_model
            final_usage: dict[str, Any] = {}
            # P0 修复:try/finally 确保客户端断开时显式关闭 litellm 响应流,防止 httpx 连接泄漏
            # 客户端中途断开 → GeneratorExit 从 async for 抛出,finally 仍会执行 aclose
            _stream_debug = True  # Force enable SSE debug logging
            _stream_last = time.perf_counter()
            _stream_count = 0
            # 2026-08-29 修复:litellm 流式 tool_calls 分片累积器(带 tools 的 astream 用),
            # 循环内累积 delta.tool_calls,流结束前统一以 tool_calls 事件产出。
            litellm_tool_acc: dict[int, dict[str, Any]] = {}
            _guard_fallback = False
            try:
                async for chunk in response:
                    if _is_stream_timeout_guard(chunk):
                        # 极速API 流式+tools 降级:45s 后仅回超时占位块。
                        # 放弃该流(下方 finally 关闭底层连接),改走非流式回退。
                        _guard_fallback = True
                        logger.warning(
                            "[llm_gateway] %s 流式返回 timeout-guard 占位(上游流式降级),自动回退非流式",
                            used_model,
                        )
                        break
                    if hasattr(chunk, "choices") and chunk.choices:
                        delta = chunk.choices[0].delta
                        token = getattr(delta, "content", None)
                        if token:
                            accumulated_content += token
                            if _stream_debug:
                                _stream_count += 1
                                now = time.perf_counter()
                                logger.debug(
                                    "[SSE-DEBUG] backend chunk #%s interval=%.1fms token=%r",
                                    _stream_count,
                                    (now - _stream_last) * 1000,
                                    token,
                                )
                                _stream_last = now
                            yield {"type": "chunk", "content": token}
                        reasoning_token = getattr(delta, "reasoning_content", None)
                        if reasoning_token:
                            accumulated_reasoning += reasoning_token
                            yield {"type": "reasoning", "content": reasoning_token}
                        # 2026-08-29 修复:litellm 路径此前忽略 delta.tool_calls,
                        # 带 tools 的 astream 拿不到 LLM 工具决策。分片按 index 累积。
                        delta_tool_calls = getattr(delta, "tool_calls", None)
                        if delta_tool_calls:
                            self._accumulate_tool_calls(litellm_tool_acc, delta_tool_calls)
                    if hasattr(chunk, "usage") and chunk.usage:
                        try:
                            final_usage = (
                                chunk.usage.model_dump()
                                if hasattr(chunk.usage, "model_dump")
                                else dict(chunk.usage)
                            )
                        except Exception as e:
                            logger.debug("chunk usage 序列化失败: %s", e)
                    if hasattr(chunk, "model") and chunk.model:
                        final_model = chunk.model
            finally:
                # 显式关闭流式响应,释放底层 httpx 连接(优先 aclose,降级 close)
                try:
                    aclose = getattr(response, "aclose", None)
                    if aclose is not None:
                        await aclose()
                    else:
                        close = getattr(response, "close", None)
                        if close is not None:
                            close()
                except Exception:
                    pass  # 已关闭或关闭失败不阻塞
            if _guard_fallback:
                # 流式降级回退(2026-09-18 立):同一参数改非流式重试(上游非流式路径
                # 正常),结果包装成等价事件流(content 分片/reasoning/tool_calls/
                # usage),复用下方统一的 tool_calls 产出、usage 兜底与 done 事件逻辑。
                fb_kwargs = {
                    k: v for k, v in call_kwargs.items() if k not in ("stream", "stream_usage")
                }
                fb_kwargs["stream"] = False
                async with _openrouter_proxy_context(used_model):
                    fb_resp = await litellm.acompletion(**fb_kwargs)
                fb_msg = fb_resp.choices[0].message
                fb_content = getattr(fb_msg, "content", None) or ""
                _FB_CHUNK_SIZE = 64
                for i in range(0, len(fb_content), _FB_CHUNK_SIZE):
                    seg = fb_content[i : i + _FB_CHUNK_SIZE]
                    accumulated_content += seg
                    yield {"type": "chunk", "content": seg}
                fb_reasoning = getattr(fb_msg, "reasoning_content", None)
                if fb_reasoning:
                    accumulated_reasoning += fb_reasoning
                    yield {"type": "reasoning", "content": fb_reasoning}
                fb_tools = getattr(fb_msg, "tool_calls", None)
                if fb_tools:
                    # 非流式完整 tool_calls 对象无 index,累积器自动分配递增序号
                    self._accumulate_tool_calls(litellm_tool_acc, fb_tools)
                if getattr(fb_resp, "usage", None):
                    try:
                        final_usage = (
                            fb_resp.usage.model_dump()
                            if hasattr(fb_resp.usage, "model_dump")
                            else dict(fb_resp.usage)
                        )
                    except Exception as e:
                        logger.debug("回退 usage 序列化失败: %s", e)
                if getattr(fb_resp, "model", None):
                    final_model = fb_resp.model
                logger.info(
                    "[llm_gateway] %s 非流式回退完成(content=%d chars, tools=%d)",
                    used_model,
                    len(fb_content),
                    len(fb_tools) if fb_tools else 0,
                )
            # 2026-08-29 修复:tool_calls 分片累积完成后,在 done 事件之前统一产出完整列表
            if litellm_tool_acc:
                yield {
                    "type": "tool_calls",
                    "tool_calls": [litellm_tool_acc[k] for k in sorted(litellm_tool_acc)],
                }
            # provider 不返回 stream_usage(如 StepFun)时,用 litellm.token_counter 估算兜底
            if not final_usage:
                try:
                    est_model = real_model or used_model
                    prompt_tokens = litellm.token_counter(model=est_model, messages=trimmed_messages)
                    completion_tokens = litellm.token_counter(
                        model=est_model, text=accumulated_content + accumulated_reasoning
                    )
                    final_usage = {
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": prompt_tokens + completion_tokens,
                        "estimated": True,
                    }
                    logger.info(
                        "provider 未返回 stream_usage,已用 token_counter 估算: %s",
                        final_usage,
                    )
                except Exception as est_err:
                    logger.warning("token_counter 估算失败,usage 保持空: %s", est_err)
            # P0-5c:号池 key 调用成功 → 标记 healthy(恢复 degraded/unknown 状态)
            if current_key_pool_id:
                await KeyPoolSelector.mark_key_healthy(current_key_pool_id)
            yield {
                "type": "done",
                "model": final_model,
                "usage": final_usage,
                "stub": False,
                **({"compaction": compaction_info} if compaction_info is not None else {}),
            }
        except Exception as e:
            safe_msg = str(e)
            err_code = "LLM_ERROR"
            if "API key 未配置" in safe_msg or "未配置" in safe_msg:
                err_code = "MODEL_NOT_CONFIGURED"
            elif "NotImplemented" in safe_msg:
                err_code = "PROVIDER_NOT_IMPLEMENTED"
            else:
                for key_field in ("api_key", "apikey", "authorization"):
                    if key_field in safe_msg.lower():
                        safe_msg = f"LLM 流式调用失败(含敏感信息已脱敏): {type(e).__name__}"
                        break
            # 流式中断标记:已发过 chunk 的流式调用失败时,不可中途切换 provider,
            # 标记 partial_done 让前端知道流被异常截断(收到的是部分内容),避免半截内容 + error 的混淆
            if accumulated_content or accumulated_reasoning:
                logger.warning(
                    "astream 流式中断:已发 content_len=%d reasoning_len=%d,异常=%s: %s,标记 partial_done",
                    len(accumulated_content), len(accumulated_reasoning), type(e).__name__, safe_msg,
                )
                # P0-5c:号池 key 流式中断 → 仍标记失败(下次选 key 时降级)
                if current_key_pool_id:
                    await KeyPoolSelector.mark_key_failed(current_key_pool_id, str(e))
                yield {
                    "type": "partial_done",
                    "fallback_applied": False,
                    "reason": "stream_interrupted",
                    "model": used_model,
                }
                return
            # P0-5c:号池故障转移 — 标记失败 + 递归重试(最多 3 次,换 key 再试)
            # 仅在未发送任何 chunk 时重试(已发送 chunk 不可撤回,无法中途换 key)
            # 重试优先于 FallbackRouter(同模型换 key < 换模型兜底)
            if (
                current_key_pool_id is not None
                and _pool_retry < 3
                and not accumulated_content
                and not accumulated_reasoning
            ):
                await KeyPoolSelector.mark_key_failed(current_key_pool_id, str(e))
                logger.info(
                    "[key_pool] astream key %s 失败(retry %d/3),换 key 重试: %s",
                    current_key_pool_id, _pool_retry + 1, str(e)[:200],
                )
                # D34(2026-09-22,G-44):把"正在第 N/M 次重试"交到流上,界面才能出重试条
                # 而不是静默等待。字段严格取契约声明的四项(sse_contract.py /
                # packages/shared/src/sse/contract.ts 的 retry_scheduled);本路径是
                # **换 key 立即重试**,故 retryInMs=0(带退避延迟的那条在
                # agent_loop_v2 的 decide_stream_retry 侧,属 D39,未在此伪造延迟)。
                _retry_status = getattr(e, "status_code", None) or getattr(
                    getattr(e, "response", None), "status_code", None
                )
                yield {
                    "type": "retry_scheduled",
                    "attempt": _pool_retry + 1,
                    "maxRetries": 3,
                    "retryInMs": 0,
                    "httpStatus": _retry_status if isinstance(_retry_status, int) else None,
                }
                async for evt in self.astream(
                    messages,
                    model=model,
                    owner_uuid=owner_uuid,
                    _pool_retry=_pool_retry + 1,
                    **kwargs,
                ):
                    yield evt
                return
            # P3-3 OpenRouter 403 failover(2026-07-30):openrouter/<model> 返回 403 时,
            # 自动 failover 到 agnes/<model>(仅未发送 chunk 时,已发送 chunk 不可撤回)
            # _is_openrouter_403_error 天然防递归:agnes/ 前缀不匹配 openrouter/ 判断
            if (
                settings.openrouter_failover_to_agnes
                and _is_openrouter_403_error(used_model, e)
                and not accumulated_content
                and not accumulated_reasoning
            ):
                agnes_model = _failover_openrouter_to_agnes(used_model)
                if agnes_model:
                    logger.info(
                        "astream OpenRouter 403 failover: %s → %s",
                        used_model, agnes_model,
                    )
                    try:
                        LLM_FALLBACK_TRIGGERED.labels(
                            primary_model=used_model,
                            backup_model=agnes_model,
                            reason="openrouter_403",
                        ).inc()
                    except Exception as metric_err:
                        logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
                    yield {
                        "type": "fallback",
                        "primary_model": used_model,
                        "backup_model": agnes_model,
                        "reason": "openrouter_403",
                    }
                    async for evt in self.astream(
                        messages,
                        model=agnes_model,
                        owner_uuid=owner_uuid,
                        **kwargs,
                    ):
                        yield evt
                    return
            # 流式 fallback:仅在未发送任何 chunk 时尝试 fallback provider
            # (已发送 chunk 不可撤回,无法中途切换 provider)
            if (
                err_code == "LLM_ERROR"
                and not accumulated_content
                and not accumulated_reasoning
                and (fallback_router._configs or is_quota_exhaustion_error(e))
            ):
                fb_reason = classify_fallback_reason(e)
                try:
                    fb_result = await fallback_router.complete_with_fallback(
                        trimmed_messages, used_model, primary_error=e
                    )
                    if not fb_result.get("error"):
                        # fallback 返回的是完整结果(非流式),拆成 chunk 产出
                        fb_content = fb_result.get("content", "") or ""
                        backup_model = fb_result.get("model", "unknown")
                        # P3-2 指标埋点:fallback 触发 + 成功
                        try:
                            LLM_FALLBACK_TRIGGERED.labels(
                                primary_model=used_model,
                                backup_model=backup_model,
                                reason=fb_reason,
                            ).inc()
                            LLM_FALLBACK_SUCCESS.labels(
                                primary_model=used_model,
                                backup_model=backup_model,
                            ).inc()
                        except Exception as metric_err:
                            logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
                        # P4-2: 提前发送 fallback 通知事件,让前端感知模型切换
                        # 在 chunk 产出之前 yield,前端据此展示"已切换到备用模型"横幅
                        yield {
                            "type": "fallback",
                            "primary_model": used_model,
                            "backup_model": backup_model,
                            # 换到同族等效模型时 reason 变 'quota_equivalent'(既有字段,不新增键)
                            "reason": str(fb_result.get("fallback_reason") or fb_reason),
                        }
                        chunk_size = 10
                        for i in range(0, len(fb_content), chunk_size):
                            yield {"type": "chunk", "content": fb_content[i : i + chunk_size]}
                        yield {
                            "type": "done",
                            "model": backup_model,
                            "usage": fb_result.get("usage", {}),
                            "stub": False,
                            "fallback_used": True,
                            "fallback_primary": used_model,
                        }
                        return
                    # P3-2 指标埋点:fallback 触发 + 失败(所有备用 provider 均失败)
                    try:
                        LLM_FALLBACK_TRIGGERED.labels(
                            primary_model=used_model,
                            backup_model="all_failed",
                            reason=fb_reason,
                        ).inc()
                        LLM_FALLBACK_FAILURE.labels(
                            primary_model=used_model,
                            backup_model="all_failed",
                        ).inc()
                    except Exception as metric_err:
                        logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
                    if fb_result.get("quota_exhausted"):
                        # 透传"哪家、因为什么",否则调用方只看到主通道那一条上游错误
                        safe_msg = f"{safe_msg} | {fb_result.get('error')}"
                        # 稳定错误码:仅"确因额度且同名+同族改道已穷尽"时替换 LLM_ERROR
                        err_code = str(
                            fb_result.get("errorCode") or PROVIDER_QUOTA_EXHAUSTED
                        )
                except Exception as fb_err:
                    logger.warning("astream fallback 失败: %s", fb_err)
                    # P3-2 指标埋点:fallback 触发 + 失败(fallback_router 自身抛异常)
                    try:
                        LLM_FALLBACK_TRIGGERED.labels(
                            primary_model=used_model,
                            backup_model="all_failed",
                            reason=fb_reason,
                        ).inc()
                        LLM_FALLBACK_FAILURE.labels(
                            primary_model=used_model,
                            backup_model="all_failed",
                        ).inc()
                    except Exception as metric_err:
                        logger.warning("LLM_FALLBACK 指标记录失败(忽略): %s", metric_err)
            yield {"type": "error", "message": safe_msg, "errorCode": err_code}

    async def embed(
        self,
        text: str,
        model: str | None = None,
    ) -> list[float]:
        """生成文本的嵌入向量。

        stub 模式下返回确定性哈希向量(便于测试,无语义意义)。
        """
        used_model = model or getattr(settings, "embedding_model", "text-embedding-3-small")

        if self._is_stub_mode():
            import hashlib

            vector = []
            for i in range(384):
                h = hashlib.sha256(f"{text}:{i}".encode()).hexdigest()
                vector.append((int(h[:8], 16) % 1000) / 1000.0)
            return vector

        import litellm

        response = await litellm.aembedding(model=used_model, input=text)
        return cast(list[float], response.data[0]["embedding"])


llm_gateway = LLMGateway()


# ---------------------------------------------------------------------------
# MoA / Fallback / CredentialPool(P2-2,对标 Hermes Agent provider 扩展)
# ---------------------------------------------------------------------------


class MoARouter:
    """Mixture of Agents 路由器 — 多模型出方案 + 聚合。

    对齐 packages/types 的 MoaPreset 契约:
    - preset.models 中 role=proposer 的模型并行出方案
    - role=aggregator 的模型聚合所有 proposer 方案
    - role=critic 的模型对聚合结果做批判(可选,本轮未实现)
    """

    def __init__(self) -> None:
        self._presets: dict[str, dict[str, Any]] = {}

    def register_preset(self, name: str, preset: dict[str, Any]) -> None:
        """注册 MoA 预设。"""
        self._presets[name] = preset

    def list_presets(self) -> list[dict[str, Any]]:
        """列出所有预设。"""
        return list(self._presets.values())

    async def complete(self, messages: list[dict[str, Any]], preset_name: str) -> dict[str, Any]:
        """MoA 推理:多 proposer 出方案 → aggregator 聚合。

        流程:
        1. 取 preset.models 中 role=proposer 的模型,并行调用各自出方案
        2. 取 role=aggregator 的模型,把所有 proposer 方案喂给它聚合
        3. role=critic 的模型对聚合结果做批判(可选,本轮透传不实现)
        4. 返回最终聚合结果
        """
        import asyncio as _asyncio

        preset = self._presets.get(preset_name)
        if not preset:
            return {"content": "", "error": f"preset not found: {preset_name}"}

        models = preset.get("models", [])
        proposers = [m for m in models if m.get("role") == "proposer"]
        aggregators = [m for m in models if m.get("role") == "aggregator"]

        if not proposers:
            return {"content": "", "error": "no proposer models in preset"}

        # 1. 并行出方案(return_exceptions=True 防止单个失败导致整体崩溃)
        proposals = await _asyncio.gather(*[
            llm_gateway.complete(messages, model=m["model"])
            for m in proposers
        ], return_exceptions=True)

        # 2. 聚合(有 aggregator 时综合,无 aggregator 时取第一个成功方案)
        if aggregators:
            agg_model = aggregators[0]["model"]
            proposal_texts = [
                p.get("content", "") for p in proposals
                if isinstance(p, dict) and p.get("content")
            ]
            if not proposal_texts:
                return {"content": "", "error": "all proposers returned empty"}
            agg_messages = messages + [{
                "role": "user",
                "content": (
                    "以下是多个模型的回答,请综合给出最佳答案:\n\n"
                    + "\n\n---\n\n".join(proposal_texts)
                ),
            }]
            return await llm_gateway.complete(agg_messages, model=agg_model)

        # 无 aggregator:返回第一个非异常方案
        for p in proposals:
            if isinstance(p, dict) and not p.get("error"):
                return p
        return {"content": "", "error": "all proposers failed"}


# P2 修复:fallback 阶段单次请求级 token budget 上限,防止超大 prompt 重发到 fallback provider
# 粗略估算:1 token ≈ 4 字符(中英文混合),32K token 上限 ≈ 128K 字符
_MAX_FALLBACK_PROMPT_CHARS = 128_000


class FallbackRouter:
    """Provider 故障转移路由器。

    对齐 packages/types 的 ProviderFallbackConfig 契约:
    - 先调 primary provider
    - 失败且错误类型在 triggerOnError 中时,依次尝试 fallbacks
    - 全部失败返回错误
    """

    def __init__(self) -> None:
        self._configs: dict[str, dict[str, Any]] = {}

    def configure(self, provider: str, config: dict[str, Any]) -> None:
        """配置故障转移。"""
        self._configs[provider] = config

    def get_config(self, provider: str) -> dict[str, Any]:
        """获取故障转移配置。"""
        return self._configs.get(provider, {})

    async def complete_with_fallback(
        self,
        messages: list[dict[str, Any]],
        primary: str,
        *,
        primary_error: BaseException | str | None = None,
    ) -> dict[str, Any]:
        """带故障转移的推理。

        primary 已在 llm_gateway.complete() 的 except 块中失败,此处只尝试 fallbacks。
        传 _skip_fallback=True 防止 fallback provider 失败时再次触发 fallback_router(防递归)。

        1. 依次尝试 fallbacks 列表中的 provider
        2. 全部失败返回错误

        P2 修复(防重试放大):
        - 单次请求级 token budget 检查:prompt 超大(>128K 字符)时直接拒绝 fallback,
          避免无谓消耗 fallback 配额(主 provider 可能因 prompt 超限失败,fallback 同样会失败)。
        - fallback 阶段禁用 LiteLLM 重试(num_retries=0):原 complete() 默认 num_retries=2,
          N 个 fallback provider × 2 次重试 = 2N 次请求,主+fallback 双故障时形成重试放大。
          fallback 是兜底路径,失败应快速返回错误,不重试。

        额度耗尽专用分支(2026-09-22 批次 59):primary_error 被判为账号额度类错误时,
        把同一模型在其他厂商的可用通道也送进候选,并把"已确认没钱"的厂商记进本请求黑名单
        —— 欠费是厂商级状态,换 key 或重试同一家都不可能有结果。

        批次 60 补第二档:同名通道全部用尽后,再退到"同族等效模型"
        (_find_quota_equivalent_channels)。顺序 = 同名其他通道 > 同族替代 > 报错;
        换到不同模型时结果带 fallback_reason='quota_equivalent',绝不静默替换。
        三条都失败时按 `模型[厂商]=错误码` 点名归因,并回 PROVIDER_QUOTA_EXHAUSTED
        错误码供前端精准提示。
        """
        config = self._configs.get(primary, {})
        candidates: list[str] = [
            str(p) for p in config.get("fallbacks", []) if isinstance(p, str)
        ]

        # P2 修复:单次请求级 token budget 检查
        # 粗略估算 messages 总字符数,超过 128K 字符(≈32K token)直接拒绝 fallback
        total_chars = sum(
            len(str(m.get("content", ""))) for m in messages if isinstance(m, dict)
        )
        if total_chars > _MAX_FALLBACK_PROMPT_CHARS:
            logger.warning(
                "complete_with_fallback 拒绝重发超大 prompt"
                "(total_chars=%d > %d),避免 fallback 配额耗尽(primary=%s)",
                total_chars, _MAX_FALLBACK_PROMPT_CHARS, primary,
            )
            return {
                "content": "",
                "error": (
                    f"prompt too large for fallback"
                    f" (total_chars={total_chars} > {_MAX_FALLBACK_PROMPT_CHARS})"
                ),
            }

        # 延迟导入避免循环(llm_gateway ↔ model_availability)
        from ..services.model_availability import model_availability

        quota_hit = is_quota_exhaustion_error(primary_error)
        blocked_providers: set[str] = set()
        primary_provider = ""
        if quota_hit:
            primary_provider = await _resolve_provider_code(primary)
            if primary_provider:
                blocked_providers.add(primary_provider)
                await model_availability.mark_provider_quota_exhausted(
                    primary_provider, describe_quota_error(primary_error)
                )
            candidates.extend(
                await _find_quota_alternate_channels(primary, blocked_providers)
            )
            logger.info(
                "[quota-failover] %s 额度耗尽,替代通道=%s(跳过厂商=%s)",
                primary, candidates, sorted(blocked_providers) or "-",
            )

        # 第二档(同族等效)惰性加载:同名通道里任一能成就不必多打一次 DB,
        # 也保证优先级严格为 同名其他通道 > 同族替代 > 报错。
        equivalents: list[str] = []
        equivalents_loaded = not quota_hit

        last_error: str | None = None
        attempts: list[str] = []
        cursor = 0
        while True:
            if cursor >= len(candidates):
                if equivalents_loaded:
                    break
                equivalents_loaded = True
                equivalents = await _find_quota_equivalent_channels(
                    primary, blocked_providers
                )
                if equivalents:
                    logger.info(
                        "[quota-equivalent] %s 无可用同名通道,同族等效候选=%s",
                        primary, equivalents,
                    )
                candidates.extend(equivalents)
                continue
            provider = candidates[cursor]
            cursor += 1
            # 非额度分支保持纯前缀归因(provider_code 只服务于额度黑名单与点名归因,
            # 不参与该分支的返回文案)—— 普通故障转移不得因为归属查询多打一次 DB。
            provider_code = (
                await _resolve_provider_code(provider)
                if quota_hit
                else _explicit_provider_code_of(provider)
            )
            if provider_code and provider_code in blocked_providers:
                continue
            try:
                # P2 修复:fallback 阶段 num_retries=0,防止重试放大
                # 主 provider 已失败,fallback 也失败时重试只是浪费资源,应快速返回错误
                result = await llm_gateway.complete(
                    messages, model=provider, _skip_fallback=True,
                    num_retries=0,
                )
                if not result.get("error"):
                    if provider in equivalents:
                        # 不许静默替换:换到不同模型时把这一点标出来,
                        # 由 astream 的 fallback 事件 reason / complete 的 fallback_reason 回给调用方
                        result["fallback_reason"] = FALLBACK_REASON_QUOTA_EQUIVALENT
                    return result
                last_error = result.get("error_message") or result.get("error")
            except Exception as e:
                last_error = str(e)
            err_text = str(last_error or "")
            provider_quota = bool(provider_code) and is_quota_exhaustion_error(err_text)
            if provider_quota:
                await model_availability.mark_provider_quota_exhausted(
                    provider_code, describe_quota_error(err_text)
                )
                blocked_providers.add(provider_code)
            reason = describe_quota_error(err_text) if provider_quota else "其他错误"
            attempts.append(f"{provider}[{provider_code or '-'}]={reason}")

        if quota_hit:
            trail = [f"{primary}[{primary_provider or '-'}]={describe_quota_error(primary_error)}"]
            trail.extend(attempts)
            return {
                "content": "",
                "error": "所有通道均因账号额度耗尽失败: " + "; ".join(trail),
                "quota_exhausted": True,
                "errorCode": PROVIDER_QUOTA_EXHAUSTED,
            }
        return {"content": "", "error": f"all fallbacks failed: {last_error}"}


class CredentialPool:
    """凭证池 — 多 API key 轮询。

    对齐 packages/types 的 CredentialPoolConfig 契约:
    - round_robin 策略:按顺序轮询
    - random 策略:随机选择
    """

    def __init__(self) -> None:
        self._pools: dict[str, dict[str, Any]] = {}

    def configure(
        self, provider: str, keys: list[str], strategy: str = "round_robin"
    ) -> None:
        """配置凭证池。"""
        self._pools[provider] = {"keys": keys, "index": 0, "strategy": strategy}

    def get_key(self, provider: str) -> str | None:
        """获取下一个 key(按轮询策略)。"""
        pool = self._pools.get(provider)
        if not pool or not pool["keys"]:
            return None
        keys = pool["keys"]
        if pool["strategy"] == "random":
            import random
            return cast(str, random.choice(keys))
        # round_robin(默认)
        key = keys[pool["index"] % len(keys)]
        pool["index"] += 1
        return cast(str, key)

    def get_pool_info(self, provider: str) -> dict[str, Any]:
        """获取凭证池信息(不含实际 key)。"""
        pool = self._pools.get(provider)
        if not pool:
            return {}
        return {
            "key_count": len(pool["keys"]),
            "strategy": pool["strategy"],
            "current_index": pool["index"],
        }


moa_router = MoARouter()
fallback_router = FallbackRouter()
credential_pool = CredentialPool()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

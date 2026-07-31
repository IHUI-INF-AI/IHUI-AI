"""LiteLLM 网关。

配置优先级:ai_model_config 表(ownerUuid/providerCode 匹配) > .env 环境变量 > stub 降级。
无 key 时降级为 stub(返回固定响应),便于本地开发与测试。
支持流式输出(litellm.acompletion stream=True),stub 模式下模拟分块。
"""

import base64
import json
import logging
import os
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, AsyncIterator, Optional, TYPE_CHECKING, cast

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
)
from ..services.tls_stealth import create_stealth_client, get_stealth_headers
from .config import settings
from .context_compaction import estimate_messages_tokens
from .db_pool import get_shared_pool
from .provider_caps import filter_call_kwargs, get_provider_cap

# Combo 多级 fallback 路由器(2026-07-30 立,P0-1 Combo 接入 LLM 调用链)
# 延迟导入避免循环依赖(combo_router.py 内部反向 import llm_gateway)
_COMBO_ROUTER = None  # type: Optional[Any]


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
    from ..providers import get_provider as _get_native_provider
    from ..providers.base_provider import BaseProvider, ProviderError

logger = logging.getLogger(__name__)

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
_http_client: Optional[httpx.AsyncClient] = None


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
    """关闭全局 httpx.AsyncClient(main.py shutdown 调用)。"""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
        logger.info("global httpx.AsyncClient closed")


# 修复(2026-07-28):复用 app.core.db_pool 共享 pool,避免 14 个独立 pool 打满 max_connections。
# 保留 _get_pool 函数签名(向后兼容),内部委托给 get_shared_pool()。
async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(复用 app.core.db_pool 共享 pool)。"""
    return await get_shared_pool()


# P0-5c(2026-07-30):中转站 Key 池选择器(查 ai_relay_key_pool 表,多 key 负载均衡 + 故障转移)
# 模块级导入安全:key_pool_selector.py 内部对 llm_gateway 符号用懒导入,无循环依赖
from ..services.key_pool_selector import KeyPoolSelector


def _decrypt_api_key(api_key_enc: Optional[str]) -> Optional[str]:
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
    "qwen": "qwen",
    "qwen-": "qwen",
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
    "pollinations/": "pollinations",
    "llm7/": "llm7",
    "ovh/": "ovh",
    "aihorde/": "aihorde",
    "reka/": "reka",
    "routeway/": "routeway",
    "bazaarlink/": "bazaarlink",
    "ainative/": "ainative",
}


def _model_to_provider_code(model: str) -> str:
    m = model.lower()
    for prefix, code in _PREFIX_TO_PROVIDER_CODE.items():
        if m.startswith(prefix):
            return code
    return "openai"


async def _resolve_from_db(
    model: str,
    owner_uuid: Optional[str] = None,
) -> Optional[tuple[str | None, str | None, str | None]]:
    """从 ai_model_config 表查询配置,返回 (api_key, api_base, litellm_model) 或 None。

    优先 owner_uuid 匹配的用户私有配置,兜底 owner_uuid IS NULL 的全局配置。
    """
    provider_code = _model_to_provider_code(model)
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
        base_url = row["base_url"] or None
        api_format = row["api_format"] or "openai_chat"
        real_model = model.split("/", 1)[1] if "/" in model else model
        if api_format == "anthropic_messages":
            litellm_model = model if "/" in model else f"anthropic/{model}"
        elif provider_code == "openrouter":
            # P0-5m(2026-07-30):OpenRouter 需要走 LiteLLM 原生 openrouter/ 路由,
            # 不能转成 openai/(否则 LiteLLM 走 OpenAI 路由不传 Auth header)。
            # model 已含 openrouter/ 前缀(如 openrouter/deepseek/deepseek-v4-pro),原样返回。
            litellm_model = model
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


def repair_messages(messages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int, list[str]]:
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
    if cleaned and cleaned[-1].get("role") == "user":
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
    if "auth" in err_type or "forbidden" in err_type or "permission" in err_type:
        return True
    return False


def _failover_openrouter_to_agnes(model: str) -> Optional[str]:
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


@contextmanager
def _openrouter_proxy_context(model: str) -> Iterator[None]:
    """临时为 OpenRouter 请求设置专用代理(P3-3)。

    LiteLLM 底层 httpx 读取 HTTPS_PROXY / HTTP_PROXY env var,
    本函数在 openrouter/ 前缀调用期间临时设置 settings.openrouter_proxy_url,
    调用结束后恢复原值。仅对 openrouter/ 前缀模型生效,其他模型直接 yield。

    注意:env var 方式在并发场景下有竞态风险(多 OpenRouter 请求并行时互相干扰),
    但 LiteLLM 不支持 per-call proxy 参数,这是当前最优方案。生产环境如需严格隔离,
    应在进程级配置不同 worker 分别处理 OpenRouter 流量。

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


class LLMGateway:
    """LLM 调用网关,封装 LiteLLM 并提供 stub 降级。"""

    # P0-5c:当前请求选中的 key_pool_id(供 complete/astream 故障转移标记用)
    # _resolve 设置,complete/astream 在 await 前读取到局部变量(无 race:中间无 await 点)
    _current_key_pool_id: Optional[str] = None

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
        # 第二层:os.environ 检查所有 LiteLLM 一等公民厂商 key
        # 用户在 .env 直接配 GROQ_API_KEY / XAI_API_KEY / DEEPSEEK_API_KEY 等也立即激活
        # 前缀列表对应 _PREFIX_TO_PROVIDER_CODE 全部 30+ 厂商
        vendor_env_keys = [
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
        ]
        return not any(os.environ.get(k) for k in vendor_env_keys)

    @staticmethod
    def _resolve_provider(model: str) -> tuple[str | None, str | None, str | None]:
        """根据 model 前缀匹配 .env provider,返回 (api_key, api_base, litellm_model)。

        2026-07-25 改造:统一走 settings.get_provider_config(name),优先 LLM_PROVIDERS
        JSON 配置,降级旧扁平字段(向后兼容)。新增 provider 只需改 .env,零代码改动。

        前缀约定:
        - stepfun/*  → STEPFUN_API_KEY + STEPFUN_API_BASE(OpenAI 兼容)
        - agnes/*    → AGNES_API_KEY + AGNES_API_BASE(OpenAI 兼容)
        - groq/*     → GROQ_API_KEY(LiteLLM 原生)
        - gemini/*   → GEMINI_API_KEY(LiteLLM 原生)
        - openrouter/* → OPENROUTER_API_KEY(LiteLLM 原生)
        - claude-*/anthropic/* → ANTHROPIC_API_KEY(LiteLLM 原生)
        - ollama/*   → OLLAMA_API_BASE(LiteLLM 原生,默认 http://localhost:11434)
        - azure/*    → AZURE_API_KEY + AZURE_API_BASE + AZURE_API_VERSION(LiteLLM 原生)
        - bedrock/*  → AWS_ACCESS_KEY_ID 等(LiteLLM 原生)
        - gpt-*/o1-* 等 → OPENAI_API_KEY(默认)
        """
        m = model.lower()
        if m.startswith("stepfun/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("stepfun")
            return cfg.api_key, cfg.api_base, f"openai/{real_model}"
        if m.startswith("agnes/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("agnes")
            return cfg.api_key, cfg.api_base, f"openai/{real_model}"
        if m.startswith("groq/"):
            cfg = settings.get_provider_config("groq")
            return cfg.api_key, cfg.api_base or None, model
        if m.startswith("gemini/"):
            cfg = settings.get_provider_config("gemini")
            return cfg.api_key, cfg.api_base or None, model
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
        # Cloudflare Workers AI:模型 ID 以 @cf/ 开头,API base 含 account_id
        if m.startswith(("cloudflare/", "@cf/")):
            real_model = model.split("/", 1)[1] if m.startswith("cloudflare/") else model
            cfg = settings.get_provider_config("cloudflare")
            # 阶段 3 主体:cloudflare_account_id 字段已删除,api_base 必须配置完整 URL
            # (含 account_id,如 https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1)
            if not cfg.api_key or not cfg.api_base:
                return None, None, real_model
            return cfg.api_key, cfg.api_base, f"openai/{real_model}"
        if m.startswith("nvidia/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("nvidia")
            return cfg.api_key or None, cfg.api_base or "https://integrate.api.nvidia.com/v1", f"openai/{real_model}"
        if m.startswith("github/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("github")
            return cfg.api_key or None, cfg.api_base or "https://models.inference.ai.azure.com", f"openai/{real_model}"
        if m.startswith("vercel/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("vercel")
            return cfg.api_key or None, cfg.api_base or "https://ai-gateway.vercel.sh/v1", f"openai/{real_model}"
        if m.startswith("opencode/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("opencode")
            return cfg.api_key or None, cfg.api_base or "https://opencode.ai/zen/v1", f"openai/{real_model}"
        if m.startswith("modal/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("modal")
            return cfg.api_key or None, cfg.api_base or "https://modal.com/v1", f"openai/{real_model}"
        if m.startswith("inferencenet/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("inference_net")
            return cfg.api_key or None, cfg.api_base or "https://api.inference.net/v1", f"openai/{real_model}"
        if m.startswith("nlpcloud/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("nlp_cloud")
            return cfg.api_key or None, cfg.api_base or "https://api.nlpcloud.io/v1", f"openai/{real_model}"
        if m.startswith("scaleway/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("scaleway")
            return cfg.api_key or None, cfg.api_base or "https://api.scaleway.ai/ai-platform/v1", f"openai/{real_model}"
        if m.startswith("alibaba-intl/"):
            real_model = model.split("/", 1)[1]
            cfg = settings.get_provider_config("alibaba_intl")
            return cfg.api_key or None, cfg.api_base or "https://bailian-intl.alibabacloud.com/compatible-mode/v1", f"openai/{real_model}"
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

    async def _get_provider(
        self,
        model: str,
        owner_uuid: Optional[str] = None,
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
            api_key, api_base, _ = await self._resolve(model, owner_uuid)
        if not api_key:
            return None
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
        owner_uuid: Optional[str] = None,
    ) -> tuple[str | None, str | None, str | None]:
        """优先 BYOK → 号池 → .env(三层优先级)。

        1. BYOK 用户私有配置(_resolve_from_db 查 ai_model_config WHERE owner_uuid=?)
        2. 中转站号池(KeyPoolSelector 查 ai_relay_key_pool WHERE provider_code=?)
        3. .env 单 key(_resolve_provider 兜底)

        号池命中时:self._current_key_pool_id 设为选中 key 的 id(供 complete/astream
        故障转移标记用);BYOK/.env 路径置 None。
        """
        # 1. BYOK 用户私有配置
        db_result = await _resolve_from_db(model, owner_uuid)
        if db_result:
            self._current_key_pool_id = None
            return db_result

        # 2. 号池(中转站模式):查 ai_relay_key_pool
        provider_code = KeyPoolSelector.model_to_provider_code(model)
        pool_key = await KeyPoolSelector.select_key(provider_code)
        if pool_key is not None:
            # base_url 仍从 .env provider config 读(号池只管 key 轮换)
            # litellm_model 走 _resolve_provider 的前缀处理(去前缀 + 加 openai/ 等)
            cfg = settings.get_provider_config(provider_code)
            _, _, litellm_model = self._resolve_provider(model)
            self._current_key_pool_id = pool_key["key_pool_id"]
            return pool_key["api_key"], cfg.api_base or None, litellm_model

        # 3. .env 单 key 兜底
        self._current_key_pool_id = None
        return self._resolve_provider(model)

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

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: Optional[str] = None,
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
        used_model = model or settings.litellm_model
        # P38 跨端同步:先修复结构异常,再修剪窗口(防御性兜底,与 API /chat/stream 同源)
        repaired_messages, repair_removed, _ = repair_messages(messages)
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
                    tools = kwargs.pop("tools", None)
                    return await provider.complete(
                        trimmed_messages, used_model, tools=tools, **kwargs
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
            current_key_pool_id: Optional[str] = None
        else:
            api_key, api_base, real_model = await self._resolve(used_model, owner_uuid)
            # 立即读取到局部变量(无 await 点,无 race)供故障转移标记用
            current_key_pool_id = self._current_key_pool_id

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
            # 替代旧硬编码 `if used_model.startswith("nvidia/"): 120 else 30`(P0 Phase A)
            provider_code = _model_to_provider_code(used_model)
            cap = get_provider_cap(provider_code)
            call_kwargs["timeout"] = cap.default_timeout
            call_kwargs["num_retries"] = 2
            call_kwargs.update(kwargs)
            # 按 capability 过滤不支持的参数(stream_usage/tools/response_format/temperature)
            filter_call_kwargs(call_kwargs, provider_code, used_model)
            # P3-3(2026-07-30):openrouter/ 前缀请求临时设置专用代理
            with _openrouter_proxy_context(used_model):
                response = await litellm.acompletion(**call_kwargs)
            usage = response.usage
            usage_dict: dict[str, Any] = {}
            if usage is not None:
                usage_dict = (
                    usage.model_dump() if hasattr(usage, "model_dump") else dict(usage)
                )
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
            if (
                err_code == "LLM_ERROR"
                and not _skip_fallback
                and fallback_router._configs
            ):
                fb_result = await fallback_router.complete_with_fallback(
                    trimmed_messages, used_model
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
                "errorCode": err_code,
            }

    async def structured_completion(
        self,
        messages: list[dict[str, Any]],
        schema: dict[str, Any],
        model: str | None = None,
        *,
        owner_uuid: Optional[str] = None,
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
                    extra = [k for k in parsed.keys() if k not in allowed]
                    if extra:
                        last_error = f"unexpected fields: {extra}"
                        if attempt < max_retries:
                            continue
                        return {"error": True, "error_message": last_error}

            return parsed

        return {"error": True, "error_message": last_error or "unknown"}

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: Optional[str] = None,
        _pool_retry: int = 0,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式调用 LLM,逐 token 产出。

        Yields:
            - {"type": "chunk", "content": "token 文本"}
            - {"type": "done", "model": ..., "usage": ..., "stub": bool}
            - {"type": "error", "message": ...}
        """
        used_model = model or settings.litellm_model
        # P38 跨端同步:先修复结构异常,再修剪窗口(防御性兜底,与 API /chat/stream 同源)
        repaired_messages, repair_removed, _ = repair_messages(messages)
        if repair_removed > 0:
            logger.info("repair_messages 修复 %d 条异常消息(astream)", repair_removed)
        trimmed_messages = trim_messages(repaired_messages)

        # 可选 token 压缩(P3-1,与 complete() 同源):流式也要支持压缩
        trimmed_messages, compaction_info = await self._apply_token_compaction(
            trimmed_messages, used_model, has_tools="tools" in kwargs
        )

        # 厂商原生适配器(可选增强):tools 存在时优先用厂商原生流式 API。
        # 流式场景不支持中途 fallback(已发送的 chunk 不可撤回),适配器内部自行处理错误。
        if "tools" in kwargs and not self._is_stub_mode():
            provider = await self._get_provider(used_model, owner_uuid)
            if provider is not None:
                tools = kwargs.pop("tools", None)
                astream_iter = provider.astream(
                    trimmed_messages, used_model, tools=tools, **kwargs
                )
                async for evt in astream_iter:
                    yield evt
                return

        if self._is_stub_mode():
            db_result = await _resolve_from_db(used_model, owner_uuid)
            if not db_result:
                result = await self.complete(messages, model=model, owner_uuid=owner_uuid)
                content = result.get("content", "")
                chunk_size = 10
                for i in range(0, len(content), chunk_size):
                    yield {"type": "chunk", "content": content[i : i + chunk_size]}
                yield {
                    "type": "done",
                    "model": result.get("model", used_model),
                    "usage": result.get("usage", {}),
                    "stub": True,
                }
                return
            api_key, api_base, real_model = db_result
            current_key_pool_id: Optional[str] = None
        else:
            api_key, api_base, real_model = await self._resolve(used_model, owner_uuid)
            # 立即读取到局部变量(无 await 点,无 race)供故障转移标记用
            current_key_pool_id = self._current_key_pool_id

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
            # 替代旧硬编码 `if used_model.startswith("nvidia/"): 120 else 30`(P0 Phase A)
            provider_code = _model_to_provider_code(used_model)
            cap = get_provider_cap(provider_code)
            call_kwargs["timeout"] = cap.default_timeout
            # 免费 provider (api_key 为占位符) 不传 api_key,走匿名访问避免 402
            if api_key and api_key not in ("no-key-required", "free"):
                call_kwargs["api_key"] = api_key
            if api_base:
                call_kwargs["api_base"] = api_base
            call_kwargs.update(kwargs)
            # 按 capability 过滤不支持的参数(stream_usage/tools/response_format/temperature)
            filter_call_kwargs(call_kwargs, provider_code, used_model)
            # P3-3(2026-07-30):openrouter/ 前缀请求临时设置专用代理
            with _openrouter_proxy_context(used_model):
                response = await litellm.acompletion(**call_kwargs)
            final_model = used_model
            final_usage: dict[str, Any] = {}
            # P0 修复:try/finally 确保客户端断开时显式关闭 litellm 响应流,防止 httpx 连接泄漏
            # 客户端中途断开 → GeneratorExit 从 async for 抛出,finally 仍会执行 aclose
            try:
                async for chunk in response:
                    if hasattr(chunk, "choices") and chunk.choices:
                        delta = chunk.choices[0].delta
                        token = getattr(delta, "content", None)
                        if token:
                            accumulated_content += token
                            yield {"type": "chunk", "content": token}
                        reasoning_token = getattr(delta, "reasoning_content", None)
                        if reasoning_token:
                            accumulated_reasoning += reasoning_token
                            yield {"type": "reasoning", "content": reasoning_token}
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
                and fallback_router._configs
            ):
                fb_reason = classify_fallback_reason(e)
                try:
                    fb_result = await fallback_router.complete_with_fallback(
                        trimmed_messages, used_model
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
                            "reason": fb_reason,
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
        used_model = model or getattr(settings, "embedding_model", "text-embedding-ada-002")

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
        self, messages: list[dict[str, Any]], primary: str
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
        """
        config = self._configs.get(primary, {})
        fallbacks = config.get("fallbacks", [])

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

        last_error: str | None = None
        for provider in fallbacks:
            try:
                # P2 修复:fallback 阶段 num_retries=0,防止重试放大
                # 主 provider 已失败,fallback 也失败时重试只是浪费资源,应快速返回错误
                result = await llm_gateway.complete(
                    messages, model=provider, _skip_fallback=True,
                    num_retries=0,
                )
                if not result.get("error"):
                    return result
                last_error = result.get("error_message") or result.get("error")
            except Exception as e:
                last_error = str(e)
                continue
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

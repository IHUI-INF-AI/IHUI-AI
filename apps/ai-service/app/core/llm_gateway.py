"""LiteLLM 网关。

配置优先级:ai_model_config 表(ownerUuid/providerCode 匹配) > .env 环境变量 > stub 降级。
无 key 时降级为 stub(返回固定响应),便于本地开发与测试。
支持流式输出(litellm.acompletion stream=True),stub 模式下模拟分块。
"""

import base64
import json
import logging
import os
from typing import Any, AsyncIterator, Optional

import asyncpg

from .config import settings
from ..providers import get_provider as _get_native_provider
from ..providers.base_provider import BaseProvider, ProviderError

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


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
            return api_key_enc
    except (json.JSONDecodeError, TypeError):
        return api_key_enc

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
        return plaintext.decode("utf-8")
    except Exception as e:
        logger.warning("解密 api_key_enc 失败: %s", e)
        return None


_PREFIX_TO_PROVIDER_CODE: dict[str, str] = {
    "stepfun/": "stepfun",
    "agnes/": "agnes",
    "groq/": "groq",
    "gemini/": "gemini",
    "openrouter/": "openrouter",
    "anthropic/": "anthropic",
    "claude-": "anthropic",
    "ollama/": "ollama",
    "azure/": "azure",
    "bedrock/": "bedrock",
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
) -> Optional[tuple[str, Optional[str], str]]:
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



class LLMGateway:
    """LLM 调用网关,封装 LiteLLM 并提供 stub 降级。"""

    @staticmethod
    def _is_stub_mode() -> bool:
        """未配置任何 .env API key 时为 stub 模式(仍可被 DB 配置覆盖)。"""
        return not any([
            settings.openai_api_key,
            settings.anthropic_api_key,
            settings.groq_api_key,
            settings.gemini_api_key,
            settings.openrouter_api_key,
            settings.agnes_api_key,
            settings.stepfun_api_key,
        ])

    @staticmethod
    def _resolve_provider(model: str) -> tuple[str | None, str | None, str | None]:
        """根据 model 前缀匹配 .env provider,返回 (api_key, api_base, litellm_model)。

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
            return settings.stepfun_api_key, settings.stepfun_api_base, f"openai/{real_model}"
        if m.startswith("agnes/"):
            real_model = model.split("/", 1)[1]
            return settings.agnes_api_key, settings.agnes_api_base, f"openai/{real_model}"
        if m.startswith("groq/"):
            return settings.groq_api_key, None, model
        if m.startswith("gemini/"):
            return settings.gemini_api_key, None, model
        if m.startswith("openrouter/"):
            return settings.openrouter_api_key, None, model
        if m.startswith("claude-") or m.startswith("anthropic/"):
            return settings.anthropic_api_key, None, model
        if m.startswith("ollama/"):
            return os.environ.get("OLLAMA_API_KEY") or None, os.environ.get("OLLAMA_API_BASE", "http://localhost:11434"), model
        if m.startswith("azure/"):
            return os.environ.get("AZURE_API_KEY") or None, os.environ.get("AZURE_API_BASE") or None, model
        if m.startswith("bedrock/"):
            return os.environ.get("AWS_ACCESS_KEY_ID") or None, None, model
        return settings.openai_api_key or None, None, model

    async def _get_provider(
        self,
        model: str,
        owner_uuid: Optional[str] = None,
    ) -> BaseProvider | None:
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
            return _get_native_provider(model, api_key, api_base)
        except Exception as e:
            logger.warning("厂商适配器初始化失败(model=%s): %s, fallback LiteLLM", model, e)
            return None

    async def _resolve(
        self,
        model: str,
        owner_uuid: Optional[str] = None,
    ) -> tuple[str | None, str | None, str | None]:
        """优先 DB 配置,兜底 .env。"""
        db_result = await _resolve_from_db(model, owner_uuid)
        if db_result:
            return db_result
        return self._resolve_provider(model)

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: Optional[str] = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """调用 LLM 完成对话。

        Args:
            messages: OpenAI 格式的消息列表。
            model: 模型名称,为空则使用默认模型。
            owner_uuid: 用户 UUID,用于匹配 ai_model_config 表中的用户私有配置。
            **kwargs: 透传给 litellm 的额外参数。

        Returns:
            包含 content/model/usage/stub 字段的字典。
        """
        used_model = model or settings.litellm_model
        trimmed_messages = trim_messages(messages)

        # 厂商原生适配器(可选增强):当请求含 tools(function calling)时,
        # 优先用厂商原生 API 以保留格式差异(Anthropic tool_use / Gemini functionDeclarations 等),
        # 失败时 fallback 到 LiteLLM 通用路径。
        if "tools" in kwargs and not self._is_stub_mode():
            provider = await self._get_provider(used_model, owner_uuid)
            if provider is not None:
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
        else:
            api_key, api_base, real_model = await self._resolve(used_model, owner_uuid)

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
            call_kwargs.update(kwargs)
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
            reasoning = getattr(response.choices[0].message, "reasoning_content", None)
            if reasoning:
                result["reasoning"] = reasoning
            return result
        except Exception as e:
            safe_msg = str(e)
            for key_field in ("api_key", "apikey", "authorization"):
                if key_field in safe_msg.lower():
                    safe_msg = f"LLM 调用失败(含敏感信息已脱敏): {type(e).__name__}"
                    break
            return {
                "content": "",
                "model": used_model,
                "usage": {},
                "stub": False,
                "error": True,
                "error_message": safe_msg,
            }

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式调用 LLM,逐 token 产出。

        Yields:
            - {"type": "chunk", "content": "token 文本"}
            - {"type": "done", "model": ..., "usage": ..., "stub": bool}
            - {"type": "error", "message": ...}
        """
        used_model = model or settings.litellm_model
        trimmed_messages = trim_messages(messages)

        # 厂商原生适配器(可选增强):tools 存在时优先用厂商原生流式 API。
        # 流式场景不支持中途 fallback(已发送的 chunk 不可撤回),适配器内部自行处理错误。
        if "tools" in kwargs and not self._is_stub_mode():
            provider = await self._get_provider(used_model, owner_uuid)
            if provider is not None:
                tools = kwargs.pop("tools", None)
                async for evt in provider.astream(
                    trimmed_messages, used_model, tools=tools, **kwargs
                ):
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
        else:
            api_key, api_base, real_model = await self._resolve(used_model, owner_uuid)

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
                "stream_usage": True,
            }
            call_kwargs["api_key"] = api_key
            if api_base:
                call_kwargs["api_base"] = api_base
            call_kwargs.update(kwargs)
            response = await litellm.acompletion(**call_kwargs)
            final_model = used_model
            final_usage: dict[str, Any] = {}
            async for chunk in response:
                if hasattr(chunk, "choices") and chunk.choices:
                    delta = chunk.choices[0].delta
                    token = getattr(delta, "content", None)
                    if token:
                        yield {"type": "chunk", "content": token}
                    reasoning_token = getattr(delta, "reasoning_content", None)
                    if reasoning_token:
                        yield {"type": "reasoning", "content": reasoning_token}
                if hasattr(chunk, "usage") and chunk.usage:
                    try:
                        final_usage = (
                            chunk.usage.model_dump()
                            if hasattr(chunk.usage, "model_dump")
                            else dict(chunk.usage)
                        )
                    except Exception:
                        pass
                if hasattr(chunk, "model") and chunk.model:
                    final_model = chunk.model
            yield {
                "type": "done",
                "model": final_model,
                "usage": final_usage,
                "stub": False,
            }
        except Exception as e:
            safe_msg = str(e)
            for key_field in ("api_key", "apikey", "authorization"):
                if key_field in safe_msg.lower():
                    safe_msg = f"LLM 流式调用失败(含敏感信息已脱敏): {type(e).__name__}"
                    break
            yield {"type": "error", "message": safe_msg}

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
        return response.data[0]["embedding"]


llm_gateway = LLMGateway()

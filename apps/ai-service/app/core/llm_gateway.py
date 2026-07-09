"""LiteLLM 网关。

无 key 时降级为 stub(返回固定响应),便于本地开发与测试。
支持流式输出(litellm.acompletion stream=True),stub 模式下模拟分块。
"""

from typing import Any, AsyncIterator

from .config import settings


class LLMGateway:
    """LLM 调用网关,封装 LiteLLM 并提供 stub 降级。"""

    @staticmethod
    def _is_stub_mode() -> bool:
        """判断是否处于 stub 模式(未配置任何 API key)。

        支持的 provider(任一配置即激活):
        - StepFun(用户 plan 套餐,已验证连通):stepfun/step-3.7-flash
        - Agnes AI(用户 plan 套餐):agnes/<model>
        - Groq(免费 30 RPM):https://console.groq.com/keys
        - Gemini(免费 15 RPM):https://aistudio.google.com/apikey
        - OpenRouter(有 free tier 模型):https://openrouter.ai/keys
        - OpenAI / Anthropic(付费)
        """
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
        """根据 model 前缀匹配 provider,返回 (api_key, api_base, litellm_model)。

        对于 OpenAI 兼容 endpoint,需返回 api_base 和带 openai/ 前缀的 model 名。
        LiteLLM 用 openai/ 前缀识别 OpenAI 兼容模式,配合 api_base 路由到自定义 endpoint。

        前缀约定:
        - stepfun/*  → STEPFUN_API_KEY + STEPFUN_API_BASE(OpenAI 兼容,返回 openai/{model})
        - agnes/*    → AGNES_API_KEY + AGNES_API_BASE(OpenAI 兼容,返回 openai/{model})
        - groq/*     → GROQ_API_KEY(LiteLLM 原生支持)
        - gemini/*   → GEMINI_API_KEY(LiteLLM 原生支持)
        - openrouter/* → OPENROUTER_API_KEY(LiteLLM 原生支持)
        - claude-*/anthropic/* → ANTHROPIC_API_KEY(LiteLLM 原生支持)
        - gpt-*/openai/* → OPENAI_API_KEY(LiteLLM 原生支持)
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
        # 默认 OpenAI(gpt-* / o1-* 等)
        return settings.openai_api_key or None, None, model

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """调用 LLM 完成对话。

        Args:
            messages: OpenAI 格式的消息列表。
            model: 模型名称,为空则使用默认模型。
            **kwargs: 透传给 litellm 的额外参数。

        Returns:
            包含 content/model/usage/stub 字段的字典。
        """
        used_model = model or settings.litellm_model

        # stub 模式: 未配置 API key 时返回模拟响应
        if self._is_stub_mode():
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
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                },
                "stub": True,
            }

        # 真实调用 LiteLLM
        try:
            import litellm

            api_key, api_base, real_model = self._resolve_provider(used_model)
            # 校验对应 provider key 已配置(避免空 key 静默 401)
            if not api_key:
                raise ValueError(
                    f"模型 {used_model} 对应的 provider API key 未配置,请在 .env 中设置"
                )
            call_kwargs: dict[str, Any] = {"model": real_model, "messages": messages}
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
            return {
                "content": response.choices[0].message.content,
                "model": response.model or used_model,
                "usage": usage_dict,
                "stub": False,
            }
        except Exception as e:
            # 真实调用失败不是 stub 模式,用 error 标记区分
            # 脱敏错误信息(避免泄露 key/URL)
            safe_msg = str(e)
            for key_field in ("api_key", "apikey", "authorization"):
                if key_field in safe_msg.lower():
                    safe_msg = f"LLM 调用失败(含敏感信息已脱敏): {type(e).__name__}"
                    break
            return {
                "content": "",  # 错误时返回空内容,不把错误文本当作 AI 回复
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
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式调用 LLM,逐 token 产出。

        Args:
            messages: OpenAI 格式的消息列表。
            model: 模型名称,为空则使用默认模型。
            **kwargs: 透传给 litellm 的额外参数。

        Yields:
            每个产出为一个字典:
            - {"type": "chunk", "content": "token 文本"}  逐块内容
            - {"type": "done", "model": ..., "usage": ..., "stub": bool}  完成
            - {"type": "error", "message": ...}  错误(stub 降级)
        """
        used_model = model or settings.litellm_model

        # stub 模式: 把 stub 响应按 10 字符分块模拟流式
        if self._is_stub_mode():
            result = await self.complete(messages, model=model)
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

        # 真实流式调用 LiteLLM
        try:
            import litellm

            api_key, api_base, real_model = self._resolve_provider(used_model)
            # 校验 provider key 已配置
            if not api_key:
                raise ValueError(
                    f"模型 {used_model} 对应的 provider API key 未配置,请在 .env 中设置"
                )
            call_kwargs: dict[str, Any] = {
                "model": real_model,
                "messages": messages,
                "stream": True,
                "stream_usage": True,  # 启用流式 usage 返回真实 token 数
            }
            call_kwargs["api_key"] = api_key
            if api_base:
                call_kwargs["api_base"] = api_base
            call_kwargs.update(kwargs)
            response = await litellm.acompletion(**call_kwargs)
            final_model = used_model
            final_usage: dict[str, Any] = {}
            async for chunk in response:
                # litellm 流式 chunk 格式: chunk.choices[0].delta.content
                if hasattr(chunk, "choices") and chunk.choices:
                    delta = chunk.choices[0].delta
                    token = getattr(delta, "content", None)
                    if token:
                        yield {"type": "chunk", "content": token}
                # 捕获流式 usage(最后一个 chunk 可能含 usage)
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
            # 脱敏错误信息
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

        Args:
            text: 待嵌入的文本。
            model: 嵌入模型名称,为空则使用默认 embedding_model。

        Returns:
            浮点数列表(向量)。

        stub 模式下返回确定性哈希向量(便于测试,无语义意义)。
        """
        used_model = model or getattr(settings, "embedding_model", "text-embedding-ada-002")

        # stub 模式: 基于文本哈希生成确定性伪向量(384 维)
        if self._is_stub_mode():
            import hashlib

            vector = []
            for i in range(384):
                h = hashlib.sha256(f"{text}:{i}".encode()).hexdigest()
                vector.append((int(h[:8], 16) % 1000) / 1000.0)
            return vector

        # 真实调用 LiteLLM embedding
        import litellm

        response = await litellm.aembedding(model=used_model, input=text)
        return response.data[0]["embedding"]


llm_gateway = LLMGateway()

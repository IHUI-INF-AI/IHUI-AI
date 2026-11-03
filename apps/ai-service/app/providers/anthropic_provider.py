# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Anthropic 原生适配器。

核心差异(相对 OpenAI/LiteLLM 通用层):
- tool_use 格式:tools 用 input_schema(而非 JSON schema),响应为 content blocks
- system prompt 独立参数(不放在 messages 里)
- max_tokens 必填(Anthropic API 强制要求)

P0-① Prompt 缓存(2026-09-18 立,对标 Codex Harness 的 prompt-cache 组装):
- system 走 block 数组形态,末块打 ephemeral 断点;tools 末项再打一个断点
  (共 2 个,远低于 Anthropic 上限 4)→ 前缀稳定部分(system+tools)命中缓存后
  按 0.1x 计价,agent 长会话输入成本降一个数量级(官方数据输出 token 省 6 倍)。
- usage 归一化:cache_read/cache_creation 字段经 core.usage_cache 统一为
  cached_tokens/cache_creation_tokens,流式路径从 message_start/message_delta 采集。
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from ..core.llm_gateway import get_http_client
from ..core.usage_cache import normalize_usage
from ..services.tool_schema_adapter import (
    anthropic_response_to_openai,
    anthropic_tool_choice_from_openai,
    openai_tools_to_anthropic,
)
from .base_provider import BaseProvider, ProviderError

_ANTHROPIC_VERSION = "2023-06-01"

# WP-6(2026-09-25 实测立):逐轮变化的注入段签名(前缀匹配,见各注入器落点)。
#
# 为什么需要这张表:system 各段是被注入器用 "\n\n" 逐段拼到同一条 system 消息里的
# (记忆子图 / 自动语义检索 / 元知识 …),而 Anthropic 的缓存断点覆盖"断点之前的整段
# 前缀"。旧实现把整段 system 合成**一个块**并在它末尾打断点 ⇒ 尾部一行记忆内容变了,
# 前面 3200+ 字符逐字相同的稳定段也一起 miss(实测:turn1 锚定块 sha=daae11068ebaa0c9
# / turn2=833868452b7f55ef,首差偏移 3204,即 99% 相同仍整段不命中)。
# 现在按签名切开稳定段与易变尾段,断点只钉在稳定段末尾。
#
# 新增逐轮注入器**必须**在此登记其段落起始签名,否则它会把断点重新推回动态内容里
# (回归锁:apps/ai-service/tests/test_prompt_cache_anchor_drift.py)。
_VOLATILE_SYSTEM_SEGMENT_MARKERS: tuple[str, ...] = (
    "<memory_graph>",  # routers/llm._inject_memory_graph(按最后一条 user 查询命中)
    "[auto-context]",  # routers/llm D7 自动语义检索(按查询命中)
    "<!-- repo-wiki-auto -->",  # routers/llm._maybe_inject_auto_repo_wiki(增量同步)
    "[线程目标]",  # agent_loop_v2.run 线程持久目标(可在轮间变更)
    "## 元知识",  # meta_learner.build_system_prompt_snippet(避坑指南随轮累积)
    "## 元认知提示",  # metacognition.build_system_prompt_snippet(反思发现随轮累积)
)


class AnthropicProvider(BaseProvider):
    """Anthropic Messages API 原生适配器。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        super().__init__(api_key, api_base, timeout)
        self.base_url = (api_base or "https://api.anthropic.com").rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": _ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        }

    def _split_system(
        self,
        messages: list[dict[str, Any]],
    ) -> tuple[str | None, list[dict[str, Any]]]:
        """分离 system prompt(Anthropic 用独立参数,不放在 messages)。"""
        system_parts: list[str] = []
        rest: list[dict[str, Any]] = []
        for m in messages:
            if m.get("role") == "system":
                content = m.get("content", "")
                if isinstance(content, str):
                    system_parts.append(content)
                else:
                    system_parts.append(json.dumps(content, ensure_ascii=False))
            else:
                rest.append(m)
        system = "\n\n".join(system_parts) if system_parts else None
        return system, rest

    def _convert_tools(self, tools: list[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
        """OpenAI function calling tools → Anthropic tool_use 格式(input_schema)。

        委托 tool_schema_adapter.openai_tools_to_anthropic(深拷贝,
        递归保留 input_schema 全部嵌套字段,与入参不共享引用)。
        """
        return openai_tools_to_anthropic(tools)

    def _split_stable_system_prefix(self, system: str) -> tuple[str, str]:
        """把整段 system 切成 (稳定前缀, 易变尾部)。

        切点 = 第一个动态注入段的起点(注入器一律以 ``\\n\\n`` 追加新段,故按**段首**
        匹配,不做子串模糊匹配 —— 正文里提到该词的稳定段不得被误判成动态)。
        无动态段时尾部为空串,断点仍钉在整段末尾 —— 与改造前逐字节等价。
        """
        cut = -1
        for marker in _VOLATILE_SYSTEM_SEGMENT_MARKERS:
            if system.startswith(marker):
                return "", system
            at = system.find("\n\n" + marker)
            if at >= 0 and (cut < 0 or at < cut):
                cut = at
        if cut < 0:
            return system, ""
        return system[:cut], system[cut + len("\n\n") :]

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None,
        stream: bool,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> dict[str, Any]:
        system, rest = self._split_system(messages)
        payload: dict[str, Any] = {
            "model": self._strip_prefix(model),
            "messages": rest,
            # max_tokens 必填(Anthropic API 强制要求,与 OpenAI 不同)
            "max_tokens": kwargs.pop("max_tokens", max_tokens),
        }
        if system:
            # P0-① Prompt 缓存(2026-09-18 立)+ WP-6 两段式装配(2026-09-25 修):
            # system 走 block 数组形态,但**断点只钉在稳定前缀末尾** —— 逐轮变化的注入段
            # 排在尾部且不进缓存。旧写法把整段 system 合成一个块并在它末尾打断点,
            # 于是尾部一行动态内容会连带前面逐字相同的稳定段一起 miss(实测见
            # _VOLATILE_SYSTEM_SEGMENT_MARKERS 注释)。block 形态与纯字符串形态等价,
            # API 均接受。
            stable, volatile = self._split_stable_system_prefix(system)
            system_blocks: list[dict[str, Any]] = []
            if stable:
                system_blocks.append(
                    {
                        "type": "text",
                        "text": stable,
                        "cache_control": {"type": "ephemeral"},
                    }
                )
            if volatile:
                system_blocks.append({"type": "text", "text": volatile})
            if system_blocks:
                payload["system"] = system_blocks
        converted_tools = self._convert_tools(tools)
        if converted_tools:
            # P0-① Prompt 缓存:tools 末项(紧跟 system 的稳定前缀)再打一个断点,
            # 使工具定义也进缓存;_convert_tools 深拷贝返回,此处改写不影响入参。
            # 调用方已显式传 cache_control 时尊重之,不覆盖。
            last_tool = converted_tools[-1]
            if isinstance(last_tool, dict) and "cache_control" not in last_tool:
                last_tool["cache_control"] = {"type": "ephemeral"}
            payload["tools"] = converted_tools
            if "tool_choice" in kwargs:
                # OpenAI 字符串("auto"/"none"/"required")会被 Anthropic 400,
                # 统一转对象形态(none → 不带)
                converted_choice = anthropic_tool_choice_from_openai(kwargs.pop("tool_choice"))
                if converted_choice is not None:
                    payload["tool_choice"] = converted_choice
        if stream:
            payload["stream"] = True
        payload.update(kwargs)
        return payload

    def _parse_content_blocks(self, content: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
        """解析 Anthropic content blocks → (text, tool_calls)。

        tool_use 块的 OpenAI 形态转换委托
        tool_schema_adapter.anthropic_response_to_openai(统一 tool_calls 契约)。
        """
        text_parts: list[str] = []
        for block in content:
            if block.get("type") == "text":
                text_parts.append(block.get("text", ""))
        tool_calls = anthropic_response_to_openai(content)
        return "".join(text_parts), tool_calls

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = self._build_payload(messages, model, tools=tools, stream=False, **kwargs)
        data = await self._request("POST", f"{self.base_url}/v1/messages", headers=self._headers(), json=payload)
        text, tool_calls = self._parse_content_blocks(data.get("content", []))
        result: dict[str, Any] = {
            "content": text,
            "model": data.get("model", model),
            # P0-①:cache_read_input_tokens/cache_creation_input_tokens 经
            # normalize_usage 统一为 cached_tokens/cache_creation_tokens(原生字段保留)
            "usage": normalize_usage(data.get("usage", {})),
            "stub": False,
        }
        if tool_calls:
            result["tool_calls"] = tool_calls
        return result

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        payload = self._build_payload(messages, model, tools=tools, stream=True, **kwargs)
        try:
            client = get_http_client()
            async with client.stream(
                "POST", f"{self.base_url}/v1/messages", headers=self._headers(), json=payload,
                timeout=self.timeout,
            ) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise ProviderError(
                        f"Anthropic 流式调用失败: {resp.status_code} {body[:300]!r}",
                        resp.status_code,
                    )
                # tool_use 块累积器:index → {id, name, arguments_json}
                # content_block_start 携带 id/name,input_json_delta 逐片拼接 arguments,
                # content_block_stop 时以 OpenAI tool_calls 形态产出完整 tool_call 事件
                # (供 llm_gateway._accumulate_tool_calls 归并 → SSE tool_calls 事件)。
                pending_tool_blocks: dict[int, dict[str, Any]] = {}
                # P0-① 流式 usage 采集:Anthropic 的 usage 拆在两个事件里——
                # message_start 携带 input_tokens(+缓存字段),message_delta 携带
                # 累计 output_tokens;message_stop 时合并归一化随 done 事件透出
                # (此前 done 恒 {"usage": {}},流式路径缓存计量完全丢失)。
                stream_usage: dict[str, Any] = {}
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    try:
                        event = json.loads(line[6:])
                    except json.JSONDecodeError:
                        continue
                    etype = event.get("type")
                    if etype == "message_start":
                        start_msg = event.get("message") or {}
                        start_usage = start_msg.get("usage")
                        if isinstance(start_usage, dict):
                            stream_usage.update(start_usage)
                    elif etype == "message_delta":
                        delta_usage = event.get("usage")
                        if isinstance(delta_usage, dict):
                            stream_usage.update(delta_usage)
                    elif etype == "content_block_start":
                        block = event.get("content_block", {}) or {}
                        if block.get("type") == "tool_use":
                            pending_tool_blocks[event.get("index", 0)] = {
                                "id": block.get("id") or "",
                                "name": block.get("name") or "",
                                "arguments": "",
                            }
                    elif etype == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield {"type": "chunk", "content": delta.get("text", "")}
                        elif delta.get("type") == "input_json_delta":
                            partial = delta.get("partial_json", "")
                            block = pending_tool_blocks.get(event.get("index", 0))
                            if block is not None and partial:
                                block["arguments"] += partial
                            # 兼容旧行为:逐片透传 tool_call_delta(partial_json)
                            yield {"type": "tool_call_delta", "partial_json": partial}
                    elif etype == "content_block_stop":
                        block = pending_tool_blocks.pop(event.get("index", 0), None)
                        if block is not None:
                            # OpenAI tool_calls 形态(arguments 为 JSON 字符串,空入参兜底 "{}")
                            yield {"type": "tool_call", "tool_calls": [{
                                "id": block["id"],
                                "type": "function",
                                "function": {
                                    "name": block["name"],
                                    "arguments": block["arguments"] or "{}",
                                },
                            }]}
                    elif etype == "message_stop":
                        yield {
                            "type": "done",
                            "model": model,
                            "usage": normalize_usage(stream_usage),
                            "stub": False,
                        }
        except httpx.HTTPError as e:
            yield {"type": "error", "message": f"Anthropic 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

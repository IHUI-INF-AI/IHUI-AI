# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM Provider Capability Registry(2026-07-31 立,P0 Phase A)。

设计目标:消灭 llm_gateway.py 中按厂商前缀硬编码的 `if nvidia/` / `if cloudflare/`
条件判断,改为基于 capability registry 自动过滤参数。新增厂商只需在 PROVIDER_CAPS
登记 capability 字段,无需改 llm_gateway.py 调用逻辑。

与 llm_gateway.py / routers/llm.py / packages/types 三角色统一,字段 schema 必须严格对齐:
- supports_stream_usage:是否支持 stream_usage 参数(NVIDIA/CF=False, OpenAI=True)
- supports_tools:是否支持 function calling
- supports_vision:是否支持图片输入
- supports_response_format:是否支持 response_format
- supports_temperature:是否支持 temperature(部分推理模型如 o1/deepseek-r1 不支持)
- default_timeout:默认超时秒数(NVIDIA=120, 其他=30)
- max_context:默认最大上下文 tokens(具体模型可在 default_models.json 覆盖)
- protocol:openai_chat / anthropic_messages / gemini_generate_content
- request_max_retries:HTTP 请求失败重试次数(2026-09-19 第十七批,对标 Codex
  ModelProviderInfo.request_max_retries)。此前 llm_gateway 里是全局硬编码
  num_retries=2,排队型 provider(NVIDIA 免费层)与低延迟 provider(Groq)
  根本不该同档;现按 provider 声明。
- stream_idle_timeout_s:流式响应空闲超时(对标 Codex stream_idle_timeout_ms)。
  长思考链/排队型 provider 需要放宽,否则正常排队被误判为断流。
- extra_headers / env_headers:附加请求头(对标 Codex http_headers /
  env_http_headers)。env_headers 的 value 是「环境变量名」,运行时取值,
  未设置或空值则该头整个省略 —— 凭据只留在环境变量里,不落配置与代码。
"""
from __future__ import annotations

import os
from dataclasses import asdict, dataclass, replace
from typing import Any


@dataclass(frozen=True)
class ProviderCap:
    """单个 provider 的能力声明(immutable,作为三角色统一 schema)。"""

    supports_stream_usage: bool = True
    supports_tools: bool = True
    supports_vision: bool = False
    supports_response_format: bool = True
    supports_temperature: bool = True
    default_timeout: int = 30
    max_context: int = 8192
    protocol: str = "openai_chat"
    # 第十七批:provider 级韧性与请求头(全部可选,None 表示沿用调用方默认)
    request_max_retries: int | None = 2
    stream_idle_timeout_s: float | None = None
    extra_headers: dict[str, str] | None = None
    env_headers: dict[str, str] | None = None


# 未知 provider 的兜底 cap(全 True 默认 + openai_chat 协议)
DEFAULT_CAP = ProviderCap()


# 已知 provider 的 capability 表(与 _PREFIX_TO_PROVIDER_CODE 的 value 对齐)
# 注:新增 provider 只需在此登记,无需改 llm_gateway.py
PROVIDER_CAPS: dict[str, ProviderCap] = {
    # NVIDIA NIM:免费层 worker 池容量有限(16 个),并发排队需 120s;
    # 不支持 stream_usage(BadRequest 400)
    "nvidia_nim": ProviderCap(
        supports_stream_usage=False,
        default_timeout=120,
        max_context=128000,
        # 免费层 worker 池仅 16 并发,排队是常态:多给重试 + 放宽流式空闲
        request_max_retries=3,
        stream_idle_timeout_s=180,
    ),
    # Cloudflare Workers AI:不支持 stream_usage 也不支持 response_format
    "cloudflare_workers_ai": ProviderCap(
        supports_stream_usage=False,
        supports_response_format=False,
        default_timeout=60,
        max_context=8192,
        stream_idle_timeout_s=60,
    ),
    "openai": ProviderCap(
        supports_stream_usage=True,
        supports_tools=True,
        supports_vision=True,
        max_context=128000,
    ),
    "anthropic": ProviderCap(
        supports_stream_usage=True,
        supports_tools=True,
        supports_vision=True,
        protocol="anthropic_messages",
        max_context=200000,
    ),
    # StepFun 智能路由:不支持 stream_usage(需 token_counter 估算兜底)
    "stepfun": ProviderCap(
        supports_stream_usage=False,
        max_context=128000,
    ),
    # Agnes 中转站:不支持 stream_usage
    "agnes": ProviderCap(
        supports_stream_usage=False,
        max_context=128000,
    ),
    # Token6688 聚合网关(TokenGo 系):stream_usage 未知先按 False 兜底,
    # 超时放宽(聚合网关上游链路长),vision 走多模态模型
    "token6688": ProviderCap(
        supports_stream_usage=False,
        supports_vision=True,
        default_timeout=120,
        max_context=128000,
        # 聚合网关上游链路长,排队与首字节等待都更久
        request_max_retries=3,
        stream_idle_timeout_s=180,
    ),
    "openrouter": ProviderCap(
        supports_stream_usage=True,
        max_context=128000,
        # OpenRouter 推荐的自报家门头:值来自环境变量,未配置则整个头不发
        env_headers={
            "HTTP-Referer": "OPENROUTER_HTTP_REFERER",
            "X-Title": "OPENROUTER_APP_TITLE",
        },
    ),
    # Gemini / Google:支持 vision + gemini_generate_content 协议,长上下文
    "gemini": ProviderCap(
        supports_stream_usage=True,
        supports_vision=True,
        protocol="gemini_generate_content",
        max_context=1000000,
    ),
    "google": ProviderCap(
        supports_stream_usage=True,
        supports_vision=True,
        protocol="gemini_generate_content",
        max_context=1000000,
    ),
    "groq": ProviderCap(
        supports_stream_usage=True,
        max_context=32768,
        # 低延迟推理:失败重试 1 次即可,快速失败比死等更有用
        request_max_retries=1,
    ),
    "ollama": ProviderCap(
        supports_stream_usage=False,
        max_context=8192,
        # 本地推理:重试无意义(失败即本机问题),快速失败
        request_max_retries=0,
    ),
    "mistral": ProviderCap(
        supports_stream_usage=True,
        supports_tools=True,
        max_context=32768,
    ),
    "cohere": ProviderCap(
        supports_stream_usage=True,
        max_context=128000,
    ),
    "vertexai": ProviderCap(
        supports_stream_usage=True,
        max_context=32768,
    ),
    "bedrock": ProviderCap(
        supports_stream_usage=True,
        max_context=128000,
    ),
}


def get_provider_cap(provider_code: str) -> ProviderCap:
    """按 provider_code 查询能力(未知 provider 返回 DEFAULT_CAP 全 True 默认)。

    Args:
        provider_code: provider 唯一标识(与 _PREFIX_TO_PROVIDER_CODE 的 value 一致),
            如 "openai" / "anthropic" / "nvidia_nim" / "cloudflare_workers_ai"。

    Returns:
        ProviderCap 实例(immutable,不可修改,如需覆盖用 replace())。
    """
    return PROVIDER_CAPS.get(provider_code, DEFAULT_CAP)


def filter_call_kwargs(
    call_kwargs: dict[str, Any],
    provider_code: str,
    model: str,
) -> dict[str, Any]:
    """按 provider capability 过滤 litellm.acompletion 调用参数。

    移除 provider 不支持的参数,避免 400 BadRequest 错误:
    - supports_stream_usage=False → 移除 stream_usage
    - supports_tools=False → 移除 tools / tool_choice
    - supports_response_format=False → 移除 response_format
    - supports_temperature=False → 移除 temperature

    Args:
        call_kwargs: litellm.acompletion 的关键字参数(会被原地修改并返回)。
        provider_code: provider 唯一标识。
        model: 模型名(仅用于日志,不参与过滤决策)。

    Returns:
        过滤后的 call_kwargs(同一 dict 引用,便于调用方继续链式使用)。
    """
    cap = get_provider_cap(provider_code)
    if not cap.supports_stream_usage:
        call_kwargs.pop("stream_usage", None)
    if not cap.supports_tools:
        call_kwargs.pop("tools", None)
        call_kwargs.pop("tool_choice", None)
    if not cap.supports_response_format:
        call_kwargs.pop("response_format", None)
    if not cap.supports_temperature:
        call_kwargs.pop("temperature", None)
    return call_kwargs


def cap_to_dict(cap: ProviderCap) -> dict[str, Any]:
    """将 ProviderCap 序列化为 dict(供 /llm/models 端点附加 caps 字段用)。

    用 asdict 转换为普通 dict(JSON 可序列化),字段顺序与 dataclass 定义一致。

    安全闸门(2026-09-19 第十七批):`extra_headers` / `env_headers` 属于出站
    请求头配置,可能承载凭据,**绝不下发给客户端** —— 该端点会把 caps 直接
    返回给前端(routers/llm.py /llm/models)。表头只留在服务端用于实际请求。
    """
    data = asdict(cap)
    data.pop("extra_headers", None)
    data.pop("env_headers", None)
    return data


def cap_with_max_context(cap: ProviderCap, max_context: int | None) -> ProviderCap:
    """返回覆盖了 max_context 的新 cap 实例(模型级覆盖,如 default_models.json 的 context_length)。

    Args:
        cap: provider 级 cap。
        max_context: 模型级 max_context(None 表示不覆盖,用 provider 默认值)。

    Returns:
        新的 ProviderCap 实例(frozen=True,replace 创建新对象)。
    """
    if max_context is None or max_context <= 0:
        return cap
    return replace(cap, max_context=max_context)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# ---------------------------------------------------------------------------
# 第十七批(2026-09-19,对标 Codex ModelProviderInfo):
# provider 级韧性参数与请求头解析
# ---------------------------------------------------------------------------


def resolve_provider_headers(provider_code: str | None) -> dict[str, str]:
    """解析 provider 的附加请求头(固定头 + 环境变量头)。

    env_headers 的 value 是「环境变量名」而不是值:运行时才取;变量未设置或
    为空串则该头整个省略(而不是发一个空头) —— 凭据只留在环境变量里,不落
    配置与代码(对标 Codex env_http_headers 的语义)。
    固定头 extra_headers 与 env_headers 同名时,env_headers 优先(更动态)。
    """
    cap = get_provider_cap(provider_code or "")
    headers: dict[str, str] = {}
    if cap.extra_headers:
        headers.update(cap.extra_headers)
    for name, env_name in (cap.env_headers or {}).items():
        value = os.environ.get(env_name) or ""
        if value:
            headers[name] = value
    return headers


def apply_provider_overrides(
    call_kwargs: dict[str, Any], provider_code: str | None
) -> None:
    """把 provider 级韧性参数写进 litellm 调用参数(调用方已显式给的值不改)。

    对标 Codex request_max_retries / stream_idle_timeout_ms:此前 llm_gateway
    里 num_retries 是全局硬编码 2,排队型 provider(NVIDIA 免费层 16 并发)与
    低延迟 provider(Groq)不该同档;现在按 provider 声明。
    """
    cap = get_provider_cap(provider_code or "")
    if cap.request_max_retries is not None and "num_retries" not in call_kwargs:
        call_kwargs["num_retries"] = cap.request_max_retries
    if cap.stream_idle_timeout_s and "stream_timeout" not in call_kwargs:
        call_kwargs["stream_timeout"] = cap.stream_idle_timeout_s


def apply_provider_headers(
    call_kwargs: dict[str, Any], provider_code: str | None
) -> None:
    """合并 provider 附加请求头到 extra_headers(调用方显式值优先)。

    与 apply_provider_overrides 分两步是因为时机不同:头部必须在调用方 kwargs
    合并「之后」再合,否则会被调用方传入的 extra_headers 整个覆盖掉。
    """
    headers = resolve_provider_headers(provider_code)
    if not headers:
        return
    merged = dict(headers)
    merged.update(call_kwargs.get("extra_headers") or {})
    call_kwargs["extra_headers"] = merged

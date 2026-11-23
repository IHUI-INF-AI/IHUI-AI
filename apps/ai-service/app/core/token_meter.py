# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""重放感知 token 计量(2026-11-23 第十五批,对齐 DSH dsh-token-meter)。

纯函数、零 IO、零模型调用:对一份持久消息日志做确定性折叠,同时给出三投影:
- ``tokenUsage``:持久日志里 provider 上报的累计用量(输入/输出/缓存读/缓存写,
  reasoning 已包含在 output 内,不二次累加);
- ``contextPressure``:最近一次 provider 压力 + 采样后 surface 的带符号增量;
- ``contextBreakdown``:system / tools / messages 三块的固定密度近似构成。

与对侧的差异(本仓超越轴):
1. 对侧按 surface 事件流折叠;本仓直接吃 checkpoint / 线程消息快照,不要求事件流先落库,
   于是 ``/api/agents/{id}/token-usage`` 这类"只有消息数组"的读面也能复用同一估算器。
2. 估算器与 ``context_compaction`` 的 BPE 估算**不是**同一口径:本模块只服务
   "构成 / 压力参考",不替换压缩决策的权威预算(避免用 4 字符/token 低估 CJK 与 JSON
   schema 去驱动压缩)。
3. provider 用量只在"规范请求信封完全一致 + 总量不低于同名锚点的完整估算"时才复用;
   否则回退完整固定密度估算。这条闸是防"改了上下文还拿旧 provider 用量冒充现值"。

本模块不新增模型可见内容,也不在 loop 里做决策。
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any

__all__ = [
    "BLOCK_OVERHEAD",
    "CHARS_PER_TOKEN",
    "ROLE_OVERHEAD",
    "ContextBreakdown",
    "ProviderUsage",
    "TokenAnchor",
    "TokenMeasurement",
    "TokenNode",
    "build_anchor",
    "canonical_envelope_key",
    "estimate_content",
    "estimate_message",
    "estimate_messages",
    "estimate_system_message",
    "estimate_tool_calls",
    "estimate_tools",
    "measure_messages",
    "prompt_completion_tokens",
]

# 固定每 token 四字符(对齐 DSH estimate.ts 的 CHARS_PER_TOKEN)。
CHARS_PER_TOKEN = 4
# JSON 结构框 / 类型标签的单块开销。
BLOCK_OVERHEAD = 4
# 每条消息的 role 字段框开销。
ROLE_OVERHEAD = 4

_TEXT_BLOCK_TYPES = frozenset({"text", "input_text", "output_text"})
_REASONING_BLOCK_TYPES = frozenset({"reasoning", "reasoning_text"})
_TOOL_CALL_BLOCK_TYPES = frozenset({"tool-call", "tool_call", "function_call"})
_IMAGE_BLOCK_TYPES = frozenset({"image", "image_url", "input_image"})


def _first_int(value: Any, keys: tuple[str, ...]) -> int | None:
    """按候选键取第一个可转 int 的值;非 dict / 全缺省返回 None。"""
    if not isinstance(value, dict):
        return None
    for key in keys:
        raw = value.get(key)
        if isinstance(raw, bool):
            continue
        if isinstance(raw, (int, float)) and raw >= 0:
            return int(raw)
        if isinstance(raw, str) and raw.strip().isdigit():
            return int(raw.strip())
    return None


def _canonical_json(value: Any) -> str:
    """紧凑 JSON(不转义中文、键排序),用于结构定价与信封哈希。"""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True, default=str)


@dataclass(frozen=True)
class ProviderUsage:
    """provider 上报的一次请求用量。四桶互斥;reasoning 是 output 的子集。"""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    reasoning_output_tokens: int = 0

    @property
    def prompt_tokens(self) -> int:
        """提示词侧压力:输入 + 缓存读 + 缓存写(不含输出)。"""
        return self.input_tokens + self.cache_read_tokens + self.cache_write_tokens

    @property
    def total_tokens(self) -> int:
        """提示词 + 输出;reasoning 已含在 output,不再加。"""
        return self.prompt_tokens + self.output_tokens

    @classmethod
    def from_normalized_usage(
        cls, usage: Any, *, prompt_includes_cache: bool | None = None
    ) -> ProviderUsage | None:
        """从本仓 ``normalize_usage`` 的归一字典构造(兼容原始厂商别名)。

        ``prompt_tokens`` 是**含缓存**的提示词总量,因此未缓存输入要减去
        cache read / cache write 两桶,避免把同一段缓存二次计入。

        **厂商口径不能靠字段名猜**:Anthropic 原生 ``input_tokens`` 本身不含缓存
        (缓存是额外的 ``cache_read_input_tokens`` / ``cache_creation_input_tokens``),
        而 OpenAI 风格 ``prompt_tokens`` 含缓存。旧实现把两者都当"含缓存总量"再减,
        上游直给 ``input_tokens`` 时会把未缓存输入减成 0、prompt 只剩缓存桶。
        现按显式口径判定:调用方可用 ``prompt_includes_cache`` 覆盖;未给时——
        ``prompt_tokens`` 存在 ⇒ 含缓存(本仓归一契约);只有 ``input_tokens`` ⇒
        视为不含缓存(Anthropic 原生)。缓存桶仍单独入账,``prompt_tokens`` 属性
        继续返回三者之和。
        """
        if not isinstance(usage, dict):
            return None
        prompt_total = _first_int(usage, ("prompt_tokens",))
        prompt_uncached = _first_int(usage, ("input_tokens", "inputTokenCount"))
        prompt: int | None = prompt_total if prompt_total is not None else prompt_uncached
        output = _first_int(usage, ("completion_tokens", "output_tokens", "outputTokenCount"))
        if prompt is None and output is None:
            return None
        cached = (
            _first_int(usage, ("cached_tokens", "cache_read_tokens", "cacheReadTokenCount")) or 0
        )
        cache_write = (
            _first_int(
                usage,
                ("cache_creation_tokens", "cache_write_tokens", "cacheWriteTokenCount"),
            )
            or 0
        )
        reasoning = (
            _first_int(
                usage,
                ("reasoning_output_tokens", "reasoning_tokens", "reasoningTokenCount"),
            )
            or 0
        )
        prompt = max(0, prompt or 0)
        cached = max(0, cached)
        cache_write = max(0, cache_write)
        inclusive = (
            prompt_total is not None if prompt_includes_cache is None else prompt_includes_cache
        )
        uncached_input = max(0, prompt - cached - cache_write) if inclusive else prompt
        return cls(
            input_tokens=uncached_input,
            output_tokens=max(0, output or 0),
            cache_read_tokens=cached,
            cache_write_tokens=cache_write,
            reasoning_output_tokens=max(0, reasoning),
        )

    def as_dict(self) -> dict[str, int]:
        return {
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "cacheReadTokens": self.cache_read_tokens,
            "cacheWriteTokens": self.cache_write_tokens,
            "reasoningOutputTokens": self.reasoning_output_tokens,
            "promptTokens": self.prompt_tokens,
            "totalTokens": self.total_tokens,
        }


@dataclass(frozen=True)
class TokenAnchor:
    """provider 用量可复用所需的锚点。

    ``envelope_key`` 必须与当前请求信封的规范键逐字一致;``estimated_tokens`` 是
    锚点当时的完整固定密度估算(工具 schema + surface),provider 总量低于它时
    视为上报不完整,回退估算;``surface_tokens`` 是锚点当时的 surface 总量,
    用来把采样后的 surface 变化算成带符号增量。
    """

    envelope_key: str
    estimated_tokens: int
    surface_tokens: int


@dataclass(frozen=True)
class TokenNode:
    index: int
    role: str
    kind: str
    tokens: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "role": self.role,
            "kind": self.kind,
            "tokens": self.tokens,
        }


@dataclass(frozen=True)
class ContextBreakdown:
    """上下文的近似构成(不是计费数据,也不是总量)。"""

    system_tokens: int = 0
    tools_tokens: int = 0
    message_tokens: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "systemTokens": self.system_tokens,
            "toolsTokens": self.tools_tokens,
            "messageTokens": self.message_tokens,
        }


@dataclass(frozen=True)
class TokenMeasurement:
    """一次测量的不可变快照。"""

    total_tokens: int
    surface_tokens: int
    breakdown: ContextBreakdown
    nodes: tuple[TokenNode, ...]
    baseline: str
    provider_usage: ProviderUsage | None = None
    pressure_tokens: int | None = None
    projected_tokens: int | None = None
    surface_delta_tokens: int = 0
    context_window: int | None = None
    envelope_key: str | None = None

    def as_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "totalTokens": self.total_tokens,
            "surfaceTokens": self.surface_tokens,
            "contextBreakdown": self.breakdown.as_dict(),
            "nodes": [node.as_dict() for node in self.nodes],
            "baseline": self.baseline,
            "surfaceDeltaTokens": self.surface_delta_tokens,
        }
        if self.provider_usage is not None:
            out["tokenUsage"] = self.provider_usage.as_dict()
        if self.pressure_tokens is not None:
            out["pressureTokens"] = self.pressure_tokens
        if self.projected_tokens is not None:
            out["projectedTokens"] = self.projected_tokens
        if self.context_window is not None:
            out["contextWindow"] = self.context_window
        if self.envelope_key is not None:
            out["envelopeKey"] = self.envelope_key
        return out


def _text_tokens(text: str) -> int:
    return math.ceil(len(text) / CHARS_PER_TOKEN)


def _strip_offloaded(value: Any) -> Any:
    """去掉 image 节点上的 ``offloaded`` 标记:它只影响路由路由定价,不影响固定启发式。"""
    if isinstance(value, dict):
        return {k: _strip_offloaded(v) for k, v in value.items() if k != "offloaded"}
    if isinstance(value, list):
        return [_strip_offloaded(item) for item in value]
    return value


def _block_text(block: Any) -> str:
    """取一个 block 里模型可见的文本;非文本返回空串。"""
    if not isinstance(block, dict):
        return ""
    for key in ("text", "content", "input_text", "output_text"):
        value = block.get(key)
        if isinstance(value, str):
            return value
    return ""


def estimate_content(blocks: Any) -> int:
    """按固定密度给 content 定价;字符串按单个 text 块计。"""
    if blocks is None:
        return 0
    if isinstance(blocks, str):
        return _text_tokens(blocks) + BLOCK_OVERHEAD
    if not isinstance(blocks, (list, tuple)):
        return BLOCK_OVERHEAD + _text_tokens(_canonical_json(blocks))
    total = 0
    for block in blocks:
        if not isinstance(block, dict):
            total += BLOCK_OVERHEAD + _text_tokens(_canonical_json(block))
            continue
        block_type = str(block.get("type") or "")
        if block_type in _TEXT_BLOCK_TYPES or block_type in _REASONING_BLOCK_TYPES:
            total += _text_tokens(_block_text(block)) + BLOCK_OVERHEAD
            continue
        if block_type in _TOOL_CALL_BLOCK_TYPES:
            name = str(block.get("name") or block.get("tool_name") or "")
            arguments = block.get("arguments")
            if arguments is None:
                arguments = block.get("args")
            if not isinstance(arguments, str):
                arguments = _canonical_json(arguments or {})
            total += _text_tokens(name) + _text_tokens(arguments) + BLOCK_OVERHEAD
            continue
        if block_type in _IMAGE_BLOCK_TYPES:
            total += BLOCK_OVERHEAD + _text_tokens(_canonical_json(_strip_offloaded(block)))
            continue
        # 未知 block / 合并扩展:保守结构 JSON 定价。
        total += BLOCK_OVERHEAD + _text_tokens(_canonical_json(block))
    return total


def estimate_tool_calls(tool_calls: Any) -> int:
    """给消息上的 tool_calls 定价(不重复加 role 开销)。"""
    if not isinstance(tool_calls, (list, tuple)) or not tool_calls:
        return 0
    total = 0
    for call in tool_calls:
        if not isinstance(call, dict):
            total += BLOCK_OVERHEAD + _text_tokens(_canonical_json(call))
            continue
        function = call.get("function")
        if isinstance(function, dict):
            name = str(function.get("name") or "")
            arguments = function.get("arguments")
        else:
            name = str(call.get("name") or call.get("tool_name") or "")
            arguments = call.get("arguments") if "arguments" in call else call.get("args")
        if not isinstance(arguments, str):
            arguments = _canonical_json(arguments or {})
        total += _text_tokens(name) + _text_tokens(arguments) + BLOCK_OVERHEAD
    return total


def estimate_system_message(message: dict[str, Any]) -> int:
    """system 提示词定价:纯文本 + role 开销,没有逐块开销;空内容为 0。"""
    content = message.get("content")
    if content is None or content == "" or content == []:
        return 0
    if isinstance(content, str):
        characters = len(content)
    elif isinstance(content, (list, tuple)):
        characters = 0
        for block in content:
            if isinstance(block, dict) and block.get("type") in _TEXT_BLOCK_TYPES:
                characters += len(_block_text(block))
            else:
                characters += len(_canonical_json(block))
    else:
        characters = len(_canonical_json(content))
    return _text_tokens_from_chars(characters) + ROLE_OVERHEAD


def _text_tokens_from_chars(characters: int) -> int:
    return math.ceil(max(0, characters) / CHARS_PER_TOKEN)


def estimate_message(message: dict[str, Any]) -> int:
    """给一条模型可见消息定价;system 走单独口径。"""
    if not isinstance(message, dict):
        return 0
    role = str(message.get("role") or "")
    if role == "system":
        return estimate_system_message(message)
    content = message.get("content")
    total = estimate_content(content)
    total += estimate_tool_calls(message.get("tool_calls"))
    return total + ROLE_OVERHEAD


def estimate_messages(messages: Any) -> int:
    """给消息数组定价(逐条求和)。"""
    if not isinstance(messages, (list, tuple)):
        return 0
    return sum(estimate_message(message) for message in messages)


def estimate_tools(tools: Any) -> int:
    """工具 schema 定价:只有最新请求信封的 tools 计入。"""
    if not tools:
        return 0
    return _text_tokens(_canonical_json(tools)) + BLOCK_OVERHEAD


def canonical_envelope_key(
    *,
    tools: Any = None,
    model: str | None = None,
    provider: str | None = None,
    config: Any = None,
) -> str:
    """规范请求信封键:工具 / 模型 / provider / 调用配置逐字参与。

    只把**会影响请求信封**的字段纳入,不把消息数组纳入 —— surface 的变化
    由 ``surfaceDeltaTokens`` 单独计价,若把 messages 也塞进信封键,
    每追加一条消息都会让锚点失配,provider 用量永远无法复用。
    """
    payload = {
        "model": model or "",
        "provider": provider or "",
        "tools": tools,
        "config": config,
    }
    # 只回不透明摘要,不回原文:token-usage 响应会带 envelopeKey,若直接把
    # 完整消息 JSON 塞回响应,等于把会话正文(可能含凭据)复制一份给前端。
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _split_breakdown(nodes: list[TokenNode], tools_tokens: int) -> ContextBreakdown:
    """system 只认最后一条非空 system;其余全部并入 message(含被取代的 system)。"""
    last_system: TokenNode | None = None
    for node in nodes:
        if node.kind == "system" and node.tokens > 0:
            last_system = node
    message_tokens = 0
    for node in nodes:
        if last_system is not None and node.index == last_system.index:
            continue
        message_tokens += node.tokens
    return ContextBreakdown(
        system_tokens=last_system.tokens if last_system is not None else 0,
        tools_tokens=max(0, tools_tokens),
        message_tokens=max(0, message_tokens),
    )


def measure_messages(
    messages: Any,
    *,
    tools: Any = None,
    provider_usage: ProviderUsage | None = None,
    context_window: int | None = None,
    anchor: TokenAnchor | None = None,
    envelope_key: str | None = None,
) -> TokenMeasurement:
    """对消息快照做一次确定性测量。

    Args:
        messages: 模型可见消息数组(可含 system);不做深拷贝,也不修改入参。
        tools: 当前请求信封的工具 schema;只影响 tools 分块与总量。
        provider_usage: 最近一次 provider 上报;只有与 ``anchor`` 同时成立才复用。
        context_window: 模型窗口容量;仅回传,不参与压力计算。
        anchor: provider 用量锚点;``envelope_key`` 与当前键不一致时一律回退估算。
        envelope_key: 当前请求信封键;不传时用 ``canonical_envelope_key`` 从
            messages/tools 生成(不含 model/provider,二者未知时也能用)。

    Returns:
        ``TokenMeasurement``。``totalTokens`` 是压力参考;不是计费记录。
    """
    if not isinstance(messages, (list, tuple)):
        messages = []
    if envelope_key is None:
        envelope_key = canonical_envelope_key(tools=tools)
    nodes: list[TokenNode] = []
    for index, message in enumerate(messages):
        role = str(message.get("role") or "") if isinstance(message, dict) else ""
        tokens = estimate_message(message)
        kind = "system" if role == "system" else "message"
        nodes.append(TokenNode(index=index, role=role, kind=kind, tokens=tokens))
    surface_tokens = sum(node.tokens for node in nodes)
    tools_tokens = estimate_tools(tools)
    breakdown = _split_breakdown(nodes, tools_tokens)

    baseline = "estimated"
    total_tokens = tools_tokens + surface_tokens
    pressure_tokens: int | None = None
    projected_tokens: int | None = None
    surface_delta = 0
    used_usage: ProviderUsage | None = None
    if provider_usage is not None and anchor is not None and anchor.envelope_key == envelope_key:
        estimated_anchor = tools_tokens + anchor.surface_tokens
        if provider_usage.total_tokens >= max(anchor.estimated_tokens, estimated_anchor):
            baseline = "provider_usage"
            surface_delta = surface_tokens - anchor.surface_tokens
            total_tokens = max(0, provider_usage.total_tokens + surface_delta)
            pressure_tokens = provider_usage.prompt_tokens
            projected_tokens = max(0, pressure_tokens + surface_delta)
            used_usage = provider_usage

    return TokenMeasurement(
        total_tokens=max(0, total_tokens),
        surface_tokens=max(0, surface_tokens),
        breakdown=breakdown,
        nodes=tuple(nodes),
        baseline=baseline,
        provider_usage=used_usage,
        pressure_tokens=pressure_tokens,
        projected_tokens=projected_tokens,
        surface_delta_tokens=surface_delta,
        context_window=context_window
        if isinstance(context_window, int) and context_window > 0
        else None,
        envelope_key=envelope_key,
    )


def build_anchor(
    messages: Any,
    usage: Any,
    *,
    model: str | None = None,
    tools: Any = None,
) -> tuple[ProviderUsage, TokenAnchor] | None:
    """从一轮结束后的消息快照 + 最后一次 usage 构造可复用锚点。

    锚点取**最后一条 assistant 消息之前**的 surface 作为 sampled 价,并把该
    assistant 消息自身的 token 计入 ``estimated_tokens``:provider 总量里已经
    含了这段输出,但下一请求的 surface 也会包含它,所以 surface delta 必须从
    它之前开始算。找不到 assistant 或 usage 不可解析时返回 ``None``,调用方
    继续走完整估算,不拿旧数冒充。
    """
    if not isinstance(messages, (list, tuple)) or not messages:
        return None
    last_assistant = -1
    for index, message in enumerate(messages):
        if isinstance(message, dict) and str(message.get("role") or "") == "assistant":
            last_assistant = index
    if last_assistant < 0:
        return None
    provider = ProviderUsage.from_normalized_usage(usage)
    if provider is None:
        return None
    before = list(messages[:last_assistant])
    assistant_tokens = estimate_message(messages[last_assistant])
    sampled_surface = estimate_messages(before)
    estimated = estimate_tools(tools) + sampled_surface + assistant_tokens
    return provider, TokenAnchor(
        envelope_key=canonical_envelope_key(tools=tools, model=model),
        estimated_tokens=estimated,
        surface_tokens=sampled_surface,
    )


def prompt_completion_tokens(messages: Any) -> tuple[int, int]:
    """按角色拆 prompt / completion(供 token-usage 图表)。

    prompt = system + user + tool;completion = assistant(含 tool_calls)。
    与 ``estimate_message`` 同源,不再另抄一套 ``len//4``。
    """
    prompt = 0
    completion = 0
    if not isinstance(messages, (list, tuple)):
        return 0, 0
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "")
        tokens = estimate_message(message)
        if role == "assistant":
            completion += tokens
        else:
            prompt += tokens
    return prompt, completion


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

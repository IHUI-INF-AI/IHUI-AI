"""ai-service 上下文压缩服务(2026-07-22 立,与 TS 端 @ihui/context-compaction 对等)。

核心能力:
- token 估算(tiktoken,与 TS 端 gpt-tokenizer 对等)
- 上下文压缩(百分比阈值触发 + 绝对值阈值触发)
- 结构化摘要(提取 tool_call 名称 / 工具结果状态 / 代码块语言 / 首句)
- pre_compact / post_compact hooks
- 逐步减少 keep_recent 找最优压缩

常量(与 TS 端一致):
- DEFAULT_TRIGGER_RATIO = 0.88  (88% 触发压缩)
- DEFAULT_TARGET_RATIO = 0.6    (压缩到 60%)
- DEFAULT_KEEP_RECENT = 6        (保留最近 6 条)
- CONTEXT_BUDGET_THRESHOLD = 0.7 (70% 提醒)
"""

import logging
import re
from typing import Any, Callable, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# 常量(与 TS 端一致)
DEFAULT_TRIGGER_RATIO = 0.88
DEFAULT_TARGET_RATIO = 0.6
DEFAULT_KEEP_RECENT = 6
CONTEXT_BUDGET_THRESHOLD = 0.7

@dataclass
class CompactionResult:
    """压缩结果。"""
    messages: list[dict[str, Any]]  # 压缩后的消息列表
    original_tokens: int
    compacted_tokens: int
    reduction_ratio: float  # (original - compacted) / original
    was_compacted: bool
    summary: Optional[str] = None  # 压缩摘要(如果触发了摘要)

@dataclass
class CompactionConfig:
    """压缩配置。"""
    trigger_ratio: float = DEFAULT_TRIGGER_RATIO
    target_ratio: float = DEFAULT_TARGET_RATIO
    keep_recent: int = DEFAULT_KEEP_RECENT
    max_tokens: Optional[int] = None  # 绝对值阈值(优先于 ratio)
    enable_summary: bool = True

class ContextCompactor:
    """上下文压缩器(与 TS 端 ContextCompactor 对等)。"""
    
    def __init__(self, config: Optional[CompactionConfig] = None, token_counter: Optional[Callable[[str], int]] = None):
        self.config = config or CompactionConfig()
        self._token_counter = token_counter or self._default_token_counter
        self._pre_hooks: list[Callable] = []
        self._post_hooks: list[Callable] = []
    
    def add_pre_hook(self, hook: Callable):
        """注册压缩前 hook。"""
        self._pre_hooks.append(hook)
    
    def add_post_hook(self, hook: Callable):
        """注册压缩后 hook。"""
        self._post_hooks.append(hook)
    
    def count_tokens(self, messages: list[dict[str, Any]]) -> int:
        """统计消息列表总 token 数。"""
        total = 0
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                total += self._token_counter(content)
            elif isinstance(content, list):
                # vision 消息(content 是 list of {type, text/image_url})
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        total += self._token_counter(part.get("text", ""))
            # role 也占 token
            total += 4  # 粗略估算 role 开销
        return total
    
    def should_compact(self, messages: list[dict[str, Any]], max_context_tokens: int) -> bool:
        """判断是否需要压缩。"""
        current = self.count_tokens(messages)
        if self.config.max_tokens and current >= self.config.max_tokens:
            return True
        return current >= max_context_tokens * self.config.trigger_ratio
    
    def compact_if_needed(self, messages: list[dict[str, Any]], max_context_tokens: int) -> CompactionResult:
        """按需压缩(百分比阈值触发)。逐步减少 keep_recent 找最优压缩。"""
        current = self.count_tokens(messages)
        if not self.should_compact(messages, max_context_tokens):
            return CompactionResult(messages=messages, original_tokens=current, compacted_tokens=current, reduction_ratio=0.0, was_compacted=False)
        
        # 触发 pre hooks
        for hook in self._pre_hooks:
            try:
                hook(messages, current)
            except Exception as e:
                logger.warning("pre_compact hook 失败: %s", e)
        
        # 逐步减少 keep_recent 尝试压缩
        target = int(max_context_tokens * self.config.target_ratio)
        for keep in range(self.config.keep_recent, 0, -1):
            compacted = self._do_compact(messages, keep)
            new_tokens = self.count_tokens(compacted)
            if new_tokens <= target:
                result = CompactionResult(
                    messages=compacted,
                    original_tokens=current,
                    compacted_tokens=new_tokens,
                    reduction_ratio=(current - new_tokens) / current if current > 0 else 0.0,
                    was_compacted=True,
                )
                # 触发 post hooks
                for hook in self._post_hooks:
                    try:
                        hook(result)
                    except Exception as e:
                        logger.warning("post_compact hook 失败: %s", e)
                return result
        
        # 所有 keep_recent 都无法达到 target,用最小 keep_recent=1
        compacted = self._do_compact(messages, 1)
        new_tokens = self.count_tokens(compacted)
        result = CompactionResult(
            messages=compacted,
            original_tokens=current,
            compacted_tokens=new_tokens,
            reduction_ratio=(current - new_tokens) / current if current > 0 else 0.0,
            was_compacted=True,
        )
        for hook in self._post_hooks:
            try:
                hook(result)
            except Exception as e:
                logger.warning("post_compact hook 失败: %s", e)
        return result
    
    def compact(self, messages: list[dict[str, Any]], max_tokens: int) -> CompactionResult:
        """绝对值阈值压缩(不判断 ratio,直接压到 max_tokens 以下)。"""
        current = self.count_tokens(messages)
        if current <= max_tokens:
            return CompactionResult(messages=messages, original_tokens=current, compacted_tokens=current, reduction_ratio=0.0, was_compacted=False)
        
        for keep in range(self.config.keep_recent, 0, -1):
            compacted = self._do_compact(messages, keep)
            new_tokens = self.count_tokens(compacted)
            if new_tokens <= max_tokens:
                return CompactionResult(messages=compacted, original_tokens=current, compacted_tokens=new_tokens, reduction_ratio=(current - new_tokens) / current if current > 0 else 0.0, was_compacted=True)
        
        compacted = self._do_compact(messages, 1)
        new_tokens = self.count_tokens(compacted)
        return CompactionResult(messages=compacted, original_tokens=current, compacted_tokens=new_tokens, reduction_ratio=(current - new_tokens) / current if current > 0 else 0.0, was_compacted=True)
    
    def _do_compact(self, messages: list[dict[str, Any]], keep_recent: int) -> list[dict[str, Any]]:
        """执行压缩:保留 system + 最近 keep_recent 条,中间消息结构化摘要。"""
        if len(messages) <= keep_recent + 1:
            return messages
        
        # 分离 system 消息(始终保留)
        system_msgs = [m for m in messages if m.get("role") == "system"]
        non_system = [m for m in messages if m.get("role") != "system"]
        
        if len(non_system) <= keep_recent:
            return messages
        
        # 中间消息(要被摘要的)
        to_summarize = non_system[:-keep_recent] if keep_recent > 0 else non_system
        recent = non_system[-keep_recent:] if keep_recent > 0 else []
        
        # 生成结构化摘要
        summary = self._summarize_messages(to_summarize)
        
        # 组装:system + 摘要 + recent
        summary_msg = {
            "role": "system",
            "content": f"[上下文压缩] 以下是对话历史摘要({len(to_summarize)} 条消息):\n\n{summary}",
        }
        return system_msgs + [summary_msg] + recent
    
    def _summarize_messages(self, messages: list[dict[str, Any]]) -> str:
        """结构化摘要(与 TS 端 summarizeMessage 对等)。"""
        lines = []
        for i, msg in enumerate(messages):
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            
            if isinstance(content, list):
                # vision 消息
                text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                content = " ".join(text_parts)
            
            if not isinstance(content, str):
                content = str(content)
            
            # 提取 tool_call
            tool_calls = msg.get("tool_calls", [])
            if tool_calls:
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    name = fn.get("name", "unknown")
                    lines.append(f"[{i}] {role}: 🔧 调用工具 {name}")
                continue
            
            # 提取工具结果(tool role)
            if role == "tool":
                # 工具结果,标记成功/失败
                status = "✓" if "error" not in content.lower() else "✗"
                first_line = content.split("\n")[0][:100] if content else ""
                lines.append(f"[{i}] {role}: [工具结果 {status}] {first_line}")
                continue
            
            # 提取代码块
            code_blocks = re.findall(r"```(\w+)", content)
            if code_blocks:
                langs = ", ".join(set(code_blocks))
                first_sentence = content.split(".")[0][:80]
                lines.append(f"[{i}] {role}: [代码 {langs}] {first_sentence}")
                continue
            
            # 普通文本:首句
            first_sentence = content.split("。")[0].split(".")[0][:100]
            lines.append(f"[{i}] {role}: {first_sentence}")
        
        return "\n".join(lines)
    
    def _default_token_counter(self, text: str) -> int:
        """默认 token 计数器(粗略估算,1 token ≈ 4 字符)。
        生产环境应替换为 tiktoken:
            import tiktoken
            enc = tiktoken.encoding_for_model("gpt-4o")
            return len(enc.encode(text))
        """
        return max(1, len(text) // 4)

# 模块级单例
compactor = ContextCompactor()

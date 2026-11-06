"""上下文账本(七类固定顺序)—— 批次 3:预算与上下文账本。

契约见 packages/shared/src/sse/contract.ts 的 usage.contextLedger:
    { model, contextLimit, usedTokens, percentage,
      categories[7]{category,tokens,percent}, tokenizer, compacted, capturedAt }

恒等式(硬约束,前端按此画饼图,不允许多一位少一位):
    system_prompt + system_tools + skills + messages + other
        + free_space + auto_compact == contextLimit

口径说明:
- 前五类是**已占用**窗口;free_space 是剩余可用;auto_compact 是"为压缩预留的
  余量" —— 一旦占用逼近触发线,压缩需要空间放摘要,预留量就是 trigger_ratio 之外
  的那段窗口(0.88 触发 ⇒ 预留 12%)。它不算占用,但也不能被业务内容用掉,
  所以单独成一类,而不是并进 free_space。
- token 估算复用 context_compaction 的 BPE 估算器(cl100k_base,与 TS 共享包同一
  口径),不另立第二种估算;有 provider 上报的 prompt_tokens 时以 provider 为准
  校正 messages 类(见 build_context_ledger 注释),tokenizer 标 provider_usage。
- 类别补齐只按"这条链路是否真的注入"来填:调用方拿不到的类别传空/None,计 0,
  不伪造数量(各调用链在文档注释里写明缺哪一类及原因)。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from ..core.context_compaction import (
    DEFAULT_TRIGGER_RATIO,
    estimate_messages_tokens,
    estimate_tokens,
)

# 七类固定顺序(契约数组顺序,不得调整)。
CONTEXT_LEDGER_CATEGORIES: tuple[str, ...] = (
    "system_prompt",
    "system_tools",
    "skills",
    "messages",
    "other",
    "free_space",
    "auto_compact",
)

_TOKENIZER_PROVIDER = "provider_usage"
_TOKENIZER_HEURISTIC = "heuristic"


def _schema_text(schemas: Any) -> str:
    """把工具 schema 归一成待估文本(支持 OpenAI tools 数组 / ToolDefinition 对象)。"""
    if not schemas:
        return ""
    if isinstance(schemas, str):
        return schemas
    items = schemas if isinstance(schemas, (list, tuple)) else [schemas]
    parts: list[str] = []
    for item in items:
        if isinstance(item, str):
            parts.append(item)
            continue
        dump = getattr(item, "model_dump", None)
        if callable(dump):
            try:
                item = dump()
            except Exception:
                item = getattr(item, "__dict__", item)
        elif not isinstance(item, dict):
            item = getattr(item, "__dict__", item)
        try:
            parts.append(json.dumps(item, ensure_ascii=False, default=str))
        except Exception:
            parts.append(str(item))
    return "\n".join(parts)


def _skills_text(skill_texts: Any) -> str:
    """把注入的 skill 文本拼成待估文本(支持 str 或 str 序列)。"""
    if not skill_texts:
        return ""
    if isinstance(skill_texts, str):
        return skill_texts
    return "\n".join(str(s) for s in skill_texts)


def _percent(tokens: int, limit: int) -> float:
    """token → 百分比(一位小数)。窗口未知(limit<=0)时按 0.0,不拿 0 冒充 100%。"""
    if limit <= 0:
        return 0.0
    return round(tokens / limit * 100.0, 1)


def build_context_ledger(
    system_prompt_text: str,
    tool_schemas: Any,
    skill_texts: Any,
    messages: list[dict[str, Any]],
    attachments_or_other_text: str,
    context_limit: int,
    model: str | None,
    provider_prompt_tokens: int | None = None,
    compacted: bool = False,
) -> dict[str, Any]:
    """构造 usage.contextLedger 载荷(纯函数,不抛异常、不做 I/O)。

    Args:
        system_prompt_text: 本轮实际下发的 system 文本(含注入的记忆/规则等)。
        tool_schemas: 本轮工具 schema(OpenAI tools 数组或等价对象)。
        skill_texts: 本轮注入的 skill 正文;该链路不注入时传 []/None(计 0)。
        messages: 非 system 消息列表(压缩后的真实上下文)。
        attachments_or_other_text: 附件/未归类的注入文本;没有则空串。
        context_limit: 模型窗口 token;<=0 表示拿不到窗口 ⇒ 七类全 0。
        model: 本轮模型名(取不到时 None)。
        provider_prompt_tokens: provider 上报的 prompt_tokens;None=未上报。
        compacted: 本轮是否发生过压缩(账本随帧说明压缩状态)。

    Returns:
        dict,键名与 TS 接口逐字一致;categories 顺序固定、tokens 整数、百分比一位
        小数;恒等式见模块 docstring。
    """
    limit = max(0, int(context_limit or 0))
    if limit <= 0:
        # 窗口未知 ≠ 占用为 0 的合法账本,但契约要求 contextLimit 是整数且恒等式
        # 成立;唯一不撒谎的写法就是 limit=0 时七类全 0,并把预算判断交给
        # assess_context_pressure / percent_left=None 那一侧。
        categories = [
            {"category": name, "tokens": 0, "percent": 0.0}
            for name in CONTEXT_LEDGER_CATEGORIES
        ]
        return {
            "model": model,
            "contextLimit": 0,
            "usedTokens": 0,
            "percentage": 0.0,
            "categories": categories,
            "tokenizer": _TOKENIZER_PROVIDER if provider_prompt_tokens else _TOKENIZER_HEURISTIC,
            "compacted": bool(compacted),
            "capturedAt": datetime.now(UTC).isoformat(),
        }

    system_prompt_tokens = estimate_tokens(system_prompt_text or "")
    system_tools_tokens = estimate_tokens(_schema_text(tool_schemas))
    skills_tokens = estimate_tokens(_skills_text(skill_texts))
    messages_tokens = estimate_messages_tokens(list(messages or []))
    other_tokens = estimate_tokens(attachments_or_other_text or "")

    tokenizer = _TOKENIZER_HEURISTIC
    if isinstance(provider_prompt_tokens, int) and provider_prompt_tokens > 0:
        tokenizer = _TOKENIZER_PROVIDER
        # provider 口径校正:provider 的 prompt_tokens 覆盖 system+tools+messages
        # (含注入文本),但本账本前五类分项是本地 BPE 估算。做法是"以 provider 总数为
        # 真值,倒推 messages 分项",保证 usedTokens 与 usage.promptTokens 对齐;
        # 倒推为负(本地估算把其它类别算超了)或对齐后仍有尾差 ⇒ 残差并入 other,
        # 不把误差摊进 system/tools/skills(那三类的展示价值在于"是谁占的")。
        non_message = system_prompt_tokens + system_tools_tokens + skills_tokens + other_tokens
        messages_tokens = max(0, provider_prompt_tokens - non_message)
        residual = provider_prompt_tokens - (
            non_message + messages_tokens
        )
        other_tokens = max(0, other_tokens + residual)

    categories_tokens: dict[str, int] = {
        "system_prompt": int(max(0, system_prompt_tokens)),
        "system_tools": int(max(0, system_tools_tokens)),
        "skills": int(max(0, skills_tokens)),
        "messages": int(max(0, messages_tokens)),
        "other": int(max(0, other_tokens)),
    }

    # 压缩预留量:沿用 context_compaction 的 trigger/target 配置口径(默认
    # trigger 0.88 ⇒ 预留给 auto_compact 的窗口 = 12%)。这不是"已用",
    # 所以不并进 other;它回答的是"压缩时能腾挪多少空间"。
    reserve = int(limit * (1.0 - DEFAULT_TRIGGER_RATIO))
    reserve = max(0, min(limit, reserve))

    used = sum(categories_tokens.values())
    free_space = max(0, limit - used - reserve)
    # 恒等式残差:估算总量 > 窗口 - 预留时,free_space 会钳到 0,而
    # limit - used - reserve - free 变成负数。把它并入 other(再不够依次冲减
    # messages/skills/tools/system),保证恒等式严格成立,且优先牺牲"未归类
    # 内容"而不是把账本做平均缩放。
    residual = limit - used - reserve - free_space
    if residual < 0:
        need = -residual
        for name in ("other", "messages", "skills", "system_tools", "system_prompt"):
            if need <= 0:
                break
            take = min(categories_tokens[name], need)
            categories_tokens[name] -= take
            need -= take

    used = sum(categories_tokens.values())
    # 极端超窗兜底:压缩预留让位(预留不得超过窗口剩余),free_space 仍钳 0。
    auto_compact = min(reserve, max(0, limit - used))
    free_space = max(0, limit - used - auto_compact)

    categories = [
        {"category": name, "tokens": tokens, "percent": _percent(tokens, limit)}
        for name, tokens in categories_tokens.items()
    ]
    categories.append(
        {"category": "free_space", "tokens": int(free_space), "percent": _percent(free_space, limit)}
    )
    categories.append(
        {
            "category": "auto_compact",
            "tokens": int(auto_compact),
            "percent": _percent(auto_compact, limit),
        }
    )
    # 顺序校验:dict 插入顺序即前五类顺序,追加两类后与契约顺序一致;
    # 用常量再断言一次,防止未来有人改 dict 顺序而契约测试才发现。
    if tuple(c["category"] for c in categories) != CONTEXT_LEDGER_CATEGORIES:
        categories = [
            next(c for c in categories if c["category"] == name)
            for name in CONTEXT_LEDGER_CATEGORIES
        ]

    return {
        "model": model,
        "contextLimit": int(limit),
        "usedTokens": int(used),
        "percentage": _percent(used, limit),
        "categories": categories,
        "tokenizer": tokenizer,
        "compacted": bool(compacted),
        "capturedAt": datetime.now(UTC).isoformat(),
    }

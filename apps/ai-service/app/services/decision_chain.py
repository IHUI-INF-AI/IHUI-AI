# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""决策链蒸馏 — 压缩时保留推理链(P1-②,2026-09-18 立,对标 Codex Harness retained reasoning)。

为什么需要:
  上下文压缩会把 head 段的 assistant 推理(reasoning,即"为什么调这个工具")一刀切掉 ——
  规则摘要只留 120-200 字符、LLM 语义摘要可能整段遗漏。压缩后模型只看到"调了工具 X、
  结果 Y",看不到"当初为什么这么判断",于是重复试错、推翻已确定的决策、绕回已排除的方案。
  OpenAI 实测:仅"保留推理 + 上下文压缩"两项 harness 调整,ARC-AGI-3 从 13.3% → 38.3%。

本模块的做法(纯确定性:零 LLM 调用、零额外网络、零额外延迟):
  1. 压缩前扫描 head 段,把每个"带工具调用的 assistant 轮次"蒸馏为一条结构化决策条目:
     推理(截断) + 动作(工具名 + 成败) + 失败工具的报错片段(最有价值的"结论");
  2. 条目渲染为独立块,注入压缩产物摘要消息的末尾 —— 后处理式接线,不改
     core/context_compaction 与 TS 共享包的压缩实现,跨端 parity 零影响;
  3. 块自带起止标记:重复压缩先剥离旧块再注入新块(幂等),并把旧条目原样接续
     (跨多次压缩不丢历史决策链,超出上限丢最旧);
  4. 注入后由 compaction_quality.assess_reasoning_retention 自证"推理保留率",与既有的
     key-fact 保留率并列成为第二个可证明指标 —— Codex 只做保留,我们做保留 + 质量自证。

开关:AGENT_DECISION_CHAIN_ENABLED(默认 true,见 core/tunables.py);置 off 时压缩
产物与未接入前逐零差异(本模块所有函数均不被调用)。

Public API:
- extract_head_messages(messages, keep_recent)   配对组对齐取出待压缩 head 段
- distill_decision_chain(messages, ...)          head 段 → 决策条目行列表
- render_decision_chain(lines)                   条目行 → 带标记的块文本
- strip_decision_chain(text)                     剥离已注入块(幂等注入前置)
- extract_chain_lines(text)                      从已有块取条目行(跨压缩接续)
- inject_decision_chain(compressed, source, ...) 注入 + 自证 → (messages, meta)
- reasoning_turns(messages) / content_tokens(text) / messages_blob(messages)
                                                 质量自证用的公开辅助(供 compaction_quality 复用)
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterable
from typing import Any

from ..core.context_compaction import SUMMARY_MARKER, _split_pair_groups
from ..core.tunables import (
    AGENT_DECISION_CHAIN_ENABLED,
    AGENT_DECISION_CHAIN_MAX_ENTRIES,
    AGENT_DECISION_CHAIN_REASONING_CHARS,
    DEFAULT_KEEP_RECENT,
    DEFAULT_MIN_MESSAGES,
)

logger = logging.getLogger(__name__)

# 决策链块在摘要正文中的起止标记(自解析:跨压缩接续 + 幂等去重均依赖它)
BLOCK_START = "[决策链保留"
BLOCK_HEADER_TEMPLATE = "[决策链保留 — 压缩前 {n} 轮决策(确定性蒸馏,零 LLM 成本)]"
BLOCK_END = "[/决策链保留]"

# 该轮 assistant 未输出推理文本时的占位(动作仍在,决策链不断裂)
MISSING_REASONING = "(未输出显式推理)"
# 单条工具报错摘要的字符上限(报错往往是"结论"本身,保留但要防爆量)
ERROR_CHARS = 120
# 推理保留判定阈值:一轮推理的内容 token 覆盖率 ≥ 该值即视为"被压缩产物保留"
REASONING_COVERAGE_THRESHOLD = 0.5
# 质量报告里最多回带的丢弃样本数(报告可读性,不参与计算)
DROPPED_SAMPLE_LIMIT = 5

# 思维链包裹标签:只去标签、保留内部文本(推理正文才是要保留的东西)
_THINK_TAG_RE = re.compile(
    r"</?(?:thinking|thought|reasoning|analysis)\s*/?>", re.IGNORECASE
)
_WS_RE = re.compile(r"\s+")
# 内容 token:ASCII 词(≥2 字符)/ CJK 双字滑窗 / 纯数字(≥2 位)
_ASCII_WORD_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_./-]{1,}")
_CJK_RUN_RE = re.compile(r"[\u4e00-\u9fff]{2,}")
_NUMBER_RE = re.compile(r"\d{2,}")


# ---------------------------------------------------------------------------
# 文本辅助
# ---------------------------------------------------------------------------


def _clean_reasoning(raw: Any) -> str:
    """归一 assistant 推理文本:兼容 content blocks 数组 / reasoning 字段 / 思维链标签。"""
    if isinstance(raw, list):
        parts: list[str] = []
        for item in raw:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        raw = "\n".join(parts)
    if not isinstance(raw, str):
        return ""
    return _WS_RE.sub(" ", _THINK_TAG_RE.sub("", raw)).strip()


def _clip(text: str, limit: int) -> str:
    """按字符上限截断(limit<=0 视为不保留该文本,返回空串)。"""
    if limit <= 0:
        return ""
    if len(text) <= limit:
        return text
    return text[: max(1, limit - 1)].rstrip() + "…"


def content_tokens(text: str) -> set[str]:
    """抽取用于覆盖率计算的内容 token(ASCII 词 + CJK 双字 + 数字)。

    确定性、与语言无关的粗粒度度量:同一段推理的 token 集合在压缩产物里出现多少,
    即"推理被保留了多少"。不追求语义等价判定(那需要 embedding),只做可复现的下限证明。
    """
    if not isinstance(text, str) or not text:
        return set()
    tokens: set[str] = set()
    for run in _CJK_RUN_RE.findall(text):
        for i in range(len(run) - 1):
            tokens.add(run[i : i + 2])
    tokens.update(word.lower() for word in _ASCII_WORD_RE.findall(text))
    tokens.update(_NUMBER_RE.findall(text))
    return tokens


def messages_blob(messages: Iterable[dict[str, Any]]) -> str:
    """把消息列表拼成单一文本(含工具名),供覆盖率匹配。"""
    parts: list[str] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        content = msg.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    parts.append(part["text"])
        calls = msg.get("tool_calls")
        if isinstance(calls, list):
            for call in calls:
                if isinstance(call, dict):
                    fn = call.get("function")
                    if isinstance(fn, dict) and isinstance(fn.get("name"), str):
                        parts.append(fn["name"])
    return "\n".join(parts)


def reasoning_turns(messages: Iterable[dict[str, Any]]) -> list[str]:
    """按序取出"带工具调用的 assistant 轮次"的推理文本(质量自证的分母)。"""
    turns: list[str] = []
    for msg in messages:
        if not isinstance(msg, dict) or msg.get("role") != "assistant":
            continue
        calls = msg.get("tool_calls")
        if not isinstance(calls, list) or not calls:
            continue
        turns.append(_clean_reasoning(msg.get("reasoning") or msg.get("content")))
    return turns


# ---------------------------------------------------------------------------
# head 段切分(与 compact_with_llm / context_compaction 的配对组语义一致)
# ---------------------------------------------------------------------------


def extract_head_messages(
    messages: list[dict[str, Any]], keep_recent: int = DEFAULT_KEEP_RECENT
) -> list[dict[str, Any]] | None:
    """取出将被压缩的 head 段(首条 system + 尾部 keep_recent 条配对组保留,其余为 head)。

    返回 None 表示无 head(消息过少 / 全部落入尾部)。与 context_compaction
    的切分逐语义一致:用 _split_pair_groups 保证 assistant(tool_calls) 与 tool 结果
    不被拆散(orphaned tool result 会让上游 API 直接 400)。
    """
    if len(messages) < DEFAULT_MIN_MESSAGES:
        return None
    first_is_system = bool(messages) and messages[0].get("role") == "system"
    non_system = messages[1:] if first_is_system else messages
    if len(non_system) <= keep_recent:
        return None
    groups = _split_pair_groups(non_system)
    tail_groups: list[list[dict[str, object]]] = []
    tail_count = 0
    for group in reversed(groups):
        tail_groups.insert(0, group)
        tail_count += len(group)
        if tail_count >= keep_recent:
            break
    head_groups = groups[: len(groups) - len(tail_groups)]
    if not head_groups:
        return None
    return [msg for group in head_groups for msg in group]


# ---------------------------------------------------------------------------
# 蒸馏
# ---------------------------------------------------------------------------


def _tool_name(call: Any) -> str:
    """从 tool_call 提取工具名(OpenAI 形态 function.name;兼容扁平 name)。"""
    if not isinstance(call, dict):
        return "?"
    fn = call.get("function")
    if isinstance(fn, dict):
        name = fn.get("name")
        if isinstance(name, str) and name:
            return name
    name = call.get("name")
    return name if isinstance(name, str) and name else "?"


def _tool_call_id(call: Any) -> str:
    if isinstance(call, dict):
        cid = call.get("id")
        if isinstance(cid, str):
            return cid
    return ""


def _tool_outcome(content: Any) -> tuple[str, str]:
    """判定工具结果成败 → (status, error_text)。

    只认确定性信号:JSON 结果的 error 键 / success=false / 非零 exit_code。
    其他一律视为 ok(不做"文本里出现 error 就算失败"这类误判)。
    """
    parsed: Any = None
    if isinstance(content, dict):
        parsed = content
    elif isinstance(content, str):
        stripped = content.strip()
        if stripped.startswith("{"):
            try:
                parsed = json.loads(stripped)
            except (TypeError, ValueError):
                parsed = None
    if isinstance(parsed, dict):
        err = parsed.get("error")
        if err:
            return "error", str(err)
        if parsed.get("success") is False:
            detail = parsed.get("message") or parsed.get("detail") or "success=false"
            return "error", str(detail)
        code = parsed.get("exit_code")
        if isinstance(code, int) and code != 0:
            return "error", f"exit_code={code}"
        if isinstance(code, str) and code.strip().lstrip("-").isdigit() and int(code) != 0:
            return "error", f"exit_code={code.strip()}"
    return "ok", ""


def distill_decision_chain(
    messages: Iterable[dict[str, Any]],
    *,
    max_entries: int = AGENT_DECISION_CHAIN_MAX_ENTRIES,
    reasoning_chars: int = AGENT_DECISION_CHAIN_REASONING_CHARS,
) -> list[str]:
    """把消息段蒸馏为决策条目行(纯确定性,零 LLM 调用)。

    每条 = 一个"带工具调用的 assistant 轮次":推理(截断)+ 动作(工具名 + 成败 + 报错片段)。
    超过 max_entries 丢最旧(近期决策权重更高,远期决策由摘要正文兜底)。
    """
    msgs = [m for m in messages if isinstance(m, dict)]
    # 先建 tool_call_id → 结果 索引(assistant 与 tool 结果在 head 段内同批出现)
    outcomes: dict[str, tuple[str, str]] = {}
    for msg in msgs:
        if msg.get("role") != "tool":
            continue
        cid = msg.get("tool_call_id")
        if isinstance(cid, str) and cid:
            outcomes[cid] = _tool_outcome(msg.get("content"))

    lines: list[str] = []
    for msg in msgs:
        if msg.get("role") != "assistant":
            continue
        calls = msg.get("tool_calls")
        if not isinstance(calls, list) or not calls:
            continue
        reasoning = _clip(
            _clean_reasoning(msg.get("reasoning") or msg.get("content")), reasoning_chars
        )
        actions: list[str] = []
        for call in calls:
            name = _tool_name(call)
            status, err = outcomes.get(_tool_call_id(call), ("ok", ""))
            if status == "error":
                detail = _clip(err, ERROR_CHARS)
                actions.append(f"{name}(error: {detail})" if detail else f"{name}(error)")
            else:
                actions.append(f"{name}(ok)")
        lines.append(f"- 推理:{reasoning or MISSING_REASONING} | 动作:{', '.join(actions)}")

    if max_entries > 0 and len(lines) > max_entries:
        lines = lines[-max_entries:]
    return lines


def render_decision_chain(lines: list[str]) -> str:
    """条目行 → 带起止标记的块文本(空输入返回空串)。"""
    if not lines:
        return ""
    header = BLOCK_HEADER_TEMPLATE.format(n=len(lines))
    return "\n".join([header, *lines, BLOCK_END])


def extract_chain_lines(text: str) -> list[str]:
    """从已注入块中取出条目行(原样保留,用于跨压缩接续)。"""
    if not isinstance(text, str) or BLOCK_START not in text:
        return []
    start = text.find(BLOCK_START)
    tail = text[start:]
    newline = tail.find("\n")
    if newline < 0:
        return []
    end = text.find(BLOCK_END, start)
    body = text[start + newline + 1 : end if end >= 0 else len(text)]
    return [line for line in body.splitlines() if line.strip().startswith("- ")]


def strip_decision_chain(text: str) -> str:
    """剥离已注入的决策链块(幂等注入前置);无块时原样返回。"""
    if not isinstance(text, str) or BLOCK_START not in text:
        return text
    start = text.find(BLOCK_START)
    end = text.find(BLOCK_END, start)
    if end < 0:
        return text[:start].rstrip()
    return (text[:start] + text[end + len(BLOCK_END) :]).strip()


# ---------------------------------------------------------------------------
# 注入(接线入口)
# ---------------------------------------------------------------------------


def _summary_index(messages: list[dict[str, Any]]) -> int:
    """定位压缩产物中的摘要消息(system 之外的 SUMMARY_MARKER 开头消息);无则 -1。"""
    for idx, msg in enumerate(messages):
        if not isinstance(msg, dict) or msg.get("role") == "system":
            continue
        content = msg.get("content")
        if isinstance(content, str) and content.startswith(SUMMARY_MARKER):
            return idx
    return -1


def _assess_reasoning_retention(
    original: list[dict[str, Any]], compressed: list[dict[str, Any]]
) -> dict[str, Any]:
    """推理保留率自证(延迟导入 compaction_quality,避免模块级循环依赖)。

    质量模块任何异常都不得影响压缩链路 → 失败返回空 dict(指标缺失,功能不受损)。
    """
    try:
        from .compaction_quality import assess_reasoning_retention

        return assess_reasoning_retention(original, compressed)
    except Exception as e:  # noqa: BLE001 - 自证失败绝不影响压缩交付
        logger.debug("推理保留率自证失败(降级为不携带指标): %s", e)
        return {}


def inject_decision_chain(
    compressed: list[dict[str, Any]],
    source_messages: list[dict[str, Any]],
    *,
    keep_recent: int = DEFAULT_KEEP_RECENT,
    max_entries: int = AGENT_DECISION_CHAIN_MAX_ENTRIES,
    reasoning_chars: int = AGENT_DECISION_CHAIN_REASONING_CHARS,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """把决策链注入压缩产物的摘要消息,并自证推理保留率。

    返回 (新消息列表, meta)。未注入时原样返回入参列表(引用相同 → 与现状逐零差异);
    注入时只替换摘要消息那一个 dict(其余消息对象保持原引用,快照回捞的对象身份
    比对逻辑不受影响)。

    接续与去重:上一次压缩注入的条目原样接续,本次新蒸馏的条目与之**逐行去重**
    (第二次压缩时 head 段可能仍包含上一轮已蒸馏过的轮次 —— 例如它落在上轮的尾部
    保留段里,若不去重会整条重复);合并后超上限丢最旧。

    meta 字段(计数均为裁剪后口径,可直接与注入内容对上):
      enabled / injected / reason(未注入原因) / entries(最终条数) /
      carried(其中继承自上一次压缩的条数) / fresh(其中本次新蒸馏的条数) /
      reasoning_retention(自证指标,注入成功时才有)
    """
    meta: dict[str, Any] = {"enabled": True, "injected": False, "reason": "", "entries": 0}
    idx = _summary_index(compressed)
    if idx < 0:
        meta["reason"] = "no_summary_message"
        return compressed, meta
    head = extract_head_messages(source_messages, keep_recent)
    if head is None:
        meta["reason"] = "no_head"
        return compressed, meta
    old_content = compressed[idx].get("content")
    if not isinstance(old_content, str):
        meta["reason"] = "bad_summary_content"
        return compressed, meta

    carried = extract_chain_lines(old_content)
    fresh_all = distill_decision_chain(
        head, max_entries=max_entries, reasoning_chars=reasoning_chars
    )
    # 逐行去重:第二次压缩的 head 段可能仍含上一轮已蒸馏过的轮次(它落在上轮尾部
    # 保留段里),不去重会整条重复;承接语义上旧条目在前(时序更早),故保留先出现者。
    seen = set(carried)
    fresh: list[str] = []
    for line in fresh_all:
        if line in seen:
            continue
        seen.add(line)
        fresh.append(line)

    tagged: list[tuple[str, str]] = [(line, "carried") for line in carried] + [
        (line, "fresh") for line in fresh
    ]
    if max_entries > 0 and len(tagged) > max_entries:
        tagged = tagged[-max_entries:]  # 超限丢最旧(接续条目先被丢)
    if not tagged:
        meta["reason"] = "no_decisions"
        return compressed, meta

    lines = [line for line, _ in tagged]
    base = strip_decision_chain(old_content).rstrip()
    out = list(compressed)
    out[idx] = {**compressed[idx], "content": f"{base}\n{render_decision_chain(lines)}"}
    meta.update(
        {
            "injected": True,
            "entries": len(lines),
            "carried": sum(1 for _, origin in tagged if origin == "carried"),
            "fresh": sum(1 for _, origin in tagged if origin == "fresh"),
            "reasoning_retention": _assess_reasoning_retention(source_messages, out),
        }
    )
    return out, meta


def apply_decision_chain(
    compressed: list[dict[str, Any]],
    source_messages: list[dict[str, Any]],
    *,
    keep_recent: int = DEFAULT_KEEP_RECENT,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """开关感知 + 异常兜底的注入包装 —— 各压缩调用点只用这一行。

    三件事(顺序固定):
      1. AGENT_DECISION_CHAIN_ENABLED=off → 原样返回,meta.enabled=False,
         调用点据此零行为差异(不注入、不计指标);
      2. 开则调 inject_decision_chain(条数/字符上限在调用时从 tunables 读取,
         支持运行时改环境变量/单测 monkeypatch);
      3. 任何异常都吞掉并降级为"未注入"(压缩链路绝不因增强层引入新故障)。

    Returns:
        (消息列表, meta)。meta 至少含 enabled / injected / reason。
    """
    if not AGENT_DECISION_CHAIN_ENABLED:
        return compressed, {"enabled": False, "injected": False, "reason": "disabled"}
    try:
        return inject_decision_chain(
            compressed,
            source_messages,
            keep_recent=keep_recent,
            max_entries=AGENT_DECISION_CHAIN_MAX_ENTRIES,
            reasoning_chars=AGENT_DECISION_CHAIN_REASONING_CHARS,
        )
    except Exception as e:  # noqa: BLE001 - 增强层异常绝不阻塞压缩交付
        logger.warning("[决策链] 蒸馏/注入失败(降级为不注入): %s", e)
        return compressed, {"enabled": True, "injected": False, "reason": f"error: {e}"}


__all__ = [
    "BLOCK_END",
    "BLOCK_START",
    "ERROR_CHARS",
    "MISSING_REASONING",
    "REASONING_COVERAGE_THRESHOLD",
    "apply_decision_chain",
    "content_tokens",
    "distill_decision_chain",
    "extract_chain_lines",
    "extract_head_messages",
    "inject_decision_chain",
    "messages_blob",
    "reasoning_turns",
    "render_decision_chain",
    "strip_decision_chain",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

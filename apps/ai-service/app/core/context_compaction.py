# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""上下文压缩模块(Python 端兜底实现)。

跨端统一规则(与 TypeScript 共享包 @ihui/context-compaction 等价):
- 默认触发阈值:88%(0.88)
- 默认目标:60%(0.6)
- 默认尾部保留:6 条 non-system 消息
- 压缩策略:保留首条 system + 尾部至少 N 条(按 tool_calls 配对组对齐),中段用结构化摘要替代
- 摘要格式:[上下文摘要 — 之前 N 条消息已压缩] 标记行 + 分层金字塔摘要
  (近层 = 最后 ceil(N*0.3) 条至少 1 条:user/assistant 与 tool result 保留前 200 字符;
   远层 = 其余消息:user/assistant 浓缩到前 120 字符,tool result 前 120 字符)
- 摘要防嵌套:历史摘要消息(SUMMARY_MARKER 开头)再压缩时正文原样并入、条数累加,不再套规则摘要
- tool_calls 配对保护:kr 切分按配对组对齐,assistant(tool_calls) 与其 tool 结果不拆散(防孤 tool 消息 400)
- 防循环两级降级:压缩后仍超阈值时,先截断最后一条消息内容降级(trigger=truncated);
  截断到最小长度仍超阈值(典型:system 本身巨大)才返回原消息(trigger=incompressible)

设计目的:
- API 层(apps/api)在调用 ai-service 前已调用 TS 共享包压缩
- ai-service 本层是兜底:防御性压缩,避免 API 漏传 contextLimit 时仍能保护上下文
- 跨端一致性:Python 实现与 TS 共享包逻辑等价,阈值统一 0.88
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any

import tiktoken

logger = logging.getLogger(__name__)

# 跨端统一常量(与 @ihui/context-compaction 一致)
DEFAULT_TRIGGER_RATIO = 0.88
DEFAULT_TARGET_RATIO = 0.6
DEFAULT_KEEP_RECENT = 6
DEFAULT_MIN_MESSAGES = 2  # 与 TS 共享包一致(2026-08-16 起):仅 system+1 条即可压缩;旧值 7 在短对话/历史被截断时误判"消息不足"

# 截断降级(truncate-fallback)常量:常规压缩无效时对最后一条消息做内容截断
MIN_TRUNCATE_CHARS = 100  # 截断保留的最小字符数(下限)
TRUNCATE_MARKER = "…[已截断]"  # 截断标记(追加在被截断内容末尾)
MAX_TRUNCATE_ATTEMPTS = 8  # 截断迭代最大次数

# 摘要标记(与 TS 共享包 SUMMARY_MARKER 一致):历史摘要消息以此开头,
# 再压缩时正文原样并入、条数累加(防嵌套),不再套规则摘要
SUMMARY_MARKER = "[上下文摘要"

# 分层金字塔摘要常量:按时间距离分层 —— 越近的保留越多细节,越远的越浓缩,
# 同样 token 预算下信息保留度显著更高(与 TS 共享包 @ihui/context-compaction 逐语义一致)
# 近层占比:非历史摘要消息中最后 ceil(N * ratio) 条(至少 1 条)为近层
SUMMARY_TIER_RECENT_RATIO = 0.3
# 近层消息保留的字符数(user/assistant 直截 + tool result)
SUMMARY_RECENT_CHARS = 200
# 远层消息保留的字符数(user/assistant 浓缩截断 + tool result 截断)
SUMMARY_REMOTE_CHARS = 120
# tool result 摘要保留字符数兼容别名:旧"统一 160"已收编到分层常量(远层 120)
TOOL_RESULT_SUMMARY_CHARS = SUMMARY_REMOTE_CHARS

# ==================== Token 估算开销常量(2026-09-02 跨端对齐) ====================
# 与 TS 共享包 @ihui/context-compaction 逐值一致
MESSAGE_OVERHEAD_TOKENS = 4  # 单条消息固定开销(role/name 分隔)
TOOL_CALL_OVERHEAD_TOKENS = 4  # 单条 tool_call 固定 JSON 协议开销
IMAGE_TOKEN_PLACEHOLDER = 1200  # 多模态图片占位估算(每张图)

# data:image/...;base64,XXX 多模态图片占位正则
_DATA_IMAGE_RE = re.compile(r"data:image/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+")

# 模块级 encoder 缓存(CI 502 修复:lazy 加载避免 import 时报错)
_encoder: tiktoken.Encoding | None = None


def _get_encoder() -> tiktoken.Encoding:
    """获取 tiktoken encoder(cl100k_base,与 TS 端 gpt-tokenizer 一致)。"""
    global _encoder
    if _encoder is None:
        try:
            _encoder = tiktoken.get_encoding("cl100k_base")
        except Exception as e:
            logger.warning("Failed to load tiktoken cl100k_base: %s, fallback to p50k", e)
            _encoder = tiktoken.get_encoding("p50k_base")
    return _encoder


def _estimate_text_with_image_placeholders(text: str) -> int:
    """估算字符串 token,命中 data:image base64 时按 IMAGE_TOKEN_PLACEHOLDER 占位短路。

    跨端对齐:与 TS 共享包 estimateTextWithImagePlaceholders 行为一致,
    避免对超大 base64 段做完整 BPE(慢且虚高)。
    """
    if not text:
        return 0
    matches = list(_DATA_IMAGE_RE.finditer(text))
    if not matches:
        try:
            return len(_get_encoder().encode(text))
        except Exception as e:
            logger.debug("tiktoken encode failed: %s, fallback to len/4", e)
            return max(1, len(text) // 4)
    total = 0
    cursor = 0
    try:
        enc = _get_encoder()
    except Exception as e:
        logger.debug("tiktoken encoder unavailable: %s, fallback to len/4", e)
        enc = None
    for m in matches:
        if m.start() > cursor:
            seg = text[cursor:m.start()]
            if enc is not None:
                total += len(enc.encode(seg))
            else:
                total += max(1, len(seg) // 4)
        total += IMAGE_TOKEN_PLACEHOLDER
        cursor = m.end()
    if cursor < len(text):
        seg = text[cursor:]
        if enc is not None:
            total += len(enc.encode(seg))
        else:
            total += max(1, len(seg) // 4)
    return total


def _estimate_tool_call_tokens(tc: Any) -> int:
    """估算单条 tool_call 的 token 数(id+type+name+arguments + 固定开销)。

    跨端对齐:与 TS 共享包 estimateToolCallTokens 行为一致。
    """
    if not isinstance(tc, dict):
        return 0
    tc_id = tc.get("id")
    if not isinstance(tc_id, str):
        return 0
    fn = tc.get("function") or {}
    inner = tc_id + (tc.get("type") or "") + (fn.get("name") or "") + (fn.get("arguments") or "")
    return _estimate_text_with_image_placeholders(inner) + TOOL_CALL_OVERHEAD_TOKENS


def estimate_tokens(text: str) -> int:
    """估算字符串的 token 数(BPE 真实分词),与 TS 端 gpt-tokenizer 一致(cl100k_base)。

    含 data:image base64 占位短路(与 TS 共享包 estimateTokens 一致)。
    """
    return _estimate_text_with_image_placeholders(text)


def estimate_messages_tokens(messages: list[dict[str, Any]]) -> int:
    """估算消息列表的 token 数(2026-09-02 跨端对齐)。

    增量规则(与 TS 共享包一致):
    - 每条消息 +MESSAGE_OVERHEAD_TOKENS
    - assistant tool_calls[].function.arguments 等同字符串参与 BPE,+TOOL_CALL_OVERHEAD_TOKENS/条
    - tool 消息若有 tool_call_id,+TOOL_CALL_OVERHEAD_TOKENS
    - content 中的 data:image base64 段按 IMAGE_TOKEN_PLACEHOLDER 占位
    - OpenAI vision list-of-parts 格式逐 part 估 +MESSAGE_OVERHEAD_TOKENS
    """
    total = 0
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            # str 内容(含缺失时默认 ''):+1 条消息 overhead + 内容 token
            total += MESSAGE_OVERHEAD_TOKENS + estimate_tokens(content)
        elif isinstance(content, list):
            # OpenAI vision 格式:list of {type, text/image_url},逐 part 估
            # overhead 按 part 计(不再额外加消息级 overhead,避免与 TS 不一致)
            for part in content:
                if isinstance(part, dict):
                    text = part.get("text") or str(part.get("content", ""))
                    total += estimate_tokens(text) + MESSAGE_OVERHEAD_TOKENS
        # content 非 str 非 list(如数字)→ 跳过,不贡献任何 token/overhead
        # tool_calls 参数(token 增量,与 TS 一致)
        tool_calls = msg.get("tool_calls")
        if isinstance(tool_calls, list):
            for tc in tool_calls:
                total += _estimate_tool_call_tokens(tc)
        # tool 消息的 tool_call_id(与 TS 一致)
        if msg.get("role") == "tool" and isinstance(msg.get("tool_call_id"), str) and msg.get("tool_call_id"):
            total += TOOL_CALL_OVERHEAD_TOKENS
    return total


def _summarize_message(
    msg: dict[str, Any],
    max_chars: int = SUMMARY_RECENT_CHARS,
    *,
    tool_chars: int | None = None,
    ellipsis: str = "...",
) -> str:
    """单条消息摘要:角色 + 内容前 N 字符。

    role='tool' 的结果消息保留前 tool_chars(默认 TOOL_RESULT_SUMMARY_CHARS = 120)字符 + '…'
    (空内容才用纯占位),不用固定占位模板,避免丢失工具结果关键信息(与 TS 共享包对齐)。
    user/assistant 保留前 max_chars(默认 SUMMARY_RECENT_CHARS = 200)字符:
    - 分层近层:传 ellipsis='…' 与 TS 近层直截格式逐字一致
    - 分层远层:传 max_chars=SUMMARY_REMOTE_CHARS(120) 浓缩
    """
    role = msg.get("role", "unknown")
    content = msg.get("content", "")
    if not isinstance(content, str):
        content = str(content)
    if role == "tool":
        if not content:
            return "[tool] (空)"
        keep = TOOL_RESULT_SUMMARY_CHARS if tool_chars is None else tool_chars
        if len(content) > keep:
            content = content[:keep] + "…"
        return f"[{role}] {content}"
    if len(content) > max_chars:
        content = content[:max_chars] + ellipsis
    return f"[{role}] {content}"


# 历史摘要标记行中的覆盖条数(与 TS 共享包格式一致)
_SUMMARY_COUNT_RE = re.compile(r"之前 (\d+) 条消息已压缩")


def _parse_existing_summary(content: str) -> tuple[int, str]:
    """解析历史摘要消息:返回 (旧覆盖条数, 标记行之后的正文)。

    条数解析失败按 1(防嵌套仍生效,计数保守);正文原样返回(仅去首尾空白)。
    """
    match = _SUMMARY_COUNT_RE.search(content)
    covered = int(match.group(1)) if match else 1
    newline_idx = content.find("\n")
    body = content[newline_idx + 1 :] if newline_idx != -1 else ""
    return covered, body.strip()


def _build_structured_summary(
    messages: list[dict[str, Any]],
    custom_summary: str = "",
) -> str:
    """结构化摘要:分层金字塔摘要(近层保留细节 / 远层浓缩)+ 累积摘要(防嵌套)。

    分层(与 TS 共享包 buildSummaryMessage 逐语义一致):
    - 非历史摘要消息按位置分层:最后 ceil(N * SUMMARY_TIER_RECENT_RATIO) 条(至少 1 条)为近层
    - 近层:user/assistant 与 tool result 都保留前 SUMMARY_RECENT_CHARS(200) 字符直截('…' 后缀)
    - 远层:user/assistant 浓缩到前 SUMMARY_REMOTE_CHARS(120) 字符,tool result 前 120 字符
    - 层级只影响保留量,摘要行输出格式无层级标记
    - custom_summary 非空时(LLM 语义摘要)优先级最高:整段替代规则摘要正文,不做分层

    防嵌套(与 TS 共享包 SUMMARY_MARKER 语义一致):
    - 输入中含历史摘要消息(content 以 SUMMARY_MARKER 开头)时不对其套规则摘要,
      其标记行之后的正文原样并入新摘要
    - 新标记行条数 = 非摘要消息条数 + 旧摘要覆盖条数之和
    """
    # 预统计非历史摘要消息条数,确定近层边界(最后 ceil(N * ratio) 条,至少 1 条)
    non_summary_total = 0
    for msg in messages:
        if msg.get("role") == "system":
            continue
        content = msg.get("content", "")
        if isinstance(content, str) and content.startswith(SUMMARY_MARKER):
            continue
        non_summary_total += 1
    recent_count = max(1, math.ceil(non_summary_total * SUMMARY_TIER_RECENT_RATIO))
    recent_from = non_summary_total - recent_count

    summary_lines: list[str] = []
    old_bodies: list[str] = []
    old_covered = 0
    non_summary_count = 0
    for msg in messages:
        if msg.get("role") == "system":
            continue
        content = msg.get("content", "")
        if isinstance(content, str) and content.startswith(SUMMARY_MARKER):
            covered, body = _parse_existing_summary(content)
            old_covered += covered
            if body:
                old_bodies.append(body)
            continue
        is_recent = non_summary_count >= recent_from
        non_summary_count += 1
        if msg.get("role") == "tool":
            summary = (
                _summarize_message(msg, tool_chars=SUMMARY_RECENT_CHARS)
                if is_recent
                else _summarize_message(msg)
            )
        elif is_recent:
            summary = _summarize_message(msg, ellipsis="…")
        else:
            summary = _summarize_message(msg, max_chars=SUMMARY_REMOTE_CHARS)
        if summary:
            summary_lines.append(f"- {summary}")
    total_covered = non_summary_count + old_covered
    lines = [f"{SUMMARY_MARKER} — 之前 {total_covered} 条消息已压缩]"]
    if custom_summary:
        # LLM 语义摘要优先级最高:整段替代(不做分层),标记行计数仍按防嵌套规则累计
        lines.append(custom_summary)
        return "\n".join(lines)
    # 旧摘要正文原样并入(时序在前,不套规则摘要),新摘要行在后
    lines.extend(old_bodies)
    lines.extend(summary_lines)
    return "\n".join(lines)


def _extract_tool_call_ids(tool_calls: object) -> list[str]:
    """从 assistant 消息的 tool_calls 字段提取 tool_call id 列表(isinstance 严格守卫)。

    OpenAI 格式:[{id: str, type: 'function', function: {...}}, ...]
    非 list / 元素非 dict / 缺 id / id 不是非空 str 一律跳过(防御性,不做任何假设)。
    """
    if not isinstance(tool_calls, list):
        return []
    ids: list[str] = []
    for tc in tool_calls:
        if isinstance(tc, dict):
            tc_id = tc.get("id")
            if isinstance(tc_id, str) and tc_id:
                ids.append(tc_id)
    return ids


def _split_pair_groups(
    non_system: list[dict[str, object]],
) -> list[list[dict[str, object]]]:
    """把 non-system 消息切成"配对组":assistant(tool_calls) 与其 tool 结果不可拆散。

    规则(与 TS 共享包语义一致):
    - role='assistant' 且 tool_calls 非空 → 开新组
    - 后续 role='tool' 且 tool_call_id ∈ 该 assistant 的 tool_calls[].id → 入组
      (pending id 集合空了 → 组结束;遇到其他 role → 组结束)
    - 其他消息各自成组;异常序列(tool 无归属)自成组
    - 配对组开放期间遇到的无归属 tool 组延后落组(排在配对组之后),
      保证配对组不被散组打断,摊平后消息顺序与原序一致
    """
    groups: list[list[dict[str, object]]] = []
    deferred: list[list[dict[str, object]]] = []  # 配对组开放期间的无归属 tool 组
    current: list[dict[str, object]] | None = None
    pending: set[str] = set()

    for msg in non_system:
        role = msg.get("role")
        if role == "assistant":
            if current is not None:
                # 新 assistant 结束未闭合的上一组(pending 未空也结束,保留已收集部分)
                groups.append(current)
                groups.extend(deferred)
                deferred.clear()
                current = None
                pending = set()
            call_ids = _extract_tool_call_ids(msg.get("tool_calls"))
            if call_ids:
                current = [msg]
                pending = set(call_ids)
            else:
                groups.append([msg])
            continue

        if role == "tool" and current is not None:
            tc_id = msg.get("tool_call_id")
            if isinstance(tc_id, str) and tc_id in pending:
                current.append(msg)
                pending.discard(tc_id)
                if not pending:
                    groups.append(current)
                    groups.extend(deferred)
                    deferred.clear()
                    current = None
            else:
                # tool 无归属(id 不匹配/缺失)→ 异常序列自成组,当前组保持开放
                deferred.append([msg])
            continue

        # user / 其他 role → 结束开放组,自身成组
        if current is not None:
            groups.append(current)
            groups.extend(deferred)
            deferred.clear()
            current = None
            pending = set()
        groups.append([msg])

    if current is not None:
        groups.append(current)
    groups.extend(deferred)
    return groups


def _truncate_fallback(
    system_msgs: list[dict[str, Any]],
    non_system: list[dict[str, Any]],
    context_limit: int,
    original_tokens: int,
    trigger_threshold: int,
    target_threshold: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]] | None:
    """第一级降级:kr=1(按配对组)+ 组内最后一条可截断消息内容截断(system 消息永不截断)。

    常规摘要压缩无法达标时(典型:超长单条消息如粘贴大文件,摘要化收益不足),
    重建 kr=1 方案(system + 摘要 + 最后一组消息),对组内最后一条 content 为 str 的
    user/assistant 消息做内容截断(组内 tool result 不截断,保持 tool_calls 配对完整),
    按 BPE 密度估算裁剪字符量,迭代收敛到目标阈值以下。
    最后一组只有一条消息时与旧行为一致。

    Returns:
        截断后 tokens < 触发阈值 → (截断后的消息列表, info dict, trigger='truncated')
        组内无可安全截断的 str content 消息,或截断到最小长度仍 >= 触发阈值
        (典型:system 本身巨大)→ None(走 incompressible)
    """
    if not non_system:
        return None

    groups = _split_pair_groups(non_system)
    last_group = groups[-1]

    # 截断目标:组内最后一条 content 为非空 str 的 user/assistant 消息(tool result 不截断)
    target_idx: int | None = None
    target_content = ""
    for idx in range(len(last_group) - 1, -1, -1):
        msg = last_group[idx]
        if msg.get("role") not in ("user", "assistant"):
            continue
        content = msg.get("content", "")
        if isinstance(content, str) and content:
            target_idx = idx
            target_content = content
            break
    if target_idx is None:
        return None

    # kr=1 方案:system + 摘要(最后一组之前的全部 non-system) + 最后一组(完整保留)
    to_compress_msgs = [m for group in groups[:-1] for m in group]
    fallback_summary: dict[str, Any] = {
        "role": "user",
        "content": _build_structured_summary(to_compress_msgs),
    }
    kept_group = list(last_group)
    truncated_target: dict[str, Any] = dict(last_group[target_idx])  # 拷贝,不改动原消息
    kept_group[target_idx] = truncated_target
    candidate = [*system_msgs, fallback_summary, *kept_group]

    keep_content = target_content
    tokens = 0
    for _attempt in range(MAX_TRUNCATE_ATTEMPTS):
        truncated_target["content"] = keep_content
        tokens = estimate_messages_tokens(candidate)
        if tokens <= target_threshold:
            break  # 截断成功
        if len(keep_content) <= MIN_TRUNCATE_CHARS:
            break  # 截到下限仍不达标
        excess_tokens = tokens - target_threshold
        # 每 char 的 token 数(BPE 密度),据此估算需裁剪的字符数,1.2 倍安全余量
        density = estimate_tokens(keep_content) / max(1, len(keep_content))
        cut_chars = math.ceil((excess_tokens / max(density, 0.01)) * 1.2)
        keep_content = keep_content[: max(MIN_TRUNCATE_CHARS, len(keep_content) - cut_chars)] + TRUNCATE_MARKER

    if tokens >= trigger_threshold:
        # 截断到最小长度仍超触发阈值 → 第二级 incompressible
        return None

    logger.warning(
        "[Compaction] truncate-fallback: %d → %d tokens (trigger_threshold=%d), "
        "last group target message %d → %d chars",
        original_tokens,
        tokens,
        trigger_threshold,
        len(target_content),
        len(truncated_target["content"]),
    )
    return candidate, {
        "compressed": True,
        "original_tokens": original_tokens,
        "compressed_tokens": tokens,
        "removed_count": len(non_system) - len(last_group),
        "usage_ratio": original_tokens / context_limit,
        "trigger": "truncated",
    }


def compress_messages_if_needed(
    messages: list[dict[str, Any]],
    context_limit: int,
    trigger_ratio: float = DEFAULT_TRIGGER_RATIO,
    target_ratio: float = DEFAULT_TARGET_RATIO,
    keep_recent: int = DEFAULT_KEEP_RECENT,
    custom_summary: str = "",
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """百分比阈值自动压缩(与 TS 共享包 compressContextIfNeeded 等价)。

    Args:
        messages: OpenAI 格式消息列表
        context_limit: 模型上下文窗口大小(tokens)
        trigger_ratio: 触发压缩的占用率(默认 0.88)
        target_ratio: 压缩后的目标占用率(默认 0.6)
        keep_recent: 尾部保留的 non-system 消息数(默认 6;按配对组对齐,可能整组多保留)
        custom_summary: 外部预生成的语义摘要(可选,对齐 TS customSummary):
            非空时摘要正文整段用该文本(不做分层),标记行仍自动生成

    Returns:
        (compressed_messages, info)
        - compressed_messages: 压缩后的消息列表(或原列表,若未触发)
        - info: dict {compressed: bool, original_tokens, compressed_tokens, removed_count, usage_ratio, trigger}
    """
    if context_limit <= 0:
        return messages, {
            "compressed": False,
            "original_tokens": 0,
            "compressed_tokens": 0,
            "removed_count": 0,
            "usage_ratio": 0,
            "trigger": "none",
        }

    original_tokens = estimate_messages_tokens(messages)
    trigger_threshold = int(context_limit * trigger_ratio)

    if original_tokens <= trigger_threshold:
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": original_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "none",
        }

    # 消息数过少不压缩(minMessages = 2,与 TS 共享包一致)
    if len(messages) < DEFAULT_MIN_MESSAGES:
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": original_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "none",
        }

    # 分割:首条 system + head(压缩) + tail(保留 keepRecent 条)
    has_system = messages and messages[0].get("role") == "system"
    system_msgs = [messages[0]] if has_system else []
    non_system = messages[1:] if has_system else messages

    if len(non_system) <= keep_recent:
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": original_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "none",
        }

    # 配对组保护:kr 切分点对齐组边界(不拆散 assistant(tool_calls) 与其 tool 结果)
    # 从组列表尾部往前累计消息条数直到 >= keep_recent,toKeep 尾部完整组、toCompress 头部完整组
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
        # 全部组落入尾部(如单个巨大配对组覆盖整个 kr 窗口)→ 按组无法切分,不压缩
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": original_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "none",
        }

    tail = [msg for group in tail_groups for msg in group]
    head = [msg for group in head_groups for msg in group]

    # 生成结构化摘要(custom_summary 非空时整段替代,不做分层)
    summary_text = _build_structured_summary(head, custom_summary=custom_summary)
    summary_msg: dict[str, Any] = {
        "role": "user",
        "content": summary_text,
    }

    # 合并:system + summary + tail
    compressed = system_msgs + [summary_msg] + tail
    compressed_tokens = estimate_messages_tokens(compressed)
    removed_count = len(head)

    # 防循环保护(与 TS 共享包对齐):压缩后仍超触发阈值 → 常规压缩无效,
    # 不再返回常规压缩结果,避免"每轮都压缩、摘要套摘要"的历史质量退化。
    # 两级降级:先截断最后一条消息内容(truncated),仍不行才判 incompressible
    if compressed_tokens >= trigger_threshold:
        # 第一级:截断降级(超长单条消息摘要化收益不足时,截到最后一条消息上)
        fallback = _truncate_fallback(
            system_msgs=system_msgs,
            non_system=non_system,
            context_limit=context_limit,
            original_tokens=original_tokens,
            trigger_threshold=trigger_threshold,
            target_threshold=int(context_limit * target_ratio),
        )
        if fallback is not None:
            return fallback

        # 第二级 incompressible:截断到最小长度仍超触发阈值
        # (典型场景:system prompt 本身巨大且 system 消息永不截断)
        logger.warning(
            "Context incompressible: compressed %d tokens still >= trigger threshold %d "
            "(system/material 占用过大), skip re-summarization loop",
            compressed_tokens,
            trigger_threshold,
        )
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": compressed_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "incompressible",
        }

    logger.info(
        "Context compressed: %d → %d tokens (removed %d messages, ratio %.2f → %.2f)",
        original_tokens,
        compressed_tokens,
        removed_count,
        original_tokens / context_limit,
        compressed_tokens / context_limit,
    )

    return compressed, {
        "compressed": True,
        "original_tokens": original_tokens,
        "compressed_tokens": compressed_tokens,
        "removed_count": removed_count,
        "usage_ratio": original_tokens / context_limit,
        "trigger": "ratio",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

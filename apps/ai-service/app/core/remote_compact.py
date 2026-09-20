# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""远端服务端压缩 v2 的纯装配 / 预算逻辑(2026-09-19 第三十一批,对标 Codex compact_remote_v2.rs)。

本模块只搬运 **不依赖 Codex Session / 服务端 Responses 流式 API** 的纯算法;
涉及 Session、ModelClientSession、ResponseStream、rollout trace、hook runtime、
``CodexHarnessMetadata`` / ``ResponseItem`` 协议类型、``event_mapping::parse_turn_item``
等的部分一律 **不在此实现**,判定与证据见模块末尾 ``__PORTABILITY_NOTES__``。

移植范围(纯算法,数据模型统一下沉为 OpenAI 风格消息字典 + 轻量 Envelope 包裹):
- 历史分段:``history_item_groups`` / ``HistoryItemGroup`` / ``is_attached_notice``
  (对标 compact_remote_history.rs,把紧邻 developer 图像缩放通告的消息配对成组)
- client-authored developer 消息判定:``is_client_authored_developer_message``
- 远端压缩 v2 保留过滤:``is_retained_for_remote_compaction_v2``
  (只保留 user / client developer / 特定 agent 消息;system、assistant、普通 developer 丢弃)
- 字节 / token 预算截断(核心可移植算法):
    - ``truncate_retained_messages``:从最新消息向旧回溯,整体 token 预算内保留,
      边界消息超预算则截断其文本;``RetainedImageBudget`` 开启时按图像字节计费
    - ``truncate_message_text_to_token_budget``:单条消息文本截断到 token 预算(图像/音频原样保留)
    - ``truncate_message_to_token_budget``:单条消息内图像原子保留(图像及其相邻标签整块保留/丢弃)
    - 图像预算扣减辅助:``content_item_token_count`` / ``message_content_token_count`` /
      ``message_text_token_count`` / ``retained_input_image_count`` / ``image_token_cost``
- v2 压缩历史装配:``build_v2_compacted_history``(过滤 → 预算截断 → 统计保留图像数 → 追加压缩产物)
- request 装配内核(纯函数,剥离 Session):``assemble_remote_compaction_prompt``

说明:
- token 估算刻意使用轻量启发式 ``approx_token_count``(字符数 // 4),与 Codex
  ``codex_utils_output_truncation::approx_token_count`` 逐语义一致,**不引入 tiktoken**,
  保证模块自包含且跨端可复现。
- 图像 token 计费采用字节近似(``image_token_cost``),与 Codex
  ``approx_tokens_from_byte_count(estimate_image_reference_bytes)`` 等价思路。
- ``attempt 重试语义``(``should_retry_with_current_model`` / ``record_model_fallback``)
  已在 ``app/services/compact_with_llm.py`` 实现,本模块不重复(见末尾证据)。

数据模型约定(OpenAI 风格消息字典):
- ``{"role": "user"|"assistant"|"system"|"developer"|"tool", "content": <str | list[part]> }``
- 多模态 part:``{"type": "text", "text": str}`` /
  ``{"type": "image_url", "image_url": {"url": "data:image/...;base64,..." | "file://..."}}`` /
  ``{"type": "input_audio", "input_audio": {"data": ..., "format": ...}}``
- agent 子消息(Codex ``ResponseItem::AgentMessage`` 的对标):在消息字典上附加
  ``"agent_message": {"author": str, "recipient": str, "content": [text part, ...]}``
- Envelope = ``{"item": 消息字典, "metadata": {"client_authored": bool} | None}``,
  对标 Codex ``ResponseItemEnvelope { item, metadata: Option<CodexHarnessMetadata> }``。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# ===================== 常量(对标 compact_remote_v2.rs) =====================
# 保留消息的总 token 预算(Codex: RETAINED_MESSAGE_TOKEN_BUDGET = 64_000)
RETAINED_MESSAGE_TOKEN_BUDGET: int = 64_000
# 单条 agent 消息可保留的最大 token(Codex: MAX_RETAINED_AGENT_MESSAGE_TOKENS = 10_000)
MAX_RETAINED_AGENT_MESSAGE_TOKENS: int = 10_000
# 压缩 attempt 的流式重试上限(Codex: MAX_REMOTE_COMPACTION_V2_STREAM_RETRIES = 2);
# 纯常量,供上层装配参考,本模块不发起请求。
MAX_REMOTE_COMPACTION_V2_STREAM_RETRIES: int = 2

# 单条消息固定开销 token(与 app.core.context_compaction.MESSAGE_OVERHEAD_TOKENS 对齐)
MESSAGE_OVERHEAD_TOKENS: int = 4
# 多模态图像占位估算 token(与 app.core.context_compaction.IMAGE_TOKEN_PLACEHOLDER 对齐)
IMAGE_TOKEN_PLACEHOLDER: int = 1200
# 文件类图像(无字节信息)的保守固定计费 token
FILE_IMAGE_TOKEN_COST: int = IMAGE_TOKEN_PLACEHOLDER
# 截断标记(与 app.core.context_compaction.TRUNCATE_MARKER 对齐)
TRUNCATE_MARKER: str = "…[已截断]"

# 图像缩放通告标签(对标 Codex ``ImageResizeNotice::matches_text``)
IMAGE_RESIZE_NOTICE_TAG = "<image_resize_notice>"

# agent 子消息首行标记(对标 Codex AgentMessageInputContent 文本前缀判定)
AGENT_MESSAGE_TYPE_PREFIX = "Message Type: "
AGENT_DESCENDANT_PROGRESS = "Message Type: MESSAGE\n"
AGENT_COMPLETION = "Message Type: FINAL_ANSWER\n"


# ===================== token / 字节 估算(轻量启发式) =====================
def approx_token_count(text: str) -> int:
    """文本 token 近似(对标 Codex approx_token_count:字符数 // 4,至少 1)。

    刻意使用启发式而非 BPE,与 Codex 原实现逐语义一致,且使本模块自包含。
    """
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)


def image_token_cost(url: str) -> int:
    """单张图像 token 计费(对标 Codex approx_tokens_from_byte_count(estimate_image_reference_bytes))。

    - data:image base64:按 base64 解码后的字节数近似(bytes // 1000,至少 1)
    - file:// 或 file_id 等无字节信息:保守固定占位(``FILE_IMAGE_TOKEN_COST``)
    """
    if not isinstance(url, str):
        return FILE_IMAGE_TOKEN_COST
    if url.startswith("data:image"):
        # 剥离 "data:image/<sub>;base64," 前缀后,base64 长度 * 3/4 ≈ 字节数
        comma = url.find(",")
        b64 = url[comma + 1:] if comma != -1 else url
        # 去除 base64 可能含有的空白
        b64 = "".join(b64.split())
        byte_count = max(0, (len(b64) * 3) // 4)
        return max(1, byte_count // 1000)
    return FILE_IMAGE_TOKEN_COST


# ===================== 内容 part 解析(OpenAI 风格) =====================
def _content_parts(item: dict[str, Any]) -> list[dict[str, Any]]:
    """把消息 content 规范化为 part 列表(str 内容包成单个 text part)。

    agent 子消息(``agent_message``)的内容位于 ``agent_message.content``,同样纳入统计,
    使 token 估算与 Codex ``estimate_item_token_count`` 对 AgentMessage 的口径一致。
    """
    if "content" in item:
        content = item["content"]
        if isinstance(content, str):
            return [{"type": "text", "text": content}]
        if isinstance(content, list):
            return [p for p in content if isinstance(p, dict)]
    agent = item.get("agent_message")
    if isinstance(agent, dict):
        ac = agent.get("content")
        if isinstance(ac, list):
            return [p for p in ac if isinstance(p, dict)]
    return []


def _part_text(part: dict[str, Any]) -> str:
    """提取 part 的文本内容(兼容 text / input_text 两种写法)。返回 "" 表示非文本。"""
    ptype = part.get("type")
    if ptype in ("text", "input_text"):
        val = part.get("text")
        return val if isinstance(val, str) else ""
    return ""


def _part_is_image(part: dict[str, Any]) -> bool:
    """part 是否为图像(|image_url| 写法)。"""
    return part.get("type") == "image_url"


def _part_image_url(part: dict[str, Any]) -> str:
    img = part.get("image_url")
    if isinstance(img, dict):
        url = img.get("url")
        if isinstance(url, str):
            return url
    return ""


def _part_is_audio(part: dict[str, Any]) -> bool:
    return part.get("type") == "input_audio"


def _is_image_open_tag_text(text: str) -> bool:
    """对标 Codex is_image_open_tag_text(本地图像标签开放标记)。

    本移植使用裸 ``image_url`` part,无文本标签,故恒 False(保留分支以备将来对接标签式图像)。
    """
    return False


def _is_image_close_tag_text(text: str) -> bool:
    """对标 Codex is_image_close_tag_text(图像闭合标签)。裸 part 形态下恒 False。"""
    return False


# ===================== 轻量 Envelope(对标 ResponseItemEnvelope) =====================
@dataclass
class Envelope:
    """消息 + 元数据包裹,对标 Codex ``ResponseItemEnvelope { item, metadata }``。

    ``metadata`` 承载 ``client_authored`` 等来源标记(对标 ``CodexHarnessMetadata``)。
    """

    item: dict[str, Any]
    metadata: dict[str, Any] | None = None


def _envelope_item(env: Envelope) -> dict[str, Any]:
    return env.item


# ===================== 图像缩放通告 / 分组(对标 compact_remote_history.rs) =====================
def is_attached_notice(item: dict[str, Any]) -> bool:
    """判断是否为"附加通告"(对标 Codex is_attached_notice)。

    规则:role 为 developer 且唯一 text part 命中图像缩放通告标签。
    """
    if item.get("role") != "developer":
        return False
    parts = _content_parts(item)
    if len(parts) != 1:
        return False
    text = _part_text(parts[0])
    return IMAGE_RESIZE_NOTICE_TAG in text


@dataclass
class HistoryItemGroup:
    """消息分组:source 消息 + 可选紧邻的附加通告(对标 Codex HistoryItemGroup)。

    附加通告是紧跟 source 之后的 developer 图像缩放通告,在预算截断时作为
    低优先级一并计费/保留。
    """

    source: Envelope
    attached_notice: Envelope | None = None

    def into_items(self) -> list[Envelope]:
        items = [self.source]
        if self.attached_notice is not None:
            items.append(self.attached_notice)
        return items


def history_item_groups(items: list[Envelope]) -> list[HistoryItemGroup]:
    """把消息序列配对成组:每条 source 后若紧邻一条附加通告则并入(对标 Codex history_item_groups)。

    实现为前瞻单步配对:``source = next``;若下一条是 ``is_attached_notice`` 则作为
    ``attached_notice`` 一并取出。
    """
    groups: list[HistoryItemGroup] = []
    i = 0
    n = len(items)
    while i < n:
        source = items[i]
        notice: Envelope | None = None
        if i + 1 < n and is_attached_notice(items[i + 1].item):
            notice = items[i + 1]
            i += 2
        else:
            i += 1
        groups.append(HistoryItemGroup(source=source, attached_notice=notice))
    return groups


# ===================== client developer 判定 =====================
def is_client_authored_developer_message(env: Envelope) -> bool:
    """对标 Codex is_client_authored_developer_message。

    同时满足:metadata.client_authored 为真,且 item.role == "developer"。
    """
    if env.metadata is None or not env.metadata.get("client_authored", False):
        return False
    return env.item.get("role") == "developer"


# ===================== v2 历史分组(把 client developer 通告拆成独立组) =====================
def v2_history_item_groups(items: list[Envelope]) -> list[HistoryItemGroup]:
    """对标 compact_remote_v2.rs::v2_history_item_groups。

    在普通 history_item_groups 之上:若某组的附加通告本身是 client-authored developer 消息,
    则把它从通告位拆出,单独成组(保留其 client 来源语义)。
    """
    out: list[HistoryItemGroup] = []
    for group in history_item_groups(items):
        client_message: HistoryItemGroup | None = None
        if group.attached_notice is not None and is_client_authored_developer_message(
            group.attached_notice
        ):
            notice = group.attached_notice
            group.attached_notice = None
            client_message = HistoryItemGroup(source=notice, attached_notice=None)
        out.append(group)
        if client_message is not None:
            out.append(client_message)
    return out


# ===================== 保留过滤(对标 is_retained_for_remote_compaction_v2) =====================
def is_retained_for_remote_compaction_v2(
    env: Envelope,
    retain_client_developer_messages: bool,
) -> bool:
    """对标 Codex is_retained_for_remote_compaction_v2 的保留判定。

    语义(adapted 到 OpenAI 风格消息):
    - agent 子消息:排除"后代进度"(author 以 recipient+"/" 开头且首行 MESSAGE)与
      "完成"(首行 FINAL_ANSWER),且 token 数不超过 ``MAX_RETAINED_AGENT_MESSAGE_TOKENS``
    - 普通消息:仅 role=="user" 保留(对标 UserMessage/HookPrompt);
      role=="developer" 仅在 ``retain_client_developer_messages`` 且为 client 来源时保留;
      system / assistant / tool 等一律不保留(远端压缩产物会重新注入 system 等上下文)
    """
    item = env.item
    agent = item.get("agent_message")
    if isinstance(agent, dict):
        author = agent.get("author", "")
        recipient = agent.get("recipient", "")
        content = agent.get("content") or []
        first_text = ""
        if content and isinstance(content[0], dict):
            first_text = _part_text(content[0])
        is_descendant_progress = (
            isinstance(author, str)
            and isinstance(recipient, str)
            and author.startswith(recipient)
            and len(author) > len(recipient)
            and author[len(recipient)] == "/"
            and first_text.startswith(AGENT_DESCENDANT_PROGRESS)
        )
        is_completion = first_text.startswith(AGENT_COMPLETION)
        if is_descendant_progress or is_completion:
            return False
        return _estimate_item_tokens(item) <= MAX_RETAINED_AGENT_MESSAGE_TOKENS

    role = item.get("role")
    if role == "user":
        return True
    if role == "developer":
        return retain_client_developer_messages and is_client_authored_developer_message(env)
    return False


# ===================== token 计数辅助 =====================
def _part_token_cost(part: dict[str, Any]) -> int:
    """单 part 的 token 成本(文本走近似,图像走字节计费,音频不计)。"""
    text = _part_text(part)
    if text:
        return approx_token_count(text)
    if _part_is_image(part):
        return image_token_cost(_part_image_url(part))
    return 0


def _estimate_item_tokens(item: dict[str, Any]) -> int:
    """消息整体 token 估计(序列化近似),含消息开销 + 各 part 成本。

    对标 Codex ``estimate_item_token_count`` 的近似思路(含图像字节)。
    """
    parts = _content_parts(item)
    total = MESSAGE_OVERHEAD_TOKENS
    for p in parts:
        total += _part_token_cost(p)
    return total


def message_text_token_count(item: dict[str, Any]) -> int:
    """仅文本 token 计数(图像/音频记 0),对标 Codex message_text_token_count。"""
    total = 0
    for p in _content_parts(item):
        text = _part_text(p)
        if text:
            total += approx_token_count(text)
    return total


def message_content_token_count(item: dict[str, Any]) -> int:
    """含图像的完整内容 token 计数(图像走字节计费),对标 Codex message_content_token_count。"""
    return sum(_part_token_cost(p) for p in _content_parts(item))


def content_item_token_count(part: dict[str, Any]) -> int:
    """对标 compact_remote_v2_images.rs::content_item_token_count。"""
    return _part_token_cost(part)


def retained_input_image_count(item: dict[str, Any]) -> int:
    """统计消息内输入图像数量,对标 Codex retained_input_image_count。"""
    return sum(1 for p in _content_parts(item) if _part_is_image(p))


# ===================== 文本截断到 token 预算(对标 truncate_message_text_to_token_budget) =====================
def _truncate_text_to_tokens(text: str, max_tokens: int) -> str:
    """把文本截断到约 max_tokens token(保留头部),末尾追加截断标记。"""
    if max_tokens <= 0:
        return ""
    if approx_token_count(text) <= max_tokens:
        return text
    # 按字符密度估算可保留字符数
    density = approx_token_count(text) / max(1, len(text))
    keep = max(0, int(max_tokens / density)) if density > 0 else max(0, len(text))
    if keep <= 0:
        return ""
    return text[:keep].rstrip() + TRUNCATE_MARKER


def truncate_message_text_to_token_budget(
    env: Envelope,
    max_tokens: int,
) -> Envelope | None:
    """单条消息文本截断到 token 预算;图像/音频 part 原样保留(对标 Codex 同名函数)。

    Returns:
        截断后的 Envelope;若全部文本被裁掉导致无内容则返回 None。
    """
    parts = _content_parts(env.item)
    remaining = max_tokens
    truncated: list[dict[str, Any]] = []
    for part in parts:
        text = _part_text(part)
        if text:
            if remaining == 0:
                continue
            tc = approx_token_count(text)
            if tc <= remaining:
                remaining -= tc
            else:
                new_text = _truncate_text_to_tokens(text, remaining)
                remaining = 0
                if new_text:
                    truncated.append({"type": "text", "text": new_text})
                continue
            truncated.append(part)
        else:
            # 图像 / 音频:原样保留
            truncated.append(part)
    if not truncated:
        return None
    new_item = dict(env.item)
    new_item["content"] = truncated
    return Envelope(item=new_item, metadata=env.metadata)


# ===================== 图像原子截断(对标 compact_remote_v2_images.rs::truncate_message_to_token_budget) =====================
def truncate_message_to_token_budget(env: Envelope, max_tokens: int) -> Envelope | None:
    """单条消息内图像原子保留的截断:从尾部迭代,图像及其相邻标签整块保留/丢弃。

    对标 Codex ``truncate_message_to_token_budget``:保留边界消息靠后的图像与相邻 harness
    标签原子性,文本沿用中间截断策略;音频不计费并原样保留。
    """
    parts = list(_content_parts(env.item))
    remaining = max_tokens
    retained: list[dict[str, Any]] = []
    while parts:
        last = parts[-1]
        # 图像原子块判定:末尾为图像,或末尾为图像闭合标签文本且前一条为图像
        image_index: int | None = None
        if _part_is_image(last):
            image_index = len(parts) - 1
        elif _part_text(last) and _is_image_close_tag_text(_part_text(last)) and len(parts) >= 2:
            prev = parts[-2]
            if _part_is_image(prev):
                image_index = len(parts) - 2
        if image_index is not None:
            has_open_tag = (
                image_index > 0
                and _part_text(parts[image_index - 1])
                and (
                    _is_local_image_open_tag_text(_part_text(parts[image_index - 1]))
                    or _is_image_open_tag_text(_part_text(parts[image_index - 1]))
                )
            )
            start = image_index - (1 if has_open_tag else 0)
            block = parts[start:]
            token_count = sum(_part_token_cost(p) for p in block)
            fits = token_count <= remaining
            remaining = (remaining - token_count) if fits else 0
            if fits:
                for p in reversed(block):
                    retained.append(p)
            # 无论是否保留,图像块整体处理完毕
            del parts[start:]
            continue
        # 普通 part:弹出尾部处理
        part = parts.pop()
        text = _part_text(part)
        if text:
            if remaining == 0:
                continue
            tc = approx_token_count(text)
            if tc <= remaining:
                remaining -= tc
                retained.append(part)
            else:
                new_text = _truncate_text_to_tokens(text, remaining)
                remaining = 0
                if new_text:
                    retained.append({"type": "text", "text": new_text})
        elif _part_is_audio(part):
            retained.append(part)
        else:
            # 独立图像(理论上已被上面分支处理)
            retained.append(part)
    if not retained:
        return None
    retained.reverse()
    new_item = dict(env.item)
    new_item["content"] = retained
    return Envelope(item=new_item, metadata=env.metadata)


def _is_local_image_open_tag_text(text: str) -> bool:
    """对标 Codex is_local_image_open_tag_text(本地图像标签开放标记)。裸 part 形态下恒 False。"""
    return False


# ===================== 整体预算截断(对标 truncate_retained_messages) =====================
def truncate_retained_messages(
    envelopes: list[Envelope],
    max_tokens: int,
    image_budget_enabled: bool,
) -> list[Envelope]:
    """从最新消息向旧回溯,在整体 token 预算内保留;边界消息超预算则截断。

    对标 Codex ``truncate_retained_messages``:
    - ``image_budget_enabled`` 且非 client developer 时,对图像按字节计费(charge_images)
    - 每组先计 notice_tokens(附加通告,至少 1),再计 source_tokens
    - 整体放得下则整组保留;放不下则对边界组做文本(或图像原子)截断到可用预算,并停止继续保留
    - client developer 消息用序列化估计做边界修正,保证截断后仍不超限
    """
    remaining = max_tokens
    truncated_reversed: list[Envelope] = []
    groups = v2_history_item_groups(envelopes)
    for group in reversed(groups):
        if remaining == 0:
            continue
        client_developer = is_client_authored_developer_message(group.source)
        charge_images = image_budget_enabled and not client_developer
        notice_tokens = 0
        if group.attached_notice is not None:
            notice_tokens = max(1, message_text_token_count(group.attached_notice.item))
        # content_tokens:charge_images 时含图像字节,否则仅文本
        content_tokens = (
            message_content_token_count(group.source.item)
            if charge_images
            else message_text_token_count(group.source.item)
        )
        source_tokens = (
            _estimate_item_tokens(group.source.item) if client_developer else max(1, content_tokens)
        )
        token_count = source_tokens + notice_tokens

        if token_count <= remaining:
            if group.attached_notice is not None:
                truncated_reversed.append(group.attached_notice)
            truncated_reversed.append(group.source)
            remaining -= token_count
        elif remaining > notice_tokens:
            available_tokens = remaining - notice_tokens
            # client developer:source_tokens 含非文本(序列化)成本,扣减后给文本预算
            content_budget = (
                available_tokens - max(0, source_tokens - content_tokens)
                if client_developer
                else available_tokens
            )
            image_count = retained_input_image_count(group.source.item)
            if charge_images and image_count > 0:
                # 超大图像会耗尽预算且不回填更旧消息
                remaining = 0
            truncated_item: Envelope | None = (
                truncate_message_to_token_budget(group.source, content_budget)
                if (charge_images and image_count > 0)
                else truncate_message_text_to_token_budget(group.source, content_budget)
            )
            if truncated_item is None:
                continue
            if client_developer:
                item_tokens = _estimate_item_tokens(truncated_item.item)
                if item_tokens > available_tokens:
                    adjusted_budget = max(
                        0, content_budget - (item_tokens - available_tokens) - 1
                    )
                    adjusted = truncate_message_text_to_token_budget(
                        truncated_item, adjusted_budget
                    )
                    if adjusted is None:
                        continue
                    if _estimate_item_tokens(adjusted.item) > available_tokens:
                        continue
                    truncated_item = adjusted
            if group.attached_notice is not None:
                truncated_reversed.append(group.attached_notice)
            truncated_reversed.append(truncated_item)
            remaining = 0
        elif charge_images and retained_input_image_count(group.source.item) > 0:
            remaining = 0
    truncated_reversed.reverse()
    return truncated_reversed


def truncate_retained_messages_for_remote_compaction(
    envelopes: list[Envelope],
    max_tokens: int,
) -> list[Envelope]:
    """对标 Codex ``truncate_retained_messages_for_remote_compaction``(图像预算关闭的薄包装)。"""
    return truncate_retained_messages(envelopes, max_tokens, image_budget_enabled=False)


# ===================== v2 压缩历史装配(对标 build_v2_compacted_history) =====================
def build_v2_compacted_history(
    prompt_input: list[dict[str, Any]],
    prompt_input_metadata: list[dict[str, Any] | None],
    compaction_output: dict[str, Any],
    retain_client_developer_messages: bool,
    image_budget_enabled: bool,
) -> tuple[list[dict[str, Any]], int]:
    """装配远端压缩 v2 的保留历史(纯预算/过滤逻辑,不对 Session 写入)。

    流程(对标 Codex build_v2_compacted_history):
    1. input 与 metadata 配对成 Envelope
    2. 经 v2 分组 + 保留过滤(is_retained_for_remote_compaction_v2)取出应保留消息
    3. ``truncate_retained_messages`` 在 ``RETAINED_MESSAGE_TOKEN_BUDGET`` 内截断
    4. 统计保留图像数
    5. 末尾追加服务端压缩产物(compaction_output)

    Returns:
        (保留历史消息列表, 保留图像总数)
    """
    if len(prompt_input) != len(prompt_input_metadata):
        raise ValueError("prompt_input 与 prompt_input_metadata 长度必须一致")
    envelopes = [
        Envelope(item=item, metadata=meta)
        for item, meta in zip(prompt_input, prompt_input_metadata, strict=True)
    ]
    # 分组 → 保留过滤 → flat_map into_items(等价于 Codex 的
    # v2_history_item_groups(...).filter(is_retained).flat_map(into_items))
    retained_envs: list[Envelope] = []
    for group in v2_history_item_groups(envelopes):
        if is_retained_for_remote_compaction_v2(
            group.source, retain_client_developer_messages
        ):
            retained_envs.extend(group.into_items())
    retained_envs = truncate_retained_messages(
        retained_envs, RETAINED_MESSAGE_TOKEN_BUDGET, image_budget_enabled
    )
    retained_image_count = sum(
        retained_input_image_count(env.item) for env in retained_envs
    )
    out_items = [env.item for env in retained_envs]
    out_items.append(compaction_output)
    return out_items, retained_image_count


# ===================== request 装配内核(纯函数,剥离 Session) =====================
def assemble_remote_compaction_prompt(
    input_items: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    base_instructions: str,
    *,
    parallel_tool_calls: bool = True,
    output_schema: dict[str, Any] | None = None,
    cyber_access_program: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """对标 ``run_remote_compact_v2_attempt`` 中 Prompt 装配(剥离 Session / client_session)。

    纯装配:把历史 input 项与工具、基础指令组装成一次远端压缩请求的描述;并在 input 末尾
    追加 ``compaction_trigger`` 标记(对标 Codex ``ResponseItem::CompactionTrigger``),
    告知服务端此处为压缩触发点。

    Returns:
        请求描述字典,字段与 Codex ``Prompt`` 对齐(无副作用、不发起网络请求)。
    """
    augmented_input = list(input_items)
    augmented_input.append({"type": "compaction_trigger"})
    return {
        "input": augmented_input,
        "tools": tools,
        "parallel_tool_calls": parallel_tool_calls,
        "base_instructions": base_instructions,
        "output_schema": output_schema,
        "output_schema_strict": True,
        "cyber_access_program": cyber_access_program,
    }


# ===================== 可移植性判定(证据,非代码) =====================
__PORTABILITY_NOTES__ = """
compact_remote_v2.rs 系列可移植性判定(2026-09-19 第三十一批):

【纯算法 · 已移植】
1. compact_remote_history.rs::history_item_groups / HistoryItemGroup / is_attached_notice
   —— 纯分组算法,仅依赖 role 与文本标签,无 Session 依赖。
2. compact_remote_v2.rs::is_client_authored_developer_message
   —— 纯谓词(role + metadata.client_authored)。
3. compact_remote_v2.rs::is_retained_for_remote_compaction_v2
   —— 纯保留过滤;agent 分支仅依赖 author/recipient/首行文本,user/developer 分支为角色判定。
   (注:Codex 原实现的 user 分支调用 event_mapping::parse_turn_item,本移植以
    "role==user 即保留" 等价简化 —— 因本系统无 Codex TurnItem 协议,且 user 即对应
    UserMessage/HookPrompt;若需更细判定可注入谓词。)
4. compact_remote_v2.rs::truncate_retained_messages / truncate_message_text_to_token_budget
   —— 核心字节/token 预算截断算法,纯函数。
5. compact_remote_v2_images.rs::content_item_token_count / truncate_message_to_token_budget
   —— 图像原子保留与图像字节计费,纯函数。
6. compact_remote_v2.rs::message_text_token_count / message_content_token_count /
   retained_input_image_count / build_v2_compacted_history —— 纯预算装配。
7. run_remote_compact_v2_attempt 中 Prompt 装配部分 → 剥离为 assemble_remote_compaction_prompt 纯函数。

【依赖服务端 API / Session 结构 · 跳过】
A. run_inline_remote_auto_compact_task / run_remote_compact_task / run_remote_compact_task_inner /
   run_remote_compact_task_inner_impl —— 入口与编排,直接持有 Arc<Session>、StepContext、
   ModelClientSession、CancellationToken、hook runtime、rollout trace,整体不可移植。
B. run_remote_compaction_request_v2 / collect_compaction_output —— 通过 ModelClientSession.stream
   消费 Responses 流式 API(ResponseStream / ResponseEvent),依赖服务端流式协议,跳过。
C. run_remote_compact_v2_attempt(attempt 模块)—— 调用 sess.clone_history()、
   sess.get_prompt_base_instructions()、history.for_prompt_annotated()、
   tool_router.model_visible_specs()、sess.services.model_client.new_session() 等 Session/
   ContextManager/工具路由能力,跳过(仅其 Prompt 装配被抽象为纯函数,见 7)。
D. compact_remote_history.rs::trim_function_call_history_to_fit_context_window /
   rewritten_output_for_context_window —— 操作 ContextManager、TurnContext、BaseInstructions
   及 FunctionCallOutput/CustomToolCallOutput/ToolSearchOutput 等 Codex 输出协议类型,
   无 OpenAI 对应物,跳过。
E. should_retry_with_current_model / record_model_fallback(attempt 重试语义)——
   已在 app/services/compact_with_llm.py 实现(should_retry_compact_with_current_model /
   compact_model_fallback_tags),本模块不重复。
F. 各类 Session 方法(replace_compacted_history / recompute_token_usage /
   advance_auto_compact_window / build_compaction_initial_context 等)、hook runtime、
   rollout trace、Guardian 上下文 —— 均为服务端/会话态依赖,跳过。
"""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

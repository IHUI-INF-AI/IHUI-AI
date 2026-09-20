# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部会话导入的统一中间表示(IR)与规范化收口(D28,2026-09-20 立)。

四个来源(Claude Code / Codex / Cursor / Aider)的解析器只负责把各自格式翻译成
`Conversation`;跨来源一致的收口逻辑集中在本模块,避免四份重复实现:

- 时间戳归一:ISO 字符串 / epoch 秒 / 毫秒 / 微秒 / 纳秒 → 统一 `...Z` ISO-8601
- 内容净化:`strip_ansi` 剥离终端转义 + `redact_secrets` 密钥脱敏(导入的第三方
  会话正文常含明文 API key,落库后会再次喂给模型,必须在入库边界脱敏)
- 角色白名单:仅 user/assistant/system,其余丢弃并聚合计账
- 体积收口:会话数 / 每会话消息数 / 单条内容长度上限,超限置 truncated 并出聚合告警
- 标题兜底:来源未携带标题时取首条用户消息前缀

上限取值以 api 侧 zod 校验为硬边界(`apps/api/src/routes/conversation-import.ts`
的 commitSchema:messages ≤ 2000、title ≤ 255、model ≤ 64、content 非空)。
越界会让 /commit 直接 400,所以在这里截断而不是把坏数据推给前端。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from app.core.output_cleaning import redact_secrets, strip_ansi

__all__ = [
    "MAX_CONTENT_CHARS",
    "MAX_CONVERSATIONS",
    "MAX_MESSAGES_PER_CONVERSATION",
    "MAX_MODEL_CHARS",
    "MAX_TITLE_CHARS",
    "Conversation",
    "Message",
    "ParseResult",
    "VALID_ROLES",
    "decode_text",
    "finalize",
    "iter_json_records",
    "message",
    "to_iso",
]

# ------------------------------------------------------------------
# 收口上限(与 api commitSchema 对齐)
# ------------------------------------------------------------------

MAX_CONVERSATIONS = 50
MAX_MESSAGES_PER_CONVERSATION = 2000
MAX_CONTENT_CHARS = 200_000
MAX_TITLE_CHARS = 255
MAX_MODEL_CHARS = 64

# 标题兜底:取首条用户消息的前若干字符
_TITLE_FALLBACK_CHARS = 60
_CONTENT_TAIL = "\n…[内容超长,已截断]"

VALID_ROLES = frozenset({"user", "assistant", "system"})


@dataclass(slots=True)
class Message:
    """IR 单条消息;created_at 为已归一的 ISO 字符串(可缺省)。"""

    role: str
    content: str
    created_at: str | None = None


@dataclass(slots=True)
class Conversation:
    """IR 单会话;字段全部可缺省,由来源导出携带时才有值。"""

    messages: list[Message] = field(default_factory=list)
    title: str | None = None
    model: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


@dataclass(slots=True)
class ParseResult:
    """单个 parser 的输出:解析出的会话 + 该来源特有的告警。"""

    conversations: list[Conversation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def message(role: str, content: str, created_at: str | None = None) -> Message | None:
    """构造消息并挡掉空正文(api 侧 content.min(1),空串会让整会话 400)。"""
    text = content.strip()
    if not text:
        return None
    return Message(role=role, content=text, created_at=created_at)


def decode_text(data: bytes) -> str:
    """按 UTF-8 解码导出文件;容忍 BOM,非法字节替换而非抛错。"""
    return data.decode("utf-8-sig", errors="replace")


def iter_json_records(text: str) -> tuple[list[Any], int]:
    """把导出文本读成 JSON 记录序列。

    整篇是合法 JSON(`[...]` 数组或 `{...}` 对象)时按整体解析;解析不动就退回
    JSONL 逐行 —— JSONL 的首行同样以 `{` 开头,只能靠"整篇能否解析"区分,
    不能靠前导字符。坏行跳过而非中断:第三方导出文件常在崩溃处留下半行 JSON。
    返回(记录列表, 无法解析的行数)。
    """
    stripped = text.strip()
    if stripped[:1] in ("[", "{"):
        try:
            payload = json.loads(stripped)
        except ValueError:
            pass
        else:
            return (payload if isinstance(payload, list) else [payload]), 0

    records: list[Any] = []
    corrupt = 0
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            parsed = json.loads(line)
        except ValueError:
            corrupt += 1
            continue
        if isinstance(parsed, list):
            records.extend(parsed)
        else:
            records.append(parsed)
    return records, corrupt


def to_iso(value: object) -> str | None:
    """把来源时间戳归一为 UTC ISO-8601(`...Z`)。

    支持 ISO 字符串、纯数字字符串、epoch 秒/毫秒/微秒/纳秒(按量级判别:
    Cursor 存毫秒、Codex/Claude 存 ISO 或秒)。无法识别时返回 None,
    由 api 侧回退到导入时刻 —— 宁缺省也不写入错误时间。
    """
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return _epoch_to_iso(float(value))
    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw:
        return None
    numeric = raw.replace(".", "", 1).replace("-", "", 1)
    if numeric.isdigit():
        try:
            return _epoch_to_iso(float(raw))
        except ValueError:
            return None

    candidate = raw[:-1] + "+00:00" if raw.endswith(("Z", "z")) else raw
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return _format(parsed.astimezone(UTC))


def _epoch_to_iso(ts: float) -> str | None:
    """epoch 秒/毫秒/微秒/纳秒 → ISO;越界或非法值返回 None。"""
    magnitude = abs(ts)
    if magnitude >= 1e17:  # 纳秒
        ts /= 1e9
    elif magnitude >= 1e14:  # 微秒
        ts /= 1e6
    elif magnitude >= 1e11:  # 毫秒
        ts /= 1e3
    try:
        return _format(datetime.fromtimestamp(ts, tz=UTC))
    except (OverflowError, OSError, ValueError):
        return None


def _format(moment: datetime) -> str:
    return moment.isoformat().replace("+00:00", "Z")


def finalize(
    result: ParseResult, *, source: str
) -> tuple[dict[str, Any], list[str], bool]:
    """收口成 /parse 响应体:净化 + 过滤 + 截断 + 字典化。

    返回 (parsed, warnings, truncated);parsed 仅含 `conversations` 键,路由层再拼上
    truncated/warnings 透出。收口告警直接追加到 result.warnings 之后一并返回。
    """
    warnings = result.warnings
    truncated = False
    dropped_roles = 0
    dropped_content = 0
    trimmed_content = 0

    conversations = [conv for conv in result.conversations if conv.messages]
    if len(conversations) > MAX_CONVERSATIONS:
        truncated = True
        warnings.append(
            f"会话数 {len(conversations)} 超过上限 {MAX_CONVERSATIONS},仅保留前 "
            f"{MAX_CONVERSATIONS} 个"
        )
        conversations = conversations[:MAX_CONVERSATIONS]

    items: list[dict[str, Any]] = []
    for conv in conversations:
        messages: list[dict[str, Any]] = []
        for msg in conv.messages:
            if msg.role not in VALID_ROLES:
                dropped_roles += 1
                continue
            content = redact_secrets(strip_ansi(msg.content)).strip()
            if not content:
                dropped_content += 1
                continue
            if len(content) > MAX_CONTENT_CHARS:
                trimmed_content += 1
                content = content[: MAX_CONTENT_CHARS - len(_CONTENT_TAIL)] + _CONTENT_TAIL
            entry: dict[str, Any] = {"role": msg.role, "content": content}
            if msg.created_at:
                entry["createdAt"] = msg.created_at
            messages.append(entry)

        if len(messages) > MAX_MESSAGES_PER_CONVERSATION:
            truncated = True
            warnings.append(
                f"会话「{conv.title or '未命名会话'}」消息数超过上限 "
                f"{MAX_MESSAGES_PER_CONVERSATION},已截断"
            )
            messages = messages[:MAX_MESSAGES_PER_CONVERSATION]
        if not messages:
            continue

        conv_item: dict[str, Any] = {"source": source, "messages": messages}
        title = _clamp(_one_line(conv.title), MAX_TITLE_CHARS) or _fallback_title(messages)
        if title:
            conv_item["title"] = title
        model = _clamp(_one_line(conv.model), MAX_MODEL_CHARS)
        if model:
            conv_item["model"] = model
        # 来源未带会话时间时用首/末条消息时间兜底(Claude Code 只有逐条时间戳)
        stamps = [m["createdAt"] for m in messages if m.get("createdAt")]
        created = conv.created_at or (stamps[0] if stamps else None)
        updated = conv.updated_at or (stamps[-1] if stamps else None)
        if created:
            conv_item["sourceCreatedAt"] = created
        if updated:
            conv_item["sourceUpdatedAt"] = updated
        items.append(conv_item)

    if dropped_roles:
        warnings.append(f"{dropped_roles} 条消息角色不在 user/assistant/system 内,已丢弃")
    if dropped_content:
        warnings.append(f"{dropped_content} 条空内容消息已丢弃")
    if trimmed_content:
        warnings.append(f"{trimmed_content} 条消息正文超过 {MAX_CONTENT_CHARS} 字符,已截断")

    return {"conversations": items}, warnings, truncated


def _one_line(text: str | None) -> str | None:
    if not text:
        return None
    return " ".join(text.split())


def _clamp(text: str | None, limit: int) -> str:
    if not text:
        return ""
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _fallback_title(messages: list[dict[str, Any]]) -> str:
    """来源无标题时,用首条用户消息开头当标题(与客户端新建会话的命名习惯一致)。"""
    for entry in messages:
        if entry["role"] != "user":
            continue
        body = _one_line(entry["content"]) or ""
        return _clamp(body[:_TITLE_FALLBACK_CHARS], MAX_TITLE_CHARS)
    return ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

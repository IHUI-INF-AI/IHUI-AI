# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Claude Code 会话导出解析器(D28,2026-09-20 立;同日按真机导出实证修订)。

输入形态:`~/.claude/projects/<项目路径转写>/<sessionId>.jsonl`(JSONL,一次会话一个
文件,也可能把多段会话拼进同一份导出),或同结构的 `.json` 数组。

真机实测(137 个真实导出文件)得出三条硬事实,决定了本模块形态:
1. 标题记录是 `{"type":"ai-title","aiTitle":…,"sessionId":…}`,同一会话会出现多条
   (取最后一条);**不存在** `{"type":"summary","leafUuid":…}` 这种形态。
2. 多数记录不承载可见文本:user 侧多为 `tool_result`,assistant 侧多为 `tool_use` /
   `thinking`。只取 text block 的话,一份 253 行的真实导出只剩 13 条消息,导入后读不出
   上下文 → 把 `tool_use` 折成一行 `[工具调用] Name(k=v)` 保留对话骨架;`tool_result`
   正文(常是几十 KB 文件内容/命令输出)仍不落地,只聚合计一条告警告知用户。
3. 混合导出里 sidechain 记录(子 agent 分支)会打乱主线 → 剔除;但 `agent-<id>.jsonl`
   这类**整份都是 sidechain** 的单体转写,用户主动选了它就必须按主线导入(实测 61 个
   真实文件里 60 个属于这种,一律剔除会让导入结果为空)。isMeta(本地命令回显)仍跳过。

其余真实类型(system / attachment / last-prompt / mode / permission-mode /
file-history-snapshot / queue-operation)是客户端 chrome,不是会话文本,不解析。
"""

from __future__ import annotations

from typing import Any

from .ir import Conversation, ParseResult, decode_text, iter_json_records, message, to_iso

__all__ = ["parse"]

# 单条工具调用行里最多展示的参数个数与取值截断长度(避免整段 prompt 挤进一行)
_MAX_ARG_PAIRS = 2
_MAX_ARG_VALUE_CHARS = 60


def parse(data: bytes, filename: str) -> ParseResult:
    """解析 Claude Code 导出为 IR 会话列表。"""
    del filename  # Claude Code 只有 JSON/JSONL 一种载体,后缀不影响解析路径
    records, corrupt = iter_json_records(decode_text(data))
    result = ParseResult()
    if corrupt:
        result.warnings.append(f"{corrupt} 行 JSON 无法解析已跳过")

    sessions: dict[str, Conversation] = {}
    sidechains: dict[str, Conversation] = {}
    titles: dict[str, str] = {}
    tool_results = 0

    for record in records:
        if not isinstance(record, dict):
            continue
        rtype = record.get("type")
        if rtype == "ai-title":
            _collect_title(record, titles)
            continue
        if rtype not in ("user", "assistant") or record.get("isMeta"):
            continue

        session_id = str(record.get("sessionId") or "default")
        # 混排文件里 sidechain 是子 agent 分支,会打乱主线阅读 → 剔除
        bucket = sidechains if record.get("isSidechain") else sessions
        conv = bucket.get(session_id)
        if conv is None:
            conv = Conversation()
            bucket[session_id] = conv

        payload = record.get("message")
        if not isinstance(payload, dict):
            continue
        raw_role = payload.get("role")
        role = raw_role if isinstance(raw_role, str) else str(rtype)
        text, skipped = _render(payload.get("content"))
        tool_results += skipped
        msg = message(role, text, to_iso(record.get("timestamp")))
        if msg is None:
            continue
        conv.messages.append(msg)
        if isinstance(payload.get("model"), str) and not conv.model:
            conv.model = payload["model"]

    if not sessions:
        # 整份导出都是子 agent 转写(Claude Code 的 agent-<id>.jsonl 单体文件):
        # 用户主动选了它,按主线导入,不能返回空
        sessions = sidechains
    for session_id, conv in sessions.items():
        title = titles.get(session_id)
        if title:
            conv.title = title
    if tool_results:
        result.warnings.append(
            f"{tool_results} 条工具输出正文未纳入导入(仅保留 [工具调用] 行,"
            "避免文件内容灌进会话)"
        )
    result.conversations = list(sessions.values())
    return result


def _collect_title(record: dict[str, Any], titles: dict[str, str]) -> None:
    """ai-title 按 sessionId 归属;同会话多条时后者覆盖前者(标题会被重命名)。"""
    session_id = record.get("sessionId")
    ai_title = record.get("aiTitle")
    if isinstance(session_id, str) and isinstance(ai_title, str) and ai_title.strip():
        titles[session_id] = ai_title.strip()


def _render(content: Any) -> tuple[str, int]:
    """把 message.content 渲染成会话文本,并返回被跳过的 tool_result 条数。"""
    if isinstance(content, str):
        return content, 0
    if not isinstance(content, list):
        return "", 0

    lines: list[str] = []
    skipped = 0
    for block in content:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype == "text":
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                lines.append(text.strip())
        elif btype == "tool_use":
            line = _tool_line(block)
            if line:
                lines.append(line)
        elif btype == "tool_result":
            skipped += 1
        # thinking / 未知块:非可见文本,跳过
    return "\n".join(lines), skipped


def _tool_line(block: dict[str, Any]) -> str:
    """工具调用 → 一行可读骨架(名字 + 最多两个标量参数);正文脱敏由 ir 层统一做。"""
    name = block.get("name")
    if not isinstance(name, str) or not name.strip():
        return ""
    args = block.get("input")
    pairs: list[str] = []
    if isinstance(args, dict):
        for key, value in args.items():
            if isinstance(value, str | int | float | bool):
                pairs.append(f"{key}={str(value)[:_MAX_ARG_VALUE_CHARS]}")
            if len(pairs) >= _MAX_ARG_PAIRS:
                break
    label = name.strip()
    return f"[工具调用] {label}({', '.join(pairs)})" if pairs else f"[工具调用] {label}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

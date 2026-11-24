# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""context_anchor_check — 回合前上下文自检钩子(P0-7,2026-11-24 立)。

工具调用下发前,自检本轮 tool_calls 引用的关键锚点(路径类引用)是否仍在当前
会话上下文内;上下文被压缩 / 截断导致锚点掉落时,回源重读并把片段补回上下文,
同时留审计痕迹。

背景(候选 P0-7):agent_loop_v2 此前只有 ``fingerprint / re-read / 自检 / anchor``
三处注释、无实现。长会话压缩后,旧路径引用可能已从 messages 掉落;若模型拿着
悬空锚点直接下发编辑/命令工具,会基于过期上下文操作。本钩子在工具执行前兜底。

纪律:
- **默认关**(env :data:`ANCHOR_CHECK_ENV`,off ⇒ 零调用零开销);
- 无锚点 ⇒ 不拼接上下文文本、不触发任何重读;
- **只读回源**:本钩子不做任何写操作;重读失败如实记审计,不阻断工具下发;
- 判据不另起一套:路径归一 / 文本提取口径与 ``file_read_state`` /
  ``token_compaction`` 同形;上下文历史文本排除本轮 assistant(tool_calls) 消息,
  避免"锚点只在本轮调用参数里"被误判成仍在上下文内;
- 失效方向(AGENTS §0.10):自检 / 重读异常一律降级跳过,绝不把"没查到"渲染成
  "锚点完好",也不借它新立一道拦门。
"""

from __future__ import annotations

import logging
import os
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)

#: 自检总开关环境变量名(取值 on/1/true/yes 启用;空/未设置/其他 = 关)。
ANCHOR_CHECK_ENV = "AGENT_CONTEXT_ANCHOR_CHECK_ENABLED"

#: 回源重读片段进入上下文的字符上限(超长截断,防单锚点撑爆上下文)。
_REREAD_EXCERPT_MAX_CHARS = 2000
#: 读盘取样字节上限(与片段上限同量级,二进制不过度解码)。
_REREAD_MAX_BYTES = 256 * 1024
#: basename 短于该长度不单独参与命中匹配(防单字符/扩展名误命中)。
_MIN_BASENAME_LEN = 3

#: 视为路径锚点的工具参数键(双名兼容,与 edit_file/write_file 的参数名惯例同源)。
_PATH_ARG_KEYS: tuple[str, ...] = (
    "path", "file_path", "filePath", "file", "relative_path",
    "target", "dir", "directory", "cwd", "pattern", "glob",
)

REREAD_OK = "reread_ok"
REREAD_UNAVAILABLE = "reread_unavailable"
ANCHOR_PRESENT = "present"
ANCHOR_MISSING = "missing"


class _AnchorToolCall(Protocol):
    """工具调用鸭子类型(满足 services.agent_loop_v2.ToolCall 形态即可)。"""

    name: str
    args: dict[str, Any]


def anchor_check_enabled() -> bool:
    """自检总开关:默认 off(与现状逐零差异);env 显式置真值才启用。"""
    return os.environ.get(ANCHOR_CHECK_ENV, "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _content_text(content: Any) -> str:
    """把消息 content 归一成纯文本(str / list[dict] 多模态 / None 均不抛)。

    口径与 ``token_compaction._extract_content_text`` 同形;本模块在 core 层,
    不反向依赖 services,故在此保留同一份小实现(§0.6 同口径,不造第二套判据)。
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                text = part.get("text")
                if isinstance(text, str):
                    parts.append(text)
            elif isinstance(part, str):
                parts.append(part)
        return " ".join(parts)
    if content is None:
        return ""
    return str(content)


def extract_path_anchors(tool_name: str, args: dict[str, Any]) -> list[str]:
    """从工具入参提取路径类锚点(归一化去重、保序;非 str / 空值剔除)。"""
    if not isinstance(args, dict):
        return []
    anchors: list[str] = []
    for key in _PATH_ARG_KEYS:
        value = args.get(key)
        if not isinstance(value, str):
            continue
        text = value.strip()
        if not text:
            continue
        normalized = os.path.normcase(os.path.normpath(os.path.abspath(text)))
        if normalized not in anchors:
            anchors.append(normalized)
    return anchors


def _basename_of(normalized_path: str) -> str:
    return os.path.basename(normalized_path.rstrip("\\/")).lower()


def _anchor_in_text(anchor: str, history_text: str) -> bool:
    """锚点是否仍在历史上下文文本内(全路径或 basename 子串命中)。"""
    needle = anchor.lower()
    if needle and needle in history_text:
        return True
    base = _basename_of(anchor)
    return len(base) >= _MIN_BASENAME_LEN and base in history_text


def _history_text_excluding_current_tool_calls(messages: Sequence[dict[str, Any]]) -> str:
    """拼历史消息文本;排除末尾本轮 assistant(tool_calls) 消息本身。

    本轮 assistant 消息的入参里就带着锚点,若纳入检索会造成"锚点总在上下文内"
    的假阳性;自检判的是"先前出现在历史里、现在是否还在"。
    """
    start = 0
    if messages:
        last = messages[-1]
        if (
            isinstance(last, dict)
            and last.get("role") == "assistant"
            and last.get("tool_calls")
        ):
            start = len(messages) - 1
    parts: list[str] = []
    for msg in messages[:start]:
        if isinstance(msg, dict):
            parts.append(_content_text(msg.get("content")))
    return "\n".join(parts).lower()


async def _default_reread(path: str) -> str | None:
    """缺省回源重读:盘上读片段(只读);读不到 / 不存在 ⇒ None,不抛。"""
    try:
        file_path = Path(path)
        if not file_path.is_file():
            return None
        with file_path.open("rb") as f:
            data = f.read(_REREAD_MAX_BYTES)
        return data.decode("utf-8", errors="replace")
    except OSError:
        return None
    except Exception as e:  # noqa: BLE001 - 重读失败降级为 unavailable,不冒泡
        logger.debug("上下文自检回源重读失败(%s): %s", path, e)
        return None


@dataclass
class AnchorCheckResult:
    """一轮自检的结构化结果(审计 / 测试断言共用此形状)。"""

    enabled: bool
    checked: int = 0
    #: 仍在历史上下文内的锚点。
    present: list[str] = field(default_factory=list)
    #: 已从上下文掉落、需要回源的锚点。
    missing: list[str] = field(default_factory=list)
    #: 回源重读成功并补回上下文的锚点明细。
    reread: list[dict[str, Any]] = field(default_factory=list)
    #: 回源重读不可用的锚点明细。
    unavailable: list[dict[str, Any]] = field(default_factory=list)
    #: 是否向 messages 追加了重读补充消息。
    messages_mutated: bool = False
    #: 审计痕迹明细(可直接进 audit_service.log_agent_action.details)。
    audit: dict[str, Any] = field(default_factory=dict)


async def run_context_anchor_check(
    tool_calls: Sequence[_AnchorToolCall],
    messages: list[dict[str, Any]],
    *,
    session_id: str | None = None,
    iteration: int | None = None,
    reread_callback: Callable[[str], Awaitable[str | None]] | None = None,
) -> AnchorCheckResult:
    """工具下发前自检锚点;缺失则回源重读并补回上下文。

    Args:
        tool_calls: 本轮待执行工具调用(ToolCall 鸭子类型序列)。
        messages: 当前会话消息列表;重读成功时就地追加补充 user 消息。
        session_id: 会话标识(审计归因,可空)。
        iteration: 轮次号(审计归因,可空)。
        reread_callback: 可注入的回源重读;缺省走盘上只读。返回 None = 读不到。

    Returns:
        :class:`AnchorCheckResult`;开关关 / 无锚点时不拼接历史文本、不触发重读。
    """
    if not anchor_check_enabled():
        return AnchorCheckResult(enabled=False)

    anchors: list[str] = []
    per_call: list[dict[str, str]] = []
    for tc in tool_calls:
        tc_name = getattr(tc, "name", "") or ""
        for anchor in extract_path_anchors(tc_name, getattr(tc, "args", {}) or {}):
            if anchor not in anchors:
                anchors.append(anchor)
            per_call.append({"tool": tc_name, "anchor": anchor})

    if not anchors:
        return AnchorCheckResult(enabled=True, checked=0)

    history_text = _history_text_excluding_current_tool_calls(messages)
    present: list[str] = []
    missing: list[str] = []
    for anchor in anchors:
        if _anchor_in_text(anchor, history_text):
            present.append(anchor)
        else:
            missing.append(anchor)

    result = AnchorCheckResult(
        enabled=True,
        checked=len(anchors),
        present=present,
        missing=missing,
    )
    if not missing:
        result.audit = {
            "iteration": iteration,
            "session_id": session_id or "",
            "checked": len(anchors),
            "missing": [],
            "reread": [],
            "unavailable": [],
        }
        return result

    reader = reread_callback or _default_reread
    excerpts: list[str] = []
    for anchor in missing:
        tool_names = sorted({c["tool"] for c in per_call if c["anchor"] == anchor})
        try:
            content = await reader(anchor)
        except Exception as e:  # noqa: BLE001 - 单锚点重读异常不拖垮整轮自检
            logger.debug("上下文自检重读回调异常(%s): %s", anchor, e)
            content = None
        if content:
            excerpt = content[:_REREAD_EXCERPT_MAX_CHARS]
            result.reread.append(
                {"anchor": anchor, "tools": tool_names, "chars": len(excerpt)}
            )
            excerpts.append(f"路径: {anchor}\n内容片段:\n{excerpt}")
        else:
            result.unavailable.append({"anchor": anchor, "tools": tool_names})

    if excerpts:
        messages.append(
            {
                "role": "user",
                "content": (
                    "[上下文自检] 下列路径锚点已不在当前上下文中,已回源重读,"
                    "请以本次重读内容为准:\n\n" + "\n\n".join(excerpts)
                ),
            }
        )
        result.messages_mutated = True

    result.audit = {
        "iteration": iteration,
        "session_id": session_id or "",
        "checked": len(anchors),
        "present": present,
        "missing": missing,
        "reread": result.reread,
        "unavailable": result.unavailable,
        "messages_mutated": result.messages_mutated,
    }
    return result
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

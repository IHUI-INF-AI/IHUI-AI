# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具调用入参解析（逆向-复现-超越，AGENTS §0.12；接 ``json_repair`` 的修复/流式能力）。

对标：Qoder / Trae 把 ``jsonrepair`` 用在工具调用入参上——LLM 产出的 ``arguments`` 常常残缺
（流截断、裸键名、单引号…），直接 ``json.loads`` 会丢参数或崩卡片。
复现：``normalize_tool_call_args`` 把任意上游 args 形态（已是对象 / 字符串 / 残缺字符串）统一收敛为对象，
字符串走 ``repair_json`` 修复解析，避免各端各自 ``isinstance(str)?json.loads:…`` 漂开。
超越：``ToolCallArgsStreamer`` 支持 OpenAI 风格 ``function.arguments`` **字符串分片**的增量解析——
每个分片到达即给出当前最好部分 args（partial=True），流闭合即 complete，使 ToolCallCard
在流未结束时就能渐进渲染入参（jsonrepair 只能吃完整串，做不到）。

本文件为纯自研 Python 等价实现（不粘贴任何对照程序专有源码；不依赖第三方 jsonrepair 包）。
行为与 TypeScript 侧 ``packages/api-client/src/tool-call-args.ts`` 逐一对齐。
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .json_repair import StreamingJsonRepair, create_streaming_json_repair, repair_json

__all__ = [
    "normalize_tool_call_args",
    "ToolCallArgsStreamer",
    "create_tool_call_args_streamer",
    "accumulate_tool_call_arguments",
    "ToolCallArgsState",
]


def as_object_record(value: Any) -> Optional[Dict[str, Any]]:
    """把「值」收敛为普通对象（剔除 None / 列表 / 原始类型）。"""
    return value if isinstance(value, dict) and not isinstance(value, list) else None


def normalize_tool_call_args(raw: Any) -> Optional[Dict[str, Any]]:
    """入参归一化单一出口。

    - 已是对象（非列表、非 None）-> 原样返回（引用不变，既有的 deep-equal 对账不受影响）
    - 字符串 -> ``repair_json`` 尽力修复后解析为对象；修复失败 -> None
    - 其余（None / 列表 / 原始类型）-> None

    用于 SSE / 路由层在 ``tool-call-start`` / ``tool-result`` 处把上游 args 收口为对象，
    覆盖「上游把 args 当 JSON 字符串下发」或「略带残缺」的情形。
    """
    if raw is None:
        return None
    if isinstance(raw, dict):
        return as_object_record(raw)
    if isinstance(raw, str):
        trimmed = raw.strip()
        if trimmed == "":
            return None
        result = repair_json(trimmed)
        return as_object_record(result["value"]) if result["ok"] else None
    return None


class ToolCallArgsStreamer:
    """增量工具调用入参流：喂入 OpenAI 风格 ``function.arguments`` 字符串分片，逐片产出可用 args。

    流未闭合时即可拿到部分对象（partial），闭合后 complete。无分片时 args 为 None。
    """

    def __init__(self) -> None:
        self._repair: StreamingJsonRepair = create_streaming_json_repair()

    def push(self, fragment: str) -> "ToolCallArgsState":
        snap = self._repair.push(fragment)
        return {
            "complete": snap["complete"],
            "partial": snap["partial"],
            "args": as_object_record(snap["value"]),
        }

    @property
    def is_complete(self) -> bool:
        """流是否已解析出完整 args（之后喂入的分片不会改变「已完成」这一事实）。"""
        return self._repair.is_complete


def create_tool_call_args_streamer() -> ToolCallArgsStreamer:
    """工厂：创建一个增量工具调用入参流。"""
    return ToolCallArgsStreamer()


class ToolCallArgsState(Dict[str, Any]):
    """流式增量 args 解析态（dict 形态对齐 TS ``ToolCallArgsState``）。"""


def accumulate_tool_call_arguments(
    store: Dict[int, ToolCallArgsStreamer],
    index: int,
    name: str,
    fragment: str,
) -> "ToolCallArgsState":
    """增量累积单个工具调用的 ``function.arguments`` 分片（SSE / 流式通道的接入缝）。

    参数:
        store: 调用方拥有的累加器字典（``Dict[int, ToolCallArgsStreamer]``），**按 SSE 会话独立持有**，
            切勿跨会话共享——同一 index 在不同会话里表示不同的工具调用。会话结束时由调用方清理。
        index: 工具调用在 ``tool_calls`` 数组中的下标（用于区分并行的多个调用）。
        name: 工具名（仅携带，便于日志 / 调试；不参与解析）。
        fragment: 本次到达的 ``function.arguments`` 字符串分片（可能截断、残缺）。

    返回:
        ``ToolCallArgsState``：``complete`` / ``partial`` / ``args``（当前最好可用的参数对象，可能 None）。

    用法（在把上游 OpenAI 流式 chunk 转成内部 tool_calls 的环节调用）::

        from app.utils.tool_call_args import accumulate_tool_call_arguments

        # 每个 SSE 会话新建一个独立的累加器字典
        tool_args_store: Dict[int, ToolCallArgsStreamer] = {}
        # 每个 chunk 携带 tool_calls[i].function.arguments 的增量片段:
        for i, tc in enumerate(chunk.tool_calls):
            frag = tc.function.arguments or ""
            state = accumulate_tool_call_arguments(tool_args_store, i, tc.function.name, frag)
            if state["args"] is not None:
                emit_tool_arg_progress(i, tc.function.name, state["args"], state["complete"])

    说明：当前 ai-service 的 astream 已在服务端把分片 tool_calls 聚合成完整事件后再进
    ``_convert_openai_tool_calls``；此函数是为「逐分片渐进渲染」预留的接入缝——一旦某条
    通道需要把分片直接喂给前端 ToolCallCard，用本函数即可获得与 TS ``ToolCallArgsStreamer``
    行为对等的增量修复能力。
    """
    streamer = store.get(index)
    if streamer is None or streamer.is_complete:
        streamer = create_tool_call_args_streamer()
        store[index] = streamer
    _ = name  # 保留参数位，便于未来按 name 做路由 / 日志
    return streamer.push(fragment)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

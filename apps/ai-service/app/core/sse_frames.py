# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""帧级 trace 关联键的唯一注入点(承 D174;由 routers/llm.py 的私有函数提升而来)。

为什么要有这个模块:注入规则(兼容面不注入 / 取值只经一个出口 / 无有效 trace 就整字段缺席 /
不改入参)在 llm.py 里落地后,**其余拼帧路径**(agents 流、官方 MCP 流)各自 `f"event: …"`
组装线格式,拿不到这一份逻辑 ⇒ 症状是"主对话流的帧带 trace、任务流的帧不带",
而两处各写一遍迟早漂开(本仓最高频的失效型)。函数体逐字搬自 llm.py,判序一字未改。
"""

import contextvars
from dataclasses import dataclass, field
from typing import Any

from .sse_contract import (
    FRAME_KIND_DELTA,
    FRAME_KIND_SNAPSHOT,
    PROCESS_LOG_EPOCH,
    SSE_COMPAT_EVENTS,
    SSE_TRACE_ID_PAYLOAD_KEY,
    SSE_WATERMARK_PAYLOAD_KEYS,
    WATERMARK_SNAPSHOT_SEQ,
    StreamWatermark,
    apply_frame,
)
from .trace_context import sse_frame_trace_id


def with_frame_trace_id(evt: str, payload: Any) -> Any:
    """帧级 traceId 的**唯一**注入点。

    四条判序,缺一不可:

    1. **兼容面不注入**:`SSE_COMPAT_EVENTS`(Anthropic Messages API 兼容事件)两份契约
       文件对它的原话都是"wire 形态与 Anthropic 官方一致",往里加我方自定键 = 单方面
       改那个协议。要补的是对话流帧(`SSE_EVENTS`)那一格。
    2. **取值只经一个出口**:`sse_frame_trace_id()`(它读的是 middleware 那一份 ContextVar,
       并在那里做 W3C 有效性判)。本函数不碰 `request`、不解析 traceparent。
    3. **没有有效 trace ⇒ 整字段缺席**:不写空串、不写 null。"空串"与"没有"必须可分,
       消费侧按 `typeof === 'string'` 判;写空串就是把"没接上"写成"接上了"。
    4. **不改入参**:`payload` 常在 yield 之后被调用方继续用(同一 dict 进落库记录 /
       被复用),就地写键会把 trace 带进持久化面 —— 本票没做那件事,也不该被顺手做掉。
    """
    if evt in SSE_COMPAT_EVENTS:
        return payload
    trace_id = sse_frame_trace_id()
    if not isinstance(payload, dict):
        return payload
    if trace_id is None:
        # 无有效 trace ⇒ 帧上**不该有**这个键。调用方递进来的 dict 可能已经带着一个 `traceId`
        # (模型/上游把字段名猜对了、或有人在 payload 里自写)。留着的不是一个"看起来合理"的值,
        # 而是一个**没有出处**的值 —— 线格式与工厂写出来的完全一样,于是"帧上的 traceId 只能
        # 出自这一处"这条不变量就被绕过了。剥掉它,让缺席就是缺席。
        # 不判红、不告警:本模块只做线格式,trace 是关联键不是凭据,自写它没有授权收益。
        if SSE_TRACE_ID_PAYLOAD_KEY in payload:
            stripped = dict(payload)
            stripped.pop(SSE_TRACE_ID_PAYLOAD_KEY)
            return stripped
        return payload
    return {**payload, SSE_TRACE_ID_PAYLOAD_KEY: trace_id}


# ── 差距②(2026-10-30 立):帧水位四维的出站注入点 ─────────────────────────────
#
# 为什么住在本模块:水位与 traceId 同族 —— 都是"每一帧顶层都要带"的装配字段,
# 判序只许有一处(llm.py::_sse() 调用本函数,agents 流等未接线面天然不带 = 现状)。
# 水位状态是**每流一份**的,经 ContextVar 交接:流开始处 begin、流收尾处 end,
# 出帧时读同一上下文;字段名唯一真相源在 sse_contract.SSE_WATERMARK_PAYLOAD_KEYS
# (与 packages/api-client/src/frame-watermark.ts 逐字对齐,错一格 = 消费侧恒 undetermined)。


@dataclass
class _StreamFrameSeq:
    """一条出站流的帧水位游标(生产侧)。首帧按 snapshot 立基线,其后皆 delta。"""

    subscription_id: str
    watermark: StreamWatermark = field(default_factory=StreamWatermark)
    seq: int = 0


_stream_frame_seq: contextvars.ContextVar["_StreamFrameSeq | None"] = contextvars.ContextVar(
    "ihui_sse_stream_frame_seq", default=None
)


def begin_stream_watermark(subscription_id: str) -> None:
    """流开始处挂上本流的帧水位上下文(llm.py gen() 注册 session 后调用)。"""
    _stream_frame_seq.set(_StreamFrameSeq(subscription_id=subscription_id))


def end_stream_watermark() -> None:
    """流收尾处摘除上下文(gen() finally 调用;未 begin 过也无害)。"""
    _stream_frame_seq.set(None)


def with_frame_watermark(evt: str, payload: Any) -> Any:
    """出站帧的水位四维注入点(判序与 with_frame_trace_id 同纪律)。

    1. 无流上下文(非主聊天流 / 未注册 session 的流)⇒ 原样返回,线格式逐字节不变;
    2. 兼容面(SSE_COMPAT_EVENTS)不注入 —— 那是 Anthropic 官方 wire 形状,与 traceId 同理;
    3. 载荷非 dict ⇒ 不注入(与 traceId 同取向,不造顶层键的容身之处);
    4. apply_frame 判不 apply(单写者、纪元恒定、订阅恒定下不该发生)⇒ 不注入,
       **不冒充推进** —— 水位说假话比没有水位更糟,回退方向恒为现状(undetermined)。
    """
    state = _stream_frame_seq.get()
    if state is None or evt in SSE_COMPAT_EVENTS or not isinstance(payload, dict):
        return payload
    state.seq += 1
    is_snapshot = state.seq == 1
    from_seq = WATERMARK_SNAPSHOT_SEQ if is_snapshot else state.seq - 1
    to_seq = state.seq
    decision = apply_frame(
        state.watermark,
        frame_kind=FRAME_KIND_SNAPSHOT if is_snapshot else FRAME_KIND_DELTA,
        log_epoch=PROCESS_LOG_EPOCH,
        from_seq=from_seq,
        to_seq=to_seq,
        subscription_id=state.subscription_id,
    )
    if not decision.applied:
        return payload
    subscription_key, epoch_key, from_key, to_key = SSE_WATERMARK_PAYLOAD_KEYS
    return {
        **payload,
        subscription_key: state.subscription_id,
        epoch_key: PROCESS_LOG_EPOCH,
        from_key: from_seq,
        to_key: to_seq,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

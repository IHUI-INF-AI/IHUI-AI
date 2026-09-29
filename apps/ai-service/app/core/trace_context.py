# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D174(2026-09-30 立)SSE **帧级** trace id 的唯一取值出口。

本票承 D147。D147 把 trace id 落在**响应头** `X-Trace-Id`(两端 CORS 已 expose),
而"帧里也带 trace id"这一格没做:头在**整趟流式响应**上只出现一次,而一条响应里有
几十到几千帧共用它 —— 客户端拿头只能定位到"这一整轮",定位不到"这一帧"。
补的就是帧级那一格。

**载体不在这里。** traceparent 的解析、本轮 trace id 的 ContextVar 存取,只有
`app/middleware/trace_context.py` 那一份实现(它头注第 ① 条原文即"声明与读写只住在
这里,别处不得再建第二份 trace 上下文")。本模块只做**面向线格式的投影**:取值经
`current_trace_id()`,再加"什么值可以进帧"的判据。因此:

- 不新建 ContextVar,不在这里再解析一遍 traceparent 字符串(两处算同一件事必漂移);
- `parse_traceparent` 的既有契约一字未动 —— 它按**格式**接受全 0
  (`tests/test_trace_context.py::test_parse_all_zero_hex` 把那条钉着),本模块只决定
  **什么值可以进帧**,两者是不同的问题,不得回头去削那条判据。

三条规矩(与票面"已裁决的设计约束"逐字对应):

① 键名统一 `traceId`(线格式 camelCase,同 messageId / terminalId 一族)。键名本身的
   唯一真相源是 `app/core/sse_contract.py::SSE_TRACE_ID_PAYLOAD_KEY`,本模块不写第二份;
② 值是**小写 32 hex**;全 0 按 W3C 是非法值(trace-id 全 0 = 无效)⇒ 不写;
③ 没有有效 trace 时**整字段缺席** —— 不写空串、不写 null。理由:"空串"与"没有"必须
   可分,消费侧按 `typeof === 'string'` 判;写空串等于声称"有一个,只是它是空的",
   那是把"没接上"写成"接上了"(本仓最高频的失效型)。

**trace id 是关联键,不是授权凭据**(票面约束 5)。它由客户端可写的 `traceparent` 头
带来,所以任何归属/授权判定都**不得**读它 —— 读了就等于让调用方自报"我属于哪条链"。
阳性对照用例:`tests/test_sse_trace_frame_d174.py::test_foreign_trace_id_does_not_change_ownership`。
"""

from __future__ import annotations

import re

from app.middleware.trace_context import current_trace_id

__all__ = ["normalize_trace_id", "sse_frame_trace_id"]

# 32 位十六进制(大小写均接受,落帧前归一为小写)。W3C trace-context 规定 trace-id
# 恒为 32 hex,长度不对或含非 hex 字符即不是 trace id,而不是"一个短一点的 id"。
_TRACE_ID_RE = re.compile(r"^[0-9a-fA-F]{32}$")

# W3C:"An all-zero trace-id is invalid"(它表示"没有 trace"),不得被当成一个有效值
# 写进帧 —— 那会让消费侧的 `typeof === 'string'` 判真,把"没有 trace"读成"有一条"。
_ALL_ZERO_TRACE_ID = "0" * 32


def normalize_trace_id(raw: str | None) -> str | None:
    """把候选 trace id 归一成**可以进帧**的形态;不合格一律 None(不是空串)。

    与 TS 侧 `packages/shared/src/sse/contract.ts::normalizeSSEFrameTraceId` 是
    **同一条规则的两份语言实现**(跨语言无法共用一份代码,但判例表逐字同形,
    两侧各自带一份同表用例:`tests/test_sse_trace_frame_d174.py` 与
    `packages/shared/src/sse/__tests__/sse-frame-trace-id.test.ts`)。
    """
    if not isinstance(raw, str):
        return None
    candidate = raw.strip().lower()
    if not _TRACE_ID_RE.match(candidate):
        return None
    if candidate == _ALL_ZERO_TRACE_ID:
        return None
    return candidate


def sse_frame_trace_id() -> str | None:
    """当轮可写进帧的 trace id;读不到 / 不合法 ⇒ None(调用方据此**整字段缺席**)。

    取值只经 `current_trace_id()`(中间件那份 ContextVar 的唯一读取出口),本函数不
    碰任何请求对象,因此后台任务 / ASGI in-process 用例经 `use_trace_id()` 绑定的轮次
    在这里同样取得到 —— 这是刻意的:D147 已经把那条通道铺好,本票只是多一个投影面。
    """
    return normalize_trace_id(current_trace_id())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

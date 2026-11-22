# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D174(2026-09-30 立)常驻回归:SSE **帧内** trace id 回带(承 D147)。

D147 把 trace id 落在响应头 `X-Trace-Id`(两端 CORS 已 expose),而"帧里也带 trace id"
这一格没做:头在整趟流式响应上只出现一次,一条响应有几十到几千帧共用它 —— 拿头只能
定位到"这一整轮",定位不到"这一帧"。本票补的就是帧级那一格,并把它钉成常驻判据。

四条硬要求(与票面"已裁决的设计约束"逐字对应,每条都有正反用例):
① **单一生产点**:注入只发生在中心帧工厂 `llm.py::_sse()`;70+ 个 yield 站点一律不写,
   历史上另有三帧(plan_updated / tool-summary / citations)自带 f-string 绕过工厂 ——
   本票把它们改走 `_sse`(线格式逐字节不变),否则"每一帧都带"这句话本身就是假的。
② **归一与缺省**:落帧的值是小写 32 hex;全 0 按 W3C 非法 ⇒ 不写;没有有效 trace 时
   **整字段缺席**(不写空串、不写 null)—— "空串"与"没有"必须可分。
③ **两侧契约同批登记**:`core/sse_contract.py`(键名 + 帧级元信息清单)与
   `packages/shared/src/sse/contract.ts` 的 `SSEEventMeta`。
④ **trace id 是关联键,不是授权凭据**:任何归属判定都不得读它 —— 见
   `test_foreign_trace_id_does_not_change_ownership`(阳性对照:构造"别人属主"的 traceId,
   断言归属结果与它无关)。

判例表(归一规则)与 TS 侧 `packages/shared/src/sse/__tests__/sse-frame-trace-id.test.ts`
**逐字同形**:跨语言无法共用一份实现,所以两侧各带同一张表,谁改规则另一边必红。

测试隔离(§5 铁律):全程不调 DB / Redis,只用纯函数与 contextvar;`use_trace_id` 是
D147 留下的唯一后台绑定出口,不新开第二条 trace 通道。
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.sse_contract import (
    SSE_COMPAT_EVENTS,
    SSE_EVENT_CONTRACTS,
    SSE_FRAME_META_FIELDS,
    SSE_TRACE_ID_PAYLOAD_KEY,
)
from app.core.trace_context import normalize_trace_id, sse_frame_trace_id
from app.middleware.trace_context import use_trace_id
from app.routers import llm
from app.services.session_store import (
    IDENTITY_METADATA_KEYS,
    carry_identity_keys,
    owner_scoped_allows,
    scrub_identity_keys,
    thread_owner,
)

TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
# 阳性对照用:一条**属于别人**的合法形态 trace id(格式完全合格,只是不是本轮的)
FOREIGN_TRACE_ID = "0123456789abcdef0123456789abcdef"
ALL_ZERO_TRACE_ID = "0" * 32


def _frame_data(frame: str) -> Any:
    """从 `event: X\\ndata: {...}\\n\\n` 里取回 payload(按线格式解,不按内存对象猜)。"""
    lines = frame.split("\n")
    assert lines[-1] == "" and lines[-2] == "", f"帧必须以 \\n\\n 结尾,实得 {frame!r}"
    data_line = next(line for line in lines if line.startswith("data: "))
    return json.loads(data_line[len("data: ") :])


def _event_name(frame: str) -> str:
    return next(line for line in frame.split("\n") if line.startswith("event: "))[
        len("event: ") :
    ]


# ---------------------------------------------------------------------------
# ② 归一判例表 —— 与 TS 侧同一张表,逐字同形
# ---------------------------------------------------------------------------

# (输入, 期望) —— 期望 None 表示"这个值不得进帧"
_NORMALIZATION_CASES: list[tuple[Any, str | None]] = [
    (TRACE_ID, TRACE_ID),
    # 大写归一为小写(W3C 要求小写上线,而 api 端/上游偶发大写)
    ("4BF92F3577B34DA6A3CE929D0E0E4736", TRACE_ID),
    ("  " + TRACE_ID + "  ", TRACE_ID),
    # W3C:全 0 trace-id 表示"没有 trace",不得被当成一个有效值
    (ALL_ZERO_TRACE_ID, None),
    ("0000000000000000000000000000000f", ALL_ZERO_TRACE_ID[:31] + "f"),
    # 长度不对 / 非 hex / 类型不对 ⇒ 一律不是 trace id(不是"短一点的 id")
    ("", None),
    ("   ", None),
    ("abc", None),
    (TRACE_ID[:31], None),
    (TRACE_ID + "0", None),
    ("g" * 32, None),
    (TRACE_ID.replace("4", "-"), None),
    (None, None),
    (12345, None),
    (TRACE_ID.upper() + " ", TRACE_ID),
]


@pytest.mark.parametrize(("raw", "expected"), _NORMALIZATION_CASES)
def test_normalization_case_table(raw: Any, expected: str | None) -> None:
    """判据:小写 32 hex ⇒ 归一为小写;其余 ⇒ None(**不是空串**)。"""
    assert normalize_trace_id(raw) == expected


def test_normalization_never_returns_empty_string() -> None:
    """不合格输入的返回值必须是 None。空串会让消费侧 `typeof === 'string'` 判真,
    把"没有 trace"洗成"有一条空的"—— 那是本仓记过多次的"把没判写成判过了"。"""
    for raw, _expected in _NORMALIZATION_CASES:
        got = normalize_trace_id(raw)
        assert got != "", f"输入 {raw!r} 归一成了空串"


# ---------------------------------------------------------------------------
# 取值只经那一份载体(D147 的 ContextVar)
# ---------------------------------------------------------------------------


def test_frame_trace_id_reads_the_single_carrier() -> None:
    with use_trace_id(TRACE_ID):
        assert sse_frame_trace_id() == TRACE_ID


def test_unbound_context_yields_no_fake_trace_id() -> None:
    """反向对照:没绑定就**没有**,不得造一个看起来像的 id、也不得回退成空串。"""
    assert sse_frame_trace_id() is None


def test_all_zero_carrier_is_not_admitted_into_frames() -> None:
    """中间件按**格式**接受全 0(`test_trace_context.py::test_parse_all_zero_hex` 钉着,
    那条一字未动),但"可以进帧"是另一回事:全 0 在 W3C 里就是"没有 trace"。"""
    with use_trace_id(ALL_ZERO_TRACE_ID):
        assert sse_frame_trace_id() is None


# ---------------------------------------------------------------------------
# ① 注入:每一帧、只此一处
# ---------------------------------------------------------------------------


def test_named_frame_carries_trace_id() -> None:
    payload = {"type": "chunk", "content": "hi"}
    with use_trace_id(TRACE_ID):
        frame = llm._sse("chunk", payload)
    assert _event_name(frame) == "chunk"
    assert _frame_data(frame)[SSE_TRACE_ID_PAYLOAD_KEY] == TRACE_ID
    # 原有字段一字不动
    assert _frame_data(frame)["content"] == "hi"


def test_no_valid_trace_means_field_absent_not_empty() -> None:
    """无 trace ⇒ 键整个缺席(既不是 ""、也不是 null)。"""
    frame = llm._sse("chunk", {"type": "chunk", "content": "x"})
    data = _frame_data(frame)
    assert SSE_TRACE_ID_PAYLOAD_KEY not in data
    assert '""' not in frame, "不得写出空串占位"
    assert "null" not in frame, "不得写出 null 占位"


def test_uppercase_carrier_is_lowered_on_the_wire() -> None:
    with use_trace_id(TRACE_ID.upper()):
        data = _frame_data(llm._sse("chunk", {"type": "chunk", "content": "x"}))
    assert data[SSE_TRACE_ID_PAYLOAD_KEY] == TRACE_ID


def test_compat_events_keep_anthropic_wire_shape() -> None:
    """Anthropic 兼容面**不带**我方自定键:两份契约对它的原话都是"wire 形态与 Anthropic
    官方一致"。往兼容帧加 traceId 是单方面改那个协议,不属于本票。"""
    compat = sorted(SSE_COMPAT_EVENTS)
    assert compat, "兼容集为空说明契约被摘线,这条判据就无从成立"
    for evt in compat:
        payload = {"type": evt, "x": 1}
        with use_trace_id(TRACE_ID):
            data = _frame_data(llm._sse(evt, payload))
        assert data == payload, f"兼容帧 {evt} 被加了键 {sorted(set(data) - set(payload))}"
        assert SSE_TRACE_ID_PAYLOAD_KEY not in data


def test_payload_dict_is_never_mutated() -> None:
    """不改入参:同一 dict 常在 yield 之后继续被用(落库记录 / 复用),就地写键等于把
    trace 带进持久化面 —— 本票没做那件事,也不该被顺手做掉。"""
    payload: dict[str, Any] = {"type": "terminal_end", "terminalId": "t-1"}
    before = dict(payload)
    with use_trace_id(TRACE_ID):
        frame = llm._sse("terminal_end", payload)
    assert payload == before
    assert _frame_data(frame)[SSE_TRACE_ID_PAYLOAD_KEY] == TRACE_ID


def test_non_dict_payload_passes_through() -> None:
    with use_trace_id(TRACE_ID):
        frame = llm._sse("chunk", ["a", "b"])
    assert _frame_data(frame) == ["a", "b"]


def test_self_reported_trace_id_never_wins() -> None:
    """两条都要成立:① 有 trace 时**工厂的值赢**(调用方/上游自写的那一份被盖掉);
    ② 没 trace 时**剥掉**自写的那一份 —— 留着一个没有出处的值,等于让
    "帧上的 traceId 只能出自这一处"这条不变量被绕过。"""
    poisoned = {"type": "chunk", "content": "x", SSE_TRACE_ID_PAYLOAD_KEY: FOREIGN_TRACE_ID}
    with use_trace_id(TRACE_ID):
        data = _frame_data(llm._sse("chunk", dict(poisoned)))
    assert data[SSE_TRACE_ID_PAYLOAD_KEY] == TRACE_ID

    stripped = _frame_data(llm._sse("chunk", dict(poisoned)))
    assert SSE_TRACE_ID_PAYLOAD_KEY not in stripped
    # 剥的是副本:入参不得被就地改坏(理由见上一条用例)
    assert poisoned[SSE_TRACE_ID_PAYLOAD_KEY] == FOREIGN_TRACE_ID


# ---------------------------------------------------------------------------
# ① 的源码形状锁:工厂是唯一出口,写键只有一行
# ---------------------------------------------------------------------------

_LLM_SRC = Path(llm.__file__).read_text(encoding="utf-8")
# R3:注入实现已从路由提到 core/sse_frames.py,这条锁按整个 app 包计数,需要拿到那份源码的位置
from app.core import sse_frames  # noqa: E402


def test_frame_factory_is_the_only_named_frame_emitter() -> None:
    """llm.py 里命名帧的 f-string 只许出现在 `_sse` 内部一处。
    历史上 plan_updated / tool-summary / citations 三帧自带 `f"event: …"` 绕过工厂,
    于是"单点注入"对它们不成立 —— 那条"每一帧都带 trace"的承诺当时就是假的。"""
    assert _LLM_SRC.count('f"event: ') == 1, (
        "命名帧必须由 `_sse()` 这一个工厂产出;新增第二处 `f\"event: ` 就等于"
        "造一帧不带 traceId 的漏网点(判序见 `_with_frame_trace_id`)"
    )


def test_trace_key_is_written_at_exactly_one_place() -> None:
    """写键语句(`SSE_TRACE_ID_PAYLOAD_KEY: trace_id`)全仓恰好一处。

    R3 之后那一处在 `core/sse_frames.py`(两条拼帧路径共用),所以计数必须按**整个 app 包**
    而不是按 llm.py 单文件 —— 只按单文件数会出两种错:搬去新文件被当成"0 处 = 通过",
    或者在新文件又留一份而没人发现。路由里现在必须是 0 处。
    """
    writer = "SSE_TRACE_ID_PAYLOAD_KEY: trace_id"
    app_root = Path(sse_frames.__file__).resolve().parent.parent
    hits = {
        p.name: p.read_text(encoding="utf-8").count(writer)
        for p in sorted(app_root.rglob("*.py"))
        if p.read_text(encoding="utf-8").count(writer) > 0
    }
    assert hits == {Path(sse_frames.__file__).name: 1}, f"全仓写键语句分布:{hits}"
    assert _LLM_SRC.count(writer) == 0, "路由里不得再留一份写键语句"
    assert '"traceId"' not in _LLM_SRC and "'traceId'" not in _LLM_SRC, (
        "键名只经 SSE_TRACE_ID_PAYLOAD_KEY 引用,不在路由里写死字面量"
    )


# ---------------------------------------------------------------------------
# ③ 两侧契约登记(键名 + 帧级元信息清单;payload_fields 不得被污染)
# ---------------------------------------------------------------------------


def test_contract_registers_the_frame_meta_key() -> None:
    # 键名逐字 camelCase `traceId`,与 TS 侧 contract.ts 的 SSE_TRACE_ID_PAYLOAD_KEY 同名。
    # 断言形状刻意写成"整张清单等于单元素集":既证键名,又证帧级元信息层没被顺手加进
    # 别的键(那条会连带改变两侧契约的语义)。
    assert frozenset({"traceId"}) == SSE_FRAME_META_FIELDS
    assert SSE_TRACE_ID_PAYLOAD_KEY in SSE_FRAME_META_FIELDS


def test_trace_id_is_not_a_per_event_required_field() -> None:
    """traceId 住在**帧级元信息**层,不进各条目的 payload_fields:那份清单被 `_sse()`
    的契约诊断当"必填"来查(缺 ⇒ 告警),把"本轮没有有效 trace"这一合法形态列进去,
    就等于让诊断对合法帧恒告警。"""
    for contract in SSE_EVENT_CONTRACTS:
        assert SSE_TRACE_ID_PAYLOAD_KEY not in contract.payload_fields, (
            f"{contract.name} 的 payload_fields 里不该出现帧级元信息键"
        )
        assert contract.injects_trace_id is True, (
            f"{contract.name} 应默认声明带 traceId(它是对话流帧)"
        )


# ---------------------------------------------------------------------------
# ④ 阳性对照:traceId 是关联键,不是授权凭据
# ---------------------------------------------------------------------------


def test_foreign_trace_id_does_not_change_ownership() -> None:
    """构造一条**别人属主**的 traceId(格式完全合法)塞进归属判定要看的那份 metadata,
    断言归属结果与它在不在、是谁的都**无关**。

    为什么这一条必须存在:traceId 来自客户端可自写的 `traceparent` 头,一旦有任何
    归属/权限判定读它,就等于让调用方自报"我属于哪条链"—— 那正是本仓「认证不等于
    授权」那一族缺陷的形状。判据侧(session_store)本来就不认这个键,本用例把
    "不认"钉成事实,而不是留成一句注释。
    """
    victim = "user-victim-0001"
    attacker = "user-attacker-0002"

    clean_meta: dict[str, Any] = {"userId": victim}
    poisoned_meta: dict[str, Any] = {
        "userId": victim,
        SSE_TRACE_ID_PAYLOAD_KEY: FOREIGN_TRACE_ID,
        # 连原始 traceparent 一起带上:攻击者能写的一切
        "traceparent": f"00-{FOREIGN_TRACE_ID}-b7ad6b7169203331-01",
    }

    # 取属主只看落库的 userId,与帧上/元数据里那个"看起来像凭据"的值无关
    assert thread_owner(SimpleNamespace(metadata=clean_meta)) == victim
    assert thread_owner(SimpleNamespace(metadata=poisoned_meta)) == victim

    # 归属判定结果逐格相同:带别人的 traceId ≠ 拿到访问权
    for meta in (clean_meta, poisoned_meta):
        owner = thread_owner(SimpleNamespace(metadata=meta))
        assert owner_scoped_allows(attacker, owner) is False
        assert owner_scoped_allows(victim, owner) is True
        assert owner_scoped_allows(None, owner) is True  # 未鉴权/dev 通道,与本票无关

    # traceId **不是**身份键:整写 metadata 时它既不参与剥、也不参与盖回 ——
    # 它没有"属主"可言,身份键的待遇(userId/roleId)一点都不能分给它。
    assert SSE_TRACE_ID_PAYLOAD_KEY not in IDENTITY_METADATA_KEYS
    assert scrub_identity_keys(poisoned_meta)[SSE_TRACE_ID_PAYLOAD_KEY] == FOREIGN_TRACE_ID
    assert set(scrub_identity_keys(poisoned_meta)) == set(poisoned_meta) - set(
        IDENTITY_METADATA_KEYS
    )
    carried = carry_identity_keys(
        {"userId": victim}, {**poisoned_meta, "userId": attacker}
    )
    assert carried["userId"] == victim, "身份键必须以已落库那份为准"
    assert carried[SSE_TRACE_ID_PAYLOAD_KEY] == FOREIGN_TRACE_ID, (
        "traceId 原样留着(它不是身份键),但上面的归属断言已经证明它不参与判定"
    )


def test_frames_from_a_foreign_trace_do_not_reach_the_authorized_principal() -> None:
    """同型的第二格:帧里的 traceId 由**当轮 contextvar**决定,不受 payload 内容影响 ——
    所以"带别人 trace 的帧"永远不会把这条流绑到那个人身上。"""
    payload = {
        "type": "steer",
        "phase": "injected",
        "text": "引导",
        SSE_TRACE_ID_PAYLOAD_KEY: FOREIGN_TRACE_ID,
    }
    with use_trace_id(TRACE_ID):
        data = _frame_data(llm._sse("steer", payload))
    assert data[SSE_TRACE_ID_PAYLOAD_KEY] == TRACE_ID
    assert data[SSE_TRACE_ID_PAYLOAD_KEY] != FOREIGN_TRACE_ID
    # 且这条流的归属判定仍然只看 principal
    assert owner_scoped_allows(TRACE_ID, FOREIGN_TRACE_ID) is False


# ---------------------------------------------------------------------------
# 承重墙:trace 必须**活得过流式响应体的消费时刻**,不只是活过 dispatch
# ---------------------------------------------------------------------------


def test_trace_id_survives_into_the_streaming_body() -> None:
    """端到端(ASGI in-process,零 DB / 零网络):中间件解到 traceparent ⇒ **正文每一帧**
    都带同一个 traceId。

    为什么这条不能拿上面那些单元级用例顶掉:`TraceContextMiddleware.dispatch` 在
    `call_next` **返回**时就把 contextvar 的 token reset 了,而 `StreamingResponse` 的正文
    是在另一个任务里被逐块消费的(异步生成器 + anyio 线程池投递)。那个任务持有的是创建
    时刻的 context **快照** —— 于是"值活不过 dispatch、却活得过响应体"这一差别只能靠真发
    一次流式请求量出来。而它正是本票全部功能的承重墙:墙塌了账面照样全绿(`_sse` 的单元
    用例一条都测不到这一格,`git status`、typecheck 更不会)。这一型在本仓的名字叫
    "判据必须在真跑它的那一刻才成立,否则等于没有"。
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from starlette.responses import StreamingResponse

    from app.middleware.trace_context import TraceContextMiddleware

    app_ = FastAPI()
    app_.add_middleware(TraceContextMiddleware)

    @app_.get("/sse")
    async def _sse_endpoint() -> StreamingResponse:  # 不接 Request:值只从 contextvar 取
        async def _gen():
            yield llm._sse("chunk", {"type": "chunk", "content": "a"})
            yield llm._sse("chunk", {"type": "chunk", "content": "b"})
            yield llm._sse("done", {"type": "done"})

        return StreamingResponse(_gen(), media_type="text/event-stream")

    client = TestClient(app_)
    with client.stream(
        "GET", "/sse", headers={"traceparent": f"00-{TRACE_ID}-b7ad6b7169203331-01"}
    ) as resp:
        assert resp.status_code == 200
        # D147 那一格仍在(响应头),本票加的是帧内那一格
        assert resp.headers.get("X-Trace-Id") == TRACE_ID
        body = "".join(resp.iter_text())

    frames = [line for line in body.split("\n") if line.startswith("data: ")]
    assert len(frames) == 3, f"应当正好三帧,实得 {len(frames)}"
    for line in frames:
        data = json.loads(line[len("data: ") :])
        assert data.get(SSE_TRACE_ID_PAYLOAD_KEY) == TRACE_ID, (
            f"正文帧没带 trace —— 承重墙塌了:{data!r}"
        )


def test_stream_body_without_traceparent_has_the_key_absent_end_to_end() -> None:
    """反向对照走同一条端到端路:没带 traceparent ⇒ 正文里**整字段缺席**(而不是空串/null)。
    只测正向那一支会放过"恒写一个空串"这种实现 —— 它同样能让上面的用例绿?不会,但
    "缺席"这件事必须在**流式路径**上被看过,而不是只在单元路径上。"""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from starlette.responses import StreamingResponse

    from app.middleware.trace_context import TraceContextMiddleware

    app_ = FastAPI()
    app_.add_middleware(TraceContextMiddleware)

    @app_.get("/sse")
    async def _sse_endpoint() -> StreamingResponse:
        async def _gen():
            yield llm._sse("chunk", {"type": "chunk", "content": "x"})

        return StreamingResponse(_gen(), media_type="text/event-stream")

    client = TestClient(app_)
    with client.stream("GET", "/sse") as resp:
        # 没 traceparent ⇒ D147 那条响应头也不发(不造一个"看起来像"的 id)
        assert resp.headers.get("X-Trace-Id") is None
        text = "".join(resp.iter_text())

    data = json.loads(
        next(line for line in text.split("\n") if line.startswith("data: "))[len("data: ") :]
    )
    assert SSE_TRACE_ID_PAYLOAD_KEY not in data
    assert '""' not in text, "不得写出空串占位"
    assert "null" not in text, "不得写出 null 占位"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

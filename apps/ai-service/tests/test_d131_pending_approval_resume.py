# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D131 取证①:断线窗口里"审批已下发但用户还没点",重连续传能不能恢复?

结论(由本文件的判据现场量出,不是读代码后的印象):
**恢复不了 —— 待决审批在重连窗口里会丢。** 两条链路各丢一次,而且机制不同:

- 主对话流(`app/routers/llm.py` 的 `_sse`):帧**根本不带 `id:` 行**,
  客户端的 `lastEventIdRef` 永远停在空中 ⇒ 重连时连续传锚点都发不出去,
  重连 = 重新起一次 run,老 generator 里那条 `_approval_sessions[...]` 等待的
  `asyncio.Event` 与这一次毫无关系。
- Agent 任务流(`app/routers/agents.py` + `app/core/sse_buffer.py`):帧带 id,
  但续传语义是**按游标只补"其后的事件"**(`replay_outcome` 的 REPLAY_HIT 取
  `entries[seq - first + 1:]`)⇒ 审批帧在游标**之前**,不在重放集合里。

两侧都**没有**任何"重放仍待决的审批"的出口:`_permission_requests` /
`_approval_sessions` 只有 `[…] =`、`.get()`、`.pop()`、`.setdefault()` 四种取法,
从被审源码面看**没有一处迭代它们**(test_no_resume_path_reemits_pending_approvals 是本判据的
否证锁 —— 哪天这一格有了重放出口,该用例必须翻红,那时本结论要重新取证)。

建议的修法(**不在本票落地**,交主会话裁决,见 b2-d131-report.md)。

测试隔离(AGENTS §5 测试隔离铁律):全程纯内存 + 纯源码文本,**不连 PostgreSQL / Redis**,
不 import 任何会触发建池的模块路径(app.routers.llm 仅取 `_sse` 一个纯函数)。
"""

from __future__ import annotations

import inspect
import re
from typing import Any

from app.core.sse_buffer import REPLAY_HIT, SSEEventBuffer

# ── 现场构造:帧已发 → 游标推进 → 重连续传 ──────────────────────────────────

_APPROVAL_FRAME: dict[str, Any] = {
    "type": "tool-approval",
    "approval_id": "appr_deadbeef0001",
    "session_id": "sess-1",
    "tool_name": "run_command",
    "danger_level": "high",
}

_DECIDED_FRAME: dict[str, Any] = {
    "type": "tool-approval-resolved",
    "approval_id": "appr_cafef00d0002",
    "decision": "approve",
}


def _scenario() -> tuple[SSEEventBuffer, str, str, str]:
    """构造"审批帧已下发 → 游标推进到它之后"的最小现场。

    Returns:
        (buffer, 审批帧之前那一帧的 id, 审批帧的 id, 客户端断线时会带的 Last-Event-ID)
    """
    buffer = SSEEventBuffer()
    before_id = buffer.append("task-1", {"type": "run.started", "threadId": "t-1"})
    approval_id = buffer.append("task-1", dict(_APPROVAL_FRAME))
    # 断线前客户端还收到了它之后的两帧(thinking.delta / plan.step 之类)
    buffer.append("task-1", {"type": "thinking.delta", "content": "等一下,我去查"})
    last_seen = buffer.append("task-1", {"type": "plan.step", "title": "准备执行"})
    return buffer, before_id, approval_id, last_seen


def test_pending_approval_is_not_replayed_after_cursor() -> None:
    """正向取证:待决审批帧在重连后的重放集合里**不存在**。

    客户端的 Last-Event-ID 取"断线前收到的最后一帧"—— 这是 SSE 的标准语义,
    也是 `packages/api-client/src/client.ts` 的 `lastEventIdRef` 实际做的事。
    """
    buffer, _before_id, approval_id, last_seen = _scenario()

    outcome = buffer.replay_outcome("task-1", last_seen)

    assert outcome.status == REPLAY_HIT, f"本用例判的是重放集合的内容,不是可续性: {outcome.reason}"
    replayed_ids = [e["id"] for e in outcome.events]
    assert approval_id not in replayed_ids, (
        "待决审批竟被重放了 —— 本文件的取证结论(会丢)不再成立,须重新定性"
    )
    assert outcome.events == [], (
        f"游标之后无新帧时重放应为空,实得 {replayed_ids}"
    )


def test_control_events_after_cursor_are_replayed() -> None:
    """对照:同一把尺子在"游标之后确有帧"时必须能重放到(含审批帧本身)。

    缺了这条,上一条的 `approval_id not in replayed_ids` 就只是"什么都没重放"的
    退化结果,证明不了任何事(判据必须能命中它要防的形态,也必须在正当形态上放过)。
    """
    buffer, before_id, approval_id, _last_seen = _scenario()

    # 客户端在**审批帧之前**断开:Last-Event-ID = 审批帧前面那一帧
    outcome = buffer.replay_outcome("task-1", before_id)

    assert outcome.status == REPLAY_HIT
    assert outcome.dropped == 0
    replayed_ids = [e["id"] for e in outcome.events]
    assert approval_id in replayed_ids, (
        f"尺子看不见审批帧,上一条的'不在重放集合'就没有意义: {replayed_ids}"
    )
    replayed_types = [e["event"].get("type") for e in outcome.events]
    assert replayed_types == ["tool-approval", "thinking.delta", "plan.step"], replayed_types


def test_decided_approval_is_not_replayed() -> None:
    """反向对照:已决的审批更不得被重放(重放会二次弹窗)。

    这条与第一条同形成立 —— 说明"不在重放集合"是**游标位置**的性质,
    而不是"审批帧被特殊对待"。所以想恢复待决审批,靠位置判是判不出来的,
    必须显式去查待决表(现无任何一处这么做)。
    """
    buffer = SSEEventBuffer()
    decided_id = buffer.append("task-1", dict(_DECIDED_FRAME))
    cursor = buffer.append("task-1", {"type": "chunk", "content": "已按批准执行"})

    tail = buffer.replay_outcome("task-1", cursor)
    assert decided_id not in [e["id"] for e in tail.events]

    # 从更早的锚点重连:已决帧会作为"历史事件"被重放 ⇒ 位置判的第二次后果
    early = buffer.replay_outcome("task-1", None)
    replayed_types = [e["event"].get("type") for e in early.events]
    assert "tool-approval-resolved" in replayed_types, (
        "整段重放把已决帧也带回来了 —— 前端若按帧二次弹窗就是二次副作用"
    )


def test_chat_stream_frames_carry_no_sse_id_line() -> None:
    """主对话流的帧**没有 id: 行** ⇒ 连续传锚点都不存在(第二条链路的第一半)。

    `client.ts` 只在 `line.startsWith('id:')` 时才推进 `lastEventIdRef`;
    主对话流一条 `id:` 都不发,所以重连请求根本不会带 `Last-Event-ID`。
    """
    from app.routers.llm import _sse

    frame = _sse("tool-approval", dict(_APPROVAL_FRAME))

    assert frame.startswith("event: tool-approval\ndata: ")
    assert not re.search(r"^id:", frame, re.MULTILINE), (
        f"主对话流帧现在带 id 了,须重新取证是否已具备续传:\n{frame}"
    )


def test_agents_stream_wire_events_carry_id_anchor() -> None:
    """对照:Agent 任务流的重放载荷**是带 id 的**(与上一条构成不对称的证据)。

    所以"恢复不了"在两链路上的原因不同:任务流是有锚点但按游标只补之后;
    主对话流是压根没有锚点。不得把这条读成"任务流能恢复待决审批"。
    """
    buffer = SSEEventBuffer()
    eid = buffer.append("task-2", dict(_APPROVAL_FRAME))

    assert re.fullmatch(r"task-2-\d+", eid), f"id 形态与 agents.py 的续传解析不符: {eid}"
    wire = buffer.replay_outcome("task-2", None).events
    assert wire and wire[0]["id"] == eid and "id" in wire[0]


# ── 否证锁:有没有"重放仍待决的审批"的出口? ────────────────────────────────

_PENDING_TABLES = ("_permission_requests", "_approval_sessions")
_ITERATION_RE = re.compile(
    r"(?:for\s+\w+(?:\s*,\s*\w+)*\s+in\s+(?:self\.)?(?:%s))"
    r"|(?:%s)\s*\.\s*(?:values|items|keys)\s*\(" % ("|".join(_PENDING_TABLES), "|".join(_PENDING_TABLES)),
)


def _code_face(source: str) -> str:
    """剥行注释后的代码面(注释里的提及不构成"真有一个重放出口")。"""
    return "\n".join(line.split("#", 1)[0] for line in source.splitlines())


def test_no_resume_path_reemits_pending_approvals() -> None:
    """判据的否证:两张贴表若出现"被遍历"的取法,说明重放出口已经存在,本结论作废。

    取法面只允许 `[…] =` / `.get(` / `.pop(` / `.setdefault(`(写入与逐条结算),
    这些都不构成"把仍待决的那几条重新下发"。
    """
    import app.routers.llm as llm_module
    from app.services import agent_engine

    sources = {
        "routers/llm.py": _code_face(inspect.getsource(llm_module)),
        "services/agent_engine.py": _code_face(inspect.getsource(agent_engine)),
    }
    # 每个面必须真的提到过这两张表之一 —— 提不到说明读错了文件,不得把"没扫到"当成"没有"
    for name, src in sources.items():
        assert any(t in src for t in _PENDING_TABLES), f"{name} 面里找不到待决表,判据失效"

    hits: list[str] = []
    for name, src in sources.items():
        for m in _ITERATION_RE.finditer(src):
            line_no = src[: m.start()].count("\n") + 1
            hits.append(f"{name}:{line_no} {m.group(0).strip()}")

    assert not hits, (
        "待决审批表已被某处遍历 ⇒ 可能存在重放出口,本文件的'会丢'结论须重新取证:\n"
        + "\n".join(hits)
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

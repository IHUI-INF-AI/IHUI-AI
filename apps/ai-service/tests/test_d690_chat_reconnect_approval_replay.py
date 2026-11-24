# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D690(方案 A,机主授权代拍板 2026-10-22)—— 主对话流断线重连重放仍待决审批。

承 D131 取证①(`test_d131_pending_approval_resume.py`:断线窗口里"审批已下发
但用户还没点"的弹窗会丢)与 D1047 diff①/diff②(取数侧
`app/core/approval_replay.py::chat_pending_approval_replays` 2026-10-18 落库,
生产接线本票落地)。任务流侧(D1047 先行)钉在
`test_d1047_pending_approval_replay.py`;本文件钉主对话流侧的三格:

① 出口行为(成对):待决 ∧ 属主相等 ∧ 字段齐备 ∧ 未过期 ⇒ 重放帧出现在恢复流;
   已决 / 已唤醒 / 跨属主 / 无身份对有人属主 / 字段缺 / 过期 / created_at 缺失或
   畸形 / 会话无条目 ⇒ **不得**重放(二次弹窗 = 副作用;空头支票 = 僵尸 run);
② 接线钉(源码面):gen() 在 `req.streamSessionId` 重连位调 `_approval_replay_frames`,
   位置在 D34 注入交代帧之后、goal 流首帧之前(取数侧全绿而端点不调 = 弹窗照样丢,
   与 D1047 的 agents.py 接线钉同一手法);
③ 契约两侧同批(py + ts 逐字同值,先例 D174):`replay` 标记键名在
   `app/core/sse_contract.py::SSE_APPROVAL_REPLAY_PAYLOAD_KEY` 与
   `packages/shared/src/sse/contract.ts::SSE_APPROVAL_REPLAY_PAYLOAD_KEY` 同值,
   且**不进** tool-approval 的必填 payload_fields(正常审批帧没有这一格)。

测试隔离(AGENTS §5):全程纯内存,不连 PostgreSQL / Redis;`app.routers.llm`
的 import 面与 D131 取证同规(该模块可纯函数取用,不触发建池)。
"""

from __future__ import annotations

import asyncio
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from app.core.sse_contract import SSE_APPROVAL_REPLAY_PAYLOAD_KEY
from app.routers.llm import _APPROVAL_TIMEOUT, _approval_replay_frames, _approval_sessions

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
LLM_PY = AI_SERVICE_ROOT / "app" / "routers" / "llm.py"
AGENTS_PY = AI_SERVICE_ROOT / "app" / "routers" / "agents.py"
SSE_CONTRACT_PY = AI_SERVICE_ROOT / "app" / "core" / "sse_contract.py"
CONTRACT_TS = REPO_ROOT / "packages" / "shared" / "src" / "sse" / "contract.ts"

_SESSION = "d690-sess-1"
_OWNER = "user-A"


_UNSET: Any = object()  # 区分"未传 created_at(默认新鲜)"与"显式传 None(缺失)"


def _entry(
    *,
    owner: str | None = _OWNER,
    decision: str | None = None,
    set_event: bool = False,
    created_at: Any = _UNSET,
    **overrides: Any,
) -> dict[str, Any]:
    """按 llm.py 生产条目形状(diff① 补齐后的键集)造一条待决/已决条目。"""
    ev = asyncio.Event()
    if set_event:
        ev.set()
    entry: dict[str, Any] = {
        "event": ev,
        "decision": decision,
        "scope": None,
        "reason": None,
        "argv": ["ls"],
        "tool_name": "run_command",
        "net_fact": None,
        "tool_call_id": "call-1",
        "args_preview": '{"argv":["ls"]}',
        "danger_level": "high",
        "owner_user_id": owner,
        "created_at": datetime.now(UTC).isoformat() if created_at is _UNSET else created_at,
    }
    entry.update(overrides)
    return entry


@pytest.fixture()
def seeded():
    """在 _approval_sessions 里开一格,用后即清(不碰其他会话的格)。"""
    _approval_sessions.pop(_SESSION, None)
    bucket: dict[str, dict[str, Any]] = {}
    _approval_sessions[_SESSION] = bucket
    yield bucket
    _approval_sessions.pop(_SESSION, None)


def _frame_payload(frame: str) -> dict[str, Any]:
    assert frame.startswith("event: tool-approval\ndata: ")
    body = frame.split("data: ", 1)[1].strip()
    return json.loads(body)


# ── ① 出口行为:正例 ──────────────────────────────────────────────────────────


def test_pending_fresh_entry_is_replayed_as_tool_approval_frame(seeded) -> None:
    """断线窗口后重连 ⇒ 仍待决条目以同形 tool-approval 帧 + replay 标记出现在恢复流。"""
    seeded["appr_fresh000001"] = _entry()
    frames = _approval_replay_frames(_SESSION, _OWNER)
    assert len(frames) == 1, f"应重放恰一帧,实得 {len(frames)}"
    payload = _frame_payload(frames[0])
    assert payload["type"] == "tool-approval"
    assert payload["approval_id"] == "appr_fresh000001"
    assert payload["tool_name"] == "run_command"
    assert payload["tool_call_id"] == "call-1"
    assert payload["args_preview"] == '{"argv":["ls"]}'
    assert payload["danger_level"] == "high"
    assert payload["session_id"] == _SESSION
    assert payload[SSE_APPROVAL_REPLAY_PAYLOAD_KEY] is True, "重放帧必须带 replay 标记(前端幂等渲染的判别位)"
    # 正常审批帧的必填展示字段之外,不得把内部记账格(owner_user_id/created_at)漏上 wire
    wire_keys = set(payload) - {"traceId"}  # D174:有合法 trace 上下文时才带,测试面恒缺席
    assert wire_keys == {
        "type",
        "approval_id",
        "tool_name",
        "tool_call_id",
        "args_preview",
        "danger_level",
        "session_id",
        SSE_APPROVAL_REPLAY_PAYLOAD_KEY,
    }, f"重放帧 wire 形状漂了: {sorted(wire_keys)}"
    # B 档未选:主对话流帧仍不得带 id: 行(与 D131 取证第④条同判)
    assert not re.search(r"^id:", frames[0], re.MULTILINE)


def test_replay_is_read_only_snapshot(seeded) -> None:
    """重放不改登记表:不 pop、不写 decision、不置 event(与取数侧"不取结算名额"同纪律)。"""
    entry = _entry()
    seeded["appr_ro00000001"] = entry
    _approval_replay_frames(_SESSION, _OWNER)
    assert "appr_ro00000001" in seeded
    assert entry["decision"] is None
    assert not entry["event"].is_set()


# ── ① 出口行为:反例(成对)────────────────────────────────────────────────────


def test_decided_or_woken_entry_is_not_replayed(seeded) -> None:
    """已决(decision 写入)或已唤醒(event 置位)⇒ 不重放 —— 重放即二次弹窗(副作用)。"""
    seeded["appr_dec00000001"] = _entry(decision="approve")
    seeded["appr_woken000001"] = _entry(set_event=True)
    assert _approval_replay_frames(_SESSION, _OWNER) == []


@pytest.mark.parametrize(
    ("caller", "entry_owner"),
    [("user-B", "user-A"), (None, "user-A"), ("user-A", None)],
    ids=["跨属主", "无身份对有人属主", "有人身份对无主条目"],
)
def test_owner_mismatch_is_not_replayed(seeded, caller, entry_owner) -> None:
    """属主精确相等才重放(与审批结算同判据,fail-closed,与取数侧 T3 同族)。"""
    seeded["appr_own00000001"] = _entry(owner=entry_owner)
    assert _approval_replay_frames(_SESSION, caller) == []


def test_expired_entry_is_not_replayed(seeded) -> None:
    """过期(created_at 老过 _APPROVAL_TIMEOUT 决策窗口)⇒ 不重放(票面验收:过期条目不得重放)。"""
    stale = (datetime.now(UTC) - timedelta(seconds=_APPROVAL_TIMEOUT + 5)).isoformat()
    seeded["appr_old00000001"] = _entry(created_at=stale)
    assert _approval_replay_frames(_SESSION, _OWNER) == []


@pytest.mark.parametrize(
    "created_at",
    [None, "not-a-date", 12345],
    ids=["缺失", "不可解析", "非字符串"],
)
def test_unjudgeable_freshness_is_not_replayed(seeded, created_at) -> None:
    """判不了新鲜度 ⇒ 不重放(fail-closed:宁可丢弹窗,不发一张兑现不了的旧弹窗)。"""
    seeded["appr_unk00000001"] = _entry(created_at=created_at)
    assert _approval_replay_frames(_SESSION, _OWNER) == []


def test_missing_display_field_is_not_replayed(seeded) -> None:
    """展示字段缺格 ⇒ 取数侧闸拦下(不发前端没法弹的半截帧;与取数侧 T5 同判的端到端面)。"""
    seeded["appr_half0000001"] = _entry(args_preview=None)
    assert _approval_replay_frames(_SESSION, _OWNER) == []


def test_unknown_or_empty_session_returns_no_frames() -> None:
    """会话无条目(新会话/已收口)⇒ 恒零帧 —— 非重连流与重连落空的合法形状。"""
    assert _approval_replay_frames("d690-no-such-session", _OWNER) == []
    _approval_sessions.pop(_SESSION, None)
    _approval_sessions[_SESSION] = {}
    try:
        assert _approval_replay_frames(_SESSION, _OWNER) == []
    finally:
        _approval_sessions.pop(_SESSION, None)


def test_mixed_bucket_replays_only_the_pending_fresh_owned_one(seeded) -> None:
    """同格混装:待决新鲜 ∧ 已决 ∧ 过期 ∧ 跨属主 ⇒ 只重放第一条(判据逐条独立生效)。"""
    seeded["appr_hit00000001"] = _entry()
    seeded["appr_dec00000002"] = _entry(decision="reject")
    seeded["appr_exp00000003"] = _entry(
        created_at=(datetime.now(UTC) - timedelta(seconds=_APPROVAL_TIMEOUT + 1)).isoformat()
    )
    seeded["appr_oth00000004"] = _entry(owner="user-B")
    frames = _approval_replay_frames(_SESSION, _OWNER)
    ids = [_frame_payload(f)["approval_id"] for f in frames]
    assert ids == ["appr_hit00000001"], f"重放集合不精确: {ids}"


# ── ② 接线钉:gen() 重连位真的调用出口(取数侧绿而端点不调 = 弹窗照样丢)────────


def test_gen_wires_replay_on_stream_session_reconnect() -> None:
    src = LLM_PY.read_text(encoding="utf-8")
    assert "def _approval_replay_frames(" in src, "重放组帧出口不在 llm.py"
    # 接线位:仅当调用方复用 streamSessionId(重连形态)才查待决表
    assert "if req.streamSessionId and session_id:" in src, "重连闸没钉在 streamSessionId 上"
    assert "_approval_replay_frames(session_id, owner_uuid)" in src, "gen() 未调用重放出口"
    # 位置:D34 注入交代帧之后(不抢"最早业务帧")、goal 流首帧之前
    assert src.index("yield _sse(SSE_INJECTION_APPLIED") < src.index(
        "_approval_replay_frames(session_id, owner_uuid)"
    ), "重放帧不得先于注入交代帧(D34:注入帧必须是流上最早的业务帧)"
    assert src.index("_approval_replay_frames(session_id, owner_uuid)") < src.index(
        "register_goal_listener(_goal_conversation_id)"
    ), "重放帧应落在流首区(goal 流首帧之前),与任务流侧 start 后重放同位形"


# ── ③ 契约两侧同批:replay 标记键 py/ts 逐字同值 + 不进必填清单 ─────────────────


def test_replay_key_declared_identically_on_both_contract_sides() -> None:
    """python 与 ts 契约面的重放标记键名同值(本票的"sse_contract 同批"硬前置)。"""
    assert SSE_APPROVAL_REPLAY_PAYLOAD_KEY == "replay"
    ts_src = CONTRACT_TS.read_text(encoding="utf-8")
    m = re.search(
        r"export const SSE_APPROVAL_REPLAY_PAYLOAD_KEY\s*=\s*['\"]([^'\"]+)['\"]", ts_src
    )
    assert m is not None, "packages/shared/src/sse/contract.ts 缺 SSE_APPROVAL_REPLAY_PAYLOAD_KEY 声明"
    assert m.group(1) == SSE_APPROVAL_REPLAY_PAYLOAD_KEY, (
        f"契约两侧重放标记键分叉: ts={m.group(1)!r} py={SSE_APPROVAL_REPLAY_PAYLOAD_KEY!r}"
    )
    # ts 判别成员把 replay 列为可选(正常审批帧没有这一格)
    assert re.search(r"replay\?:\s*true", ts_src), "contract.ts 的 tool-approval 成员未登记可选 replay?: true"


def test_replay_key_is_not_required_in_py_payload_fields() -> None:
    """replay 不进 SSEEventContract("tool-approval") 的 payload_fields —— 那份清单被
    _sse() 契约诊断当必填查,正常审批帧没有这一格,列进去 = 对合法帧恒告警。"""
    py_src = SSE_CONTRACT_PY.read_text(encoding="utf-8")
    m = re.search(r'SSEEventContract\(\s*"tool-approval"\s*,\s*\(([^)]*)\)', py_src, re.S)
    assert m is not None, "sse_contract.py 的 tool-approval 契约条目取不到,判据失效"
    fields = re.findall(r'"([a-zA-Z_0-9]+)"', m.group(1))
    assert "replay" not in fields, f"replay 被列进了必填清单: {fields}"


def test_chat_replay_frame_shape_paired_with_task_stream_replay() -> None:
    """两条腿的重放帧同形(同标记键):agents.py 的字面量写面与 llm.py 的常量写面不许分叉。"""
    agents_src = AGENTS_PY.read_text(encoding="utf-8")
    assert '"replay": True' in agents_src, (
        "agents.py 任务流重放的标记写面变了 —— 两侧同形判据须重新对齐(键名真相源在 sse_contract)"
    )
    llm_src = LLM_PY.read_text(encoding="utf-8")
    assert "SSE_APPROVAL_REPLAY_PAYLOAD_KEY: True" in llm_src, "llm.py 重放写面不再经契约常量"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

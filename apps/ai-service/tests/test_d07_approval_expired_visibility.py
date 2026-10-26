# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D-07(2026-10-26)第三格 —— 断线失效审批的**端上可见**成对判据。

前两格已在 `test_d07_approval_expiry_ledger_replay.py` 收口(留痕账本 + 具名拒绝,
零 wire 变化)。本文件补的是票面点名的最后一个跨端面:**失效要让用户看得见**。

做法(不新增事件名,走既有帧的可选载荷键):
- 服务端 `llm.py::_approval_replay_frames` 在重连时把账本里的失效条目投影成
  **同形** `tool-approval` 帧 + `expired: true` + `expired_reason`;
- 键名单源在 `sse_contract.py` 的两个常量,TS 侧在
  `packages/shared/src/sse/contract.ts` 逐字同值(本文件读源码钉同值);
- 端上三处(web / mobile-rn / miniapp)按 expired 分流:不弹窗、只给一条可读提示。

失效方向与既有判据同族:属主不等 ⇒ 零帧(存在性隔离)、账本空 ⇒ 零帧、
重连 N 次 ⇒ 同一集合且账本行数不变(只读投递)。
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.core.approval_replay import (
    approval_expiry_size,
    clear_approval_expiry,
    record_approval_expiry,
)
from app.core.sse_contract import (
    SSE_APPROVAL_EXPIRED_PAYLOAD_KEY,
    SSE_APPROVAL_EXPIRED_REASON_PAYLOAD_KEY,
    SSE_EVENT_CONTRACTS,
)
from app.routers.llm import _approval_replay_frames, _approval_sessions

ROOT = Path(__file__).resolve().parents[3]
CONTRACT_TS = ROOT / "packages" / "shared" / "src" / "sse" / "contract.ts"
WEB_SEND = ROOT / "apps" / "web" / "src" / "hooks" / "use-chat" / "send-message.ts"
RN_SCREEN = ROOT / "apps" / "mobile-rn" / "src" / "screens" / "ChatScreen.tsx"
MINIAPP_CHAT = ROOT / "apps" / "miniapp-taro" / "src" / "pkg-ai" / "ai" / "chat.tsx"
EXTENSION_CHAT = (
    ROOT / "apps" / "extension" / "entrypoints" / "sidepanel" / "pages" / "ChatPage.tsx"
)

_SESSION = "d07v-sess-1"
_OWNER = "user-A"
_OUTSIDER = "user-B"
_EXPIRED = "appr_d07v000001"
_PENDING = "appr_d07v000002"


def _entry(**overrides: object) -> dict[str, object]:
    entry: dict[str, object] = {
        "event": asyncio.Event(),
        "decision": None,
        "scope": None,
        "reason": None,
        "argv": ["ls"],
        "tool_name": "run_command",
        "net_fact": None,
        "tool_call_id": "call-1",
        "args_preview": '{"argv":["ls"]}',
        "danger_level": "high",
        "owner_user_id": _OWNER,
        "created_at": datetime.now(UTC).isoformat(),
    }
    entry.update(overrides)
    return entry


@pytest.fixture(autouse=True)
def _clean() -> object:
    clear_approval_expiry()
    _approval_sessions.pop(_SESSION, None)
    yield
    clear_approval_expiry()
    _approval_sessions.pop(_SESSION, None)


def _frames(owner: str | None = _OWNER) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for frame in _approval_replay_frames(_SESSION, owner):
        assert frame.startswith("event: tool-approval\ndata: "), frame[:40]
        out.append(json.loads(frame.split("data: ", 1)[1].strip()))
    return out


# ── ① 正向:失效条目在重连流里成为一帧可读留痕 ───────────────────────────────


def test_expired_approval_is_visible_on_reconnect() -> None:
    record_approval_expiry(_SESSION, _EXPIRED, _entry(), reason="stream_closed")
    frames = _frames()
    assert len(frames) == 1, f"失效条目没有变成可见帧: {frames}"
    frame = frames[0]
    assert frame["type"] == "tool-approval"
    assert frame[SSE_APPROVAL_EXPIRED_PAYLOAD_KEY] is True
    assert frame[SSE_APPROVAL_EXPIRED_REASON_PAYLOAD_KEY] == "stream_closed"
    assert frame["approval_id"] == _EXPIRED
    assert frame["tool_name"] == "run_command"
    assert frame["session_id"] == _SESSION
    assert "replay" not in frame, "失效留痕帧带 replay 会让端上走弹窗分支"


def test_pending_replay_follows_the_expired_notice() -> None:
    """同一重连里:失效的**先**告知,仍待决的**后**弹窗(顺序即语义)。"""
    record_approval_expiry(_SESSION, _EXPIRED, _entry(), reason="cancelled")
    pending = _entry()
    _approval_sessions[_SESSION] = {_PENDING: pending}

    frames = _frames()
    assert [f["approval_id"] for f in frames] == [_EXPIRED, _PENDING]
    assert frames[0].get(SSE_APPROVAL_EXPIRED_PAYLOAD_KEY) is True
    assert frames[1].get("replay") is True
    assert pending["decision"] is None and not pending["event"].is_set(), "重放不许替用户答应"


# ── ② 反向:没有失效 / 不是本人 ⇒ 一帧都不许有 ───────────────────────────────


def test_no_visible_frame_without_a_ledger_record() -> None:
    assert _frames() == []


@pytest.mark.parametrize("caller", [_OUTSIDER, None])
def test_other_owner_never_sees_the_expired_frame(caller: str | None) -> None:
    record_approval_expiry(_SESSION, _EXPIRED, _entry(), reason="timeout")
    assert _approval_replay_frames(_SESSION, caller) == [], "属主隔离被穿透"


# ── ③ 幂等:重连 N 次同一集合,账本只读不出账 ────────────────────────────────


def test_expired_frames_are_idempotent_and_readonly() -> None:
    record_approval_expiry(_SESSION, _EXPIRED, _entry(), reason="stream_closed")
    rounds = [_frames() for _ in range(3)]
    assert rounds[0] == rounds[1] == rounds[2]
    assert approval_expiry_size() == 1, "取帧把账本改大了(只读投递被破坏)"


# ── ④ 契约单源:可选键同值 + 不进必填清单 ──────────────────────────────────


def test_contract_keys_match_the_ts_single_source() -> None:
    ts = CONTRACT_TS.read_text(encoding="utf-8")
    assert (
        f"export const SSE_APPROVAL_EXPIRED_PAYLOAD_KEY = '{SSE_APPROVAL_EXPIRED_PAYLOAD_KEY}'"
        in ts
    ), "Python 与 shared 的失效标记键名分叉"
    assert (
        f"export const SSE_APPROVAL_EXPIRED_REASON_PAYLOAD_KEY = "
        f"'{SSE_APPROVAL_EXPIRED_REASON_PAYLOAD_KEY}'" in ts
    ), "Python 与 shared 的失效原因键名分叉"


def test_optional_keys_are_not_in_required_payload_fields() -> None:
    contract = next(c for c in SSE_EVENT_CONTRACTS if c.name == "tool-approval")
    assert SSE_APPROVAL_EXPIRED_PAYLOAD_KEY not in contract.payload_fields
    assert SSE_APPROVAL_EXPIRED_REASON_PAYLOAD_KEY not in contract.payload_fields


# ── ⑤ 三端接线锁:解析层递出后,端上必须真的分流(不许再静默) ─────────────────


def test_all_clients_branch_on_expired_before_any_dialog_enqueue() -> None:
    """web / RN / 小程序 / extension 四处消费面同批分流;desktop 复用 web(无独立审批面)。"""
    for path, branch in (
        (WEB_SEND, "if (event.expired)"),
        (RN_SCREEN, "if (event.expired)"),
        (MINIAPP_CHAT, "if (evt.expired)"),
        (EXTENSION_CHAT, "if (event.expired)"),
    ):
        src = path.read_text(encoding="utf-8", errors="ignore")
        assert branch in src, f"{path.name} 没有 expired 分流 ⇒ 端上仍会把失效帧当审批弹窗"
        assert "approvalExpiredNotice" in src, f"{path.name} 分流没走共享文案键"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

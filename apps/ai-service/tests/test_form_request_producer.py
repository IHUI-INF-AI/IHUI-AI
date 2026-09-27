# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #63 对话流业务表单:**生产者侧**的行为证据(此前只有契约登记与前端解析用例)。

立因:票面要求的是"表单帧真能弹",而仓里当时只有 `contract.ts` 的字段表与
`BusinessFormSection` 的渲染件 —— 没有任何一条用例证明
① 后端真的发得出这一帧、② 发出去的字节形状与**登记的契约**一致、
③ 应答端点不会把"别人的 requestId"结算掉。
只测 ② 会变成"契约与实现互相引用"的闭环,所以本文件的重点在 ① 与 ③。

三条不可让的判据(每条都配反向对照):
- **不发半帧**:未知 kind / 空 fields ⇒ 组帧返回 None。端上解析层对畸形帧是**整帧丢弃且不报错**,
  发出去就等于"服务端以为弹了、界面上什么都没有",比工具当场回一句可自愈的失败更坏。
- **下行 camelCase、上行 snake_case 是两条不同形状**:写错不报错、只静默丢帧,
  所以这里按键名集合逐字判,而不是"看起来有 requestId 就行"。
- **越权与不存在逐字段同形,且绝不 `Event.set()`**:AGENTS §5「已登录不等于可以动这条数据」
  的表单版。只断言"回包是拒绝"会放过"先把别人的待决项结算掉、再回一句拒绝"这种写法 ——
  因此每个失败分支都额外断言 **Event 仍未置位 + 待决项仍在册**。
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core.sse_contract import SSE_EVENT_CONTRACTS, SSE_EVENTS
from app.routers import llm as llm_mod
from app.services.mcp_server import (
    BUSINESS_FORM_KINDS,
    build_form_request_frame,
    business_form_wire_fields,
)

_FORM_EVENT = "form_request"
_OWNER_A = "11111111-1111-1111-1111-111111111111"
_OWNER_B = "22222222-2222-2222-2222-222222222222"


def _contract_fields(event: str) -> tuple[str, ...]:
    for c in SSE_EVENT_CONTRACTS:
        if c.name == event:
            assert c.payload_fields, f"{event} 的契约字段清单为空 ⇒ 本判据无从成立(不得当成通过)"
            return c.payload_fields
    raise AssertionError(f"契约清单里没有 {event} ⇒ 判据输入取不到,不得当成通过")


def _a_real_kind() -> str:
    assert BUSINESS_FORM_KINDS, "表单种类清单为空 ⇒ 判据无从成立(不得静默跳过)"
    return sorted(BUSINESS_FORM_KINDS)[0]


def _pending(session_id: str, request_id: str, *, owner: str | None) -> asyncio.Event:
    ev = asyncio.Event()
    llm_mod._form_sessions.setdefault(session_id, {})[request_id] = {
        "event": ev,
        "action": None,
        "values": None,
        "reject_reason": None,
        "user_id": owner,
        "kind": _a_real_kind(),
    }
    return ev


@pytest.fixture()
def client() -> TestClient:
    """把 llm 路由挂到独立 app,并用中间件把身份落进 request.state。

    刻意**不**依赖 app.main 全量启动:真实中间件要验 JWT,而本文件判的是
    "端点拿到的主体与待决项记录的主体不一致时做了什么",与令牌怎么来无关。
    """
    app = FastAPI()
    app.include_router(llm_mod.router)

    @app.middleware("http")
    async def _inject_identity(request: Request, call_next):  # type: ignore[no-untyped-def]
        uid = request.headers.get("x-test-uid")
        if uid:
            request.state.user_id = uid
        return await call_next(request)

    with TestClient(app) as c:
        yield c


def _post(client: TestClient, session_id: str, body: dict, *, uid: str | None = None):
    headers = {"x-test-uid": uid} if uid else {}
    return client.post(f"/llm/complete/stream/{session_id}/form-response", json=body, headers=headers)


# ----------------------------------------------------------------------- 组帧侧


def test_unknown_kind_emits_no_half_frame() -> None:
    got = build_form_request_frame(
        request_id="frm_x", kind="definitely_not_a_kind", session_id="s1", message_id=None
    )
    assert got is None, "未知 kind 仍组帧 ⇒ 端上整帧丢弃而服务端以为弹了"


def test_kind_with_empty_field_table_emits_no_frame() -> None:
    # 阳性对照:确实存在"种类合法但字段表为空"的形态时这条才有牙;一个都没有则本条
    # 与上一条同型(仍要求 None 成立),而不是悄悄跳过。
    checked = 0
    for kind in sorted(BUSINESS_FORM_KINDS):
        if business_form_wire_fields(kind):
            continue
        checked += 1
        assert (
            build_form_request_frame(
                request_id="frm_y", kind=kind, session_id="s1", message_id=None
            )
            is None
        ), f"kind={kind} 字段表为空却仍发帧"
    if checked == 0:
        # 没有这种形态可测 ⇒ 至少把"判据不是恒真"写清:随便挑一个合法 kind 组帧必须**非** None。
        assert (
            build_form_request_frame(
                request_id="frm_y", kind=_a_real_kind(), session_id="s1", message_id=None
            )
            is not None
        ), "合法 kind 也组不出帧 ⇒ 上面那条断言是恒真的假判据"


def test_downlink_frame_keys_equal_the_registered_contract() -> None:
    declared = _contract_fields(_FORM_EVENT)
    kind = _a_real_kind()
    without_msg = build_form_request_frame(
        request_id="frm_a", kind=kind, session_id="s", message_id=None
    )
    with_msg = build_form_request_frame(
        request_id="frm_a", kind=kind, session_id="s", message_id="m-7"
    )
    assert without_msg is not None and with_msg is not None
    # messageId 是可选键:契约声明而帧里没有 ⇒ 允许;反向(帧里有而契约没声明)必红 ——
    # 那才是"实现与契约分叉"的方向。
    assert set(without_msg) <= set(declared), f"帧里出现契约未声明的键:{set(without_msg) - set(declared)}"
    assert set(with_msg) == set(declared), f"带 messageId 时帧键集与契约不等:{set(with_msg) ^ set(declared)}"
    for snake in ("request_id", "session_id", "message_id"):
        assert snake not in with_msg, f"下行帧混入 snake_case 键 {snake} ⇒ 解析层静默丢帧"
    assert with_msg["type"] == _FORM_EVENT
    assert with_msg["actions"] == ["approve", "reject"], "动作必须成对(只给 approve 等于替用户决定)"


def test_form_request_is_registered_on_both_python_sides() -> None:
    assert _FORM_EVENT in SSE_EVENTS
    assert _FORM_EVENT in {c.name for c in SSE_EVENT_CONTRACTS}


# ----------------------------------------------------------------------- 应答端点


def test_missing_and_foreign_requests_are_indistinguishable(client: TestClient) -> None:
    sid, rid = "s-1", "frm_1"
    ev = _pending(sid, rid, owner=_OWNER_A)
    try:
        missing = _post(client, sid, {"request_id": "frm_nope", "action": "approve", "values": {}})
        foreign = _post(
            client, sid, {"request_id": rid, "action": "approve", "values": {"a": 1}}, uid=_OWNER_B
        )
        assert missing.status_code == foreign.status_code
        assert missing.json()["ok"] is False and foreign.json()["ok"] is False
        assert missing.json()["error"] == foreign.json()["error"], (
            "两种情形不同形 ⇒ 本端点成了 requestId 存在性探针"
        )
        # 归属判据的核心:**没结算**别人持有的待决项。
        assert not ev.is_set(), "越权请求把别人持有的待决项置位了"
        assert llm_mod._form_pending_entry(sid, rid) is not None, "越权请求消耗掉了别人的待决项"
    finally:
        llm_mod._form_sessions.pop(sid, None)


def test_approve_without_values_does_not_settle(client: TestClient) -> None:
    sid, rid = "s-2", "frm_2"
    ev = _pending(sid, rid, owner=_OWNER_A)
    try:
        r = _post(client, sid, {"request_id": rid, "action": "approve"}, uid=_OWNER_A)
        assert r.status_code == 200
        assert r.json()["ok"] is False, "approve 缺 values 却结算成功 ⇒ 模型会以为用户交了白卷"
        assert not ev.is_set()
    finally:
        llm_mod._form_sessions.pop(sid, None)


def test_owner_match_approve_really_wakes_the_waiter(client: TestClient) -> None:
    sid, rid = "s-3", "frm_3"
    ev = _pending(sid, rid, owner=_OWNER_A)
    try:
        r = _post(
            client, sid, {"request_id": rid, "action": "approve", "values": {"title": "T"}}, uid=_OWNER_A
        )
        assert r.json() == {"ok": True, "accepted": True, "requestId": rid, "action": "approve"}
        assert ev.is_set(), "合法应答没唤醒等待方 ⇒ 工具循环会一直等到超时"
        assert llm_mod._form_sessions.get(sid, {}).get(rid, {}).get("values") == {"title": "T"}
    finally:
        llm_mod._form_sessions.pop(sid, None)


def test_reject_drops_values_entirely(client: TestClient) -> None:
    sid, rid = "s-4", "frm_4"
    ev = _pending(sid, rid, owner=_OWNER_A)
    try:
        r = _post(
            client,
            sid,
            {"request_id": rid, "action": "reject", "values": {"title": "T"}, "reject_reason": "不想"},
            uid=_OWNER_A,
        )
        assert r.json()["ok"] is True and ev.is_set()
        entry = llm_mod._form_sessions.get(sid, {}).get(rid) or {}
        assert entry.get("values") is None, "拒绝却留着 values ⇒ 下游可能照它建一条空草稿"
        assert entry.get("reject_reason") == "不想"
    finally:
        llm_mod._form_sessions.pop(sid, None)


def test_unauthored_pending_entry_is_not_settled_by_identified_caller(client: TestClient) -> None:
    """发帧时没有主体(开发态/进程内)而应答方带身份 ⇒ 两条不同身份通道的偶然相遇。"""
    sid, rid = "s-5", "frm_5"
    ev = _pending(sid, rid, owner=None)
    try:
        r = _post(client, sid, {"request_id": rid, "action": "approve", "values": {"a": 1}}, uid=_OWNER_B)
        assert r.json()["ok"] is False and not ev.is_set()
    finally:
        llm_mod._form_sessions.pop(sid, None)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

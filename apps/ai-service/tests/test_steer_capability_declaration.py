# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""插话(steer)能力声明契约测试(2026-10-15 立)。

钉住三格,每格对应一个真会腐烂的方向:

  F1 键名与承载帧:`capabilities` / `interjection` 是**线上字**。改名而测试不同步
     就是一次静默断链(端上读老键、服务端写新键,两边都不报错)。承载帧必须是
     `done` —— 主聊天流里 injection_applied / goal_updated / compaction 三者全是
     条件产出,只有 done 是"每轮恒在且恰好一次"的收口帧。
  F2 判定同源:能力值不是常量,必须与 steer 端点自己的闸门
     (`post_steer_message` 里 `_steer_sessions.get(...) is None ⇒ 404`)读同一张表。
     "声明 true 而上行 404" 是最坏的一型 —— 用户点了插话、界面给了 ACK、服务端
     根本没收到。所以这里不复读判定式,而是拿端点的真实状态码反证。
  F3 帧上真带:契约条目登记了字段、函数也算得出值,但组装点忘了塞 ⇒ 端上照样
     读不到。末条用例走 `_sse()` 序列化后回读线上 JSON,并顺手开着契约诊断证明
     done 帧不再因缺 capabilities 告警。

与 tests/test_steer_endpoint.py 同族:那边测入队状态机,这边测能力声明通道。
"""

from __future__ import annotations

import json
import warnings

import pytest

from app.core.sse_contract import (
    SSE_CAPABILITIES_FRAME,
    SSE_CAPABILITIES_PAYLOAD_KEY,
    SSE_CAPABILITY_INTERJECTION_KEY,
    SSE_EVENT_CONTRACTS,
)
from app.routers.llm import (
    _capabilities_payload,
    _interjection_capable,
    _sse,
    _steer_sessions,
)

BASE = "/api/llm/complete/stream"


@pytest.fixture(autouse=True)
def _clean_steer_sessions():
    """与 test_steer_endpoint.py 同款隔离:`_steer_sessions` 是模块级全局 dict。"""
    _steer_sessions.clear()
    yield
    _steer_sessions.clear()


def _done_contract():
    return next(c for c in SSE_EVENT_CONTRACTS if c.name == SSE_CAPABILITIES_FRAME)


# ── F1 键名与承载帧 ──────────────────────────────────────────────────────────


def test_capabilities_keys_are_wire_literals():
    """键名是线上字(camelCase 单键),改动必须同时改端上读数与契约注释。"""
    assert SSE_CAPABILITIES_PAYLOAD_KEY == "capabilities"
    assert SSE_CAPABILITY_INTERJECTION_KEY == "interjection"


def test_capabilities_lands_on_done_frame():
    """承载帧是 `done`,且它真在 done 的契约条目里登记了(两处必须同步改)。"""
    assert SSE_CAPABILITIES_FRAME == "done"
    assert SSE_CAPABILITIES_PAYLOAD_KEY in _done_contract().payload_fields


# ── F2 判定同源 ──────────────────────────────────────────────────────────────


def test_interjection_capable_is_false_without_registered_bucket():
    """未登记 steer 桶(None / 空串 / 未注册 / 已被收口摘除)⇒ False。"""
    assert _interjection_capable(None) is False
    assert _interjection_capable("") is False
    assert _interjection_capable("sess_unregistered") is False


def test_interjection_capable_is_true_once_registered():
    """gen() 在流首登记了桶 ⇒ True(与该 session_id 的 steer 上行会给 200 同义)。"""
    _steer_sessions["sess_live"] = []
    assert _interjection_capable("sess_live") is True


async def test_capability_matches_steer_endpoint_gate(client):
    """判定与端点闸门同源 —— 拿真实状态码反证,而不是复述一遍判定式。

    这一条就是"不许硬编码 true"的尺子:任何让 `_interjection_capable` 返回常真的
    改法,都会撞上"声明 true 而端点回 404"或"声明 false 而端点回 200"中的一处。
    """
    _steer_sessions["sess_live"] = []
    declared_live = _interjection_capable("sess_live")
    resp = await client.post(f"{BASE}/sess_live/steer", json={"text": "换个思路"})
    assert declared_live is True
    assert resp.status_code == 200

    declared_dead = _interjection_capable("sess_dead")
    resp2 = await client.post(f"{BASE}/sess_dead/steer", json={"text": "换个思路"})
    assert declared_dead is False
    assert resp2.status_code == 404


# ── F3 帧上真带 ──────────────────────────────────────────────────────────────


def test_capabilities_payload_shape():
    """载荷只有已支持的能力键:不支持的能力不写 false 占位(不造值冒充事实)。"""
    _steer_sessions["sess_live"] = []
    assert _capabilities_payload("sess_live") == {"interjection": True}
    assert _capabilities_payload("sess_nope") == {"interjection": False}
    assert all(isinstance(v, bool) for v in _capabilities_payload("sess_live").values())


def test_done_frame_carries_capabilities_on_the_wire(monkeypatch):
    """走 `_sse()` 序列化后回读:capabilities 真在 data 行里,不是只活在契约注释里。"""
    monkeypatch.setenv("SSE_CONTRACT_VALIDATE_ENABLED", "true")
    _steer_sessions["sess_live"] = []
    payload = {
        "type": "done",
        "model": "m",
        "usage": {},
        "stub": False,
        "capabilities": _capabilities_payload("sess_live"),
    }
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        frame = _sse("done", payload)
    data_line = [ln for ln in frame.splitlines() if ln.startswith("data: ")][0]
    wire = json.loads(data_line[len("data: ") :])
    assert wire["capabilities"] == {"interjection": True}
    # 顺带钉住:开了契约诊断后 done 帧不再因缺 capabilities 告警
    assert [str(w.message) for w in caught if "缺少契约字段" in str(w.message)] == []

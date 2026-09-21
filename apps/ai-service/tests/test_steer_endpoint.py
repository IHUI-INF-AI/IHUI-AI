# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Steer(中途引导,2026-09-19 立)端点测试:POST /api/llm/complete/stream/{session_id}/steer
#
# 覆盖状态机全分支:
# - 422:body 缺 text / text 为空白
# - 404:session_id 未注册(流不存在或已结束)
# - 200:入队成功,queued 计数随追加递增
# - 429:队列满(_STEER_QUEUE_LIMIT=8)
# - 截断:超 4000 字符的单条文本截断后入队(防撑爆上下文)
#
# 注入侧(tool loop 每轮 drain → messages + event: steer)依赖完整 LLM 调用链,
# 由 test_sse_contract.py 的契约成员断言(SSE_STEER 已注册)+ 上游网关测试覆盖。

import pytest

from app.routers.llm import _STEER_QUEUE_LIMIT, _steer_sessions

BASE = "/api/llm/complete/stream"


@pytest.fixture(autouse=True)
def _clean_steer_sessions():
    """每个测试前后清空进程内 steer 队列,防跨测试污染(队列是模块级全局 dict)。"""
    _steer_sessions.clear()
    yield
    _steer_sessions.clear()


async def test_steer_empty_text_returns_422(client):
    """text 缺失/为空白:422,不入队。"""
    _steer_sessions["sess_422"] = []
    resp = await client.post(f"{BASE}/sess_422/steer", json={})
    assert resp.status_code == 422
    resp2 = await client.post(f"{BASE}/sess_422/steer", json={"text": "   "})
    assert resp2.status_code == 422
    assert _steer_sessions["sess_422"] == []


async def test_steer_unknown_session_returns_404(client):
    """session_id 未注册(流不存在或已结束):404。"""
    resp = await client.post(f"{BASE}/no_such_session/steer", json={"text": "引导"})
    assert resp.status_code == 404


async def test_steer_enqueues_and_counts(client):
    """流活跃(session_id 已注册):200,queued 随追加递增。"""
    sid = "sess_ok"
    _steer_sessions[sid] = []
    r1 = await client.post(f"{BASE}/{sid}/steer", json={"text": "换一个思路"})
    assert r1.status_code == 200
    assert r1.json()["ok"] is True
    assert r1.json()["queued"] == 1
    r2 = await client.post(f"{BASE}/{sid}/steer", json={"text": "再加一条"})
    assert r2.status_code == 200
    assert r2.json()["queued"] == 2
    # 队列内容:text 原样,queuedAt 为 ISO 时间戳
    assert _steer_sessions[sid][0]["text"] == "换一个思路"
    assert "queuedAt" in _steer_sessions[sid][0]


async def test_steer_queue_full_returns_429(client):
    """队列达上限(_STEER_QUEUE_LIMIT):429,拒绝入队不覆盖。"""
    sid = "sess_full"
    _steer_sessions[sid] = [{"text": f"msg{i}", "queuedAt": "t"} for i in range(_STEER_QUEUE_LIMIT)]
    resp = await client.post(f"{BASE}/{sid}/steer", json={"text": "超限引导"})
    assert resp.status_code == 429
    # 队列未被改动(仍为原 8 条)
    assert len(_steer_sessions[sid]) == _STEER_QUEUE_LIMIT
    assert all(item["text"] != "超限引导" for item in _steer_sessions[sid])


async def test_steer_truncates_long_text(client):
    """超长文本(>4000 字符)截断后入队,防撑爆上下文。"""
    sid = "sess_trunc"
    _steer_sessions[sid] = []
    long_text = "长" * 4500
    resp = await client.post(f"{BASE}/{sid}/steer", json={"text": long_text})
    assert resp.status_code == 200
    assert len(_steer_sessions[sid][0]["text"]) == 4000
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

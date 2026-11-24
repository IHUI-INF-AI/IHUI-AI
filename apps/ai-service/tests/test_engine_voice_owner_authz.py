# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""语音这条**第二通道**的属主对账(G-371 同族,2026-09-29 立)。

判的是"同一身份只许有一条绑主体路径"——AGENTS §5 把"身份只能从承载层显式入参进来"写成了规矩,
而 `routers/engine.py` 的 `_bind_principal` 覆盖了它自己的四个入口(HTTP 单发 / 批量 / SSE / WS),
`routers/engine_voice.py` 是**第五个承载**:它自己合成 JSON-RPC 报文发给同一个 ENGINE,
收口前那些 `params` 里**根本没有 `userId`**。后果不是"少一个字段":

- 引擎侧 `_connection_principal(params)` 取不到主体 ⇒ 属主谓词按"承载层没给身份 ⇒ 维持
  改动前行为"放过 ⇒ 任何已登录用户可以用**别人的 threadId** 建语音会话,并在他人线程上
  `thread.prompt`;
- 语音会话表(`sid → 线程使用权`)自身也没有属主,拿到 sid(12 位 hex,会进日志与客户端状态)
  的人就能在别人的线程上说话。

三层判据:
1. **绑定**:语音发出的每一条合成报文都带 `params.userId` / `params.roleId`,且值来自承载层
   (这里由测试中间件注入的 `state.user_id` 模拟令牌主体),不是请求体自报值;
2. **归属**:跨属主的 sid 一律 404,且与"根本没这个 sid"**逐字同形**(端点不得变成 sid 预言机);
3. **上下文**:无参回调 `tool_lister` 读到的主体 = 本次请求主体(漏绑会让语音链的工具清单
   只剩部署级 server,而账面全绿 —— ContextVar 最常见的错不是传错,是没人绑)。

全程假 ENGINE + 桩 STT/TTS,不发真实网络请求、不连数据库。
"""

from __future__ import annotations

import base64
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

import app.routers.engine_voice as engine_voice
from app.services.mcp_client import current_mcp_principal

USER_A = "voice-user-a"
USER_B = "voice-user-b"


class _FakeEngine:
    """脚本化引擎:记录每一趟收到的报文,并记下当时上下文里的主体。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.principals_seen: list[str] = []
        self.threads: dict[str, str] = {"thr_a": USER_A, "thr_b": USER_B}
        self.prompt_response: dict[str, Any] = {
            "result": {"finalResponse": "好的。", "usage": {"totalTokens": 3}}
        }

    async def handle_message(self, payload: dict[str, Any], emit: Any = None) -> dict[str, Any]:
        self.calls.append(payload)
        # 作用域必须已经绑上本次请求的主体 —— 这一条是"没人绑"那型故障的唯一现场证据
        self.principals_seen.append(current_mcp_principal())
        method = payload.get("method")
        params = payload.get("params") or {}
        principal = params.get("userId")
        if method == "thread.start":
            new_id = f"thr_by_{principal}"
            self.threads[new_id] = str(principal)
            return {"result": {"threadId": new_id}}
        if method == "thread.state":
            owner = self.threads.get(str(params.get("threadId")))
            if owner is None or (principal and owner != principal):
                # 与真实引擎同形:不属于你 ⇒ 与不存在同一句(引擎侧 _require_thread 的规矩)
                return {"error": {"code": -32004, "message": "线程不存在"}}
            return {"result": {"status": "idle"}}
        if method == "thread.prompt":
            owner = self.threads.get(str(params.get("threadId")))
            if owner is None or (principal and owner != principal):
                return {"error": {"code": -32004, "message": "线程不存在"}}
            return dict(self.prompt_response)
        return {"error": {"code": -32601, "message": f"未知方法 {method}"}}


async def _fake_transcribe(data: bytes, filename: str, language: str | None) -> str:
    return "帮我查一下天气"


async def _fake_synthesize(text: str, voice: str) -> bytes:
    return b"mp3-fake"


@pytest.fixture()
def harness(monkeypatch: pytest.MonkeyPatch) -> tuple[TestClient, _FakeEngine]:
    """按 header 注入主体的客户端:`X-Test-Principal` 模拟"中间件已从令牌解出主体"。

    刻意走 `state.user_id`(生产里由 JWT 中间件写),而不是往请求体里塞 userId —— 后者正是
    本票要否证的那种"客户端自报身份"。
    """
    fake = _FakeEngine()
    monkeypatch.setattr(engine_voice, "ENGINE", fake)
    monkeypatch.setattr(engine_voice, "_transcribe_audio", _fake_transcribe, raising=True)
    monkeypatch.setattr(engine_voice, "_synthesize_speech", _fake_synthesize, raising=True)

    app = FastAPI()

    @app.middleware("http")
    async def _inject(request: Request, call_next):  # type: ignore[no-untyped-def]
        principal = request.headers.get("X-Test-Principal")
        if principal:
            request.state.user_id = principal
            request.state.role_id = 0
        return await call_next(request)

    app.include_router(engine_voice.router, prefix="/api")
    engine_voice._sessions.clear()
    return TestClient(app), fake


def _as(user: str) -> dict[str, str]:
    return {"X-Test-Principal": user}


def _same_detail(a: Any, b: Any, sid_a: str, sid_b: str) -> bool:
    """两句 404 的**模板**是否同形(把调用方自己报上来的 sid 归一掉再比)。

    口径与 `tests/test_mcp_external_owner_authz.py` 同源:判"同形"判的是状态码 + 字段集 +
    文案模板,而不是响应体逐字节等 —— 回声里带着调用方自己给的那个 id 不构成泄露,
    把它洗成同一个占位才是本判据要看的东西。
    """
    return a.get("detail", "").replace(sid_a, "<sid>") == b.get("detail", "").replace(
        sid_b, "<sid>"
    )


# =============================================================================
# 第 1 层:绑定 —— 语音发出去的每条报文都带承载层主体
# =============================================================================


def test_every_engine_call_carries_the_carrier_principal(harness) -> None:
    tc, fake = harness

    created = tc.post("/api/engine/voice/sessions", json={}, headers=_as(USER_A))
    assert created.status_code == 200, created.text
    sid = created.json()["sessionId"]

    turn = tc.post(
        f"/api/engine/voice/sessions/{sid}/turn",
        files={"file": ("a.wav", b"RIFFfake", "audio/wav")},
        headers=_as(USER_A),
    )
    assert turn.status_code == 200, turn.text

    methods = [c.get("method") for c in fake.calls]
    assert "thread.start" in methods and "thread.prompt" in methods, methods
    for call in fake.calls:
        params = call.get("params") or {}
        assert params.get("userId") == USER_A, f"报文没带主体:{call}"
        # 角色同样由承载层注入,缺省 0 = fail-closed,不得由客户端填
        assert params.get("roleId") == 0, f"报文没带角色:{call}"
    # 第 3 层:作用域与主体同值(不是空串)
    assert set(fake.principals_seen) == {USER_A}, fake.principals_seen


# =============================================================================
# 第 2 层:归属 —— 跨主体一律不可见,且与"没这条"同形
# =============================================================================


def test_foreign_sid_is_404_identical_to_missing_sid(harness) -> None:
    """A 的会话,B 拿同一个 sid 走三条 {sid} 端点都得 404,且文案**模板**与"根本没这个 sid"相同。

    差异本身会把"这个 sid 存在"变成可枚举信号,而 sid 会进日志与客户端状态。
    """
    tc, _ = harness
    sid = tc.post("/api/engine/voice/sessions", json={}, headers=_as(USER_A)).json()["sessionId"]
    absent = "vse_doesnotexist"
    missing = tc.get(f"/api/engine/voice/sessions/{absent}", headers=_as(USER_B))
    assert missing.status_code == 404

    for call in (
        lambda: tc.get(f"/api/engine/voice/sessions/{sid}", headers=_as(USER_B)),
        lambda: tc.post(
            f"/api/engine/voice/sessions/{sid}/turn",
            files={"file": ("a.wav", b"RIFFfake", "audio/wav")},
            headers=_as(USER_B),
        ),
        lambda: tc.delete(f"/api/engine/voice/sessions/{sid}", headers=_as(USER_B)),
    ):
        resp = call()
        assert resp.status_code == 404, resp.text
        assert _same_detail(resp.json(), missing.json(), sid, absent), (
            f"跨主体与「不存在」不同形:sid 端点成了存在性预言机\n{resp.json()}\n{missing.json()}"
        )

    # 反向对照:A 自己三条都通(否则本判据可能只是把功能改坏了)
    assert tc.get(f"/api/engine/voice/sessions/{sid}", headers=_as(USER_A)).status_code == 200


def test_foreign_thread_id_cannot_be_bound(harness) -> None:
    """B 不能用 A 的 threadId 建语音会话,而且失败形态与"线程不存在"同句。"""
    tc, fake = harness
    before = len(fake.calls)

    resp = tc.post(
        "/api/engine/voice/sessions", json={"threadId": "thr_a"}, headers=_as(USER_B)
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"].startswith("线程不存在")
    sent = fake.calls[before]
    assert (sent.get("params") or {}).get("userId") == USER_B, (
        "去问引擎那一条没带主体 ⇒ 引擎侧属主对账无从对账"
    )
    # 没建成会话:表里一条都没有(失败不落半只会话)
    assert engine_voice._sessions == {}

    ok = tc.post(
        "/api/engine/voice/sessions", json={"threadId": "thr_a"}, headers=_as(USER_A)
    )
    assert ok.status_code == 200, ok.text


def test_new_thread_is_created_under_the_caller_principal(harness) -> None:
    """自动新建线程那一支:线程 id 由假引擎按"收到的主体"生成 ⇒ 证明主体真到了引擎。"""
    tc, fake = harness
    sid = tc.post("/api/engine/voice/sessions", json={}, headers=_as(USER_B)).json()["sessionId"]
    session = engine_voice._sessions[sid]
    assert session["threadId"] == f"thr_by_{USER_B}", session
    assert session["owner_user_id"] == USER_B


def test_prompt_reaches_the_thread_only_for_its_owner(harness) -> None:
    """正向对照:属主走完整回合(音频 → STT → prompt → TTS)仍然通。

    只留越权用例的话,这道门可能只是把功能改坏了 —— 与本仓"越权必配正向对照"同一条规矩。
    """
    tc, fake = harness
    sid = tc.post("/api/engine/voice/sessions", json={}, headers=_as(USER_A)).json()["sessionId"]
    fake.calls.clear()

    resp = tc.post(
        f"/api/engine/voice/sessions/{sid}/turn",
        data={"language": "zh"},
        files={"file": ("a.wav", base64.b64decode("UklGRmZmZg=="), "audio/wav")},
        headers=_as(USER_A),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["responseText"] == "好的。"
    prompt_calls = [c for c in fake.calls if c.get("method") == "thread.prompt"]
    assert prompt_calls and prompt_calls[0]["params"]["userId"] == USER_A


def test_legacy_ownerless_session_is_not_usable_by_anyone(harness) -> None:
    """升级前建的会话(没有属主键)按"不是你的"处理 —— 登记这条行为变化,不许被读成许可。

    会话表是进程内内存态(TTL 1h、重启即清),所以这里的代价是"客户端重建一次会话",
    而不是"谁的存量数据回不来";反过来给无主会话开口子,等于把"没人认领就能被任何人用"
    永久写进这条链。
    """
    tc, _ = harness
    engine_voice._sessions["vse_legacy"] = {
        "id": "vse_legacy",
        "threadId": "thr_a",
        "stt_language": None,
        "tts_voice": "x",
        "turns": 0,
        "created_at": 0.0,
        "last_active": 0.0,
    }
    for user in (USER_A, USER_B):
        assert tc.get("/api/engine/voice/sessions/vse_legacy", headers=_as(user)).status_code == 404
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

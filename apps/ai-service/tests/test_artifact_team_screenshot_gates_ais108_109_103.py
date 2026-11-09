# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-108 / AIS-109 / AIS-103 三条一组:跨会话读、跨主体看板、probe 重定向 SSRF。

缺陷(现读):
  · AIS-108 `summarize_artifacts` 直接信任模型自报的 `conversation_id` —— 任意会话
    都能读别人的 plans/sources/artifacts/tool_calls(提示注入还能指定受害者 id);
  · AIS-109 `team_task` 看板只用模型自报的 `team_id` 分键,`default` 就是全平台共用
    一张表 —— 他人可枚举/认领/篡改别人的任务;
  · AIS-103 `_probe_can_embed_sync` 只做首跳 SSRF 校验,随后
    `context.request.get(url)` 未禁重定向 —— 公网页 302 → 169.254/内网直达。

修法:
  · AIS-108 有宿主 `__session_id` 时一律以它为准,自报值与之一致才放行,不一致
    直接 `CONVERSATION_MISMATCH` 且**零读取**;
  · AIS-109 看板键改为 `owner::team_id`(owner 取宿主注入的 `__user_id`,展示仍用 team_id);
  · AIS-103 `max_redirects=0`,每一跳都先过同一把 SSRF 尺,最多 6 跳。

用例:
  AIS-108:跨会话被拒且 `_load_artifacts` 零调用;宿主会话为准;无宿主会话保持旧行为。
  AIS-109:同 team_id 下两个主体互不可见/不可篡改;同主体仍可见。
  AIS-103:302 → 169.254 只发 1 次请求且第二跳零请求;正向 200 正常;
          跳数超限拒绝。
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

import pytest

from app.services import mcp_server, screenshot_service


# ---------------------------------------------------------------------------
# AIS-108:summarize_artifacts 的会话归属
# ---------------------------------------------------------------------------


def _install_artifacts(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """把 `_load_artifacts` 换成记录器,返回被读过的 conversation_id 列表。"""
    calls: list[str] = []

    def _fake_load(conversation_id: str) -> dict[str, Any]:
        calls.append(conversation_id)
        return {
            "plans": [{"id": "p1"}],
            "sources": [{"url": "https://victim.example/x"}],
            "artifacts": [{"name": "a.py"}],
            "tool_calls": [{"tool": "read_file"}],
        }

    monkeypatch.setattr(mcp_server, "_load_artifacts", _fake_load)
    return calls


async def test_summarize_artifacts_cross_session_is_denied_without_read(
    monkeypatch: pytest.MonkeyPatch,
):
    """宿主会话 A + 自报会话 B ⇒ 拒绝,且不读 B 的 artifacts。"""
    calls = _install_artifacts(monkeypatch)
    out = await mcp_server._tool_summarize_artifacts(
        {"__session_id": "sess-A", "conversation_id": "sess-B"}
    )
    assert out["ok"] is False
    assert out["errorCode"] == "CONVERSATION_MISMATCH"
    assert out["plans"] == [] and out["sources"] == []
    assert calls == [], "被拒的跨会话读取不得触碰 artifacts 存储"


async def test_summarize_artifacts_uses_host_session(
    monkeypatch: pytest.MonkeyPatch,
):
    """只给宿主会话 ⇒ 读的就是宿主会话,模型自报值不能另开一路。"""
    calls = _install_artifacts(monkeypatch)
    out = await mcp_server._tool_summarize_artifacts(
        {"__session_id": "sess-A", "conversation_id": "sess-A"}
    )
    assert out["ok"] is True
    assert out["conversation_id"] == "sess-A"
    assert out["tool_calls_summary"]["total"] == 1
    assert calls == ["sess-A"]


async def test_summarize_artifacts_without_host_session_keeps_legacy(
    monkeypatch: pytest.MonkeyPatch,
):
    """无宿主会话(进程内/开发态)⇒ 回落自报 conversation_id,旧调用方不被改坏。"""
    calls = _install_artifacts(monkeypatch)
    out = await mcp_server._tool_summarize_artifacts({"conversation_id": "sess-C"})
    assert out["ok"] is True
    assert out["conversation_id"] == "sess-C"
    assert calls == ["sess-C"]


# ---------------------------------------------------------------------------
# AIS-109:team_task 看板按宿主主体分区
# ---------------------------------------------------------------------------


def _drop_boards(*owners: str, team_id: str) -> None:
    for owner in owners:
        mcp_server._TEAM_TASK_BOARD.pop(f"{owner}::{team_id}", None)


async def test_team_board_is_namespaced_by_host_subject():
    """A 建的任务 B 看不到,也改不了;B 的看板里没有这条。"""
    team_id = "t-ais109"
    try:
        added = await mcp_server._tool_team_task(
            {"action": "add", "team_id": team_id, "title": "A 的任务",
             "agent_id": "agent-a", "__user_id": "user-a"}
        )
        assert added["ok"] is True
        task_id = added["task"]["id"]

        # 同一主体:可见且仍能认领。
        own = await mcp_server._tool_team_task(
            {"action": "list", "team_id": team_id, "__user_id": "user-a"}
        )
        assert own["total"] == 1

        # 另一主体:整表不可见。
        other = await mcp_server._tool_team_task(
            {"action": "list", "team_id": team_id, "__user_id": "user-b"}
        )
        assert other["total"] == 0
        assert other["tasks"] == []

        # 另一主体:连 task_id 都解析不到 ⇒ 不能认领/篡改。
        hijack = await mcp_server._tool_team_task(
            {"action": "claim", "team_id": team_id, "task_id": task_id,
             "agent_id": "agent-b", "__user_id": "user-b"}
        )
        assert hijack["ok"] is False
        assert hijack["errorCode"] == "TASK_NOT_FOUND"

        hijack_update = await mcp_server._tool_team_task(
            {"action": "update", "team_id": team_id, "task_id": task_id,
             "agent_id": "agent-b", "status": "done", "__user_id": "user-b"}
        )
        assert hijack_update["ok"] is False
        assert hijack_update["errorCode"] == "TASK_NOT_FOUND"

        # A 的条目未被 B 改动。
        after = await mcp_server._tool_team_task(
            {"action": "list", "team_id": team_id, "__user_id": "user-a"}
        )
        assert after["tasks"][0]["status"] == "pending"
        assert after["tasks"][0]["claimed_by"] == ""
    finally:
        _drop_boards("user-a", "user-b", team_id=team_id)


# ---------------------------------------------------------------------------
# AIS-103:probe 探测的重定向链路必须逐跳过 SSRF 尺
# ---------------------------------------------------------------------------


class _StubResponse:
    def __init__(self, status: int, headers: dict[str, str] | None = None) -> None:
        self.status = status
        self.headers = headers or {}


class _StubRequest:
    """假 Playwright APIRequestContext。

    `max_redirects=0`(新码)⇒ 原样返回 3xx;不传(旧码)⇒ 按 Playwright 默认自行跟随。
    """

    def __init__(self, routes: dict[str, tuple[int, dict[str, str]]]) -> None:
        self.routes = routes
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def get(self, url: str, timeout: int | None = None, **kw: Any) -> _StubResponse:
        self.calls.append((url, dict(kw)))
        current = url
        hops = 0
        while True:
            node = self.routes.get(current)
            if node is None:
                raise RuntimeError(f"未登记的 URL: {current}")
            status, headers = node
            if kw.get("max_redirects") == 0:
                return _StubResponse(status, headers)
            location = headers.get("location")
            if 300 <= status < 400 and location:
                current = urljoin(current, location)
                hops += 1
                if hops > 50:
                    raise RuntimeError("redirect too many")
                continue
            return _StubResponse(status, headers)


class _StubContext:
    def __init__(self, request: _StubRequest) -> None:
        self.request = request
        self.closed = False

    def close(self) -> None:
        self.closed = True


class _StubBrowser:
    def __init__(self, context: _StubContext) -> None:
        self._context = context

    def new_context(self) -> _StubContext:
        return self._context


_PRIVATE_PREFIXES = (
    "http://169.254.",
    "http://127.",
    "http://10.",
    "http://192.168.",
    "http://172.16.",
)


def _install_probe(
    monkeypatch: pytest.MonkeyPatch, routes: dict[str, tuple[int, dict[str, str]]]
) -> tuple[_StubRequest, list[str]]:
    request = _StubRequest(routes)
    context = _StubContext(request)
    monkeypatch.setattr(screenshot_service, "_get_browser_sync", lambda: _StubBrowser(context))

    validated: list[str] = []

    def _fake_validate(u: str) -> tuple[bool, str]:
        validated.append(u)
        if u.startswith(_PRIVATE_PREFIXES):
            return False, "private/loopback/link-local"
        return True, ""

    monkeypatch.setattr(screenshot_service, "_validate_url_ssrf", _fake_validate)
    return request, validated


def test_probe_redirect_into_metadata_ip_is_blocked(
    monkeypatch: pytest.MonkeyPatch,
):
    """公网页 302 → 169.254 ⇒ ssrf_blocked,且内网地址一次请求都没发。"""
    start = "http://public.test/start"
    internal = "http://169.254.169.254/latest/meta-data/"
    request, validated = _install_probe(
        monkeypatch,
        {
            start: (302, {"location": internal}),
            internal: (200, {}),
        },
    )
    out = screenshot_service._probe_can_embed_sync(start)

    assert out["can_embed"] is False
    assert out.get("ssrf_blocked") is True
    assert [u for u, _ in request.calls] == [start], "第二跳(内网)不得发出请求"
    assert validated == [start, internal], "每一跳都要过 SSRF 尺"


def test_probe_public_ok_still_embeds(monkeypatch: pytest.MonkeyPatch):
    """正向对照:公网 200 无 XFO ⇒ can_embed=True,不被新逻辑误杀。"""
    url = "http://public.test/ok"
    request, _validated = _install_probe(monkeypatch, {url: (200, {})})
    out = screenshot_service._probe_can_embed_sync(url)

    assert out["can_embed"] is True
    assert len(request.calls) == 1


def test_probe_redirect_chain_over_limit_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
):
    """无限/超长跳转链 ⇒ 到上限即拒绝,不会被牵着一直跑。"""
    routes: dict[str, tuple[int, dict[str, str]]] = {}
    for i in range(8):
        routes[f"http://public.test/h{i}"] = (
            302,
            {"location": f"http://public.test/h{i + 1}"},
        )
    routes["http://public.test/h8"] = (200, {})

    request, _validated = _install_probe(monkeypatch, routes)
    out = screenshot_service._probe_can_embed_sync("http://public.test/h0")

    assert out["can_embed"] is False
    assert len(request.calls) == 6, "最多 6 跳,超限直接拒绝"
    assert [u for u, _ in request.calls][-1] == "http://public.test/h5"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

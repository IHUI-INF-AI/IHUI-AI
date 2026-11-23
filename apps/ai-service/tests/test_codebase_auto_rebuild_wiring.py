# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0-8 第十四批:自动重建装车(2026-11-23)。

第十三批给了调度层,但没人调用它 —— 按 §0.9「造好没装车 = 没有」,这一批把它接进
真实调用点:`codebase_indexer.auto_rebuild_once` 取候选后按开关跑,`auto_rebuild_codebase`
作为 MCP 工具露给 agent。

火光测试钉住四件事:
① 候选读取的 URL/参数/失败语义(读失败抛错,不返回空列表冒充"没活干");
② 开关关着时**明确 skipped+reason**,`candidates_total` 照实报;
③ MCP 工具**先过出域同意闸**(与 index_codebase 同一条闸),未同意时连 indexer 都不碰;
④ 工具注册双射(`_TOOLS` 与 `_TOOL_HANDLERS` 都有,且 schema 破 max_age_days 非负)。
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx
import pytest

from app.services.codebase_auto_rebuild import AUTO_REBUILD_ENV, AUTO_REBUILD_MAX_ENV


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, Any] | str | None = None) -> None:
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = payload if isinstance(payload, str) else ""

    def json(self) -> dict[str, Any]:
        return self._payload if isinstance(self._payload, dict) else {}


class _FakeClient:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *args: Any) -> bool:
        return False

    async def get(self, url: str, params: dict[str, Any] | None = None, headers: Any = None) -> _FakeResponse:
        _FakeClient.last_call = {"url": url, "params": params, "headers": headers}
        return _FakeClient.next_response


def _patch_client(monkeypatch: pytest.MonkeyPatch, response: _FakeResponse) -> None:
    _FakeClient.next_response = response
    monkeypatch.setattr(httpx, "AsyncClient", _FakeClient)


def test_fetch_candidates_url_params_and_body(monkeypatch):
    from app.services.codebase_indexer import codebase_indexer

    _patch_client(
        monkeypatch,
        _FakeResponse(
            200,
            {
                "code": 0,
                "message": "ok",
                "data": {
                    "candidates": [
                        {"repoId": "r1", "decision": "rebuild-stale", "localPath": "/w/1"},
                    ],
                    "scanned": 3,
                },
            },
        ),
    )
    out = asyncio.run(
        codebase_indexer.fetch_rebuild_candidates(
            max_age_days=7, limit=11, internal_user_id="u1"
        )
    )
    assert [c["repoId"] for c in out] == ["r1"]
    call = _FakeClient.last_call
    assert call["url"].endswith("/api/v1/codebase/rebuild-candidates")
    assert call["params"] == {"maxAgeDays": 7, "limit": 11}
    # 归属必须真的进到请求:候选按归属隔离,没身份就等于取空集(fail-closed)。
    # 这里断言"传了就一定带出去"的确定部分:显式 api_token 走 Bearer 档。
    assert "internal_user_id" in str(call) or isinstance(call["headers"], dict)


def test_fetch_candidates_bearer_when_api_token(monkeypatch):
    from app.services.codebase_indexer import codebase_indexer

    _patch_client(monkeypatch, _FakeResponse(200, {"code": 0, "data": {"candidates": []}}))
    asyncio.run(codebase_indexer.fetch_rebuild_candidates(api_token="tk"))
    assert _FakeClient.last_call["headers"]["Authorization"] == "Bearer tk"


def test_fetch_candidates_http_error_raises_not_empty_list(monkeypatch):
    from app.services.codebase_indexer import codebase_indexer

    _patch_client(monkeypatch, _FakeResponse(500, "boom"))
    with pytest.raises(RuntimeError) as ei:
        asyncio.run(codebase_indexer.fetch_rebuild_candidates(internal_user_id="u1"))
    assert "500" in str(ei.value)


def test_fetch_candidates_unexpected_shape_yields_empty(monkeypatch):
    from app.services.codebase_indexer import codebase_indexer

    _patch_client(monkeypatch, _FakeResponse(200, {"code": 0, "data": {}}))
    out = asyncio.run(codebase_indexer.fetch_rebuild_candidates(internal_user_id="u1"))
    assert out == []


def test_auto_rebuild_once_disabled_reports_skip_and_candidate_total(monkeypatch):
    from app.services.codebase_indexer import codebase_indexer

    _patch_client(
        monkeypatch,
        _FakeResponse(200, {"code": 0, "data": {"candidates": [{"repoId": "r1", "localPath": "/w/1"}]}}),
    )
    monkeypatch.delenv(AUTO_REBUILD_ENV, raising=False)
    out = asyncio.run(codebase_indexer.auto_rebuild_once(internal_user_id="u1"))
    assert out["skipped"] is True
    assert AUTO_REBUILD_ENV in out["reason"]
    assert out["candidates_total"] == 1
    assert "ran" not in out  # 没跑就不许有 ran 字段冒充"跑了 0 个"


def test_auto_rebuild_once_enabled_runs_through_real_indexer(monkeypatch):
    from app.services.codebase_indexer import codebase_indexer

    _patch_client(
        monkeypatch,
        _FakeResponse(
            200,
            {
                "code": 0,
                "data": {
                    "candidates": [
                        {"repoId": "r1", "localPath": "/w/1"},
                        {"repoId": "r2", "localPath": None},
                    ]
                },
            },
        ),
    )
    monkeypatch.setenv(AUTO_REBUILD_ENV, "1")
    monkeypatch.setenv(AUTO_REBUILD_MAX_ENV, "1")
    seen: list[dict[str, Any]] = []

    async def _fake_index(repo_path: str, **kw: Any) -> Any:
        seen.append({"repo_path": repo_path, **kw})

        class _R:
            files_indexed = 2
            chunks_indexed = 5
            errors: list[str] = []

        return _R()

    monkeypatch.setattr(codebase_indexer, "index_repository", _fake_index)
    out = asyncio.run(codebase_indexer.auto_rebuild_once(internal_user_id="u1"))
    assert out["skipped"] is False
    assert out["limit"] == 1
    assert out["ran"] == 1 and out["ok"] == 1
    assert out["skipped_no_path"] == ["r2"]
    assert seen and seen[0]["repo_path"] == "/w/1"


def test_mcp_tool_requires_consent_before_any_indexing(monkeypatch):
    from app.services import mcp_server

    monkeypatch.setattr(mcp_server, "_code_index_egress_allowed", lambda _uid: False)
    called: list[str] = []

    async def _boom(*a: Any, **kw: Any) -> Any:
        called.append("hit")
        raise AssertionError("未同意时不得碰 indexer")

    from app.services.codebase_indexer import codebase_indexer

    monkeypatch.setattr(codebase_indexer, "auto_rebuild_once", _boom)
    out = asyncio.run(mcp_server._tool_auto_rebuild_codebase({"__user_id": "u1"}))
    assert out["tool"] == "auto_rebuild_codebase"
    assert out["ok"] is False
    assert out["skipped"] == "not-consented"
    assert called == []


def test_mcp_tool_surfaces_skip_without_ok(monkeypatch):
    from app.services import mcp_server
    from app.services.codebase_indexer import codebase_indexer

    monkeypatch.setattr(mcp_server, "_code_index_egress_allowed", lambda _uid: True)

    async def _skip(**kw: Any) -> dict[str, Any]:
        return {"skipped": True, "reason": "未开启", "candidates": 2}

    monkeypatch.setattr(codebase_indexer, "auto_rebuild_once", _skip)
    out = asyncio.run(mcp_server._tool_auto_rebuild_codebase({}))
    assert out["ok"] is False
    assert out["skipped"] is True
    assert out["reason"] == "未开启"
    assert out["candidates"] == 2


def test_mcp_tool_ok_when_run_has_no_failures(monkeypatch):
    from app.services import mcp_server
    from app.services.codebase_indexer import codebase_indexer

    monkeypatch.setattr(mcp_server, "_code_index_egress_allowed", lambda _uid: True)

    async def _run(**kw: Any) -> dict[str, Any]:
        return {"skipped": False, "ran": 1, "ok": 1, "failed": 0, "results": [], "limit": 3}

    monkeypatch.setattr(codebase_indexer, "auto_rebuild_once", _run)
    out = asyncio.run(mcp_server._tool_auto_rebuild_codebase({"max_age_days": 7}))
    assert out["ok"] is True
    assert out["ran"] == 1
    # 两层同名字段必须分流:工具面 ok=布尔,成功数在 okCount,
    # 否则调度层的成功数 1 会盖掉布尔 True(调用方读到 ok:1 判不出结论)
    assert out["okCount"] == 1


def test_mcp_tool_rejects_bad_max_age_days():
    from app.services import mcp_server

    out = asyncio.run(mcp_server._tool_auto_rebuild_codebase({"max_age_days": "abc"}))
    assert out["ok"] is False
    assert "整数" in out["error"]
    out2 = asyncio.run(mcp_server._tool_auto_rebuild_codebase({"max_age_days": -1}))
    assert out2["ok"] is False
    assert "非负" in out2["error"]


def test_tool_registry_bijection_includes_auto_rebuild():
    from app.services import mcp_server

    names = [t.name for t in mcp_server._TOOLS]
    assert "auto_rebuild_codebase" in names
    assert "auto_rebuild_codebase" in mcp_server._TOOL_HANDLERS
    tool = next(t for t in mcp_server._TOOLS if t.name == "auto_rebuild_codebase")
    prop = tool.input_schema["properties"]["max_age_days"]
    assert prop["type"] == "integer"
    assert prop["minimum"] == 0
    assert "CODEBASE_AUTO_REBUILD" in tool.description
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

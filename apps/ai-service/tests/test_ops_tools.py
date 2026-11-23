# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""动作型工具分发层单测(2026-11-23 立)。

只测 api_ops_common.dispatch 与四张路由表的形状,不发真实请求:
用 monkeypatch 替换 api_ops_common.api_request,断言 method/path/params/body 的切分。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.tools import api_ops_common
from app.tools.finance_ops_tools import FINANCE_LEDGER_ROUTES, FINANCE_TAX_ROUTES
from app.tools.hr_ops_tools import HR_LIFECYCLE_ROUTES, HR_PAYOUT_ROUTES

_UID = "11111111-2222-4333-8444-555555555555"


def _run(tool: str, arguments: dict[str, Any], routes: dict[str, tuple[str, str]], captured: list[dict[str, Any]]):
    async def fake_request(method, path, *, tool, user_id, params=None, body=None):  # noqa: ARG001
        captured.append({"method": method, "path": path, "params": params, "body": body})
        return {"ok": True, "echo": path}

    def fake(method, path, **kwargs):
        return fake_request(method, path, **kwargs)

    api_ops_common.api_request = fake  # type: ignore[assignment]
    try:
        return asyncio.run(
            api_ops_common.dispatch(tool, {"__user_id": _UID, **arguments}, routes)
        )
    finally:
        # 还原为真实实现,避免影响其它用例
        import importlib

        importlib.reload(api_ops_common)


def test_unknown_action_lists_available():
    captured: list[dict[str, Any]] = []
    result = _run("t", {"action": "nope"}, {"a.b": ("GET", "/api/x")}, captured)
    assert result["ok"] is False
    assert result["errorCode"] == "UNKNOWN_ACTION"
    assert "a.b" in result["message"]


def test_missing_action_and_user():
    captured: list[dict[str, Any]] = []
    r1 = _run("t", {"action": ""}, {"a.b": ("GET", "/api/x")}, captured)
    assert r1["errorCode"] == "MISSING_ACTION"
    r2 = _run("t", {"action": "a.b", "__user_id": "bad"}, {"a.b": ("GET", "/api/x")}, captured)
    assert r2["errorCode"] == "MISSING_USER"


def test_path_param_replaced_and_removed_from_body():
    captured: list[dict[str, Any]] = []
    routes = {"v.create": ("POST", "/api/x/ledgers/:id/vouchers")}
    res = _run("t", {"action": "v.create", "payload": {"id": "L-1", "memo": "m"}}, routes, captured)
    assert res["ok"] is True
    assert captured[0]["method"] == "POST"
    assert captured[0]["path"] == "/api/x/ledgers/L-1/vouchers"
    assert captured[0]["body"] == {"memo": "m"}


def test_get_uses_query_params_and_drops_none():
    captured: list[dict[str, Any]] = []
    routes = {"v.list": ("GET", "/api/x/ledgers/:id/vouchers")}
    _run("t", {"action": "v.list", "payload": {"id": "L-1", "status": "posted", "empty": None}}, routes, captured)
    assert captured[0]["params"] == {"status": "posted"}
    assert captured[0]["body"] is None


def test_missing_path_param_rejected():
    captured: list[dict[str, Any]] = []
    routes = {"v.post": ("POST", "/api/x/vouchers/:id/post")}
    res = _run("t", {"action": "v.post", "payload": {}}, routes, captured)
    assert res["errorCode"] == "MISSING_PATH_PARAM"
    assert "id" in res["message"]
    assert captured == []


def test_route_tables_shape():
    for table in (FINANCE_LEDGER_ROUTES, FINANCE_TAX_ROUTES, HR_LIFECYCLE_ROUTES, HR_PAYOUT_ROUTES):
        for action, (method, path) in table.items():
            assert method in {"GET", "POST", "PATCH", "PUT", "DELETE"}, action
            assert path.startswith("/api/"), action
            assert not path.endswith("/"), action


def test_route_tables_cover_key_actions():
    assert "client.create" in FINANCE_LEDGER_ROUTES
    assert "opening.set" in FINANCE_LEDGER_ROUTES
    assert "voucher.post" in FINANCE_LEDGER_ROUTES
    assert "review.approve" in FINANCE_LEDGER_ROUTES
    assert "period.close" in FINANCE_LEDGER_ROUTES
    assert "tax.profile.upsert" in FINANCE_TAX_ROUTES
    assert "filing.task.update" in FINANCE_TAX_ROUTES
    assert "candidate.hire" in HR_LIFECYCLE_ROUTES
    assert "resign.settle" in HR_LIFECYCLE_ROUTES
    assert "contract.renew" in HR_LIFECYCLE_ROUTES
    assert "batch.export" in HR_PAYOUT_ROUTES
    assert "payslip.push" in HR_PAYOUT_ROUTES
    assert "batch.build" in HR_PAYOUT_ROUTES


def test_tool_descriptions_mention_all_actions():
    from app.tools.hr_ops_tools import HR_LIFECYCLE_DESCRIPTION, HR_PAYOUT_DESCRIPTION
    from app.tools.finance_ops_tools import FINANCE_LEDGER_DESCRIPTION, FINANCE_TAX_DESCRIPTION

    for text, table in (
        (FINANCE_LEDGER_DESCRIPTION, FINANCE_LEDGER_ROUTES),
        (FINANCE_TAX_DESCRIPTION, FINANCE_TAX_ROUTES),
        (HR_LIFECYCLE_DESCRIPTION, HR_LIFECYCLE_ROUTES),
        (HR_PAYOUT_DESCRIPTION, HR_PAYOUT_ROUTES),
    ):
        for action in table:
            assert action in text, action
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

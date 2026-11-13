# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-039 回归:全局预算配置/降级重置只允许管理员写。

票面缺陷:orchestration router 无任何角色依赖,JWT 中间件只保证"登录",
任意成员都能 PATCH `/api/orchestration/budget/config`(daily_token_limit /
daily_cost_limit_usd / auto_degrade_at / hard_stop_at 全可写)或重置支柱降级,
把全站预算保护调穿。

HEAD 已修(router 内 `_require_admin` + `Depends(get_current_user_id)`),
本文件只补回归,钉五件事:
① 普通用户写全局预算 ⇒ 403,且 governor.update_config 一次都不调用;
② 管理员写 ⇒ 200,配置落到 governor(只带非 None 字段);
③ 普通用户重置支柱降级 ⇒ 403,且 reset_degradation 未被调用(管理员 200);
④ 普通用户读预算汇总/单支柱预算 ⇒ 仍 200(闸只拦写,不误伤查询);
⑤ 未认证写 ⇒ 401(身份依赖先于端点执行)。

身份模拟:HEAD 的写端点用 `Depends(get_current_user_id)` 读
`request.state.user_id`,并在函数体内读 `request.state.role_id`;这里用 ASGI
中间件按请求头注入两者,与 JWT 中间件同一条通道。governor 整体替换为假对象,
不连 DB/Redis/外网。
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.routers import orchestration as orchestration_router

CONFIG_URL = "/api/orchestration/budget/config"
RESET_URL = "/api/orchestration/budget/pillar/rag/reset"


def _make_app() -> FastAPI:
    """最小 app + 身份注入中间件(等价 JWT 中间件写 request.state)。"""
    app = FastAPI()

    @app.middleware("http")
    async def _inject_identity(request: Request, call_next):
        user_id = request.headers.get("x-test-user")
        role_id = request.headers.get("x-test-role", "0")
        if user_id:
            request.state.user_id = user_id
            request.state.role_id = int(role_id)
        return await call_next(request)

    app.include_router(orchestration_router.router, prefix="/api")
    return app


@pytest.fixture()
def fake_governor(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """替换预算治理器:只观察写入口是否被调用。"""
    gov = MagicMock()
    gov.update_config = AsyncMock(
        return_value=SimpleNamespace(daily_token_limit=100)
    )
    gov.reset_degradation = AsyncMock(return_value=True)
    gov.get_usage_summary = AsyncMock(return_value={"total_tokens": 1})
    gov.get_pillar_budget = AsyncMock(return_value={"pillar": "rag"})
    monkeypatch.setattr(orchestration_router, "llm_budget_governor", gov)
    return gov


def _headers(user: str | None, role: int = 0) -> dict[str, str]:
    if user is None:
        return {}
    return {"x-test-user": user, "x-test-role": str(role)}


# =============================================================================
# 全局配置写:普通用户 403 且不落库;管理员 200 且生效
# =============================================================================


def test_non_admin_budget_config_write_is_403_and_storage_untouched(
    fake_governor: MagicMock,
) -> None:
    """普通用户改全局预算 ⇒ 403,update_config 未被调用。"""
    with TestClient(_make_app()) as client:
        resp = client.patch(
            CONFIG_URL,
            headers=_headers("alice", role=0),
            json={"daily_token_limit": 999999, "hard_stop_at": 1.0},
        )

    assert resp.status_code == 403
    assert "仅管理员" in resp.json()["detail"]
    fake_governor.update_config.assert_not_awaited()


def test_admin_budget_config_write_persists(fake_governor: MagicMock) -> None:
    """管理员改全局预算 ⇒ 200,非 None 字段原样传给 governor。"""
    with TestClient(_make_app()) as client:
        resp = client.patch(
            CONFIG_URL,
            headers=_headers("admin", role=1),
            json={"daily_token_limit": 100, "daily_cost_limit_usd": None},
        )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    fake_governor.update_config.assert_awaited_once_with({"daily_token_limit": 100})


def test_non_admin_pillar_reset_is_403_and_untouched(
    fake_governor: MagicMock,
) -> None:
    """普通用户重置降级状态 ⇒ 403,reset_degradation 未被调用。"""
    with TestClient(_make_app()) as client:
        resp = client.post(RESET_URL, headers=_headers("alice", role=0))

    assert resp.status_code == 403
    fake_governor.reset_degradation.assert_not_awaited()


def test_admin_pillar_reset_ok(fake_governor: MagicMock) -> None:
    """管理员重置降级状态 ⇒ 200,写入生效。"""
    with TestClient(_make_app()) as client:
        resp = client.post(RESET_URL, headers=_headers("admin", role=1))

    assert resp.status_code == 200
    assert resp.json()["data"] == {"success": True}
    fake_governor.reset_degradation.assert_awaited_once_with(pillar="rag")


# =============================================================================
# 读端点不误伤;未认证写 401
# =============================================================================


def test_member_budget_reads_still_200(fake_governor: MagicMock) -> None:
    """普通用户读预算汇总/单支柱预算 ⇒ 仍 200(闸只拦写)。"""
    with TestClient(_make_app()) as client:
        summary = client.get(
            "/api/orchestration/budget/summary", headers=_headers("alice", role=0)
        )
        pillar = client.get(
            "/api/orchestration/budget/pillar/rag", headers=_headers("alice", role=0)
        )

    assert summary.status_code == 200
    assert summary.json()["data"] == {"total_tokens": 1}
    assert pillar.status_code == 200
    assert pillar.json()["data"] == {"pillar": "rag"}


def test_unauthenticated_budget_write_is_401(fake_governor: MagicMock) -> None:
    """未认证写 ⇒ 401,且 governor 未被触碰。"""
    with TestClient(_make_app()) as client:
        resp = client.patch(
            CONFIG_URL, headers=_headers(None), json={"daily_token_limit": 1}
        )

    assert resp.status_code == 401
    fake_governor.update_config.assert_not_awaited()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

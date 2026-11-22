# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""memory 面两条凭据收口的回归(2026-11-01)。

缺口一:500 分支把数据库异常原文回给客户端。
    `except Exception as e: return {"message": f"保存失败: {e}"}` —— asyncpg 的异常文本
    常带表名/列名/约束名/截断 SQL,而 response-sanitizer 只按**字段名**打码,`message`
    不在名单 ⇒ 原文原样出网关。本文件用一条含 `relation "x" does not exist` 的假异常,
    断言它**不出现在响应体**,但**必须出现在日志**里(否则是销毁现场,不是脱敏)。

缺口二:INTERNAL_SERVICE_TOKEN 缺失时静默回落 `"dev-token"`。
    断言缺失时为空串;且"签不出内部票 + 常驻密钥为空"时 `_fetch_memory_entries`
    一步都不出站(用 `httpx.AsyncClient` 被调用即抛错的桩来证明)。
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import memory as memory_api
from app.core.jwt_auth import require_request_user_id
from app.services import memory_service as memory_service_module
from app.services.memory_service import memory_service

# 典型会泄表的异常原文:表名 + 截断 SQL 都在里面。
DB_ERROR_TEXT = 'relation "x" does not exist'
DB_SQL_TEXT = 'SELECT * FROM x WHERE secret_column = $1'

# (method, path, kwargs, 服务对象, 方法名, errorCode, 固定文案)
CASES: tuple[tuple[str, str, dict[str, Any], str, str, str, str], ...] = (
    (
        "post",
        "/api/memory/save",
        {"json": {"content": "c", "layer": "semantic"}},
        "memory_service",
        "save",
        "MEMORY_SAVE_FAILED",
        "保存失败",
    ),
    (
        "get",
        "/api/memory/recall",
        {"params": {"query": "q"}},
        "memory_service",
        "recall",
        "MEMORY_RECALL_FAILED",
        "检索失败",
    ),
    (
        "post",
        "/api/memory/dream",
        {"json": {}},
        "dream_service",
        "consolidate",
        "MEMORY_DREAM_FAILED",
        "梦境固化失败",
    ),
    (
        "get",
        "/api/memory/topics",
        {},
        "dream_service",
        "dream_topic",
        "MEMORY_TOPICS_FAILED",
        "主题生成失败",
    ),
    (
        "delete",
        "/api/memory/forget",
        {},
        "dream_service",
        "forget",
        "MEMORY_FORGET_FAILED",
        "遗忘失败",
    ),
    (
        "post",
        "/api/memory/procedural",
        {"json": {"pattern": "doom_loop:read:hash"}},
        "memory_service",
        "add_procedural",
        "MEMORY_PROCEDURAL_SAVE_FAILED",
        "procedural 保存失败",
    ),
)


def _boom(*_args: object, **_kwargs: object) -> None:
    raise RuntimeError(f"{DB_ERROR_TEXT}; SQL: {DB_SQL_TEXT}")


@pytest.fixture
async def client() -> Any:
    """最小 app:真实 memory router + 身份依赖覆盖(本文件不测鉴权)。"""
    app = FastAPI()
    app.include_router(memory_api.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://memory-error.test") as ac:
        yield ac


@pytest.mark.parametrize("method,path,kwargs,target_name,method_name,error_code,message", CASES)
async def test_db_error_text_never_reaches_response(
    client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    kwargs: dict[str, Any],
    target_name: str,
    method_name: str,
    error_code: str,
    message: str,
) -> None:
    target = getattr(memory_api, target_name)
    monkeypatch.setattr(target, method_name, _boom)

    with caplog.at_level(logging.ERROR, logger="app.api.memory"):
        resp = await getattr(client, method)(path, **kwargs)

    body = resp.json()
    assert resp.status_code == 200, f"{method.upper()} {path} 的容器状态码变了: {resp.status_code}"
    assert body["code"] == 500
    assert body["errorCode"] == error_code
    assert body["message"] == message
    # 反向牙口①:原文不得出现在响应体(表名 / SQL 片段 / 异常类文本都算)。
    assert DB_ERROR_TEXT not in resp.text, f"{method.upper()} {path} 把数据库异常原文回给了客户端"
    assert "SELECT * FROM x" not in resp.text
    # 反向牙口②:原文必须留在日志里 —— 否则不是脱敏,是把排障现场毁了。
    assert DB_ERROR_TEXT in caplog.text, "异常原文未进 logger.exception,排障现场丢失"
    assert "RuntimeError" in caplog.text


def test_internal_service_token_has_no_dev_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """缺失时必须是空串,不能回落到仓库里人人可见的 `dev-token`。"""
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    assert memory_service_module._internal_service_token() == ""


def test_internal_service_token_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "  unit-test-token  ")
    assert memory_service_module._internal_service_token() == "unit-test-token"


def test_outbound_headers_none_when_only_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """`x-user-id` 非空 ≠ 有凭据:两者都缺内部票与常驻密钥时必须判"无凭据"。"""
    monkeypatch.setattr(
        memory_service_module,
        "internal_service_headers",
        lambda *_a, **_k: {"x-user-id": "user-1"},
    )
    assert memory_service_module._memory_outbound_headers("user-1") is None


def test_outbound_headers_carry_legacy_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "unit-test-token")
    headers = memory_service_module._memory_outbound_headers("user-1")
    assert headers is not None
    assert headers[memory_service_module.INTERNAL_TOKEN_HEADER] == "unit-test-token"


async def test_fetch_entries_skips_outbound_without_credentials(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """零凭据时不得构造 HTTP 客户端(用"被调用即抛错"的桩证明真的没发)。"""
    uid = str(uuid4())
    monkeypatch.setattr(
        memory_service_module,
        "internal_service_headers",
        lambda *_a, **_k: {"x-user-id": uid},
    )

    def _no_http(*_a: object, **_k: object) -> None:
        raise AssertionError("内部凭据不可用时不得出站")

    monkeypatch.setattr(httpx, "AsyncClient", _no_http)

    with caplog.at_level(logging.WARNING, logger="app.services.memory_service"):
        entries = await memory_service._fetch_memory_entries(uid, "user")

    assert entries == []
    assert "内部凭据不可用" in caplog.text

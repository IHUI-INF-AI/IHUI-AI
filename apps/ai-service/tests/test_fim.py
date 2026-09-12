# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/routers/fim.py 单元测试:FIM 代码补全端点。

测试覆盖:
- POST /api/llm/fim:正常补全(stub 模式)/ 空 prefix 短路 / 网关异常静默降级
- 响应契约:{code, message, data:{completion, model, latency_ms, stub}}
- 请求模型校验:prefix 必填 → 422;max_tokens 越界 → 422

测试隔离:monkeypatch llm_gateway.complete(AsyncMock),不调用真实 LLM。
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.routers import fim


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件(与 test_tools_router 同规则)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")



async def test_fim_normal_completion(client, monkeypatch):
    """正常补全:返回 {code:0, completion 非空, latency_ms 非负}。"""
    mock = AsyncMock(return_value={"content": "return a + b", "model": "stub-model", "stub": True})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    resp = await client.post(
        "/api/llm/fim",
        json={"prefix": "def add(a, b):\n    ", "suffix": "\n", "language": "python"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["completion"] == "return a + b"
    assert data["model"] == "stub-model"
    assert data["latency_ms"] >= 0
    # 补全调用必须是 temperature=0 + 小 max_tokens(低延迟约束)
    kwargs = mock.call_args.kwargs
    assert kwargs["temperature"] == 0.0
    assert kwargs["max_tokens"] == 128



async def test_fim_empty_prefix_short_circuit(client):
    """空 prefix 短路:不调网关,直接返回空 completion。"""
    resp = await client.post("/api/llm/fim", json={"prefix": ""})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["completion"] == ""



async def test_fim_gateway_exception_silent_degrade(client, monkeypatch):
    """网关异常:补全失败静默降级为空 completion(绝不打断打字流)。"""
    monkeypatch.setattr(
        fim.llm_gateway, "complete", AsyncMock(side_effect=RuntimeError("upstream boom"))
    )
    resp = await client.post("/api/llm/fim", json={"prefix": "const x = "})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["completion"] == ""



async def test_fim_strips_markdown_fences(client, monkeypatch):
    """模型偶发输出 ``` 围栏:剥离后返回纯代码。"""
    mock = AsyncMock(return_value={"content": "```ts\nconst a = 1;\n```", "model": "m", "stub": False})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    resp = await client.post("/api/llm/fim", json={"prefix": "x"})
    data = resp.json()["data"]
    assert data["completion"] == "const a = 1;"



async def test_fim_validation_errors(client):
    """schema 校验:缺 prefix → 422;max_tokens 超上限 → 422。"""
    resp = await client.post("/api/llm/fim", json={"suffix": "x"})
    assert resp.status_code == 422
    resp = await client.post("/api/llm/fim", json={"prefix": "x", "max_tokens": 9999})
    assert resp.status_code == 422

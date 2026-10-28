# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

"""用户级 LLM 指标与中间件收口测试(2026-10-19 立,修 26 倍虚高误报)。
覆盖:record_user_request 计数(一次一 inc)/ 中间件只对非流式
/api/llm/complete 收口(2xx=ok,非 2xx=failed)/ /api/llm/complete/stream
与其它 POST 路径不在此列(流式在 astream 收口,避免双计)。
"""

import pytest
from prometheus_client import REGISTRY
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.middleware.audit import _USER_LLM_PATH, AuditMiddleware
from app.middleware.llm_metrics import record_user_request


def _count(endpoint: str, status: str) -> float:
    value = REGISTRY.get_sample_value(
        "ihui_llm_requests_total", {"endpoint": endpoint, "status": status}
    )
    return float(value) if value is not None else 0.0


@pytest.fixture(autouse=True)
def _note_baseline():
    """记录基线(其他用例可能已 inc 过同标签),断言用增量。"""
    base = {
        ("complete", "ok"): _count("complete", "ok"),
        ("complete", "failed"): _count("complete", "failed"),
        ("stream", "ok"): _count("stream", "ok"),
        ("stream", "failed"): _count("stream", "failed"),
    }
    yield base


def test_record_user_request_increments_once():
    before = _count("complete", "ok")
    record_user_request("complete", "ok")
    assert _count("complete", "ok") == before + 1


def test_record_user_request_swallows_bad_input():
    """写入层不炸:异常只 warn(与 record_llm_outcome 同契约)。"""
    record_user_request("complete", "ok")  # 正常
    record_user_request("", "")  # 空标签不抛即通过


def _make_app() -> Starlette:
    async def complete_ep(request):
        # 同一路径按 query 返回成功/失败:真实的非流式失败就是该路径本身返 5xx
        if request.query_params.get("fail") == "1":
            return JSONResponse({"error": True}, status_code=502)
        return JSONResponse({"ok": True})

    async def stream_ep(request):
        return JSONResponse({"stream": True})

    async def other_ep(request):
        return JSONResponse({"other": True})

    app = Starlette(
        routes=[
            Route(_USER_LLM_PATH, complete_ep, methods=["POST"]),
            Route(_USER_LLM_PATH + "/stream", stream_ep, methods=["POST"]),
            Route("/api/other/write", other_ep, methods=["POST"]),
        ]
    )
    app.add_middleware(AuditMiddleware)
    return app


def test_middleware_counts_complete_ok_and_failed(_note_baseline):
    client = TestClient(_make_app())
    r1 = client.post(_USER_LLM_PATH)
    assert r1.status_code == 200
    assert _count("complete", "ok") == _note_baseline[("complete", "ok")] + 1

    r2 = client.post(_USER_LLM_PATH + "?fail=1")
    assert r2.status_code == 502
    assert _count("complete", "failed") == _note_baseline[("complete", "failed")] + 1


def test_middleware_skips_stream_and_other_paths(_note_baseline):
    """stream 与其它 POST 不在中间件收口(防双计/防把非 LLM 写操作算进来)。"""
    client = TestClient(_make_app())
    client.post(_USER_LLM_PATH + "/stream")
    client.post("/api/other/write")
    assert _count("stream", "ok") == _note_baseline[("stream", "ok")]
    assert _count("stream", "failed") == _note_baseline[("stream", "failed")]
    assert _count("complete", "ok") == _note_baseline[("complete", "ok")]
    assert _count("complete", "failed") == _note_baseline[("complete", "failed")]

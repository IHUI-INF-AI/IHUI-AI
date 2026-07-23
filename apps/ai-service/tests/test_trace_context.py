"""trace_context.py 单元测试:W3C traceparent 解析 + 中间件 state 注入。

测试覆盖:
- parse_traceparent:合法(小写/大写)+ 非法(空/None/段数错/长度错/非 hex)
- parse_traceparent:返回字段完整性(version/trace_id/parent_id/flags)
- TraceContextMiddleware:合法 traceparent → state 注入 + 响应头回传
- TraceContextMiddleware:无 traceparent → state None + 无响应头
- TraceContextMiddleware:非法 traceparent → state None + 无响应头
- TraceContextMiddleware:不阻塞请求(异常路径)
- setup_trace_context_middleware:注册到 FastAPI app
- parse_traceparent:trace_id 32 hex + parent_id 16 hex 边界
"""

from __future__ import annotations

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.testclient import TestClient

from app.middleware.trace_context import (
    TraceContextMiddleware,
    parse_traceparent,
    setup_trace_context_middleware,
)


# 合法 W3C traceparent:version-trace_id(32 hex)-parent_id(16 hex)-flags
_VALID_TRACEPARENT = (
    "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
)
_VALID_TRACE_ID = "0af7651916cd43dd8448eb211c80319c"
_VALID_PARENT_ID = "b7ad6b7169203331"


# =============================================================================
# parse_traceparent — 合法路径
# =============================================================================


def test_parse_valid_lowercase_traceparent():
    """合法小写 traceparent 应返回完整字典。"""
    result = parse_traceparent(_VALID_TRACEPARENT)
    assert result is not None
    assert result["version"] == "00"
    assert result["trace_id"] == _VALID_TRACE_ID
    assert result["parent_id"] == _VALID_PARENT_ID
    assert result["flags"] == "01"


def test_parse_valid_uppercase_hex():
    """大写 hex 字符应被接受(全部转为小写比较)。"""
    tp = "00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-01"
    result = parse_traceparent(tp)
    assert result is not None
    # trace_id/parent_id 保持原样(代码未做大小写归一化,只校验合法)
    assert result["trace_id"] == "0AF7651916CD43DD8448EB211C80319C"
    assert result["parent_id"] == "B7AD6B7169203331"


def test_parse_returns_four_keys():
    """返回字典应恰好含 4 个键:version/trace_id/parent_id/flags。"""
    result = parse_traceparent(_VALID_TRACEPARENT)
    assert set(result.keys()) == {"version", "trace_id", "parent_id", "flags"}


def test_parse_all_zero_hex():
    """全 0 hex 应被接受(虽然是 W3C 不推荐,但格式合法)。"""
    tp = "00-" + "0" * 32 + "-" + "0" * 16 + "-00"
    result = parse_traceparent(tp)
    assert result is not None
    assert result["trace_id"] == "0" * 32
    assert result["parent_id"] == "0" * 16
    assert result["flags"] == "00"


# =============================================================================
# parse_traceparent — 非法路径(返回 None)
# =============================================================================


def test_parse_empty_string_returns_none():
    """空字符串应返回 None。"""
    assert parse_traceparent("") is None


def test_parse_none_returns_none():
    """None 输入应返回 None。"""
    assert parse_traceparent(None) is None  # type: ignore[arg-type]


def test_parse_wrong_part_count_returns_none():
    """段数 != 4 应返回 None。"""
    assert parse_traceparent("00-trace-parent") is None  # 3 段
    assert parse_traceparent("00-trace-id-parent-id-extra") is None  # 5 段
    assert parse_traceparent("00") is None  # 1 段
    assert parse_traceparent("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331") is None  # 3 段


def test_parse_short_trace_id_returns_none():
    """trace_id 长度 != 32 应返回 None。"""
    tp = "00-short-b7ad6b7169203331-01"
    assert parse_traceparent(tp) is None


def test_parse_short_parent_id_returns_none():
    """parent_id 长度 != 16 应返回 None。"""
    tp = "00-0af7651916cd43dd8448eb211c80319c-short-01"
    assert parse_traceparent(tp) is None


def test_parse_non_hex_trace_id_returns_none():
    """trace_id 含非 hex 字符应返回 None。"""
    bad_trace = "x" * 32
    tp = f"00-{bad_trace}-b7ad6b7169203331-01"
    assert parse_traceparent(tp) is None


def test_parse_non_hex_parent_id_returns_none():
    """parent_id 含非 hex 字符应返回 None。"""
    bad_parent = "z" * 16
    tp = f"00-0af7651916cd43dd8448eb211c80319c-{bad_parent}-01"
    assert parse_traceparent(tp) is None


def test_parse_trace_id_with_uppercase_g_is_rejected():
    """trace_id 含超出 hex 范围的字符(如 'g')应返回 None。"""
    # 'g' 不在 0-9a-f 范围
    bad_trace = "0af7651916cd43dd8448eb211c80319g"  # 末尾 g
    tp = f"00-{bad_trace}-b7ad6b7169203331-01"
    assert parse_traceparent(tp) is None


# =============================================================================
# parse_traceparent — 边界
# =============================================================================


def test_parse_trace_id_exactly_32_chars():
    """trace_id 恰好 32 字符应通过(边界)。"""
    tp = "00-" + "a" * 32 + "-b7ad6b7169203331-01"
    assert parse_traceparent(tp) is not None


def test_parse_trace_id_33_chars_rejected():
    """trace_id 33 字符应被拒(边界)。"""
    tp = "00-" + "a" * 33 + "-b7ad6b7169203331-01"
    assert parse_traceparent(tp) is None


def test_parse_parent_id_exactly_16_chars():
    """parent_id 恰好 16 字符应通过(边界)。"""
    tp = "00-0af7651916cd43dd8448eb211c80319c-" + "b" * 16 + "-01"
    assert parse_traceparent(tp) is not None


def test_parse_parent_id_17_chars_rejected():
    """parent_id 17 字符应被拒(边界)。"""
    tp = "00-0af7651916cd43dd8448eb211c80319c-" + "b" * 17 + "-01"
    assert parse_traceparent(tp) is None


# =============================================================================
# TraceContextMiddleware — state 注入
# =============================================================================


def _make_trace_app() -> Starlette:
    """构建带 TraceContextMiddleware 的最小 app。"""
    app = Starlette()

    async def root(request):
        # 暴露 state 给测试断言
        trace_id = getattr(request.state, "trace_id", None)
        parent_id = getattr(request.state, "trace_parent_id", None)
        return PlainTextResponse(f"trace={trace_id}|parent={parent_id}")

    app.add_route("/", root, methods=["GET"])
    app.add_middleware(TraceContextMiddleware)
    return app


def test_middleware_sets_state_on_valid_traceparent():
    """合法 traceparent:state.trace_id / trace_parent_id 应被注入。"""
    app = _make_trace_app()
    with TestClient(app) as client:
        resp = client.get("/", headers={"traceparent": _VALID_TRACEPARENT})
    assert resp.status_code == 200
    assert resp.text == f"trace={_VALID_TRACE_ID}|parent={_VALID_PARENT_ID}"


def test_middleware_sets_state_none_when_no_header():
    """无 traceparent 头:state 应为 None。"""
    app = _make_trace_app()
    with TestClient(app) as client:
        resp = client.get("/")
    assert resp.status_code == 200
    assert resp.text == "trace=None|parent=None"


def test_middleware_sets_state_none_on_invalid_header():
    """非法 traceparent:state 应为 None(不抛错)。"""
    app = _make_trace_app()
    with TestClient(app) as client:
        resp = client.get("/", headers={"traceparent": "invalid"})
    assert resp.status_code == 200
    assert resp.text == "trace=None|parent=None"


# =============================================================================
# TraceContextMiddleware — 响应头回传
# =============================================================================


def test_middleware_returns_x_trace_id_header():
    """合法 traceparent:响应头应含 X-Trace-Id。"""
    app = _make_trace_app()
    with TestClient(app) as client:
        resp = client.get("/", headers={"traceparent": _VALID_TRACEPARENT})
    assert resp.headers.get("X-Trace-Id") == _VALID_TRACE_ID


def test_middleware_no_x_trace_id_when_no_header():
    """无 traceparent 头:响应头不应含 X-Trace-Id。"""
    app = _make_trace_app()
    with TestClient(app) as client:
        resp = client.get("/")
    assert "X-Trace-Id" not in resp.headers


def test_middleware_no_x_trace_id_when_invalid_header():
    """非法 traceparent:响应头不应含 X-Trace-Id。"""
    app = _make_trace_app()
    with TestClient(app) as client:
        resp = client.get("/", headers={"traceparent": "invalid"})
    assert "X-Trace-Id" not in resp.headers


# =============================================================================
# TraceContextMiddleware — 不阻塞请求
# =============================================================================


def test_middleware_does_not_block_on_parse_failure():
    """parse 失败时中间件不应抛错,请求继续(返回 200)。"""
    app = _make_trace_app()
    bad_tps = [
        "00-short-b7ad6b7169203331-01",
        "00-" + "x" * 32 + "-b7ad6b7169203331-01",
        "garbage",
        "",
    ]
    with TestClient(app) as client:
        for tp in bad_tps:
            resp = client.get("/", headers={"traceparent": tp})
            assert resp.status_code == 200, f"traceparent={tp!r} 不应阻塞请求"


def test_middleware_preserves_trace_id_exact_value():
    """trace_id 应原样透传(不做大小写归一化)。"""
    app = _make_trace_app()
    tp = "00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-01"
    with TestClient(app) as client:
        resp = client.get("/", headers={"traceparent": tp})
    # 响应头应含原样 trace_id(大写)
    assert resp.headers.get("X-Trace-Id") == "0AF7651916CD43DD8448EB211C80319C"


# =============================================================================
# setup_trace_context_middleware — 注册到 FastAPI app
# =============================================================================


def test_setup_trace_context_middleware_registers():
    """setup_trace_context_middleware 应将中间件添加到 app。"""
    app = Starlette()
    setup_trace_context_middleware(app)
    # Starlette/FastAPI 中间件存在 user_middleware 列表里
    middleware_classes = [m.cls for m in app.user_middleware]
    assert TraceContextMiddleware in middleware_classes


def test_setup_trace_context_middleware_idempotent():
    """多次调用 setup 不抛错(虽然可能重复注册,但不应崩溃)。"""
    app = Starlette()
    setup_trace_context_middleware(app)
    # 第二次调用不应抛异常
    setup_trace_context_middleware(app)
    # 至少有 1 个(可能 2 个)
    middleware_classes = [m.cls for m in app.user_middleware]
    assert middleware_classes.count(TraceContextMiddleware) >= 1


# =============================================================================
# 模块 logger
# =============================================================================


def test_module_logger_name():
    """模块 logger 名应为 app.middleware.trace_context。"""
    from app.middleware import trace_context
    assert trace_context.logger.name == "app.middleware.trace_context"

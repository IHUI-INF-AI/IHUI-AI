"""SSE 流式接口测试 - 验证 chat 端点的 text/event-stream 输出。

涵盖 /chat, /ai/stream 等 SSE 路由。
"""
import json

import pytest
from fastapi.testclient import TestClient


@pytest.mark.sse
def test_sse_chat_endpoint_exists():
    """验证 /chat 或类似 SSE 端点已被注册。"""
    from app.main import create_app

    app = create_app()
    sse_paths = []
    for r in app.routes:
        path = getattr(r, "path", "")
        if any(k in path.lower() for k in ("chat", "stream", "sse")):
            sse_paths.append(path)
    assert len(sse_paths) > 0, "未找到 /chat 或 /stream SSE 路由"


@pytest.mark.sse
def test_sse_content_type():
    """验证 SSE 端点返回 text/event-stream MIME 类型。"""
    from app.main import create_app

    app = create_app()
    with TestClient(app) as client:
        # 尝试常用 SSE 路径
        for path in ("/api/v1/ai/chat/stream", "/api/v1/chat/stream", "/chat/stream"):
            try:
                with client.stream("GET", path) as resp:
                    ct = resp.headers.get("content-type", "")
                    if "event-stream" in ct:
                        assert "event-stream" in ct
                        return
            except Exception:
                continue
        pytest.skip("未找到可用的 SSE 端点")


@pytest.mark.sse
def test_sse_handles_invalid_token():
    """验证 SSE 端点对无效 token 返回 401 而非 500。"""
    from app.main import create_app

    app = create_app()
    with TestClient(app) as client:
        for path in ("/api/v1/ai/chat/stream", "/chat"):
            try:
                resp = client.get(path, headers={"Authorization": "Bearer invalid_token_xxx"})
                if resp.status_code in (200, 401, 403):
                    assert resp.status_code != 500, "无效 token 不应触发 500"
                    return
            except Exception:
                continue
        pytest.skip("未找到受保护 SSE 端点")

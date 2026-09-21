# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""PR AI 评审端点契约测试。

覆盖 /api/v1/pr-review:
- {code, message, data} 统一包裹形状
- diff 优先于 repo+pr_number(服务端无需 GitHub 凭据)
- 参数缺失 / 业务失败 / 异常 的结构化降级
mock 掉 app.services.pr_reviewer 的两个入口,不触发真实 LLM / GitHub 调用。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import pr_review as pr_review_router

_SAMPLE_DIFF = (
    "diff --git a/foo.py b/foo.py\n"
    "index 111..222 100644\n"
    "--- a/foo.py\n"
    "+++ b/foo.py\n"
    "@@ -1,2 +1,3 @@\n"
    " def f():\n"
    "+    eval(user_input)  # 安全隐患\n"
    "     return 1\n"
)


def _ok_result(repo="owner/name", pr_number=42) -> dict:
    return {
        "ok": True,
        "repo": repo,
        "pr_number": pr_number,
        "summary": "发现 1 处安全隐患",
        "issues": [
            {
                "severity": "high",
                "file": "foo.py",
                "line": "3",
                "message": "使用了 eval",
                "suggestion": "改用 ast.literal_eval",
            }
        ],
        "stats": {"files_changed": 1, "diff_truncated": False, "total_chunks": 1},
        "diff_truncated": False,
    }


async def _client() -> AsyncClient:
    app = FastAPI()
    app.include_router(pr_review_router.router, prefix="/api/v1")
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def _assert_shape(payload: dict) -> None:
    assert set(payload.keys()) == {"code", "message", "data"}, payload.keys()
    assert isinstance(payload["code"], int)
    assert isinstance(payload["message"], str)


async def test_pr_review_with_diff_success() -> None:
    with patch(
        "app.services.pr_reviewer.review_pr_from_diff",
        new=AsyncMock(return_value=_ok_result()),
    ) as mock_fn:
        async with await _client() as client:
            resp = await client.post(
                "/api/v1/pr-review",
                json={"repo": "owner/name", "pr_number": 42, "diff": _SAMPLE_DIFF},
            )
    payload = resp.json()
    _assert_shape(payload)
    assert resp.status_code == 200
    assert payload["code"] == 0
    assert payload["message"] == "ok"
    data = payload["data"]
    assert data["summary"] == "发现 1 处安全隐患"
    assert data["issues"][0]["severity"] == "high"
    assert "comment" in data and data["comment"]
    # diff 必须透传给服务(不触发服务端 GitHub 拉取)
    mock_fn.assert_awaited_once()
    args, kwargs = mock_fn.call_args
    assert args[0] == _SAMPLE_DIFF
    assert kwargs["repo"] == "owner/name"
    assert kwargs["pr_number"] == 42


async def test_pr_review_fallback_to_review_pr() -> None:
    with patch(
        "app.services.pr_reviewer.review_pr_from_diff",
        new=AsyncMock(return_value=_ok_result()),
    ), patch(
        "app.services.pr_reviewer.review_pr",
        new=AsyncMock(return_value=_ok_result()),
    ) as mock_review:
        async with await _client() as client:
            resp = await client.post(
                "/api/v1/pr-review",
                json={"repo": "owner/name", "pr_number": 7},
            )
    payload = resp.json()
    _assert_shape(payload)
    assert payload["code"] == 0
    # 无 diff 时回退到服务端 fetch 路径
    mock_review.assert_awaited_once_with("owner/name", 7, focus=None)


async def test_pr_review_missing_params_400() -> None:
    async with await _client() as client:
        resp = await client.post("/api/v1/pr-review", json={})
    payload = resp.json()
    _assert_shape(payload)
    assert resp.status_code == 200  # 业务错误仍走结构化包装,非 500
    assert payload["code"] == 400
    assert payload["data"] is None


async def test_pr_review_service_error_400() -> None:
    # 仅传 repo+pr_number(无 diff)走服务端 fetch 路径;其返回业务失败应映射为 code=400
    with patch(
        "app.services.pr_reviewer.review_pr",
        new=AsyncMock(
            return_value={"ok": False, "errorCode": "PR_NOT_FOUND", "message": "PR 不存在"}
        ),
    ):
        async with await _client() as client:
            resp = await client.post(
                "/api/v1/pr-review", json={"repo": "o/n", "pr_number": 1}
            )
    payload = resp.json()
    _assert_shape(payload)
    assert payload["code"] == 400
    assert "PR 不存在" in payload["message"]


async def test_pr_review_service_exception_500() -> None:
    with patch(
        "app.services.pr_reviewer.review_pr_from_diff",
        new=AsyncMock(side_effect=RuntimeError("boom")),
    ):
        async with await _client() as client:
            resp = await client.post(
                "/api/v1/pr-review", json={"repo": "o/n", "pr_number": 1, "diff": _SAMPLE_DIFF}
            )
    payload = resp.json()
    _assert_shape(payload)
    assert payload["code"] == 500
    assert payload["data"] is None

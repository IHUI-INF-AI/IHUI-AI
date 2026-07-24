"""pr_reviewer.py 测试 — GitHub PR diff 获取 + LLM 分析。

覆盖维度:
1. fetch_pr_diff:成功(httpx mock)/ PR 不存在 / 无效 repo / 网络错误
2. parse_diff:单文件 / 多文件 / 空diff
3. review_pr:LLM 分析成功(mock fetch + complete)/ LLM 失败兜底
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

from app.services.pr_reviewer import (
    fetch_pr_diff,
    parse_diff,
    review_pr,
)


# =============================================================================
# httpx mock 辅助
# =============================================================================


class _MockResponse:
    def __init__(
        self,
        status_code: int = 200,
        text: str = "",
        json_data: dict | None = None,
    ):
        self.status_code = status_code
        self.text = text
        self._json = json_data or {}

    def json(self) -> dict:
        return self._json


class _MockClient:
    """模拟 httpx.AsyncClient 上下文管理器。"""

    def __init__(self, responses: list[_MockResponse]):
        self._responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    async def __aenter__(self) -> "_MockClient":
        return self

    async def __aexit__(self, *args: object) -> bool:
        return False

    async def get(self, url: str, headers: dict | None = None) -> _MockResponse:
        self.calls.append({"url": url, "headers": headers})
        if not self._responses:
            raise AssertionError("no more mock responses")
        return self._responses.pop(0)


# =============================================================================
# fetch_pr_diff
# =============================================================================


class TestFetchPrDiff:
    async def test_success(self, monkeypatch: pytest.MonkeyPatch):
        """成功获取 diff + metadata。"""
        monkeypatch.setattr("app.core.config.settings.github_token", "")

        diff_text = (
            "diff --git a/foo.py b/foo.py\n"
            "@@ -1,2 +1,2 @@\n"
            "-old\n"
            "+new\n"
        )
        meta = {
            "title": "Test PR",
            "user": {"login": "tester"},
            "html_url": "https://github.com/owner/repo/pull/1",
            "changed_files": 1,
            "additions": 1,
            "deletions": 1,
            "commits": 1,
        }
        client = _MockClient([_MockResponse(200, text=diff_text), _MockResponse(200, json_data=meta)])
        monkeypatch.setattr(
            "app.services.pr_reviewer.httpx.AsyncClient",
            lambda **kw: client,
        )

        result = await fetch_pr_diff("owner/repo", 1)

        assert result["ok"] is True
        assert result["repo"] == "owner/repo"
        assert result["pr_number"] == 1
        assert "diff --git" in result["diff"]
        assert result["title"] == "Test PR"
        assert result["author"] == "tester"
        assert result["additions"] == 1
        assert result["deletions"] == 1
        assert result["files_changed"] == 1
        assert result["rate_limit"] == "anonymous"

    async def test_pr_not_found(self, monkeypatch: pytest.MonkeyPatch):
        """404 → PR_NOT_FOUND。"""
        client = _MockClient([_MockResponse(404, text="Not Found")])
        monkeypatch.setattr(
            "app.services.pr_reviewer.httpx.AsyncClient",
            lambda **kw: client,
        )
        result = await fetch_pr_diff("owner/repo", 999)
        assert result["ok"] is False
        assert result["errorCode"] == "PR_NOT_FOUND"

    async def test_invalid_repo(self):
        """无 / 的 repo → INVALID_REPO。"""
        result = await fetch_pr_diff("invalidrepo", 1)
        assert result["ok"] is False
        assert result["errorCode"] == "INVALID_REPO"

    async def test_invalid_pr_number(self):
        """pr_number <= 0 → INVALID_PR。"""
        result = await fetch_pr_diff("owner/repo", 0)
        assert result["ok"] is False
        assert result["errorCode"] == "INVALID_PR"

    async def test_network_error(self, monkeypatch: pytest.MonkeyPatch):
        """网络错误 → FETCH_FAILED。"""

        class _FailingClient:
            async def __aenter__(self) -> "_FailingClient":
                return self

            async def __aexit__(self, *a: object) -> bool:
                return False

            async def get(self, url: str, headers: dict | None = None) -> _MockResponse:
                raise httpx.ConnectError("connection failed")

        monkeypatch.setattr(
            "app.services.pr_reviewer.httpx.AsyncClient",
            lambda **kw: _FailingClient(),
        )
        result = await fetch_pr_diff("owner/repo", 1)
        assert result["ok"] is False
        assert result["errorCode"] == "FETCH_FAILED"

    async def test_with_token_authenticated(self, monkeypatch: pytest.MonkeyPatch):
        """有 token → rate_limit=authenticated。"""
        diff_text = "diff --git a/foo.py b/foo.py\n@@ -1 +1 @@\n-a\n+b\n"
        client = _MockClient([
            _MockResponse(200, text=diff_text),
            _MockResponse(200, json_data={}),
        ])
        monkeypatch.setattr(
            "app.services.pr_reviewer.httpx.AsyncClient",
            lambda **kw: client,
        )
        result = await fetch_pr_diff("owner/repo", 1, github_token="ghp_xxx")
        assert result["ok"] is True
        assert result["rate_limit"] == "authenticated"
        # 验证 Authorization 头被加上
        first_call = client.calls[0]
        assert first_call["headers"]["Authorization"] == "Bearer ghp_xxx"


# =============================================================================
# parse_diff
# =============================================================================


class TestParseDiff:
    def test_single_file(self):
        diff = (
            "diff --git a/foo.py b/foo.py\n"
            "@@ -1,2 +1,2 @@\n"
            "-old line\n"
            "+new line\n"
            "+added line\n"
        )
        result = parse_diff(diff)
        assert len(result["files"]) == 1
        assert result["files"][0]["filename"] == "foo.py"
        assert result["files"][0]["additions"] == 2
        assert result["files"][0]["deletions"] == 1
        assert result["total_additions"] == 2
        assert result["total_deletions"] == 1
        assert result["total_chunks"] == 1

    def test_multiple_files(self):
        diff = (
            "diff --git a/a.py b/a.py\n"
            "@@ -1 +1 @@\n"
            "-a\n"
            "+b\n"
            "diff --git a/b.py b/b.py\n"
            "@@ -1 +1 @@\n"
            "-c\n"
            "+d\n"
            "+e\n"
        )
        result = parse_diff(diff)
        assert len(result["files"]) == 2
        assert result["files"][0]["filename"] == "a.py"
        assert result["files"][1]["filename"] == "b.py"
        assert result["total_additions"] == 3
        assert result["total_deletions"] == 2

    def test_empty_diff(self):
        result = parse_diff("")
        assert result["files"] == []
        assert result["total_additions"] == 0
        assert result["total_deletions"] == 0

    def test_hunk_count(self):
        diff = (
            "diff --git a/foo.py b/foo.py\n"
            "@@ -1 +1 @@\n"
            "-a\n"
            "+b\n"
            "@@ -10 +10 @@\n"
            "-c\n"
            "+d\n"
        )
        result = parse_diff(diff)
        assert result["files"][0]["chunks"] == 2
        assert result["total_chunks"] == 2


# =============================================================================
# review_pr
# =============================================================================


class TestReviewPr:
    async def test_success(self, monkeypatch: pytest.MonkeyPatch):
        """mock fetch_pr_diff + llm_gateway.complete → 结构化结果。"""
        async def mock_fetch(repo: str, pr_number: int, github_token: str | None = None) -> dict:
            return {
                "ok": True, "repo": repo, "pr_number": pr_number,
                "diff": "diff --git a/foo.py b/foo.py\n@@ -1 +1 @@\n-a\n+b\n",
                "title": "Test", "author": "tester",
                "additions": 1, "deletions": 1,
                "files_changed": 1, "commits": 1,
                "html_url": "u", "rate_limit": "anonymous",
            }
        monkeypatch.setattr("app.services.pr_reviewer.fetch_pr_diff", mock_fetch)

        async def mock_complete(messages: list[dict], model: str | None = None, **kw: Any) -> dict:
            return {
                "content": '{"summary": "代码质量良好", "issues": [{"severity": "low", "file": "foo.py", "line": "1", "message": "建议添加注释", "suggestion": "加 docstring"}]}',
                "model": model,
            }
        monkeypatch.setattr("app.services.pr_reviewer.llm_gateway.complete", mock_complete)

        result = await review_pr("owner/repo", 1)

        assert result["ok"] is True
        assert result["summary"] == "代码质量良好"
        assert len(result["issues"]) == 1
        assert result["issues"][0]["severity"] == "low"
        assert result["stats"]["additions"] == 1
        assert result["diff_truncated"] is False

    async def test_llm_failure_fallback(self, monkeypatch: pytest.MonkeyPatch):
        """LLM 分析失败 → 兜底返回 llm_failed 标记。"""
        async def mock_fetch(repo: str, pr_number: int, github_token: str | None = None) -> dict:
            return {
                "ok": True, "repo": repo, "pr_number": pr_number,
                "diff": "diff --git a/foo.py b/foo.py\n@@ -1 +1 @@\n-a\n+b\n",
                "title": "T", "author": "a",
                "additions": 1, "deletions": 1,
                "files_changed": 1, "commits": 1,
                "html_url": "u", "rate_limit": "anonymous",
            }
        monkeypatch.setattr("app.services.pr_reviewer.fetch_pr_diff", mock_fetch)

        async def mock_complete(messages: list[dict], model: str | None = None, **kw: Any) -> dict:
            raise RuntimeError("LLM 服务不可用")
        monkeypatch.setattr("app.services.pr_reviewer.llm_gateway.complete", mock_complete)

        result = await review_pr("owner/repo", 1)
        assert result["ok"] is True
        assert "LLM 分析失败" in result["summary"]
        assert result["issues"] == []

    async def test_fetch_failure_propagates(self, monkeypatch: pytest.MonkeyPatch):
        """fetch 失败 → 透传错误响应。"""
        async def mock_fetch(repo: str, pr_number: int, github_token: str | None = None) -> dict:
            return {"ok": False, "errorCode": "PR_NOT_FOUND", "message": "不存在"}
        monkeypatch.setattr("app.services.pr_reviewer.fetch_pr_diff", mock_fetch)

        result = await review_pr("owner/repo", 999)
        assert result["ok"] is False
        assert result["errorCode"] == "PR_NOT_FOUND"

    async def test_diff_truncation(self, monkeypatch: pytest.MonkeyPatch):
        """超长 diff → 截断 + diff_truncated=True。"""
        long_diff = "diff --git a/foo.py b/foo.py\n@@ -1 +1 @@\n-a\n+b\n" + "x" * 15000
        async def mock_fetch(repo: str, pr_number: int, github_token: str | None = None) -> dict:
            return {
                "ok": True, "repo": repo, "pr_number": pr_number,
                "diff": long_diff, "title": "T", "author": "a",
                "additions": 1, "deletions": 1,
                "files_changed": 1, "commits": 1,
                "html_url": "u", "rate_limit": "anonymous",
            }
        monkeypatch.setattr("app.services.pr_reviewer.fetch_pr_diff", mock_fetch)

        async def mock_complete(messages: list[dict], model: str | None = None, **kw: Any) -> dict:
            return {"content": '{"summary": "ok", "issues": []}', "model": model}
        monkeypatch.setattr("app.services.pr_reviewer.llm_gateway.complete", mock_complete)

        result = await review_pr("owner/repo", 1)
        assert result["ok"] is True
        assert result["diff_truncated"] is True
        assert result["stats"]["diff_truncated"] is True

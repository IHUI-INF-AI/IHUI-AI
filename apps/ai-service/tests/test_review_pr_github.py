"""review_pr GitHub API 集成 + diff 解析单元测试。

测试覆盖(2026-07-24 升级):
- diff 字符串模式(source="diff_string")
- GitHub API 模式(source="github_api",mock httpx)
- _parse_unified_diff:unified diff 解析
- _compute_diff_stats:统计 + risk 评估(low/medium/high)
- _gh_error_for_status:状态码映射
- _get_cached_pr_diff / _set_cached_pr_diff:缓存命中 + TTL 过期
- 安全 finding 检测(eval/exec/new Function/os.system/shell=True/硬编码凭证)
- 性能 finding 检测(嵌套循环/N+1 查询)
- 可读性 finding 检测(大文件 > 500 新增行)
- focus 过滤(security/performance/readability/all)
- max_files 限制
- 错误码:MISSING_PARAMS / INVALID_PARAMS / GITHUB_AUTH_FAILED / PR_NOT_FOUND / GITHUB_API_ERROR / DEP_MISSING
- Bearer auth header(GITHUB_TOKEN 设置时)
- pr_url 构造
"""

from __future__ import annotations

import os
import time
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.services.mcp_server import (
    _PR_DIFF_CACHE,
    _PR_DIFF_CACHE_TTL,
    _build_review_result,
    _compute_diff_stats,
    _gh_error_for_status,
    _get_cached_pr_diff,
    _parse_unified_diff,
    _scan_pr_files_for_findings,
    _set_cached_pr_diff,
    _tool_review_pr,
)


# =============================================================================
# Fake httpx AsyncClient(mock GitHub API 响应)
# =============================================================================


class _FakeResponse:
    """模拟 httpx.Response。"""

    def __init__(
        self, status_code: int = 200, json_data: Any = None,
        text_data: str = "",
    ):
        self.status_code = status_code
        self._json = json_data if json_data is not None else {}
        self.text = text_data or ""
        self.content = text_data.encode("utf-8") if text_data else b""

    def json(self):
        return self._json


class _FakeAsyncClient:
    """模拟 httpx.AsyncClient,根据 URL 返回不同响应。

    responses: dict[url_suffix, _FakeResponse 或 list[_FakeResponse(按调用顺序)]]
    """

    def __init__(self, responses: dict[str, Any] | None = None):
        self._responses = responses or {}
        self._call_counts: dict[str, int] = {}
        self.requests: list[tuple[str, dict]] = []  # (method, headers) 记录

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, url: str, headers: dict | None = None):
        self.requests.append(("GET", headers or {}))
        # 匹配 URL 后缀
        for suffix, resp in self._responses.items():
            if suffix in url:
                if isinstance(resp, list):
                    idx = self._call_counts.get(suffix, 0)
                    self._call_counts[suffix] = idx + 1
                    return resp[min(idx, len(resp) - 1)]
                return resp
        return _FakeResponse(404, {}, "not found")


def _mock_httpx(monkeypatch, responses: dict[str, Any] | None = None):
    """注入 fake httpx 模块到 sys.modules(monkeypatch 自动还原)。"""
    import sys
    import types

    fake_mod = types.ModuleType("httpx")
    client = _FakeAsyncClient(responses)
    fake_mod.AsyncClient = lambda **kwargs: client
    monkeypatch.setitem(sys.modules, "httpx", fake_mod)
    return client


# =============================================================================
# _parse_unified_diff
# =============================================================================


def test_parse_unified_diff_single_file():
    """解析单个文件的 unified diff。"""
    diff = (
        "diff --git a/foo.py b/foo.py\n"
        "--- a/foo.py\n"
        "+++ b/foo.py\n"
        "@@ -1,3 +1,4 @@\n"
        " def foo():\n"
        "-    return 1\n"
        "+    return 2\n"
        "+    print('new')\n"
    )
    files = _parse_unified_diff(diff)
    assert len(files) == 1
    assert files[0]["filename"] == "foo.py"
    assert files[0]["additions"] == 2
    assert files[0]["deletions"] == 1
    assert "foo.py" in files[0]["patch"]


def test_parse_unified_diff_multiple_files():
    """解析多个文件的 diff(以 +++ b/ 作为边界)。"""
    diff = (
        "--- a/a.py\n+++ b/a.py\n@@ -1 +1 @@\n-old\n+new\n"
        "--- b/b.py\n+++ b/b.py\n@@ -1 +1 @@\n-x\n+y\n"
    )
    files = _parse_unified_diff(diff)
    assert len(files) == 2
    assert files[0]["filename"] == "a.py"
    assert files[1]["filename"] == "b.py"
    assert files[0]["additions"] == 1
    assert files[0]["deletions"] == 1


def test_parse_unified_diff_empty():
    """空 diff 返回空列表。"""
    assert _parse_unified_diff("") == []


def test_parse_unified_diff_no_file_marker():
    """无 +++ b/ 行的 diff 返回空列表。"""
    diff = "some random text\nwithout file markers\n"
    files = _parse_unified_diff(diff)
    assert files == []


def test_parse_unified_diff_counts_additions_deletions():
    """准确统计 additions/deletions(排除 +++/--- 行)。"""
    diff = (
        "+++ b/test.py\n"
        "@@ -1,2 +1,3 @@\n"
        " context\n"
        "-removed line\n"
        "+added line 1\n"
        "+added line 2\n"
    )
    files = _parse_unified_diff(diff)
    assert files[0]["additions"] == 2
    assert files[0]["deletions"] == 1


# =============================================================================
# _compute_diff_stats
# =============================================================================


def test_compute_diff_stats_empty():
    """空文件列表 → 全 0,risk=low。"""
    stats = _compute_diff_stats([])
    assert stats["files_changed"] == 0
    assert stats["added_lines"] == 0
    assert stats["removed_lines"] == 0
    assert stats["complexity_score"] == 0
    assert stats["risk_assessment"] == "low"


def test_compute_diff_stats_low_risk():
    """小 PR → complexity < 50 → risk=low。"""
    files = [{"additions": 10, "deletions": 2}]
    stats = _compute_diff_stats(files)
    assert stats["complexity_score"] == 10 + 4 + 10  # 24
    assert stats["risk_assessment"] == "low"


def test_compute_diff_stats_medium_risk():
    """中等 PR → 50 <= complexity < 300 → risk=medium。"""
    files = [{"additions": 100, "deletions": 10}]
    stats = _compute_diff_stats(files)
    # 100 + 20 + 10 = 130
    assert stats["complexity_score"] == 130
    assert stats["risk_assessment"] == "medium"


def test_compute_diff_stats_high_risk():
    """大 PR → complexity >= 300 → risk=high。"""
    files = [{"additions": 200, "deletions": 50}]
    stats = _compute_diff_stats(files)
    # 200 + 100 + 10 = 310
    assert stats["complexity_score"] == 310
    assert stats["risk_assessment"] == "high"


def test_compute_diff_stats_multiple_files():
    """多文件 PR 统计汇总。"""
    files = [
        {"additions": 30, "deletions": 5},
        {"additions": 20, "deletions": 10},
    ]
    stats = _compute_diff_stats(files)
    assert stats["files_changed"] == 2
    assert stats["added_lines"] == 50
    assert stats["removed_lines"] == 15
    # 50 + 30 + 20 = 100 → medium
    assert stats["complexity_score"] == 100
    assert stats["risk_assessment"] == "medium"


# =============================================================================
# _gh_error_for_status
# =============================================================================


def test_gh_error_401_auth_failed():
    assert _gh_error_for_status(401) == "GITHUB_AUTH_FAILED"


def test_gh_error_403_auth_failed():
    assert _gh_error_for_status(403) == "GITHUB_AUTH_FAILED"


def test_gh_error_404_pr_not_found():
    assert _gh_error_for_status(404) == "PR_NOT_FOUND"


def test_gh_error_422_pr_not_found():
    assert _gh_error_for_status(422) == "PR_NOT_FOUND"


def test_gh_error_500_api_error():
    assert _gh_error_for_status(500) == "GITHUB_API_ERROR"


def test_gh_error_429_api_error():
    assert _gh_error_for_status(429) == "GITHUB_API_ERROR"


# =============================================================================
# 缓存 _get_cached_pr_diff / _set_cached_pr_diff
# =============================================================================


def test_cache_set_and_get():
    """写入缓存后可读取。"""
    _set_cached_pr_diff("test:cache:1", "diff content here")
    result = _get_cached_pr_diff("test:cache:1")
    assert result == "diff content here"
    # 清理
    _PR_DIFF_CACHE.pop("test:cache:1", None)


def test_cache_miss_returns_none():
    """未写入的 key 返回 None。"""
    assert _get_cached_pr_diff("nonexistent:key:xyz") is None


def test_cache_ttl_expiry(monkeypatch):
    """缓存过期后返回 None(TTL 检查在读取时触发)。"""
    _set_cached_pr_diff("test:cache:ttl", "old diff")
    # 模拟时间流逝超过 TTL
    original_time = time.time
    monkeypatch.setattr(time, "time", lambda: original_time() + _PR_DIFF_CACHE_TTL + 1)
    result = _get_cached_pr_diff("test:cache:ttl")
    assert result is None
    # 过期条目应被删除
    assert "test:cache:ttl" not in _PR_DIFF_CACHE


def test_cache_within_ttl_returns_value(monkeypatch):
    """缓存未过期返回值。"""
    _set_cached_pr_diff("test:cache:fresh", "fresh diff")
    original_time = time.time
    monkeypatch.setattr(time, "time", lambda: original_time() + 100)  # 100s < 3600s
    result = _get_cached_pr_diff("test:cache:fresh")
    assert result == "fresh diff"
    _PR_DIFF_CACHE.pop("test:cache:fresh", None)


# =============================================================================
# _scan_pr_files_for_findings:安全检测
# =============================================================================


def test_scan_finds_eval():
    """检测 eval() 调用。"""
    files = [{"filename": "evil.py", "patch": "+result = eval(user_input)\n"}]
    findings = _scan_pr_files_for_findings(files, "all")
    security = [f for f in findings if f["category"] == "security"]
    assert len(security) >= 1
    assert security[0]["severity"] == "high"
    assert "eval" in security[0]["comment"].lower()


def test_scan_finds_exec():
    """检测 exec() 调用。"""
    files = [{"filename": "evil.py", "patch": "+exec(code_string)\n"}]
    findings = _scan_pr_files_for_findings(files, "all")
    security = [f for f in findings if f["category"] == "security"]
    assert len(security) >= 1


def test_scan_finds_new_function():
    """检测 new Function() 调用。"""
    files = [{"filename": "evil.js", "patch": "+var f = new Function('return 1')\n"}]
    findings = _scan_pr_files_for_findings(files, "all")
    security = [f for f in findings if f["category"] == "security"]
    assert len(security) >= 1


def test_scan_finds_os_system():
    """检测 os.system() 调用。"""
    files = [{"filename": "evil.py", "patch": "+os.system(cmd)\n"}]
    findings = _scan_pr_files_for_findings(files, "all")
    security = [f for f in findings if f["category"] == "security"]
    assert len(security) >= 1


def test_scan_finds_shell_true():
    """检测 subprocess shell=True。"""
    files = [{
        "filename": "evil.py",
        "patch": "+subprocess.run(cmd, shell=True)\n",
    }]
    findings = _scan_pr_files_for_findings(files, "all")
    security = [f for f in findings if f["category"] == "security"]
    assert len(security) >= 1


def test_scan_finds_hardcoded_creds():
    """检测硬编码凭证(api_key/secret/token/password)。"""
    files = [{
        "filename": "config.py",
        "patch": '+api_key = "sk-1234567890abcdef"\n',
    }]
    findings = _scan_pr_files_for_findings(files, "all")
    security = [f for f in findings if f["category"] == "security"]
    assert len(security) >= 1


# =============================================================================
# _scan_pr_files_for_findings:性能检测
# =============================================================================


def test_scan_finds_nested_loops():
    """检测嵌套循环 O(n²)。"""
    files = [{
        "filename": "slow.py",
        "patch": "+for i in items:\n+    for j in items:\n+        pass\n",
    }]
    findings = _scan_pr_files_for_findings(files, "all")
    perf = [f for f in findings if f["category"] == "performance"]
    assert len(perf) >= 1
    assert perf[0]["severity"] == "medium"


def test_scan_finds_n_plus_1_query():
    """检测 N+1 查询模式(循环内 execute)。"""
    files = [{
        "filename": "db.py",
        "patch": "+for item in items:\n+    cursor.execute(sql)\n",
    }]
    findings = _scan_pr_files_for_findings(files, "all")
    perf = [f for f in findings if f["category"] == "performance"]
    assert len(perf) >= 1


# =============================================================================
# _scan_pr_files_for_findings:可读性检测
# =============================================================================


def test_scan_finds_large_file():
    """检测大文件(新增 > 500 行)。"""
    patch_lines = "+" + "x\n" + "+x\n" * 501
    files = [{"filename": "big.py", "patch": patch_lines}]
    findings = _scan_pr_files_for_findings(files, "all")
    readability = [f for f in findings if f["category"] == "readability"]
    assert len(readability) >= 1
    assert readability[0]["severity"] == "low"


def test_scan_small_file_no_readability_finding():
    """小文件(新增 < 500 行)不触发 readability finding。"""
    files = [{"filename": "small.py", "patch": "+x\n" * 10}]
    findings = _scan_pr_files_for_findings(files, "all")
    readability = [f for f in findings if f["category"] == "readability"]
    assert len(readability) == 0


# =============================================================================
# _scan_pr_files_for_findings:focus 过滤
# =============================================================================


def test_scan_focus_security_only():
    """focus=security 只返回安全 finding。"""
    files = [{
        "filename": "x.py",
        "patch": "+eval(x)\n+for i in a:\n+    for j in b:\n+        pass\n",
    }]
    findings = _scan_pr_files_for_findings(files, "security")
    categories = {f["category"] for f in findings}
    assert categories == {"security"}


def test_scan_focus_performance_only():
    """focus=performance 只返回性能 finding。"""
    files = [{
        "filename": "x.py",
        "patch": "+eval(x)\n+for i in a:\n+    for j in b:\n+        pass\n",
    }]
    findings = _scan_pr_files_for_findings(files, "performance")
    categories = {f["category"] for f in findings}
    assert categories == {"performance"}


def test_scan_focus_all():
    """focus=all 返回所有类别。"""
    files = [{
        "filename": "x.py",
        "patch": "+eval(x)\n+for i in a:\n+    for j in b:\n+        pass\n",
    }]
    findings = _scan_pr_files_for_findings(files, "all")
    categories = {f["category"] for f in findings}
    assert "security" in categories
    assert "performance" in categories


def test_scan_skips_empty_patch():
    """空 patch 的文件被跳过。"""
    files = [{"filename": "empty.py", "patch": ""}]
    findings = _scan_pr_files_for_findings(files, "all")
    assert findings == []


# =============================================================================
# _tool_review_pr:diff 字符串模式
# =============================================================================


async def test_review_pr_diff_string_mode():
    """diff 参数模式返回 source=diff_string。"""
    diff = (
        "+++ b/test.py\n"
        "@@ -1,3 +1,4 @@\n"
        " context\n"
        "-old line\n"
        "+new line\n"
    )
    out = await _tool_review_pr({"diff": diff})
    assert out["tool"] == "review_pr"
    assert out["ok"] is True
    assert out["source"] == "diff_string"
    assert out["pr_url"] is None
    assert out["files_reviewed"] == 1
    assert "findings" in out
    assert "summary" in out


async def test_review_pr_diff_string_with_security_finding():
    """diff 字符串模式检测到安全 finding。"""
    diff = "+++ b/evil.py\n+result = eval(user_input)\n"
    out = await _tool_review_pr({"diff": diff, "focus": "security"})
    assert out["ok"] is True
    security_findings = [f for f in out["findings"] if f["category"] == "security"]
    assert len(security_findings) >= 1
    assert security_findings[0]["severity"] == "high"


async def test_review_pr_diff_string_stats():
    """diff 字符串模式返回统计字段。"""
    diff = (
        "+++ b/a.py\n"
        "+added1\n"
        "+added2\n"
        "-removed1\n"
    )
    out = await _tool_review_pr({"diff": diff})
    assert out["ok"] is True
    assert out["files_changed"] == 1
    assert out["added_lines"] == 2
    assert out["removed_lines"] == 1
    assert "complexity_score" in out
    assert "risk_assessment" in out


async def test_review_pr_max_files_limit():
    """max_files 限制扫描文件数。"""
    diff = ""
    for i in range(10):
        diff += f"+++ b/file{i}.py\n+line{i}\n"
    out = await _tool_review_pr({"diff": diff, "max_files": 3})
    assert out["ok"] is True
    assert out["files_reviewed"] <= 3


# =============================================================================
# _tool_review_pr:参数校验
# =============================================================================


async def test_review_pr_missing_params():
    """缺少 repo+pr_number 和 diff → MISSING_PARAMS。"""
    out = await _tool_review_pr({})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


async def test_review_pr_invalid_focus():
    """无效 focus → INVALID_PARAMS。"""
    out = await _tool_review_pr({"diff": "+++ b/x.py\n", "focus": "invalid"})
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"


async def test_review_pr_invalid_pr_number_string():
    """pr_number 非数字 → INVALID_PARAMS。"""
    out = await _tool_review_pr({
        "repo": "owner/repo",
        "pr_number": "abc",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"


async def test_review_pr_invalid_pr_number_zero():
    """pr_number=0 → INVALID_PARAMS。"""
    out = await _tool_review_pr({
        "repo": "owner/repo",
        "pr_number": 0,
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"


async def test_review_pr_invalid_pr_number_negative():
    """pr_number=-1 → INVALID_PARAMS。"""
    out = await _tool_review_pr({
        "repo": "owner/repo",
        "pr_number": -1,
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"


async def test_review_pr_repo_without_slash():
    """repo 无 / → 走 diff 模式或 MISSING_PARAMS。"""
    # repo="owner" 无 / → use_github=False, 无 diff → MISSING_PARAMS
    out = await _tool_review_pr({"repo": "owner", "pr_number": 1})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


# =============================================================================
# _tool_review_pr:GitHub API 模式(mock httpx)
# =============================================================================


_DIFF_TEXT = (
    "diff --git a/foo.py b/foo.py\n"
    "--- a/foo.py\n"
    "+++ b/foo.py\n"
    "@@ -1,3 +1,4 @@\n"
    " def foo():\n"
    "-    return 1\n"
    "+    return 2\n"
    "+    pass\n"
)

_PR_JSON = {
    "title": "Fix foo function",
    "user": {"login": "octocat"},
    "additions": 2,
    "deletions": 1,
}

_PR_FILES_JSON = [
    {"filename": "foo.py", "patch": "+def foo():\n+    return 2\n"},
]


async def test_review_pr_github_api_success(monkeypatch):
    """GitHub API 成功获取 PR metadata + diff + files。"""
    responses = {
        "/pulls/42": [
            _FakeResponse(200, _PR_JSON, ""),         # JSON metadata (第一次 GET)
            _FakeResponse(200, {}, _DIFF_TEXT),        # diff (第二次 GET, Accept: diff)
        ],
        "/files": _FakeResponse(200, _PR_FILES_JSON),
    }
    client = _mock_httpx(monkeypatch, responses)

    # 清缓存确保走 API
    cache_key = "github:pr:owner/repo:42:diff"
    _PR_DIFF_CACHE.pop(cache_key, None)

    out = await _tool_review_pr({"repo": "owner/repo", "pr_number": 42})

    assert out["tool"] == "review_pr"
    assert out["ok"] is True
    assert out["source"] == "github_api"
    assert out["repo"] == "owner/repo"
    assert out["pr_number"] == 42
    assert out["pr_url"] == "https://github.com/owner/repo/pull/42"
    assert out["title"] == "Fix foo function"
    assert out["author"] == "octocat"
    assert out["additions"] == 2
    assert out["deletions"] == 1
    # diff 被解析
    assert out["files_changed"] >= 1
    # 验证至少调用了 3 次 GET(metadata + diff + files)
    assert len(client.requests) >= 3


async def test_review_pr_github_api_bearer_auth(monkeypatch):
    """GITHUB_TOKEN 设置时 Authorization: Bearer header 被发送。"""
    monkeypatch.setenv("GITHUB_TOKEN", "ghp_test_token_123")
    responses = {
        "/pulls/1": [
            _FakeResponse(200, _PR_JSON, ""),
            _FakeResponse(200, {}, _DIFF_TEXT),
        ],
        "/files": _FakeResponse(200, _PR_FILES_JSON),
    }
    client = _mock_httpx(monkeypatch, responses)
    _PR_DIFF_CACHE.pop("github:pr:test/repo:1:diff", None)

    await _tool_review_pr({"repo": "test/repo", "pr_number": 1})

    # 所有请求都应携带 Authorization header
    for method, headers in client.requests:
        assert headers.get("Authorization") == "Bearer ghp_test_token_123"


async def test_review_pr_github_api_no_token_no_auth(monkeypatch):
    """无 GITHUB_TOKEN 时不发送 Authorization header(匿名限速)。"""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    responses = {
        "/pulls/1": [
            _FakeResponse(200, _PR_JSON, ""),
            _FakeResponse(200, {}, _DIFF_TEXT),
        ],
        "/files": _FakeResponse(200, _PR_FILES_JSON),
    }
    client = _mock_httpx(monkeypatch, responses)
    _PR_DIFF_CACHE.pop("github:pr:test/repo:1:diff", None)

    await _tool_review_pr({"repo": "test/repo", "pr_number": 1})

    for method, headers in client.requests:
        assert "Authorization" not in headers


async def test_review_pr_github_api_diff_accept_header(monkeypatch):
    """diff 请求携带 Accept: application/vnd.github.v3.diff。"""
    responses = {
        "/pulls/1": [
            _FakeResponse(200, _PR_JSON, ""),
            _FakeResponse(200, {}, _DIFF_TEXT),
        ],
        "/files": _FakeResponse(200, _PR_FILES_JSON),
    }
    client = _mock_httpx(monkeypatch, responses)
    _PR_DIFF_CACHE.pop("github:pr:test/repo:1:diff", None)

    await _tool_review_pr({"repo": "test/repo", "pr_number": 1})

    # 第二次请求是 diff 请求,应携带 diff Accept header
    if len(client.requests) >= 2:
        _, diff_headers = client.requests[1]
        assert diff_headers.get("Accept") == "application/vnd.github.v3.diff"


async def test_review_pr_github_api_401(monkeypatch):
    """GitHub API 401 → GITHUB_AUTH_FAILED。"""
    responses = {"/pulls/1": _FakeResponse(401, {}, "Unauthorized")}
    _mock_httpx(monkeypatch, responses)
    _PR_DIFF_CACHE.pop("github:pr:owner/repo:1:diff", None)

    out = await _tool_review_pr({"repo": "owner/repo", "pr_number": 1})
    assert out["ok"] is False
    assert out["errorCode"] == "GITHUB_AUTH_FAILED"


async def test_review_pr_github_api_404(monkeypatch):
    """GitHub API 404 → PR_NOT_FOUND。"""
    responses = {"/pulls/999": _FakeResponse(404, {}, "Not Found")}
    _mock_httpx(monkeypatch, responses)
    _PR_DIFF_CACHE.pop("github:pr:owner/repo:999:diff", None)

    out = await _tool_review_pr({"repo": "owner/repo", "pr_number": 999})
    assert out["ok"] is False
    assert out["errorCode"] == "PR_NOT_FOUND"


async def test_review_pr_github_api_500(monkeypatch):
    """GitHub API 500 → GITHUB_API_ERROR。"""
    responses = {"/pulls/1": _FakeResponse(500, {}, "Server Error")}
    _mock_httpx(monkeypatch, responses)
    _PR_DIFF_CACHE.pop("github:pr:owner/repo:1:diff", None)

    out = await _tool_review_pr({"repo": "owner/repo", "pr_number": 1})
    assert out["ok"] is False
    assert out["errorCode"] == "GITHUB_API_ERROR"


async def test_review_pr_github_api_diff_404(monkeypatch):
    """diff 端点 404(metadata 成功但 diff 失败)→ PR_NOT_FOUND。"""
    responses = {
        "/pulls/1": [
            _FakeResponse(200, _PR_JSON, ""),    # metadata OK
            _FakeResponse(404, {}, "Not Found"),  # diff 404
        ],
    }
    _mock_httpx(monkeypatch, responses)
    _PR_DIFF_CACHE.pop("github:pr:owner/repo:1:diff", None)

    out = await _tool_review_pr({"repo": "owner/repo", "pr_number": 1})
    assert out["ok"] is False
    assert out["errorCode"] == "PR_NOT_FOUND"


# =============================================================================
# _tool_review_pr:缓存命中(不重复调 API)
# =============================================================================


async def test_review_pr_cache_hit_skips_api_call(monkeypatch):
    """缓存命中时不调用 diff API(但仍调用 metadata/files)。"""
    cache_key = "github:pr:test/cache:5:diff"
    _PR_DIFF_CACHE[cache_key] = (_DIFF_TEXT, time.time())  # 预置缓存

    call_count = {"diff_calls": 0}
    diff_response = _FakeResponse(200, {}, _DIFF_TEXT)
    metadata_response = _FakeResponse(200, _PR_JSON, "")
    files_response = _FakeResponse(200, _PR_FILES_JSON)

    class _CountingClient(_FakeAsyncClient):
        async def get(self, url, headers=None):
            if "application/vnd.github.v3.diff" in (headers or {}).get("Accept", ""):
                call_count["diff_calls"] += 1
            return await super().get(url, headers)

    import sys
    import types

    fake_mod = types.ModuleType("httpx")
    counting_client = _CountingClient({
        "/pulls/5": [metadata_response, diff_response],
        "/files": files_response,
    })
    fake_mod.AsyncClient = lambda **kwargs: counting_client
    monkeypatch.setitem(sys.modules, "httpx", fake_mod)

    out = await _tool_review_pr({"repo": "test/cache", "pr_number": 5})
    assert out["ok"] is True
    assert out["source"] == "github_api"
    # diff API 不应被调用(缓存命中)
    assert call_count["diff_calls"] == 0

    _PR_DIFF_CACHE.pop(cache_key, None)


async def test_review_pr_cache_populated_after_api_call(monkeypatch):
    """API 调用后缓存被填充。"""
    cache_key = "github:pr:test/cache:7:diff"
    _PR_DIFF_CACHE.pop(cache_key, None)

    responses = {
        "/pulls/7": [
            _FakeResponse(200, _PR_JSON, ""),
            _FakeResponse(200, {}, _DIFF_TEXT),
        ],
        "/files": _FakeResponse(200, _PR_FILES_JSON),
    }
    _mock_httpx(monkeypatch, responses)

    out = await _tool_review_pr({"repo": "test/cache", "pr_number": 7})
    assert out["ok"] is True
    # 缓存应被填充
    assert cache_key in _PR_DIFF_CACHE
    assert _PR_DIFF_CACHE[cache_key][0] == _DIFF_TEXT

    _PR_DIFF_CACHE.pop(cache_key, None)


# =============================================================================
# _tool_review_pr:httpx 缺失
# =============================================================================


async def test_review_pr_httpx_missing(monkeypatch):
    """httpx 未安装 → DEP_MISSING。"""
    import sys

    monkeypatch.setitem(sys.modules, "httpx", None)
    _PR_DIFF_CACHE.pop("github:pr:owner/repo:1:diff", None)

    out = await _tool_review_pr({"repo": "owner/repo", "pr_number": 1})
    assert out["ok"] is False
    assert out["errorCode"] == "DEP_MISSING"


# =============================================================================
# _build_review_result helper
# =============================================================================


def test_build_review_result_basic():
    """_build_review_result 组装完整返回结构。"""
    stats = {
        "files_changed": 3,
        "added_lines": 50,
        "removed_lines": 10,
        "complexity_score": 90,
        "risk_assessment": "medium",
    }
    findings = [
        {"severity": "high", "category": "security"},
        {"severity": "medium", "category": "performance"},
        {"severity": "low", "category": "readability"},
    ]
    result = _build_review_result(
        repo="owner/repo", pr_number=42, source="github_api",
        pr_url="https://github.com/owner/repo/pull/42",
        title="Test PR", author="octocat",
        additions=50, deletions=10,
        files_reviewed=3, findings=findings, stats=stats, focus="all",
    )
    assert result["tool"] == "review_pr"
    assert result["ok"] is True
    assert result["repo"] == "owner/repo"
    assert result["pr_number"] == 42
    assert result["source"] == "github_api"
    assert result["pr_url"] == "https://github.com/owner/repo/pull/42"
    assert result["title"] == "Test PR"
    assert result["author"] == "octocat"
    assert result["files_reviewed"] == 3
    assert result["files_changed"] == 3
    assert result["added_lines"] == 50
    assert result["removed_lines"] == 10
    assert result["complexity_score"] == 90
    assert result["risk_assessment"] == "medium"
    assert result["findings"] == findings
    assert "1 个 high" in result["summary"]
    assert "1 个 medium" in result["summary"]
    assert "1 个 low" in result["summary"]


def test_build_review_result_empty_findings():
    """无 finding 时 summary 显示 0。"""
    stats = {
        "files_changed": 0, "added_lines": 0, "removed_lines": 0,
        "complexity_score": 0, "risk_assessment": "low",
    }
    result = _build_review_result(
        repo="", pr_number=None, source="diff_string", pr_url=None,
        title="", author="", additions=0, deletions=0,
        files_reviewed=0, findings=[], stats=stats, focus="all",
    )
    assert "0 个 high" in result["summary"]
    assert "0 个 medium" in result["summary"]
    assert "0 个 low" in result["summary"]


# =============================================================================
# 集成:diff 模式 + GitHub 模式对比
# =============================================================================


async def test_review_pr_diff_string_pr_number_none():
    """diff 字符串模式 pr_number=None(不是 int)。"""
    diff = "+++ b/x.py\n+x\n"
    out = await _tool_review_pr({"diff": diff})
    assert out["pr_number"] is None
    assert out["source"] == "diff_string"

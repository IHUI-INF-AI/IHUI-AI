"""PR 评审器 — 调 GitHub API 获取 PR diff + LLM 分析。

对标 Codex review_pr 工具,解决"仅静态分析"问题。
无 github_token 时降级匿名调用(60 req/h 限流)。
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings
from app.core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

_GITHUB_API = "https://api.github.com"

# LLM 分析用的默认模型(与 agent_graph 同源,fast 便宜够用)
_REVIEW_MODEL = "stepfun/step-3.7-flash"

# diff 过长截断阈值(LLM 上下文有限,超出截断)
_MAX_DIFF_CHARS = 12000

# unified diff 行解析正则
_DIFF_FILE_HEADER = re.compile(r"^diff --git a/(.+?) b/(.+)$")
_DIFF_HUNK_START = re.compile(r"^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@")


async def fetch_pr_diff(
    repo: str,
    pr_number: int,
    github_token: str | None = None,
) -> dict[str, Any]:
    """获取 PR diff + 元数据。

    Args:
        repo: "owner/name" 格式
        pr_number: PR 编号
        github_token: 可选(无则匿名 60 req/h)

    Returns:
        成功:{ok, repo, pr_number, diff, files_changed, additions, deletions,
              commits, title, author, html_url, rate_limit}
        失败:{ok: False, errorCode, message}
    """
    if not repo or "/" not in repo:
        return {
            "ok": False, "errorCode": "INVALID_REPO",
            "message": "repo 格式应为 owner/name",
        }
    if pr_number <= 0:
        return {
            "ok": False, "errorCode": "INVALID_PR",
            "message": "pr_number 必须 > 0",
        }

    token = github_token or getattr(settings, "github_token", "") or None
    headers: dict[str, str] = {"Accept": "application/vnd.github.v3.diff"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{_GITHUB_API}/repos/{repo}/pulls/{pr_number}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            diff_resp = await client.get(url, headers=headers)
            if diff_resp.status_code == 404:
                return {
                    "ok": False, "errorCode": "PR_NOT_FOUND",
                    "message": f"PR {repo}#{pr_number} 不存在",
                }
            if diff_resp.status_code == 403 and "rate limit" in diff_resp.text.lower():
                return {
                    "ok": False, "errorCode": "RATE_LIMITED",
                    "message": "GitHub API 限流",
                }
            if diff_resp.status_code != 200:
                return {
                    "ok": False, "errorCode": "FETCH_FAILED",
                    "message": f"GitHub API 返回 {diff_resp.status_code}",
                }
            diff_text = diff_resp.text

            # 元数据(best-effort,失败不影响 diff)
            meta: dict[str, Any] = {}
            try:
                meta_resp = await client.get(
                    url,
                    headers={**headers, "Accept": "application/vnd.github+json"},
                )
                if meta_resp.status_code == 200:
                    meta = meta_resp.json()
            except Exception:
                pass
    except httpx.HTTPError as e:
        return {"ok": False, "errorCode": "FETCH_FAILED", "message": f"网络错误: {e}"}
    except Exception as e:
        return {"ok": False, "errorCode": "FETCH_FAILED", "message": f"异常: {e}"}

    return {
        "ok": True,
        "repo": repo,
        "pr_number": pr_number,
        "diff": diff_text,
        "files_changed": meta.get("changed_files", 0),
        "additions": meta.get("additions", 0),
        "deletions": meta.get("deletions", 0),
        "commits": meta.get("commits", 0),
        "title": meta.get("title", ""),
        "author": (meta.get("user") or {}).get("login", ""),
        "html_url": meta.get("html_url", ""),
        "rate_limit": "anonymous" if not token else "authenticated",
    }


def parse_diff(diff: str) -> dict[str, Any]:
    """解析 unified diff,返回文件级统计。

    Returns:
        {files: [{filename, additions, deletions, chunks}],
         total_additions, total_deletions, total_chunks}
    """
    files: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    total_add = 0
    total_del = 0
    total_chunks = 0

    for line in diff.splitlines():
        m = _DIFF_FILE_HEADER.match(line)
        if m:
            if current is not None:
                files.append(current)
            current = {
                "filename": m.group(2),
                "additions": 0,
                "deletions": 0,
                "chunks": 0,
            }
            continue
        if current is None:
            continue
        if _DIFF_HUNK_START.match(line):
            current["chunks"] = current["chunks"] + 1
            total_chunks += 1
            continue
        if line.startswith("+") and not line.startswith("+++"):
            current["additions"] = current["additions"] + 1
            total_add += 1
        elif line.startswith("-") and not line.startswith("---"):
            current["deletions"] = current["deletions"] + 1
            total_del += 1

    if current is not None:
        files.append(current)

    return {
        "files": files,
        "total_additions": total_add,
        "total_deletions": total_del,
        "total_chunks": total_chunks,
    }


async def review_pr(
    repo: str,
    pr_number: int,
    github_token: str | None = None,
    focus: list[str] | None = None,
) -> dict[str, Any]:
    """完整 PR review 流程:fetch diff → LLM 分析 → 结构化结果。

    Args:
        focus: 关注维度,可选 ["security", "performance", "style", "bugs"]

    Returns:
        {ok, repo, pr_number, summary, issues, stats, diff_truncated, rate_limit?}
        或透传 fetch_pr_diff 的错误响应。
    """
    fetch = await fetch_pr_diff(repo, pr_number, github_token)
    if not fetch.get("ok"):
        return fetch

    diff = fetch["diff"]
    parsed = parse_diff(diff)
    focus_dims = focus or ["security", "performance", "style", "bugs"]

    truncated = False
    if len(diff) > _MAX_DIFF_CHARS:
        diff = diff[:_MAX_DIFF_CHARS]
        truncated = True

    prompt = [
        {
            "role": "system",
            "content": (
                "你是代码评审专家。基于 PR diff 输出结构化评审,关注维度: "
                + ", ".join(focus_dims)
                + "。输出严格 JSON: "
                '{"summary": str, "issues": [{"severity": "high|medium|low", '
                '"file": str, "line": str, "message": str, "suggestion": str}]}。'
                "severity 取值:high(必须修复)/ medium(建议修复)/ low(提示)。"
                "无问题时 issues 为空数组。只输出 JSON,不要其他文字。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"PR: {repo}#{pr_number}\n"
                f"标题: {fetch.get('title', '')}\n"
                f"作者: {fetch.get('author', '')}\n"
                f"文件变更: +{fetch.get('additions', 0)} -{fetch.get('deletions', 0)}\n\n"
                f"diff:\n{diff}"
            ),
        },
    ]

    try:
        result = await llm_gateway.complete(prompt, model=_REVIEW_MODEL)
        content = result.get("content", "") if isinstance(result, dict) else str(result)
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        review = json.loads(cleaned)
    except Exception as e:
        logger.warning("review_pr LLM 分析失败: %s", e)
        review = {
            "summary": f"LLM 分析失败: {e}",
            "issues": [],
            "llm_failed": True,
        }

    return {
        "ok": True,
        "repo": repo,
        "pr_number": pr_number,
        "summary": review.get("summary", ""),
        "issues": review.get("issues", []),
        "stats": {
            "files_changed": fetch.get("files_changed", 0),
            "additions": fetch.get("additions", 0),
            "deletions": fetch.get("deletions", 0),
            "commits": fetch.get("commits", 0),
            "diff_truncated": truncated,
            "total_chunks": parsed.get("total_chunks", 0),
        },
        "diff_truncated": truncated,
        "rate_limit": fetch.get("rate_limit"),
    }

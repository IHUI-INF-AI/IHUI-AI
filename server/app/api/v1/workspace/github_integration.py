"""
GitHub PR 集成 — 对标 Codex 的 GitHub PR 集成能力。

提供:
- GitHubClient: 封装 GitHub REST API (v3) 调用
  - 自动检测 GitHub remote URL 解析 owner/repo
  - create_pr / list_prs / get_pr / add_pr_comment / request_review / merge_pr
- Token 来源: 环境变量 GITHUB_TOKEN 或 ~/.ihui/github_token
- 无 token 时降级为 git CLI 命令 (分支检测/推送等基础操作; PR 专属操作需 token)

依赖: httpx (已在 venv 中安装)
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import Any

import httpx

# GitHub REST API (v3) 基地址
GITHUB_API_BASE = "https://api.github.com"


# ---------------------------------------------------------------------------
# Token 读取
# ---------------------------------------------------------------------------

def load_github_token() -> str:
    """读取 GitHub token。

    优先级:
    1. 环境变量 GITHUB_TOKEN
    2. ~/.ihui/github_token 文件

    Returns:
        token 字符串 (无则返回空字符串)
    """
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        return token

    token_file = Path.home() / ".ihui" / "github_token"
    if token_file.exists():
        try:
            return token_file.read_text(encoding="utf-8").strip()
        except Exception:
            return ""
    return ""


# ---------------------------------------------------------------------------
# Remote URL 解析
# ---------------------------------------------------------------------------

# 支持 HTTPS 与 SSH 两种 GitHub remote 格式
_REMOTE_HTTPS_RE = re.compile(r"https?://github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?(?:\#.*)?$")
_REMOTE_SSH_RE = re.compile(r"git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$")


def parse_github_remote(url: str) -> tuple[str, str] | None:
    """解析 GitHub remote URL, 返回 (owner, repo) 或 None。

    支持:
    - HTTPS: https://github.com/owner/repo.git
    - SSH:   git@github.com:owner/repo.git
    """
    url = url.strip()
    m = _REMOTE_HTTPS_RE.search(url) or _REMOTE_SSH_RE.search(url)
    if m:
        return m.group(1), m.group(2)
    return None


# ---------------------------------------------------------------------------
# GitHubClient
# ---------------------------------------------------------------------------

class GitHubClient:
    """GitHub API 客户端 — 封装 PR 相关操作。

    优先使用 GitHub REST API (需 token); 无 token 时仅保留 git CLI 能力
    (如 current_branch / 推送提示), PR 专属操作会返回明确的错误提示。

    所有 PR 操作均为 async (供 Agent 工具 / slash 命令 await 调用)。
    """

    def __init__(self, workspace: str, token: str | None = None) -> None:
        self.workspace = workspace
        # token=None 时自动从环境变量/文件读取; 显式传空串则视为无 token
        self.token = token if token is not None else load_github_token()
        self._owner_repo: tuple[str, str] | None = None

    # --- 状态属性 ---

    @property
    def has_token(self) -> bool:
        """是否已配置有效 token。"""
        return bool(self.token)

    @property
    def owner_repo(self) -> tuple[str, str] | None:
        """懒加载解析 (owner, repo), 失败返回 None。"""
        if self._owner_repo is None:
            self._owner_repo = self._detect_owner_repo()
        return self._owner_repo

    # --- git CLI 辅助 (无需 token) ---

    def _run_git(self, args: list[str]) -> tuple[str, str, int]:
        """在 workspace 执行 git 命令, 返回 (stdout, stderr, returncode)。"""
        try:
            proc = subprocess.run(
                ["git"] + args,
                cwd=self.workspace,
                capture_output=True,
                text=True,
                timeout=15,
            )
            return proc.stdout, proc.stderr, proc.returncode
        except Exception as e:
            return "", str(e), -1

    def _detect_owner_repo(self) -> tuple[str, str] | None:
        """从 git remote origin 解析 owner/repo。"""
        stdout, _, code = self._run_git(["remote", "get-url", "origin"])
        if code != 0:
            return None
        return parse_github_remote(stdout)

    def current_branch(self) -> str:
        """获取当前分支名 (git CLI, 无需 token)。失败返回空串。"""
        stdout, _, code = self._run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        if code != 0:
            return ""
        return stdout.strip()

    def default_branch(self) -> str:
        """推测默认分支 (优先远程 HEAD, 回退 main/master)。"""
        stdout, _, code = self._run_git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
        if code == 0 and stdout.strip():
            # 形如 origin/main → 取 main
            return stdout.strip().split("/", 1)[-1]
        # 回退: 检查本地是否存在 main / master
        for cand in ("main", "master"):
            _, _, c = self._run_git(["rev-parse", "--verify", cand])
            if c == 0:
                return cand
        return "main"

    # --- HTTP 请求封装 ---

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "IHUI-Agent/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _repo_path(self) -> str:
        """返回 API 路径段 repos/{owner}/{repo}, 失败抛 ValueError。"""
        if not self.owner_repo:
            raise ValueError(
                "无法解析 GitHub owner/repo (请确认 git remote origin 指向 GitHub 仓库)"
            )
        owner, repo = self.owner_repo
        return f"repos/{owner}/{repo}"

    async def _arequest(
        self, method: str, path: str, **kwargs: Any
    ) -> dict[str, Any]:
        """异步请求 GitHub API。

        Returns:
            {"status_code": int, "data": Any, "ok": bool}
        """
        url = f"{GITHUB_API_BASE}/{path.lstrip('/')}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, url, headers=self._headers(), **kwargs)
        try:
            data = resp.json() if resp.content else {}
        except Exception:
            data = {"raw": resp.text}
        return {
            "status_code": resp.status_code,
            "data": data,
            "ok": resp.status_code < 400,
        }

    # --- PR 操作 ---

    async def create_pr(
        self, title: str, body: str, head: str, base: str
    ) -> dict[str, Any]:
        """创建 PR。

        Args:
            title: PR 标题
            body:  PR 正文 (Markdown)
            head:  源分支 (要合并的分支)
            base:  目标分支
        """
        payload = {"title": title, "body": body, "head": head, "base": base}
        return await self._arequest("POST", f"{self._repo_path()}/pulls", json=payload)

    async def list_prs(self, state: str = "open") -> dict[str, Any]:
        """列出 PR。state: open|closed|all。"""
        return await self._arequest(
            "GET",
            f"{self._repo_path()}/pulls",
            params={"state": state, "per_page": 30},
        )

    async def get_pr(self, number: int) -> dict[str, Any]:
        """获取 PR 详情。"""
        return await self._arequest("GET", f"{self._repo_path()}/pulls/{number}")

    async def add_pr_comment(self, number: int, body: str) -> dict[str, Any]:
        """在指定 PR (Issue) 上添加评论。"""
        return await self._arequest(
            "POST",
            f"{self._repo_path()}/issues/{number}/comments",
            json={"body": body},
        )

    async def request_review(
        self, number: int, reviewers: list[str]
    ) -> dict[str, Any]:
        """向指定 PR 请求审查者。"""
        return await self._arequest(
            "POST",
            f"{self._repo_path()}/pulls/{number}/requested_reviewers",
            json={"reviewers": reviewers},
        )

    async def merge_pr(self, number: int, method: str = "squash") -> dict[str, Any]:
        """合并 PR。method: merge|squash|rebase。"""
        return await self._arequest(
            "PUT",
            f"{self._repo_path()}/pulls/{number}/merge",
            json={"merge_method": method},
        )


# ---------------------------------------------------------------------------
# 结果格式化辅助 (供 tools.py / slash_commands.py 复用)
# ---------------------------------------------------------------------------

def format_pr_brief(pr: dict[str, Any]) -> str:
    """将 PR 对象格式化为单行摘要。"""
    number = pr.get("number", "?")
    title = pr.get("title", "(无标题)")
    author = pr.get("user", {}).get("login", "?") if isinstance(pr.get("user"), dict) else "?"
    head = pr.get("head", {}).get("ref", "?") if isinstance(pr.get("head"), dict) else "?"
    state = pr.get("state", "?")
    return f"#{number} [{state}] {title} — @{author} ({head})"


def format_pr_detail(pr: dict[str, Any]) -> str:
    """将 PR 对象格式化为多行详情。"""
    number = pr.get("number", "?")
    title = pr.get("title", "(无标题)")
    state = pr.get("state", "?")
    author = pr.get("user", {}).get("login", "?") if isinstance(pr.get("user"), dict) else "?"
    head = pr.get("head", {}).get("ref", "?") if isinstance(pr.get("head"), dict) else "?"
    base = pr.get("base", {}).get("ref", "?") if isinstance(pr.get("base"), dict) else "?"
    url = pr.get("html_url", "")
    body = pr.get("body") or "(无描述)"
    if len(body) > 1500:
        body = body[:1500] + "\n... (正文已截断)"
    lines = [
        f"PR #{number}: {title}",
        f"状态: {state} | 作者: @{author}",
        f"分支: {head} → {base}",
    ]
    if url:
        lines.append(f"URL: {url}")
    lines.append("")
    lines.append(body)
    return "\n".join(lines)


def token_missing_message() -> str:
    """返回统一的缺少 token 提示。"""
    return (
        "未配置 GitHub Token, 无法调用 GitHub API。请通过以下方式之一配置:\n"
        "  1. 设置环境变量 GITHUB_TOKEN\n"
        "  2. 将 token 写入 ~/.ihui/github_token 文件"
    )

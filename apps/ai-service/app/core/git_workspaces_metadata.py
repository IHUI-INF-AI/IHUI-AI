# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:git workspaces 元数据采集 — 对标 codex turn_metadata.rs 的 git enrichment。

WorkspaceGitMetadata:repo_root -> {associated_remote_urls(脱敏), latest_git_commit_hash, has_changes}。
采集纯函数 collect_git_workspaces(cwd):git 命令超时/失败静默降级返回空(逐字段 Option 语义)。
MEMORY_GIT_METADATA_TIMEOUT=1s(memory 请求限时等待,由调用方施加上限)。
SanitizedGitUrl:剥离凭据(user 除 ssh 的 git@、全部 password),helper 前缀(peel `transport::`),
file:// authority 全保留,无凭据时保留原文精确形态。
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from typing import Any

MEMORY_GIT_METADATA_TIMEOUT = 1.0  # 秒;memory 请求限时等待的上限
_GIT_TIMEOUT = 5.0  # 单条 git 命令超时(采集任务整体由调用方包装)


@dataclass
class SanitizedGitUrl:
    """脱敏后的 git remote URL。原始 URL 无凭据时保留精确原文。"""

    value: str


def sanitize_git_url(url: str) -> SanitizedGitUrl | None:
    """对标 protocol/src/sanitized_git_url.rs TryFrom<&str>:
    ① peel 远程 helper 前缀(`transport::` 迭代,transport 限 [A-Za-z0-9+-.];
       首段含空白 → 拒绝(helper 可能携带任意命令行));
    ② `scheme://authority/path`:authority 含 @ 时剥除 user[:password]@,
       但 ssh + git 用户 + 无密码 视为传输身份保留;其余凭据剥除;
    ③ SCP 形态(user@host:path):仅剥 `user@` 保留 `host:path`;
    ④ 无凭据 → 返回原文。
    """
    original = url
    address = url
    while True:
        parts = address.split("::", 1)
        if len(parts) != 2:
            break
        transport, nested = parts
        if not transport:
            break
        if not all(c.isascii() and (c.isalnum() or c in "+-.") for c in transport):
            break
        if len(address) == len(url) and any(c.isspace() for c in nested):
            return None
        address = nested
    helper_prefix = url[: len(url) - len(address)]
    value = address

    def _authority_view(u: str) -> tuple[str, str, str] | None:
        if "://" not in u:
            return None
        scheme, authority_and_path = u.split("://", 1)
        idx = authority_and_path.find("/")
        if idx < 0:
            authority, path = authority_and_path, ""
        else:
            authority, path = authority_and_path[:idx], authority_and_path[idx:]
        return scheme, authority, path

    av = _authority_view(value)
    if av is not None:
        scheme, authority, path = av
        if "@" not in authority:
            return SanitizedGitUrl(original)
        # scheme ssh 且 user==git 且无 password → 保留
        user_part = authority.rsplit("@", 1)[0]
        is_ssh_git = scheme == "ssh" and user_part == "git"
        if is_ssh_git and ":" not in user_part:
            return SanitizedGitUrl(original)
        host = authority.rsplit("@", 1)[1]
        preserved_user = "git@" if is_ssh_git else ""
        return SanitizedGitUrl(f"{helper_prefix}{scheme}://{preserved_user}{host}{path}")

    # SCP 形态:user@host:path(存在 @ 在第一个冒号前)
    colon = value.find(":")
    if colon > 0 and "@" in value[:colon]:
        user_end = value[:colon].rfind("@")
        return SanitizedGitUrl(f"{helper_prefix}{value[user_end + 1 :]}")

    # Rust 语义兜底:URL 解析失败(无 scheme://)且无 SCP user@ → invalid git remote URL。
    if "://" not in value and ":" in value:
        return None

    # 无凭据形态(https://x.y/repo.git 等已在 ② 处理;此处为纯 host:path 无 @)
    return SanitizedGitUrl(original)


@dataclass
class WorkspaceGitMetadata:
    associated_remote_urls: dict[str, str] | None = None
    latest_git_commit_hash: str | None = None
    has_changes: bool | None = None

    def is_empty(self) -> bool:
        return (
            self.associated_remote_urls is None
            and self.latest_git_commit_hash is None
            and self.has_changes is None
        )


@dataclass
class WorkspacesSnapshot:
    """repo_root -> metadata 的有序映射快照。"""

    workspaces: dict[str, WorkspaceGitMetadata] = field(default_factory=dict)


def _run_git(args: list[str], cwd: str, timeout: float) -> str | None:
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout.strip()


def collect_git_workspaces(cwd: str) -> dict[str, WorkspaceGitMetadata]:
    """采集 (head_commit_hash, associated_remote_urls, has_changes) 三元组;
    任一字段不可得即置 None;整体为空时返回 {}。失败静默降级。"""
    repo_root = _run_git(["rev-parse", "--show-toplevel"], cwd, _GIT_TIMEOUT)
    if not repo_root:
        return {}

    head = _run_git(["rev-parse", "HEAD"], cwd, _GIT_TIMEOUT)
    remotes_raw = _run_git(["remote", "-v"], cwd, _GIT_TIMEOUT)
    urls: dict[str, str] | None = None
    if remotes_raw:
        parsed: dict[str, str] = {}
        ok = False
        for line in remotes_raw.splitlines():
            parts = line.split()
            if len(parts) < 2:
                continue
            name, raw_url = parts[0], parts[1]
            sanitized = sanitize_git_url(raw_url)
            if sanitized is not None:
                parsed[name] = sanitized.value
                ok = True
        if ok:
            urls = parsed

    status = _run_git(["status", "--porcelain"], repo_root or cwd, _GIT_TIMEOUT)
    has_changes: bool | None = None
    if status is not None:
        has_changes = bool(status)

    meta = WorkspaceGitMetadata(
        associated_remote_urls=urls,
        latest_git_commit_hash=head,
        has_changes=has_changes,
    )
    if meta.is_empty():
        return {}
    return {repo_root: meta}


def workspaces_to_metadata_value(snapshot: dict[str, WorkspaceGitMetadata]) -> dict[str, Any]:
    """产出 enriched_workspaces 元数据字段形态(repo_root -> {fields, None→缺省})。"""
    out: dict[str, Any] = {}
    for root in sorted(snapshot):
        m = snapshot[root]
        entry: dict[str, Any] = {}
        if m.associated_remote_urls is not None:
            entry["associated_remote_urls"] = dict(
                sorted(m.associated_remote_urls.items())
            )
        if m.latest_git_commit_hash is not None:
            entry["latest_git_commit_hash"] = m.latest_git_commit_hash
        if m.has_changes is not None:
            entry["has_changes"] = m.has_changes
        if entry:
            out[root] = entry
    return out

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/sandbox_policy.py
"""沙箱策略(writable roots 与受保护元数据)纯规则 — 2026-09-19 第三十五批,对标 Codex
protocol/src/protocol.rs 的 SandboxPolicy/WritableRoot/NetworkAccess 与
protocol/src/permissions.rs 的 default_read_only_subpaths_for_writable_root /
is_git_pointer_file / resolve_gitdir_from_file / PROTECTED_METADATA_PATH_NAMES。

移植范围:
- SandboxPolicy 四变体:DangerFullAccess / ReadOnly(network_access) /
  ExternalSandbox(network_access) / WorkspaceWrite(writable_roots + network_access +
  exclude_tmpdir_env_var + exclude_slash_tmp),含 kebab-case 序列化名;
- 磁盘/网络判定:读恒放开;写仅 DangerFullAccess 与 ExternalSandbox 全放开;
  网络按变体与 network_access 标志;
- get_writable_roots_with_cwd:显式 writable_roots + cwd 恒入 + /tmp(仅 POSIX 且未
  排除且存在) + $TMPDIR(未排除且非空);ReadOnly/External/Danger 返回空表
  (External 语义=外部沙箱已管全盘,无需再列根);
- WritableRoot.is_path_writable:根前缀内 + 不落任何只读子路径 + 首段组件不是
  受保护元数据名;
- default_read_only_subpaths_for_writable_root:.git(目录/指针文件,worktree 指针
  还要保护其 gitdir 真身) + .agents(存在时) + .codex(存在时;工作区根即使不存在
  也保护,首次创建走受保护审批) + 去重。

判定跳过:FileSystemSandboxPolicy/NetworkSandboxPolicy 完整面与 legacy bridge
(平台沙箱运行时落地层);Landlock/Windows restricted token 执行机制。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

PROTECTED_METADATA_GIT_PATH_NAME = ".git"
PROTECTED_METADATA_AGENTS_PATH_NAME = ".agents"
PROTECTED_METADATA_CODEX_PATH_NAME = ".codex"
PROTECTED_METADATA_PATH_NAMES = (
    PROTECTED_METADATA_GIT_PATH_NAME,
    PROTECTED_METADATA_AGENTS_PATH_NAME,
    PROTECTED_METADATA_CODEX_PATH_NAME,
)

POLICY_DANGER_FULL_ACCESS = "danger-full-access"
POLICY_READ_ONLY = "read-only"
POLICY_EXTERNAL_SANDBOX = "external-sandbox"
POLICY_WORKSPACE_WRITE = "workspace-write"


@dataclass(frozen=True)
class SandboxPolicy:
    """Codex SandboxPolicy 等价。variant 取四常量之一;仅 WorkspaceWrite 使用根列表字段。"""

    variant: str = POLICY_READ_ONLY
    network_access: bool = False
    writable_roots: tuple[str, ...] = ()
    exclude_tmpdir_env_var: bool = False
    exclude_slash_tmp: bool = False

    @classmethod
    def new_read_only_policy(cls) -> "SandboxPolicy":
        return cls(variant=POLICY_READ_ONLY, network_access=False)

    @classmethod
    def new_workspace_write_policy(cls) -> "SandboxPolicy":
        return cls(
            variant=POLICY_WORKSPACE_WRITE,
            writable_roots=(),
            network_access=False,
            exclude_tmpdir_env_var=False,
            exclude_slash_tmp=False,
        )

    def has_full_disk_read_access(self) -> bool:
        return True

    def has_full_disk_write_access(self) -> bool:
        return self.variant in (POLICY_DANGER_FULL_ACCESS, POLICY_EXTERNAL_SANDBOX)

    def has_full_network_access(self) -> bool:
        if self.variant == POLICY_DANGER_FULL_ACCESS:
            return True
        return self.network_access

    def get_writable_roots_with_cwd(self, cwd: str) -> list["WritableRoot"]:
        """按 cwd 定制的可写根列表;非 WorkspaceWrite 变体一律空(无沙箱写入根语义)。"""
        if self.variant != POLICY_WORKSPACE_WRITE:
            return []
        roots: list[str] = list(self.writable_roots)
        if cwd:
            roots.append(cwd)
        if os.name == "posix" and not self.exclude_slash_tmp and os.path.isdir("/tmp"):
            roots.append("/tmp")
        if not self.exclude_tmpdir_env_var:
            tmpdir = os.environ.get("TMPDIR")
            if tmpdir:
                roots.append(tmpdir)
        return [
            WritableRoot(
                root=root,
                read_only_subpaths=default_read_only_subpaths_for_writable_root(
                    root, protect_missing_dot_codex=(root == cwd)
                ),
            )
            for root in roots
        ]


@dataclass
class WritableRoot:
    """可写根 + 只读子路径 + 受保护元数据名(首段组件名,防提权文件被改)。"""

    root: str
    read_only_subpaths: list[str] = field(default_factory=list)
    protected_metadata_names: list[str] = field(default_factory=list)

    def is_path_writable(self, path: str) -> bool:
        """根内 + 非只读子路径 + 首段组件非受保护元数据名 才可写。"""
        normalized = os.path.normpath(path)
        if not _is_subpath(normalized, os.path.normpath(self.root)):
            return False
        for subpath in self.read_only_subpaths:
            if _is_subpath(normalized, os.path.normpath(subpath)):
                return False
        if self._path_contains_protected_metadata_name(normalized):
            return False
        return True

    def _path_contains_protected_metadata_name(self, path: str) -> bool:
        root_norm = os.path.normpath(self.root)
        if not _is_subpath(path, root_norm) or path == root_norm:
            return False
        relative = os.path.relpath(path, root_norm)
        first_component = relative.split(os.sep)[0]
        return first_component in self.protected_metadata_names


def _is_subpath(path: str, base: str) -> bool:
    """Codex Path::starts_with 语义(组件级前缀,不认字符串巧合)。"""
    try:
        relative = os.path.relpath(path, base)
    except ValueError:
        return False
    return relative == "." or (not relative.startswith("..") and not os.path.isabs(relative))


def is_git_pointer_file(path: str) -> bool:
    """worktree/submodule 的 .git 是内容为 `gitdir: <path>` 的指针文件。"""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            first_line = fh.readline().strip()
    except OSError:
        return False
    return first_line.startswith("gitdir:")


def resolve_gitdir_from_file(pointer_file: str) -> Optional[str]:
    """从 .git 指针文件解析 gitdir 路径(相对路径按指针所在目录解析)。"""
    try:
        with open(pointer_file, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("gitdir:"):
                    gitdir = line[len("gitdir:"):].strip()
                    if not os.path.isabs(gitdir):
                        gitdir = os.path.join(os.path.dirname(os.path.abspath(pointer_file)), gitdir)
                    return os.path.normpath(gitdir)
    except OSError:
        return None
    return None


def default_read_only_subpaths_for_writable_root(
    writable_root: str, protect_missing_dot_codex: bool
) -> list[str]:
    """只读子路径默认集:.git(含 worktree 指针的 gitdir 真身) / .agents / .codex;
    工作区根的 .codex 即使不存在也保护(首次创建走受保护审批)。返回去重序列。"""
    subpaths: list[str] = []
    top_level_git = os.path.join(writable_root, PROTECTED_METADATA_GIT_PATH_NAME)
    git_is_file = os.path.isfile(top_level_git)
    git_is_dir = os.path.isdir(top_level_git)
    if git_is_dir or git_is_file:
        if git_is_file and is_git_pointer_file(top_level_git):
            gitdir = resolve_gitdir_from_file(top_level_git)
            if gitdir:
                subpaths.append(gitdir)
        subpaths.append(top_level_git)
    top_level_agents = os.path.join(writable_root, PROTECTED_METADATA_AGENTS_PATH_NAME)
    if os.path.isdir(top_level_agents):
        subpaths.append(top_level_agents)
    top_level_codex = os.path.join(writable_root, PROTECTED_METADATA_CODEX_PATH_NAME)
    if protect_missing_dot_codex or os.path.isdir(top_level_codex):
        subpaths.append(top_level_codex)
    # 去重(保持顺序)
    seen: set[str] = set()
    deduped: list[str] = []
    for subpath in subpaths:
        key = os.path.normpath(subpath)
        if key not in seen:
            seen.add(key)
            deduped.append(subpath)
    return deduped
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

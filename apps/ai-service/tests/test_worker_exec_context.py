# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""worker_exec_context 单测:请求级 cwd/env 契约与子进程合并点。

覆盖:
- env 白名单:非白名单键直接拒绝(不静默丢弃);
- cwd:必须绝对路径、存在、位于 MCP_WORKSPACE_ROOTS 内;
- 子进程合并:宿主凭据键被剥离,白名单覆盖生效;
- 工具 cwd 收敛:默认/相对路径以工人目录为基准;
- HTTP 层 helper:非法 env 转 400。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.core.worker_exec_context import (
    WORKER_ENV_ALLOWED_KEYS,
    WorkerExecContextError,
    apply_worker_child_env,
    build_worker_exec_context,
    effective_worker_cwd,
    validate_worker_env,
    worker_exec_scope,
)


@pytest.fixture()
def workspace_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(root))
    return root


def test_env_rejects_non_allowlisted_key() -> None:
    with pytest.raises(WorkerExecContextError, match="GH_TOKEN"):
        validate_worker_env({"GH_TOKEN": "secret"})


def test_env_accepts_allowlisted_keys() -> None:
    env = validate_worker_env(
        {
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_ASKPASS": "",
            "GIT_TERMINAL_PROMPT": "0",
        }
    )
    assert set(env) == set(WORKER_ENV_ALLOWED_KEYS)
    assert env["GIT_ASKPASS"] == ""


def test_env_rejects_nul_value() -> None:
    with pytest.raises(WorkerExecContextError, match="NUL"):
        validate_worker_env({"GIT_ASKPASS": "\x00"})


def test_cwd_rejects_relative_path() -> None:
    with pytest.raises(WorkerExecContextError, match="绝对路径"):
        build_worker_exec_context("relative/dir")


def test_cwd_rejects_outside_allowed_roots(workspace_root: Path, tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    with pytest.raises(WorkerExecContextError, match="允许"):
        build_worker_exec_context(str(outside))


def test_cwd_accepts_directory_under_allowed_root(workspace_root: Path) -> None:
    worker = workspace_root / "worker-1"
    worker.mkdir()
    ctx = build_worker_exec_context(str(worker))
    assert ctx is not None
    assert ctx.cwd is not None
    assert os.path.isabs(ctx.cwd)
    assert Path(ctx.cwd).resolve() == worker.resolve()


def test_cwd_rejects_missing_directory(workspace_root: Path) -> None:
    with pytest.raises(WorkerExecContextError, match="不存在|不是目录"):
        build_worker_exec_context(str(workspace_root / "missing"))


def test_apply_worker_child_env_scrubs_host_credentials(workspace_root: Path) -> None:
    ctx = build_worker_exec_context(str(workspace_root), {"GIT_CONFIG_NOSYSTEM": "1"})
    with worker_exec_scope(ctx):
        merged = apply_worker_child_env(
            {
                "PATH": "/usr/bin",
                "GH_TOKEN": "secret",
                "GITHUB_TOKEN": "secret2",
                "GIT_AUTHOR_NAME": "someone",
                "GIT_COMMITTER_EMAIL": "someone@example.com",
                "GIT_AUTHOR_DATE": "2026-01-01T00:00:00Z",
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_GLOBAL": "/tmp/global",
            }
        )
    assert merged["PATH"] == "/usr/bin"
    assert merged["GIT_CONFIG_NOSYSTEM"] == "1"
    for scrubbed in (
        "GH_TOKEN",
        "GITHUB_TOKEN",
        "GIT_AUTHOR_NAME",
        "GIT_COMMITTER_EMAIL",
        "GIT_AUTHOR_DATE",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_GLOBAL",
    ):
        assert scrubbed not in merged


def test_apply_worker_child_env_noop_without_scope() -> None:
    base = {"GH_TOKEN": "keep", "PATH": "/usr/bin"}
    assert apply_worker_child_env(base) == base


def test_effective_worker_cwd_defaults_and_relative(workspace_root: Path) -> None:
    worker = workspace_root / "worker"
    worker.mkdir()
    ctx = build_worker_exec_context(str(worker))
    with worker_exec_scope(ctx):
        assert effective_worker_cwd(".") == str(worker)
        assert effective_worker_cwd(None) == str(worker)
        assert Path(effective_worker_cwd("sub") or "").resolve() == (worker / "sub").resolve()


def test_http_scope_helper_rejects_bad_env(workspace_root: Path) -> None:
    from app.api.v1.agent import _worker_scope

    with pytest.raises(HTTPException) as exc:
        _worker_scope(str(workspace_root), {"GH_TOKEN": "secret"})
    assert exc.value.status_code == 400
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

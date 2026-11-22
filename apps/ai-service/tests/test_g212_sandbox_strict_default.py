# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-212 第十一批:沙箱默认严档(safe by default)验收。

三层判据,逐层正反成对:
1. 默认即严 —— 未配置档位时 network 拒绝 / timeout 上限 / workdir 收敛 /
   env 白名单;容器运行时 docker 不可用即拒绝,不再静默本地降级。
2. 显式放宽才放行 —— ``SANDBOX_EXEC_TIER=relaxed`` 与
   ``CONTAINER_RUNTIME_ALLOW_LOCAL_FALLBACK=1`` / ``CONTAINER_RUNTIME_NETWORK``。
3. 非法配置 fail-closed —— 未知档位、非法 timeout、越界 workdir 一律拒绝执行,
   且**一次子进程都不派生**;放宽路径必须留 tier 名审计日志。
"""

from __future__ import annotations

import sys
from unittest.mock import MagicMock

import pytest

from app.services import container_runtime as cr
from app.services import sandbox as sb
from app.services.container_runtime import ContainerRuntime
from app.services.sandbox import SandboxError, SandboxExecutor

PY = sys.executable or "python"


def _fake_proc(stdout: bytes = b"ok", stderr: bytes = b"") -> MagicMock:
    proc = MagicMock()
    proc.returncode = 0

    async def fake_communicate(*_args, **_kwargs):
        return stdout, stderr

    proc.communicate = fake_communicate
    proc.kill = MagicMock()
    return proc


@pytest.fixture(autouse=True)
def _clean_strict_env(monkeypatch):
    """每个用例都从"完全未配置"的严档基线出发。"""
    for name in (
        sb.SANDBOX_TIER_ENV,
        cr.CONTAINER_RUNTIME_ALLOW_LOCAL_FALLBACK_ENV,
        cr.CONTAINER_RUNTIME_NETWORK_ENV,
        cr.CONTAINER_RUNTIME_TIMEOUT_SEC_ENV,
        "MCP_WORKSPACE_ROOTS",
    ):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture()
def no_spawn(monkeypatch) -> None:
    """任何子进程派生都视为失败(用于 fail-closed 的副作用断言)。"""

    async def _boom(*_args, **_kwargs):
        raise AssertionError("fail-closed 路径不得派生任何子进程")

    monkeypatch.setattr(sb.asyncio, "create_subprocess_shell", _boom)
    monkeypatch.setattr(sb.asyncio, "create_subprocess_exec", _boom)
    monkeypatch.setattr(cr.asyncio, "create_subprocess_exec", _boom)


# ---------------------------------------------------------------------------
# 1. 默认即严
# ---------------------------------------------------------------------------


def test_default_profile_is_strict() -> None:
    profile = sb.resolve_execution_profile()
    assert profile.tier == sb.SANDBOX_TIER_STRICT
    assert profile.allow_network is False
    assert profile.full_env is False
    assert profile.allow_unconfined_workdir is False
    assert profile.timeout_ceiling_s == sb.STRICT_TIMEOUT_CEILING_S


def test_strict_rejects_network_request_without_spawning(no_spawn) -> None:
    executor = SandboxExecutor()
    result = sb.asyncio.run(executor.execute("echo hi", allow_network=True))
    assert result.exit_code == -1
    assert "网络访问默认拒绝" in result.stderr
    assert "tier=strict" in result.stderr


def test_strict_timeout_is_capped_and_audited(caplog) -> None:
    caplog.set_level("WARNING", logger="app.services.sandbox")
    profile = sb.resolve_execution_profile()
    assert sb._resolve_timeout(profile, 300) == sb.STRICT_TIMEOUT_CEILING_S
    assert any("tier=strict" in record.message for record in caplog.records)


def test_strict_workdir_must_stay_inside_workspace_roots(tmp_path, no_spawn) -> None:
    granted = tmp_path / "granted"
    outside = tmp_path / "outside"
    granted.mkdir()
    outside.mkdir()
    sb.os.environ["MCP_WORKSPACE_ROOTS"] = str(granted)
    try:
        executor = SandboxExecutor()
        with pytest.raises(SandboxError, match="越出服务端工作区根"):
            sb.asyncio.run(executor.execute("echo hi", workdir=str(outside)))
    finally:
        del sb.os.environ["MCP_WORKSPACE_ROOTS"]


def test_empty_workspace_roots_falls_back_to_cwd_not_allow_all(monkeypatch, tmp_path) -> None:
    """空配置(含 .env.example 的空值)按契约回落到 cwd,且 cwd 外仍拒绝。"""
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", "")
    assert sb._workspace_roots() == [sb.os.path.abspath(sb.os.getcwd())]
    profile = sb.resolve_execution_profile()
    assert sb._resolve_workdir(profile, ".") == sb.os.path.abspath(".")

    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", sb.os.pathsep)
    assert sb._workspace_roots() == [sb.os.path.abspath(sb.os.getcwd())]

    outside = tmp_path / "outside-roots"
    outside.mkdir()
    with pytest.raises(SandboxError, match="越出服务端工作区根"):
        sb._resolve_workdir(profile, str(outside))


def test_strict_env_does_not_leak_host_secrets(monkeypatch) -> None:
    monkeypatch.setenv("G212_SECRET_TOKEN", "must-not-leak")
    captured: dict[str, str] = {}

    async def fake_spawn(*_args, **kwargs):
        captured.update(kwargs.get("env") or {})
        return _fake_proc()

    monkeypatch.setattr(sb.asyncio, "create_subprocess_shell", fake_spawn)
    monkeypatch.setattr(sb.asyncio, "create_subprocess_exec", fake_spawn)
    result = sb.asyncio.run(
        SandboxExecutor()._execute_local("echo test", 10, ".", {"MY_VAR": "ok"})
    )
    assert result.exit_code == 0
    assert captured.get("MY_VAR") == "ok"
    assert "G212_SECRET_TOKEN" not in captured


def test_docker_args_are_strict_by_default() -> None:
    args = ContainerRuntime._docker_args("python main.py", "img", False)
    assert "--network=none" in args
    assert "--cap-drop=ALL" in args
    assert "--security-opt=no-new-privileges" in args
    assert "--pids-limit" in args
    assert "--memory" in args
    assert "--cpus" in args


# ---------------------------------------------------------------------------
# 2. 显式放宽才放行
# ---------------------------------------------------------------------------


def test_relaxed_tier_is_explicit_opt_in(monkeypatch, caplog) -> None:
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_RELAXED)
    caplog.set_level("WARNING", logger="app.services.sandbox")
    profile = sb.resolve_execution_profile()
    assert profile.tier == sb.SANDBOX_TIER_RELAXED
    assert profile.allow_network is True
    assert profile.full_env is True

    spawned: dict[str, object] = {}

    async def fake_docker_spawn(*args, **kwargs):
        spawned["args"] = args
        return _fake_proc()

    monkeypatch.setattr(sb.asyncio, "create_subprocess_exec", fake_docker_spawn)
    result = sb.asyncio.run(
        SandboxExecutor().execute("echo hi", backend="docker", allow_network=True)
    )
    assert result.exit_code == 0
    assert "--network=bridge" in spawned["args"]
    assert any("放宽档生效" in record.message for record in caplog.records)


async def test_container_local_fallback_requires_opt_in(tmp_path) -> None:
    rt = ContainerRuntime(
        persist_path=tmp_path / "container_runs.json",
        store=cr.CloudRunStore(file_path=tmp_path / "cloud_runs.json"),
    )
    rt._docker_available = False  # 模拟 docker 不可用

    refused = await rt.start_run("拒绝", [PY, "-c", "print(1)"])
    assert refused["status"] == "error"
    assert "docker 不可用" in refused["error"]
    assert rt._runs[refused["run_id"]].task is None

    cr.os.environ[cr.CONTAINER_RUNTIME_ALLOW_LOCAL_FALLBACK_ENV] = "1"
    try:
        allowed = await rt.start_run("放宽", [PY, "-c", "print(2)"])
        done = await rt.wait_run(allowed["run_id"], timeout=30)
        assert done is not None and done["status"] == "done"
    finally:
        del cr.os.environ[cr.CONTAINER_RUNTIME_ALLOW_LOCAL_FALLBACK_ENV]


# ---------------------------------------------------------------------------
# 3. 非法配置 fail-closed + 审计档位名可见
# ---------------------------------------------------------------------------


def test_unknown_tier_fails_closed_without_spawning(monkeypatch, no_spawn) -> None:
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, "danger-full-access")
    with pytest.raises(SandboxError, match="未知沙箱执行档位"):
        sb.asyncio.run(SandboxExecutor().execute("echo hi"))


def test_invalid_timeout_fails_closed_without_spawning(no_spawn) -> None:
    with pytest.raises(SandboxError, match="正整数秒"):
        sb.asyncio.run(SandboxExecutor().execute("echo hi", timeout=0))
    with pytest.raises(SandboxError, match="正整数秒"):
        sb.asyncio.run(SandboxExecutor().execute("echo hi", timeout=True))


def test_audit_log_carries_tier_name(caplog) -> None:
    caplog.set_level("INFO", logger="app.services.sandbox")
    SandboxExecutor._log_exec("local", "echo hi", 0, 1.0, tier=sb.SANDBOX_TIER_STRICT)
    assert any("tier=strict" in record.message for record in caplog.records)


async def test_invalid_container_timeout_is_refused(tmp_path) -> None:
    rt = ContainerRuntime(
        persist_path=tmp_path / "container_runs.json",
        store=cr.CloudRunStore(file_path=tmp_path / "cloud_runs.json"),
    )
    rt._docker_available = True
    run = await rt.start_run("非法超时", [PY, "-c", "print(1)"], timeout_sec=0)
    assert run["status"] == "error"
    assert "有限正数" in run["error"]
    assert rt._runs[run["run_id"]].task is None


def test_invalid_container_env_timeout_is_refused(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv(cr.CONTAINER_RUNTIME_TIMEOUT_SEC_ENV, "abc")
    rt = ContainerRuntime(
        persist_path=tmp_path / "container_runs.json",
        store=cr.CloudRunStore(file_path=tmp_path / "cloud_runs.json"),
    )
    rt._docker_available = True
    run = sb.asyncio.run(rt.start_run("坏配置", [PY, "-c", "print(1)"]))
    assert run["status"] == "error"
    assert "必须是数字" in run["error"]


def test_invalid_container_network_falls_back_to_none(monkeypatch, caplog) -> None:
    monkeypatch.setenv(cr.CONTAINER_RUNTIME_NETWORK_ENV, "public")
    caplog.set_level("WARNING", logger="app.services.container_runtime")
    assert cr._resolve_network_mode() == "none"
    assert any("非法网络档" in record.message for record in caplog.records)


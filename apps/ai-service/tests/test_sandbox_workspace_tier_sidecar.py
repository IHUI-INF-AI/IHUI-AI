# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B1-05 第三档(workspace)+ 会话级额外可写根侧车验收(2026-11-24)。

两件事,各自正反成对:

A. 三级执行档位
   - strict(缺省,60s 上限) / workspace(工作区档:安全面同 strict,仅超时预算
     放宽到 180s) / relaxed(全放开,3600s);
   - workspace 仍拒网络 / 仍白名单 env / 仍限工作区根;不打"放宽档生效"WARNING;
   - 未知档位 fail-closed,不回退严档。

B. 会话级额外可写根侧车(执行面镜像)
   - 注册即生效:同 (主体, 会话) 判定立即认附加根;
   - 注销即失效:clear 后同会话再查 ⇒ 空,不残留;
   - 续跑需重注册:进程内 TTL 存储,clear 后不自动恢复,重新 register 才恢复;
   - 主体隔离:user A 注册,user B 读不到;
   - 只扩不收:静态根内路径不因侧车集变严;
   - 缺省零行为:不传 session_id ⇒ 不查侧车,与改动前逐字等价。
"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.services import sandbox as sb


def _fake_proc(stdout: bytes = b"ok", stderr: bytes = b"") -> MagicMock:
    proc = MagicMock()
    proc.returncode = 0

    async def fake_communicate(*_args: object, **_kwargs: object) -> tuple[bytes, bytes]:
        return stdout, stderr

    proc.communicate = fake_communicate
    proc.kill = MagicMock()
    return proc


@pytest.fixture(autouse=True)
def _isolate_env_and_sidecar(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(sb.SANDBOX_TIER_ENV, raising=False)
    monkeypatch.delenv("MCP_WORKSPACE_ROOTS", raising=False)
    sb._SESSION_EXTRA_WRITABLE_ROOTS.clear()
    yield
    sb._SESSION_EXTRA_WRITABLE_ROOTS.clear()


@pytest.fixture
def strict_profile(monkeypatch: pytest.MonkeyPatch) -> sb.SandboxExecutionProfile:
    monkeypatch.delenv(sb.SANDBOX_TIER_ENV, raising=False)
    return sb.resolve_execution_profile()


@pytest.fixture
def no_spawn(monkeypatch: pytest.MonkeyPatch) -> None:
    """任何子进程派生都视为失败(fail-closed 路径不得派生)。"""

    async def _boom(*_args: object, **_kwargs: object) -> MagicMock:
        raise AssertionError("fail-closed 路径不得派生任何子进程")

    monkeypatch.setattr(sb.asyncio, "create_subprocess_shell", _boom)
    monkeypatch.setattr(sb.asyncio, "create_subprocess_exec", _boom)


def _dir(tmp_path: Path, name: str) -> str:
    target = tmp_path / name
    target.mkdir(parents=True, exist_ok=True)
    return str(target)


# ---------------------------------------------------------------------------
# A. 第三档 workspace
# ---------------------------------------------------------------------------


def test_default_profile_is_strict_still() -> None:
    """缺省档位不变:未配置 ⇒ strict(零缺省行为变化)。"""
    profile = sb.resolve_execution_profile()
    assert profile.tier == sb.SANDBOX_TIER_STRICT
    assert profile.allow_network is False
    assert profile.full_env is False
    assert profile.allow_unconfined_workdir is False
    assert profile.timeout_ceiling_s == sb.STRICT_TIMEOUT_CEILING_S


def test_workspace_profile_shape_is_strict_safety_middle_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_WORKSPACE)
    profile = sb.resolve_execution_profile()
    assert profile.tier == sb.SANDBOX_TIER_WORKSPACE
    assert profile.allow_network is False
    assert profile.full_env is False
    assert profile.allow_unconfined_workdir is False
    assert profile.timeout_ceiling_s == sb.WORKSPACE_TIMEOUT_CEILING_S


def test_workspace_rejects_network(monkeypatch: pytest.MonkeyPatch, no_spawn: None) -> None:
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_WORKSPACE)
    result = sb.asyncio.run(
        sb.SandboxExecutor().execute("echo hi", allow_network=True)
    )
    assert result.exit_code == -1
    assert "tier=workspace" in result.stderr


def test_workspace_workdir_still_confined(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, no_spawn: None
) -> None:
    granted = _dir(tmp_path, "granted")
    outside = _dir(tmp_path, "outside")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", granted)
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_WORKSPACE)
    with pytest.raises(sb.SandboxError, match="越出服务端工作区根"):
        sb.asyncio.run(sb.SandboxExecutor().execute("echo hi", workdir=outside))


def test_workspace_timeout_ceiling_is_middle_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_WORKSPACE)
    profile = sb.resolve_execution_profile()
    assert sb._resolve_timeout(profile, 300) == sb.WORKSPACE_TIMEOUT_CEILING_S
    assert sb._resolve_timeout(profile, 120) == 120


def test_workspace_env_does_not_leak_host_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("B105_SECRET_TOKEN", "must-not-leak")
    captured: dict[str, str] = {}

    async def fake_spawn(*_args: object, **kwargs: object) -> MagicMock:
        captured.update(kwargs.get("env") or {})
        return _fake_proc()

    monkeypatch.setattr(sb.asyncio, "create_subprocess_shell", fake_spawn)
    monkeypatch.setattr(sb.asyncio, "create_subprocess_exec", fake_spawn)
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_WORKSPACE)
    result = sb.asyncio.run(
        sb.SandboxExecutor()._execute_local("echo test", 10, ".", {"MY_VAR": "ok"})
    )
    assert result.exit_code == 0
    assert captured.get("MY_VAR") == "ok"
    assert "B105_SECRET_TOKEN" not in captured


def test_workspace_skips_relaxed_warning_but_relaxed_logs(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("WARNING", logger="app.services.sandbox")
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_WORKSPACE)
    sb.asyncio.run(sb.SandboxExecutor().execute("echo hi"))
    assert not any("放宽档生效" in r.message for r in caplog.records)

    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, sb.SANDBOX_TIER_RELAXED)
    sb.asyncio.run(sb.SandboxExecutor().execute("echo hi"))
    assert any("放宽档生效" in r.message for r in caplog.records)


def test_unknown_tier_fails_closed(monkeypatch: pytest.MonkeyPatch, no_spawn: None) -> None:
    monkeypatch.setenv(sb.SANDBOX_TIER_ENV, "danger-full-access")
    with pytest.raises(sb.SandboxError, match="未知沙箱执行档位"):
        sb.asyncio.run(sb.SandboxExecutor().execute("echo hi"))


# ---------------------------------------------------------------------------
# B. 会话级额外可写根侧车
# ---------------------------------------------------------------------------


def test_register_then_resolve_allows_extra_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, strict_profile: sb.SandboxExecutionProfile
) -> None:
    workspace = _dir(tmp_path, "workspace")
    extra = _dir(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    sb.register_session_extra_roots("sess-1", [extra], user_id="u1")
    target = os.path.join(extra, "sub")
    resolved = sb._resolve_workdir(
        strict_profile, target, session_id="sess-1", user_id="u1"
    )
    assert resolved == os.path.abspath(target)


def test_clear_takes_effect_immediately(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, strict_profile: sb.SandboxExecutionProfile
) -> None:
    workspace = _dir(tmp_path, "workspace")
    extra = _dir(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    sb.register_session_extra_roots("sess-2", [extra], user_id="u1")
    sb.clear_session_extra_roots("sess-2", user_id="u1")
    assert sb.get_session_extra_roots("sess-2", user_id="u1") == ()
    with pytest.raises(sb.SandboxError):
        sb._resolve_workdir(
            strict_profile, os.path.join(extra, "sub"),
            session_id="sess-2", user_id="u1",
        )


def test_sidecar_isolated_by_subject(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, strict_profile: sb.SandboxExecutionProfile
) -> None:
    workspace = _dir(tmp_path, "workspace")
    extra = _dir(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    sb.register_session_extra_roots("sess-3", [extra], user_id="u1")
    assert sb.get_session_extra_roots("sess-3", user_id="u2") == ()
    with pytest.raises(sb.SandboxError):
        sb._resolve_workdir(
            strict_profile, os.path.join(extra, "sub"),
            session_id="sess-3", user_id="u2",
        )


def test_sidecar_only_expand_never_tighten(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, strict_profile: sb.SandboxExecutionProfile
) -> None:
    workspace = _dir(tmp_path, "workspace")
    extra = _dir(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    sb.register_session_extra_roots("sess-4", [extra], user_id="u1")
    inside = os.path.join(workspace, "deep")
    assert sb._resolve_workdir(
        strict_profile, inside, session_id="sess-4", user_id="u1"
    ) == os.path.abspath(inside)


def test_missing_session_id_does_not_query_sidecar(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, strict_profile: sb.SandboxExecutionProfile
) -> None:
    """不传 session_id:侧车根不参与,根外路径照旧拒绝(零缺省变化)。"""
    workspace = _dir(tmp_path, "workspace")
    extra = _dir(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    sb.register_session_extra_roots("sess-5", [extra], user_id="u1")
    with pytest.raises(sb.SandboxError):
        sb._resolve_workdir(strict_profile, os.path.join(extra, "sub"))


def test_register_requires_nonempty_session_id() -> None:
    with pytest.raises(sb.SandboxError, match="session_id"):
        sb.register_session_extra_roots("  ", ["/tmp/x"])


async def test_execute_local_sidecar_register_then_clear(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace = _dir(tmp_path, "workspace")
    extra = _dir(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    sb.register_session_extra_roots("sess-6", [extra], user_id="u1")
    ok = await sb.sandbox_executor.execute(
        "echo sidecar-ok", backend="local", timeout=10, workdir=extra,
        session_id="sess-6", user_id="u1",
    )
    assert ok.exit_code == 0 and "sidecar-ok" in ok.stdout

    sb.clear_session_extra_roots("sess-6", user_id="u1")
    with pytest.raises(sb.SandboxError):
        await sb.sandbox_executor.execute(
            "echo sidecar-ok", backend="local", timeout=10, workdir=extra,
            session_id="sess-6", user_id="u1",
        )


def test_reregister_required_after_clear(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, strict_profile: sb.SandboxExecutionProfile
) -> None:
    """注销后不自动恢复;重新注册才再次放行(续跑需重注册)。"""
    workspace = _dir(tmp_path, "workspace")
    extra = _dir(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    sb.register_session_extra_roots("sess-7", [extra], user_id="u1")
    sb.clear_session_extra_roots("sess-7", user_id="u1")
    with pytest.raises(sb.SandboxError):
        sb._resolve_workdir(
            strict_profile, os.path.join(extra, "sub"),
            session_id="sess-7", user_id="u1",
        )
    sb.register_session_extra_roots("sess-7", [extra], user_id="u1")
    target = os.path.join(extra, "sub")
    assert sb._resolve_workdir(
        strict_profile, target, session_id="sess-7", user_id="u1"
    ) == os.path.abspath(target)


def test_wiring_merges_sidecar_roots_into_resolve_chain() -> None:
    """接线回潮闸:侧车根必须在入口并入附加集,判定仍归 _resolve_workdir 唯一入口。"""
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    text = (Path(here) / "app" / "services" / "sandbox.py").read_text(encoding="utf-8")
    assert "get_session_extra_roots(session_id, user_id=user_id)" in text
    assert "_resolve_workdir(profile, workdir, extra_writable_roots)" in text
    assert "_merge_writable_roots(_workspace_roots(), extra_roots or [])" in text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

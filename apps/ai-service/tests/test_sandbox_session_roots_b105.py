# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B1-05 会话级附加可写根接入 sandbox workdir 收敛(2026-11-23)。

病灶(现读):`mcp_server._validate_path_in_workspace` 早已认会话附加目录
(ContextVar `_ACTIVE_SESSION_EXTRA_ROOTS`),但 `sandbox._resolve_workdir` 只认静态
`MCP_WORKSPACE_ROOTS` ⇒ 同一会话里 `add_directories` 追加的目录在 local 路径放行、
在 docker/ssh 路径(sandbox_executor)被拒 —— 两条腿判据不一致。

判据:
① 附加集**只扩不收**:静态根内路径不因附加集变严;附加集外仍拒;
② 合并口径唯一实现(`_merge_writable_roots`,去重保序);
③ relaxed 档不受影响(本就允许越界);
④ 空/缺省附加集 ⇒ 行为与改动前逐字等价。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.services import sandbox as sb


def _write_probe(tmp_path, name: str) -> str:
    """造一个真实存在的目录(判据不做 stat,但端到端用例要走真实路径)。"""
    target = tmp_path / name
    target.mkdir(parents=True, exist_ok=True)
    return str(target)


@pytest.fixture
def strict_profile(monkeypatch) -> sb.SandboxExecutionProfile:
    monkeypatch.delenv(sb.SANDBOX_TIER_ENV, raising=False)
    return sb.resolve_execution_profile()


def test_extra_root_outside_static_is_rejected_without_extra(
    tmp_path, monkeypatch, strict_profile
) -> None:
    workspace = _write_probe(tmp_path, "workspace")
    extra = _write_probe(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    target = os.path.join(extra, "sub")
    with pytest.raises(sb.SandboxError) as exc:
        sb._resolve_workdir(strict_profile, target)
    assert "会话附加目录" in str(exc.value), "拒绝文案必须说明附加集这一维"


def test_extra_root_outside_static_is_allowed_with_extra(
    tmp_path, monkeypatch, strict_profile
) -> None:
    workspace = _write_probe(tmp_path, "workspace")
    extra = _write_probe(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    target = os.path.join(extra, "sub")
    resolved = sb._resolve_workdir(strict_profile, target, [extra])
    assert resolved == os.path.abspath(target)


def test_extra_roots_only_expand_never_tighten(
    tmp_path, monkeypatch, strict_profile
) -> None:
    """静态根内路径即使不在附加集里也必须放行(只扩不收)。"""
    workspace = _write_probe(tmp_path, "workspace")
    extra = _write_probe(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    inside = os.path.join(workspace, "deep", "file")
    assert sb._resolve_workdir(strict_profile, inside, [extra]) == os.path.abspath(inside)


def test_extra_roots_beyond_static_and_extra_still_rejected(
    tmp_path, monkeypatch, strict_profile
) -> None:
    workspace = _write_probe(tmp_path, "workspace")
    extra = _write_probe(tmp_path, "extra")
    outside = _write_probe(tmp_path, "outside")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    with pytest.raises(sb.SandboxError):
        sb._resolve_workdir(strict_profile, outside, [extra])


def test_relaxed_profile_ignores_extra_roots(
    tmp_path, monkeypatch, strict_profile
) -> None:
    relaxed = sb.SANDBOX_EXECUTION_PROFILES[sb.SANDBOX_TIER_RELAXED]
    anywhere = _write_probe(tmp_path, "anywhere")
    assert sb._resolve_workdir(relaxed, anywhere, []) == os.path.abspath(anywhere)


def test_empty_extra_is_byte_equivalent_to_previous_behavior(
    tmp_path, monkeypatch, strict_profile
) -> None:
    workspace = _write_probe(tmp_path, "workspace")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    inside = os.path.join(workspace, "x")
    assert sb._resolve_workdir(strict_profile, inside) == sb._resolve_workdir(
        strict_profile, inside, []
    )
    assert sb._resolve_workdir(strict_profile, inside) == sb._resolve_workdir(
        strict_profile, inside, None
    )


def test_merge_dedupes_and_keeps_static_first(tmp_path) -> None:
    a = _write_probe(tmp_path, "a")
    b = _write_probe(tmp_path, "b")
    merged = sb._merge_writable_roots([a, a], [b, a, ""])
    assert merged == [os.path.abspath(a), os.path.abspath(b)], "去重 + 静态在前 + 空项剔除"


def test_merge_empty_inputs() -> None:
    assert sb._merge_writable_roots([], []) == []
    assert sb._merge_writable_roots([""], ["  "]) == []


@pytest.mark.asyncio
async def test_execute_local_honors_extra_writable_root(tmp_path, monkeypatch) -> None:
    """端到端:严格档 + 附加根内的 workdir ⇒ 真跑通;不传附加根 ⇒ 被拒。"""
    workspace = _write_probe(tmp_path, "workspace")
    extra = _write_probe(tmp_path, "extra")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", workspace)
    monkeypatch.delenv(sb.SANDBOX_TIER_ENV, raising=False)
    ok = await sb.sandbox_executor.execute(
        "echo b105-ok",
        backend="local",
        timeout=10,
        workdir=extra,
        extra_writable_roots=[extra],
    )
    assert ok.exit_code == 0 and "b105-ok" in ok.stdout
    with pytest.raises(sb.SandboxError):
        await sb.sandbox_executor.execute(
            "echo b105-ok", backend="local", timeout=10, workdir=extra
        )


def test_wiring_mcp_server_passes_active_extra_roots() -> None:
    """接线回潮闸:非 local 分支必须把会话附加集传给 sandbox_executor。"""
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    text = (Path(here) / "app" / "services" / "mcp_server.py").read_text(encoding="utf-8")
    assert "extra_writable_roots=list(_active_extra_roots()) or None" in text
    sandbox_text = (Path(here) / "app" / "services" / "sandbox.py").read_text(
        encoding="utf-8"
    )
    assert "_resolve_workdir(profile, workdir, extra_writable_roots)" in sandbox_text
    assert "_merge_writable_roots(_workspace_roots(), extra_roots or [])" in sandbox_text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:batch55-e2e-snapshot-injection

# 批 55 端到端回归:真实 bash 捕获 → --noprofile --norc 会话 source 注入 →
# profile 环境在会话内可见、凭据不泄入。与 unified_exec 新建会话链路完全同构。

import os
import shutil
import subprocess
from pathlib import Path

import pytest

from app.core.shell_snapshot import capture_shell_snapshot, snapshot_env_for_exec


@pytest.mark.skipif(shutil.which("bash") is None, reason="bash 不可用")
def test_e2e_snapshot_capture_source_injection(tmp_path):
    workdir = str(tmp_path)
    parent_env = dict(os.environ)
    parent_env["E2E_BATCH55_MARK"] = "hello55"

    snap = capture_shell_snapshot(
        "bash", workdir, str(tmp_path / "snaps"), "e2e-batch55",
        parent_env=parent_env, timeout=30.0,
    )
    if snap is None:
        pytest.skip("登录 shell 捕获在本机不可用(如 profile 崩溃)")

    body = Path(snap.path).read_text(encoding="utf-8")
    assert body.startswith("# Snapshot file")
    for k in snap.credential_keys:
        assert k not in body

    exec_env = {
        k: v for k, v in os.environ.items() if not k.startswith("E2E_BATCH55")
    }
    exec_env = snapshot_env_for_exec(snap, exec_env)
    assert exec_env.get("E2E_BATCH55_MARK") == "hello55"
    assert all(k not in exec_env for k in snap.credential_keys)

    # 与 unified_exec 同构:noprofile/norc + env + stdin 先 source 快照
    proc = subprocess.run(
        ["bash", "--noprofile", "--norc"],
        input=f". {snap.path}\necho MARK=$E2E_BATCH55_MARK\necho CHAIN_OK\n",
        capture_output=True, text=True, timeout=30,
        cwd=workdir, env=exec_env,
    )
    assert "CHAIN_OK" in proc.stdout
    assert "MARK=hello55" in proc.stdout

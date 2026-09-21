# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:batch55-shell-snapshot-wiring

# 批 55(2026-09-20)shell 快照运行时接线测试:
# 对标 Codex shell_snapshot.rs + environment_selection.rs 的复用语义——
# thread.start 预热 → unified_exec 消费 → thread.close 清理。

import asyncio
import contextlib
import os
import shutil
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from app.core.shell_snapshot import ShellSnapshotData, ShellSnapshotFile
from app.services.agent_engine import AgentEngine, EngineThread


def _make_engine() -> AgentEngine:
    """最小引擎实例:只用到快照缓存相关属性。"""
    eng = AgentEngine.__new__(AgentEngine)
    eng._exec_sessions = {}
    eng._shell_snapshots = {}
    eng._shell_snapshot_tasks = {}
    return eng


def _make_thread(session_id: str = "sess-55") -> EngineThread:
    thr = EngineThread.__new__(EngineThread)
    thr.thread_id = f"thr_{session_id}"
    thr.session_id = session_id
    thr.shell_snapshot_path = None
    thr.shell_snapshot_task = None
    thr.workspace = str(Path.cwd())
    return thr


def _fake_snapshot(path: Path) -> ShellSnapshotFile:
    data = ShellSnapshotData(
        shell_state="# Functions\nfake\n",
        aliases="alias ll='ls -la'\n",
        env={"PATH": "/usr/local/bin:/usr/bin", "PROFILE_MARK": "1",
             "FAKE_API_KEY": "sk-secret"},
    )
    return ShellSnapshotFile(
        path=str(path), data=data, credential_keys=["FAKE_API_KEY"]
    )


class TestPrewarm:
    def test_prewarm_skips_on_windows(self):
        eng = _make_engine()
        thr = _make_thread()
        with patch("app.services.agent_engine.os.name", "nt"):
            eng._start_shell_snapshot_prewarm(thr)
        assert not eng._shell_snapshot_tasks
        assert not eng._shell_snapshots

    def test_prewarm_skips_without_bash(self):
        eng = _make_engine()
        thr = _make_thread()
        with patch("app.services.agent_engine.os.name", "posix"), \
                patch("app.services.agent_engine.shutil.which", return_value=None):
            eng._start_shell_snapshot_prewarm(thr)
        assert not eng._shell_snapshot_tasks
        assert not eng._shell_snapshots

    def test_prewarm_no_duplicate_scheduling(self):
        """已有缓存或已在跑的会话不重复预热。"""
        eng = _make_engine()
        thr = _make_thread()
        eng._shell_snapshots[thr.session_id] = object()
        with patch("app.services.agent_engine.os.name", "posix"), \
                patch("app.services.agent_engine.shutil.which", return_value="bash"):
            eng._start_shell_snapshot_prewarm(thr)
        assert not eng._shell_snapshot_tasks

    async def test_prewarm_schedules_task_and_completes(self, tmp_path):
        """预热任务被调度,快照入缓存,任务表自清。"""
        eng = _make_engine()
        thr = _make_thread()
        snap = _fake_snapshot(tmp_path / "snaps" / "sess-55.1.sh")
        Path(snap.path).parent.mkdir(parents=True, exist_ok=True)
        Path(snap.path).write_text("# Snapshot file\n", encoding="utf-8")

        async def _ok(*a, **k):
            return snap

        with patch.object(
            eng, "_shell_snapshot_dir", return_value=str(tmp_path / "snaps")
        ):
            with patch("app.services.agent_engine.os.name", "posix"), \
                    patch("app.services.agent_engine.shutil.which", return_value="bash"), \
                    patch("asyncio.to_thread", side_effect=_ok):
                eng._start_shell_snapshot_prewarm(thr)
                task = eng._shell_snapshot_tasks.get(thr.session_id)
                assert task is not None
                await asyncio.wait_for(task, timeout=5)
        assert eng._shell_snapshots[thr.session_id] is snap
        assert thr.shell_snapshot_path == snap.path
        assert thr.session_id not in eng._shell_snapshot_tasks

    async def test_prewarm_failure_silent(self, tmp_path):
        eng = _make_engine()
        thr = _make_thread()

        async def _boom(*a, **k):
            raise RuntimeError("capture exploded")

        with patch.object(eng, "_shell_snapshot_dir", return_value=str(tmp_path)):
            with patch("app.services.agent_engine.os.name", "posix"), \
                    patch("app.services.agent_engine.shutil.which", return_value="bash"), \
                    patch("asyncio.to_thread", side_effect=_boom):
                eng._start_shell_snapshot_prewarm(thr)
                task = eng._shell_snapshot_tasks.get(thr.session_id)
                assert task is not None
                await asyncio.wait_for(task, timeout=5)
        assert thr.session_id not in eng._shell_snapshots
        assert thr.shell_snapshot_path is None
        assert thr.session_id not in eng._shell_snapshot_tasks


class TestTakeAndDrop:
    def test_take_returns_snapshot_and_sets_path(self, tmp_path):
        eng = _make_engine()
        thr = _make_thread()
        snap = _fake_snapshot(tmp_path / "sess-55.1.sh")
        eng._shell_snapshots[thr.session_id] = snap
        got = eng._take_shell_snapshot(thr)
        assert got is snap
        assert thr.shell_snapshot_path == snap.path

    def test_take_missing_returns_none(self):
        eng = _make_engine()
        thr = _make_thread()
        assert eng._take_shell_snapshot(thr) is None

    def test_drop_clears_cache_task_and_files(self, tmp_path):
        eng = _make_engine()
        thr = _make_thread()
        snap = _fake_snapshot(tmp_path / "sess-55.42.sh")
        snap.path = str(tmp_path / "sess-55.42.sh")
        Path(snap.path).write_text("# Snapshot file\n", encoding="utf-8")
        Path(tmp_path / "sess-55.tmp-42").write_text("partial", encoding="utf-8")
        eng._shell_snapshots[thr.session_id] = snap

        import asyncio

        # 无事件循环环境下构造"已完成任务"替身(drop 只调 done()/cancel())
        class _DoneTask:
            def done(self) -> bool:
                return True

            def cancel(self) -> bool:
                return False

        eng._shell_snapshot_tasks[thr.session_id] = _DoneTask()

        with patch.object(
            eng, "_shell_snapshot_dir", return_value=str(tmp_path)
        ):
            eng._drop_shell_snapshot(thr.session_id)
        assert thr.session_id not in eng._shell_snapshots
        assert thr.session_id not in eng._shell_snapshot_tasks
        assert not Path(snap.path).exists()
        assert not Path(tmp_path / "sess-55.tmp-42").exists()


class TestUnifiedExecWiring:
    def test_snapshot_env_merge_excludes_secrets(self, tmp_path):
        """unified_exec 的环境合成语义:快照覆盖基础,凭据键排除。"""
        from app.core.shell_snapshot import snapshot_env_for_exec

        snap = _fake_snapshot(tmp_path / "s.sh")
        base = {"PATH": "/usr/bin", "IHUI_INTERNAL": "x"}
        merged = snapshot_env_for_exec(snap, base)
        assert merged["PATH"] == "/usr/local/bin:/usr/bin"
        assert merged["PROFILE_MARK"] == "1"
        assert merged["IHUI_INTERNAL"] == "x"
        assert "FAKE_API_KEY" not in merged

    def test_engine_imports_snapshot_module(self):
        """运行时真正 import shell_snapshot(死代码复活断言)。"""
        import app.services.agent_engine as ae

        src = Path(ae.__file__).read_text(encoding="utf-8")
        assert "shell_snapshot" in src
        assert "_start_shell_snapshot_prewarm" in src
        assert "_drop_shell_snapshot" in src
        assert "snapshot_env_for_exec" in src
        assert "shell_snapshot_path" in src

    def test_thread_start_hook_exists(self):
        """thread.start 处理器含预热调用。"""
        import inspect

        import app.services.agent_engine as ae

        code = inspect.getsource(ae.AgentEngine._handle_thread_start)
        assert "_start_shell_snapshot_prewarm" in code

    def test_thread_close_hook_exists(self):
        """thread.close 处理器含快照清理。"""
        import inspect

        import app.services.agent_engine as ae

        code = inspect.getsource(ae.AgentEngine._handle_thread_close)
        assert "_drop_shell_snapshot" in code

    def test_unified_exec_bootstrap_injection(self):
        """unified_exec 会话启动注入 source 快照命令。"""
        import inspect

        import app.services.agent_engine as ae

        code = inspect.getsource(ae.AgentEngine._unified_exec_tool)
        assert "bootstrap_cmd" in code
        assert "snapshot_env_for_exec" in code
        assert "_take_shell_snapshot" in code

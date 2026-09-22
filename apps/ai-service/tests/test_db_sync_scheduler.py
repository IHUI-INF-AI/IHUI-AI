# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""db_sync_scheduler.py 单元测试:生产 ⇄ 开发 全表同步调度器(2026-09-22 立)。

测试覆盖:
- 环境变量助手:_env_bool / _env_int / _env_str(含非法值回落)
- SyncRun.to_dict:完整字段与默认值
- DbSyncScheduler 配置属性:enabled / mode 白名单回落 / interval 与 timeout 下限钳制
- preflight:脚本缺失 / 配置缺失 / 配置为空 / 全部就绪
- start:_ENABLED=false 静默返回 / 预检失败静默待机 / 就绪创建 task / 重复调用不重建
- stop:无 task 安全 / 取消已有 task
- run_once:未开启 / 预检失败 / 已在执行跳过 / 成功(解析 JSON 摘要)/ 超时 / 子进程抛异常
- _parse_summary / _parse_lines:剥离机器摘要行
- _mirror_due:空值关闭 / 格式非法 / 当日已跑 / 未到点 / 到点
- 调度水位:_save_state→_load_state 往返 / 文件损坏容错 / 落盘失败不抛
- _tick:间隔到期触发并推进水位 / 失败缩短重试 / 每日镜像到点触发
- get_status:关键字段齐全
- 端点:/status 未登录 401;/trigger 非管理员 403 / 非法 mode 400 / 触发成功;/drift 触发成功
- 模块级单例存在
"""

from __future__ import annotations

import asyncio
import json
import re
import threading
import time
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.services import db_sync_scheduler as mod
from app.services.db_sync_scheduler import (
    _CN_TZ,
    _JSON_PREFIX,
    DbSyncScheduler,
    SyncRun,
    _env_bool,
    _env_int,
    _env_str,
    _require_admin,
    _require_login,
    db_sync_scheduler,
)


def _req(user_id: str | None = "u1", role_id: int = 1) -> Any:
    """构造带 state 的假 Request。"""
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id, role_id=role_id))


def _run(mode: str = "sync", ok: bool = True) -> SyncRun:
    return SyncRun(
        mode=mode, trigger="schedule", started_at="2026-09-22T10:00:00+08:00", ok=ok
    )


@pytest.fixture()
def isolated_files(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, Path]:
    """把脚本/配置/水位三个路径全部指向 tmp_path,避免碰到真机文件。"""
    script = tmp_path / "db_sync.py"
    script.write_text("print('stub')\n", encoding="utf-8")
    cfg = tmp_path / "db-sync.local.json"
    cfg.write_text('{"prod": {}}', encoding="utf-8")
    state = tmp_path / "db-sync.state.json"
    monkeypatch.setenv("DB_SYNC_SCRIPT", str(script))
    monkeypatch.setenv("DB_SYNC_CONFIG", str(cfg))
    monkeypatch.setenv("DB_SYNC_STATE", str(state))
    return {"script": script, "config": cfg, "state": state}


# =============================================================================
# 1. 环境变量助手
# =============================================================================


class TestEnvHelpers:
    """_env_bool / _env_int / _env_str。"""

    def test_env_bool_default_when_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("IHUI_TEST_B", raising=False)
        assert _env_bool("IHUI_TEST_B", True) is True
        assert _env_bool("IHUI_TEST_B") is False

    @pytest.mark.parametrize("raw", ["1", "true", "TRUE", "yes", "on", " On "])
    def test_env_bool_truthy(self, monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
        monkeypatch.setenv("IHUI_TEST_B", raw)
        assert _env_bool("IHUI_TEST_B") is True

    @pytest.mark.parametrize("raw", ["0", "false", "no", "off", "anything"])
    def test_env_bool_falsy(self, monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
        monkeypatch.setenv("IHUI_TEST_B", raw)
        assert _env_bool("IHUI_TEST_B") is False

    def test_env_bool_empty_string_uses_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """空串视为未配置(不被读成 False),否则 .env 里留空开关会意外关掉功能。"""
        monkeypatch.setenv("IHUI_TEST_B", "   ")
        assert _env_bool("IHUI_TEST_B", True) is True

    def test_env_int_parses_and_falls_back(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("IHUI_TEST_I", "120")
        assert _env_int("IHUI_TEST_I", 7) == 120
        monkeypatch.setenv("IHUI_TEST_I", "120.9")
        assert _env_int("IHUI_TEST_I", 7) == 120
        monkeypatch.setenv("IHUI_TEST_I", "not-a-number")
        assert _env_int("IHUI_TEST_I", 7) == 7
        monkeypatch.delenv("IHUI_TEST_I", raising=False)
        assert _env_int("IHUI_TEST_I", 7) == 7

    def test_env_str_default_and_strip(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("IHUI_TEST_S", raising=False)
        assert _env_str("IHUI_TEST_S", "fallback") == "fallback"
        monkeypatch.setenv("IHUI_TEST_S", "  value  ")
        assert _env_str("IHUI_TEST_S") == "value"


# =============================================================================
# 2. SyncRun
# =============================================================================


class TestSyncRun:
    """SyncRun 执行记录。"""

    def test_defaults(self) -> None:
        r = SyncRun(mode="sync", trigger="manual", started_at="t0")
        assert r.finished_at == ""
        assert r.duration_ms == 0
        assert r.exit_code is None
        assert r.ok is False
        assert r.timed_out is False
        assert r.summary == {}
        assert r.tail == ""
        assert r.error == ""

    def test_to_dict_roundtrip(self) -> None:
        r = SyncRun(
            mode="mirror",
            trigger="schedule",
            started_at="t0",
            finished_at="t1",
            duration_ms=1234,
            exit_code=0,
            ok=True,
            summary={"mode": "mirror"},
            tail="done",
        )
        d = r.to_dict()
        assert d["mode"] == "mirror"
        assert d["ok"] is True
        assert d["duration_ms"] == 1234
        assert d["summary"] == {"mode": "mirror"}
        assert set(d) == {
            "mode",
            "trigger",
            "started_at",
            "finished_at",
            "duration_ms",
            "exit_code",
            "ok",
            "timed_out",
            "summary",
            "tail",
            "error",
        }


# =============================================================================
# 3. 配置属性
# =============================================================================


class TestConfigProperties:
    """环境变量驱动的配置属性。"""

    def test_enabled_default_false(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("DB_SYNC_ENABLED", raising=False)
        assert DbSyncScheduler().enabled is False

    def test_mode_whitelist_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_MODE", "mirror")
        assert DbSyncScheduler().mode == "mirror"
        monkeypatch.setenv("DB_SYNC_MODE", "MIRROR")
        assert DbSyncScheduler().mode == "mirror"
        monkeypatch.setenv("DB_SYNC_MODE", "drop-everything")
        assert DbSyncScheduler().mode == "sync"

    def test_interval_clamped_to_at_least_one(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_INTERVAL_MINUTES", "0")
        assert DbSyncScheduler().interval_minutes == 1
        monkeypatch.setenv("DB_SYNC_INTERVAL_MINUTES", "-5")
        assert DbSyncScheduler().interval_minutes == 1

    def test_timeout_clamped(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_TIMEOUT", "5")
        assert DbSyncScheduler().timeout_seconds == 60

    def test_mirror_timeout_is_separate_and_longer(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """mirror 要整表 COPY 588 张表,沿用 sync 的 30 分钟会每夜中途被杀。"""
        monkeypatch.delenv("DB_SYNC_MIRROR_TIMEOUT", raising=False)
        monkeypatch.setenv("DB_SYNC_TIMEOUT", "1800")
        s = DbSyncScheduler()
        assert s.timeout_for("sync") == 1800
        assert s.timeout_for("drift") == 1800
        assert s.timeout_for("mirror") == 7200
        monkeypatch.setenv("DB_SYNC_MIRROR_TIMEOUT", "9000")
        assert s.timeout_for("mirror") == 9000

    def test_startup_delay_never_negative(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_STARTUP_DELAY", "-30")
        assert DbSyncScheduler().startup_delay == 0

    def test_mirror_at_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("DB_SYNC_MIRROR_AT", raising=False)
        assert DbSyncScheduler().mirror_at == "04:00"

    def test_default_paths_under_repo_root(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("DB_SYNC_SCRIPT", raising=False)
        monkeypatch.delenv("DB_SYNC_CONFIG", raising=False)
        s = DbSyncScheduler()
        assert s.script_path == mod._ROOT / "scripts" / "db" / "db_sync.py"
        assert s.config_path == mod._ROOT / ".ihui-agent" / "db-sync.local.json"

    def test_state_path_derives_from_config_dir(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """未显式指定 DB_SYNC_STATE 时,水位文件落在同步配置同目录。"""
        monkeypatch.delenv("DB_SYNC_STATE", raising=False)
        monkeypatch.setenv("DB_SYNC_CONFIG", str(tmp_path / "cfg.json"))
        assert DbSyncScheduler().state_path == tmp_path / "db-sync.state.json"


# =============================================================================
# 4. preflight
# =============================================================================


class TestPreflight:
    """运行前置检查(缺依赖时必须静默待机,不能误连)。"""

    def test_script_missing(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_SCRIPT", str(tmp_path / "nope.py"))
        monkeypatch.setenv("DB_SYNC_CONFIG", str(tmp_path / "cfg.json"))
        assert "同步脚本不存在" in DbSyncScheduler().preflight()

    def test_config_missing(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        script = tmp_path / "db_sync.py"
        script.write_text("x", encoding="utf-8")
        monkeypatch.setenv("DB_SYNC_SCRIPT", str(script))
        monkeypatch.setenv("DB_SYNC_CONFIG", str(tmp_path / "nope.json"))
        assert "同步配置不存在" in DbSyncScheduler().preflight()

    def test_config_empty(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        script = tmp_path / "db_sync.py"
        script.write_text("x", encoding="utf-8")
        cfg = tmp_path / "cfg.json"
        cfg.write_text("", encoding="utf-8")
        monkeypatch.setenv("DB_SYNC_SCRIPT", str(script))
        monkeypatch.setenv("DB_SYNC_CONFIG", str(cfg))
        assert "同步配置为空" in DbSyncScheduler().preflight()

    def test_all_ready(self, isolated_files: dict[str, Path]) -> None:
        assert DbSyncScheduler().preflight() == ""


# =============================================================================
# 5. start / stop
# =============================================================================


class TestLifecycle:
    """start / stop。"""

    async def test_start_skipped_when_disabled(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "false")
        s = DbSyncScheduler()
        s.start()
        assert s._task is None
        assert "DB_SYNC_ENABLED" in s.get_status()["idle_reason"]

    async def test_start_idles_when_preflight_fails(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        monkeypatch.setenv("DB_SYNC_SCRIPT", str(tmp_path / "nope.py"))
        monkeypatch.setenv("DB_SYNC_CONFIG", str(tmp_path / "nope.json"))
        s = DbSyncScheduler()
        s.start()
        assert s._task is None
        assert "同步脚本不存在" in s.get_status()["idle_reason"]

    async def test_start_creates_task_and_is_idempotent(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        s.start()
        first = s._task
        assert first is not None
        s.start()  # 重复调用不得重建
        assert s._task is first
        assert s.get_status()["idle_reason"] is None
        await s.stop()

    async def test_stop_without_task_is_safe(self) -> None:
        s = DbSyncScheduler()
        await s.stop()
        assert s._task is None

    async def test_stop_cancels_task(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        monkeypatch.setenv("DB_SYNC_STARTUP_DELAY", "600")  # 停在 sleep 阶段
        s = DbSyncScheduler()
        s.start()
        task = s._task
        assert task is not None
        await s.stop()
        assert task.cancelled() or task.done()


# =============================================================================
# 6. run_once
# =============================================================================


class TestRunOnce:
    """run_once:子进程编排与结果解析。"""

    async def test_disabled_returns_error(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "false")
        s = DbSyncScheduler()
        run = await s.run_once("sync")
        assert run.ok is False
        assert "DB_SYNC_ENABLED" in run.error
        assert s._history[-1] is run

    async def test_preflight_failure_is_recorded(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        monkeypatch.setenv("DB_SYNC_SCRIPT", str(tmp_path / "nope.py"))
        monkeypatch.setenv("DB_SYNC_CONFIG", str(tmp_path / "nope.json"))
        s = DbSyncScheduler()
        run = await s.run_once("sync")
        assert run.ok is False
        assert "同步脚本不存在" in run.error

    async def test_success_parses_json_summary(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        payload = {"mode": "sync", "exit_code": 0, "lines": ["[sync] 已回灌 3 行"]}
        out = f"[sync] 报告\n{_JSON_PREFIX}{json.dumps(payload)}\n"
        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", lambda argv, timeout: (0, out, "", False))
        run = await s.run_once("sync", trigger="manual")
        assert run.ok is True
        assert run.exit_code == 0
        assert run.timed_out is False
        assert run.summary == payload
        assert run.tail == "[sync] 报告"
        assert run.finished_at != ""
        assert run.duration_ms >= 0

    async def test_sync_passes_apply_and_json_flags(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """mode=sync 必须带 --apply,否则脚本只跑 dry-run 不写生产(静默失效)。"""
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        seen: dict[str, Any] = {}

        def fake_exec(argv: list[str], timeout: int) -> tuple[int, str, str, bool]:
            seen["argv"] = argv
            seen["timeout"] = timeout
            return 0, "", "", False

        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", fake_exec)
        await s.run_once("sync")
        assert seen["argv"][-2:] == ["--json", "--apply"]
        assert seen["argv"][1] == str(isolated_files["script"])
        assert seen["timeout"] == s.timeout_seconds

    async def test_mirror_and_drift_flags(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        seen: list[list[str]] = []

        def fake_exec(argv: list[str], timeout: int) -> tuple[int, str, str, bool]:
            seen.append(argv)
            return 0, "", "", False

        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", fake_exec)
        await s.run_once("mirror")
        await s.run_once("drift")
        assert seen[0][-2:] == ["--json", "--yes"]
        assert seen[1][-2:] == ["--json", "--fail"]

    async def test_mirror_uses_its_own_timeout(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        monkeypatch.setenv("DB_SYNC_TIMEOUT", "600")
        monkeypatch.setenv("DB_SYNC_MIRROR_TIMEOUT", "9000")
        seen: dict[str, int] = {}

        def fake_exec(argv: list[str], timeout: int) -> tuple[int, str, str, bool]:
            seen[argv[2]] = timeout
            return 0, "", "", False

        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", fake_exec)
        await s.run_once("sync")
        await s.run_once("mirror")
        assert seen == {"sync": 600, "mirror": 9000}

    async def test_timeout_marks_timed_out(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", lambda argv, timeout: (-1, "partial", "", True))
        run = await s.run_once("sync")
        assert run.timed_out is True
        assert run.ok is False
        assert "超时" in run.error
        assert run.tail == "partial"

    async def test_exec_exception_is_swallowed(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """调度器绝不能把异常抛给 lifespan。"""
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")

        def boom(argv: list[str], timeout: int) -> tuple[int, str, str, bool]:
            raise OSError("spawn failed")

        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", boom)
        run = await s.run_once("sync")
        assert run.ok is False
        assert "OSError" in run.error

    async def test_nonzero_exit_is_not_ok(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", lambda argv, timeout: (1, "boom", "traceback", False))
        run = await s.run_once("drift")
        assert run.ok is False
        assert run.exit_code == 1
        assert "traceback" in run.error

    async def test_concurrent_run_is_skipped(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """一轮没跑完时再触发不得叠加(避免两轮同时打生产库)。"""
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        started = threading.Event()

        def slow_exec(argv: list[str], timeout: int) -> tuple[int, str, str, bool]:
            started.set()  # threading.Event 跨线程安全(asyncio.Event 不是)
            time.sleep(0.3)
            return 0, "", "", False

        monkeypatch.setattr(s, "_exec", slow_exec)
        first = asyncio.create_task(s.run_once("sync"))
        for _ in range(300):
            if started.is_set():
                break
            await asyncio.sleep(0.01)
        assert started.is_set(), "首轮未进入子进程阶段"

        second = await s.run_once("sync")
        assert second.ok is False
        assert "仍在执行" in second.error
        await first

    async def test_lock_released_after_run(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """跑完必须释放锁,否则调度器从此永久空转。"""
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", lambda argv, timeout: (0, "", "", False))
        await s.run_once("sync")
        assert s.is_running is False
        assert s.running_mode is None

    async def test_history_is_capped(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        monkeypatch.setattr(s, "_exec", lambda argv, timeout: (0, "", "", False))
        for _ in range(mod._HISTORY_LIMIT + 5):
            await s.run_once("sync")
        assert len(s._history) == mod._HISTORY_LIMIT


# =============================================================================
# 7. 输出解析
# =============================================================================


class TestParsing:
    """_parse_summary / _parse_lines。"""

    def test_parse_summary_finds_last_json_line(self) -> None:
        out = "\n".join(
            [
                "[sync] 报告",
                _JSON_PREFIX + '{"mode":"sync","exit_code":0}',
                "尾部噪声",
            ]
        )
        assert DbSyncScheduler._parse_summary(out) == {"mode": "sync", "exit_code": 0}

    def test_parse_summary_returns_empty_without_marker(self) -> None:
        assert DbSyncScheduler._parse_summary("只有人读报告") == {}

    def test_parse_summary_tolerates_broken_json(self) -> None:
        assert DbSyncScheduler._parse_summary(_JSON_PREFIX + "{not json") == {}

    def test_parse_lines_strips_marker_line(self) -> None:
        out = f"[sync] a\n{_JSON_PREFIX}{{}}\n[sync] b\n"
        assert DbSyncScheduler._parse_lines(out) == "[sync] a\n[sync] b"


# =============================================================================
# 8. _mirror_due
# =============================================================================


class TestMirrorDue:
    """每日镜像到点判断(东八区)。"""

    def test_disabled_when_blank(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "")
        s = DbSyncScheduler()
        assert s._mirror_due(datetime(2026, 9, 22, 23, 0, tzinfo=_CN_TZ)) is False

    def test_malformed_value_is_ignored(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "四点半")
        s = DbSyncScheduler()
        assert s._mirror_due(datetime(2026, 9, 22, 23, 0, tzinfo=_CN_TZ)) is False

    def test_before_time_not_due(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "04:00")
        s = DbSyncScheduler()
        assert s._mirror_due(datetime(2026, 9, 22, 3, 59, tzinfo=_CN_TZ)) is False

    def test_at_time_is_due(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "04:00")
        s = DbSyncScheduler()
        assert s._mirror_due(datetime(2026, 9, 22, 4, 0, tzinfo=_CN_TZ)) is True

    def test_already_ran_today_not_due(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "04:00")
        s = DbSyncScheduler()
        s._last_mirror_date = "2026-09-22"
        assert s._mirror_due(datetime(2026, 9, 22, 9, 0, tzinfo=_CN_TZ)) is False

    def test_next_day_is_due_again(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "04:00")
        s = DbSyncScheduler()
        s._last_mirror_date = "2026-09-21"
        assert s._mirror_due(datetime(2026, 9, 22, 9, 0, tzinfo=_CN_TZ)) is True


# =============================================================================
# 9. 调度水位落盘
# =============================================================================


class TestStatePersistence:
    """水位落盘:重启不重置周期,否则间隔任务会被重启风暴饿死。"""

    def test_roundtrip(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        s = DbSyncScheduler()
        due = datetime(2026, 9, 22, 12, 0, tzinfo=_CN_TZ)
        s._last_interval_run = due - timedelta(minutes=120)
        s._next_interval_due = due
        s._last_mirror_date = "2026-09-22"
        s._save_state()

        fresh = DbSyncScheduler()
        fresh._load_state()
        assert fresh._last_interval_run == s._last_interval_run
        assert fresh._next_interval_due == due
        assert fresh._last_mirror_date == "2026-09-22"

    def test_missing_file_is_tolerated(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        s = DbSyncScheduler()
        s._load_state()  # 不抛
        assert s._next_interval_due is None

    def test_corrupt_file_is_tolerated(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        isolated_files["state"].write_text("{broken", encoding="utf-8")
        s = DbSyncScheduler()
        s._load_state()  # 不抛
        assert s._next_interval_due is None

    def test_bad_timestamp_ignored(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        isolated_files["state"].write_text(
            json.dumps({"last_interval_run": "not-a-date", "last_mirror_date": "2026-09-22"}),
            encoding="utf-8",
        )
        s = DbSyncScheduler()
        s._load_state()
        assert s._last_interval_run is None
        assert s._last_mirror_date == "2026-09-22"

    def test_save_failure_does_not_raise(self, monkeypatch: pytest.MonkeyPatch) -> None:
        s = DbSyncScheduler()
        monkeypatch.setattr(
            type(s), "state_path", property(lambda self: Path("Z:/ definitely/not/writable.json"))
        )
        s._save_state()  # 不抛


# =============================================================================
# 10. _tick
# =============================================================================


class TestTick:
    """_tick:到点则触发,失败缩短重试。"""

    async def test_interval_due_triggers_and_advances(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        calls: list[tuple[str, str]] = []

        async def fake_run_once(mode: str, trigger: str = "manual", **kw: Any) -> SyncRun:
            calls.append((mode, trigger))
            return _run(mode, ok=True)

        monkeypatch.setattr(s, "run_once", fake_run_once)
        await s._tick()
        assert calls == [("sync", "schedule")]
        assert s._last_interval_run is not None
        assert s._next_interval_due is not None
        delta = s._next_interval_due - s._last_interval_run
        assert timedelta(minutes=s.interval_minutes - 1) <= delta <= timedelta(
            minutes=s.interval_minutes + 1
        )
        assert isolated_files["state"].exists()

    async def test_failure_shortens_retry(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")

        async def fake_run_once(mode: str, trigger: str = "manual", **kw: Any) -> SyncRun:
            return _run(mode, ok=False)

        s = DbSyncScheduler()
        monkeypatch.setattr(s, "run_once", fake_run_once)
        await s._tick()
        assert s._next_interval_due is not None
        assert s._next_interval_due - datetime.now(_CN_TZ) <= timedelta(
            minutes=mod._RETRY_MINUTES + 1
        )

    async def test_not_due_does_nothing(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "")
        s = DbSyncScheduler()
        s._next_interval_due = datetime.now(_CN_TZ) + timedelta(hours=1)
        mock = AsyncMock()
        monkeypatch.setattr(s, "run_once", mock)
        await s._tick()
        mock.assert_not_awaited()

    async def test_mirror_fires_when_due(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        monkeypatch.setenv("DB_SYNC_MIRROR_AT", "00:00")
        s = DbSyncScheduler()
        s._next_interval_due = datetime.now(_CN_TZ) + timedelta(hours=1)
        calls: list[str] = []

        async def fake_run_once(mode: str, trigger: str = "manual", **kw: Any) -> SyncRun:
            calls.append(mode)
            return _run(mode, ok=True)

        monkeypatch.setattr(s, "run_once", fake_run_once)
        await s._tick()
        assert calls == ["mirror"]
        assert s._last_mirror_date == datetime.now(_CN_TZ).strftime("%Y-%m-%d")


# =============================================================================
# 11. get_status
# =============================================================================


class TestGetStatus:
    """状态快照。"""

    def test_shape(self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        st = s.get_status()
        for key in (
            "enabled",
            "mode",
            "interval_minutes",
            "startup_delay_seconds",
            "timeout_seconds",
            "mirror_timeout_seconds",
            "mirror_at",
            "script_path",
            "script_exists",
            "config_path",
            "config_exists",
            "state_path",
            "idle_reason",
            "running",
            "running_mode",
            "run_count",
            "last_interval_run_at",
            "next_interval_due_at",
            "last_mirror_date",
            "last",
            "history",
        ):
            assert key in st, key
        assert st["enabled"] is True
        assert st["script_exists"] is True
        assert st["config_exists"] is True
        assert st["running"] is False
        assert st["last"] is None

    def test_last_reflects_latest_run(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        s = DbSyncScheduler()
        s._append(_run("sync", ok=True))
        st = s.get_status()
        assert st["last"]["mode"] == "sync"
        assert len(st["history"]) == 1


# =============================================================================
# 12. 鉴权助手
# =============================================================================


class TestAuthHelpers:
    """_require_login / _require_admin。"""

    def test_login_ok(self) -> None:
        assert _require_login(_req()) == "u1"

    def test_login_rejects_anonymous(self) -> None:
        with pytest.raises(HTTPException) as ei:
            _require_login(_req(user_id=None))
        assert ei.value.status_code == 401

    def test_admin_ok(self) -> None:
        _require_admin(_req(role_id=1))

    def test_admin_rejects_non_admin(self) -> None:
        with pytest.raises(HTTPException) as ei:
            _require_admin(_req(role_id=0))
        assert ei.value.status_code == 403


# =============================================================================
# 13. 端点
# =============================================================================


class TestEndpoints:
    """只读状态 / 手动触发 / 差异体检。"""

    async def test_status_requires_login(self) -> None:
        with pytest.raises(HTTPException) as ei:
            await mod.get_status(_req(user_id=None))
        assert ei.value.status_code == 401

    async def test_status_ok(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        resp = await mod.get_status(_req())
        assert resp["code"] == 0
        assert resp["data"]["enabled"] is True

    async def test_trigger_requires_admin(self) -> None:
        with pytest.raises(HTTPException) as ei:
            await mod.trigger_sync(_req(role_id=0))
        assert ei.value.status_code == 403

    async def test_trigger_rejects_bad_mode(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        with pytest.raises(HTTPException) as ei:
            await mod.trigger_sync(_req(), mode="drop")
        assert ei.value.status_code == 400

    async def test_trigger_spawns_background_task(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        handler = AsyncMock(return_value=_run("mirror"))
        monkeypatch.setattr(db_sync_scheduler, "run_once", handler)
        resp = await mod.trigger_sync(_req(), mode="mirror")
        assert resp["data"] == {"triggered": True, "mode": "mirror"}
        await asyncio.sleep(0)  # 让 create_task 跑起来
        handler.assert_awaited_once()

    async def test_trigger_skips_when_one_is_running(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        monkeypatch.setattr(db_sync_scheduler, "run_once", AsyncMock())
        async with db_sync_scheduler._lock:
            resp = await mod.trigger_sync(_req(), mode="sync")
        assert resp["data"]["triggered"] is False
        assert "已有一轮在执行" in resp["message"]

    async def test_drift_endpoint_spawns(
        self, isolated_files: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DB_SYNC_ENABLED", "true")
        handler = AsyncMock(return_value=_run("drift"))
        monkeypatch.setattr(db_sync_scheduler, "run_once", handler)
        resp = await mod.trigger_drift(_req())
        assert resp["data"]["triggered"] is True
        await asyncio.sleep(0)
        handler.assert_awaited_once()


# =============================================================================
# 14. 单例
# =============================================================================


class TestSingleton:
    """模块级单例。"""

    def test_singleton_exists(self) -> None:
        assert isinstance(db_sync_scheduler, DbSyncScheduler)

    def test_json_prefix_matches_script(self) -> None:
        """前缀是跨进程契约:必须与 scripts/db/db_sync.py 的 JSON_PREFIX 一致。

        任一端的字面量被改掉,摘要就静默解析不到(summary 恒为 {}),症状极隐蔽 →
        这里作为跨文件契约钉死(引号风格不敏感)。
        """
        script = mod._ROOT / "scripts" / "db" / "db_sync.py"
        assert script.exists(), f"同步脚本不存在: {script}"
        src = script.read_text(encoding="utf-8")
        pattern = rf"""JSON_PREFIX\s*=\s*['"]{re.escape(_JSON_PREFIX)}['"]"""
        assert re.search(pattern, src), "db_sync.py 的 JSON_PREFIX 与调度器不一致"


def test_cn_tz_offset() -> None:
    """东八区偏移固定 +8,每日镜像时刻语义依赖它。"""
    assert datetime(2026, 9, 22, tzinfo=_CN_TZ).utcoffset() == timedelta(hours=8)
    assert datetime(2026, 9, 22, tzinfo=UTC).astimezone(_CN_TZ).hour == 8
    assert timezone(timedelta(hours=8)) == _CN_TZ


# =============================================================================
# 15. 同步诚实性契约(2026-09-22 静默缺口事故的回归护栏)
# =============================================================================


class TestSyncHonestyContract:
    """钉住 db_sync.py「未落地必须可见」的契约。

    事故(真实 sync 实测):一轮以 exit 0 + 「已回灌 1350 行(失败 0 张)」收尾,
    而 resources(待回灌 720、生产 0 行)、ai_world_items(4108 行)、
    ai_model_config_models(500 行)整表一行都没进生产 —— 合计 4833 行缺口静默存在。
    两个成因:
      ① push_rows 把「系统性失败早退 / 大批量不重放」并入 skipped(报表写作
         「冲突跳过」),与「该行生产已存在」无从区分;
      ② do_sync 无条件 return 0,且 tables_touched 不论 written 是否为 0 都 +1,
         于是「涉及 16 张表」把一行没进的表也算作已同步。
    这正是用户要求「不可以再出现」的漏同步形态:报表乐观 + 退出码绿色 ⇒
    调度器/CI/用户三方都看不见缺口。

    db_sync.py 末尾是模块级 `sys.exit(asyncio.run(main()))`,import 即执行 main,
    故沿用本文件既有做法(见 TestSingleton.test_json_prefix_matches_script)按源码断言。
    """

    @staticmethod
    def _src() -> str:
        script = mod._ROOT / "scripts" / "db" / "db_sync.py"
        assert script.exists(), f"同步脚本不存在: {script}"
        return script.read_text(encoding="utf-8")

    def test_push_rows_separates_not_landed_from_conflict_skip(self) -> None:
        """push_rows 必须把「未落地」独立成第三个返回值,不得与冲突跳过混算。"""
        src = self._src()
        assert "-> tuple[int, int, int, str]" in src, "push_rows 未返回 4 元组"
        assert "return written, skipped, abandoned, first_err" in src, (
            "push_rows 未返回 abandoned(未落地行数)"
        )

    def test_abandonment_not_counted_as_conflict_skip(self) -> None:
        """早退与不重放两条路径都必须计入 abandoned。"""
        src = self._src()
        assert src.count("abandoned += len(chunk)") >= 2, (
            "系统性失败早退 / 大批量不重放都要计入未落地"
        )
        assert "skipped += len(chunk)" not in src, (
            "整批跳过被计成「冲突跳过」,缺口会从报表上消失"
        )

    def test_do_sync_names_undelivered_tables(self) -> None:
        """整表零落地必须被点名(用户要求「哪几张没同步」能落到具体表)。"""
        src = self._src()
        assert "零落地" in src and "undelivered_names" in src

    def test_do_sync_exit_code_reflects_gap(self) -> None:
        """有缺口必须非 0 退出:调度器 run.ok 由退出码决定,否则不会告警/快速重试。"""
        src = self._src()
        assert re.search(r"if failed or undelivered:\s*\n\s*return 1", src), (
            "do_sync 未把缺口反映到退出码"
        )
        sched = mod.__file__
        assert sched
        sched_src = Path(sched).read_text(encoding="utf-8")
        assert "run.ok = (code == 0) and not timed_out" in sched_src, (
            "调度器 run.ok 未跟随退出码"
        )

    def test_tables_touched_requires_actual_write(self) -> None:
        """tables_touched 只在真写进去时 +1,否则「涉及 N 张表」会谎报同步范围。"""
        src = self._src()
        assert re.search(r"if written:\s*\n\s*tables_touched \+= 1", src), (
            "tables_touched 未受 written 守卫"
        )

    def test_report_shows_net_delta_not_just_submitted(self) -> None:
        """只报「已写入 N 行」在业务键合并场景下会说谎。

        以业务唯一键为 upsert 冲突目标时,多条「不同主键、同业务键」的本地行会合并到
        同一条生产行:实测 resources 提交 720 行、生产只 0→114 行。此时只写「已写入
        720 行」等于把「合并」说成「落地」,是新的乐观报告 ⇒ 必须同时给
        「生产 before→after(净 ±Δ)」。
        """
        src = self._src()
        assert "已提交 {written} 行" in src, "提交行数措辞未改为「已提交」"
        assert "净 {net:+d}" in src, "报告缺少净增量(生产 before→after)"

    def test_unique_index_keys_are_collected(self) -> None:
        """SQL_UNIQUE 必须把「索引式唯一键」也收进来。

        本仓迁移大量用 `CREATE UNIQUE INDEX`(不落 pg_constraint)。只查
        `con.contype='u'` 会让 registry_items / model_leaderboard 等表的业务键对
        upsert 冲突目标不可见 ⇒ 退回主键 ⇒ 同业务键不同主键的行整批失败
        (实测 registry_items 244 行只落 18 行)。同时必须排除主键、部分索引
        (indpred)与含表达式列的索引(indkey 含 0)—— 这三类不能当 ON CONFLICT arbiter。
        """
        src = self._src()
        assert "i.indisunique" in src, "SQL_UNIQUE 未纳入唯一索引"
        assert "NOT i.indisprimary" in src, "SQL_UNIQUE 未排除主键索引"
        assert "i.indpred IS NULL" in src, "SQL_UNIQUE 未排除部分索引(不能做 arbiter)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

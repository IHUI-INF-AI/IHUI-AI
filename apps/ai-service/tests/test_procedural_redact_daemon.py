# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""定时批量 dry-run 审计守护的用例(2026-10-26 立)。

隔离纪律(AGENTS §5 测试隔离铁律):autouse 夹具把清洗器的 `open_store` 打成必抛 ——
本模块任何用例都不许触达真实 asyncpg;喂给守护的是纯内存假件。

本守护要自证的三件事:
  * **只量不写**:`apply_updates` 是绊线,被踩即抛;ok 档结果里写盘计数恒为 False。
  * **判不出来就喊**:缺 DSN / 连不上 / schema 不符 ⇒ status=undetermined 且**不带计数字段**
    (带 0 会被读成"扫过了,干净"——清洗器退出码 2 的同一条纪律)。
  * **该动手时点名**:有待改写或撞键行 ⇒ warning 里出现手动 --apply 命令与确认令牌。
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path
from typing import Any

import pytest

from app.services import procedural_redact_daemon as daemon

DSN = "postgresql://u:p@127.0.0.1:8810/ihui"
PLAIN_TAIL = '{"path":"G:/IHUI-AI/secret.txt","content":"李春川的口令是 abc123"}'
LOGGER_NAME = "app.services.procedural_redact_daemon"


@pytest.fixture(autouse=True)
def _forbid_real_connections(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _never(*_a: Any, **_k: Any) -> Any:
        raise AssertionError("测试不得开真连接(§5 测试隔离铁律)")

    monkeypatch.setattr(daemon.load_cleaner(), "open_store", _never)


@pytest.fixture(autouse=True)
def _reset_latch() -> Any:
    daemon.stop()
    yield
    daemon.stop()


def row(mod: Any, rid: str, user: str, tool: str, pattern: str) -> Any:
    return mod.RowSnapshot(row_id=rid, user_id=user, tool_name=tool, pattern=pattern)


def expected_new(tail: str, tool: str = "read_file") -> str:
    digest = hashlib.sha256(tail.encode("utf-8")).hexdigest()[:16]
    return f"doom_loop:{tool}:redacted-{digest}"


class FakeStore:
    """内存假件。apply_updates 是绊线:审计守护若敢写盘,当场炸给测试看。"""

    def __init__(self, mod: Any, rows: list[Any], *, table_exists: bool = True) -> None:
        self.mod = mod
        self.rows = rows
        self.table_exists = table_exists
        self.wrote = False
        self.closed = False

    async def schema_report(self) -> Any:
        return self.mod.SchemaReport(
            table_exists=self.table_exists,
            columns=frozenset(self.mod.REQUIRED_COLUMNS),
            unique_index_ok=True,
        )

    async def count_rows(self) -> tuple[int, int]:
        prefixed = sum(1 for r in self.rows if r.pattern.startswith(self.mod.PATTERN_PREFIX))
        return len(self.rows), prefixed

    async def fetch_prefixed_rows(self) -> list[Any]:
        return [r for r in self.rows if r.pattern.startswith(self.mod.PATTERN_PREFIX)]

    async def fetch_rows_by_patterns(self, patterns: list[str]) -> list[Any]:
        wanted = set(patterns)
        return [r for r in self.rows if r.pattern in wanted]

    async def apply_updates(self, updates: list[tuple[str, str, str]]) -> int:
        self.wrote = True
        raise AssertionError("审计守护绝不允许写盘(写盘只认交互终端手动 --apply)")

    async def close(self) -> None:
        self.closed = True


def _install_store(monkeypatch: pytest.MonkeyPatch, mod: Any, store: FakeStore) -> None:
    async def _opener(_dsn: str, *_a: Any, **_k: Any) -> FakeStore:
        return store

    monkeypatch.setattr(mod, "open_store", _opener)
    monkeypatch.setenv("DATABASE_URL", DSN)


# ---------------------------------------------------------------------------
# 判据单源:守护加载的就是清洗器脚本本体,不是第二份实现
# ---------------------------------------------------------------------------


def test_loaded_cleaner_is_the_script_itself() -> None:
    mod = daemon.load_cleaner()
    assert Path(str(mod.__file__)).resolve() == daemon._CLEANER_PATH
    assert mod.__name__ == daemon._CLEANER_MODNAME
    assert mod.__name__ != "redact_legacy_procedural_patterns", (
        "模块名必须与测试里那份实例错开,否则两个实例在 sys.modules 同键位互顶"
    )


# ---------------------------------------------------------------------------
# dry-run 计数与零写盘
# ---------------------------------------------------------------------------


async def test_dirty_rows_counted_and_zero_writes(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    mod = daemon.load_cleaner()
    store = FakeStore(
        mod,
        [
            row(mod, "1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}"),
            row(mod, "2", "u1", "run_command", "doom_loop:run_command:rm -rf /tmp/x"),
            row(mod, "3", "u2", "read_file", f"doom_loop:read_file:{'b' * 64}"),
            row(mod, "4", "u1", "read_file", "doom_loop:read_file:redacted-ffffffffffffffff"),
        ],
    )
    _install_store(monkeypatch, mod, store)

    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        out = await daemon.sweep_once()

    assert out["status"] == "ok"
    assert out["planned"] == 2
    assert out["safe_skipped"] == 2
    assert out["collide_with_existing"] == 0
    assert out["collide_within_candidates"] == 0
    assert store.wrote is False, "审计守护踩了 apply_updates = 越权写盘"
    assert store.closed is True
    warnings = " || ".join(r.getMessage() for r in caplog.records if r.levelno >= logging.WARNING)
    assert "--apply" in warnings and mod.CONFIRM_TOKEN in warnings, "有待改写行必须点名手动落盘命令"


async def test_all_safe_rows_zero_planned_and_no_warning(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    mod = daemon.load_cleaner()
    store = FakeStore(
        mod,
        [
            row(mod, "1", "u1", "read_file", f"doom_loop:read_file:{'a' * 64}"),
            row(mod, "2", "u1", "read_file", "doom_loop:read_file:redacted-1234567890abcdef"),
        ],
    )
    _install_store(monkeypatch, mod, store)

    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        out = await daemon.sweep_once()

    assert out["status"] == "ok"
    assert out["planned"] == 0
    assert out["safe_skipped"] == 2
    assert store.wrote is False
    assert [r for r in caplog.records if r.levelno >= logging.WARNING] == [], "干净库面不该喊狼"


async def test_collision_rows_also_trigger_warning(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    """待改写 0 行但撞键 >0 ⇒ 照样点名:撞键行是"机器无权决定"的存量,更需要人来看。"""
    mod = daemon.load_cleaner()
    new_form = expected_new(PLAIN_TAIL)
    store = FakeStore(
        mod,
        [
            row(mod, "1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}"),
            row(mod, "2", "u1", "read_file", new_form),
        ],
    )
    _install_store(monkeypatch, mod, store)

    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        out = await daemon.sweep_once()

    assert out["status"] == "ok"
    assert out["planned"] == 0
    assert out["collide_with_existing"] == 1
    warnings = " || ".join(r.getMessage() for r in caplog.records if r.levelno >= logging.WARNING)
    assert "--apply" in warnings


# ---------------------------------------------------------------------------
# 判不出来就喊:undetermined 绝不带计数字段
# ---------------------------------------------------------------------------


async def test_connection_failure_is_undetermined_not_zero_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    mod = daemon.load_cleaner()

    async def _boom(_dsn: str, *_a: Any, **_k: Any) -> Any:
        raise ConnectionError("连不上目标库:模拟")

    monkeypatch.setattr(mod, "open_store", _boom)
    monkeypatch.setenv("DATABASE_URL", DSN)

    out = await daemon.sweep_once()
    assert out["status"] == "undetermined"
    assert "planned" not in out, "读不到库面时不得交回任何计数(0 会被读成「扫过了,干净」)"


async def test_missing_dsn_is_undetermined(monkeypatch: pytest.MonkeyPatch) -> None:
    mod = daemon.load_cleaner()

    def _no_dsn(_args: Any) -> str:
        raise mod.DsnError("DSN 未配置:模拟三处都拿不到")

    monkeypatch.setattr(mod, "resolve_dsn", _no_dsn)

    out = await daemon.sweep_once()
    assert out["status"] == "undetermined"
    assert "planned" not in out


async def test_schema_mismatch_is_undetermined_and_store_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    mod = daemon.load_cleaner()
    store = FakeStore(mod, [], table_exists=False)
    _install_store(monkeypatch, mod, store)

    out = await daemon.sweep_once()
    assert out["status"] == "undetermined"
    assert "planned" not in out
    assert store.closed is True, "开出去的假连接也要收口,不许漏"


# ---------------------------------------------------------------------------
# 装载闩与数值档(与 expiry_janitor 同一形态)
# ---------------------------------------------------------------------------


def test_disabled_ensure_started_is_no_op(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROCEDURAL_REDACT_AUDIT_ENABLED", "0")
    assert daemon.ensure_started() is None


async def test_enabled_latch_is_idempotent_and_stop_resets(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    async def _stub_sweep() -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"status": "ok"}

    monkeypatch.setattr(daemon, "sweep_once", _stub_sweep)
    monkeypatch.setenv("PROCEDURAL_REDACT_AUDIT_ENABLED", "1")
    monkeypatch.setenv("PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS", "3600")

    first = daemon.ensure_started()
    second = daemon.ensure_started()
    assert first is not None and first is second, "重复装载不得再起第二个循环"
    assert not first.done()
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert calls == 0, "先睡后扫(与 expiry_janitor 同形):短命 lifespan(测试)全程不得碰真库"

    daemon.stop()
    assert daemon._task is None
    third = daemon.ensure_started()
    assert third is not None and third is not first, "stop() 后闩必须复位"
    third.cancel()


def test_interval_falls_back_and_clamps(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS", "abc")
    assert daemon.interval_seconds_from_env() == daemon.DEFAULT_INTERVAL_SECONDS
    monkeypatch.setenv("PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS", "-5")
    assert daemon.interval_seconds_from_env() == daemon.DEFAULT_INTERVAL_SECONDS
    monkeypatch.setenv("PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS", "1")
    assert daemon.interval_seconds_from_env() == daemon.MIN_INTERVAL_SECONDS
    monkeypatch.setenv("PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS", "600")
    assert daemon.interval_seconds_from_env() == 600.0
    monkeypatch.delenv("PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS")
    assert daemon.interval_seconds_from_env() == daemon.DEFAULT_INTERVAL_SECONDS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

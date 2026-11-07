# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Z35 装车证明:main.py lifespan 收尾步表真调到引擎侧排空腿(agent_engine 零改动)。

三条断言(对应任务①②③):
① 关停序列把该腿**调起恰好一次**(不是断言函数存在);
② 该腿抛异常 ⇒ 后续步骤照常执行,且经 `_run_shutdown_steps` 第③条报名(具名 warning),
   不掀翻关停序列;
③ 门控 off(三键全缺,且无在飞循环)⇒ 该腿零排空调用、零日志,与 Z32 默认档等价。
零真实网络/数据库:只用步表器械本身 + 记录器,不连 8810/8811。
"""

from __future__ import annotations

import inspect
import logging
import sys
import time
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main as app_main  # noqa: E402
from app.core import file_watcher as fw  # noqa: E402
from app.routers import engine as engine_router  # noqa: E402

LEG = "agent_engine_watchers"
OFF_KEYS = (
    "ENGINE_FILE_WATCHER_ENABLED",
    fw.POLL_ENABLED_ENV,
    fw.POLL_UNTIL_ENV,
    "IHUI_INCREMENTAL_INDEX_WINDOW_S",
)


@pytest.mark.asyncio
async def test_shutdown_sequence_invokes_engine_leg_exactly_once(
    monkeypatch: Any,
) -> None:
    """① 步表登记在该函数上 + 经真实 `_run_shutdown_steps` 跑一遍 ⇒ 被调恰好一次。"""
    calls: list[int] = []

    async def _rec() -> list[dict[str, Any]]:
        calls.append(1)
        return []

    monkeypatch.setattr(engine_router.ENGINE, "shutdown_workspace_watchers", _rec)
    src = inspect.getsource(app_main.lifespan)
    assert f'("{LEG}", _s_agent_engine_watchers)' in src, "该腿必须登记在 lifespan 步表"
    await app_main._run_shutdown_steps(
        [(LEG, app_main._s_agent_engine_watchers)], time.monotonic() + 5.0
    )
    assert calls == [1], f"关停序列必须把引擎腿调起恰好一次:{calls}"


@pytest.mark.asyncio
async def test_engine_leg_exception_named_and_sequence_continues(
    monkeypatch: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """② 腿抛异常 ⇒ 具名报名(不静默)且后续步骤照常执行(关停序列不被掀翻)。"""

    async def _boom() -> None:
        raise RuntimeError("watcher drain exploded")

    monkeypatch.setattr(engine_router.ENGINE, "shutdown_workspace_watchers", _boom)
    after: list[str] = []

    async def _sentinel() -> None:
        after.append("ran")

    with caplog.at_level(logging.WARNING):
        await app_main._run_shutdown_steps(
            [(LEG, app_main._s_agent_engine_watchers), ("sentinel_after", _sentinel)],
            time.monotonic() + 5.0,
        )
    assert after == ["ran"], "引擎腿异常不得吞掉后续资源释放步骤"
    msgs = [r.getMessage() for r in caplog.records]
    assert any(LEG in m and "失败" in m for m in msgs), f"异常必须具名报名: {msgs}"


@pytest.mark.asyncio
async def test_off_gate_leg_moves_nothing_and_speaks_nothing(
    monkeypatch: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """③ off 档(三键全缺 + 无在飞循环)⇒ 真引擎腿零排空调用、零日志、整链无报名。"""
    for key in OFF_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(engine_router.ENGINE, "_workspace_watchers", {}, raising=False)
    drains: list[str] = []

    async def _drain_rec(*args: Any, **kw: Any) -> dict[str, Any]:
        drains.append("called")
        return {"leg": "shutdown", "drain": "unreachable", "measured": True, "paths": 0}

    monkeypatch.setattr(engine_router.ENGINE, "drain_file_watch_on_shutdown", _drain_rec)
    with caplog.at_level(logging.WARNING):
        await app_main._run_shutdown_steps(
            [(LEG, app_main._s_agent_engine_watchers)], time.monotonic() + 5.0
        )
    assert drains == [], "off 档该腿必须零动作(与 Z32 默认档等价)"
    assert [r.getMessage() for r in caplog.records] == [], f"off 档不得出声: {caplog.records}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

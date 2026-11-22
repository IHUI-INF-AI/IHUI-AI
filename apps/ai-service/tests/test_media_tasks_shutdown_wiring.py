# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""媒体轮询关停接线取证(2026-11-02 立)。

`media_tasks.stop_media_task_poller` 自 2026-09-09 造好后一直是零调用方:main.py
lifespan 的关停清单里有 video_worker / mcp_stdio_bridge 等十几枚,独缺它 ⇒ 每轮
关停/热重载都会留下一个仍在扫描 media_tasks 在途任务的 asyncio.Task。

三面锁:
① 行为面 —— 轮询起来后确实在跑,stop 之后调用计数不再增长(副作用断言),且幂等;
② 接线面 —— main.py 的 steps 清单里确实登记了这一步,且登记的闭包真的调用 stop;
③ fail-open —— 用 main.py 里那份 `_run_shutdown_steps` 原函数体证明"该步异常不阻断
   其余步骤"(§0.6 不复制判据:整段函数体从源码取出后 exec,不在测试里重写一遍)。

**本文件刻意不 import app.main**:tests/conftest.py 的 autouse 限流隔离夹具依赖
"共享 app 的中间件栈已被建起来"(只有走过 `client` fixture 发过请求才会建),纯单元
文件一旦把 app.main 拉进 sys.modules,夹具就在 FastAPI 层断链并当场 raise,把本文件
所有用例连坐成 ERROR(现读实证:tests/test_admission_receipt_frame.py 同型 9 errors)。
conftest.py 不在本次可改面,故接线证据改走源码解析 + 定点 exec。

隔离:不连 PG/Redis(_poll_processing_batch 被 monkeypatch)。
"""

from __future__ import annotations

import ast
import asyncio
import logging
import time
from pathlib import Path
from typing import Any

import pytest

from app.services import media_tasks as mt

_MAIN_PY = Path(__file__).resolve().parents[1] / "app" / "main.py"


@pytest.fixture(autouse=True)
def _isolated_poller_globals(monkeypatch):
    """把轮询的三个模块级状态钉回初始形态,保证同一文件跑两次同结果。"""
    monkeypatch.setattr(mt, "_poller_task", None)
    monkeypatch.setattr(mt, "_poller_stop", asyncio.Event())
    monkeypatch.setattr(mt, "_MEDIA_POLLER_ENABLED", False)
    yield


async def test_stop_media_task_poller_halts_the_loop(monkeypatch):
    """① 行为面:start 后轮询在跑,stop 后计数不再增长、任务消失、再停不报错。"""
    calls = {"n": 0}

    async def _fake_batch() -> int:
        calls["n"] += 1
        return 0

    monkeypatch.setattr(mt, "_poll_processing_batch", _fake_batch)
    monkeypatch.setattr(mt, "_MEDIA_POLLER_ENABLED", True)
    monkeypatch.setattr(mt, "_MEDIA_POLL_INTERVAL", 0.01)

    mt.start_media_task_poller()
    task: Any = mt._poller_task
    assert task is not None and not task.done(), "轮询任务应已建起"
    try:
        await asyncio.sleep(0.08)
        assert calls["n"] >= 1, "轮询循环应至少跑过一批"

        await mt.stop_media_task_poller()
        assert mt._poller_task is None
        assert task.done()
        settled = calls["n"]
        await asyncio.sleep(0.08)
        assert calls["n"] == settled, "关停后不得再跑任何一批(泄漏即此项失败)"
        # 幂等:重复关停不报错、不再造任务
        await mt.stop_media_task_poller()
        assert mt._poller_task is None
    finally:
        if mt._poller_task is not None and not mt._poller_task.done():
            mt._poller_task.cancel()


async def test_disabled_poller_stop_is_a_noop() -> None:
    """开关 off 时 start 不起任务,stop 也不得凭空造/等任务。"""
    mt.start_media_task_poller()
    assert mt._poller_task is None
    await mt.stop_media_task_poller()
    assert mt._poller_task is None


# ---------------------------------------------------------------------------
# main.py 侧的接线证据(源码解析,不 import app.main)
# ---------------------------------------------------------------------------


def _main_tree() -> ast.Module:
    return ast.parse(_MAIN_PY.read_text(encoding="utf-8"))


def _find_function(tree: ast.AST, name: str) -> ast.AST:
    node = next(
        (
            n
            for n in ast.walk(tree)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name
        ),
        None,
    )
    assert node is not None, f"main.py 里必须仍有 {name}"
    return node


def _lifespan_steps() -> list[tuple[str, ast.expr]]:
    """解析 lifespan 的 steps 清单,返回 [(步名, 工厂 AST 节点), ...]。"""
    lifespan = _find_function(_main_tree(), "lifespan")
    steps_list = next(
        (
            s.value
            for s in ast.walk(lifespan)
            if isinstance(s, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "steps" for t in s.targets)
            and isinstance(s.value, ast.List)
        ),
        None,
    )
    assert steps_list is not None, "lifespan 内必须仍有 steps = [...] 关停清单"
    parsed: list[tuple[str, ast.expr]] = []
    for element in steps_list.elts:
        assert isinstance(element, ast.Tuple) and len(element.elts) == 2, (
            "steps 每项必须是 (名称, 工厂) 二元组"
        )
        name_node, factory_node = element.elts
        assert isinstance(name_node, ast.Constant) and isinstance(name_node.value, str)
        assert isinstance(factory_node, ast.expr)
        parsed.append((name_node.value, factory_node))
    return parsed


def test_shutdown_steps_register_media_task_poller() -> None:
    """② 接线面:steps 登记了 media_task_poller,工厂就地定义且真的调用 stop。"""
    steps = _lifespan_steps()
    names = [n for n, _ in steps]
    assert len(names) == len(set(names)), "steps 步名不得重复"
    assert "media_task_poller" in names, "关停清单必须包含 media_task_poller"
    idx = names.index("media_task_poller")
    assert names[idx - 1] == "video_worker", "与启动侧顺序对称:video_worker 之后紧邻媒体轮询"
    factory = dict(steps)["media_task_poller"]
    assert isinstance(factory, ast.Name) and factory.id == "_s_media_task_poller", (
        f"工厂应是就地闭包 _s_media_task_poller,实际:{ast.dump(factory)}"
    )

    tree = _main_tree()
    fn = _find_function(tree, "_s_media_task_poller")
    assert isinstance(fn, ast.AsyncFunctionDef), "关停步骤必须是可等待的 async 闭包"
    called = {
        c.func.id
        for c in ast.walk(fn)
        if isinstance(c, ast.Call) and isinstance(c.func, ast.Name)
    }
    assert "stop_media_task_poller" in called, (
        f"_s_media_task_poller 必须真的调用 stop_media_task_poller,实际调用:{called}"
    )
    imported = {
        alias.name
        for c in ast.walk(fn)
        if isinstance(c, ast.ImportFrom)
        for alias in c.names
        if c.module == "app.services.media_tasks"
    }
    assert "stop_media_task_poller" in imported, "必须从 app.services.media_tasks 取该出口"


def _load_run_shutdown_steps() -> Any:
    """把 main.py 的 `_run_shutdown_steps` 函数体原样 exec 出来(单源,不复制判据)。"""
    tree = _main_tree()
    fn = _find_function(tree, "_run_shutdown_steps")
    module = ast.Module(body=[fn], type_ignores=[])
    ast.fix_missing_locations(module)
    namespace: dict[str, Any] = {
        "asyncio": asyncio,
        "time": time,
        "logger": logging.getLogger("test-shutdown"),
        "_SHUTDOWN_STEP_CAP_S": 0.5,
        "Iterable": __import__("collections.abc", fromlist=["Iterable"]).Iterable,
        "Callable": __import__("collections.abc", fromlist=["Callable"]).Callable,
        "Awaitable": __import__("typing").Awaitable,
        "Any": Any,
    }
    exec(compile(module, str(_MAIN_PY), "exec"), namespace)  # noqa: S102 - 取的是在册实现本体
    return namespace["_run_shutdown_steps"]


async def test_shutdown_step_is_fail_open() -> None:
    """③ 该步异常不得阻断其余步骤(用 main.py 里那份真实执行器验证)。"""
    run_shutdown_steps = _load_run_shutdown_steps()
    seen: list[str] = []

    async def _boom() -> None:
        seen.append("media_task_poller")
        raise RuntimeError("关停轮询失败(测试注入)")

    async def _ok() -> None:
        seen.append("next")

    await run_shutdown_steps(
        [("media_task_poller", _boom), ("next_step", _ok)],
        time.monotonic() + 5.0,
    )
    assert seen == ["media_task_poller", "next"], "坏步骤必须只报名、不吞后续资源释放"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自动化配置缓存与调度任务镜像的封顶(2026-11-01 安全强化第 24 批)。

同族第 7 批。两处的共同形状:**进程内只增不减,而写入由外部调用驱动**。
本文件不重复实现封顶判据(单源在 `bounded_ttl_store.BoundedTtlDict`),只钉三件事:
① 上限真的存在且可观测;② 越限前行为一字不变(不能把在用的记录当垃圾扫掉);
③ **调用点真的走了新出口** —— 这一格是本仓最贵的教训:mypy 抓到过"新版函数被同名旧版
静默遮蔽",测试全绿而封顶是死的。故 ③ 用 AST 判代码面,不判文字。
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from app.core.bounded_ttl_store import BoundedTtlDict
from app.services import mcp_server

SRC = Path(mcp_server.__file__).resolve()


def test_automation_configs_is_bounded_with_ttl() -> None:
    store = mcp_server._AUTOMATION_CONFIGS
    assert isinstance(store, BoundedTtlDict), "封顶必须住在存储本身,指望调用方记得清不算"
    assert store.max_keys == mcp_server._AUTOMATION_CONFIGS_MAX_KEYS == 512
    assert store.ttl_seconds > 0, "无 TTL 的用户原文留存 = 进程无限期留住投喂内容"


def test_automation_configs_evicts_oldest_only_when_over_cap() -> None:
    """逐出语义在**独立小实例**上量(max_keys 是只读属性,不去改生产存储)。"""
    store = BoundedTtlDict(max_keys=3, ttl_seconds=3600.0, slide_on_read=False)
    for i in range(3):
        store[f"k{i}"] = {"n": i}
    assert store.evictions == 0, "未越限不得逐出(在用的记录不能当垃圾扫)"
    store["k3"] = {"n": 3}
    assert "k0" not in store, "越限后必须从最旧一端逐出"
    assert "k3" in store and "k2" in store
    assert store.evictions == 1


def test_automation_configs_drops_expired_without_reading() -> None:
    """过期条目即使不再被读也必须出局(TTL 不判就永不消失的那一型)。"""
    clock = {"t": 1_000.0}
    store = BoundedTtlDict(max_keys=8, ttl_seconds=60.0, clock=lambda: clock["t"])
    store["a"] = {"v": 1}
    clock["t"] += 61.0
    store["b"] = {"v": 2}  # 写入顺带扫过期
    assert "a" not in store
    assert store.expired_swept >= 1, "过期逐出必须可观测,不能静默消失"


def test_remember_scheduled_task_trims_at_cap_and_counts_drops() -> None:
    saved_list = list(mcp_server._SCHEDULED_TASKS)
    saved_drops = mcp_server.scheduled_tasks_mirror_drops
    saved_cap = mcp_server._SCHEDULED_TASKS_MAX_MIRROR
    try:
        mcp_server._SCHEDULED_TASKS.clear()
        mcp_server.scheduled_tasks_mirror_drops = 0
        mcp_server._SCHEDULED_TASKS_MAX_MIRROR = 4  # type: ignore[misc]

        for i in range(4):
            mcp_server._remember_scheduled_task({"task_id": str(i)})
        assert len(mcp_server._SCHEDULED_TASKS) == 4
        assert mcp_server.scheduled_tasks_mirror_drops == 0, "未越限不得丢条"

        mcp_server._remember_scheduled_task({"task_id": "4"})
        assert len(mcp_server._SCHEDULED_TASKS) == 4
        assert [t["task_id"] for t in mcp_server._SCHEDULED_TASKS] == ["1", "2", "3", "4"]
        assert mcp_server.scheduled_tasks_mirror_drops == 1
    finally:
        mcp_server._SCHEDULED_TASKS_MAX_MIRROR = saved_cap  # type: ignore[misc]
        mcp_server.scheduled_tasks_mirror_drops = saved_drops
        mcp_server._SCHEDULED_TASKS.clear()
        mcp_server._SCHEDULED_TASKS.extend(saved_list)


def _enclosing_func(tree: ast.Module, node: ast.AST) -> str:
    for parent in ast.walk(tree):
        if isinstance(parent, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for child in ast.walk(parent):
                if child is node:
                    return parent.name
    return "<module>"


def test_getitem_matches_dict_semantics_including_expiry() -> None:
    """`store[k]` 必须与 `k in store` 对"过期"给同一个答案。

    这对运算符是为了让封顶存储能**原地替掉**旧 dict 而补的;若两处判序不一致,
    读写点就会在"有没有这一条"上互相打脸(本仓反复栽在两套口径分叉)。
    """
    clock = {"t": 1000.0}
    store = BoundedTtlDict(max_keys=4, ttl_seconds=10.0, clock=lambda: clock["t"])
    store["a"] = {"v": 1}
    assert store["a"]["v"] == 1
    clock["t"] += 11.0
    assert "a" not in store
    with pytest.raises(KeyError):
        _ = store["a"]


def test_schedule_site_actually_routes_through_the_capped_helper() -> None:
    """接线锁:`_SCHEDULED_TASKS.append` 只许出现在 `_remember_scheduled_task` 里。

    用 AST 判**代码面**:负断言若按整文件字符串比,会把我写的说明文字判成违规
    (本仓为此反复自伤),而放宽成"有就算过"又抓不到"调用点还走裸 append"这一真病灶。
    """
    tree = ast.parse(SRC.read_text(encoding="utf-8"), filename=str(SRC))
    offenders = [
        _enclosing_func(tree, node)
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "append"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "_SCHEDULED_TASKS"
    ]
    assert offenders == ["_remember_scheduled_task"], f"裸 append 残留在:{offenders}"

    sites = [
        _enclosing_func(tree, node)
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "_remember_scheduled_task"
    ]
    assert "schedule" in "".join(sites).lower(), f"生产调用点没接上出口,实际在:{sites}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

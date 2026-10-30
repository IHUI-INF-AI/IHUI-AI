# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""bg_task_status 的身份只认宿主注入(2026-10-31 立)。

现读缺陷(app/services/mcp_server.py 的 `_tool_bg_task_status`):

    user_id = arguments.get("user_id") or arguments.get("__user_id")

模型自填的 `user_id` 排在宿主注入值**前面** ⇒ 模型只要在参数里报一个别人的 uuid,
就能列出别人正在跑的任务(任务名/状态/result 原文)。这直接违反
`packages/types/src/tool-contract.ts` 的 ROUTING_IDENTITY_KEYS(含 `user_id`)
"路由身份键由宿主绑定、禁入模型参数"契约;而 `task_id` 档更连归属都不问,
拿到 id 就回详情 ⇒ task_id 成了他人任务的枚举面。

修法:身份只取 `__user_id`,取不到就拒绝(fail-closed);`task_id` 命中但主体不同
按"不存在"同形返回(不给枚举信号);schema 里的 `user_id` 属性一并摘除
—— 只要还暴露在 schema,就必然再被某条 handler 读回去。

四档成对钉:摘掉主体绑定 ⇒ ①②翻红;把"非本人=同形不存在"改成恒拒 ⇒ ④翻红。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import background_tasks as bg_module
from app.services.mcp_server import _tool_bg_task_status

VICTIM = "u-victim"
ATTACKER = "u-attacker"

_TASKS: dict[str, dict[str, Any]] = {
    "t-1": {"task_id": "t-1", "name": "受害者跑的批处理", "user_id": VICTIM, "state": "running"},
    "t-2": {"task_id": "t-2", "name": "我自己的任务", "user_id": ATTACKER, "state": "done"},
}


class _FakeManager:
    def __init__(self, tasks: dict[str, dict[str, Any]]) -> None:
        self._tasks = tasks
        self.list_calls: list[str | None] = []

    async def get_status(self, task_id: str) -> dict[str, Any] | None:
        found = self._tasks.get(task_id)
        return dict(found) if found is not None else None

    async def list_tasks(
        self, user_id: str | None = None, limit: int = 20
    ) -> list[dict[str, Any]]:
        self.list_calls.append(user_id)
        items = [
            dict(r) for r in self._tasks.values() if user_id is None or r["user_id"] == user_id
        ]
        return items[: max(0, limit)]


@pytest.fixture()
def fake_manager(monkeypatch: pytest.MonkeyPatch) -> _FakeManager:
    mgr = _FakeManager(_TASKS)
    monkeypatch.setattr(bg_module, "background_task_manager", mgr)
    return mgr


async def test_model_supplied_user_id_cannot_list_others(fake_manager: _FakeManager) -> None:
    """① 模型自填他人 uuid ⇒ 仍以宿主主体过滤(旧写法把模型值排在前面,本条翻红)。"""
    res = await _tool_bg_task_status(
        {"user_id": VICTIM, "__user_id": ATTACKER, "limit": 10}
    )

    assert res["ok"] is True
    assert [t["task_id"] for t in res["tasks"]] == ["t-2"]
    # 而且传给 store 的过滤主体必须是宿主值,不是模型值
    assert fake_manager.list_calls == [ATTACKER]


async def test_missing_host_principal_denies(fake_manager: _FakeManager) -> None:
    """② 宿主身份缺失 ⇒ 拒(旧写法会退成 user_id=None ⇒ list_tasks(None) ⇒ 全站任务清单)。"""
    res = await _tool_bg_task_status({"limit": 10})

    assert res["ok"] is False
    assert res.get("errorCode") == "PRINCIPAL_REQUIRED"
    assert "tasks" not in res
    assert fake_manager.list_calls == []


async def test_foreign_task_id_is_shaped_like_missing(fake_manager: _FakeManager) -> None:
    """③ 拿别人的 task_id ⇒ 与"不存在"同形,不给枚举信号。"""
    res = await _tool_bg_task_status({"task_id": "t-1", "__user_id": ATTACKER})

    assert res["ok"] is False
    assert "任务不存在" in res["error"]


async def test_own_task_id_returns_status(fake_manager: _FakeManager) -> None:
    """④ 正向对照:本人的 task_id 正常回状态(防判据被改成恒拒式假绿)。"""
    res = await _tool_bg_task_status({"task_id": "t-1", "__user_id": VICTIM})

    assert res["ok"] is True
    assert res["task"]["name"] == "受害者跑的批处理"

    listed = await _tool_bg_task_status({"__user_id": VICTIM, "limit": 10})
    assert [t["task_id"] for t in listed["tasks"]] == ["t-1"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""云运行路由的授权接线(§5「认证不等于授权」):令牌主体必须显式传进 store。

立因(现读,非推断):改前 GET /api/cloud-runs 与 GET /api/cloud-runs/{id} 只把
`user_id` 写进 logger,`list()/get()/complete()` 一个归属参数都不接 ⇒ 任一登录用户
读到他人全部运行记录(任务文本 + 完整 output),PATCH 还能改写他人运行状态。
本文件钉的是"承载层不再丢弃身份"这一格:摘掉路由里任何一处 `user_id=`,即翻红。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import cloud_runs
from app.routers.cloud_runs import RunCompleteRequest, RunStartRequest
from app.services.cloud_run_store import CloudRun


class _Captured:
    """记录 store 各方法被怎么调用,并把返回值钉成可控样本。"""

    def __init__(self, monkeypatch: pytest.MonkeyPatch, run: CloudRun | None) -> None:
        self.calls: list[dict[str, Any]] = []
        self._run = run
        st = cloud_runs.cloud_run_store
        monkeypatch.setattr(st, "get", self._get, raising=True)
        monkeypatch.setattr(st, "list", self._list, raising=True)
        monkeypatch.setattr(st, "complete", self._complete, raising=True)
        monkeypatch.setattr(st, "start", self._start, raising=True)

    def _get(self, run_id: str, **kwargs: Any) -> CloudRun | None:
        self.calls.append({"fn": "get", "args": (run_id,), "kwargs": kwargs})
        return self._run

    def _list(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append({"fn": "list", "args": (), "kwargs": kwargs})
        return {"list": [], "total": 0, "page": 1, "page_size": 20}

    def _complete(self, run_id: str, **kwargs: Any) -> CloudRun | None:
        self.calls.append({"fn": "complete", "args": (run_id,), "kwargs": kwargs})
        return self._run

    def _start(self, task: str, **kwargs: Any) -> CloudRun:
        self.calls.append({"fn": "start", "args": (task,), "kwargs": kwargs})
        return CloudRun(run_id="r1", task=task, status="running", user_id=kwargs.get("user_id", ""))

    def kwargs_of(self, fn: str) -> dict[str, Any]:
        matched = [c["kwargs"] for c in self.calls if c["fn"] == fn]
        assert matched, f"{fn} 未被调用"
        return matched[0]


def _run(owner: str) -> CloudRun:
    return CloudRun(run_id="r1", task="secret task", status="done", user_id=owner, output="out")


@pytest.mark.asyncio
async def test_list_forwards_principal_to_store(monkeypatch: pytest.MonkeyPatch) -> None:
    cap = _Captured(monkeypatch, None)
    await cloud_runs.list_cloud_runs(page=1, page_size=20, status=None, user_id="alice")
    assert cap.kwargs_of("list").get("user_id") == "alice"


@pytest.mark.asyncio
async def test_get_forwards_principal_and_missing_is_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cap = _Captured(monkeypatch, None)
    with pytest.raises(HTTPException) as exc:
        await cloud_runs.get_cloud_run("r1", user_id="alice")
    assert exc.value.status_code == 404
    assert cap.kwargs_of("get").get("user_id") == "alice"


@pytest.mark.asyncio
async def test_get_of_other_owners_run_is_404_not_200(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """跨用户读必须走 404 这一条:store 按主体过滤后返回 None,路由不得再"补一次无归属读"。"""
    _Captured(monkeypatch, None)
    with pytest.raises(HTTPException) as exc:
        await cloud_runs.get_cloud_run("r1", user_id="bob")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_complete_forwards_principal(monkeypatch: pytest.MonkeyPatch) -> None:
    cap = _Captured(monkeypatch, _run("alice"))
    await cloud_runs.complete_cloud_run(
        "r1", RunCompleteRequest(status="done", output="o"), user_id="alice"
    )
    assert cap.kwargs_of("complete").get("user_id") == "alice"


@pytest.mark.asyncio
async def test_complete_of_foreign_run_is_404(monkeypatch: pytest.MonkeyPatch) -> None:
    cap = _Captured(monkeypatch, None)
    with pytest.raises(HTTPException) as exc:
        await cloud_runs.complete_cloud_run(
            "r1", RunCompleteRequest(status="done", output="劫持"), user_id="bob"
        )
    assert exc.value.status_code == 404
    # 副作用没发生:store 收到的归属是 bob(而不是绕过过滤直写)
    assert cap.kwargs_of("complete").get("user_id") == "bob"


@pytest.mark.asyncio
async def test_start_stamps_principal(monkeypatch: pytest.MonkeyPatch) -> None:
    cap = _Captured(monkeypatch, None)
    await cloud_runs.create_cloud_run(RunStartRequest(task="t"), user_id="alice")
    assert cap.kwargs_of("start").get("user_id") == "alice"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

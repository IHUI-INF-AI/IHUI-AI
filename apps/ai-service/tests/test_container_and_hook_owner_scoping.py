# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""容器运行与 Hook 面的归属对账(2026-09-27 批 63 / G-258 A 组)。

形状与批 61 完全相同:端点 `Depends(get_current_user_id)` 取到令牌主体却只用在一侧
(建资源时写 owner),**读 / 列 / 杀**三向都不看它。本轮收的是"属主字段本来就在"的六条:

  · `GET /agent-runtime/runs` · `GET /runs/{id}` · `GET /runs/{id}/stream` · `DELETE /runs/{id}`
    (owner 存在 `ContainerRun.user_id`,由 `start_run(user_id=…)` 写入)
  · `GET /hooks/logs` 的全站档(过滤写在 `hook_engine.list_logs(owner_id=…)`)
  · `GET /hooks/{id}/execution-timeline` / `/health-forecast`(与同文件既有的
    `GET /hooks/{id}/logs` 同一条闸)
  · `POST /hooks/templates/{id}/instantiate`(此前不传 owner ⇒ 造出系统级 Hook,人人可管)

当时按住未收口的同型面(browser_hub / computer_use / browser_trace / A-B 测试 / hooks emit /
patch root 白名单 / sandbox 策略)**已全部收口**,逐票与判据在 PROJECT_PLAN 的 G-258 B 组:
批 65(browser_hub 会话属主 + WS 主体)、批 66(Hook 触发集与 A/B 归属)、批 68(patch 允许集合
+ 沙箱档位收归服务端登记表)、批 70(computer_use 按用户隔离 + trace 属主)。
仍留在账上、**不由这几票裁**的三格:按用户落点缺配置来源(身份只做归因)、可选档位的授予源
属 RBAC 决策、每人一只浏览器没有并发上界(旧 docstring 那句"由 lifespan 统一收口"经 grep
证伪,已就地推翻为"未收口")。

隔离:全部进程内对象 + monkeypatch,不派生子进程、不碰生产 PG(8810)/Redis(8811)、
不建真容器、不读 data/ 下的任何持久化文件。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import agent_runtime as ar
from app.routers import hooks as hooks_router
from app.services.container_runtime import ContainerRun, ContainerRuntime, _RunHandle
from app.services.hook_engine import HookEngine

# ---------------------------------------------------------------------------
# 容器运行面
# ---------------------------------------------------------------------------


def _run(run_id: str, owner: str | None, started_at: str) -> _RunHandle:
    return _RunHandle(
        run=ContainerRun(
            run_id=run_id,
            task=f"任务-{run_id}",
            status="running",
            user_id=owner or "",
            started_at=started_at,
        )
    )


@pytest.fixture
def runtime() -> ContainerRuntime:
    rt = ContainerRuntime()
    # 直接填内部 dict(等价于 start_run 落完 owner 之后的状态),不派生任何进程
    rt._runs.clear()
    rt._runs["run-a"] = _run("run-a", "alice", "2026-09-27T00:00:01Z")
    rt._runs["run-b"] = _run("run-b", "bob", "2026-09-27T00:00:02Z")
    yield rt
    rt._runs.clear()


def test_list_runs_is_owner_scoped(runtime: ContainerRuntime) -> None:
    alice = [r["run_id"] for r in runtime.list_runs(owner_user_id="alice")]
    bob = [r["run_id"] for r in runtime.list_runs(owner_user_id="bob")]
    assert alice == ["run-a"] and bob == ["run-b"]
    # 未鉴权 / 管理员通道(None)维持全量 —— 与本模块既有 owner 约定同形
    assert {r["run_id"] for r in runtime.list_runs()} == {"run-a", "run-b"}


def test_run_gate_is_not_an_existence_probe(runtime: ContainerRuntime, monkeypatch) -> None:
    monkeypatch.setattr(ar, "container_runtime", runtime)
    assert ar._run_or_404("run-a", "alice")["run_id"] == "run-a"
    with pytest.raises(HTTPException) as foreign:
        ar._run_or_404("run-a", "mallory")
    with pytest.raises(HTTPException) as missing:
        ar._run_or_404("run-does-not-exist", "mallory")
    assert foreign.value.status_code == 404 and missing.value.status_code == 404
    # 同模板句式:分成"存在但不是你的"与"不存在"就把端点变成存在性探针
    assert str(foreign.value.detail).startswith("运行记录不存在")
    assert str(missing.value.detail).startswith("运行记录不存在")


def test_cancel_gate_runs_before_killing(runtime: ContainerRuntime, monkeypatch) -> None:
    """越权取消必须**没发生**:只断言 404 会放过"先杀了再拒"那种写法。"""
    monkeypatch.setattr(ar, "container_runtime", runtime)
    handle = runtime._runs["run-a"]

    def _boom(*_a: Any, **_k: Any) -> None:
        raise AssertionError("归属判定之前不得触碰 cancel()")

    monkeypatch.setattr(runtime, "cancel", _boom)
    with pytest.raises(HTTPException):
        ar._run_or_404("run-a", "bob")
    assert handle.run.status == "running"


# ---------------------------------------------------------------------------
# Hook 面
# ---------------------------------------------------------------------------


def _engine() -> HookEngine:
    eng = HookEngine()
    eng._hooks = {
        "hk-a": {"id": "hk-a", "name": "a", "owner_id": "alice", "event": "tool.before"},
        "hk-b": {"id": "hk-b", "name": "b", "owner_id": "bob", "event": "tool.before"},
    }
    eng._logs = [
        {"hookId": "hk-a", "triggeredAt": "2026-09-27T00:00:00Z", "event": "tool.before"},
        {"hookId": "hk-b", "triggeredAt": "2026-09-27T00:00:01Z", "event": "tool.before"},
    ]
    return eng


async def test_list_logs_owner_filter_scopes_the全站档(monkeypatch) -> None:
    eng = _engine()
    assert {l["hookId"] for l in eng.list_logs(owner_id="alice")} == {"hk-a"}
    assert {l["hookId"] for l in eng.list_logs(owner_id="bob")} == {"hk-b"}
    assert len(eng.list_logs()) == 2, "None(管理员/系统级)不得被收窄"
    # 反向对照:owner 过滤不得把 event/success 等**既有维度**判据弄丢
    # (本文件写这段时真丢过一次 —— Edit 的 old_string 停在 `if event:` 半行,
    #  下一行赋值被吞,`event=` 过滤整型失效。)
    assert len(eng.list_logs(event="tool.before", owner_id="alice")) == 1
    assert eng.list_logs(event="no-such-event", owner_id="alice") == []

    monkeypatch.setattr(hooks_router, "hook_engine", eng)
    req = SimpleNamespace(state=SimpleNamespace(user_id="alice", role_id=0))
    out = await hooks_router.list_all_logs(req, limit=100, user_id="alice")
    assert {l["hookId"] for l in out["data"]["logs"]} == {"hk-a"}


async def test_admin_channel_still_sees_all(monkeypatch) -> None:
    """`_owner_filter` 对管理员返回 None ⇒ 全站档照给 —— 既有分级,不是本票新开的口子。"""
    eng = _engine()
    monkeypatch.setattr(hooks_router, "hook_engine", eng)
    req = SimpleNamespace(state=SimpleNamespace(user_id="root", role_id=1))
    out = await hooks_router.list_all_logs(req, limit=100, user_id="root")
    assert {l["hookId"] for l in out["data"]["logs"]} == {"hk-a", "hk-b"}


async def test_instantiate_template_binds_creator(monkeypatch) -> None:
    eng = _engine()
    captured: dict[str, Any] = {}

    async def _fake(
        template_id: str, overrides: dict[str, Any], owner_id: str | None = None
    ) -> dict[str, Any]:
        captured["owner_id"] = owner_id
        captured["template_id"] = template_id
        return {"id": "hk-new", "owner_id": owner_id}

    monkeypatch.setattr(eng, "instantiate_template", _fake)
    monkeypatch.setattr(hooks_router, "hook_engine", eng)
    req = SimpleNamespace(state=SimpleNamespace(user_id="alice", role_id=0))
    out = await hooks_router.instantiate_template(
        req,
        "webhook-basic",
        hooks_router.InstantiateTemplateBody(overrides={}),
        user_id="alice",
    )
    assert out["data"]["id"] == "hk-new"
    assert captured["owner_id"] == "alice", "模板创建的 hook 落成 owner_id=None = 系统级、人人可管"


async def test_timeline_and_forecast_gate_before_reading(monkeypatch) -> None:
    eng = _engine()
    monkeypatch.setattr(hooks_router, "hook_engine", eng)
    called: list[str] = []

    async def _tl(hook_id: str, since: str | None = None) -> dict[str, Any]:
        called.append("timeline")
        return {"hook_id": hook_id}

    async def _hf(hook_id: str, days: int = 7) -> dict[str, Any]:
        called.append("forecast")
        return {"hook_id": hook_id}

    monkeypatch.setattr(eng, "execution_timeline", _tl)
    monkeypatch.setattr(eng, "health_forecast", _hf)
    bob = SimpleNamespace(state=SimpleNamespace(user_id="bob", role_id=0))
    with pytest.raises(HTTPException) as e1:
        await hooks_router.execution_timeline(bob, "hk-a", None, user_id="bob")
    with pytest.raises(HTTPException) as e2:
        await hooks_router.health_forecast(bob, "hk-a", 7, user_id="bob")
    assert e1.value.status_code == 404 and e2.value.status_code == 404
    assert called == [], "被拒的两条仍然读了 alice 的日志(判定晚于取数)"
    alice = SimpleNamespace(state=SimpleNamespace(user_id="alice", role_id=0))
    await hooks_router.execution_timeline(alice, "hk-a", None, user_id="alice")
    assert called == ["timeline"], "正向对照:属主本人的链路不得被本票改坏"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

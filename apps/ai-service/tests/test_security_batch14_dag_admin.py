# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 14 批:DAG/WorkerPool 面的 admin 收敛 + 子进程 env/cwd 收敛(2026-10-31)。

现读缺陷(回源确认):
  1) `app/api/dag.py` 的 router 只有 JWTAuthMiddleware 的"已登录"约束,而 `taskType`
     可声明 `long_running_command` / `test_suite` ⇒ **任意登录用户(role=0)提交一个
     DAG 即以服务账号执行任意命令**,与 MCP 工具面 `run_command` 的 admin-only 档
     (`mcp_server._ADMIN_ONLY_TOOLS`)同能力却低一档门槛。`/dag/tasks` 走同一分派
     (`dag_scheduler._default_executor` → `execute_task`),同型。
  2) `task_executors.run_command` 的两个调用腿都没传 `env` ⇒ 子进程完整继承
     服务进程 os.environ(provider API key / JWT_SECRET / AI_CALLBACK_SECRET)。
  3) `cwd` 是任务参数里的自由字符串 ⇒ 可在服务器任意目录起进程。

本文件钉住三档,各带变异自证:
  A 非 admin(role=0)打 /dag/execute、/dag/tasks ⇒ 403;读面同样 403。
  B admin(role=1)可到达 handler(不是 403)。
  C 子进程环境默认走 CORE 白名单:KEY/SECRET/TOKEN 形名一律不在。
  D 越界 cwd 被拒;登记根内 cwd 放行。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import dag as dag_module
from app.services import task_executors as tx

# =============================================================================
# A/B:DAG 面 admin 闸
# =============================================================================

ADMIN_ROLE = 1
USER_ROLE = 0


def _make_app(role_id: int) -> FastAPI:
    """裸 app + 注入 role 的中间件(替代真 JWTAuthMiddleware 的注入面)。"""
    app = FastAPI()
    app.include_router(dag_module.router, prefix="/api")

    @app.middleware("http")
    async def _inject_role(request: Any, call_next: Any) -> Any:
        request.state.role_id = role_id
        request.state.user_id = "u-1"
        return await call_next(request)

    return app


@pytest.fixture(autouse=True)
def _reset_dag_globals(monkeypatch):
    monkeypatch.setattr(dag_module, "_pool", None)
    monkeypatch.setattr(dag_module, "_executions", {})
    yield
    dag_module._pool = None
    dag_module._executions.clear()


async def _post(app: FastAPI, path: str, body: dict[str, Any]):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        return await ac.post(path, json=body)


async def test_dag_execute_rejected_for_plain_user():
    """A1 非 admin 的 DAG 执行 ⇒ 403(核心:任意登录用户不得以服务身份起进程)。"""
    resp = await _post(_make_app(USER_ROLE), "/api/dag/execute", {"nodes": []})
    assert resp.status_code == 403


async def test_dag_tasks_rejected_for_plain_user():
    """A2 非 admin 的 WorkerPool 提交 ⇒ 403(同一条分派出口的另一扇门)。"""
    resp = await _post(
        _make_app(USER_ROLE),
        "/api/dag/tasks",
        {"agentId": "a1", "name": "n"},
    )
    assert resp.status_code == 403


async def test_dag_read_faces_rejected_for_plain_user():
    """A3 读面同样 403:执行结果里带命令 argv 与 stdout/stderr 片段。"""
    app = _make_app(USER_ROLE)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        for path in ("/api/dag/tasks", "/api/dag/workers", "/api/dag/execute/x"):
            resp = await ac.get(path)
            assert resp.status_code == 403, path


async def test_admin_reaches_handler(monkeypatch):
    """B admin 能到达 handler(证明 403 是闸给出,不是路由坏了)。"""
    fake = MagicMock()
    fake.add_node = MagicMock()
    fake_result = MagicMock()
    fake_result.status = "success"
    fake_result.node_results = {}
    fake_result.total_duration_ms = 1.0
    fake_result.trace = []
    fake.execute = AsyncMock(return_value=fake_result)
    monkeypatch.setattr(dag_module, "DAGScheduler", lambda: fake)

    resp = await _post(_make_app(ADMIN_ROLE), "/api/dag/execute", {"nodes": []})
    assert resp.status_code == 200, resp.text


# =============================================================================
# C:子进程环境白名单
# =============================================================================


def test_child_env_excludes_secrets(monkeypatch):
    """C 默认子进程环境不得携带 KEY/SECRET/TOKEN 形名变量。"""
    poison = {
        "OPENAI_API_KEY": "sk-live-xxx",
        "JWT_SECRET": "jwt-xxx",
        "AI_CALLBACK_SECRET": "cb-xxx",
        "SOME_TOKEN": "tk-xxx",
        "PATH": "/usr/bin:/bin",
    }
    for k, v in poison.items():
        monkeypatch.setenv(k, v)

    env = tx._default_child_env()
    assert "OPENAI_API_KEY" not in env
    assert "JWT_SECRET" not in env
    assert "AI_CALLBACK_SECRET" not in env
    assert "SOME_TOKEN" not in env
    # 对照:核心运行变量必须留下,否则子进程连解释器都找不到
    assert env.get("PATH")


def test_explicit_env_is_not_rewritten(monkeypatch):
    """C2 调用方显式传 env 时原样使用(不被本层悄悄改写,责任在调用方)。"""
    sentinel = {"A": "1"}
    captured: dict[str, Any] = {}

    async def fake_exec(*argv: Any, **kwargs: Any) -> Any:
        captured.update(kwargs)
        raise FileNotFoundError("stop-here")

    monkeypatch.setattr(tx.asyncio, "create_subprocess_exec", fake_exec)
    import asyncio

    with pytest.raises(tx.TaskExecutionError):
        asyncio.get_event_loop_policy().new_event_loop().run_until_complete(
            tx.run_command(["x"], task_id="t", env=sentinel)
        )
    assert captured.get("env") == sentinel


def test_run_command_default_env_is_allowlisted(monkeypatch):
    """C3 run_command 不传 env 时用的是白名单环境,而不是 None(继承)。"""
    monkeypatch.setenv("LEAKY_SECRET_VALUE", "nope")
    captured: dict[str, Any] = {}

    async def fake_exec(*argv: Any, **kwargs: Any) -> Any:
        captured.update(kwargs)
        raise FileNotFoundError("stop-here")

    monkeypatch.setattr(tx.asyncio, "create_subprocess_exec", fake_exec)
    import asyncio

    with pytest.raises(tx.TaskExecutionError):
        asyncio.get_event_loop_policy().new_event_loop().run_until_complete(
            tx.run_command(["x"], task_id="t")
        )
    assert captured.get("env") is not None
    assert "LEAKY_SECRET_VALUE" not in captured["env"]


# =============================================================================
# D:cwd 收敛到登记工作区根
# =============================================================================


def test_cwd_outside_registered_roots_is_rejected(monkeypatch, tmp_path):
    """D1 未登记的 cwd(如系统目录)被拒。"""
    from app.services import workspace_roots

    monkeypatch.setattr(workspace_roots, "registered_workspace_roots", lambda: [str(tmp_path)])
    with pytest.raises(tx.TaskExecutionError):
        tx._resolve_workspace_cwd("C:\\Windows\\System32")


def test_cwd_inside_registered_root_is_accepted(monkeypatch, tmp_path):
    """D2 登记根内的 cwd 放行。"""
    from app.services import workspace_roots

    monkeypatch.setattr(workspace_roots, "registered_workspace_roots", lambda: [str(tmp_path)])
    got = tx._resolve_workspace_cwd(str(tmp_path))
    assert got is not None
    assert str(tmp_path) in got


def test_empty_cwd_stays_none():
    """D3 未给 cwd ⇒ None(继承服务 cwd),不因缺参数而报错。"""
    assert tx._resolve_workspace_cwd(None) is None
    assert tx._resolve_workspace_cwd("") is None
    assert tx._resolve_workspace_cwd("   ") is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""容器运行时 router 端点测试(独立文件)。

从 test_container_runtime.py 拆分出来,保持纯运行时测试与 HTTP 端点测试
的依赖边界(router 测试需要完整 conftest 环境 client/JWT)。
"""

import contextlib
import sys
import uuid

import pytest

from app.services.cloud_run_store import CloudRunStore
from app.services.container_runtime import ContainerRuntime

PY = sys.executable or "python"


def _make_runtime(tmp_path) -> ContainerRuntime:
    rt = ContainerRuntime(
        store=CloudRunStore(file_path=tmp_path / "cloud_runs.json"),
        persist_path=tmp_path / "container_runs.json",
    )
    rt._docker_available = False
    return rt


@pytest.fixture
async def api_client(client, monkeypatch, tmp_path):
    """router 级测试:固定 JWT 用户 + 替换单例为注入临时存储的运行时(无 docker)。

    yield 后先 shutdown 回收后台子进程任务——pytest-asyncio loop teardown 阶段
    _cancel_all_tasks 无法安全取消 create_subprocess_exec 中的任务(Windows
    Proactor IOCP 永等),必须在用例作用域内终结。
    """
    from app.core.jwt_auth import get_current_user_id
    from app.routers import agent_runtime as _ar_mod

    rt = _make_runtime(tmp_path)
    monkeypatch.setattr(_ar_mod, "container_runtime", rt)
    # 注意:app.main.app 是 socketio.ASGIApp 包装,依赖注入表在内部 FastAPI 实例上
    from app.main import fastapi_app

    fastapi_app.dependency_overrides[get_current_user_id] = lambda: "test-user-rt"
    yield client, rt
    # kill 残留子进程让 _execute 自然收尾(勿依赖 cancel,Windows 下取消可能挂死)
    for handle in rt._runs.values():
        proc = handle.proc
        if proc is not None and proc.returncode is None:
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
    await rt.shutdown(timeout=15)
    fastapi_app.dependency_overrides.pop(get_current_user_id, None)


async def test_router_start_get_delete_run(api_client):
    """POST /api/agent-runtime/runs 启动 → GET 状态 → DELETE 终止(信封 code=0)。"""
    http, rt = api_client
    resp = await http.post(
        "/api/agent-runtime/runs",
        json={"task": "长任务", "command": [PY, "-c", "import time; time.sleep(60)"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["execution_env"] == "local-fallback"
    run_id = body["data"]["run_id"]

    resp = await http.get(f"/api/agent-runtime/runs/{run_id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "running"

    resp = await http.delete(f"/api/agent-runtime/runs/{run_id}")
    assert resp.status_code == 200
    assert resp.json()["code"] == 0

    done = await rt.wait_run(run_id, timeout=15)
    assert done["status"] == "cancelled"


async def test_router_run_not_found(api_client):
    """GET/DELETE 不存在的 run → 404。"""
    http, _ = api_client
    rid = uuid.uuid4().hex
    assert (await http.get(f"/api/agent-runtime/runs/{rid}")).status_code == 404
    assert (await http.delete(f"/api/agent-runtime/runs/{rid}")).status_code == 404
    assert (
        await http.get(f"/api/agent-runtime/runs/{rid}/stream")
    ).status_code == 404


async def test_router_sse_stream(api_client):
    """SSE 流:连接 /runs/{id}/stream 可收到 stdout 与 exit 事件。"""
    http, rt = api_client
    resp = await http.post(
        "/api/agent-runtime/runs",
        json={"task": "SSE", "command": [PY, "-c", "print('sse-hello')"]},
    )
    run_id = resp.json()["data"]["run_id"]
    await rt.wait_run(run_id, timeout=30)

    lines: list[str] = []
    async with http.stream("GET", f"/api/agent-runtime/runs/{run_id}/stream") as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        async for line in r.aiter_lines():
            lines.append(line)
            # exit 事件的 data 行含 status,读到即止(比只等 "event: exit" 多一行)
            if '"status"' in line:
                break
    text = "\n".join(lines)
    assert "event: start" in text
    assert "event: stdout" in text
    assert "sse-hello" in text
    assert "event: exit" in text
    assert '"status": "done"' in text

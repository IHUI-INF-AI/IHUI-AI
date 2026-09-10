# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""容器运行时(container_runtime)单元测试。

设计原则:本机可能没有 docker,全部用例走"降级路径 + monkeypatch",无 docker 也全绿:
- docker 不可用 → 自动降级 local-fallback(真实本地子进程执行,跨平台)
- 任务启动/完成/超时/终止全生命周期
- 执行记录 JSON 持久化 + cloud_run_store 端闭环联动
- docker 路径的参数构造与 tar 快照打包(纯函数断言,不拉真容器)
- router 端点:POST /runs 启动 + GET 状态 + DELETE 终止(依赖注入固定用户)
"""

import asyncio
import contextlib
import io
import json
import sys
import tarfile

import pytest

from app.services.cloud_run_store import CloudRunStore
from app.services.container_runtime import ContainerRuntime

# 跨平台可用的真实命令(直接 exec,不经 shell,规避引号差异)
PY = sys.executable or "python"


@pytest.fixture(autouse=True)
async def _reap_container_tasks():
    """用例结束后回收所有运行时的后台子进程任务。

    Windows 根因修复:pytest-asyncio 在 loop teardown 阶段用
    _cancel_all_tasks 取消残留任务,而处于 create_subprocess_exec /
    pipe transport 回收中的任务无法完成取消,Proactor IOCP 永等 →
    整个 pytest 进程挂死。因此 start_run 派生的任务必须在用例内终结。
    """
    yield
    for rt in list(_LIVE_RUNTIMES):
        # 先 kill 仍在运行的子进程,让 _execute 自然收尾;
        # shutdown 内的 cancel 兜底在 Windows 下可能无法完成(根因所在),
        # 因此这里必须走"kill → 任务自行终结"路径而非依赖 cancel。
        for handle in rt._runs.values():
            proc = handle.proc
            if proc is not None and proc.returncode is None:
                with contextlib.suppress(ProcessLookupError):
                    proc.kill()
        await rt.shutdown(timeout=15)
    _LIVE_RUNTIMES.clear()


# 记录本模块创建过的运行时实例,供 autouse fixture 统一回收后台任务
_LIVE_RUNTIMES: list[ContainerRuntime] = []


def _make_runtime(tmp_path) -> ContainerRuntime:
    """构造注入临时存储的运行时(docker 不可用 → 走降级路径)。"""
    rt = ContainerRuntime(
        store=CloudRunStore(file_path=tmp_path / "cloud_runs.json"),
        persist_path=tmp_path / "container_runs.json",
    )
    rt._docker_available = False  # 强制 docker 不可用,走 local-fallback
    _LIVE_RUNTIMES.append(rt)
    return rt


# =============================================================================
# 降级链路:docker 不可用 → local-fallback 真实执行
# =============================================================================


async def test_docker_unavailable_falls_back_to_local(tmp_path):
    """docker 不可用时自动降级为本地子进程沙箱并标记 execution_env=local-fallback。"""
    rt = _make_runtime(tmp_path)
    run = await rt.start_run("打印 42", [PY, "-c", "print(42)"])
    assert run["execution_env"] == "local-fallback"
    assert run["status"] == "running"

    done = await rt.wait_run(run["run_id"], timeout=30)
    assert done is not None
    assert done["status"] == "done"
    assert done["exit_code"] == 0
    assert "42" in done["output"]
    assert done["ended_at"]


async def test_local_fallback_uses_workspace_snapshot(tmp_path):
    """降级路径把 files 快照解包到临时 cwd,命令可在其中读到文件。"""
    rt = _make_runtime(tmp_path)
    run = await rt.start_run(
        "读工作区文件",
        [PY, "-c", "import pathlib; print(pathlib.Path('main.py').read_text(encoding='utf-8'))"],
        files={"main.py": "print('from workspace')"},
    )
    done = await rt.wait_run(run["run_id"], timeout=30)
    assert done is not None
    assert done["status"] == "done"
    assert "from workspace" in done["output"]


# =============================================================================
# cloud_run_store 端闭环联动
# =============================================================================


async def test_cloud_run_store_linkage(tmp_path):
    """每次容器运行同时写入 cloud_run_store:start(running) → complete(done/output)。"""
    store = CloudRunStore(file_path=tmp_path / "cloud_runs.json")
    rt = ContainerRuntime(
        store=store, persist_path=tmp_path / "container_runs.json"
    )
    rt._docker_available = False
    _LIVE_RUNTIMES.append(rt)

    run = await rt.start_run("排序算法任务", [PY, "-c", "print('ok')"], user_id="u-1")
    assert store.get(run["run_id"]) is not None
    assert store.get(run["run_id"]).status == "running"

    await rt.wait_run(run["run_id"], timeout=30)
    linked = store.get(run["run_id"])
    assert linked is not None
    assert linked.status == "done"
    assert "ok" in linked.output
    assert linked.agent_type == "container-runtime"
    assert linked.user_id == "u-1"


# =============================================================================
# 执行记录持久化
# =============================================================================


async def test_execution_record_persisted(tmp_path):
    """执行记录落盘 data/container_runs.json(注入 tmp_path),含终态字段。"""
    rt = _make_runtime(tmp_path)
    run = await rt.start_run("持久化测试", [PY, "-c", "print('persist')"])
    await rt.wait_run(run["run_id"], timeout=30)

    data = json.loads((tmp_path / "container_runs.json").read_text(encoding="utf-8"))
    rec = next(r for r in data if r["run_id"] == run["run_id"])
    assert rec["status"] == "done"
    assert rec["execution_env"] == "local-fallback"
    assert "persist" in rec["output"]


# =============================================================================
# 超时强杀
# =============================================================================


async def test_run_timeout_kills_process(tmp_path):
    """超时强杀:status=timeout,且在超时上限内返回(不死等)。"""
    rt = _make_runtime(tmp_path)
    run = await rt.start_run(
        "睡 60 秒", [PY, "-c", "import time; time.sleep(60)"], timeout_sec=1
    )
    done = await rt.wait_run(run["run_id"], timeout=30)
    assert done is not None
    assert done["status"] == "timeout"
    assert "超时" in done["error"]


# =============================================================================
# 终止(cancel)
# =============================================================================


async def test_cancel_terminates_running_process(tmp_path):
    """DELETE 终止:运行中进程被强杀,终态 cancelled。"""
    rt = _make_runtime(tmp_path)
    run = await rt.start_run("长任务", [PY, "-c", "import time; time.sleep(60)"])
    await asyncio.sleep(0.3)  # 等子进程拉起
    snap = rt.cancel(run["run_id"])
    assert snap is not None

    done = await rt.wait_run(run["run_id"], timeout=15)
    assert done is not None
    assert done["status"] == "cancelled"
    # 幂等:再次 cancel 不抛错
    assert rt.cancel(run["run_id"])["status"] == "cancelled"


def test_cancel_unknown_run_returns_none(tmp_path):
    """cancel 不存在的 run 返回 None。"""
    rt = _make_runtime(tmp_path)
    assert rt.cancel("no-such-run") is None
    assert rt.snapshot("no-such-run") is None


# =============================================================================
# docker 路径:参数构造与 tar 快照(纯函数,不依赖真实 docker)
# =============================================================================


def test_docker_args_construction():
    """docker run 参数:镜像 + /workspace 工作目录 + tar 解包前缀(有文件时)。"""
    args = ContainerRuntime._docker_args("python main.py", "python:3.12-slim", True)
    assert args[:2] == ["docker", "run"]
    assert "--rm" in args and "-i" in args
    assert args[args.index("-w") + 1] == "/workspace"
    assert "python:3.12-slim" in args
    script = args[-1]
    assert "tar -x -C /workspace" in script
    assert "python main.py" in script

    # 无文件快照时不带 tar 解包前缀
    args_nofiles = ContainerRuntime._docker_args("python -V", "img", False)
    assert "tar -x" not in args_nofiles[-1]


def test_build_tar_snapshot():
    """工作区快照 tar 打包:相对路径 + 内容一致。"""
    files = {"main.py": "print(1)", "src/util.py": "x = 2"}
    raw = ContainerRuntime._build_tar(files)
    buf = io.BytesIO(raw)
    with tarfile.open(fileobj=buf, mode="r") as tf:
        names = tf.getnames()
        assert set(names) == set(files)
        content = tf.extractfile("src/util.py").read().decode("utf-8")
        assert content == "x = 2"


async def test_docker_detection_failure_is_cached(tmp_path, monkeypatch):
    """docker 探测失败(命令不存在)→ 缓存 False,后续直接走降级。"""
    rt = ContainerRuntime(persist_path=tmp_path / "c.json")
    # 注意:此用例不注册进 _LIVE_RUNTIMES——monkeypatch 的 fake exec 仅在用例内生效,
    # teardown 阶段若再触发 create_subprocess_exec 会拿到已还原的真实事件循环对象。

    async def _fail_exec(*args, **kwargs):
        raise FileNotFoundError("docker not found")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _fail_exec)
    assert await rt.detect_docker() is False
    # 第二次走缓存,不再触发探测(monkeypatch 仍在也无所谓)
    assert await rt.detect_docker() is False


# =============================================================================
# 事件流(队列缓冲)
# =============================================================================


async def test_events_streamed_and_buffered(tmp_path):
    """stdout/stderr 事件进队列,exit 事件收尾;无消费者时缓冲可回放。"""
    rt = _make_runtime(tmp_path)
    run = await rt.start_run("事件流", [PY, "-c", "print('line-1')"])
    await rt.wait_run(run["run_id"], timeout=30)

    q = rt.events_queue(run["run_id"])
    assert q is not None
    events = []
    while not q.empty():
        events.append(q.get_nowait())
    kinds = [e["event"] for e in events]
    assert kinds[0] == "start"
    assert "stdout" in kinds
    assert kinds[-1] == "exit"
    stdout_evt = next(e for e in events if e["event"] == "stdout")
    assert "line-1" in stdout_evt["data"]


# Router 端点测试已拆分到 test_container_runtime_router.py,
# 避免本文件 import app.routers.agent_runtime 触发 langgraph/memory 初始化
# 导致 Windows Proactor 事件循环下 collect 阶段挂起。

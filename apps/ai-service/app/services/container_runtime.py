# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""真实云端 Agent 容器运行时(对标 Cursor Cloud Agents / Codex CI sandbox)。

与 cloud_runs.py(仅会话历史记录 API)不同,本模块补齐"真执行层":
- Docker 可用时:拉起一次性容器(python:3.12-slim,可经 CONTAINER_IMAGE 覆盖),
  把工作区快照(dict[相对路径 -> 文本内容])打成 tar 从 stdin 传入容器内 /workspace
  解包,执行任务命令,流式收集 stdout/stderr,超时强杀,结果回传。
- Docker 不可用时:自动降级为本地子进程沙箱(临时目录 + 子进程,Windows cmd /c、
  POSIX sh -c),并标记 execution_env="local-fallback",保证链路永不断。
- 每次运行与 cloud_run_store 联动(start/complete),形成端到端闭环记录。
- 执行记录额外持久化到 data/container_runs.json(进程重启可恢复查看)。

事件流模型:每个运行持有 asyncio.Queue,执行协程按序推入
start / stdout / stderr / exit 事件,SSE 端点实时消费;
无消费者时事件在队列中缓冲,连接后可回放。
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import shlex
import shutil
import sys
import tarfile
import tempfile
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .cloud_run_store import CloudRunStore, cloud_run_store

logger = logging.getLogger(__name__)

# 单条输出/错误持久化截断上限(对齐 cloud_run_store 的防膨胀策略)
OUTPUT_LIMIT = 50_000
ERROR_LIMIT = 5_000

# JSON 持久化文件(ai-service 根下的 data/container_runs.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_DEFAULT_PERSIST_FILE = _DATA_DIR / "container_runs.json"


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级),与 cloud_run_store 格式一致。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@dataclass
class ContainerRun:
    """单次容器/降级沙箱运行的执行记录快照。"""

    run_id: str
    task: str
    command: str = ""
    image: str = ""
    status: str = "running"  # running / done / error / timeout / cancelled
    execution_env: str = ""  # docker / local-fallback
    exit_code: int | None = None
    output: str = ""
    error: str = ""
    user_id: str = ""
    started_at: str = field(default_factory=_now_iso)
    ended_at: str = ""


@dataclass
class _RunHandle:
    """运行内部句柄:记录 + 事件队列 + 子进程引用(进程内可见,不持久化)。"""

    run: ContainerRun
    events: "asyncio.Queue[dict[str, Any]]" = field(default_factory=asyncio.Queue)
    proc: asyncio.subprocess.Process | None = None
    cancel_requested: bool = False
    done_event: asyncio.Event = field(default_factory=asyncio.Event)
    task: "asyncio.Task[None] | None" = None  # _execute 后台任务句柄(shutdown 用)


class ContainerRuntime:
    """Agent 容器运行时:Docker 优先,本地子进程沙箱降级。"""

    def __init__(
        self,
        *,
        store: CloudRunStore | None = None,
        persist_path: Path | None = None,
    ) -> None:
        self._runs: dict[str, _RunHandle] = {}
        self._store = store  # None 时懒取全局 cloud_run_store 单例(便于测试注入)
        self._persist_file = persist_path or _DEFAULT_PERSIST_FILE
        # docker 可用性缓存:None=未探测,True/False=已探测(测试可 monkeypatch)
        self._docker_available: bool | None = None

    # ---------------- 对外 API ----------------

    async def detect_docker(self) -> bool:
        """探测 docker daemon 是否可用(docker info);结果缓存,失败视为不可用。

        Windows 注意:daemon 未启动时 `docker info` 会挂起(命名管道等待),
        因此 wait_for 超时后必须显式 kill + wait 回收子进程,否则协程悬挂。
        """
        if self._docker_available is not None:
            return self._docker_available
        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "info", "--format", "{{.ServerVersion}}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
            ok = proc.returncode == 0 and bool(out.strip())
        except (asyncio.TimeoutError, FileNotFoundError, OSError):
            ok = False
        except Exception:
            ok = False
        finally:
            # 超时路径下 communicate 被取消但子进程仍在运行:强杀并回收。
            # 注意不能 await(可能处于 loop 关闭阶段),用同步 poll + kill 尽力而为。
            if proc is not None and proc.returncode is None:
                try:
                    proc._transport.close()  # type: ignore[attr-defined]
                except Exception:
                    pass
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
        self._docker_available = ok
        logger.info("[container_runtime] docker 可用性探测: %s", ok)
        return ok

    async def start_run(
        self,
        task: str,
        command: str | list[str],
        *,
        files: dict[str, str] | None = None,
        image: str | None = None,
        timeout_sec: float | None = None,
        user_id: str = "",
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """启动一次容器/沙箱运行(异步后台执行),立即返回运行记录快照。

        - files: 工作区快照(dict[相对路径 -> 文本内容]),tar 打包传入容器 /workspace,
          降级路径则解包到本地临时目录作为 cwd。
        - command: str(容器内 sh / 本地 shell 解释)或 list(容器内 shlex.join,
          本地直接 exec,无 shell 注入面)。
        - image: 覆盖镜像,默认取 CONTAINER_IMAGE 环境变量,再默认 python:3.12-slim。
        - timeout_sec: 执行超时(秒),超时强杀进程并置 status=timeout。
        """
        run_id = run_id or uuid.uuid4().hex
        resolved_image = image or os.getenv("CONTAINER_IMAGE") or "python:3.12-slim"
        env = "docker" if await self.detect_docker() else "local-fallback"
        cmd_str = command if isinstance(command, str) else shlex.join(command)

        # 与 cloud_run_store 联动:同时写入云托管运行记录(端闭环)
        self._get_store().start(
            task,
            run_id=run_id,
            agent_type="container-runtime",
            user_id=user_id,
            session_alias=run_id,
        )

        run = ContainerRun(
            run_id=run_id,
            task=task[:2000],
            command=cmd_str[:2000],
            image=resolved_image if env == "docker" else "",
            execution_env=env,
            user_id=user_id,
        )
        handle = _RunHandle(run=run)
        self._runs[run_id] = handle
        handle.events.put_nowait({"event": "start", "run_id": run_id, "execution_env": env})
        self._persist()
        # 保留原始命令形态(list 直接 exec 无 shell 注入面;str 经 shell 解释),
        # 避免 shlex.join 后再被 cmd /c 二次解释导致 Windows 语法错误
        handle.task = asyncio.create_task(
            self._execute(handle, dict(files or {}), timeout_sec, command)
        )
        logger.info(
            "[container_runtime] 启动 run=%s env=%s task=%s",
            run_id, env, task[:80],
        )
        return self.snapshot(run_id)  # type: ignore[return-value]

    async def wait_run(self, run_id: str, timeout: float = 60.0) -> dict[str, Any] | None:
        """等待运行进入终态(测试与同步调用辅助),超时返回当前快照。"""
        handle = self._runs.get(run_id)
        if handle is None:
            return None
        try:
            await asyncio.wait_for(handle.done_event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            pass
        return self.snapshot(run_id)

    def cancel(self, run_id: str) -> dict[str, Any] | None:
        """终止运行:强杀子进程,状态置 cancelled;不存在返回 None。幂等。"""
        handle = self._runs.get(run_id)
        if handle is None:
            return None
        if handle.run.status == "running":
            handle.cancel_requested = True
            proc = handle.proc
            if proc is not None and proc.returncode is None:
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
        return self.snapshot(run_id)

    def snapshot(self, run_id: str) -> dict[str, Any] | None:
        """取运行记录快照(dict);不存在返回 None。"""
        handle = self._runs.get(run_id)
        return asdict(handle.run) if handle else None

    def events_queue(self, run_id: str) -> "asyncio.Queue[dict[str, Any]] | None":
        """取运行的事件队列(SSE 消费用);不存在返回 None。"""
        handle = self._runs.get(run_id)
        return handle.events if handle else None

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        """列出本进程内的运行记录快照(新→旧)。"""
        items = [asdict(h.run) for h in self._runs.values()]
        items.sort(key=lambda r: r["started_at"], reverse=True)
        return items[: max(1, limit)]

    async def shutdown(self, timeout: float = 10.0) -> None:
        """回收所有后台执行任务:等待其自然终结,超时则 cancel。

        2026-09-06 修复(Windows):事件循环关闭阶段(pytest-asyncio
        _scoped_runner teardown → _cancel_all_tasks),若 _execute 任务仍
        处于 create_subprocess_exec 内部,取消永远无法完成,Proactor IOCP
        永等导致整个进程挂死。因此调用方(测试 fixture / 应用 lifespan)必须
        在 loop 结束前 await shutdown(),确保所有子进程任务已终结。
        """
        tasks = [h.task for h in self._runs.values() if h.task is not None]
        pending = [t for t in tasks if not t.done()]
        if pending:
            _, still = await asyncio.wait(pending, timeout=timeout)
            for t in still:
                t.cancel()
            if still:
                # cancel 兜底路径同样可能触发 subprocess race,
                # 用 wait 限时收敛,异常一律吞掉(shutdown 语义为尽力而为)
                await asyncio.gather(*still, return_exceptions=True)

    # ---------------- 内部执行 ----------------

    def _get_store(self) -> CloudRunStore:
        """取联动存储(测试注入优先,否则全局单例)。"""
        return self._store if self._store is not None else cloud_run_store

    @staticmethod
    def _build_tar(files: dict[str, str]) -> bytes:
        """把工作区快照打成 tar 字节流(容器内解包到 /workspace)。"""
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w", encoding="utf-8") as tf:
            for rel, content in files.items():
                data = content.encode("utf-8")
                info = tarfile.TarInfo(name=rel)
                info.size = len(data)
                tf.addfile(info, io.BytesIO(data))
        return buf.getvalue()

    @staticmethod
    def _docker_args(cmd: str, image: str, has_files: bool) -> list[str]:
        """构造 docker run 参数(纯函数,便于单测断言)。"""
        script = (f"mkdir -p /workspace && tar -x -C /workspace && {cmd}" if has_files else cmd)
        return [
            "docker", "run", "--rm", "-i", "-w", "/workspace", image,
            "sh", "-c", script,
        ]

    @staticmethod
    def _local_args(cmd: str | list[str]) -> tuple[list[str], str]:
        """构造本地降级沙箱参数。返回 (argv, shell_name);list 命令直接 exec 无 shell。"""
        if isinstance(cmd, list):
            return list(cmd), ""
        if sys.platform == "win32":
            return ["cmd", "/c", cmd], "cmd"
        return ["sh", "-c", cmd], "sh"

    async def _pump_stream(self, handle: _RunHandle, stream: Any, kind: str) -> None:
        """流式读取子进程 stdout/stderr:逐行推事件 + 累积到 run.output。"""
        run = handle.run
        while True:
            line = await stream.readline()
            if not line:
                break
            text = line.decode("utf-8", "replace").rstrip("\r\n")
            if not text:
                continue
            if len(run.output) < OUTPUT_LIMIT:
                run.output = (run.output + text + "\n")[:OUTPUT_LIMIT]
            handle.events.put_nowait({"event": kind, "data": text})

    @staticmethod
    async def _write_stdin(proc: asyncio.subprocess.Process, data: bytes) -> None:
        """写入 stdin 数据并原子回收 transport(供 shield 调用)。

        Windows Proactor 下 stdin pipe 的 drain/wait_closed 若在取消中被打断,
        transport 会永久滞留待回收队列(bpo-46813),故整体作为不可分割单元执行。
        """
        assert proc.stdin is not None
        proc.stdin.write(data)
        await proc.stdin.drain()
        proc.stdin.close()
        await proc.stdin.wait_closed()  # 显式回收 transport,规避 Proactor GC 竞态

    async def _execute(
        self,
        handle: _RunHandle,
        files: dict[str, str],
        timeout_sec: float | None,
        command: str | list[str],
    ) -> None:
        """后台执行协程:拉起子进程 → 流式收集 → 超时/终止处理 → 结果回传。

        2026-09-05 修复(Windows):asyncio Proactor 事件循环下,子进程 pipe
        transport 在 GC 时会向（可能已关闭的）事件循环投递 post_close，
        导致解释器退出阶段 fatal error 或挂起。因此在协程内显式 close 并
        wait_closed 三个 pipe transport，确保 transport 生命周期先于 loop 结束。
        """
        run = handle.run
        workdir: str | None = None
        proc: asyncio.subprocess.Process | None = None
        try:
            if run.execution_env == "docker":
                argv = self._docker_args(run.command, run.image, bool(files))
                stdin_data = self._build_tar(files) if files else None
                cwd = None
            else:
                # 本地降级沙箱:临时目录解包快照作为执行 cwd(与容器 /workspace 等价)
                if files:
                    workdir = tempfile.mkdtemp(prefix="agent-runtime-")
                    for rel, content in files.items():
                        p = Path(workdir) / rel
                        p.parent.mkdir(parents=True, exist_ok=True)
                        p.write_text(content, encoding="utf-8")
                argv, _shell = self._local_args(command)
                stdin_data = None
                cwd = workdir

            # spawn 阶段 cancel 保护(根因修复):Windows Proactor 下,若在
            # create_subprocess_exec 进行中收到取消,transport 创建无法回滚,
            # _cancel_all_tasks 的 gather 会 IOCP 永等。shield 让 spawn 原子
            # 完成后,取消分支再显式回收子进程与 transport。
            spawn_fut = asyncio.ensure_future(
                asyncio.create_subprocess_exec(
                    *argv,
                    stdin=asyncio.subprocess.PIPE if stdin_data is not None else asyncio.subprocess.DEVNULL,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=cwd,
                )
            )
            try:
                proc = await asyncio.shield(spawn_fut)
            except asyncio.CancelledError:
                proc = await spawn_fut  # spawn 未被中断,等其完成拿回进程
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                run.status = "cancelled"
                run.error = "任务在进程拉起阶段被取消"
                raise
            handle.proc = proc

            if stdin_data is not None:
                assert proc.stdin is not None
                # shield:drain/wait_closed 被 cancel 时 Windows Proactor 的
                # stdin transport 会永久卡在 _wait_closed(bpo-46813),
                # 导致事件循环关闭阶段死锁;shield 确保回收原子完成。
                await asyncio.shield(self._write_stdin(proc, stdin_data))

            pumps = [
                asyncio.create_task(self._pump_stream(handle, proc.stdout, "stdout")),
                asyncio.create_task(self._pump_stream(handle, proc.stderr, "stderr")),
            ]
            try:
                code = await asyncio.wait_for(proc.wait(), timeout=timeout_sec)
                run.exit_code = code
                # 外部 cancel():kill 后 wait 正常返回(Windows 退出码非零),
                # cancel 语义优先于"退出码非零即 error"
                if handle.cancel_requested:
                    run.status = "cancelled"
                else:
                    run.status = "done" if code == 0 else "error"
                    if code != 0:
                        run.error = f"命令退出码非零: {code}"
            except asyncio.TimeoutError:
                # 超时强杀:kill 后 wait 让 pump 自然 EOF 收尾
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                await proc.wait()
                run.status = "timeout"
                run.error = f"执行超时({timeout_sec}s),进程已强杀"
            # shield:pipe 读取被 cancel 会留下未终结的 read transport,
            # loop teardown 阶段 _cancel_all_tasks 将无法完成回收
            await asyncio.shield(asyncio.gather(*pumps, return_exceptions=True))

        except Exception as e:  # 拉起失败等:降级记录,不让后台任务静默崩
            run.status = "error"
            run.error = str(e)[:ERROR_LIMIT]
            logger.warning("[container_runtime] run=%s 执行异常: %s", run.run_id, e)
        finally:
            # Windows Proactor 兼容:显式关闭剩余 pipe transport,避免 GC 时
            # 向已关闭事件循环投递 post_close 造成退出挂起/fatal error
            if proc is not None:
                for pipe in (proc.stdin, proc.stdout, proc.stderr):
                    transport = getattr(pipe, "_transport", None) if pipe is not None else None
                    if transport is not None:
                        try:
                            transport.close()
                        except Exception:  # 尽力而为,关闭失败不影响终态记录
                            pass
            run.ended_at = _now_iso()
            handle.events.put_nowait({
                "event": "exit",
                "status": run.status,
                "exit_code": run.exit_code,
            })
            # cloud_run_store 回传:非 done/error 状态映射为 error(其只认 done/error),
            # 具体 timeout/cancelled 语义保留在本模块执行记录中。
            store_status = "done" if run.status == "done" else "error"
            self._get_store().complete(
                run.run_id,
                status=store_status,
                output=run.output,
                error=run.error or (run.status if run.status != "done" else ""),
            )
            self._persist()
            if workdir:
                shutil.rmtree(workdir, ignore_errors=True)
            handle.done_event.set()
            logger.info(
                "[container_runtime] 结束 run=%s status=%s exit=%s",
                run.run_id, run.status, run.exit_code,
            )

    # ---------------- 持久化 ----------------

    def _persist(self) -> None:
        """把进程内运行记录全量写回 JSON(尽力,失败降级内存保留)。"""
        try:
            self._persist_file.parent.mkdir(parents=True, exist_ok=True)
            data = [asdict(h.run) for h in self._runs.values()]
            self._persist_file.write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as e:
            logger.warning("[container_runtime] 写盘失败(内存保留): %s", e)


# 全局单例(router 挂载共用)
container_runtime = ContainerRuntime()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

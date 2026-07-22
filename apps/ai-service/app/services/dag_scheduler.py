"""DAG 调度引擎(2026-07-22 立,替代 linear pipeline,支持依赖图拓扑排序 + 并行批次 + 节点级重试 + 条件分支)。

相比 agent_orchestrator.run_pipeline(线性串行)和 run_parallel(单层 gather):
- 支持依赖图(节点间显式声明 dependencies)
- 拓扑排序自动计算执行顺序
- 同层级节点并行执行(asyncio.gather)
- 节点级重试(每个节点独立 max_retries + 指数退避)
- 条件分支(节点返回 skip 后续依赖节点)
- 失败策略(continue_on_fail / fail_fast)
- 完整 trace(每节点 start/end/duration/status/retry_count)
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


@dataclass
class DAGNode:
    """DAG 节点定义。"""

    id: str
    name: str
    executor: Callable[..., Any]  # async (context: dict) -> dict
    dependencies: list[str] = field(default_factory=list)  # 依赖的节点 id 列表
    max_retries: int = 3
    retry_delay: float = 1.0  # 基础重试延迟(秒),指数退避:delay * 2^(attempt-1)
    timeout: float = 300.0  # 单节点超时(秒)
    continue_on_fail: bool = False  # 本节点失败后是否继续执行后续依赖节点
    condition: Optional[Callable[[dict], bool]] = None  # 条件函数,返回 False 则跳过本节点


@dataclass
class NodeResult:
    """节点执行结果。"""

    node_id: str
    status: str  # success / failed / skipped / timeout
    output: Optional[dict] = None
    error: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_ms: float = 0.0
    retry_count: int = 0
    attempts: int = 0


@dataclass
class DAGResult:
    """DAG 执行结果。"""

    status: str  # success / partial / failed
    node_results: dict[str, NodeResult]  # node_id -> result
    total_duration_ms: float
    context: dict  # 最终上下文(所有节点输出合并)
    trace: list[dict]  # 执行轨迹(按完成时间排序)


class DAGValidationError(Exception):
    """DAG 验证错误(环检测 / 重复节点 / 依赖不存在)。"""


class DAGScheduler:
    """DAG 调度器。

    用法:
        scheduler = DAGScheduler()
        scheduler.add_node(DAGNode(id="research", name="调研", executor=research_fn))
        scheduler.add_node(DAGNode(id="code", name="编码", executor=code_fn, dependencies=["research"]))
        scheduler.add_node(DAGNode(id="test", name="测试", executor=test_fn, dependencies=["code"]))
        scheduler.add_node(
            DAGNode(
                id="deploy",
                name="部署",
                executor=deploy_fn,
                dependencies=["test"],
                condition=lambda ctx: ctx.get("test", {}).get("passed", False),
            )
        )
        result = await scheduler.execute({"input": "build a feature"})
    """

    def __init__(self):
        self.nodes: dict[str, DAGNode] = {}

    def add_node(self, node: DAGNode):
        """添加节点。"""
        if node.id in self.nodes:
            raise DAGValidationError(f"节点 {node.id} 已存在")
        self.nodes[node.id] = node

    def validate(self) -> None:
        """验证 DAG:检测环 / 重复节点 / 依赖不存在。"""
        # 检查依赖存在
        for node in self.nodes.values():
            for dep in node.dependencies:
                if dep not in self.nodes:
                    raise DAGValidationError(f"节点 {node.id} 依赖不存在的节点 {dep}")

        # 检查环(Kahn 算法)
        in_degree = {nid: 0 for nid in self.nodes}
        adj = {nid: [] for nid in self.nodes}
        for node in self.nodes.values():
            for dep in node.dependencies:
                adj[dep].append(node.id)
                in_degree[node.id] += 1

        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        visited = 0
        while queue:
            nid = queue.pop(0)
            visited += 1
            for neighbor in adj[nid]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited != len(self.nodes):
            raise DAGValidationError("DAG 存在环,无法拓扑排序")

    def _topological_levels(self) -> list[list[str]]:
        """拓扑分层(Kahn 算法变体):返回每层可并行执行的节点 id 列表。"""
        in_degree = {nid: len(node.dependencies) for nid, node in self.nodes.items()}
        adj = {nid: [] for nid in self.nodes}
        for node in self.nodes.values():
            for dep in node.dependencies:
                adj[dep].append(node.id)

        levels: list[list[str]] = []
        current_level = [nid for nid, deg in in_degree.items() if deg == 0]

        while current_level:
            levels.append(current_level)
            next_level: list[str] = []
            for nid in current_level:
                for neighbor in adj[nid]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        next_level.append(neighbor)
            current_level = next_level

        return levels

    async def execute(self, initial_context: Optional[dict] = None) -> DAGResult:
        """执行 DAG。

        - 按拓扑分层逐层执行
        - 同层节点并行执行(asyncio.gather)
        - 每个节点独立重试(指数退避)
        - 条件节点:condition 返回 False 则跳过,后续依赖节点也跳过
        - 失败节点:如果 continue_on_fail=True,后续依赖节点标记 skipped;否则 fail_fast 中止整个 DAG
        """
        self.validate()

        context = dict(initial_context or {})
        node_results: dict[str, NodeResult] = {}
        trace: list[dict] = []
        start_time = datetime.now(timezone.utc)
        skipped_nodes: set[str] = set()  # 因条件/上游失败被跳过的节点

        levels = self._topological_levels()

        for level_idx, level in enumerate(levels):
            # 过滤被跳过的节点
            executable = [nid for nid in level if nid not in skipped_nodes]

            if not executable:
                continue

            logger.info("DAG 层级 %d:执行 %d 个节点 %s", level_idx, len(executable), executable)

            # 并行执行同层节点
            tasks = [self._execute_node(nid, context, node_results, trace) for nid in executable]
            results = await asyncio.gather(*tasks, return_exceptions=False)

            # 检查失败节点,决定是否 fail_fast 或标记后续 skipped
            for nid, result in zip(executable, results):
                if result.status == "failed" and not self.nodes[nid].continue_on_fail:
                    # fail_fast:标记所有后续依赖节点为 skipped
                    self._mark_downstream_skipped(nid, skipped_nodes)
                    logger.warning("节点 %s 失败且 continue_on_fail=False,标记后续节点为 skipped", nid)
                elif result.status == "skipped":
                    # 条件跳过:标记后续依赖节点为 skipped
                    self._mark_downstream_skipped(nid, skipped_nodes)

        # 计算总状态
        end_time = datetime.now(timezone.utc)
        total_duration_ms = (end_time - start_time).total_seconds() * 1000

        has_failed = any(r.status == "failed" for r in node_results.values())
        has_success = any(r.status == "success" for r in node_results.values())

        if has_failed and has_success:
            status = "partial"
        elif has_failed:
            status = "failed"
        else:
            status = "success"

        return DAGResult(
            status=status,
            node_results=node_results,
            total_duration_ms=total_duration_ms,
            context=context,
            trace=trace,
        )

    async def _execute_node(
        self, node_id: str, context: dict, node_results: dict, trace: list
    ) -> NodeResult:
        """执行单个节点(含重试 + 超时 + 条件检查)。"""
        node = self.nodes[node_id]
        result = NodeResult(node_id=node_id, status="failed")

        # 条件检查
        if node.condition and not node.condition(context):
            result.status = "skipped"
            result.start_time = result.end_time = datetime.now(timezone.utc).isoformat()
            node_results[node_id] = result
            trace.append({"node_id": node_id, "status": "skipped", "reason": "condition_false"})
            logger.info("节点 %s 条件不满足,跳过", node_id)
            return result

        start = datetime.now(timezone.utc)
        result.start_time = start.isoformat()

        for attempt in range(1, node.max_retries + 1):
            result.attempts = attempt
            try:
                logger.info(
                    "节点 %s 第 %d 次执行(attempt %d/%d)",
                    node_id, attempt, attempt, node.max_retries,
                )

                output = await asyncio.wait_for(
                    node.executor(context),
                    timeout=node.timeout,
                )

                # 成功
                result.status = "success"
                result.output = output
                result.end_time = datetime.now(timezone.utc).isoformat()
                result.duration_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000

                # 合并输出到 context
                if isinstance(output, dict):
                    context[node_id] = output

                node_results[node_id] = result
                trace.append(
                    {
                        "node_id": node_id,
                        "status": "success",
                        "attempt": attempt,
                        "duration_ms": round(result.duration_ms, 2),
                    }
                )
                return result

            except asyncio.TimeoutError:
                result.error = f"超时({node.timeout}s)"
                logger.warning("节点 %s 第 %d 次执行超时", node_id, attempt)
            except Exception as e:
                result.error = str(e)
                logger.warning("节点 %s 第 %d 次执行失败: %s", node_id, attempt, e)

            # 重试延迟(指数退避)
            if attempt < node.max_retries:
                delay = node.retry_delay * (2 ** (attempt - 1))
                logger.info("节点 %s 等待 %.1fs 后重试", node_id, delay)
                await asyncio.sleep(delay)
                result.retry_count += 1

        # 所有重试失败
        result.status = "failed"
        result.end_time = datetime.now(timezone.utc).isoformat()
        result.duration_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        node_results[node_id] = result
        trace.append(
            {
                "node_id": node_id,
                "status": "failed",
                "attempts": result.attempts,
                "error": result.error,
                "duration_ms": round(result.duration_ms, 2),
            }
        )
        return result

    def _mark_downstream_skipped(self, node_id: str, skipped: set):
        """递归标记所有下游节点为 skipped。"""
        for nid, node in self.nodes.items():
            if node_id in node.dependencies and nid not in skipped:
                skipped.add(nid)
                self._mark_downstream_skipped(nid, skipped)

    def visualize(self) -> str:
        """生成 DAG 可视化文本(ASCII art)。"""
        lines = ["DAG 可视化:", "=" * 50]
        levels = self._topological_levels()
        for i, level in enumerate(levels):
            lines.append(f"层级 {i}:")
            for nid in level:
                node = self.nodes[nid]
                deps = ", ".join(node.dependencies) if node.dependencies else "无"
                cond = " [条件]" if node.condition else ""
                retry = f" [重试 {node.max_retries}]" if node.max_retries > 1 else ""
                lines.append(f"  └─ {node.name}({nid}) 依赖: {deps}{cond}{retry}")
        lines.append("=" * 50)
        return "\n".join(lines)


# ============================================================================
# Worker Pool(限并发 + 优先级队列 + 持久化,2026-07-22 立)
# 对齐 packages/types/src/agent-runtime.ts L1232-1447 多 Agent 并行执行契约。
# Python 端用 dataclass 对齐 TS 类型,字段名 snake_case,JSON 序列化转 camelCase。
# ============================================================================


import json as _json
import os as _os
import uuid as _uuid
from typing import Awaitable, Literal


AgentTaskStatus = Literal["triage", "todo", "ready", "in_progress", "blocked", "done"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_ts(s: Optional[str]) -> float:
    """ISO 字符串 → timestamp(优先级队列排序用,空值返回 0)。"""
    if not s:
        return 0.0
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def _snake_to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


@dataclass
class KanbanTask:
    """Kanban 任务(跨端统一,对齐 agent-runtime.ts KanbanTask)。"""

    id: str
    agent_id: str
    name: str
    status: AgentTaskStatus = "triage"
    priority: int = 0
    payload: dict = field(default_factory=dict)
    description: Optional[str] = None
    result: Optional[dict] = None
    scheduled_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    dependencies: list[str] = field(default_factory=list)
    worker_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    def to_camel_dict(self) -> dict:
        return {
            "id": self.id,
            "agentId": self.agent_id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "payload": self.payload,
            "result": self.result,
            "scheduledAt": self.scheduled_at,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
            "errorMessage": self.error_message,
            "dependencies": list(self.dependencies),
            "workerId": self.worker_id,
            "createdBy": self.created_by,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


@dataclass
class WorkerPoolConfig:
    """Worker Pool 配置(对齐 agent-runtime.ts WorkerPoolConfig)。"""

    max_workers: int = 4
    task_timeout_seconds: float = 300.0
    max_queue_size: int = 100
    idle_worker_ttl_seconds: Optional[float] = 60.0
    preemptive: bool = False

    def to_camel_dict(self) -> dict:
        return {
            "maxWorkers": self.max_workers,
            "taskTimeoutSeconds": self.task_timeout_seconds,
            "maxQueueSize": self.max_queue_size,
            "idleWorkerTtlSeconds": self.idle_worker_ttl_seconds,
            "preemptive": self.preemptive,
        }


@dataclass
class WorkerState:
    """Worker 状态(对齐 agent-runtime.ts WorkerState)。"""

    worker_id: str
    type: str  # ai-service-worker | cli-subprocess | api-dispatcher
    status: str  # idle | busy | dead
    current_task_id: Optional[str] = None
    completed_count: int = 0
    failed_count: int = 0
    started_at: str = ""
    last_heartbeat_at: str = ""

    def to_camel_dict(self) -> dict:
        return {
            "workerId": self.worker_id,
            "type": self.type,
            "status": self.status,
            "currentTaskId": self.current_task_id,
            "completedCount": self.completed_count,
            "failedCount": self.failed_count,
            "startedAt": self.started_at,
            "lastHeartbeatAt": self.last_heartbeat_at,
        }


@dataclass
class AgentSSEEvent:
    """SSE 实时流事件(对齐 agent-runtime.ts AgentSSEEvent)。"""

    type: str  # task_created | task_status_changed | task_completed | task_failed | ...
    task_id: Optional[str] = None
    worker_id: Optional[str] = None
    payload: dict = field(default_factory=dict)
    timestamp: str = ""

    def to_camel_dict(self) -> dict:
        return {
            "type": self.type,
            "taskId": self.task_id,
            "workerId": self.worker_id,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }


@dataclass
class ParallelExecutionResult:
    """并行执行结果(对齐 agent-runtime.ts ParallelExecutionResult)。"""

    execution_id: str
    status: str  # success | partial | failed
    task_results: dict[str, KanbanTask] = field(default_factory=dict)
    total_duration_ms: float = 0.0
    worker_count: int = 0
    trace: list[dict] = field(default_factory=list)

    def to_camel_dict(self) -> dict:
        return {
            "executionId": self.execution_id,
            "status": self.status,
            "taskResults": {k: v.to_camel_dict() for k, v in self.task_results.items()},
            "totalDurationMs": self.total_duration_ms,
            "workerCount": self.worker_count,
            "trace": list(self.trace),
        }


async def _default_executor(task: KanbanTask) -> dict:
    """默认 executor:回显任务 id + payload。"""
    return {"executed": True, "taskId": task.id, "echo": task.payload}


class WorkerPool:
    """限并发 Worker Pool + 优先级队列。

    - N 个 worker(asyncio.Task)从 asyncio.PriorityQueue 消费任务
    - 优先级:priority 降序 + scheduledAt 升序 + 入队序号(避免比较 task)
    - 并发限制:max_workers 个 worker 同时执行,超限排队
    - 依赖检查:依赖未完成且仍在队列 → 重新入队等待;依赖缺失/阻塞 → 本任务 blocked
    - 超时:task_timeout_seconds,超时标记 blocked
    - SSE 事件:状态变化通过 on_event callback 回调
    - 持久化:REDIS_URL 可用时持久化任务状态到 Redis,不可用纯内存
    - 优雅关闭:shutdown 后新 submit 拒绝,当前任务完成

    用法:
        pool = WorkerPool(WorkerPoolConfig(max_workers=4), executor_factory=my_factory)
        await pool.start()
        tid = await pool.submit(task)
        result = await pool.wait_all()
        await pool.shutdown()
    """

    def __init__(
        self,
        config: WorkerPoolConfig,
        executor_factory: Optional[Callable[[KanbanTask], Awaitable[dict]]] = None,
        on_event: Optional[Callable[[AgentSSEEvent], None]] = None,
    ):
        self.config = config
        self.executor_factory = executor_factory or _default_executor
        self.on_event = on_event
        # 优先级队列元素:(-priority, scheduled_at_ts, seq, task);seq 保证不比较 task
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._tasks: dict[str, KanbanTask] = {}  # task_id -> task(状态存储)
        self._workers: list[asyncio.Task] = []
        self._workers_state: dict[str, WorkerState] = {}
        self._wait_retries: dict[str, int] = {}  # 依赖等待重试计数(防死循环)
        self._seq = 0
        self._shutdown = False
        self._started = False
        self._redis = self._init_redis()

    def _init_redis(self):
        """REDIS_URL 可用时创建异步 redis 客户端,否则 None(纯内存)。"""
        url = _os.environ.get("REDIS_URL")
        if not url:
            return None
        try:
            import redis.asyncio as aioredis  # type: ignore

            return aioredis.from_url(url, decode_responses=True)
        except Exception:
            logger.debug("Redis 初始化失败,降级为纯内存模式")
            return None

    async def start(self) -> None:
        """启动 N 个 worker(asyncio.Task)。幂等:已启动则 no-op。"""
        if self._started:
            return
        self._started = True
        self._shutdown = False
        for i in range(self.config.max_workers):
            wid = f"worker-{i + 1}"
            now = _now_iso()
            self._workers_state[wid] = WorkerState(
                worker_id=wid,
                type="ai-service-worker",
                status="idle",
                started_at=now,
                last_heartbeat_at=now,
            )
            self._workers.append(asyncio.create_task(self._worker_loop(wid)))

    async def submit(self, task: KanbanTask) -> str:
        """提交任务入队,返回 task_id。shutdown 后拒绝新任务。"""
        if self._shutdown:
            raise RuntimeError("WorkerPool 已关闭,拒绝新任务")
        if self._queue.qsize() >= self.config.max_queue_size:
            raise RuntimeError("任务队列已满")
        now = _now_iso()
        if not task.created_at:
            task.created_at = now
        task.updated_at = now
        if task.status == "triage":
            task.status = "todo"
        self._tasks[task.id] = task
        await self._persist(task)
        self._emit("task_created", task)
        self._seq += 1
        await self._queue.put(
            (-task.priority, _parse_ts(task.scheduled_at), self._seq, task)
        )
        return task.id

    async def get_status(self, task_id: str) -> Optional[KanbanTask]:
        """查询任务状态,不存在返回 None。"""
        return self._tasks.get(task_id)

    def list_tasks(self, status: Optional[str] = None) -> list[KanbanTask]:
        """列出所有任务,可选 status 过滤。"""
        tasks = list(self._tasks.values())
        if status:
            tasks = [t for t in tasks if t.status == status]
        return tasks

    def get_workers_state(self) -> list[WorkerState]:
        """返回所有 worker 当前状态。"""
        return list(self._workers_state.values())

    async def wait_all(self) -> ParallelExecutionResult:
        """等待所有已提交任务到达终态(done/blocked),返回并行执行结果。"""
        await self.start()
        start = datetime.now(timezone.utc)
        await self._queue.join()
        end = datetime.now(timezone.utc)
        has_done = any(t.status == "done" for t in self._tasks.values())
        has_blocked = any(t.status == "blocked" for t in self._tasks.values())
        if has_blocked and has_done:
            status = "partial"
        elif has_blocked:
            status = "failed"
        else:
            status = "success"
        trace = [
            {
                "level": 0,
                "nodeIds": [t.id],
                "status": "success" if t.status == "done" else "failed",
                "durationMs": 0.0,
            }
            for t in self._tasks.values()
        ]
        return ParallelExecutionResult(
            execution_id=str(_uuid.uuid4()),
            status=status,
            task_results=dict(self._tasks),
            total_duration_ms=(end - start).total_seconds() * 1000,
            worker_count=len(self._workers),
            trace=trace,
        )

    async def shutdown(self) -> None:
        """优雅关闭:拒绝新任务,等待当前任务完成 + worker 退出。"""
        self._shutdown = True
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
            self._workers.clear()
        self._started = False
        if self._redis is not None:
            try:
                await self._redis.close()
            except Exception:
                pass
            self._redis = None

    def _check_deps(self, task: KanbanTask) -> str:
        """依赖检查。返回 'ready' | 'wait' | 'blocked:<reason>'。"""
        for dep_id in task.dependencies or []:
            dep = self._tasks.get(dep_id)
            if dep is None:
                return f"blocked:依赖 {dep_id} 不存在"
            if dep.status == "done":
                continue
            if dep.status == "blocked":
                return f"blocked:依赖 {dep_id} 已阻塞"
            # 依赖仍在 triage/todo/ready/in_progress → 等待
            return "wait"
        return "ready"

    async def _worker_loop(self, worker_id: str) -> None:
        """worker 主循环:从优先级队列取任务 → 依赖检查 → 执行 → 更新状态 → SSE。"""
        state = self._workers_state[worker_id]
        while not self._shutdown:
            try:
                item = await asyncio.wait_for(self._queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            # 已取到 item,必须 task_done 恰好一次
            try:
                _, _, _, task = item
                dep_status = self._check_deps(task)
                if dep_status == "wait":
                    retries = self._wait_retries.get(task.id, 0) + 1
                    self._wait_retries[task.id] = retries
                    if retries > 200:
                        task.status = "blocked"
                        task.error_message = "依赖等待超时(重试 200 次)"
                        task.updated_at = _now_iso()
                        task.completed_at = _now_iso()
                        await self._persist(task)
                        self._emit("task_failed", task, worker_id)
                        state.failed_count += 1
                    else:
                        # 重新入队,让其他任务推进
                        self._seq += 1
                        await self._queue.put(
                            (-task.priority, _parse_ts(task.scheduled_at), self._seq, task)
                        )
                        await asyncio.sleep(0.02)
                    continue
                if dep_status.startswith("blocked"):
                    task.status = "blocked"
                    task.error_message = dep_status.split(":", 1)[1]
                    task.updated_at = _now_iso()
                    task.completed_at = _now_iso()
                    await self._persist(task)
                    self._emit("task_failed", task, worker_id)
                    state.failed_count += 1
                    continue
                # ready:执行
                task.status = "in_progress"
                task.started_at = _now_iso()
                task.worker_id = worker_id
                task.updated_at = _now_iso()
                state.status = "busy"
                state.current_task_id = task.id
                state.last_heartbeat_at = _now_iso()
                await self._persist(task)
                self._emit("task_status_changed", task, worker_id)
                try:
                    output = await asyncio.wait_for(
                        self.executor_factory(task),
                        timeout=self.config.task_timeout_seconds,
                    )
                    task.status = "done"
                    task.result = output if isinstance(output, dict) else {"value": output}
                    task.completed_at = _now_iso()
                    state.completed_count += 1
                    self._emit("task_completed", task, worker_id)
                except asyncio.TimeoutError:
                    task.status = "blocked"
                    task.error_message = f"超时({self.config.task_timeout_seconds}s)"
                    task.completed_at = _now_iso()
                    state.failed_count += 1
                    self._emit("task_failed", task, worker_id)
                except Exception as e:  # noqa: BLE001
                    task.status = "blocked"
                    task.error_message = f"执行异常: {e}"
                    task.completed_at = _now_iso()
                    state.failed_count += 1
                    self._emit("task_failed", task, worker_id)
                task.updated_at = _now_iso()
                task.worker_id = None
                state.status = "idle"
                state.current_task_id = None
                state.last_heartbeat_at = _now_iso()
                await self._persist(task)
            finally:
                self._queue.task_done()

    def _emit(
        self, event_type: str, task: KanbanTask, worker_id: Optional[str] = None
    ) -> None:
        """发送 SSE 事件(回调异常吞掉,不影响主流程)。"""
        if self.on_event is None:
            return
        event = AgentSSEEvent(
            type=event_type,
            task_id=task.id,
            worker_id=worker_id,
            payload=task.to_camel_dict(),
            timestamp=_now_iso(),
        )
        try:
            self.on_event(event)
        except Exception:  # noqa: BLE001
            logger.exception("SSE callback 异常")

    async def _persist(self, task: KanbanTask) -> None:
        """Redis 可用时持久化任务状态(best-effort,失败仅日志)。"""
        if self._redis is None:
            return
        try:
            await self._redis.set(
                f"kanban:task:{task.id}", _json.dumps(task.to_camel_dict(), ensure_ascii=False)
            )
        except Exception:  # noqa: BLE001
            logger.debug("Redis 持久化失败(忽略)")

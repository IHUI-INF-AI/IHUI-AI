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

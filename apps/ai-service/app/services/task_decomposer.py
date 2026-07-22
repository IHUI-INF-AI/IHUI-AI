"""任务自动分解服务(P3-3)。

对标 Hermes Agent 的任务自动分解能力:
1. LLM 驱动:基于任务描述 + 可用 agent 能力,分解为子任务
2. 4 种策略:sequential(顺序)/ parallel(并行)/ dag(依赖图)/ recursive(递归)
3. DAG 拓扑排序(Kahn 算法)+ 环检测
4. 并行批次计算(同批无依赖可并行,批内 priority 降序)

设计原则:
- llm_gateway 调用失败时降级为简单分解(不抛错)
- 拓扑排序检测到环时报错(避免死锁)
- recursive 最大深度 3(防止无限递归)
"""

from __future__ import annotations

import json
import logging
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Literal

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# 类型别名(对齐 packages/types/src/agent-runtime.ts P3-3 契约)
TaskDecompositionStrategy = Literal["sequential", "parallel", "dag", "recursive"]
SubTaskDependencyType = Literal["output", "completion", "resource"]


@dataclass
class SubTaskDependency:
    """子任务依赖关系。"""

    dependsOn: str
    type: SubTaskDependencyType = "completion"


@dataclass
class SubTask:
    """分解出的子任务。"""

    id: str
    description: str
    recommendedAgentType: str
    requiredCapabilities: list[str] = field(default_factory=list)
    dependencies: list[SubTaskDependency] = field(default_factory=list)
    priority: int = 5
    estimatedDurationSeconds: int | None = None
    retryable: bool = True
    maxRetries: int = 3


@dataclass
class TaskDecompositionRequest:
    """任务分解请求。"""

    task: str
    availableAgents: list[dict[str, Any]]  # [{name, capabilities: []}]
    strategy: TaskDecompositionStrategy = "dag"
    maxSubTasks: int = 10


@dataclass
class TaskDecompositionResult:
    """任务分解结果。"""

    subTasks: list[SubTask]
    executionOrder: list[str]
    parallelBatches: list[list[str]]
    strategy: TaskDecompositionStrategy
    totalEstimatedDurationSeconds: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """转换为字典(API 序列化 / 测试断言用)。"""
        return {
            "subTasks": [
                {
                    "id": st.id,
                    "description": st.description,
                    "recommendedAgentType": st.recommendedAgentType,
                    "requiredCapabilities": st.requiredCapabilities,
                    "dependencies": [
                        {"dependsOn": d.dependsOn, "type": d.type}
                        for d in st.dependencies
                    ],
                    "priority": st.priority,
                    "estimatedDurationSeconds": st.estimatedDurationSeconds,
                    "retryable": st.retryable,
                    "maxRetries": st.maxRetries,
                }
                for st in self.subTasks
            ],
            "executionOrder": self.executionOrder,
            "parallelBatches": self.parallelBatches,
            "strategy": self.strategy,
            "totalEstimatedDurationSeconds": self.totalEstimatedDurationSeconds,
        }


class TaskDecomposer:
    """LLM 驱动的任务分解器。"""

    MAX_RECURSIVE_DEPTH = 3

    @staticmethod
    def _coerce_request(
        request: TaskDecompositionRequest | dict[str, Any],
    ) -> TaskDecompositionRequest:
        """兼容 dict 输入(API 路由层直接传 dict,无需构造对象)。"""
        if isinstance(request, TaskDecompositionRequest):
            return request
        if isinstance(request, dict):
            agents = request.get("availableAgents") or request.get("available_agents") or []
            return TaskDecompositionRequest(
                task=str(request.get("task", "")),
                availableAgents=list(agents) if isinstance(agents, list) else [],
                strategy=str(request.get("strategy", "dag")),  # type: ignore[arg-type]
                maxSubTasks=int(request.get("maxSubTasks", 10) or request.get("max_sub_tasks", 10) or 10),
            )
        raise TypeError(f"request 必须是 TaskDecompositionRequest 或 dict,收到 {type(request)}")

    async def decompose(
        self, request: TaskDecompositionRequest | dict[str, Any]
    ) -> TaskDecompositionResult:
        """分解任务为子任务列表。

        兼容 dict 输入(API 路由层友好)和 TaskDecompositionRequest 对象。

        流程:
        1. 构建 prompt 喂给 LLM(含任务描述 + 可用 agent 能力)
        2. LLM 输出 JSON 子任务列表
        3. 按策略处理:sequential/parallel 直接用,dag 做拓扑排序,recursive 递归分解
        4. 计算执行顺序 + 并行批次
        """
        request = self._coerce_request(request)
        strategy = request.strategy
        try:
            sub_tasks = await self._llm_decompose(request, depth=0)
        except Exception as e:
            logger.warning("LLM 分解失败,降级为简单分解: %s", e)
            sub_tasks = self._fallback_decompose(request)

        # recursive 策略:对复杂子任务递归分解
        if strategy == "recursive":
            sub_tasks = await self._recursive_expand(sub_tasks, request, depth=1)

        # 截断到 maxSubTasks
        if len(sub_tasks) > request.maxSubTasks:
            sub_tasks = sub_tasks[: request.maxSubTasks]

        # 计算执行顺序 + 并行批次
        execution_order = self.topological_sort(sub_tasks)
        parallel_batches = self.compute_parallel_batches(sub_tasks)
        total_dur = self._estimate_total_duration(sub_tasks, parallel_batches)

        return TaskDecompositionResult(
            subTasks=sub_tasks,
            executionOrder=execution_order,
            parallelBatches=parallel_batches,
            strategy=strategy,
            totalEstimatedDurationSeconds=total_dur,
        )

    # =========================================================================
    # LLM 分解
    # =========================================================================

    async def _llm_decompose(
        self, request: TaskDecompositionRequest, depth: int
    ) -> list[SubTask]:
        """调用 LLM 分解任务,返回子任务列表。"""
        agents_desc = "\n".join(
            f"- {a.get('name', 'unknown')}: 能力 {a.get('capabilities', [])}"
            for a in request.availableAgents
        )
        strategy_hint = {
            "sequential": "子任务有严格顺序依赖,前一个的输出是后一个的输入",
            "parallel": "子任务相互独立,可全部并行",
            "dag": "子任务有部分依赖关系,形成 DAG(允许并行 + 串行混合)",
            "recursive": "复杂任务需层层拆解,子任务仍可继续分解",
        }.get(request.strategy, "DAG 形式")

        prompt = (
            f"你是任务分解专家。请把以下任务分解为 {request.maxSubTasks} 个以内的子任务。\n\n"
            f"任务:{request.task}\n\n"
            f"可用 agent:\n{agents_desc}\n\n"
            f"分解要求:{strategy_hint}\n\n"
            "输出严格 JSON(不要 markdown 代码块,不要额外说明):\n"
            '{"subTasks": [\n'
            "  {\n"
            '    "id": "st-1",\n'
            '    "description": "子任务描述",\n'
            '    "recommendedAgentType": "agent名",\n'
            '    "requiredCapabilities": ["能力1"],\n'
            '    "dependencies": [{"dependsOn": "st-0", "type": "output"}],\n'
            '    "priority": 8,\n'
            '    "estimatedDurationSeconds": 30\n'
            "  }\n"
            "]}\n\n"
            "约束:id 唯一;dependencies.dependsOn 必须引用已定义的 id;priority 1-10。"
        )

        result = await llm_gateway.complete(
            [{"role": "user", "content": prompt}],
        )
        content = str(result.get("content", "") or "")
        if not content:
            raise ValueError("LLM 返回空内容")

        data = self._extract_json(content)
        if not data or "subTasks" not in data:
            raise ValueError("LLM 返回非预期 JSON")

        return self._parse_sub_tasks(data["subTasks"], request)

    def _extract_json(self, text: str) -> dict[str, Any] | None:
        """从 LLM 输出中提取 JSON(兼容 markdown 代码块包裹)。"""
        # 去除可能的 markdown 代码块
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # 去首尾 ``` 行
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines)
        # 尝试定位 JSON 对象边界
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return json.loads(cleaned[start : end + 1])
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("JSON 解析失败: %s", e)
            return None

    def _parse_sub_tasks(
        self, raw: list[Any], request: TaskDecompositionRequest
    ) -> list[SubTask]:
        """解析 LLM 输出的子任务列表为 SubTask 对象。"""
        # 构建 agent 名集合(用于校验 recommendedAgentType)
        valid_agents = {str(a.get("name", "")) for a in request.availableAgents}
        sub_tasks: list[SubTask] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            sid = str(item.get("id", "") or f"st-{uuid.uuid4().hex[:6]}")
            deps_raw = item.get("dependencies", []) or []
            deps: list[SubTaskDependency] = []
            for d in deps_raw:
                if not isinstance(d, dict):
                    continue
                deps.append(SubTaskDependency(
                    dependsOn=str(d.get("dependsOn", "")),
                    type=str(d.get("type", "completion")),  # type: ignore[arg-type]
                ))
            agent_type = str(item.get("recommendedAgentType", ""))
            # 推荐的 agent 不在可用列表中时,降级取第一个可用 agent
            if agent_type not in valid_agents and valid_agents:
                agent_type = next(iter(valid_agents))
            sub_tasks.append(SubTask(
                id=sid,
                description=str(item.get("description", "")),
                recommendedAgentType=agent_type,
                requiredCapabilities=[
                    str(c) for c in (item.get("requiredCapabilities") or [])
                ],
                dependencies=deps,
                priority=int(item.get("priority", 5) or 5),
                estimatedDurationSeconds=(
                    int(item["estimatedDurationSeconds"])
                    if item.get("estimatedDurationSeconds") is not None
                    else None
                ),
                retryable=bool(item.get("retryable", True)),
                maxRetries=int(item.get("maxRetries", 3) or 3),
            ))
        return sub_tasks

    # =========================================================================
    # 降级分解(LLM 不可用时)
    # =========================================================================

    def _fallback_decompose(self, request: TaskDecompositionRequest) -> list[SubTask]:
        """LLM 不可用时的简单分解:按 agent 数量均分任务。"""
        agents = request.availableAgents or [{"name": "general", "capabilities": []}]
        n = min(len(agents), request.maxSubTasks, 3)  # 最多 3 个子任务
        sub_tasks: list[SubTask] = []
        for i in range(n):
            agent = agents[i % len(agents)]
            prev_id = sub_tasks[-1].id if sub_tasks else None
            deps = [SubTaskDependency(dependsOn=prev_id, type="output")] if prev_id else []
            sub_tasks.append(SubTask(
                id=f"st-{i + 1}",
                description=f"子任务 {i + 1}:处理「{request.task[:80]}」的第 {i + 1}/{n} 部分",
                recommendedAgentType=str(agent.get("name", "general")),
                requiredCapabilities=[
                    str(c) for c in (agent.get("capabilities") or [])
                ],
                dependencies=deps,
                priority=max(1, 10 - i * 2),
                estimatedDurationSeconds=30,
            ))
        return sub_tasks

    # =========================================================================
    # recursive 递归分解
    # =========================================================================

    async def _recursive_expand(
        self,
        sub_tasks: list[SubTask],
        request: TaskDecompositionRequest,
        depth: int,
    ) -> list[SubTask]:
        """递归分解复杂子任务(最大深度 3)。"""
        if depth > self.MAX_RECURSIVE_DEPTH:
            return sub_tasks
        expanded: list[SubTask] = []
        for st in sub_tasks:
            # 启发式:描述超过 100 字 或 priority >= 8 视为复杂,需进一步分解
            is_complex = len(st.description) > 100 or st.priority >= 8
            if is_complex and depth < self.MAX_RECURSIVE_DEPTH:
                sub_request = TaskDecompositionRequest(
                    task=st.description,
                    availableAgents=request.availableAgents,
                    strategy="recursive",
                    maxSubTasks=max(2, request.maxSubTasks // 2),
                )
                try:
                    sub_result = await self._llm_decompose(sub_request, depth)
                    # 修正子任务的 id 避免冲突,并建立依赖关系
                    for sub_st in sub_result:
                        sub_st.id = f"{st.id}-{sub_st.id}"
                        sub_st.dependencies = [
                            SubTaskDependency(dependsOn=st.id, type="output")
                        ] + sub_st.dependencies
                        expanded.append(sub_st)
                    expanded.append(st)  # 保留父任务(作为聚合点)
                except Exception as e:
                    logger.warning("递归分解失败(depth=%d): %s", depth, e)
                    expanded.append(st)
            else:
                expanded.append(st)
        return expanded

    # =========================================================================
    # 拓扑排序(Kahn 算法)
    # =========================================================================

    def topological_sort(self, sub_tasks: list[SubTask]) -> list[str]:
        """DAG 拓扑排序(Kahn 算法)。

        检测到环时报错(避免死锁)。
        同层节点按 priority 降序排列(高优先级先执行)。
        """
        # 构建邻接表 + 入度表
        ids = {st.id for st in sub_tasks}
        in_degree: dict[str, int] = {st.id: 0 for st in sub_tasks}
        adj: dict[str, list[str]] = {st.id: [] for st in sub_tasks}

        for st in sub_tasks:
            for dep in st.dependencies:
                if dep.dependsOn not in ids:
                    # 依赖不存在的任务,忽略(降级容错)
                    continue
                adj[dep.dependsOn].append(st.id)
                in_degree[st.id] += 1

        # Kahn 算法:入度为 0 的节点入队(按 priority 降序)
        result: list[str] = []
        id_to_priority = {st.id: st.priority for st in sub_tasks}
        queue = deque(
            sorted(
                [sid for sid, d in in_degree.items() if d == 0],
                key=lambda x: -id_to_priority.get(x, 0),
            )
        )

        while queue:
            node = queue.popleft()
            result.append(node)
            # 收集下游节点,排序后入队
            next_zero: list[str] = []
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    next_zero.append(neighbor)
            # 同层按 priority 降序
            for n in sorted(next_zero, key=lambda x: -id_to_priority.get(x, 0)):
                queue.append(n)

        if len(result) != len(sub_tasks):
            # 存在环(result 少于节点数)
            remaining = [sid for sid in ids if sid not in set(result)]
            raise ValueError(
                f"检测到依赖环,无法拓扑排序。涉及子任务: {remaining}"
            )
        return result

    # =========================================================================
    # 并行批次计算
    # =========================================================================

    def compute_parallel_batches(self, sub_tasks: list[SubTask]) -> list[list[str]]:
        """按依赖关系分组,同一批无依赖可并行,批次内 priority 降序。"""
        ids = {st.id for st in sub_tasks}
        in_degree: dict[str, int] = {st.id: 0 for st in sub_tasks}
        adj: dict[str, list[str]] = {st.id: [] for st in sub_tasks}
        id_to_priority = {st.id: st.priority for st in sub_tasks}

        for st in sub_tasks:
            for dep in st.dependencies:
                if dep.dependsOn not in ids:
                    continue
                adj[dep.dependsOn].append(st.id)
                in_degree[st.id] += 1

        batches: list[list[str]] = []
        processed: set[str] = set()

        while len(processed) < len(sub_tasks):
            # 当前批次:所有入度为 0 且未处理的节点
            batch = [
                sid for sid, d in in_degree.items()
                if d == 0 and sid not in processed
            ]
            if not batch:
                # 剩余节点存在环,直接加入最后一批(避免死循环)
                remaining = [sid for sid in ids if sid not in processed]
                batches.append(remaining)
                break
            # 批次内 priority 降序
            batch.sort(key=lambda x: -id_to_priority.get(x, 0))
            batches.append(batch)
            for sid in batch:
                processed.add(sid)
                for neighbor in adj[sid]:
                    in_degree[neighbor] -= 1

        return batches

    # =========================================================================
    # 工具方法
    # =========================================================================

    @staticmethod
    def _estimate_total_duration(
        sub_tasks: list[SubTask], batches: list[list[str]]
    ) -> int | None:
        """估算总耗时:取各批次最大耗时之和(并行批次取最大值)。"""
        id_to_dur = {st.id: st.estimatedDurationSeconds for st in sub_tasks}
        total = 0
        has_any = False
        for batch in batches:
            batch_max = 0
            for sid in batch:
                dur = id_to_dur.get(sid)
                if dur is not None:
                    has_any = True
                    batch_max = max(batch_max, dur)
            total += batch_max
        return total if has_any else None


task_decomposer = TaskDecomposer()

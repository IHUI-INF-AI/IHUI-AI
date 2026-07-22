"""services 模块: 业务服务层。"""

# DAG 调度引擎 + Worker Pool(限并发 + 优先级队列,2026-07-22 立)
# 对齐 packages/types/src/agent-runtime.ts 多 Agent 并行执行契约
from .dag_scheduler import (  # noqa: F401
    AgentSSEEvent,
    AgentTaskStatus,
    DAGNode,
    DAGResult,
    DAGScheduler,
    DAGValidationError,
    KanbanTask,
    NodeResult,
    ParallelExecutionResult,
    WorkerPool,
    WorkerPoolConfig,
    WorkerState,
)

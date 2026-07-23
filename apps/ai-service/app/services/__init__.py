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

# P3 深度层 LangGraph 升级(2026-07-23 立)
# - langgraph_checkpoint: 节点级 checkpoint 管理(双层存储 + interrupt + resume + Time Travel)
# - langgraph_stream: 5 模式 streaming + 12 类 SSE 事件
# 软依赖:psycopg/langgraph 缺失时仍可 import,运行时调用才抛 RuntimeError
try:
    from .langgraph_checkpoint import (  # noqa: F401
        LangGraphCheckpointManager,
        trigger_interrupt,
        resume_from_interrupt,
    )
    from .langgraph_stream import (  # noqa: F401
        SSEEvent,
        stream_agent_execution,
    )
except ImportError:  # psycopg/langgraph 未安装时降级,模块仍可 import
    pass

"""A2A(Agent-to-Agent)任务队列服务。

⚠️ 架构诚实声明(2026-07-09 Phase 4 审计):
当前实现是"带 Redis 持久化的本地异步任务队列",不是完整的 A2A 协议。
- ✅ 已实现:Redis 持久化(agents + tasks)、内存热缓存、重启恢复、异步执行(LangGraph / agent_executor)
- ✅ 已实现:agent 注册接口(endpoint 字段持久化)
- ❌ 未实现:跨服务 HTTP 派发(_execute_task 无视 endpoint,所有任务本地执行)
- ❌ 未实现:真正的 Agent-to-Agent 通信协议

未来要落地完整 A2A:在 _execute_task 中按 agent.endpoint 发 HTTP 请求到远端 agent,
而非无条件调用本地 langgraph_service / agent_executor。

Redis 降级策略:Redis 不可用时静默退化为纯内存模式(重启即丢),
2026-07-09 Phase 4 改进:降级时打 warning 日志(不再完全静默),便于运维感知。
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from ..core.config import settings
from .agent_loop import agent_executor
from .langgraph_service import langgraph_service

logger = logging.getLogger(__name__)


class A2ATask:
    """A2A 任务模型。"""

    def __init__(
        self,
        task_id: str,
        name: str,
        agent_id: str,
        input_data: dict[str, Any] | None = None,
    ) -> None:
        self.id = task_id
        self.name = name
        self.agent_id = agent_id
        self.input = input_data or {}
        self.status = "pending"  # pending / running / completed / failed / canceled
        self.result: dict[str, Any] | None = None
        self.error: str | None = None
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        """序列化为字典(用于 API 响应和 Redis 持久化)。"""
        return {
            "id": self.id,
            "name": self.name,
            "agent_id": self.agent_id,
            "input": self.input,
            "status": self.status,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "A2ATask":
        """从字典反序列化(从 Redis 恢复)。"""
        task = cls(
            task_id=data["id"],
            name=data["name"],
            agent_id=data["agent_id"],
            input_data=data.get("input"),
        )
        task.status = data.get("status", "pending")
        task.result = data.get("result")
        task.error = data.get("error")
        task.created_at = datetime.fromisoformat(data["created_at"])
        task.updated_at = datetime.fromisoformat(data["updated_at"])
        return task


class A2AAgent:
    """A2A Agent 注册信息。"""

    def __init__(
        self,
        agent_id: str,
        name: str,
        capabilities: list[str] | None = None,
        endpoint: str = "",
        description: str = "",
    ) -> None:
        self.id = agent_id
        self.name = name
        self.capabilities = capabilities or []
        self.endpoint = endpoint
        self.description = description

    def to_dict(self) -> dict[str, Any]:
        """序列化为字典(用于 API 响应和 Redis 持久化)。"""
        return {
            "id": self.id,
            "name": self.name,
            "capabilities": self.capabilities,
            "endpoint": self.endpoint,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "A2AAgent":
        """从字典反序列化(从 Redis 恢复)。"""
        return cls(
            agent_id=data["id"],
            name=data["name"],
            capabilities=data.get("capabilities"),
            endpoint=data.get("endpoint", ""),
            description=data.get("description", ""),
        )


class A2AServer:
    """A2A 服务端(Redis 持久化 + 内存热缓存)。

    - agents: 内存注册 + Redis 持久化(重启可恢复)
    - tasks: Redis 持久化 + 内存热缓存(运行中的任务在内存)
    - send_task 创建 pending 任务后异步执行,客户端轮询 get_task_status
    """

    REDIS_AGENT_KEY = "a2a:agents"
    REDIS_TASK_KEY_PREFIX = "a2a:task:"
    REDIS_TASK_INDEX_KEY = "a2a:tasks:index"

    def __init__(self) -> None:
        self._agents: dict[str, A2AAgent] = {}
        self._tasks: dict[str, A2ATask] = {}  # 内存热缓存
        self._redis = None
        self._redis_available = False

    async def _get_redis(self):
        """获取 Redis 连接(懒初始化)。

        Redis 不可用时降级为纯内存模式,并打 warning 日志(2026-07-09 Phase 4 改进)。
        """
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis

            redis_url = getattr(settings, "redis_url", None) or "redis://localhost:6379/0"
            self._redis = aioredis.from_url(redis_url, decode_responses=True)
            await self._redis.ping()
            self._redis_available = True
            logger.info("A2A Redis connected (persistence enabled)")
        except Exception as e:
            self._redis = None
            self._redis_available = False
            # 不再静默,打 warning 让运维感知降级(重启即丢任务)
            logger.warning(
                "A2A Redis unavailable, degrading to in-memory mode (tasks lost on restart): %s", e
            )
        return self._redis

    async def _persist_agent(self, agent: A2AAgent) -> None:
        """持久化 agent 到 Redis。"""
        redis = await self._get_redis()
        if not redis:
            return
        try:
            await redis.hset(self.REDIS_AGENT_KEY, agent.id, json.dumps(agent.to_dict()))
        except Exception:
            pass

    async def _persist_task(self, task: A2ATask) -> None:
        """持久化 task 到 Redis。"""
        redis = await self._get_redis()
        if not redis:
            return
        try:
            await redis.set(
                self.REDIS_TASK_KEY_PREFIX + task.id,
                json.dumps(task.to_dict()),
                ex=86400 * 7,  # 7 天过期
            )
            await redis.zadd(self.REDIS_TASK_INDEX_KEY, {task.id: task.created_at.timestamp()})
        except Exception:
            pass

    async def _load_task_from_redis(self, task_id: str) -> A2ATask | None:
        """从 Redis 加载 task。"""
        redis = await self._get_redis()
        if not redis:
            return None
        try:
            data = await redis.get(self.REDIS_TASK_KEY_PREFIX + task_id)
            if data:
                return A2ATask.from_dict(json.loads(data))
        except Exception:
            pass
        return None

    async def _load_agents_from_redis(self) -> None:
        """启动时从 Redis 恢复 agents。"""
        redis = await self._get_redis()
        if not redis:
            return
        try:
            agents_map = await redis.hgetall(self.REDIS_AGENT_KEY)
            for agent_id, data in agents_map.items():
                agent = A2AAgent.from_dict(json.loads(data))
                self._agents[agent.id] = agent
        except Exception:
            pass

    async def _recover_tasks(self) -> None:
        """启动时恢复未完成的任务(标记 running 为 failed)。"""
        redis = await self._get_redis()
        if not redis:
            return
        try:
            task_ids = await redis.zrange(self.REDIS_TASK_INDEX_KEY, 0, -1)
            for task_id in task_ids:
                task = await self._load_task_from_redis(task_id)
                if task and task.status == "running":
                    task.status = "failed"
                    task.error = "服务重启,任务中断"
                    task.updated_at = datetime.now(timezone.utc)
                    await self._persist_task(task)
                    self._tasks[task.id] = task
        except Exception:
            pass

    async def init(self) -> None:
        """初始化:从 Redis 恢复数据。"""
        await self._get_redis()
        if self._redis_available:
            await self._load_agents_from_redis()
            await self._recover_tasks()

    def register_agent(self, agent: A2AAgent) -> A2AAgent:
        """注册一个 agent,若 id 已存在则覆盖。"""
        self._agents[agent.id] = agent
        asyncio.create_task(self._persist_agent(agent))
        return agent

    def list_agents(self) -> list[A2AAgent]:
        """列出所有已注册 agent。"""
        return list(self._agents.values())

    def get_agent(self, agent_id: str) -> A2AAgent | None:
        """按 id 获取 agent。"""
        return self._agents.get(agent_id)

    def send_task(
        self,
        name: str,
        agent_id: str,
        input_data: dict[str, Any] | None = None,
    ) -> A2ATask:
        """发送任务,创建 pending 任务并异步执行。

        使用 uuid4 生成 task_id 避免高并发冲突。
        异步执行不阻塞返回,客户端轮询 get_task_status 直到 completed。
        """
        task_id = f"task-{uuid.uuid4().hex}"
        task = A2ATask(task_id, name, agent_id, input_data)
        self._tasks[task_id] = task
        asyncio.create_task(self._persist_task(task))
        # 异步执行(不阻塞 send_task 返回)
        asyncio.create_task(self._execute_task(task_id))
        return task

    async def _execute_task(self, task_id: str) -> None:
        """执行任务:调用 langgraph_service 或 agent_executor。

        优先用 LangGraph(现在使用真正的 StateGraph),降级为 agent_executor。
        """
        task = self._tasks.get(task_id)
        if not task:
            return
        task.status = "running"
        task.updated_at = datetime.now(timezone.utc)
        await self._persist_task(task)
        try:
            goal = task.input.get("goal") or task.input.get("message") or task.name
            session_id = f"a2a-{task.id}"

            if langgraph_service.available:
                try:
                    result = await langgraph_service.run_graph(goal=goal, session_id=session_id)
                except Exception:
                    result = await agent_executor.run(goal=goal, session_id=session_id)
            else:
                result = await agent_executor.run(goal=goal, session_id=session_id)

            task.result = result if isinstance(result, dict) else {"output": str(result)}
            task.status = "completed"
        except Exception as e:
            task.error = str(e)
            task.status = "failed"
        task.updated_at = datetime.now(timezone.utc)
        await self._persist_task(task)

    async def get_task(self, task_id: str) -> A2ATask | None:
        """获取任务完整信息(优先内存,回退 Redis)。"""
        task = self._tasks.get(task_id)
        if task:
            return task
        return await self._load_task_from_redis(task_id)

    async def get_task_status(self, task_id: str) -> dict[str, Any] | None:
        """获取任务状态(返回字典,不存在返回 None)。"""
        task = await self.get_task(task_id)
        if not task:
            return None
        return {
            "id": task.id,
            "status": task.status,
            "agent_id": task.agent_id,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat(),
        }

    async def get_task_result(self, task_id: str) -> dict[str, Any] | None:
        """获取任务结果(返回字典,不存在返回 None)。"""
        task = await self.get_task(task_id)
        if not task:
            return None
        return {
            "id": task.id,
            "status": task.status,
            "result": task.result,
            "error": task.error,
        }

    def list_tasks(self) -> list[A2ATask]:
        """列出所有任务(内存缓存中的)。"""
        return list(self._tasks.values())


a2a_server = A2AServer()

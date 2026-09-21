# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A(Agent-to-Agent)任务队列服务。

⚠️ 架构诚实声明(2026-07-09 Phase 4 审计,O11 2026-09-20 更新):
当前实现是"带 Redis 持久化 + A2A 发现文档的本地异步任务队列",不是完整的 A2A 协议。
- ✅ 已实现:Redis 持久化(agents + tasks)、内存热缓存、重启恢复、异步执行(agent_executor)
- ✅ 已实现:agent 注册接口(endpoint 字段持久化)
- ✅ 已实现:跨服务 HTTP 派发(_execute_task 按 agent.endpoint 发 HTTP 请求,失败 fallback 到本地执行)
- ✅ 已实现(O11):**能力发现** —— agent-card 由 app/services/agent_card.py 构建,
  GET /.well-known/agent.json 匿名可抓;skills 逐项对应真实注册的工具
- ✅ 已实现(O11):**任务归属收权** —— owner = principal.sub,跨归属读取 403
  (裁决函数 `can_access_task`)
- ❌ 未实现:A2A 标准报文(JSON-RPC / HTTP+JSON transcodding)—— 现有任务是自研
  REST 形状,该偏差已在 agent-card 的 capabilities.extensions[] 中如实声明
- ❌ 未实现:流式(SSE)与 push 回调(notification)、任务状态历史数组

Redis 降级策略:Redis 不可用时静默退化为纯内存模式(重启即丢),
2026-07-09 Phase 4 改进:降级时打 warning 日志(不再完全静默),便于运维感知。
"""

import asyncio
import json
import logging
import uuid
from collections.abc import Coroutine
from datetime import UTC, datetime
from typing import Any

from ..core.config import settings
from .agent_loop import agent_executor
from .capability_gate import Principal

logger = logging.getLogger(__name__)

# 管理员角色门槛(与 apps/api preHandler 的 roleId >= 1 口径一致):管理员可跨归属查任务
ADMIN_ROLE = 1


class A2ATask:
    """A2A 任务模型。"""

    def __init__(
        self,
        task_id: str,
        name: str,
        agent_id: str,
        input_data: dict[str, Any] | None = None,
        owner_id: str | None = None,
    ) -> None:
        self.id = task_id
        self.name = name
        self.agent_id = agent_id
        self.input = input_data or {}
        self.status = "pending"  # pending / running / completed / failed / canceled
        self.result: dict[str, Any] | None = None
        self.error: str | None = None
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)
        # 调用者归属(O11 收权:principal.sub,无身份的本机开发回退主体为 None)。
        # **不进 to_dict()** —— 既有 API 响应形状逐字段冻结,归属只走持久化通道。
        self.owner_id = owner_id

    def to_dict(self) -> dict[str, Any]:
        """序列化为字典(用于 API 响应)。

        ⚠️ 键集合是对外契约(POST /a2a/tasks 与历史客户端都在消费),
        新增字段一律不得进这里,持久化用的扩展字段见 `to_storage_dict()`。
        """
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

    def to_storage_dict(self) -> dict[str, Any]:
        """Redis 持久化用:响应形状 + 归属字段(owner_id)。"""
        return {**self.to_dict(), "owner_id": self.owner_id}

    def status_dict(self) -> dict[str, Any]:
        """状态视图(GET /a2a/tasks/{id}/status 的响应体,键集合冻结)。"""
        return {
            "id": self.id,
            "status": self.status,
            "agent_id": self.agent_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def result_dict(self) -> dict[str, Any]:
        """结果视图(GET /a2a/tasks/{id}/result 的响应体,键集合冻结)。"""
        return {
            "id": self.id,
            "status": self.status,
            "result": self.result,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "A2ATask":
        """从字典反序列化(从 Redis 恢复)。

        兼容迁移前的历史行:无 `owner_id` 键 → 归属为空(按无主任务裁决)。
        """
        task = cls(
            task_id=data["id"],
            name=data["name"],
            agent_id=data["agent_id"],
            input_data=data.get("input"),
            owner_id=cls._read_owner_id(data),
        )
        task.status = data.get("status", "pending")
        task.result = data.get("result")
        task.error = data.get("error")
        task.created_at = datetime.fromisoformat(data["created_at"])
        task.updated_at = datetime.fromisoformat(data["updated_at"])
        return task

    @staticmethod
    def _read_owner_id(data: dict[str, Any]) -> str | None:
        """容错读取归属:非字符串(脏数据)一律按无主处理。"""
        raw = data.get("owner_id")
        return raw if isinstance(raw, str) and raw else None


def can_access_task(task: A2ATask, principal: Principal | None) -> bool:
    """任务归属裁决(纯函数,无 I/O)。

    - 管理员(role >= ADMIN_ROLE):全量可读(运维排障口径,与 apps/api 一致);
    - 有主任务:`principal.sub` 必须与 `task.owner_id` **严格相等**;
    - 无主任务(本机开发回退主体 / 收权前写入的 Redis 历史行):只有同样无身份的
      开发态主体可读 —— 任何带身份的调用方一律拒绝(fail-closed,不做"无主即可读")。
    """
    if principal is None:
        return False
    if principal.role >= ADMIN_ROLE:
        return True
    if task.owner_id is None:
        return principal.sub is None and principal.kind == "dev-anonymous"
    return principal.sub == task.owner_id


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
        self._redis: Any = None
        self._redis_available = False
        # 持有 create_task 引用,防止 CPython GC 回收未完成的 task
        self._pending_tasks: set[asyncio.Task[None]] = set()

    def _spawn_task(self, coro: Coroutine[Any, Any, Any]) -> asyncio.Task[None]:
        """创建 task 并持有引用,完成后自动从集合移除。"""
        task = asyncio.create_task(coro)
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)
        return task

    async def _get_redis(self) -> Any:
        """获取 Redis 连接(懒初始化)。

        Redis 不可用时降级为纯内存模式,并打 warning 日志(2026-07-09 Phase 4 改进)。
        """
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis

            redis_url = getattr(settings, "redis_url", None) or "redis://localhost:8811/0"
            # protocol=2 强制 RESP2:redis-py 8.x 默认 RESP3(HELLO 3 协商),
            # 老 Redis/Memurai 4.x 不支持会 unknown command HELLO(同 im_bridge)
            self._redis = aioredis.from_url(redis_url, decode_responses=True, protocol=2, socket_connect_timeout=2)
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
        except Exception as e:
            logger.warning(f"persist agent failed: {e}", exc_info=True)

    async def _persist_task(self, task: A2ATask) -> None:
        """持久化 task 到 Redis(用 to_storage_dict:含归属字段,响应形状不变)。"""
        redis = await self._get_redis()
        if not redis:
            return
        try:
            await redis.set(
                self.REDIS_TASK_KEY_PREFIX + task.id,
                json.dumps(task.to_storage_dict()),
                ex=86400 * 7,  # 7 天过期
            )
            await redis.zadd(self.REDIS_TASK_INDEX_KEY, {task.id: task.created_at.timestamp()})
        except Exception as e:
            logger.warning(f"persist task failed: {e}", exc_info=True)

    async def _load_task_from_redis(self, task_id: str) -> A2ATask | None:
        """从 Redis 加载 task。"""
        redis = await self._get_redis()
        if not redis:
            return None
        try:
            data = await redis.get(self.REDIS_TASK_KEY_PREFIX + task_id)
            if data:
                return A2ATask.from_dict(json.loads(data))
        except Exception as e:
            logger.warning(f"load task from redis failed: {e}", exc_info=True)
        return None

    async def _load_agents_from_redis(self) -> None:
        """启动时从 Redis 恢复 agents。"""
        redis = await self._get_redis()
        if not redis:
            return
        try:
            agents_map = await redis.hgetall(self.REDIS_AGENT_KEY)
            for _agent_id, data in agents_map.items():
                agent = A2AAgent.from_dict(json.loads(data))
                self._agents[agent.id] = agent
        except Exception as e:
            logger.warning(f"load agents from redis failed: {e}", exc_info=True)

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
                    task.updated_at = datetime.now(UTC)
                    await self._persist_task(task)
                    self._tasks[task.id] = task
        except Exception as e:
            logger.warning(f"recover tasks failed: {e}", exc_info=True)

    async def init(self) -> None:
        """初始化:从 Redis 恢复数据。"""
        await self._get_redis()
        if self._redis_available:
            await self._load_agents_from_redis()
            await self._recover_tasks()

    def register_agent(self, agent: A2AAgent) -> A2AAgent:
        """注册一个 agent,若 id 已存在则覆盖。"""
        self._agents[agent.id] = agent
        self._spawn_task(self._persist_agent(agent))
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
        owner_id: str | None = None,
    ) -> A2ATask:
        """发送任务,创建 pending 任务并异步执行。

        使用 uuid4 生成 task_id 避免高并发冲突。
        异步执行不阻塞返回,客户端轮询 get_task_status 直到 completed。
        `owner_id` 为调用者归属(principal.sub),仅入持久化、不进响应体。
        """
        task_id = f"task-{uuid.uuid4().hex}"
        task = A2ATask(task_id, name, agent_id, input_data, owner_id=owner_id)
        self._tasks[task_id] = task
        self._spawn_task(self._persist_task(task))
        # 异步执行(不阻塞 send_task 返回)
        self._spawn_task(self._execute_task(task_id))
        return task

    async def _execute_task(self, task_id: str) -> None:
        """执行任务:优先按 agent.endpoint 跨服务 HTTP 派发,fallback 到本地执行。

        - agent.endpoint 非空时:POST `${endpoint}/tasks/{task_id}/execute` 跨服务派发
        - endpoint 为空或请求失败时:fallback 到本地 agent_executor(langgraph 已退役,D6 第 1 步)
        """
        task = self._tasks.get(task_id)
        if not task:
            return
        task.status = "running"
        task.updated_at = datetime.now(UTC)
        await self._persist_task(task)
        try:
            agent = self.get_agent(task.agent_id)
            endpoint = agent.endpoint if agent else ""

            if endpoint:
                try:
                    result = await self._dispatch_remote(endpoint, task)
                    task.result = result
                    task.status = "completed"
                    task.updated_at = datetime.now(UTC)
                    await self._persist_task(task)
                    return
                except Exception as e:
                    logger.warning(
                        "a2a remote dispatch failed (task=%s, endpoint=%s): %s — fallback to local",
                        task_id,
                        endpoint,
                        e,
                        exc_info=True,
                    )

            goal = task.input.get("goal") or task.input.get("message") or task.name
            session_id = f"a2a-{task.id}"

            # D6 第 1 步(2026-09-19 立):后端栈归一——langgraph fallback 已删除。
            # langgraph_service 退役(最后运行时消费点即此处);a2a 回退统一走
            # agent_executor;agent_loop_v2 全面接管(含本 fallback)为第 1.5 步
            # (需先下沉 _make_loop_v2_llm 到 services 层避免 routers 循环导入)。
            result = await agent_executor.run(goal=goal, session_id=session_id)

            task.result = result if isinstance(result, dict) else {"output": str(result)}
            task.status = "completed"
        except Exception as e:
            task.error = str(e)
            task.status = "failed"
        task.updated_at = datetime.now(UTC)
        await self._persist_task(task)

    async def _dispatch_remote(self, endpoint: str, task: A2ATask) -> dict[str, Any]:
        """跨服务 HTTP 派发:POST `${endpoint}/tasks/{task_id}/execute`。

        30 秒超时,成功时返回响应 JSON。
        """
        import httpx

        url = f"{endpoint.rstrip('/')}/tasks/{task.id}/execute"
        payload = {
            "task_id": task.id,
            "input": task.input,
            "metadata": {
                "agent_id": task.agent_id,
                "name": task.name,
            },
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return data if isinstance(data, dict) else {"output": str(data)}

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
        return task.status_dict()

    async def get_task_result(self, task_id: str) -> dict[str, Any] | None:
        """获取任务结果(返回字典,不存在返回 None)。"""
        task = await self.get_task(task_id)
        if not task:
            return None
        return task.result_dict()

    def list_tasks(self) -> list[A2ATask]:
        """列出所有任务(内存缓存中的)。"""
        return list(self._tasks.values())


a2a_server = A2AServer()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

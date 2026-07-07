"""
Swarm 多智能体编排系统 — IHUI-AI 独特优势功能.

将复杂任务分解为多个子任务, 由多个 AI Agent 协同完成:
- 协调者 (coordinator): 分析任务 + 分解子任务 + 建立依赖关系
- 工作者 (worker): 执行具体子任务 (复用现有 SubagentConfig + run_subagent)
- 审查者 (reviewer): 审查工作者的产出, 给出反馈

执行模型:
- 无依赖的 agent 并行启动 (asyncio.gather)
- 有依赖的 agent 等待依赖完成后启动 (asyncio.Event 协调)
- 实时更新 agent 状态 + 持久化到磁盘

持久化: ~/.ihui/swarms/{swarm_id}.json (与 session_store 风格一致)

对标:
- OpenAI Swarm (多 agent 协作)
- Claude Code Subagents (子代理隔离上下文)
- Codex max_threads (并发池)
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from loguru import logger


# ---------------------------------------------------------------------------
# 存储目录 (与 session_store / background_agents 风格一致)
# ---------------------------------------------------------------------------

_STORE_ROOT = Path.home() / ".ihui"
_SWARMS_DIR = _STORE_ROOT / "swarms"


def _ensure_dirs() -> None:
    """确保存储目录存在。"""
    _SWARMS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

class SwarmAgentRole(str, Enum):
    """Swarm 中 Agent 的角色。"""
    COORDINATOR = "coordinator"  # 协调者: 分析任务 + 分解子任务
    WORKER = "worker"            # 工作者: 执行具体工作
    REVIEWER = "reviewer"        # 审查者: 审查工作结果


@dataclass
class SwarmAgent:
    """Swarm 中的单个 Agent。

    每个 agent 复用现有 SubagentConfig 执行独立子任务 (隔离上下文)。
    """
    agent_id: str
    role: SwarmAgentRole
    subagent_config: Any  # SubagentConfig (复用现有子代理配置, 避免循环导入用 Any)
    status: str = "idle"  # idle/running/completed/failed
    result: str | None = None
    dependencies: list[str] = field(default_factory=list)  # 依赖的其他 agent_id


@dataclass
class SwarmPlan:
    """Swarm 执行计划 — 一个完整的多 agent 协作方案。"""
    swarm_id: str
    task: str                       # 总体任务描述
    agents: list[SwarmAgent]        # 所有参与 agent
    workspace_path: str
    model_id: str
    created_at: float
    status: str = "planning"        # planning/executing/completed/failed
    results: dict[str, str] = field(default_factory=dict)  # agent_id → result

    def to_dict(self) -> dict[str, Any]:
        """序列化为可持久化/传输的 dict。"""
        return {
            "swarm_id": self.swarm_id,
            "task": self.task,
            "agents": [_agent_to_dict(a) for a in self.agents],
            "workspace_path": self.workspace_path,
            "model_id": self.model_id,
            "created_at": self.created_at,
            "status": self.status,
            "results": self.results,
        }


def _agent_to_dict(agent: SwarmAgent) -> dict[str, Any]:
    """将 SwarmAgent 序列化为 dict (subagent_config 仅保留元数据)。"""
    sa = agent.subagent_config
    return {
        "agent_id": agent.agent_id,
        "role": agent.role.value,
        "name": getattr(sa, "name", ""),
        "description": getattr(sa, "description", ""),
        "system_prompt": getattr(sa, "system_prompt", ""),
        "tools": getattr(sa, "tools", []),
        "model": getattr(sa, "model", "inherit"),
        "status": agent.status,
        "result": agent.result,
        "dependencies": agent.dependencies,
    }


def _agent_from_dict(data: dict[str, Any]) -> SwarmAgent:
    """从 dict 重建 SwarmAgent (含 SubagentConfig)。"""
    from app.api.v1.workspace.subagents import SubagentConfig

    sa = SubagentConfig(
        name=data.get("name", ""),
        description=data.get("description", ""),
        system_prompt=data.get("system_prompt", ""),
        tools=data.get("tools", []),
        model=data.get("model", "inherit"),
    )
    return SwarmAgent(
        agent_id=data["agent_id"],
        role=SwarmAgentRole(data.get("role", "worker")),
        subagent_config=sa,
        status=data.get("status", "idle"),
        result=data.get("result"),
        dependencies=data.get("dependencies", []),
    )


def _plan_from_dict(data: dict[str, Any]) -> SwarmPlan:
    """从 dict 重建 SwarmPlan。"""
    return SwarmPlan(
        swarm_id=data["swarm_id"],
        task=data.get("task", ""),
        agents=[_agent_from_dict(a) for a in data.get("agents", [])],
        workspace_path=data.get("workspace_path", ""),
        model_id=data.get("model_id", "default"),
        created_at=data.get("created_at", time.time()),
        status=data.get("status", "planning"),
        results=data.get("results", {}),
    )


# ---------------------------------------------------------------------------
# 任务分解 prompt (用于 LLM 分析)
# ---------------------------------------------------------------------------

_TASK_DECOMPOSITION_PROMPT = """你是一个任务分解专家。请分析以下任务, 将其分解为可并行执行的子任务。

要求:
1. 每个子任务应该可以独立完成
2. 标明子任务之间的依赖关系
3. 为每个子任务分配角色: worker（执行具体工作）或 reviewer（审查工作结果）
4. 子任务数量 2-6 个

输出 JSON 格式:
{
  "subtasks": [
    {
      "name": "子任务名称",
      "description": "子任务描述",
      "role": "worker|reviewer",
      "depends_on": ["依赖的子任务名称（空数组表示无依赖）"]
    }
  ]
}

只输出 JSON, 不要输出其他内容。"""


# ---------------------------------------------------------------------------
# SwarmOrchestrator — Swarm 编排器 (单例)
# ---------------------------------------------------------------------------

class SwarmOrchestrator:
    """Swarm 多智能体编排器。

    职责:
    - create_swarm: 调用 LLM 分析任务, 自动分解为子任务, 创建 SwarmPlan
    - execute_swarm: 按依赖关系并行执行所有 agent
    - get_swarm_status: 查询 swarm 和所有 agent 的当前状态
    - cancel_swarm: 取消整个 swarm
    - list_swarms: 列出工作区的所有 swarm

    生命周期:
        planning → executing → completed / failed / cancelled

    线程安全: 仅在 asyncio 事件循环中使用 (FastAPI 单线程异步模型)。
    """

    def __init__(self) -> None:
        # swarm_id -> SwarmPlan (内存态, 含运行时信息)
        self._swarms: dict[str, SwarmPlan] = {}
        # swarm_id -> asyncio.Task (运行中的执行任务)
        self._tasks: dict[str, asyncio.Task[Any]] = {}
        # swarm_id -> set[asyncio.Event] (取消信号)
        self._cancel_flags: dict[str, asyncio.Event] = {}
        _ensure_dirs()

    # ------------------------------------------------------------------
    # 创建 swarm (自动分解任务)
    # ------------------------------------------------------------------

    async def create_swarm(
        self,
        task: str,
        workspace_path: str,
        model_id: str,
        user_uuid: str = "anonymous",
    ) -> SwarmPlan:
        """分析任务, 自动分解为子任务, 为每个子任务创建一个 SwarmAgent。

        流程:
        1. 调用 LLM 分析任务, 生成子任务分解方案 (JSON)
        2. 为每个子任务创建 SubagentConfig + SwarmAgent
        3. 建立依赖关系 (depends_on 名称 → agent_id 映射)
        4. 持久化 SwarmPlan 到磁盘

        Args:
            task: 总体任务描述
            workspace_path: 工作区绝对路径
            model_id: 模型 code
            user_uuid: 用户 UUID

        Returns:
            SwarmPlan (含所有 agent 和依赖关系)
        """
        swarm_id = uuid.uuid4().hex[:12]
        logger.info(f"创建 Swarm: id={swarm_id}, task={task[:80]}...")

        # 1. 调用 LLM 分解任务
        subtasks = await self._decompose_task(task, model_id)
        if not subtasks:
            # LLM 分解失败 → 创建单 agent 兜底
            logger.warning(f"Swarm {swarm_id} 任务分解失败, 使用单 agent 兜底")
            subtasks = [{
                "name": "执行任务",
                "description": task,
                "role": "worker",
                "depends_on": [],
            }]

        # 2. 第一遍: 为每个子任务创建 agent_id (用于依赖映射)
        name_to_id: dict[str, str] = {}
        agents: list[SwarmAgent] = []

        from app.api.v1.workspace.subagents import SubagentConfig

        for st in subtasks:
            agent_id = uuid.uuid4().hex[:8]
            name = st.get("name", f"agent-{agent_id}")
            name_to_id[name] = agent_id

        # 3. 第二遍: 创建 SwarmAgent (依赖名称 → agent_id)
        for st in subtasks:
            agent_id = name_to_id[st.get("name", "")]
            role_str = st.get("role", "worker").lower()
            try:
                role = SwarmAgentRole(role_str)
            except ValueError:
                role = SwarmAgentRole.WORKER

            desc = st.get("description", "")
            name = st.get("name", f"agent-{agent_id}")

            # 根据角色定制系统 prompt
            if role == SwarmAgentRole.REVIEWER:
                sys_prompt = (
                    f"你是 Swarm 中的审查者 (reviewer)。\n"
                    f"子任务: {name}\n"
                    f"描述: {desc}\n\n"
                    f"你的职责是审查其他 agent 的工作成果, 给出:\n"
                    f"1. 质量评估 (是否满足要求)\n"
                    f"2. 发现的问题和建议改进\n"
                    f"3. 总体结论 (通过/需修改)\n"
                )
                # 审查者只用只读工具
                tools = ["read_file", "list_dir", "glob", "grep", "git_status", "git_diff"]
            else:
                sys_prompt = (
                    f"你是 Swarm 中的工作者 (worker)。\n"
                    f"子任务: {name}\n"
                    f"描述: {desc}\n\n"
                    f"你是多 agent 协作团队的一员, 负责完成上述子任务。\n"
                    f"请专注完成你的任务, 并给出清晰的完成总结。\n"
                )
                tools = []  # 空=继承全部工具

            sa = SubagentConfig(
                name=name,
                description=desc,
                system_prompt=sys_prompt,
                tools=tools,
                model="inherit",
            )

            # 依赖名称 → agent_id
            deps_names = st.get("depends_on", []) or []
            dependencies = [name_to_id[n] for n in deps_names if n in name_to_id]

            agents.append(SwarmAgent(
                agent_id=agent_id,
                role=role,
                subagent_config=sa,
                status="idle",
                dependencies=dependencies,
            ))

        # 4. 构建 SwarmPlan
        plan = SwarmPlan(
            swarm_id=swarm_id,
            task=task,
            agents=agents,
            workspace_path=workspace_path,
            model_id=model_id,
            created_at=time.time(),
            status="planning",
        )

        # 5. 持久化 + 缓存
        self._swarms[swarm_id] = plan
        self._persist_swarm(plan)

        logger.info(
            f"Swarm {swarm_id} 创建完成: {len(agents)} 个 agent "
            f"(worker={sum(1 for a in agents if a.role == SwarmAgentRole.WORKER)}, "
            f"reviewer={sum(1 for a in agents if a.role == SwarmAgentRole.REVIEWER)})"
        )
        return plan

    async def _decompose_task(
        self,
        task: str,
        model_id: str,
    ) -> list[dict[str, Any]]:
        """调用 LLM 分解任务, 返回子任务列表。

        Returns:
            [{"name", "description", "role", "depends_on"}, ...]
            失败时返回空列表。
        """
        from app.api.v1.workspace.llm_gateway import (
            ChatMessage,
            _get_model_config,
            _detect_protocol,
            chat_openai,
            chat_anthropic,
        )

        cfg = _get_model_config(model_id)
        if not cfg:
            logger.warning(f"任务分解: 模型配置未找到 {model_id}")
            return []

        messages = [
            ChatMessage(role="system", content=_TASK_DECOMPOSITION_PROMPT),
            ChatMessage(role="user", content=f"任务: {task}"),
        ]

        try:
            result_text = ""
            protocol = _detect_protocol(cfg)

            if protocol == "anthropic":
                async for event in chat_anthropic(messages, cfg, stream=False):
                    if event.get("type") == "text_delta":
                        result_text += event.get("content", "")
                    elif event.get("type") == "done":
                        break
                    elif event.get("type") == "error":
                        logger.warning(f"任务分解 LLM 调用失败: {event.get('message')}")
                        return []
            else:
                async for event in chat_openai(messages, cfg, stream=False):
                    if event.get("type") == "text_delta":
                        result_text += event.get("content", "")
                    elif event.get("type") == "done":
                        break
                    elif event.get("type") == "error":
                        logger.warning(f"任务分解 LLM 调用失败: {event.get('message')}")
                        return []

            # 解析 JSON (容错: 提取第一个 { ... } 块)
            result_text = result_text.strip()
            # 移除可能的 markdown 代码块标记
            if result_text.startswith("```"):
                lines = result_text.split("\n")
                # 去掉首尾 ``` 行
                lines = [l for l in lines if not l.strip().startswith("```")]
                result_text = "\n".join(lines)

            # 尝试找到 JSON 块
            json_str = result_text
            if "{" in result_text:
                start = result_text.index("{")
                end = result_text.rindex("}") + 1
                json_str = result_text[start:end]

            data = json.loads(json_str)
            subtasks = data.get("subtasks", [])
            if not isinstance(subtasks, list) or not subtasks:
                return []

            # 限制 2-6 个子任务
            if len(subtasks) > 6:
                subtasks = subtasks[:6]
            if len(subtasks) < 2:
                # 至少保证 2 个 (如果 LLM 只返回 1 个, 复制一个审查者)
                if len(subtasks) == 1:
                    review = dict(subtasks[0])
                    review["name"] = review.get("name", "task") + "-review"
                    review["role"] = "reviewer"
                    review["depends_on"] = [subtasks[0].get("name", "")]
                    subtasks.append(review)

            return subtasks

        except json.JSONDecodeError as e:
            logger.warning(f"任务分解 JSON 解析失败: {e}, 原文: {result_text[:200]}")
            return []
        except Exception as e:
            logger.warning(f"任务分解异常: {e}")
            return []

    # ------------------------------------------------------------------
    # 执行 swarm (按依赖关系并行)
    # ------------------------------------------------------------------

    async def execute_swarm(self, swarm_id: str) -> dict[str, Any]:
        """按依赖关系并行执行 swarm 中的所有 agent。

        执行策略:
        - 无依赖的 agent 立即并行启动
        - 有依赖的 agent 等待所有依赖完成后再启动
        - 使用 asyncio.Event 协调依赖关系
        - 实时更新 agent 状态 + 持久化

        Returns:
            {"swarm_id", "status", "results", "agent_count", "completed", "failed"}
        """
        plan = self._swarms.get(swarm_id)
        if not plan:
            plan = self._load_swarm(swarm_id)
            if not plan:
                return {"swarm_id": swarm_id, "status": "not_found", "results": {}}
            self._swarms[swarm_id] = plan

        if plan.status == "executing":
            return {
                "swarm_id": swarm_id,
                "status": "already_executing",
                "message": "Swarm 正在执行中",
            }
        if plan.status in ("completed", "failed"):
            return {
                "swarm_id": swarm_id,
                "status": plan.status,
                "message": f"Swarm 已 {plan.status}, 无法重复执行",
                "results": plan.results,
            }

        # 设置取消信号
        cancel_event = asyncio.Event()
        self._cancel_flags[swarm_id] = cancel_event

        plan.status = "executing"
        self._persist_swarm(plan)

        logger.info(f"开始执行 Swarm {swarm_id} ({len(plan.agents)} agents)")

        # 为每个 agent 创建完成事件 (用于依赖协调)
        done_events: dict[str, asyncio.Event] = {
            a.agent_id: asyncio.Event() for a in plan.agents
        }

        async def _run_agent(agent: SwarmAgent) -> None:
            """执行单个 agent, 等待依赖完成后启动。"""
            # 1. 等待依赖完成
            for dep_id in agent.dependencies:
                if dep_id in done_events:
                    await done_events[dep_id].wait()

            # 2. 检查取消信号
            if cancel_event.is_set():
                agent.status = "failed"
                agent.result = "Swarm 已取消"
                self._persist_swarm(plan)
                done_events[agent.agent_id].set()
                return

            # 3. 检查依赖是否成功 (失败的依赖仍然放行, 但在 prompt 中告知)
            dep_results = {}
            for dep_id in agent.dependencies:
                dep_agent = next((a for a in plan.agents if a.agent_id == dep_id), None)
                if dep_agent:
                    dep_results[dep_id] = {
                        "name": getattr(dep_agent.subagent_config, "name", dep_id),
                        "status": dep_agent.status,
                        "result": dep_agent.result or "",
                    }

            # 4. 构建任务 prompt (含依赖结果上下文)
            task_prompt = self._build_agent_prompt(agent, plan, dep_results)

            # 5. 更新状态为 running
            agent.status = "running"
            self._persist_swarm(plan)

            # 6. 执行子代理 (复用现有 run_subagent)
            try:
                from app.api.v1.workspace.subagents import run_subagent

                result = await run_subagent(
                    subagent=agent.subagent_config,
                    task_prompt=task_prompt,
                    workspace_path=plan.workspace_path,
                    main_model_id=plan.model_id,
                    user_uuid="swarm-" + swarm_id,
                    max_iterations=15,
                )

                if result.get("success"):
                    agent.status = "completed"
                    agent.result = result.get("output", "")
                else:
                    agent.status = "failed"
                    agent.result = result.get("output", "子代理执行失败")

            except Exception as e:
                logger.error(f"Swarm agent {agent.agent_id} 执行异常: {e}")
                agent.status = "failed"
                agent.result = f"执行异常: {e}"

            # 7. 记录结果 + 通知依赖方
            plan.results[agent.agent_id] = agent.result or ""
            self._persist_swarm(plan)
            done_events[agent.agent_id].set()

            logger.info(
                f"Swarm {swarm_id} agent {agent.agent_id} "
                f"({getattr(agent.subagent_config, 'name', '?')}) → {agent.status}"
            )

        # 并行启动所有 agent (依赖在各自内部等待)
        tasks = [asyncio.create_task(_run_agent(a)) for a in plan.agents]
        self._tasks[swarm_id] = asyncio.current_task()

        await asyncio.gather(*tasks, return_exceptions=True)

        # 清理取消标志
        self._cancel_flags.pop(swarm_id, None)

        # 统计结果
        completed = sum(1 for a in plan.agents if a.status == "completed")
        failed = sum(1 for a in plan.agents if a.status == "failed")

        if cancel_event.is_set():
            plan.status = "failed"
        elif failed > 0 and completed == 0:
            plan.status = "failed"
        else:
            plan.status = "completed"

        self._persist_swarm(plan)

        logger.info(
            f"Swarm {swarm_id} 执行完成: status={plan.status}, "
            f"completed={completed}, failed={failed}"
        )

        return {
            "swarm_id": swarm_id,
            "status": plan.status,
            "results": plan.results,
            "agent_count": len(plan.agents),
            "completed": completed,
            "failed": failed,
        }

    def _build_agent_prompt(
        self,
        agent: SwarmAgent,
        plan: SwarmPlan,
        dep_results: dict[str, Any],
    ) -> str:
        """为单个 agent 构建任务 prompt (含总体任务 + 依赖结果上下文)。"""
        parts: list[str] = []

        # 总体任务上下文
        parts.append(f"## 总体任务\n{plan.task}\n")

        # 当前子任务
        sa = agent.subagent_config
        parts.append(f"## 你的子任务: {getattr(sa, 'name', agent.agent_id)}")
        parts.append(f"描述: {getattr(sa, 'description', '')}\n")

        # 依赖结果上下文 (让 agent 知道前置工作的产出)
        if dep_results:
            parts.append("## 前置依赖任务的结果\n")
            for dep_id, dep_info in dep_results.items():
                dep_name = dep_info.get("name", dep_id)
                dep_status = dep_info.get("status", "?")
                dep_result = dep_info.get("result", "")
                # 截断过长的依赖结果
                if len(dep_result) > 2000:
                    dep_result = dep_result[:2000] + "\n...(结果已截断)"
                parts.append(f"### [{dep_name}] (状态: {dep_status})")
                parts.append(dep_result)
                parts.append("")

            if agent.role == SwarmAgentRole.REVIEWER:
                parts.append(
                    "请基于以上前置任务的结果进行审查, "
                    "评估质量并给出改进建议。\n"
                )
            else:
                parts.append(
                    "请基于以上前置任务的成果继续完成你的子任务。\n"
                )

        parts.append("完成后请给出清晰的总结。")
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # 查询 / 取消 / 列表
    # ------------------------------------------------------------------

    def get_swarm_status(self, swarm_id: str) -> dict[str, Any] | None:
        """返回 swarm 和所有 agent 的当前状态。

        优先从内存读取 (运行中实时状态), 回退到磁盘。
        """
        plan = self._swarms.get(swarm_id)
        if not plan:
            plan = self._load_swarm(swarm_id)
            if not plan:
                return None

        return {
            "swarm_id": plan.swarm_id,
            "task": plan.task,
            "status": plan.status,
            "model_id": plan.model_id,
            "workspace_path": plan.workspace_path,
            "created_at": plan.created_at,
            "agents": [_agent_to_dict(a) for a in plan.agents],
            "results": plan.results,
            "stats": {
                "total": len(plan.agents),
                "idle": sum(1 for a in plan.agents if a.status == "idle"),
                "running": sum(1 for a in plan.agents if a.status == "running"),
                "completed": sum(1 for a in plan.agents if a.status == "completed"),
                "failed": sum(1 for a in plan.agents if a.status == "failed"),
            },
        }

    def cancel_swarm(self, swarm_id: str) -> bool:
        """取消整个 swarm (设置取消信号, 运行中的 agent 完成当前步骤后终止)。

        Returns:
            True 如果成功取消 (swarm 存在且在执行中), False 如果不存在或已完成
        """
        plan = self._swarms.get(swarm_id)
        if not plan:
            plan = self._load_swarm(swarm_id)
            if not plan:
                return False
            self._swarms[swarm_id] = plan

        if plan.status not in ("executing", "planning"):
            return False

        # 设置取消信号
        cancel_event = self._cancel_flags.get(swarm_id)
        if cancel_event:
            cancel_event.set()

        # 更新状态
        plan.status = "failed"
        for a in plan.agents:
            if a.status in ("idle", "running"):
                a.status = "failed"
                if not a.result:
                    a.result = "Swarm 已取消"
        self._persist_swarm(plan)

        logger.info(f"Swarm {swarm_id} 已取消")
        return True

    def list_swarms(self, workspace_path: str | None = None) -> list[dict[str, Any]]:
        """列出所有 swarm (可按工作区过滤)。

        优先合并内存态 (实时) + 磁盘态 (历史)。
        """
        _ensure_dirs()
        results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        # 1. 内存态 (运行中, 实时状态)
        for swarm_id, plan in self._swarms.items():
            seen_ids.add(swarm_id)
            if workspace_path and plan.workspace_path != workspace_path:
                continue
            results.append({
                "swarm_id": plan.swarm_id,
                "task": plan.task[:100] + ("..." if len(plan.task) > 100 else ""),
                "status": plan.status,
                "agent_count": len(plan.agents),
                "workspace_path": plan.workspace_path,
                "created_at": plan.created_at,
            })

        # 2. 磁盘态 (历史, 补充内存中没有的)
        for json_file in sorted(_SWARMS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True):
            swarm_id = json_file.stem
            if swarm_id in seen_ids:
                continue
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                if workspace_path and data.get("workspace_path") != workspace_path:
                    continue
                results.append({
                    "swarm_id": data.get("swarm_id", swarm_id),
                    "task": (data.get("task", "") or "")[:100],
                    "status": data.get("status", "unknown"),
                    "agent_count": len(data.get("agents", [])),
                    "workspace_path": data.get("workspace_path", ""),
                    "created_at": data.get("created_at", 0),
                })
            except Exception as e:
                logger.warning(f"读取 swarm 文件 {json_file} 失败: {e}")

        return results

    # ------------------------------------------------------------------
    # 持久化 (与 session_store 风格一致)
    # ------------------------------------------------------------------

    def _swarm_file(self, swarm_id: str) -> Path:
        """swarm 持久化文件路径。"""
        return _SWARMS_DIR / f"{swarm_id}.json"

    def _persist_swarm(self, plan: SwarmPlan) -> None:
        """持久化 SwarmPlan 到磁盘。"""
        _ensure_dirs()
        try:
            path = self._swarm_file(plan.swarm_id)
            path.write_text(
                json.dumps(plan.to_dict(), ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning(f"持久化 swarm {plan.swarm_id} 失败: {e}")

    def _load_swarm(self, swarm_id: str) -> SwarmPlan | None:
        """从磁盘加载 SwarmPlan。"""
        try:
            path = self._swarm_file(swarm_id)
            if not path.exists():
                return None
            data = json.loads(path.read_text(encoding="utf-8"))
            return _plan_from_dict(data)
        except Exception as e:
            logger.warning(f"加载 swarm {swarm_id} 失败: {e}")
            return None


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_orchestrator: SwarmOrchestrator | None = None


def get_swarm_orchestrator() -> SwarmOrchestrator:
    """获取全局 SwarmOrchestrator 单例。"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = SwarmOrchestrator()
    return _orchestrator

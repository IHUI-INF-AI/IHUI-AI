"""工作流引擎(2026-08-09 新增,Phase 2:可视化工作流编辑器)。

对标 ihui 工作流编排 + n8n 风格节点画布能力。

核心能力:
1. 工作流 CRUD — 创建/列表/详情/更新/删除
2. 工作流执行 — 触发执行,串行/并行 step 调度
3. 实例管理 — 状态追踪、取消、重试
4. 任务日志 — 每步执行 trace + 日志记录

存储:进程内内存 dict(Redis 降级模式,与 skill_feedback 同源)。
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from ..core.llm_gateway import llm_gateway
from .skill_feedback import skill_feedback_tracker
from .skills import skill_registry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


@dataclass
class Workflow:
    """工作流定义。"""

    id: str
    name: str
    description: str
    triggerType: str  # manual / schedule / event / webhook
    steps: list[dict[str, Any]]
    isActive: bool = True
    createdAt: str = ""
    updatedAt: str = ""


@dataclass
class WorkflowInstance:
    """工作流实例(单次执行)。"""

    id: str
    workflowId: str
    workflowName: str
    status: str  # pending / running / completed / failed / cancelled
    startedAt: str = ""
    completedAt: str = ""
    input: dict[str, Any] = field(default_factory=dict)
    output: str = ""


@dataclass
class WorkflowTask:
    """工作流实例中的单步任务。"""

    id: str
    instanceId: str
    step: int
    name: str
    type: str  # skill / llm / tool / echo
    status: str  # pending / running / completed / failed / cancelled
    input: str = ""
    output: str = ""
    error: str = ""


@dataclass
class WorkflowLog:
    """工作流执行日志。"""

    id: str
    instanceId: str
    timestamp: str
    level: str  # debug / info / warn / error
    message: str


# ---------------------------------------------------------------------------
# 工作流引擎
# ---------------------------------------------------------------------------


class WorkflowEngine:
    """工作流引擎(进程内单例)。"""

    def __init__(self) -> None:
        self._workflows: dict[str, Workflow] = {}
        self._instances: dict[str, WorkflowInstance] = {}
        self._tasks: dict[str, list[WorkflowTask]] = {}
        self._logs: dict[str, list[WorkflowLog]] = {}
        # 运行中的取消信号:{instance_id: event}
        self._cancel_events: dict[str, asyncio.Event] = {}
        # 运行中的 task 锁(防并发触发)
        self._running_instances: set[str] = set()

    # =========================================================================
    # Workflow CRUD
    # =========================================================================

    def create_workflow(
        self,
        name: str,
        description: str,
        triggerType: str,
        steps: list[dict[str, Any]],
    ) -> Workflow:
        """创建新工作流。"""
        now = datetime.now(timezone.utc).isoformat()
        wf = Workflow(
            id=f"wf-{uuid.uuid4().hex[:12]}",
            name=name,
            description=description,
            triggerType=triggerType,
            steps=steps,
            isActive=True,
            createdAt=now,
            updatedAt=now,
        )
        self._workflows[wf.id] = wf
        logger.info("workflow_engine 创建工作流: id=%s name=%s", wf.id, wf.name)
        return wf

    def list_workflows(self) -> list[Workflow]:
        """列出所有工作流(按创建时间降序)。"""
        return sorted(
            self._workflows.values(),
            key=lambda w: w.createdAt,
            reverse=True,
        )

    def get_workflow(self, workflow_id: str) -> Workflow | None:
        """获取单个工作流。"""
        return self._workflows.get(workflow_id)

    def update_workflow(
        self,
        workflow_id: str,
        name: str | None = None,
        description: str | None = None,
        triggerType: str | None = None,
        steps: list[dict[str, Any]] | None = None,
        isActive: bool | None = None,
    ) -> Workflow | None:
        """更新工作流。返回 None 表示不存在。"""
        wf = self._workflows.get(workflow_id)
        if not wf:
            return None
        if name is not None:
            wf.name = name
        if description is not None:
            wf.description = description
        if triggerType is not None:
            wf.triggerType = triggerType
        if steps is not None:
            wf.steps = steps
        if isActive is not None:
            wf.isActive = isActive
        wf.updatedAt = datetime.now(timezone.utc).isoformat()
        return wf

    def delete_workflow(self, workflow_id: str) -> bool:
        """删除工作流。"""
        if workflow_id not in self._workflows:
            return False
        del self._workflows[workflow_id]
        return True

    # =========================================================================
    # 工作流执行
    # =========================================================================

    async def trigger_workflow(
        self,
        workflow_id: str,
        input_data: dict[str, Any] | None = None,
    ) -> WorkflowInstance | None:
        """触发工作流执行。

        返回 WorkflowInstance(异步执行,状态 pending)。
        实际执行在后台 task 中异步推进。
        """
        wf = self._workflows.get(workflow_id)
        if not wf:
            return None
        if not wf.isActive:
            logger.warning("workflow_engine 工作流已禁用: id=%s", workflow_id)
            return None

        # 防止并发触发
        if workflow_id in self._running_instances:
            logger.warning("workflow_engine 工作流正在运行: id=%s", workflow_id)
            return None

        now = datetime.now(timezone.utc).isoformat()
        inst = WorkflowInstance(
            id=f"wi-{uuid.uuid4().hex[:12]}",
            workflowId=workflow_id,
            workflowName=wf.name,
            status="pending",
            startedAt=now,
            input=input_data or {},
        )
        self._instances[inst.id] = inst
        self._tasks[inst.id] = []
        self._logs[inst.id] = []
        self._cancel_events[inst.id] = asyncio.Event()
        self._running_instances.add(workflow_id)

        # 后台异步执行
        asyncio.create_task(self._execute_instance(inst, wf))
        return inst

    def _log(self, instance_id: str, level: str, message: str) -> None:
        """记录执行日志。"""
        log = WorkflowLog(
            id=f"log-{uuid.uuid4().hex[:8]}",
            instanceId=instance_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            level=level,
            message=message,
        )
        logs = self._logs.setdefault(instance_id, [])
        logs.append(log)

    async def _execute_instance(self, inst: WorkflowInstance, wf: Workflow) -> None:
        """后台执行工作流实例。"""
        inst.status = "running"
        self._log(inst.id, "info", f"工作流 '{wf.name}' 开始执行,共 {len(wf.steps)} 步")

        cancel_event = self._cancel_events.get(inst.id)
        all_succeeded = True

        for idx, step in enumerate(wf.steps):
            # 检查取消
            if cancel_event and cancel_event.is_set():
                inst.status = "cancelled"
                inst.completedAt = datetime.now(timezone.utc).isoformat()
                self._log(inst.id, "warn", f"工作流在第 {idx + 1} 步被取消")
                self._running_instances.discard(wf.id)
                return

            step_name = str(step.get("name", f"step_{idx + 1}"))
            step_type = str(step.get("type", "llm"))
            step_input = str(step.get("input", ""))
            step_skill = str(step.get("skill", ""))

            task = WorkflowTask(
                id=f"task-{uuid.uuid4().hex[:8]}",
                instanceId=inst.id,
                step=idx + 1,
                name=step_name,
                type=step_type,
                status="running",
                input=step_input,
            )
            self._tasks.setdefault(inst.id, []).append(task)
            self._log(inst.id, "info", f"执行第 {idx + 1} 步: {step_name}({step_type})")

            try:
                result = await self._execute_step(step, inst.input, inst.id)
                if result.get("error"):
                    task.status = "failed"
                    task.error = str(result["error"])
                    self._log(inst.id, "error", f"第 {idx + 1} 步失败: {result['error']}")
                    if not step.get("continueOnFail", False):
                        all_succeeded = False
                        break
                else:
                    task.status = "completed"
                    task.output = str(result.get("output", ""))
                    self._log(inst.id, "info", f"第 {idx + 1} 步完成")
            except Exception as e:
                task.status = "failed"
                task.error = str(e)
                self._log(inst.id, "error", f"第 {idx + 1} 步异常: {e}")
                if not step.get("continueOnFail", False):
                    all_succeeded = False
                    break

        # 更新最终状态
        inst.status = "completed" if all_succeeded else "failed"
        inst.completedAt = datetime.now(timezone.utc).isoformat()
        self._running_instances.discard(wf.id)
        self._log(
            inst.id,
            "info",
            f"工作流执行完成,状态: {inst.status}",
        )

    async def _execute_step(
        self,
        step: dict[str, Any],
        context: dict[str, Any],
        instance_id: str,
    ) -> dict[str, Any]:
        """执行单步。

        支持 step_type:
        - skill: 调 skill_registry 中的 skill(通过 llm_gateway)
        - llm: 直接调 llm_gateway
        - echo: 返回输入(用于测试)
        - tool: 调 MCP 工具(预留)
        """
        step_type = str(step.get("type", "llm"))
        step_input = str(step.get("input", ""))
        step_skill = str(step.get("skill", ""))

        if step_type == "echo":
            return {"output": step_input or json.dumps(context, ensure_ascii=False)}

        if step_type == "skill":
            if not step_skill:
                return {"error": "skill 类型 step 缺少 skill 字段"}
            skill = skill_registry.get(step_skill)
            if not skill:
                return {"error": f"skill 不存在: {step_skill}"}
            try:
                rendered = skill.render({"input": step_input, **context})
            except Exception as e:
                return {"error": f"skill 模板渲染失败: {e}"}
            try:
                result = await llm_gateway.complete(
                    [{"role": "user", "content": rendered}],
                    temperature=0.7,
                    max_tokens=2000,
                )
            except Exception as e:
                return {"error": f"LLM 调用失败: {e}"}
            if result.get("error"):
                return {"error": str(result.get("error_message", result["error"]))}
            content = str(result.get("content", "")).strip()
            if not content:
                return {"error": "LLM 返回空内容"}
            return {"output": content}

        if step_type == "llm":
            try:
                result = await llm_gateway.complete(
                    [{"role": "user", "content": step_input or "请执行此步骤"}],
                    temperature=0.7,
                    max_tokens=2000,
                )
            except Exception as e:
                return {"error": f"LLM 调用失败: {e}"}
            if result.get("error"):
                return {"error": str(result.get("error_message", result["error"]))}
            content = str(result.get("content", "")).strip()
            return {"output": content or "（无输出）"}

        return {"error": f"不支持的 step type: {step_type}"}

    # =========================================================================
    # 实例管理
    # =========================================================================

    def list_instances(self, workflow_id: str | None = None) -> list[WorkflowInstance]:
        """列出实例(按开始时间降序)。"""
        instances = list(self._instances.values())
        if workflow_id:
            instances = [i for i in instances if i.workflowId == workflow_id]
        return sorted(
            instances,
            key=lambda i: i.startedAt,
            reverse=True,
        )

    def get_instance(self, instance_id: str) -> WorkflowInstance | None:
        """获取单个实例。"""
        return self._instances.get(instance_id)

    def get_instance_tasks(self, instance_id: str) -> list[WorkflowTask]:
        """获取实例的任务列表。"""
        return self._tasks.get(instance_id, [])

    def get_instance_logs(self, instance_id: str) -> list[WorkflowLog]:
        """获取实例的日志列表。"""
        return self._logs.get(instance_id, [])

    async def cancel_instance(self, instance_id: str) -> bool:
        """取消运行中的实例。"""
        inst = self._instances.get(instance_id)
        if not inst:
            return False
        if inst.status not in ("pending", "running"):
            return False
        cancel_event = self._cancel_events.get(instance_id)
        if cancel_event:
            cancel_event.set()
        return True

    async def retry_instance(self, instance_id: str) -> WorkflowInstance | None:
        """重试失败的实例(创建新实例,使用原工作流)。"""
        inst = self._instances.get(instance_id)
        if not inst:
            return None
        if inst.status not in ("failed", "cancelled"):
            return None
        wf = self._workflows.get(inst.workflowId)
        if not wf:
            return None
        return await self.trigger_workflow(inst.workflowId, inst.input)

    # =========================================================================
    # 序列化
    # =========================================================================

    def workflow_to_dict(self, wf: Workflow) -> dict[str, Any]:
        return {
            "id": wf.id,
            "name": wf.name,
            "description": wf.description,
            "triggerType": wf.triggerType,
            "steps": wf.steps,
            "isActive": wf.isActive,
            "createdAt": wf.createdAt,
            "updatedAt": wf.updatedAt,
        }

    def instance_to_dict(self, inst: WorkflowInstance) -> dict[str, Any]:
        return {
            "id": inst.id,
            "workflowId": inst.workflowId,
            "workflowName": inst.workflowName,
            "status": inst.status,
            "startedAt": inst.startedAt,
            "completedAt": inst.completedAt,
            "input": inst.input,
            "output": inst.output,
        }

    def task_to_dict(self, t: WorkflowTask) -> dict[str, Any]:
        return {
            "id": t.id,
            "instanceId": t.instanceId,
            "step": t.step,
            "name": t.name,
            "type": t.type,
            "status": t.status,
            "input": t.input,
            "output": t.output,
            "error": t.error,
        }

    def log_to_dict(self, log: WorkflowLog) -> dict[str, Any]:
        return {
            "id": log.id,
            "instanceId": log.instanceId,
            "timestamp": log.timestamp,
            "level": log.level,
            "message": log.message,
        }


# 全局单例
workflow_engine = WorkflowEngine()